export class Engine {
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.game = null;
    this._last = 0;
  }
  start(){
    if(this.running) return;
    this.running = true;
    this._last = performance.now();
    const loop = (now) => {
      const dt = (now - this._last) / 1000;
      this._last = now;
      if(this.game && typeof this.game.update === 'function') this.game.update(dt);
      if(this.game && typeof this.game.render === 'function') this.game.render(this.ctx);
      if(this.running) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop(){ this.running = false }
  update(){}
  render(){}
}
