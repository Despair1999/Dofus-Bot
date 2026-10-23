import {
  CommunityPage,
  CommunityProvider,
  type Section,
} from "@dofus/community/ui";
import { browserStore } from "@dofus/community/browser-store";
import { communityDungeons, searchCommunityItems } from "./community-catalog";

const sections: { id: Section; label: string }[] = [
  { id: "account", label: "Account & Cloud" },
  { id: "guild", label: "Gildenübersicht" },
  { id: "marketplace", label: "Marktplatz" },
  { id: "events", label: "Events" },
  { id: "groups", label: "Gruppenfinder" },
];

export default function CommunityArea({ path }: { path: string }) {
  const requested = path.split("/")[2] || "account";
  const selected = requested === "members" ? "guild" : requested;
  if (requested === "members")
    history.replaceState(null, "", "/community/guild?section=members");
  return (
    <CommunityProvider
      emulators={
        (import.meta.env.DEV || import.meta.env.MODE === "emulator-test") &&
        import.meta.env.VITE_COMMUNITY_EMULATORS === "true"
      }
      store={browserStore}
      searchItems={searchCommunityItems}
      dungeons={communityDungeons}
    >
      <div className="cc">
        <nav className="cc-tabs" aria-label="Community">
          {sections.map((s) => (
            <a key={s.id} href={`/community/${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
      </div>
      <CommunityPage
        section={sections.find((s) => s.id === selected)?.id || "account"}
      />
    </CommunityProvider>
  );
}
