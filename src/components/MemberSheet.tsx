import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, KeyRound, QrCode, Trash2, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VerifiedBadge } from "./VerifiedBadge";
import type { Association, Member, TransactionKind } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import { toast } from "@/hooks/use-toast";
import { uuid } from "@/lib/crypto";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  assoc: Association;
  isManagerView: boolean;
  isMyTurnToCollect?: boolean;
  onChanged: () => void;
}

export function MemberSheet({ open, onOpenChange, member, assoc, isManagerView, isMyTurnToCollect, onChanged }: Props) {
  const navigate = useNavigate();
  const [manualAction, setManualAction] = useState<TransactionKind | null>(null);

  if (!member) return null;

  const close = () => onOpenChange(false);
  const isManagerSelfMember = !member.isManual && member.publicId === assoc.managerId;

  const removeMember = async () => {
    await db.members.delete(member.id);
    toast({ title: "تم حذف العضو وأصبح دوره شاغرًا" });
    close();
    onChanged();
  };

  const registerLocalTransaction = async (kind: TransactionKind) => {
    await db.transactions.add({
      id: uuid(),
      associationId: assoc.id,
      associationName: assoc.name,
      memberId: member.id,
      memberPublicId: member.publicId,
      memberName: member.name,
      managerPublicId: assoc.managerId,
      managerName: assoc.managerName,
      amount: kind === "payout" ? assoc.installmentAmount * assoc.membersCount : assoc.installmentAmount,
      turn: member.turn,
      kind,
      status: "confirmed",
      createdAt: Date.now(),
      approvedAt: Date.now(),
      confirmedAt: Date.now(),
      side: "manager",
    });

    if (kind === "payout") {
      await db.members.update(member.id, { payoutCollected: true, payoutCollectedAt: Date.now() });
    }

    toast({
      title:
        kind === "payout"
          ? isManagerSelfMember
            ? "تم تسجيل قبض الدور ذاتيًا"
            : "تم تسجيل قبض الدور يدويًا"
          : isManagerSelfMember
            ? "تم تسجيل القسط الذاتي"
            : "تم تسجيل القسط اليدوي",
    });
    setManualAction(null);
    close();
    onChanged();
  };

  const actionTitle =
    member.isManual
      ? "عضو يدوي"
      : member.verified
        ? "عضو موثق"
        : "بانتظار اكتمال التوثيق";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl border-primary/20">
          <SheetHeader className="text-start">
            <SheetTitle className="flex items-center gap-2">
              <span>{member.name}</span>
              <VerifiedBadge verified={member.verified && !member.isManual} manual={member.isManual} size="md" />
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="الدور" value={`#${member.turn}`} />
              <Stat label="موعد القبض" value={formatDate(member.payoutDate)} />
              <Stat label="الحالة" value={member.payoutCollected ? "تم القبض" : actionTitle} />
            </div>

            {isManagerView && isManagerSelfMember && (
              <>
                <Button onClick={() => setManualAction("installment")} className="w-full bg-gradient-primary shadow-glow">
                  <CreditCard className="size-4 me-2" />
                  تسجيل القسط الذاتي
                </Button>

                {isMyTurnToCollect && !member.payoutCollected && (
                  <Button
                    onClick={() => setManualAction("payout")}
                    variant="outline"
                    className="w-full border-success/30 text-success hover:bg-success/10"
                  >
                    <Trophy className="size-4 me-2" />
                    تأكيد قبض الدور ذاتيًا
                  </Button>
                )}

                <p className="text-[11px] text-muted-foreground text-center">
                  لأنك المدير وصاحب هذا الدور على نفس الجهاز، تُسجَّل العملية مباشرة كتأكيد ذاتي.
                </p>
              </>
            )}

            {isManagerView && !member.isManual && member.verified && !isManagerSelfMember && (
              <>
                <Button
                  onClick={() => {
                    close();
                    navigate("/scan");
                  }}
                  className="w-full bg-gradient-primary shadow-glow"
                >
                  <QrCode className="size-4 me-2" />
                  مسح QR من العضو
                </Button>
                <Button
                  onClick={() => {
                    close();
                    navigate("/enter-code");
                  }}
                  variant="outline"
                  className="w-full border-primary/30"
                >
                  <KeyRound className="size-4 me-2" />
                  إدخال كود العضو
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  هذا العضو موثق، لذلك لا تُسجّل أي عملية له إلا بعد أن يرسل QR الدفع أو الكود النصي من جهازه.
                </p>
              </>
            )}

            {isManagerView && !member.isManual && !member.verified && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-center text-sm text-warning">
                هذا العضو لم يُكمل التوثيق العكسي بعد، لذلك لا يمكن تسجيل عمليات مالية له الآن.
              </div>
            )}

            {isManagerView && member.isManual && (
              <>
                <Button onClick={() => setManualAction("installment")} className="w-full bg-gradient-primary shadow-glow">
                  <CreditCard className="size-4 me-2" />
                  تسجيل قسط يدوي
                </Button>

                {isMyTurnToCollect && !member.payoutCollected && (
                  <Button
                    onClick={() => setManualAction("payout")}
                    variant="outline"
                    className="w-full border-success/30 text-success hover:bg-success/10"
                  >
                    <Trophy className="size-4 me-2" />
                    تأكيد قبض الدور يدويًا
                  </Button>
                )}

                {!isMyTurnToCollect && !member.payoutCollected && (
                  <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-center text-[11px] text-muted-foreground">
                    قبض الدور اليدوي لا يظهر إلا عندما يكون هذا الدور هو الدور الحالي للقبض.
                  </div>
                )}
              </>
            )}

            {isManagerView && (
              <Button
                onClick={removeMember}
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5 me-1.5" />
                حذف العضو (الدور يبقى شاغرًا)
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={manualAction !== null} onOpenChange={(open) => !open && setManualAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {manualAction === "payout" ? "تأكيد قبض الدور يدويًا" : "تسجيل قسط يدوي"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {manualAction === "payout"
                ? isManagerSelfMember
                  ? `سيتم تسجيل قبض دورك ذاتيًا على نفس الجهاز.`
                  : `سيتم تسجيل أن ${member.name} قبض دوره يدويًا كمستخدم غير موثق.`
                : isManagerSelfMember
                  ? `سيتم تسجيل قسطك الذاتي بمبلغ ${assoc.installmentAmount} جنيه.`
                  : `سيتم تسجيل قسط ${member.name} يدويًا بمبلغ ${assoc.installmentAmount} جنيه.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => manualAction && registerLocalTransaction(manualAction)}
              className="bg-gradient-primary"
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-bold text-sm num-en">{value}</p>
    </div>
  );
}
