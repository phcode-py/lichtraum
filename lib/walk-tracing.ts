export type MapPoint=[number,number]; // longitude, latitude
export type MapStroke={points:MapPoint[]};
export type MapNote={id:string;point:MapPoint;text:string};
export type MapSketch={id:string;key:string;corners:[MapPoint,MapPoint,MapPoint,MapPoint];opacity:number;rotation:number};
export type MapTracing={strokes:MapStroke[];notes:MapNote[];sketches:MapSketch[]};
export type MapTracingLayer=MapTracing&{authorId:string;authorName:string;mine:boolean;revision:number;updatedAt:string;sketches:(MapSketch&{url?:string})[]};
export const emptyMapTracing=():MapTracing=>({strokes:[],notes:[],sketches:[]});
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const validMapPoint=(v:unknown):v is MapPoint=>Array.isArray(v)&&v.length===2&&v.every(n=>typeof n==='number'&&Number.isFinite(n))&&Math.abs(v[0])<=180&&Math.abs(v[1])<=85;
/** Whitelisted geometry/text only. No HTML, SVG, URLs or encoded image data in storage. */
export function parseMapTracing(value:unknown,allowLocalPreview=false):MapTracing|null{
 if(!object(value)||!Array.isArray(value.strokes)||value.strokes.length>200||!Array.isArray(value.notes)||value.notes.length>50||!Array.isArray(value.sketches)||value.sketches.length>3)return null;
 let total=0;const result=emptyMapTracing(),ids=new Set<string>();
 for(const stroke of value.strokes){if(!object(stroke)||!Array.isArray(stroke.points)||!stroke.points.length||stroke.points.length>2500||(total+=stroke.points.length)>20000||!stroke.points.every(validMapPoint))return null;result.strokes.push({points:stroke.points.map(p=>[p[0],p[1]])});}
 const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v)&&!ids.has(v);
 for(const note of value.notes){if(!object(note)||!id(note.id)||!validMapPoint(note.point)||typeof note.text!=='string'||!note.text.trim()||note.text.length>600)return null;ids.add(note.id);result.notes.push({id:note.id,point:[...note.point],text:note.text.trim()});}
 for(const sketch of value.sketches){if(!object(sketch)||!id(sketch.id)||typeof sketch.key!=='string'||!(/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(sketch.key)||allowLocalPreview&&/^preview\/[0-9a-f-]{36}$/.test(sketch.key))||!Array.isArray(sketch.corners)||sketch.corners.length!==4||!sketch.corners.every(validMapPoint)||typeof sketch.opacity!=='number'||!Number.isFinite(sketch.opacity)||sketch.opacity<.05||sketch.opacity>1||typeof sketch.rotation!=='number'||!Number.isFinite(sketch.rotation)||Math.abs(sketch.rotation)>180)return null;ids.add(sketch.id);result.sketches.push({id:sketch.id,key:sketch.key,corners:sketch.corners.map(p=>[p[0],p[1]]) as MapSketch['corners'],opacity:sketch.opacity,rotation:sketch.rotation});}
 return result;
}
