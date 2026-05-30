interface StepIndicatorProps {
  step: 1 | 2 | 3;
}

const STEPS = [
  { n: 1, label: "Lega" },
  { n: 2, label: "Squadre" },
  { n: 3, label: "Riepilogo" },
];

export default function StepIndicator({ step }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono font-bold border-2 transition-colors ${
                s.n < step
                  ? "bg-[#1f4733] border-[#1f4733] text-[#efe6d3]"
                  : s.n === step
                  ? "bg-[#1f4733] border-[#1f4733] text-[#efe6d3]"
                  : "bg-transparent border-muted-foreground/30 text-muted-foreground/50"
              }`}
            >
              {s.n < step ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                s.n
              )}
            </div>
            <span
              className={`text-xs font-medium ${
                s.n === step ? "text-[#1f4733]" : "text-muted-foreground/50"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-2 mb-5 transition-colors ${
                s.n < step ? "bg-[#1f4733]" : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
