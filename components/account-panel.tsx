'use client';
import {useEffect,useState} from 'react';
import {Check} from 'lucide-react';

type Account={username:string;email:string;admin?:boolean};
type JoinRequest={id:string;name:string;email:string;requestedAt:number};
type Outcome={text:string;admitted:boolean};

/** Account information never includes the user's password. */
export default function AccountPanel({signedOut=false}:{signedOut?:boolean}){
 const[account,setAccount]=useState<Account|null>(null),[error,setError]=useState('');
 const[requests,setRequests]=useState<JoinRequest[]|null>(null),[requestError,setRequestError]=useState('');
 useEffect(()=>{
  if(signedOut)return;const controller=new AbortController();
  fetch('/api/account',{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Account details could not be loaded.');setAccount(data);
   if(!data.admin)return;
   const q=await fetch('/api/account/requests',{signal:controller.signal}),list=await q.json();
   if(!q.ok){setRequestError(list.error||'Join requests could not be loaded.');return;}
   setRequests(list.requests);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Account details could not be loaded.')});
  return()=>controller.abort();
 },[signedOut]);
 const waiting=requests?.length??0;
 return <><div className="account-tapes" aria-hidden="true"><span/><span/><span/></div><section className="account-panel" aria-label="Account"><h1 className="section-display">Account</h1>{!signedOut&&<><dl className="account-details"><div><dt>Username</dt><dd>{account?.username??'…'}</dd></div><div><dt>Email</dt><dd>{account?.email??'…'}</dd></div><div><dt>Password</dt><dd><span aria-label="Password hidden">••••••••</span><a href="/password">Change password</a></dd></div>{account?.admin&&<div><dt>Join requests</dt><dd>{requestError||(requests===null?'…':waiting===0?'No one is waiting':waiting===1?'One person is waiting':`${waiting} people are waiting`)}</dd></div>}</dl>{error&&<p className="account-status" role="status">{error}</p>}</>}<nav aria-label="Account actions">{signedOut?<a href="/signin">Sign in</a>:<a href="/auth/signout">Sign out</a>}</nav></section>
  {!!waiting&&<div className="join-requests" aria-label="Join requests">{requests!.map(r=><JoinRequestPaper key={r.id} request={r} onDone={()=>setRequests(list=>list?.filter(x=>x.id!==r.id)??null)}/>)}</div>}
 </>;
}

/** One sheet per person who asked to join. Admitting or declining removes it for every admin. */
function JoinRequestPaper({request,onDone}:{request:JoinRequest;onDone:()=>void}){
 const[busy,setBusy]=useState(false),[confirmDecline,setConfirmDecline]=useState(false);
 const[outcome,setOutcome]=useState<Outcome|null>(null),[error,setError]=useState('');
 const first=request.name.split(/\s+/)[0]||request.name;
 async function decide(admit:boolean){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/account/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:request.id,admit})}),data=await r.json();
   if(!r.ok)throw Error(data.error||'The answer could not be saved.');
   const admitted=data.status==='approved';
   setOutcome({admitted,text:data.decided?(admitted?`${first} can now open the atlas.`:`${first} will not be admitted.`):`${data.decidedBy||'Another admin'} already ${admitted?'admitted':'declined'} ${first}.`});
   setTimeout(onDone,2600);
  }catch(e){setError(e instanceof Error?e.message:'The answer could not be saved.');setBusy(false)}
 }
 return <article className={'join-request'+(outcome?' decided':'')} aria-label={`Join request from ${request.name}`}>
  <span className="join-request-tape" aria-hidden="true"/>
  <p className="join-request-label">Join request<time dateTime={new Date(request.requestedAt).toISOString()}>{new Date(request.requestedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</time></p>
  <h2>{request.name||'No name given'}</h2>
  <p className="join-request-email">{request.email}</p>
  {outcome?<p className="join-request-outcome" role="status">{outcome.admitted&&<Check size={14} aria-hidden="true"/>}{outcome.text}</p>
  :confirmDecline?<div className="join-request-actions"><span>Decline {first}?</span><button disabled={busy} onClick={()=>decide(false)}>{busy?'One moment…':'Yes, decline'}</button><button className="quiet" disabled={busy} onClick={()=>setConfirmDecline(false)}>Keep</button></div>
  :<div className="join-request-actions"><button disabled={busy} onClick={()=>decide(true)}><Check size={14} aria-hidden="true"/>{busy?'One moment…':'Admit'}</button><button className="quiet" disabled={busy} onClick={()=>setConfirmDecline(true)}>Decline</button></div>}
  {error&&<p className="join-request-error" role="alert">{error}</p>}
 </article>;
}
