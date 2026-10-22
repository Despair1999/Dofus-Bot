import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { read, write } from "../storage";
import type { View } from "../v2/routing";
import { navigationItems } from "./navigation";

export default function SideNavigation({
  current,
  onNavigate,
  footer,
}: {
  current: View;
  onNavigate: (view: View) => void;
  footer: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [groups, setGroups] = useState<Record<string, boolean>>({
      Entdecken: true,
      Planen: true,
      Tools: false,
      Persönlich: true,
    });
  useEffect(() => {
    void read("ui:sidebar-collapsed", false).then(setCollapsed);
    void read("ui:navigation-groups", {
      Entdecken: true,
      Planen: true,
      Tools: false,
      Persönlich: true,
    }).then(setGroups);
  }, []);
  return (
    <aside className="sidebar ui-sidebar" data-collapsed={collapsed}>
      <div className="ui-sidebar-brand">
        <img
          src={collapsed ? "/branding/icon.png" : "/branding/wordmark.png"}
          alt="DOFUS Companion"
        />
        <button
          className="icon-button"
          aria-label={
            collapsed ? "Seitenleiste erweitern" : "Seitenleiste einklappen"
          }
          onClick={() => {
            setCollapsed(!collapsed);
            void write("ui:sidebar-collapsed", !collapsed);
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
        </button>
      </div>
      <div className="ui-sidebar-caption">DEIN ABENTEUER. DEIN COMPANION.</div>
      <nav aria-label="Hauptnavigation">
        {["Entdecken", "Planen", "Tools", "Persönlich"].map((group) => (
          <section className="ui-nav-group" key={group}>
            <button
              className="ui-nav-group-toggle"
              aria-expanded={collapsed || groups[group]}
              aria-controls={`nav-${group}`}
              onClick={() => {
                const next = { ...groups, [group]: !groups[group] };
                setGroups(next);
                void write("ui:navigation-groups", next);
              }}
            >
              <span>{group}</span>
              <ChevronDown size={12} />
            </button>
            {(collapsed || groups[group]) && (
              <div id={`nav-${group}`} className="ui-nav-group-items">
                {navigationItems
                  .filter((i) => i.group === group)
                  .map((entry) => (
                    <button
                      key={entry.id}
                      className={`nav ${current === entry.id ? "active" : ""}`}
                      aria-label={collapsed ? entry.label : undefined}
                      aria-current={current === entry.id ? "page" : undefined}
                      title={collapsed ? entry.label : entry.description}
                      onClick={() => onNavigate(entry.id)}
                    >
                      <entry.icon size={19} />
                      <span className="ui-nav-label">{entry.label}</span>
                      {entry.id === "scanner" && !collapsed && (
                        <small className="ui-nav-tag">OCR</small>
                      )}
                      {current === entry.id && (
                        <i className="ui-nav-active-dot" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </section>
        ))}
      </nav>
      <div className="ui-sidebar-footer">{footer}</div>
    </aside>
  );
}
