import * as THREE from 'three';
import Game from './game';

export interface Player {
  sprite: THREE.Sprite;
  state: number;
}

export function create(loader: THREE.TextureLoader, ): Player {
  const playerMaterial = new THREE.SpriteMaterial({
    map: loader.load('assets/hero.png', texture => {
      texture.repeat.set(1/6, 1/5);
      texture.offset.set(0, 1/5 * 4);
      texture.magFilter = THREE.NearestFilter;
    })
    //color: 0x44aa88
  });
  const sprite = new THREE.Sprite(playerMaterial);
  sprite.position.z = 0.5;

  return {
    sprite,
    state: 0,
  }
}

export function update(player: Player, tDiff: number, game: Game) {
  if (game.input.keyPressed.has('a')) {
    player.sprite.position.x -= 0.01 * tDiff;
    game.camera.position.x -= 0.01 * tDiff;
  } else if (game.input.keyPressed.has('d')) {
    player.sprite.position.x += 0.01 * tDiff;
    game.camera.position.x += 0.01 * tDiff;
  }

  if (game.input.keyPressed.has('w')) {
    player.sprite.position.y += 0.01 * tDiff;
    game.camera.position.y += 0.01 * tDiff;
  } else if (game.input.keyPressed.has('s')) {
    player.sprite.position.y -= 0.01 * tDiff;
    game.camera.position.y -= 0.01 * tDiff;
  }

  if (Math.sin(game.time * 0.005) > 0) {
    player.sprite.material.map.offset.x = 1/6;
  } else {
    player.sprite.material.map.offset.x = 0;
  }
}
