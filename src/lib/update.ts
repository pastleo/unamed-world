import Game from './game';
import { update as updatePlayer } from './player';
import { update as updateInput } from './input';

export default function update(game: Game, tDiff: number) {
  updatePlayer(game.player, tDiff, game);
  updateInput(game.input);
}

export function resize(game: Game, width: number, height: number) {
  game.camera.aspect = width / height;
  game.camera.updateProjectionMatrix();
  game.renderer.setSize(width, height);
}
