/** Fourier least-squares normal equations. The only solve is the Jacobi iteration.
 * Column ordering: [intercept, cos(f1), sin(f1), cos(f2), sin(f2), ...].
 * G and b are normalized by sample count to keep magnitudes well-scaled.
 */
export interface NormalSystem { dimension:number; gram:Float64Array; rhs:Float64Array }

export function buildNormalEquations(
  samples: Float32Array,
  sampleRate: number,
  frequencies: readonly number[],
): NormalSystem {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.length === 0) {
    throw new Error('Frecuencia de muestreo o señal inválida.');
  }
  if (frequencies.length < 1 || frequencies.length > 6) {
    throw new Error('Selecciona entre una y seis frecuencias.');
  }
  const duration = samples.length / sampleRate;
  for (let j=0;j<frequencies.length;j++) {
    const f = frequencies[j];
    if (!Number.isFinite(f) || f < 20 || f >= sampleRate/2) {
      throw new Error(`Frecuencia fuera de rango: ${f} Hz.`);
    }
    for (let k=0;k<j;k++) {
      // Very nearby columns are nearly collinear on a finite-duration recording.
      if (Math.abs(f-frequencies[k]) < 0.25/duration) {
        throw new Error('Dos frecuencias están demasiado próximas para la duración del audio. Sepáralas o usa una grabación más larga.');
      }
    }
  }
  const n = 2*frequencies.length + 1;
  const gram = new Float64Array(n*n);
  const rhs = new Float64Array(n);
  const basis = new Float64Array(n);
  const phase = new Float64Array(frequencies.length);
  const step = new Float64Array(frequencies.length);
  for (let j=0;j<frequencies.length;j++) step[j] = 2*Math.PI*frequencies[j]/sampleRate;
  // Recurrence reduces expensive trigonometric calls. Resynchronize periodically
  // to avoid accumulating phase drift on longer recordings.
  const cs = new Float64Array(frequencies.length);
  const sn = new Float64Array(frequencies.length);
  const cd = new Float64Array(frequencies.length);
  const sd = new Float64Array(frequencies.length);
  for (let j=0;j<frequencies.length;j++) {cs[j]=1; cd[j]=Math.cos(step[j]); sd[j]=Math.sin(step[j]);}

  for (let i=0;i<samples.length;i++) {
    const y = samples[i];
    if (!Number.isFinite(y)) throw new Error('La señal contiene muestras no finitas.');
    basis[0]=1;
    const resync=(i & 4095) === 0;
    for (let j=0;j<frequencies.length;j++) {
      if (resync) {
        phase[j] = (i*step[j]) % (2*Math.PI);
        cs[j]=Math.cos(phase[j]); sn[j]=Math.sin(phase[j]);
      }
      basis[2*j+1] = cs[j];
      basis[2*j+2] = sn[j];
      const cNext=cs[j]*cd[j]-sn[j]*sd[j];
      sn[j]=sn[j]*cd[j]+cs[j]*sd[j]; cs[j]=cNext;
    }
    for (let j=0;j<n;j++) {
      const v = basis[j];
      rhs[j] += y*v;
      const row=j*n;
      for (let k=j;k<n;k++) gram[row+k] += v*basis[k];
    }
  }
  const scale=1/samples.length;
  for(let j=0;j<n;j++) {
    rhs[j]*=scale;
    for(let k=j;k<n;k++) {
      gram[j*n+k]*=scale;
      if (k!==j) gram[k*n+j]=gram[j*n+k];
    }
  }
  return {dimension:n, gram, rhs};
}
