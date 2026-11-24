export interface DecodedAudio {samples:Float32Array;sampleRate:number;channels:number;duration:number;name:string}
export async function decodeAudioFile(file:File):Promise<DecodedAudio> {
  if(file.size>45*1024*1024)throw new Error('El archivo supera el límite de 45 MB.');
  // MIME types are unreliable for some WAV files; also check the extension.
  if(!/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(file.name) && !file.type.startsWith('audio/')) {
    throw new Error('Selecciona un archivo de audio compatible con tu navegador (recomendado: WAV o MP3).');
  }
  const context=new AudioContext();
  let buffer:AudioBuffer;
  try {buffer=await context.decodeAudioData(await file.arrayBuffer());}
  catch {throw new Error('El navegador no pudo decodificar el archivo. Prueba con WAV o MP3.');}
  finally {await context.close();}
  if(buffer.duration<0.75)throw new Error('La grabación debe durar al menos 0,75 segundos.');
  if(buffer.duration>30)throw new Error('Para este prototipo, selecciona un fragmento de hasta 30 segundos.');
  const mono=new Float32Array(buffer.length);
  for(let ch=0;ch<buffer.numberOfChannels;ch++){
    const channel=buffer.getChannelData(ch),weight=1/buffer.numberOfChannels;
    for(let i=0;i<buffer.length;i++)mono[i]+=channel[i]*weight;
  }
  return {samples:mono,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,duration:buffer.duration,name:file.name};
}
export async function fetchDemo():Promise<DecodedAudio> {
  const res=await fetch('/audio/entrevista_ruidosa.wav');
  if(!res.ok)throw new Error('No se encontró el archivo de demostración.');
  return decodeAudioFile(new File([await res.blob()],'entrevista_ruidosa.wav',{type:'audio/wav'}));
}
