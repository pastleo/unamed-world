import { Game } from './game';
import { exportAndSwitch } from './update';
import { movePlayer, castMainTool } from './player';
import { moveCameraAngle, adjCameraDistance, vecAfterCameraRotation } from './camera';
import { Vec2, multiply, add, lengthSq } from './utils/utils';

export interface Input {
  keyPressed: Set<string>;
  mousedown: null | 'left' | 'right' | 'middle' | 'rightClicked';
  mouseMoved: boolean;
  lastMouseCoord: Vec2;
  mouseTotalMovement: Vec2;
  touched: boolean | 'multi';
  touchmove: boolean;
  touchCoord: Vec2;
  pitchSq?: number;
  macTouchpadDetected: boolean;
  wheelMinDeltaY?: number;
  gestureRotation: number;
  gestureScale: number;
}
const MOUSE_BUTTONS: Input['mousedown'][] = ['left', 'middle', 'right'];

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
    macTouchpadDetected: false,
    gestureRotation: 0,
    gestureScale: 0,
  };
}

export function startListeners(game: Game) {
  const { input } = game;
  window.addEventListener('keydown', event => {
    if (event.ctrlKey) {
      switch (event.key) {
        case 's':
          event.preventDefault();
          return exportAndSwitch(game);
        case 'x':
          event.preventDefault();
          window.location.href = window.location.origin; // reset room for development
          return;
      }
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
    }
  });
  game.renderer.domElement.addEventListener('mouseup', () => {
    if (!input.mouseMoved) {
      switch (input.mousedown) {
        case 'left':
          castMainTool(game);
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
          // tool aiming
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
    input.touched = true;
    input.touchCoord = touchOffset(event.touches[0], game.renderer.domElement);
  });
  game.renderer.domElement.addEventListener('touchend', event => {
    event.preventDefault(); // prevent simulating mouse click

    if (input.touched && !input.touchmove) {
      castMainTool(game);
    }
    input.touched = false;
    input.touchmove = false;
    delete input.pitchSq;
  });
  game.renderer.domElement.addEventListener('touchmove', event => {
    event.preventDefault();
    if (!input.touched) return;

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
            adjCameraDistance((prePicthSq - pitchSq) / 8000, game.camera);
          }
          input.pitchSq = pitchSq;
        }
      }
    } else if (
      input.touchmove ||
      ((offsetX - preOffsetX) * (offsetX - preOffsetX) + (offsetY - preOffsetY) * (offsetY - preOffsetY)) > 48
    ) {
      input.touchmove = true;

      movePlayer(
        multiply(
          vecAfterCameraRotation(
            [preOffsetX - offsetX, offsetY - preOffsetY],
            game.camera
          ),
          0.01,
        ),
        game,
      );
    }
  });

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  game.renderer.domElement.addEventListener('wheel', event => {
    event.preventDefault();

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

    adjCameraDistance(distanceDelta, game.camera);
    moveCameraAngle(angleDelta, game.camera);
  });

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
    adjCameraDistance((preScale - input.gestureScale) * 20, game.camera);
  });
}

export function update(input: Input, tDiff: number, game: Game) {
  const inputVec: Vec2 = [0, 0];
  if (input.keyPressed.has('a')) {
    inputVec[0] -= tDiff;
  } else if (input.keyPressed.has('d')) {
    inputVec[0] += tDiff;
  }

  if (game.input.keyPressed.has('s')) {
    inputVec[1] -= tDiff;
  } else if (game.input.keyPressed.has('w')) {
    inputVec[1] += tDiff;
  }

  if (inputVec[0] !== 0 || inputVec[1] !== 0) {
    movePlayer(multiply(vecAfterCameraRotation(inputVec, game.camera), 0.01), game);
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
