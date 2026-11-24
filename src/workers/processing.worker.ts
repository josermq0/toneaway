/// <reference lib="webworker" />
import type {WorkerRequest,WorkerResponse} from '../types/audio.js';
import {analyzeSpectrum,maxDbNear} from '../audio/spectrum.js';
import {processTonalAudio} from '../numerical/processAudio.js';

const ctx=self as DedicatedWorkerGlobalScope;
ctx.onmessage=(event:MessageEvent<WorkerRequest>)=>{
  const request=event.data;
  try {
    if(request.type==='analyze') {
      const spectrum=analyzeSpectrum(request.samples,request.sampleRate);
      const reply:WorkerResponse={type:'analyzed',requestId:request.requestId,spectrum};
      ctx.postMessage(reply,[spectrum.db.buffer as ArrayBuffer]);
    }else {
      const result=processTonalAudio(request.samples,request.sampleRate,request.frequencies,request.tolerance,request.maxIterations);
      const inputSpectrum=analyzeSpectrum(request.samples,request.sampleRate);
      const spectrum=analyzeSpectrum(result.processed,request.sampleRate);
      const peakChanges=request.frequencies.map(frequencyHz=>{
        const beforeDb=maxDbNear(inputSpectrum,frequencyHz);
        const afterDb=maxDbNear(spectrum,frequencyHz);
        return {frequencyHz,beforeDb,afterDb,changeDb:afterDb-beforeDb};
      });
      result.diagnostics.peakChanges=peakChanges;
      result.diagnostics.averagePeakChangeDb=peakChanges.length?peakChanges.reduce((sum,p)=>sum+p.changeDb,0)/peakChanges.length:null;
      const reply:WorkerResponse={type:'processed',requestId:request.requestId,samples:result.processed,spectrum,diagnostics:result.diagnostics};
      ctx.postMessage(reply,[result.processed.buffer as ArrayBuffer,spectrum.db.buffer as ArrayBuffer]);
    }
  } catch(error) {
    const reply:WorkerResponse={type:'failed',requestId:request.requestId,error:error instanceof Error?error.message:'Falló el procesamiento de audio.'};
    ctx.postMessage(reply);
  }
};
