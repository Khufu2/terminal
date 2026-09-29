import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel flex flex-col overflow-hidden", className)}>
      {(title || action) && (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {title}
              </h2>
            )}
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("min-h-0 flex-1 px-4 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "up" | "down" | "gold";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 truncate text-2xl font-semibold",
          tone === "up" && "text-bull",
          tone === "down" && "text-bear",
          tone === "gold" && "text-gold-soft",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "gold";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        tone === "neutral" && "border-border text-muted-foreground",
        tone === "up" && "border-bull/40 bg-bull/10 text-bull",
        tone === "down" && "border-bear/40 bg-bear/10 text-bear",
        tone === "gold" && "border-gold/40 bg-gold/10 text-gold-soft",
      )}
    >
      {children}
    </span>
  );
}