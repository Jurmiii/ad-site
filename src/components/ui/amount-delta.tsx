import { formatSignedKrw } from "@/lib/format/currency";

type AmountDeltaProps = {
  value: number;
};

export function AmountDelta({ value }: AmountDeltaProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const toneClass = isPositive
    ? "text-positive"
    : isNegative
      ? "text-negative"
      : "text-slate-500";

  const chipClass = isPositive
    ? "bg-teal-50"
    : isNegative
      ? "bg-rose-50"
      : "bg-slate-100";

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${toneClass} ${chipClass}`}
      >
        {isPositive ? "수입" : isNegative ? "지출" : "변동 없음"}
      </span>
      <span className={`text-lg font-semibold ${toneClass}`}>{formatSignedKrw(value)}</span>
    </div>
  );
}
