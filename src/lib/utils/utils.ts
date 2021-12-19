import * as THREE from 'three';
import * as ss from 'superstruct';
import crypto from 'isomorphic-webcrypto';

export const vec2Type = ss.tuple([ss.number(), ss.number()]);
export type Vec2 = ss.Infer<typeof vec2Type>;
export const vec3Type = ss.tuple([ss.number(), ss.number(), ss.number()]);
export type Vec3 = ss.Infer<typeof vec3Type>;

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

export function vec3To2(a: Vec3): Vec2 {
  return [a[0], a[2]];
}
export function threeToVec3(threeVec: THREE.Vector3): Vec3 {
  return [threeVec.x, threeVec.y, threeVec.z];
}
export function vecCopyTo<T extends Vec2 | Vec3>(v: T, dst: T) {
  for (let i = 0; i < v.length; i++) dst[i] = v[i];
}
export function vec2CopyTo3(v: Vec2, dst: Vec3) {
  dst[0] = v[0];
  dst[2] = v[1];
}
export function vecCopyToThree(v: Vec2 | Vec3, dst: THREE.Vector3) {
  if (v.length === 2) {
    dst.x = v[0];
    dst.z = v[1];
  } else {
    dst.x = v[0];
    dst.y = v[1];
    dst.z = v[2];
  }
}
export function vecAddToThree(v: Vec2 | Vec3, dst: THREE.Vector3) {
  if (v.length === 2) {
    dst.x += v[0];
    dst.z += v[1];
  } else {
    dst.x += v[0];
    dst.y += v[1];
    dst.z += v[2];
  }
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function normalize<T extends Vec2 | Vec3>(v: T): T {
  const l = length(v);
  if (l <= 0) return Array(v.length).fill(0) as T;
  return multiply(v, 1 / l);
}

export function lengthSq<T extends Vec2 | Vec3>(v: T): number {
  return v.reduce((p, v) => p + v * v, 0);
}
export function length<T extends Vec2 | Vec3>(v: T): number {
  return Math.sqrt(lengthSq<T>(v));
}

export function mod(v: number, d: number): number {
  return ((v % d) + d) % d;
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

export function step(a: number, b: number, ratio: number): number {
  return a * (1 - ratio) + b * ratio
}

export function stepVec<T extends Vec2 | Vec3>(vecA: T, vecB: T, ratio: number): T {
  return vecA.map((va, i) => step(va, vecB[i], ratio)) as T;
}

export function smooth(ratio: number, exponentA: number = 4, exponentB: number = 4): number {
  if (ratio >= 1) return 1;
  if (ratio <= 0) return 0;
  if (ratio > 0.5) return 1 - 0.5 * Math.pow(2 * (1 - ratio), exponentB);
  return 0.5 * Math.pow(2 * ratio, exponentA);
}

export function warnIfNotPresent(...values: any[]) {
  if (values.findIndex(v => v === null || v === undefined || v === false) >= 0) {
    console.warn('values should not be false, null or undefined, caller should be upper level in call stack, values:', values)
    return true; // for caller to if (warnIfNotPresent(...)) return;
  }
  return false;
}

const UUID_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
const UUID_TEMPLATE_REGEX = /[xy]/g;
const UUID_Y_SYMBOLS = ['8', '9', 'a', 'b'];
const UUID_RND_SIZE = UUID_TEMPLATE.replace(/[^x]/g, '').length;
export function genUUID() {
  const rndArr = new Uint8Array(Math.ceil(UUID_RND_SIZE / 2));
  crypto.getRandomValues(rndArr);

  let i = 0;
  return UUID_TEMPLATE.replace(UUID_TEMPLATE_REGEX, s => {
    if (s === 'y') {
      return UUID_Y_SYMBOLS[Math.floor(Math.random() * UUID_Y_SYMBOLS.length)];
    }
    
    const rndArrIndex = Math.floor((i++) / 2);
    const value = rndArr[rndArrIndex] & 0xF;
    rndArr[rndArrIndex] = rndArr[rndArrIndex] >> 4;
    return value.toString(16);
  });
}
