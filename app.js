/* WeekendLister v2 - mobile-first SPA (no icons, no drag/drop)
   Data: localStorage only.
*/
const STORE_KEY = "weekendlister_v2";

const App = {
  state: {
    version: 2,
    students: [], // {id, name, firstName, lastName, house, room}
    flags: {},    // id -> {isPresent, kitchen, leavesSaturday, sundayDinnerOnly, returnedSunday, notes:"", sleep:{fri/sat/sun}}
    houseOrder: [],
    duties: {
      settings: { peoplePerSlot: 2, maxPerStudent: 1, biasFridayForSaturdayLeavers: true },
      assignments: {} // slotId -> [ids]
    },
    reng: {
      sameForSatSun: true,
      settings: { excludeKitchen: true, minLeftPerHouse: 2 },
      needs: {},
      assignments: {}, // area -> [ids]
      hallway: {}      // house -> [ids] (egen gang)
    },
    lastImport: null
  },

  load(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === "object") this.state = {...this.state, ...parsed};
      }
    }catch(e){}
    // defaults for RENG needs
    if(!this.state.reng.needs || Object.keys(this.state.reng.needs).length===0){
      this.state.reng.needs = Defaults.defaultCleaningNeeds();
    }
    this.ensureHouseOrder();
    this.save(false);
  },
  save(updateStatus=true){
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    if(updateStatus) UI.updateStatus();
  },
  reset(){
    localStorage.removeItem(STORE_KEY);
    location.reload();
  },
  ensureHouseOrder(){
    const houses = [...new Set(this.state.students.map(s=>s.house).filter(Boolean))];
    const keep = (this.state.houseOrder||[]).filter(h => houses.includes(h));
    const missing = houses.filter(h => !keep.includes(h)).sort((a,b)=>a.localeCompare(b,"da"));
    this.state.houseOrder = [...keep, ...missing];
  }
};

const Util = {
  norm(s){ return (s??"").toString().trim(); },
  splitName(full){
    const s = Util.norm(full);
    if(!s) return {first:"", last:"", full:""};
    const parts = s.split(/\s+/).filter(Boolean);
    return {first: parts[0]||"", last: parts.slice(1).join(" "), full:s};
  },
  roomKey(room){
    // numeric-aware sort key: prefix + list of numbers
    const r = Util.norm(room);
    const m = r.match(/^([^0-9]*)(.*)$/);
    const prefix = (m?.[1]||"").toLowerCase();
    const tail = m?.[2]||r;
    const nums = (tail.match(/\d+/g)||[]).map(n=>parseInt(n,10));
    return {prefix, nums, raw:r.toLowerCase()};
  },
  cmpRoom(a,b){
    const A = Util.roomKey(a), B = Util.roomKey(b);
    const p = A.prefix.localeCompare(B.prefix,"da"); if(p) return p;
    const n = Math.max(A.nums.length, B.nums.length);
    for(let i=0;i<n;i++){
      const x = A.nums[i] ?? -1;
      const y = B.nums[i] ?? -1;
      if(x!==y) return x-y;
    }
    return A.raw.localeCompare(B.raw,"da");
  },
  cmpName(a,b){
    return (a.firstName||"").localeCompare(b.firstName||"","da")
      || (a.lastName||"").localeCompare(b.lastName||"","da")
      || (a.name||"").localeCompare(b.name||"","da");
  },
  idFromRow(row, idx){
    // stable-enough id: name + house + room + index fallback
    const n = Util.norm(row.name||row.Navn||"");
    const h = Util.norm(row.house||row.StudentHouse||row.Hus||"");
    const r = Util.norm(row.room||row["Værelse"]||row["Vaerelse"]||"");
    const base = (n+"|"+h+"|"+r+"|"+idx).toLowerCase();
    let hash = 0;
    for(let i=0;i<base.length;i++){ hash = ((hash<<5)-hash) + base.charCodeAt(i); hash |= 0; }
    return "s_"+Math.abs(hash);
  },
  byId(id){
    return App.state.students.find(s=>s.id===id);
  },

  sleepLabel(student, day){
    const f = Selectors.flags(student.id);
    const s = (f.sleep||{})[day] || null;
    if(!s || s.type==='own'){
      return { kind:'room', house: student.house||"(ukendt)", room: student.room||"" , label: `${student.house} · ${student.room}` };
    }
    if(s.type==='room'){
      return { kind:'room', house: student.house||"(ukendt)", room: s.room||"", label: `${student.house} · ${s.room||""}` };
    }
    if(s.type==='common'){
      return { kind:'common', label: s.name || "Fællessovning" };
    }
    if(s.type==='manual'){
      return { kind:'manual', label: s.text || "Andet" };
    }
    return { kind:'manual', label: "Andet" };
  }
};

const Defaults = {
  houses(){
    return ["Komponisten","Tankegangen","Mellemtiden","Vest","Øst","Treenigheden","Arken","Rebild","Sibelius","Einstein"];
  },
  defaultCleaningNeeds(){
    // Default values (editable in UI). Based on typical practice; can be tuned by teachers.
    return {
      "Arken": 2,
      "Den lange gang": 3,
      "Gangene i treenigheden (MT og Gimle)": 2,
      "Biografen": 1,
      "Kunst": 1,
      "Klassefløjen + toiletter": 4,
      "Toiletter i hallen - Alle": 3,
      "Toiletter på den lange gang": 2,
      "Gangen ved TG og Kompo": 1,
      "Gymnastiksalen": 3,
      "Hallen": 2
    };
  },
  commonSleepPlaces(){
    return ["Teltet","Shelteret","Gymnastiksalen","Medie","Biografen"];
  },

  dutySlots(){
    const mk=(id,label)=>({id,label});
    return [
      mk("fri_after_dinner","Fre: Efter aftensmad"),
      mk("fri_evening_before","Fre: Aftenservering (før)"),
      mk("fri_evening_after","Fre: Aftenservering (efter)"),
      mk("sat_moko_before","Lør: Mokost (før)"),
      mk("sat_moko_after","Lør: Mokost (efter)"),
      mk("sat_afternoon_before","Lør: Eftermiddagsservering (før)"),
      mk("sat_afternoon_after","Lør: Eftermiddagsservering (efter)"),
      mk("sat_before_dinner","Lør: Før aftensmad"),
      mk("sat_after_dinner","Lør: Efter aftensmad"),
      mk("sat_evening_before","Lør: Aftenservering (før)"),
      mk("sat_evening_after","Lør: Aftenservering (efter)"),
      mk("sun_moko_before","Søn: Mokost (før)"),
      mk("sun_moko_after","Søn: Mokost (efter)"),
      mk("sun_afternoon_before","Søn: Eftermiddagsservering (før)"),
      mk("sun_afternoon_after","Søn: Eftermiddagsservering (efter)"),
      mk("sun_before_dinner","Søn: Før aftensmad"),
      mk("sun_after_dinner","Søn: Efter aftensmad"),
      mk("sun_evening_before","Søn: Aftenservering (før)"),
      mk("sun_evening_after","Søn: Aftenservering (efter)")
    ];
  }
};

