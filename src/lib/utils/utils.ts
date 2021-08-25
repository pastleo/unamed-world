export function mod(v: number, d: number): number {
  return v - Math.floor(v / d) * d;
}
