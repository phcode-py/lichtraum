'use client';
import {Star} from 'lucide-react';

/** The star in a picture's corner: shown on hover, and kept visible once a picture is a favourite. */
export default function FavouriteStar({active,title,by='',onToggle}:{active:boolean;title:string;by?:string;onToggle:()=>void}){
 return <button type="button" className={'favourite-star'+(active?' is-favourite':'')} aria-pressed={active} aria-label={(active?'Remove from favourites: ':'Add to favourites: ')+title} title={active?(by?`Favourite of ${by} · click to remove`:'Shared favourite · click to remove'):'Add to the shared favourites'} onClick={e=>{e.stopPropagation();onToggle()}}><Star size={15} fill={active?'currentColor':'none'} aria-hidden="true"/></button>;
}
