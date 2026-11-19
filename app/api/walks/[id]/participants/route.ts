import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {parseParticipantIds} from '@/lib/walk-participants';
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in to see participants.'},{status:401});
 const {id}=await params,{data:walk,error}=await db.from('walks').select('owner,author_name').eq('id',id).maybeSingle();
 if(error)return Response.json({error:'The walk could not be loaded.'},{status:503});if(!walk)return Response.json({error:'Walk not found.'},{status:404});
 const {data:members,error:memberError}=await db.from('walk_participants').select('user_id,name').eq('walk_id',id).eq('active',true);
 const query=new URL(request.url).searchParams.get('q')?.trim()??'';
 let people:unknown[]=[];
 if(query.length>=2){if(walk.owner!==user.id)return Response.json({error:'Only the creator can add people.'},{status:403});if(query.length>80)return Response.json({error:'Use a shorter name.'},{status:400});const result=await db.rpc('search_walk_people',{walk_id:id,query});if(result.error)return Response.json({error:'Finding people needs the participant database setup.'},{status:503});people=result.data??[]}
 return Response.json({owner:{id:walk.owner,name:walk.author_name},members:(members??[]).map(p=>({id:p.user_id,name:p.name})),people,available:!memberError,canManage:walk.owner===user.id},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request,{params}:Context){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);if(!user)return Response.json({error:'Sign in to add people.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Choose people for this walk.'},{status:400})}
 const ids=parseParticipantIds(body?.people);if(!ids)return Response.json({error:'Choose up to 20 registered people.'},{status:400});
 const {id}=await params,{data:walk}=await db.from('walks').select('owner').eq('id',id).maybeSingle();
 if(!walk||walk.owner!==user.id)return Response.json({error:'Only the creator can change participants.'},{status:403});
 if(ids.includes(user.id))return Response.json({error:'The creator is already included.'},{status:400});
 const {data,error}=await db.rpc('set_walk_participants',{walk_id:id,people:ids});
 if(error)return Response.json({error:['PGRST202','42P01','42883'].includes(error.code)?'Saving participants needs Philipp’s database setup. Your choices are still here.':'Participants could not be saved. Check that each person has an account.'},{status:503});
 return Response.json({members:data??[]},{headers:{'Cache-Control':'no-store'}});
}
