'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight, Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import './signin.css';

export default function SignInForm({linkError}:{linkError:boolean}){
 const[email,setEmail]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const[error,setError]=useState(linkError?'That link has expired or was already used. Request a new one.':'');
 async function send(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const {error}=await createClient().auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/`,data:name.trim()?{full_name:name.trim().slice(0,80)}:undefined}});
  setBusy(false);
  if(error){setError(error.status===429?'Too many requests. Wait a moment and try again.':'The link could not be sent. Check the address and try again.');return;}
  setSent(true);
 }
 return <main className="signin">
  <header className="topbar"><Link href="/" className="brand" aria-label="lichtraum zürich home"><span className="brand-mark"><span/><span/><span/></span><span className="brand-name">lichtraum zürich<span className="brand-sub">WALKS / REFLECTIONS / TOGETHER</span></span></Link></header>
  <section className="signin-sheet">
   <div className="signin-index"><span>ATLAS / ENTRY</span><span>47.3769° N · 8.5417° E</span></div>
   {sent?<div className="signin-sent" role="status">
     <span className="signin-check"><Check size={18}/></span>
     <h1>Check your inbox.</h1>
     <p>We sent a sign-in link to <strong>{email}</strong>. Open it on this device to enter the atlas.</p>
     <button className="signin-again" onClick={()=>setSent(false)}>Use another address</button>
    </div>
   :<form onSubmit={send}>
     <h1>Enter the<br/>light atlas.</h1>
     <p className="signin-lede">Lichtraum is private. Enter your email and we send you a link — no password.</p>
     <label className="field">Email<input type="email" required autoComplete="email" placeholder="you@example.ch" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
     <label className="field">Your name <span>(first visit only — shown beside your photographs)</span><input autoComplete="name" maxLength={80} placeholder="Lena" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
     {error&&<p className="form-error" role="alert">{error}</p>}
     <button className="primary signin-submit" disabled={busy||!email.trim()}>{busy?'Sending…':'Email me a link'}<ArrowUpRight size={16}/></button>
    </form>}
  </section>
 </main>;
}
