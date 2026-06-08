import React, { useState, useRef, useEffect } from "react";
import { BartenderMessage } from "../types";
import { chatWithBartender, getGreeting } from "../services/bartenderService";
import { sound } from "../services/soundService";

interface BartenderChatProps {
	isOpen: boolean;
	onClose: () => void;
}

const BartenderChat: React.FC<BartenderChatProps> = ({ isOpen, onClose }) => {
	const [messages, setMessages] = useState<BartenderMessage[]>([]);
	const [input, setInput] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasGreeted = useRef(false);

	// Auto-greeting when first opened
	useEffect(() => {
		if (isOpen && !hasGreeted.current) {
			hasGreeted.current = true;
			const greeting: BartenderMessage = {
				id: `bt-${Date.now()}`,
				sender: "bartender",
				text: getGreeting(),
				timestamp: Date.now(),
			};
			setMessages([greeting]);
		}
		if (isOpen) {
			setTimeout(() => inputRef.current?.focus(), 100);
		}
	}, [isOpen]);

	// Auto-scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isTyping]);

	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		const text = input.trim();
		if (!text || isTyping) return;

		sound.playClick();

		const userMsg: BartenderMessage = {
			id: `user-${Date.now()}`,
			sender: "user",
			text,
			timestamp: Date.now(),
		};

		const newMessages = [...messages, userMsg].slice(-10); // Keep last 10
		setMessages(newMessages);
		setInput("");
		setIsTyping(true);

		try {
			const response = await chatWithBartender(text, newMessages);
			const bartenderMsg: BartenderMessage = {
				id: `bt-${Date.now()}`,
				sender: "bartender",
				text: response,
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, bartenderMsg].slice(-10));
		} catch (err) {
			const errorMsg: BartenderMessage = {
				id: `bt-err-${Date.now()}`,
				sender: "bartender",
				text: "*lau ly trong im lặng*",
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, errorMsg].slice(-10));
		} finally {
			setIsTyping(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="bartender-panel">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-2 border-b-4 border-indigo-900 bg-indigo-950/50">
				<div className="flex items-center gap-2">
					<span className="text-xl">🍸</span>
					<span className="text-indigo-300 text-sm uppercase tracking-[0.2em] font-bold">
						Bartender
					</span>
					<span className="text-[10px] text-indigo-500 uppercase tracking-widest">
						Midnight Lounge
					</span>
				</div>
				<button
					type="button"
					onClick={() => {
						sound.playClick();
						onClose();
					}}
					className="text-slate-500 hover:text-white text-lg px-1 transition-colors"
				>
					✕
				</button>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin min-h-[200px] max-h-[300px]">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex gap-2 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
					>
						<div className="text-xl flex-shrink-0 mt-0.5">
							{msg.sender === "bartender" ? "🤖" : "👤"}
						</div>
						<div
							className={`text-sm px-3 py-2 max-w-[85%] ${
								msg.sender === "bartender"
									? "bg-indigo-950/80 text-indigo-200 border-2 border-indigo-900"
									: "bg-slate-800 text-white border-2 border-slate-700"
							}`}
						>
							{msg.text}
						</div>
					</div>
				))}

				{/* Typing indicator */}
				{isTyping && (
					<div className="flex gap-2">
						<div className="text-xl flex-shrink-0 mt-0.5">🤖</div>
						<div className="bg-indigo-950/80 text-indigo-400 border-2 border-indigo-900 px-3 py-2 text-sm italic animate-pulse">
							đang pha chế...
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<form
				onSubmit={handleSend}
				className="flex gap-2 px-3 py-3 border-t-4 border-indigo-900 bg-slate-950/80"
			>
				<input
					ref={inputRef}
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Nói gì đi..."
					maxLength={200}
					disabled={isTyping}
					className="flex-1 bg-slate-900 border-2 border-slate-700 px-3 py-1.5 text-sm text-white uppercase focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 disabled:opacity-50"
				/>
				<button
					type="submit"
					disabled={isTyping || !input.trim()}
					className="bg-indigo-900 hover:bg-indigo-800 text-white px-4 py-1.5 text-xs pixel-border font-bold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
				>
					GỬI
				</button>
			</form>
		</div>
	);
};

export default BartenderChat;
