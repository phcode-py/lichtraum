import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {emptyTags,parseTags,type PhotoTags} from '@/lib/gallery';
const validId=(id:unknown):id is string=>typeof id==='string'&&(['room','contributors'].includes(id)||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
const missing=(error:{code?:string}|null)=>!!error&&['42P01','PGRST205'].includes(error.code??'');
export async function GET(){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to view paper tags.'},{status:401});
 const {data,error}=await db.from('correspondence_paper_tags').select('sheet_id,tags').limit(1000);
 if(error&&!missing(error))return Response.json({error:'Paper tags could not be loaded.'},{status:503});
 const tags:Record<string,PhotoTags>={};for(const row of data??[])if(validId(row.sheet_id))tags[row.sheet_id]=parseTags(row.tags)??emptyTags();
 return Response.json({tags,available:!error},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to tag papers.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Choose tags from the available categories.'},{status:400})}
 const tags=parseTags(body?.tags),id=typeof body?.paperId==='string'?body.paperId.toLowerCase():body?.paperId;
 if(!validId(id)||!tags)return Response.json({error:'Choose a paper and valid tags.'},{status:400});
 if(!['room','contributors'].includes(id)){
  const {data,error}=await db.from('correspondence_papers').select('id').eq('id',id).maybeSingle();
  if(error)return Response.json({error:'This paper could not be checked.'},{status:503});
  if(!data)return Response.json({error:'Paper not found or no longer accessible.'},{status:404});
 }
 // Existing paper RLS controls access; tags live in a separate companion table.
 const {error}=await db.from('correspondence_paper_tags').upsert({sheet_id:id,tags},{onConflict:'sheet_id'});
 if(error)return Response.json({error:missing(error)?'Saving paper tags needs Philipp’s one-time database setup. Your choices are still here.':'Paper tags could not be saved. Your choices are still here.'},{status:503});
 return Response.json({tags},{headers:{'Cache-Control':'no-store'}});
}
