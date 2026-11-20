import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AudioLines, Camera, CircleStop, Download, Eye, LayoutGrid, Music2, Play, Save, ShieldCheck, Sparkles, Users, Video, Volume2 } from "lucide-react";
import StageView from "./components/StageView";
import MetricCard from "./components/MetricCard";
import { getPoseLandmarker,toWorldPoints } from "./lib/pose";
import { angularVelocity,dtwDistance,jointMetrics,sequenceFeature,smoothFrames } from "./lib/kinematics";
import { analyzeAudio,type BeatEvent } from "./lib/audio";
import { loadFormations,loadReferences,saveFormation,saveReference } from "./lib/storage";
import type { Dancer,Formation,Point3,PoseFrame } from "./types";

const palette=["#d5a66f","#90b7a2","#c49acb","#8aa7d8","#d58b82","#d0c27d"];
const initialDancers:Dancer[]=[{id:"1",name:"Dancer 1",x:2,z:2,color:palette[0]},{id:"2",name:"Dancer 2",x:4,z:2,color:palette[1]},{id:"3",name:"Dancer 3",x:3,z:3.5,color:palette[2]}];
type Tab="technique"|"formations"|"accessibility";
export default function App(){
  const [tab,setTab]=useState<Tab>("technique");
  const [status,setStatus]=useState("Camera not started");
  const [running,setRunning]=useState(false);
  const [landmarks,setLandmarks]=useState<Point3[]>([]);
  const [frames,setFrames]=useState<PoseFrame[]>([]);
  const [referenceName,setReferenceName]=useState("My reference");
  const [references,setReferences]=useState(loadReferences);
  const [metrics,setMetrics]=useState<ReturnType<typeof jointMetrics>>(null);
  const [velocity,setVelocity]=useState(0);
  const [previousAngle,setPreviousAngle]=useState<number>();
  const [previousTime,setPreviousTime]=useState(0);
  const [dancers,setDancers]=useState<Dancer[]>(initialDancers);
  const [formations,setFormations]=useState<Formation[]>(loadFormations);
  const [formationName,setFormationName]=useState("New formation");
  const [selectedDancer,setSelectedDancer]=useState("1");
  const [audioName,setAudioName]=useState("");
  const [beats,setBeats]=useState<BeatEvent[]>([]);
  const [audioUrl,setAudioUrl]=useState("");
  const [audioPlaying,setAudioPlaying]=useState(false);
  const [beatFlash,setBeatFlash]=useState(true);
  const [sonify,setSonify]=useState(false);
  const [highContrast,setHighContrast]=useState(false);
  const [beatOn,setBeatOn]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const rafRef=useRef<number>(0);
  const audioRef=useRef<HTMLAudioElement>(null);
  const metricsRef=useRef<typeof metrics>(null);
  const lastBeatRef=useRef(-1);

  const stopCamera=useCallback(()=>{cancelAnimationFrame(rafRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setRunning(false);setStatus("Camera stopped");},[]);
  const detect=useCallback(async()=>{
    const video=videoRef.current;if(!video||video.readyState<2)return;
    try{
      const task=await getPoseLandmarker();
      const result=task.detectForVideo(video,performance.now());
      const points=toWorldPoints(result);
      if(points.length>=33){
        const now=performance.now(),m=jointMetrics(points);
        setLandmarks(points);setMetrics(m);
        if(m){setVelocity(angularVelocity(previousAngle,m.leftKnee,now-previousTime));setPreviousAngle(m.leftKnee);setPreviousTime(now);metricsRef.current=m;
          if(sonify){/* sonification is scheduled from the effect below */}}
        setFrames(old=>{const next=[...old,{timestamp:Date.now(),landmarks:points}];return next.slice(-900)});
        setStatus("Tracking 33 body landmarks");
      }
    }catch(e){setStatus("Pose tracking error. Check model/network access.");console.error(e)}
    rafRef.current=requestAnimationFrame(detect);
  },[previousAngle,previousTime,sonify]);
  const startCamera=async()=>{
    try{
      setStatus("Requesting camera permission…");
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:720}},audio:false});
      streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setRunning(true);setStatus("Camera ready");rafRef.current=requestAnimationFrame(detect);
    }catch{setStatus("Camera unavailable. Allow camera access and use HTTPS or localhost.");}
  };
  useEffect(()=>()=>{cancelAnimationFrame(rafRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());if(audioUrl)URL.revokeObjectURL(audioUrl)},[audioUrl]);
  useEffect(()=>{
    if(!sonify||!metrics)return;
    const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.frequency.value=220+Math.max(0,Math.min(1,metrics.leftExtension))*440;gain.gain.value=.035;
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.08);
    return()=>{void ctx.close()};
  },[sonify,metrics?.leftExtension]);

  const recordReference=()=>{
    if(frames.length<10){alert("Record at least a few seconds of movement first.");return}
    const cleaned=smoothFrames(frames.slice(-600));saveReference(referenceName,cleaned);setReferences(loadReferences());
    alert(`Saved ${cleaned.length} local pose frames as “${referenceName}”.`);
  };
  const compare=()=>{
    const names=Object.keys(references);if(!names.length||frames.length<10){alert("Record a reference and capture a performance first.");return}
    const name=names[0],score=dtwDistance(sequenceFeature(frames.slice(-600)),sequenceFeature(references[name]));
    alert(`DTW feature distance vs “${name}”: ${score.toFixed(3)}. Lower means closer for this knee-angle feature only.`);
  };
  const loadAudio=async(file?:File)=>{
    if(!file)return;
    try{const result=await analyzeAudio(file);setBeats(result.beats);setAudioName(file.name);if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl(URL.createObjectURL(file));}
    catch{alert("This audio file could not be decoded by the browser.");}
  };
  const saveCurrentFormation=()=>{
    const f:Formation={id:crypto.randomUUID(),name:formationName,dancers,updatedAt:Date.now()};
    saveFormation(f);setFormations(loadFormations());
  };
  const exportSession=()=>{
    const blob=new Blob([JSON.stringify({format:"choreokinematics-pose-v1",createdAt:new Date().toISOString(),frames:smoothFrames(frames)},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="choreokinematics-pose-session.json";a.click();URL.revokeObjectURL(url);
  };
  const spacingIssues=useMemo(()=>{
    const issues:string[]=[];for(let i=0;i<dancers.length;i++)for(let j=i+1;j<dancers.length;j++){
      const d=Math.hypot(dancers[i].x-dancers[j].x,dancers[i].z-dancers[j].z);
      if(d<.9)issues.push(`${dancers[i].name} / ${dancers[j].name}: ${d.toFixed(1)}m spacing`);
    }return issues;
  },[dancers]);
  const currentBeat=beats.length?beats.reduce((best,b)=>Math.abs(b.time-(audioRef.current?.currentTime??0))<Math.abs(best.time-(audioRef.current?.currentTime??0))?b:best):null;
  const handleAudioTime=()=>{
    const t=audioRef.current?.currentTime??0;
    const idx=beats.findIndex(b=>Math.abs(b.time-t)<.055);
    setBeatOn(idx>=0 && idx!==lastBeatRef.current);if(idx>=0)lastBeatRef.current=idx;
  };
  const updateDancer=(id:string,patch:Partial<Dancer>)=>setDancers(ds=>ds.map(d=>d.id===id?{...d,...patch}:d));
  const importPose=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];if(!file)return;
    file.text().then(t=>{try{const data=JSON.parse(t);if(data.format!=="choreokinematics-pose-v1"||!Array.isArray(data.frames))throw Error();setFrames(data.frames);alert("Pose sequence imported locally.");}catch{alert("That file is not a supported ChoreoKinematics pose export.");}});
  };
  return <main className={highContrast?"app high-contrast":"app"}>
    <header className="topbar"><div className="brand-mark">CK</div><div><div className="brand">CHOREOKINEMATICS</div><div className="subbrand">MOVEMENT INTELLIGENCE STUDIO <span>• BETA 0.1</span></div></div><div className="top-spacer"/><div className="privacy"><ShieldCheck size={15}/> LOCAL PROCESSING</div></header>
    <section className="hero"><div><div className="eyebrow">DANCE × ENGINEERING × DESIGN</div><h1>Make every movement<br/><i>mean something.</i></h1><p>A private rehearsal workspace for technique analysis, musical timing, and spatial choreography.</p></div><div className="hero-stats"><div><strong>33</strong><span>POSE LANDMARKS</span></div><div><strong>3D</strong><span>STAGE VIEW</span></div><div><strong>0</strong><span>VIDEO UPLOADS</span></div></div></section>
    <nav className="tabs">
      <button className={tab==="technique"?"active":""} onClick={()=>setTab("technique")}><Activity size={16}/> Technique Lab</button>
      <button className={tab==="formations"?"active":""} onClick={()=>setTab("formations")}><LayoutGrid size={16}/> Stage & Formations</button>
      <button className={tab==="accessibility"?"active":""} onClick={()=>setTab("accessibility")}><Eye size={16}/> Access Modes</button>
    </nav>
    {tab==="technique"&&<section className="workspace">
      <div className="section-heading"><div><span className="eyebrow">01 / LIVE CAPTURE</span><h2>Technique lab</h2></div><div className="status"><span className={running?"dot live":"dot"}/>{status}</div></div>
      <div className="capture-grid">
        <div className="panel camera-panel"><div className="panel-head"><span><Camera size={15}/> CAMERA FEED</span><span className="tiny-tag">ON-DEVICE</span></div><div className="camera-box"><video ref={videoRef} playsInline muted/><div className="camera-overlay">{!running&&<div className="camera-empty"><Video size={34}/><span>Camera preview appears here</span><small>Your video stays on this device</small></div>}{beatOn&&beatFlash&&<div className="beat-flash">BEAT</div>}</div></div><div className="camera-actions"><button className="primary" onClick={running?stopCamera:startCamera}>{running?<><CircleStop size={15}/> Stop camera</>:<><Camera size={15}/> Start camera</>}</button><span className="muted">{frames.length} frames captured in this session</span></div></div>
        <div className="panel skeleton-panel"><div className="panel-head"><span><Sparkles size={15}/> 3D SKELETON VIEW</span><span className="tiny-tag">WORLD LANDMARK ESTIMATE</span></div><StageView landmarks={landmarks} dancers={[]} mode="pose"/><div className="view-foot">Estimated pose depth • Not laboratory motion capture</div></div>
      </div>
      <div className="metrics-grid">
        <MetricCard label="LEFT KNEE ANGLE" value={metrics?metrics.leftKnee.toFixed(1):"—"} unit="°" hint="3-point joint angle"/>
        <MetricCard label="RIGHT KNEE ANGLE" value={metrics?metrics.rightKnee.toFixed(1):"—"} unit="°" hint="3-point joint angle"/>
        <MetricCard label="LEFT KNEE ANGULAR VELOCITY" value={velocity.toFixed(1)} unit="°/s" hint="Frame-to-frame estimate"/>
        <MetricCard label="BALANCE PROXY" value={metrics?metrics.stabilityProxy.toFixed(3):"—"} unit="m*" hint="COM proxy to ankle midpoint"/>
      </div>
      <div className="lower-grid">
        <div className="panel"><div className="panel-head"><span><Activity size={15}/> ALIGNMENT INDICATORS</span><span className="tiny-tag">LIVE ESTIMATES</span></div>
          <div className="indicator-list"><Indicator label="Shoulder line tilt" value={metrics?`${metrics.shoulderTilt.toFixed(1)}°`:"—"}/><Indicator label="Hip line tilt" value={metrics?`${metrics.hipTilt.toFixed(1)}°`:"—"}/><Indicator label="Left arm extension" value={metrics?metrics.leftExtension.toFixed(2):"—"}/><Indicator label="Right arm extension" value={metrics?metrics.rightExtension.toFixed(2):"—"}/></div>
          <p className="note">*Balance is a simplified geometric proxy. These values are not clinical or injury-risk scores.</p></div>
        <div className="panel"><div className="panel-head"><span><Sparkles size={15}/> REFERENCE COMPARISON</span><span className="tiny-tag">DTW</span></div>
          <label className="field-label">Reference sequence name</label><input value={referenceName} onChange={e=>setReferenceName(e.target.value)}/>
          <div className="button-row"><button className="secondary" onClick={recordReference}><Save size={14}/> Save current reference</button><button className="secondary" onClick={compare}>Compare performance</button></div>
          <div className="saved-list">{Object.keys(references).length?Object.keys(references).map(n=><span key={n}>{n} <small>{references[n].length} frames</small></span>):<span className="muted">No references saved yet. Capture a phrase, then save it.</span>}</div>
          <p className="note">DTW currently compares left-knee angle trajectories. Lower distance means closer timing/shape for that one feature, not overall dance quality.</p></div>
      </div>
      <div className="panel audio-panel"><div className="panel-head"><span><Music2 size={15}/> MUSIC & BEAT SYNC</span><span className="tiny-tag">WEB AUDIO</span></div>
        <div className="audio-content"><label className="upload-button"><Music2 size={15}/> Load audio file<input type="file" accept="audio/*" onChange={e=>loadAudio(e.target.files?.[0])}/></label><div className="audio-info">{audioName||"No audio loaded"}<small>{beats.length?`${beats.length} candidate accents detected`:"Energy-onset beat estimation"}</small></div>{audioUrl&&<audio ref={audioRef} src={audioUrl} controls onTimeUpdate={handleAudioTime} onPlay={()=>setAudioPlaying(true)} onPause={()=>setAudioPlaying(false)}/>}</div>
        <div className="beat-track">{Array.from({length:60},(_,i)=><span key={i} style={{height:`${beats[i]?Math.min(100,22+beats[i].strength*900):8}%`}} className={beats[i]?"accent":""}/>)}</div><p className="note">Audio is decoded locally. Beat positions are approximate onset candidates; output latency is device-dependent and is not guaranteed to be millisecond-accurate.</p>
      </div>
      <div className="utility-row"><button className="secondary" onClick={exportSession}><Download size={14}/> Export anonymized pose JSON</button><label className="secondary file-label"><Download size={14}/> Import pose JSON<input type="file" accept=".json,application/json" onChange={importPose}/></label><button className="secondary" onClick={()=>{setFrames([]);setLandmarks([]);setMetrics(null)}}>Clear current capture</button></div>
    </section>}
    {tab==="formations"&&<section className="workspace"><div className="section-heading"><div><span className="eyebrow">02 / SPATIAL DESIGN</span><h2>Stage & formations</h2></div><span className="tiny-tag">TOP-DOWN COORDINATES • METERS</span></div>
      <div className="formation-grid"><div className="panel stage-panel"><div className="panel-head"><span><LayoutGrid size={15}/> 3D STAGE PREVIEW</span><span className="tiny-tag">AUDIENCE VIEW</span></div><StageView landmarks={[]} dancers={dancers} mode="stage"/><div className="view-foot">Front of stage is marked by the gold arrow</div></div>
      <div className="panel dancer-panel"><div className="panel-head"><span><Users size={15}/> DANCER PLACEMENT</span><span className="tiny-tag">{dancers.length} DANCERS</span></div>
        <div className="dancer-list">{dancers.map(d=><button key={d.id} className={selectedDancer===d.id?"dancer-row selected":"dancer-row"} onClick={()=>setSelectedDancer(d.id)}><i style={{background:d.color}}/><span>{d.name}</span><small>x {d.x.toFixed(1)} / z {d.z.toFixed(1)}</small></button>)}</div>
        {dancers.filter(d=>d.id===selectedDancer).map(d=><div className="placement-controls" key={d.id}><label>{d.name} · X position <b>{d.x.toFixed(1)}m</b></label><input type="range" min="0" max="8" step=".1" value={d.x} onChange={e=>updateDancer(d.id,{x:Number(e.target.value)})}/><label>Z position <b>{d.z.toFixed(1)}m</b></label><input type="range" min="0" max="6" step=".1" value={d.z} onChange={e=>updateDancer(d.id,{z:Number(e.target.value)})}/></div>)}
        <div className="button-row"><button className="secondary" onClick={()=>setDancers(ds=>[...ds,{id:crypto.randomUUID(),name:`Dancer ${ds.length+1}`,x:4,z:3,color:palette[ds.length%palette.length]}])}>+ Add dancer</button><button className="secondary" onClick={()=>setDancers(initialDancers)}>Reset</button></div>
        <label className="field-label">Formation name</label><input value={formationName} onChange={e=>setFormationName(e.target.value)}/><button className="primary full" onClick={saveCurrentFormation}><Save size={14}/> Save formation locally</button>
      </div></div>
      <div className="panel spacing-panel"><div className="panel-head"><span><ShieldCheck size={15}/> SPACING CHECK</span><span className={spacingIssues.length?"warning-tag":"tiny-tag"}>{spacingIssues.length?`${spacingIssues.length} CLOSE PAIRS`:"NO CLOSE PAIRS"}</span></div>{spacingIssues.length?spacingIssues.map(s=><div className="warning-line" key={s}>{s} <small>Suggested minimum spacing: 0.9m</small></div>):<p className="success-line">All current dancer markers are at least 0.9m apart. This is a simplified 2D spacing check.</p>}</div>
      <div className="panel"><div className="panel-head"><span>LOCAL FORMATION LIBRARY</span><span className="tiny-tag">{formations.length} SAVED</span></div><div className="formation-library">{formations.length?formations.map(f=><button key={f.id} onClick={()=>setDancers(f.dancers)}><strong>{f.name}</strong><small>{f.dancers.length} dancers · {new Date(f.updatedAt).toLocaleDateString()}</small></button>):<span className="muted">Save a formation to build your library.</span>}</div></div>
    </section>}
    {tab==="accessibility"&&<section className="workspace"><div className="section-heading"><div><span className="eyebrow">03 / INCLUSIVE INTERACTION</span><h2>Access modes</h2></div><span className="tiny-tag">PERSONALIZE FEEDBACK</span></div>
      <div className="access-grid"><div className="panel access-card"><div className="access-icon"><Eye/></div><h3>High-contrast interface</h3><p>Increase contrast for labels, panels, and status indicators.</p><Toggle checked={highContrast} onChange={setHighContrast} label="Enable high contrast"/></div>
      <div className="panel access-card"><div className="access-icon"><AudioLines/></div><h3>Visual beat flash</h3><p>Show a large visual cue when playback reaches a detected beat candidate.</p><Toggle checked={beatFlash} onChange={setBeatFlash} label="Enable visual beat flash"/></div>
      <div className="panel access-card"><div className="access-icon"><Volume2/></div><h3>Joint-height sonification</h3><p>Play a brief tone whose pitch changes with the left wrist's height estimate.</p><Toggle checked={sonify} onChange={setSonify} label="Enable sonification"/></div></div>
      <div className="panel"><div className="panel-head"><span><ShieldCheck size={15}/> PRIVACY & CONSENT</span><span className="tiny-tag">BY DESIGN</span></div><ul className="privacy-list"><li>Camera frames are processed in-browser and are not uploaded by this app.</li><li>Only skeletal coordinates are retained in the current session unless you save or export them.</li><li>Ask permission before capturing or analyzing another dancer, especially minors.</li><li>Use a personal device or clear local browser storage after a shared-studio session.</li></ul></div>
    </section>}
    <footer><span>CHOREOKINEMATICS / PROTOTYPE 0.1</span><span>BUILT FOR MOVEMENT, DESIGNED FOR PRIVACY</span></footer>
  </main>;
}
function Indicator({label,value}:{label:string;value:string}){return <div className="indicator"><span>{label}</span><strong>{value}</strong></div>}
function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){return <label className="toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><i/></label>}
