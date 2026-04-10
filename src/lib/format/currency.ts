const KRW_FORMATTER = new Intl.NumberFormat("ko-KR");

export function formatKrw(value: number): string {
  return `${KRW_FORMATTER.format(value)}원`;
}

export function formatSignedKrw(value: number): string {
  const absValue = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${KRW_FORMATTER.format(absValue)}원`;
}
