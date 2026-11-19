'use client';
import {useEffect,useState} from 'react';
/** Account information never includes the user's password. */
export default function AccountPanel({signedOut=false}:{signedOut?:boolean}){
 const[account,setAccount]=useState<{username:string;email:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  if(signedOut)return;const controller=new AbortController();
  fetch('/api/account',{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Account details could not be loaded.');setAccount(data)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Account details could not be loaded.')});
  return()=>controller.abort();
 },[signedOut]);
 return <><div className="account-tapes" aria-hidden="true"><span/><span/><span/></div><section className="account-panel" aria-label="Account"><h1 className="section-display">Account</h1>{!signedOut&&<><dl className="account-details"><div><dt>Username</dt><dd>{account?.username??'…'}</dd></div><div><dt>Email</dt><dd>{account?.email??'…'}</dd></div><div><dt>Password</dt><dd><span aria-label="Password hidden">••••••••</span><a href="/password">Change password</a></dd></div></dl>{error&&<p className="account-status" role="status">{error}</p>}</>}<nav aria-label="Account actions">{signedOut?<a href="/signin">Sign in</a>:<a href="/auth/signout">Sign out</a>}</nav></section></>;
}
