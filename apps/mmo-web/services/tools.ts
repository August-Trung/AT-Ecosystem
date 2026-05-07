// 2FA TOTP Helper (Simplified RFC 6238)

export const generateTOTP = async (secret: string): Promise<string> => {
  if (!secret) return '';
  
  // Clean secret: remove spaces and padding characters
  const key = secret.replace(/\s/g, '').toUpperCase().replace(/=/g, '');
  
  // Valid Base32? (A-Z and 2-7)
  if (!/^[A-Z2-7]+$/.test(key)) return 'INVALID'; // Return invalid instead of throwing to prevent app crash

  const epoch = Math.round(new Date().getTime() / 1000.0);
  const time = Math.floor(epoch / 30).toString(16).padStart(16, '0');

  // Robust Base32 Decode
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const length = key.length;
  const output = new Uint8Array((length * 5) / 8);
  let bits = 0;
  let value = 0;
  let index = 0;

  for (let i = 0; i < length; i++) {
    const charIndex = alphabet.indexOf(key[i]);
    if (charIndex === -1) continue;
    
    value = (value << 5) | charIndex;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xFF;
      bits -= 8;
    }
  }
  
  // Use only the filled bytes
  const bytes = output.slice(0, index);

  // HMAC-SHA1
  // We need to convert hex time to Uint8Array
  const timeBytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    timeBytes[i] = parseInt(time.substr(i * 2, 2), 16);
  }

  try {
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw", bytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    
    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, timeBytes);
    const signatureArray = new Uint8Array(signature);
    
    const offset = signatureArray[signatureArray.length - 1] & 0xf;
    const binary =
      ((signatureArray[offset] & 0x7f) << 24) |
      ((signatureArray[offset + 1] & 0xff) << 16) |
      ((signatureArray[offset + 2] & 0xff) << 8) |
      (signatureArray[offset + 3] & 0xff);
      
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (e) {
    console.error("Crypto Error", e);
    return 'ERROR';
  }
};

export const getRemainingTime = () => {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
};