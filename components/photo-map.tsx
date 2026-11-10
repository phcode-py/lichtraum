'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map,Marker,StyleSpecification,GeoJSONSource,LngLatBoundsLike} from 'maplibre-gl';
import {LocateFixed,Plus} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
type Photo={id:string;title:string;place:string;lat:number;lng:number;url:string;caption:string;createdAt:number;source?:string};
export const mapStyle:StyleSpecification={version:8,sources:{city:{type:'vector',url:'https://tiles.openfreemap.org/planet'}},layers:[
 {id:'paper',type:'background',paint:{'background-color':'#fff'}},
 {id:'water',type:'fill',source:'city','source-layer':'water',paint:{'fill-color':'#000','fill-antialias':false}},
 {id:'waterways',type:'line',source:'city','source-layer':'waterway',paint:{'line-color':'#000','line-width':['interpolate',['linear'],['zoom'],11,1,17,5]}},
 {id:'building-fill',type:'fill',source:'city','source-layer':'building',minzoom:14,paint:{'fill-color':'#000','fill-antialias':false}},
 {id:'blocks',type:'line',source:'city','source-layer':'building',minzoom:16,paint:{'line-color':'#000','line-width':.5}},
 {id:'streets',type:'line',source:'city','source-layer':'transportation',filter:['!',['in',['get','class'],['literal',['rail','transit','ferry']]]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#000','line-width':['interpolate',['linear'],['zoom'],10,.25,14,.65,17,1.3]}},
 {id:'main-roads',type:'line',source:'city','source-layer':'transportation',filter:['in',['get','class'],['literal',['motorway','trunk','primary','secondary']]],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#000','line-width':['interpolate',['linear'],['zoom'],10,.7,14,1.3,17,2.5]}},
 {id:'bridges',type:'line',source:'city','source-layer':'transportation',filter:['==',['get','brunnel'],'bridge'],paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],12,1.5,17,5]}},
]};
export type MapRoute={id:string;lines:[number,number][][];active:boolean};
export default function PhotoMap({photos,selected,onSelect,picking,point,onPoint,reset,routes=[]}:{photos:Photo[];selected:string|null;onSelect:(p:Photo)=>void;picking:boolean;point:{lat:number;lng:number}|null;onPoint:(p:{lat:number;lng:number})=>void;reset:number;routes?:MapRoute[]}){
 const element=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),lib=useRef<typeof import('maplibre-gl')|null>(null),markers=useRef<Marker[]>([]),labels=useRef<Marker[]>([]),pick=useRef(picking),choose=useRef(onPoint),select=useRef(onSelect);const[ready,setReady]=useState(0),[mapError,setMapError]=useState(false);
 pick.current=picking;choose.current=onPoint;select.current=onSelect;
 useEffect(()=>{let cancelled=false;let observer:ResizeObserver|undefined;import('maplibre-gl').then(M=>{if(cancelled||!element.current)return;lib.current=M;const m=new M.Map({container:element.current,style:mapStyle,center:[8.5399,47.3709],zoom:14.7,minZoom:10,maxZoom:18,maxBounds:[[8.32,47.24],[8.78,47.52]],pitchWithRotate:false,dragRotate:false,touchZoomRotate:true,attributionControl:{compact:true},canvasContextAttributes:{antialias:false}});map.current=m;const districts=[['CITY',47.3730,8.5347],['ALTSTADT',47.3717,8.5439],['ENGE',47.3618,8.5284],['SEEFELD',47.3606,8.5515],['HOCHSCHULEN',47.376,8.55],['LANGSTRASSE',47.3788,8.5260]] as const;districts.forEach(([name,lat,lng])=>{const label=document.createElement('span');label.className='district-label';label.textContent=name;labels.current.push(new M.Marker({element:label}).setLngLat([lng,lat]).addTo(m));});m.touchZoomRotate.disableRotation();m.on('load',()=>{if(!cancelled){setReady(n=>n+1);setMapError(false)}});m.on('error',()=>setMapError(true));m.on('idle',()=>{if(m.areTilesLoaded())setMapError(false)});m.on('click',e=>{if(pick.current)choose.current({lat:e.lngLat.lat,lng:e.lngLat.lng})});observer=new ResizeObserver(()=>{m.resize();});observer.observe(element.current);}).catch(()=>setMapError(true));return()=>{cancelled=true;observer?.disconnect();markers.current.forEach(m=>m.remove());labels.current.forEach(m=>m.remove());labels.current=[];map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{if(!ready||!lib.current||!map.current)return;markers.current.forEach(m=>m.remove());markers.current=[];const M=lib.current;photos.forEach(p=>{const node=document.createElement('button');node.className='photo-marker '+(p.id===selected?'active':'');node.setAttribute('aria-label',p.title+' at '+p.place);node.dataset.cursor='view';const img=document.createElement('img');img.src=p.url;img.alt='';node.appendChild(img);node.addEventListener('click',e=>{e.stopPropagation();select.current(p)});const marker=new M.Marker({element:node,anchor:'bottom',offset:[0,-10]}).setLngLat([p.lng,p.lat]).addTo(map.current!);markers.current.push(marker);});if(point){const node=document.createElement('span');node.className='chosen-point';node.setAttribute('aria-label','Selected photo location');markers.current.push(new M.Marker({element:node}).setLngLat([point.lng,point.lat]).addTo(map.current));}},[ready,photos,selected,point]);
 useEffect(()=>{const p=photos.find(p=>p.id===selected);if(p)map.current?.flyTo({center:[p.lng,p.lat],zoom:16,duration:700,essential:false})},[selected]);
 // Walk routes: the active walk in blue, others as quiet grey lines.
 const activeRoute=routes.find(r=>r.active)?.id??'';
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  const data={type:'FeatureCollection' as const,features:routes.filter(r=>r.lines.length).map(r=>({type:'Feature' as const,properties:{active:r.active},geometry:{type:'MultiLineString' as const,coordinates:r.lines}}))};
  const source=m.getSource('walk-routes') as GeoJSONSource|undefined;
  if(source)source.setData(data);
  else{m.addSource('walk-routes',{type:'geojson',data});
   m.addLayer({id:'walk-routes-casing',type:'line',source:'walk-routes',filter:['get','active'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':8}});
   m.addLayer({id:'walk-routes-line',type:'line',source:'walk-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['get','active'],'#2446e8','#8f8f88'],'line-width':['case',['get','active'],3.5,1.5],'line-opacity':['case',['get','active'],1,.7]}});}
 },[ready,routes]);
 useEffect(()=>{const m=map.current,r=routes.find(r=>r.active);if(!ready||!m||!r)return;const pts=r.lines.flat();if(!pts.length)return;
  const lng=pts.map(p=>p[0]),lat=pts.map(p=>p[1]);
  m.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]] as LngLatBoundsLike,{padding:{top:90,right:70,bottom:110,left:70},maxZoom:16.5,duration:650});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,activeRoute]);
 useEffect(()=>{if(reset)map.current?.flyTo({center:[8.5399,47.3709],zoom:14.7,duration:700})},[reset]);

 return <><div className={'map-canvas '+(picking?'picking':'')} data-cursor={picking?'pin':'drag'} ref={element} aria-label="Interactive map of Zürich"/><div className="map-tools"><button aria-label="Zoom in" onClick={()=>map.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>map.current?.zoomOut()}><span className="minus">−</span></button><span/><button aria-label="Recenter on Zürich" onClick={()=>map.current?.flyTo({center:[8.5399,47.3709],zoom:14.7})}><LocateFixed size={19}/></button></div>{mapError&&<div className="map-error">Map unavailable. Check your connection and reload.</div>}</>;
}
