import Link from 'next/link';
import './signin.css';

/** Paper sheet used by the sign-in and password pages. */
export default function SignInShell({index, children}:{index:string;children:React.ReactNode}){
 return <main className="signin">
  <header className="topbar"><Link href="/" className="brand" aria-label="lichtraum zürich home"><span className="brand-mark"><span/><span/><span/></span><span className="brand-name">lichtraum zürich<span className="brand-sub">WALKS / REFLECTIONS / TOGETHER</span></span></Link></header>
  <section className="signin-sheet">
   <div className="signin-index"><span>{index}</span><span>47.3769° N · 8.5417° E</span></div>
   {children}
  </section>
 </main>;
}
