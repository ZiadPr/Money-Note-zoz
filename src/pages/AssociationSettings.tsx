import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRightLeft, Crown, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRDisplay } from "@/components/QRDisplay";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { db, type Association, type Member, logSecurity } from "@/lib/db";
import { useIdentity } from "@/hooks/useIdentity";
import { encodeQr, signTransfer, type TransferQr } from "@/lib/qr-payload";
import { toast } from "@/hooks/use-toast";

export default function AssociationSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const [assoc, setAssoc] = useState<Association | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<Member | null>(null);
  const [transferQr, setTransferQr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [association, memberRows] = await Promise.all([
      db.associations.get(id),
      db.members.where("associationId").equals(id).toArray(),
    ]);
    setAssoc(association ?? null);
    setMembers(memberRows.sort((left, right) => left.turn - right.turn));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const verifiedMembers = useMemo(
    () => members.filter((member) => member.verified && !member.isManual),
    [members]
  );

  const initiateTransfer = async () => {
    if (!assoc || !identity || !selectedTarget) return;
    if (!selectedTarget.handshakeKey) {
      toast({ title: "لا يمكن إنشاء نقل لهذا العضو", description: "مفتاح التوثيق غير متوفر", variant: "destructive" });
      return;
    }

    const ts = Date.now();
    const payloadBase = {
      aid: assoc.id,
      aname: assoc.name,
      fromManagerId: identity.publicId,
      fromManagerName: identity.name,
      fromManagerUid: identity.deviceUid,
      toMemberId: selectedTarget.publicId,
      toMemberName: selectedTarget.name,
      originalCreatorId: assoc.originalCreatorId ?? identity.publicId,
      originalCreatorName: assoc.originalCreatorName ?? identity.name,
      originalCreatorUid: assoc.originalCreatorUid ?? identity.deviceUid,
      originalCreatorQr: assoc.originalCreatorQr,
      ts,
    };
    const sig = await signTransfer(identity.hmacSecret, payloadBase);
    const payload: TransferQr = { t: "transfer", ...payloadBase, sig };

    setTransferQr(encodeQr(payload));
    await logSecurity("transfer", `بدء نقل ${assoc.name} إلى ${selectedTarget.name}`);
  };

  if (!assoc || !identity) {
    return (
      <AppShell hideNav>
        <AppHeader title="..." back />
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <AppHeader title="إعدادات الجمعية" subtitle={assoc.name} back />

      <div className="p-4 space-y-4 animate-fade-in">
        {!transferQr ? (
          <>
            <Card className="card-elevated p-5 space-y-3 border-primary/20">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="size-5 text-primary" />
                <h3 className="font-bold">نقل ملكية الجمعية</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                اختر عضوًا موثقًا ثم أكّد النقل. لن يتغير المدير على جهازك حتى يقبل العضو العرض ويعرض لك باركود الإتمام.
              </p>
            </Card>

            {verifiedMembers.length === 0 ? (
              <Card className="p-5 text-center border-dashed">
                <ShieldAlert className="size-8 text-warning mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد أعضاء موثقون لتسليم الملكية إليهم.</p>
              </Card>
            ) : (
              <>
                <div className="space-y-2">
                  {verifiedMembers.map((member) => (
                    <Card
                      key={member.id}
                      onClick={() => setSelectedTarget(member)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTarget(member);
                        }
                      }}
                      className={`p-3 flex items-center gap-3 cursor-pointer transition-colors active:scale-[0.99] ${
                        selectedTarget?.id === member.id
                          ? "border-warning/50 bg-warning/10"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-sm shrink-0">
                        <span className="num-en">{member.turn}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{member.name}</span>
                          <VerifiedBadge verified />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">دور #{member.turn}</p>
                      </div>
                      <Crown className={`size-4 ${selectedTarget?.id === member.id ? "text-warning" : "text-muted-foreground"}`} />
                    </Card>
                  ))}
                </div>

                <Card className="p-4 border-warning/30 bg-warning/5">
                  {selectedTarget ? (
                    <div className="space-y-3">
                      <p className="text-sm">
                        سيتم إرسال عرض نقل الملكية إلى <span className="font-bold">{selectedTarget.name}</span>.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        بعد أن يقبل العضو العرض، سيعرض لك باركود إتمام. امسحه من شاشة المسح ليصبح هو المدير الجديد.
                      </p>
                      <Button onClick={initiateTransfer} className="w-full bg-gradient-primary shadow-glow">
                        تأكيد النقل وإنشاء QR
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">اختر عضوًا موثقًا أولًا للمتابعة.</p>
                  )}
                </Card>
              </>
            )}
          </>
        ) : (
          <Card className="card-elevated p-5 space-y-3 border-warning/30">
            <Crown className="size-10 text-warning mx-auto" />
            <h3 className="font-bold text-center">عرض نقل الملكية إلى</h3>
            <p className="text-center font-bold">{selectedTarget?.name}</p>
            <div className="flex justify-center">
              <QRDisplay value={transferQr} size={220} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              اطلب من العضو مسح هذا الباركود ثم قبول الملكية من جهازه. بعد ذلك سيعرض لك باركود إتمام يجب مسحه لتحديث جهازك.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={() => navigate("/scan")} className="w-full bg-gradient-primary shadow-glow">
                مسح باركود إتمام النقل
              </Button>
              <Button onClick={() => setTransferQr(null)} variant="outline" className="w-full">
                رجوع إلى اختيار العضو
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
