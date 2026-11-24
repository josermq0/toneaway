import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {Download,Pause,Play,Volume2,VolumeX} from 'lucide-react';
import {Waveform} from './Waveform';
import {encodeMonoWav} from '../audio/wavEncoder';
import {timeLabel} from '../utils/format';
interface Props {input:Float32Array|null;processed:Float32Array|null;sampleRate:number;onDownload:()=>void;}
export function AudioComparison({input,processed,sampleRate,onDownload}:Props){
  const [mode,setMode]=useState<'input'|'output'>('input');
  const [playing,setPlaying]=useState(false);
  const [position,setPosition]=useState(0);
  const [volume,setVolume]=useState(0.8);
  const [showVolume,setShowVolume]=useState(false);
  const audioRef=useRef<HTMLAudioElement>(null);
  const keepAt=useRef<{time:number;wasPlaying:boolean}>({time:0,wasPlaying:false});
  const inputUrl=useRef<string|null>(null);
  const outputUrl=useRef<string|null>(null);
  useEffect(()=>{
    if(input&&sampleRate)inputUrl.current=URL.createObjectURL(encodeMonoWav(input,sampleRate));
    else inputUrl.current=null;
    if(processed&&sampleRate)outputUrl.current=URL.createObjectURL(encodeMonoWav(processed,sampleRate));
    else outputUrl.current=null;
    const inputTmp=inputUrl.current,outputTmp=outputUrl.current;
    return ()=>{if(inputTmp)URL.revokeObjectURL(inputTmp);if(outputTmp)URL.revokeObjectURL(outputTmp);};
  },[input,processed,sampleRate]);
  useEffect(()=>{
    const element=audioRef.current;
    if(!element)return;
    const target=mode==='output'&&outputUrl.current?outputUrl.current:inputUrl.current;
    if(!target){element.pause();element.removeAttribute('src');element.load();setPosition(0);setPlaying(false);return;}
    if(element.src===target)return;
    keepAt.current={time:input&&sampleRate?Math.min(position,input.length/sampleRate-.001):0,wasPlaying:!element.paused&&!!element.src};
    element.pause();element.src=target;element.load();
    const onMetadata=()=>{
      try {element.currentTime=Math.max(0,Math.min(keepAt.current.time,(element.duration||1)-.001));}catch{/* metadata race */}
      if(keepAt.current.wasPlaying)element.play().catch(()=>setPlaying(false));
    };
    element.addEventListener('loadedmetadata',onMetadata,{once:true});
    return ()=>element.removeEventListener('loadedmetadata',onMetadata);
    // position is deliberately not a dependency: changing slider must not reload audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input,processed,sampleRate,mode]);
  useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume;},[volume]);
  useEffect(()=>{setMode(processed?'output':'input');},[processed]);
  const currentSamples=mode==='output'&&processed?processed:input;
  const duration=input&&sampleRate?input.length/sampleRate:0;
  const toggle=async()=>{
    const el=audioRef.current;if(!el||!input)return;
    if(el.paused){try{await el.play();}catch{setPlaying(false);}} else el.pause();
  };
  const selectMode=(next:'input'|'output')=>{
    if(next==='output'&&!processed)return;
    if(next!==mode)setMode(next);
  };
  const progress=duration?Math.min(1,position/duration):0;
  return <section className="panel compare-panel">
    <div className="section-heading comparison-heading">
      <div className="heading-title"><span className="audio-square-icon">≈</span><div><h2>Comparación de audio</h2><p>Escucha ambos resultados desde el mismo instante.</p></div></div>
      <div className="compare-actions"><div className="segment" role="group" aria-label="Versión de audio">
        <button type="button" className={mode==='input'?'on input-active':''} onClick={()=>selectMode('input')} disabled={!input}>Entrada</button>
        <button type="button" className={mode==='output'?'on output-active':''} onClick={()=>selectMode('output')} disabled={!processed}>Procesado</button>
      </div>
      <button type="button" className="download-button" disabled={!processed} onClick={onDownload}><Download size={17}/> Descargar WAV</button></div>
    </div>
    <div className="waveform-wrap"><Waveform samples={currentSamples??null} progress={progress} variant={mode==='output'?'output':'input'}/>{!input&&<div className="waveform-placeholder">Carga un audio para escucharlo aquí</div>}</div>
    <div className="transport">
      <button className="play-button" onClick={toggle} disabled={!input} aria-label={playing?'Pausar audio':'Reproducir audio'}>{playing?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button>
      <span className="time-indicator">{timeLabel(position)} <span>/</span> {timeLabel(duration)}</span>
      <input aria-label="Posición de reproducción" className="audio-seek" type="range" min={0} max={Math.max(0.01,duration)} step={0.01} value={Math.min(duration,position)} disabled={!input} onChange={e=>{const v=Number(e.target.value);if(audioRef.current)audioRef.current.currentTime=v;setPosition(v);}} style={{'--progress':`${progress*100}%`} as CSSProperties}/>
      <div className="volume-control"><button className="volume-button" title="Volumen" aria-label="Ajustar volumen" onClick={()=>setShowVolume(v=>!v)}>{volume===0?<VolumeX size={21}/>:<Volume2 size={21}/>}</button>{showVolume&&<input aria-label="Volumen" type="range" min={0} max={1} step={.05} value={volume} onChange={e=>setVolume(Number(e.target.value))}/>}</div>
      <audio ref={audioRef} preload="auto" onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>{setPlaying(false);setPosition(0);}}/>
    </div>
  </section>;
}
