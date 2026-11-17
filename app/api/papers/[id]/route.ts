import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {toPaper,validPosition,type PaperRow} from '@/lib/papers';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to edit papers.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
 const {id}=await params;
 if(body.x!==undefined||body.y!==undefined){
  if(!validPosition(body.x,body.y)||body.title!==undefined||body.material!==undefined||body.shared!==undefined||body.category!==undefined)return Response.json({error:'Invalid paper position.'},{status:400});
  const {data,error}=await db.from('correspondence_papers').update({x:body.x,y:body.y}).eq('id',id).select('id').maybeSingle();
  if(error)return Response.json({error:'The paper’s position could not be saved. Move it again to retry.'},{status:503});
  if(!data)return Response.json({error:'Paper not found.'},{status:404});
  return Response.json({ok:true});
 }
 if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>80||!['opaque','tracing'].includes(body.material)||typeof body.shared!=='boolean')return Response.json({error:'Add a title of up to 80 characters and choose a paper type.'},{status:400});
 if(body.category!==undefined&&!['references','messages'].includes(body.category))return Response.json({error:'Choose References or Messages.'},{status:400});
 const {data:current,error:readError}=await db.from('correspondence_papers').select('*').eq('id',id).maybeSingle();
 if(readError)return Response.json({error:'The paper could not be loaded.'},{status:503});
 if(!current)return Response.json({error:'Paper not found.'},{status:404});
 if(current.owner!==user.id&&body.shared!==current.shared)return Response.json({error:'Only the owner can change sharing.'},{status:403});
 // The database function checks access and sharing again under a row lock.
 const {data,error}=await db.rpc(body.category?'edit_working_note':'edit_correspondence_paper',{paper_id:id,paper_title:body.title.trim(),paper_material:body.material,paper_shared:body.shared,...(body.category?{paper_category:body.category}:{})}).maybeSingle();
 if(error)return Response.json({error:error.code==='42501'?'You can no longer edit this paper.':'The paper could not be updated. Your changes are still here; try again.'},{status:error.code==='42501'?403:503});
 if(!data)return Response.json({error:'Paper not found.'},{status:404});
 return Response.json({paper:toPaper(data as PaperRow,user.id)});
}

// Remove the sheet from the board without destroying notes or reference files.
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to delete a paper.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Confirm the paper deletion first.'},{status:400})}
 if(body?.confirmed!==true)return Response.json({error:'Confirm the paper deletion first.'},{status:400});
 const {id}=await params;
 if(id==='room'||id==='contributors')return Response.json({error:'Built-in sheets cannot be deleted.'},{status:403});
 const {data:paper,error:readError}=await db.from('correspondence_papers').select('id,owner').eq('id',id).maybeSingle();
 if(readError)return Response.json({error:'The paper could not be loaded. Please try again.'},{status:503});
 if(!paper)return Response.json({error:'Paper not found.'},{status:404});
 if(paper.owner!==user.id)return Response.json({error:'Only the person who created this paper can delete it.'},{status:403});
 const {data,error}=await db.rpc('archive_correspondence_paper',{paper_id:id});
 if(error)return Response.json({error:['PGRST202','42883','42703'].includes(error.code)?'Paper deletion needs the one-time database setup. Your paper is unchanged.':'The paper could not be deleted. Please try again.'},{status:503});
 if(data!==true)return Response.json({error:'Paper not found or no longer yours.'},{status:404});
 return Response.json({ok:true});
}
