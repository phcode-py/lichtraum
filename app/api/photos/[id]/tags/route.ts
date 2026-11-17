import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {parseTags} from '@/lib/gallery';
import {writePhotoTags} from '@/lib/photo-tags-server';

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 const supabase=await createClient(),user=await getSessionUser(supabase);
 if(!user)return Response.json({error:'Sign in required.'},{status:401});
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 let body:unknown;try{body=await request.json();}catch{return Response.json({error:'Invalid tags.'},{status:400});}
 const tags=parseTags(body);if(!tags)return Response.json({error:'Choose tags from the available categories.'},{status:400});
 const {id}=await params;
 const {data:photo}=await supabase.from('photos').select('id').eq('id',id).eq('owner',user.id).maybeSingle();
 if(!photo)return Response.json({error:'Only the photographer can edit these tags.'},{status:404});
 if(!await writePhotoTags(supabase,id,tags))return Response.json({error:'Tags could not be saved. The gallery tag storage may need its separate setup. Your photograph is unchanged.'},{status:503});
 return Response.json({tags},{headers:{'Cache-Control':'no-store'}});
}
