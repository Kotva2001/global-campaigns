import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { scoreColor } from "@/lib/performanceScore";
import { cn } from "@/lib/utils";

interface Props {
  score: number | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const SIZE: Record<NonNullable<Props["size"]>, { box: string; text: string; ring: string }> = {
  xs: { box: "h-7 w-7", text: "text-[10px]", ring: "border" },
  sm: { box: "h-9 w-9", text: "text-xs", ring: "border" },
  md: { box: "h-12 w-12", text: "text-sm", ring: "border-2" },
  lg: { box: "h-16 w-16", text: "text-lg", ring: "border-2" },
};

export const PerformanceScoreBadge = ({ score, size = "sm", className, showLabel = false }: Props) => {
  if (score == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-border/50 bg-background/40 font-bold text-muted-foreground/60",
          SIZE[size].box,
          SIZE[size].text,
          className,
        )}
        aria-label="No performance score yet"
        title="No performance score yet"
      >
        —
      </span>
    );
  }
  const { color, label } = scoreColor(score);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-background/60 font-black tabular-nums transition-all hover:scale-110",
            SIZE[size].box,
            SIZE[size].text,
            SIZE[size].ring,
            className,
          )}
          style={{
            color,
            borderColor: color,
            boxShadow: `0 0 10px ${color.replace(")", " / 0.6)").replace("hsl(", "hsla(")}, inset 0 0 8px ${color.replace(")", " / 0.18)").replace("hsl(", "hsla(")}`,
            textShadow: `0 0 6px ${color.replace(")", " / 0.55)").replace("hsl(", "hsla(")}`,
          }}
          aria-label={`Performance score ${score} out of 100 (${label})`}
        >
          {score}
          {showLabel && <span className="ml-1 text-[8px] uppercase tracking-wider opacity-70">pts</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div className="font-bold">Performance Score: {score}/100</div>
          <div className="text-muted-foreground">{label} · weighted across views, engagement, frequency, efficiency</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default PerformanceScoreBadge;