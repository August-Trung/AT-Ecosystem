import { Archive, Crown, Mic2, Moon, Radio, Send, Library } from "lucide-react";
import type { ViewId } from "../types";

const navItems: Array<{ id: ViewId; label: string; icon: typeof Radio }> = [
  { id: "tonight", label: "Tonight", icon: Radio },
  { id: "voices", label: "Voices", icon: Mic2 },
  { id: "stories", label: "Stories", icon: Library },
  { id: "confess", label: "Confess", icon: Send },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "premium", label: "Premium", icon: Crown }
];

interface AppShellProps {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
  children: React.ReactNode;
}

export function AppShell({ activeView, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-mark" type="button" onClick={() => onNavigate("tonight")}>
          <span className="brand-mark__icon">
            <Moon size={18} />
          </span>
          <span>
            <strong>Another Tomorrow</strong>
            <small>A midnight channel for unfinished feelings.</small>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? "nav-item is-active" : "nav-item"}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "mobile-nav__item is-active" : "mobile-nav__item"}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
