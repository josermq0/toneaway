export interface TonePeak {
  frequencyHz: number;
  magnitudeDb: number;
  prominenceDb: number;
}

export interface SpectrumData {
  db: Float32Array;
  binHz: number;
  maxHz: number;
  nyquistHz: number;
  peaks: TonePeak[];
}

export interface JacobiResult {
  coefficients: number[];
  iterations: number;
  relativeResidual: number;
  converged: boolean;
  reason: 'converged' | 'max-iterations' | 'diverged' | 'degenerate';
}

export interface ProcessingDiagnostics {
  iterations: number;
  relativeResidual: number;
  solverMs: number;
  matrixMs: number;
  processingMs: number;
  estimatedToneRms: number;
  peakChanges: Array<{frequencyHz:number; beforeDb:number; afterDb:number; changeDb:number}>;
  averagePeakChangeDb: number | null;
}

export type WorkerRequest =
  | {type:'analyze'; requestId:number; samples: Float32Array; sampleRate:number}
  | {type:'process'; requestId:number; samples:Float32Array; sampleRate:number; frequencies:number[]; tolerance:number; maxIterations:number};

export type WorkerResponse =
  | {type:'analyzed'; requestId:number; spectrum: SpectrumData}
  | {type:'processed'; requestId:number; samples:Float32Array; spectrum: SpectrumData; diagnostics:ProcessingDiagnostics}
  | {type:'failed'; requestId:number; error:string};
