import React, { useEffect, useMemo, useState } from "react";
import { RouterLink } from "../Layout";
import { useI18n } from "../i18n";
import { useSettings } from "../settings";
import { getToolGroups, type ToolGroup } from "../toolRegistry";
import {
	ArrowRight,
	ChevronDown,
	Star,
} from "lucide-react";

type DashboardProps = {
	mode?: "browse" | "favorites" | "recent";
};

const FAVORITES_KEY = "at_tools_favorites";
const RECENTS_KEY = "at_tools_recent";

const Dashboard = ({ mode = "browse" }: DashboardProps) => {
	const { t } = useI18n();
	const { compact } = useSettings();
	const [query, setQuery] = useState("");
	const [groupFilter, setGroupFilter] = useState("all");
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
	const [favorites, setFavorites] = useState<string[]>([]);
	const [recents, setRecents] = useState<string[]>([]);
	const groupedTools = useMemo(() => getToolGroups(t), [t]);

	useEffect(() => {
		const stored = localStorage.getItem(FAVORITES_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) setFavorites(parsed);
			} catch {
				// ignore
			}
		}
	}, []);

	useEffect(() => {
		const stored = localStorage.getItem(RECENTS_KEY);
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) setRecents(parsed);
			} catch {
				// ignore
			}
		}
	}, []);

	const toggleFavorite = (path: string) => {
		setFavorites((prev) => {
			const exists = prev.includes(path);
			const next = exists ? prev.filter((p) => p !== path) : [...prev, path];
			localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
			return next;
		});
	};

	const favoritesGroup = useMemo<ToolGroup | null>(() => {
		const items = groupedTools.flatMap((group) =>
			group.items.filter((item) => favorites.includes(item.path))
		);
		if (items.length === 0) return null;
		return { title: t("Favorites", "Yêu thích"), items };
	}, [favorites, groupedTools, t]);

	const recentGroup = useMemo<ToolGroup | null>(() => {
		const items = groupedTools.flatMap((group) =>
			group.items.filter((item) => recents.includes(item.path))
		);
		if (items.length === 0) return null;
		const ordered = recents
			.map((path) => items.find((item) => item.path === path))
			.filter(Boolean) as ToolItem[];
		return { title: t("Recently Used", "Dùng gần đây"), items: ordered };
	}, [groupedTools, recents, t]);

	const allGroups = useMemo(() => {
		const base = groupedTools as ToolGroup[];
		return favoritesGroup ? [favoritesGroup, ...base] : base;
	}, [favoritesGroup, groupedTools]);

	useEffect(() => {
		const next: Record<string, boolean> = {};
		allGroups.forEach((group) => {
			next[group.title] = openGroups[group.title] ?? true;
		});
		setOpenGroups(next);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [t, allGroups.length]);

	const filteredGroups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const groups =
			mode === "favorites" && favoritesGroup
				? [favoritesGroup]
				: mode === "recent" && recentGroup
				? [recentGroup]
				: allGroups;
		return groups
			.filter((group) => (groupFilter === "all" ? true : group.title === groupFilter))
			.map((group) => ({
				...group,
				items: group.items.filter((tool) => {
					if (!q) return true;
					const hay = `${tool.name} ${tool.desc}`.toLowerCase();
					return hay.includes(q);
				}),
			}))
			.filter((group) => group.items.length > 0);
	}, [allGroups, favoritesGroup, groupFilter, mode, query]);

	const groupOptions = useMemo(() => {
		return [t("All groups", "Tất cả nhóm"), ...groupedTools.map((g) => g.title)];
	}, [groupedTools, t]);

	const titleText =
		mode === "favorites"
			? t("Favorites", "Yêu thích")
			: mode === "recent"
			? t("Recently Used", "Dùng gần đây")
			: t("Browse", "Duyệt");

	return (
		<div>
			<div className="mb-6 text-center lg:text-left">
				<h2 className="text-4xl font-bold text-white mb-2">
					{titleText}{" "}
					<span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">
						AT Tools
					</span>
				</h2>
				{mode === "browse" && (
					<p className="text-gray-400">
						{t(
							"Essential MMO utilities. No ads. No tracking. Pure function.",
							"Bộ tiện ích thiết yếu. Không quảng cáo. Không tracking."
						)}
					</p>
				)}
			</div>

			<div className={`mb-4 flex flex-col md:flex-row ${compact ? "gap-2" : "gap-3"}`}>
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder={t("Search tools...", "Tìm công cụ...")}
					className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				/>
				<select
					value={groupFilter}
					onChange={(e) => setGroupFilter(e.target.value)}
					className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				>
					{groupOptions.map((label, idx) => {
						const value = idx === 0 ? "all" : groupedTools[idx - 1].title;
						return (
							<option key={label} value={value}>
								{label}
							</option>
						);
					})}
				</select>
			</div>

			{filteredGroups.map((group) => (
				<div key={group.title} className="mb-6">
					<button
						onClick={() =>
							setOpenGroups((prev) => ({
								...prev,
								[group.title]: !prev[group.title],
							}))
						}
						className="w-full flex items-center justify-between text-left text-xl font-semibold text-white mb-4">
						<span>{group.title}</span>
						<ChevronDown
							className={`transition-transform ${
								openGroups[group.title] ? "rotate-180" : ""
							}`}
						/>
					</button>
					{openGroups[group.title] && (
						<div
							className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
								compact ? "gap-3" : "gap-4"
							}`}>
							{group.items.map((tool) => {
								const isFav = favorites.includes(tool.path);
								return (
									<RouterLink
										key={tool.path}
										to={tool.path}
										className={`group relative bg-dark-800 border border-dark-700 rounded-2xl ${
											compact ? "p-3" : "p-4"
										} hover:-translate-y-1 transition-all duration-300 hover:shadow-xl hover:shadow-neon-purple/10 hover:border-neon-purple/50`}>
										<button
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												toggleFavorite(tool.path);
											}}
											className={`absolute top-5 right-12 p-1 rounded-full ${
												isFav
													? "text-yellow-400"
													: "text-gray-500 hover:text-yellow-300"
											}`}
											title={t("Pin tool", "Ghim công cụ")}>
											<Star size={18} className={isFav ? "fill-yellow-400" : ""} />
										</button>
										<div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
											<ArrowRight className="text-gray-400" size={20} />
										</div>
										<div
											className={`p-3 rounded-lg bg-dark-900 w-fit mb-4 group-hover:scale-110 transition-transform ${tool.color}`}>
											<tool.icon size={24} />
										</div>
										<h3 className="text-lg font-bold text-gray-200 mb-1 group-hover:text-white">
											{tool.name}
										</h3>
										<p className="text-xs text-gray-500 leading-relaxed">
											{tool.desc}
										</p>
									</RouterLink>
								);
							})}
						</div>
					)}
				</div>
			))}

			{filteredGroups.length === 0 && (
				<div className="text-sm text-gray-500">
					{t("No tools found.", "Không tìm thấy công cụ.")}
				</div>
			)}
		</div>
	);
};

export default Dashboard;
