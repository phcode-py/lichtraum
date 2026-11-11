export type Paper={id:string;title:string;author:string;mine:boolean;shared:boolean;x:number;y:number;createdAt:number};
export type PaperRow={id:string;title:string;author_name:string;owner:string;shared:boolean;x:number;y:number;created_at:string};
export const toPaper=(p:PaperRow,userId:string):Paper=>({id:p.id,title:p.title,author:p.author_name,mine:p.owner===userId,shared:p.shared,x:p.x,y:p.y,createdAt:Date.parse(p.created_at)});
export const validPosition=(x:unknown,y:unknown)=>typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<=10000&&y<=10000;
