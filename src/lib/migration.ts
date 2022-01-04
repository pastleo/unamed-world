import debug from 'debug';

import type { SidEntries } from './resourcePacker';
import type { ChunkComponent } from './chunk/chunk';
import type { Vec2 } from './utils/utils';

const log = debug('migration');

export const LATEST_REALM_JSON_VERSION = 2;
export function migrateRealmJson(json: any) {
  if (!json.version) { // version null
    json.packedChunks.forEach(([_, chunk]: [string, {cellsEntries: any}]) => {
      chunk.cellsEntries.forEach(([_, cell]: [Vec2, {flatness: number}]) => {
        cell.flatness *= 10;
      });
    });
    json.version = 1;
    log('migrated realmJson to v1:', json);
  }

  if (json.version === 1) {
    delete json.realmUUID;
    json.version = 2;
    (json.packedChunks as SidEntries<ChunkComponent>).forEach(
      ([_id, chunk]) => {
        chunk.repeatable = true;
      }
    );
    log('migrated realmJson to v2:', json);
  }
  
  checkLatest(json, LATEST_REALM_JSON_VERSION);
}

export const LATEST_SPRITE_JSON_VERSION = 3;
export function migrateSpriteJson(json: any) {
  if (!json.version) { // version null
    json.version = 1;
    log('migrated spriteJson:', json.objUUID);
  }

  if (json.version === 1) {
    delete json.objUUID;
    json.version = 2;
    log('migrated spriteJson to v2:', json);
  }

  if (json.version === 2) {
    json.packedObj = {
      subObjType: 'sprite',
    }
    json.version = 3;
    log('migrated spriteJson to v3:', json);
  }

  checkLatest(json, LATEST_SPRITE_JSON_VERSION);
}

function checkLatest(json: any, latestVersion: number) {
  if (json.version !== latestVersion) {
    console.warn(`migrateRealmJson: did not migrate to latest version, json version: ${json.version}, latestVersion: ${latestVersion}`)
  }
}

