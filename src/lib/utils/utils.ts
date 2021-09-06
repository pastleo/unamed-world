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

export function mod(v: number, d: number): number {
  return v - Math.floor(v / d) * d;
}
