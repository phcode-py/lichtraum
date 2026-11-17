import {notFound} from 'next/navigation';
import Home from '@/components/home';

export default async function Preview({searchParams}:{searchParams:Promise<{section?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 // Render the actual application, not a separately designed demonstration.
 // Without configuration, use empty, explicitly unavailable data and no writes.
 const connected=!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const {section}=await searchParams;
 return <Home localPreview={!connected} initialSection={section==='gallery'?'gallery':'walks'}/>;
}
