import {createClient,getSessionUser} from '@/lib/supabase/server';
import {RADAR_FRAME,radarImage} from '@/lib/meteoswiss';

/** One radar frame, drawn as a transparent PNG for the map. Frames never change once published. */
export async function GET(request:Request){
 const supabase=await createClient();
 if(!await getSessionUser(supabase))return new Response('Sign in required.',{status:401});
 const name=new URL(request.url).searchParams.get('name')??'';
 if(!RADAR_FRAME.test(name))return new Response('Unknown radar frame.',{status:400});
 try{
  const image=await radarImage(name);
  return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=86400, immutable'}});
 }catch{return new Response('Radar frame unavailable.',{status:502})}
}
