import { EmailSummary, EmailDetail, MailboxState } from '../types';

const API_BASE = 'https://api.mail.tm';
const STORAGE_KEY = 'tempmail_creds_v1';

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
        const username = `user${Math.floor(Math.random() * 10000000)}`;
        const password = `P${Math.random().toString(36).slice(-10)}!`;
        const address = `${username}@${domain}`;

        // Register Account
        const regRes = await fetch(`${API_BASE}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, password })
        });
        
        if (regRes.status === 429) {
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
        
        // Successfully created, save credentials
        saveCredentials({ address, password });

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
      intro: msg.intro
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
    
    // SANITIZATION: Remove unsupported URL schemes to prevent console errors
    // Browsers will throw ERR_UNKNOWN_URL_SCHEME for attachment: and cid:
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
      htmlBody: htmlBody
    };
  } catch (error) {
    console.error("Error fetching message detail:", error);
    return null;
  }
};