// A map follows the first fix, then only moves the dot while the visitor explores.
export function observeMapLocation(gps:Geolocation,onPosition:(coords:GeolocationCoordinates,first:boolean)=>void,onError:(error:GeolocationPositionError)=>void){
 let active=true,first=true;
 const watch=gps.watchPosition(position=>{
  if(!active)return;
  const {latitude,longitude}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return;
  onPosition(position.coords,first);first=false;
 },error=>{if(active)onError(error)},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
 return()=>{active=false;gps.clearWatch(watch)};
}
