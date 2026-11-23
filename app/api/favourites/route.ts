import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';

// Personal favourites. Until the photo_favourites table is set up, the browser keeps them instead.
const setupMissing=(code?:string)=>['42P01','PGRST205','PGRST202','42501'].includes(code??'');

export async function GET(){
 const supabase=await createClient(),user=await getSessionUser(supabase);
 if(!user)return Response.json({error:'Sign in required.'},{status:401});
 const {data,error}=await supabase.from('photo_favourites').select('photo_id').eq('user_id',user.id);
 if(error)return Response.json({available:false,ids:[]},{status:setupMissing(error.code)?200:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({available:true,ids:data.map(r=>r.photo_id)},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 const supabase=await createClient(),user=await getSessionUser(supabase);
 if(!user)return Response.json({error:'Sign in required.'},{status:401});
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 let body:{ids?:unknown;favourite?:unknown};try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 const ids=Array.isArray(body.ids)?body.ids.filter((id):id is string=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)).slice(0,500):[];
 if(!ids.length||typeof body.favourite!=='boolean')return Response.json({error:'Choose a photograph.'},{status:400});
 const {error}=body.favourite
  ?await supabase.from('photo_favourites').upsert(ids.map(photo_id=>({user_id:user.id,photo_id})),{onConflict:'user_id,photo_id',ignoreDuplicates:true})
  :await supabase.from('photo_favourites').delete().eq('user_id',user.id).in('photo_id',ids);
 if(error)return Response.json({available:!setupMissing(error.code),error:'The favourite could not be saved.'},{status:setupMissing(error.code)?409:503});
 return Response.json({available:true});
}
