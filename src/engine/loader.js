export async function loadImage(path){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = path;
  });
}

export async function preloadImages(list){
  const out = {};
  for(const item of list){
    try{
      const img = await loadImage(item.path);
      out[item.key] = img;
    }catch(e){ out[item.key] = null; }
  }
  return out;
}
