
import { EmailSummary, EmailDetail, MailboxState, Attachment } from '../types';

const API_BASE = 'https://api.mail.tm';
const STORAGE_KEY = 'tempmail_creds_v1';
const COOLDOWN_KEY = 'tempmail_last_created_at';
const COOLDOWN_DURATION = 60000; // 60 seconds cooldown between new accounts

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Credentials {
  address: string;
  password: string;
}

const saveCredentials = (creds: Credentials) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch (e) {
    console.error("Failed to save credentials", e);
  }
};

const getCredentials = (): Credentials | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

const clearCredentials = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// --- RATE LIMITING LOGIC ---
const updateLastCreationTime = () => {
  localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
};

export const getCooldownRemaining = (): number => {
  try {
    const last = localStorage.getItem(COOLDOWN_KEY);
    if (!last) return 0;
    const diff = Date.now() - parseInt(last, 10);
    if (diff < COOLDOWN_DURATION) {
      return Math.ceil((COOLDOWN_DURATION - diff) / 1000);
    }
    return 0;
  } catch {
    return 0;
  }
};
// ---------------------------

export const generateMailbox = async (forceNew = false): Promise<MailboxState> => {
  // 1. Try to restore existing session if not forced to create new
  if (!forceNew) {
    const existing = getCredentials();
    if (existing) {
      try {
        const tokenRes = await fetch(`${API_BASE}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing)
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          return { address: existing.address, token: tokenData.token };
        } else {
          // Token invalid or account deleted, clear and continue to generate new
          console.warn("Stored credentials invalid, creating new account.");
          clearCredentials();
        }
      } catch (e) {
        // If network error during restore, we might want to return demo mode or try creating new
        console.warn("Failed to restore session due to network error", e);
      }
    }
  } else {
    // SECURITY: Client-side Rate Limiting Check
    const remaining = getCooldownRemaining();
    if (remaining > 0) {
      throw new Error(`Please wait ${remaining}s before creating a new ID.`);
    }
    // If forcing new, clear old creds
    clearCredentials();
  }

  // 2. Create new account with retries and backoff
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Fetch available domains
      const domainsRes = await fetch(`${API_BASE}/domains`);
      if (!domainsRes.ok) throw new Error("Failed to fetch domains");
      const domainsData = await domainsRes.json();

      if (!domainsData['hydra:member'] || domainsData['hydra:member'].length === 0) {
        throw new Error("No domains available");
      }

      const domain = domainsData['hydra:member'][0].domain;

      // Generate credentials
      // Random English Names
      const firstNames = [
        "James", "John", "Robert", "Michael", "William", "David", "Richard",
        "Charles", "Joseph", "Thomas", "Christopher", "Daniel", "Paul", "Mark",
        "Donald", "George", "Steven", "Kenneth", "Andrew", "Joshua", "Kevin",
        "Brian", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan",
        "Jacob", "Gary", "Nicholas", "Eric", "Stephen", "Jonathan", "Larry"
      ];

      const lastNames = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
        "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
        "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
        "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
        "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King"
      ];

      // Pick random first + last name
      const first = firstNames[Math.floor(Math.random() * firstNames.length)];
      const last = lastNames[Math.floor(Math.random() * lastNames.length)];

      // Add a 4-digit number
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      // Build username: firstname + lastname + number
      const username = `${first}${last}${randomNum}`.toLowerCase();
      const password = `P${Math.random().toString(36).slice(-10)}!`;
      const address = `${username}@${domain}`;

      // Register Account
      const regRes = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      if (regRes.status === 429) {
        // If server limits us, enforce a local penalty
        updateLastCreationTime();
        console.warn(`Rate limited (429). Retrying in ${(attempts + 1) * 2}s...`);
        await delay((attempts + 1) * 2000); // 2s, 4s, 6s wait
        attempts++;
        continue;
      }

      if (!regRes.ok) {
        throw new Error(`Registration failed: ${regRes.status}`);
      }

      // Get Auth Token
      const tokenRes = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, password })
      });

      if (!tokenRes.ok) throw new Error("Failed to obtain token");

      const tokenData = await tokenRes.json();

      // Successfully created, save credentials and update rate limit timestamp
      saveCredentials({ address, password });
      updateLastCreationTime();

      return { address, token: tokenData.token };

    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed:`, error);
      attempts++;
      if (attempts >= maxAttempts) break;
      await delay(1000);
    }
  }

  // Fallback if all attempts fail
  console.warn("Mail Service Unavailable (Rate Limit or Network). Switching to Offline Demo Mode.");
  return {
    address: `demo.user@offline-mode.com`,
    token: 'DEMO_MODE'
  };
};

export const getMessages = async (token: string): Promise<EmailSummary[]> => {
  if (token === 'DEMO_MODE') return [];

  try {
    const res = await fetch(`${API_BASE}/messages?page=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return [];

    const data = await res.json();
    return (data['hydra:member'] || []).map((msg: any) => ({
      id: msg.id,
      from: `${msg.from.name || ''} <${msg.from.address}>`.trim(),
      subject: msg.subject,
      date: msg.createdAt,
      intro: msg.intro,
      seen: msg.seen,
      hasAttachments: msg.hasAttachments
    }));
  } catch (error) {
    return [];
  }
};

export const getMessage = async (token: string, id: string): Promise<EmailDetail | null> => {
  if (token === 'DEMO_MODE') return null;

  try {
    const res = await fetch(`${API_BASE}/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return null;

    const data = await res.json();

    let htmlBody = data.html ? data.html[0] : "";

    // SANITIZATION
    if (htmlBody) {
      htmlBody = htmlBody.replace(/src=["'](attachment|cid):[^"']*["']/gi, 'src="" alt="[Embedded Image Not Supported]"');
    }

    return {
      id: data.id,
      from: `${data.from.name || ''} <${data.from.address}>`.trim(),
      subject: data.subject,
      date: data.createdAt,
      intro: data.intro,
      body: data.text || "No text content",
      textBody: data.text || "",
      htmlBody: htmlBody,
      seen: data.seen,
      hasAttachments: data.hasAttachments,
      attachments: (data.attachments || []).map((att: any) => ({
        id: att.id,
        filename: att.filename,
        contentType: att.contentType,
        disposition: att.disposition,
        transferEncoding: att.transferEncoding,
        related: att.related,
        size: att.size,
        downloadUrl: att.downloadUrl
      }))
    };
  } catch (error) {
    console.error("Error fetching message detail:", error);
    return null;
  }
};

export const markMessageAsRead = async (token: string, id: string): Promise<boolean> => {
  if (token === 'DEMO_MODE') return true;
  try {
    await fetch(`${API_BASE}/messages/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/merge-patch+json'
      },
      body: JSON.stringify({ seen: true })
    });
    return true;
  } catch (e) {
    console.error("Failed to mark as read", e);
    return false;
  }
};

export const getMessageSource = async (token: string, id: string): Promise<string | null> => {
  if (token === 'DEMO_MODE') return "Demo Mode - No Raw Source";
  try {
    const res = await fetch(`${API_BASE}/messages/${id}/source`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    // The endpoint typically returns raw text directly
    return await res.text();
  } catch (e) {
    return null;
  }
};

export const downloadAttachment = async (token: string, downloadUrl: string, filename: string) => {
  if (token === 'DEMO_MODE') return;
  try {
    const res = await fetch(`${API_BASE}${downloadUrl}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Download failed");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (e) {
    console.error("Attachment download error", e);
    alert("Failed to download attachment");
  }
};

export const deleteMessage = async (token: string, id: string): Promise<boolean> => {
  if (token === 'DEMO_MODE') return true;

  try {
    const res = await fetch(`${API_BASE}/messages/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    return res.ok;
  } catch (error) {
    console.error("Error deleting message:", error);
    return false;
  }
};

// Demo Data Generator
export const generateDemoEmail = (idPrefix: string) => {
  const id = `${idPrefix}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    from: "security@net-flix-verify.com",
    subject: "Urgent: Update your payment details immediately",
    date: new Date().toISOString(),
    body: "Dear Customer...",
    textBody: "Dear Customer...",
    htmlBody: "<div>...</div>",
    seen: false,
    hasAttachments: false
  };
};
