'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRight, Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import SignInShell from './shell';

type Mode='signin'|'signup'|'link';
const MIN_PASSWORD=8;

export default function SignInForm({linkError}:{linkError:boolean}){
 const router=useRouter();
 const[mode,setMode]=useState<Mode>('signin');
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
 const[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const[error,setError]=useState(linkError?'That link has expired or was already used. Sign in with your password, or request a new link.':'');

 function switchTo(m:Mode){setMode(m);setError('');}

 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  const auth=createClient().auth, mail=email.trim();
  if(mode==='link'){
   const {error}=await auth.signInWithOtp({email:mail,options:{shouldCreateUser:false,emailRedirectTo:`${window.location.origin}/auth/callback?next=/password`}});
   setBusy(false);
   if(error){setError(error.status===429?'Sign-in emails are limited to two per hour. Try again later, or use your password.':'The link could not be sent. Check the address and try again.');return;}
   setSent(true);return;
  }
  const {data,error}=mode==='signin'
   ?await auth.signInWithPassword({email:mail,password})
   :await auth.signUp({email:mail,password,options:{data:{full_name:name.trim().slice(0,80)}}});
  if(error||!data.session){
   setBusy(false);
   if(mode==='signin') setError(error?.code==='invalid_credentials'?'Email or password is not right. Signed in with a link before? Use “Forgot or no password”.':'Could not sign in. Please try again.');
   else setError(error?.code==='user_already_exists'||error?.code==='email_exists'?'This email already has an account. Sign in instead.':error?.code==='weak_password'?`Use at least ${MIN_PASSWORD} characters.`:'Could not create the account. Please try again.');
   return;
  }
  router.replace('/');router.refresh();
 }

 if(sent) return <SignInShell index="ATLAS / ENTRY"><div className="signin-sent" role="status">
  <span className="signin-check"><Check size={18}/></span>
  <h1>Check your inbox.</h1>
  <p>We sent a sign-in link to <strong>{email}</strong>. Open it on this device, then choose a password so you won’t need a link again.</p>
  <button className="signin-again" onClick={()=>setSent(false)}>Back</button>
 </div></SignInShell>;

 return <SignInShell index="ATLAS / ENTRY">
  <div className="signin-tabs" role="tablist">
   <button role="tab" aria-selected={mode!=='signup'} className={mode!=='signup'?'active':''} onClick={()=>switchTo('signin')}>Sign in</button>
   <button role="tab" aria-selected={mode==='signup'} className={mode==='signup'?'active':''} onClick={()=>switchTo('signup')}>New account</button>
  </div>
  <form onSubmit={submit}>
   <h1>{mode==='signup'?<>Join the<br/>light atlas.</>:<>Enter the<br/>light atlas.</>}</h1>
   <p className="signin-lede">{mode==='link'?'We email you a one-time link. Afterwards you can set a password.':'Lichtraum is private. Sign in to see the walks and photographs.'}</p>
   {mode==='signup'&&<label className="field">Your name <span>(shown beside your photographs)</span><input required autoComplete="name" maxLength={80} placeholder="Lena" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>}
   <label className="field">Email<input type="email" required autoComplete="email" placeholder="you@example.ch" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
   {mode!=='link'&&<label className="field">Password{mode==='signup'&&<span> (at least {MIN_PASSWORD} characters)</span>}<input type="password" required minLength={mode==='signup'?MIN_PASSWORD:undefined} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="primary signin-submit" disabled={busy||!email.trim()||(mode!=='link'&&!password)||(mode==='signup'&&!name.trim())}>
    {busy?'One moment…':mode==='signin'?'Sign in':mode==='signup'?'Create account':'Email me a link'}<ArrowUpRight size={16}/>
   </button>
   {mode!=='signup'&&<button type="button" className="signin-again" onClick={()=>switchTo(mode==='link'?'signin':'link')}>{mode==='link'?'Use my password':'Forgot or no password'}</button>}
  </form>
 </SignInShell>;
}
