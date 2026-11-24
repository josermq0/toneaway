import {useCallback,useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {
  Activity,AudioLines,Check,CheckCircle2,ChevronDown,CircleHelp,Clock3,
  FileAudio2,FileUp,FolderOpen,Info,LoaderCircle,PenLine,
  Plus,ShieldCheck,SlidersHorizontal,TriangleAlert,WandSparkles,X,
} from 'lucide-react';
import {SpectrumChart} from './components/SpectrumChart';
import {AudioComparison} from './components/AudioComparison';
import {decodeAudioFile,fetchDemo} from './audio/decoder';
import {encodeMonoWav} from './audio/wavEncoder';
import {freqLabel,timeLabel} from './utils/format';
import type {DecodedAudio} from './audio/decoder';
import type {SpectrumData,ProcessingDiagnostics,WorkerRequest,WorkerResponse} from './types/audio';
import './styles.css';

type Status='empty'|'loading'|'ready'|'processing'|'done'|'error';
type Pending={resolve:(value:WorkerResponse)=>void;reject:(reason:Error)=>void};
type WithoutRequestId<T> = T extends {requestId:number} ? Omit<T,'requestId'> : never;

function App(){
  const [status,setStatus]=useState<Status>('empty');
  const [audio,setAudio]=useState<DecodedAudio|null>(null);
  const [inputSpectrum,setInputSpectrum]=useState<SpectrumData|null>(null);
  const [processed,setProcessed]=useState<Float32Array|null>(null);
  const [outputSpectrum,setOutputSpectrum]=useState<SpectrumData|null>(null);
  const [diagnostics,setDiagnostics]=useState<ProcessingDiagnostics|null>(null);
  const [selected,setSelected]=useState<number[]>([]);
  const [frequencyText,setFrequencyText]=useState('');
  const [editing,setEditing]=useState<number|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [help,setHelp]=useState(false);
  const inputRef=useRef<HTMLInputElement|null>(null);
  const workerRef=useRef<Worker|null>(null);
  const pendingRef=useRef(new Map<number,Pending>());
  const nextId=useRef(1);
  const loadSeq=useRef(0);
  const busy=status==='loading'||status==='processing';

  useEffect(()=>{
    const worker=new Worker(new URL('./workers/processing.worker.ts',import.meta.url),{type:'module'});
    workerRef.current=worker;
    worker.onmessage=(event:MessageEvent<WorkerResponse>)=>{
      const res=event.data;
      const pending=pendingRef.current.get(res.requestId);if(!pending)return;
      pendingRef.current.delete(res.requestId);
      if(res.type==='failed')pending.reject(new Error(res.error));else pending.resolve(res);
    };
    worker.onerror=()=>{
      for(const pending of pendingRef.current.values())pending.reject(new Error('El procesador de audio dejó de responder. Vuelve a cargar la página.'));
      pendingRef.current.clear();
    };
    return ()=>{
      worker.terminate();workerRef.current=null;
      for(const p of pendingRef.current.values())p.reject(new Error('Procesamiento cancelado.'));
      pendingRef.current.clear();
    };
  },[]);

  const submitWorker=useCallback((request:WithoutRequestId<WorkerRequest>):Promise<WorkerResponse>=>{
    const worker=workerRef.current;
    if(!worker)return Promise.reject(new Error('Procesador no disponible.'));
    const requestId=nextId.current++;
    const payload={...request,requestId} as WorkerRequest;
    const buffer=payload.samples.buffer as ArrayBuffer;
    return new Promise((resolve,reject)=>{
      pendingRef.current.set(requestId,{resolve,reject});
      try{worker.postMessage(payload,[buffer]);}
      catch(e){pendingRef.current.delete(requestId);reject(e);}
    });
  },[]);

  const invalidateResult=()=>{
    setProcessed(null);setOutputSpectrum(null);setDiagnostics(null);
    setStatus(old=>old==='done'?'ready':old);
  };

  const loadDecoded=async(decoded:DecodedAudio)=>{
    const ticket=++loadSeq.current;
    setStatus('loading');setError(null);setAudio(null);setInputSpectrum(null);
    setSelected([]);setEditing(null);setFrequencyText('');invalidateResult();
    try{
      const response=await submitWorker({type:'analyze',samples:new Float32Array(decoded.samples),sampleRate:decoded.sampleRate});
      if(ticket!==loadSeq.current)return;
      if(response.type!=='analyzed')throw new Error('Respuesta de análisis inválida.');
      setAudio(decoded);setInputSpectrum(response.spectrum);setStatus('ready');
    }catch(e){
      if(ticket!==loadSeq.current)return;
      setError(e instanceof Error?e.message:'Error al cargar el audio.');setStatus('error');
    }
  };
  const loadFile=async(file:File)=>{
    const ticket=++loadSeq.current;
    setStatus('loading');setError(null);
    try{const decoded=await decodeAudioFile(file);if(ticket!==loadSeq.current)return;await loadDecoded(decoded);}
    catch(e){if(ticket!==loadSeq.current)return;setError(e instanceof Error?e.message:'No se pudo abrir el archivo.');setStatus(audio?'ready':'error');}
  };
  const loadDemo=async()=>{
    const ticket=++loadSeq.current;setStatus('loading');setError(null);
    try{const decoded=await fetchDemo();if(ticket!==loadSeq.current)return;await loadDecoded(decoded);}
    catch(e){if(ticket!==loadSeq.current)return;setError(e instanceof Error?e.message:'No se pudo abrir el ejemplo.');setStatus(audio?'ready':'error');}
  };
  const setFrequency=(f:number,replace:number|null=null)=>{
    if(!audio||busy)return;
    const maximumHz=Math.min(20000,audio.sampleRate/2-1);
    if(!Number.isFinite(f)||f<20||f>maximumHz) {
      setError(`Introduce una frecuencia entre 20 Hz y ${Math.floor(maximumHz)} Hz.`);return;
    }
    const tolerance=0.25/audio.duration;
    if(selected.some(x=>x!==replace&&Math.abs(x-f)<tolerance)) {
      setError(`Esta frecuencia está demasiado cerca de otra seleccionada (separación mínima: ${tolerance.toFixed(2)} Hz).`);return;
    }
    if(replace===null&&selected.length>=6){setError('Este prototipo admite un máximo de seis frecuencias por procesamiento.');return;}
    setSelected(current=>(replace!==null?current.map(v=>v===replace?f:v):[...current,f]).sort((a,b)=>a-b));
    setEditing(null);setFrequencyText('');setError(null);invalidateResult();
  };
  const addFrequencyFromChart=(frequencyHz:number)=>setFrequency(frequencyHz);
  const saveFrequency=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const f=Number(frequencyText.trim().replace(',','.'));
    setFrequency(Math.round(f*100)/100,editing);
  };
  const removeFrequency=(f:number)=>{
    setSelected(current=>current.filter(v=>v!==f));
    if(editing===f){setEditing(null);setFrequencyText('');}
    setError(null);invalidateResult();
  };
  const process=async()=>{
    if(!audio||selected.length===0||busy)return;
    setStatus('processing');setError(null);setProcessed(null);setOutputSpectrum(null);setDiagnostics(null);
    try{
      const res=await submitWorker({type:'process',samples:new Float32Array(audio.samples),sampleRate:audio.sampleRate,frequencies:selected,tolerance:1e-8,maxIterations:2000});
      if(res.type!=='processed')throw new Error('Respuesta del procesador inválida.');
      setProcessed(res.samples);setOutputSpectrum(res.spectrum);setDiagnostics(res.diagnostics);setStatus('done');
    }catch(e){setError(e instanceof Error?e.message:'No se pudo procesar el archivo.');setStatus('ready');}
  };
  const download=()=>{
    if(!processed||!audio)return;
    const blob=encodeMonoWav(processed,audio.sampleRate);
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;
    const stem=audio.name.replace(/\.[^.]+$/,'');link.download=`${stem}_toneaway.wav`;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),3000);
  };
  const suggestions=(inputSpectrum?.peaks??[])
    .filter(p=>selected.every(s=>Math.abs(s-p.frequencyHz)>0.2))
    .slice(0,6);
  const selectedClose=selected.some((f,i)=>selected.some((g,j)=>j>i&&Math.abs(f-g)<2/(audio?.duration??1)));

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="logo-mark"><AudioLines size={34} strokeWidth={2.7}/></div><strong>ToneAway</strong><div className="brand-divider"/><span>Atenuación de interferencia tonal en voz</span></div>
      <button className="help-button" title="Acerca de ToneAway" aria-label="Acerca de ToneAway" onClick={()=>setHelp(true)}><CircleHelp size={23}/></button>
    </header>

    <main className="workspace">
      <aside className="sidebar">
        <section className="panel source-panel">
          <div className="section-heading"><div className="heading-title"><FileAudio2 size={25}/><h2>Audio de origen</h2></div></div>
          {audio?<div className="file-details"><div className="file-name" title={audio.name}>{audio.name}</div><div className="file-meta"><span><Clock3 size={14}/>{timeLabel(audio.duration)}</span><span>{(audio.sampleRate/1000).toFixed(1)} kHz</span><span>{audio.channels>1?'Estéreo → mono':'Mono'}</span></div></div>
            :<p className="sidebar-description">Carga una grabación de voz que ya contenga tonos no deseados.</p>}
          <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void loadFile(file);e.target.value='';}}/>
          <button className="secondary-wide" disabled={busy} onClick={()=>inputRef.current?.click()}><FolderOpen size={17}/>{audio?'Cambiar archivo':'Subir audio'}</button>
          <button className="example-button" disabled={busy} onClick={()=>void loadDemo()}><FileUp size={16}/>{audio?'Cargar archivo de ejemplo':'Usar grabación de ejemplo'}</button>
        </section>

        <section className="panel selection-panel">
          <div className="section-heading"><div className="heading-title"><SlidersHorizontal size={23}/><h2>Frecuencias seleccionadas</h2></div></div>
          <p className="sidebar-description">Selecciona picos del espectro o introduce una frecuencia precisa.</p>
          <form className="frequency-form" onSubmit={saveFrequency}>
            <label className="sr-only" htmlFor="frequency-input">Frecuencia en hercios</label>
            <div className="frequency-input-wrap"><input id="frequency-input" type="text" inputMode="decimal" placeholder="Frecuencia (Hz)" value={frequencyText} onChange={e=>setFrequencyText(e.target.value)} disabled={!audio||busy}/></div>
            <button type="submit" className="mini-primary" disabled={!audio||busy||!frequencyText.trim()||(selected.length>=6&&editing===null)}>{editing===null?'Agregar':'Actualizar'}</button>
          </form>
          {editing!==null&&<div className="edit-hint">Editando {freqLabel(editing)} <button onClick={()=>{setEditing(null);setFrequencyText('');}}>Cancelar</button></div>}
          <div className="selected-tags" aria-label="Tonos seleccionados">
            {selected.length?selected.map(f=><div className="frequency-chip" key={f}>
              <button className="chip-edit" type="button" disabled={busy} title={`Editar ${freqLabel(f)}`} onClick={()=>{setEditing(f);setFrequencyText(String(f));document.getElementById('frequency-input')?.focus();}}>{freqLabel(f)} <PenLine size={12}/></button>
              <button className="chip-remove" type="button" disabled={busy} title={`Quitar ${freqLabel(f)}`} aria-label={`Quitar ${freqLabel(f)}`} onClick={()=>removeFrequency(f)}><X size={14}/></button>
            </div>):<p className="chip-placeholder">Aún no has seleccionado frecuencias.</p>}
          </div>
          <div className="chip-capacity">{selected.length} de 6 tonos seleccionados</div>
          <div className="suggestions-head"><span><Activity size={17}/> Picos sugeridos</span><span className="info-inline" title="Sugerencias estimadas a partir del espectro. Pueden incluir componentes legítimos de la voz."><Info size={15}/></span></div>
          <div className="suggestion-chips">{suggestions.length?suggestions.map(p=><button key={p.frequencyHz} type="button" className="suggestion-chip" onClick={()=>setFrequency(p.frequencyHz)} disabled={busy||!audio||selected.length>=6} title={`Pico espectral sugerido: ${freqLabel(p.frequencyHz)}. Revisar antes de seleccionar.`}><Plus size={12}/>{freqLabel(p.frequencyHz)}</button>):<p className="suggestion-placeholder">{inputSpectrum?'No hay más picos destacados.':'Aparecerán al analizar el audio.'}</p>}</div>
          {selectedClose&&<p className="caution-inline"><TriangleAlert size={14}/> Frecuencias cercanas: Jacobi podría converger lentamente.</p>}
          <button type="button" className="action-primary" onClick={()=>void process()} disabled={!audio||busy||selected.length===0}>
            {status==='processing'?<LoaderCircle className="spin" size={19}/>:<WandSparkles size={20}/>}
            {status==='processing'?'Estimando tonos…':'Atenuar tonos seleccionados'}
          </button>
          <p className="solver-note"><ShieldCheck size={14}/> Método de Jacobi · Procesamiento local</p>
        </section>

        <section className={`panel result-panel ${status==='done'?'result-success':''}`}>
          <div className="section-heading"><div className="heading-title">{status==='done'?<CheckCircle2 size={22}/>:<Activity size={22}/>}<h2>Resultado</h2></div></div>
          {status==='processing'?<div className="result-pending"><LoaderCircle size={19} className="spin"/> Resolviendo el sistema iterativo…</div>
            :status==='loading'?<div className="result-pending"><LoaderCircle size={19} className="spin"/> Analizando la grabación…</div>
            :status==='done'&&diagnostics?<div className="result-data">
              <div className="result-summary"><span>Convergencia alcanzada</span><Check size={18}/></div>
              {diagnostics.averagePeakChangeDb!==null&&<div className="metric"><span>Cambio medio en picos</span><strong>{diagnostics.averagePeakChangeDb>0?'+':''}{diagnostics.averagePeakChangeDb.toFixed(1)} dB</strong></div>}
              <div className="result-subline">{selected.length} tonos estimados · {diagnostics.iterations} iteraciones</div>
            </div>:<p className="sidebar-description result-idle">{audio?'Selecciona las frecuencias y comienza el procesamiento.':'El resultado aparecerá después del procesamiento.'}</p>}
        </section>
      </aside>

      <div className="main-content">
        {error&&<div className="error-banner" role="alert"><TriangleAlert size={19}/><span>{error}</span><button aria-label="Cerrar error" onClick={()=>setError(null)}><X size={18}/></button></div>}
        <SpectrumChart input={inputSpectrum} output={outputSpectrum} frequencies={selected} onSelectFrequency={addFrequencyFromChart}/>
        <AudioComparison input={audio?.samples??null} processed={processed} sampleRate={audio?.sampleRate??48000} onDownload={download}/>
        <details className="panel technical-details">
          <summary><span><SlidersHorizontal size={20}/> Detalles del procesamiento</span><ChevronDown className="details-chevron" size={19}/></summary>
          <div className="technical-content">
            <div className="technical-grid"><span>Método numérico</span><strong>Jacobi (implementación propia)</strong><span>Sistema de ecuaciones</span><strong>{selected.length?2*selected.length+1:'—'} coeficientes</strong><span>Tolerancia del residuo</span><strong>1 × 10⁻⁸</strong><span>Iteraciones realizadas</span><strong>{diagnostics?.iterations??'—'}</strong><span>Residuo relativo final</span><strong>{diagnostics?.relativeResidual.toExponential(2)??'—'}</strong><span>Construcción del sistema</span><strong>{diagnostics?`${diagnostics.matrixMs.toFixed(1)} ms`:'—'}</strong><span>Tiempo del solver</span><strong>{diagnostics?`${diagnostics.solverMs.toFixed(1)} ms`:'—'}</strong></div>
            {diagnostics?.peakChanges.length? <div className="peak-measurements"><strong>Variación espectral medida (después − antes)</strong><div className="peak-change-grid">{diagnostics.peakChanges.map(p=><div key={p.frequencyHz}><span>{freqLabel(p.frequencyHz)}</span><strong>{p.changeDb>0?'+':''}{p.changeDb.toFixed(1)} dB</strong></div>)}</div></div>:null}
            <p className="technical-disclaimer">Se estiman y sustraen componentes sinusoidales estables. La atenuación se calcula sobre los picos espectrales de entrada y salida, sin medir calidad perceptual de voz. La FFT se usa para visualizar y sugerir picos, no para resolver el sistema.</p>
          </div>
        </details>
        <footer className="workspace-footer"><span><ShieldCheck size={15}/> Tu audio se procesa en este dispositivo; no se sube a un servidor.</span><span>Prototipo académico · Investigación aplicada</span></footer>
      </div>
    </main>
    {help&&<div className="modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setHelp(false);}}><div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="modal-header"><h2 id="help-title">¿Qué hace ToneAway?</h2><button onClick={()=>setHelp(false)} aria-label="Cerrar ayuda"><X size={22}/></button></div><p>ToneAway atenúa interferencias tonales <strong>estables y de frecuencia conocida</strong> en grabaciones de voz. No agrega ruido ni tonos al audio.</p><ol><li>Carga un audio con interferencias, o utiliza el archivo de ejemplo.</li><li>Haz clic en picos sospechosos del espectro, elige sugerencias o introduce una frecuencia exacta.</li><li>Selecciona hasta seis frecuencias y pulsa <strong>Atenuar tonos seleccionados</strong>.</li><li>Compara las dos versiones en el mismo punto de reproducción y descarga el resultado.</li></ol><p>Los coeficientes sinusoidales se calculan resolviendo las ecuaciones normales mediante <strong>Jacobi</strong>, sin recurrir a un solver directo. La voz que comparta energía en esas frecuencias también puede verse afectada. No es un eliminador de ruido general ni detecta automáticamente qué pico es indeseado.</p><button className="action-primary modal-close" onClick={()=>setHelp(false)}>Entendido</button></div></div>}
  </div>;
}
export default App;
