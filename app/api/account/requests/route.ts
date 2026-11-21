import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore={'Cache-Control':'no-store'};

/** People waiting to join. Admins only; the database checks this too. */
export async function GET(){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to see join requests.'},{status:401});
 const {data,error}=await db.rpc('join_requests');
 if(error)return Response.json({error:error.code==='42501'?'Only admins can see join requests.':'Join requests could not be loaded.'},{status:error.code==='42501'?403:500});
 const requests=(data as {id:string;name:string;email:string;requested_at:string}[]).map(r=>({id:r.id,name:r.name,email:r.email,requestedAt:Date.parse(r.requested_at)}));
 return Response.json({requests},{headers:noStore});
}

/** Admit or decline one person. One admin deciding is enough. */
export async function POST(request:Request){
 if(isCrossOrigin(request))return Response.json({error:'Not allowed.'},{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to answer join requests.'},{status:401});
 const body=await request.json().catch(()=>null) as {id?:unknown;admit?:unknown}|null;
 if(typeof body?.id!=='string'||!UUID.test(body.id)||typeof body.admit!=='boolean')return Response.json({error:'Unknown request.'},{status:400});
 const {data,error}=await db.rpc('decide_join_request',{person:body.id,admit:body.admit});
 if(error)return Response.json({error:error.code==='42501'?'Only admins can answer join requests.':'The answer could not be saved. Please try again.'},{status:error.code==='42501'?403:500});
 const row=(data as {status:string;decided:boolean;decided_by_name:string}[])[0];
 if(!row)return Response.json({error:'This request no longer exists.'},{status:404});
 return Response.json({status:row.status,decided:row.decided,decidedBy:row.decided_by_name},{headers:noStore});
}
