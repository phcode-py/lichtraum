import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
const entry=(m:{id:string;owner:string;author_name:string;content:string;created_at:string},user:string)=>({id:m.id,author:m.author_name,content:m.content,createdAt:Date.parse(m.created_at),mine:m.owner===user});
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to read entries.'},{status:401});
 const {id}=await params;
 const {data:paper,error:paperError}=await db.from('correspondence_papers').select('id').eq('id',id).maybeSingle();
 if(paperError)return Response.json({error:'Entries could not be loaded.'},{status:503});
 if(!paper)return Response.json({error:'Paper not found.'},{status:404});
 const {data,error}=await db.from('correspondence_entries').select('*').eq('paper_id',id).order('created_at',{ascending:false}).limit(100);
 if(error)return Response.json({error:'Entries could not be loaded.'},{status:503});
 return Response.json({messages:data.reverse().map(m=>entry(m,user.id))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to write an entry.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body.content!=='string'||!body.content.trim()||body.content.trim().length>800)return Response.json({error:'Write an entry of 1–800 characters.'},{status:400});
 const {id}=await params;
 const {data,error}=await db.from('correspondence_entries').insert({paper_id:id,owner:user.id,author_name:user.name,content:body.content.trim()}).select('*').single();
 if(error||!data)return Response.json({error:'Your entry could not be saved. Please try again.'},{status:503});
 return Response.json({message:entry(data,user.id)},{status:201});
}
