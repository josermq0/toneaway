import {useEffect,useRef} from 'react';
interface Props {samples:Float32Array|null;progress:number;variant:'input'|'output'}
export function Waveform({samples,progress,variant}:Props) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const paint=()=>{
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.max(1,Math.floor(rect.width*scale));canvas.height=Math.max(1,Math.floor(rect.height*scale));
      const c=canvas.getContext('2d');if(!c)return;
      c.scale(scale,scale);c.clearRect(0,0,rect.width,rect.height);
      const w=Math.max(1,Math.floor(rect.width)),h=rect.height;
      c.strokeStyle='rgba(148,187,203,.15)';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
      if(!samples?.length)return;
      const step=Math.max(1,Math.floor(samples.length/w));
      const mid=h/2,amplitude=(h/2)*0.85;
      c.lineWidth=1.4;c.strokeStyle=variant==='input'?'#f6a352':'#24e1d5';
      c.beginPath();
      for(let px=0;px<w;px++) {
        let low=1,high=-1;
        const start=Math.floor(px/w*samples.length);
        const end=Math.min(samples.length,start+step+1);
        for(let i=start;i<end;i++){low=Math.min(low,samples[i]);high=Math.max(high,samples[i]);}
        if(high<low)continue;
        c.moveTo(px+.5,mid-high*amplitude);
        c.lineTo(px+.5,mid-low*amplitude);
      }
      c.stroke();
      c.fillStyle='rgba(255,255,255,.09)';c.fillRect(0,0,Math.min(w,w*Math.max(0,Math.min(1,progress))),h);
      if(progress>0&&progress<1){c.strokeStyle='#effbf9';c.lineWidth=1;c.beginPath();c.moveTo(progress*w,2);c.lineTo(progress*w,h-2);c.stroke();}
    };
    const observer=new ResizeObserver(paint);observer.observe(canvas);paint();
    return ()=>observer.disconnect();
  },[samples,progress,variant]);
  return <canvas className="waveform-canvas" ref={canvasRef} aria-label="Forma de onda calculada a partir del audio"/>;
}
