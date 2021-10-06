export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export function add<T extends Vec2 | Vec3>(v1: T, v2: T, dstVArg?: T): T {
  const dstV = dstVArg || Array(v1.length).fill(0) as T;
  dstV.forEach((_, i) => {
    dstV[i] = v1[i] + v2[i];
  });

  return dstV;
}
export function minus<T extends Vec2 | Vec3>(v: T, dstVArg?: T): T {
  const dstV = dstVArg || Array(v.length).fill(0) as T;
  dstV.forEach((_, i) => {
    dstV[i] = -v[i];
  });

  return dstV;
}

export function sub<T extends Vec2 | Vec3>(v1: T, v2: T, dstVArg?: T): T {
  return add(v1, minus(v2), dstVArg);
}

export function multiply<T extends Vec2 | Vec3>(v: T, scalar: number, dstVArg?: T): T {
  const dstV = dstVArg || Array(v.length).fill(0) as T;
  dstV.forEach((_, i) => {
    dstV[i] = v[i] * scalar;
  });

  return dstV;
}

export function lengthSq<T extends Vec2 | Vec3>(v: T): number {
  return v.reduce((p, v) => p + v * v, 0);
}
export function length<T extends Vec2 | Vec3>(v: T): number {
  return Math.sqrt(lengthSq<T>(v));
}

export function mod(v: number, d: number): number {
  return v - Math.floor(v / d) * d;
}

export function clamp(v: number, edge0: number, edge1: number): number {
  return (v < edge0 ? edge0 : (v > edge1 ? edge1 : v))
}

export function rangeVec2s(centerVec: Vec2, range: number): Vec2[] {
  return [
    [0, 0],
    ...Array(range).fill(null).map((_, i) => i + 1).flatMap(d =>
      Array(d).fill(null).flatMap(
        (_, j) => ([j, -1 - j])
      ).flatMap(x => ([
        [x, d], [-x, -d],
        [d, -x], [-d, x],
      ])),
    ),
  ].map(([dI, dJ]) => (
    [centerVec[0] + dI, centerVec[1] + dJ]
  ));
}

export function averagePresentNumbers(...ns: number[]): number {
  const presentNumbers = ns.filter(n => n !== undefined && n !== null);
  return presentNumbers.reduce((p, c) => p + c, 0) / presentNumbers.length;
}

export function step(vecA: number[], vecB: number[], progress: number) {
  return vecA.map((va, i) => va * (1 - progress) + vecB[i] * progress);
}
