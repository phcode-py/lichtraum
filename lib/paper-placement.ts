export type PaperBounds={x:number;y:number;width:number;height:number};
// Try the visible wall first, then nearby gaps, without moving any existing sheet.
export function findPaperSpace(occupied:PaperBounds[],view:PaperBounds,width=330,height=560,gap=32){
 const xs=[...new Set([Math.max(gap,view.x+gap),gap,...occupied.map(r=>r.x+r.width+gap)])].filter(x=>x<=10000);
 const ys=[...new Set([Math.max(gap,view.y+gap),gap,...occupied.map(r=>r.y+r.height+gap)])].filter(y=>y<=10000);
 const free=xs.flatMap(x=>ys.map(y=>({x,y}))).filter(p=>occupied.every(r=>p.x+width+gap<=r.x||p.x>=r.x+r.width+gap||p.y+height+gap<=r.y||p.y>=r.y+r.height+gap));
 const fits=(p:{x:number;y:number})=>p.x>=view.x&&p.y>=view.y&&p.x+width<=view.x+view.width&&p.y+height<=view.y+view.height;
 free.sort((a,b)=>Number(fits(b))-Number(fits(a))||Math.hypot(a.x-view.x,a.y-view.y)-Math.hypot(b.x-view.x,b.y-view.y));
 return free[0]??null;
}
