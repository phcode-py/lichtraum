'use client';
import {useState} from 'react';
import {ArrowUpRight, Check} from 'lucide-react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import SignInShell from '../signin/shell';

export default function SetPassword(){
 const[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const {error}=await createClient().auth.updateUser({password});
  setBusy(false);
  if(error){setError(error.code==='same_password'?'That is already your password.':error.code==='weak_password'?'Use at least 8 characters.':'The password could not be saved. Please try again.');return;}
  setDone(true);
 }
 return <SignInShell index="ATLAS / PASSWORD">
  {done?<div className="signin-sent" role="status">
    <span className="signin-check"><Check size={18}/></span>
    <h1>Password saved.</h1>
    <p>Next time, sign in with your email and this password.</p>
    <Link className="primary signin-submit" href="/">Open the atlas<ArrowUpRight size={16}/></Link>
   </div>
  :<form onSubmit={save}>
    <h1>Choose a<br/>password.</h1>
    <p className="signin-lede">So you can sign in without waiting for an email.</p>
    <label className="field">New password <span>(at least 8 characters)</span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="primary signin-submit" disabled={busy||password.length<8}>{busy?'Saving…':'Save password'}<ArrowUpRight size={16}/></button>
    <Link className="signin-again" href="/">Skip for now</Link>
   </form>}
 </SignInShell>;
}
