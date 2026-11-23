import {metres,type Walk} from './walks';
import {newestPhotoFirst} from './gallery';
type Moment={id:string;lat:number;lng:number;createdAt:number;conditions?:{capturedAt:number}|null};
/** Keep route distances, but show the most recently captured picture first. */
export function sequenceWalkPhotos<T extends Moment>(walk:Pick<Walk,'path'>,photos:T[]):{photo:T;distance:number|null}[]{
 const legs:{a:[number,number];b:[number,number];length:number;start:number}[]=[];let travelled=0;
 for(let i=1;i<walk.path.length;i++){
  const a=walk.path[i-1],b=walk.path[i];if(a[3]!==b[3])continue;
  const length=metres([a[0],a[1]],[b[0],b[1]]);if(!length)continue;
  legs.push({a:[a[0],a[1]],b:[b[0],b[1]],length,start:travelled});travelled+=length;
 }
 return photos.map(photo=>{
  let nearest=Infinity,distance:number|null=null;
  for(const leg of legs){
   const scale=Math.cos((leg.a[1]+leg.b[1])*Math.PI/360),dx=(leg.b[0]-leg.a[0])*scale,dy=leg.b[1]-leg.a[1];
   const px=(photo.lng-leg.a[0])*scale,py=photo.lat-leg.a[1];
   const fraction=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));
   const squared=(px-dx*fraction)**2+(py-dy*fraction)**2;
   if(squared<nearest){nearest=squared;distance=leg.start+leg.length*fraction;}
  }
  return {photo,distance};
 }).sort((a,b)=>newestPhotoFirst(a.photo,b.photo));
}
