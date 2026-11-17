// Stored as text, with a version marker so existing plain notes keep their exact meaning.
export const PAPER_RICH_PREFIX='[paper-text:v1]';
const ALLOWED=new Set(['b','strong','i','em','u','s','strike','p','div','br','ul','ol','li','blockquote']);
export const escapePaperText=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function sanitizePaperHTML(html:string){
 return html.split(/(<[^>]*>)/g).map(part=>{
  if(!part.startsWith('<'))return part.replace(/</g,'&lt;');
  const tag=part.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>$/i);
  return tag&&ALLOWED.has(tag[2].toLowerCase())?'<'+tag[1]+tag[2].toLowerCase()+'>':'';
 }).join('');
}
export function paperTextHTML(text:string){return text.startsWith(PAPER_RICH_PREFIX)?sanitizePaperHTML(text.slice(PAPER_RICH_PREFIX.length)):escapePaperText(text).replace(/\n/g,'<br>')}
export function paperTextPlain(text:string){
 if(!text.startsWith(PAPER_RICH_PREFIX))return text;
 return sanitizePaperHTML(text.slice(PAPER_RICH_PREFIX.length)).replace(/<br>|<\/(?:p|div|li)>/g,'\n').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|nbsp);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&nbsp;':' '}[v]??v)).trim();
}
export function encodePaperHTML(html:string){
 const safe=sanitizePaperHTML(html);
 if(!paperTextPlain(PAPER_RICH_PREFIX+safe).trim())return '';
 return PAPER_RICH_PREFIX+safe;
}
