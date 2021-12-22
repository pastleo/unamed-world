import debug from 'debug';

import { SidEntries } from './storage';
import { ChunkComponent } from './chunk/chunk';

import { Vec2 } from './utils/utils';
import { LATEST_STORAGE_VERSION } from './consts';

const log = debug('migration');

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

  checkLatest(json);
}

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

  checkLatest(json);
}

function checkLatest(json: any) {
  if (json.version !== LATEST_STORAGE_VERSION) {
    console.warn(`migrateRealmJson: did not migrate to latest version, json version: ${json.version}, LATEST_STORAGE_VERSION: ${LATEST_STORAGE_VERSION}`)
  }
}

