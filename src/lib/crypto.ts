// أدوات التشفير المحلية AES-GCM + HMAC-SHA256
// كل شيء يعمل أوفلاين عبر Web Crypto API

const enc = new TextEncoder();
const dec = new TextDecoder();

export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function randomBytes(len: number): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}

export function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = randomBytes(16);
  return bufToB64(b.buffer.slice(0) as ArrayBuffer).replace(/[^a-zA-Z0-9]/g, "").slice(0, 22);
}

// اشتقاق مفتاح من كلمة سر بـ PBKDF2
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// توليد مفتاح AES جديد
export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportKeyRaw(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToB64(raw);
}

export async function importAesKeyRaw(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64ToBuf(b64), { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function importHmacKeyRaw(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64ToBuf(b64), { name: "HMAC", hash: "SHA-256" }, true, ["sign", "verify"]);
}

// تشفير كائن JSON
export async function encryptJson(key: CryptoKey, data: unknown): Promise<string> {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(data))
  );
  return JSON.stringify({ iv: bufToB64(iv.buffer.slice(0) as ArrayBuffer), ct: bufToB64(ciphertext) });
}

export async function decryptJson<T = unknown>(key: CryptoKey, payload: string): Promise<T> {
  const { iv, ct } = JSON.parse(payload);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBuf(iv) },
    key,
    b64ToBuf(ct)
  );
  return JSON.parse(dec.decode(plain));
}

// HMAC للتوقيع
export async function hmacSign(secretB64: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBuf(secretB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufToB64(sig);
}

export async function hmacVerify(secretB64: string, message: string, sigB64: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBuf(secretB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, b64ToBuf(sigB64), enc.encode(message));
}

// مفتاح HMAC عشوائي
export function generateHmacSecret(): string {
  const b = randomBytes(32);
  return bufToB64(b.buffer.slice(0) as ArrayBuffer);
}
