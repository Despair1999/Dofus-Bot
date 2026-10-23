import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Activity, Listing } from "@dofus/community/model";

export const communityCommand = new SlashCommandBuilder()
  .setName("companion")
  .setDescription("Gemeinsame Companion-Cloud")
  .addSubcommand((s) =>
    s
      .setName("markt")
      .setDescription("Community-Angebote auf deinem Server suchen")
      .addStringOption((o) =>
        o.setName("suche").setDescription("Gegenstand").setMaxLength(120),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("mitglieder")
      .setDescription("Bestätigte Gildenmitglieder anzeigen"),
  )
  .addSubcommand((s) =>
    s.setName("events").setDescription("Offene Gildenaktivitäten anzeigen"),
  )
  .addSubcommand((s) =>
    s.setName("gruppen").setDescription("Offene Dungeon-Gruppen anzeigen"),
  )
  .addSubcommand((s) =>
    s
      .setName("beitreten")
      .setDescription("Mit eigenem Cloud-Charakter einer Gruppe beitreten")
      .addStringOption((o) =>
        o.setName("gruppe").setDescription("Gruppen-ID").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("charakter")
          .setDescription("Eigene Charakter-ID aus dem Companion")
          .setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("rolle")
          .setDescription("Gruppenrolle")
          .addChoices(
            ...[
              "Schaden",
              "Tank",
              "Heilung",
              "Unterstützung",
              "Positionierung",
              "Flexibel",
            ].map((name) => ({ name, value: name })),
          ),
      ),
  );

export async function communityInteraction(i: ChatInputCommandInteraction) {
  if (i.commandName !== "companion") return false;
  if (process.env.COMPANION_COMMUNITY_BOT !== "true")
    throw Error(
      "Die Community-Anbindung ist auf diesem Bot-Host noch nicht eingerichtet.",
    );
  const app =
    getApps().find((a) => a.name === "companion-bot") ??
    initializeApp(
      { projectId: "dofus-companion", credential: applicationDefault() },
      "companion-bot",
    );
  const db = getFirestore(app),
    link = await db.doc(`discordLinks/${i.user.id}`).get();
  const uid = link.data()?.uid;
  if (typeof uid !== "string" || !uid)
    throw Error(
      "Deine Discord-ID wurde noch keinem verifizierten Companion-Account zugeordnet. Bitte die Gildenleitung kontaktieren.",
    );
  const user = await getAuth(app).getUser(uid);
  if (!user.emailVerified || user.disabled)
    throw Error("Ein bestätigter, aktiver Companion-Account ist erforderlich.");
  const profile = await db.doc(`profiles/${uid}`).get();
  if (!profile.exists)
    throw Error("Bitte zuerst das Companion-Profil vervollständigen.");
  const command = i.options.getSubcommand();
  // This trusted bot uses Admin SDK and therefore enforces authorization explicitly on every invocation.
  const membership = await db.doc(`memberships/${uid}`).get();
  if (command !== "markt" && membership.data()?.status !== "approved")
    throw Error(
      "Diese Gildeninformationen sind ausschließlich bestätigten Mitgliedern zugänglich.",
    );
  let content = "";
  if (command === "markt") {
    const rows = await db
      .collection("listings")
      .where("visibility", "==", "global")
      .where("server", "==", profile.data()!.server)
      .where("status", "==", "open")
      .limit(25)
      .get();
    const search = i.options.getString("suche")?.toLocaleLowerCase("de") ?? "";
    const offers = rows.docs
      .map((d) => d.data() as Listing)
      .filter((l) => l.itemName.toLocaleLowerCase("de").includes(search));
    content =
      offers
        .map(
          (l) =>
            `${l.itemName} · ${l.available} Stück · ${l.price} K/Stück · ${l.server}`,
        )
        .join("\n") || "Keine passenden Angebote im geladenen Auszug gefunden.";
  } else if (command === "mitglieder") {
    const rows = await db
      .collection("memberships")
      .where("status", "==", "approved")
      .limit(25)
      .get();
    const names = await Promise.all(
      rows.docs.map(async (m) => {
        const p = await db.doc(`profiles/${m.id}`).get();
        return `${m.data().displayName || p.data()?.dofusName || "Profil nicht verfügbar"} · ${m.data().rank || "Mitglied"}`;
      }),
    );
    content = names.join("\n") || "Keine Mitglieder vorhanden.";
  } else if (command === "events" || command === "gruppen") {
    const rows = await db
      .collection("activities")
      .where("kind", "==", command === "events" ? "event" : "group")
      .where("status", "==", "open")
      .limit(25)
      .get();
    content =
      rows.docs
        .map((d) => {
          const e = d.data() as Activity;
          return `${e.title} · ${new Date(e.startsAt).toLocaleString("de-DE", { timeZone: e.timezone })} (${e.timezone}) · ${e.joined}/${e.capacity} · ID ${d.id}`;
        })
        .join("\n") || "Keine offenen Aktivitäten im geladenen Auszug.";
  } else if (command === "beitreten") {
    const groupId = i.options.getString("gruppe", true),
      characterId = i.options.getString("charakter", true),
      role = i.options.getString("rolle") ?? "Flexibel";
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(groupId) ||
      !/^[-A-Za-z0-9_]{1,128}$/.test(characterId)
    )
      throw Error("Ungültige Gruppen- oder Charakter-ID.");
    const record = await db
      .doc(
        `users/${uid}/records/${encodeURIComponent("characters::rows/" + encodeURIComponent(characterId))}`,
      )
      .get();
    if (!record.exists || record.data()!.deleted)
      throw Error(
        "Dieser Charakter ist nicht in deinem Account synchronisiert.",
      );
    const ch = JSON.parse(record.data()!.payload);
    if (
      ch.id !== characterId ||
      !Number.isInteger(ch.level) ||
      ch.level < 1 ||
      ch.level > 200 ||
      typeof ch.name !== "string"
    )
      throw Error("Ungültige Charakterdaten.");
    await db.runTransaction(async (tx) => {
      const ref = db.doc(`activities/${groupId}`),
        snapshot = await tx.get(ref);
      if (!snapshot.exists) throw Error("Gruppe nicht gefunden.");
      const e = snapshot.data() as Activity;
      if (
        e.kind !== "group" ||
        e.status !== "open" ||
        e.server !== ch.server ||
        e.minLevel > ch.level
      )
        throw Error("Die Gruppe ist für diesen Charakter nicht verfügbar.");
      const participants = { ...e.participants };
      const count = e.joined - Number(participants[uid]?.status === "joined");
      const status = count < e.capacity ? "joined" : "waiting";
      participants[uid] = {
        characterId,
        name: ch.name,
        level: ch.level,
        role,
        status,
      };
      if (Object.keys(participants).length > 100)
        throw Error("Die Warteliste ist voll.");
      tx.update(ref, {
        participants,
        joined: count + Number(status === "joined"),
        revision: e.revision + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      content =
        status === "joined"
          ? "Du bist der Gruppe beigetreten."
          : "Du stehst auf der Warteliste.";
    });
  }
  await i.editReply({
    content: (
      content + "\n\nCompanion-Cloud · Auszug bis zu 25 Einträge"
    ).slice(0, 1950),
    allowedMentions: { parse: [] },
  });
  return true;
}
