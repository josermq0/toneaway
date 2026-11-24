import type {ProcessingDiagnostics} from '../types/audio.js';
import {buildNormalEquations} from './normalEquations.js';
import {solveJacobi} from './jacobiSolver.js';
import {subtractTones} from './reconstruct.js';

export function processTonalAudio(samples:Float32Array, sampleRate:number, frequencies:readonly number[], tolerance=1e-8, maxIterations=2000) {
  const start=performance.now();
  const system=buildNormalEquations(samples,sampleRate,frequencies);
  const matrixMs=performance.now()-start;
  const solveStart=performance.now();
  const sol=solveJacobi(system,tolerance,maxIterations);
  const solverMs=performance.now()-solveStart;
  if (!sol.converged) throw new Error(`Jacobi no convergió (${sol.reason}; residuo ${Number.isFinite(sol.relativeResidual)?sol.relativeResidual.toExponential(2):'no finito'}). Ajusta las frecuencias seleccionadas.`);
  const result=subtractTones(samples,sampleRate,frequencies,sol.coefficients);
  const diagnostics:ProcessingDiagnostics={
    iterations:sol.iterations,relativeResidual:sol.relativeResidual,solverMs,matrixMs,
    processingMs:performance.now()-start,estimatedToneRms:result.estimatedToneRms,
    peakChanges:[],averagePeakChangeDb:null,
  };
  return {...result,coefficients:sol.coefficients,diagnostics};
}
