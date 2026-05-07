// src/components/layout/Header.tsx
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeaderProps {
  currentGame: string | null;
  onBackToMenu: () => void;
}

const NAV_ITEMS = {
  vi: [
    { label: "Sảnh game", href: "/" },
    { label: "Thư viện", href: "/#game-library" },
    { label: "Xếp hạng", href: "/#leaderboard" },
  ],
  en: [
    { label: "Game lobby", href: "/" },
    { label: "Library", href: "/#game-library" },
    { label: "Leaderboard", href: "/#leaderboard" },
  ],
};

export default function Header({ currentGame, onBackToMenu }: HeaderProps) {
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();
  const navItems = NAV_ITEMS[language];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3 md:px-8 2xl:px-10">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-base font-black text-white">
            GH
          </div>
          <div className="leading-tight">
            <p className="text-lg font-bold text-slate-800">GameHub</p>
            <p className="text-xs font-semibold text-zinc-500">
              Mini games web
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-zinc-600 md:flex">
          {navItems.map((item) => {
            const isActive = item.href === "/" && location.pathname === "/";

            return (
              <a
                key={item.href}
                href={item.href}
                className={`transition ${
                  isActive ? "text-slate-800" : "hover:text-teal-700"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700 transition hover:border-teal-500 hover:text-teal-700"
          >
            {language === "vi" ? "EN" : "VI"}
          </button>
          {currentGame && (
            <button
              onClick={onBackToMenu}
              className="rounded-md bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
            >
              {language === "vi" ? "Thoát game" : "Exit game"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
