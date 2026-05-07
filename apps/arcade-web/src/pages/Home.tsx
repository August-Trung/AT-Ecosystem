import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Search,
	Flame,
	PlayCircle,
	FolderOpen,
	History,
	Heart,
	Brain,
	Car,
	Swords,
	Rocket,
	Trophy,
	SortAsc,
	LayoutGrid,
} from "lucide-react";
import GameCard from "../components/GameCard";
import { gameList, categories } from "../data/gameList";
import { Game } from "../types";

const Home: React.FC = () => {
	const [searchTerm, setSearchTerm] = useState("");
	const [activeCategory, setActiveCategory] = useState("All");
	const [favorites, setFavorites] = useState<string[]>([]);
	const [recentIds, setRecentIds] = useState<string[]>([]);
	const [sortOption, setSortOption] = useState<"rating" | "name">("rating");

	// Carousel State
	const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

	const navigate = useNavigate();
	const location = useLocation();

	// Helper for Category Icons
	const getCategoryIcon = (cat: string) => {
		switch (cat.toLowerCase()) {
			case "action":
				return <Swords size={16} />;
			case "puzzle":
				return <Brain size={16} />;
			case "racing":
				return <Car size={16} />;
			case "strategy":
				return <Trophy size={16} />;
			case "arcade":
				return <Rocket size={16} />;
			default:
				return <LayoutGrid size={16} />;
		}
	};

	// Load persistence data
	useEffect(() => {
		const storedFavs = localStorage.getItem("arcade_favorites");
		const storedRecents = localStorage.getItem("arcade_recents");
		if (storedFavs) setFavorites(JSON.parse(storedFavs));
		if (storedRecents) setRecentIds(JSON.parse(storedRecents));
	}, []);

	// Hero Carousel Logic: Top 5 Highest Rated Games
	const heroGames = useMemo(() => {
		return [...gameList].sort((a, b) => b.rating - a.rating).slice(0, 5);
	}, []);

	// Auto-slide Effect
	useEffect(() => {
		if (heroGames.length <= 1) return;
		const interval = setInterval(() => {
			setCurrentHeroIndex((prev) => (prev + 1) % heroGames.length);
		}, 5000); // Change every 5 seconds
		return () => clearInterval(interval);
	}, [heroGames.length]);

	const toggleFavorite = (e: React.MouseEvent, gameId: string) => {
		e.stopPropagation();
		setFavorites((prev) => {
			const newFavs = prev.includes(gameId)
				? prev.filter((id) => id !== gameId)
				: [...prev, gameId];
			localStorage.setItem("arcade_favorites", JSON.stringify(newFavs));
			return newFavs;
		});
	};

	// Determine view mode based on URL
	const isTrending = location.pathname === "/trending";
	const isFavoritesPage = location.pathname === "/favorites";

	// Filter & Sort Logic
	const filteredGames = useMemo(() => {
		let result = gameList.filter((game) => {
			const matchesSearch = game.name
				.toLowerCase()
				.includes(searchTerm.toLowerCase());
			const matchesCategory =
				activeCategory === "All" || game.category === activeCategory;
			let matchesRoute = true;
			if (isTrending) matchesRoute = game.rating >= 4.0;
			if (isFavoritesPage) matchesRoute = favorites.includes(game.id);
			return matchesSearch && matchesCategory && matchesRoute;
		});

		// Sorting
		return result.sort((a, b) => {
			if (sortOption === "rating") return b.rating - a.rating;
			if (sortOption === "name") return a.name.localeCompare(b.name);
			return 0;
		});
	}, [
		searchTerm,
		activeCategory,
		isTrending,
		isFavoritesPage,
		favorites,
		sortOption,
	]);

	// Recently Played Games
	const recentGames = useMemo(() => {
		return recentIds
			.map((id) => gameList.find((g) => g.id === id))
			.filter((g): g is Game => !!g)
			.slice(0, 5);
	}, [recentIds]);

	const getPageTitle = () => {
		if (searchTerm) return `Results for "${searchTerm}"`;
		if (isFavoritesPage) return "My Favorites";
		if (isTrending) return "Trending Now";
		if (activeCategory !== "All") return `${activeCategory} Games`;
		return "All Games";
	};

	return (
		<div className="min-h-screen pb-24">
			{/* Search Header Mobile */}
			<div className="md:hidden p-4 sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-md border-b border-white/5">
				<div className="relative">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
						size={18}
					/>
					<input
						type="text"
						placeholder="Search games..."
						className="w-full bg-[#1a1a20] text-white pl-10 pr-4 py-2 rounded-full border border-white/10 focus:outline-none focus:border-purple-500 text-sm"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
			</div>

			<div className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
				{/* Desktop Header & Search */}
				<header className="hidden md:flex justify-between items-end">
					<div>
						<h2 className="text-3xl font-black text-white tracking-tight">
							{isFavoritesPage
								? "Your Collection"
								: "Discover Games"}
						</h2>
						<p className="text-slate-400 mt-1">
							{isFavoritesPage
								? "Your personal hall of fame."
								: "Dive into the latest arcade experiences."}
						</p>
					</div>
					<div className="flex gap-4 items-center">
						<div className="relative w-80">
							<Search
								className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
								size={18}
							/>
							<input
								type="text"
								placeholder="Search games..."
								className="w-full bg-[#12121a] text-white pl-11 pr-4 py-3 rounded-2xl border border-white/10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-slate-600 text-sm"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
					</div>
				</header>

				{/* Hero Carousel Section */}
				{location.pathname === "/" &&
					activeCategory === "All" &&
					!searchTerm &&
					(heroGames.length > 0 ? (
						<div className="relative rounded-[2rem] overflow-hidden aspect-[21/9] md:aspect-[3/1] group cursor-pointer shadow-2xl shadow-purple-900/20 border border-white/10 bg-[#12121a]">
							{/* Carousel Slides */}
							{heroGames.map((game, index) => (
								<div
									key={game.id}
									className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
										index === currentHeroIndex
											? "opacity-100 z-10"
											: "opacity-0 z-0"
									}`}
									onClick={() =>
										navigate(`/play/${game.slug}`)
									}>
									{/* Background Image with Zoom Effect */}
									<div className="absolute inset-0 overflow-hidden">
										<img
											src={game.thumbnail}
											alt={game.name}
											className={`w-full h-full object-cover transition-transform duration-[8000ms] ease-linear opacity-80 ${
												index === currentHeroIndex
													? "scale-110"
													: "scale-100"
											}`}
										/>
										<div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/60 to-transparent" />
									</div>

									{/* Content Overlay */}
									<div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 z-20">
										<div className="max-w-2xl animate-fade-in-up">
											<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
												<Flame
													size={12}
													className="animate-pulse"
												/>{" "}
												Top Rated
											</div>
											<h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-none drop-shadow-lg truncate">
												{game.name}
											</h1>
											<p className="text-slate-300 text-sm md:text-lg mb-8 line-clamp-2 leading-relaxed opacity-90 max-w-lg">
												{game.description}
											</p>

											<div className="flex gap-4">
												<button className="flex items-center gap-2 bg-white text-black pl-5 pr-6 py-3.5 rounded-full font-bold hover:bg-purple-50 transition-all hover:scale-105 active:scale-95">
													<PlayCircle
														size={20}
														className="fill-black"
													/>
													Play Now
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														toggleFavorite(
															e,
															game.id
														);
													}}
													className="flex items-center gap-2 bg-white/10 text-white px-5 py-3.5 rounded-full font-bold backdrop-blur-md hover:bg-white/20 transition-all border border-white/10">
													<Heart
														size={20}
														className={
															favorites.includes(
																game.id
															)
																? "fill-pink-500 text-pink-500"
																: ""
														}
													/>
												</button>
											</div>
										</div>
									</div>
								</div>
							))}

							{/* Carousel Indicators */}
							<div className="absolute bottom-6 right-8 z-30 flex gap-2">
								{heroGames.map((_, idx) => (
									<button
										key={idx}
										onClick={(e) => {
											e.stopPropagation();
											setCurrentHeroIndex(idx);
										}}
										className={`h-1.5 rounded-full transition-all duration-300 ${
											idx === currentHeroIndex
												? "w-8 bg-purple-500"
												: "w-2 bg-white/30 hover:bg-white/60"
										}`}
									/>
								))}
							</div>
						</div>
					) : (
						<div className="relative rounded-[2rem] overflow-hidden aspect-[21/9] md:aspect-[3/1] border border-dashed border-white/10 bg-[#12121a]/50 flex flex-col items-center justify-center text-center p-8">
							<div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
								<FolderOpen
									size={32}
									className="text-purple-400"
								/>
							</div>
							<h2 className="text-xl font-bold text-white mb-2">
								Your library is waiting
							</h2>
							<p className="text-slate-500 max-w-md text-sm">
								Add game folders to{" "}
								<code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 text-xs font-mono">
									public/games/
								</code>{" "}
								to populate this area.
							</p>
						</div>
					))}

				{/* Categories & Filter Bar */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					{/* Categories */}
					<div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide mask-linear-fade">
						{categories.map((cat) => (
							<button
								key={cat}
								onClick={() => setActiveCategory(cat)}
								className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 border ${
									activeCategory === cat
										? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-transparent shadow-[0_4px_20px_-5px_rgba(168,85,247,0.5)] transform scale-105"
										: "bg-[#12121a] text-slate-400 border-white/5 hover:border-white/20 hover:text-white hover:bg-white/5"
								}`}>
								{getCategoryIcon(cat)}
								{cat}
							</button>
						))}
					</div>

					{/* Sort Dropdown (Simple Toggle for now) */}
					<div className="flex items-center gap-2 bg-[#12121a] p-1 rounded-xl border border-white/5">
						<button
							onClick={() => setSortOption("rating")}
							className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
								sortOption === "rating"
									? "bg-white/10 text-white"
									: "text-slate-500 hover:text-white"
							}`}>
							<Flame size={14} /> Top Rated
						</button>
						<button
							onClick={() => setSortOption("name")}
							className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
								sortOption === "name"
									? "bg-white/10 text-white"
									: "text-slate-500 hover:text-white"
							}`}>
							<SortAsc size={14} /> A-Z
						</button>
					</div>
				</div>

				{/* Recently Played Section */}
				{location.pathname === "/" &&
					!searchTerm &&
					recentGames.length > 0 && (
						<section>
							<div className="flex items-center gap-3 text-white font-bold text-xl mb-6">
								<div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
									<History size={20} />
								</div>
								Jump Back In
							</div>
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
								{recentGames.map((game, idx) => (
									<div
										key={`recent-${game.id}`}
										className="animate-fade-in-up"
										style={{
											animationDelay: `${idx * 50}ms`,
										}}>
										<GameCard
											game={game}
											onClick={(slug) =>
												navigate(`/play/${slug}`)
											}
											isFavorite={favorites.includes(
												game.id
											)}
											onToggleFavorite={toggleFavorite}
										/>
									</div>
								))}
							</div>
						</section>
					)}

				{/* Main Game Grid */}
				<main>
					<div className="flex items-center justify-between mb-8">
						<h3 className="text-xl font-bold text-white flex items-center gap-3">
							<div className="w-1 h-6 rounded-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
							{getPageTitle()}
							<span className="text-xs font-bold text-slate-500 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
								{filteredGames.length}
							</span>
						</h3>
					</div>

					{filteredGames.length > 0 ? (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6">
							{filteredGames.map((game, idx) => (
								<div
									key={game.id}
									className="animate-fade-in-up"
									style={{ animationDelay: `${idx * 50}ms` }}>
									<GameCard
										game={game}
										onClick={(slug) =>
											navigate(`/play/${slug}`)
										}
										isFavorite={favorites.includes(game.id)}
										onToggleFavorite={toggleFavorite}
									/>
								</div>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-24 text-slate-500 border border-dashed border-white/10 rounded-3xl bg-[#12121a]/50">
							{isFavoritesPage ? (
								<>
									<div className="p-4 bg-pink-500/10 rounded-full mb-4">
										<Heart
											size={40}
											className="text-pink-500"
										/>
									</div>
									<p className="text-xl font-bold text-white">
										No favorites yet
									</p>
									<p className="text-sm opacity-60 mt-1">
										Mark games with a heart to see them
										here!
									</p>
								</>
							) : (
								<>
									<div className="p-4 bg-white/5 rounded-full mb-4">
										<Search size={40} />
									</div>
									<p className="text-xl font-bold text-white">
										No games found
									</p>
									<p className="text-sm opacity-60 mt-1">
										Try adjusting your search or filters
									</p>
								</>
							)}
						</div>
					)}
				</main>
			</div>
		</div>
	);
};

export default Home;