const Selectors = {
  flags(id){
    return App.state.flags[id] || (App.state.flags[id] = {
      isPresent:false, kitchen:false, leavesSaturday:false, sundayDinnerOnly:false,
      returnedSunday:false, notes:"", sleep:{fri:null,sat:null,sun:null}
    });
  },
  weekendStudents(){
    return App.state.students.filter(s => Selectors.flags(s.id).isPresent);
  },
  eligibleForWork(){
    // for duties + reng: present AND not kitchen
    return App.state.students.filter(s => {
      const f = Selectors.flags(s.id);
      return f.isPresent && !f.kitchen;
    });
  },
  houses(){
    return App.state.houseOrder || [];
  }
};

const Importer = {
  async handleFile(file){
    if(!file) return;
    const name = (file.name||"").toLowerCase();
    if(name.endsWith(".csv")){
      const text = await file.text();
      Importer.fromCSV(text, file.name);
      return;
    }
    const buf = await file.arrayBuffer();
    Importer.fromXLSX(buf, file.name);
  },
  loadFile(file){ return Importer.handleFile(file); },

  fromXLSX(buf, filename){
    const wb = XLSX.read(buf, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:""});
    Importer.ingestRows(rows, filename);
  },

  fromCSV(text, filename){
    const lines = text.replace(/\r/g,"").split("\n").filter(Boolean);
    const header = lines[0].split(",").map(s=>s.trim());
    const rows = [];
    for(let i=1;i<lines.length;i++){
      const cols = lines[i].split(",");
      const r = {};
      header.forEach((h,idx)=> r[h] = (cols[idx] ?? "").trim());
      rows.push(r);
    }
    Importer.ingestRows(rows, filename);
  },

  ingestRows(rows, filename){
    const students = [];
    const flags = {};
    for(let i=0;i<rows.length;i++){
      const r = rows[i] || {};
      const full = Util.norm(r.Navn || r.name || (Util.norm(r.Fornavn)+" "+Util.norm(r.Efternavn)));
      if(!full) continue;

      const house = Util.norm(r.StudentHouse || r.Hus || r.Gang || r.house);
      const room = Util.norm(r["Værelse"] || r["Vaerelse"] || r.room);

      const id = Util.idFromRow({name:full,house,room}, i);
      const nm = Util.splitName(full);

      students.push({ id, name:nm.full, firstName:nm.first, lastName:nm.last, house, room });

      // Weekend status from ViGGO style
      const ans = Util.norm(r["Hvor er du i weekenden? (6087)"] || r["Hvor er du i weekenden?"] || r.Weekend || r.weekend || "");
      const isHU = ans.toLowerCase().includes("hu");
      const leavesSat = ans.toLowerCase().includes("lørdag");
      const sundayDinnerOnly = ans.toLowerCase().includes("søndag") && !isHU;

      flags[id] = {
        isPresent: isHU,
        kitchen: false,
        leavesSaturday: leavesSat && isHU,
        sundayDinnerOnly,
        returnedSunday: isHU, // already on campus
        notes: "",
        sleep: {fri:null,sat:null,sun:null}
      };
    }

    App.state.students = students;
    App.state.flags = flags;
    App.state.lastImport = { filename, ts: new Date().toISOString() };
    App.ensureHouseOrder();
    // clear generated plans (safe)
    App.state.duties.assignments = {};
    App.state.reng.assignments = {};
    App.state.reng.hallway = {};
    App.save();
    UI.show("weekend");
  }
};

const Demo = {
  load(){
    const houses = Defaults.houses();
    const firstNames = ["Asta","Bo","Cille","Dani","Elias","Freja","Hannah","Ida","Johan","Klara","Liva","Marcus","Noah","Olivia","Signe","Viktor","Villiam","Zara","Åse","Øyvind"];
    const lastNames  = ["Holm","Jensen","Larsen","Mikkelsen","Nørgaard","Poulsen","Rasmussen","Sørensen","Kristensen","Pedersen","Andersen","Mortensen","Hansen","Olsen","Thomsen"];
    const students = [];
    const flags = {};
    for(let i=1;i<=150;i++){
      const house = houses[(i-1)%houses.length];
      const roomNum = (i%20)+1;
      const full = firstNames[i%firstNames.length]+" "+lastNames[(i*3)%lastNames.length];
      const nm = Util.splitName(full);
      const id = "demo_"+i;

      students.push({ id, name:nm.full, firstName:nm.first, lastName:nm.last, house, room:String(roomNum) });

      const present = Math.random() < 0.60;
      const kitchen = present && (Math.random() < 0.12);
      const leavesSat = present && !kitchen && (Math.random() < 0.12);
      const sundayDinnerOnly = !present && (Math.random() < 0.08);

      flags[id] = {
        isPresent: present,
        kitchen,
        leavesSaturday: leavesSat,
        sundayDinnerOnly,
        returnedSunday: present,
        notes: "",
        sleep: {fri:null,sat:null,sun:null}
      };
    }
    App.state.students = students;
    App.state.flags = flags;
    App.state.lastImport = { filename:"DEMO", ts:new Date().toISOString() };
    App.state.reng.needs = Defaults.defaultCleaningNeeds();
    App.ensureHouseOrder();
    App.state.duties.assignments = {};
    App.state.reng.assignments = {};
    App.state.reng.hallway = {};
    App.save();
    UI.show("weekend");
  }
};

