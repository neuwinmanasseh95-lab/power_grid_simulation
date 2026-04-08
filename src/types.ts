
export interface Position {
  lat: number;
  lng: number;
}

export interface TransformerState {
  id: string;
  name: string;
  position: Position;
  primaryVoltage: number; // V
  secondaryVoltage: number; // V
  primaryCurrent: number; // A
  secondaryCurrent: number; // A
  powerKW: number;
  powerKVAR: number;
  powerKVA: number;
  temperature: number; // °C
  health: 'healthy' | 'warning' | 'critical';
  loadPercentage: number;
  isTripped: boolean;
  manualMode: boolean;
  overrideVoltage?: number;
  overrideTemp?: number;
}

export interface PoleState {
  id: string;
  name: string;
  position: Position;
  voltage: number;
  current: number;
  powerKW: number;
  temperature: number;
}

export interface FeederState {
  id: string;
  name: string;
  transformerId: string;
  poles: PoleState[];
  sendingPowerKW: number;
  receivingPowerKW: number;
  conductorTemp: number;
  status: 'online' | 'fault' | 'overload' | 'tripped';
  isTripped: boolean;
}

export interface GridState {
  transformers: TransformerState[];
  feeders: FeederState[];
  timestamp: number;
  ambientTemp: number;
  waterLevel: number; // in meters
  isRaining: boolean;
}
