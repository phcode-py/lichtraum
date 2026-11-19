import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {parseMapTracing,type MapTracing} from '@/lib/walk-tracing';
import {REFERENCE_BUCKET,referenceExists,validReferenceKey} from '@/lib/paper-references';
type Context={params:Promise<{id:string}>};
type Row={owner:string;author_name:string;revision:number;updated_at:string;drawing:MapTracing};
async function layers(db:Awaited<ReturnType<typeof createClient>>,rows:Row[],userId:string){
 const keys=[...new Set(rows.flatMap(row=>row.drawing.sketches.map(sketch=>sketch.key)))];
 const urls=new Map<string,string>();if(keys.length){const {data}=await db.storage.from(REFERENCE_BUCKET).createSignedUrls(keys,21600);data?.forEach(item=>{if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl)})}
 return rows.map(row=>({...row.drawing,authorId:row.owner,authorName:row.author_name,mine:row.owner===userId,revision:row.revision,updatedAt:row.updated_at,sketches:row.drawing.sketches.map(sketch=>({...sketch,url:urls.get(sketch.key)??''}))}));
}
export async function GET(_request:Request,{params}:Context){
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in required.'},{status:401});
 const {id}=await params;const {data:walk,error:readError}=await db.from('walks').select('id').eq('id',id).maybeSingle();
 if(readError)return Response.json({error:'The walk could not be loaded.'},{status:503});if(!walk)return Response.json({error:'Walk not found.'},{status:404});
 const {data,error}=await db.from('walk_map_tracings').select('owner,author_name,drawing,revision,updated_at').eq('walk_id',id).order('updated_at',{ascending:true});
 if(error)return Response.json({available:false,layers:[]},{headers:{'Cache-Control':'no-store'}});
 return Response.json({available:true,layers:await layers(db,data as Row[],user.id)},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request,{params}:Context){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in required.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid tracing.'},{status:400})}
 const drawing=parseMapTracing(body?.drawing),revision=body?.revision;
 if(!drawing||!Number.isSafeInteger(revision)||revision<0)return Response.json({error:'Keep this layer within 200 lines, 50 notes and 3 sketch images.'},{status:400});
 const {id}=await params;const {data:walk,error:readError}=await db.from('walks').select('id').eq('id',id).maybeSingle();
 if(readError)return Response.json({error:'The walk could not be loaded.'},{status:503});if(!walk)return Response.json({error:'Walk not found.'},{status:404});
 for(const sketch of drawing.sketches){if(!validReferenceKey(sketch.key,user.id)||!await referenceExists(db,sketch.key))return Response.json({error:'Upload your sketch image before saving this layer.'},{status:400})}
 const value={drawing,revision:revision+1,updated_at:new Date().toISOString()};
 const query=revision===0?db.from('walk_map_tracings').insert({...value,walk_id:id,owner:user.id,author_name:user.name}):db.from('walk_map_tracings').update(value).eq('walk_id',id).eq('owner',user.id).eq('revision',revision);
 const {data,error}=await query.select('owner,author_name,drawing,revision,updated_at').maybeSingle();
 if(error?.code==='23505'||!error&&!data)return Response.json({error:'Your layer changed in another window. Reopen the walk before saving again.'},{status:409});
 if(error)return Response.json({error:'Saving map tracings needs the one-time database setup. Your drawing is still here.'},{status:503});
 return Response.json({layer:(await layers(db,[data as Row],user.id))[0]},{headers:{'Cache-Control':'no-store'}});
}
