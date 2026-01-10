
(() => {
  // Seeded random
  let seed = Math.floor(Date.now() / 1000);
  function rand() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17; seed >>>= 0;
    seed ^= seed << 5;  seed >>>= 0;
    return (seed >>> 0) / 4294967296;
  }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Demo data (random)
  const FIRST = ["Alma","Noah","Freja","Oskar","Maja","Elias","Sofia","Aksel","Liva","Viggo","Aya","Lucas","Mille","Thea","Malik","Nora","Karlo","Selma","Anton","Idun","Kasper","Helena","Jonas","Lea","Amina","Storm","Ingrid","Emil","Amira","Tilde","August","Zara","Signe","Felix","Liv","Hector","Luna","Mikkel","Clara"];
  const LAST  = ["Berg","Lind","Skov","Nørby","Højgaard","Krog","Bech","Toft","Carlsen","Juhl","Hansen","Petersen","Nielsen","Andersen","Olesen","Kjær","Aagaard","Bruun","Ravn","Thygesen","Hald","Winther","Klausen","Ibsen","Gravesen","Damgaard","Gundersen","Lodahl","Jørgensen","Holm","Bentsen","Thomsen","Bach","Sørensen","Kristensen","Knudsen","Sahl","Krag"];
  const GANGS = ["Hjemstavn","Mellemtiden","Gimle","Komponisten","Poeten","Tankegangen","Nord","Syd","Øst","Vest"];
  const ROOMS = ["Bifrost","Vølven","Pelikanen","Mandø","Veng","Alrø","Chopin","Newton","Mozart","Sibelius","Grieg","Samsø","Æbleø","Nattergalen","Carl Nielsen","Niels W. Gade","Fang","Lappedykkeren","Svavlfjære","Vitskøl","Efterbølge","Hasbøg","Perseus"];

  function makeFakeStudents(n=34) {
    const seen = new Set();
    const out = [];
    while (out.length < n) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      if (seen.has(name)) continue;
      seen.add(name);
      const leaveSat12 = out.length < 2 ? true : (rand() < 0.04);
      out.push({
        id: `d${String(out.length+1).padStart(3,"0")}`,
        unic: "",
        name,
        gang: pick(GANGS),
        room: pick(ROOMS),
        k_grp: "",
        present: { fredag:true, lørdag:true, søndag:!leaveSat12 },
        leaveSat12,
        roles: { kitchenCrew: rand() < 0.10 },
        overrides: { maxNonCleaningTasksWeekend: 1, excludeNonCleaningTasks: false }
      });
    }
    return shuffle(out);
  }

  // ---- CSV helpers
  function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
    const commas = (sample.match(/,/g) || []).length;
    const semis  = (sample.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  }
  function parseCsv(text) {
    const delim = detectDelimiter(text);
    const rows = [];
    let row = [], cur = "", inQuotes = false;
    for (let i=0;i<text.length;i++){
      const ch=text[i], next=text[i+1];
      if(inQuotes){
        if(ch === '"' && next === '"'){ cur+='"'; i++; continue; }
        if(ch === '"'){ inQuotes=false; continue; }
        cur += ch;
      } else {
        if(ch === '"'){ inQuotes=true; continue; }
        if(ch === delim){ row.push(cur); cur=""; continue; }
        if(ch === "\n"){ row.push(cur); rows.push(row); row=[]; cur=""; continue; }
        if(ch === "\r"){ continue; }
        cur += ch;
      }
    }
    row.push(cur); rows.push(row);
    while(rows.length && rows[rows.length-1].every(c=>String(c).trim()==="")) rows.pop();
    if(!rows.length) return {headers:[], data:[], delim};
    const headers = rows[0].map(h=>String(h).trim());
    const data = rows.slice(1).filter(r=>r.some(c=>String(c).trim()!==""));
    return {headers, data, delim};
  }
  function normKey(s){
    return String(s??"").trim().toLowerCase().replace(/\s+/g," ")
      .replaceAll("æ","ae").replaceAll("ø","oe").replaceAll("å","aa");
  }
  function buildHeaderIndex(headers){
    const m=new Map(); headers.forEach((h,i)=>m.set(normKey(h), i)); return m;
  }
  function getCell(row, idx, ...cands){
    for(const c of cands){
      const i = idx.get(normKey(c));
      if(i!=null && i>=0) return row[i] ?? "";
    }
    return "";
  }
  function norm(s){ return String(s??"").trim().replace(/\s+/g," "); }
  function cleanNameKey(s){
    return norm(s).toLowerCase().replace(/[.\u00b7·]/g,"").replace(/\s+/g," ").trim();
  }
  function initialsFromName(name){
    const parts = norm(name).split(" ").filter(Boolean);
    if(!parts.length) return "";
    if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }

  // ---- Code aliasing (forced)
  function normalizeTeacherCode(code, role){
    let c = norm(code).toUpperCase();
    if (!c) return "";
    if (c === "AP") c = "AB";
    if (c === "JN") c = "JH";
    if (c === "MP" && role === "k1") c = "MTP";
    if (c === "MP" && role === "k2") c = "MV";
    return c;
  }

  // Learnt overrides: teacherName -> code for role
  function buildTeacherOverrideMaps(dataRows, headerIndex){
    const k1 = new Map();
    const k2 = new Map();

    for (const row of dataRows){
      const k1Name = getCell(row, headerIndex, "Relationer-Kontaktlærer-Navn", "Kontaktlærer");
      const k2Name = getCell(row, headerIndex, "Relationer-Anden kontaktlærer-Navn", "Kontaktlærer 2");
      const k1Code = getCell(row, headerIndex, "K1-init");
      const k2Code = getCell(row, headerIndex, "K2-init");

      const k1Key = cleanNameKey(k1Name);
      const k2Key = cleanNameKey(k2Name);

      if (k1Key && norm(k1Code)) k1.set(k1Key, normalizeTeacherCode(k1Code, "k1"));
      if (k2Key && norm(k2Code)) k2.set(k2Key, normalizeTeacherCode(k2Code, "k2"));
    }
    return { k1, k2 };
  }

  function teacherCode(name, override, role, overrideMap){
    const o = norm(override).toUpperCase();
    if (o) return normalizeTeacherCode(o, role);

    const key = cleanNameKey(name);
    if (key && overrideMap && overrideMap.has(key)) return normalizeTeacherCode(overrideMap.get(key), role);

    return normalizeTeacherCode(initialsFromName(name), role);
  }

  function makeKGrpFromRow(row, idx, maps){
    const k1Name = getCell(row, idx, "Relationer-Kontaktlærer-Navn", "Kontaktlærer");
    const k2Name = getCell(row, idx, "Relationer-Anden kontaktlærer-Navn", "Kontaktlærer 2");

    const k1Code = getCell(row, idx, "K1-init");
    const k2Code = getCell(row, idx, "K2-init");

    const c1 = teacherCode(k1Name, k1Code, "k1", maps?.k1);
    const c2 = teacherCode(k2Name, k2Code, "k2", maps?.k2);

    if(c1 && c2) return `${c1}/${c2}`;
    return c1 || c2 || "";
  }

  // ---- Weekend parsing from "Hvor er du i weekenden? (6725)"
  function normWeekendText(s){
    return norm(s)
      .toLowerCase()
      .replaceAll("æ","ae").replaceAll("ø","oe").replaceAll("å","aa")
      .replace(/[()]/g," ")
      .replace(/[.,;:!?]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function parseWeekendAvailability(text){
    const t = normWeekendText(text);
    if (!t) return null;

    const hasFre = /\bfre(dag)?\b/.test(t);
    const hasSat = /\bloer(dag)?\b|\blor(dag)?\b/.test(t);
    const hasSun = /\bsoen(dag)?\b|\bson(dag)?\b/.test(t);

    // explicit home sat 12
    const homeSat12 =
      (/\bhjem\b/.test(t) && (/\b12\b/.test(t) || /\bkl\b/.test(t)) && (/\bloer\b|\blor\b/.test(t))) ||
      /\bhjem loer 12\b/.test(t) || /\bhjem lor 12\b/.test(t) ||
      /\btager hjem\b.*\bloer\b.*\b12\b/.test(t);

    if (homeSat12) {
      return { fredag:true, lørdag:true, søndag:false, leaveSat12:true };
    }

    // “hele weekenden”
    if (t.includes("hele weekenden") || t.includes("alle dage") || t.includes("paa hu hele weekenden") || t.includes("pa hu hele weekenden")) {
      return { fredag:true, lørdag:true, søndag:true, leaveSat12:false };
    }

    // Only-day patterns
    if (t.includes("kun") || t.includes("bare")) {
      if (hasSat && !hasFre && !hasSun) return { fredag:false, lørdag:true, søndag:false, leaveSat12:false };
      if (hasSun && !hasFre && !hasSat) return { fredag:false, lørdag:false, søndag:true, leaveSat12:false };
      if (hasFre && !hasSat && !hasSun) return { fredag:true, lørdag:false, søndag:false, leaveSat12:false };
    }

    // combos
    if (hasFre || hasSat || hasSun) {
      return { fredag:!!hasFre, lørdag:!!hasSat, søndag:!!hasSun, leaveSat12:false };
    }

    return null;
  }

  function mapCsvRowToStudent(row, idx, n, maps){
    const fornavn = norm(getCell(row, idx, "Fornavn"));
    const efternavn = norm(getCell(row, idx, "Efternavn"));
    const room = norm(getCell(row, idx, "Værelse", "Vaerelse"));
    const gang = norm(getCell(row, idx, "StudentHouse", "Gang"));
    const unic = norm(getCell(row, idx, "Uni-C brugernavn", "Uni-C", "Unic", "UniC"));

    const navnFallback = norm(getCell(row, idx, "Navn"));
    const name = ([fornavn, efternavn].filter(Boolean).join(" ").trim()) || navnFallback || `Ukendt elev ${n+1}`;

    const k_grp = makeKGrpFromRow(row, idx, maps);

    const weekendText = getCell(row, idx, "Hvor er du i weekenden? (6725)", "Hvor er du i weekenden?");
    const w = parseWeekendAvailability(weekendText);

    const present = w ? { fredag:w.fredag, lørdag:w.lørdag, søndag:w.søndag } : { fredag:true, lørdag:true, søndag:true };
    const leaveSat12 = !!(w && w.leaveSat12);

    return {
      id: `c${String(n+1).padStart(4,"0")}`,
      unic,
      name,
      gang: gang || "(ukendt)",
      room: room || "",
      k_grp,
      present,
      leaveSat12,
      roles: { kitchenCrew:false },
      overrides: { maxNonCleaningTasksWeekend: 1, excludeNonCleaningTasks:false }
    };
  }

  function studentsFromCsvText(text){
    const {headers, data, delim} = parseCsv(text);
    if(!headers.length) throw new Error("CSV ser tom ud.");
    const idx = buildHeaderIndex(headers);

    const maps = buildTeacherOverrideMaps(data, idx);
    const students = data.map((r,i)=>mapCsvRowToStudent(r, idx, i, maps));
    return {students, headers, delim};
  }

  // ---- Assignments (simple max 1/weekend; excludes kitchenCrew)
  const taskPlan = {
    fredag: { aftensmad_før:3, aftensmad_efter:3, aftenservering:2 },
    lørdag: { mokost_før:2, mokost_efter:2, eftermiddag:2, aftensmad_før:3, aftensmad_efter:3, aftenservering:1 },
    søndag: { mokost_før:2, mokost_efter:2, eftermiddag:2, aftensmad_før:3, aftensmad_efter:3, aftenservering:2 },
  };
  const commonAreas = ["Arken","Den lange gang","Toiletter på den lange gang","Køkken","Foyeren","Trapper","Gæstetoilet"];

  function emptyAssignments(){
    return {
      tasks: {
        fredag: Object.fromEntries(Object.keys(taskPlan.fredag).map(k=>[k,[]])),
        lørdag: Object.fromEntries(Object.keys(taskPlan.lørdag).map(k=>[k,[]])),
        søndag: Object.fromEntries(Object.keys(taskPlan.søndag).map(k=>[k,[]])),
      }
    };
  }

  function assignSimple(students){
    const A = emptyAssignments();
    const load = new Map(students.map(s=>[s.id,0]));
    const can = (day,s)=>s.present?.[day] && !s.roles?.kitchenCrew;

    function pickMany(day, key, n){
      const list = students
        .filter(s=>can(day,s))
        .sort((a,b)=> (load.get(a.id)-load.get(b.id)) || a.name.localeCompare(b.name,"da"));
      let i=0;
      for(const s of list){
        if(i>=n) break;
        if(load.get(s.id) >= 1) continue; // max 1/weekend
        A.tasks[day][key].push(s.name);
        load.set(s.id, load.get(s.id)+1);
        i++;
      }
    }

    for(const [day, spec] of Object.entries(taskPlan)){
      for(const [key, n] of Object.entries(spec)){
        pickMany(day, key, n);
      }
    }
    return A;
  }

  function makeStableCleaning(students){
    const plan = {};
    const rows = [...GANGS, ...commonAreas, "(Ekstra – fordel manuelt)"];
    rows.forEach(r=>plan[r]={sat:[], sun:[], flag:""});
    const sat = students.filter(s=>s.present.lørdag);
    const sun = students.filter(s=>s.present.søndag);
    const both = students.filter(s=>s.present.lørdag && s.present.søndag);

    const usedSat = new Set(), usedSun = new Set();

    // stable common areas from 'both'
    const bothSorted = both.slice().sort((a,b)=>a.name.localeCompare(b.name,"da"));
    let bi=0;
    for(const area of commonAreas){
      const s = bothSorted[bi++];
      if(!s) break;
      plan[area].sat=[s.name]; plan[area].sun=[s.name];
      usedSat.add(s.id); usedSun.add(s.id);
    }

    // halls: up to 2 per day per gang
    function fillHalls(dayKey, list, used){
      const extras=[];
      for(const g of GANGS){
        const candidates = list.filter(s=>s.gang===g && !used.has(s.id)).slice(0,2);
        candidates.forEach(s=>used.add(s.id));
        plan[g][dayKey]=candidates.map(s=>s.name);
      }
      const leftover = list.filter(s=>!used.has(s.id));
      leftover.forEach(s=>{ used.add(s.id); extras.push(`${s.name} (${s.gang||"Ukendt"})`); });
      plan["(Ekstra – fordel manuelt)"][dayKey]=extras;
    }
    fillHalls("sat", sat, usedSat);
    fillHalls("sun", sun, usedSun);

    for(const r of rows){
      const a = (plan[r].sat||[]).join("|");
      const b = (plan[r].sun||[]).join("|");
      if(a && b && a!==b) plan[r].flag="SKIFT";
    }
    return {rows, plan, meta:{warnings:[], bothCount:both.length, satOnlyCount:sat.length-both.length, sunOnlyCount:sun.length-both.length}};
  }

  // ---- Rendering helpers
  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function fmt(list){ return (!list || !list.length) ? "—" : list.join(", "); }
  function taskLabel(k){
    const m = {
      mokost_før:"Mokost (før)", mokost_efter:"Mokost (efter)", eftermiddag:"Eftermiddag",
      aftensmad_før:"Aftensmad (før)", aftensmad_efter:"Aftensmad (efter)", aftenservering:"Aftenservering"
    };
    return m[k]||k;
  }
  function dayCard(title, obj){
    const lines = Object.keys(obj).map(k=>`
      <div style="margin:6px 0;">
        <div class="small" style="margin-bottom:2px;"><b>${esc(taskLabel(k))}</b></div>
        <div>${esc(fmt(obj[k]))}</div>
      </div>
    `).join("");
    return `<div class="card"><h2>${esc(title)}</h2>${lines}</div>`;
  }

  function renderScreenTable(students){
    const tbody = document.getElementById("screenTbody");
    tbody.innerHTML = students.slice().sort((a,b)=>a.name.localeCompare(b.name,"da")).map(s=>`
      <tr data-id="${esc(s.id)}">
        <td>${esc(s.name)}</td>
        <td>${esc(s.gang)}</td>
        <td>${esc(s.room)}</td>
        <td class="center"><input type="checkbox" data-f="fre" ${s.present.fredag?"checked":""}></td>
        <td class="center"><input type="checkbox" data-f="lør" ${s.present.lørdag?"checked":""}></td>
        <td class="center"><input type="checkbox" data-f="søn" ${s.present.søndag?"checked":""}></td>
        <td class="center"><input type="checkbox" data-f="hjem12" ${s.leaveSat12?"checked":""}></td>
        <td class="center"><input type="checkbox" data-f="kitchen" ${s.roles.kitchenCrew?"checked":""}></td>
        <td class="small">${esc(s.k_grp||"")}</td>
      </tr>
    `).join("");

    tbody.querySelectorAll("tr").forEach(tr=>{
      const id = tr.getAttribute("data-id");
      const s = students.find(x=>x.id===id);
      tr.querySelectorAll("input[type=checkbox]").forEach(cb=>{
        cb.addEventListener("change", ()=>{
          const f = cb.getAttribute("data-f");
          if(f==="fre") s.present.fredag = cb.checked;
          if(f==="lør") s.present.lørdag = cb.checked;
          if(f==="søn") s.present.søndag = cb.checked;
          if(f==="hjem12"){ s.leaveSat12 = cb.checked; if(cb.checked) s.present.søndag=false; }
          if(f==="kitchen"){ s.roles.kitchenCrew = cb.checked; s.overrides.excludeNonCleaningTasks = cb.checked; }
          if(f==="søn" && cb.checked) s.leaveSat12=false;
          updateStatus();
        });
      });
    });
  }

  function renderPrint(students, A, cleaning){
    const count = d => students.filter(s=>s.present[d]).length;
    const home12 = students.filter(s=>s.leaveSat12).length;
    const kitchenCrew = students.filter(s=>s.roles.kitchenCrew).map(s=>s.name).sort((a,b)=>a.localeCompare(b,"da"));

    document.getElementById("page1").innerHTML = `
      <h2>Weekend – køkkenoverblik</h2>
      <p class="small">Udskrift: ${esc(new Date().toLocaleString("da-DK"))}</p>
      <p class="small"><b>Antal på HU:</b> Fre ${count("fredag")} · Lør ${count("lørdag")} · Søn ${count("søndag")} · <b>Hjem lør 12:</b> ${home12}</p>
      <p class="small"><b>Køkkenelever (udeladt fra tjanser):</b> ${esc(kitchenCrew.join(", ") || "—")}</p>
      <div class="grid" style="grid-template-columns:repeat(3, minmax(240px, 1fr)); gap:10px;">
        ${dayCard("Fredag", A.tasks.fredag)}
        ${dayCard("Lørdag", A.tasks.lørdag)}
        ${dayCard("Søndag", A.tasks.søndag)}
      </div>
    `;

    const rows = students.slice().sort((a,b)=>a.name.localeCompare(b.name,"da")).map(s=>`
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.gang)}</td>
        <td>${esc(s.room)}</td>
        <td class="center">${s.present.fredag?"x":""}</td>
        <td class="center">${s.present.lørdag?"x":""}</td>
        <td class="center">${s.present.søndag?"x":""}</td>
        <td class="center">${s.leaveSat12?"x":""}</td>
        <td class="center">${s.roles.kitchenCrew?"x":""}</td>
        <td class="small">${esc(s.k_grp||"")}</td>
        <td class="small"></td>
      </tr>
    `).join("");

    document.getElementById("page2").innerHTML = `
      <h2>Tilstedeværelse</h2>
      <p class="small">Kompakt liste til overblik og noter.</p>
      <table>
        <thead>
          <tr>
            <th>Navn</th><th>Gang</th><th>Værelse</th>
            <th class="center">Fre</th><th class="center">Lør</th><th class="center">Søn</th>
            <th class="center">Hjem lør 12</th><th class="center">Køkkenelev</th>
            <th>K-grp</th><th>Noter</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    const cRows = cleaning.rows.map(r=>`
      <tr>
        <td><b>${esc(r)}</b></td>
        <td>${esc((cleaning.plan[r].sat||[]).join(", "))}</td>
        <td>${esc((cleaning.plan[r].sun||[]).join(", "))}</td>
        <td class="small center">${cleaning.plan[r].flag ? "SKIFT" : ""}</td>
        <td class="small"></td>
      </tr>
    `).join("");

    document.getElementById("page3").innerHTML = `
      <h2>Rengøring (stabil plan)</h2>
      <p class="small"><b>Alle elever deltager i rengøring (køkkenelever også).</b> En-dags-elever bliver på egen gang, så vidt muligt.</p>
      <p class="small">Begge dage: ${cleaning.meta.bothCount} · Kun lørdag: ${cleaning.meta.satOnlyCount} · Kun søndag: ${cleaning.meta.sunOnlyCount}</p>
      <table>
        <thead>
          <tr>
            <th>Område / Gang</th>
            <th>Lørdag</th>
            <th>Søndag</th>
            <th class="center">Note</th>
            <th>Bemærkninger</th>
          </tr>
        </thead>
        <tbody>${cRows}</tbody>
      </table>
    `;
  }

  function updateStatus(){
    const count = d => students.filter(s=>s.present[d]).length;
    const home12 = students.filter(s=>s.leaveSat12).length;
    const kitchenCrew = students.filter(s=>s.roles.kitchenCrew).length;
    document.getElementById("seedPill").textContent = `seed: ${seed}`;
    document.getElementById("status").textContent = `Elever: ${students.length} · Fre ${count("fredag")} Lør ${count("lørdag")} Søn ${count("søndag")} · Hjem lør 12: ${home12} · Køkkenelever: ${kitchenCrew}`;
  }

  // ---- Bulk kitchen helpers
  function splitTokens(s){
    return String(s??"")
      .split(/[\n,]+/g)
      .map(x => x.trim())
      .filter(Boolean);
  }
  function normalizeToken(s){
    return norm(s).toLowerCase().replaceAll("æ","ae").replaceAll("ø","oe").replaceAll("å","aa");
  }
  function applyKitchenBulk(tokens){
    if (!tokens.length) return {marked:0, notFound:[]};

    const tokSet = new Set(tokens.map(normalizeToken));
    let marked = 0;
    const notFound = [];

    for (const tok of tokSet){
      const match = students.find(s =>
        (s.unic && normalizeToken(s.unic) === tok) ||
        normalizeToken(s.name) === tok
      );
      if (match){
        if (!match.roles.kitchenCrew) marked++;
        match.roles.kitchenCrew = true;
        match.overrides.excludeNonCleaningTasks = true;
      } else {
        notFound.push(tok);
      }
    }
    return {marked, notFound};
  }

  function clearKitchen(){
    students.forEach(s => {
      s.roles.kitchenCrew = false;
      s.overrides.excludeNonCleaningTasks = false;
    });
  }

  // ---- UI wiring
  const csvFileEl = document.getElementById("csvFile");
  const csvInfoEl = document.getElementById("csvInfo");
  const kitchenBulkEl = document.getElementById("kitchenBulk");

  let students = makeFakeStudents(34);

  function regenerate(){
    students.forEach(s=>{
      if(!s.present) s.present={fredag:true,lørdag:true,søndag:true};
      if(!s.roles) s.roles={kitchenCrew:false};
      if(!s.overrides) s.overrides={maxNonCleaningTasksWeekend:1, excludeNonCleaningTasks:false};

      if(s.leaveSat12) s.present.søndag=false;
      if(s.present.søndag) s.leaveSat12=false;
      s.overrides.excludeNonCleaningTasks = !!s.roles.kitchenCrew;
    });

    const A = assignSimple(students);
    const cleaning = makeStableCleaning(students);

    renderScreenTable(students);
    updateStatus();
    renderPrint(students, A, cleaning);
  }

  document.getElementById("btnGenerate").addEventListener("click", regenerate);

  document.getElementById("btnShuffle").addEventListener("click", ()=>{
    seed = Math.floor(Math.random() * 2**31);
    students = makeFakeStudents(34);
    csvInfoEl.textContent = "Demo-data genereret.";
    regenerate();
  });

  document.getElementById("btnPrint").addEventListener("click", ()=>{
    regenerate();
    window.print();
  });

  document.getElementById("btnUseDemo").addEventListener("click", ()=>{
    students = makeFakeStudents(34);
    csvInfoEl.textContent = "Skiftet til demo-data.";
    regenerate();
  });

  document.getElementById("btnLoadCsv").addEventListener("click", async ()=>{
    const file = csvFileEl.files && csvFileEl.files[0];
    if(!file){ csvInfoEl.textContent="Vælg først en CSV-fil."; return; }
    try{
      const text = await file.text();
      const parsed = studentsFromCsvText(text);
      students = parsed.students;
      csvInfoEl.textContent = `Indlæst: ${students.length} elever · delimiter "${parsed.delim}" · headers ${parsed.headers.length}.`;
      regenerate();
    } catch(e){
      console.error(e);
      csvInfoEl.textContent = "Kunne ikke indlæse CSV. Tjek format/kolonnenavne.";
    }
  });

  document.getElementById("btnKitchenBulk").addEventListener("click", ()=>{
    const tokens = splitTokens(kitchenBulkEl.value);
    const res = applyKitchenBulk(tokens);
    csvInfoEl.textContent = `Køkkenelever markeret: +${res.marked}. Ikke fundet: ${res.notFound.length ? res.notFound.join(", ") : "—"}`;
    regenerate();
  });

  document.getElementById("btnKitchenClear").addEventListener("click", ()=>{
    clearKitchen();
    csvInfoEl.textContent = "Alle køkkenelever ryddet.";
    regenerate();
  });

  regenerate();
})();
