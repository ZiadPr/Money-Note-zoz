import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QrCode, UserPlus, ScanLine, Users, Calendar, Wallet, CreditCard, Settings as SettingsIcon, ArrowRightLeft, History, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, type Association, type Member } from "@/lib/db";
import { encodeQr, type AssociationQr } from "@/lib/qr-payload";
import { QRDisplay } from "@/components/QRDisplay";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useIdentity } from "@/hooks/useIdentity";
import { formatAmount, formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { uuid } from "@/lib/crypto";
import { MemberSheet } from "@/components/MemberSheet";
import { OriginalCreatorBadge } from "@/components/OriginalCreatorBadge";

export default function AssociationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [assoc, setAssoc] = useState<Association | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [showAddSelf, setShowAddSelf] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualTurn, setManualTurn] = useState("");
  const [selfTurn, setSelfTurn] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const a = await db.associations.get(id);
    setAssoc(a ?? null);
    if (a) {
      const m = await db.members.where("associationId").equals(id).toArray();
      setMembers(m.sort((x, y) => x.turn - y.turn));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // الدور الحالي للقبض = أصغر دور لم يقبض بعد
  const currentPayoutTurn = useMemo(() => {
    const sorted = [...members].sort((a, b) => a.turn - b.turn);
    const next = sorted.find((m) => !m.payoutCollected);
    return next?.turn ?? null;
  }, [members]);

  if (!assoc || !identity) {
    return (
      <AppShell hideNav>
        <AppHeader title="جارٍ التحميل..." back />
      </AppShell>
    );
  }

  const isManager = assoc.role === "manager";

  const associationQr: AssociationQr = {
    t: "association",
    aid: assoc.id,
    name: assoc.name,
    amount: assoc.installmentAmount,
    cycle: assoc.cycleType,
    members: assoc.membersCount,
    managerId: assoc.managerId,
    managerName: assoc.managerName,
    managerHmac: identity.hmacSecret,
  };

  // الأدوار المشغولة
  const takenTurns = new Set(members.map((m) => m.turn));
  const allSlots = Array.from({ length: assoc.membersCount }, (_, i) => i + 1);
  const vacantSlots = allSlots.filter((n) => !takenTurns.has(n));

  const addManual = async () => {
    const turnN = Number(manualTurn);
    if (!manualName.trim() || !manualTurn) {
      toast({ title: "أكمل البيانات", variant: "destructive" });
      return;
    }
    if (takenTurns.has(turnN)) {
      toast({ title: "هذا الدور مشغول بالفعل", variant: "destructive" });
      return;
    }
    if (turnN < 1 || turnN > assoc.membersCount) {
      toast({ title: "رقم الدور خارج النطاق", variant: "destructive" });
      return;
    }
    const m: Member = {
      id: uuid(),
      associationId: assoc.id,
      publicId: "manual-" + uuid(),
      name: manualName.trim(),
      turn: turnN,
      payoutDate: assoc.startDate + (turnN - 1) * 30 * 86400000,
      verified: false,
      hasPhone: false,
      isManual: true,
      createdAt: Date.now(),
    };
    await db.members.add(m);
    toast({ title: "تمت الإضافة" });
    setManualName(""); setManualTurn(""); setShowAddManual(false);
    load();
  };

  // العضو المرتبط بهويتي (لمعرفة دوري كعضو)
  const myMembership = members.find((m) => m.publicId === identity.publicId);
  const myTurn = isManager ? null : assoc.myTurn;
  const isMyTurnToCollect = !isManager && myTurn !== null && myTurn === currentPayoutTurn && !assoc.payoutCollected;

  const addSelfToRole = async () => {
    const turnN = Number(selfTurn);
    if (myMembership) {
      toast({ title: "أنت مضاف بالفعل داخل هذه الجمعية", variant: "destructive" });
      return;
    }
    if (!selfTurn || Number.isNaN(turnN)) {
      toast({ title: "اختر دورًا متاحًا", variant: "destructive" });
      return;
    }
    if (takenTurns.has(turnN)) {
      toast({ title: "هذا الدور مشغول بالفعل", variant: "destructive" });
      return;
    }

    const member: Member = {
      id: uuid(),
      associationId: assoc.id,
      publicId: identity.publicId,
      deviceUid: identity.deviceUid,
      name: identity.name,
      turn: turnN,
      payoutDate: assoc.startDate + (turnN - 1) * 30 * 86400000,
      verified: true,
      hasPhone: true,
      isManual: false,
      handshakeKey: identity.hmacSecret,
      createdAt: Date.now(),
    };

    await db.members.add(member);
    await db.transactions.add({
      id: uuid(),
      associationId: assoc.id,
      associationName: assoc.name,
      memberId: member.id,
      memberPublicId: member.publicId,
      memberName: member.name,
      managerPublicId: identity.publicId,
      managerName: identity.name,
      amount: 0,
      turn: member.turn,
      kind: "join",
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: Date.now(),
      confirmedAt: Date.now(),
      signature: identity.hmacSecret,
      side: "manager",
    });

    toast({ title: "تمت إضافتك إلى دور داخل جمعيتك" });
    setSelfTurn("");
    setShowAddSelf(false);
    load();
  };

  return (
    <AppShell hideNav>
      <AppHeader
        title={
          <span className="flex items-center gap-2">
            {assoc.transferredAt && <OriginalCreatorBadge assoc={assoc} />}
            <span>{assoc.name}</span>
          </span>
        }
        subtitle={isManager ? "أنت المدير" : `المدير: ${assoc.managerName}`}
        back
        action={
          isManager ? (
            <Button size="icon" variant="ghost" onClick={() => navigate(`/associations/${assoc.id}/settings`)}>
              <SettingsIcon className="size-5" />
            </Button>
          ) : null
        }
      />

      <div className="p-4 space-y-4 animate-fade-in">
        {/* بطاقة الجمعية */}
        <Card className="card-elevated p-5 border-primary/20 relative overflow-hidden">
          <div className="absolute -top-12 -end-12 size-32 rounded-full bg-primary/10 blur-2xl" />
          <div className="grid grid-cols-3 gap-3 text-center relative">
            <Stat icon={Wallet} label="القسط" value={`${formatAmount(assoc.installmentAmount)}`} suffix="جنيه" />
            <Stat icon={Users} label="الأعضاء" value={`${members.length}/${assoc.membersCount}`} />
            <Stat
              icon={Calendar}
              label="الدورة"
              value={assoc.cycleType === "monthly" ? "شهرية" : assoc.cycleType === "weekly" ? "أسبوعية" : "مخصصة"}
            />
          </div>
        </Card>

        {/* أزرار حسب الدور */}
        {isManager ? (
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn icon={QrCode} label="QR الجمعية" onClick={() => setShowQr(true)} />
            <ActionBtn icon={ScanLine} label="مسح" onClick={() => navigate("/scan")} />
            <ActionBtn icon={UserPlus} label="إضافة يدوية" onClick={() => setShowAddManual(true)} />
            <ActionBtn
              icon={UserPlus}
              label={myMembership ? "أنت مضاف" : "أضف نفسي لدور"}
              onClick={() => {
                setSelfTurn(vacantSlots[0] ? String(vacantSlots[0]) : "");
                setShowAddSelf(true);
              }}
              disabled={!!myMembership || vacantSlots.length === 0}
            />
          </div>
        ) : (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <p className="text-xs text-muted-foreground mb-1">دورك في الجمعية</p>
            <p className="text-2xl font-extrabold gradient-text num-en">#{assoc.myTurn ?? "—"}</p>
            {assoc.myPayoutDate && (
              <p className="text-xs text-muted-foreground mt-2">
                موعد قبضك: <span className="text-foreground font-semibold">{formatDate(assoc.myPayoutDate)}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button
                onClick={() => navigate(`/pay/${assoc.id}`)}
                className="h-11 bg-gradient-primary shadow-glow"
              >
                <CreditCard className="size-4 me-2" />
                سداد القسط
              </Button>
              {isMyTurnToCollect ? (
                <Button
                  onClick={() => navigate(`/pay/${assoc.id}?kind=payout`)}
                  variant="outline"
                  className="h-11 border-success/30 text-success"
                >
                  <Trophy className="size-4 me-2" />
                  تأكيد قبض الدور
                </Button>
              ) : assoc.payoutCollected ? (
                <Button disabled className="h-11" variant="outline">
                  <Trophy className="size-4 me-2 text-success" />
                  تم القبض
                </Button>
              ) : (
                <Button disabled variant="outline" className="h-11 opacity-60">
                  <Trophy className="size-4 me-2" />
                  ليس دورك بعد
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* قائمة الأعضاء (للمدير فقط) */}
        {isManager && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Users className="size-4 text-primary" />
                الأعضاء
                <span className="text-xs text-muted-foreground font-normal">
                  (<span className="num-en">{members.length}</span>/<span className="num-en">{assoc.membersCount}</span>)
                </span>
              </h2>
            </div>

            <div className="space-y-2">
              {allSlots.map((slot) => {
                const m = members.find((x) => x.turn === slot);
                const isCurrent = slot === currentPayoutTurn;
                if (!m) {
                  return (
                    <Card key={slot} className="p-3 flex items-center gap-3 border-dashed border-border/40 opacity-70">
                      <div className="size-9 rounded-full bg-muted/50 flex items-center justify-center font-bold text-sm shrink-0 text-muted-foreground">
                        <span className="num-en">{slot}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">شاغر</p>
                        {isCurrent && <p className="text-[10px] text-warning">الدور الحالي</p>}
                      </div>
                    </Card>
                  );
                }
                return (
                  <Card
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    onKeyDown={(event) => onCardKeyDown(event, () => setSelectedMember(m))}
                    role="button"
                    tabIndex={0}
                    className={`p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors active:scale-[0.99] ${isCurrent ? "border-primary/40 bg-primary/5" : ""}`}
                  >
                    <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm shrink-0">
                      <span className="num-en">{m.turn}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{m.name}</span>
                        <VerifiedBadge verified={m.verified} manual={m.isManual} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        قبض: {formatDate(m.payoutDate)}
                        {m.payoutCollected && <span className="text-success ms-1">تم القبض</span>}
                        {isCurrent && !m.payoutCollected && <span className="text-warning ms-1">الحالي</span>}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Dialog QR الجمعية */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">باركود الانضمام</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-2">
            <QRDisplay value={encodeQr(associationQr)} />
            <p className="text-xs text-muted-foreground text-center">
              هذا الباركود يعرّف الجمعية فقط. الانضمام لا يكتمل به وحده، بل عبر جلسة الإضافة الثنائية من شاشة المسح.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog إضافة عضو يدوي */}
      <Dialog open={showAddManual} onOpenChange={setShowAddManual}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة عضو بدون هاتف</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم العضو</Label>
              <Input value={manualName} onChange={(e) => setManualName(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رقم الدور (الشاغر)</Label>
              <select
                value={manualTurn}
                onChange={(e) => setManualTurn(e.target.value)}
                className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm num-en"
              >
                <option value="">اختر دورًا</option>
                {vacantSlots.map((s) => (
                  <option key={s} value={s}>دور #{s}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              العضو اليدوي لن يحمل علامة التوثيق الزرقاء، وموافقتك وحدها كافية لعملياته.
            </p>
            <Button onClick={addManual} className="w-full bg-gradient-primary">إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSelf} onOpenChange={setShowAddSelf}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة نفسي إلى دور</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {myMembership ? (
              <p className="text-sm text-muted-foreground text-center">
                أنت مضاف بالفعل داخل الجمعية في الدور <span className="font-bold num-en">#{myMembership.turn}</span>.
              </p>
            ) : vacantSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">لا توجد أدوار شاغرة حاليًا داخل الجمعية.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">الدور المتاح</Label>
                  <select
                    value={selfTurn}
                    onChange={(e) => setSelfTurn(e.target.value)}
                    className="w-full h-10 rounded-md bg-background/50 border border-input px-3 text-sm num-en"
                  >
                    <option value="">اختر دورًا</option>
                    {vacantSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        دور #{slot}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  لأنك المدير وعلى نفس الجهاز، سيتم توثيق إضافتك مباشرة بدون مسح خارجي.
                </p>
                <Button onClick={addSelfToRole} className="w-full bg-gradient-primary">
                  تأكيد الإضافة الذاتية
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MemberSheet
        open={!!selectedMember}
        onOpenChange={(o) => !o && setSelectedMember(null)}
        member={selectedMember}
        assoc={assoc}
        isManagerView={isManager}
        isMyTurnToCollect={selectedMember?.turn === currentPayoutTurn && !selectedMember?.payoutCollected}
        onChanged={load}
      />
    </AppShell>
  );
}

function onCardKeyDown(event: React.KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function Stat({ icon: Icon, label, value, suffix }: { icon: typeof Wallet; label: string; value: string; suffix?: string }) {
  return (
    <div>
      <Icon className="size-4 text-primary mx-auto mb-1" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-bold text-sm num-en">{value}{suffix && <span className="text-[10px] text-muted-foreground ms-1 font-normal">{suffix}</span>}</p>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof QrCode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-card p-3 hover:bg-primary/10 hover:border-primary/40 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-card disabled:hover:border-border/50"
    >
      <Icon className="size-5 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
