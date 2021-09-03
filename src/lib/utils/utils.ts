export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export function mod(v: number, d: number): number {
  return v - Math.floor(v / d) * d;
}
