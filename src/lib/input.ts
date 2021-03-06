import type { Game } from './game';
import { movePlayerAddRelative, syncLocationToRealmSpawnLocation } from './player';
import { setActiveTool, castMainTool, castMainToolMove } from './tools';
import { exportRealm } from './resource';
import { moveCameraAngle, adjCameraDistance, vecAfterCameraRotation } from './camera';
import mayZoom from './zoom';

import { Vec2, multiply, add, lengthSq } from './utils/utils';
import { setUrlHash } from './utils/web';

export interface Input {
  keyPressed: Set<string>;
  mousedown: null | 'left' | 'right' | 'middle' | 'rightClicked';
  mouseMoved: boolean;
  lastMouseCoord: Vec2;
  mouseTotalMovement: Vec2;
  triggerMouseClickTimeout?: ReturnType<typeof setTimeout>;
  touched: boolean | 'multi';
  touchmove: boolean;
  touchCoord: Vec2;
  triggerTouchClickTimeout?: ReturnType<typeof setTimeout>;
  penDown: boolean;
  pitchSq?: number;
  macTouchpadDetected: boolean;
  wheelMinDeltaY?: number;
  gestureRotation: number;
  gestureScale: number;
}
const MOUSE_BUTTONS: Input['mousedown'][] = ['left', 'middle', 'right'];
const DOUBLE_CLICK_INTERVAL = 200;

interface SafariGestureEvent extends Event {
  rotation: number;
  scale: number;
}

export function create(): Input {
  return {
    keyPressed: new Set(),
    mousedown: null,
    lastMouseCoord: [0, 0],
    mouseTotalMovement: [0, 0],
    mouseMoved: false,
    touched: false,
    touchmove: false,
    touchCoord: [0, 0],
    penDown: false,
    macTouchpadDetected: false,
    gestureRotation: 0,
    gestureScale: 0,
  };
}

