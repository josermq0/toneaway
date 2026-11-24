export interface Reconstruction {processed:Float32Array; estimatedToneRms:number}
/** Remove only sinusoidal terms; do NOT subtract the intercept (DC) coefficient. */
export function subtractTones(samples:Float32Array,sampleRate:number,frequencies:readonly number[], coefficients:readonly number[]):Reconstruction {
  if(coefficients.length!==2*frequencies.length+1)throw new Error('Longitud de coeficientes inválida.');
  const processed=new Float32Array(samples.length);
  const cs=new Float64Array(frequencies.length); const sn=new Float64Array(frequencies.length);
  const cd=new Float64Array(frequencies.length); const sd=new Float64Array(frequencies.length);
  const step=frequencies.map(f=>2*Math.PI*f/sampleRate);
  for(let j=0;j<frequencies.length;j++) {cs[j]=1; cd[j]=Math.cos(step[j]);sd[j]=Math.sin(step[j]);}
  let power=0;
  for(let i=0;i<samples.length;i++) {
    let noise=0;
    for(let j=0;j<frequencies.length;j++) {
      if((i&4095)===0) {const a=(i*step[j])%(2*Math.PI);cs[j]=Math.cos(a);sn[j]=Math.sin(a);}
      noise+=coefficients[2*j+1]*cs[j]+coefficients[2*j+2]*sn[j];
      const c=cs[j]*cd[j]-sn[j]*sd[j];sn[j]=sn[j]*cd[j]+cs[j]*sd[j];cs[j]=c;
    }
    processed[i]=samples[i]-noise;
    power+=noise*noise;
  }
  return {processed,estimatedToneRms:Math.sqrt(power/Math.max(1,samples.length))};
}
