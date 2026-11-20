import {createClient,getSessionUser} from '@/lib/supabase/server';
import {RADAR_CORNERS,radarFrames} from '@/lib/meteoswiss';

/** The last two hours of MeteoSwiss rain radar frames. */
export async function GET(){
 const supabase=await createClient();
 if(!await getSessionUser(supabase))return Response.json({error:'Sign in required.'},{status:401});
 try{
  const frames=await radarFrames();
  return Response.json({corners:RADAR_CORNERS,frames:frames.map(f=>({time:f.time,url:`/api/rain/frame?name=${encodeURIComponent(f.name)}`}))},{headers:{'Cache-Control':'private, max-age=120'}});
 }catch{return Response.json({error:'The rain radar is unavailable right now.'},{status:502})}
}
