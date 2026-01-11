
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Users, Utensils, Trash2, FileText, Upload, ChevronRight, ArrowRightLeft, 
  Trash, CheckCircle2, XCircle, Printer, ChevronUp, ChevronDown, Database, 
  Info, CalendarDays, Search, Filter, Eye, X, Clock, GripVertical, Bed, 
  MapPin, Plus, Flame, ArrowUp, ArrowDown, Lock, Unlock, AlertCircle, 
  Check, MoveHorizontal, Home, HelpCircle, BookOpen, Github, Globe, 
  PieChart, Download, Share2, Compass, AlertTriangle, Monitor, 
  Smartphone, Share, Layers, Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- FRA types.ts ---
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  room: string;
  house: string;
  uniLogin: string;
  teacher1: string;
  teacher2: string;
  isPresent: boolean;
  stayType: 'full' | 'saturday' | 'none';
  isKitchenDuty: boolean;
  hasReturned?: boolean;
  isMarked?: boolean;
  sleepingLocations: { 'Fredag': string; 'Lørdag': string; 'Søndag': string; };
  note?: string;
  needsExtraDuty?: boolean;
}

export const CLEANING_CONFIG = [
  { name: "Arken", count: 2 },
  { name: "Den lange gang", count: 3 },
  { name: "Gangene i treenigheden (MT og Gimle)", count: 2 },
  { name: "Biografen", count: 1 },
  { name: "Kunst", count: 1 },
  { name: "Klassefløjen + toiletter", count: 4 },
  { name: "Toiletter i hallen - Alle", count: 3 },
  { name: "Toiletter på den lange gang", count: 2 },
  { name: "Gangen ved TG og Kompo", count: 1 },
  { name: "Gymnastiksalen", count: 2 },
  { name: "Hallen", count: 2 }
];

export const COMMON_SLEEPING_AREAS = ["Teltet", "Shelteret", "Gymnastiksalen", "Medie", "Biografen"];

export const TASK_CONFIG = [
  { id: 'fri_dinner_before', label: 'Før Aftensmad', day: 'Fredag', type: 'Før', category: 'Aftensmad' },
  { id: 'fri_dinner_after', label: 'Efter Aftensmad', day: 'Fredag', type: 'Efter', category: 'Aftensmad' },
  { id: 'fri_snack', label: 'Aftenservering', day: 'Fredag', category: 'Aftenservering' },
  { id: 'sat_mokost_before', label: 'Før Mokost', day: 'Lørdag', type: 'Før', category: 'Mokost' },
  { id: 'sat_mokost_after', label: 'Efter Mokost', day: 'Lørdag', type: 'Efter', category: 'Mokost' },
  { id: 'sat_afternoon', label: 'Eftermiddagsservering', day: 'Lørdag', category: 'Eftermiddag' },
  { id: 'sat_dinner_before', label: 'Før Aftensmad', day: 'Lørdag', type: 'Før', category: 'Aftensmad' },
  { id: 'sat_dinner_after', label: 'Efter Aftensmad', day: 'Lørdag', type: 'Efter', category: 'Aftensmad' },
  { id: 'sat_snack', label: 'Aftenservering', day: 'Lørdag', category: 'Aftenservering' },
  { id: 'sun_mokost_before', label: 'Før Mokost', day: 'Søndag', type: 'Før', category: 'Mokost' },
  { id: 'sun_mokost_after', label: 'Efter Mokost', day: 'Søndag', type: 'Efter', category: 'Mokost' },
  { id: 'sun_afternoon', label: 'Eftermiddagsservering', day: 'Søndag', category: 'Eftermiddag' },
  { id: 'sun_dinner_before', label: 'Før Aftensmad', day: 'Søndag', type: 'Før', category: 'Aftensmad' },
  { id: 'sun_dinner_after', label: 'Efter Aftensmad', day: 'Søndag', type: 'Efter', category: 'Aftensmad' },
  { id: 'sun_snack', label: 'Aftenservering', day: 'Søndag', category: 'Aftenservering' },
];

