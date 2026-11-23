import {parseZurichDateTime} from './sun';

/** Upload dates are suggestions, never capture evidence without confirmation. */
export function captureEditTime({time,initialTime,savedCaptureAt,confirmed,moved}:{time:string;initialTime:string;savedCaptureAt?:number;confirmed:boolean;moved:boolean}):number|null{
 const parsed=time?parseZurichDateTime(time):null;
 if(parsed===null)return null;
 if(savedCaptureAt===undefined)return confirmed?parsed:null;
 if(time!==initialTime)return parsed;
 // Retain recorded seconds when recalculating only for a moved pin.
 return moved?savedCaptureAt:null;
}
