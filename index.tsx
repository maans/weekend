
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Users, Utensils, Trash2, FileText, Upload, ChevronRight, ArrowRightLeft, 
  Trash, CheckCircle2, XCircle, Printer, ChevronUp, ChevronDown, Database, 
  Search, X, Clock, Bed, MapPin, Plus, Lock, Unlock, AlertCircle, Check, 
  Home, HelpCircle, BookOpen, PieChart, Download, Compass, Flame, Info, Save, RotateCcw, Hash, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- HJÆLPERE ---
const getWeekNumber = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  // Torsdag i samme uge bestemmer ugenummeret (ISO 8601)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getActualDayName = () => {
  const d = new Date().getDay();
  if (d === 6) return 'Lørdag';
  if (d === 0) return 'Søndag';
  return 'Fredag';
};

const cleanValue = (val: any) => {
  if (val === null || val === undefined) return '';
  return String(val).split(',')[0].split('(')[0].trim();
};

// --- KONFIGURATION ---
const STORAGE_KEY = 'weekend_master_v8_stable';
const WISE_COLORS = ['bg-[#FFB300]', 'bg-[#00BFA5]', 'bg-[#D81B60]', 'bg-[#1E88E5]', 'bg-[#5E35B1]'];

const CLEANING_CONFIG = [
  { name: "Arken", count: 2 },
  { name: "Den lange gang", count: 3 },
  { name: "Gangene i treenigheden", count: 2 },
  { name: "Biografen", count: 1 },
  { name: "Kunst", count: 1 },
  { name: "Klassefløjen + toiletter", count: 4 },
  { name: "Toiletter i hallen", count: 3 },
  { name: "Toiletter på den lange gang", count: 2 },
  { name: "Gymnastiksalen", count: 2 },
  { name: "Hallen", count: 2 }
];

const TASK_CONFIG = [
  { id: 'f1', label: 'Fredag: Før Aftensmad', day: 'Fredag' },
  { id: 'f2', label: 'Fredag: Efter Aftensmad', day: 'Fredag' },
  { id: 'f3', label: 'Fredag: Aftenservering', day: 'Fredag' },
  { id: 'l1', label: 'Lørdag: Før Mokost', day: 'Lørdag' },
  { id: 'l2', label: 'Lørdag: Efter Mokost', day: 'Lørdag' },
  { id: 'l3', label: 'Lørdag: Før Aftensmad', day: 'Lørdag' },
  { id: 'l4', label: 'Lørdag: Efter Aftensmad', day: 'Lørdag' },
  { id: 'l5', label: 'Lørdag: Aftenservering', day: 'Lørdag' },
  { id: 's1', label: 'Søndag: Før Mokost', day: 'Søndag' },
  { id: 's2', label: 'Søndag: Efter Mokost', day: 'Søndag' }
];

const COMMON_SLEEPING_AREAS = ["Teltet", "Shelteret", "Gymnastiksalen", "Medie", "Biografen", "Andet"];

const processExcelData = (data: any[][]) => {
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const findIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

  const idx = {
    first: findIdx(['fornavn', 'first name']),
    last: findIdx(['efternavn', 'last name']),
    room: findIdx(['værelse', 'room']),
    house: findIdx(['house', 'gang', 'hus']),
    weekend: findIdx(['weekend', 'til stede', 'status'])
  };

  return data.slice(1).filter(row => row.length > 0 && row[idx.first]).map((row, i) => {
    const presenceStr = String(row[idx.weekend] || '').toLowerCase();
    let stayType = 'none';
    if (presenceStr.includes('hele') || presenceStr === 'ja' || presenceStr === '1' || presenceStr === 'true') stayType = 'full';
    else if (presenceStr.includes('indtil lørdag')) stayType = 'saturday';

    const house = cleanValue(row[idx.house]) || 'Ukendt Gang';
    const room = cleanValue(row[idx.room]) || '??';

    return {
      id: `std-${Date.now()}-${i}`,
      firstName: String(row[idx.first] || ''),
      lastName: String(row[idx.last] || ''),
      room, house,
      isPresent: stayType !== 'none',
      stayType,
      isKitchenDuty: false,
      isMarked: false,
      hasReturned: false,
      sleepingLocations: { 'Fredag': `${house} - ${room}`, 'Lørdag': `${house} - ${room}`, 'Søndag': `${house} - ${room}` }
    };
  });
};

