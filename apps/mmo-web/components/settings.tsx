import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

type SettingsContextValue = {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	compact: boolean;
	setCompact: (compact: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const THEME_KEY = "at_tools_theme";
const COMPACT_KEY = "at_tools_compact";

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
	const [theme, setTheme] = useState<Theme>("dark");
	const [compact, setCompact] = useState(false);

	useEffect(() => {
		const storedTheme = localStorage.getItem(THEME_KEY);
		const storedCompact = localStorage.getItem(COMPACT_KEY);
		if (storedTheme === "dark" || storedTheme === "light") {
			setTheme(storedTheme);
		}
		if (storedCompact === "true" || storedCompact === "false") {
			setCompact(storedCompact === "true");
		}
	}, []);

	useEffect(() => {
		localStorage.setItem(THEME_KEY, theme);
		const root = document.documentElement;
		const body = document.body;
		const appRoot = document.getElementById("root");
		root.classList.toggle("dark", theme === "dark");
		root.classList.toggle("theme-light", theme === "light");
		body.classList.toggle("dark", theme === "dark");
		body.classList.toggle("theme-light", theme === "light");
		if (appRoot) {
			appRoot.classList.toggle("dark", theme === "dark");
			appRoot.classList.toggle("theme-light", theme === "light");
		}
	}, [theme]);

	useEffect(() => {
		localStorage.setItem(COMPACT_KEY, compact ? "true" : "false");
	}, [compact]);

	const value = useMemo<SettingsContextValue>(
		() => ({ theme, setTheme, compact, setCompact }),
		[theme, compact]
	);

	return (
		<SettingsContext.Provider value={value}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = () => {
	const ctx = useContext(SettingsContext);
	if (!ctx) {
		throw new Error("useSettings must be used within SettingsProvider");
	}
	return ctx;
};
