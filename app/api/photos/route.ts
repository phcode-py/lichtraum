import { env } from 'cloudflare:workers';
import { and, desc, eq, or } from 'drizzle-orm';
import { getDb } from '../../../db';
import { photos } from '../../../db/schema';
import { getChatGPTUser } from '../../chatgpt-auth';
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({error:'Sign in to see your photos.'},{status:401});
  try { const rows = await getDb().select().from(photos).where(or(eq(photos.owner,user.userId),eq(photos.shared,1))).orderBy(desc(photos.createdAt));
    return Response.json({photos: rows.map(({owner,key,...p})=>({...p,mine:owner===user.userId,author:p.authorName,url:`/api/photos/${p.id}/image`}))},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Your collection could not be loaded. Please try again.'},{status:503});}
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({error:'Sign in to add photos.'},{status:401});
  if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return new Response('Forbidden',{status:403});
  if (Number(request.headers.get('content-length')) > 11*1024*1024) return Response.json({error:'Choose an image under 10 MB.'},{status:413});
  try {
    const data = await request.formData(), file = data.get('file');
    const title=String(data.get('title')||'').trim(), caption=String(data.get('caption')||'').trim(), place=String(data.get('place')||'Dropped pin').trim();
    const lat=Number(data.get('lat')), lng=Number(data.get('lng'));
    const shared=data.get('shared')==='true'?1:0;const category=['Reflection','Light','Shadow','Other'].includes(String(data.get('category')))?String(data.get('category')):'Reflection';const walk=String(data.get('walk')||'').trim().slice(0,100);
    if (!(file instanceof File)||!file.size||file.size>10*1024*1024||!title||title.length>100||caption.length>600||place.length>100||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<47.25||lat>47.5||lng<8.35||lng>8.75) return Response.json({error:'Add a title, an image under 10 MB, and a location in Zürich.'},{status:400});
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
    if(!mime) return Response.json({error:'Please use a JPG, PNG, or WebP image.'},{status:400});
    if(!env.BUCKET) throw new Error('Storage unavailable');
    const authorName=(user.fullName||user.email.split('@')[0]||'Photographer').slice(0,80);
    const id=crypto.randomUUID(), key=`photos/${id}`, createdAt=Date.now();
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
    try {await getDb().insert(photos).values({id,owner:user.userId,authorName,title,caption,place,lat,lng,key,createdAt,shared,category,walk});}
    catch(e){await env.BUCKET.delete(key);throw e;}
    return Response.json({photo:{id,title,caption,place,lat,lng,createdAt,shared,category,walk,mine:true,author:authorName,url:`/api/photos/${id}/image`}},{status:201});
  } catch { return Response.json({error:'Your photo could not be saved. Please try again.'},{status:503}); }
}
