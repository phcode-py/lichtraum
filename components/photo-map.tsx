'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Map,Marker,StyleSpecification,GeoJSONSource,LngLatBoundsLike} from 'maplibre-gl';
import {ArrowUp,CircleDot,Cloud,Sun} from 'lucide-react';
import type {RainRadar} from './rain-tool';
import MapPrintButton from './map-print-button';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {WalkRouteDraft} from '@/lib/walk-route';
import WalkMapTracing from './walk-map-tracing';
import {observeMapLocation} from '@/lib/map-location';
import {daySunPath,solarPosition,zurichDate,ZURICH} from '@/lib/sun';
type Photo={mediaType?:'photo'|'video';id:string;title:string;place:string;lat:number;lng:number;url:string;caption:string;createdAt:number;source?:string};
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
/** The sun drawn as a shape, so phones never swap in their colour emoji. */
const SUN_GLYPH='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.85 1.85M17.35 17.35l1.85 1.85M4.8 19.2l1.85-1.85M17.35 6.65l1.85-1.85"/></g></svg>';
export type MapRoute={id:string;lines:[number,number][][];active:boolean};
export default function PhotoMap({tracingWalkId=null,tracingVisible=false,onTracingHide,routeDraft=null,onRoutePoint,onRouteMove,onRouteRemove,photos,selected,onSelect,picking,point,onPoint,reset,routes=[],sunTime=null,sunOpen=false,onSunToggle,onCurrentLocation,sunPoint=ZURICH,onSunPoint,sunPicking=false,rainOpen=false,onRainToggle,rainRadar=null,rainFrame=0}:{rainOpen?:boolean;onRainToggle?:()=>void;rainRadar?:RainRadar|null;rainFrame?:number;tracingWalkId?:string|null;tracingVisible?:boolean;onTracingHide?:()=>void;routeDraft?:WalkRouteDraft|null;onRoutePoint?:(p:{lat:number;lng:number})=>void;onRouteMove?:(index:number,p:{lat:number;lng:number})=>void;onRouteRemove?:(index:number)=>void;sunPoint?:{lat:number;lng:number};onSunPoint?:(p:{lat:number;lng:number})=>void;sunPicking?:boolean;sunTime?:number|null;sunOpen?:boolean;onSunToggle:()=>void;onCurrentLocation?:(p:{lat:number;lng:number})=>void;photos:Photo[];selected:string|null;onSelect:(p:Photo)=>void;picking:boolean;point:{lat:number;lng:number}|null;onPoint:(p:{lat:number;lng:number})=>void;reset:number;routes?:MapRoute[]}){
 const element=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),lib=useRef<typeof import('maplibre-gl')|null>(null),markers=useRef<Marker[]>([]),labels=useRef<Marker[]>([]),pick=useRef(picking),choose=useRef(onPoint),select=useRef(onSelect);const[ready,setReady]=useState(0),[mapError,setMapError]=useState(false),[bearing,setBearing]=useState(0);
 const getMap=useCallback(()=>map.current,[]);
 const routeFocus=useRef<number|null>(null);
 const drawing=useRef(routeDraft),routeChoose=useRef(onRoutePoint);
 useEffect(()=>{drawing.current=routeDraft;routeChoose.current=onRoutePoint},[routeDraft,onRoutePoint]);
 const locationMarker=useRef<Marker|null>(null),location=useRef<[number,number]|null>(null);
 const[locationError,setLocationError]=useState('');
 const reportLocation=useRef(onCurrentLocation);
 useEffect(()=>{reportLocation.current=onCurrentLocation},[onCurrentLocation]);
 const showLocation=useCallback((coords:GeolocationCoordinates,center:boolean)=>{
  const m=map.current,M=lib.current;if(!m||!M)return;
  const position:[number,number]=[coords.longitude,coords.latitude];location.current=position;
  reportLocation.current?.({lat:coords.latitude,lng:coords.longitude});
  if(!locationMarker.current){const dot=document.createElement('span');dot.className='current-location-dot';dot.setAttribute('role','img');dot.setAttribute('aria-label','Your current location');locationMarker.current=new M.Marker({element:dot}).setLngLat(position).addTo(m)}
  else locationMarker.current.setLngLat(position);
  setLocationError('');if(center)m.flyTo({center:position,zoom:16,duration:800,essential:false});
 },[]);
 useEffect(()=>{
  if(!ready)return;
  if(!navigator.geolocation){setLocationError('Location is unavailable in this browser.');return;}
  const stop=observeMapLocation(navigator.geolocation,showLocation,error=>setLocationError(error.code===1?'Allow location access to see where you are.':'Your location could not be found. Try again.'));
  return()=>{stop();locationMarker.current?.remove();locationMarker.current=null};
 },[ready,showLocation]);
 function recenterLocation(){
  if(location.current)map.current?.flyTo({center:location.current,zoom:16,duration:700,essential:false});
  if(!navigator.geolocation){setLocationError('Location is unavailable in this browser.');return;}
  navigator.geolocation.getCurrentPosition(p=>showLocation(p.coords,true),error=>setLocationError(error.code===1?'Allow location access to see where you are.':'Your location could not be found. Try again.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 }
 const sunPick=useRef(sunPicking),sunChoose=useRef(onSunPoint),restoreOriginFocus=useRef(false);
 useEffect(()=>{sunPick.current=sunPicking;sunChoose.current=onSunPoint;pick.current=picking;choose.current=onPoint;select.current=onSelect;},[sunPicking,onSunPoint,picking,onPoint,onSelect]);
 useEffect(()=>{let cancelled=false;let observer:ResizeObserver|undefined;import('maplibre-gl').then(M=>{if(cancelled||!element.current)return;lib.current=M;const m=new M.Map({container:element.current,style:mapStyle,center:[8.5399,47.3709],zoom:14.7,minZoom:2,maxZoom:18,pitchWithRotate:false,rollEnabled:false,minPitch:0,maxPitch:0,dragRotate:true,touchZoomRotate:true,touchPitch:false,attributionControl:{compact:true},canvasContextAttributes:{antialias:false}});map.current=m;const districts=[['CITY',47.3730,8.5347],['ALTSTADT',47.3717,8.5439],['ENGE',47.3618,8.5284],['SEEFELD',47.3606,8.5515],['HOCHSCHULEN',47.376,8.55],['LANGSTRASSE',47.3788,8.5260]] as const;districts.forEach(([name,lat,lng])=>{const label=document.createElement('span');label.className='district-label';label.textContent=name;labels.current.push(new M.Marker({element:label}).setLngLat([lng,lat]).addTo(m));});m.on('rotate',()=>setBearing(m.getBearing()));m.on('load',()=>{if(!cancelled){setReady(n=>n+1);setMapError(false);}});m.on('error',()=>setMapError(true));m.on('idle',()=>{if(m.areTilesLoaded())setMapError(false)});m.on('click',e=>{if(drawing.current?.picking)routeChoose.current?.({lat:e.lngLat.lat,lng:e.lngLat.lng});else if(pick.current)choose.current({lat:e.lngLat.lat,lng:e.lngLat.lng});else if(sunPick.current)sunChoose.current?.({lat:e.lngLat.lat,lng:e.lngLat.lng})});observer=new ResizeObserver(()=>{m.resize();});observer.observe(element.current);}).catch(()=>setMapError(true));return()=>{cancelled=true;observer?.disconnect();markers.current.forEach(m=>m.remove());labels.current.forEach(m=>m.remove());labels.current=[];map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{if(!ready||!lib.current||!map.current)return;markers.current.forEach(m=>m.remove());markers.current=[];const M=lib.current;photos.forEach(p=>{const node=document.createElement('button');node.className='photo-marker '+(p.id===selected?'active':'');node.setAttribute('aria-label',p.title+' at '+p.place);node.dataset.cursor='view';if(p.mediaType==='video'){const icon=document.createElement('span');icon.className='video-map-icon';icon.textContent='▶';icon.setAttribute('aria-hidden','true');node.appendChild(icon);}else{const img=document.createElement('img');img.src=p.url;img.alt='';node.appendChild(img);}node.addEventListener('click',e=>{e.stopPropagation();select.current(p)});const marker=new M.Marker({element:node,anchor:'bottom',offset:[0,-10]}).setLngLat([p.lng,p.lat]).addTo(map.current!);markers.current.push(marker);});if(point){const node=document.createElement('span');node.className='chosen-point';node.setAttribute('aria-label','Selected photo location');markers.current.push(new M.Marker({element:node}).setLngLat([point.lng,point.lat]).addTo(map.current));}},[ready,photos,selected,point]);
 useEffect(()=>{const p=photos.find(p=>p.id===selected);if(p)map.current?.flyTo({center:[p.lng,p.lat],zoom:16,duration:700,essential:false})},[selected,photos]);
 // Walk routes: the active walk in royal blue, others in light blue.
 const activeRoute=routes.find(r=>r.active)?.id??'';
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  const data={type:'FeatureCollection' as const,features:routes.filter(r=>r.lines.length).map(r=>({type:'Feature' as const,properties:{active:r.active},geometry:{type:'MultiLineString' as const,coordinates:r.lines}}))};
  const source=m.getSource('walk-routes') as GeoJSONSource|undefined;
  if(source)source.setData(data);
  else{m.addSource('walk-routes',{type:'geojson',data});
   m.addLayer({id:'walk-routes-casing',type:'line',source:'walk-routes',filter:['get','active'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':8}});
   m.addLayer({id:'walk-routes-line',type:'line',source:'walk-routes',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['case',['get','active'],'#2446e8','#91b6ff'],'line-width':['case',['get','active'],3.5,2],'line-opacity':1}});}
  m.setPaintProperty('walk-routes-line','line-color',['case',['get','active'],'#2446e8','#91b6ff']);
  m.setPaintProperty('walk-routes-line','line-width',['case',['get','active'],3.5,2]);
  m.setPaintProperty('walk-routes-line','line-opacity',1);
 },[ready,routes]);
 useEffect(()=>{const m=map.current,r=routes.find(r=>r.active);if(!ready||!m||!r)return;const pts=r.lines.flat();if(!pts.length)return;
  const lng=pts.map(p=>p[0]),lat=pts.map(p=>p[1]);
  m.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]] as LngLatBoundsLike,{padding:{top:90,right:70,bottom:110,left:70},maxZoom:16.5,duration:650});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,activeRoute]);
 // A local draft is independent of saved routes until the walk is saved.
 useEffect(()=>{const m=map.current,M=lib.current;if(!ready||!m||!M)return;
  const points=routeDraft?.points??[];
  const data={type:'FeatureCollection' as const,features:points.length>1?[{type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:points}}]:[]};
  const source=m.getSource('walk-draft') as GeoJSONSource|undefined;
  if(source)source.setData(data);else{m.addSource('walk-draft',{type:'geojson',data});m.addLayer({id:'walk-draft-casing',type:'line',source:'walk-draft',paint:{'line-color':'#fff','line-width':7}});m.addLayer({id:'walk-draft-line',type:'line',source:'walk-draft',paint:{'line-color':'#2446e8','line-width':3}})}
  const draftMarkers=points.map((point,index)=>{
   const node=document.createElement('button');node.className='walk-draft-point';node.textContent=String(index+1);node.type='button';
   node.setAttribute('aria-label',routeDraft?.picking?`Route point ${index+1}. Drag to move, arrow keys to adjust, Delete to remove.`:`Route point ${index+1}`);
   node.addEventListener('click',e=>e.stopPropagation());
   const marker=new M.Marker({element:node,draggable:!!routeDraft?.picking}).setLngLat(point).addTo(m);
   marker.on('dragend',()=>onRouteMove?.(index,marker.getLngLat()));
   node.addEventListener('keydown',e=>{if(!routeDraft?.picking)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();onRouteRemove?.(index);return;}const moves:Record<string,[number,number]>={ArrowUp:[0,.0001],ArrowDown:[0,-.0001],ArrowLeft:[-.00015,0],ArrowRight:[.00015,0]};const move=moves[e.key];if(move){e.preventDefault();e.stopPropagation();onRouteMove?.(index,{lng:point[0]+move[0],lat:point[1]+move[1]})}});
   return marker;
  });
  if(routeFocus.current!==null&&draftMarkers.length){draftMarkers[Math.min(routeFocus.current,draftMarkers.length-1)].getElement().focus({preventScroll:true});routeFocus.current=null;}
  return()=>{const focused=draftMarkers.findIndex(marker=>marker.getElement()===document.activeElement);if(focused>=0)routeFocus.current=focused;draftMarkers.forEach(marker=>marker.remove())};
 },[ready,routeDraft,onRouteMove,onRouteRemove]);

 useEffect(()=>{if(reset)map.current?.flyTo({center:[8.5399,47.3709],zoom:14.7,duration:700})},[reset]);

 // Keep the study point in the uncovered part of the map, including on phones.
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  if(!sunOpen){m.setPadding({top:0,right:0,bottom:0,left:0});return;}
  const positionStudy=()=>{const mobile=window.matchMedia('(max-width:720px)').matches;
   m.easeTo({center:[sunPoint.lng,sunPoint.lat],padding:mobile?{top:0,right:0,bottom:m.getContainer().clientHeight*.56,left:0}:{top:0,right:Math.min(420,m.getContainer().clientWidth*.55),bottom:0,left:0},duration:450});};
  positionStudy();const observer=new ResizeObserver(positionStudy);observer.observe(m.getContainer());return()=>observer.disconnect();
 },[ready,sunOpen,sunPoint]);


 useEffect(()=>{const m=map.current,M=lib.current;if(!ready||!m||!M)return;
  const source=m.getSource('sun-study') as GeoJSONSource|undefined;
  if(sunTime===null){source?.setData({type:'FeatureCollection',features:[]});return}
  const sun=solarPosition(sunTime,sunPoint.lat,sunPoint.lng);
  const day=daySunPath(zurichDate(sunTime),sunPoint.lat,sunPoint.lng).filter(p=>p.elevation>=-.833);
  const node=document.createElement('span');node.className='sun-map-marker'+(sun.elevation<0?' below-horizon':'');node.innerHTML=SUN_GLYPH;node.setAttribute('aria-label','Sun direction');const marker=new M.Marker({element:node}).setLngLat([sunPoint.lng,sunPoint.lat]).addTo(m);
  // This is a direction diagram, so keep its radius in screen pixels. Zooming
  // reduces the ground distance it spans; rotation still respects true north.
  const drawGuide=()=>{
   const center=m.project([sunPoint.lng,sunPoint.lat]),padding=m.getPadding();
   const width=m.getContainer().clientWidth,height=m.getContainer().clientHeight;
   // Size depends only on the viewport, never the pin’s distance from an edge.
   // Panning may move part of the diagram offscreen, but must not collapse it.
   const radius=1.2*Math.max(24,Math.min(170,(width-(padding.left??0)-(padding.right??0))/2-28,(height-(padding.top??0)-(padding.bottom??0))/2-28));
   const guidePoint=(azimuth:number):[number,number]=>{const angle=(azimuth-m.getBearing())*Math.PI/180;const p=m.unproject([center.x+Math.sin(angle)*radius,center.y-Math.cos(angle)*radius]);return [p.lng,p.lat];};
   const arc=day.map(p=>guidePoint(p.azimuth)),tip=guidePoint(sun.azimuth);
   const data={type:'FeatureCollection' as const,features:[...(arc.length>1?[{type:'Feature' as const,properties:{kind:'arc'},geometry:{type:'LineString' as const,coordinates:arc}}]:[]),{type:'Feature' as const,properties:{kind:'ray'},geometry:{type:'LineString' as const,coordinates:[[sunPoint.lng,sunPoint.lat],tip]}}]};
   const current=m.getSource('sun-study') as GeoJSONSource|undefined;
   if(current)current.setData(data);else{m.addSource('sun-study',{type:'geojson',data});m.addLayer({id:'sun-study-casing',type:'line',source:'sun-study',paint:{'line-color':'#fff','line-width':6,'line-opacity':.85}});m.addLayer({id:'sun-day-arc',type:'line',source:'sun-study',filter:['==',['get','kind'],'arc'],paint:{'line-color':'#2446e8','line-width':2,'line-dasharray':[2,3]}});m.addLayer({id:'sun-now-ray',type:'line',source:'sun-study',filter:['==',['get','kind'],'ray'],paint:{'line-color':'#2446e8','line-width':2.5,'line-dasharray':[5,2]}})}
   marker.setLngLat(tip);
  };
  drawGuide();m.on('move',drawGuide);m.on('resize',drawGuide);
  const origin=document.createElement('button');origin.className='sun-map-origin';origin.setAttribute('aria-label','Sun study location. Drag to move, or use arrow keys.');origin.title='Drag to study another place';const originMarker=new M.Marker({element:origin,draggable:true}).setLngLat([sunPoint.lng,sunPoint.lat]).addTo(m);
  originMarker.on('dragend',()=>{const p=originMarker.getLngLat();sunChoose.current?.({lat:p.lat,lng:p.lng})});
  origin.addEventListener('keydown',e=>{const moves:Record<string,[number,number]>={ArrowUp:[.0001,0],ArrowDown:[-.0001,0],ArrowLeft:[0,-.00015],ArrowRight:[0,.00015]};const move=moves[e.key];if(!move)return;e.preventDefault();sunChoose.current?.({lat:sunPoint.lat+move[0],lng:sunPoint.lng+move[1]})});
  if(restoreOriginFocus.current){origin.focus({preventScroll:true});restoreOriginFocus.current=false;}
  return()=>{restoreOriginFocus.current=document.activeElement===origin;m.off('move',drawGuide);m.off('resize',drawGuide);marker.remove();originMarker.remove()};
 },[ready,sunTime,sunPoint]);

 // Rain radar: every frame is loaded once as its own image layer, and only the current one is visible.
 const rainLayers=useRef<string[]>([]),rainView=useRef<{center:[number,number];zoom:number}|null>(null);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  const ids=rainRadar?rainRadar.frames.map(f=>'rain-'+f.time):[];
  const before=m.getLayer('walk-routes-casing')?'walk-routes-casing':m.getLayer('walk-routes')?'walk-routes':undefined;
  rainLayers.current.filter(id=>!ids.includes(id)).forEach(id=>{if(m.getLayer(id))m.removeLayer(id);if(m.getSource(id))m.removeSource(id)});
  rainRadar?.frames.forEach(f=>{const id='rain-'+f.time;if(m.getSource(id))return;m.addSource(id,{type:'image',url:f.url,coordinates:rainRadar.corners});m.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':0,'raster-fade-duration':0,'raster-resampling':'linear'}},before)});
  rainLayers.current=ids;
 },[ready,rainRadar]);
 useEffect(()=>{const m=map.current;if(!ready||!m)return;rainLayers.current.forEach((id,i)=>{if(m.getLayer(id))m.setPaintProperty(id,'raster-opacity',i===Math.min(rainFrame,rainLayers.current.length-1)?.85:0)})},[ready,rainRadar,rainFrame]);
 // Opening the rain view steps back to see the weather around Zürich; closing returns to the earlier view.
 useEffect(()=>{const m=map.current;if(!ready||!m)return;
  if(rainOpen){if(!rainView.current){const c=m.getCenter();rainView.current={center:[c.lng,c.lat],zoom:m.getZoom()}}m.easeTo({center:[8.35,47.05],zoom:Math.min(m.getZoom(),7.4),bearing:0,duration:700,essential:false});return}
  if(rainView.current){m.easeTo({...rainView.current,duration:700,essential:false});rainView.current=null}
 },[ready,rainOpen]);
 return <><div className={'map-canvas '+(picking||sunPicking||routeDraft?.picking?'picking':'')} data-cursor={picking||sunPicking?'pin':'drag'} ref={element} aria-label="Interactive map"/>{!!ready&&map.current&&<WalkMapTracing map={map.current} walkId={tracingWalkId} visible={tracingVisible} onHide={()=>onTracingHide?.()}/>} <div className="map-tools" role="group" aria-label="Map controls"><button aria-label="Zoom in" title="Zoom in" onClick={()=>map.current?.zoomIn()}><span aria-hidden="true">+</span></button><button aria-label="Zoom out" title="Zoom out" onClick={()=>map.current?.zoomOut()}><span aria-hidden="true">−</span></button><button aria-label="Point map north" title="North" onClick={()=>map.current?.easeTo({bearing:0,pitch:0})}><ArrowUp aria-hidden="true" style={{transform:`rotate(${-bearing}deg)`}}/></button><button aria-label="Show my location" title="Show my location" onClick={recenterLocation}><CircleDot aria-hidden="true"/></button><button aria-label="Sun position" title="Sun position through the day" aria-expanded={sunOpen} onClick={onSunToggle}><Sun aria-hidden="true"/></button><button aria-label="Rain radar and forecast" title="Rain radar and MeteoSwiss forecast" aria-expanded={rainOpen} onClick={onRainToggle}><Cloud aria-hidden="true"/></button><MapPrintButton getMap={getMap}/></div>{locationError&&<div className="map-location-status" role="status">{locationError}<button onClick={recenterLocation}>try again</button></div>}{mapError&&<div className="map-error">Map unavailable. Check your connection and reload.</div>}</>;
}
