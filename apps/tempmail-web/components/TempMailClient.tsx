import React, { useState, useEffect, useCallback, useRef } from "react";
import {
	Mail,
	RefreshCw,
	Copy,
	Github,
	Inbox as InboxIcon,
	ChevronLeft,
	ShieldCheck,
	AlertCircle,
	Clock,
	Trash2,
	RotateCw,
} from "lucide-react";
import {
	generateMailbox,
	getMessages,
	getMessage,
} from "../services/mailService";
import { EmailSummary, EmailDetail, MailboxState } from "../types";
import { Button } from "./Button";

const REFRESH_INTERVAL = 8000; // 8s polling

export const TempMailClient: React.FC = () => {
	const [mailbox, setMailbox] = useState<MailboxState | null>(null);
	const [messages, setMessages] = useState<EmailSummary[]>([]);
	const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(
		null
	);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isInitializing, setIsInitializing] = useState(true);
	const [copied, setCopied] = useState(false);

	// Timers
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const initMailbox = useCallback(async (forceNew = false) => {
		setIsInitializing(true);
		try {
			const mb = await generateMailbox(forceNew);
			setMailbox(mb);
			setMessages([]);
			setSelectedEmail(null);
		} catch (e) {
			console.error(e);
		} finally {
			setIsInitializing(false);
		}
	}, []);

	useEffect(() => {
		initMailbox(false); // Restore existing session if possible
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only mount

	const fetchMessages = useCallback(async () => {
		if (!mailbox) return;
		setIsLoadingMessages(true);
		try {
			const msgs = await getMessages(mailbox.token);
			// Only update if changes to avoid jitter
			setMessages((prev) => {
				if (prev.length !== msgs.length) return msgs;
				if (
					msgs.length > 0 &&
					prev.length > 0 &&
					msgs[0].id !== prev[0].id
				)
					return msgs;
				return prev;
			});
		} finally {
			setIsLoadingMessages(false);
		}
	}, [mailbox]);

	// Polling Effect
	useEffect(() => {
		if (mailbox && mailbox.token !== "DEMO_MODE") {
			fetchMessages(); // Initial fetch for this mailbox
			pollTimerRef.current = setInterval(fetchMessages, REFRESH_INTERVAL);
		}
		return () => {
			if (pollTimerRef.current) clearInterval(pollTimerRef.current);
		};
	}, [mailbox, fetchMessages]);

	const handleSelectEmail = async (summary: EmailSummary) => {
		// Optimistic set
		setSelectedEmail({
			...summary,
			body: "Loading...",
			textBody: "Loading...",
			htmlBody: "",
		});

		// Fetch full
		if (mailbox) {
			const full = await getMessage(mailbox.token, summary.id);
			if (full) {
				setSelectedEmail(full);
			} else {
				const found = messages.find((m) => m.id === summary.id);
				if (found && "body" in found) {
					setSelectedEmail(found as EmailDetail);
				}
			}
		}
	};

	const copyToClipboard = () => {
		if (mailbox) {
			navigator.clipboard.writeText(mailbox.address);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-200 font-sans selection:bg-zinc-700 selection:text-white">
			{/* Sidebar - Controls */}
			<aside className="w-72 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col z-20">
				{/* Header */}
				<div className="h-14 flex items-center px-5 border-b border-zinc-800">
					<div className="flex items-center gap-2">
						<img
							src="/ver-bigger-logo.png"
							alt="AT Mail Logo"
							className="w-6 h-6"
						/>
						<span className="font-semibold text-lg text-zinc-100 tracking-tight">
							AT Mail
						</span>
					</div>
				</div>

				{/* Mailbox Info */}
				<div className="p-5 border-b border-zinc-800 bg-zinc-900/30">
					<div className="mb-2 flex items-center justify-between">
						<span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
							Your Address
						</span>
						{isInitializing && (
							<RefreshCw className="w-3 h-3 animate-spin text-zinc-500" />
						)}
					</div>

					<div className="group relative">
						<div
							onClick={copyToClipboard}
							className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-md p-3 cursor-pointer transition-colors duration-200 flex items-center justify-between gap-2">
							<div className="font-mono text-sm text-zinc-300 truncate select-all">
								{isInitializing
									? "Generating..."
									: mailbox?.address || "No address"}
							</div>
							{copied ? (
								<span className="text-xs font-medium text-emerald-500 whitespace-nowrap">
									Copied
								</span>
							) : (
								<Copy className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
							)}
						</div>
					</div>

					<div className="mt-4 grid grid-cols-2 gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => initMailbox(true)}
							disabled={isInitializing}
							className="w-full">
							<RotateCw
								className={`w-3.5 h-3.5 mr-2 ${
									isInitializing ? "animate-spin" : ""
								}`}
							/>
							New ID
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => fetchMessages()}
							disabled={isLoadingMessages}
							className="w-full">
							<RefreshCw
								className={`w-3.5 h-3.5 mr-2 ${
									isLoadingMessages ? "animate-spin" : ""
								}`}
							/>
							Refresh
						</Button>
					</div>
				</div>

				{/* Status / Links */}
				<div className="mt-auto p-5 border-t border-zinc-800">
					<div className="flex items-center justify-center h-full gap-2 text-xs text-zinc-500 mb-4">
						<div className="w-2 h-2 rounded-full bg-emerald-500/50 border border-emerald-500" />
						<span>Operational</span>
						<span className="mx-1">•</span>
						<span>TLS Encrypted</span>
					</div>
				</div>
			</aside>

			{/* Main Content: Split View */}
			<main className="flex-1 flex min-w-0 bg-zinc-950">
				{/* Message List */}
				<div
					className={`${
						selectedEmail ? "hidden lg:flex" : "flex"
					} w-full lg:w-96 flex-col border-r border-zinc-800 bg-zinc-950/50`}>
					<div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
						<span className="text-sm font-medium text-zinc-400">
							Inbox
						</span>
						<span className="text-xs text-zinc-600">
							{messages.length} messages
						</span>
					</div>

					<div className="flex-1 overflow-y-auto">
						{messages.length === 0 ? (
							<div className="h-full flex flex-col items-center justify-center p-8 text-center">
								<div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
									<InboxIcon className="w-6 h-6 text-zinc-700" />
								</div>
								<p className="text-sm text-zinc-500 font-medium">
									No messages yet
								</p>
								<p className="text-xs text-zinc-700 mt-1">
									Checking automatically...
								</p>
							</div>
						) : (
							<ul className="divide-y divide-zinc-800/50">
								{messages.map((msg) => {
									const isSelected =
										selectedEmail?.id === msg.id;
									return (
										<li
											key={msg.id}
											onClick={() =>
												handleSelectEmail(msg)
											}
											className={`
                        relative p-4 cursor-pointer transition-all duration-200 
                        ${isSelected ? "bg-zinc-900" : "hover:bg-zinc-900/50"}
                      `}>
											{isSelected && (
												<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />
											)}
											<div className="flex justify-between items-baseline mb-1">
												<span
													className={`text-sm font-medium truncate pr-2 ${
														isSelected
															? "text-zinc-100"
															: "text-zinc-300"
													}`}>
													{msg.from}
												</span>
												<span className="text-[10px] text-zinc-600 flex-shrink-0">
													{new Date(
														msg.date
													).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</div>
											<div
												className={`text-sm mb-1 truncate ${
													isSelected
														? "text-zinc-300"
														: "text-zinc-400"
												}`}>
												{msg.subject || "(No Subject)"}
											</div>
											<div className="text-xs text-zinc-600 truncate">
												{msg.intro ||
													"No preview available"}
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
				</div>

				{/* Email Detail View */}
				{selectedEmail ? (
					<div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
						{/* Toolbar */}
						<div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 lg:px-8 bg-zinc-950">
							<button
								onClick={() => setSelectedEmail(null)}
								className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white">
								<ChevronLeft className="w-5 h-5" />
							</button>
							<div className="flex items-center gap-2 ml-auto">
								<span className="text-xs text-zinc-600 flex items-center">
									<ShieldCheck className="w-3 h-3 mr-1" />{" "}
									Secure View
								</span>
							</div>
						</div>

						{/* Email Header */}
						<div className="p-6 lg:p-8 border-b border-zinc-800 bg-zinc-900/20">
							<h1 className="text-xl lg:text-2xl font-semibold text-zinc-100 mb-4 leading-snug">
								{selectedEmail.subject}
							</h1>

							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-sm font-medium border border-zinc-700">
										{selectedEmail.from
											.charAt(0)
											.toUpperCase()}
									</div>
									<div>
										<div className="text-sm font-medium text-zinc-200">
											{selectedEmail.from}
										</div>
										<div className="text-xs text-zinc-500">
											To: {mailbox?.address}
										</div>
									</div>
								</div>
								<div className="text-xs text-zinc-500 flex items-center gap-1">
									<Clock className="w-3 h-3" />
									{new Date(
										selectedEmail.date
									).toLocaleString()}
								</div>
							</div>
						</div>

						{/* Email Content */}
						<div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-zinc-950">
							<div className="max-w-3xl mx-auto">
								{selectedEmail.htmlBody ? (
									<div
										className="
                      prose prose-sm lg:prose-base max-w-none dark:prose-invert
                      prose-headings:font-semibold prose-a:text-blue-400 prose-img:rounded-md
                      prose-hr:border-zinc-800
                    "
										dangerouslySetInnerHTML={{
											__html: selectedEmail.htmlBody,
										}}
									/>
								) : (
									<pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 leading-relaxed">
										{selectedEmail.body}
									</pre>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="hidden lg:flex flex-1 items-center justify-center bg-zinc-950/80">
						<div className="text-center max-w-xs p-6">
							<div className="w-16 h-16 bg-zinc-900 rounded-2xl border border-zinc-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
								<Mail className="w-8 h-8 text-zinc-600" />
							</div>
							<h3 className="text-zinc-200 font-medium mb-2">
								No Email Selected
							</h3>
							<p className="text-sm text-zinc-500">
								Select an email from the inbox list to view its
								contents securely.
							</p>
						</div>
					</div>
				)}
			</main>
		</div>
	);
};
