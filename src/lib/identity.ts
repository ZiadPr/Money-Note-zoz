// إدارة الهوية الرقمية للمستخدم
import { db, type UserIdentity } from "./db";
import { uuid, generateHmacSecret } from "./crypto";
import { getDeviceUid, clearDeviceUid } from "./device";
import { clearAppSecurity } from "./app-security";

export async function getIdentity(): Promise<UserIdentity | undefined> {
  const all = await db.identity.toArray();
  return all[0];
}

export async function createIdentity(name: string): Promise<UserIdentity> {
  const id = uuid();
  const deviceUid = await getDeviceUid();
  const identity: UserIdentity = {
    id,
    name,
    publicId: id,
    hmacSecret: generateHmacSecret(),
    deviceUid,
    deepSecret: generateHmacSecret(),
    createdAt: Date.now(),
  };
  await db.identity.put(identity);
  return identity;
}

export async function updateName(name: string): Promise<void> {
  const cur = await getIdentity();
  if (!cur) return;
  await db.identity.update(cur.id, { name });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  clearDeviceUid();
  clearAppSecurity();
  await db.open();
}
