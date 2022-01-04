import * as ss from 'superstruct';
import type { Optional } from 'utility-types';

import { sidType } from './ecs';
import { EqualOrNever, vec2Type, vec3Type } from './utils';

/**
 * To define a superstruct object with optional key:
 *
 * const someTypeDef = ss.object({
 *   a: ss.string(),
 *   b: ss.optional(ss.string()),
 * });
 * type Some = InferSSOptional<typeof someTypeDef, 'b'>;
 * export const someType = someTypeDef as ss.Struct<Some>;
 *
 * Why optional can not be infered directly?
 *
 * from https://docs.superstructjs.org/guides/06-using-typescript
 * If you are not using TypeScript's strictNullChecks option, Superstruct will be unable to infer your "optional" types correctly and will mark all types as optional.
 */
export type InferSSOptional<T extends ss.Struct<object>, K extends keyof ss.Infer<T>> = Optional<ss.Infer<T>, K>;

/**
 * When superstruct type definition is separated from original type declaration, use this to make sure 2 definition is equal
 *
 * const someTypeDefSeparated = ss.object({
 *   a: ss.string(),
 *   b: ss.number(),
 * });
 * 
 * interface SomeDef {
 *   a: string;
 *   b: number;
 * }
 * export type Some = EnsureSS<SomeDef, typeof someTypeDefSeparated>;
 *
 * when someTypeDefSeparated is not aligned with SomeDef, Some will become never
 */
export type EnsureSS<T, R extends ss.Struct> = EqualOrNever<T, ss.Infer<R>>;
// EnsureSS is for superstruct definitions below

// below definitions are shared superstruct types that cause circular dependency
// and resulting "const 'xxx' is accessed before initialization"

export const subObjStateType = ss.union([ss.literal('normal'), ss.literal('walking'), ss.string()]);

export const packedSubObjComponentType = ss.object({
  obj: sidType,
  position: vec3Type,
  rotation: vec3Type,
  groundAltitude: ss.number(),
  state: subObjStateType,
  cellIJ: vec2Type,
  chunkIJ: vec2Type,
});
