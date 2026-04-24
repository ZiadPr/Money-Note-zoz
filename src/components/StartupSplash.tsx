import { useEffect, useState } from "react";

const MIN_SPLASH_MS = 1600;
const MAX_WAIT_FOR_FONTS_MS = 2500;

export function StartupSplash({ children }: { children: React.ReactNode }) {
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const minDelayTimer = window.setTimeout(() => {
      setMinDelayDone(true);
    }, MIN_SPLASH_MS);

    let cancelled = false;

    const readyFonts = async () => {
      try {
        if ("fonts" in document) {
          await Promise.all([
            document.fonts.load('900 48px "Thmanyah Serif Display"'),
            document.fonts.load('700 24px "Thmanyah Sans"'),
            document.fonts.ready,
          ]);
        }
      } finally {
        if (!cancelled) {
          setFontsReady(true);
        }
      }
    };

    readyFonts();

    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled) {
        setFontsReady(true);
      }
    }, MAX_WAIT_FOR_FONTS_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(minDelayTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const showSplash = !minDelayDone || !fontsReady;

  return (
    <>
      {showSplash && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-transparent px-6 text-foreground"
          aria-label="شاشة بدء التطبيق"
          role="img"
        >
          <div className="flex h-full w-full flex-col items-center justify-center text-center">
            <div className="flex-1" />
            <div className="w-full max-w-md">
              <h1 className="font-brand-display text-6xl font-black leading-none tracking-tight sm:text-7xl">
                موني نوت
              </h1>
            </div>
            <div className="flex-1" />
            <p className="font-ui text-3xl font-black leading-[1.45] tracking-tight sm:text-4xl">
              تطوير
              <br />
              المبرمج زياد يحيى
            </p>
            <div className="safe-bottom h-8" />
          </div>
        </div>
      )}

      <div className={showSplash ? "opacity-0" : "opacity-100 transition-opacity duration-300"}>
        {children}
      </div>
    </>
  );
}