const Duties = {
  generate(){
    const slots = Defaults.dutySlots();
    const peoplePerSlot = Number(App.state.duties.settings.peoplePerSlot || 2);
    const maxPer = Number(App.state.duties.settings.maxPerStudent || 1);
    const bias = !!App.state.duties.settings.biasFridayForSaturdayLeavers;

    const pool = Selectors.eligibleForWork().slice();
    // track assigned counts
    const cnt = new Map(pool.map(s => [s.id, 0]));
    const pickWeighted = (candidates) => {
      // weighted random among candidates, prefer lower count, and optionally bias friday for leavesSaturday
      const weights = [];
      let total = 0;
      for(const s of candidates){
        const c = cnt.get(s.id) || 0;
        if(c >= maxPer) continue;
        let w = 1;
        // prefer those with fewer assignments
        w *= (maxPer - c);
        weights.push([s, w]);
        total += w;
      }
      if(total <= 0) return null;
      let r = Math.random() * total;
      for(const [s,w] of weights){
        r -= w;
        if(r <= 0) return s;
      }
      return weights[weights.length-1]?.[0] || null;
    };

    const assignments = {};
    for(const slot of slots){
      const isFriday = slot.id.startsWith("fri_");
      assignments[slot.id] = [];
      for(let k=0;k<peoplePerSlot;k++){
        // build candidate list
        let candidates = pool.filter(s => (cnt.get(s.id)||0) < maxPer);
        if(isFriday && bias){
          // bias: duplicate candidates who leave saturday
          const extra = [];
          for(const s of candidates){
            const f = Selectors.flags(s.id);
            if(f.leavesSaturday) extra.push(s, s); // +2 weight
          }
          candidates = candidates.concat(extra);
        }
        const picked = pickWeighted(candidates);
        if(!picked) break;
        assignments[slot.id].push(picked.id);
        cnt.set(picked.id, (cnt.get(picked.id)||0)+1);
      }
    }
    App.state.duties.assignments = assignments;
    App.save();
  }
};

