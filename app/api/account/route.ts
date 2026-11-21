import {createClient,getSessionUser} from '@/lib/supabase/server';
/** Verified profile information only. Passwords cannot be read through this endpoint. */
export async function GET(){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to see your account.'},{status:401});
 const {data}=await db.rpc('my_membership');
 const admin=(data as {admin?:boolean}|null)?.admin===true;
 return Response.json({username:user.name,email:user.email,admin},{headers:{'Cache-Control':'no-store'}});
}
