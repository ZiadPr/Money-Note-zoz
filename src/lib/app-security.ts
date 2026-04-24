import { b64ToBuf, bufToB64, randomBytes } from "./crypto";

export interface AppSecuritySettings {
  pinEnabled: boolean;
  pinSalt?: string;
  pinHash?: string;
  lockOnBackground: boolean;
}

const SETTINGS_KEY = "mn-app-security-v1";
const SESSION_UNLOCK_KEY = "mn-app-unlocked-v1";
export const SECURITY_CHANGED_EVENT = "mn-security-changed";
export const LOCK_CHANGED_EVENT = "mn-lock-changed";

const defaultSettings: AppSecuritySettings = {
  pinEnabled: false,
  lockOnBackground: true,
};

function normalizeSettings(value?: Partial<AppSecuritySettings> | null): AppSecuritySettings {
  return {
    pinEnabled: Boolean(value?.pinEnabled && value?.pinSalt && value?.pinHash),
    pinSalt: value?.pinSalt,
    pinHash: value?.pinHash,
    lockOnBackground: value?.lockOnBackground !== false,
  };
}

function emitSecurityChanged() {
  window.dispatchEvent(new Event(SECURITY_CHANGED_EVENT));
}

function emitLockChanged() {
  window.dispatchEvent(new Event(LOCK_CHANGED_EVENT));
}

function saveSettings(settings: AppSecuritySettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  emitSecurityChanged();
}

async function hashPin(pin: string, saltB64: string): Promise<string> {
  const pinBytes = new TextEncoder().encode(pin);
  const saltBytes = new Uint8Array(b64ToBuf(saltB64));
  const combined = new Uint8Array(saltBytes.length + pinBytes.length);
  combined.set(saltBytes);
  combined.set(pinBytes, saltBytes.length);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return bufToB64(digest);
}

export function getSecuritySettings(): AppSecuritySettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export async function enablePin(pin: string): Promise<void> {
  const current = getSecuritySettings();
  const saltBytes = randomBytes(16);
  const salt = bufToB64(saltBytes.buffer.slice(0) as ArrayBuffer);
  const pinHash = await hashPin(pin, salt);

  saveSettings({
    ...current,
    pinEnabled: true,
    pinSalt: salt,
    pinHash,
  });
  unlockAppSession();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const settings = getSecuritySettings();
  if (!settings.pinEnabled || !settings.pinSalt || !settings.pinHash) return false;
  return (await hashPin(pin, settings.pinSalt)) === settings.pinHash;
}

export async function changePin(currentPin: string, nextPin: string): Promise<boolean> {
  const currentOk = await verifyPin(currentPin);
  if (!currentOk) return false;
  await enablePin(nextPin);
  return true;
}

export async function disablePin(currentPin: string): Promise<boolean> {
  const currentOk = await verifyPin(currentPin);
  if (!currentOk) return false;

  saveSettings({
    pinEnabled: false,
    lockOnBackground: getSecuritySettings().lockOnBackground,
  });
  unlockAppSession();
  return true;
}

export function updateSecuritySettings(patch: Partial<AppSecuritySettings>) {
  saveSettings({
    ...getSecuritySettings(),
    ...patch,
  });
}

export function unlockAppSession() {
  sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
  emitLockChanged();
}

export function lockAppSession() {
  sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  emitLockChanged();
}

export function isAppLockRequired(): boolean {
  const settings = getSecuritySettings();
  if (!settings.pinEnabled) return false;
  return sessionStorage.getItem(SESSION_UNLOCK_KEY) !== "1";
}

export function clearAppSecurity() {
  localStorage.removeItem(SETTINGS_KEY);
  sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  emitSecurityChanged();
  emitLockChanged();
}
