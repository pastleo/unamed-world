import localForage from 'localforage';
import type { GameECS } from './gameECS';

import type { PackedRealmJson, PackedSpriteJson } from './resourcePacker';

import { ObjPath, unpack as unpackObj } from './obj/obj';
import { unpack as unpackObjRealm } from './obj/realm';
import { unpack as unpackChunk } from './chunk/chunk';
import { unpack as unpackSubObj } from './subObj/subObj';
import { unpack as unpackObjSprite } from './obj/sprite';
import { unpack as unpackObjWalkable } from './obj/walkable';

import { EntityRef } from './utils/ecs';

export function loadPackedRealm(realmObjPath: ObjPath, json: PackedRealmJson, ecs: GameECS): EntityRef {
  const newRealmEntity = ecs.fromSid(realmObjPath);
  unpackObjRealm(newRealmEntity, json.packedObjRealm, ecs);
  json.packedChunks.forEach(([sid, packedChunk]) => {
    unpackChunk(
      ecs.fromSid(sid),
      packedChunk,
      ecs,
    )
  });
  json.packedSubObjs.forEach(([sid, packedSubObjs]) => {
    unpackSubObj(
      ecs.fromSid(sid),
      packedSubObjs,
      ecs,
    );
  });

  return newRealmEntity;
}

export function loadPackedSprite(objSpritePath: ObjPath, json: PackedSpriteJson, ecs: GameECS): EntityRef {
  const objEntity = ecs.fromSid(objSpritePath);
  unpackObj(objEntity, json.packedObj, ecs);
  unpackObjSprite(objEntity, json.packedObjSprite, ecs);
  unpackObjWalkable(objEntity, json.packedObjWalkable, ecs);

  return objEntity;
}

export function isObjSpriteRequired(objEntityOrPath: EntityRef | ObjPath, ecs: GameECS): [required: boolean, objPath: ObjPath, objEntity: EntityRef] {
  const objPath = typeof objEntityOrPath === 'string' ? objEntityOrPath : ecs.getPrimarySid(objEntityOrPath);
  const objEntity = typeof objEntityOrPath === 'string' ? ecs.fromSid(objEntityOrPath) : objEntityOrPath;
  const obj = ecs.getComponent(objEntity, 'obj');
  if (obj) return [true, objPath, objEntity]; // already required
  return [false, objPath, null];
}
