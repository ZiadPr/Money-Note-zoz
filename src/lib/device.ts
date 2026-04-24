// توليد معرّف شبه ثابت للجهاز
// ملاحظة: المتصفحات لا تكشف الـ IMEI، لذا نعتمد على بصمة المتصفح/الجهاز
// مع تخزين دائم في localStorage. عند نشر التطبيق عبر Capacitor يمكن
// استبدال هذا بـ getId الحقيقي من plugin (Device).

const KEY = "mn-device-uid-v1";

type NavigatorWithDeviceHints = Navigator & {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  platform?: string;
};

function fingerprintRaw(): string {
  const nav = navigator as NavigatorWithDeviceHints;
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(","),
    String(screen.width) + "x" + String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    nav.hardwareConcurrency ?? "",
    nav.deviceMemory ?? "",
    nav.platform ?? "",
  ];
  return parts.join("|");
}

async function sha256Hex(input: string): Promise<string> {
  // crypto.subtle يشتغل بس في Secure Context (HTTPS أو localhost)
  if (crypto?.subtle) {
    const buf = new TextEncoder().encode(input);
    const h = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(h);
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  // fallback: hash بسيط لو مش في Secure Context (مثلاً HTTP على IP)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // تحويل لـ 32-bit integer
  }
  const h = Math.abs(hash).toString(16).padStart(8, "0");
  return (h + h + h + h).slice(0, 32); // 32 حرف hex
}

export async function getDeviceUid(): Promise<string> {
  const cached = localStorage.getItem(KEY);
  if (cached) return cached;

  const fp = fingerprintRaw();
  const hex = await sha256Hex(fp);

  // تنسيق ثلاثي مرئي: MN-XXXX-XXXX-XXXX-XXXX
  const id =
    "MN-" +
    hex.slice(0, 4).toUpperCase() +
    "-" +
    hex.slice(4, 8).toUpperCase() +
    "-" +
    hex.slice(8, 12).toUpperCase() +
    "-" +
    hex.slice(12, 16).toUpperCase();

  localStorage.setItem(KEY, id);
  return id;
}

// استبدال الـ UID (يُستخدم فقط عند مسح كل البيانات)
export function clearDeviceUid() {
  localStorage.removeItem(KEY);
}