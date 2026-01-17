import { Engine } from './engine/engine.js';
import { Game } from './game/game.js';

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('game-container');
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  // size canvas to fill its container
  function resizeCanvas(){
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width));
    canvas.height = Math.max(240, Math.floor(rect.height));
    if(engine && engine._last) engine._last = performance.now();
  }

  const engine = new Engine(canvas);
  // initial resize and adjust on window resize
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const game = new Game(engine);
  engine.game = game;
  // cargar lista de pokémon para encuentros
  try{
    const res = await fetch('data/pokemon/pokemon.json');
    window.__POKEMON_LIST__ = await res.json();
  }catch(e){ window.__POKEMON_LIST__ = []; }
  await game.init();
  engine.start();
  console.log('Pokémon Classic — overworld y combate listo');
});
