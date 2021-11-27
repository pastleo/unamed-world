import UnamedNetwork, { debug } from 'unamed-network';

import { Game } from './game';

import { getObjEntity } from './obj/obj';
import { createSubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, setMoveTarget } from './subObj/walking';

import { EntityRef } from './utils/ecs';
import { Vec3, Vec2, add, sub, vec3To2 } from './utils/utils';

import { UNAMED_NETWORK_CONFIG, UNAMED_NETWORK_KNOWN_ADDRS } from '../env';

export interface Networking {
  unamedNetwork: UnamedNetwork;
  roomName: string | null;
  members: Map<string, EntityRef>;
  pingThrottle: boolean;
}

export function init(): Networking {
  return {
    unamedNetwork: null,
    roomName: null,
    members: new Map(),
    pingThrottle: false,
  }
}

debug.enable([
  'unamedNetwork:*',
  '-unamedNetwork:start',
  '-unamedNetwork:packet:*',
].join(',')); // for development

export async function start(game: Game): Promise<void> {
  const network = game.network;

  const unamedNetwork = new UnamedNetwork(game.ipfs, UNAMED_NETWORK_CONFIG);
  await unamedNetwork.start(UNAMED_NETWORK_KNOWN_ADDRS);

  network.unamedNetwork = unamedNetwork;

  { // development
    (window as any).unamedNetwork = unamedNetwork;
    console.log('window.unamedNetwork created:', unamedNetwork);
    console.log('unamedNetwork started, unamedNetwork.idInfo.id:', unamedNetwork.idInfo.id);

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
}

export async function join(roomName: string, game: Game): Promise<boolean> {
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
  game.network.unamedNetwork.on('member-left', ({ memberPeer, room }) => {
    console.log('got [member-left]', memberPeer, room);
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
    ...(playerWalking.moveTarget ? {
      moveTargetAbs: add(playerWalking.moveTarget, vec3To2(playerSubObj.position))
    } : {}),
  }
  game.network.unamedNetwork.broadcast(game.network.roomName, message);
}

function handlePing(from: string, message: PingMessage, game: Game) {
  let member = game.network.members.get(from);
  if (!member) {
    const baseObj = getObjEntity('base', game.ecs);
    const located = locateOrCreateChunkCell(message.position, game);
    member = createSubObj(baseObj, message.position, game, located);
    game.network.members.set(from, member);
    initSubObjWalking(member, game);
  }

  const subObj = game.ecs.getComponent(member, 'subObj');
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