// --- FRA App.tsx logic ---
const STORAGE_KEY = 'weekendvagt_app_data_v16';
const WISE_COLORS = ['bg-[#FFB300]', 'bg-[#00BFA5]', 'bg-[#D81B60]', 'bg-[#1E88E5]', 'bg-[#5E35B1]'];

const getActualDayName = (): 'Fredag' | 'Lørdag' | 'Søndag' => {
  const d = new Date().getDay();
  if (d === 6) return 'Lørdag';
  if (d === 0) return 'Søndag';
  return 'Fredag';
};

const cleanValue = (val: any): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return s.split(',')[0].split('(')[0].trim();
};

const processExcelData = (data: any[][]): Student[] => {
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const findIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.toLowerCase().includes(n.toLowerCase())));

  const idx = {
    first: findIdx(['fornavn', 'first name']),
    last: findIdx(['efternavn', 'last name']),
    room: findIdx(['værelse', 'room']),
    house: findIdx(['house', 'gang', 'hus']),
    uni: findIdx(['uni', 'login', 'brugernavn']),
    k1: findIdx(['kontaktlærer', 'teacher 1']),
    k2: findIdx(['anden kontaktlærer', 'teacher 2']),
    weekend: findIdx(['weekend', 'til stede', 'status'])
  };

  return data.slice(1).filter(row => row.length > 0 && row[idx.first]).map((row, i) => {
    const presenceStr = String(row[idx.weekend] || '').toLowerCase();
    let stayType: 'full' | 'saturday' | 'none' = 'none';
    if (presenceStr.includes('hele weekenden') || presenceStr === 'ja' || presenceStr === 'true' || presenceStr === '1') stayType = 'full';
    else if (presenceStr.includes('indtil lørdag')) stayType = 'saturday';

    const house = cleanValue(row[idx.house]);
    const room = cleanValue(row[idx.room]);
    const defaultLoc = `${house} - ${room}`;

    return {
      id: `std-${Date.now()}-${i}`,
      firstName: String(row[idx.first] || ''),
      lastName: String(row[idx.last] || ''),
      room, house,
      uniLogin: String(row[idx.uni] || ''),
      teacher1: String(row[idx.k1] || ''),
      teacher2: String(row[idx.k2] || ''),
      isPresent: stayType !== 'none',
      stayType,
      isKitchenDuty: false,
      hasReturned: false,
      isMarked: false,
      needsExtraDuty: false,
      sleepingLocations: { 'Fredag': defaultLoc, 'Lørdag': defaultLoc, 'Søndag': defaultLoc },
      note: ''
    };
  });
};

// Define interface for SwipableStudentCard props to fix 'key' error and missing type definitions
interface SwipableStudentCardProps {
  student: Student;
  color: string;
  onSwipe: () => void;
  onKitchenClick: () => void;
}

