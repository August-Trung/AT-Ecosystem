import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Mail, RefreshCw, Copy, Inbox as InboxIcon, ChevronLeft, ShieldCheck,
    Clock, RotateCw, Check, AlertCircle, CheckCircle2, Trash2, Paperclip,
    Download, Code
} from 'lucide-react';
import {
    generateMailbox, getMessages, getMessage, getCooldownRemaining,
    deleteMessage, markMessageAsRead, getMessageSource, downloadAttachment, generateDemoEmail
} from '../../services/mailService';
import { EmailSummary, EmailDetail, MailboxState } from '../../types';
import { Button } from '../Button';

const REFRESH_INTERVAL = 8000; // 8s polling

// Simple "Ding" sound (Base64 MP3 stub)
const BEEP_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU";

interface Notification {
    type: 'success' | 'error' | 'info';
    message: string;
}

const TempMailClient: React.FC = () => {
    const [mailbox, setMailbox] = useState<MailboxState | null>(null);
    const [messages, setMessages] = useState<EmailSummary[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [copied, setCopied] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [notification, setNotification] = useState<Notification | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // New Features State
    const [progress, setProgress] = useState(0);
    const [showRawSource, setShowRawSource] = useState(false);
    const [rawSourceContent, setRawSourceContent] = useState<string>('');
    const [isLoadingSource, setIsLoadingSource] = useState(false);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastRefreshTimeRef = useRef<number>(Date.now());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio(BEEP_SOUND);
    }, []);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    }, []);

    // Cooldown sync
    useEffect(() => {
        setCooldown(getCooldownRemaining());
        const interval = setInterval(() => {
            setCooldown(getCooldownRemaining());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const initMailbox = useCallback(async (forceNew = false) => {
        if (forceNew) {
            const remaining = getCooldownRemaining();
            if (remaining > 0) {
                showNotification(`Please wait ${remaining}s before creating a new ID.`, 'error');
                return;
            }
        }

        setIsInitializing(true);
        try {
            const mb = await generateMailbox(forceNew);
            setMailbox(mb);
            setMessages([]);
            setSelectedEmail(null);
            setProgress(0);

            if (forceNew) {
                setCooldown(60);
                showNotification("New identity created successfully.", "success");
            }
        } catch (e: any) {
            console.error(e);
            let msg = e.message || "Failed to generate mailbox";
            if (msg.includes('wait') || msg.includes('429')) {
                const remaining = getCooldownRemaining();
                setCooldown(remaining);
                msg = `Rate limit hit. Please wait ${remaining}s.`;
            }
            showNotification(msg, 'error');
        } finally {
            setIsInitializing(false);
        }
    }, [showNotification]);

    useEffect(() => {
        initMailbox(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchMessages = useCallback(async (isAuto = false) => {
        if (!mailbox) return;

        if (!isAuto) {
            setIsLoadingMessages(true);
        }

        lastRefreshTimeRef.current = Date.now();
        setProgress(0);

        const startTime = Date.now();

        try {
            const msgs = await getMessages(mailbox.token);

            setMessages(prev => {
                if (prev.length > 0 && msgs.length > 0 && msgs[0].id !== prev[0].id) {
                    if (audioRef.current) {
                        audioRef.current.play().catch(e => console.log("Audio play failed", e));
                    }
                    showNotification("New email received!", "info");
                }

                if (JSON.stringify(prev) !== JSON.stringify(msgs)) {
                    return msgs;
                }
                return prev;
            });
        } finally {
            if (!isAuto) {
                const elapsed = Date.now() - startTime;
                if (elapsed < 500) {
                    await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
                }
                setIsLoadingMessages(false);
            }
        }
    }, [mailbox, showNotification]);

    // Polling & Progress Bar Effect
    useEffect(() => {
        if (mailbox && mailbox.token !== 'DEMO_MODE') {
            fetchMessages(true);

            pollTimerRef.current = setInterval(() => fetchMessages(true), REFRESH_INTERVAL);

            progressTimerRef.current = setInterval(() => {
                const elapsed = Date.now() - lastRefreshTimeRef.current;
                const p = Math.min((elapsed / REFRESH_INTERVAL) * 100, 100);
                setProgress(p);
            }, 100);
        }
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        };
    }, [mailbox, fetchMessages]);

    const handleSelectEmail = useCallback(async (summary: EmailSummary) => {
        setMessages(prev => prev.map(m => m.id === summary.id ? { ...m, seen: true } : m));

        setSelectedEmail({
            ...summary,
            body: 'Loading...',
            textBody: 'Loading...',
            htmlBody: '',
            attachments: [],
            seen: true
        });

        if (mailbox) {
            if (!summary.seen && mailbox.token !== 'DEMO_MODE') {
                markMessageAsRead(mailbox.token, summary.id);
            }

            const full = await getMessage(mailbox.token, summary.id);
            if (full) {
                setSelectedEmail(full);
            } else {
                const found = messages.find(m => m.id === summary.id);
                if (found && 'body' in found) {
                    setSelectedEmail(found as EmailDetail);
                }
            }
        }
    }, [mailbox, messages]);

    const handleDeleteEmail = useCallback(async () => {
        if (!selectedEmail || !mailbox) return;
        setIsDeleting(true);
        try {
            const success = await deleteMessage(mailbox.token, selectedEmail.id);
            if (success) {
                setMessages(prev => prev.filter(m => m.id !== selectedEmail.id));
                setSelectedEmail(null);
                showNotification("Email deleted", "success");
            } else {
                showNotification("Failed to delete", "error");
            }
        } catch (e) {
            showNotification("Error deleting", "error");
        } finally {
            setIsDeleting(false);
        }
    }, [selectedEmail, mailbox, showNotification]);

    const handleViewSource = useCallback(async () => {
        if (!selectedEmail || !mailbox) return;
        setIsLoadingSource(true);
        setShowRawSource(true);
        try {
            const source = await getMessageSource(mailbox.token, selectedEmail.id);
            setRawSourceContent(source || "Failed to load source.");
        } finally {
            setIsLoadingSource(false);
        }
    }, [selectedEmail, mailbox]);

    // Stable handler for link clicks to avoid re-renders on every tick
    const handleBodyClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor && (anchor as HTMLAnchorElement).href) {
            e.preventDefault();
            e.stopPropagation();
            window.open((anchor as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer');
        }
    }, []);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showRawSource) return;

            if (e.key === 'r' || e.key === 'R') {
                fetchMessages();
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedEmail) handleDeleteEmail();
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (messages.length === 0) return;
                // prevent scrolling page
                if (e.target === document.body) e.preventDefault();

                const currentIndex = selectedEmail
                    ? messages.findIndex(m => m.id === selectedEmail.id)
                    : -1;

                let nextIndex = currentIndex;

                if (e.key === 'ArrowDown') {
                    nextIndex = currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
                } else {
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : messages.length - 1;
                }

                handleSelectEmail(messages[nextIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [messages, selectedEmail, showRawSource, fetchMessages, handleDeleteEmail, handleSelectEmail]);

    const copyToClipboard = () => {
        if (mailbox) {
            navigator.clipboard.writeText(mailbox.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showNotification("Copied", "success");
        }
    };

    const injectDemoEmail = () => {
        const fake = generateDemoEmail('demo-' + Date.now());
        setMessages(prev => [fake, ...prev]);
    };

    // MEMOIZED VIEW FOR EMAIL DETAIL
    // This prevents the email body from re-rendering when the progress bar updates (every 100ms)
    // This solves the text selection disappearance issue.
    const emailDetailView = useMemo(() => {
        if (!selectedEmail) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                    <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 opacity-30" strokeWidth={1.5} />
                    </div>
                    <span className="text-lg font-medium opacity-50">Select an email to read</span>
                </div>
            );
        }

        return (
            <>
                <div className="p-4 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/50">
                    <div className="flex items-center gap-2 lg:hidden">
                        <button onClick={() => setSelectedEmail(null)} className="p-2 -ml-2 text-zinc-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                    </div>
                    <div className="flex gap-2 ml-auto">
                        {/* <button onClick={handleViewSource} className="p-2 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-800" title="View Source">
                            <Code size={18} />
                        </button> */}
                        <button onClick={handleDeleteEmail} disabled={isDeleting} className="p-2 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800" title="Delete">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 pb-2">
                    <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{selectedEmail.subject}</h2>
                    <div className="flex items-center justify-between flex-wrap gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {selectedEmail.from.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-zinc-200">{selectedEmail.from}</div>
                                <div className="text-xs text-zinc-500">to: {mailbox?.address}</div>
                            </div>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                            {new Date(selectedEmail.date).toLocaleString()}
                        </div>
                    </div>
                </div>

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                    <div className="px-6 py-2">
                        <div className="flex flex-wrap gap-2">
                            {selectedEmail.attachments.map(att => (
                                <button
                                    key={att.id}
                                    onClick={() => downloadAttachment(mailbox!.token, att.downloadUrl, att.filename)}
                                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
                                >
                                    <Paperclip size={14} className="text-orange-500" />
                                    <span className="truncate max-w-[150px]">{att.filename}</span>
                                    <Download size={14} className="ml-1 opacity-50" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="bg-white text-zinc-900 rounded-xl p-6 min-h-full shadow-inner selection:bg-blue-200 selection:text-blue-900">
                        {selectedEmail.htmlBody ? (
                            <div
                                className="prose prose-sm max-w-none prose-a:text-blue-600 prose-headings:text-zinc-900 break-words"
                                dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }}
                                onClick={handleBodyClick}
                            />
                        ) : (
                            <pre className="whitespace-pre-wrap font-mono text-sm">{selectedEmail.body}</pre>
                        )}
                    </div>
                </div>
            </>
        );
    }, [selectedEmail, isDeleting, mailbox, handleBodyClick, handleViewSource, handleDeleteEmail]);

    return (
        <div className="flex flex-col h-full w-full font-sans gap-6 p-2 lg:p-0">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 mb-2">
                    <Mail className="text-orange-500 w-6 h-6" />
                    <h1 className="text-xl font-bold text-white tracking-tight">Temporary Email</h1>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800/60 p-1.5 flex items-center pr-2 relative group transition-all hover:border-zinc-700">
                    <div className="pl-4 flex-1 font-mono text-zinc-300 text-lg truncate select-all">
                        {isInitializing ? "Generating ID..." : (mailbox?.address || "Wait...")}
                    </div>

                    <button
                        onClick={copyToClipboard}
                        className="p-3 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                        title="Copy Address"
                    >
                        {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>

                <button
                    onClick={() => initMailbox(true)}
                    disabled={isInitializing || cooldown > 0}
                    className={`
                bg-zinc-900 border border-zinc-800/60 text-white rounded-xl px-6 py-3 font-semibold 
                flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                whitespace-nowrap shadow-sm
            `}
                >
                    {cooldown > 0 ? (
                        <>
                            <Clock className="w-5 h-5 text-orange-500" />
                            <span>Wait {cooldown}s</span>
                        </>
                    ) : (
                        <>
                            <RotateCw className={`w-5 h-5 ${isInitializing ? 'animate-spin' : ''}`} />
                            <span>New Address</span>
                        </>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-4 bg-zinc-900 rounded-2xl border border-zinc-800/60 flex flex-col overflow-hidden shadow-sm">
                    <div className="h-1 w-full bg-zinc-950">
                        <div
                            className="h-full bg-orange-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="p-5 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/50">
                        <span className="font-bold text-zinc-400 text-sm tracking-wider">INBOX ({messages.length})</span>
                        <button
                            onClick={() => fetchMessages()}
                            disabled={isLoadingMessages}
                            className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4 min-h-[300px]">
                                <Mail className="w-16 h-16 opacity-20" strokeWidth={1.5} />
                                <span className="text-sm font-medium opacity-50">Waiting for incoming emails...</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {messages.map((msg) => {
                                    const isSelected = selectedEmail?.id === msg.id;
                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => handleSelectEmail(msg)}
                                            className={`
                                        p-4 rounded-xl cursor-pointer transition-all duration-200 border
                                        ${isSelected
                                                    ? 'bg-zinc-950 border-orange-500/30 ring-1 ring-orange-500/20'
                                                    : 'bg-transparent border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'
                                                }
                                    `}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {!msg.seen && <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 animate-pulse"></div>}
                                                    <span className={`text-sm truncate ${!msg.seen ? 'font-bold text-white' : 'font-medium text-zinc-400'} ${isSelected ? 'text-orange-100' : ''}`}>
                                                        {msg.from}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-zinc-600 flex-shrink-0 bg-zinc-950/50 px-1.5 py-0.5 rounded">
                                                    {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className={`text-sm truncate mb-1 ${!msg.seen ? 'text-zinc-200' : 'text-zinc-500'}`}>
                                                {msg.subject || '(No Subject)'}
                                            </div>
                                            <div className="text-xs text-zinc-600 truncate">
                                                {msg.intro || "No preview available"}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-8 bg-zinc-900 rounded-2xl border border-zinc-800/60 flex flex-col overflow-hidden shadow-sm min-h-[500px]">
                    {emailDetailView}
                </div>
            </div>

            {showRawSource && (
                <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                            <h3 className="text-zinc-200 font-medium flex items-center gap-2">
                                <Code size={16} className="text-orange-500" /> Raw Message Source
                            </h3>
                            <button onClick={() => setShowRawSource(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-zinc-950 custom-scrollbar">
                            {isLoadingSource ? (
                                <div className="text-zinc-500 flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Loading...</div>
                            ) : (
                                <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap break-all">{rawSourceContent}</pre>
                            )}
                        </div>
                        <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end">
                            <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(rawSourceContent); showNotification("Copied Source", "success") }}>Copy to Clipboard</Button>
                        </div>
                    </div>
                </div>
            )}

            {notification && (
                <div className={`fixed bottom-8 right-8 z-[70] px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${notification.type === 'error' ? 'bg-red-500 text-white border-red-600' :
                    notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' :
                        'bg-zinc-800 text-white border-zinc-700'
                    }`}>
                    {notification.type === 'error' ? <AlertCircle size={20} /> : notification.type === 'success' ? <CheckCircle2 size={20} /> : <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                    <span className="font-medium">{notification.message}</span>
                </div>
            )}

        </div>
    );
};

export default TempMailClient;