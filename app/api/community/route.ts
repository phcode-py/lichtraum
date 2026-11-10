import {desc} from 'drizzle-orm';
import {getDb} from '../../../db';
import {messages,photos} from '../../../db/schema';
import {getChatGPTUser} from '../../chatgpt-auth';
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to join the correspondence.'},{status:401});
 try{const db=getDb();const rows=await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(100);const uploads=await db.select({owner:photos.owner,name:photos.authorName,createdAt:photos.createdAt}).from(photos);const people=new Map<string,{name:string;count:number;latest:number}>();for(const p of uploads){const old=people.get(p.owner);people.set(p.owner,{name:p.name,count:(old?.count||0)+1,latest:Math.max(old?.latest||0,p.createdAt)})}
 return Response.json({messages:rows.reverse().map(({owner,authorName,...m})=>({...m,author:authorName,mine:owner===user.userId})),contributors:[...people.values()].sort((a,b)=>b.latest-a.latest)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Correspondence could not be loaded. Please try again.'},{status:503})}}
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Sign in to write a message.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return new Response('Forbidden',{status:403});
 if(Number(request.headers.get('content-length'))>5000)return new Response('Message too long',{status:413});
 try{const payload=await request.json() as {content?:unknown};if(typeof payload.content!=='string'||!payload.content.trim()||payload.content.trim().length>800)return Response.json({error:'Write a message of 1–800 characters.'},{status:400});
 const authorName=(user.fullName||user.email.split('@')[0]||'Photographer').slice(0,80),id=crypto.randomUUID(),createdAt=Date.now(),content=payload.content.trim();await getDb().insert(messages).values({id,owner:user.userId,authorName,content,createdAt});return Response.json({message:{id,author:authorName,content,createdAt,mine:true}},{status:201});
 }catch{return Response.json({error:'Your message could not be sent. Please try again.'},{status:503})}}
