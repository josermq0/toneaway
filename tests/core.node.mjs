import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNormalEquations} from '../dist-core/numerical/normalEquations.js';
import {solveJacobi} from '../dist-core/numerical/jacobiSolver.js';
import {processTonalAudio} from '../dist-core/numerical/processAudio.js';
import {analyzeSpectrum} from '../dist-core/audio/spectrum.js';
import {encodeMonoWav} from '../dist-core/audio/wavEncoder.js';

function rms(x) {return Math.sqrt(x.reduce((a,b)=>a+b*b,0)/x.length);}
function signal(fs,duration,frequencies,amplitudes,noise=false) {
  const length=Math.floor(fs*duration);const y=new Float32Array(length);
  let seed=123456789;
  for(let i=0;i<length;i++) {
    const t=i/fs;
    let v=0;
    for(let j=0;j<frequencies.length;j++) v+=amplitudes[j]*Math.sin(2*Math.PI*frequencies[j]*t+0.2*(j+1));
    if(noise) {seed=(Math.imul(seed,1664525)+1013904223)>>>0;v+=0.04*(seed/0xffffffff-0.5);}
    y[i]=v;
  }
  return y;
}
test('Jacobi converges and reproduces a five-coefficient system',()=>{
  const fs=4000, frequencies=[440,440.7];
  const audio=signal(fs,0.512,frequencies,[0.35,0.2]);
  const system=buildNormalEquations(audio,fs,frequencies);
  assert.equal(system.dimension,5);
  const result=solveJacobi(system,1e-8,2000);
  assert.equal(result.converged,true,JSON.stringify(result));
  assert.ok(result.iterations>1);
  assert.ok(result.relativeResidual<1e-8);
});
test('Multiple tones are removed using only Jacobi',()=>{
  const fs=16000,duration=2.5, freqs=[620,800,1100,1450,1700];
  const tonal=signal(fs,duration,freqs,[0.045,0.060,0.040,0.029,0.035]);
  const speech=signal(fs,duration,[207,346,479],[0.09,0.065,0.041],true);
  const observed=new Float32Array(tonal.length);
  for(let i=0;i<observed.length;i++)observed[i]=tonal[i]+speech[i];
  const res=processTonalAudio(observed,fs,freqs);
  assert.ok(res.diagnostics.iterations>=1);
  assert.ok(res.diagnostics.relativeResidual<=1e-8);
  const mse=(x,y)=>x.reduce((acc,v,i)=>acc+(v-y[i])**2,0)/x.length;
  const initialError=mse(observed,speech),finalError=mse(res.processed,speech);
  assert.ok(finalError<initialError/100,`${finalError} / ${initialError}`);
  assert.ok(Math.abs(rms(res.processed)-rms(speech))<0.006);
});
test('Constant/DC component remains untouched',()=>{
  const fs=8000,f=800,y=signal(fs,2,[f],[0.3]);
  for(let i=0;i<y.length;i++)y[i]+=0.1;
  const {processed}=processTonalAudio(y,fs,[f]);
  const average=processed.reduce((a,b)=>a+b,0)/processed.length;
  assert.ok(Math.abs(average-0.1)<1e-5);
});
test('Very close frequencies are rejected rather than silently mishandled',()=>{
  assert.throws(()=>buildNormalEquations(new Float32Array(8000),8000,[800,800.2]),/demasiado próximas/);
});
test('Spectrum locates stable unwanted frequencies',()=>{
  const fs=8000, y=signal(fs,2,[800,1100],[0.1,0.05]);
  const spectrum=analyzeSpectrum(y,fs);
  assert.ok(spectrum.peaks.some(p=>Math.abs(p.frequencyHz-800)<0.4));
  assert.ok(spectrum.peaks.some(p=>Math.abs(p.frequencyHz-1100)<0.4));
});
test('WAV encoder outputs a valid RIFF/WAVE header',async()=>{
  const blob=encodeMonoWav(new Float32Array([0,0.25,-0.25]),48000);
  const view=new DataView(await blob.arrayBuffer());
  const text=(p,n)=>String.fromCharCode(...Array.from({length:n},(_,i)=>view.getUint8(p+i)));
  assert.equal(text(0,4),'RIFF');assert.equal(text(8,4),'WAVE');
  assert.equal(view.getUint32(24,true),48000);
  assert.equal(view.getUint32(40,true),6);
});
