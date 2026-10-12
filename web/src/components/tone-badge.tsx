import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/labels";
import { cn } from "@/lib/utils";

const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-secondary text-secondary-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** Status pill. The dot keeps meaning visible without relying on colour alone. */
export function ToneBadge({ tone, children, className, title }: { tone: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <Badge className={cn("gap-1.5 border-transparent font-semibold", TONE[tone], className)} title={title}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}
