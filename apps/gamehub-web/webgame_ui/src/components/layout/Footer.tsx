// src/components/layout/Footer.tsx
import { useLanguage } from "@/contexts/LanguageContext";

const FOOTER_COPY = {
  vi: {
    headline: "GameHub",
    subline: "Kho mini game chơi trực tiếp trên trình duyệt.",
    links: [
      { label: "Sảnh game", href: "/" },
      { label: "Thư viện", href: "/#game-library" },
      { label: "Liên hệ", href: "mailto:team@gamehub.dev" },
    ],
    tagline: "Chơi có trách nhiệm. Xây bằng React và Tailwind.",
  },
  en: {
    headline: "GameHub",
    subline: "Browser mini games you can launch instantly.",
    links: [
      { label: "Game lobby", href: "/" },
      { label: "Library", href: "/#game-library" },
      { label: "Contact", href: "mailto:team@gamehub.dev" },
    ],
    tagline: "Play responsibly. Built with React and Tailwind.",
  },
};

export default function Footer() {
  const { language } = useLanguage();
  const copy = FOOTER_COPY[language];

  return (
    <footer className="mt-12 border-t border-zinc-200 bg-white text-zinc-700">
      <div className="mx-auto max-w-[1680px] px-4 py-8 md:px-8 2xl:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-bold text-slate-800">{copy.headline}</p>
            <p className="text-sm text-zinc-600">{copy.subline}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-zinc-600">
            {copy.links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                className="hover:text-teal-700"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 text-xs font-medium text-zinc-500">
          <span>© {new Date().getFullYear()} Game Hub Collective</span>
          <span>{copy.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
