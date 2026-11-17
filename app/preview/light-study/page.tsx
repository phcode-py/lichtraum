import {notFound} from 'next/navigation';
import LightStudyPreview from '@/components/light-study-preview';

export default function Preview(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <LightStudyPreview/>;
}
