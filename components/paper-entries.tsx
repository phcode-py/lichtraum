'use client';
import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {Camera,Video,Plus,Trash2,X} from 'lucide-react';
import PaperTextEditor,{PaperText} from './paper-text-editor';
import {paperTextPlain} from '@/lib/paper-text';
import {chatMessageSide,type PaperEntryChange} from '@/lib/paper-entry-edits';
import {REFERENCE_ONLY_CONTENT,referenceCaption,REFERENCE_IMAGE_ACCEPT,REFERENCE_VIDEO_ACCEPT,referenceError,uploadPaperReference} from '@/lib/paper-references';

export const PaperReferenceUploadContext=createContext<(file:File)=>Promise<string>>(uploadPaperReference);
export type Message={id:string;author:string;authorId?:string;content:string;createdAt:number;updatedAt?:number;mine:boolean;hasImage?:boolean;imageUrl?:string;mediaType?:'image'|'video'};
export type ChatDates={createdAt?:number;updatedAt?:number};
export type EntriesHandle={save:()=>Promise<void>};
type EntryDraft={content:string;file?:File|null;removeMedia?:boolean;removeEntry?:boolean};

function Reference({url,video,caption}:{url:string;video:boolean;caption:string}){
 return video?<video className="paper-reference-video" src={url} controls playsInline preload="metadata" aria-label={caption}/>:<a className="paper-reference" href={url} target="_blank" rel="noreferrer" aria-label={'Open reference image: '+caption}><img src={url} alt={caption} loading="lazy"/></a>;
}
function PaperEntry({message,index,editing,disabled,chat,draft,onChange}:{message:Message;index:number;editing:boolean;disabled:boolean;chat:boolean;draft?:EntryDraft;onChange:(patch:Partial<EntryDraft>)=>void}){
 const[preview,setPreview]=useState('');
 useEffect(()=>{if(!draft?.file){setPreview('');return;}const url=URL.createObjectURL(draft.file);setPreview(url);return()=>URL.revokeObjectURL(url)},[draft?.file]);
 const content=draft?.content??referenceCaption(message.content,!!message.hasImage),caption=paperTextPlain(content),url=preview||(!draft?.removeMedia?message.imageUrl:'')||'',video=draft?.file?draft.file.type.startsWith('video/'):message.mediaType==='video';
 function choose(file?:File){if(!file||disabled)return;const problem=referenceError(file);if(problem){setFileError(problem);return;}setFileError('');onChange({file,removeMedia:false})}
 const[fileError,setFileError]=useState('');
 if(editing&&draft?.removeEntry)return <article className="paper-entry paper-entry-removal"><p>This entry will be removed when you save.</p><button type="button" disabled={disabled} onClick={()=>onChange({removeEntry:false})}>undo</button></article>;
 return <article className={'paper-entry'+(chat?' paper-chat-message is-'+chatMessageSide(message):'')}>
  {chat&&<div className="paper-chat-author"><span>{message.author}</span><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div>}
  {url?<Reference url={url} video={video} caption={caption||(video?'Reference video':'Reference image')}/>:message.hasImage&&!draft?.removeMedia&&!preview&&<p className="paper-reference-missing">Reference unavailable. Reopen this sheet to try again.</p>}
  {editing?<div className="paper-entry-editor"><PaperTextEditor value={content} onChange={content=>onChange({content})} label={'Edit entry '+(index+1)} disabled={disabled}/>
   <div className="paper-entry-reference-tools"><label className="paper-reference-add" title="Choose image"><Camera size={13} aria-hidden="true"/><input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label={'Choose image for entry '+(index+1)} disabled={disabled} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label><label className="paper-reference-add" title="Choose video"><Video size={13} aria-hidden="true"/><input type="file" accept={REFERENCE_VIDEO_ACCEPT} aria-label={'Choose video for entry '+(index+1)} disabled={disabled} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label>{(draft?.file||message.hasImage&&!draft?.removeMedia)&&<button type="button" className="paper-reference-detach" aria-label={'Remove reference from entry '+(index+1)} title="Remove reference from this entry" disabled={disabled} onClick={()=>onChange({file:null,removeMedia:true})}><X size={13}/></button>}{!chat&&<button type="button" className="paper-entry-delete" aria-label={'Delete entry '+(index+1)} title="Delete entry" disabled={disabled} onClick={()=>onChange({removeEntry:true})}><Trash2 size={13}/></button>}</div>
   {content.length>800&&<p className="paper-error">Shorten this entry slightly to keep its formatting.</p>}{fileError&&<p className="paper-error" role="alert">{fileError}</p>}
  </div>:referenceCaption(message.content,!!message.hasImage)&&<PaperText value={message.content}/>}
 </article>;
}

