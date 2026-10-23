import { useEffect, useState } from "react";
import type { CommunityService } from "./firebase";
import type { Profile } from "./model";
// One live subscription per visible UID and service, released with the last consumer.
const sources = new WeakMap<
  CommunityService,
  Map<
    string,
    {
      value: Profile | null;
      listeners: Set<(p: Profile | null) => void>;
      stop: () => void;
    }
  >
>();
export function usePublicProfile(service: CommunityService, uid: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    setProfile(null);
    let entries = sources.get(service);
    if (!entries) {
      entries = new Map();
      sources.set(service, entries);
    }
    let source = entries.get(uid);
    if (!source) {
      source = { value: null, listeners: new Set(), stop: () => {} };
      entries.set(uid, source);
      const current = source;
      source.stop = service.watch<Profile>(
        `profiles/${uid}`,
        (p) => {
          current.value = p;
          current.listeners.forEach((fn) => fn(p));
        },
        () => {
          current.value = null;
          current.listeners.forEach((fn) => fn(null));
        },
      );
    }
    source.listeners.add(setProfile);
    setProfile(source.value);
    return () => {
      source.listeners.delete(setProfile);
      if (!source.listeners.size) {
        source.stop();
        entries.delete(uid);
      }
    };
  }, [service, uid]);
  return profile;
}
