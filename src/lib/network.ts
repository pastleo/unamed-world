import UnamedNetwork, { Room, Peer } from 'unamed-network';

import debug from 'debug';

import type { Game } from './game';
import { PackedRealmJson, PackedSpriteJson, packRealm, packSprite } from './resourcePacker';

import { ObjPath, getObjEntity } from './obj/obj';
import { createSubObj, destroySubObj } from './subObj/subObj';
import { locateOrCreateChunkCell } from './chunk/chunk';
import { initSubObjWalking, getMoveTarget, setMoveTo } from './subObj/walking';
import { Action, processAction } from './action';

import type { EntityRef, Sid } from './utils/ecs';
import { Vec3, Vec2, randomStr } from './utils/utils';

import { UNAMED_NETWORK_CONFIG, UNAMED_NETWORK_KNOWN_SERVICE_ADDRS } from '../env';
import { ACTION_BROADCAST_INTIVAL } from './consts';
import { DBG_MODE } from './dbg';

const log = debug('network');

export interface Networking {
  unamedNetwork: UnamedNetwork;
  roomName: string | null;
  members: Map<string, EntityRef>;
  master: boolean;
  pingThrottle: boolean;

  paused: boolean;
  reqs: Map<string, (message: RoomMessage, fromMember: Peer) => void>;
  pausedResolves: (() => void)[];

  actionsToBroadcast: Action[];
  actionBroadcastLoop?: ReturnType<typeof setTimeout>;
}

export function init(): Networking {
  return {
    unamedNetwork: new UnamedNetwork(UNAMED_NETWORK_CONFIG),
    roomName: null,
    members: new Map(),
    master: false,
    pingThrottle: false,

    reqs: new Map(),
    paused: true,
    pausedResolves: [],

    actionsToBroadcast: [],
  }
}

export async function ensureStarted(game: Game) {
  const unamedNetwork = game.network.unamedNetwork;
  if (unamedNetwork.started) return;

  game.network.unamedNetwork.on('new-member', ({ memberPeer, room }) => {
    log('new-member', { memberPeer, room });
    broadcastMyself(game, true);
  });
  game.network.unamedNetwork.on('member-left', ({ memberPeer }) => {
    memberLeft(memberPeer.peerId, game);
  });
  game.network.unamedNetwork.on('room-message', ({ room, fromMember, message }) => {
    handleRoomMessage(fromMember, message, room, game);
  });

  await unamedNetwork.start(UNAMED_NETWORK_KNOWN_SERVICE_ADDRS);

  if (DBG_MODE) {
    (window as any).unamedNetwork = unamedNetwork;
    console.log('window.unamedNetwork created:', unamedNetwork);
    console.log('unamedNetwork started, unamedNetwork.id:', unamedNetwork.id);
  }
}

export async function unpauseProcessingRuntimeMessages(game: Game, untilPromiseResolved?: Promise<any>) {
  if (untilPromiseResolved) {
    await untilPromiseResolved;
  }
  if (!game.network.paused) return;

  game.network.paused = false;
  game.network.pausedResolves.forEach(r => r());
}
export function pauseProcessingRuntimeMessages(game: Game) {
  game.network.paused = true;
}
function untilRuntimeMessageUnpaused(game: Game): Promise<void> {
  if (!game.network.paused) return;
  return new Promise(resolve => {
    game.network.pausedResolves.push(resolve);
  });
}

interface RoomMessage {
  type: string;
  roomName: string;
}
interface PingMessage extends RoomMessage {
  type: 'ping';
  position: Vec3;
  moveTarget?: Vec2;
  playerObj: Sid;
}
interface ByebyeMessage extends RoomMessage {
  type: 'byebye';
}
interface ReqResMessage extends RoomMessage {
  reqId: string;
}
interface ReqObjMessage extends ReqResMessage {
  type: 'req-obj';
  objType: 'realm' | 'sprite';
  objPath: ObjPath;
}
interface ReqObjFoundMessage extends ReqResMessage {
  type: 'res-obj-found';
}
interface ReqRealmMessage extends ReqResMessage {
  type: 'req-realm';
}
interface ResRealmMessage extends ReqResMessage {
  type: 'res-realm';
  realm: PackedRealmJson;
}
interface ReqSpriteMessage extends ReqResMessage {
  type: 'req-sprite';
  spriteObjPath: string;
}
interface ResSpriteMessage extends ReqResMessage {
  type: 'res-sprite';
  sprite: PackedSpriteJson;
}
interface ActionsMessage extends RoomMessage {
  type: 'actions';
  actions: Action[];
}

