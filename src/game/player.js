export class Player {
  constructor(tx,ty,map){
    this.map = map;
    this.tx = tx; this.ty = ty; // tile coords
    this.x = tx; this.y = ty; // for smooth movement
    this.tileSize = map.tileSize;
    this.moving = false;
    this.moveTimer = 0;
    this.moveDuration = 0.12;
    this.dir = 'down';
    this.onEnterGrass = null;
    this.walkTimer = 0;
    this.frameIndex = 0;

    this._bindKeys();
  }
  _bindKeys(){
    window.addEventListener('keydown', (e)=>{
      if(this.moving) return;
      const key = e.key;
      let nx=this.tx, ny=this.ty, nd=null;
      if(key==='ArrowUp'){ ny--; nd='up' }
      else if(key==='ArrowDown'){ ny++; nd='down' }
      else if(key==='ArrowLeft'){ nx--; nd='left' }
      else if(key==='ArrowRight'){ nx++; nd='right' }
      if(nd){
        this.dir = nd;
        // check collision
        if(this.map.getTile(nx,ny) !== 2){
          this.startTx = this.tx; this.startTy = this.ty;
          this.tx = nx; this.ty = ny;
          this.moving = true; this.moveTimer = 0;
          this.walkTimer = 0;
          this.frameIndex = 0;
        }
      }
    });
  }
  update(dt){
    if(this.moving){
      this.moveTimer += dt;
      const t = Math.min(1, this.moveTimer/this.moveDuration);
      // interpolate
      const sx = this.startTx || this.x; const sy = this.startTy || this.y;
      this.x = sx*(1-t) + this.tx*t;
      this.y = sy*(1-t) + this.ty*t;
      if(t>=1){
        this.x = this.tx; this.y = this.ty; this.moving = false;
        // entered new tile
        if(this.map.isGrass(this.tx,this.ty) && typeof this.onEnterGrass==='function'){
          this.onEnterGrass();
        }
      }
      // walk animation timer
      this.walkTimer += dt;
      if(this.walkTimer >= 0.5){ this.walkTimer -= 0.5; this.frameIndex = (this.frameIndex+1)%2; }
    }
  }
  render(ctx){
    const ts = this.tileSize;
    const px = Math.round(this.x*ts); const py = Math.round(this.y*ts);
    // attempt to draw walking sprite from assets
    const dirMap = { up:'n', down:'s', left:'w', right:'e' };
    const dchar = dirMap[this.dir] || 's';
    const key = `walking-${dchar}-${this.frameIndex+1}`;
    const img = (window.__ASSETS__ && window.__ASSETS__[key]) ? window.__ASSETS__[key] : null;
    if(img){
      ctx.drawImage(img, px, py, ts, ts);
    } else {
      // fallback rectangle
      ctx.fillStyle = '#2b6cff';
      ctx.fillRect(px+6,py+4,ts-12,ts-8);
      ctx.fillStyle='#fff';
      if(this.dir==='up') ctx.fillRect(px+13,py+2,6,4);
      if(this.dir==='down') ctx.fillRect(px+13,py+ts-6,6,4);
      if(this.dir==='left') ctx.fillRect(px+6,py+12,4,6);
      if(this.dir==='right') ctx.fillRect(px+ts-10,py+12,4,6);
    }
  }
}
