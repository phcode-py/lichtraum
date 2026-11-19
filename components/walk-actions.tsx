'use client';
import {Pencil} from 'lucide-react';
import type {Walk} from '@/lib/walks';
export default function WalkActions({walk,onEdit}:{walk:Walk;onEdit:()=>void}){
 if(!walk.mine&&!walk.canEdit)return null;
 return <div className="owner-actions"><button aria-label={'Edit '+(walk.title||'walk')} title="Edit walk" onClick={onEdit}><Pencil size={12} aria-hidden="true"/></button></div>;
}
