import Game from './game';
import { update as updatePlayer } from './player';
import { update as updateInput } from './input';
import { resize as resizeCamera } from './camera';

export default function update(game: Game, tDiff: number) {
  updatePlayer(game.player, tDiff, game);
  updateInput(game.input, tDiff, game);
}

export function resize(game: Game, width: number, height: number) {
  resizeCamera(width, height, game.camera);
  game.renderer.setSize(width, height);
}
