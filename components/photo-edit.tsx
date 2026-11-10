'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,ImagePlus} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {prepareImage,uploadImage} from '@/lib/image';

type Editable={id:string;title:string;caption:string;url:string;category?:string;shared?:number};

/** Edit your own photograph or impression: picture, title, caption, category and sharing. */
export default function PhotoEdit<T extends Editable>({photo,onSaved,onCancel}:{photo:T;onSaved:(p:T)=>void;onCancel:()=>void}){
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const[title,setTitle]=useState(photo.title),[caption,setCaption]=useState(photo.caption),[category,setCategory]=useState(photo.category||'Reflection'),[shared,setShared]=useState(!!photo.shared);
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 function choose(f?:File){if(!f)return;setFile(f);setPreview(URL.createObjectURL(f));}

 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const supabase=createClient();let key='';
  try{
   if(file){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Your session ended. Sign in again.');key=await uploadImage(supabase,user.id,await prepareImage(file));}
   const r=await fetch(`/api/photos/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,caption,category,shared,...(key?{key}:{})})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'Your changes could not be saved.');
   onSaved({...photo,...data.photo});
  }catch(e){setError(e instanceof Error?e.message:'Your changes could not be saved.');setBusy(false);}
 }

 return <form className="photo-edit" onSubmit={save}>
  <label className="photo-edit-image">
   <img src={preview||photo.url} alt=""/>
   <span><ImagePlus size={15}/>{file?'New picture chosen':'Change picture'}</span>
   <input type="file" accept="image/*" disabled={busy} onChange={e=>choose(e.target.files?.[0])}/>
  </label>
  <div className="detail-body">
   <div className="eyebrow">EDIT PHOTOGRAPH</div>
   <label className="field">Title<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></label>
   <label className="field">What caught your eye?<select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}><option>Reflection</option><option>Light</option><option>Shadow</option><option>Other</option></select></label>
   <label className="field">Caption <span>(optional)</span><textarea maxLength={600} rows={3} value={caption} onChange={e=>setCaption(e.target.value)} disabled={busy} placeholder="A few words about this moment."/></label>
   <label className="share-photo"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)} disabled={busy}/><span>Share with my walking partner<small>{shared?'Visible to everyone in the atlas.':'Private to you.'}</small></span></label>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="photo-edit-actions">
    <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
    <button className="primary" disabled={busy||!title.trim()}>{busy?'Saving…':'Save changes'}<ArrowUpRight size={14}/></button>
   </div>
  </div>
 </form>;
}
