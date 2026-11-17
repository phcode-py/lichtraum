import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
export async function GET(){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to open the board.'},{status:401});
 const {data,error}=await db.from('correspondence_sheet_settings').select('*');
 if(error)return Response.json({error:'Sheet settings could not be loaded.'},{status:503});
 return Response.json({settings:data},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(request:Request){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to edit papers.'},{status:401});
 let b;try{b=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!b||!['room','contributors'].includes(b.id)||typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>80||!['opaque','tracing'].includes(b.material))return Response.json({error:'Choose a title and paper type.'},{status:400});
 const {data,error}=await db.from('correspondence_sheet_settings').upsert({id:b.id,title:b.title.trim(),material:b.material}).select('*').single();
 if(error||!data)return Response.json({error:'The sheet could not be updated. Your changes are still here; try again.'},{status:503});
 return Response.json({settings:data});
}