const SwipableStudentCard: React.FC<SwipableStudentCardProps> = ({ student, color, onSwipe, onKitchenClick }) => {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (startX.current === 0) return;
    const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startX.current;
    if (Math.abs(diff) > 10) setOffset(diff);
  };

  const handleEnd = () => {
    if (Math.abs(offset) > 100) onSwipe();
    setOffset(0);
    startX.current = 0;
  };

  return (
    <div className="relative overflow-hidden rounded-[2.5rem]" onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}>
      <div style={{ transform: `translateX(${offset}px)` }} className={`${color} p-7 text-black shadow-lg flex items-center justify-between transition-transform duration-150 select-none ${!student.isPresent ? 'opacity-30 grayscale' : 'hover:scale-[1.01]'}`}>
        <div className="flex flex-col pointer-events-none">
            <p className={`text-2xl font-black leading-tight mb-1 ${!student.isPresent ? 'text-black/40' : ''}`}>{student.firstName} {student.lastName}</p>
            <span className="text-[11px] font-black uppercase opacity-60 tracking-[0.15em]">{student.house} • {student.room}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onKitchenClick(); }} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border shadow-sm ${student.isKitchenDuty ? 'bg-black text-white border-black' : 'bg-black/10 border-transparent text-black'}`}>Køkken</button>
      </div>
      {offset > 20 && <div className="absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none opacity-50"><ArrowRightLeft className="w-6 h-6 text-black"/></div>}
      {offset < -20 && <div className="absolute inset-y-0 right-0 w-12 flex items-center justify-center pointer-events-none opacity-50"><ArrowRightLeft className="w-6 h-6 text-black"/></div>}
    </div>
  );
};

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState('import');
  const [houseOrder, setHouseOrder] = useState<string[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string[]>>({});
  const [cleaningAssignments, setCleaningAssignments] = useState<Record<string, string[]>>({});
  const [lockedSlots, setLockedSlots] = useState<Record<string, boolean>>({});
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [expandedHouses, setExpandedHouses] = useState<Record<string, boolean>>({});
  const [editingStudentLocation, setEditingStudentLocation] = useState<string | null>(null);
  const [manualAddSlot, setManualAddSlot] = useState<{id: string, type: 'task' | 'cleaning'} | null>(null);
  const [brandListDay, setBrandListDay] = useState<'Fredag' | 'Lørdag' | 'Søndag'>(getActualDayName());
  const [showFaq, setShowFaq] = useState(false);
  const [showQuickstart, setShowQuickstart] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.students) setStudents(parsed.students);
        if (parsed.houseOrder) setHouseOrder(parsed.houseOrder);
        setTaskAssignments(parsed.taskAssignments || {});
        setCleaningAssignments(parsed.cleaningAssignments || {});
        setLockedSlots(parsed.lockedSlots || {});
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, houseOrder, taskAssignments, cleaningAssignments, lockedSlots }));
    }
  }, [students, houseOrder, taskAssignments, cleaningAssignments, lockedSlots]);

  const stats = useMemo(() => {
    const present = students.filter(s => s.isPresent);
    return {
      total: present.length,
      full: present.filter(s => s.stayType === 'full').length,
      saturday: present.filter(s => s.stayType === 'saturday').length,
      kitchen: students.filter(s => s.isKitchenDuty).length,
      special: students.filter(s => s.needsExtraDuty).length
    };
  }, [students]);

  const roomsByHouse = useMemo(() => {
    const map: Record<string, string[]> = {};
    students.forEach(s => {
      if (!map[s.house]) map[s.house] = [];
      const room = `${s.house} - ${s.room}`;
      if (!map[s.house].includes(room)) map[s.house].push(room);
    });
    Object.keys(map).forEach(h => map[h].sort());
    return map;
  }, [students]);

  const performAutoGeneration = useCallback((currentStudents = students) => {
    const newTasks = { ...taskAssignments };
    const newCleaning = { ...cleaningAssignments };
    const eligibleTasks = currentStudents.filter(s => s.isPresent && !s.isKitchenDuty);
    const pool = [...eligibleTasks].sort(() => Math.random() - 0.5);
    let usedIds = new Set<string>();
    
    // Fix: Explicitly type sids as string[] to allow forEach call
    Object.entries(taskAssignments).forEach(([slotId, sids]) => {
      const ids = sids as string[];
      if (lockedSlots[slotId]) ids.forEach(id => usedIds.add(id));
      else newTasks[slotId] = [];
    });
    TASK_CONFIG.forEach(slot => {
      if (lockedSlots[slot.id]) return;
      const assigned = pool.filter(s => !usedIds.has(s.id) && (slot.day === 'Fredag' ? true : s.stayType === 'full')).slice(0, 2).map(s => s.id);
      newTasks[slot.id] = assigned;
      assigned.forEach(id => usedIds.add(id));
    });
    const eligibleClean = currentStudents.filter(s => s.stayType === 'full' && !s.isKitchenDuty);
    const cleanPool = [...eligibleClean].sort(() => Math.random() - 0.5);
    let cIdx = 0;
    CLEANING_CONFIG.forEach(area => {
      if (lockedSlots[area.name]) return;
      const assigned = cleanPool.slice(cIdx, cIdx + area.count).map(s => s.id);
      newCleaning[area.name] = assigned;
      cIdx += area.count;
    });
    setTaskAssignments(newTasks);
    setCleaningAssignments(newCleaning);
  }, [students, taskAssignments, cleaningAssignments, lockedSlots]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        // Fix: content can be string or ArrayBuffer, JSON.parse requires string
        if (typeof content !== 'string') return;
        
        if (file.name.endsWith('.json')) {
          const b = JSON.parse(content);
          if (b.students) setStudents(b.students);
          if (b.houseOrder) setHouseOrder(b.houseOrder);
          setTaskAssignments(b.taskAssignments || {});
          setCleaningAssignments(b.cleaningAssignments || {});
          setActiveTab('students');
          return;
        }
        const wb = XLSX.read(content, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const parsed = processExcelData(data);
        if (parsed.length > 0) {
          setStudents(parsed);
          setHouseOrder(Array.from(new Set(parsed.map(s => s.house))).filter(Boolean).sort());
          setActiveTab('students');
          setTimeout(() => performAutoGeneration(parsed), 100);
        }
      } catch (err) { alert("Fejl ved indlæsning."); }
    };
    if (file.name.endsWith('.json')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  };

  const exportBackup = () => {
    const data = JSON.stringify({ students, taskAssignments, cleaningAssignments, houseOrder, lockedSlots });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `weekend_backup.json`; a.click();
  };

  const togglePresence = (id: string) => setStudents(prev => prev.map(s => s.id === id ? { ...s, isPresent: !s.isPresent, stayType: !s.isPresent ? 'full' : 'none' } : s));
  const toggleKitchenDuty = (id: string) => setStudents(prev => prev.map(s => id === s.id ? { ...s, isKitchenDuty: !s.isKitchenDuty } : s));
  const toggleMarked = (id: string) => setStudents(prev => prev.map(s => id === s.id ? { ...s, isMarked: !s.isMarked } : s));
  const toggleReturned = (id: string) => setStudents(prev => prev.map(s => id === s.id ? { ...s, hasReturned: !s.hasReturned } : s));
  const toggleLock = (slotId: string) => setLockedSlots(prev => ({ ...prev, [slotId]: !prev[slotId] }));
  const setStudentLocation = (id: string, loc: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, sleepingLocations: { ...s.sleepingLocations, [brandListDay]: loc } } : s));
    setEditingStudentLocation(null);
  };
  const removeStudentFromSlot = (slotId: string, sid: string, type: 'task' | 'cleaning') => {
    if (type === 'task') setTaskAssignments(p => ({ ...p, [slotId]: (p[slotId] || []).filter(id => id !== sid) }));
    else setCleaningAssignments(p => ({ ...p, [slotId]: (p[slotId] || []).filter(id => id !== sid) }));
  };
  const addStudentToSlot = (sid: string) => {
    if (!manualAddSlot) return;
    const { id, type } = manualAddSlot;
    if (type === 'task') setTaskAssignments(p => ({ ...p, [id]: Array.from(new Set([...(p[id] || []), sid])) }));
    else setCleaningAssignments(p => ({ ...p, [id]: Array.from(new Set([...(p[id] || []), sid])) }));
    setManualAddSlot(null);
  };

  const getName = (id: string) => { const s = students.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}` : 'Ukendt'; };
  const filteredStudents = useMemo(() => students.filter(s => (showAllStudents || s.isPresent) && `${s.firstName} ${s.lastName} ${s.house}`.toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b)=>a.firstName.localeCompare(b.firstName)), [students, searchTerm, showAllStudents]);
  const modalFilteredStudents = useMemo(() => students.filter(s => s.isPresent && `${s.firstName} ${s.lastName}`.toLowerCase().includes(modalSearchTerm.toLowerCase())).sort((a,b)=>a.firstName.localeCompare(b.firstName)), [students, modalSearchTerm]);
  const currentBrandList = useMemo(() => {
    const dailySts = students.filter(s => brandListDay === 'Fredag' ? s.isPresent : (brandListDay === 'Lørdag' ? s.stayType === 'full' : (s.stayType === 'full' || s.hasReturned)));
    const groups: Record<string, Student[]> = {};
    dailySts.forEach(s => { 
      const loc = (s.sleepingLocations[brandListDay] || '');
      const name = loc.includes(' - ') ? loc.split(' - ')[0] : loc; 
      if (!groups[name]) groups[name] = []; groups[name].push(s); 
    });
    return Object.entries(groups).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [students, brandListDay]);

  const isStudentBusy = (sid: string) => {
    // Fix: Cast sids as string[] to use includes
    for (const sids of Object.values(taskAssignments)) if ((sids as string[]).includes(sid)) return true;
    for (const sids of Object.values(cleaningAssignments)) if ((sids as string[]).includes(sid)) return true;
    return false;
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#0A0E1A] text-white ${previewType ? '' : 'pb-24'}`}>
      {!previewType && (
        <header className="bg-[#0A0E1A] p-6 border-b border-white/10 no-print flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-[#FFB300] p-2 rounded-xl text-black shadow-lg shadow-[#FFB300]/20"><Compass className="w-6 h-6" /></div>
             <h1 className="text-2xl font-black tracking-tighter uppercase">Weekend</h1>
          </div>
          <div className="flex gap-2">
            {activeTab === 'students' && <button onClick={() => setShowAllStudents(!showAllStudents)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showAllStudents ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>{showAllStudents ? 'Alle' : 'Tilmeldte'}</button>}
            <button onClick={() => setShowFaq(true)} className="p-2 text-white/40"><HelpCircle className="w-5 h-5"/></button>
          </div>
        </header>
      )}

      <main className={`flex-1 ${previewType ? 'p-0 bg-white' : 'p-4 max-w-xl mx-auto w-full'}`}>
        {!previewType && (
          <>
            {activeTab === 'import' && (
              <div className="space-y-6 py-4">
                <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 text-center">
                  <Upload className="w-12 h-12 text-[#FFB300] mx-auto mb-6" /><h2 className="text-2xl font-black mb-4">Indlæs data</h2>
                  <input type="file" accept=".xlsx, .xls, .csv, .json" onChange={handleFileUpload} className="hidden" id="excel-up" />
                  <label htmlFor="excel-up" className="block w-full py-6 bg-[#00BFA5] text-black rounded-3xl font-black uppercase tracking-widest text-xs cursor-pointer shadow-lg shadow-[#00BFA5]/20">Vælg fil</label>
                </div>
                {students.length > 0 && (
                  <div className="bg-[#1E88E5]/10 p-6 rounded-[2rem] border border-[#1E88E5]/30">
                     <h3 className="text-sm font-black uppercase tracking-widest text-[#1E88E5] mb-4 flex items-center gap-2"><PieChart className="w-4 h-4" /> Weekend Overblik</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[10px] font-black uppercase text-white/40">Tilmeldt Total</p><p className="text-2xl font-black">{stats.total}</p></div>
                        <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[10px] font-black uppercase text-white/40">Hele week.</p><p className="text-2xl font-black">{stats.full}</p></div>
                        <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[10px] font-black uppercase text-white/40">Lørdag kl. 12</p><p className="text-2xl font-black text-[#00BFA5]">{stats.saturday}</p></div>
                        <div className="bg-white/5 p-4 rounded-2xl"><p className="text-[10px] font-black uppercase text-white/40">Særlige aftaler</p><p className="text-2xl font-black text-[#D81B60]">{stats.special}</p></div>
                     </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={exportBackup} disabled={students.length === 0} className="bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center gap-3 group disabled:opacity-20"><Download className="w-8 h-8 text-[#1E88E5]" /><span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Backup & Del</span></button>
                  <button onClick={() => setShowQuickstart(!showQuickstart)} className="bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center gap-3"><BookOpen className="w-8 h-8 text-[#FFB300]" /><span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Vejledning</span></button>
                </div>
              </div>
            )}
            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="relative mb-2"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" /><input type="text" placeholder="Søg..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none" /></div>
                <div className="flex justify-center mb-4"><p className="text-[9px] font-black uppercase text-white/20 tracking-widest flex items-center gap-2"><ArrowRightLeft className="w-3 h-3"/> Swipe til siden for tilmelding</p></div>
                {filteredStudents.map((s, idx) => <SwipableStudentCard key={s.id} student={s} color={WISE_COLORS[idx % WISE_COLORS.length]} onSwipe={() => togglePresence(s.id)} onKitchenClick={() => toggleKitchenDuty(s.id)} />)}
              </div>
            )}
            {activeTab === 'rounds' && (
               <div className="space-y-6">
                 <div className="flex justify-between items-center px-2"><h2 className="text-2xl font-black">Gang-runde</h2><div className="flex bg-white/5 p-1 rounded-xl border border-white/10">{['Fredag', 'Lørdag', 'Søndag'].map(day => <button key={day} onClick={() => setBrandListDay(day as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${brandListDay === day ? 'bg-[#FFB300] text-black' : 'text-white/40'}`}>{day}</button>)}</div></div>
                 {houseOrder.map((house, idx) => {
                   const dailyStsCount = students.filter(s => s.house === house && (brandListDay === 'Fredag' ? s.isPresent : (brandListDay === 'Lørdag' ? s.stayType === 'full' : (s.stayType === 'full' || s.hasReturned)))).length;
                   const isExp = expandedHouses[house];
                   const houseSts = students.filter(s => s.house === house && (brandListDay === 'Fredag' ? s.isPresent : (brandListDay === 'Lørdag' ? s.stayType === 'full' : (s.stayType === 'full' || s.hasReturned))));
                   return (
                     <div key={house} className="bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden">
                        <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => setExpandedHouses(p => ({...p, [house]: !p[house]}))}><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${WISE_COLORS[idx % WISE_COLORS.length]} text-black`}>{dailyStsCount}</div><span className="font-black uppercase tracking-widest">{house}</span></div><div className="text-white/20">{isExp ? <ChevronUp/> : <ChevronDown/>}</div></div>
                        {isExp && <div className="p-2 space-y-2 border-t border-white/10">{houseSts.length > 0 ? houseSts.map(s => {
                                const loc = (s.sleepingLocations[brandListDay] || '');
                                const isDefault = loc === `${s.house} - ${s.room}`;
                                return (
                                <div key={s.id} className="bg-white/5 p-5 rounded-2xl flex items-center justify-between group">
                                   <div className="flex items-center gap-4"><button onClick={() => toggleMarked(s.id)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${s.isMarked ? 'bg-[#00BFA5] border-[#00BFA5] text-black' : 'border-white/10 text-transparent'}`}><Check/></button><div><p className="font-bold">{s.firstName} {s.lastName}</p><button onClick={() => setEditingStudentLocation(s.id)} className="flex items-center gap-1.5 mt-0.5 group/loc"><MapPin className={`w-3 h-3 ${isDefault ? 'text-white/40' : 'text-[#FFB300]'}`}/><span className={`text-[9px] font-black uppercase ${isDefault ? 'text-white/40' : 'text-[#FFB300]'}`}>{loc}</span></button></div></div>
                                   <button onClick={() => setEditingStudentLocation(s.id)} className={`p-3 rounded-2xl transition-all ${isDefault ? 'bg-white/5 text-white/20' : 'bg-[#FFB300] text-black'}`}><Bed className="w-5 h-5" /></button>
                                </div>
                             )}) : <div className="p-6 text-center text-white/20 font-black uppercase text-[10px]">Ingen elever her {brandListDay}</div>}</div>}
                     </div>
                   );
                 })}
               </div>
            )}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center px-2"><h2 className="text-2xl font-black">Tjanser</h2><button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase tracking-widest bg-[#FFB300] text-black px-4 py-2 rounded-xl shadow-lg shadow-[#FFB300]/10 active:scale-95 transition-all">Gendan Plan</button></div>
                 {['Fredag', 'Lørdag', 'Søndag'].map((day, dIdx) => (
                   <div key={day} className="space-y-4">
                      <h3 className="text-xl font-black uppercase tracking-widest text-[#FFB300] border-b border-white/5 pb-2 pl-4 mt-4">{day}</h3>
                      {TASK_CONFIG.filter(t => t.day === day).map((task, tIdx) => (
                        <div key={task.id} className={`${WISE_COLORS[(dIdx + tIdx) % WISE_COLORS.length]} p-6 rounded-[2rem] text-black flex flex-col gap-4 shadow-lg`}><div className="flex justify-between items-start"><div className="flex items-center gap-3"><span className="text-2xl font-black uppercase tracking-tighter leading-none">{task.label}</span><button onClick={() => toggleLock(task.id)} className={`p-1 rounded-lg ${lockedSlots[task.id] ? 'bg-black text-white' : 'bg-black/10'}`}>{lockedSlots[task.id] ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3 opacity-40"/>}</button></div><button onClick={() => setManualAddSlot({id: task.id, type: 'task'})} className="p-2 bg-black/10 rounded-xl"><Plus className="w-5 h-5"/></button></div><div className="flex flex-wrap gap-2">{(taskAssignments[task.id] || []).map(sid => <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 group">{getName(sid)}<button onClick={() => removeStudentFromSlot(task.id, sid, 'task')} className="opacity-40 hover:opacity-100"><Trash2 className="w-4 h-4 text-red-600"/></button></div>)}{!(taskAssignments[task.id] || []).length && <span className="text-sm font-bold opacity-30 italic">Ingen valgt</span>}</div></div>
                      ))}
                   </div>
                 ))}
              </div>
            )}
            {activeTab === 'cleaning' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center px-2"><h2 className="text-2xl font-black">Rengøring</h2><button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase tracking-widest bg-[#FFB300] text-black px-4 py-2 rounded-xl shadow-lg shadow-[#FFB300]/10 active:scale-95 transition-all">Gendan Plan</button></div>
                 <div className="grid grid-cols-1 gap-4">{CLEANING_CONFIG.map((area, idx) => (
                      <div key={area.name} className={`${WISE_COLORS[idx % WISE_COLORS.length]} p-6 rounded-[2rem] text-black shadow-lg flex flex-col gap-4`}><div className="flex justify-between items-center"><div className="flex items-center gap-3"><h3 className="text-xl font-black uppercase tracking-widest">{area.name}</h3><button onClick={() => toggleLock(area.name)} className={`p-1 rounded-lg ${lockedSlots[area.name] ? 'bg-black text-white' : 'bg-black/10'}`}>{lockedSlots[area.name] ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3 opacity-40"/>}</button></div><button onClick={() => setManualAddSlot({id: area.name, type: 'cleaning'})} className="p-1.5 bg-black/10 rounded-lg"><Plus className="w-4 h-4"/></button></div><div className="flex flex-wrap gap-2">{(cleaningAssignments[area.name] || []).map(sid => <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">{getName(sid)}<button onClick={() => removeStudentFromSlot(area.name, sid, 'cleaning')}><X className="w-4 h-4 text-red-600"/></button></div>)}</div></div>
                    ))}</div>
              </div>
            )}
            {activeTab === 'sunday' && (
              <div className="space-y-4">
                 <h2 className="text-2xl font-black px-2">Søndagslisten</h2>
                 {students.sort((a,b)=>a.firstName.localeCompare(b.firstName)).map((s) => (
                   <div key={s.id} className={`bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center justify-between transition-all ${!s.isPresent ? 'opacity-30' : ''}`}><div><p className="font-black text-xl">{s.firstName} {s.lastName}</p><p className="text-[10px] font-black uppercase text-white/20 tracking-widest">{s.house} • {s.room}</p></div>{s.isPresent ? <span className="bg-[#00BFA5]/20 text-[#00BFA5] px-5 py-3 rounded-2xl font-black text-xs">HU</span> : <button onClick={() => toggleReturned(s.id)} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${s.hasReturned ? 'bg-[#00BFA5] text-black' : 'bg-white/5 text-white/20'}`}>{s.hasReturned ? 'Kommet' : 'Venter'}</button>}</div>
                 ))}
              </div>
            )}
            {activeTab === 'print' && (
               <div className="space-y-4 py-10"><h2 className="text-3xl font-black text-center mb-8">Udskrift & Lister</h2><button onClick={() => setPreviewType('main')} className="w-full p-8 bg-[#FFB300] text-black rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#FFB300]/10">Tjanser & Rengøring <ChevronRight/></button><button onClick={() => setPreviewType('brand')} className="w-full p-8 bg-[#D81B60] text-white rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#D81B60]/10">Brandliste ({brandListDay}) <ChevronRight/></button><button onClick={() => setPreviewType('sunday')} className="w-full p-8 bg-[#00BFA5] text-black rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#00BFA5]/10">Søndagslisten <ChevronRight/></button></div>
            )}
          </>
        )}

        {previewType && (
          <div className="bg-white text-black p-4 min-h-screen">
             <div className="no-print fixed top-0 left-0 right-0 bg-black p-4 z-[200] flex justify-between items-center text-white"><button onClick={() => setPreviewType(null)}><X/></button><span className="font-black text-xs">Print Preview</span><button onClick={() => window.print()} className="bg-[#00BFA5] text-black px-6 py-2 rounded-xl font-black text-xs">Udskriv</button></div>
             <div className="pt-16">
               <h1 className="text-4xl font-black text-center mb-8">{previewType === 'main' ? 'Tjanser' : (previewType === 'brand' ? 'Brandliste' : 'Søndagsliste')}</h1>
               <p className="text-center text-slate-400">Indhold genereret fra Wiselist Weekend</p>
             </div>
          </div>
        )}
      </main>

      {!previewType && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0E1A]/95 backdrop-blur-2xl border-t border-white/10 px-4 py-6 no-print z-50"><div className="max-w-md mx-auto flex justify-between items-center"><button onClick={() => setActiveTab('import')} className={`p-4 ${activeTab === 'import' ? 'text-[#FFB300]' : 'text-white/20'}`}><Database/></button><button onClick={() => setActiveTab('students')} className={`p-4 ${activeTab === 'students' ? 'text-[#FFB300]' : 'text-white/20'}`}><Users/></button><div className="relative -top-10"><button onClick={() => setActiveTab('rounds')} className="w-20 h-20 bg-[#FFB300] text-black rounded-[2rem] flex items-center justify-center shadow-2xl"><Compass /></button></div><button onClick={() => setActiveTab('tasks')} className={`p-4 ${activeTab === 'tasks' ? 'text-[#FFB300]' : 'text-white/20'}`}><Utensils/></button><button onClick={() => setActiveTab('print')} className={`p-4 ${activeTab === 'print' ? 'text-[#FFB300]' : 'text-white/20'}`}><FileText/></button></div></nav>
      )}

      {showFaq && <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-6"><div className="bg-[#151926] w-full max-w-lg rounded-[3rem] p-8"><h3>Guide</h3><p>Swipe for at melde til/fra.</p><button onClick={() => setShowFaq(false)}>Luk</button></div></div>}
      
      {editingStudentLocation && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-6 no-print">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] p-8 overflow-y-auto max-h-[90vh]">
             <h3 className="mb-4">Vælg Sovested</h3>
             <button onClick={() => setEditingStudentLocation(null)} className="absolute top-8 right-8"><X/></button>
             {COMMON_SLEEPING_AREAS.map(area => <button key={area} onClick={() => setStudentLocation(editingStudentLocation, area)} className="w-full p-4 bg-white/5 rounded-xl mb-2">{area}</button>)}
             <button onClick={() => setEditingStudentLocation(null)} className="w-full p-4 border mt-4">Annuller</button>
          </div>
        </div>
      )}

      {manualAddSlot && (
        <div className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center p-6 no-print">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] p-8 overflow-y-auto max-h-[80vh]">
             <h3 className="mb-4">Tildel Elev</h3>
             <input type="text" placeholder="Søg..." value={modalSearchTerm} onChange={e=>setModalSearchTerm(e.target.value)} className="w-full bg-white/5 p-4 rounded-xl mb-4" />
             {modalFilteredStudents.map(s => <button key={s.id} onClick={() => addStudentToSlot(s.id)} className="w-full p-4 bg-white/5 rounded-xl mb-2 text-left">{s.firstName} {s.lastName}</button>)}
             <button onClick={() => setManualAddSlot(null)} className="w-full p-4 mt-4">Luk</button>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
