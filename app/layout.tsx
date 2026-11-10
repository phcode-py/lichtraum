import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'lichtraum zürich — atlas',description:'Walk together through Zürich. Photograph light and reflections, share a light atlas, and stay in touch through Correspondence.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}</body></html>}