const App = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('import');
  const [weekendNum, setWeekendNum] = useState(String(getWeekNumber(new Date())));
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string[]>>({});
  const [cleaningAssignments, setCleaningAssignments] = useState<Record<string, string[]>>({});
  const [lockedSlots, setLockedSlots] = useState<Record<string, boolean>>({});
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [brandListDay, setBrandListDay] = useState(getActualDayName());
  const [expandedHouses, setExpandedHouses] = useState<Record<string, boolean>>({});
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [manualAdd, setManualAdd] = useState<any | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [roomSearchTerm, setRoomSearchTerm] = useState('');

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.students) setStudents(p.students);
        if (p.weekendNum) setWeekendNum(p.weekendNum);
        setTaskAssignments(p.taskAssignments || {});
        setCleaningAssignments(p.cleaningAssignments || {});
        setLockedSlots(p.lockedSlots || {});
      } catch (e) { console.error("Load error", e); }
    }
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots }));
    }
  }, [students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots]);

  // Opdater document.title for PDF navngivning
  useEffect(() => {
    if (previewType) {
      const titles: Record<string, string> = {
        main: `Weekend ${weekendNum} - Plan & Rengøring`,
        brand: `Weekend ${weekendNum} - Brandlister`,
        sunday: `Weekend ${weekendNum} - Søndagsliste`
      };
      document.title = titles[previewType] || 'Weekend';
    } else {
      document.title = 'Weekend';
    }
  }, [previewType, weekendNum]);

  const stats = useMemo(() => {
    const present = students.filter(s => s.isPresent);
    return {
      total: present.length,
      full: present.filter(s => s.stayType === 'full').length,
      sat: present.filter(s => s.stayType === 'saturday').length,
      kitchen: students.filter(s => s.isKitchenDuty).length
    };
  }, [students]);

  const allSchoolRooms = useMemo(() => {
    const rooms = new Map();
    students.forEach(s => {
      if (!rooms.has(s.room)) {
        rooms.set(s.room, s.house);
      }
    });
    return Array.from(rooms.entries()).sort((a,b) => a[0].localeCompare(b[0]));
  }, [students]);

  const downloadBackup = () => {
    const data = JSON.stringify({ students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekend_${weekendNum}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target?.result as string);
        if (p.students) setStudents(p.students);
        if (p.weekendNum) setWeekendNum(p.weekendNum);
        setTaskAssignments(p.taskAssignments || {});
        setCleaningAssignments(p.cleaningAssignments || {});
        setLockedSlots(p.lockedSlots || {});
        alert("Backup indlæst!");
      } catch (e) { alert("Ugyldig backup-fil."); }
    };
    reader.readAsText(file);
  };

  const performAutoGeneration = useCallback((currentSts = students) => {
    const newTasks = { ...taskAssignments };
    const newClean = { ...cleaningAssignments };
    Object.keys(newTasks).forEach(k => !lockedSlots[k] && (newTasks[k] = []));
    Object.keys(newClean).forEach(k => !lockedSlots[k] && (newClean[k] = []));

    const eligible = currentSts.filter(s => s.isPresent && !s.isKitchenDuty);
    let pool = [...eligible].sort(() => Math.random() - 0.5);
    let used = new Set();
    // Fix: Explicitly cast 'v' to string[] to avoid TS unknown error
    Object.entries(taskAssignments).forEach(([k, v]) => { if(lockedSlots[k]) (v as string[]).forEach(id => used.add(id)); });

    TASK_CONFIG.forEach(t => {
      if (lockedSlots[t.id]) return;
      const assigned = pool.filter(s => !used.has(s.id)).slice(0, 2).map(s => s.id);
      newTasks[t.id] = assigned;
      assigned.forEach(id => used.add(id));
    });

    const cleanEligible = currentSts.filter(s => s.stayType === 'full' && !s.isKitchenDuty);
    let cPool = [...cleanEligible].sort(() => Math.random() - 0.5);
    let cIdx = 0;
    CLEANING_CONFIG.forEach(area => {
      if (lockedSlots[area.name]) return;
      const assigned = cPool.slice(cIdx, cIdx + area.count).map(s => s.id);
      newClean[area.name] = assigned;
      cIdx += area.count;
    });

    setTaskAssignments(newTasks);
    setCleaningAssignments(newClean);
  }, [students, taskAssignments, cleaningAssignments, lockedSlots]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result as string, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const parsed = processExcelData(data);
        if (parsed.length > 0) {
          setStudents(parsed);
          // Rens gamle tildelinger for at undgå "??"
          setTaskAssignments({});
          setCleaningAssignments({});
          setActiveTab('students');
          setTimeout(() => performAutoGeneration(parsed), 100);
        }
      } catch (err) { alert("Fejl ved læsning af Excel."); }
    };
    reader.readAsBinaryString(file);
  };

  const houseOrder = useMemo(() => Array.from(new Set(students.map(s => s.house))).filter(Boolean).sort(), [students]);
  const getName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}` : '??'; };
  const getStatusLabel = (sid: string) => {
    const s = students.find(x => x.id === sid);
    if (!s) return null;
    if (s.isKitchenDuty) return "Køkken";
    // Fix: Explicitly cast 'ids' to string[] to avoid TS unknown error
    const inTask = Object.values(taskAssignments).some(ids => (ids as string[]).includes(sid));
    // Fix: Explicitly cast 'ids' to string[] to avoid TS unknown error
    const inClean = Object.values(cleaningAssignments).some(ids => (ids as string[]).includes(sid));
    if (inTask && inClean) return "T+R";
    if (inTask) return "Tjans";
    if (inClean) return "Rengør";
    return null;
  };

  const filtered = students.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    if (showAllStudents) return matchSearch;
    return matchSearch && s.isPresent;
  }).sort((a,b) => a.firstName.localeCompare(b.firstName));

  const currentEditingStudent = useMemo(() => students.find(x => x.id === editingLoc), [editingLoc, students]);
  const roomsOnCurrentGang = useMemo(() => {
    if (!currentEditingStudent) return [];
    return Array.from(new Set(students.filter(x => x.house === currentEditingStudent.house).map(x => x.room))).sort();
  }, [currentEditingStudent, students]);

  return (
    <div className={`min-h-screen ${previewType ? 'bg-white text-black' : 'pb-32'}`}>
      {!previewType && (
        <>
          <header className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#0A0E1A]/80 backdrop-blur-xl z-50">
            <div className="flex items-center gap-3">
              <div className="bg-[#FFB300] p-2 rounded-xl text-black shadow-lg shadow-[#FFB300]/20"><Compass className="w-6 h-6"/></div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Weekend {weekendNum}</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFaq(true)} className="p-2 text-white/40"><HelpCircle className="w-5 h-5"/></button>
              <button onClick={() => { if(confirm("Nulstil alt?")) { localStorage.clear(); location.reload(); }}} className="p-2 text-red-500/40"><RotateCcw className="w-5 h-5"/></button>
            </div>
          </header>

          <main className="p-4 max-w-xl mx-auto space-y-6">
            {activeTab === 'import' && (
              <div className="py-6 space-y-6">
                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-4">
                  <div className="flex items-center gap-4 text-[#FFB300] mb-2">
                     <Hash className="w-5 h-5"/>
                     <span className="text-[10px] font-black uppercase tracking-widest">Weekend Nummer</span>
                  </div>
                  <input type="number" value={weekendNum} onChange={e => setWeekendNum(e.target.value)} className="w-full bg-black/30 border border-white/10 p-5 rounded-2xl text-2xl font-black outline-none focus:border-[#FFB300] transition-all"/>
                </div>

                <div className="bg-white/5 p-12 rounded-[3rem] border border-white/10 text-center">
                  <Upload className="mx-auto w-12 h-12 text-[#FFB300] mb-6"/>
                  <h2 className="text-2xl font-black mb-4 uppercase">Indlæs Elevdata</h2>
                  <input type="file" id="up" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv"/>
                  <label htmlFor="up" className="block w-full py-6 bg-[#00BFA5] text-black rounded-3xl font-black uppercase text-xs cursor-pointer shadow-2xl shadow-[#00BFA5]/20">Vælg Excel Fil</label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={downloadBackup} className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-2">
                    <Save className="text-[#1E88E5]"/>
                    <span className="text-[10px] font-black uppercase">Gem Backup</span>
                  </button>
                  <label htmlFor="restore" className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-2 cursor-pointer">
                    <Download className="text-[#00BFA5]"/>
                    <span className="text-[10px] font-black uppercase">Hent Backup</span>
                    <input type="file" id="restore" className="hidden" onChange={handleRestore} accept=".json"/>
                  </label>
                </div>
                
                {students.length > 0 && (
                  <div className="bg-[#1E88E5]/10 p-8 rounded-[2.5rem] border border-[#1E88E5]/30 space-y-6 text-center">
                    <PieChart className="w-8 h-8 mx-auto text-[#1E88E5]"/>
                    <div className="grid grid-cols-2 gap-4 text-center">
                       <div className="bg-white/5 p-5 rounded-2xl">
                          <p className="text-[10px] font-black uppercase opacity-40 mb-1">Tilmeldt</p>
                          <p className="text-3xl font-black">{stats.total}</p>
                       </div>
                       <div className="bg-white/5 p-5 rounded-2xl">
                          <p className="text-[10px] font-black uppercase opacity-40 mb-1">Køkken</p>
                          <p className="text-3xl font-black text-[#D81B60]">{stats.kitchen}</p>
                       </div>
                    </div>
                    <button onClick={() => performAutoGeneration()} className="w-full py-5 bg-[#FFB300] text-black rounded-2xl font-black uppercase text-xs shadow-lg">Gendan alle tjanser</button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/>
                    <input type="text" placeholder="Søg..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 pl-12 rounded-2xl outline-none focus:border-[#FFB300] transition-all"/>
                  </div>
                  <button onClick={() => setShowAllStudents(!showAllStudents)} className={`px-5 rounded-2xl flex items-center gap-2 font-black uppercase text-[9px] border transition-all ${showAllStudents ? 'bg-[#00BFA5] text-black border-[#00BFA5]' : 'bg-white/5 border-white/10 text-white/40'}`}>
                    <Filter className="w-4 h-4"/> {showAllStudents ? 'Vis Alle' : 'Tilmeldte'}
                  </button>
                </div>

                {filtered.map((s, i) => (
                  <div key={s.id} className="relative overflow-hidden rounded-[2rem] mb-2 wise-card">
                    <div className={`${WISE_COLORS[i % 5]} p-5 text-black shadow-lg flex items-center justify-between gap-3 transition-transform duration-150 select-none ${!s.isPresent ? 'opacity-30 grayscale' : ''}`}>
                      <div className="flex-1 min-w-0" onClick={() => setStudents(p => p.map(x => x.id === s.id ? {...x, isPresent: !x.isPresent, stayType: !x.isPresent ? 'full' : 'none'} : x))}>
                          <p className="text-lg font-black leading-tight break-words">{s.firstName} {s.lastName}</p>
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-[0.1em]">{s.house} • {s.room}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setStudents(p => p.map(x => x.id === s.id ? {...x, isKitchenDuty: !x.isKitchenDuty} : x)) }} className={`w-24 py-3 rounded-xl text-[9px] font-black uppercase border tracking-[0.1em] transition-all shrink-0 ${s.isKitchenDuty ? 'bg-black text-white border-black' : 'bg-black/10 border-transparent text-black'}`}>
                        {s.isKitchenDuty ? 'Køkken' : 'Køkken?'}
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && !showAllStudents && students.length > 0 && (
                    <div className="text-center py-10 opacity-30">
                        <p className="text-sm font-black uppercase mb-4 italic">Ingen tilmeldte elever matcher din søgning.</p>
                        <button onClick={() => setShowAllStudents(true)} className="px-6 py-3 border border-white/20 rounded-xl text-[10px] font-black uppercase">Se alle elever (inkl. afmeldte)</button>
                    </div>
                )}
              </div>
            )}

            {activeTab === 'rounds' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Gange</h2>
                  <div className="flex bg-white/5 p-1 rounded-xl">
                    {['Fredag', 'Lørdag', 'Søndag'].map(d => <button key={d} onClick={() => setBrandListDay(d)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg ${brandListDay === d ? 'bg-[#FFB300] text-black' : 'opacity-30'}`}>{d}</button>)}
                  </div>
                </div>
                {houseOrder.map((house, idx) => {
                  const houseSts = students.filter(s => s.house === house && s.isPresent);
                  const isExp = expandedHouses[house];
                  return (
                    <div key={house} className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                      <div className="p-7 flex justify-between items-center cursor-pointer" onClick={() => setExpandedHouses(p => ({...p, [house]: !isExp}))}>
                         <div className="flex items-center gap-4">
                            <div className={`${WISE_COLORS[idx % 5]} w-12 h-12 rounded-2xl flex items-center justify-center text-black font-black shadow-lg`}>{houseSts.length}</div>
                            <span className="font-black uppercase tracking-widest text-sm">{house}</span>
                         </div>
                         <div className="opacity-20">{isExp ? <ChevronUp/> : <ChevronDown/>}</div>
                      </div>
                      {isExp && (
                        <div className="p-3 border-t border-white/5 space-y-2 bg-black/20">
                          {houseSts.map(s => {
                            const isChanged = s.sleepingLocations[brandListDay] !== `${s.house} - ${s.room}`;
                            return (
                              <div key={s.id} className={`bg-white/5 p-5 rounded-2xl flex justify-between items-center border transition-all ${isChanged ? 'border-[#FFB300]/50 bg-[#FFB300]/5' : 'border-transparent'}`}>
                                 <div className="flex items-center gap-4">
                                    <button onClick={() => setStudents(p => p.map(x => x.id === s.id ? {...x, isMarked: !x.isMarked} : x))} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${s.isMarked ? 'bg-[#00BFA5] border-[#00BFA5] text-black' : 'border-white/10 text-transparent'}`}><Check className="w-5 h-5"/></button>
                                    <div>
                                      <p className="font-black text-lg">{s.firstName}</p>
                                      <div className="flex items-center gap-2">
                                        {isChanged && <AlertCircle className="w-3 h-3 text-[#FFB300]"/>}
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isChanged ? 'text-[#FFB300]' : 'opacity-30'}`}>{s.sleepingLocations[brandListDay]}</p>
                                      </div>
                                    </div>
                                 </div>
                                 <button onClick={() => setEditingLoc(s.id)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10"><MapPin className={`w-5 h-5 ${isChanged ? 'text-[#FFB300]' : 'opacity-20'}`}/></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black uppercase">Tjanser</h2>
                  <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase bg-[#FFB300] text-black px-5 py-2 rounded-xl shadow-lg">Auto</button>
                </div>
                {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                  <div key={day} className="space-y-4">
                    <h3 className="text-xs font-black text-[#FFB300] uppercase tracking-[0.3em] border-b border-white/5 pb-2 ml-2">{day}</h3>
                    {TASK_CONFIG.filter(t => t.day === day).map((t, i) => (
                      <div key={t.id} className={`${WISE_COLORS[i % 5]} p-7 rounded-[3rem] text-black shadow-lg`}>
                        <div className="flex justify-between items-start mb-6">
                          <h4 className="text-xl font-black uppercase">{t.label}</h4>
                          <button onClick={() => setLockedSlots(p => ({...p, [t.id]: !p[t.id]}))} className="p-2 bg-black/10 rounded-xl">{lockedSlots[t.id] ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4 opacity-40"/>}</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {(taskAssignments[t.id] || []).map(sid => (
                             <div key={sid} className="bg-black/20 px-4 py-3 rounded-2xl text-sm font-black flex items-center gap-3">
                                {getName(sid)} <button onClick={() => setTaskAssignments(p => ({...p, [t.id]: p[t.id].filter(x => x !== sid)}))}><X className="w-4 h-4"/></button>
                             </div>
                           ))}
                           <button onClick={() => setManualAdd({id: t.id, type: 'task'})} className="p-3 bg-black/10 rounded-2xl"><Plus className="w-5 h-5"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'cleaning' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black uppercase">Rengøring</h2>
                  <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase bg-[#FFB300] text-black px-5 py-2 rounded-xl shadow-lg">Auto</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   {CLEANING_CONFIG.map((area, idx) => (
                     <div key={area.name} className={`${WISE_COLORS[idx % 5]} p-7 rounded-[3rem] text-black shadow-lg`}>
                        <div className="flex justify-between items-start mb-6">
                           <h4 className="font-black text-lg uppercase tracking-widest">{area.name}</h4>
                           <button onClick={() => setLockedSlots(p => ({...p, [area.name]: !p[area.name]}))} className="p-2 bg-black/10 rounded-xl">{lockedSlots[area.name] ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4 opacity-40"/>}</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {(cleaningAssignments[area.name] || []).map(sid => (
                             <div key={sid} className="bg-black/20 px-4 py-3 rounded-2xl text-sm font-black flex items-center gap-3">
                                {getName(sid)} <button onClick={() => setCleaningAssignments(p => ({...p, [area.name]: p[area.name].filter(x => x !== sid)}))}><X className="w-4 h-4"/></button>
                             </div>
                           ))}
                           <button onClick={() => setManualAdd({id: area.name, type: 'cleaning'})} className="p-3 bg-black/10 rounded-2xl"><Plus className="w-5 h-5"/></button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'print' && (
              <div className="py-10 space-y-6 text-center">
                <h2 className="text-2xl font-black uppercase tracking-widest mb-10 opacity-40">Print & Lister</h2>
                <button onClick={() => setPreviewType('main')} className="w-full p-10 bg-[#FFB300] text-black rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#FFB300]/10">Plan & Rengøring <FileText/></button>
                <button onClick={() => setPreviewType('brand')} className="w-full p-10 bg-[#D81B60] text-white rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#D81B60]/10">Brandlister <Flame/></button>
                <button onClick={() => setPreviewType('sunday')} className="w-full p-10 bg-[#00BFA5] text-black rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#00BFA5]/10">Søndagsliste <CheckCircle2/></button>
              </div>
            )}
          </main>

          <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0E1A]/95 backdrop-blur-3xl border-t border-white/10 p-8 flex justify-around items-center no-print z-[100]">
             <button onClick={() => setActiveTab('import')} className={`p-2 transition-all ${activeTab === 'import' ? 'text-[#FFB300] scale-110' : 'opacity-20'}`}><Database className="w-7 h-7"/></button>
             <button onClick={() => setActiveTab('students')} className={`p-2 transition-all ${activeTab === 'students' ? 'text-[#FFB300] scale-110' : 'opacity-20'}`}><Users className="w-7 h-7"/></button>
             <button onClick={() => setActiveTab('rounds')} className={`p-6 bg-[#FFB300] text-black rounded-[2rem] -top-12 relative shadow-2xl transition-all active:scale-90 shadow-[#FFB300]/40`}><Compass className="w-8 h-8"/></button>
             <button onClick={() => setActiveTab('tasks')} className={`p-2 transition-all ${activeTab === 'tasks' ? 'text-[#FFB300] scale-110' : 'opacity-20'}`}><Utensils className="w-7 h-7"/></button>
             <button onClick={() => setActiveTab('cleaning')} className={`p-2 transition-all ${activeTab === 'cleaning' ? 'text-[#FFB300] scale-110' : 'opacity-20'}`}><Trash2 className="w-7 h-7"/></button>
             <button onClick={() => setActiveTab('print')} className={`p-2 transition-all ${activeTab === 'print' ? 'text-[#FFB300] scale-110' : 'opacity-20'}`}><FileText className="w-7 h-7"/></button>
          </nav>
        </>
      )}

      {/* PRINT PREVIEW */}
      {previewType && (
        <div className="p-4 bg-white text-black min-h-screen relative font-sans">
          <div className="no-print fixed top-0 left-0 right-0 p-6 bg-black flex justify-between items-center text-white z-[1000]">
             <button onClick={() => setPreviewType(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X/></button>
             <button onClick={() => window.print()} className="bg-[#00BFA5] text-black px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-lg">Print til PDF</button>
          </div>
          
          <div className="pt-24 max-w-4xl mx-auto">
             {previewType === 'main' && (
                <div className="space-y-12 a4-page">
                   <div className="text-center mb-12">
                     <h1 className="text-6xl font-black uppercase italic border-b-[12px] border-black pb-4 mb-2">Weekend {weekendNum}</h1>
                     <p className="text-xl font-bold uppercase opacity-30 tracking-[0.5em]">Weekend Plan</p>
                   </div>
                   
                   {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                      <div key={day} className="mb-10">
                         <h3 className="text-4xl font-black mb-6 uppercase text-slate-400 italic border-l-8 border-slate-200 pl-4">{day}</h3>
                         <div className="grid grid-cols-2 gap-4">
                            {TASK_CONFIG.filter(t => t.day === day).map(t => (
                               <div key={t.id} className="p-6 border-2 border-slate-100 rounded-3xl bg-slate-50 shadow-sm">
                                  <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">{t.label}</p>
                                  <p className="text-2xl font-bold leading-tight">{(taskAssignments[t.id] || []).map(getName).join(' & ') || '---'}</p>
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}

                   <div className="page-break"></div>
                   
                   <div className="mt-12">
                      <h2 className="text-5xl font-black uppercase mb-8 border-l-[15px] border-black pl-6">Rengøring</h2>
                      <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                         {CLEANING_CONFIG.map(area => (
                            <div key={area.name} className="border-b-2 border-slate-100 pb-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{area.name}</p>
                               <p className="font-bold text-xl leading-snug">{(cleaningAssignments[area.name] || []).map(getName).join(', ') || '---'}</p>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {previewType === 'brand' && (
                <div className="space-y-10">
                   {(() => {
                      // Fix: Cast 'loc' as string and filter Boolean to avoid TS unknown errors
                      const locations = Array.from(new Set(students.filter(s => s.isPresent).map(s => s.sleepingLocations[brandListDay]))).filter(Boolean) as string[];
                      const areas = Array.from(new Set(locations.map(loc => loc.includes(' - ') ? loc.split(' - ')[0] : loc))).sort();
                      
                      return areas.map((area, i) => {
                        const sts = students.filter(s => s.isPresent && s.sleepingLocations[brandListDay].startsWith(area));
                        const rooms: Record<string, string[]> = {};
                        sts.forEach(s => {
                          const r = s.sleepingLocations[brandListDay].split(' - ')[1] || s.sleepingLocations[brandListDay];
                          if (!rooms[r]) rooms[r] = [];
                          rooms[r].push(`${s.firstName} ${s.lastName}`);
                        });

                        return (
                          <div key={area} className="a4-page page-break flex flex-col relative border-[15px] border-red-600">
                             <div className="flex justify-between items-end border-b-[10px] border-red-600 pb-6 mb-10">
                                <div>
                                  <h1 className="text-6xl font-black text-red-600 uppercase italic leading-none">Brandliste</h1>
                                  <p className="text-xl font-bold mt-2 opacity-30 uppercase tracking-[0.2em]">Weekend {weekendNum} • {brandListDay}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[100px] font-black text-red-600 leading-none">{sts.length}</p>
                                  <p className="text-[10px] font-black uppercase opacity-40">Personer i alt</p>
                                </div>
                             </div>

                             <h2 className="text-[70px] font-black uppercase mb-12 tracking-tighter border-b-4 border-slate-100 pb-4">{area}</h2>
                             
                             <div className="space-y-12 flex-1">
                                {Object.entries(rooms).sort().map(([room, names]) => (
                                   <div key={room} className="border-l-[12px] border-red-600 pl-8 pb-4">
                                      <p className="text-5xl font-black text-red-600 mb-6 uppercase tracking-tight">Værelse {room}</p>
                                      <div className="space-y-3">
                                        {names.map((name, idx) => (
                                          <p key={idx} className="text-4xl font-bold tracking-tight">{name}</p>
                                        ))}
                                      </div>
                                   </div>
                                ))}
                             </div>

                             <div className="pt-10 flex justify-between items-center text-[10px] font-black uppercase opacity-20 border-t-2 border-slate-100 mt-10">
                               <span>Dato: {new Date().toLocaleDateString('da-DK')}</span>
                               <span>Weekend {weekendNum} • Side {i+1} af {areas.length}</span>
                             </div>
                          </div>
                        );
                      });
                   })()}
                </div>
             )}

             {previewType === 'sunday' && (
                <div className="a4-page">
                   <div className="flex justify-between items-end border-b-[10px] border-black pb-6 mb-10">
                      <h1 className="text-6xl font-black uppercase italic leading-none">Søndag</h1>
                      <p className="text-3xl font-black opacity-30 uppercase">Weekend {weekendNum}</p>
                   </div>
                   
                   <div className="columns-2 gap-x-12">
                      {students.sort((a,b) => a.firstName.localeCompare(b.firstName)).map(s => (
                         <div key={s.id} className="flex justify-between items-center py-4 border-b border-slate-100 break-inside-avoid">
                            <div className={!s.isPresent ? 'opacity-20' : ''}>
                               <p className="text-lg font-bold leading-tight">{s.firstName} {s.lastName}</p>
                               <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest">{s.house} • {s.room}</p>
                            </div>
                            <div className="w-12 h-12 border-4 border-black flex items-center justify-center font-black text-xl shrink-0">
                               {s.isPresent ? 'HU' : ''}
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {editingLoc && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 no-print backdrop-blur-md">
          <div className="bg-[#151926] w-full max-w-lg rounded-[3.5rem] p-10 border border-white/10 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black uppercase tracking-tight">Vælg Sovested</h3><button onClick={() => { setEditingLoc(null); setRoomSearchTerm(''); }} className="p-2 bg-white/5 rounded-full"><X/></button></div>
             
             <div className="overflow-y-auto custom-scroll space-y-6 pr-2">
               <div>
                  <p className="text-[10px] font-black uppercase text-[#FFB300] ml-2 tracking-[0.2em] mb-3">Værelser på {currentEditingStudent?.house}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roomsOnCurrentGang.map(r => (
                        <button key={r} onClick={() => {
                          setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: `${currentEditingStudent.house} - ${r}`}} : s));
                          setEditingLoc(null); setRoomSearchTerm('');
                        }} className="p-4 bg-white/5 rounded-2xl text-left font-black uppercase text-[10px] border border-transparent hover:border-[#FFB300] transition-all">Værelse {r}</button>
                    ))}
                  </div>
               </div>

               <div>
                  <p className="text-[10px] font-black uppercase text-[#00BFA5] ml-2 tracking-[0.2em] mb-3">Fællesområder</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_SLEEPING_AREAS.map(area => (
                        <button key={area} onClick={() => { 
                          if (area === "Andet") {
                            const custom = prompt("Hvor skal de sove?");
                            if(custom) setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: custom}} : s));
                          } else {
                            setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: area}} : s)); 
                          }
                          setEditingLoc(null); setRoomSearchTerm('');
                        }} className="p-4 bg-white/5 rounded-2xl text-left font-black uppercase text-[10px] border border-transparent hover:border-[#00BFA5] transition-all">{area}</button>
                    ))}
                  </div>
               </div>

               <div>
                  <p className="text-[10px] font-black uppercase text-[#1E88E5] ml-2 tracking-[0.2em] mb-3">Søg på hele skolen</p>
                  <div className="relative mb-3"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20"/><input type="text" placeholder="Søg værelsesnr..." value={roomSearchTerm} onChange={e => setRoomSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 pl-10 rounded-2xl outline-none text-sm"/></div>
                  <div className="space-y-2">
                    {allSchoolRooms.filter(r => r[0].toLowerCase().includes(roomSearchTerm.toLowerCase())).slice(0, 10).map(([room, house]) => (
                       <button key={room} onClick={() => {
                          setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: `${house} - ${room}`}} : s));
                          setEditingLoc(null); setRoomSearchTerm('');
                       }} className="w-full p-4 bg-white/5 rounded-2xl text-left font-black uppercase text-[10px] flex justify-between items-center group hover:bg-[#1E88E5] hover:text-white transition-all">
                         <span>Værelse {room}</span>
                         <span className="opacity-20 text-[8px]">{house}</span>
                       </button>
                    ))}
                  </div>
               </div>
             </div>
             <button onClick={() => { setEditingLoc(null); setRoomSearchTerm(''); }} className="w-full p-5 mt-6 border border-white/10 rounded-2xl text-[10px] font-black uppercase opacity-40">Luk</button>
          </div>
        </div>
      )}

      {manualAdd && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 no-print backdrop-blur-md">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] p-10 flex flex-col max-h-[85vh] border border-white/10">
             <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black uppercase">Vælg Elev</h3><button onClick={() => setManualAdd(null)} className="p-2 bg-white/5 rounded-full"><X/></button></div>
             <div className="relative mb-6"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/><input type="text" placeholder="Søg..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-[#FFB300] transition-all"/></div>
             <div className="overflow-y-auto space-y-3 pr-2 custom-scroll">
                {students.filter(s => s.isPresent && `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())).map(s => {
                   const status = getStatusLabel(s.id);
                   return (
                     <button key={s.id} onClick={() => {
                        if (manualAdd.type === 'task') setTaskAssignments(p => ({...p, [manualAdd.id]: Array.from(new Set([...(p[manualAdd.id] || []), s.id]))}));
                        else setCleaningAssignments(p => ({...p, [manualAdd.id]: Array.from(new Set([...(p[manualAdd.id] || []), s.id]))}));
                        setManualAdd(null);
                        setSearchTerm('');
                     }} className="w-full p-6 bg-white/5 rounded-3xl text-left font-black uppercase text-xs flex justify-between items-center group hover:bg-[#00BFA5] hover:text-black transition-all">
                       <div><p className="text-lg font-black normal-case">{s.firstName} {s.lastName}</p><p className="text-[9px] opacity-40">{s.house}</p></div>
                       {status && <span className="bg-black/10 px-3 py-1 rounded-lg text-[9px] group-hover:bg-black/40">{status}</span>}
                     </button>
                   );
                })}
             </div>
          </div>
        </div>
      )}

      {showFaq && (
        <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-6 no-print backdrop-blur-md">
           <div className="bg-[#151926] w-full max-w-lg rounded-[3rem] p-10 border border-white/10 overflow-y-auto max-h-[85vh] space-y-8">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black uppercase text-[#FFB300]">Brugervejledning</h2><button onClick={() => setShowFaq(false)} className="p-2 bg-white/5 rounded-full"><X/></button></div>
              <div className="space-y-6">
                 <p className="text-white/40">Velkommen til Weekend! Her er de vigtigste funktioner:</p>
                 <div className="space-y-4">
                    <div className="flex gap-4"><Hash className="text-[#FFB300]"/><p className="text-sm"><b>Weekend Nr:</b> Beregnes automatisk som den aktuelle uge.</p></div>
                    <div className="flex gap-4"><Filter className="text-[#00BFA5]"/><p className="text-sm"><b>Gendan elever:</b> Brug "Vis Alle" filteret på elevlisten for at se afmeldte elever og bringe dem tilbage.</p></div>
                    <div className="flex gap-4"><Database className="text-[#FFB300]"/><p className="text-sm"><b>Backup:</b> Gem dit arbejde jævnligt med Save-ikonet i Import-fanen.</p></div>
                 </div>
              </div>
              <button onClick={() => setShowFaq(false)} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs">Forstået</button>
           </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
