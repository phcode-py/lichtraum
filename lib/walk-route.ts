import {metres,type WalkPoint} from './walks';
export type RoutePosition=[number,number];
export type WalkRouteDraft={points:RoutePosition[];picking:boolean};
/** A hand-drawn route has positions, not invented GPS capture times. */
export function parseWalkRoute(value:unknown):{path:WalkPoint[];distance:number}|null{
 if(!Array.isArray(value)||value.length>2000||value.length===1)return null;
 if(!value.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90))return null;
 const positions=value as RoutePosition[];
 return {path:positions.map(([lng,lat])=>[lng,lat,0,0]),distance:positions.reduce((sum,p,i)=>sum+(i?metres(positions[i-1],p):0),0)};
}
