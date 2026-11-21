import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowUpRight, Hourglass} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import SignInShell from '../signin/shell';

export const metadata: Metadata = {title: 'Waiting to join — lichtraum zürich'};
export const dynamic = 'force-dynamic';

/** Shown to new accounts until Mona, Philipp or Lena admits them. */
export default async function Waiting(){
 const db=await createClient();
 const {data,error}=await db.rpc('my_membership');
 const status=(data as {status?:unknown}|null)?.status;
 const declined=status==='declined',unclear=!!error||(status!=='pending'&&status!=='approved'&&!declined);
 return <SignInShell index="ATLAS / WAITING">
  <div className="signin-sent" role="status">
   <span className="signin-check"><Hourglass size={18}/></span>
   {unclear?<>
    <h1>Access could<br/>not be confirmed.</h1>
    <p>The atlas could not check your account just now. Please try again in a moment.</p>
    <Link className="primary signin-submit" href="/">Try again<ArrowUpRight size={16}/></Link>
   </>:declined?<>
    <h1>Not admitted.</h1>
    <p>Your request to join the light atlas was declined. If you think this is a mistake, please write to Mona, Philipp or Lena.</p>
   </>:<>
    <h1>Your request<br/>is on its way.</h1>
    <p>Mona, Philipp or Lena will let you into the light atlas. As soon as one of them has admitted you, this page opens the atlas.</p>
    <Link className="primary signin-submit" href="/">Check again<ArrowUpRight size={16}/></Link>
   </>}
   <a className="signin-again" href="/auth/signout">Sign out</a>
  </div>
 </SignInShell>;
}