export async function join(roomName: string, game: Game): Promise<boolean> {
  await ensureStarted(game);
  pauseProcessingRuntimeMessages(game);

  if (game.network.roomName) {
    sayByebye(game.network.roomName, game);
    game.network.members.forEach((_, peerId) => {
      memberLeft(peerId, game);
    });
  }

  game.network.roomName = roomName;
  const memberExists = await game.network.unamedNetwork.join(roomName, true);
  console.log('join', roomName, memberExists);

  if (memberExists) {
    broadcastMyself(game, true);
    game.network.master = false;
  } else {
    game.network.master = true;
  }

  return memberExists;
}

export function reqRealm(game: Game): Promise<PackedRealmJson> {
  return new Promise(resolve => {
    const reqId = randomStr();
    const message: ReqRealmMessage = {
      type: 'req-realm', reqId,
      roomName: game.network.roomName,
    }

    game.network.reqs.set(reqId, message => {
      resolve((message as ResRealmMessage).realm);
    });
    game.network.unamedNetwork.broadcast(game.network.roomName, message);
  });
}

export async function reqSprite(spriteObjPath: ObjPath, game: Game): Promise<PackedSpriteJson> {
  const memberWithSprite = await reqObj('sprite', spriteObjPath, game);
  return reqSpriteFromMember(spriteObjPath, memberWithSprite, game);
}

export function broadcastMyself(game: Game, force?: boolean) {
  if (!game.network.roomName) return;
  if (!force) {
    if (game.network.pingThrottle) return;
    game.network.pingThrottle = true;
    setTimeout(() => {
      game.network.pingThrottle = false;
    }, 150);
  }
  const player = game.ecs.getEntityComponents(game.player.subObjEntity);
  const playerSubObj = player.get('subObj');
  const playerWalking = player.get('subObj/walking');
  const message: PingMessage = {
    type: 'ping',
    roomName: game.network.roomName,
    position: playerSubObj.position,
    playerObj: game.ecs.getPrimarySid(game.player.objEntity, true),
    ...(playerWalking.moveRelative ? {
      moveTarget: getMoveTarget(player),
    } : {}),
  }
  game.network.unamedNetwork.broadcast(game.network.roomName, message);
}

export function addActionToBroadcast(action: Action, game: Game) {
  if (!game.network.roomName) return;

  game.network.actionsToBroadcast.push(action);

  if (game.network.actionBroadcastLoop) return;

  game.network.actionBroadcastLoop = setTimeout(() => {
    delete game.network.actionBroadcastLoop;

    const message: ActionsMessage = {
      type: 'actions',
      roomName: game.network.roomName,
      actions: game.network.actionsToBroadcast,
    }
    game.network.actionsToBroadcast = [];
    game.network.unamedNetwork.broadcast(
      game.network.roomName,
      message
    );
  }, ACTION_BROADCAST_INTIVAL);
}

async function handleRoomMessage(fromMember: Peer, message: RoomMessage, room: Room, game: Game) {
  log('room-message', { room, fromMember, message });
  if (room.name !== game.network.roomName) return;

  switch (message.type) {
    case 'req-obj':
      return handleReqObj(fromMember, message as ReqObjMessage, game);
    case 'req-realm':
      return handleReqRealm(fromMember, message as ReqRealmMessage, game);
    case 'req-sprite':
      return handleReqSprite(fromMember, message as ReqSpriteMessage, game);
    case 'res-obj-found':
    case 'res-realm':
    case 'res-sprite':
      return handleResMessage(fromMember, message as ReqResMessage, game);
    case 'ping':
      await untilRuntimeMessageUnpaused(game);
      return handlePing(fromMember, message as PingMessage, game);
    case 'byebye':
      await untilRuntimeMessageUnpaused(game);
      return handleByebye(fromMember, message as ByebyeMessage, game);
    case 'actions':
      await untilRuntimeMessageUnpaused(game);
      return handleActions(fromMember, message as ActionsMessage, game);
  }
}
function handleResMessage(fromMember: Peer, message: ReqResMessage, game: Game) {
  const req = game.network.reqs.get(message.reqId);
  if (req) {
    game.network.reqs.delete(message.reqId);
    req(message, fromMember);
  }
}

