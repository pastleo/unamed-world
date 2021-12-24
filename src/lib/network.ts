import UnamedNetwork from 'unamed-network';

import debug from 'debug';

import { Game } from './game';

import { getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, getMoveTarget, setMoveTo } from './subObj/walking';

import { EntityRef } from './utils/ecs';
import { Vec3, Vec2 } from './utils/utils';

import { UNAMED_NETWORK_CONFIG, UNAMED_NETWORK_KNOWN_SERVICE_ADDRS } from '../env';
import { DBG_MODE } from './dbg';

const log = debug('network');

export interface Networking {
  unamedNetwork: UnamedNetwork;
  roomName: string | null;
  members: Map<string, EntityRef>;
  pingThrottle: boolean;
}

export function init(): Networking {
  return {
    unamedNetwork: new UnamedNetwork(UNAMED_NETWORK_CONFIG),
    roomName: null,
    members: new Map(),
    pingThrottle: false,
  }
}

export async function ensureStarted(game: Game) {
  const unamedNetwork = game.network.unamedNetwork;
  if (unamedNetwork.started) return;

  await unamedNetwork.start(UNAMED_NETWORK_KNOWN_SERVICE_ADDRS);

  if (DBG_MODE) {
    (window as any).unamedNetwork = unamedNetwork;
    console.log('window.unamedNetwork created:', unamedNetwork);
    console.log('unamedNetwork started, unamedNetwork.id:', unamedNetwork.id);
  }
}

interface PingMessage {
  type: 'world-ping';
  position: Vec3;
  moveTarget?: Vec2;
  playerObj: string;
}

export async function join(roomName: string, game: Game): Promise<boolean> {
  await ensureStarted(game);

  game.network.roomName = roomName;
  const memberExists = await game.network.unamedNetwork.join(roomName, true);

  if (memberExists) {
    broadcastMyself(game);
  }
  game.network.unamedNetwork.on('new-member', ({ memberPeer, room }) => {
    log('new-member', { memberPeer, room });
    broadcastMyself(game);
  });
  game.network.unamedNetwork.on('member-left', ({ memberPeer }) => {
    memberLeft(memberPeer.peerId, game);
  });
  game.network.unamedNetwork.on('room-message', ({ room, fromMember, message }) => {
    log('room-message', { room, fromMember, message });
    if (room.name !== roomName) return;
    switch (message.type) {
      case 'world-ping':
        handlePing(fromMember.peerId, message as PingMessage, game);
      break;
    }
  });

  return memberExists;
}

export function broadcastMyself(game: Game) {
  if (game.network.pingThrottle || !game.network.roomName) return;
  game.network.pingThrottle = true;
  setTimeout(() => {
    game.network.pingThrottle = false;
  }, 150);
  const player = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = player.get('subObj');
  const playerWalking = player.get('subObj/walking');
  const message: PingMessage = {
    type: 'world-ping',
    position: playerSubObj.position,
    playerObj: game.ecs.getSid(game.player.objEntity),
    ...(playerWalking.moveRelative ? {
      moveTarget: getMoveTarget(player),
    } : {}),
  }
  game.network.unamedNetwork.broadcast(game.network.roomName, message);
}

function addMemberSprite(peerId: string, playerObj: string, position: Vec3, game: Game): EntityRef {
  const baseObj = getObjEntity(playerObj || 'base', game.ecs);
  const located = locateOrCreateChunkCell(position, game);
  const member = createSubObj(baseObj, position, game, located);
  game.network.members.set(peerId, member);
  initSubObjWalking(member, game);
  return member;
}

function handlePing(from: string, message: PingMessage, game: Game) {
  let member = game.network.members.get(from);
  if (!member) {
    member = addMemberSprite(from, message.playerObj || 'base', message.position, game);
  }

  const subObj = game.ecs.getComponent(member, 'subObj');
  if (game.ecs.getSid(subObj.obj) !== message.playerObj) {
    destroySubObj(member, game);
    addMemberSprite(from, message.playerObj, message.position, game);
  }
  if (message.moveTarget) {
    setMoveTo(member, message.moveTarget, game);
  }
}

function memberLeft(from: string, game: Game) {
  let member = game.network.members.get(from);
  destroySubObj(member, game);
}
