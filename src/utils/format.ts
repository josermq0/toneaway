export function timeLabel(seconds:number):string {
  if(!Number.isFinite(seconds))return '0:00';
  const s=Math.max(0,Math.floor(seconds));
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
export function freqLabel(f:number):string {
  return `${Number.isInteger(f)?f.toLocaleString('es-CR'):f.toLocaleString('es-CR',{maximumFractionDigits:2})} Hz`;
}
