import {emptyTags,type PhotoTags} from './gallery';
import {paperCategory,type PaperCategory,type PaperMaterial} from './papers';
export type PaperFilters={group:PaperCategory|'all';material:PaperMaterial|'all';tags:PhotoTags;untagged:boolean};
export const emptyPaperFilters=():PaperFilters=>({group:'all',material:'all',tags:emptyTags(),untagged:false});
export function paperHasTags(tags:PhotoTags){return !!(tags.imageTypes.length||tags.weather.length||tags.timeOfDay||tags.area)}
export function paperMatchesFilters(paper:{title:string;category?:PaperCategory;material?:PaperMaterial},tags:PhotoTags|undefined,filters:PaperFilters){
 const value=tags??emptyTags(),wanted=filters.tags;
 return (filters.group==='all'||paperCategory(paper)===filters.group)
  &&(filters.material==='all'||(paper.material??'opaque')===filters.material)
  &&(!filters.untagged||!paperHasTags(value))
  &&(!wanted.imageTypes.length||wanted.imageTypes.some(id=>value.imageTypes.includes(id)))
  &&(!wanted.weather.length||wanted.weather.some(id=>value.weather.includes(id)))
  &&(!wanted.timeOfDay||wanted.timeOfDay===value.timeOfDay)
  &&(!wanted.area||wanted.area===value.area);
}
export function paperFilterCount(filters:PaperFilters){return Number(filters.group!=='all')+Number(filters.material!=='all')+Number(filters.untagged)+filters.tags.imageTypes.length+filters.tags.weather.length+Number(!!filters.tags.timeOfDay)+Number(!!filters.tags.area)}
