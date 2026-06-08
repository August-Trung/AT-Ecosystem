import React, { useEffect, useRef, useState } from "react";
import { sound } from "../services/soundService";
import { p2p } from "../services/p2pService";

interface PlaylistTrack {
	videoId: string;
	title: string;
}

interface JukeboxItem {
	id: string;
	title: string;
	url: string;
	type: "video" | "playlist";
	videoId?: string;
	playlistId?: string;
	tracks?: PlaylistTrack[];
}

interface PixelJukeboxProps {
	vibeMode: string;
	onMuteProcedural: (mute: boolean) => void;
	onClose: () => void;
}



let apiLoadedPromise: Promise<void> | null = null;
const loadYouTubeAPI = (): Promise<void> => {
	if ((window as any).YT && (window as any).YT.Player) {
		return Promise.resolve();
	}
	if (apiLoadedPromise) return apiLoadedPromise;

	apiLoadedPromise = new Promise((resolve) => {
		const tag = document.createElement("script");
		tag.src = "https://www.youtube.com/iframe_api";
		const firstScriptTag = document.getElementsByTagName("script")[0];
		if (firstScriptTag && firstScriptTag.parentNode) {
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
		} else {
			document.head.appendChild(tag);
		}

		(window as any).onYouTubeIframeAPIReady = () => {
			resolve();
		};
	});
	return apiLoadedPromise;
};

const extractPlaylistData = (html: string): { title: string; tracks: PlaylistTrack[] } | null => {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");
		
		// 1. Lấy tiêu đề playlist từ tag og:title hoặc <title>
		const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") 
			|| doc.querySelector('title')?.textContent 
			|| "Playlist YouTube";
		const cleanTitle = ogTitle.replace(" - YouTube", "").trim();

		// 2. Lấy dữ liệu bài hát từ ytInitialData trong các tag script
		const scripts = doc.querySelectorAll("script");
		let ytInitialDataStr = "";
		for (const script of Array.from(scripts)) {
			const content = script.textContent || "";
			const index = content.indexOf("ytInitialData =");
			if (index !== -1) {
				// Tìm vị trí của dấu ngoặc nhọn mở đầu tiên '{' sau 'ytInitialData ='
				const startBrace = content.indexOf("{", index);
				if (startBrace !== -1) {
					let braceCount = 1;
					let endBrace = startBrace + 1;
					let inString = false;
					let escaped = false;
					while (braceCount > 0 && endBrace < content.length) {
						const char = content[endBrace];
						if (inString) {
							if (escaped) {
								escaped = false;
							} else if (char === "\\") {
								escaped = true;
							} else if (char === '"') {
								inString = false;
							}
						} else {
							if (char === '"') {
								inString = true;
							} else if (char === "{") {
								braceCount++;
							} else if (char === "}") {
								braceCount--;
							}
						}
						endBrace++;
					}
					if (braceCount === 0) {
						ytInitialDataStr = content.substring(startBrace, endBrace);
						break;
					}
				}
			}
		}

		const tracks: PlaylistTrack[] = [];
		if (ytInitialDataStr) {
			const data = JSON.parse(ytInitialDataStr);
			
			// Hàm đệ quy tìm kiếm tất cả các đối tượng playlistVideoRenderer
			const renderers: any[] = [];
			const findRenderers = (obj: any) => {
				if (!obj || typeof obj !== "object") return;
				if (Array.isArray(obj)) {
					for (const item of obj) {
						findRenderers(item);
					}
				} else {
					if (obj.playlistVideoRenderer) {
						renderers.push(obj.playlistVideoRenderer);
					}
					for (const key in obj) {
						if (Object.prototype.hasOwnProperty.call(obj, key)) {
							findRenderers(obj[key]);
						}
					}
				}
			};

			findRenderers(data);

			for (const r of renderers) {
				if (r && r.videoId) {
					let videoTitle = "Bài hát không có tên";
					if (r.title && Array.isArray(r.title.runs) && r.title.runs[0]) {
						videoTitle = r.title.runs[0].text;
					} else if (r.title && typeof r.title.simpleText === "string") {
						videoTitle = r.title.simpleText;
					}
					tracks.push({
						videoId: r.videoId,
						title: videoTitle
					});
				}
			}
		}

		return {
			title: cleanTitle,
			tracks
		};
	} catch (e) {
		console.error("Error parsing playlist HTML data:", e);
		return null;
	}
};


