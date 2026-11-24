/** Radix-2 Cooley–Tukey transform for spectrum presentation / candidate finding.
 * This is NOT used to solve Fourier coefficients or replace Jacobi.
 */
export function fftInPlace(real:Float64Array, imag:Float64Array): void {
  const n=real.length;
  if(n!==imag.length || n<2 || (n&(n-1))!==0)throw new Error('FFT requiere longitud potencia de dos.');
  for(let i=1,j=0;i<n;i++) {
    let bit=n>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){let a=real[i];real[i]=real[j];real[j]=a;a=imag[i];imag[i]=imag[j];imag[j]=a;}
  }
  for(let len=2;len<=n;len<<=1) {
    const angle=-2*Math.PI/len, wc=Math.cos(angle),ws=Math.sin(angle);
    for(let i=0;i<n;i+=len) {
      let wr=1,wi=0;
      for(let j=0;j<len/2;j++) {
        const u=i+j,v=u+len/2;
        const tr=wr*real[v]-wi*imag[v],ti=wr*imag[v]+wi*real[v];
        real[v]=real[u]-tr;imag[v]=imag[u]-ti;
        real[u]+=tr;imag[u]+=ti;
        const nr=wr*wc-wi*ws;wi=wr*ws+wi*wc;wr=nr;
      }
    }
  }
}
export function nextPowerOfTwo(n:number):number {
  let v=1;while(v<n)v*=2;return v;
}
