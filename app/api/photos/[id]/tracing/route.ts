import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {parseTracing} from '@/lib/photo-tracing';
type Context={params:Promise<{id:string}>};
type Row={owner:string;author_name:string;strokes:unknown;revision:number;updated_at:string};
const layer=(row:Row,user:string)=>({authorId:row.owner,authorName:row.author_name,strokes:parseTracing(row.strokes)??[],mine:row.owner===user,revision:row.revision,updatedAt:row.updated_at});
export async function GET(_request:Request,{params}:Context){
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in required.'},{status:401});
 const {id}=await params;
 // The photograph's existing RLS decides whether the caller may see it.
 const {data:photo,error:photoError}=await db.from('photos').select('id,key').eq('id',id).maybeSingle();
 if(photoError)return Response.json({error:'The photograph could not be loaded.'},{status:503});
 if(!photo)return Response.json({error:'Photograph not found.'},{status:404});
 const {data,error}=await db.from('photo_tracings').select('owner,author_name,strokes,revision,updated_at').eq('photo_id',id).eq('image_key',photo.key).order('updated_at',{ascending:true});
 if(error)return Response.json({available:false,source:photo.key,layers:[]},{headers:{'Cache-Control':'no-store'}});
 return Response.json({available:true,source:photo.key,layers:(data as Row[]).map(row=>layer(row,user.id))},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request,{params}:Context){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in required.'},{status:401});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:'Invalid tracing.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid tracing.'},{status:400});
 const strokes=parseTracing(body.strokes),revision=body.revision;
 if(!strokes||!Number.isSafeInteger(revision)||Number(revision)<0)return Response.json({error:'Use up to 200 lines and 20,000 points in this tracing.'},{status:400});
 const {id}=await params;
 const {data:photo,error:photoError}=await db.from('photos').select('id,key').eq('id',id).maybeSingle();
 if(photoError)return Response.json({error:'The photograph could not be loaded.'},{status:503});
 if(!photo)return Response.json({error:'Photograph not found.'},{status:404});
 if(typeof body.source!=='string'||body.source!==photo.key)return Response.json({error:'The photograph changed. Reopen it before saving this tracing.'},{status:409});
 if(/\.(mp4|webm|mov)$/i.test(photo.key))return Response.json({error:'Tracing is available for still photographs.'},{status:400});
 const value={strokes,revision:Number(revision)+1,updated_at:new Date().toISOString()};
 // Each participant edits only their own layer, with optimistic concurrency.
 const query=revision===0?db.from('photo_tracings').insert({...value,photo_id:id,image_key:photo.key,owner:user.id,author_name:user.name}):db.from('photo_tracings').update(value).eq('photo_id',id).eq('image_key',photo.key).eq('owner',user.id).eq('revision',revision);
 const {data,error}=await query.select('owner,author_name,strokes,revision,updated_at').maybeSingle();
 if(error?.code==='23505'||(!error&&!data))return Response.json({error:'Your tracing changed in another window. Reopen the photograph before saving again.'},{status:409});
 if(error)return Response.json({error:'Saving tracings is not available yet. You can download this layer.'},{status:503});
 return Response.json({layer:layer(data as Row,user.id)},{headers:{'Cache-Control':'no-store'}});
}
