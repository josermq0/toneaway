import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {analyzeSpectrum,maxDbNear} from '../dist-core/audio/spectrum.js';
import {processTonalAudio} from '../dist-core/numerical/processAudio.js';

const path=fileURLToPath(new URL('../public/audio/entrevista_ruidosa.wav',import.meta.url));

test('Bundled speech demo: multiple real peaks diminish using Jacobi',()=>{
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  const fs=bytes.readUInt32LE(24);
  const count=bytes.readUInt32LE(40)/2;
  const mono=new Float32Array(count);
  for(let i=0;i<count;i++)mono[i]=bytes.readInt16LE(44+i*2)/32768;
  assert.equal(fs,48000);
  assert.equal(count/fs,12);
  const frequencies=[620.25,800.35,1100.45,1450.55];
  const before=analyzeSpectrum(mono,fs);
  for(const f of frequencies) {
    assert.ok(before.peaks.some(p=>Math.abs(p.frequencyHz-f)<.3),`Missing spectral peak at ${f} Hz`);
  }
  const result=processTonalAudio(mono,fs,frequencies);
  assert.ok(result.diagnostics.iterations>=1);
  assert.ok(result.diagnostics.relativeResidual<=1e-8);
  const after=analyzeSpectrum(result.processed,fs);
  for(const f of frequencies){
    const reductionDb=maxDbNear(before,f)-maxDbNear(after,f);
    assert.ok(reductionDb>12,`Insufficient attenuation at ${f} Hz: ${reductionDb.toFixed(2)} dB`);
  }
});
