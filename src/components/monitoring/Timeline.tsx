import { cn } from "@/lib/utils";

const OFFSETS: { h: number; label: string }[] = [
  { h: 0, label: "Ahora" },
  { h: 1, label: "+1h" },
  { h: 3, label: "+3h" },
  { h: 6, label: "+6h" },
  { h: 12, label: "+12h" },
  { h: 24, label: "+24h" },
];

interface Props { value: number; onChange: (h: number) => void }

export default function Timeline({ value, onChange }: Props) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10">
      <div className="bg-white/95 backdrop-blur rounded-full px-2 py-1.5 flex items-center gap-1" style={{ boxShadow: "0 4px 20px -4px rgba(0,0,0,0.15)" }}>
        {OFFSETS.map(o => (
          <button
            key={o.h}
            onClick={() => onChange(o.h)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors",
              value === o.h
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-[#EFF6FF]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
