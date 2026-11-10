import { env } from 'cloudflare:workers';
import { and,eq } from 'drizzle-orm';
import { getDb } from '../../../../db';
import { photos } from '../../../../db/schema';
import { getChatGPTUser } from '../../../chatgpt-auth';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await getChatGPTUser();if(!user)return new Response('Sign in required',{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
 const {id}=await params;
 try{const db=getDb();const [p]=await db.select().from(photos).where(and(eq(photos.id,id),eq(photos.owner,user.userId)));
 if(!p)return new Response('Not found',{status:404});
 await env.BUCKET!.delete(p.key);await db.delete(photos).where(and(eq(photos.id,id),eq(photos.owner,user.userId)));
 return Response.json({ok:true});}catch{return Response.json({error:'Could not delete this photo. Try again.'},{status:503});}
}
