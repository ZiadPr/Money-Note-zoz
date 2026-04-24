import { useState } from "react";
import { Crown, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Association } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { QRDisplay } from "./QRDisplay";

export function OriginalCreatorBadge({ assoc }: { assoc: Association }) {
  const [open, setOpen] = useState(false);
  if (!assoc.transferredAt) return null;

  const copy = (val?: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val);
    toast({ title: "تم النسخ" });
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5 text-[10px] font-bold text-warning hover:bg-warning/25"
        title="جمعية منقولة الملكية"
      >
        <Crown className="size-3" />
        منقولة
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>المنشئ الأصلي للجمعية</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm pt-2">
            <Row label="الاسم" value={assoc.originalCreatorName ?? "—"} />
            <Row label="UID الجهاز" value={assoc.originalCreatorUid ?? "—"} onCopy={() => copy(assoc.originalCreatorUid)} />
            <Row label="المعرّف العام" value={assoc.originalCreatorId ?? "—"} onCopy={() => copy(assoc.originalCreatorId)} />
            <Row label="تاريخ الإنشاء" value={formatDate(assoc.createdAt)} />
            <Row label="تاريخ النقل" value={formatDate(assoc.transferredAt!)} />
          </div>
          {assoc.originalCreatorQr && (
            <div className="flex flex-col items-center gap-2 border-t border-border/40 pt-3">
              <p className="text-xs text-muted-foreground">QR الشخصي للمنشئ الأصلي</p>
              <QRDisplay value={assoc.originalCreatorQr} size={170} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 last:border-0 py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {onCopy ? (
        <button onClick={onCopy} className="font-semibold num-en truncate max-w-[60%] text-end inline-flex items-center gap-1 hover:text-primary">
          <span className="truncate">{value}</span>
          <Copy className="size-3 shrink-0" />
        </button>
      ) : (
        <span className="font-semibold num-en truncate max-w-[60%] text-end">{value}</span>
      )}
    </div>
  );
}
