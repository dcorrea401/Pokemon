import { Map } from './map.js';
import { Player } from './player.js';
import { Battle } from './battle.js';
import { preloadImages } from '../engine/loader.js';

export class Game {
  constructor(engine){
    this.engine = engine;
    this.state = { mode: 'overworld' };
    this.map = null;
    this.player = null;
    this.battle = null;
  }

  async init(){
    this.map = new Map();
    await this.map.load('data/maps/map1.json');
    this.player = new Player(2,2, this.map);
    this.player.onEnterGrass = () => this.tryEncounter();
    // configurar entrenador del jugador con hasta 3 pokémon (si existen) y un inventario de prueba
    const all = window.__POKEMON_LIST__ || [];
    this.playerTrainer = {
      name: 'Player',
      pokemon: all.slice(0,3).map(p=>({
        id: p.id,
        name: p.name,
        hp: p.hp || p.maxHp || 10,
        maxHp: p.maxHp || p.hp || 10,
        attack: p.attack || 4
      })),
      items: [
        { id: 'pokeball', name: 'Poké Ball', type: 'ball', count: 3 },
        { id: 'potion', name: 'Potion', type: 'heal', heal: 20, count: 2 }
      ]
    };

    // precargar sprites: player walking frames y pokémon images
    window.__ASSETS__ = window.__ASSETS__ || {};
    const tasks = [];
    const dirs = ['n','e','s','w'];
    for(const d of dirs){
      for(let f=1;f<=2;f++) tasks.push({ key:`walking-${d}-${f}`, path:`assets/sprites/walking-${d}-${f}.png` });
    }
    for(const p of window.__POKEMON_LIST__ || []){
      const name = String(p.name).toLowerCase();
      tasks.push({ key: `${name}-logo`, path:`assets/sprites/${name}-logo.png` });
      tasks.push({ key: `${name}-friend`, path:`assets/sprites/${name}-friend.png` });
      tasks.push({ key: `${name}-enemy`, path:`assets/sprites/${name}-enemy.png` });
    }
    const loaded = await preloadImages(tasks);
    window.__ASSETS__ = Object.assign(window.__ASSETS__, loaded);
  }

  tryEncounter(){
    if(this.state.mode !== 'overworld') return;
    // 20% chance to encounter
    if(Math.random() < 0.2){
      const wild = this._randomWild();
      this.startBattle(wild);
    }
  }

  _randomWild(){
    // pick random pokemon from data file
    const list = window.__POKEMON_LIST__ || [];
    if(list.length === 0) return null;
    const idx = Math.floor(Math.random() * list.length);
    return JSON.parse(JSON.stringify(list[idx]));
  }

  startBattle(wild){
    if(!wild) return;
    // asegurar hp/maxHp en wild
    wild.hp = wild.hp || wild.maxHp || 10;
    wild.maxHp = wild.maxHp || wild.hp;
    this.battle = new Battle(this.playerTrainer, wild);
    this.state.mode = 'battle';
    this.battle.onEnd = () => {
      this.state.mode = 'overworld';
      this.battle = null;
    };
  }

  update(dt){
    if(this.state.mode === 'overworld'){
      this.player.update(dt);
    } else if(this.battle){
      this.battle.update(dt);
    }
  }

  render(ctx){
    // clear
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    if(this.state.mode === 'overworld'){
      this.map.render(ctx);
      this.player.render(ctx);
      // update left HUD with party info
      this._renderPartyHUD();
      // update bottom HUD (empty in overworld)
      this._renderBottomHUD();
    } else if(this.battle){
      this.map.render(ctx);
      this.player.render(ctx);
      this.battle.render(ctx);
      this._renderPartyHUD();
      this._renderBottomHUD();
    }
  }

  _renderPartyHUD(){
    const el = document.getElementById('hud-left');
    if(!el) return;
    const party = (this.playerTrainer && this.playerTrainer.pokemon) || [];
    el.innerHTML = '<h3>Party</h3>';
    for(let i=0;i<Math.min(3,party.length);i++){
      const p = party[i];
      const pct = Math.max(0, Math.min(1, (p.hp||0) / (p.maxHp||1)));
      const color = pct <= 0.25 ? '#d32f2f' : (pct <= 0.5 ? '#ff9800' : '#4caf50');
      const box = document.createElement('div'); box.className='party-box';
      const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center';
      const img = document.createElement('img'); img.className='party-logo'; img.src = 'assets/sprites/'+String(p.name).toLowerCase()+'-logo.png';
      img.onerror = ()=>{ img.style.display='none'; };
      row.appendChild(img);
      const namewrap = document.createElement('div'); namewrap.innerHTML = '<div><strong>'+p.name+'</strong></div>';
      const hpWrap = document.createElement('div'); hpWrap.className='hp-bar-wrap';
      const hpBar = document.createElement('div'); hpBar.className='hp-bar'; hpBar.style.width = Math.floor(pct*100)+'%'; hpBar.style.background=color;
      hpWrap.appendChild(hpBar);
      namewrap.appendChild(hpWrap);
      row.appendChild(namewrap);
      box.appendChild(row);
      el.appendChild(box);
    }
  }

  _renderBottomHUD(){
    const el = document.getElementById('hud-bottom');
    if(!el) return;
    // During battle, menu is rendered on canvas, not in DOM
    if(this.state.mode === 'battle') { el.innerHTML = ''; return; }
    // Outside of battle, HUD bottom is empty
    el.innerHTML = '';
  }
}
