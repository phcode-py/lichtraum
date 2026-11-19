import Link from 'next/link';
import SignInBackdrop from './backdrop';
import './signin.css';

/** Paper sheet used by the sign-in and password pages. */
export default function SignInShell({index, children}:{index:string;children:React.ReactNode}){
 return <main className="signin">
  <SignInBackdrop/>
  <header className="signin-header"><Link href="/" className="signin-brand" aria-label="Lichtraum Zürich — starting page"><span>LICHTRAUM</span><span>ZÜRICH</span></Link></header>
  <span className="signin-side-label" aria-hidden="true">04 account</span>
  <section className="signin-sheet" aria-label={index==='ATLAS / PASSWORD'?'Choose your password':'Account access'}>
   <div className="signin-tapes" aria-hidden="true"><span/><span/><span/><span/></div>
   {children}
  </section>
 </main>;
}