export default function Entries({endpoint,onChanged,localPreview=false,editing=false,disabled=false,chat=false,onDatesChange,ref}:{endpoint:string;onChanged?:()=>void;localPreview?:boolean;editing?:boolean;disabled?:boolean;chat?:boolean;onDatesChange?:(dates:ChatDates)=>void;ref?:Ref<EntriesHandle>}){
 const[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(!localPreview),[sending,setSending]=useState(false),[error,setError]=useState(''),[writing,setWriting]=useState(false),[drafts,setDrafts]=useState<Record<string,EntryDraft>>({});
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const uploadReference=useContext(PaperReferenceUploadContext),uploaded=useRef<{file:File;key:string}|null>(null),replacements=useRef(new Map<string,{file:File;key:string}>());
 const chatFeed=useRef<HTMLDivElement>(null),nearBottom=useRef(true);
 const revision=useRef(0),editingNow=useRef(editing),loaded=useRef(false),dates=useRef<ChatDates>({});
 useLayoutEffect(()=>{if(chat&&nearBottom.current&&chatFeed.current)chatFeed.current.scrollTop=chatFeed.current.scrollHeight},[chat,messages]);
 const busy=sending||disabled,video=!!file?.type.startsWith('video/');
 useEffect(()=>{editingNow.current=editing;if(!editing){setDrafts({});replacements.current.clear()}},[editing]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 function choose(file?:File){if(!file||busy||localPreview)return;const problem=referenceError(file);if(problem){setError(problem);return;}setFile(file);uploaded.current=null;setWriting(true);setError('')}
 const load=useCallback(async()=>{
  if(localPreview||editingNow.current&&loaded.current)return;
  const version=revision.current;
  try{const r=await fetch(endpoint);const data=await r.json();if(!r.ok)throw Error(data.error||'Entries could not be loaded.');if(version===revision.current&&(!editingNow.current||!loaded.current)){setMessages(data.messages);setError('');loaded.current=true;if(chat){dates.current={createdAt:data.createdAt,updatedAt:data.updatedAt};onDatesChange?.(dates.current)}}}catch(e){setError(e instanceof Error?e.message:'Entries could not be loaded.')}finally{setLoading(false)}
 },[endpoint,localPreview,chat,onDatesChange]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},chat?3000:15000);return()=>clearInterval(timer)},[load,editing,chat]);
 function noteSaved(updated:Message[],removed:string[]=[]){if(!updated.length&&!removed.length)return;if(updated.some(m=>!messages.some(old=>old.id===m.id)))nearBottom.current=true;revision.current+=1;setMessages(list=>{const replacements=new Map(updated.map(m=>[m.id,m]));return [...list.filter(m=>!removed.includes(m.id)).map(m=>replacements.get(m.id)??m),...updated.filter(m=>!list.some(old=>old.id===m.id))]});if(chat&&updated.length){dates.current={createdAt:dates.current.createdAt??Math.min(...updated.map(m=>m.createdAt)),updatedAt:Math.max(dates.current.updatedAt??0,...updated.map(m=>m.updatedAt??m.createdAt))};onDatesChange?.(dates.current)}onChanged?.()}
 async function publishEntry(){
  if(!paperTextPlain(text).trim()&&!file)return;
  if(text.length>800)throw Error('Shorten the new entry slightly to keep its formatting.');
  let imageKey:string|undefined;
  if(file){if(uploaded.current?.file!==file)uploaded.current={file,key:await uploadReference(file)};imageKey=uploaded.current!.key;}
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,...(file?{imageKey}:{})})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Your entry could not be saved.');noteSaved([data.message]);setText('');setFile(null);uploaded.current=null;setWriting(false);
 }
 async function saveEntries(){
  const changes:PaperEntryChange[]=[];
  for(const [id,draft] of Object.entries(drafts)){
   const original=messages.find(m=>m.id===id);if(!original)continue;
   if(draft.removeEntry){changes.push({entryId:id,content:original.content,delete:true});continue;}
   if(draft.content===referenceCaption(original.content,!!original.hasImage)&&!draft.file&&!(draft.removeMedia&&original.hasImage))continue;
   const hasMedia=!!draft.file||!!original.hasImage&&!draft.removeMedia;
   const content=paperTextPlain(draft.content).trim()?draft.content:hasMedia?REFERENCE_ONLY_CONTENT:'';
   if(!content||content.length>800)throw Error('Each entry needs a note or reference, within 800 characters.');
   const change:PaperEntryChange={entryId:id,content};
   if(draft.file){let attachment=replacements.current.get(id);if(attachment?.file!==draft.file){attachment={file:draft.file,key:await uploadReference(draft.file)};replacements.current.set(id,attachment)}change.imageKey=attachment.key;}
   else if(draft.removeMedia)change.imageKey=null;
   changes.push(change);
  }
  if(changes.length){const r=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries:changes})});const data=await r.json();if(!r.ok)throw Error(data.error||'Your entries could not be saved.');noteSaved(data.messages,data.deletedEntryIds??[]);setDrafts({});replacements.current.clear();}
  if(writing)await publishEntry();
 }
 useImperativeHandle(ref,()=>({save:saveEntries}));
 async function send(e:React.FormEvent){e.preventDefault();if(localPreview||busy)return;setSending(true);setError('');try{await publishEntry()}catch(e){setError(e instanceof Error?e.message:'Your entry could not be saved.')}finally{setSending(false)}}
 return <div className={'paper-notes'+(chat?' paper-chat':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files[0])}}>
  <div className="paper-entries" ref={chatFeed} onScroll={e=>{const node=e.currentTarget;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<40}} role="log" aria-label={chat?'Chat messages':'Paper entries'} aria-live="polite" aria-busy={loading}>
   {loading&&!messages.length&&<p className="paper-loading">Opening this sheet…</p>}
   {chat&&!messages.length&&!loading&&<div className="paper-chat-participants"><span>Lena</span><span>Mona</span></div>}
   {messages.map((message,index)=><PaperEntry key={message.id+(editing?'-editing':'-reading')} message={message} index={index} editing={editing} disabled={busy||localPreview} chat={chat} draft={drafts[message.id]} onChange={patch=>setDrafts(current=>({...current,[message.id]:{...(current[message.id]??{content:referenceCaption(message.content,!!message.hasImage)}),...patch}}))}/>)}
  </div>
  {writing&&<form className="paper-compose" onSubmit={send}><PaperTextEditor value={text} onChange={setText} label={file?'Reference caption (optional)':chat?'New message':'New entry'} placeholder={file?'Add a caption (optional)…':chat?'Write a message…':'Write on this paper…'} autoFocus disabled={busy}/><div className="paper-reference-draft">{preview&&<><Reference url={preview} video={video} caption="Selected reference"/><button type="button" className="paper-reference-remove" aria-label="Remove selected reference" disabled={busy} onClick={()=>{setFile(null);uploaded.current=null}}><X size={13}/></button></>}</div>{text.length>800&&<p className="paper-error">Shorten the new entry slightly to keep its formatting.</p>}<div className="paper-compose-actions"><button type="button" disabled={busy} onClick={()=>{setWriting(false);setText('');setFile(null);uploaded.current=null}}>cancel</button><button disabled={busy||(!paperTextPlain(text).trim()&&!file)||text.length>800}>{sending?'saving…':chat?'send message':file?'add reference':'leave entry'}</button></div></form>}
  <div className="paper-add-actions">{!writing&&<button className="paper-write" aria-label={chat?'Write a message':'Leave an entry'} title={chat?'Write a message':'Leave an entry'} disabled={localPreview||busy} onClick={()=>setWriting(true)}><Plus size={14} aria-hidden="true"/></button>}<label className="paper-reference-add" title="Add reference image"><Camera size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label="Choose reference image" disabled={busy||localPreview} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label><label className="paper-reference-add" title="Add a video"><Video size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_VIDEO_ACCEPT} aria-label="Choose reference video" disabled={busy||localPreview} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label></div>
  {writing&&file&&<p className="paper-reference-hint">{video?'MP4, MOV or WebM · up to 50 MB':'JPG, PNG or WebP · up to 10 MB'}</p>}
  {error&&<p className="paper-error" role="alert">{error} <button onClick={load}>retry</button></p>}
 </div>;
}
