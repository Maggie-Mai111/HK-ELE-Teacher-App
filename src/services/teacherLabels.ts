export function teacherBandLabel(value: string | null | undefined): string {
  return (value ?? "").replace(/\b(\d+)k\b/gi, (_, number: string) => (Number(number) * 1000).toLocaleString("en"));
}
