import type {JacobiResult} from '../types/audio.js';
import type {NormalSystem} from './normalEquations.js';

function norm(x:Float64Array): number {let v=0;for(let i=0;i<x.length;i++)v+=x[i]*x[i];return Math.sqrt(v);}
function residual(gram:Float64Array, b:Float64Array, x:Float64Array): number {
  const n=b.length; let sq=0;
  for(let i=0;i<n;i++) {let r=b[i];for(let j=0;j<n;j++)r-=gram[i*n+j]*x[j];sq+=r*r;}
  return Math.sqrt(sq)/Math.max(norm(b), 1e-15);
}

/** Plain simultaneous Jacobi updates. No direct or library linear-system solve. */
export function solveJacobi(system:NormalSystem, tolerance=1e-8, maxIterations=2000):JacobiResult {
  const {dimension:n, gram, rhs} = system;
  if (!Number.isInteger(n) || gram.length!==n*n || rhs.length!==n) throw new Error('Sistema lineal inválido.');
  if (!(tolerance > 0 && tolerance < 1) || !Number.isInteger(maxIterations) || maxIterations < 1) throw new Error('Parámetros del solver inválidos.');
  let current = new Float64Array(n);
  let next = new Float64Array(n);
  for(let i=0;i<n;i++) {
    if(!(gram[i*n+i] > 1e-12)) return {coefficients:Array.from(current),iterations:0,relativeResidual:1,converged:false,reason:'degenerate'};
  }
  const initialNorm=norm(rhs);
  if(initialNorm < 1e-15) return {coefficients:Array.from(current),iterations:0,relativeResidual:0,converged:true,reason:'converged'};
  let best=Number.POSITIVE_INFINITY;
  let growth=0;
  for(let iteration=1;iteration<=maxIterations;iteration++) {
    for(let i=0;i<n;i++) {
      let sum=rhs[i];
      for(let j=0;j<n;j++) if(j!==i)sum-=gram[i*n+j]*current[j];
      next[i]=sum/gram[i*n+i];
    }
    const r=residual(gram,rhs,next);
    if (!Number.isFinite(r) || r>1e8) return {coefficients:Array.from(current),iterations:iteration,relativeResidual:r,converged:false,reason:'diverged'};
    if (r<=tolerance) return {coefficients:Array.from(next),iterations:iteration,relativeResidual:r,converged:true,reason:'converged'};
    if (r<best*0.999) {best=r;growth=0;} else if (r>best*100) growth++;
    if (growth>35) return {coefficients:Array.from(next),iterations:iteration,relativeResidual:r,converged:false,reason:'diverged'};
    const tmp=current;current=next;next=tmp;
  }
  return {coefficients:Array.from(current),iterations:maxIterations,relativeResidual:residual(gram,rhs,current),converged:false,reason:'max-iterations'};
}
