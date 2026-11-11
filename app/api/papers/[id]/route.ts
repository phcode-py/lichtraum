import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {validPosition} from '@/lib/papers';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to move papers.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||!validPosition(body.x,body.y))return Response.json({error:'Invalid paper position.'},{status:400});
 const {id}=await params;
 const {data,error}=await db.from('correspondence_papers').update({x:body.x,y:body.y}).eq('id',id).select('id').maybeSingle();
 if(error)return Response.json({error:'The paper’s position could not be saved. Move it again to retry.'},{status:503});
 if(!data)return Response.json({error:'Paper not found.'},{status:404});
 return Response.json({ok:true});
}
