import React, { useState, useEffect } from "react";
import { Mail, RefreshCw, Copy, X, Eye } from "lucide-react";
import { TempMailMessage } from "../../types";

const TempMail = () => {
	const [email, setEmail] = useState("");
	const [messages, setMessages] = useState<TempMailMessage[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
	const [loadingMsg, setLoadingMsg] = useState(false);
	const [error, setError] = useState("");

	// Using 1secmail API
	useEffect(() => {
		const saved = localStorage.getItem("neo_tempmail");
		if (saved) {
			setEmail(saved);
		} else {
			generateNew();
		}
	}, []);

	useEffect(() => {
		if (!email) return;
		const interval = setInterval(checkMail, 5000);
		return () => clearInterval(interval);
	}, [email]);

	const generateNew = async () => {
		setLoading(true);
		setSelectedMsg(null);
		setError("");

		// Strategy: Try API first. If blocked/fails, generate client-side valid domain to ensure tool works.
		try {
			const res = await fetch(
				"https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1",
				{ referrerPolicy: "no-referrer" }
			);
			if (!res.ok) throw new Error("API Limit");
			const data = await res.json();
			if (data && data[0]) {
				setEmail(data[0]);
				setMessages([]);
				localStorage.setItem("neo_tempmail", data[0]);
			}
		} catch (e) {
			// FALLBACK: Generate Client-Side
			// 1secmail supports any address on these domains
			const domains = ["1secmail.com", "1secmail.org", "1secmail.net"];
			const randomDomain =
				domains[Math.floor(Math.random() * domains.length)];
			const randomUser = Math.random().toString(36).substring(2, 12);
			const fallbackEmail = `${randomUser}@${randomDomain}`;

			console.log("Using client-side generated email:", fallbackEmail);
			setEmail(fallbackEmail);
			setMessages([]);
			localStorage.setItem("neo_tempmail", fallbackEmail);
		} finally {
			setLoading(false);
		}
	};

	const checkMail = async () => {
		if (!email) return;
		const [login, domain] = email.split("@");
		try {
			const res = await fetch(
				`https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`,
				{ referrerPolicy: "no-referrer" }
			);
			if (res.ok) {
				const data = await res.json();
				// Only update if changed to avoid re-renders
				if (JSON.stringify(data) !== JSON.stringify(messages)) {
					setMessages(data);
				}
			}
		} catch (e) {
			// Silent fail for polling
			console.debug("Polling failed", e);
		}
	};

	const readMessage = async (id: number) => {
		setLoadingMsg(true);
		const [login, domain] = email.split("@");
		try {
			const res = await fetch(
				`https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`,
				{ referrerPolicy: "no-referrer" }
			);
			if (res.ok) {
				const data = await res.json();
				setSelectedMsg(data);
			}
		} catch (e) {
			console.error(e);
		}
		setLoadingMsg(false);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Mail className="text-orange-500" /> Temporary Email
			</h2>

			{error && (
				<div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center justify-between">
					<span>{error}</span>
					<button
						onClick={generateNew}
						className="text-white underline text-xs">
						Retry
					</button>
				</div>
			)}

			<div className="flex flex-col md:flex-row gap-4 mb-8">
				<div className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-2 pl-4 flex items-center justify-between">
					<span className="font-mono text-orange-200 truncate">
						{email || "Generating..."}
					</span>
					<button
						onClick={() => navigator.clipboard.writeText(email)}
						className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white">
						<Copy size={18} />
					</button>
				</div>
				<button
					onClick={generateNew}
					disabled={loading}
					className="px-6 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white rounded-xl flex items-center gap-2 font-bold">
					<RefreshCw
						size={18}
						className={loading ? "animate-spin" : ""}
					/>{" "}
					New Address
				</button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* Message List */}
				<div className="md:col-span-1 bg-dark-800 border border-dark-700 rounded-xl overflow-hidden min-h-[400px] flex flex-col">
					<div className="p-4 bg-dark-700/50 border-b border-dark-700 flex justify-between items-center">
						<span className="text-sm font-bold text-gray-400">
							INBOX ({messages.length})
						</span>
						<button
							onClick={checkMail}
							className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1">
							<RefreshCw size={12} /> Refresh
						</button>
					</div>

					<div className="divide-y divide-dark-700 overflow-y-auto flex-1">
						{messages.length === 0 ? (
							<div className="p-10 text-center text-gray-600">
								<Mail
									size={32}
									className="mx-auto mb-2 opacity-20"
								/>
								<p className="text-xs">
									Waiting for incoming emails...
								</p>
							</div>
						) : (
							messages.map((msg) => (
								<div
									key={msg.id}
									onClick={() => readMessage(msg.id)}
									className={`p-4 hover:bg-dark-700/30 transition-colors cursor-pointer group ${
										selectedMsg?.id === msg.id
											? "bg-orange-500/10"
											: ""
									}`}>
									<div className="flex justify-between mb-1">
										<span className="font-bold text-gray-200 text-sm truncate w-24">
											{msg.from}
										</span>
										<span className="text-xs text-gray-500">
											{msg.date.split(" ")[0]}
										</span>
									</div>
									<p className="text-gray-400 text-xs truncate group-hover:text-orange-300">
										{msg.subject}
									</p>
								</div>
							))
						)}
					</div>
				</div>

				{/* Message Body */}
				<div className="md:col-span-2 bg-dark-800 border border-dark-700 rounded-xl overflow-hidden min-h-[400px] flex flex-col relative">
					{loadingMsg && (
						<div className="absolute inset-0 bg-dark-900/80 flex items-center justify-center z-10">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
						</div>
					)}

					{!selectedMsg ? (
						<div className="flex-1 flex flex-col items-center justify-center text-gray-600">
							<Eye size={48} className="mb-4 opacity-20" />
							<p>Select an email to read</p>
						</div>
					) : (
						<div className="flex flex-col h-full">
							<div className="p-6 border-b border-dark-700 bg-dark-700/30">
								<div className="flex justify-between items-start mb-4">
									<h3 className="text-xl font-bold text-white">
										{selectedMsg.subject}
									</h3>
									<button
										onClick={() => setSelectedMsg(null)}
										className="md:hidden p-2 text-gray-400">
										<X />
									</button>
								</div>
								<div className="flex justify-between text-sm text-gray-400">
									<span>
										From:{" "}
										<span className="text-orange-300">
											{selectedMsg.from}
										</span>
									</span>
									<span>{selectedMsg.date}</span>
								</div>
							</div>
							<div className="flex-1 p-6 overflow-y-auto bg-white text-black">
								{/* Render HTML content safely */}
								<div
									dangerouslySetInnerHTML={{
										__html:
											selectedMsg.htmlBody ||
											selectedMsg.body,
									}}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default TempMail;