function handleReqObj(fromMember: Peer, message: ReqObjMessage, game: Game) {
  let found = false;

  if (
    message.objType === 'realm' &&
    game.ecs.getPrimarySid(game.realm.currentObj) === message.objPath
  ) {
    found = true;
  } else {
    const entity = game.ecs.fromSid(message.objPath, true);
    if (entity && game.ecs.getComponent(entity, 'obj/sprite')) {
      found = true;
    }
  }

  if (found) {
    const resMessage: ReqObjFoundMessage = {
      type: 'res-obj-found',
      reqId: message.reqId,
      roomName: game.network.roomName,
    }
    game.network.unamedNetwork.broadcast(game.network.roomName, resMessage, [fromMember.peerId]);
  }
}

function handleReqRealm(fromMember: Peer, message: ReqRealmMessage, game: Game) {
  if (!game.network.master) return;

  const resMessage: ResRealmMessage = {
    type: 'res-realm',
    reqId: message.reqId,
    roomName: game.network.roomName,
    realm: packRealm(game),
  }

  game.network.unamedNetwork.broadcast(game.network.roomName, resMessage, [fromMember.peerId]);
}

function handleReqSprite(fromMember: Peer, message: ReqSpriteMessage, game: Game) {
  const objSprite = game.ecs.fromSid(message.spriteObjPath, true);
  if (!objSprite) return;

  const resMessage: ResSpriteMessage = {
    type: 'res-sprite',
    reqId: message.reqId,
    roomName: game.network.roomName,
    sprite: packSprite(objSprite, game.ecs),
  }

  game.network.unamedNetwork.broadcast(game.network.roomName, resMessage, [fromMember.peerId]);
}

function handlePing(fromMember: Peer, message: PingMessage, game: Game) {
  let member = game.network.members.get(fromMember.peerId);
  if (!member) {
    member = addMemberSprite(fromMember.peerId, message.playerObj, message.position, game);
  }

  const subObj = game.ecs.getComponent(member, 'subObj');
  if (game.ecs.getPrimarySid(subObj?.obj) !== message.playerObj) {
    destroySubObj(member, game);
    member = addMemberSprite(fromMember.peerId, message.playerObj, message.position, game);
  }
  if (message.moveTarget) {
    setMoveTo(member, message.moveTarget, game);
  }
}

function handleByebye(fromMember: Peer, _message: ByebyeMessage, game: Game) {
  memberLeft(fromMember.peerId, game);
}

function handleActions(_fromMember: Peer, message: ActionsMessage, game: Game) {
  message.actions.forEach(action => {
    processAction(action, game);
  });
}

function reqObj(objType: 'realm' | 'sprite', objPath: ObjPath, game: Game): Promise<Peer> {
  return new Promise(resolve => {
    const reqId = randomStr();
    const message: ReqObjMessage = {
      type: 'req-obj', reqId,
      roomName: game.network.roomName,
      objType, objPath,
    }

    game.network.reqs.set(reqId, (_message, fromMember) => {
      resolve(fromMember);
    });
    game.network.unamedNetwork.broadcast(game.network.roomName, message);
  });
}
function reqSpriteFromMember(spriteObjPath: ObjPath, member: Peer, game: Game): Promise<PackedSpriteJson> {
  return new Promise(resolve => {
    const reqId = randomStr();
    const message: ReqSpriteMessage = {
      type: 'req-sprite', reqId,
      roomName: game.network.roomName,
      spriteObjPath,
    }

    game.network.reqs.set(reqId, message => {
      resolve((message as ResSpriteMessage).sprite);
    });
    game.network.unamedNetwork.broadcast(game.network.roomName, message, [member.peerId]);
  });
}

function addMemberSprite(peerId: string, playerObj: string, position: Vec3, game: Game): EntityRef {
  const objSid = playerObj || 'base';
  const spriteObj = getObjEntity(objSid, game.ecs);
  const located = locateOrCreateChunkCell(position, game);
  const member = createSubObj(spriteObj, position, [0, 0, 0], game, located);
  const subObj = game.ecs.getComponent(member, 'subObj');
  subObj.mounted = true;
  game.network.members.set(peerId, member);
  initSubObjWalking(member, game);
  return member;
}

function sayByebye(roomName: string, game: Game) {
  const message: ByebyeMessage = {
    type: 'byebye', roomName,
  }

  game.network.unamedNetwork.broadcast(roomName, message);
}

function memberLeft(peerId: string, game: Game) {
  const member = game.network.members.get(peerId);
  destroySubObj(member, game);
  if (game.network.members.size <= 0) {
    game.network.master = true;
  }
}
