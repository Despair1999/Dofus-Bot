import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  inMemoryPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getIdTokenResult,
  onIdTokenChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  getFirestore,
  connectFirestoreEmulator,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type Transaction,
  Timestamp,
} from "firebase/firestore";
import {
  type Activity,
  type CloudRecord,
  type Listing,
  type Participant,
  type Pending,
  type Profile,
  type Reservation,
  type ReservationState,
  listingInput,
  profileSchema,
  reservationDelta,
  transitionReservation,
} from "./model";
import type { CloudTransport } from "./sync";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getBytes,
  deleteObject,
  connectStorageEmulator,
} from "firebase/storage";

export type PlatformConfig = {
  registrationEnabled: boolean;
  privacyUrl: string;
  termsUrl: string;
  legalVersion: string;
  guildName: string;
  server: string;
  description: string;
  discordUrl: string;
  emblem: string;
  rules: string;
  admission: string;
  revision: number;
  lastAudit: string;
  archived?: boolean;
};
export type Role = "owner" | "admin" | "moderator" | "member";
export type RecordClock = { seconds: number; nanoseconds: number };
export class CommunityService {
  readonly app;
  readonly auth;
  readonly db;
  readonly storage;
  private persistence: Promise<void>;
  private emblemRequests = new Map<string, Promise<Blob>>();
  constructor(
    config: FirebaseOptions,
    options: { name?: string; emulator?: boolean } = {},
  ) {
    this.app = initializeApp(config, options.name ?? "companion-community");
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
    if (options.emulator) {
      if (!config.projectId?.startsWith("demo-"))
        throw Error(
          "Emulatoren sind ausschließlich für explizite demo-Projekte erlaubt.",
        );
      connectAuthEmulator(this.auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(this.db, "127.0.0.1", 8080);
      connectStorageEmulator(this.storage, "127.0.0.1", 9199);
    }
    this.persistence = setPersistence(
      this.auth,
      typeof window === "undefined"
        ? inMemoryPersistence
        : browserLocalPersistence,
    );
  }
  get uid() {
    const user = this.auth.currentUser;
    if (!user) throw Error("Bitte anmelden.");
    return user.uid;
  }
  ref(path: string) {
    return doc(this.db, path);
  }
  async get<T>(path: string): Promise<T | null> {
    const result = await getDoc(this.ref(path));
    return result.exists() ? (result.data() as T) : null;
  }
  observeSession(callback: (user: User | null) => void) {
    return onIdTokenChanged(this.auth, callback);
  }
  async login(email: string, password: string) {
    await this.persistence;
    await signInWithEmailAndPassword(this.auth, email, password);
  }
  async logout() {
    await signOut(this.auth);
  }
  async register(
    email: string,
    password: string,
    confirmation: string,
    profile: Profile,
    legalAccepted: boolean,
  ) {
    const clean = profileSchema.parse(profile);
    if (password !== confirmation || password.length < 12)
      throw Error(
        "Passwörter müssen übereinstimmen und mindestens 12 Zeichen lang sein.",
      );
    const settings = await this.get<PlatformConfig>("platform/legal");
    if (
      !settings?.registrationEnabled ||
      !settings.privacyUrl ||
      !settings.termsUrl ||
      !settings.legalVersion ||
      !legalAccepted
    )
      throw Error(
        "Registrierung ist erst nach Einrichtung der rechtlichen Angaben und Zustimmung verfügbar.",
      );
    await this.persistence;
    const { user } = await createUserWithEmailAndPassword(
      this.auth,
      email.trim(),
      password,
    );
    await this.writeOnboarding(user.uid, clean, settings.legalVersion);
    await sendEmailVerification(user);
  }
  private assertSession(uid: string) {
    if (this.auth.currentUser?.uid !== uid)
      throw Error("Account wurde während der Aktion gewechselt.");
  }
  private async writeOnboarding(
    uid: string,
    profile: Profile,
    legalVersion: string,
  ) {
    this.assertSession(uid);
    const batch = writeBatch(this.db);
    batch.set(this.ref(`profiles/${uid}`), {
      ...profileSchema.parse(profile),
      uid,
      updatedAt: serverTimestamp(),
    });
    batch.set(this.ref(`users/${uid}/account/consent`), {
      legalVersion,
      legalAcceptedAt: serverTimestamp(),
    });
    await batch.commit();
    this.assertSession(uid);
  }
  async saveProfile(profile: Profile) {
    const uid = this.uid,
      clean = profileSchema.parse(profile),
      current = await this.get(`profiles/${uid}`);
    this.assertSession(uid);
    if (!current) throw Error("Onboarding muss abgeschlossen werden.");
    await setDoc(this.ref(`profiles/${uid}`), {
      ...clean,
      uid,
      updatedAt: serverTimestamp(),
    });
  }
  async completeOnboarding(profile: Profile, accepted: boolean) {
    const uid = this.uid,
      settings = await this.get<PlatformConfig>("platform/legal");
    this.assertSession(uid);
    if (!settings?.registrationEnabled || !settings.legalVersion || !accepted)
      throw Error("Betreiberfreigabe und rechtliche Zustimmung fehlen.");
    await this.writeOnboarding(uid, profile, settings.legalVersion);
  }
  async reset(email: string) {
    await sendPasswordResetEmail(this.auth, email);
  }
  async verify() {
    const user = this.auth.currentUser;
    if (user) await sendEmailVerification(user);
  }
  async refreshVerification() {
    const user = this.auth.currentUser;
    if (user) {
      await reload(user);
      await user.getIdToken(true);
    }
  }
  async role(): Promise<Role> {
    const result = await this.get<{ role: Role }>(`roles/${this.uid}`);
    return result?.role ?? "member";
  }
  async reauthenticate(password: string) {
    const user = this.auth.currentUser;
    if (!user?.email) throw Error("E-Mail-/Passwortkonto erforderlich.");
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    );
    await user.getIdToken(true);
    const token = await getIdTokenResult(user);
    this.assertSession(user.uid);
    if (Date.now() - new Date(token.authTime).getTime() > 300000)
      throw Error("Authentifizierung ist nicht aktuell.");
  }
  transport(uid: string): CloudTransport {
    return {
      put: (mutation: Pending, deviceId: string) =>
        runTransaction(this.db, async (tx) => {
          if (this.uid !== uid) throw Error("Account gewechselt.");
          const ref = this.ref(
            `users/${uid}/records/${encodeURIComponent(mutation.key)}`,
          );
          const result = await tx.get(ref);
          const current = result.exists()
            ? (result.data() as CloudRecord)
            : null;
          if (current?.mutationId === mutation.mutationId) return current;
          if ((current?.revision ?? 0) !== mutation.baseRevision)
            return current!;
          const next: CloudRecord = {
            key: mutation.key,
            payload: mutation.payload,
            deleted: mutation.deleted,
            mutationId: mutation.mutationId,
            revision: mutation.baseRevision + 1,
            deviceId,
          };
          tx.set(ref, { ...next, updatedAt: serverTimestamp() });
          return next;
        }),
    };
  }
  watchRecords(
    uid: string,
    callback: (records: CloudRecord[]) => Promise<void> | void,
    error: (e: Error) => void,
    since?: RecordClock | null,
  ) {
    // A small live tail wakes a paginated delta catch-up. No record-count ceiling can hide older changes.
    let watermark: Timestamp | null = since
      ? new Timestamp(since.seconds, since.nanoseconds)
      : null;
    let serial = Promise.resolve();
    let queued = false;
    let stopped = false;
    const unsubscribe = onSnapshot(
      query(
        collection(this.db, `users/${uid}/records`),
        orderBy("updatedAt", "desc"),
        limit(1),
      ),
      () => {
        if (queued || stopped) return;
        queued = true;
        serial = serial
          .then(async () => {
            queued = false;
            let cursor: DocumentSnapshot | undefined;
            let nextWatermark = watermark;
            do {
              const page = await getDocs(
                query(
                  collection(this.db, `users/${uid}/records`),
                  ...(watermark ? [where("updatedAt", ">=", watermark)] : []),
                  orderBy("updatedAt"),
                  orderBy(documentId()),
                  limit(100),
                  ...(cursor ? [startAfter(cursor)] : []),
                ),
              );
              if (stopped) return;
              await callback(page.docs.map((d) => d.data() as CloudRecord));
              for (const row of page.docs) {
                const time = row.data().updatedAt as Timestamp;
                if (
                  !nextWatermark ||
                  time.seconds > nextWatermark.seconds ||
                  (time.seconds === nextWatermark.seconds &&
                    time.nanoseconds > nextWatermark.nanoseconds)
                )
                  nextWatermark = time;
              }
              if (page.size < 100) break;
              cursor = page.docs.at(-1);
            } while (!stopped);
            watermark = nextWatermark;
          })
          .catch(error);
      },
      error,
    );
    return () => {
      stopped = true;
      unsubscribe();
    };
  }
  cloudClock(
    records: CloudRecord[],
    fallback: RecordClock | null = null,
  ): RecordClock | null {
    let clock = fallback;
    for (const record of records) {
      const time = (record as CloudRecord & { updatedAt?: RecordClock })
        .updatedAt;
      if (
        time &&
        (!clock ||
          time.seconds > clock.seconds ||
          (time.seconds === clock.seconds &&
            time.nanoseconds > clock.nanoseconds))
      )
        clock = { seconds: time.seconds, nanoseconds: time.nanoseconds };
    }
    return clock;
  }
  async records(
    uid = this.uid,
    since?: RecordClock | null,
  ): Promise<CloudRecord[]> {
    const all: CloudRecord[] = [];
    let cursor: DocumentSnapshot | undefined;
    while (true) {
      const snapshot = await getDocs(
        query(
          collection(this.db, `users/${uid}/records`),
          ...(since
            ? [
                where(
                  "updatedAt",
                  ">=",
                  new Timestamp(since.seconds, since.nanoseconds),
                ),
                orderBy("updatedAt"),
              ]
            : []),
          orderBy(documentId()),
          limit(100),
          ...(cursor ? [startAfter(cursor)] : []),
        ),
      );
      all.push(...snapshot.docs.map((d) => d.data() as CloudRecord));
      if (snapshot.size < 100) return all;
      cursor = snapshot.docs.at(-1);
    }
  }
  async page<T>(
    path: string,
    filters: QueryConstraint[] = [],
    cursor?: DocumentSnapshot,
    recent = false,
  ) {
    const snapshot = await getDocs(
      query(
        collection(this.db, path),
        ...filters,
        ...(recent
          ? [orderBy("createdAt", "desc"), orderBy(documentId(), "desc")]
          : [orderBy(documentId())]),
        limit(25),
        ...(cursor ? [startAfter(cursor)] : []),
      ),
    );
    return {
      items: snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as T),
      cursor: snapshot.docs.at(-1),
      hasMore: snapshot.size === 25,
    };
  }
  watch<T>(
    path: string,
    callback: (data: T | null) => void,
    error: (e: Error) => void,
  ) {
    return onSnapshot(
      this.ref(path),
      (s) => callback(s.exists() ? (s.data() as T) : null),
      error,
    );
  }
  async requestMembership() {
    await setDoc(this.ref(`memberships/${this.uid}`), {
      uid: this.uid,
      status: "pending",
      rank: "",
      displayName: "",
      revision: 1,
      lastAudit: "",
      updatedAt: serverTimestamp(),
    });
  }
  async uploadEmblem(blob: Blob) {
    const uid = this.uid;
    if (blob.type !== "image/webp" || blob.size < 12 || blob.size > 200000)
      throw Error("Das Wappen muss als WebP bis 200 KB vorliegen.");
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (
      String.fromCharCode(...header.slice(0, 4)) !== "RIFF" ||
      String.fromCharCode(...header.slice(8, 12)) !== "WEBP"
    )
      throw Error("Ungültige WebP-Datei.");
    this.assertSession(uid);
    const path = `guild-emblems/default/${crypto.randomUUID()}.webp`;
    await uploadBytes(storageRef(this.storage, path), blob, {
      contentType: "image/webp",
      cacheControl: "private,max-age=86400",
      customMetadata: { uploadedBy: uid },
    });
    return path;
  }
  async readEmblem(path: string) {
    if (!/^guild-emblems\/default\/[a-f0-9-]+\.webp$/.test(path))
      throw Error("Ungültiger Wappenpfad.");
    const uid = this.uid,
      key = uid + ":" + path;
    // Coalesce simultaneous renders without keeping an authorization-bypassing persistent cache.
    let request = this.emblemRequests.get(key);
    if (!request) {
      request = getBytes(storageRef(this.storage, path), 200000)
        .then((bytes) => {
          this.assertSession(uid);
          return new Blob([bytes], { type: "image/webp" });
        })
        .finally(() => this.emblemRequests.delete(key));
      this.emblemRequests.set(key, request);
    }
    return request;
  }
  async removeUnusedEmblem(path: string) {
    if (path.startsWith("guild-emblems/default/"))
      await deleteObject(storageRef(this.storage, path));
  }
  async saveSettings(value: PlatformConfig, reason: string) {
    const audit = crypto.randomUUID();
    await runTransaction(this.db, async (tx) => {
      const guild = await tx.get(this.ref("platform/config")),
        legal = await tx.get(this.ref("platform/legal"));
      if (!guild.exists() || !legal.exists())
        throw Error(
          "Gilden- oder Rechtstextkonfiguration wurde noch nicht initialisiert.",
        );
      if (guild.data().revision !== value.revision)
        throw Error(
          "Gildeneinstellungen wurden inzwischen verändert. Bitte neu laden.",
        );
      const {
        guildName,
        server,
        description,
        discordUrl,
        emblem,
        rules,
        admission,
      } = value;
      const { registrationEnabled, privacyUrl, termsUrl, legalVersion } = value;
      const guildAfter = {
        guildName,
        server,
        description,
        discordUrl,
        emblem,
        rules,
        admission,
        archived: value.archived ?? false,
        revision: value.revision + 1,
        lastAudit: audit,
        updatedAt: serverTimestamp(),
      };
      const legalAfter = {
        registrationEnabled,
        privacyUrl,
        termsUrl,
        legalVersion,
        guildActive: !value.archived,
        revision: legal.data().revision + 1,
        lastAudit: audit + "-legal",
        updatedAt: serverTimestamp(),
      };
      this.audit(
        tx,
        audit,
        "platform/config",
        guild.data(),
        guildAfter,
        reason,
      );
      this.audit(
        tx,
        audit + "-legal",
        "platform/legal",
        legal.data(),
        legalAfter,
        reason,
      );
      tx.set(guild.ref, guildAfter);
      tx.set(legal.ref, legalAfter);
      tx.set(this.ref(`guildAnnouncements/${audit}`), {
        actorUid: this.uid,
        text: "Die Gildeninformationen wurden aktualisiert.",
        createdAt: serverTimestamp(),
      });
    });
  }
  async createListing(input: unknown) {
    const value = listingInput.parse(input),
      id = crypto.randomUUID();
    await setDoc(this.ref(`listings/${id}`), {
      ...value,
      id,
      ownerUid: this.uid,
      available: value.quantity,
      revision: 1,
      lastReservation: "",
      lastAudit: "",
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  }
  async report(target: string, reason: string) {
    if (
      !/^(listings|activities)\/[a-zA-Z0-9-]+(\/comments\/[a-zA-Z0-9-]+)?$/.test(
        target,
      ) ||
      reason.trim().length < 10 ||
      reason.length > 1000
    )
      throw Error(
        "Bitte einen gültigen Inhalt und einen Grund mit 10 bis 1000 Zeichen angeben.",
      );
    const uid = this.uid,
      id = crypto.randomUUID();
    await runTransaction(this.db, async (tx) => {
      const throttle = this.ref(`users/${uid}/account/reportLimit`),
        snapshot = await tx.get(throttle);
      const last = snapshot.data()?.createdAt?.toMillis?.() ?? 0;
      if (Date.now() - last < 60000)
        throw Error("Bitte mindestens eine Minute zwischen Meldungen warten.");
      tx.set(throttle, { reportId: id, createdAt: serverTimestamp() });
      tx.set(this.ref(`reports/${id}`), {
        reporterUid: uid,
        target,
        reason: reason.trim(),
        status: "open",
        resolution: "",
        revision: 1,
        lastAudit: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }
  async reserve(listingId: string, quantity: number) {
    const uid = this.uid;
    if (!Number.isInteger(quantity) || quantity < 1)
      throw Error("Ungültige Menge.");
    const id = crypto.randomUUID(),
      listing = await this.get<Listing>(`listings/${listingId}`);
    if (
      !listing ||
      listing.ownerUid === uid ||
      listing.status !== "open" ||
      quantity > listing.available
    )
      throw Error("Angebot ist nicht reservierbar.");
    this.assertSession(uid);
    await setDoc(this.ref(`reservations/${id}`), {
      id,
      listingId,
      buyerUid: uid,
      sellerUid: listing.ownerUid,
      quantity,
      state: "requested",
      revision: 1,
      lastAudit: "",
      updatedAt: serverTimestamp(),
    });
  }
  async reservation(id: string, state: ReservationState, reason = "") {
    const uid = this.uid,
      auditId = crypto.randomUUID();
    await runTransaction(this.db, async (tx) => {
      const r = await tx.get(this.ref(`reservations/${id}`));
      if (!r.exists()) throw Error("Reservierung fehlt.");
      const before = r.data() as Reservation;
      const l = await tx.get(this.ref(`listings/${before.listingId}`));
      if (!l.exists()) throw Error("Angebot fehlt.");
      const listing = l.data() as Listing;
      const admin = uid !== before.buyerUid && uid !== before.sellerUid;
      const next = transitionReservation(before, state, uid, admin);
      const delta = reservationDelta(before.state, state, before.quantity);
      if (listing.available - delta < 0)
        throw Error("Nicht mehr ausreichend verfügbar.");
      const after = {
        ...next,
        lastAudit: admin ? auditId : before.lastAudit,
        updatedAt: serverTimestamp(),
      };
      const listingAfter = {
        ...listing,
        available: listing.available - delta,
        lastReservation: id,
        revision: listing.revision + 1,
        lastAudit: admin ? auditId + "-listing" : listing.lastAudit,
        updatedAt: serverTimestamp(),
      };
      if (admin) {
        this.audit(tx, auditId, `reservations/${id}`, r.data(), after, reason);
        this.audit(
          tx,
          auditId + "-listing",
          `listings/${listing.id}`,
          l.data(),
          listingAfter,
          reason,
        );
      }
      tx.set(r.ref, after);
      tx.set(l.ref, listingAfter);
      this.notify(
        tx,
        crypto.randomUUID(),
        before.buyerUid,
        "reservation",
        id,
        "Reservierung: " + state,
      );
    });
  }
  private notify(
    tx: Transaction,
    id: string,
    uid: string,
    kind: string,
    subjectId: string,
    text: string,
  ) {
    tx.set(this.ref(`users/${uid}/notifications/${id}`), {
      kind,
      subjectId,
      text,
      read: false,
      actorUid: this.uid,
      createdAt: serverTimestamp(),
    });
  }
  async comment(listingId: string, text: string) {
    if (!text.trim() || text.length > 2000)
      throw Error("Kommentar muss 1–2000 Zeichen enthalten.");
    await setDoc(
      this.ref(`listings/${listingId}/comments/${crypto.randomUUID()}`),
      {
        ownerUid: this.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        revision: 1,
        lastAudit: "",
        moderated: false,
      },
    );
  }
  async createActivity(
    input: Omit<
      Activity,
      | "id"
      | "ownerUid"
      | "participants"
      | "joined"
      | "status"
      | "revision"
      | "lastAudit"
    >,
  ) {
    if (
      !input.title.trim() ||
      input.title.length > 160 ||
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > 100 ||
      !Number.isInteger(input.minLevel) ||
      input.minLevel < 1 ||
      input.minLevel > 200 ||
      !Number.isFinite(Date.parse(input.startsAt))
    )
      throw Error("Titel, Termin, Level oder Teilnehmerlimit ist ungültig.");
    Intl.DateTimeFormat("de", { timeZone: input.timezone });
    const id = crypto.randomUUID();
    await setDoc(this.ref(`activities/${id}`), {
      ...input,
      id,
      ownerUid: this.uid,
      joined: 0,
      participants: {},
      lastParticipantUid: "",
      status: "open",
      revision: 1,
      lastAudit: "",
      updatedAt: serverTimestamp(),
    });
  }
  async participate(
    id: string,
    participant: Omit<Participant, "status"> | null,
  ) {
    const uid = this.uid;
    await runTransaction(this.db, async (tx) => {
      const ref = this.ref(`activities/${id}`),
        s = await tx.get(ref);
      if (!s.exists()) throw Error("Aktivität fehlt.");
      const value = s.data() as Activity;
      if (value.status !== "open") throw Error("Aktivität ist geschlossen.");
      if (participant && participant.level < value.minLevel)
        throw Error("Mindestlevel nicht erreicht.");
      const participants = { ...value.participants };
      const wasJoined = participants[uid]?.status === "joined";
      delete participants[uid];
      let joined = value.joined - Number(wasJoined);
      if (participant) {
        const status = joined < value.capacity ? "joined" : "waiting";
        participants[uid] = { ...participant, status };
        joined += Number(status === "joined");
      }
      tx.update(ref, {
        participants,
        joined,
        lastParticipantUid: uid,
        revision: value.revision + 1,
        updatedAt: serverTimestamp(),
      });
      if (
        participants[uid]?.status === "joined" &&
        value.participants[uid]?.status === "waiting"
      )
        this.notify(
          tx,
          crypto.randomUUID(),
          uid,
          "activity-self",
          id,
          "Du hast einen bestätigten Gruppenplatz erhalten.",
        );
    });
  }
  async moderateParticipant(
    id: string,
    targetUid: string,
    participant: Participant | null,
    revision: number,
    reason: string,
  ) {
    const auditId = crypto.randomUUID();
    await runTransaction(this.db, async (tx) => {
      const ref = this.ref(`activities/${id}`),
        snapshot = await tx.get(ref);
      if (!snapshot.exists() || snapshot.data().revision !== revision)
        throw Error("Aktivität wurde inzwischen geändert. Neu laden.");
      const before = snapshot.data() as Activity,
        participants = { ...before.participants };
      let joined =
        before.joined - Number(participants[targetUid]?.status === "joined");
      delete participants[targetUid];
      if (participant) {
        if (
          participant.level < before.minLevel ||
          participant.level > 200 ||
          !Number.isInteger(participant.level) ||
          !participant.name.trim() ||
          participant.name.length > 60
        )
          throw Error("Ungültige Teilnehmerdaten.");
        participants[targetUid] = participant;
        joined += Number(participant.status === "joined");
      }
      if (joined > before.capacity || joined < 0)
        throw Error("Teilnehmerlimit würde verletzt.");
      const after = {
        ...before,
        participants,
        joined,
        lastParticipantUid: targetUid,
        revision: revision + 1,
        lastAudit: auditId,
        updatedAt: serverTimestamp(),
      };
      this.audit(
        tx,
        auditId,
        `activities/${id}`,
        snapshot.data(),
        after,
        reason,
      );
      tx.set(ref, after);
      this.notify(
        tx,
        auditId,
        targetUid,
        "activity-admin",
        id,
        "Dein Gruppenplatz wurde administrativ aktualisiert.",
      );
    });
  }
  private audit(
    tx: Transaction,
    id: string,
    target: string,
    before: DocumentData,
    after: DocumentData,
    reason: string,
  ) {
    if (reason.trim().length < 5)
      throw Error(
        "Bitte einen Änderungsgrund mit mindestens fünf Zeichen angeben.",
      );
    tx.set(this.ref(`audit/${id}`), {
      actorUid: this.uid,
      target,
      before,
      after,
      reason: reason.trim(),
      createdAt: serverTimestamp(),
    });
  }
  async edit(
    path: string,
    changes: Record<string, unknown>,
    revision: number,
    reason = "",
    admin = false,
  ) {
    const id = crypto.randomUUID();
    await runTransaction(this.db, async (tx) => {
      const ref = this.ref(path),
        s = await tx.get(ref);
      if (!s.exists() || s.data().revision !== revision)
        throw Error("Datensatz wurde verändert. Neu laden und vergleichen.");
      const after: DocumentData = {
        ...s.data(),
        ...changes,
        revision: revision + 1,
        lastAudit: admin ? id : s.data().lastAudit,
        updatedAt: serverTimestamp(),
      };
      if (path.startsWith("activities/")) {
        if (
          typeof after.title !== "string" ||
          !after.title.trim() ||
          after.title.length > 160 ||
          !Number.isInteger(after.capacity) ||
          after.capacity < after.joined ||
          after.capacity < 1 ||
          after.capacity > 100 ||
          !Number.isInteger(after.minLevel) ||
          after.minLevel < 1 ||
          after.minLevel > 200 ||
          !Number.isFinite(Date.parse(after.startsAt))
        )
          throw Error("Titel, Datum, Level oder Teilnehmerlimit ist ungültig.");
        Intl.DateTimeFormat("de", { timeZone: after.timezone });
      }
      if (path.startsWith("listings/") && typeof changes.quantity === "number")
        after.available =
          Number(s.data().available) +
          changes.quantity -
          Number(s.data().quantity);
      const eventNotice =
        path.startsWith("activities/") &&
        [
          "title",
          "description",
          "startsAt",
          "timezone",
          "meeting",
          "status",
          "capacity",
        ].some((field) => field in changes);
      if (eventNotice) after.lastNotice = id;
      if (admin) this.audit(tx, id, path, s.data(), after, reason);
      tx.set(ref, after);
      if (admin && path.startsWith("guildCharacters/"))
        this.notify(
          tx,
          id,
          path.split("/")[1],
          "guild-character",
          path.split("/")[1],
          "Deine freigegebenen Gildencharaktere wurden korrigiert.",
        );
      if (eventNotice && Object.keys(s.data().participants ?? {}).length)
        tx.set(this.ref(`activityAnnouncements/${id}`), {
          actorUid: this.uid,
          activityId: path.split("/")[1],
          recipientUids: Object.keys(s.data().participants),
          text: "Eine gemeinsame Aktivität wurde aktualisiert.",
          createdAt: serverTimestamp(),
        });

      if (admin && path.startsWith("memberships/"))
        this.notify(
          tx,
          id,
          path.split("/")[1],
          "membership",
          path.split("/")[1],
          "Deine Gildenmitgliedschaft wurde aktualisiert.",
        );
    });
  }
  async exportAccount() {
    const uid = this.uid,
      profile = await this.get(`profiles/${uid}`);
    this.assertSession(uid);
    const records = await this.records(uid),
      consent = await this.get(`users/${uid}/account/consent`);
    this.assertSession(uid);
    return { profile, records, consent, exportedAt: new Date().toISOString() };
  }
  async undoAudit(id: string, reason: string) {
    if (reason.trim().length < 5 || reason.length > 500)
      throw Error("Bitte einen Änderungsgrund mit 5 bis 500 Zeichen angeben.");
    const log = await this.get<{
      target: string;
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    }>(`audit/${id}`);
    if (!log) throw Error("Änderung nicht gefunden.");
    const kind = log.target.split("/")[0],
      allowed: Record<string, string[]> = {
        memberships: ["displayName", "rank", "status"],
        guildCharacters: ["characters"],
        listings: [
          "itemName",
          "itemId",
          "quantity",
          "price",
          "server",
          "description",
          "type",
          "status",
        ],
        activities: [
          "title",
          "description",
          "startsAt",
          "timezone",
          "meeting",
          "minLevel",
          "capacity",
          "status",
        ],
        reports: ["status", "resolution"],
      };
    const fields =
      log.target.split("/").length === 4 && log.target.includes("/comments/")
        ? ["text", "moderated"]
        : allowed[kind];
    if (!fields)
      throw Error(
        "Diese gekoppelte Änderung muss über ihren Fachdialog korrigiert werden.",
      );
    const current = await this.get<{ revision: number; lastAudit: string }>(
      log.target,
    );
    if (
      !current ||
      current.lastAudit !== id ||
      current.revision !== log.after.revision
    )
      throw Error(
        "Inzwischen bestehen weitere Änderungen. Bitte im Fachdialog vergleichen.",
      );
    const patch = Object.fromEntries(
      fields
        .filter(
          (f) =>
            f in log.before &&
            JSON.stringify(log.before[f]) !== JSON.stringify(log.after[f]),
        )
        .map((f) => [f, log.before[f]]),
    );
    if (!Object.keys(patch).length)
      throw Error(
        "Keine unmittelbar rücknehmbaren Fachwerte. Teilnehmer oder Reservierungen separat korrigieren.",
      );
    await this.edit(
      log.target,
      patch,
      current.revision,
      `Rücknahme ${id}: ${reason}`,
      true,
    );
  }
  async deleteAccount(password: string) {
    const uid = this.uid,
      originalUser = this.auth.currentUser!;
    await this.reauthenticate(password);
    this.assertSession(uid);
    // Refuse to orphan marketplace obligations or the operator's last owner account.
    if ((await this.role()) !== "member")
      throw Error(
        "Privilegierte Konten können nur nach Betreiberprüfung entfernt werden.",
      );
    const ownListings = await getDocs(
      query(
        collection(this.db, "listings"),
        where("ownerUid", "==", uid),
        where("status", "in", ["open", "paused"]),
        limit(1),
      ),
    );
    if (!ownListings.empty)
      throw Error(
        "Bitte zuerst alle offenen Angebote zurückziehen und Reservierungen abschließen.",
      );
    const requests = await getDocs(
      query(
        collection(this.db, "reservations"),
        where("buyerUid", "==", uid),
        where("state", "in", ["requested", "accepted"]),
        limit(1),
      ),
    );
    if (!requests.empty) throw Error("Es bestehen noch offene Reservierungen.");
    const sellerRequests = await getDocs(
      query(
        collection(this.db, "reservations"),
        where("sellerUid", "==", uid),
        where("state", "in", ["requested", "accepted"]),
        limit(1),
      ),
    );
    if (!sellerRequests.empty)
      throw Error("Zu deinen Angeboten bestehen noch offene Reservierungen.");
    const deletionPath = `accountDeletions/${uid}`;
    if (!(await this.get(deletionPath)))
      await setDoc(this.ref(deletionPath), {
        state: "pending",
        createdAt: serverTimestamp(),
      });
    this.assertSession(uid);
    const records = await this.records(uid);
    for (let offset = 0; offset < records.length; offset += 200) {
      const batch = writeBatch(this.db);
      for (const r of records.slice(offset, offset + 200))
        batch.delete(
          this.ref(`users/${uid}/records/${encodeURIComponent(r.key)}`),
        );
      await batch.commit();
    }
    const batch = writeBatch(this.db);
    batch.delete(this.ref(`profiles/${uid}`));
    batch.delete(this.ref(`memberships/${uid}`));
    batch.delete(this.ref(`guildCharacters/${uid}`));
    batch.delete(this.ref(`users/${uid}/account/consent`));
    batch.delete(this.ref(`users/${uid}/account/reportLimit`));
    await batch.commit();
    while (true) {
      const notifications = await getDocs(
        query(collection(this.db, `users/${uid}/notifications`), limit(100)),
      );
      if (notifications.empty) break;
      const cleanup = writeBatch(this.db);
      notifications.docs.forEach((d) => cleanup.delete(d.ref));
      await cleanup.commit();
    }
    this.assertSession(uid);
    await deleteUser(originalUser);
  }
}

let service: CommunityService | null = null;
export function communityService(
  config: FirebaseOptions,
  options?: { name?: string; emulator?: boolean },
) {
  return (service ??= new CommunityService(config, options));
}
