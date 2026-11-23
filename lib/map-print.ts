import type {Map as MapLibreMap,StyleSpecification} from 'maplibre-gl';

export type Orientation='landscape'|'portrait';
/** The scales an architect would print at. */
export const PRINT_SCALES=[10,20,50,100,200,500,1000,2000,5000,10000] as const;
export type PrintScale=typeof PRINT_SCALES[number];
export const MAX_SHEETS=24;

const A3={long:420,short:297};// millimetres
const DPI=150,PIXEL_RATIO=2,EARTH=40075016.686,TILE=512;

/** Sheet size in millimetres for the chosen orientation. */
export const sheetSize=(orientation:Orientation)=>orientation==='landscape'?{w:A3.long,h:A3.short}:{w:A3.short,h:A3.long};
const cssPx=(mm:number)=>Math.round(mm/25.4*DPI/PIXEL_RATIO);// CSS pixels; the canvas has twice as many

/** Metres of ground in one CSS pixel at this zoom and latitude. */
const metresPerPixel=(zoom:number,lat:number)=>EARTH*Math.cos(lat*Math.PI/180)/(TILE*2**zoom);

/**
 * How many A3 sheets the visible map needs at a scale: the area on screen now,
 * printed so that 1 mm on paper is `scale` mm on the ground.
 */
export function sheetPlan(map:MapLibreMap,scale:PrintScale,orientation:Orientation){
 const sheet=sheetSize(orientation),lat=map.getCenter().lat,canvas=map.getContainer();
 const view={w:canvas.clientWidth*metresPerPixel(map.getZoom(),lat),h:canvas.clientHeight*metresPerPixel(map.getZoom(),lat)};
 const ground={w:sheet.w*scale/1000,h:sheet.h*scale/1000};// metres covered by one sheet
 const cols=Math.max(1,Math.ceil(view.w/ground.w-.02)),rows=Math.max(1,Math.ceil(view.h/ground.h-.02));
 return {cols,rows,count:cols*rows,ground,total:{w:ground.w*cols,h:ground.h*rows}};
}

/** The map as it is on screen, without the weather and sun overlays. */
function printableStyle(map:MapLibreMap):StyleSpecification{
 const style=map.getStyle();
 const skip=(id:string)=>id.startsWith('rain-')||id.startsWith('sun-');
 return {...style,layers:style.layers.filter(l=>!skip(l.id)),sources:Object.fromEntries(Object.entries(style.sources).filter(([id])=>!skip(id)))};
}

/**
 * Prints the visible map at a true scale. The sheets are laid out around the current centre
 * and turn, then each A3 sheet is drawn on its own at 150 dpi so they join seamlessly.
 * Returns one JPEG data URL per sheet, row by row.
 */
export async function renderA3Sheets(source:MapLibreMap,scale:PrintScale,orientation:Orientation){
 const M=await import('maplibre-gl');
 const sheet=sheetSize(orientation),plan=sheetPlan(source,scale,orientation);
 if(plan.count>MAX_SHEETS)throw new Error(`At 1:${scale} this view needs ${plan.count} sheets. Zoom in, or choose a higher number such as 1:5000.`);
 const sheetCss={w:cssPx(sheet.w),h:cssPx(sheet.h)},style=printableStyle(source),center=source.getCenter(),bearing=source.getBearing();
 // The zoom at which one CSS pixel of a sheet covers exactly the right amount of ground.
 const zoom=Math.log2(EARTH*Math.cos(center.lat*Math.PI/180)/(TILE*(sheet.w/1000*scale/sheetCss.w)));
 const offscreen=(w:number,h:number)=>{const el=document.createElement('div');Object.assign(el.style,{position:'fixed',left:'-100000px',top:'0',width:`${w}px`,height:`${h}px`});document.body.append(el);return el};
 const settle=(map:MapLibreMap,event:'load'|'idle')=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('The map took too long to draw. Try again.')),45000);map.once(event,()=>{clearTimeout(timer);resolve()})});
 const base={style,interactive:false,attributionControl:false as const,fadeDuration:0,maxZoom:24,bearing};

 // 1. Where each sheet goes: all sheets together around the current centre.
 const area=offscreen(sheetCss.w*plan.cols,sheetCss.h*plan.rows);
 const planner=new M.Map({...base,container:area,center,zoom,pixelRatio:1});
 const views:{center:[number,number]}[]=[];
 try{
  await settle(planner,'load');
  for(let row=0;row<plan.rows;row++)for(let col=0;col<plan.cols;col++){const c=planner.unproject([(col+.5)*sheetCss.w,(row+.5)*sheetCss.h]);views.push({center:[c.lng,c.lat]})}
 }finally{planner.remove();area.remove();}

 // 2. Each sheet at full print resolution.
 const sheets:string[]=[];
 for(const [i,view] of views.entries()){
  const holder=offscreen(sheetCss.w,sheetCss.h);
  const map=new M.Map({...base,container:holder,center:view.center,zoom,pixelRatio:PIXEL_RATIO,canvasContextAttributes:{preserveDrawingBuffer:true,antialias:true}});
  try{
   await settle(map,'idle');
   const canvas=map.getCanvas(),piece=document.createElement('canvas');piece.width=canvas.width;piece.height=canvas.height;
   const ctx=piece.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,piece.width,piece.height);ctx.drawImage(canvas,0,0);
   // A small note keeps the sheets in order and states the scale.
   const row=Math.floor(i/plan.cols)+1,col=i%plan.cols+1,size=Math.round(piece.height/95),pad=Math.round(piece.height/60);
   const note=`LICHTRAUM ZÜRICH · 1:${scale} ON A3 · SHEET ${i+1} / ${plan.count} · ROW ${row}, COLUMN ${col}`;
   ctx.font=`${size}px "Courier New", monospace`;const tw=ctx.measureText(note).width;
   ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(pad-6,piece.height-pad-size-8,tw+12,size+14);
   ctx.fillStyle='#2446e8';ctx.fillText(note,pad,piece.height-pad);
   sheets.push(piece.toDataURL('image/jpeg',.92));
  }finally{map.remove();holder.remove();}
 }
 return sheets;
}

/** Fills a prepared window with one A3 page per sheet and opens the print dialog there. */
export function printSheets(win:Window,sheets:string[],orientation:Orientation){
 const {w,h}=sheetSize(orientation);
 win.document.open();
 win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lichtraum map · ${sheets.length} × A3</title><style>@page{size:A3 ${orientation};margin:0}html,body{margin:0;background:#888}img{display:block;width:${w}mm;height:${h}mm;break-after:page;page-break-after:always;margin:0 auto 12px;background:#fff}@media print{body{background:none}img{margin:0}}</style></head><body>${sheets.map((src,i)=>`<img src="${src}" alt="Map sheet ${i+1}">`).join('')}</body></html>`);
 win.document.close();
 const images=[...win.document.images];
 Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r}))).then(()=>{win.focus();win.print()});
}
