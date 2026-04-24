import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface QRDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRDisplay({ value, size = 240, className }: QRDisplayProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a1a", light: "#ffffff" },
    }).then(() => setError(null)).catch((e) => setError(String(e)));
  }, [value, size]);

  return (
    <div className={cn("inline-block rounded-2xl bg-white p-3 shadow-glow", className)}>
      <canvas ref={ref} />
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  );
}