export function startListeners(game: Game) {
  const { input } = game;
  window.addEventListener('keydown', async event => {
    if (event.ctrlKey) {
      let realmObjPath;
      switch (event.key) {
        case 'S':
          if (!await game.ui.modal.confirm('[UNSTABLE] Will save to IPFS and switch, process?')) return;
          event.preventDefault();
          syncLocationToRealmSpawnLocation(game);
          realmObjPath = await exportRealm('ipfs', game);
          if (realmObjPath) {
            setUrlHash({ '': realmObjPath });
          }
          return;
      }
    }

    const numberKey = parseInt(event.key, 10);
    if (!Number.isNaN(numberKey)) {
      return setActiveTool(numberKey - 1, game);
    }

    if (event.key === '`') {
      return setActiveTool('melee', game);
    }
    if (event.key === 'Escape') {
      return setActiveTool('options', game);
    }

    input.keyPressed.add(event.key);
  }, false);
  window.addEventListener('keyup', event => {
    input.keyPressed.delete(event.key);
  }, false);

  game.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
  game.renderer.domElement.addEventListener('mousedown', event => {
    event.preventDefault();
    if (input.mousedown) return;

    input.mousedown = MOUSE_BUTTONS[event.button];
    input.lastMouseCoord = [event.offsetX, event.offsetY];
    input.mouseTotalMovement = [0, 0];

    if (input.mousedown === 'right') {
      game.renderer.domElement.requestPointerLock();
    } else {
      castMainTool(input.lastMouseCoord, 'down', game);
    }
  });
  game.renderer.domElement.addEventListener('mouseup', () => {
    if (!input.mouseMoved) {
      switch (input.mousedown) {
        case 'left':
          castMainTool(input.lastMouseCoord, 'up', game);

          if (input.triggerMouseClickTimeout) {
            clearTimeout(input.triggerMouseClickTimeout);
            delete input.triggerMouseClickTimeout;
            castMainTool(input.lastMouseCoord, 'dbclick', game);
          } else {
            input.triggerMouseClickTimeout = setTimeout(() => {
              delete input.triggerMouseClickTimeout;
              castMainTool(input.lastMouseCoord, 'click', game);
            }, DOUBLE_CLICK_INTERVAL);
          }
          break;
        case 'middle':
          // use tool accordingly
          break;
        case 'right':
          input.mousedown = 'rightClicked';
          return;
      }
    }

    input.mousedown = null;
    input.mouseMoved = false;
    document.exitPointerLock();
  });
  game.renderer.domElement.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'pen') return;
    input.penDown = true;
    castMainTool([event.offsetX, event.offsetY], 'down', game);
  });
  game.renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerType !== 'pen' && !input.penDown) return;
    castMainTool([event.offsetX, event.offsetY], 'down', game);
  });
  game.renderer.domElement.addEventListener('pointerup', event => {
    if (event.pointerType !== 'pen' && !input.penDown) return;
    input.penDown = false;
    castMainTool([event.offsetX, event.offsetY], 'up', game);
  });

  game.renderer.domElement.addEventListener('mousemove', event => {
    if (input.mousedown) {
      const { offsetX, offsetY } = event;
      const [preOffsetX, preOffsetY] = input.lastMouseCoord;
      const movement: Vec2 = [
        -event.movementX || offsetX - preOffsetX,
        -event.movementY || offsetY - preOffsetY,
      ];
      input.lastMouseCoord = [offsetX, offsetY];
      input.mouseTotalMovement = add(input.mouseTotalMovement, movement);

      if (
        input.mouseMoved ||
        lengthSq(input.mouseTotalMovement) > 48
      ) {
        input.mouseMoved = true;
        if (input.mousedown === 'left') {
          castMainToolMove([offsetX, offsetY], movement, 'move', game);
        } else if (input.mousedown.startsWith('right')) {
          moveCameraAngle(
            multiply(input.mouseTotalMovement, 0.01),
            game.camera,
          );
        }

        input.mouseTotalMovement = [0, 0];
      }
    } else {
      // hover
    }
  });

  const exitPointerLock = () => {
    if (document.pointerLockElement !== game.renderer.domElement) {
      input.mousedown = null;
      input.mouseMoved = false;
      document.exitPointerLock();
    }
  }
  document.addEventListener('pointerlockchange', exitPointerLock, false);
  document.addEventListener('pointerlockerror', exitPointerLock, false);

  game.renderer.domElement.addEventListener('touchstart', event => {
    if (input.penDown) return;
    input.touched = true;
    input.touchCoord = touchOffset(event.touches[0], game.renderer.domElement);
  }, { passive: true });
  game.renderer.domElement.addEventListener('touchend', event => {
    event.preventDefault(); // prevent simulating mouse click

    if (input.touched && !input.touchmove && !input.penDown) {
      castMainTool(input.touchCoord, 'up', game);

      if (input.triggerTouchClickTimeout) {
        clearTimeout(input.triggerTouchClickTimeout);
        delete input.triggerTouchClickTimeout;
        castMainTool(input.touchCoord, 'dbclick', game);
      } else {
        input.triggerTouchClickTimeout = setTimeout(() => {
          delete input.triggerTouchClickTimeout;
          castMainTool(input.touchCoord, 'click', game);
        }, DOUBLE_CLICK_INTERVAL);
      }
    }
    input.touched = false;
    input.touchmove = false;
    delete input.pitchSq;
  });
  game.renderer.domElement.addEventListener('touchcancel', _event => {
    input.touched = false;
    input.touchmove = false;
    delete input.pitchSq;
  });
  game.renderer.domElement.addEventListener('touchmove', event => {
    if (!input.touched || input.penDown) return;

    const [offsetX, offsetY] = multiTouchOffset(event.touches, game.renderer.domElement);
    const [preOffsetX, preOffsetY] = input.touchCoord;
    input.touchCoord = [offsetX, offsetY];

    if (event.touches.length >= 2) {
      input.touchmove = true;

      if (input.touched !== 'multi') {
        input.touched = 'multi';
      } else {
        moveCameraAngle([(preOffsetX - offsetX) / 100, (preOffsetY - offsetY) / 100], game.camera)

        if (event.touches.length === 2) {
          const offsets = [touchOffset(event.touches[0], game.renderer.domElement), touchOffset(event.touches[1], game.renderer.domElement)];
          const pitchSq = (offsets[0][0] - offsets[1][0]) * (offsets[0][0] - offsets[1][0]) +
            (offsets[0][1] - offsets[1][1]) * (offsets[0][1] - offsets[1][1]);

          if (input.pitchSq) {
            const prePicthSq = input.pitchSq;
            const zoom = adjCameraDistance((prePicthSq - pitchSq) / 8000, game);
            mayZoom(zoom, game);
          }
          input.pitchSq = pitchSq;
        }
      }
    } else if (
      input.touchmove ||
      ((offsetX - preOffsetX) * (offsetX - preOffsetX) + (offsetY - preOffsetY) * (offsetY - preOffsetY)) > 48
    ) {
      input.touchmove = true;

      castMainToolMove(
        [offsetX, offsetY],
        [preOffsetX - offsetX, preOffsetY - offsetY],
        'move', game,
      );
    }
  }, { passive: true });

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  game.renderer.domElement.addEventListener('wheel', event => {
    if (isMac) {
      const absDeltaY = Math.abs(event.deltaY);
      if (!input.macTouchpadDetected) {
        if (absDeltaY > 0) {
          input.wheelMinDeltaY = Math.min(absDeltaY, input.wheelMinDeltaY || Infinity);
        }
        if (input.wheelMinDeltaY) {
          const mouseWheelSteps = absDeltaY / input.wheelMinDeltaY;
          if (input.wheelMinDeltaY === 1 || mouseWheelSteps % 1 > 0) {
            input.macTouchpadDetected = true;
          }
        }
      }
    }

    let distanceDelta = 0, angleDelta: Vec2 = [0, 0];

    if (event.ctrlKey) {
      // touchpad pinch-to-zoom, on chrome, firefox, edge
      // https://kenneth.io/post/detecting-multi-touch-trackpad-gestures-in-javascript
      distanceDelta += event.deltaY / 2;
    } else if (input.macTouchpadDetected) {
      angleDelta[0] += event.deltaX / 200;
      angleDelta[1] += event.deltaY / 200;
    } else {
      distanceDelta += event.deltaY / 50;
      angleDelta[0] += event.deltaX / 100;
    }

    const zoom = adjCameraDistance(distanceDelta, game);
    mayZoom(zoom, game);
    moveCameraAngle(angleDelta, game.camera);
  }, { passive: true });

  // non-standard gesture events, only supported in Safari
  // https://kenneth.io/post/detecting-multi-touch-trackpad-gestures-in-javascript
  game.renderer.domElement.addEventListener('gesturestart', (event: SafariGestureEvent) => {
    event.preventDefault();
    input.gestureRotation = event.rotation;
    input.gestureScale = event.scale;
  });
  game.renderer.domElement.addEventListener('gesturechange', (event: SafariGestureEvent) => {
    event.preventDefault();

    if (input.touched) return;

    const preRotation = input.gestureRotation;
    const preScale = input.gestureScale;
    input.gestureRotation = event.rotation;
    input.gestureScale = event.scale;

    moveCameraAngle(
      [0, (input.gestureRotation - preRotation) * Math.PI / 180],
      game.camera,
    );
    const zoom = adjCameraDistance((preScale - input.gestureScale) * 20, game);
    mayZoom(zoom, game);
  });
}

