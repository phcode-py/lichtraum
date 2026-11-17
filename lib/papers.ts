export type PaperCategory='references'|'messages';
export const paperCategory=(p:{category?:PaperCategory;title:string}):PaperCategory=>p.category??(/references?/i.test(p.title)?'references':'messages');
export type PaperMaterial='opaque'|'tracing';
export type Paper={id:string;title:string;author:string;mine:boolean;shared:boolean;x:number;y:number;createdAt:number;updatedAt?:number;category?:PaperCategory;material?:PaperMaterial};
export type PaperRow={id:string;title:string;author_name:string;owner:string;shared:boolean;x:number;y:number;created_at:string;updated_at?:string|null;category?:PaperCategory;material?:PaperMaterial};
export const toPaper=(p:PaperRow,userId:string):Paper=>({id:p.id,title:p.title,author:p.author_name,mine:p.owner===userId,shared:p.shared,x:p.x,y:p.y,createdAt:Date.parse(p.created_at),updatedAt:p.updated_at?Date.parse(p.updated_at):undefined,category:paperCategory(p),material:p.material==='tracing'?'tracing':'opaque'});
export const validPosition=(x:unknown,y:unknown)=>typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<=10000&&y<=10000;
export type SheetSettings={id:'room'|'contributors';title:string;material:PaperMaterial};
