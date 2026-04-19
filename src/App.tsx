import React, { useState, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Battery, 
  Zap, 
  Thermometer, 
  Wifi, 
  Activity, 
  Clock, 
  Settings,
  AlertTriangle,
  ZapOff,
  Navigation
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
import { BMSData, PackData } from './types';

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const isCharging = status.toLowerCase() === 'charging';
  return (
    <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 ${
      isCharging 
        ? 'bg-charging/10 text-charging border border-charging/20' 
        : 'bg-discharging/10 text-discharging border border-discharging/20'
    } font-semibold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isCharging ? 'bg-charging animate-pulse' : 'bg-discharging'}`} />
      {status}
    </div>
  );
};

const ValueDisplay = ({ label, value, unit, color = "text-text-main" }: { label: string, value: string | number, unit?: string, color?: string }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-sans uppercase text-text-dim tracking-[0.1em] mb-1 font-medium">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-[1.8rem] font-bold tracking-tight ${color}`}>{value}</span>
      {unit && <span className="text-xs text-text-dim font-mono italic">{unit}</span>}
    </div>
  </div>
);

const CellGrid = ({ pack }: { pack: PackData }) => (
  <div className="grid grid-cols-4 gap-2 mt-4 bg-black/20 p-3 rounded-lg border border-white/5">
    {[1, 2, 3, 4].map((num) => {
      const val = pack[`cell${num}_v` as keyof PackData];
      const isWarn = parseFloat(val as string) < 3.2;
      return (
        <div key={num} className="flex flex-col items-center bg-[#0f172a]/50 p-2 rounded-lg border border-white/[0.03]">
          <span className={`text-[0.9rem] font-semibold ${isWarn ? 'text-red-400' : 'text-accent'}`}>
            {val}V
          </span>
          <span className="text-[0.65rem] text-text-dim uppercase mt-1">Cell {num}</span>
        </div>
      );
    })}
  </div>
);

const PackView = ({ pack, title, id }: { pack: PackData, title: string, id: number }) => (
  <motion.div 
    layout
    className="bg-card p-6 rounded-2xl border border-white/5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] relative overflow-hidden"
  >
    <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.03]">
      <div className="flex items-center gap-2">
         <span className="text-[0.75rem] font-sans uppercase tracking-[0.1em] text-text-dim">{title} - STATUS</span>
      </div>
      <StatusBadge status={pack.status} />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <ValueDisplay label="Total Voltage" value={pack.total_v} unit="V" />
      <ValueDisplay label="Current Flow" value={pack.current_a} unit="A" color="text-accent" />
    </div>

    <CellGrid pack={pack} />
  </motion.div>
);

interface TemperatureProbeProps {
  value: number | null;
  id: number;
  key?: React.Key;
}

