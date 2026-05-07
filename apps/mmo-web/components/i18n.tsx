import React, {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type Lang = "en" | "vi";

type I18nContextValue = {
	lang: Lang;
	setLang: (lang: Lang) => void;
	toggleLang: () => void;
	t: (en: string, vi: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
	const [lang, setLang] = useState<Lang>("en");

	useEffect(() => {
		const stored = localStorage.getItem("at_tools_lang");
		if (stored === "en" || stored === "vi") {
			setLang(stored);
		}
	}, []);

	const value = useMemo<I18nContextValue>(() => {
		const setLangAndStore = (next: Lang) => {
			setLang(next);
			localStorage.setItem("at_tools_lang", next);
		};
		const toggleLang = () => {
			setLang((prev) => {
				const next = prev === "vi" ? "en" : "vi";
				localStorage.setItem("at_tools_lang", next);
				return next;
			});
		};
		const t = (en: string, vi: string) => (lang === "vi" ? vi : en);
		return { lang, setLang: setLangAndStore, toggleLang, t };
	}, [lang]);

	return (
		<I18nContext.Provider value={value}>{children}</I18nContext.Provider>
	);
};

export const useI18n = () => {
	const ctx = useContext(I18nContext);
	if (!ctx) {
		throw new Error("useI18n must be used within I18nProvider");
	}
	return ctx;
};
