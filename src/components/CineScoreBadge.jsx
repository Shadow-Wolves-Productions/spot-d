import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function CineScoreBadge({ score, size = "md", showLabel = true }) {
  if (!score && score !== 0) return null;

  const getColor = (s) => {
    if (s >= 80) return "from-primary to-yellow-500";
    if (s >= 60) return "from-primary/80 to-primary";
    if (s >= 40) return "from-muted-foreground to-primary/60";
    return "from-muted-foreground/50 to-muted-foreground";
  };

  const sizes = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-20 h-20 text-lg",
  };

  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1">
            <div className={cn("relative flex items-center justify-center", sizes[size])}>
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
                <circle
                  cx="20" cy="20" r="18" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="font-display font-bold text-primary">{score}</span>
            </div>
            {showLabel && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                CineScore
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-card border-border max-w-[240px]">
          <p className="text-xs text-muted-foreground">
            Based on profile completeness, verification, credits, activity, and industry connections.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}