import {createClient,getSessionUser} from '@/lib/supabase/server';
import {rainForecastFrames} from '@/lib/meteoswiss';

/** Hourly rain forecast maps for the next 24 hours (MeteoSwiss local forecast). */
export async function GET(){
 const supabase=await createClient();
 if(!await getSessionUser(supabase))return Response.json({error:'Sign in required.'},{status:401});
 try{return Response.json({frames:await rainForecastFrames()},{headers:{'Cache-Control':'private, max-age=900'}})}
 catch{return Response.json({error:'The rain forecast is unavailable right now.'},{status:502})}
}
