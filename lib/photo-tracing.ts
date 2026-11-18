export type TracePoint=[number,number];
export type TraceStroke={points:TracePoint[]};
export type TraceLayer={authorId:string;authorName:string;mine:boolean;revision:number;updatedAt:string;strokes:TraceStroke[]};
/** Store geometry only: no supplied SVG, HTML, URLs or executable markup. */
export function parseTracing(value:unknown):TraceStroke[]|null{
 if(!Array.isArray(value)||value.length>200)return null;
 let total=0;const result:TraceStroke[]=[];
 for(const item of value){
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const points=(item as Record<string,unknown>).points;
  if(!Array.isArray(points)||!points.length||points.length>2500||(total+=points.length)>20000)return null;
  if(!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)))return null;
  result.push({points:points.map(p=>[Number(p[0]),Number(p[1])])});
 }
 return result;
}
export function tracingPath(stroke:TraceStroke):string{
 const path=stroke.points.map(([x,y],i)=>`${i?'L':'M'}${(x*1000).toFixed(2)},${(y*1000).toFixed(2)}`).join(' ');
 return stroke.points.length===1?path+' l0.01,0':path;
}
export function tracingSVG(strokes:TraceStroke[],ratio:number):string{
 const width=1000,height=1000/Math.max(.01,Math.min(100,ratio));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="none"><g fill="none" stroke="#2446e8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${strokes.map(s=>`<path vector-effect="non-scaling-stroke" d="${tracingPath(s)}"/>`).join('')}</g></svg>`;
}
