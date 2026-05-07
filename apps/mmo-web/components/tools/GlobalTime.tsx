import React, { useState, useEffect } from "react";
import { Clock, Globe, Sun, Moon } from "lucide-react";

const GlobalTime = () => {
	const [offset, setOffset] = useState(0); // Minutes offset from real time
	const [baseTime, setBaseTime] = useState(new Date());
	const [searchQuery, setSearchQuery] = useState("");

	// Detect user's timezone automatically
	const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	useEffect(() => {
		// Update base time every minute if offset is 0 (Live mode)
		const timer = setInterval(() => {
			if (offset === 0) setBaseTime(new Date());
		}, 60000);
		return () => clearInterval(timer);
	}, [offset]);

	// Calculate effective time
	const effectiveTime = new Date(baseTime.getTime() + offset * 60000);

	// Curated list of major timezones with aliases for better search
	const MAJOR_ZONES = [
		// Asia
		{ tz: "Asia/Ho_Chi_Minh", aliases: ["vietnam", "saigon", "hanoi"] },
		{ tz: "Asia/Bangkok", aliases: ["thailand", "thai"] },
		{ tz: "Asia/Singapore", aliases: ["singapore"] },
		{ tz: "Asia/Jakarta", aliases: ["indonesia", "indo"] },
		{ tz: "Asia/Manila", aliases: ["philippines", "filipino"] },
		{ tz: "Asia/Hong_Kong", aliases: ["hong kong", "hk"] },
		{ tz: "Asia/Shanghai", aliases: ["china", "beijing"] },
		{ tz: "Asia/Taipei", aliases: ["taiwan"] },
		{ tz: "Asia/Tokyo", aliases: ["japan", "japanese"] },
		{ tz: "Asia/Seoul", aliases: ["korea", "south korea"] },
		{ tz: "Asia/Kolkata", aliases: ["india", "mumbai", "delhi"] },
		{ tz: "Asia/Dubai", aliases: ["uae", "united arab emirates"] },
		{ tz: "Asia/Riyadh", aliases: ["saudi arabia", "saudi"] },
		{ tz: "Asia/Tehran", aliases: ["iran"] },
		{ tz: "Asia/Jerusalem", aliases: ["israel"] },
		{ tz: "Asia/Karachi", aliases: ["pakistan"] },
		{ tz: "Asia/Dhaka", aliases: ["bangladesh"] },
		{ tz: "Asia/Yangon", aliases: ["myanmar", "burma"] },
		{ tz: "Asia/Kuala_Lumpur", aliases: ["malaysia"] },
		// Europe
		{
			tz: "Europe/London",
			aliases: ["uk", "england", "britain", "united kingdom"],
		},
		{ tz: "Europe/Paris", aliases: ["france", "french"] },
		{ tz: "Europe/Berlin", aliases: ["germany", "german"] },
		{ tz: "Europe/Amsterdam", aliases: ["netherlands", "holland"] },
		{ tz: "Europe/Brussels", aliases: ["belgium"] },
		{ tz: "Europe/Madrid", aliases: ["spain", "spanish"] },
		{ tz: "Europe/Rome", aliases: ["italy", "italian"] },
		{ tz: "Europe/Vienna", aliases: ["austria"] },
		{ tz: "Europe/Zurich", aliases: ["switzerland", "swiss"] },
		{ tz: "Europe/Stockholm", aliases: ["sweden", "swedish"] },
		{ tz: "Europe/Oslo", aliases: ["norway", "norwegian"] },
		{ tz: "Europe/Copenhagen", aliases: ["denmark", "danish"] },
		{ tz: "Europe/Helsinki", aliases: ["finland", "finnish"] },
		{ tz: "Europe/Warsaw", aliases: ["poland", "polish"] },
		{ tz: "Europe/Prague", aliases: ["czech", "czech republic"] },
		{ tz: "Europe/Budapest", aliases: ["hungary", "hungarian"] },
		{ tz: "Europe/Athens", aliases: ["greece", "greek"] },
		{ tz: "Europe/Istanbul", aliases: ["turkey", "turkish"] },
		{ tz: "Europe/Moscow", aliases: ["russia", "russian"] },
		{ tz: "Europe/Lisbon", aliases: ["portugal", "portuguese"] },
		{ tz: "Europe/Dublin", aliases: ["ireland", "irish"] },
		// Americas
		{
			tz: "America/New_York",
			aliases: ["ny", "nyc", "usa", "us", "est", "eastern"],
		},
		{ tz: "America/Chicago", aliases: ["cst", "central"] },
		{ tz: "America/Denver", aliases: ["mst", "mountain"] },
		{
			tz: "America/Los_Angeles",
			aliases: ["la", "california", "pst", "pacific"],
		},
		{ tz: "America/Anchorage", aliases: ["alaska"] },
		{ tz: "America/Toronto", aliases: ["canada", "canadian"] },
		{ tz: "America/Vancouver", aliases: [] },
		{ tz: "America/Mexico_City", aliases: ["mexico", "mexican"] },
		{ tz: "America/Bogota", aliases: ["colombia", "colombian"] },
		{ tz: "America/Lima", aliases: ["peru", "peruvian"] },
		{ tz: "America/Santiago", aliases: ["chile", "chilean"] },
		{ tz: "America/Buenos_Aires", aliases: ["argentina", "argentinian"] },
		{ tz: "America/Sao_Paulo", aliases: ["brazil", "brazilian"] },
		{ tz: "America/Caracas", aliases: ["venezuela"] },
		{ tz: "America/Havana", aliases: ["cuba"] },
		{ tz: "America/Phoenix", aliases: ["arizona"] },
		// Pacific
		{ tz: "Pacific/Auckland", aliases: ["new zealand", "nz"] },
		{ tz: "Pacific/Fiji", aliases: ["fiji"] },
		{ tz: "Pacific/Honolulu", aliases: ["hawaii", "hawaiian"] },
		{ tz: "Pacific/Guam", aliases: ["guam"] },
		// Australia
		{ tz: "Australia/Sydney", aliases: ["australia", "aussie", "aus"] },
		{ tz: "Australia/Melbourne", aliases: [] },
		{ tz: "Australia/Brisbane", aliases: [] },
		{ tz: "Australia/Perth", aliases: [] },
		{ tz: "Australia/Adelaide", aliases: [] },
		// Africa
		{ tz: "Africa/Cairo", aliases: ["egypt", "egyptian"] },
		{ tz: "Africa/Johannesburg", aliases: ["south africa", "sa"] },
		{ tz: "Africa/Lagos", aliases: ["nigeria", "nigerian"] },
		{ tz: "Africa/Nairobi", aliases: ["kenya", "kenyan"] },
		{ tz: "Africa/Casablanca", aliases: ["morocco"] },
		// Atlantic
		{ tz: "Atlantic/Reykjavik", aliases: ["iceland"] },
		{ tz: "Atlantic/Azores", aliases: [] },
		// UTC
		{ tz: "UTC", aliases: ["utc", "gmt"] },
	];

	// Ensure user's timezone is included if not in list
	const userZoneExists = MAJOR_ZONES.some((z) => z.tz === userTimeZone);
	const finalTimeZones = userZoneExists
		? MAJOR_ZONES
		: [{ tz: userTimeZone, aliases: [] }, ...MAJOR_ZONES];

	const ZONES = finalTimeZones.map((zone) => {
		const label = zone.tz.replace(/_/g, " ").replace("/", " — ");
		return { label, tz: zone.tz, aliases: zone.aliases, icon: "🌐" };
	});

	// Filter and sort zones based on search query
	const filteredZones = ZONES.filter((zone) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			zone.label.toLowerCase().includes(query) ||
			zone.tz.toLowerCase().includes(query) ||
			zone.aliases.some((alias) => alias.toLowerCase().includes(query))
		);
	}).sort((a, b) => {
		// Always pin user's timezone to the top
		const aIsUser = a.tz === userTimeZone;
		const bIsUser = b.tz === userTimeZone;

		if (aIsUser && !bIsUser) return -1;
		if (!aIsUser && bIsUser) return 1;

		// If there's a search query, sort matched items
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const aMatch =
				a.label.toLowerCase().includes(query) ||
				a.tz.toLowerCase().includes(query);
			const bMatch =
				b.label.toLowerCase().includes(query) ||
				b.tz.toLowerCase().includes(query);

			// Matched items come before non-matched
			if (aMatch && !bMatch) return -1;
			if (!aMatch && bMatch) return 1;

			// Among matched items, sort by how early the match appears
			const aIndex = Math.min(
				a.label.toLowerCase().indexOf(query) !== -1
					? a.label.toLowerCase().indexOf(query)
					: 999,
				a.tz.toLowerCase().indexOf(query) !== -1
					? a.tz.toLowerCase().indexOf(query)
					: 999
			);
			const bIndex = Math.min(
				b.label.toLowerCase().indexOf(query) !== -1
					? b.label.toLowerCase().indexOf(query)
					: 999,
				b.tz.toLowerCase().indexOf(query) !== -1
					? b.tz.toLowerCase().indexOf(query)
					: 999
			);
			return aIndex - bIndex;
		}

		return 0;
	});

	const formatTime = (date: Date, timeZone: string) => {
		return new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "numeric",
			hour12: true,
			timeZone,
		}).format(date);
	};

	const formatDate = (date: Date, timeZone: string) => {
		return new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			timeZone,
		}).format(date);
	};

	const getHour24 = (date: Date, timeZone: string) => {
		const s = new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			hour12: false,
			timeZone,
		}).format(date);
		return parseInt(s);
	};

	const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseInt(e.target.value);
		setOffset(val);
	};

	const reset = () => {
		setOffset(0);
		setBaseTime(new Date());
	};

	return (
		<div className="min-h-screen from-slate-900 via-purple-900 to-slate-900 text-white p-6">
			<div className="max-w-7xl mx-auto">
				<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
					<Clock className="text-cyan-400" /> Global Airdrop Clock
				</h2>

				{/* Controller */}
				<div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 mb-8 sticky top-4 z-20 shadow-xl">
					{/* Search Box */}
					<div className="mb-6">
						<div className="relative">
							<Globe
								className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
								size={18}
							/>
							<input
								type="text"
								placeholder="Search timezone (e.g., Tokyo, New York, Vietnam)..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full bg-slate-700/50 text-white pl-10 pr-10 py-3 rounded-lg border border-slate-600 focus:border-cyan-400 focus:outline-none transition-colors placeholder-gray-400"
							/>
							{searchQuery && (
								<button
									onClick={() => setSearchQuery("")}
									className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors text-lg font-bold">
									✕
								</button>
							)}
						</div>
						{searchQuery && (
							<p className="text-xs text-gray-400 mt-2">
								Found {filteredZones.length} timezone
								{filteredZones.length !== 1 ? "s" : ""}
							</p>
						)}
					</div>

					<div className="flex justify-between items-center mb-4">
						<span className="text-sm font-bold text-gray-400 uppercase">
							Time Travel Slider
						</span>
						<button
							onClick={reset}
							className="text-xs bg-slate-700 px-3 py-1 rounded-full text-cyan-400 hover:bg-slate-600 transition-colors">
							Reset to Live
						</button>
					</div>
					<input
						type="range"
						min="-720"
						max="720"
						step="30"
						value={offset}
						onChange={handleSlider}
						className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-400"
					/>
					<div className="text-center mt-2 text-xs text-gray-400">
						{offset === 0
							? "🔴 LIVE TIME"
							: `${offset > 0 ? "+" : ""}${offset / 60} Hours`}
					</div>
				</div>

				<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
					{filteredZones.map((zone) => {
						const timeStr = formatTime(effectiveTime, zone.tz);
						const dateStr = formatDate(effectiveTime, zone.tz);
						const h24 = getHour24(effectiveTime, zone.tz);
						const isDay = h24 >= 6 && h24 < 18;
						const isRef = zone.tz === userTimeZone;

						return (
							<div
								key={zone.tz}
								className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
									isRef
										? "bg-cyan-900/20 border-cyan-500/50"
										: "bg-slate-800/50 backdrop-blur-sm border-slate-700"
								}`}>
								<div className="flex items-center gap-4">
									<span className="text-2xl filter drop-shadow-md grayscale opacity-80">
										{zone.icon}
									</span>
									<div>
										<p
											className={`font-bold ${
												isRef
													? "text-cyan-400"
													: "text-gray-200"
											}`}>
											{zone.label}
										</p>
										<p className="text-xs text-gray-500">
											{zone.tz}
										</p>
									</div>
								</div>
								<div className="text-right">
									<div className="flex items-center justify-end gap-2">
										{isDay ? (
											<Sun
												size={14}
												className="text-yellow-500"
											/>
										) : (
											<Moon
												size={14}
												className="text-blue-400"
											/>
										)}
										<p className="text-2xl font-mono font-bold text-white tracking-wide">
											{timeStr}
										</p>
									</div>
									<p className="text-xs font-bold text-gray-500 uppercase">
										{dateStr}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};

export default GlobalTime;
