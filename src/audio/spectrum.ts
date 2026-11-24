import type {SpectrumData,TonePeak} from '../types/audio.js';
import {fftInPlace,nextPowerOfTwo} from './fft.js';

/** Hann-windowed whole-excerpt FFT. The long window helps locate stable tones precisely.
 * The spectrum is descriptive: it does not perform tonal subtraction.
 */
export function analyzeSpectrum(samples:Float32Array,sampleRate:number):SpectrumData {
  if(!samples.length || sampleRate<=0)throw new Error('No hay muestras de audio para analizar.');
  const maxSamples=1<<19; // cap CPU and memory (~10.9 seconds at 48 kHz)
  const take=Math.min(samples.length,maxSamples);
  const start=Math.floor((samples.length-take)/2);
  const fftSize=Math.min(1<<20,nextPowerOfTwo(take*2));
  const real=new Float64Array(fftSize),imag=new Float64Array(fftSize);
  let sumWeights=0;
  for(let i=0;i<take;i++) {
    const w=take===1?1:0.5-0.5*Math.cos(2*Math.PI*i/(take-1));
    real[i]=samples[start+i]*w;
    sumWeights+=w;
  }
  fftInPlace(real,imag);
  const binHz=sampleRate/fftSize;
  const maxHz=Math.min(20000,sampleRate/2);
  const count=Math.min(Math.floor(maxHz/binHz),fftSize/2)+1;
  const db=new Float32Array(count);
  const ampNorm=2/Math.max(sumWeights,1);
  for(let i=0;i<count;i++){
    const magnitude=Math.hypot(real[i],imag[i])*ampNorm;
    db[i]=Math.max(-125,20*Math.log10(Math.max(1e-10,magnitude)));
  }
  const peaks=findCandidatePeaks(db,binHz,maxHz);
  return {db,binHz,maxHz,nyquistHz:sampleRate/2,peaks};
}

function findCandidatePeaks(db:Float32Array,binHz:number,maxHz:number):TonePeak[] {
  const maxK=Math.min(db.length-3,Math.floor(Math.min(6000,maxHz)/binHz));
  const offset=Math.max(2,Math.round(3/binHz));
  const offset2=Math.max(3,Math.round(7/binHz));
  const candidates:Array<TonePeak & {score:number}>=[];
  for(let k=Math.max(offset2+2,Math.ceil(100/binHz));k<maxK-offset2;k++) {
    const v=db[k];
    if(v<-85||v<db[k-1]||v<=db[k+1])continue;
    const neighboring=Math.max(db[k-offset],db[k+offset],db[k-offset2],db[k+offset2]);
    const prominence=v-neighboring;
    if(prominence<9)continue;
    const denom=db[k-1]-2*v+db[k+1];
    const shift=Math.abs(denom)>1e-8?Math.max(-0.5,Math.min(0.5,0.5*(db[k-1]-db[k+1])/denom)):0;
    const frequencyHz=(k+shift)*binHz;
    const score=prominence+Math.max(0,v+90)*0.17;
    candidates.push({frequencyHz:Math.round(frequencyHz*100)/100,magnitudeDb:v,prominenceDb:prominence,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const chosen:TonePeak[]=[];
  for(const candidate of candidates){
    if(chosen.every(p=>Math.abs(p.frequencyHz-candidate.frequencyHz)>25)) {
      chosen.push({frequencyHz:candidate.frequencyHz,magnitudeDb:candidate.magnitudeDb,prominenceDb:candidate.prominenceDb});
    }
    if(chosen.length>=12)break;
  }
  return chosen;
}

export function maxDbNear(s:SpectrumData,frequencyHz:number,radiusHz=2):number {
  const from=Math.max(0,Math.floor((frequencyHz-radiusHz)/s.binHz));
  const to=Math.min(s.db.length-1,Math.ceil((frequencyHz+radiusHz)/s.binHz));
  let max=-125;for(let i=from;i<=to;i++)max=Math.max(max,s.db[i]);return max;
}
