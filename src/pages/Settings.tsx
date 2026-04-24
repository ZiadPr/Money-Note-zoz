import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Cpu,
  Download,
  Heart,
  Info,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  QrCode,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QRDisplay } from "@/components/QRDisplay";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useIdentity, notifyIdentityChanged } from "@/hooks/useIdentity";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { clearAllData, updateName } from "@/lib/identity";
import { db, logSecurity, type Association, type SecurityLog } from "@/lib/db";
import { toast } from "@/hooks/use-toast";
import {
  DEEP_CONFIRM_WINDOW_MS,
  encodeQr,
  signDeepConfirm,
  type DeepConfirmQr,
  type IdentityQr,
} from "@/lib/qr-payload";
import { clearJoinSession, getJoinSession } from "@/lib/join-session";
import { formatDateTime, shortId } from "@/lib/format";
import {
  changePin,
  disablePin,
  enablePin,
  getSecuritySettings,
  isValidPin,
  lockAppSession,
  SECURITY_CHANGED_EVENT,
  updateSecuritySettings,
} from "@/lib/app-security";

export default function Settings() {
  const { identity, refresh } = useIdentity();
  const { verified: identityVerified } = useIdentityVerification(identity?.publicId);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(identity?.name ?? "");
  const [deepQr, setDeepQr] = useState<string | null>(null);
  const [deepTs, setDeepTs] = useState(Date.now());
  const [, setTick] = useState(0);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [joinSession, setJoinSession] = useState(getJoinSession());
  const [associations, setAssociations] = useState<Association[]>([]);
  const [securitySettings, setSecuritySettings] = useState(getSecuritySettings());
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [nextPinConfirm, setNextPinConfirm] = useState("");

  useEffect(() => {
    setName(identity?.name ?? "");
  }, [identity]);

  useEffect(() => {
    if (!identity) return;

    let mounted = true;
    const generate = async () => {
      const ts = Date.now();
      const sig = await signDeepConfirm(identity.deepSecret, identity.publicId, identity.deviceUid, ts);
      const payload: DeepConfirmQr = {
        t: "deep-confirm",
        pid: identity.publicId,
        uid: identity.deviceUid,
        name: identity.name,
        ts,
        sig,
      };

      if (!mounted) return;
      setDeepQr(encodeQr(payload));
      setDeepTs(ts);
    };

    generate();
    const timer = setInterval(generate, DEEP_CONFIRM_WINDOW_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [identity]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((value) => value + 1);
      setJoinSession(getJoinSession());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadAssociations = async () => {
      const rows = await db.associations.orderBy("createdAt").reverse().toArray();
      setAssociations(rows);
    };

    loadAssociations();
  }, []);

  useEffect(() => {
    const syncSecurity = () => setSecuritySettings(getSecuritySettings());
    window.addEventListener(SECURITY_CHANGED_EVENT, syncSecurity);
    return () => window.removeEventListener(SECURITY_CHANGED_EVENT, syncSecurity);
  }, []);

  const remaining = useMemo(() => {
    const left = DEEP_CONFIRM_WINDOW_MS - (Date.now() - deepTs);
    return Math.max(0, Math.ceil(left / 1000));
  }, [deepTs]);

  const identityQr = useMemo<IdentityQr | null>(() => {
    if (!identity) return null;
    return {
      t: "identity",
      pid: identity.publicId,
      name: identity.name,
      uid: identity.deviceUid,
      hmac: identity.hmacSecret,
    };
  }, [identity]);

  const associationsCount = useMemo(
    () => ({
      all: associations.length,
      manager: associations.filter((assoc) => assoc.role === "manager").length,
      member: associations.filter((assoc) => assoc.role === "member").length,
    }),
    [associations]
  );

  const loadLogs = async () => {
    const all = await db.securityLogs.orderBy("createdAt").reverse().limit(50).toArray();
    setLogs(all);
    setShowLogs(true);
  };

  const refreshSecuritySettings = () => {
    setSecuritySettings(getSecuritySettings());
  };

  const resetPinForms = () => {
    setNewPin("");
    setConfirmPin("");
    setCurrentPin("");
    setNextPin("");
    setNextPinConfirm("");
  };

  const activatePin = async () => {
    if (!isValidPin(newPin)) {
      toast({ title: "رمز PIN يجب أن يكون من 4 إلى 8 أرقام", variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "تأكيد الرمز غير مطابق", variant: "destructive" });
      return;
    }

    await enablePin(newPin);
    await logSecurity("pin", "تم تفعيل رمز PIN المحلي");
    refreshSecuritySettings();
    resetPinForms();
    toast({ title: "تم تفعيل رمز PIN" });
  };

  const updatePin = async () => {
    if (!currentPin.trim()) {
      toast({ title: "أدخل الرمز الحالي أولًا", variant: "destructive" });
      return;
    }
    if (!isValidPin(nextPin)) {
      toast({ title: "الرمز الجديد يجب أن يكون من 4 إلى 8 أرقام", variant: "destructive" });
      return;
    }
    if (nextPin !== nextPinConfirm) {
      toast({ title: "تأكيد الرمز الجديد غير مطابق", variant: "destructive" });
      return;
    }

    const changed = await changePin(currentPin, nextPin);
    if (!changed) {
      toast({ title: "الرمز الحالي غير صحيح", variant: "destructive" });
      await logSecurity("pin", "فشل تغيير رمز PIN بسبب رمز حالي غير صحيح");
      return;
    }

    await logSecurity("pin", "تم تغيير رمز PIN المحلي");
    refreshSecuritySettings();
    resetPinForms();
    toast({ title: "تم تغيير رمز PIN" });
  };

  const removePin = async () => {
    if (!currentPin.trim()) {
      toast({ title: "أدخل الرمز الحالي لإيقاف الحماية", variant: "destructive" });
      return;
    }

    const disabled = await disablePin(currentPin);
    if (!disabled) {
      toast({ title: "الرمز الحالي غير صحيح", variant: "destructive" });
      await logSecurity("pin", "فشلت محاولة إيقاف رمز PIN");
      return;
    }

    await logSecurity("pin", "تم إيقاف رمز PIN المحلي");
    refreshSecuritySettings();
    resetPinForms();
    toast({ title: "تم إيقاف رمز PIN" });
  };

  const toggleLockOnBackground = (checked: boolean) => {
    updateSecuritySettings({ lockOnBackground: checked });
    refreshSecuritySettings();
  };

  const lockNow = async () => {
    await logSecurity("pin", "تم قفل التطبيق يدويًا");
    lockAppSession();
  };

  const saveName = async () => {
    if (!name.trim()) return;

    await updateName(name.trim());
    notifyIdentityChanged();
    refresh();
    setEditing(false);
    toast({ title: "تم تحديث الاسم" });
  };

  const exportBackup = async () => {
    const data = {
      identity: await db.identity.toArray(),
      associations: await db.associations.toArray(),
      members: await db.members.toArray(),
      transactions: await db.transactions.toArray(),
      pendingOps: await db.pendingOps.toArray(),
      exportedAt: Date.now(),
      version: 2,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moneynote-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير النسخة الاحتياطية" });
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version || !data.identity) throw new Error("ملف غير صالح");

      await db.transaction("rw", [db.identity, db.associations, db.members, db.transactions, db.pendingOps], async () => {
        await db.identity.clear();
        await db.associations.clear();
        await db.members.clear();
        await db.transactions.clear();
        await db.pendingOps.clear();
        await db.identity.bulkAdd(data.identity);
        await db.associations.bulkAdd(data.associations);
        await db.members.bulkAdd(data.members);
        await db.transactions.bulkAdd(data.transactions);
        if (data.pendingOps) await db.pendingOps.bulkAdd(data.pendingOps);
      });

      notifyIdentityChanged();
      toast({ title: "تم الاستيراد بنجاح" });
      window.location.reload();
    } catch (error) {
      toast({ title: "فشل الاستيراد", description: String(error), variant: "destructive" });
    }
  };

  const wipe = async () => {
    await clearAllData();
    notifyIdentityChanged();
    toast({ title: "تم مسح كل البيانات" });
    navigate("/", { replace: true });
  };

  if (!identity || !identityQr) {
    return (
      <AppShell>
        <AppHeader title="الإعدادات" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="الإعدادات" />

      <div className="p-4 animate-fade-in">
        <Accordion type="multiple" defaultValue={["account"]} className="space-y-3">
        <Section value="account" title="الحساب الشخصي" summary="الهوية الشخصية و QR الثابت وبيانات الجهاز">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                <span className="text-lg font-extrabold text-primary-foreground">{identity.name.slice(0, 2)}</span>
              </div>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="flex gap-1.5">
                    <Input value={name} onChange={(event) => setName(event.target.value)} className="bg-background/50 h-9" />
                    <Button size="sm" onClick={saveName} className="bg-gradient-primary">
                      حفظ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      إلغاء
                    </Button>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} className="w-full text-start">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold truncate">{identity.name}</p>
                      <VerifiedBadge verified={identityVerified} size="md" />
                      <Pencil className="size-3 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <p className="text-[11px] text-muted-foreground num-en">{shortId(identity.publicId)}</p>
                      <span className="text-[11px] text-muted-foreground">
                        {identityVerified ? "موثّق" : "غير موثّق بعد"}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="inline-flex items-center gap-2 text-sm font-semibold">
                <QrCode className="size-4 text-primary" />
                QR الشخصي الثابت
              </div>
              <QRDisplay value={encodeQr(identityQr)} size={180} />
              <p className="text-xs text-muted-foreground text-center">
                هذا هو QR الذي يمسحه المدير لبدء إضافتك إلى أي جمعية.
              </p>
            </div>

            <div className="rounded-lg bg-secondary/40 p-2.5 flex items-center gap-2">
              <Cpu className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">UID الجهاز (ثابت)</p>
                <p className="text-xs font-bold num-en truncate">{identity.deviceUid}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(identity.deviceUid);
                  toast({ title: "تم النسخ" });
                }}
              >
                <Copy className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </Card>
        </Section>

        <Section value="deep-confirm" title="تأكيد العمليات العميقة" summary="باركود التحقق الدوري والتأكيد العكسي لجلسات الانضمام">
          <Card className="card-elevated p-5 border-primary/30 flex flex-col items-center gap-3">
            {deepQr && <QRDisplay value={deepQr} size={180} />}
            <div className="flex items-center gap-2 text-sm">
              <Timer className={`size-4 ${remaining <= 5 ? "text-destructive animate-pulse" : "text-primary"}`} />
              <span className="text-muted-foreground">يتجدد خلال:</span>
              <span className={`font-bold num-en ${remaining <= 5 ? "text-destructive" : ""}`}>{remaining}</span>
              <span className="text-muted-foreground">ث</span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              يستخدمه المدير في الخطوة الأمنية الأولى عند إضافتك إلى جمعية.
            </p>

            <Button
              onClick={() => navigate("/scan")}
              variant="outline"
              className="w-full border-success/30 text-success hover:bg-success/10"
            >
              <ScanLine className="size-4 me-2" />
              التأكيد العكسي
            </Button>

            {joinSession && (
              <div className="w-full rounded-lg bg-warning/10 border border-warning/30 p-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-warning font-bold flex items-center gap-1">
                    <RefreshCw className="size-3" />
                    جلسة انضمام نشطة
                  </span>
                  <button
                    onClick={() => {
                      clearJoinSession();
                      setJoinSession(null);
                    }}
                    className="text-destructive"
                  >
                    إلغاء
                  </button>
                </div>
                <p className="text-muted-foreground mt-1">
                  بدأت في {formatDateTime(joinSession.startedAt)}
                </p>
              </div>
            )}
          </Card>
        </Section>

        <Section value="security" title="الأمان والحماية" summary="PIN المحلي وسجل عمليات الأمان وخيارات القفل">
          <Card className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <LockKeyhole className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">قفل التطبيق برمز PIN</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    حماية محلية عند فتح التطبيق أو عند الرجوع إليه بعد إخفائه.
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {securitySettings.pinEnabled ? "مفعّل" : "غير مفعّل"}
              </span>
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">القفل عند مغادرة التطبيق</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  عند الرجوع إلى التطبيق سيُطلب رمز PIN مرة أخرى.
                </p>
              </div>
              <Switch
                checked={securitySettings.lockOnBackground}
                onCheckedChange={toggleLockOnBackground}
                disabled={!securitySettings.pinEnabled}
              />
            </div>

            {!securitySettings.pinEnabled ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <PinField label="رمز PIN جديد" value={newPin} onChange={setNewPin} />
                  <PinField label="تأكيد الرمز" value={confirmPin} onChange={setConfirmPin} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  الرمز يجب أن يكون من 4 إلى 8 أرقام، ويُحفظ محليًا على هذا الجهاز فقط.
                </p>
                <Button
                  onClick={activatePin}
                  className="w-full bg-gradient-primary"
                  disabled={!newPin || !confirmPin}
                >
                  <KeyRound className="size-4 me-2" />
                  تفعيل رمز PIN
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <PinField label="الرمز الحالي" value={currentPin} onChange={setCurrentPin} />
                  <PinField label="الرمز الجديد" value={nextPin} onChange={setNextPin} />
                </div>
                <PinField label="تأكيد الرمز الجديد" value={nextPinConfirm} onChange={setNextPinConfirm} />
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={updatePin} className="bg-gradient-primary" disabled={!currentPin || !nextPin || !nextPinConfirm}>
                    تغيير الرمز
                  </Button>
                  <Button onClick={lockNow} variant="outline">
                    قفل الآن
                  </Button>
                </div>
                <Button
                  onClick={removePin}
                  variant="ghost"
                  className="w-full text-destructive hover:bg-destructive/10"
                  disabled={!currentPin}
                >
                  إيقاف رمز PIN
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-dashed border-border/50 p-3">
              <p className="text-sm font-semibold">البصمة أو الوجه</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                غير متاحين في نسخة الويب الحالية. عند تغليف التطبيق كتطبيق جوال أصلي يمكن ربطهما لاحقًا.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <button onClick={loadLogs} className="w-full flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                سجل عمليات الأمان
              </span>
              <span className="text-xs text-muted-foreground">{showLogs ? "مفتوح" : "عرض"}</span>
            </button>

            {showLogs && (
              <div className="mt-3 space-y-1.5 max-h-60 overflow-auto">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">لا سجلات بعد</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="text-xs rounded-md bg-secondary/30 p-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold">{labelForKind(log.kind)}</span>
                        <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">{log.detail}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </Section>

        <Section value="associations" title="الجمعيات" summary="ملخص جمعياتك وروابط الفتح والإعدادات السريعة">
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="الكل" value={String(associationsCount.all)} />
              <MiniStat label="مدير" value={String(associationsCount.manager)} />
              <MiniStat label="عضو" value={String(associationsCount.member)} />
            </div>

            {associations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
                <p className="text-sm font-semibold">لا توجد جمعيات بعد</p>
                <p className="text-xs text-muted-foreground mt-1">
                  أنشئ جمعية جديدة أو انضم عبر QR لتظهر هنا مع أزرارها السريعة.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {associations.map((association) => (
                  <div
                    key={association.id}
                    className="rounded-xl border border-border/50 bg-secondary/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm truncate">{association.name}</p>
                          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground border border-border/50">
                            {association.role === "manager" ? "مدير" : "عضو"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {association.myTurn ? `الدور ${association.myTurn}` : "بدون دور مضاف لي"} ·{" "}
                          {association.installmentAmount} جنيه
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/associations/${association.id}`)}
                        >
                          <ArrowLeft className="size-4 me-1" />
                          فتح
                        </Button>
                        {association.role === "manager" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/associations/${association.id}/settings`)}
                          >
                            <Settings2 className="size-4 me-1" />
                            إعدادات
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={() => navigate("/associations")} className="w-full">
              فتح قائمة الجمعيات
            </Button>
          </Card>
        </Section>

        <Section value="backup" title="النسخ الاحتياطي والاستيراد" summary="تصدير البيانات المحلية أو استيراد نسخة محفوظة">
          <Card className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              احفظ بياناتك محليًا أو استعدها من ملف. الملف يحتوي على هويتك وجمعياتك وسجلاتك.
            </p>
            <div className="flex gap-2">
              <Button onClick={exportBackup} variant="outline" className="flex-1">
                <Download className="size-4 me-2" />
                تصدير
              </Button>
              <label className="flex-1">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => event.target.files?.[0] && importBackup(event.target.files[0])}
                />
                <Button asChild variant="outline" className="w-full">
                  <span>
                    <Upload className="size-4 me-2" />
                    استيراد
                  </span>
                </Button>
              </label>
            </div>
          </Card>
        </Section>

        <Section value="developer" title="التواصل والدعم" summary="بيانات المطور وروابط التواصل والدعم المالي">
          <Card className="p-4 space-y-3">
            <div className="space-y-1">
              <p className="font-bold">ذياد يحيى زكريا أحمد</p>
              <p className="text-xs text-muted-foreground">مطوّر موني نوت</p>
            </div>

            <div className="space-y-2">
              <a href="tel:+201124148723" className="flex items-center gap-2 text-sm rounded-lg bg-secondary/40 p-2.5 hover:bg-secondary/60">
                <Phone className="size-4 text-primary" />
                <span className="num-en">+20 1124148723</span>
              </a>
              <a href="tel:+201096058900" className="flex items-center gap-2 text-sm rounded-lg bg-secondary/40 p-2.5 hover:bg-secondary/60">
                <Phone className="size-4 text-primary" />
                <span className="num-en">+20 1096058900</span>
              </a>
              <a href="mailto:ziadyahyazakaria@gmail.com" className="flex items-center gap-2 text-sm rounded-lg bg-secondary/40 p-2.5 hover:bg-secondary/60">
                <Mail className="size-4 text-primary" />
                <span>ziadyahyazakaria@gmail.com</span>
              </a>
            </div>
          </Card>

          <Card className="p-4 mt-3 border-accent/30 bg-accent/5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
                <Heart className="size-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">ادعم المطور</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  إذا أعجبك التطبيق وأفادك، يمكنك دعم المطور ماليًا عبر InstaPay. شكرًا لك.
                </p>
              </div>
            </div>
            <a
              href="https://ipn.eg/s/zidpl/instapay/9EMKbX"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3"
            >
              <Button className="w-full bg-gradient-primary shadow-glow">
                <Heart className="size-4 me-2" />
                دعم عبر InstaPay
              </Button>
            </a>
          </Card>
        </Section>

        <Section value="about" title="عن التطبيق" summary="الإصدار الحالي ووصف مختصر لفكرة موني نوت">
          <Card className="p-4 border-border/50">
            <div className="flex gap-2">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-bold text-foreground">موني نوت</span> — الإصدار <span className="num-en">3.0</span>
                </p>
                <p>تطبيق أوفلاين بالكامل لإدارة الجمعيات، بدون سيرفرات وبدون إرسال البيانات إلى الإنترنت.</p>
                <p>هويتك في جهازك، جمعيتك في جيبك، وكل قسط موثّق حتى لو الدنيا بعيدة.</p>
              </div>
            </div>
          </Card>
        </Section>

        <Section value="danger" title="منطقة الخطر" summary="مسح كل بيانات هذا الجهاز نهائيًا دون إمكانية التراجع">
          <Card className="p-4 border-destructive/30 bg-destructive/5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="size-4 me-2" />
                  مسح كل البيانات
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف هويتك وكل جمعياتك وعملياتك من هذا الجهاز نهائيًا. لا يمكن التراجع.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={wipe} className="bg-destructive">
                    نعم، احذف الكل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        </Section>
        </Accordion>
      </div>
    </AppShell>
  );
}

function Section({
  value,
  title,
  summary,
  children,
}: {
  value: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-2xl border border-border/50 bg-card px-4">
      <AccordionTrigger className="py-4 hover:no-underline">
        <div className="text-start">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{summary}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-3">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-bold text-sm num-en mt-1">{value}</p>
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">{label}</label>
      <Input
        type="password"
        inputMode="numeric"
        maxLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
        className="bg-background/50 h-10 text-center num-en tracking-[0.2em]"
      />
    </div>
  );
}

function labelForKind(kind: SecurityLog["kind"]): string {
  switch (kind) {
    case "scan":
      return "مسح باركود";
    case "confirm":
      return "تأكيد عملية";
    case "deep-confirm":
      return "تأكيد عميق";
    case "reverse-confirm":
      return "تأكيد عكسي";
    case "transfer":
      return "نقل ملكية";
    case "pin":
      return "قفل التطبيق";
  }
}
