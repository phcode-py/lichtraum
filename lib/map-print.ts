import type {LngLatBoundsLike,Map as MapLibreMap,StyleSpecification} from 'maplibre-gl';

export type SheetLayout={cols:number;rows:number;orientation:'landscape'|'portrait'};
export const SHEET_LAYOUTS:{label:string;cols:number;rows:number}[]=[
 {label:'1 sheet',cols:1,rows:1},{label:'2 sheets',cols:2,rows:1},{label:'4 sheets',cols:2,rows:2},{label:'6 sheets',cols:3,rows:2},
];

const A3={long:420,short:297};// millimetres

/** Sheet size in millimetres for the chosen orientation. */
export const sheetSize=(orientation:SheetLayout['orientation'])=>orientation==='landscape'?{w:A3.long,h:A3.short}:{w:A3.short,h:A3.long};

/** The map as it is on screen, without the weather and sun overlays. */
function printableStyle(map:MapLibreMap):StyleSpecification{
 const style=map.getStyle();
 const skip=(id:string)=>id.startsWith('rain-')||id.startsWith('sun-');
 return {...style,layers:style.layers.filter(l=>!skip(l.id)),sources:Object.fromEntries(Object.entries(style.sources).filter(([id])=>!skip(id)))};
}

/**
 * Lays the map out once over the area of all sheets together, then draws each A3 sheet
 * on its own at print resolution, with the same zoom and turn, so the sheets join seamlessly.
 * Returns one JPEG data URL per sheet, row by row.
 */
export async function renderA3Sheets(source:MapLibreMap,layout:SheetLayout,bounds?:LngLatBoundsLike){
 const M=await import('maplibre-gl');
 const sheet=sheetSize(layout.orientation),dpi=150,pixelRatio=2;
 const px=(mm:number)=>Math.round(mm/25.4*dpi/pixelRatio);// CSS pixels; the canvas has twice as many
 const sheetCss={w:px(sheet.w),h:px(sheet.h)},style=printableStyle(source),count=layout.cols*layout.rows;
 const offscreen=(w:number,h:number)=>{const el=document.createElement('div');Object.assign(el.style,{position:'fixed',left:'-100000px',top:'0',width:`${w}px`,height:`${h}px`});document.body.append(el);return el};
 const settle=(map:MapLibreMap,event:'load'|'idle')=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('The map took too long to draw. Try again.')),45000);map.once(event,()=>{clearTimeout(timer);resolve()})});

 // 1. Where everything goes: the whole printed area at screen scale.
 const plan=offscreen(sheetCss.w*layout.cols,sheetCss.h*layout.rows);
 const planner=new M.Map({container:plan,style,center:source.getCenter(),zoom:source.getZoom(),bearing:source.getBearing(),interactive:false,attributionControl:false,pixelRatio:1,fadeDuration:0});
 const views:{center:[number,number];zoom:number;bearing:number}[]=[];
 try{
  await settle(planner,'load');
  planner.fitBounds(bounds??source.getBounds(),{padding:bounds?px(25):0,animate:false,bearing:source.getBearing()});
  for(let row=0;row<layout.rows;row++)for(let col=0;col<layout.cols;col++){
   const c=planner.unproject([(col+.5)*sheetCss.w,(row+.5)*sheetCss.h]);
   views.push({center:[c.lng,c.lat],zoom:planner.getZoom(),bearing:planner.getBearing()});
  }
 }finally{planner.remove();plan.remove();}

 // 2. Each sheet at full print resolution.
 const sheets:string[]=[];
 for(const [i,view] of views.entries()){
  const holder=offscreen(sheetCss.w,sheetCss.h);
  const map=new M.Map({container:holder,style,...view,interactive:false,attributionControl:false,pixelRatio,fadeDuration:0,canvasContextAttributes:{preserveDrawingBuffer:true,antialias:true}});
  try{
   await settle(map,'idle');
   const canvas=map.getCanvas(),piece=document.createElement('canvas');piece.width=canvas.width;piece.height=canvas.height;
   const ctx=piece.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,piece.width,piece.height);ctx.drawImage(canvas,0,0);
   // A small note in the corner keeps the sheets in order when they are laid out together.
   const row=Math.floor(i/layout.cols)+1,col=i%layout.cols+1,size=Math.round(piece.height/95),pad=Math.round(piece.height/60);
   const note=`LICHTRAUM ZÜRICH · SHEET ${i+1} / ${count} · ROW ${row}, COLUMN ${col}`;
   ctx.font=`${size}px "Courier New", monospace`;const tw=ctx.measureText(note).width;
   ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(pad-6,piece.height-pad-size-8,tw+12,size+14);
   ctx.fillStyle='#2446e8';ctx.fillText(note,pad,piece.height-pad);
   sheets.push(piece.toDataURL('image/jpeg',.92));
  }finally{map.remove();holder.remove();}
 }
 return sheets;
}

/** Fills a prepared window with one A3 page per sheet and opens the print dialog there. */
export function printSheets(win:Window,sheets:string[],orientation:SheetLayout['orientation']){
 const {w,h}=sheetSize(orientation);
 win.document.open();
 win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Lichtraum map · ${sheets.length} × A3</title><style>@page{size:A3 ${orientation};margin:0}html,body{margin:0;background:#888}img{display:block;width:${w}mm;height:${h}mm;break-after:page;page-break-after:always;margin:0 auto 12px;background:#fff}@media print{body{background:none}img{margin:0}}</style></head><body>${sheets.map((src,i)=>`<img src="${src}" alt="Map sheet ${i+1}">`).join('')}</body></html>`);
 win.document.close();
 const images=[...win.document.images];
 Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r}))).then(()=>{win.focus();win.print()});
}
