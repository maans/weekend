
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Users, 
  Utensils, 
  Trash2, 
  FileText, 
  Upload, 
  ChevronRight, 
  ArrowRightLeft, 
  Trash,
  CheckCircle2,
  XCircle,
  Printer,
  ChevronUp,
  ChevronDown,
  Database,
  Info,
  CalendarDays,
  Search,
  Filter,
  Eye,
  X,
  Clock,
  GripVertical,
  Bed,
  MapPin,
  Plus,
  Flame,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  AlertCircle,
  Check,
  MoveHorizontal,
  Home,
  HelpCircle,
  BookOpen,
  Github,
  Globe,
  PieChart,
  Download,
  Share2,
  Compass,
  AlertTriangle,
  Monitor,
  Smartphone,
  Share,
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, TaskSlot, TASK_CONFIG, CLEANING_CONFIG, COMMON_SLEEPING_AREAS } from './types.ts';

const STORAGE_KEY = 'weekendvagt_app_data_v16';

const WISE_COLORS = [
  'bg-[#FFB300]', // Gul
  'bg-[#00BFA5]', // Teal
  'bg-[#D81B60]', // Magenta
  'bg-[#1E88E5]', // Blue
  'bg-[#5E35B1]', // Purple
];

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
    startX.current = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (startX.current === 0) return;
    const currentX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const diff = currentX - startX.current;
    if (Math.abs(diff) > 10) {
      setOffset(diff);
    }
  };

  const handleEnd = () => {
    if (Math.abs(offset) > 100) {
      onSwipe();
    }
    setOffset(0);
    startX.current = 0;
  };

  return (
    <div 
      className="relative overflow-hidden rounded-[2.5rem]"
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      <div 
        style={{ transform: `translateX(${offset}px)` }}
        className={`${color} p-7 text-black shadow-lg flex items-center justify-between transition-transform duration-150 select-none ${!student.isPresent ? 'opacity-30 grayscale' : 'hover:scale-[1.01]'}`}>
        <div className="flex flex-col pointer-events-none">
            <p className={`text-2xl font-black leading-tight mb-1 ${!student.isPresent ? 'text-black/40' : ''}`}>{student.firstName} {student.lastName}</p>
            <span className="text-[11px] font-black uppercase opacity-60 tracking-[0.15em]">{student.house} • {student.room}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onKitchenClick(); }} 
          className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border shadow-sm ${student.isKitchenDuty ? 'bg-black text-white border-black' : 'bg-black/10 border-transparent text-black'}`}>
          Køkken
        </button>
      </div>
      {offset > 20 && (
          <div className="absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none opacity-50">
              <ArrowRightLeft className="w-6 h-6 text-black"/>
          </div>
      )}
      {offset < -20 && (
          <div className="absolute inset-y-0 right-0 w-12 flex items-center justify-center pointer-events-none opacity-50">
              <ArrowRightLeft className="w-6 h-6 text-black"/>
          </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'students' | 'rounds' | 'tasks' | 'cleaning' | 'sunday' | 'print'>('import');
  const [houseOrder, setHouseOrder] = useState<string[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string[]>>({});
  const [cleaningAssignments, setCleaningAssignments] = useState<Record<string, string[]>>({});
  const [lockedSlots, setLockedSlots] = useState<Record<string, boolean>>({});
  const [previewType, setPreviewType] = useState<'main' | 'brand' | 'sunday' | null>(null);
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
        if (parsed.taskAssignments) setTaskAssignments(parsed.taskAssignments || {});
        if (parsed.cleaningAssignments) setCleaningAssignments(parsed.cleaningAssignments || {});
        if (parsed.lockedSlots) setLockedSlots(parsed.lockedSlots || {});
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        students, houseOrder, taskAssignments, cleaningAssignments, lockedSlots
      }));
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

  const performAutoGeneration = useCallback((currentStudents: Student[] = students) => {
    const newTasks: Record<string, string[]> = { ...taskAssignments };
    const newCleaning: Record<string, string[]> = { ...cleaningAssignments };
    
    const eligibleTasks = currentStudents.filter(s => s.isPresent && !s.isKitchenDuty);
    const pool = [...eligibleTasks].sort(() => Math.random() - 0.5);
    
    let usedIds = new Set<string>();
    Object.entries(taskAssignments).forEach(([slotId, sids]) => {
      if (lockedSlots[slotId]) {
        (sids as string[]).forEach(id => usedIds.add(id));
      } else {
        newTasks[slotId] = [];
      }
    });

    TASK_CONFIG.forEach(slot => {
      if (lockedSlots[slot.id]) return;
      const candidates = pool.filter(s => !usedIds.has(s.id) && (slot.day === 'Fredag' ? true : s.stayType === 'full'));
      const assigned = candidates.slice(0, 2).map(s => s.id);
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
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const backup = JSON.parse(content);
          if (backup.students) setStudents(backup.students);
          if (backup.taskAssignments) setTaskAssignments(backup.taskAssignments || {});
          if (backup.cleaningAssignments) setCleaningAssignments(backup.cleaningAssignments || {});
          if (backup.houseOrder) setHouseOrder(backup.houseOrder || []);
          if (backup.lockedSlots) setLockedSlots(backup.lockedSlots || {});
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
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekend_backup_${new Date().toLocaleDateString('da-DK')}.json`;
    a.click();
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

  const sundayStudents = useMemo(() => [...students].sort((a,b)=>a.firstName.localeCompare(b.firstName)), [students]);

  const currentBrandList = useMemo(() => {
    const dailySts = students.filter(s => {
      if (brandListDay === 'Fredag') return s.isPresent;
      if (brandListDay === 'Lørdag') return s.stayType === 'full';
      return (s.stayType === 'full' || s.hasReturned);
    });
    const groups: Record<string, Student[]> = {};
    dailySts.forEach(s => { 
      const loc = (s.sleepingLocations[brandListDay as keyof typeof s.sleepingLocations] || '') as string; 
      const name = loc.includes(' - ') ? loc.split(' - ')[0] : loc; 
      if (!groups[name]) groups[name] = []; 
      groups[name].push(s); 
    });
    return (Object.entries(groups) as [string, Student[]][]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [students, brandListDay]);

  const isStudentBusy = (sid: string) => {
    for (const sids of Object.values(taskAssignments) as string[][]) if (sids.includes(sid)) return true;
    for (const sids of Object.values(cleaningAssignments) as string[][]) if (sids.includes(sid)) return true;
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
            {activeTab === 'students' && (
              <button onClick={() => setShowAllStudents(!showAllStudents)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showAllStudents ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                {showAllStudents ? 'Alle' : 'Tilmeldte'}
              </button>
            )}
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
                  <Upload className="w-12 h-12 text-[#FFB300] mx-auto mb-6" />
                  <h2 className="text-2xl font-black mb-4">Indlæs data</h2>
                  <input type="file" accept=".xlsx, .xls, .csv, .json" onChange={handleFileUpload} className="hidden" id="excel-up" />
                  <label htmlFor="excel-up" className="block w-full py-6 bg-[#00BFA5] text-black rounded-3xl font-black uppercase tracking-widest text-xs cursor-pointer shadow-lg shadow-[#00BFA5]/20">Vælg fil</label>
                </div>

                {students.length > 0 && (
                  <div className="bg-[#1E88E5]/10 p-6 rounded-[2rem] border border-[#1E88E5]/30">
                     <h3 className="text-sm font-black uppercase tracking-widest text-[#1E88E5] mb-4 flex items-center gap-2"><PieChart className="w-4 h-4" /> Weekend Overblik</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-4 rounded-2xl">
                           <p className="text-[10px] font-black uppercase text-white/40">Tilmeldt Total</p>
                           <p className="text-2xl font-black">{stats.total}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl">
                           <p className="text-[10px] font-black uppercase text-white/40">Hele week.</p>
                           <p className="text-2xl font-black">{stats.full}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl">
                           <p className="text-[10px] font-black uppercase text-white/40">Lørdag kl. 12</p>
                           <p className="text-2xl font-black text-[#00BFA5]">{stats.saturday}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl">
                           <p className="text-[10px] font-black uppercase text-white/40">Særlige aftaler</p>
                           <p className="text-2xl font-black text-[#D81B60]">{stats.special}</p>
                        </div>
                     </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={exportBackup} disabled={students.length === 0} className="bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center gap-3 group disabled:opacity-20">
                    <Download className="w-8 h-8 text-[#1E88E5]" />
                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Backup & Del</span>
                  </button>
                  <button onClick={() => setShowQuickstart(!showQuickstart)} className="bg-white/5 p-8 rounded-[2rem] border border-white/10 text-center flex flex-col items-center gap-3">
                    <BookOpen className="w-8 h-8 text-[#FFB300]" />
                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Vejledning</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="relative mb-2">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type="text" placeholder="Søg..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none" />
                </div>
                <div className="flex justify-center mb-4">
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-widest flex items-center gap-2">
                        <ArrowRightLeft className="w-3 h-3"/> Swipe til siden for tilmelding
                    </p>
                </div>
                {filteredStudents.map((s, idx) => (
                  <SwipableStudentCard 
                    key={s.id} 
                    student={s} 
                    color={WISE_COLORS[idx % WISE_COLORS.length]} 
                    onSwipe={() => togglePresence(s.id)}
                    onKitchenClick={() => toggleKitchenDuty(s.id)}
                  />
                ))}
              </div>
            )}

            {activeTab === 'rounds' && (
               <div className="space-y-6">
                 <div className="flex justify-between items-center px-2">
                    <h2 className="text-2xl font-black">Gang-runde</h2>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                      {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                        <button key={day} onClick={() => setBrandListDay(day as any)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${brandListDay === day ? 'bg-[#FFB300] text-black' : 'text-white/40'}`}>{day}</button>
                      ))}
                    </div>
                 </div>
                 {houseOrder.map((house, idx) => {
                   const dailyStsCount = students.filter(s => {
                       if (s.house !== house) return false;
                       if (brandListDay === 'Fredag') return s.isPresent;
                       if (brandListDay === 'Lørdag') return s.stayType === 'full';
                       return (s.stayType === 'full' || s.hasReturned);
                   }).length;

                   const isExp = expandedHouses[house];
                   const houseSts = students.filter(s => {
                        if (s.house !== house) return false;
                        if (brandListDay === 'Fredag') return s.isPresent;
                        if (brandListDay === 'Lørdag') return s.stayType === 'full';
                        return (s.stayType === 'full' || s.hasReturned);
                   });

                   return (
                     <div key={house} className="bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden">
                        <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => setExpandedHouses(p => ({...p, [house]: !p[house]}))}>
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${WISE_COLORS[idx % WISE_COLORS.length]} text-black`}>{dailyStsCount}</div>
                              <span className="font-black uppercase tracking-widest">{house}</span>
                           </div>
                           <div className="text-white/20">{isExp ? <ChevronUp/> : <ChevronDown/>}</div>
                        </div>
                        {isExp && (
                          <div className="p-2 space-y-2 border-t border-white/10">
                             {houseSts.length > 0 ? houseSts.map(s => {
                                const loc = (s.sleepingLocations[brandListDay as keyof typeof s.sleepingLocations] || '') as string;
                                const isDefault = loc === `${s.house} - ${s.room}`;
                                return (
                                <div key={s.id} className="bg-white/5 p-5 rounded-2xl flex items-center justify-between group">
                                   <div className="flex items-center gap-4">
                                      <button onClick={() => toggleMarked(s.id)} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${s.isMarked ? 'bg-[#00BFA5] border-[#00BFA5] text-black' : 'border-white/10 text-transparent'}`}><Check/></button>
                                      <div>
                                        <p className="font-bold">{s.firstName} {s.lastName}</p>
                                        <button onClick={() => setEditingStudentLocation(s.id)} className="flex items-center gap-1.5 mt-0.5 group/loc">
                                          <MapPin className={`w-3 h-3 ${isDefault ? 'text-white/40' : 'text-[#FFB300]'}`}/>
                                          <span className={`text-[9px] font-black uppercase ${isDefault ? 'text-white/40' : 'text-[#FFB300]'}`}>{loc}</span>
                                        </button>
                                      </div>
                                   </div>
                                   <button onClick={() => setEditingStudentLocation(s.id)} className={`p-3 rounded-2xl transition-all ${isDefault ? 'bg-white/5 text-white/20' : 'bg-[#FFB300] text-black'}`}><Bed className="w-5 h-5" /></button>
                                </div>
                             )}) : (
                                 <div className="p-6 text-center text-white/20 font-black uppercase text-[10px]">Ingen elever her {brandListDay}</div>
                             )}
                          </div>
                        )}
                     </div>
                   );
                 })}
               </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center px-2">
                    <h2 className="text-2xl font-black">Tjanser</h2>
                    <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase tracking-widest bg-[#FFB300] text-black px-4 py-2 rounded-xl shadow-lg shadow-[#FFB300]/10 active:scale-95 transition-all">Gendan Plan</button>
                 </div>
                 
                 {stats.kitchen === 0 && (
                   <div className="mx-2 bg-[#D81B60]/20 p-4 rounded-2xl border border-[#D81B60]/40 flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-[#D81B60] shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-white/80 leading-relaxed">Ingen køkkenelever markeret! Marker dem under <Users className="w-3 h-3 inline pb-0.5"/> og gendan derefter planen for at undgå dobbeltbooking.</p>
                   </div>
                 )}

                 {['Fredag', 'Lørdag', 'Søndag'].map((day, dIdx) => (
                   <div key={day} className="space-y-4">
                      <h3 className="text-xl font-black uppercase tracking-widest text-[#FFB300] border-b border-white/5 pb-2 pl-4 mt-4">{day}</h3>
                      {TASK_CONFIG.filter(t => t.day === day).map((task, tIdx) => {
                        const isLocked = lockedSlots[task.id];
                        return (
                        <div key={task.id} className={`${WISE_COLORS[(dIdx + tIdx) % WISE_COLORS.length]} p-6 rounded-[2rem] text-black flex flex-col gap-4 shadow-lg`}>
                           <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black uppercase tracking-tighter leading-none">{task.label}</span>
                                <button onClick={() => toggleLock(task.id)} className={`p-1 rounded-lg ${isLocked ? 'bg-black text-white' : 'bg-black/10'}`}>
                                   {isLocked ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3 opacity-40"/>}
                                </button>
                              </div>
                              <button onClick={() => setManualAddSlot({id: task.id, type: 'task'})} className="p-2 bg-black/10 rounded-xl"><Plus className="w-5 h-5"/></button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                              {(taskAssignments[task.id] || []).map(sid => (
                                <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 group">
                                   {getName(sid)}
                                   <button onClick={() => removeStudentFromSlot(task.id, sid, 'task')} className="opacity-40 hover:opacity-100"><Trash2 className="w-4 h-4 text-red-600"/></button>
                                </div>
                              ))}
                              {!(taskAssignments[task.id] || []).length && <span className="text-sm font-bold opacity-30 italic">Ingen valgt</span>}
                           </div>
                        </div>
                      )})}
                   </div>
                 ))}
              </div>
            )}

            {activeTab === 'cleaning' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center px-2">
                    <h2 className="text-2xl font-black">Rengøring</h2>
                    <button onClick={() => performAutoGeneration()} className="text-[10px] font-black uppercase tracking-widest bg-[#FFB300] text-black px-4 py-2 rounded-xl shadow-lg shadow-[#FFB300]/10 active:scale-95 transition-all">Gendan Plan</button>
                 </div>
                 {stats.kitchen === 0 && (
                   <div className="mx-2 bg-[#D81B60]/20 p-4 rounded-2xl border border-[#D81B60]/40 flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 text-[#D81B60] shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-white/80 leading-relaxed">Marker venligst køkkenelever først, så de udelades fra rengøringspuljen.</p>
                   </div>
                 )}
                 <div className="grid grid-cols-1 gap-4">
                    {CLEANING_CONFIG.map((area, idx) => {
                      const isLocked = lockedSlots[area.name];
                      return (
                      <div key={area.name} className={`${WISE_COLORS[idx % WISE_COLORS.length]} p-6 rounded-[2rem] text-black shadow-lg flex flex-col gap-4`}>
                         <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-black uppercase tracking-widest">{area.name}</h3>
                              <button onClick={() => toggleLock(area.name)} className={`p-1 rounded-lg ${isLocked ? 'bg-black text-white' : 'bg-black/10'}`}>
                                 {isLocked ? <Lock className="w-3 h-3"/> : <Unlock className="w-3 h-3 opacity-40"/>}
                              </button>
                            </div>
                            <button onClick={() => setManualAddSlot({id: area.name, type: 'cleaning'})} className="p-1.5 bg-black/10 rounded-lg"><Plus className="w-4 h-4"/></button>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {(cleaningAssignments[area.name] || []).map(sid => (
                              <div key={sid} className="bg-black/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                 {getName(sid)}
                                 <button onClick={() => removeStudentFromSlot(area.name, sid, 'cleaning')}><X className="w-4 h-4 text-red-600"/></button>
                              </div>
                            ))}
                         </div>
                      </div>
                    )})}
                 </div>
              </div>
            )}

            {activeTab === 'sunday' && (
              <div className="space-y-4">
                 <h2 className="text-2xl font-black px-2">Søndagslisten</h2>
                 {sundayStudents.map((s, idx) => (
                   <div key={s.id} className={`bg-white/5 p-6 rounded-[2.5rem] border border-white/10 flex items-center justify-between transition-all ${!s.isPresent ? 'opacity-30' : ''}`}>
                      <div>
                        <p className="font-black text-xl">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">{s.house} • {s.room}</p>
                      </div>
                      {s.isPresent ? <span className="bg-[#00BFA5]/20 text-[#00BFA5] px-5 py-3 rounded-2xl font-black text-xs">HU</span> : 
                        <button onClick={() => toggleReturned(s.id)} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${s.hasReturned ? 'bg-[#00BFA5] text-black' : 'bg-white/5 text-white/20'}`}>{s.hasReturned ? 'Kommet' : 'Venter'}</button>
                      }
                   </div>
                 ))}
              </div>
            )}

            {activeTab === 'print' && (
               <div className="space-y-4 py-10">
                  <h2 className="text-3xl font-black text-center mb-8">Udskrift & Lister</h2>
                  <button onClick={() => setPreviewType('main')} className="w-full p-8 bg-[#FFB300] text-black rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#FFB300]/10">Tjanser & Rengøring <ChevronRight/></button>
                  <button onClick={() => setPreviewType('brand')} className="w-full p-8 bg-[#D81B60] text-white rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#D81B60]/10">Brandliste ({brandListDay}) <ChevronRight/></button>
                  <button onClick={() => setPreviewType('sunday')} className="w-full p-8 bg-[#00BFA5] text-black rounded-[2.5rem] font-black uppercase tracking-widest flex justify-between items-center shadow-lg shadow-[#00BFA5]/10">Søndagslisten <ChevronRight/></button>
               </div>
            )}
          </>
        )}

        {/* PRINT SYSTEM */}
        <div className={`${previewType ? 'block' : 'print-only'} bg-white text-black`}>
           {previewType && (
              <div className="no-print fixed top-0 left-0 right-0 bg-[#0A0E1A] p-4 z-[200] flex justify-between items-center border-b border-white/10 text-white">
                 <button onClick={() => setPreviewType(null)} className="p-2 text-white/40"><X/></button>
                 <span className="font-black uppercase text-xs tracking-widest">Print Preview</span>
                 <button onClick={() => window.print()} className="bg-[#00BFA5] text-black px-6 py-2 rounded-xl font-black uppercase text-xs">Udskriv nu</button>
              </div>
           )}

           {(previewType === 'main' || !previewType) && (
              <div className="bg-white min-h-screen p-[10mm] text-black">
                 <PrintPage title="Weekend Tjanser" pageNum={1} totalPages={2}>
                    <div className="space-y-8">
                       {['Fredag', 'Lørdag', 'Søndag'].map(day => (
                          <div key={day} className="border-b-2 border-slate-100 pb-6">
                             <h3 className="text-2xl font-black uppercase mb-4 text-[#FFB300]">{day}</h3>
                             <div className="grid grid-cols-2 gap-4">
                                {TASK_CONFIG.filter(t => t.day === day).map(t => (
                                   <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                      <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.label}</p>
                                      <p className="font-bold text-xl text-black">{(taskAssignments[t.id] || []).map(getName).join(' & ') || '---'}</p>
                                   </div>
                                ))}
                             </div>
                          </div>
                       ))}
                    </div>
                 </PrintPage>
                 <div className="page-break"></div>
                 <PrintPage title="Rengøringsliste" pageNum={2} totalPages={2}>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                       {CLEANING_CONFIG.map(area => (
                          <div key={area.name} className="border-b border-slate-100 pb-4">
                             <h4 className="font-black uppercase text-xs mb-3 text-slate-500 tracking-widest">{area.name}</h4>
                             <ul className="pl-6 list-disc font-bold text-xl text-black space-y-1">
                                {(cleaningAssignments[area.name] || []).map(sid => <li key={sid}>{getName(sid)}</li>)}
                             </ul>
                          </div>
                       ))}
                    </div>
                 </PrintPage>
              </div>
           )}

           {(previewType === 'sunday' || !previewType) && (
             <div className="bg-white min-h-screen p-[10mm] text-black">
               <PrintPage title="Søndagslisten" pageNum={1} totalPages={1}>
                 <div className="grid grid-cols-1 gap-1 border-t-2 border-black mt-6">
                    {sundayStudents.map(s => (
                       <div key={s.id} className="flex justify-between items-center py-2 border-b border-slate-100 px-2">
                          <div className={!s.isPresent ? 'opacity-30' : ''}>
                            <p className="font-bold text-xl text-black">{s.firstName} {s.lastName}</p>
                            <p className="text-[12px] uppercase text-slate-400 tracking-widest">{s.house} • {s.room}</p>
                          </div>
                          <div className="w-12 h-12 border-2 border-black flex items-center justify-center font-black text-xl text-black">{s.isPresent ? 'HU' : ''}</div>
                       </div>
                    ))}
                 </div>
               </PrintPage>
             </div>
           )}

           {(previewType === 'brand' || !previewType) && (
              <div className="bg-white min-h-screen text-black">
                 {currentBrandList.map(([loc, sts], idx) => {
                    const roomMap: Record<string, Student[]> = {};
                    sts.forEach(s => {
                       const r = String(s.sleepingLocations[brandListDay as keyof typeof s.sleepingLocations] || '').split(' - ')[1]?.trim() || s.room;
                       if (!roomMap[r]) roomMap[r] = [];
                       roomMap[r].push(s);
                    });
                    const sortedRooms = Object.entries(roomMap).sort((a,b) => a[0].localeCompare(b[0]));

                    return (
                    <div key={loc} className="p-[20mm] min-h-[297mm] relative border-8 border-red-600 mb-8 page-break">
                       <div className="flex justify-between items-start border-b-8 border-red-600 pb-6 mb-8">
                          <div>
                            <h1 className="text-6xl font-black text-red-600 uppercase tracking-tighter">Brandliste</h1>
                            <p className="text-2xl font-bold text-slate-400 uppercase tracking-widest">{brandListDay} nat</p>
                          </div>
                          <div className="text-right">
                             <p className="text-8xl font-black text-red-600 leading-none">{sts.length}</p>
                             <p className="font-black uppercase text-slate-400 text-sm tracking-widest">Elever på lokationen</p>
                          </div>
                       </div>
                       <div className="mb-12">
                          <p className="text-slate-400 font-black uppercase text-sm mb-2 tracking-widest">Lokation / Gang</p>
                          <h2 className="text-7xl font-black uppercase text-black">{loc}</h2>
                       </div>
                       
                       <div className="border-t-4 border-slate-200">
                         {sortedRooms.map(([room, roomSts]) => (
                            <div key={room} className="flex justify-between items-center py-4 border-b-2 border-slate-100">
                               <div className="space-y-1">
                                  {roomSts.map(rs => (
                                     <p key={rs.id} className="text-3xl font-bold text-black">{rs.firstName} {rs.lastName}</p>
                                  ))}
                               </div>
                               <div className="text-right">
                                  <p className="text-4xl font-black text-red-600 uppercase">{room}</p>
                                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest">({roomSts.length} pers)</p>
                               </div>
                            </div>
                         ))}
                       </div>

                       <div className="absolute bottom-10 left-[20mm] right-[20mm] text-center border-t-2 pt-6 text-[12px] font-black text-red-600 uppercase tracking-[0.2em]">
                          KONTROLLERES VED EVAKUERING • {sts.length} ELEVER HER • SIDE {idx+1} AF {currentBrandList.length}
                       </div>
                    </div>
                 )})}
              </div>
           )}
        </div>
      </main>

      {!previewType && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0A0E1A]/95 backdrop-blur-2xl border-t border-white/10 px-4 py-6 no-print z-50">
           <div className="max-w-md mx-auto flex justify-between items-center">
              <NavItem icon={<Database/>} active={activeTab === 'import'} onClick={() => setActiveTab('import')} />
              <NavItem icon={<Users/>} active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
              <div className="relative -top-10">
                 <button onClick={() => setActiveTab('rounds')} className="w-20 h-20 bg-[#FFB300] text-black rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#FFB300]/30 active:scale-95 transition-all">
                    <Compass className={`w-10 h-10 transition-transform ${activeTab === 'rounds' ? 'rotate-45' : ''}`} />
                 </button>
              </div>
              <NavItem icon={<Utensils/>} active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
              <NavItem icon={<Layers/>} active={activeTab === 'cleaning'} onClick={() => setActiveTab('cleaning')} />
              <NavItem icon={<FileText/>} active={activeTab === 'print'} onClick={() => setActiveTab('print')} />
           </div>
        </nav>
      )}

      {showFaq && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6 no-print">
          <div className="bg-[#151926] w-full max-w-lg rounded-[3rem] border border-white/10 p-8 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black flex items-center gap-3"><HelpCircle className="text-[#D81B60]"/> FAQ & Guide</h3>
                <button onClick={() => setShowFaq(false)} className="p-2 text-white/20 hover:text-white"><X/></button>
             </div>
             <div className="overflow-y-auto space-y-8 pr-2">
                <section className="space-y-3">
                   <h4 className="text-sm font-black uppercase tracking-widest text-[#FFB300] flex items-center gap-2"><Monitor className="w-4 h-4"/> Brug på computer</h4>
                   <p className="text-sm text-white/60 leading-relaxed">Appen er optimeret til computerbrug ved import af regneark. Du kan hente ZIP-arkivet og køre det direkte lokalt for hurtigere drift.</p>
                </section>
                <section className="space-y-3">
                   <h4 className="text-sm font-black uppercase tracking-widest text-[#00BFA5] flex items-center gap-2"><Sparkles className="w-4 h-4"/> Køkkenvagt & Autogen</h4>
                   <p className="text-sm text-white/60 leading-relaxed">Køkkenelever udelukkes automatisk fra alle tjanser og rengøring. Marker dem først, og tryk derefter <span className="text-white font-bold">Gendan Plan</span> for den bedste fordeling.</p>
                </section>
                <section className="space-y-3">
                   <h4 className="text-sm font-black uppercase tracking-widest text-[#1E88E5] flex items-center gap-2"><ArrowRightLeft className="w-4 h-4"/> Swipe for tilmelding</h4>
                   <p className="text-sm text-white/60 leading-relaxed">Swipe et elevkort til højre eller venstre for at melde dem til eller fra weekenden. Dette forhindrer utilsigtede frameldinger.</p>
                </section>
                <section className="space-y-3">
                   <h4 className="text-sm font-black uppercase tracking-widest text-[#FFB300] flex items-center gap-2"><Clock className="w-4 h-4"/> Ur-ikonet (Optaget)</h4>
                   <p className="text-sm text-white/60 leading-relaxed">Det gule ur-ikon betyder, at eleven allerede er tildelt en opgave i planen. Det hjælper dig med at undgå dobbeltbooking ved manuel tildeling.</p>
                </section>
             </div>
             <button onClick={() => setShowFaq(false)} className="mt-8 w-full py-5 bg-white/5 rounded-2xl font-black uppercase text-xs">Luk guide</button>
          </div>
        </div>
      )}

      {showQuickstart && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[500] flex items-center justify-center p-6 no-print">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] border border-white/10 p-8">
            <h3 className="text-2xl font-black text-[#FFB300] mb-6">Kom hurtigt i gang</h3>
            <div className="space-y-6 text-sm text-white/70 leading-relaxed">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-[#FFB300] text-black flex items-center justify-center font-black text-xs shrink-0">1</div>
                <p>Eksportér weekendtilmelding fra Viggo/Elevplan til Excel.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-[#FFB300] text-black flex items-center justify-center font-black text-xs shrink-0">2</div>
                <p>Indlæs filen. Appen fordeler automatisk opgaver til alle tilmeldte.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-[#FFB300] text-black flex items-center justify-center font-black text-xs shrink-0">3</div>
                <p>Husk at markere køkkenelever, så de slipper for andre tjanser.</p>
              </div>
            </div>
            <button onClick={() => setShowQuickstart(false)} className="mt-8 w-full py-5 bg-[#FFB300] text-black rounded-2xl font-black uppercase text-xs">OK</button>
          </div>
        </div>
      )}

      {manualAddSlot && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-6 no-print">
           <div className="bg-[#151926] w-full max-w-md rounded-[3rem] border border-white/10 p-8 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Vælg elev</h3>
                <button onClick={() => setManualAddSlot(null)} className="p-2"><X /></button>
              </div>
              <input type="text" placeholder="Søg..." value={modalSearchTerm} onChange={e=>setModalSearchTerm(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl mb-4 outline-none focus:border-[#00BFA5] transition-all" />
              
              <div className="flex gap-4 px-2 mb-4">
                 <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#FFB300]"/><span className="text-[9px] font-black uppercase text-white/40">Optaget</span></div>
                 <div className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-[#D81B60]"/><span className="text-[9px] font-black uppercase text-white/40">Særlig aftale</span></div>
              </div>

              <div className="overflow-y-auto space-y-2 flex-1">
                 {modalFilteredStudents.map(s => {
                   const busy = isStudentBusy(s.id);
                   const extra = s.needsExtraDuty;
                   return (
                     <button key={s.id} onClick={() => addStudentToSlot(s.id)} className="w-full p-5 bg-white/5 rounded-2xl text-left font-bold flex justify-between items-center hover:bg-[#00BFA5] hover:text-black transition-all group">
                        <div>
                          <p className="leading-tight">{s.firstName} {s.lastName}</p>
                          <span className="text-[10px] font-black uppercase opacity-40 group-hover:opacity-60">{s.house}</span>
                        </div>
                        <div className="flex gap-2">
                           {busy && <Clock className="w-4 h-4 text-[#FFB300]" />}
                           {extra && <AlertTriangle className="w-4 h-4 text-[#D81B60]" />}
                           <Plus className="w-5 h-5 opacity-20 group-hover:opacity-100" />
                        </div>
                     </button>
                   );
                 })}
              </div>
           </div>
        </div>
      )}
      
      {editingStudentLocation && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[400] flex items-center justify-center p-6 no-print">
          <div className="bg-[#151926] w-full max-w-md rounded-[3rem] border border-white/10 p-8 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black">Sovested</h3><button onClick={() => setEditingStudentLocation(null)}><X /></button></div>
             <div className="overflow-y-auto space-y-3 flex-1 pr-2">
                {(() => {
                  const student = students.find(x => x.id === editingStudentLocation);
                  if (!student) return null;
                  return (
                    <>
                      <button onClick={() => setStudentLocation(editingStudentLocation!, `${student.house} - ${student.room}`)} className="w-full p-5 bg-white/5 rounded-2xl text-left font-bold flex items-center gap-4 hover:bg-[#FFB300] hover:text-black transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center group-hover:bg-black/10"><Home/></div>
                        Eget værelse ({student.house} {student.room})
                      </button>
                      
                      <p className="text-[10px] font-black uppercase text-white/20 px-2 mt-4">Fællesområder</p>
                      <div className="grid grid-cols-2 gap-2">
                         {COMMON_SLEEPING_AREAS.map(area => (
                           <button key={area} onClick={() => setStudentLocation(editingStudentLocation!, area)} className="p-4 bg-white/5 rounded-2xl text-left font-bold text-xs flex items-center gap-3 hover:bg-[#D81B60] transition-all"><Bed className="w-4 h-4"/> {area}</button>
                         ))}
                      </div>

                      <div className="pt-6 border-t border-white/10 mt-6 space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-[#00BFA5] mb-2 px-2">Værelser på samme gang ({student.house})</p>
                          <div className="grid grid-cols-1 gap-2">
                             {roomsByHouse[student.house]?.filter(r => r !== `${student.house} - ${student.room}`)?.map(room => (
                               <button key={room} onClick={() => setStudentLocation(editingStudentLocation!, room)} className="w-full p-4 bg-white/5 rounded-xl text-left text-xs font-bold hover:bg-[#00BFA5] hover:text-black transition-all">{room}</button>
                             ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-white/20 mb-2 px-2">Resten af skolen</p>
                          <select 
                            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-[#00BFA5] appearance-none text-sm"
                            onChange={(e) => e.target.value && setStudentLocation(editingStudentLocation!, e.target.value)}
                            value=""
                          >
                            <option value="" disabled className="bg-[#151926]">Vælg andet værelse...</option>
                            {Object.entries(roomsByHouse).filter(([h]) => h !== student.house).map(([house, rooms]) => (
                              <optgroup key={house} label={house} className="bg-[#151926] text-[#FFB300]">
                                {(rooms as string[]).map(room => (
                                  <option key={room} value={room} className="bg-[#151926] text-white p-2">{room}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  );
                })()}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`p-4 rounded-2xl transition-all ${active ? 'text-[#FFB300]' : 'text-white/20'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
  </button>
);

const PrintPage = ({ title, children, pageNum, totalPages }: { title: string, children?: React.ReactNode, pageNum: number, totalPages: number }) => (
  <div className="print-page bg-white p-[10mm] text-black relative min-h-[290mm]">
    <h1 className="text-4xl font-black text-center uppercase tracking-tighter mb-10 border-b-8 border-black pb-4 text-black">{title}</h1>
    {children}
    <div className="absolute bottom-5 left-0 right-0 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
      Wiselist Weekend • Side {pageNum} af {totalPages}
    </div>
  </div>
);

export default App;
