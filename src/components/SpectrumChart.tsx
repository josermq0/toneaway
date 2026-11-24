import {useMemo,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import {ScanSearch,ZoomOut} from 'lucide-react';
import type {SpectrumData} from '../types/audio';
import {freqLabel} from '../utils/format';

type View={min:number;max:number};
const W=1000,H=315,L=57,R=16,T=20,B=42;
const plotWidth=W-L-R,plotHeight=H-T-B;
const lowDb=-122,highDb=-5;
function x(f:number,v:View){return L+(f-v.min)/(v.max-v.min)*plotWidth;}
function y(db:number){return T+(highDb-Math.max(lowDb,Math.min(highDb,db)))/(highDb-lowDb)*plotHeight;}
function profile(s:SpectrumData|null|undefined,v:View):string {
  if(!s)return '';
  const bins=1000;
  const arr:string[]=[];
  for(let k=0;k<=bins;k++){
    const minF=v.min+k/bins*(v.max-v.min);
    const maxF=v.min+(k+1)/bins*(v.max-v.min);
    const start=Math.max(0,Math.floor(minF/s.binHz));
    const end=Math.min(s.db.length-1,Math.ceil(maxF/s.binHz));
    let db=-125;
    for(let i=start;i<=end;i++)db=Math.max(db,s.db[i]);
    const xx=x(minF,v);
    arr.push(`${k===0?'M':'L'}${xx.toFixed(2)},${y(db).toFixed(2)}`);
  }
  return arr.join(' ');
}

interface Props {
  input?:SpectrumData|null;
  output?:SpectrumData|null;
  frequencies:number[];
  onSelectFrequency:(frequencyHz:number)=>void;
}
export function SpectrumChart({input,output,frequencies,onSelectFrequency}:Props){
  const maxAllowed=Math.min(input?.maxHz??20000,20000);
  const [view,setView]=useState<View>({min:0,max:3000});
  const [drag,setDrag]=useState<{startX:number;currentX:number}|null>(null);
  const [hover,setHover]=useState<number|null>(null);
  const svgRef=useRef<SVGSVGElement|null>(null);
  const effective:View={min:Math.min(view.min,maxAllowed-50),max:Math.min(view.max,maxAllowed)};
  const pathIn=useMemo(()=>profile(input,effective),[input,effective.min,effective.max]);
  const pathOut=useMemo(()=>profile(output,effective),[output,effective.min,effective.max]);
  const fFromClient=(clientX:number)=>{
    const box=svgRef.current?.getBoundingClientRect();
    if(!box)return 0;
    const vx=(clientX-box.left)/box.width*W;
    return effective.min+Math.max(0,Math.min(1,(vx-L)/plotWidth))*(effective.max-effective.min);
  };
  const xClient=(clientX:number)=>{
    const box=svgRef.current?.getBoundingClientRect();return box?Math.max(L,Math.min(W-R,(clientX-box.left)/box.width*W)):L;
  };
  const handlePointerDown=(e:PointerEvent<SVGSVGElement>)=>{
    if(!input)return;
    const box=svgRef.current?.getBoundingClientRect();
    if(!box)return;
    const vx=(e.clientX-box.left)*W/box.width;
    const vy=(e.clientY-box.top)*H/box.height;
    if(vx<L||vx>W-R||vy<T||vy>H-B)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const xx=xClient(e.clientX);
    setDrag({startX:xx,currentX:xx});
  };
  const handlePointerMove=(e:PointerEvent<SVGSVGElement>)=>{
    if(!input)return;
    const xx=xClient(e.clientX);
    if(drag)setDrag({...drag,currentX:xx});
    else setHover(fFromClient(e.clientX));
  };
  const handlePointerUp=(e:PointerEvent<SVGSVGElement>)=>{
    if(!input)return;
    const endX=xClient(e.clientX);
    const begin=drag?.startX??endX;
    const box=svgRef.current?.getBoundingClientRect();
    const yRaw=box?(e.clientY-box.top)*H/box.height:-1;
    if(!drag)return;
    if(Math.abs(endX-begin)>14){
      const f1=effective.min+(Math.min(begin,endX)-L)/plotWidth*(effective.max-effective.min);
      const f2=effective.min+(Math.max(begin,endX)-L)/plotWidth*(effective.max-effective.min);
      if(f2-f1>=8)setView({min:Math.max(0,f1),max:Math.min(maxAllowed,f2)});
    }else if(endX>=L&&endX<=W-R&&yRaw>=T&&yRaw<=H-B){
      const clicked=fFromClient(e.clientX);
      const candidates=input.peaks;
      const closest=candidates.reduce<(typeof candidates)[number]|undefined>((best,p)=>
        !best||Math.abs(p.frequencyHz-clicked)<Math.abs(best.frequencyHz-clicked)?p:best,undefined);
      const threshold=Math.min(25,Math.max(3,4*(effective.max-effective.min)/plotWidth));
      const snapped=closest&&Math.abs(closest.frequencyHz-clicked)<threshold?closest.frequencyHz:Math.round(clicked*10)/10;
      onSelectFrequency(snapped);
    }
    setDrag(null);
  };
  const yTicks=[-20,-40,-60,-80,-100,-120];
  const markers=frequencies.filter(f=>f>=effective.min&&f<=effective.max);
  const rangeButtons:Array<{name:string;max:number}>= [
    {name:'0–3 kHz',max:3000}, {name:'0–6 kHz',max:6000}, {name:'Todo',max:maxAllowed},
  ];
  return <section className="panel spectrum-panel" aria-label="Espectro interactivo de frecuencias">
    <div className="section-heading spectrum-heading">
      <div className="heading-title"><ScanSearch size={24}/><div><h2>Espectro de frecuencias</h2><p>Haz clic en un pico para seleccionarlo. Arrastra para acercar.</p></div></div>
      <div className="spectrum-toolbar">
        <div className="view-controls" aria-label="Rango de frecuencias">
          {rangeButtons.map(b=><button key={b.name} type="button" className={view.min===0&&view.max===Math.min(b.max,maxAllowed)?'active':''} onClick={()=>setView({min:0,max:Math.min(b.max,maxAllowed)})} disabled={!input}>{b.name}</button>)}
        </div>
        <button className="icon-action" title="Restablecer zoom" aria-label="Restablecer zoom" onClick={()=>setView({min:0,max:Math.min(3000,maxAllowed)})} disabled={!input}><ZoomOut size={17}/></button>
      </div>
    </div>
    <div className="chart-legend">
      <span><i className="legend-line input"/>Entrada</span>
      {output&&<span><i className="legend-line output"/>Procesado</span>}
    </div>
    <div className="chart-shell">
      <svg ref={svgRef} className="spectrum-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={input?'Espectro del archivo de audio. Haz clic para agregar frecuencias a atenuar.':'Espectro no disponible hasta cargar un archivo.'}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={()=>{if(!drag)setHover(null);}} onDoubleClick={()=>setView({min:0,max:Math.min(3000,maxAllowed)})}>
        <defs>
          <linearGradient id="spectrum-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#26d1cc" stopOpacity="0.19"/><stop offset="100%" stopColor="#26d1cc" stopOpacity="0.012"/></linearGradient>
          <clipPath id="plot-clip"><rect x={L} y={T} width={plotWidth} height={plotHeight}/></clipPath>
        </defs>
        <rect x={L} y={T} width={plotWidth} height={plotHeight} rx="2" fill="#0b1a2b"/>
        {yTicks.map(db=><g key={db}><line x1={L} y1={y(db)} x2={W-R} y2={y(db)} stroke="#35536a" strokeWidth="0.8" opacity="0.55"/><text x={L-12} y={y(db)+4} textAnchor="end" className="axis-tick">{db}</text></g>)}
        {Array.from({length:7},(_,i)=>effective.min+i*(effective.max-effective.min)/6).map((f,i)=><g key={i}><line x1={x(f,effective)} y1={T} x2={x(f,effective)} y2={H-B} stroke="#35536a" strokeWidth=".8" opacity=".45"/><text x={x(f,effective)} y={H-B+20} textAnchor="middle" className="axis-tick">{f>=1000?`${(f/1000).toFixed(f%1000===0?0:1)}k`:Math.round(f)}</text></g>)}
        <text x="17" y={T+plotHeight/2} transform={`rotate(-90 17 ${T+plotHeight/2})`} textAnchor="middle" className="axis-label">Nivel (dBFS)</text>
        <text x={L+plotWidth/2} y={H-3} textAnchor="middle" className="axis-label">Frecuencia (Hz)</text>
        <g clipPath="url(#plot-clip)">
          {input&&<path d={pathIn} fill="none" stroke="#f6a352" strokeWidth="1.9" strokeLinejoin="round"/>}
          {output&&<path d={pathOut} fill="none" stroke="#25ddd1" strokeWidth="1.9" strokeLinejoin="round"/>}
          {markers.map(f=><g key={f}><line x1={x(f,effective)} x2={x(f,effective)} y1={T} y2={H-B} stroke="#5df2e0" strokeWidth="1.25" strokeDasharray="5 5" opacity=".9"/></g>)}
          {hover!==null&&input&&<line x1={x(hover,effective)} x2={x(hover,effective)} y1={T} y2={H-B} stroke="white" opacity=".3" strokeWidth="1"/>}
          {drag&&<rect x={Math.min(drag.startX,drag.currentX)} y={T} width={Math.abs(drag.currentX-drag.startX)} height={plotHeight} fill="#20cfc3" opacity="0.16"/>}
        </g>
        {markers.map((f,i)=>{
          const xx=x(f,effective); const row=(i%2); const yy=T+14+row*23;
          const label=freqLabel(f),labelWidth=Math.min(115,Math.max(52,label.length*7.5+12));
          return <g key={f} pointerEvents="none"><rect x={Math.min(W-R-labelWidth,Math.max(L,xx-labelWidth/2))} y={yy-13} width={labelWidth} height="21" rx="6" fill="#102c3d" stroke="#2ccbbb" opacity=".98"/><text x={Math.min(W-R-labelWidth,Math.max(L,xx-labelWidth/2))+labelWidth/2} y={yy+1} textAnchor="middle" className="marker-label">{label}</text></g>;
        })}
        {!input&&<g><text x={W/2} y={H/2-8} textAnchor="middle" className="empty-graph-head">Tu espectro aparecerá aquí</text><text x={W/2} y={H/2+18} textAnchor="middle" className="empty-graph-sub">Carga una grabación para explorar sus frecuencias</text></g>}
        {input&&hover!==null&&!drag&&<g pointerEvents="none"><rect x={Math.min(W-R-108,Math.max(L,x(hover,effective)-54))} y={H-B-37} width="108" height="23" rx="5" fill="#21384b" stroke="#49667b"/><text x={Math.min(W-R-108,Math.max(L,x(hover,effective)-54))+54} y={H-B-21} textAnchor="middle" className="marker-label">{freqLabel(Math.round(hover*10)/10)}</text></g>}
      </svg>
    </div>
    <div className="spectrum-footer"><span>{input?'Clic: seleccionar · Arrastrar: zoom · Doble clic: restablecer':'Sin archivo cargado'}</span><span>Escala constante antes/después</span></div>
  </section>;
}
