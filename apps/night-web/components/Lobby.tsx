import React, { useState, useEffect } from "react";
import {
	Gender,
	Mood,
	Avatar,
	MOOD_DATA,
	AVATAR_ICONS,
	ALIASES,
	COMFORT_QUOTES,
} from "../types";
import { sound } from "../services/soundService";
import PixelButton from "./PixelButton";

interface LobbyProps {
	onStart: (
		mine: Gender,
		pref: Gender,
		myMood: Mood,
		prefMood: Mood,
		avatar: Avatar,
		alias: string,
	) => void;
	isSpecialUnlocked: boolean;
	onUnlockSpecial: () => void;
}

const STORAGE_KEYS = {
	MY_GENDER: "m_gender",
	PREF_GENDER: "p_gender",
	MY_MOOD: "m_mood",
	MY_AVATAR: "m_avatar",
};

const SECRET_CODE = "21122025"; // Mật mã để mở khóa hình đại diện đặc biệt

const Lobby: React.FC<LobbyProps> = ({
	onStart,
	isSpecialUnlocked,
	onUnlockSpecial,
}) => {
	const [myGender, setMyGender] = useState<Gender>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.MY_GENDER) as Gender) || "other",
	);
	const [prefGender, setPrefGender] = useState<Gender>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.PREF_GENDER) as Gender) ||
			"other",
	);
	const [myMood, setMyMood] = useState<Mood>(
		() => (localStorage.getItem(STORAGE_KEYS.MY_MOOD) as Mood) || "chill",
	);
	const [myAvatar, setMyAvatar] = useState<Avatar>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.MY_AVATAR) as Avatar) || "human",
	);
	const [myAlias, setMyAlias] = useState("");

	useEffect(() => {
		if (!myAlias) {
			setMyAlias(ALIASES[Math.floor(Math.random() * ALIASES.length)]);
		}
		localStorage.setItem(STORAGE_KEYS.MY_GENDER, myGender);
		localStorage.setItem(STORAGE_KEYS.PREF_GENDER, prefGender);
		localStorage.setItem(STORAGE_KEYS.MY_MOOD, myMood);
		localStorage.setItem(STORAGE_KEYS.MY_AVATAR, myAvatar);
	}, [myGender, prefGender, myMood, myAvatar]);

	// Phát hiện mật mã
	useEffect(() => {
		if (myAlias.toLowerCase().includes(SECRET_CODE)) {
			if (!isSpecialUnlocked) {
				onUnlockSpecial();
				sound.playMessage(); // Phát âm thanh xác nhận mở khóa thành công
			}
		}
	}, [myAlias, isSpecialUnlocked, onUnlockSpecial]);

	const availableAvatars: Avatar[] = [
		"cat",
		"robot",
		"ghost",
		"alien",
		"human",
	];
	if (isSpecialUnlocked) {
		availableAvatars.push("pig", "cow");
	}

	return (
		<div className="w-full max-w-xl flex flex-col gap-4">
			{/* Marquee Comfort Quotes */}
			<div className="bg-slate-950 border-4 border-slate-800 py-4 overflow-hidden relative">
				<div className="flex w-max animate-marquee gap-24 text-indigo-400 text-xl tracking-widest italic uppercase">
					{COMFORT_QUOTES.map((quote, i) => (
						<span key={i} className="flex-shrink-0">
							✦ {quote}
						</span>
					))}
					{COMFORT_QUOTES.map((quote, i) => (
						<span key={`dup-${i}`} className="flex-shrink-0">
							✦ {quote}
						</span>
					))}
				</div>
			</div>

			<div className="bg-slate-900 p-6 pixel-border relative">
				<div
					className={`absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 px-4 py-1 text-sm text-white pixel-border-primary uppercase z-50 ${isSpecialUnlocked ? "special-sparkle !bg-slate-900 !border-yellow-500" : ""}`}>
					{myAlias}
				</div>

				<div className="space-y-6">
					<section className="text-center">
						<p className="text-sm mb-2 text-slate-500 uppercase tracking-widest">
							ĐỔI BIỆT DANH
						</p>
						<input
							type="text"
							value={myAlias}
							onChange={(e) => setMyAlias(e.target.value)}
							className={`w-full bg-slate-950 border-4 border-slate-800 p-2 text-center text-white focus:outline-none focus:border-indigo-500 uppercase mb-4 ${isSpecialUnlocked ? "special-sparkle" : ""}`}
							placeholder="NHẬP TÊN..."
						/>

						<p className="text-sm mb-2 text-slate-500 uppercase tracking-widest">
							CHỌN HÌNH ĐẠI DIỆN
						</p>
						<div className="flex justify-center gap-3 flex-wrap">
							{availableAvatars.map((av) => (
								<button
									key={av}
									onClick={() => {
										sound.playClick();
										setMyAvatar(av);
									}}
									className={`w-12 h-12 text-2xl flex items-center justify-center pixel-border transition-all relative ${myAvatar === av ? "bg-indigo-600 scale-110" : "bg-slate-800 border-slate-700"} ${av === "pig" || av === "cow" ? "glow-gold shadow-[0_0_20px_rgba(234,179,8,0.5)]" : ""}`}>
									{AVATAR_ICONS[av]}
									{(av === "pig" || av === "cow") && (
										<span className="absolute -top-2 -right-2 text-[10px] animate-bounce">
											⭐
										</span>
									)}
								</button>
							))}
						</div>
					</section>

					<div className="grid grid-cols-2 gap-4">
						<section>
							<p className="text-sm mb-2 text-slate-500 uppercase">
								GIỚI TÍNH
							</p>
							<div className="flex flex-col gap-1">
								{["male", "female", "other"].map((g) => (
									<button
										key={g}
										onClick={() => setMyGender(g as Gender)}
										className={`py-1 text-sm pixel-border ${myGender === g ? "bg-indigo-600" : "bg-slate-800 border-slate-700"}`}>
										{g === "male"
											? "NAM"
											: g === "female"
												? "NỮ"
												: "KHÁC"}
									</button>
								))}
							</div>
						</section>
						<section>
							<p className="text-sm mb-2 text-slate-500 uppercase">
								TÌM KIẾM
							</p>
							<div className="flex flex-col gap-1">
								{["male", "female", "other"].map((g) => (
									<button
										key={g}
										onClick={() =>
											setPrefGender(g as Gender)
										}
										className={`py-1 text-sm pixel-border ${prefGender === g ? "bg-purple-600" : "bg-slate-800 border-slate-700"}`}>
										{g === "male"
											? "NAM"
											: g === "female"
												? "NỮ"
												: "BẤT KỲ"}
									</button>
								))}
							</div>
						</section>
					</div>

					<section>
						<p className="text-sm mb-2 text-slate-500 text-center uppercase">
							TÂM TRẠNG ĐÊM NAY
						</p>
						<div className="grid grid-cols-4 gap-2">
							{Object.keys(MOOD_DATA).map((m) => (
								<button
									key={m}
									onClick={() => setMyMood(m as Mood)}
									className={`py-2 flex flex-col items-center pixel-border ${myMood === m ? "bg-indigo-600" : "bg-slate-800 border-slate-700"}`}>
									<span className="text-xl">
										{MOOD_DATA[m as Mood].icon}
									</span>
									<span className="text-xs mt-1">
										{MOOD_DATA[m as Mood].label}
									</span>
								</button>
							))}
						</div>
					</section>

					<div className="pt-2">
						<PixelButton
							className="w-full py-4 text-2xl"
							onClick={() =>
								onStart(
									myGender,
									prefGender,
									myMood,
									myMood,
									myAvatar,
									myAlias,
								)
							}>
							TÌM NGƯỜI TÂM SỰ
						</PixelButton>
					</div>

					<div className="text-center opacity-30 text-[10px] uppercase tracking-widest pt-4 border-t border-slate-800">
						Hệ thống chỉ hoạt động từ 22h đêm đến 4h sáng
					</div>
				</div>
			</div>
		</div>
	);
};

export default Lobby;
