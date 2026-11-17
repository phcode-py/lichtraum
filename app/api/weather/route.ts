import {createClient,getSessionUser} from '@/lib/supabase/server';
import {fetchWeather} from '@/lib/photo-conditions';
import {inZurich} from '@/lib/places';

export async function GET(request:Request){
 const supabase=await createClient();
 if(!await getSessionUser(supabase))return Response.json({error:'Sign in required.'},{status:401});
 const query=new URL(request.url).searchParams;
 const time=Number(query.get('time')),lat=Number(query.get('lat')),lng=Number(query.get('lng'));
 if(!Number.isFinite(time)||time<Date.UTC(1940,0,1)||time>Date.now()+16*86400000||!Number.isFinite(lat)||!Number.isFinite(lng)||!inZurich(lat,lng))return Response.json({error:'Choose a valid time and place in Zürich.'},{status:400});
 return Response.json({weather:await fetchWeather(time,lat,lng)},{headers:{'Cache-Control':'private, max-age=300'}});
}
