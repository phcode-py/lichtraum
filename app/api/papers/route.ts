import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {toPaper,validPosition,type PaperRow} from '@/lib/papers';
export async function GET(){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to open the board.'},{status:401});
 const {data,error}=await db.from('correspondence_papers').select('*').order('created_at',{ascending:false}).limit(200);
 if(error)return Response.json({error:'Papers could not be loaded. Please try again.'},{status:503});
 return Response.json({papers:(data as PaperRow[]).reverse().map(p=>toPaper(p,user.id))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to start a paper.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>80||!validPosition(body.x,body.y)||typeof body.shared!=='boolean')return Response.json({error:'Give the paper a title of up to 80 characters and a valid position.'},{status:400});
 if(body.material!==undefined&&body.material!=='opaque'&&body.material!=='tracing')return Response.json({error:'Choose paper or tracing paper.'},{status:400});
 if(body.category!==undefined&&!['references','messages'].includes(body.category))return Response.json({error:'Choose References or Messages.'},{status:400});
 const {data,error}=await db.from('correspondence_papers').insert({owner:user.id,author_name:user.name,title:body.title.trim(),...(body.category?{category:body.category}:{}),shared:body.shared,x:body.x,y:body.y,...(body.material==='tracing'?{material:'tracing'}:{})}).select('*').single();
 if(error||!data)return Response.json({error:body.material==='tracing'&&(error?.code==='PGRST204'||error?.code==='42703')?'Tracing paper is not set up yet. Your title is still here; try ordinary paper for now.':'The paper could not be saved. Your title is still here; try again.'},{status:503});
 return Response.json({paper:toPaper(data as PaperRow,user.id)},{status:201});
}
