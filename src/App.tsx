import React, { useEffect, useState, useRef } from 'react';
import { 
  Activity, 
  Zap, 
  Thermometer, 
  LayoutDashboard, 
  AlertTriangle, 
  CheckCircle2, 
  Settings,
  BarChart3,
  Wind,
  Sun,
  Cpu,
  ShieldAlert,
  Power,
  PowerOff,
  RefreshCw,
  Bell,
  Network,
  CloudRain,
  Droplets,
  Map as MapIcon,
  Mail,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

import { GridState, TransformerState, FeederState, PoleState } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Initial state generation
const initialTransformers: TransformerState[] = Array.from({ length: 5 }, (_, i) => ({
  id: `tx-${i + 1}`,
  name: `Transformer ${i + 1}`,
  position: { lat: -1.2833 + (Math.random() - 0.5) * 0.02, lng: 36.8167 + (Math.random() - 0.5) * 0.02 },
  primaryVoltage: 33000,
  secondaryVoltage: 11000,
  primaryCurrent: 0,
  secondaryCurrent: 0,
  powerKW: 0,
  powerKVAR: 0,
  powerKVA: 0,
  temperature: 40,
  health: 'healthy',
  loadPercentage: 0,
  isTripped: false,
  manualMode: false,
  overrideVoltage: 11000,
  overrideTemp: 40,
}));

const initialFeeders: FeederState[] = initialTransformers.map((tx, i) => {
  const poles: PoleState[] = Array.from({ length: 10 }, (_, j) => ({
    id: `pole-${tx.id}-${j + 1}`,
    name: `Dist. Post ${tx.id.split('-')[1]}.${j + 1}`,
    position: { 
      lat: tx.position.lat + (j + 1) * 0.0015, 
      lng: tx.position.lng + (j + 1) * 0.0015 
    },
    voltage: 11000,
    current: 0,
    powerKW: 0,
    temperature: 25,
  }));

  return {
    id: `feeder-${i + 1}`,
    name: `Feeder Line ${i + 1}`,
    transformerId: tx.id,
    poles,
    sendingPowerKW: 0,
    receivingPowerKW: 0,
    conductorTemp: 25,
    status: 'online',
    isTripped: false,
  };
});

export default function App() {
  const [state, setState] = useState<GridState>({
    transformers: initialTransformers,
    feeders: initialFeeders,
    timestamp: Date.now(),
    ambientTemp: 25,
    waterLevel: 0,
    isRaining: false,
  });
  const [history, setHistory] = useState<any[]>([]);
  const [loadMultiplier, setLoadMultiplier] = useState(1.0);
  const [ambientTemp, setAmbientTemp] = useState(25);
  const [waterLevel, setWaterLevel] = useState(0);
  const [isRaining, setIsRaining] = useState(false);
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showTempTrends, setShowTempTrends] = useState(false);
  const [showLoadProfiles, setShowLoadProfiles] = useState(false);
  const [targetEmail] = useState('neuwinmanasseh05@gmail.com');
  const [aiLogs, setAiLogs] = useState<{ id: string; msg: string; type: 'info' | 'warning' | 'error'; time: string }[]>([]);

  const loadMultiplierRef = useRef(loadMultiplier);
  const ambientTempRef = useRef(ambientTemp);
  const waterLevelRef = useRef(waterLevel);
  const isRainingRef = useRef(isRaining);
  const lastEmailSentRef = useRef<Record<string, number>>({});

  useEffect(() => {
    loadMultiplierRef.current = loadMultiplier;
    ambientTempRef.current = ambientTemp;
    waterLevelRef.current = waterLevel;
    isRainingRef.current = isRaining;
  }, [loadMultiplier, ambientTemp, waterLevel, isRaining]);

  const addAiLog = (msg: string, type: 'info' | 'warning' | 'error') => {
    setAiLogs(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      msg,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 50));

    if (type === 'error') {
      sendEmailAlert(msg);
    }
  };

  const sendEmailAlert = (msg: string) => {
    const now = Date.now();
    // Throttle emails to once per 30 seconds per message type roughly
    const lastSent = lastEmailSentRef.current['global'] || 0;
    if (now - lastSent > 30000) {
      console.log(`[SIMULATED EMAIL] To: ${targetEmail} | Subject: GRID CRITICAL ALERT | Body: ${msg}`);
      lastEmailSentRef.current['global'] = now;
      // We add a special log for the email sent
      setAiLogs(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        msg: `SYSTEM: Critical alert email dispatched to ${targetEmail}`,
        type: 'info',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setState(prevState => {
        const currentLoadMultiplier = isNaN(loadMultiplierRef.current) ? 1.0 : loadMultiplierRef.current;
        const currentAmbientTemp = isNaN(ambientTempRef.current) ? 25 : ambientTempRef.current;

        const nextTransformers = prevState.transformers.map((tx, i) => {
          if (tx.isTripped) {
            return { ...tx, powerKW: 0, powerKVA: 0, powerKVAR: 0, secondaryCurrent: 0, primaryCurrent: 0, loadPercentage: 0 };
          }

          const baseLoad = (200 + Math.random() * 50) * currentLoadMultiplier;
          const loadPercentage = (baseLoad / 500) * 100;
          
          let voltage = tx.manualMode ? (tx.overrideVoltage ?? 11000) : 11000;
          if (isNaN(voltage)) voltage = 11000;

          const secondaryCurrent = (baseLoad * 1000) / (Math.sqrt(3) * voltage * 0.9);
          const primaryCurrent = secondaryCurrent * (voltage / 33000);
          const powerKW = baseLoad;
          const powerKVAR = baseLoad * Math.tan(Math.acos(0.9));
          const powerKVA = Math.sqrt(powerKW ** 2 + powerKVAR ** 2);
          
          const pLoss = (loadPercentage / 100) ** 2 * 20; 
          let temperature = tx.manualMode 
            ? (tx.overrideTemp ?? tx.temperature) 
            : tx.temperature + (pLoss - (tx.temperature - currentAmbientTemp) * 0.05) * 0.1;
          
          if (isNaN(temperature)) temperature = tx.temperature;

          // AI Monitoring Logic
          let isTripped = tx.isTripped;
          if (!isTripped) {
            if (temperature > 100) {
              isTripped = true;
              addAiLog(`CRITICAL: ${tx.name} thermal runaway detected (${temperature.toFixed(1)}°C). Emergency power cut initiated.`, 'error');
            } else if (secondaryCurrent > 40) {
              isTripped = true;
              addAiLog(`CRITICAL: ${tx.name} extreme overcurrent detected (${secondaryCurrent.toFixed(1)}A). Tripping circuit breaker.`, 'error');
            } else if (isRainingRef.current && waterLevelRef.current > 0.5) {
              isTripped = true;
              addAiLog(`AI SAFETY: ${tx.name} auto-cutoff triggered due to heavy rain and high water level (${waterLevelRef.current.toFixed(2)}m).`, 'error');
            } else if (Math.random() > 0.995) {
              // Simulate random phase unbalance
              addAiLog(`WARNING: ${tx.name} phase unbalance detected. Monitoring stability.`, 'warning');
            }
          }

          let health: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (temperature > 85 || loadPercentage > 110) {
            health = 'critical';
          } else if (temperature > 70 || loadPercentage > 90) {
            health = 'warning';
          }

          return {
            ...tx,
            secondaryVoltage: voltage,
            loadPercentage,
            secondaryCurrent,
            primaryCurrent,
            powerKW,
            powerKVAR,
            powerKVA,
            temperature,
            health,
            isTripped
          };
        });

        const nextFeeders = prevState.feeders.map((feeder, i) => {
          const tx = nextTransformers[i];
          const isTripped = tx.isTripped;
          
          const conductorTemp = isTripped 
            ? Math.max(currentAmbientTemp, feeder.conductorTemp - 0.5)
            : feeder.conductorTemp + ((tx.secondaryCurrent / 100) ** 2 * 5 - (feeder.conductorTemp - currentAmbientTemp) * 0.1) * 0.1;
          
          const poles = feeder.poles.map((pole, j) => {
            if (isTripped) {
              return { ...pole, current: 0, voltage: 0, powerKW: 0, temperature: conductorTemp };
            }

            const vDrop = (j + 1) * 30;
            const voltage = tx.secondaryVoltage - vDrop;
            const current = tx.secondaryCurrent;
            const powerKW = (Math.sqrt(3) * voltage * current * 0.9) / 1000 / 10; 

            return {
              ...pole,
              current,
              voltage,
              powerKW,
              temperature: conductorTemp,
            };
          });

          return {
            ...feeder,
            sendingPowerKW: isTripped ? 0 : tx.powerKW,
            receivingPowerKW: isTripped ? 0 : tx.powerKW * 0.98,
            conductorTemp,
            poles,
            isTripped,
            status: isTripped ? 'tripped' : (tx.health === 'critical' ? 'overload' : 'online')
          };
        });

        const nextState = {
          transformers: nextTransformers,
          feeders: nextFeeders,
          timestamp: Date.now(),
          ambientTemp: currentAmbientTemp,
          waterLevel: waterLevelRef.current,
          isRaining: isRainingRef.current,
        };

        setHistory(prev => {
          const newHistory = [...prev, {
            time: new Date(nextState.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            ...nextState.transformers.reduce((acc, tx) => ({
              ...acc,
              [`${tx.id}_temp`]: tx.temperature,
              [`${tx.id}_load`]: tx.loadPercentage,
              [`${tx.id}_v`]: tx.secondaryVoltage,
            }), {})
          }];
          return newHistory.slice(-20);
        });

        return nextState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleLoadChange = (val: number[]) => {
    const v = val[0];
    if (typeof v === 'number' && !isNaN(v)) {
      setLoadMultiplier(v);
    }
  };

  const handleAmbientChange = (val: number[]) => {
    const v = val[0];
    if (typeof v === 'number' && !isNaN(v)) {
      setAmbientTemp(v);
    }
  };

  const toggleManualMode = (txId: string) => {
    setState(prev => ({
      ...prev,
      transformers: prev.transformers.map(tx => 
        tx.id === txId ? { ...tx, manualMode: !tx.manualMode } : tx
      )
    }));
  };

  const setOverride = (txId: string, field: 'voltage' | 'temp', val: number) => {
    if (isNaN(val)) return;
    setState(prev => ({
      ...prev,
      transformers: prev.transformers.map(tx => 
        tx.id === txId ? { 
          ...tx, 
          [field === 'voltage' ? 'overrideVoltage' : 'overrideTemp']: val 
        } : tx
      )
    }));
  };

  const resetTrip = (txId: string) => {
    setState(prev => ({
      ...prev,
      transformers: prev.transformers.map(tx => 
        tx.id === txId ? { ...tx, isTripped: false, temperature: 40 } : tx
      )
    }));
    addAiLog(`Manual reset initiated for ${txId}. Re-energizing line...`, 'info');
  };

  const activeTx = state.transformers.find(t => t.id === selectedTx) || state.transformers[0];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar Controls */}
      <aside className="w-80 border-r border-white/10 bg-slate-950 p-6 flex flex-col gap-8 overflow-y-auto text-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-md">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">VoltVigil</h1>
            <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Grid Operations OS</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
                <Activity className="w-4 h-4 text-blue-400" /> Global Load Factor
              </label>
              <Badge variant="outline" className="text-slate-300 border-slate-700">{isNaN(loadMultiplier) ? '100' : (loadMultiplier * 100).toFixed(0)}%</Badge>
            </div>
            <Slider 
              value={[loadMultiplier]} 
              min={0.1} 
              max={2.5} 
              step={0.1} 
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                if (typeof val === 'number') setLoadMultiplier(val);
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
                <Thermometer className="w-4 h-4 text-orange-400" /> Ambient Temp
              </label>
              <Badge variant="outline" className="text-slate-300 border-slate-700">{ambientTemp}°C</Badge>
            </div>
            <Slider 
              value={[ambientTemp]} 
              min={-10} 
              max={50} 
              step={1} 
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                if (typeof val === 'number') setAmbientTemp(val);
              }}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2 text-slate-300">
                <Droplets className="w-4 h-4 text-blue-400" /> Water Level
              </label>
              <Badge variant="outline" className={cn(waterLevel > 0.5 ? "text-red-400 border-red-900/50 bg-red-950/30" : "text-blue-400 border-blue-900/50 bg-blue-950/30")}>
                {waterLevel.toFixed(2)}m
              </Badge>
            </div>
            <Slider 
              value={[waterLevel]} 
              min={0} 
              max={2} 
              step={0.01} 
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                if (typeof val === 'number') setWaterLevel(val);
              }}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <CloudRain className={cn("w-4 h-4", isRaining ? "text-blue-400" : "text-slate-600")} />
              <span className="text-sm font-medium text-slate-300">Rain Detection</span>
            </div>
            <Switch 
              checked={isRaining} 
              onCheckedChange={setIsRaining}
            />
          </div>

          <Separator className="bg-slate-800" />

          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full gap-2 border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white justify-start"
              onClick={() => setShowMap(true)}
            >
              <MapIcon className="w-4 h-4" /> View Grid Map
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2 border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white justify-start"
              onClick={() => setShowTempTrends(true)}
            >
              <BarChart3 className="w-4 h-4" /> Temperature Trends
            </Button>
            <Button 
              variant="outline" 
              className="w-full gap-2 border-slate-700 hover:bg-slate-900 text-slate-300 hover:text-white justify-start"
              onClick={() => setShowLoadProfiles(true)}
            >
              <Zap className="w-4 h-4" /> Load Profiles
            </Button>
          </div>

          <Separator className="bg-slate-800" />

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase text-blue-400 tracking-widest">Grid Health</h3>
            <div className="space-y-2">
              {state.transformers.map(tx => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTx(tx.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all group",
                    selectedTx === tx.id 
                      ? "bg-blue-600/20 border-blue-600 shadow-sm" 
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      tx.isTripped ? "bg-slate-600" :
                      tx.health === 'critical' ? "bg-red-500" : 
                      tx.health === 'warning' ? "bg-amber-500" : 
                      "bg-emerald-500"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedTx === tx.id ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                    )}>{tx.name}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] uppercase border-none",
                      tx.isTripped ? "bg-slate-800 text-slate-500" :
                      tx.health === 'critical' ? "bg-red-950/50 text-red-400" :
                      tx.health === 'warning' ? "bg-amber-950/50 text-amber-400" :
                      "bg-emerald-950/50 text-emerald-400"
                    )}
                  >
                    {tx.isTripped ? 'Tripped' : tx.health}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Simulation Engine Running
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black/20">
        {/* Header Stats */}
        <header className="h-20 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Grid Load</span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {state.transformers.reduce((acc, t) => acc + t.powerKW, 0).toFixed(1)} <span className="text-sm font-normal text-slate-400">kW</span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Avg. Efficiency</span>
              <span className="text-2xl font-bold font-mono text-slate-900">98.2<span className="text-sm font-normal text-slate-400">%</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Feeders</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{state.feeders.length}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full text-[10px] font-bold text-amber-700">
              <Sun className="w-3 h-3" /> SOLAR: 850 W/m²
            </div>
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-700">
              <Wind className="w-3 h-3" /> WIND: 12 km/h
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="flex-1 p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-12 gap-8">
            {/* Selected Transformer Details - MOVED UP */}
            <div className="col-span-4 flex flex-col gap-6">
              <Card className="flex-1 border border-slate-200 bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <Activity className="w-5 h-5 text-blue-600" /> {activeTx.name}
                  </CardTitle>
                  <CardDescription className="text-slate-500">Detailed telemetry and thermal metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Secondary Voltage</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{activeTx.secondaryVoltage.toFixed(1)} <span className="text-xs font-normal text-slate-500">V</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Secondary Current</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{activeTx.secondaryCurrent.toFixed(1)} <span className="text-xs font-normal text-slate-500">A</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Active Power</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{activeTx.powerKW.toFixed(1)} <span className="text-xs font-normal text-slate-500">kW</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Reactive Power</p>
                      <p className="text-xl font-mono font-bold text-slate-900">{activeTx.powerKVAR.toFixed(1)} <span className="text-xs font-normal text-slate-500">kVAR</span></p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <Thermometer className={cn("w-4 h-4", activeTx.temperature > 70 ? "text-red-600" : "text-emerald-600")} />
                        Winding Temperature
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-900">{activeTx.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className={cn(
                          "h-full rounded-full",
                          activeTx.temperature > 80 ? "bg-red-600" : 
                          activeTx.temperature > 60 ? "bg-amber-500" : 
                          "bg-emerald-500"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(activeTx.temperature, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2 text-slate-700">
                        <Zap className="w-4 h-4 text-blue-600" />
                        Load Utilization
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-900">{activeTx.loadPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className={cn(
                          "h-full rounded-full",
                          activeTx.loadPercentage > 100 ? "bg-red-600" : 
                          activeTx.loadPercentage > 85 ? "bg-amber-500" : 
                          "bg-blue-600"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(activeTx.loadPercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <Separator className="bg-slate-100" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase text-blue-600 tracking-widest">AI Control & Overrides</h4>
                      <Switch 
                        checked={activeTx.manualMode} 
                        onCheckedChange={() => toggleManualMode(activeTx.id)}
                      />
                    </div>
                    
                    {activeTx.manualMode ? (
                      <div className="space-y-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Override Voltage (V)</span>
                            <span className="font-mono text-blue-600">{activeTx.overrideVoltage || 11000}V</span>
                          </div>
                          <Slider 
                            value={[activeTx.overrideVoltage || 11000]} 
                            min={8000} 
                            max={13000} 
                            step={100}
                            onValueChange={(v) => {
                              const val = Array.isArray(v) ? v[0] : v;
                              if (typeof val === 'number') setOverride(activeTx.id, 'voltage', val);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Override Temp (°C)</span>
                            <span className="font-mono text-blue-600">{activeTx.overrideTemp || 40}°C</span>
                          </div>
                          <Slider 
                            value={[activeTx.overrideTemp || 40]} 
                            min={20} 
                            max={120} 
                            step={1}
                            onValueChange={(v) => {
                              const val = Array.isArray(v) ? v[0] : v;
                              if (typeof val === 'number') setOverride(activeTx.id, 'temp', val);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3 text-xs text-slate-500 italic">
                        <Cpu className="w-4 h-4 text-blue-600" />
                        AI is currently managing this transformer's parameters.
                      </div>
                    )}

                    {activeTx.isTripped && (
                      <Button 
                        variant="destructive" 
                        className="w-full gap-2"
                        onClick={() => resetTrip(activeTx.id)}
                      >
                        <RefreshCw className="w-4 h-4" /> Reset Circuit Breaker
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Monitoring & Alerts */}
            <div className="col-span-8 flex flex-col gap-6">
              <Card className="flex-1 border-none shadow-2xl bg-slate-900 text-white overflow-hidden">
                <CardHeader className="border-b border-white/10 bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-blue-400" /> AI Grid Sentinel
                    </CardTitle>
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                      Live Monitoring
                    </Badge>
                  </div>
                  <CardDescription className="text-slate-400">
                    Continuous analysis of thermal, current, and phase stability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="p-4 space-y-3">
                      <AnimatePresence initial={false}>
                        {aiLogs.map((log) => (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                              "p-3 rounded-lg border text-xs flex gap-3",
                              log.type === 'error' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                              log.type === 'warning' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                              "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            )}
                          >
                            <div className="mt-0.5">
                              {log.type === 'error' ? <ShieldAlert className="w-4 h-4" /> :
                               log.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                               <Bell className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="leading-relaxed">{log.msg}</p>
                              <p className="text-[10px] opacity-50 font-mono">{log.time}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {aiLogs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500">
                          <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-sm">System stable. No anomalies detected.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Distribution Network Section - MOVED BELOW DETAILS */}
          <div className="grid grid-cols-1 gap-8">
            <Card className="border border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                  <LayoutDashboard className="w-5 h-5 text-blue-600" /> Distribution Network: {activeTx.name}
                </CardTitle>
                <CardDescription className="text-slate-500">Real-time status of all 10 distribution posts on this feeder</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {state.feeders.find(f => f.transformerId === activeTx.id)?.poles.map(pole => (
                    <div key={pole.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-3 hover:bg-slate-100 transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{pole.name}</span>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] py-0 border-none",
                            activeTx.isTripped ? "bg-slate-200 text-slate-500" :
                            pole.voltage > 10000 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}
                        >
                          {pole.voltage > 0 ? `${pole.voltage.toFixed(0)}V` : 'OFF'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Load</span>
                          <span className="font-mono font-bold text-blue-600">{pole.powerKW.toFixed(2)} kW</span>
                        </div>
                        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600" 
                            style={{ width: `${Math.min((pole.powerKW / 10) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Current</span>
                        <span className="font-mono text-slate-700">{pole.current.toFixed(1)} A</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-8">
            <Card className="border border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                  <BarChart3 className="w-5 h-5 text-blue-600" /> Temperature Trends
                </CardTitle>
                <CardDescription className="text-slate-500">Real-time winding temperature monitoring</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[20, 100]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    {state.transformers.map((tx, i) => (
                      <Area 
                        key={tx.id}
                        type="monotone" 
                        dataKey={`${tx.id}_temp`} 
                        stroke={i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : i === 2 ? '#ec4899' : i === 3 ? '#10b981' : '#f59e0b'}
                        fillOpacity={1} 
                        fill="url(#colorTemp)" 
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                  <Zap className="w-5 h-5 text-blue-600" /> Load Profiles
                </CardTitle>
                <CardDescription className="text-slate-500">Active power utilization per transformer</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 150]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    {state.transformers.map((tx, i) => (
                      <Area 
                        key={tx.id}
                        type="monotone" 
                        dataKey={`${tx.id}_load`} 
                        stroke={i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : i === 2 ? '#ec4899' : i === 3 ? '#10b981' : '#f59e0b'}
                        fillOpacity={1} 
                        fill="url(#colorLoad)" 
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Schematic Section - MOVED TO BOTTOM */}
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-lg relative h-[600px]">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-900">
                    <Network className="w-5 h-5 text-blue-600" /> Grid Schematic Topology
                  </CardTitle>
                  <CardDescription className="text-slate-500">Real-time power flow and node status visualization</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100">Healthy</Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100">Warning</Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100">Critical</Badge>
                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-100">Tripped</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 h-full relative overflow-hidden">
              {/* Schematic Background Grid */}
              <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
              
              <div className="relative h-full flex flex-col justify-around">
                {state.transformers.map((tx, idx) => {
                  const feeder = state.feeders.find(f => f.transformerId === tx.id);
                  const txColor = tx.isTripped ? '#94a3b8' : tx.health === 'critical' ? '#dc2626' : tx.health === 'warning' ? '#f59e0b' : '#10b981';
                  
                  return (
                    <div key={tx.id} className="flex items-center gap-8 relative z-10">
                      {/* Transformer Node */}
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setSelectedTx(tx.id)}
                        className={cn(
                          "w-16 h-16 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all",
                          selectedTx === tx.id ? "scale-110 ring-4 ring-blue-100" : ""
                        )}
                        style={{ 
                          borderColor: txColor,
                          backgroundColor: `${txColor}10`,
                        }}
                      >
                        <Zap className="w-8 h-8" style={{ color: txColor }} />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap text-slate-600 uppercase tracking-tighter">
                          {tx.name}
                        </div>
                      </motion.div>

                      {/* Feeder Line */}
                      <div className="flex-1 h-1 relative overflow-hidden rounded-full bg-white/5">
                        <motion.div 
                          className="absolute inset-0"
                          style={{ 
                            backgroundColor: txColor,
                            opacity: tx.isTripped ? 0.2 : 0.6,
                            boxShadow: `0 0 10px ${txColor}`
                          }}
                          animate={!tx.isTripped ? {
                            x: ['-100%', '100%'],
                          } : {}}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                        />
                      </div>

                      {/* Distribution Nodes */}
                      <div className="flex gap-2">
                        {feeder?.poles.slice(0, 5).map((pole, pIdx) => (
                          <div 
                            key={pole.id} 
                            className="w-4 h-4 rounded-full border border-slate-200"
                            style={{ 
                              backgroundColor: tx.isTripped ? '#cbd5e1' : '#3b82f6',
                            }}
                          />
                        ))}
                        <div className="text-[10px] font-bold text-slate-400 self-center ml-2">
                          +5 more
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      {/* Map Modal */}
      <AnimatePresence>
        {showMap && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-full flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-blue-600" /> Grid Asset Locations
                  </h2>
                  <p className="text-sm text-slate-500">Geospatial distribution of transformers and nodes</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowMap(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <div className="flex-1 relative">
                <MapContainer 
                  center={[-1.2833, 36.8167]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {state.transformers.map(tx => (
                    <Marker key={tx.id} position={[tx.position.lat, tx.position.lng]}>
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-blue-600">{tx.name}</h3>
                          <p className="text-xs text-slate-600">Status: {tx.isTripped ? 'Tripped' : tx.health}</p>
                          <p className="text-xs text-slate-600">Load: {tx.loadPercentage.toFixed(1)}%</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {state.feeders.map(feeder => 
                    feeder.poles.map(pole => (
                      <Marker 
                        key={pole.id} 
                        position={[pole.position.lat, pole.position.lng]}
                        // Optional: use a different icon for poles if you want
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-slate-900">{pole.name}</h3>
                            <p className="text-xs text-slate-600">Voltage: {pole.voltage.toFixed(0)}V</p>
                            <p className="text-xs text-slate-600">Load: {pole.powerKW.toFixed(2)}kW</p>
                            <p className="text-xs text-slate-500 italic">Feeder: {feeder.name}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))
                  )}
                </MapContainer>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showTempTrends && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[600px] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" /> Temperature Trends
                  </h2>
                  <p className="text-sm text-slate-500">Real-time winding temperature monitoring</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowTempTrends(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <div className="flex-1 p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[20, 100]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    {state.transformers.map((tx, i) => (
                      <Area 
                        key={tx.id}
                        type="monotone" 
                        dataKey={`${tx.id}_temp`} 
                        stroke={i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : i === 2 ? '#ec4899' : i === 3 ? '#10b981' : '#f59e0b'}
                        fillOpacity={1} 
                        fill="url(#colorTemp)" 
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showLoadProfiles && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[600px] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600" /> Load Profiles
                  </h2>
                  <p className="text-sm text-slate-500">Active power utilization per transformer</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowLoadProfiles(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <div className="flex-1 p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 150]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '10px' }}
                    />
                    {state.transformers.map((tx, i) => (
                      <Area 
                        key={tx.id}
                        type="monotone" 
                        dataKey={`${tx.id}_load`} 
                        stroke={i === 0 ? '#3b82f6' : i === 1 ? '#8b5cf6' : i === 2 ? '#ec4899' : i === 3 ? '#10b981' : '#f59e0b'}
                        fillOpacity={1} 
                        fill="url(#colorLoad)" 
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
