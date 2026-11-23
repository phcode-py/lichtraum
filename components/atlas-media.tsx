'use client';
import AutoVideo from './auto-video';
import {useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';
import {videoThumbnailSrc} from '@/lib/media';

// Outside the components, so changing the video's own playback position is plain DOM work.
const setTimeOf=(v:HTMLVideoElement,t:number)=>{v.currentTime=t};
const playVideo=(v:HTMLVideoElement)=>{void v.play().catch(()=>{})};
const pauseVideo=(v:HTMLVideoElement)=>v.pause();
const clock=(s:number)=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';

/** Play/pause and a time bar over a small video; they appear only while pointing at it. */
function HoverControls({video,held,onHeld}:{video:HTMLVideoElement|null;held:boolean;onHeld:(held:boolean)=>void}){
 const[time,setTime]=useState(0),[duration,setDuration]=useState(0),[playing,setPlaying]=useState(false),dragging=useRef(false);
 useEffect(()=>{
  const v=video;if(!v)return;
  const update=()=>{if(!dragging.current)setTime(v.currentTime);setDuration(v.duration||0);setPlaying(!v.paused)};
  const events=['timeupdate','durationchange','loadedmetadata','play','pause'];
  events.forEach(e=>v.addEventListener(e,update));update();
  return()=>events.forEach(e=>v.removeEventListener(e,update));
 },[video]);
 const stop=(e:React.SyntheticEvent)=>e.stopPropagation();
 function toggle(e:React.MouseEvent){e.stopPropagation();e.preventDefault();if(!video)return;if(video.paused){onHeld(false);playVideo(video)}else{onHeld(true);pauseVideo(video)}}
 function seek(value:number){if(!video||!duration)return;setTimeOf(video,value);setTime(value)}
 return <div className="video-hover-controls" onClick={stop} onPointerDown={stop}>
  <button type="button" className="video-hover-play" aria-label={playing&&!held?'Pause video':'Play video'} onClick={toggle}>{playing&&!held?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button>
  <div className="video-hover-bar">
   <input type="range" aria-label="Video position" min={0} max={duration||0} step={0.05} value={Math.min(time,duration||0)} disabled={!duration} onPointerDown={()=>{dragging.current=true}} onPointerUp={()=>{dragging.current=false}} onChange={e=>seek(Number(e.target.value))} style={{'--progress':`${duration?time/duration*100:0}%`} as React.CSSProperties}/>
   <span>{clock(time)} / {clock(duration)}</span>
  </div>
 </div>;
}

export default function AtlasMedia({url,title,mediaType,className='',controls=false}:{url:string;title:string;mediaType?:'photo'|'video';className?:string;controls?:boolean}) {
 const [failed,setFailed]=useState(''),[held,setHeld]=useState(false),[video,setVideo]=useState<HTMLVideoElement|null>(null);
 if(mediaType!=='video')return <img className={className} src={url} alt={title} loading="lazy"/>;
 return <div className={'atlas-video '+className}>
  <AutoVideo key={url} onElement={setVideo} held={held} src={videoThumbnailSrc(url,controls)} aria-label={title} controls={controls} playsInline preload="metadata" onError={()=>setFailed(url)}/>
  {!controls&&failed!==url&&<HoverControls video={video} held={held} onHeld={setHeld}/>}
  {failed===url&&<span className="video-fallback">{controls?<>This video cannot play in this browser. <a href={url} target="_blank" rel="noreferrer">Open video</a></>:<><Play size={22} strokeWidth={1.4}/>Video · open to view</>}</span>}
 </div>;
}
