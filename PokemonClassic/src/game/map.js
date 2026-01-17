export class Map {
  constructor(){
    this.width = 30;
    this.height = 20;
    this.tileSize = 32;
    this.tiles = [];
  }
  async load(url){
    try{
      const res = await fetch(url);
      const data = await res.json();
      this.name = data.name || 'Mapa';
      this.width = data.width; this.height = data.height;
      this.tiles = data.tiles;
    }catch(e){
      console.warn('No se pudo cargar el mapa', e);
      // create simple default map
      this.tiles = new Array(this.height).fill(0).map(()=> new Array(this.width).fill(0));
    }
  }
  getTile(x,y){
    // if coordinates are outside defined map area or tile is undefined -> deep ocean (impassable)
    if(x < 0 || y < 0) return 3;
    if(y >= this.height || x >= this.width) return 3;
    if(!this.tiles[y] || typeof this.tiles[y][x] === 'undefined') return 3;
    return this.tiles[y][x];
  }
  isGrass(x,y){
    return this.getTile(x,y) === 1;
  }
  render(ctx){
    const ts = this.tileSize;
    // draw tiles to cover entire canvas area; undefined tiles inside canvas are deep ocean
    const cols = Math.ceil(ctx.canvas.width / ts);
    const rows = Math.ceil(ctx.canvas.height / ts);
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        const t = this.getTile(x,y);
        if(t===0){ ctx.fillStyle = '#cde6a6'; }
        else if(t===1){ ctx.fillStyle = '#7fbf58'; }
        else if(t===2){ ctx.fillStyle = '#444'; }
        else if(t===3){ ctx.fillStyle = '#003f6b'; } // deep ocean
        else { ctx.fillStyle = '#444'; }
        ctx.fillRect(x*ts, y*ts, ts, ts);
        // optional grid
        ctx.strokeStyle='rgba(0,0,0,0.05)';
        ctx.strokeRect(x*ts,y*ts,ts,ts);
      }
    }
  }
}