const TemperatureProbe = ({ value, id }: TemperatureProbeProps) => {
  const isNull = value === null;
  const isHigh = value !== null && value > 50;
  
  return (
    <div className="flex-1 bg-card p-3 rounded-xl text-center border border-white/5 shadow-sm">
      <div className="text-[0.75rem] text-text-dim mb-1 uppercase font-medium">NTC {id + 1}</div>
      <div className={`text-[1.1rem] font-bold font-mono ${isNull ? 'text-gray-800' : isHigh ? 'text-red-400' : 'text-text-main'}`}>
        {isNull ? '--' : value.toFixed(1)}°C
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [data, setData] = useState<BMSData | null>(null);
  const [history, setHistory] = useState<BMSData[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to local server
    const socket: Socket = io();

    socket.on('connect', () => {
      setConnected(true);
      console.log('Connected to BMS Server');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('bms_update', (newUpdate: BMSData) => {
      setData(newUpdate);
      setHistory(prev => {
        const next = [...prev, newUpdate];
        if (next.length > 50) return next.slice(1);
        return next;
      });
    });

    // Fetch initial history
    fetch('/api/history')
      .then(res => res.json())
      .then(json => {
        if (Array.isArray(json)) setHistory(json);
      });

    return () => {
      socket.disconnect();
    };
  }, []);

  const chartData = useMemo(() => {
    return history.map(d => ({
      time: new Date(d.received_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      p1_w: parseFloat(d.pack1.power_w),
      p2_w: parseFloat(d.pack2.power_w),
      p1_v: parseFloat(d.pack1.total_v),
      p2_v: parseFloat(d.pack2.total_v),
      temp: (d.temperature_c[0] || 0)
    }));
  }, [history]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center font-sans p-6 text-center">
        <Activity className="text-blue-500 animate-pulse mb-4" size={48} />
        <h1 className="text-2xl font-light tracking-tighter mb-2">Awaiting BMS Uplink</h1>
        <p className="text-gray-500 max-w-md text-sm font-mono uppercase tracking-widest leading-relaxed">
          Ensure ESP32 is powered and correctly configured to post to <br/>
          <span className="text-blue-400 break-all">{window.location.origin}/api/bms</span>
        </p>
        <div className="mt-8 flex gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-gray-600">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            WS SERVER: {connected ? 'READY' : 'CONNECTING'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-accent/30 flex flex-col">
      {/* Top Header */}
      <header className="h-[70px] border-b border-white/5 bg-gradient-to-r from-card to-bg z-50 flex items-center px-10 justify-between">
        <div className="logo text-[1.5rem] font-bold tracking-[-0.05em] text-accent">LITHIUM_BMS.CORE</div>
        
        <div className="hidden md:flex items-center gap-6 text-[0.85rem] text-text-dim">
          <span>DEVICE: <span className="text-text-main font-medium">{data.device_id}</span></span>
          <span className="flex items-center gap-1.5"><Wifi size={14} className="text-accent" /> RSSI <span className="text-text-main font-medium">{data.wifi_rssi_sta} dBm</span></span>
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-accent" /> UPTIME <span className="text-text-main font-medium">{(data.timestamp_ms / 1000 / 60).toFixed(1)} MIN</span></span>
          <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold text-[0.75rem]">STA CONNECTED</div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-10 grid grid-cols-2 gap-5">
        {/* Pack Overview */}
        <PackView id={1} title="PACK 01" pack={data.pack1} />
        <PackView id={2} title="PACK 02" pack={data.pack2} />

        {/* Temperature Strip */}
        <div className="col-span-2 flex gap-3 justify-between">
          {(data.temperature_c as (number | null)[]).map((t, i) => (
            <TemperatureProbe key={i} id={i} value={t} />
          ))}
        </div>

        {/* Charts */}
        <div className="col-span-2 bg-card p-6 rounded-2xl border border-white/5 shadow-sm">
          <div className="text-[0.75rem] text-text-dim uppercase tracking-[0.1em] mb-4 font-medium flex justify-between items-center">
            <span>Real-Time Power Consumption (W)</span>
            <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-accent font-mono uppercase">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  Alpha
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-discharging font-mono uppercase">
                  <div className="w-2 h-2 rounded-full bg-discharging" />
                  Bravo
                </div>
              </div>
          </div>
          
          <div className="h-[180px] w-full bg-gradient-to-b from-accent/[0.05] to-transparent rounded-xl border border-white/5 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorP1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorP2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#ffffff10', fontSize: '10px', fontFamily: 'monospace' }} 
                />
                <Area type="monotone" dataKey="p1_w" stroke="#38bdf8" fillOpacity={1} fill="url(#colorP1)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="p2_w" stroke="#f59e0b" fillOpacity={1} fill="url(#colorP2)" strokeWidth={2} isAnimationActive={false} strokeOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Global Stats Footer Replacement with instructions look */}
        <div className="col-span-2 bg-card p-4 rounded-xl border border-white/5 shadow-sm">
           <div className="text-[0.75rem] text-text-dim uppercase tracking-[0.1em] mb-4 font-medium">Connection Guide</div>
           <div className="grid grid-cols-2 gap-5">
              <div className="text-[0.8rem] leading-relaxed text-text-dim bg-black/20 p-3 rounded-lg">
                  1. Points your ESP32 <span className="bg-accent/10 text-accent px-1 rounded font-mono">API_ENDPOINT</span> to this URL.<br/>
                  2. Ensure the ESP32 and Web App share the same <span className="bg-accent/10 text-accent px-1 rounded font-mono">API_SECRET</span> key.<br/>
                  3. Use Socket.io on <span className="bg-accent/10 text-accent px-1 rounded font-mono">PORT 3000</span> for real-time sync.
              </div>
              <div className="text-[0.8rem] leading-relaxed text-text-dim bg-black/20 p-3 rounded-lg">
                  4. Monitor locally at <span className="bg-accent/10 text-accent px-1 rounded font-mono">192.168.4.1</span> via Access Point.<br/>
                  5. Cell thresholds are set to <span className="bg-accent/10 text-accent px-1 rounded font-mono">3.2V</span> for discharge warnings.<br/>
                  6. Uplink frequency should be <span className="bg-accent/10 text-accent px-1 rounded font-mono">1.0s</span> for optimal tracking.
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
