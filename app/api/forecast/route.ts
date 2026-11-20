import {createClient,getSessionUser} from '@/lib/supabase/server';
import {zurichForecast} from '@/lib/meteoswiss';

/** MeteoSwiss local forecast for Zürich. */
export async function GET(){
 const supabase=await createClient();
 if(!await getSessionUser(supabase))return Response.json({error:'Sign in required.'},{status:401});
 try{return Response.json({forecast:await zurichForecast()},{headers:{'Cache-Control':'private, max-age=600'}})}
 catch{return Response.json({error:'The forecast is unavailable right now.'},{status:502})}
}
