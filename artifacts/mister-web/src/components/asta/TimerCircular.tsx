interface TimerCircularProps {
  remaining: number;
  total: number;
  active: boolean;
}

export function TimerCircular({ remaining, total, active }: TimerCircularProps) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = active && total > 0 ? remaining / total : 1;
  const dashOffset = circumference * (1 - progress);

  const isWarning = active && remaining <= 3 && remaining > 0;
  const isExpired = active && remaining === 0;

  const strokeColor = isExpired
    ? "#ef4444"
    : isWarning
      ? "#f97316"
      : "#1f4733";

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: active ? "stroke-dashoffset 1s linear, stroke 0.3s" : "none" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {active ? (
          <span
            className={`text-xl font-bold font-mono tabular-nums ${
              isExpired ? "text-red-500" : isWarning ? "text-orange-500" : "text-foreground"
            } ${isWarning || isExpired ? "animate-pulse" : ""}`}
          >
            {remaining}
          </span>
        ) : (
          <span className="text-xl font-mono text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