export function update(input: Input, tDiff: number, game: Game) {
  const inputVec: Vec2 = [0, 0];
  if (input.keyPressed.has('a') || input.keyPressed.has('ArrowLeft')) {
    inputVec[0] -= tDiff;
  } else if (input.keyPressed.has('d') || input.keyPressed.has('ArrowRight')) {
    inputVec[0] += tDiff;
  }

  if (game.input.keyPressed.has('s') || input.keyPressed.has('ArrowDown')) {
    inputVec[1] += tDiff;
  } else if (game.input.keyPressed.has('w') || input.keyPressed.has('ArrowUp')) {
    inputVec[1] -= tDiff;
  }

  if (inputVec[0] !== 0 || inputVec[1] !== 0) {
    movePlayerAddRelative(
      vecAfterCameraRotation(
        multiply(inputVec, 0.01),
        game.camera,
      ),
      game,
    );
  }
}

function touchOffset(touch: Touch, canvas: HTMLCanvasElement): Vec2 {
  return [touch.pageX - canvas.offsetLeft, touch.pageY - canvas.offsetTop];
}

function multiTouchOffset(touches: TouchList, canvas: HTMLCanvasElement): Vec2 {
  return Array(touches.length).fill(null).map(
    (_, i) => touchOffset(touches[i], canvas)
  ).reduce(
    ([cx, cy], [x, y]) => ([cx + x, cy + y]),
    [0, 0]
  ).map(d => d / touches.length) as Vec2;
}
