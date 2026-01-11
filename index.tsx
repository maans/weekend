import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Users, Utensils, Trash2, FileText, Upload, ChevronUp, ChevronDown, Database, 
  Search, X, MapPin, Plus, Lock, Unlock, AlertCircle, Check, 
  PieChart, Download, Compass, Flame, Save, RotateCcw, Hash, Filter, Settings,
  HelpCircle, CheckCircle2, Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- HJÆLPERE ---
const getWeekNumber = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
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
const STORAGE_KEY = 'weekend_master_v12_final';
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
  { id: 'f1', label: 'Før Aftensmad', day: 'Fredag' },
  { id: 'f2', label: 'Efter Aftensmad', day: 'Fredag' },
  { id: 'f3', label: 'Aftenservering', day: 'Fredag' },
  { id: 'l1', label: 'Før Mokost', day: 'Lørdag' },
  { id: 'l2', label: 'Efter Mokost', day: 'Lørdag' },
  { id: 'l6', label: 'Eftermiddagsservering', day: 'Lørdag' },
  { id: 'l3', label: 'Før Aftensmad', day: 'Lørdag' },
  { id: 'l4', label: 'Efter Aftensmad', day: 'Lørdag' },
  { id: 'l5', label: 'Aftenservering', day: 'Lørdag' },
  { id: 's1', label: 'Før Mokost', day: 'Søndag' },
  { id: 's2', label: 'Efter Mokost', day: 'Søndag' },
  { id: 's3', label: 'Eftermiddagsservering', day: 'Søndag' },
  { id: 's4', label: 'Før Aftensmad', day: 'Søndag' },
  { id: 's5', label: 'Efter Aftensmad', day: 'Søndag' },
  { id: 's6', label: 'Aftenservering', day: 'Søndag' }
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
  const [houseFilter, setHouseFilter] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [brandListDay, setBrandListDay] = useState(getActualDayName());
  const [expandedHouses, setExpandedHouses] = useState<Record<string, boolean>>({});
  const [editingLoc, setEditingLoc] = useState<string | null>(null);
  const [manualAdd, setManualAdd] = useState<any | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [roomFilterHouse, setRoomFilterHouse] = useState<string>('');

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

  const stats = useMemo(() => {
    const present = students.filter(s => s.isPresent);
    return {
      total: present.length,
      kitchen: students.filter(s => s.isKitchenDuty).length
    };
  }, [students]);

  const allHouses = useMemo(() => Array.from(new Set(students.map(s => s.house))).filter(Boolean).sort(), [students]);

  const allSchoolRoomsByHouse = useMemo(() => {
    const map: Record<string, string[]> = {};
    students.forEach(s => {
      if (!map[s.house]) map[s.house] = [];
      if (!map[s.house].includes(s.room)) map[s.house].push(s.room);
    });
    Object.keys(map).forEach(h => map[h].sort());
    return map;
  }, [students]);

  const performAutoGeneration = useCallback((currentSts = students) => {
    const newTasks = { ...taskAssignments };
    const newClean = { ...cleaningAssignments };
    Object.keys(newTasks).forEach(k => !lockedSlots[k] && (newTasks[k] = []));
    Object.keys(newClean).forEach(k => !lockedSlots[k] && (newClean[k] = []));

    const eligible = currentSts.filter(s => s.isPresent && !s.isKitchenDuty);
    let pool = [...eligible].sort(() => Math.random() - 0.5);
    let used = new Set<string>();
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

  const downloadBackup = useCallback(() => {
    const data = { students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weekend_backup_uge_${weekendNum}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots]);

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
          setTaskAssignments({});
          setCleaningAssignments({});
          setActiveTab('students');
          setTimeout(() => performAutoGeneration(parsed), 100);
        }
      } catch (err) { alert("Fejl ved læsning af Excel."); }
    };
    reader.readAsBinaryString(file);
  };

  const getName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}` : '??'; };
  const getStatusLabel = (sid: string) => {
    const s = students.find(x => x.id === sid);
    if (!s) return null;
    if (s.isKitchenDuty) return "Køkken";
    const inTask = Object.values(taskAssignments).some(ids => (ids as string[]).includes(sid));
    const inClean = Object.values(cleaningAssignments).some(ids => (ids as string[]).includes(sid));
    if (inTask && inClean) return "T+R";
    if (inTask) return "Tjans";
    if (inClean) return "Rengør";
    return null;
  };

  const filtered = students.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchHouse = !houseFilter || s.house === houseFilter;
    if (showAllStudents) return matchSearch && matchHouse;
    return matchSearch && matchHouse && s.isPresent;
  }).sort((a,b) => a.firstName.localeCompare(b.firstName));

  const currentEditingStudent = useMemo(() => students.find(x => x.id === editingLoc), [editingLoc, students]);
  const roomsOnCurrentGang = useMemo(() => {
    if (!currentEditingStudent) return [];
    return allSchoolRoomsByHouse[currentEditingStudent.house] || [];
  }, [currentEditingStudent, allSchoolRoomsByHouse]);

  return (
    <div className={`min-h-screen ${previewType ? 'bg-white text-black' : 'pb-32'}`}>
      {!previewType && (
        <>
          <header className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#0A0E1A]/80 backdrop-blur-xl z-50">
            <div className="flex items-center gap-3">
              <div className="bg-[#FFB300] p-2 rounded-xl text-black shadow-lg shadow-[#FFB300]/20"><Compass className="w-6 h-6"/></div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Weekend</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFaq(true)} className="p-2 text-white/40"><HelpCircle className="w-5 h-5"/></button>
              <button onClick={() => { if(confirm("Nulstil alt?")) { localStorage.clear(); location.reload(); }}} className="p-2 text-red-500/40"><RotateCcw className="w-5 h-5"/></button>
            </div>
          </header>

          <main className="p-4 max-w-2xl mx-auto space-y-6">
            {activeTab === 'import' && (
              <div className="py-6 space-y-6">
                <div className="bg-white/5 p-12 rounded-[3rem] border border-white/10 text-center">
                  <Upload className="mx-auto w-12 h-12 text-[#FFB300] mb-6"/>
                  <h2 className="text-2xl font-black mb-4 uppercase">Indlæs Elevdata</h2>
                  <input type="file" id="up" className="hidden" onChange={handleFileUpload} accept=".xlsx, .xls, .csv"/>
                  <label htmlFor="up" className="block w-full py-6 bg-[#00BFA5] text-black rounded-3xl font-black uppercase text-xs cursor-pointer shadow-2xl shadow-[#00BFA5]/20">Vælg Excel Fil</label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, weekendNum, taskAssignments, cleaningAssignments, lockedSlots })); alert("Gemt!"); }} className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-2">
                    <Save className="text-[#1E88E5]"/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Gem Lokalt</span>
                  </button>
                  <button onClick={downloadBackup} className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex flex-col items-center gap-2">
                    <Download className="text-[#00BFA5]"/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Download Fil</span>
                  </button>
                </div>
                
                {students.length > 0 && (
                  <div className="bg-[#1E88E5]/10 p-8 rounded-[2.5rem] border border-[#1E88E5]/30 space-y-4 text-center">
                    <div className="grid grid-cols-2 gap-4 text-center">
                       <div className="bg-white/5 p-5 rounded-2xl">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-1">Tilmeldte</p>
                          <p className="text-3xl font-black">{stats.total}</p>
                       </div>
                       <div className="bg-white/5 p-5 rounded-2xl">
                          <p className="text-[9px] font-black uppercase opacity-40 mb-1">Køkken</p>
                          <p className="text-3xl font-black text-[#D81B60]">{stats.kitchen}</p>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/>
                    <input type="text" placeholder="Søg på navn..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 pl-12 rounded-2xl outline-none focus:border-[#FFB300] transition-all"/>
                  </div>
                  <div className="col-span-8">
                     <select value={houseFilter} onChange={e => setHouseFilter(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black uppercase outline-none focus:border-[#00BFA5]">
                        <option value="" className="bg-[#0A0E1A]">Alle Gange</option>
                        {allHouses.map(h => <option key={h} value={h} className="bg-[#0A0E1A]">{h}</option>)}
                     </select>
                  </div>
                  <div className="col-span-4">
                    <button onClick={() => setShowAllStudents(!showAllStudents)} className={`w-full h-full rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[9px] border transition-all ${showAllStudents ? 'bg-[#00BFA5] text-black border-[#00BFA5]' : 'bg-white/5 border-white/10 text-white/40'}`}>
                      <Filter className="w-4 h-4"/> {showAllStudents ? 'Alle' : 'Tilmeldt'}
                    </button>
                  </div>
                </div>

                {filtered.map((s, i) => (
                  <div key={s.id} className="relative overflow-hidden rounded-[2rem] mb-2 wise-card">
                    <div className={`${WISE_COLORS[i % 5]} p-0 text-black shadow-lg flex items-stretch transition-transform duration-150 select-none ${!s.isPresent ? 'opacity-30 grayscale' : ''}`}>
                      {/* VENSTRE DEL: Til/Frameld */}
                      <div 
                        className="flex-1 p-5 min-w-0 flex flex-col justify-center active:bg-black/5 transition-colors cursor-pointer"
                        onClick={() => setStudents(p => p.map(x => x.id === s.id ? {...x, isPresent: !x.isPresent, stayType: !x.isPresent ? 'full' : 'none'} : x))}
                      >
                          <p className="text-lg font-black leading-tight break-words">{s.firstName} {s.lastName}</p>
                          <span className="text-[10px] font-black uppercase opacity-60 tracking-[0.1em]">{s.house} • {s.room}</span>
                      </div>
                      
                      {/* DELER */}
                      <div className="w-px bg-black/10 my-4" />

                      {/* HØJRE DEL: Køkkentjans */}
                      <div className="p-4 flex items-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setStudents(p => p.map(x => x.id === s.id ? {...x, isKitchenDuty: !x.isKitchenDuty} : x)) }} 
                          className={`px-5 py-3.5 rounded-xl text-[9px] font-black uppercase border tracking-[0.1em] transition-all shrink-0 ${s.isKitchenDuty ? 'bg-black text-white border-black shadow-lg' : 'bg-black/10 border-transparent text-black'}`}
                        >
                          {s.isKitchenDuty ? 'I Køkken' : 'Køkken?'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'rounds' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Gange</h2>
                </div>
                {allHouses.map((house, idx) => {
                  const houseSts = students.filter(s => s.house === house && s.isPresent);
                  const isExp = expandedHouses[house];
                  return (
                    <div key={house} className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                      <div className="p-7 flex justify-between items-center cursor-pointer active:bg-white/5" onClick={() => setExpandedHouses(p => ({...p, [house]: !isExp}))}>
                         <div className="flex items-center gap-4">
                            <div className={`${WISE_COLORS[idx % 5]} w-12 h-12 rounded-2xl flex items-center justify-center text-black font-black shadow-lg`}>{houseSts.length}</div>
                            <span className="font-black uppercase tracking-widest text-sm">{house}</span>
                         </div>
                         <div className="opacity-20">{isExp ? <ChevronUp/> : <ChevronDown/>}</div>
                      </div>
                      {isExp && (
                        <div className="p-3 border-t border-white/5 space-y-2 bg-black/20">
                          {houseSts.map(s => {
                            const isChanged = s.sleepingLocations['Fredag'] !== `${s.house} - ${s.room}`;
                            return (
                              <div key={s.id} className={`bg-white/5 p-5 rounded-2xl flex justify-between items-center border transition-all ${isChanged ? 'border-[#FFB300]/50 bg-[#FFB300]/5' : 'border-transparent'}`}>
                                 <div className="flex items-center gap-4">
                                    <button onClick={() => setStudents(p => p.map(x => x.id === s.id ? {...x, isMarked: !x.isMarked} : x))} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${s.isMarked ? 'bg-[#00BFA5] border-[#00BFA5] text-black' : 'border-white/10 text-transparent'}`}><Check className="w-5 h-5"/></button>
                                    <div>
                                      <p className="font-black text-lg">{s.firstName}</p>
                                      <div className="flex items-center gap-2">
                                        {isChanged && <AlertCircle className="w-3 h-3 text-[#FFB300]"/>}
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${isChanged ? 'text-[#FFB300]' : 'opacity-30'}`}>{s.sleepingLocations['Fredag']}</p>
                                      </div>
                                    </div>
                                 </div>
                                 <button onClick={() => setEditingLoc(s.id)} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 active:scale-95"><MapPin className={`w-5 h-5 ${isChanged ? 'text-[#FFB300]' : 'opacity-20'}`}/></button>
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
                  <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase bg-[#FFB300] text-black px-5 py-2 rounded-xl shadow-lg active:scale-95 transition-transform">Fordel</button>
                </div>
                {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                  <div key={day} className="space-y-4">
                    <h3 className="text-xs font-black text-[#FFB300] uppercase tracking-[0.3em] border-b border-white/5 pb-2 ml-2">{day}</h3>
                    <div className="grid gap-3">
                      {TASK_CONFIG.filter(t => t.day === day).map((t, i) => (
                        <div key={t.id} className={`${WISE_COLORS[i % 5]} p-6 rounded-[2.5rem] text-black shadow-lg`}>
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-black uppercase tracking-tight">{t.label}</h4>
                            <button onClick={() => setLockedSlots(p => ({...p, [t.id]: !p[t.id]}))} className="p-2 bg-black/10 rounded-xl">{lockedSlots[t.id] ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4 opacity-40"/>}</button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                             {(taskAssignments[t.id] || []).map(sid => (
                               <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-3">
                                  {getName(sid)} <button onClick={() => setTaskAssignments(p => ({...p, [t.id]: p[t.id].filter(x => x !== sid)}))}><X className="w-3.5 h-3.5 opacity-50"/></button>
                               </div>
                             ))}
                             <button onClick={() => setManualAdd({id: t.id, type: 'task'})} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20"><Plus className="w-4 h-4"/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'cleaning' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-2xl font-black uppercase">Rengøring</h2>
                  <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase bg-[#FFB300] text-black px-5 py-2 rounded-xl shadow-lg active:scale-95 transition-transform">Fordel</button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                   {CLEANING_CONFIG.map((area, idx) => (
                     <div key={area.name} className={`${WISE_COLORS[idx % 5]} p-6 rounded-[2.5rem] text-black shadow-lg`}>
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="font-black text-sm uppercase tracking-widest">{area.name}</h4>
                           <button onClick={() => setLockedSlots(p => ({...p, [area.name]: !p[area.name]}))} className="p-2 bg-black/10 rounded-xl">{lockedSlots[area.name] ? <Lock className="w-4 h-4"/> : <Unlock className="w-4 h-4 opacity-40"/>}</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {(cleaningAssignments[area.name] || []).map(sid => (
                             <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-3">
                                {getName(sid)} <button onClick={() => setCleaningAssignments(p => ({...p, [area.name]: p[area.name].filter(x => x !== sid)}))}><X className="w-3.5 h-3.5 opacity-50"/></button>
                             </div>
                           ))}
                           <button onClick={() => setManualAdd({id: area.name, type: 'cleaning'})} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20"><Plus className="w-4 h-4"/></button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            {activeTab === 'print' && (
              <div className="py-10 space-y-6 text-center">
                <h2 className="text-xl font-black uppercase tracking-widest mb-10 opacity-30">Udskrifter</h2>
                
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-8 flex flex-col gap-4">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">UGE NR.</span>
                      <input type="number" value={weekendNum} onChange={e => setWeekendNum(e.target.value)} className="bg-transparent border-b border-white/20 w-16 text-center text-xl font-black outline-none focus:border-[#FFB300]"/>
                   </div>
                   <div className="flex items-center justify-between border-t border-white/5 pt-4">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">BRANDLISTE DAG</span>
                      <div className="flex bg-black/20 p-1 rounded-xl">
                        {['Fredag', 'Lørdag', 'Søndag'].map(d => (
                           <button key={d} onClick={() => setBrandListDay(d)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${brandListDay === d ? 'bg-[#D81B60] text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}>{d}</button>
                        ))}
                      </div>
                   </div>
                </div>

                <div className="grid gap-4">
                  <button onClick={() => setPreviewType('main')} className="w-full p-10 bg-[#FFB300] text-black rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#FFB300]/10 hover:scale-[1.02] active:scale-95 transition-all">Plan & Rengøring <FileText/></button>
                  <button onClick={() => setPreviewType('brand')} className="w-full p-10 bg-[#D81B60] text-white rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#D81B60]/10 hover:scale-[1.02] active:scale-95 transition-all">Brandlister <Flame/></button>
                  <button onClick={() => setPreviewType('sunday')} className="w-full p-10 bg-[#00BFA5] text-black rounded-[3rem] font-black uppercase flex justify-between items-center shadow-xl shadow-[#00BFA5]/10 hover:scale-[1.02] active:scale-95 transition-all">Søndagsliste <CheckCircle2/></button>
                </div>
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
        <div className="p-4 bg-white text-black min-h-screen relative font-sans print-only:p-0">
          <div className="no-print fixed top-0 left-0 right-0 p-6 bg-black/90 backdrop-blur flex justify-between items-center text-white z-[1000]">
             <button onClick={() => setPreviewType(null)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X/></button>
             <button onClick={() => window.print()} className="bg-[#00BFA5] text-black px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-lg">Print til PDF</button>
          </div>
          
          <div className="max-w-4xl mx-auto pt-24 print:pt-0">
             {previewType === 'main' && (
                <div className="space-y-4">
                   {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                      <div key={day} className="a4-page page-break bg-white text-black p-[20mm] flex flex-col h-full">
                         <div className="text-center mb-10 border-b-[6px] border-black pb-4">
                           <h1 className="text-6xl font-black uppercase italic leading-none mb-2">Uge {weekendNum}</h1>
                           <p className="text-sm font-bold uppercase opacity-30 tracking-[1em]">{day.toUpperCase()} TJANSER</p>
                         </div>
                         <div className="grid grid-cols-1 gap-y-4 mt-6">
                            {TASK_CONFIG.filter(t => t.day === day).map(t => (
                               <div key={t.id} className="p-6 border border-slate-100 rounded-2xl bg-slate-50/50">
                                  <p className="text-[12px] font-black uppercase text-slate-400 mb-2 tracking-widest">{t.label}</p>
                                  <p className="text-2xl font-bold leading-tight">{(taskAssignments[t.id] || []).map(getName).join(' & ') || '---'}</p>
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}

                   <div className="a4-page page-break bg-white text-black p-[20mm]">
                      <div className="text-center mb-10 border-b-[6px] border-black pb-4">
                        <h1 className="text-6xl font-black uppercase italic leading-none mb-2">Uge {weekendNum}</h1>
                        <p className="text-sm font-bold uppercase opacity-30 tracking-[1em]">RENGØRING</p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-12 gap-y-6 mt-10">
                         {CLEANING_CONFIG.map(area => (
                            <div key={area.name} className="border-b border-slate-100 pb-3">
                               <p className="text-[11px] font-black text-slate-400 uppercase mb-1 tracking-widest">{area.name}</p>
                               <p className="font-bold text-lg leading-snug">{(cleaningAssignments[area.name] || []).map(getName).join(', ') || '---'}</p>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
             )}

             {previewType === 'brand' && (
                <div className="space-y-4">
                   {(() => {
                      // Gruppér elever efter GANG i stedet for specifik lokation
                      const houseGroups: Record<string, any[]> = {};
                      students.filter(s => s.isPresent).forEach(s => {
                         const loc = s.sleepingLocations[brandListDay];
                         const houseName = loc.includes(' - ') ? loc.split(' - ')[0] : loc;
                         if (!houseGroups[houseName]) houseGroups[houseName] = [];
                         houseGroups[houseName].push(s);
                      });

                      return Object.entries(houseGroups).sort().map(([houseName, sts], i) => (
                          <div key={houseName} className="a4-page page-break bg-white text-black p-[15mm] border-[15px] border-red-600 flex flex-col h-[297mm]">
                             <div className="flex justify-between items-end border-b-[10px] border-red-600 pb-6 mb-10">
                                <div>
                                  <h1 className="text-6xl font-black text-red-600 uppercase italic leading-none">BRANDLISTE</h1>
                                  <p className="text-xl font-bold mt-2 opacity-40 uppercase tracking-widest">UGE {weekendNum} • {brandListDay}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[100px] font-black text-red-600 leading-[0.8]">{sts.length}</p>
                                  <p className="text-[10px] font-black uppercase opacity-40 tracking-widest">STYK</p>
                                </div>
                             </div>

                             <div className="mb-12">
                               <h2 className="text-[80px] font-black uppercase tracking-tighter leading-none">{houseName}</h2>
                             </div>
                             
                             <div className="space-y-8 flex-1 overflow-hidden">
                                {(() => {
                                   // Gruppér de enkelte værelser indenfor gangen
                                   const roomGroups: Record<string, any[]> = {};
                                   sts.forEach(s => {
                                      const roomPart = s.sleepingLocations[brandListDay].split(' - ')[1] || 'Fælles';
                                      if (!roomGroups[roomPart]) roomGroups[roomPart] = [];
                                      roomGroups[roomPart].push(s);
                                   });

                                   return Object.entries(roomGroups).sort().map(([room, roomSts]) => (
                                      <div key={room} className="border-l-[12px] border-red-600 pl-10 py-2 break-inside-avoid">
                                         <p className="text-4xl font-black text-red-600 mb-4 uppercase tracking-tight italic">
                                            {room === 'Fælles' ? 'PLADS' : 'VÆRELSE'} {room}
                                         </p>
                                         <div className="grid gap-3">
                                           {roomSts.map((s, idx) => (
                                             <p key={idx} className="text-4xl font-bold tracking-tight border-b-2 border-slate-100 pb-2 leading-tight">
                                                {s.firstName} {s.lastName}
                                             </p>
                                           ))}
                                         </div>
                                      </div>
                                   ));
                                })()}
                             </div>

                             <div className="pt-10 flex justify-between items-center text-[10px] font-black uppercase opacity-20 border-t-2 border-slate-100 italic">
                               <span>Udskrevet: {new Date().toLocaleDateString('da-DK')}</span>
                               <span>Weekend Uge {weekendNum} • Side {i+1}</span>
                             </div>
                          </div>
                      ));
                   })()}
                </div>
             )}

             {previewType === 'sunday' && (
                <div className="a4-page p-[20mm] bg-white text-black">
                   <div className="flex justify-between items-end border-b-[10px] border-black pb-6 mb-12">
                      <h1 className="text-6xl font-black uppercase italic leading-none">SØNDAGSLISTE</h1>
                      <p className="text-3xl font-black opacity-30 uppercase italic tracking-widest">Uge {weekendNum}</p>
                   </div>
                   
                   <div className="columns-2 gap-x-16">
                      {students.sort((a,b) => a.firstName.localeCompare(b.firstName)).map(s => (
                         <div key={s.id} className="flex justify-between items-center py-4 border-b-2 border-slate-100 break-inside-avoid">
                            <div className={!s.isPresent ? 'opacity-20' : ''}>
                               <p className="text-xl font-bold leading-tight">{s.firstName} {s.lastName}</p>
                               <p className="text-[9px] uppercase text-slate-400 font-black tracking-widest">{s.house} • {s.room}</p>
                            </div>
                            <div className="w-12 h-12 border-[4px] border-black flex items-center justify-center font-black text-xl shrink-0">
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

      {/* MODAL: VÆLG SOVESTED */}
      {editingLoc && currentEditingStudent && (
        <div className="fixed inset-0 bg-black/98 z-[2000] flex items-center justify-center p-4 no-print backdrop-blur-2xl">
          <div className="bg-[#151926] w-full max-w-xl rounded-[3rem] p-8 border border-white/10 flex flex-col max-h-[92vh] shadow-2xl overflow-hidden">
             <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                   <h3 className="text-2xl font-black uppercase tracking-tight text-[#FFB300]">Vælg Sovested</h3>
                   <p className="text-[10px] font-black uppercase opacity-40 mt-1 tracking-widest">{currentEditingStudent.firstName} {currentEditingStudent.lastName}</p>
                </div>
                <button onClick={() => setEditingLoc(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button>
             </div>
             
             <div className="overflow-y-auto custom-scroll space-y-8 pr-2 flex-1">
               <div>
                  <p className="text-[9px] font-black uppercase text-[#FFB300] ml-1 tracking-[0.2em] mb-3 opacity-60 italic">Prioritet 1: Eget værelse</p>
                  <button onClick={() => {
                      setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: `${currentEditingStudent.house} - ${currentEditingStudent.room}`}} : s));
                      setEditingLoc(null);
                  }} className="w-full p-6 bg-[#FFB300]/10 border border-[#FFB300]/30 rounded-2xl text-left hover:bg-[#FFB300]/20 transition-all">
                     <p className="text-lg font-black text-[#FFB300] uppercase">Værelse {currentEditingStudent.room}</p>
                     <p className="text-[10px] font-bold opacity-50 text-[#FFB300]">Standard på {currentEditingStudent.house}</p>
                  </button>
               </div>

               <div>
                  <p className="text-[9px] font-black uppercase text-[#00BFA5] ml-1 tracking-[0.2em] mb-3 opacity-60 italic">Prioritet 2: Fællesområder</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_SLEEPING_AREAS.map(area => (
                        <button key={area} onClick={() => { 
                          if (area === "Andet") {
                            const custom = prompt("Hvor skal de sove?");
                            if(custom) setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: custom}} : s));
                          } else {
                            setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: area}} : s)); 
                          }
                          setEditingLoc(null);
                        }} className="p-4 bg-white/5 rounded-2xl text-left font-black uppercase text-[10px] border border-white/5 hover:border-[#00BFA5] hover:bg-[#00BFA5]/5 transition-all">{area}</button>
                    ))}
                  </div>
               </div>

               <div>
                  <p className="text-[9px] font-black uppercase text-[#1E88E5] ml-1 tracking-[0.2em] mb-3 opacity-60 italic">Prioritet 3: På {currentEditingStudent.house}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roomsOnCurrentGang.filter(r => r !== currentEditingStudent.room).map(r => (
                        <button key={r} onClick={() => {
                          setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: `${currentEditingStudent.house} - ${r}`}} : s));
                          setEditingLoc(null);
                        }} className="p-4 bg-white/5 rounded-2xl text-left font-black uppercase text-[10px] border border-white/5 hover:border-[#1E88E5] transition-all">Værelse {r}</button>
                    ))}
                  </div>
               </div>

               <div>
                  <p className="text-[9px] font-black uppercase text-[#D81B60] ml-1 tracking-[0.2em] mb-3 opacity-60 italic">Prioritet 4: Søg på hele skolen</p>
                  <div className="flex gap-2 mb-3">
                    <select value={roomFilterHouse} onChange={e => setRoomFilterHouse(e.target.value)} className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl text-xs font-black uppercase outline-none">
                       <option value="" className="bg-[#151926]">Alle Gange</option>
                       {allHouses.map(h => <option key={h} value={h} className="bg-[#151926]">{h}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(allSchoolRoomsByHouse)
                      .filter(([h]) => !roomFilterHouse || h === roomFilterHouse)
                      .flatMap(([h, rooms]) => (rooms as string[]).map(r => ({h, r})))
                      .slice(0, 40)
                      .map(({h, r}) => (
                         <button key={`${h}-${r}`} onClick={() => {
                            setStudents(p => p.map(s => s.id === editingLoc ? {...s, sleepingLocations: {...s.sleepingLocations, [brandListDay]: `${h} - ${r}`}} : s));
                            setEditingLoc(null);
                         }} className="p-3 bg-white/5 rounded-xl text-left flex justify-between items-center group hover:bg-white/10 transition-all">
                           <span className="text-[10px] font-black uppercase">V. {r}</span>
                           <span className="text-[8px] font-bold opacity-20 uppercase">{h}</span>
                         </button>
                      ))}
                  </div>
               </div>
             </div>
             <button onClick={() => setEditingLoc(null)} className="w-full p-5 mt-6 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Luk</button>
          </div>
        </div>
      )}

      {/* MODAL: MANUEL TILFØJELSE AF ELEV TIL TJANS/RENGØRING */}
      {manualAdd && (
        <div className="fixed inset-0 bg-black/98 z-[2000] flex items-center justify-center p-4 no-print backdrop-blur-2xl">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] p-10 flex flex-col max-h-[85vh] border border-white/10 shadow-2xl">
             <div className="flex justify-between items-center mb-8 shrink-0">
               <h3 className="text-2xl font-black uppercase tracking-tight">Vælg Elev</h3>
               <button onClick={() => setManualAdd(null)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X/></button>
             </div>
             <div className="relative mb-6 shrink-0"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20"/><input type="text" placeholder="Søg..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 pl-12 rounded-2xl outline-none focus:border-[#FFB300] transition-all"/></div>
             <div className="overflow-y-auto space-y-2.5 pr-1 custom-scroll flex-1">
                {students.filter(s => s.isPresent && `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())).map(s => {
                   const status = getStatusLabel(s.id);
                   return (
                     <button key={s.id} onClick={() => {
                        if (manualAdd.type === 'task') setTaskAssignments(p => ({...p, [manualAdd.id]: Array.from(new Set([...(p[manualAdd.id] || []), s.id]))}));
                        else setCleaningAssignments(p => ({...p, [manualAdd.id]: Array.from(new Set([...(p[manualAdd.id] || []), s.id]))}));
                        setManualAdd(null);
                        setSearchTerm('');
                     }} className="w-full p-6 bg-white/5 rounded-[2rem] text-left font-black uppercase text-xs flex justify-between items-center group hover:bg-[#00BFA5] hover:text-black transition-all active:scale-95">
                       <div><p className="text-base font-black normal-case leading-tight">{s.firstName} {s.lastName}</p><p className="text-[9px] opacity-40 mt-0.5">{s.house}</p></div>
                       {status && <span className="bg-black/10 px-3 py-1.5 rounded-lg text-[8px] group-hover:bg-black/30">{status}</span>}
                     </button>
                   );
                })}
             </div>
          </div>
        </div>
      )}

      {/* MODAL: FAQ/HJÆLP */}
      {showFaq && (
        <div className="fixed inset-0 bg-black/98 z-[2000] flex items-center justify-center p-6 no-print backdrop-blur-2xl">
           <div className="bg-[#151926] w-full max-lg rounded-[3.5rem] p-10 border border-white/10 overflow-y-auto max-h-[85vh] space-y-8 shadow-2xl">
              <div className="flex justify-between items-center"><h2 className="text-3xl font-black uppercase tracking-tighter text-[#FFB300]">Brugervejledning</h2><button onClick={() => setShowFaq(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><X/></button></div>
              <div className="space-y-6">
                 <div className="space-y-5">
                    <div className="flex gap-4 items-start"><Users className="text-[#FFB300] shrink-0 mt-1"/><p className="text-sm"><b>Tilmeld/Afmeld:</b> Klik på navnedelen af elevkortet. Knappen til højre er kun til køkkentjans.</p></div>
                    <div className="flex gap-4 items-start"><Filter className="text-[#00BFA5] shrink-0 mt-1"/><p className="text-sm"><b>Gang-filter:</b> Filtrér listen i toppen for at finde specifikke elever hurtigt.</p></div>
                    <div className="flex gap-4 items-start"><Printer className="text-[#1E88E5] shrink-0 mt-1"/><p className="text-sm"><b>Print:</b> Tjanser udskrives med én side for hver dag. Nu også med Eftermiddagsservering og Aftensmad søndag.</p></div>
                    <div className="flex gap-4 items-start"><Flame className="text-[#D81B60] shrink-0 mt-1"/><p className="text-sm"><b>Brandlister:</b> Hele gangen samles nu på én side automatisk ved udprint for overblik.</p></div>
                 </div>
              </div>
              <button onClick={() => setShowFaq(false)} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">Forstået</button>
           </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
