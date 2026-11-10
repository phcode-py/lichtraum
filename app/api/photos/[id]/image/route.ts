import { env } from 'cloudflare:workers';
import { and,eq,or } from 'drizzle-orm';
import { getDb } from '../../../../../db';
import { photos } from '../../../../../db/schema';
import { getChatGPTUser } from '../../../../chatgpt-auth';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await getChatGPTUser();if(!user)return new Response('Sign in required',{status:401});const {id}=await params;
 const [p]=await getDb().select().from(photos).where(and(eq(photos.id,id),or(eq(photos.owner,user.userId),eq(photos.shared,1))));
 if(!p)return new Response('Not found',{status:404});const object=await env.BUCKET!.get(p.key);if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
