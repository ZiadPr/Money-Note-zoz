import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onResult: (text: string) => void;
  onClose?: () => void;
}

export function QRScanner({ onResult, onClose }: QRScannerProps) {
  const containerId = "mn-qr-scanner";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (cancelled) return;
          onResult(text);
        },
        () => {}
      )
      .then(() => !cancelled && setStarting(false))
      .catch((e) => {
        if (cancelled) return;
        setError("تعذّر فتح الكاميرا. تحقق من السماح بالإذن.");
        setStarting(false);
        console.error(e);
      });

    return () => {
      cancelled = true;
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-4 safe-top">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Camera className="size-5 text-primary" />
          مسح الباركود
        </h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 relative bg-black overflow-hidden">
        <div id={containerId} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            جارٍ تشغيل الكاميرا...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-destructive">{error}</p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-primary/80 rounded-2xl shadow-glow animate-pulse-glow" />
        </div>
      </div>

      <p className="p-4 text-center text-sm text-muted-foreground safe-bottom">
        وجّه الكاميرا نحو الباركود لمسحه تلقائيًا
      </p>
    </div>
  );
}
