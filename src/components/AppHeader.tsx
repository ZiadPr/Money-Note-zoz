import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: ReactNode;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}

export function AppHeader({ title, subtitle, back, action }: AppHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-lg border-b border-border/50 safe-top">
      <div className="max-w-lg mx-auto flex items-center gap-3 p-4">
        {back && (
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ms-2">
            <ArrowRight className="size-5" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