const PixelJukebox: React.FC<PixelJukeboxProps> = ({
	vibeMode,
	onMuteProcedural,
	onClose,
}) => {
	const [library, setLibrary] = useState<JukeboxItem[]>([]);
	const [urlInput, setUrlInput] = useState("");
	const [activeItem, setActiveItem] = useState<JukeboxItem | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [showVideo, setShowVideo] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");

	const [volume, setVolume] = useState(70);
	const [playlistTracks, setPlaylistTracks] = useState<string[]>([]);
	const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
	const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});

	const activeItemRef = useRef<JukeboxItem | null>(null);
	const libraryRef = useRef<JukeboxItem[]>([]);

	useEffect(() => {
		activeItemRef.current = activeItem;
	}, [activeItem]);

	useEffect(() => {
		libraryRef.current = library;
	}, [library]);

	const playerRef = useRef<any>(null);
	const playerContainerId = "youtube-player-iframe";
	const isSyncingFromPeer = useRef(false);

	const visualizerRef = useRef<HTMLCanvasElement | null>(null);

	const isPlayerReady = useRef(false);
	const pendingPlayItemRef = useRef<JukeboxItem | null>(null);


	// Canvas Equalizer Animation Effect
	useEffect(() => {
		const canvas = visualizerRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationId: number;
		const bars = 24;
		const barWidth = 3;
		const barGap = 2;
		const heights = Array(bars).fill(2);

		const draw = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#6366f1"; // indigo-500

			for (let i = 0; i < bars; i++) {
				if (isPlaying && activeItem && !errorMsg) {
					const target = Math.random() * (canvas.height - 4) + 2;
					heights[i] += (target - heights[i]) * 0.35;
				} else {
					heights[i] += (2 - heights[i]) * 0.2;
				}

				const h = heights[i];
				const x = i * (barWidth + barGap) + (canvas.width - (bars * (barWidth + barGap))) / 2;
				const y = canvas.height - h;
				ctx.fillRect(x, y, barWidth, h);
			}

			animationId = requestAnimationFrame(draw);
		};

		draw();
		return () => cancelAnimationFrame(animationId);
	}, [isPlaying, activeItem, errorMsg]);

	const updateLibraryItemTitleAndTracks = (itemId: string, newTitle: string, tracks?: PlaylistTrack[]) => {
		const currentLibrary = libraryRef.current;
		const item = currentLibrary.find((i) => i.id === itemId);
		if (!item) return;

		// Ngăn chặn ghi đè tiêu đề playlist bằng tên video đang phát
		if (item.type !== "video" && !tracks) return;

		const isDefault = item.title.includes("Video YouTube") || item.title.includes("Playlist YouTube");
		// Nếu là video và tiêu đề không còn mặc định, không cần cập nhật lại
		if (item.type === "video" && !isDefault && item.title === newTitle) return;

		const updated = currentLibrary.map((i) => {
			if (i.id === itemId) {
				const updatedItem = { ...i, title: newTitle };
				if (tracks) {
					updatedItem.tracks = tracks;
				}
				return updatedItem;
			}
			return i;
		});

		setLibrary(updated);
		localStorage.setItem("midnight_jukebox_library", JSON.stringify(updated));
		
		if (activeItemRef.current && activeItemRef.current.id === itemId) {
			const updatedActive = { ...activeItemRef.current, title: newTitle };
			if (tracks) {
				updatedActive.tracks = tracks;
			}
			setActiveItem(updatedActive);
		}

		// Phát sóng cập nhật playlist cho bạn chat
		setTimeout(() => {
			if (p2p.isConnected() && !isSyncingFromPeer.current) {
				const payload = {
					action: "playlist_update",
					playlist: updated
				};
				p2p.sendJukeboxSync(JSON.stringify(payload));
			}
		}, 100);
	};

	const updateLibraryItemTitle = (itemId: string, title: string) => {
		const currentLibrary = libraryRef.current;
		const item = currentLibrary.find((i) => i.id === itemId);
		if (!item) return;

		// Chỉ tự động cập nhật tiêu đề động cho VIDEO đơn lẻ
		if (item.type !== "video") return;

		const isDefault = item.title.includes("Video YouTube");
		if (!isDefault) return;

		const newTitle = `🎵 ${title}`;
		updateLibraryItemTitleAndTracks(itemId, newTitle);
	};

	const fetchHtmlViaProxy = async (targetUrl: string): Promise<string> => {
		const proxies = [
			`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
			`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
			`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
		];

		for (const proxyUrl of proxies) {
			try {
				const res = await fetch(proxyUrl);
				if (res.ok) {
					if (proxyUrl.includes("allorigins")) {
						const json = await res.json();
						if (json && json.contents) return json.contents;
					} else {
						return await res.text();
					}
				}
			} catch (e) {
				console.warn(`Proxy failed: ${proxyUrl}`, e);
			}
		}
		throw new Error("All CORS proxies failed");
	};

	const fetchMetadataInBackground = async (item: JukeboxItem) => {
		try {
			if (item.type === "video") {
				// Fetch single video title via oEmbed
				const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${item.videoId}`)}&format=json`;
				const html = await fetchHtmlViaProxy(oembedUrl);
				const data = JSON.parse(html);
				if (data && data.title) {
					const newTitle = `🎵 ${data.title}`;
					updateLibraryItemTitleAndTracks(item.id, newTitle);
				}
			} else if (item.type === "playlist") {
				// Fetch playlist HTML and scrape title + tracks
				const targetUrl = `https://www.youtube.com/playlist?list=${item.playlistId}`;
				const html = await fetchHtmlViaProxy(targetUrl);
				const parsedData = extractPlaylistData(html);
				if (parsedData) {
					const newTitle = `📜 Playlist: ${parsedData.title}`;
					updateLibraryItemTitleAndTracks(item.id, newTitle, parsedData.tracks);
				}
			}
		} catch (err) {
			console.warn("Background metadata fetch failed for:", item.url, err);
		}
	};


	const syncPlaylistState = () => {
		if (!playerRef.current) return;
		
		if (typeof playerRef.current.getPlaylist === "function") {
			try {
				const playlist = playerRef.current.getPlaylist();
				if (playlist && Array.isArray(playlist)) {
					setPlaylistTracks(playlist);
				} else {
					setPlaylistTracks([]);
				}
			} catch (e) {
				setPlaylistTracks([]);
			}
		}

		if (typeof playerRef.current.getPlaylistIndex === "function") {
			try {
				setCurrentTrackIndex(playerRef.current.getPlaylistIndex());
			} catch (e) {
				setCurrentTrackIndex(-1);
			}
		}

		if (typeof playerRef.current.getVideoData === "function") {
			try {
				const videoData = playerRef.current.getVideoData();
				if (videoData && videoData.video_id && videoData.title) {
					setTrackTitles((prev) => {
						if (prev[videoData.video_id] === videoData.title) return prev;
						return { ...prev, [videoData.video_id]: videoData.title };
					});
					
					if (activeItemRef.current) {
						updateLibraryItemTitle(activeItemRef.current.id, videoData.title);
					}
				}
			} catch (e) {}
		}
	};

	useEffect(() => {
		const saved = localStorage.getItem("midnight_jukebox_library");
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (Array.isArray(parsed)) {
					// Lọc bỏ các bài hát gợi ý cũ không bắt đầu bằng "user-"
					const filtered = parsed.filter((item: any) => item && typeof item.id === 'string' && item.id.startsWith('user-'));
					setLibrary(filtered);
					localStorage.setItem("midnight_jukebox_library", JSON.stringify(filtered));
				}
			} catch (e) {}
		}
		
		// Load YouTube IFrame API and setup player with timeout check
		let isMounted = true;
		const timeout = setTimeout(() => {
			if (!isMounted) return;
			if (!(window as any).YT || !(window as any).YT.Player) {
				setErrorMsg("Không thể tải thư viện YouTube. Hãy tạm tắt chặn quảng cáo.");
			}
		}, 6000);

		loadYouTubeAPI().then(() => {
			if (!isMounted) return;
			clearTimeout(timeout);
			initPlayer();
		}).catch(() => {
			if (!isMounted) return;
			setErrorMsg("Không thể tải thư viện YouTube. Hãy kiểm tra kết nối.");
		});

		// Lắng nghe lệnh đồng bộ Jukebox từ peer
		p2p.onJukeboxSync = (sync: any) => {
			handleIncomingSync(sync);
		};

		// Mute procedural sound when Jukebox opens
		onMuteProcedural(true);

		const interval = setInterval(() => {
			syncPlaylistState();
		}, 1500);

		// Phát sóng danh sách nhạc hiện có cho bạn chat khi kết nối
		if (p2p.isConnected()) {
			setTimeout(() => {
				if (!isMounted) return;
				const currentSaved = localStorage.getItem("midnight_jukebox_library");
				if (currentSaved) {
					try {
						const parsed = JSON.parse(currentSaved);
						if (Array.isArray(parsed) && parsed.length > 0) {
							const payload = {
								action: "playlist_update",
								playlist: parsed
							};
							p2p.sendJukeboxSync(JSON.stringify(payload));
						}
					} catch (e) {}
				}
			}, 1000);
		}

		return () => {
			isMounted = false;
			clearTimeout(timeout);
			clearInterval(interval);
			onMuteProcedural(false);
			if (playerRef.current) {
				try {
					playerRef.current.destroy();
				} catch (e) {}
				playerRef.current = null;
			}
			isPlayerReady.current = false;
		};
	}, []);

	const initPlayer = () => {
		if (playerRef.current) return;
		
		playerRef.current = new (window as any).YT.Player(playerContainerId, {
			host: "https://www.youtube-nocookie.com",
			height: "100%",
			width: "100%",
			playerVars: {
				playsinline: 1,
				controls: 0,
				disablekb: 1,
				fs: 0,
				rel: 0,
				modestbranding: 1,
			},
			events: {
				onReady: (event: any) => {
					isPlayerReady.current = true;
					try {
						event.target.setVolume(volume);
					} catch (e) {}
					if (pendingPlayItemRef.current) {
						playItem(pendingPlayItemRef.current);
						pendingPlayItemRef.current = null;
					}
				},
				onStateChange: (event: any) => {
					// YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
					const state = event.data;
					if (state === 1 || state === 3 || state === 5) {
						setErrorMsg("");
					}
					if (state === 1) {
						setIsPlaying(true);
						broadcastSync("play");
					} else if (state === 2) {
						setIsPlaying(false);
						broadcastSync("pause");
					}
					syncPlaylistState();
				},
				onError: (event: any) => {
					const code = event.data;
					if (code === 2) setErrorMsg("Mã video không hợp lệ.");
					else if (code === 100) setErrorMsg("Video không tồn tại hoặc riêng tư.");
					else if (code === 101 || code === 150) setErrorMsg("Video chặn nhúng trên trang bên ngoài.");
					else setErrorMsg("Không thể phát video này.");
				},
			},
		});
	};

	const parseYouTubeUrl = (url: string): { type: "video" | "playlist"; id: string } | null => {
		try {
			let cleaned = url.trim();
			if (!/^https?:\/\//i.test(cleaned)) {
				cleaned = "https://" + cleaned;
			}
			const u = new URL(cleaned);
			
			// Playlist check
			if (u.searchParams.has("list")) {
				return { type: "playlist", id: u.searchParams.get("list")! };
			}
			// Share short link check
			if (u.hostname === "youtu.be" || u.hostname.endsWith(".youtu.be")) {
				return { type: "video", id: u.pathname.substring(1) };
			}
			// Shorts check
			if (u.pathname.startsWith("/shorts/")) {
				return { type: "video", id: u.pathname.split("/")[2] };
			}
			// Regular watch link check
			if (u.searchParams.has("v")) {
				return { type: "video", id: u.searchParams.get("v")! };
			}
			// Embed link check
			if (u.pathname.startsWith("/embed/")) {
				return { type: "video", id: u.pathname.split("/")[2] };
			}
		} catch (e) {}
		return null;
	};

	const broadcastPlaylistUpdate = (updatedLibrary: JukeboxItem[]) => {
		if (isSyncingFromPeer.current) return;
		if (!p2p.isConnected()) return;

		const payload = {
			action: "playlist_update",
			playlist: updatedLibrary
		};
		p2p.sendJukeboxSync(JSON.stringify(payload));
	};

	const handleAddMusic = (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMsg("");
		if (!urlInput.trim()) return;

		const parsed = parseYouTubeUrl(urlInput);
		if (!parsed) {
			setErrorMsg("Đường dẫn YouTube không hợp lệ.");
			return;
		}

		// Ngăn chặn thêm bài hát trùng lặp
		const isDuplicate = library.some((item) => {
			const itemParsed = parseYouTubeUrl(item.url);
			return itemParsed && itemParsed.id === parsed.id;
		});
		if (isDuplicate) {
			setErrorMsg("Đường dẫn này đã tồn tại trong thư viện.");
			return;
		}

		const tempId = `user-${Date.now()}`;
		const defaultTitle = parsed.type === "playlist" ? `📜 Playlist YouTube` : `🎵 Video YouTube (${parsed.id})`;

		const newItem: JukeboxItem = {
			id: tempId,
			title: defaultTitle,
			url: urlInput,
			type: parsed.type,
			videoId: parsed.type === "video" ? parsed.id : undefined,
			playlistId: parsed.type === "playlist" ? parsed.id : undefined,
			tracks: []
		};

		const updated = [newItem, ...library];
		setLibrary(updated);
		localStorage.setItem("midnight_jukebox_library", JSON.stringify(updated));
		setUrlInput("");
		sound.playClick();
		
		// Phát sóng cập nhật playlist cho bạn chat
		broadcastPlaylistUpdate(updated);

		// Tự động phát ngay sau khi thêm
		playItem(newItem);

		// Kích hoạt việc cào dữ liệu/oEmbed ở background
		fetchMetadataInBackground(newItem);
	};

	const handleDeleteMusic = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const updated = library.filter((item) => item.id !== id);
		setLibrary(updated);
		localStorage.setItem("midnight_jukebox_library", JSON.stringify(updated));
		sound.playClick();

		// Phát sóng cập nhật playlist cho bạn chat
		broadcastPlaylistUpdate(updated);

		// Nếu thư viện trống rỗng hoặc xóa đúng bài đang phát, dừng trình phát và reset các danh mục
		if (updated.length === 0 || (activeItem && activeItem.id === id)) {
			setActiveItem(null);
			setIsPlaying(false);
			setPlaylistTracks([]);
			setCurrentTrackIndex(-1);
			if (playerRef.current && typeof playerRef.current.stopVideo === "function") {
				try {
					playerRef.current.stopVideo();
				} catch (err) {}
			}
		}
	};

	const handleRenameMusic = (item: JukeboxItem, e: React.MouseEvent) => {
		e.stopPropagation();
		const newName = prompt("Nhập tên mới cho bài hát / danh sách phát:", item.title);
		if (newName === null) return;
		const trimmed = newName.trim();
		if (!trimmed) return;

		const updated = library.map((i) => (i.id === item.id ? { ...i, title: trimmed } : i));
		setLibrary(updated);
		localStorage.setItem("midnight_jukebox_library", JSON.stringify(updated));
		
		// Phát sóng cập nhật playlist cho bạn chat
		broadcastPlaylistUpdate(updated);

		if (activeItem && activeItem.id === item.id) {
			setActiveItem({ ...activeItem, title: trimmed });
		}
		sound.playClick();
	};

	const playItem = (item: JukeboxItem, isTriggeredByPeer = false) => {
		if (!playerRef.current || !isPlayerReady.current) {
			pendingPlayItemRef.current = item;
			setActiveItem(item); // Vẫn cập nhật UI để người dùng thấy đang chọn bài
			return;
		}

		// Dừng trình phát hiện tại trước khi nạp mục mới để giải phóng stream cũ
		try {
			if (typeof playerRef.current.stopVideo === "function") {
				playerRef.current.stopVideo();
			}
		} catch (e) {}

		// Reset ngay lập tức danh sách bài hát cũ để tránh hiển thị nhầm lẫn khi đang tải mục mới
		setPlaylistTracks([]);
		setCurrentTrackIndex(-1);

		setActiveItem(item);
		setErrorMsg("");

		if (!isTriggeredByPeer) {
			isSyncingFromPeer.current = false;
		}

		if (item.type === "playlist") {
			// Tự động cào danh sách bài hát nếu chưa có
			if (!item.tracks || item.tracks.length === 0) {
				fetchMetadataInBackground(item);
			}
			try {
				playerRef.current.loadPlaylist(item.playlistId);
			} catch (e) {
				console.warn("Failed to load playlist via string ID, trying object format:", e);
				try {
					playerRef.current.loadPlaylist({
						listType: "playlist",
						list: item.playlistId,
					});
				} catch (err) {
					setErrorMsg("Không thể tải danh sách phát này.");
				}
			}
		} else {
			try {
				playerRef.current.loadVideoById(item.videoId);
			} catch (e) {
				console.warn("Failed to load video via string ID, trying object format:", e);
				try {
					playerRef.current.loadVideoById({
						videoId: item.videoId,
					});
				} catch (err) {
					setErrorMsg("Không thể tải video này.");
				}
			}
		}

		try {
			if (typeof playerRef.current.setVolume === "function") {
				playerRef.current.setVolume(volume);
			}
		} catch (e) {}

		setIsPlaying(true);
		
		if (!isTriggeredByPeer) {
			broadcastSync("load", item);
		}
	};


	const handlePlayPause = () => {
		if (!playerRef.current || !activeItem) return;
		sound.playClick();
		isSyncingFromPeer.current = false;
		if (isPlaying) {
			playerRef.current.pauseVideo();
			setIsPlaying(false);
			broadcastSync("pause");
		} else {
			playerRef.current.playVideo();
			setIsPlaying(true);
			broadcastSync("play");
		}
	};

	const handleMute = () => {
		if (!playerRef.current) return;
		sound.playClick();
		if (isMuted) {
			playerRef.current.unMute();
			try {
				playerRef.current.setVolume(volume);
			} catch (e) {}
			setIsMuted(false);
		} else {
			playerRef.current.mute();
			setIsMuted(true);
		}
	};

	const broadcastSync = (action: string, item?: JukeboxItem) => {
		if (isSyncingFromPeer.current) return; // Prevent loop echo back to peer
		if (!p2p.isConnected()) return;

		let time = 0;
		if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
			try {
				time = playerRef.current.getCurrentTime();
			} catch (e) {}
		}

		let playlistIndex = -1;
		if (playerRef.current && typeof playerRef.current.getPlaylistIndex === "function") {
			try {
				playlistIndex = playerRef.current.getPlaylistIndex();
			} catch (e) {}
		}

		const payload = {
			action,
			time,
			item,
			videoId: activeItem?.videoId,
			playlistId: activeItem?.playlistId,
			playlistIndex,
		};
		p2p.sendJukeboxSync(JSON.stringify(payload));
	};

	const handleIncomingSync = (sync: any) => {
		if (!playerRef.current) return;
		isSyncingFromPeer.current = true;

		try {
			if (sync.action === "playlist_update" && Array.isArray(sync.playlist)) {
				const filtered = sync.playlist.filter((item: any) => item && typeof item.id === 'string' && item.id.startsWith('user-'));
				setLibrary(filtered);
				localStorage.setItem("midnight_jukebox_library", JSON.stringify(filtered));
			} else if (sync.action === "load" && sync.item) {
				playItem(sync.item, true);
			} else if (sync.action === "play") {
				if (sync.playlistIndex !== undefined && sync.playlistIndex !== -1 && typeof playerRef.current.getPlaylistIndex === "function") {
					if (playerRef.current.getPlaylistIndex() !== sync.playlistIndex) {
						playerRef.current.playVideoAt(sync.playlistIndex);
					}
				}
				playerRef.current.playVideo();
				setIsPlaying(true);
				if (sync.time && Math.abs(playerRef.current.getCurrentTime() - sync.time) > 2) {
					playerRef.current.seekTo(sync.time, true);
				}
			} else if (sync.action === "pause") {
				playerRef.current.pauseVideo();
				setIsPlaying(false);
			}
		} catch (e) {}

		// Reset peer sync flag
		setTimeout(() => {
			isSyncingFromPeer.current = false;
		}, 800);
	};

	return (
		<div className="flex flex-col gap-3 p-4 bg-slate-900 border-t-4 border-indigo-900 pixel-border w-full max-w-md mx-auto shadow-2xl relative z-[450] animate-in slide-in-from-bottom duration-300">
			<div className="flex justify-between items-center pb-2 border-b-2 border-slate-800">
				<span className="text-indigo-400 font-bold text-xs uppercase tracking-[0.2em]">
					📻 JUKEBOX ĐỒNG BỘ YOUTUBE
				</span>
				<button
					type="button"
					onClick={onClose}
					className="text-rose-500 hover:text-rose-400 font-bold text-xs"
				>
					[ X ]
				</button>
			</div>

			{/* TV Screen Container (CRT Retro Pixel effect) */}
			<div className="relative w-full aspect-video bg-[#030308] border-4 border-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
				<div className="absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)] scanlines"></div>
				
				{/* TV Static Noise when not playing */}
				<div className={`absolute inset-0 bg-[#111] flex flex-col items-center justify-center text-slate-600 text-xs font-mono uppercase tracking-[0.15em] z-10 transition-opacity duration-300 ${(!activeItem && !errorMsg) ? "opacity-75 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
					<span className="text-3xl mb-2 animate-pulse">📺</span>
					<span>Jukebox Sẵn Sàng</span>
				</div>

				{/* Error Screen Overlay */}
				<div className={`absolute inset-0 bg-rose-950/95 flex flex-col items-center justify-center p-4 text-center z-10 text-rose-300 font-sans transition-opacity duration-300 ${(errorMsg) ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
					<span className="text-3xl mb-2 animate-bounce">⚠️</span>
					<p className="text-xs font-bold uppercase tracking-wider">{errorMsg}</p>
					<p className="text-[9px] text-rose-400 mt-2 uppercase tracking-widest">
						Vui lòng chọn bài khác hoặc dán link mới
					</p>
				</div>

				{/* Stable wrapper for the player container */}
				<div className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${(showVideo && !errorMsg) ? "opacity-100 pointer-events-auto z-0" : "opacity-0 pointer-events-none z-[-1]"}`}>
					<div
						id={playerContainerId}
						className="w-full h-full"
					/>
				</div>
				
				{/* Screen Overlay with song title */}
				<div className={`absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 transition-opacity duration-300 ${(activeItem && !showVideo && !errorMsg) ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
					<div className="w-12 h-12 bg-indigo-950 border-2 border-indigo-500 rounded-full flex items-center justify-center mb-3 animate-spin duration-3000">
						💿
					</div>
					<p className="text-xs text-indigo-400 font-bold tracking-wider uppercase line-clamp-2 font-sans">
						{activeItem ? activeItem.title : ""}
					</p>
					<p className="text-[10px] text-green-500 mt-2 uppercase tracking-widest animate-pulse">
						{isPlaying ? "• ĐANG PHÁT ĐỒNG BỘ" : "• ĐÃ TẠM DỪNG"}
					</p>
				</div>

				{/* Audio Visualizer Waves Canvas */}
				<canvas
					ref={visualizerRef}
					className="absolute bottom-0 left-0 w-full h-8 z-[25] pointer-events-none opacity-60"
					width="400"
					height="32"
				/>
			</div>
			{/* CRT TV Styling Scanlines */}
			<style>{`
				.scanlines {
					background: linear-gradient(
						rgba(18, 16, 16, 0) 50%,
						rgba(0, 0, 0, 0.25) 50%
					);
					background-size: 100% 4px;
				}
			`}</style>

			{/* Jukebox Controls */}
			<div className="flex justify-between items-center gap-2 bg-slate-950 p-2 pixel-border border-slate-800">
				<button
					type="button"
					onClick={handlePlayPause}
					disabled={!activeItem}
					className={`px-2 py-1.5 text-[11px] font-bold pixel-border uppercase ${activeItem ? "bg-indigo-900 text-white" : "bg-slate-800 text-slate-500"}`}
				>
					{isPlaying ? "TẠM DỪNG" : "PHÁT"}
				</button>
				<button
					type="button"
					onClick={handleMute}
					className={`px-2 py-1.5 text-[11px] font-bold pixel-border uppercase ${isMuted ? "bg-rose-950 text-rose-300" : "bg-slate-800 text-slate-300"}`}
				>
					{isMuted ? "🔇 BẬT ÂM" : "🔊 TẮT ÂM"}
				</button>
				<button
					type="button"
					onClick={() => {
						sound.playClick();
						setShowVideo(!showVideo);
					}}
					className={`px-2 py-1.5 text-[11px] font-bold pixel-border uppercase ${showVideo ? "bg-purple-900 text-white" : "bg-slate-850 text-slate-400"}`}
				>
					📺 {showVideo ? "ẨN VIDEO" : "HIỆN VIDEO"}
				</button>
				<button
					type="button"
					onClick={() => {
						sound.playClick();
						if (activeItem) {
							broadcastSync("play");
						}
					}}
					disabled={!activeItem}
					className={`px-2 py-1.5 text-[11px] font-bold pixel-border uppercase ${activeItem ? "bg-indigo-900/60 text-slate-200" : "bg-slate-800 text-slate-500"}`}
				>
					🔄 ĐỒNG BỘ
				</button>
			</div>

			{/* Volume Slider */}
			<div className="flex items-center gap-2 bg-slate-950 p-2 border-2 border-slate-800 text-xs">
				<span className="text-slate-500 font-bold uppercase tracking-wider">🔈 ÂM LƯỢNG:</span>
				<input
					type="range"
					min="0"
					max="100"
					value={volume}
					onChange={(e) => {
						const vol = parseInt(e.target.value, 10);
						setVolume(vol);
						if (playerRef.current && typeof playerRef.current.setVolume === "function") {
							try {
								playerRef.current.setVolume(vol);
							} catch (err) {}
						}
						if (vol > 0 && isMuted) {
							setIsMuted(false);
							if (playerRef.current && typeof playerRef.current.unMute === "function") {
								try {
									playerRef.current.unMute();
								} catch (err) {}
							}
						}
					}}
					className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
				/>
				<span className="text-indigo-400 font-mono w-8 text-right">{volume}%</span>
			</div>

			{/* Playlist Tracks & Navigation */}
			{((activeItem && activeItem.type === "playlist" && activeItem.tracks && activeItem.tracks.length > 0) || playlistTracks.length > 0) && (
				<div className="flex flex-col gap-2 bg-slate-950 p-2 border-2 border-slate-800">
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => {
								if (playerRef.current && typeof playerRef.current.previousVideo === "function") {
									try {
										playerRef.current.previousVideo();
										sound.playClick();
									} catch (e) {}
								}
							}}
							className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-350 py-1 text-[10px] font-bold border border-slate-800 pixel-border uppercase"
						>
							⏮ BÀI TRƯỚC
						</button>
						<button
							type="button"
							onClick={() => {
								if (playerRef.current && typeof playerRef.current.nextVideo === "function") {
									try {
										playerRef.current.nextVideo();
										sound.playClick();
									} catch (e) {}
								}
							}}
							className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-350 py-1 text-[10px] font-bold border border-slate-800 pixel-border uppercase"
						>
							BÀI SAU ⏭
						</button>
					</div>

					<div className="max-h-[100px] overflow-y-auto pr-1 flex flex-col gap-1 scrollbar-thin text-[11px] font-sans">
						<p className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 mb-1">
							✦ BÀI HÁT TRONG PLAYLIST ({activeItem?.tracks && activeItem.tracks.length > 0 ? activeItem.tracks.length : playlistTracks.length})
						</p>
						{activeItem && activeItem.type === "playlist" && activeItem.tracks && activeItem.tracks.length > 0 ? (
							activeItem.tracks.map((track, index) => {
								const isCurrent = track.videoId === (playerRef.current && typeof playerRef.current.getVideoData === "function" && playerRef.current.getVideoData()?.video_id)
									|| (index === currentTrackIndex);
								return (
									<div
										key={`${track.videoId}-${index}`}
										onClick={() => {
											if (playerRef.current && typeof playerRef.current.playVideoAt === "function") {
												try {
													playerRef.current.playVideoAt(index);
													setCurrentTrackIndex(index);
													sound.playClick();
												} catch (e) {}
											}
										}}
										className={`w-full flex items-center cursor-pointer px-1.5 py-0.5 hover:bg-indigo-950/20 transition-colors ${isCurrent ? "text-indigo-400 font-bold border-l-2 border-indigo-500 pl-1" : "text-slate-400"}`}
									>
										{isCurrent && <span className="mr-1">▶</span>}
										<span className="truncate flex-1">{track.title}</span>
									</div>
								);
							})
						) : (
							playlistTracks.map((trackId, index) => {
								const isCurrent = index === currentTrackIndex;
								const title = trackTitles[trackId] || `Bài ${index + 1} (${trackId})`;
								return (
									<div
										key={`${trackId}-${index}`}
										onClick={() => {
											if (playerRef.current && typeof playerRef.current.playVideoAt === "function") {
												try {
													playerRef.current.playVideoAt(index);
													setCurrentTrackIndex(index);
													sound.playClick();
												} catch (e) {}
											}
										}}
										className={`w-full flex items-center cursor-pointer px-1.5 py-0.5 hover:bg-indigo-950/20 transition-colors ${isCurrent ? "text-indigo-400 font-bold border-l-2 border-indigo-500 pl-1" : "text-slate-400"}`}
									>
										{isCurrent && <span className="mr-1">▶</span>}
										<span className="truncate flex-1">{title}</span>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* Paste link form */}
			<form onSubmit={handleAddMusic} className="flex gap-2">
				<input
					type="text"
					value={urlInput}
					onChange={(e) => setUrlInput(e.target.value)}
					placeholder="Dán link Video / Playlist YouTube..."
					className="flex-1 bg-slate-950 border-2 border-slate-800 text-xs px-2 py-1.5 focus:outline-none text-white font-mono placeholder:text-slate-600"
				/>
				<button
					type="submit"
					className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border-2 border-indigo-800 px-3 py-1.5 text-xs font-bold uppercase pixel-border"
				>
					THÊM
				</button>
			</form>
			{/* Custom Library List */}
			<div className="flex-1 max-h-[180px] overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin font-sans">
				{library.length > 0 ? (
					<>
						<p className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1 mt-1">
							✦ DANH SÁCH BÀI HÁT (LOCAL STORAGE)
						</p>
						{library.map((item) => (
							<div
								key={item.id}
								onClick={() => playItem(item)}
								className={`flex justify-between items-center text-xs p-1.5 bg-slate-950/40 border border-slate-850 hover:bg-indigo-950/20 cursor-pointer transition-colors ${activeItem?.id === item.id ? "border-indigo-600 text-indigo-300" : "text-slate-400"}`}
							>
								<span className="truncate flex-1 pr-2">{item.title}</span>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={(e) => handleRenameMusic(item, e)}
										className="text-[9px] text-indigo-400 hover:text-indigo-350 font-bold uppercase"
									>
										[ĐỔI TÊN]
									</button>
									<button
										type="button"
										onClick={(e) => handleDeleteMusic(item.id, e)}
										className="text-[9px] text-rose-500 hover:text-rose-400 font-bold uppercase"
									>
										[XÓA]
									</button>
								</div>
							</div>
						))}
					</>
				) : (
					<div className="text-center text-slate-500 text-xs py-6 uppercase tracking-wider leading-relaxed">
						Chưa có bài hát nào.<br />Hãy dán link YouTube ở trên để thêm!
					</div>
				)}
			</div>
		</div>
	);
};

export default PixelJukebox;
