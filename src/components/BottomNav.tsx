import { NavLink } from "react-router-dom";
import { Home, Wallet, ScrollText, IdCard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "الرئيسية", end: true },
  { to: "/associations", icon: Wallet, label: "جمعياتي" },
  { to: "/history", icon: ScrollText, label: "السجل" },
  { to: "/identity", icon: IdCard, label: "هويتي" },
  { to: "/settings", icon: Settings, label: "الإعدادات" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-card/95 backdrop-blur-lg safe-bottom">
      <ul className="flex items-stretch justify-around max-w-lg mx-auto">
        {items.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
                  <span className={cn(isActive && "font-semibold")}>{it.label}</span>
                  {isActive && <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary shadow-glow" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