const Reng = {
  generate(){
    const needs = App.state.reng.needs || {};
    const minLeft = Number(App.state.reng.settings?.minLeftPerHouse ?? 2);

    // Eligible = weekend-present AND not kitchen
    const eligible = Selectors.eligibleForWork().slice();

    // Build per-house pools
    const byHouse = new Map();
    for(const s of eligible){
      const h = s.house || "(ukendt)";
      if(!byHouse.has(h)) byHouse.set(h, []);
      byHouse.get(h).push(s);
    }

    // Stable shuffle within each house (fairness)
    for(const [h, arr] of byHouse.entries()){
      arr.sort((a,b)=> Util.cmpName(a,b));
      for(let i=arr.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    // Areas sorted by need desc
    const areas = Object.keys(needs).map(name => ({name, n:Number(needs[name]||0)}))
      .filter(a => a.n > 0)
      .sort((a,b)=> b.n - a.n || a.name.localeCompare(b.name,"da"));

    const assignments = {};
    const used = new Set();

    // Helper: pick next student from any house that can spare one (keeping minLeft)
    const pickNext = () => {
      const candidates = [];
      for(const [h, arr] of byHouse.entries()){
        const remaining = arr.filter(s => !used.has(s.id)).length;
        if(remaining > minLeft){
          candidates.push(h);
        }
      }
      if(!candidates.length) return null;

      // Prefer houses with most remaining
      candidates.sort((ha,hb)=>{
        const ra = byHouse.get(ha).filter(s=>!used.has(s.id)).length;
        const rb = byHouse.get(hb).filter(s=>!used.has(s.id)).length;
        return rb-ra || ha.localeCompare(hb,"da");
      });

      for(const h of candidates){
        const arr = byHouse.get(h);
        const next = arr.find(s => !used.has(s.id));
        if(next) return next;
      }
      return null;
    };

    // Fill common areas with constraint
    for(const area of areas){
      assignments[area.name] = [];
      for(let i=0;i<area.n;i++){
        const next = pickNext();
        if(!next) break;
        used.add(next.id);
        assignments[area.name].push(next.id);
      }
    }

    // Remaining eligible students become "egen gang" per house
    const hallway = {};
    for(const [h, arr] of byHouse.entries()){
      const remaining = arr.filter(s => !used.has(s.id));
      hallway[h] = remaining.map(s=>s.id);
    }

    App.state.reng.assignments = assignments;
    App.state.reng.hallway = hallway;
    App.save();
  }
};

const UI = {
  show(tab){
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const target = document.getElementById(tab);
    if(target) target.classList.add("active");

    // nav buttons
    document.querySelectorAll(".navbtn").forEach(b => b.classList.toggle("active", b.dataset.tab===tab));

    // render on demand
    if(tab==="data") UI.renderData();
    if(tab==="weekend") UI.renderWeekend();
    if(tab==="runder") UI.renderRunder();
    if(tab==="duties") UI.renderDuties();
    if(tab==="reng") UI.renderReng();
    if(tab==="brand") UI.renderBrand();
    if(tab==="print") UI.renderPrint();
    if(tab==="sunday") UI.renderSunday();

    UI.updateStatus();
  },

  
  renderData(){
    const el = document.getElementById("data");
    const li = App.state.lastImport;
    const last = li ? `${li.filename} • ${new Date(li.ts).toLocaleString("da-DK")}` : "—";

    el.innerHTML = `
      <div class="card">
        <div class="dropzone">
          <div class="dzTitle">Indlæs elevdata</div>
          <div class="small">Hent en Excel-fil fra administrationssystemet (eller brug demo til at teste).</div>
          <div style="margin-top:14px;">
            <label class="dzBtn">
              Vælg Excel-fil
              <input type="file" id="fileInput2" accept=".xlsx,.xls,.csv" style="display:none">
            </label>
          </div>
          <div class="small" style="margin-top:12px;">Sidst indlæst: <b>${last}</b></div>
        </div>

        <div class="smallBtnRow">
          <button class="btn" onclick="Demo.load();UI.show('data')">Indlæs demo</button>
          <button class="btn" onclick="Backup.export()">Eksport backup</button>
          <button class="btn" onclick="Backup.import()">Import backup</button>
        </div>

        <div class="hr"></div>
        <button class="btn danger" style="width:100%;border-radius:18px;padding:14px 12px;font-weight:900" onclick="App.reset()">Nulstil alt</button>
      </div>
    `;

    const inp = document.getElementById("fileInput2");
    inp.addEventListener("change", async (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      await Importer.loadFile(file);
      UI.show('weekend');
    });
  },

  renderRunder(){
    // existing runder view is named "reng/brand" only in this build; we map to Brand for now if missing
    const el = document.getElementById("runder");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }
    // Use existing Brand grouping as a 'runder light' overview: by house with expand.
    const day = App.state._roundDay || "fri";
    const dayLabel = day==="fri"?"Fredag":(day==="sat"?"Lørdag":"Søndag");
    const list = Selectors.weekendStudents();
    const byHouse = new Map();
    for(const s of list){
      if(!byHouse.has(s.house)) byHouse.set(s.house, []);
      byHouse.get(s.house).push(s);
    }
    const order = App.state.houseOrder || [...byHouse.keys()].sort((a,b)=>a.localeCompare(b,'da'));
    el.innerHTML = `
      <div class="card">
        <div style="font-weight:900;letter-spacing:.06em;text-transform:uppercase;">Runder</div>
        <div class="small">Fold et område ud for at se elever sorteret efter værelse. Brug Brand til at flytte sovested.</div>
        <div class="dayPills">
          <button class="${day==="fri"?"active":""}" onclick="App.state._roundDay='fri';App.save(false);UI.renderRunder()">Fredag</button>
          <button class="${day==="sat"?"active":""}" onclick="App.state._roundDay='sat';App.save(false);UI.renderRunder()">Lørdag</button>
          <button class="${day==="sun"?"active":""}" onclick="App.state._roundDay='sun';App.save(false);UI.renderRunder()">Søndag</button>
        </div>
        <div class="badge" style="margin-top:10px;">Visning: ${dayLabel}</div>
      </div>
    `;
    for(const h of order){
      const arr = (byHouse.get(h)||[]).slice().sort((a,b)=>Util.cmpRoom(a.room,b.room) || Util.cmpName(a,b));
      const open = !!(App.state._openHouse && App.state._openHouse===h);
      el.innerHTML += `
        <div class="card">
          <div class="row" style="justify-content:space-between;align-items:center;">
            <div style="font-weight:900">${h} <span class="badge">${arr.length}</span></div>
            <button class="btn" onclick="App.state._openHouse=(App.state._openHouse===${JSON.stringify(h)}?null:${JSON.stringify(h)});App.save(false);UI.renderRunder()">${open?'Skjul':'Vis'}</button>
          </div>
          ${open ? `<div style="margin-top:10px;">
            ${arr.map(s=>`<div class="student" style="margin:8px 0;">
              <div style="flex:1"><b>${s.name}</b><div class="meta">${s.house} · ${s.room}</div></div>
              <button class="btn" onclick="UI.show('brand');setTimeout(()=>{document.getElementById('brand')?.scrollIntoView({behavior:'smooth',block:'start'})},50)">Sovested</button>
            </div>`).join('')}
          </div>`:''}
        </div>
      `;
    }
  },

  renderPrint(){
    const el = document.getElementById("print");
    const week = App.state.weekNumber || "";
    const day = App.state._printDay || "fri";
    const dayLabel = day==="fri"?"Fredag":(day==="sat"?"Lørdag":"Søndag");
    el.innerHTML = `
      <div class="card">
        <div style="font-weight:900;letter-spacing:.06em;text-transform:uppercase;font-size:22px;">Print</div>

        <div style="margin-top:14px;">
          <input class="weekInput" placeholder="Uge nummer" value="${String(week).replaceAll('"','&quot;')}"
            oninput="App.state.weekNumber=this.value.replace(/\D/g,'');App.save(false)">
        </div>

        <div class="dayPills">
          <button class="${day==="fri"?"active":""}" onclick="App.state._printDay='fri';App.save(false);UI.renderPrint()">Fredag</button>
          <button class="${day==="sat"?"active":""}" onclick="App.state._printDay='sat';App.save(false);UI.renderPrint()">Lørdag</button>
          <button class="${day==="sun"?"active":""}" onclick="App.state._printDay='sun';App.save(false);UI.renderPrint()">Søndag</button>
        </div>

        <div class="bigActionRow" style="margin-top:16px;">
          <div class="bigAction" style="background:rgba(255,193,7,.96);color:#0b0f15;" onclick="Print.print({mode:'duties', day:'${day}'})">
            <div>
              TJANSER
              <div class="subline">Dag: ${dayLabel} • optimeret til A4</div>
            </div>
            <div>🍴</div>
          </div>

          <div class="bigAction" style="background:rgba(217,30,102,.92);color:#fff;" onclick="Print.print({mode:'brand', day:'${day}'})">
            <div>
              BRANDLISTER (${dayLabel.toUpperCase()})
              <div class="subline">Sovesteder + optælling</div>
            </div>
            <div>🔥</div>
          </div>

          <div class="bigAction" style="background:rgba(0,230,200,.92);color:#071016;" onclick="Print.print({mode:'sunday'})">
            <div>
              SØNDAGSLISTE
              <div class="subline">3 kolonner med afkrydsning</div>
            </div>
            <div>✅</div>
          </div>
        </div>
      </div>
    `;
  },

updateStatus(){
    const total = App.state.students.length;
    const present = Selectors.weekendStudents().length;
    const kitchen = App.state.students.filter(s => Selectors.flags(s.id).kitchen).length;
    const line = total
      ? `Elever: ${total} • Weekend: ${present} • Køkken: ${kitchen}`
      : "Ingen data (indlæs demo eller importér Excel)";
    const el = document.getElementById("statusLine");
    if(el) el.textContent = line;
  },

  renderWeekend(){
    const el = document.getElementById("weekend");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }

    const q = (App.state._qWeekend || "");
    el.innerHTML = `
      <div class="card">
        <div class="row">
          <input type="text" placeholder="Filtrér: navn / hus / værelse" value="${q.replaceAll('"','&quot;')}"
            oninput="App.state._qWeekend=this.value;App.save(false);UI.renderWeekend()">
          <select onchange="App.state._filterDuty=this.value;App.save(false);UI.renderWeekend()">
            <option value="">Alle</option>
            <option value="hasDuty" ${App.state._filterDuty==='hasDuty'?'selected':''}>Har tjans</option>
            <option value="noDuty" ${App.state._filterDuty==='noDuty'?'selected':''}>Ingen tjans</option>
          </select>
        </div>
        <div class="small">Viser kun elever på skolen i weekenden. Køkkenelever springes over i auto-fordeling.</div>
      </div>
    `;

    const dutySet = new Set();
    const dutyAssignments = App.state.duties.assignments || {};
    Object.values(dutyAssignments).forEach(arr => (arr||[]).forEach(id => dutySet.add(id)));

    let list = Selectors.weekendStudents().slice();
    // default: fornavn
    list.sort((a,b)=> Util.cmpName(a,b));

    // filter
    const qq = q.trim().toLowerCase();
    if(qq){
      list = list.filter(s => (s.name+" "+s.house+" "+s.room).toLowerCase().includes(qq));
    }
    const fd = App.state._filterDuty;
    if(fd==="hasDuty") list = list.filter(s => dutySet.has(s.id));
    if(fd==="noDuty") list = list.filter(s => !dutySet.has(s.id));

    // render
    for(const s of list){
      const f = Selectors.flags(s.id);
      const finished = dutySet.has(s.id) || (f.kitchen) || (App.state.reng && Object.values(App.state.reng).some(a=>Array.isArray(a)&&a.includes(s.id)));
      const badges = [
        f.kitchen ? '<span class="badge">KØKKEN</span>' : '',
        f.leavesSaturday ? '<span class="badge">Hjem lør</span>' : '',
      ].join(" ");
      el.innerHTML += `
        <div class="student ${finished?'finished':''}">
          <div>
            <div><b>${s.firstName || s.name}</b> ${s.lastName?`<span class="small">${s.lastName}</span>`:""}</div>
            <div class="meta">${s.house} · ${s.room} ${badges}</div>
          </div>
          <div class="toggles">
            <label class="toggle"><span>Weekend</span>
              <input type="checkbox" ${f.isPresent?'checked':''} onchange="UI.togglePresent('${s.id}', this.checked)">
            </label>
            <label class="toggle"><span>Køkken</span>
              <input type="checkbox" ${f.kitchen?'checked':''} onchange="UI.toggleKitchen('${s.id}', this.checked)">
            </label>
            <label class="toggle"><span>Hjem lør</span>
              <input type="checkbox" ${f.leavesSaturday?'checked':''} onchange="UI.toggleLeavesSat('${s.id}', this.checked)">
            </label>
          </div>
        </div>
      `;
    }
  },

  togglePresent(id, v){
    const f = Selectors.flags(id);
    f.isPresent = !!v;
    if(f.isPresent) f.returnedSunday = true;
    // when toggling off, also clear duties/reng assignments for cleanliness (regen recommended)
    App.save();
    UI.renderWeekend();
  },
  toggleKitchen(id, v){
    const f = Selectors.flags(id);
    f.kitchen = !!v;
    App.save();
    UI.renderWeekend();
  },
  toggleLeavesSat(id, v){
    const f = Selectors.flags(id);
    f.leavesSaturday = !!v;
    App.save();
    UI.renderWeekend();
  },

  renderSunday(){
    const el = document.getElementById("sunday");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }
    const q = (App.state._qSunday || "");
    el.innerHTML = `
      <div class="card">
        <div class="row">
          <input type="text" placeholder="Filtrér navn" value="${q.replaceAll('"','&quot;')}"
            oninput="App.state._qSunday=this.value;App.save(false);UI.renderSunday()">
        </div>
        <div class="small">Alle elever. Markér hvem der er kommet tilbage. Weekend-elever er allerede “tilbage”.</div>
      </div>
    `;

    let list = App.state.students.slice().sort((a,b)=> Util.cmpName(a,b));
    const qq = q.trim().toLowerCase();
    if(qq) list = list.filter(s => s.name.toLowerCase().includes(qq) || (s.firstName||"").toLowerCase().includes(qq));

    // 3-column layout suggestion in-app (print handles as table)
    for(const s of list){
      const f = Selectors.flags(s.id);
      const label = f.isPresent ? "På skolen" : (f.sundayDinnerOnly ? "Søn aften" : "");
      el.innerHTML += `
        <div class="student ${finished?'finished':''}">
          <div>
            <div><b>${s.firstName || s.name}</b> ${s.lastName?`<span class="small">${s.lastName}</span>`:""}</div>
            <div class="meta">${label}</div>
          </div>
          <div class="toggles">
            <label class="toggle"><span>Tilbage</span>
              <input type="checkbox" ${f.returnedSunday?'checked':''} onchange="UI.toggleReturned('${s.id}', this.checked)">
            </label>
          </div>
        </div>
      `;
    }
  },

  toggleReturned(id, v){
    const f = Selectors.flags(id);
    f.returnedSunday = !!v;
    App.save(false);
  },

  renderDuties(){
    const el = document.getElementById("duties");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }
    const s = App.state.duties.settings;
    el.innerHTML = `
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">Tjanser</div>
        <div class="row">
          <div style="flex:1">
            <div class="small">Elever pr. tjans</div>
            <input type="number" min="1" max="6" value="${s.peoplePerSlot}" onchange="App.state.duties.settings.peoplePerSlot=Number(this.value||2);App.save(false)">
          </div>
          <div style="flex:1">
            <div class="small">Max pr elev</div>
            <input type="number" min="1" max="5" value="${s.maxPerStudent}" onchange="App.state.duties.settings.maxPerStudent=Number(this.value||1);App.save(false)">
          </div>
        </div>
        <div class="row" style="margin-top:8px;">
          <label class="toggle" style="align-items:center">
            <input type="checkbox" ${s.biasFridayForSaturdayLeavers?'checked':''} onchange="App.state.duties.settings.biasFridayForSaturdayLeavers=this.checked;App.save(false)">
            <span>Bias: hjem lørdag → fredag</span>
          </label>
          <button class="btn" onclick="Duties.generate();UI.renderDuties()">Generér</button>
        </div>
        <div class="small">Køkkenelever er automatisk udelukket.</div>
      </div>
    `;

    const slots = Defaults.dutySlots();
    const A = App.state.duties.assignments || {};
    for(const slot of slots){
      const ids = A[slot.id] || [];
      const names = ids.map(id => Util.byId(id)?.name).filter(Boolean).join(", ") || "—";
      el.innerHTML += `
        <div class="card">
          <div style="font-weight:800">${slot.label}</div>
          <div class="small">${names}</div>
        </div>
      `;
    }
  },

  renderReng(){
    const el = document.getElementById("reng");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }

    const eligible = Selectors.eligibleForWork().length;
    const present = Selectors.weekendStudents().length;
    const kitchen = App.state.students.filter(s => Selectors.flags(s.id).kitchen && Selectors.flags(s.id).isPresent).length;

    el.innerHTML = `
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">RENG (lør + søn)</div>
        <div class="small">Som udgangspunkt har de samme elever de samme områder både lørdag og søndag.</div>
        <div class="pair" style="margin-top:8px;">
          <span class="pill">Weekend: ${present}</span>
          <span class="pill">Køkken (udelukket): ${kitchen}</span>
          <span class="pill">Til RENG: ${eligible}</span>
        </div>

        <div class="hr"></div>

        <div class="row">
          <div style="flex:1">
            <div class="small">Min. tilbage pr gang</div>
            <input type="number" min="0" max="10" value="${App.state.reng.settings.minLeftPerHouse ?? 2}"
              onchange="App.state.reng.settings.minLeftPerHouse=Number(this.value||2);App.save(false)">
          </div>
          <div style="flex:1">
            <div class="small">Plan</div>
            <div class="badge">Samme for lør + søn</div>
          </div>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn" onclick="Reng.generate();UI.renderReng()">Generér rengøring</button>
          <button class="btn danger" onclick="App.state.reng.assignments={};App.state.reng.hallway={};App.save();UI.renderReng()">Ryd</button>
        </div>
        <div class="small" style="margin-top:6px;">Auto-fordeling bemander fællesområder først og efterlader mindst <b>${App.state.reng.settings.minLeftPerHouse ?? 2}</b> elever pr. gang til “egen gang”.</div>
      </div>
    `;

    // needs editor
    const needs = App.state.reng.needs || {};
    const areaNames = Object.keys(needs).sort((a,b)=>a.localeCompare(b,"da"));
    el.innerHTML += `<div class="card"><div style="font-weight:800;margin-bottom:8px;">Områder & behov</div></div>`;
    for(const name of areaNames){
      const val = Number(needs[name]||0);
      el.innerHTML += `
        <div class="areaRow">
          <div>
            <div class="name">${name}</div>
          </div>
          <div>
            <input type="number" min="0" max="20" value="${val}" onchange="App.state.reng.needs['${name.replaceAll("'","\'")}']=Number(this.value||0);App.save(false)">
          </div>
        </div>
      `;
    }

    // assignments
    const A = App.state.reng.assignments || {};
    el.innerHTML += `<div class="card"><div style="font-weight:800;margin-bottom:8px;">Fordeling</div><div class="small">“ALLE ANDRE HAR EGEN GANG” kan håndteres som separat overblik i appen (ikke på fælleslisten).</div></div>`;
    for(const name of areaNames){
      const ids = A[name] || [];
      const names = ids.map(id => Util.byId(id)?.name).filter(Boolean).join(", ") || "—";
      el.innerHTML += `
        <div class="card">
          <div style="font-weight:800">${name}</div>
          <div class="small">${names}</div>
        </div>
      `;
    }
    // "Egen gang" overview (remaining students per house)
    const H = App.state.reng.hallway || {};
    el.innerHTML += `<div class="card"><div style="font-weight:800;margin-bottom:8px;">Egen gang (rester pr. gang)</div>
      <div class="small">Disse elever er tilbage på deres egne gange, efter at fællesområderne er bemandet.</div></div>`;
    const houses = (App.state.houseOrder||[]).slice();
    Object.keys(H).forEach(h=>{ if(!houses.includes(h)) houses.push(h); });
    for(const h of houses){
      const ids = H[h] || [];
      if(!ids.length) continue;
      const names = ids.map(id=>Util.byId(id)?.name).filter(Boolean).join(", ");
      el.innerHTML += `<div class="card"><div style="font-weight:800">${h} <span class="badge">${ids.length}</span></div>
        <div class="small">${names}</div></div>`;
    }

  },

  renderBrand(){
    const el = document.getElementById("brand");
    if(!App.state.students.length){
      el.innerHTML = UI.emptyState();
      return;
    }

    const day = App.state._brandDay || "fri";
    const dayLabel = day==="fri" ? "Fredag" : (day==="sat" ? "Lørdag" : "Søndag");
    const weekend = Selectors.weekendStudents().slice().sort((a,b)=> Util.cmpName(a,b));

    // Group by actual sleep place for selected day
    const groups = new Map();
    for(const s of weekend){
      const loc = Util.sleepLabel(s, day);
      const key = loc.label;
      if(!groups.has(key)) groups.set(key, {loc, students: []});
      groups.get(key).students.push(s);
    }

    const houseIndex = new Map((App.state.houseOrder||[]).map((h,i)=>[h,i]));
    const entries = [...groups.values()].sort((A,B)=>{
      const a=A.loc, b=B.loc;
      if(a.kind==='room' && b.kind==='room'){
        const ia = houseIndex.get(a.house) ?? 999;
        const ib = houseIndex.get(b.house) ?? 999;
        return ia-ib || Util.cmpRoom(a.room,b.room);
      }
      if(a.kind==='room') return -1;
      if(b.kind==='room') return 1;
      return a.label.localeCompare(b.label,"da");
    });

    el.innerHTML = `
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">Brandliste</div>
        <div class="small">Vælg dag og redigér sovested. Standard er elevens eget hus/værelse.</div>
        <div class="row" style="margin-top:10px;">
          <select onchange="App.state._brandDay=this.value;App.save(false);UI.renderBrand()">
            <option value="fri" ${day==="fri"?"selected":""}>Fredag</option>
            <option value="sat" ${day==="sat"?"selected":""}>Lørdag</option>
            <option value="sun" ${day==="sun"?"selected":""}>Søndag</option>
          </select>
          <button class="btn danger" onclick="UI.clearSleepDay('${day}');UI.renderBrand()">Nulstil dag</button>
        </div>
        <div class="badge" style="margin-top:8px;">Sovesteder for: ${dayLabel}</div>
      </div>
    `;

    // Simple overview (brandmand-venlig)
    for(const g of entries){
      const names = g.students.slice().sort((a,b)=>Util.cmpName(a,b)).map(s=>s.name).join(", ");
      el.innerHTML += `
        <div class="card">
          <div style="font-weight:800">${g.loc.label} <span class="badge">${g.students.length}</span></div>
          <div class="small">${names || "—"}</div>
        </div>
      `;
    }

    // Editor section
    el.innerHTML += `
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">Redigér sovested (${dayLabel})</div>
        <div class="small">Vælg “Andet værelse” (på samme gang), “Fællessovning” eller fri tekst. Ændringer slår igennem i overblikket og på print.</div>
      </div>
    `;

    const common = Defaults.commonSleepPlaces();
    for(const s of weekend){
      const f = Selectors.flags(s.id);
      const cur = Util.sleepLabel(s, day).label;

      const st = (f.sleep||{})[day] || null;
      const currentType = st?.type || "own";
      const currentRoom = st?.room || "";
      const currentCommon = st?.name || common[0];
      const currentManual = st?.text || "";

      const safe = (x)=> String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

      el.innerHTML += `
        <div class="student">
          <div style="flex:1;min-width:180px">
            <div><b>${safe(s.name)}</b></div>
            <div class="meta">${safe(s.house)} · ${safe(s.room)} <span class="badge">nu: ${safe(cur)}</span></div>
          </div>
          <div style="flex:1;min-width:160px">
            <select onchange="UI.setSleepType('${s.id}','${day}', this.value);UI.renderBrand()">
              <option value="own" ${currentType==="own"?"selected":""}>Eget værelse</option>
              <option value="room" ${currentType==="room"?"selected":""}>Andet værelse</option>
              <option value="common" ${currentType==="common"?"selected":""}>Fællessovning</option>
              <option value="manual" ${currentType==="manual"?"selected":""}>Andet (tekst)</option>
            </select>

            ${currentType==="room" ? `
              <div style="margin-top:6px">
                <input type="text" placeholder="Værelse" value="${safe(currentRoom)}"
                  oninput="UI.setSleepRoom('${s.id}','${day}', this.value)">
              </div>` : ""}

            ${currentType==="common" ? `
              <div style="margin-top:6px">
                <select onchange="UI.setSleepCommon('${s.id}','${day}', this.value)">
                  ${common.map(x=>`<option value="${safe(x)}" ${x===currentCommon?"selected":""}>${safe(x)}</option>`).join("")}
                </select>
              </div>` : ""}

            ${currentType==="manual" ? `
              <div style="margin-top:6px">
                <input type="text" placeholder="Sovested (fri tekst)" value="${safe(currentManual)}"
                  oninput="UI.setSleepManual('${s.id}','${day}', this.value)">
              </div>` : ""}
          </div>
        </div>
      `;
    }
  },

  clearSleepDay(day){
    for(const s of Selectors.weekendStudents()){
      const f = Selectors.flags(s.id);
      f.sleep = f.sleep || {fri:null,sat:null,sun:null};
      f.sleep[day] = null;
    }
    App.save();
    UI.renderBrand();
  },

  setSleepType(id, day, type){
    const f = Selectors.flags(id);
    f.sleep = f.sleep || {fri:null,sat:null,sun:null};
    if(type==="own"){ f.sleep[day] = null; }
    else if(type==="room"){ f.sleep[day] = {type:"room", room:""}; }
    else if(type==="common"){ f.sleep[day] = {type:"common", name: Defaults.commonSleepPlaces()[0]}; }
    else if(type==="manual"){ f.sleep[day] = {type:"manual", text:""}; }
    App.save(false);
  },
  setSleepRoom(id, day, room){
    const f = Selectors.flags(id);
    f.sleep = f.sleep || {fri:null,sat:null,sun:null};
    f.sleep[day] = {type:"room", room: String(room||"").trim()};
    App.save(false);
  },
  setSleepCommon(id, day, name){
    const f = Selectors.flags(id);
    f.sleep = f.sleep || {fri:null,sat:null,sun:null};
    f.sleep[day] = {type:"common", name};
    App.save(false);
  },
  setSleepManual(id, day, text){
    const f = Selectors.flags(id);
    f.sleep = f.sleep || {fri:null,sat:null,sun:null};
    f.sleep[day] = {type:"manual", text: String(text||"").trim()};
    App.save(false);
  },

  openHelp(){
    const m = document.getElementById("helpModal");
    m.classList.remove("hidden");
    m.onclick = (e)=>{ if(e.target===m) UI.closeHelp(); };
  },
  closeHelp(){
    const m = document.getElementById("helpModal");
    m.classList.add("hidden");
  },
  emptyState(){
    return `
      <div class="card">
        <div style="font-weight:800;margin-bottom:6px;">Ingen data endnu</div>
        <div class="small">Tryk <b>Indlæs demo</b> eller importér Excel/CSV under <b>Data</b>.</div>
      </div>
    `;
  }

};

