import UnamedNetwork from 'unamed-network';
import debug from 'debug';

import { Game } from './game';

import { getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, setMoveTarget } from './subObj/walking';

import { EntityRef } from './utils/ecs';
import { Vec3, Vec2, add, sub, vec3To2 } from './utils/utils';

import { UNAMED_NETWORK_CONFIG, UNAMED_NETWORK_KNOWN_SERVICE_ADDRS } from '../env';

debug.enable([
  'unamedNetwork:*',
  '-unamedNetwork:start',
  '-unamedNetwork:packet:*',
].join(',')); // for development

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

  { // development
    (window as any).unamedNetwork = unamedNetwork;
    console.log('window.unamedNetwork created:', unamedNetwork);
    console.log('unamedNetwork started, unamedNetwork.id:', unamedNetwork.id);

    unamedNetwork.on('new-member', ({ memberPeer, room }) => {
      console.log('new-member', { memberPeer, room });
    });
    unamedNetwork.on('room-message', ({ room, fromMember, message }) => {
      console.log('room-message', { room, fromMember, message });
    });
  }
}

interface PingMessage {
  type: 'world-ping';
  position: Vec3;
  moveTargetAbs?: Vec2;
  playerObj: string;
}

export async function join(roomName: string, game: Game): Promise<boolean> {
  await ensureStarted(game);

  if (game.network.roomName) {
    throw new Error('WIP: change realm room not implemented');
  }
  game.network.roomName = roomName;
  const memberExists = await game.network.unamedNetwork.join(roomName);

  if (memberExists) {
    broadcastMyself(game);
  }
  game.network.unamedNetwork.on('new-member', () => {
    broadcastMyself(game);
  });
  game.network.unamedNetwork.on('member-left', ({ memberPeer }) => {
    memberLeft(memberPeer.peerId, game);
  });
  game.network.unamedNetwork.on('room-message', ({ room, fromMember, message }) => {
    if (room.name !== roomName) return;
    switch (message.type) {
      case 'world-ping':
        console.log(`from ${fromMember.peerId} ping:`, message);
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
    playerObj: game.ecs.getUUID(game.player.objEntity),
    ...(playerWalking.moveTarget ? {
      moveTargetAbs: add(playerWalking.moveTarget, vec3To2(playerSubObj.position))
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
  if (game.ecs.getUUID(subObj.obj) !== message.playerObj) {
    destroySubObj(member, game);
    addMemberSprite(from, message.playerObj, message.position, game);
  }
  if (message.moveTargetAbs) {
    setMoveTarget(
      member, 
      sub(
        message.moveTargetAbs, 
        vec3To2(subObj.position),
      ),
      game,
    );
  }
}

function memberLeft(from: string, game: Game) {
  let member = game.network.members.get(from);
  destroySubObj(member, game);
}