const Print = {
  print(opts={}){
    if(!App.state.students.length){
      alert("Indlæs demo eller importér data først.");
      return;
    }
    Print.build();
    window.print();
  },
  build(opts={}){
    const mode = opts.mode || 'all';
    const day = opts.day || 'fri';
    const weekNo = App.state.weekNumber || '';
    const area = document.getElementById("printArea");
    const total = App.state.students.length;
    const present = Selectors.weekendStudents().length;

    // Weekend roster: house order -> room -> name
    const w = Selectors.weekendStudents().slice();
    const idx = new Map((App.state.houseOrder||[]).map((h,i)=>[h,i]));
    w.sort((a,b)=>{
      const ia = idx.get(a.house) ?? 999;
      const ib = idx.get(b.house) ?? 999;
      return ia-ib || Util.cmpRoom(a.room,b.room) || Util.cmpName(a,b);
    });

    const weekendRows = w.map(s=>`<tr><td>${s.house}</td><td>${s.room}</td><td>${s.name}</td></tr>`).join("");

    // Duties
    const slots = Defaults.dutySlots();
    const dutyRows = slots.map(sl=>{
      const ids = (App.state.duties.assignments||{})[sl.id] || [];
      const names = ids.map(id=>Util.byId(id)?.name).filter(Boolean).join(", ") || "—";
      return `<tr><td>${sl.label}</td><td>${names}</td></tr>`;
    }).join("");

    // RENG
    const needs = App.state.reng.needs || {};
    const namesSorted = Object.keys(needs).sort((a,b)=>a.localeCompare(b,"da"));
    const rengRows = namesSorted.map(name=>{
      const ids = (App.state.reng.assignments||{})[name] || [];
      const names = ids.map(id=>Util.byId(id)?.name).filter(Boolean).join(", ") || "—";
      return `<tr><td>${name}</td><td>${names}</td></tr>`;
    }).join("");


    // Egen gang (rester pr gang)
    const H = App.state.reng.hallway || {};
    const housesForPrint = (App.state.houseOrder||[]).slice();
    Object.keys(H).forEach(h=>{ if(!housesForPrint.includes(h)) housesForPrint.push(h); });
    const hallwayRows = housesForPrint.map(h=>{
      const ids = H[h] || [];
      if(!ids.length) return "";
      const names = ids.map(id=>Util.byId(id)?.name).filter(Boolean).join(", ") || "—";
      return `<tr><td>${h}</td><td>${names}</td></tr>`;
    }).join("");
    // Sunday list (simple table; 3-column print styling can be added later)
    const all = App.state.students.slice().sort((a,b)=>Util.cmpName(a,b));
    const sundayRows = all.map(s=>{
      const f = Selectors.flags(s.id);
      const chk = f.returnedSunday ? "☑" : "☐";
      return `<tr><td style="width:2em">${chk}</td><td>${s.name}</td><td>${f.isPresent?'på skolen':(f.sundayDinnerOnly?'søn aften':'')}</td></tr>`;
    }).join("");

    // Brand: grouped by actual sovested (fre/lør/søn)
    const buildBrandBlocks = (day) => {
      const dayLabel = day==="fri" ? "Fredag" : (day==="sat" ? "Lørdag" : "Søndag");
      const groups = new Map();
      for(const s of w){
        const loc = Util.sleepLabel(s, day);
        const key = loc.label;
        if(!groups.has(key)) groups.set(key, {loc, names: []});
        groups.get(key).names.push(s.name);
      }
      const houseIndex = new Map((App.state.houseOrder||[]).map((h,i)=>[h,i]));
      const entries = [...groups.values()].sort((A,B)=>{
        const a=A.loc, b=B.loc;
        if(a.kind==='room' && b.kind==='room'){
          const ia = houseIndex.get(a.house) ?? 999;
          const ib = houseIndex.get(b.house) ?? 999;
          return ia-ib || Util.cmpRoom(a.room,b.room);
        }
        if(a.kind==='room') return -1;
        if(b.kind==='room') return 1;
        return a.label.localeCompare(b.label,"da");
      });

      return `
        <div class="printCard" style="page-break-before:always">
          <div class="printTitle">Brand — ${dayLabel}</div>
          <div class="printSub">Sovesteder for ${dayLabel}. Optælling pr. sted.</div>
          ${entries.map(e=>{
            e.names.sort((a,b)=>a.localeCompare(b,"da"));
            return `<div class="brandBox"><div style="font-weight:800">${e.loc.label} — ${e.names.length}</div><div>${e.names.join(", ")}</div></div>`;
          }).join("")}
        </div>
  
    // Mode filtering for one-tap print
    if(mode!=="all"){
      if(mode!=="duties") { dutiesPrint = ""; rengPrint = rengPrint || ""; }
      if(mode==="duties"){ brandPrint=""; sundayPrint=""; }
      if(mode==="brand"){ dutiesPrint=""; rengPrint=""; sundayPrint=""; /* brandPrint kept */ }
      if(mode==="sunday"){ dutiesPrint=""; rengPrint=""; brandPrint=""; /* sundayPrint kept */ }
    }
    `;
    };

    brandPrint = buildBrandBlocks("fri") + buildBrandBlocks("sat") + buildBrandBlocks("sun");
    area.innerHTML = `
      <div class="printCard">
        <div class="printTitle">Weekend-overblik</div>
        <div class="printSub">Elever: ${total} • Weekend: ${present}</div>
        <table>
          <thead><tr><th>Hus</th><th>Værelse</th><th>Navn</th></tr></thead>
          <tbody>${weekendRows}</tbody>
        </table>
      </div>

      <div class="printCard" style="page-break-before:always">
        <div class="printTitle">Tjanser</div>
        <table>
          <thead><tr><th>Tidspunkt</th><th>Elever</th></tr></thead>
          <tbody>${dutyRows}</tbody>
        </table>
      </div>

      <div class="printCard" style="page-break-before:always">
        <div class="printTitle">RENG (lør + søn)</div>
        <div class="printSub">Køkkenelever er udelukket. “ALLE ANDRE HAR EGEN GANG”.</div>
        <table>
          <thead><tr><th>Område</th><th>Elever</th></tr></thead>
          <tbody>${rengRows}</tbody>
        </table>
        <div style="height:6mm"></div>
        <div style="font-weight:800;margin:0 0 3mm 0;">Egen gang (rester pr. gang)</div>
        <table>
          <thead><tr><th>Gang</th><th>Elever</th></tr></thead>
          <tbody>${hallwayRows || "<tr><td colspan=\"2\">—</td></tr>"}</tbody>
        </table>
      </div>

      <div class="printCard" style="page-break-before:always">
        <div class="printTitle">Søndagsliste</div>
        <table>
          <thead><tr><th></th><th>Navn</th><th>Note</th></tr></thead>
          <tbody>${sundayRows}</tbody>
        </table>
      </div>
      ${brandPrint}
    `;
  }
};

// boot
window.App = App; window.UI = UI; window.Demo = Demo; window.Duties = Duties; window.Reng = Reng; window.Print = Print;

App.load();
UI.show("weekend");


document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ try{UI.closeHelp()}catch{} } });