// Weekendliste – app (prototype)
// Fokus: print først, UI sekundært. Ingen backend.

(() => {
  // -------------------------
  // Seeded random
  // -------------------------
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

  // -------------------------
  // Fake data generator (no real names)
  // -------------------------
  const FIRST = ["Alma","Noah","Freja","Oskar","Maja","Elias","Sofia","Aksel","Liva","Viggo","Aya","Lucas","Mille","Thea","Malik","Nora","Karlo","Selma","Anton","Idun","Kasper","Helena","Jonas","Lea","Amina","Storm","Ingrid","Emil","Amira","Tilde","August","Zara","Signe","Felix","Liv","Hector","Luna","Mikkel","Clara"];
  const LAST  = ["Berg","Lind","Skov","Nørby","Højgaard","Krog","Bech","Toft","Madsen","Carlsen","Juhl","Hansen","Petersen","Nielsen","Andersen","Olesen","Kjær","Aagaard","Bruun","Mortensen","Ravn","Thygesen","Hald","Winther","Klausen","Ibsen","Gravesen","Damgaard","Gundersen","Lodahl","Jørgensen","Holm","Bentsen","Thomsen","Bach","Sørensen","Kristensen","Knudsen","Sahl","Krag"];
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
      const kitchenCrew = rand() < 0.10;

      out.push({
        id: `d${String(out.length+1).padStart(3,"0")}`,
        name,
        gang: pick(GANGS),
        room: pick(ROOMS),
        k_grp: "",

        present: {
          fredag: true,
          lørdag: true,
          søndag: !leaveSat12
        },
        leaveSat12,
        roles: { kitchenCrew },
        overrides: {
          maxNonCleaningTasksWeekend: 1,
          excludeNonCleaningTasks: kitchenCrew
        }
      });
    }
    return shuffle(out);
  }

  // -------------------------
  // Task plan (adjust here)
  // -------------------------
  const taskPlan = {
    fredag: { aftensmad:{før:3, efter:3}, aftenservering:2 },
    lørdag: { mokost:{før:2, efter:2}, eftermiddag:2, aftensmad:{før:3, efter:3}, aftenservering:1 },
    søndag: { mokost:{før:2, efter:2}, eftermiddag:2, aftensmad:{før:3, efter:3}, aftenservering:2 }
  };

  // Cleaning: fællesområder (1 elev pr område som udgangspunkt)
  const commonAreas = ["Arken","Den lange gang","Toiletter på den lange gang","Køkken","Foyeren","Trapper","Gæstetoilet"];

  // -------------------------
  // CSV import (no libs)
  // -------------------------
  function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
    const commas = (sample.match(/,/g) || []).length;
    const semis  = (sample.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  }

  function parseCsv(text) {
    const delim = detectDelimiter(text);
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuotes = false; continue; }
        cur += ch;
      } else {
        if (ch === '"') { inQuotes = true; continue; }
        if (ch === delim) { row.push(cur); cur = ""; continue; }
        if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
        if (ch === "\r") { continue; }
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
    while (rows.length && rows[rows.length - 1].every(c => String(c).trim() === "")) rows.pop();

    if (!rows.length) return { headers: [], data: [], delim };
    const headers = rows[0].map(h => String(h).trim());
    const data = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
    return { headers, data, delim };
  }

  function normKey(s) {
    return String(s ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replaceAll("æ","ae")
      .replaceAll("ø","oe")
      .replaceAll("å","aa");
  }

  function buildHeaderIndex(headers) {
    const map = new Map();
    headers.forEach((h, idx) => map.set(normKey(h), idx));
    return map;
  }

  function getCell(rowArr, headerIndex, ...candidates) {
    for (const c of candidates) {
      const idx = headerIndex.get(normKey(c));
      if (idx != null && idx >= 0) return rowArr[idx] ?? "";
    }
    return "";
  }

  function norm(s) { return String(s ?? "").trim().replace(/\s+/g, " "); }

  function initialsFromName(name) {
    const parts = norm(name).split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function teacherCode(name, override) {
    const o = norm(override).toUpperCase();
    if (o) return o;
    return initialsFromName(name);
  }

  function makeKGrpFromRow(rowArr, headerIndex) {
    const k1Name = getCell(rowArr, headerIndex, "Kontaktlærer", "Kontaktlaerer", "Kontaktlærer 1", "Kontaktlaerer 1");
    const k2Name = getCell(rowArr, headerIndex, "Kontaktlærer 2", "Kontaktlaerer 2");

    const k1Code = getCell(rowArr, headerIndex,
      "Kontaktlærer kode", "Kontaktlaerer kode", "Kontaktlærer forkortelse", "Kontaktlaerer forkortelse",
      "K1 kode", "K1 forkortelse"
    );
    const k2Code = getCell(rowArr, headerIndex,
      "Kontaktlærer 2 kode", "Kontaktlaerer 2 kode", "Kontaktlærer 2 forkortelse", "Kontaktlaerer 2 forkortelse",
      "K2 kode", "K2 forkortelse"
    );

    const c1 = teacherCode(k1Name, k1Code);
    const c2 = teacherCode(k2Name, k2Code);
    if (c1 && c2) return `${c1}/${c2}`;
    return c1 || c2 || "";
  }

  function mapCsvRowToStudent(rowArr, headerIndex, idx) {
    const fornavn = norm(getCell(rowArr, headerIndex, "Fornavn", "Fornavne", "Fornavn(e)"));
    const efternavn = norm(getCell(rowArr, headerIndex, "Efternavn", "Efternavne"));
    const værelse = norm(getCell(rowArr, headerIndex, "Værelse", "Vaerelse", "Room"));
    const gang = norm(getCell(rowArr, headerIndex, "Gang", "Gange", "Hus", "Afdeling"));
    const kgrp = makeKGrpFromRow(rowArr, headerIndex);
    const name = [fornavn, efternavn].filter(Boolean).join(" ").trim();

    return {
      id: `c${String(idx+1).padStart(4,"0")}`,
      name: name || `Ukendt elev ${idx+1}`,
      gang: gang || "(ukendt)",
      room: værelse || "",
      k_grp: kgrp || "",
      present: { fredag:true, lørdag:true, søndag:true },
      leaveSat12: false,
      roles: { kitchenCrew:false },
      overrides: { maxNonCleaningTasksWeekend:1, excludeNonCleaningTasks:false }
    };
  }

  function studentsFromCsvText(text) {
    const { headers, data, delim } = parseCsv(text);
    if (!headers.length) throw new Error("CSV ser tom ud.");
    const headerIndex = buildHeaderIndex(headers);
    const students = data.map((rowArr, idx) => mapCsvRowToStudent(rowArr, headerIndex, idx));
    return { students, headers, delim };
  }

  // -------------------------
  // Assignments (tjanser) – max 1/weekend + knapt mode
  // -------------------------
  function flattenTaskPlan(tp) {
    const out = [];
    for (const [day, spec] of Object.entries(tp)) {
      for (const [k, v] of Object.entries(spec)) {
        if (typeof v === "number") {
          out.push({ day, key: k, slots: v, kind: "duty_kitchen", size: "light" });
        } else {
          for (const [sub, n] of Object.entries(v)) {
            out.push({
              day,
              key: `${k}_${sub}`,
              slots: n,
              kind: "duty_kitchen",
              size: (sub === "før") ? "heavy" : "light"
            });
          }
        }
      }
    }
    return out;
  }

  function computeMode(students, flatTasks) {
    const need = flatTasks.reduce((sum,t)=>sum+t.slots,0);
    const eligible = students.filter(s =>
      (s.present.fredag || s.present.lørdag || s.present.søndag) &&
      !s.overrides?.excludeNonCleaningTasks
    );
    const capacity = eligible.reduce((sum,s)=>sum+(s.overrides?.maxNonCleaningTasksWeekend ?? 1),0);
    return { mode: need <= capacity ? "rigeligt" : "knapt", need, capacity, eligibleCount: eligible.length };
  }

  function isEligibleForNonCleaningTask(day, s) {
    if (!s.present[day]) return false;
    if (s.overrides?.excludeNonCleaningTasks) return false;
    return true;
  }

  function makeEmptyAssignments(flatTasks) {
    const tasks = { fredag:{}, lørdag:{}, søndag:{} };
    for (const t of flatTasks) tasks[t.day][t.key] = [];
    return { tasks };
  }

  function assignNonCleaningTasks(students, flatTasks) {
    const info = computeMode(students, flatTasks);
    const A = makeEmptyAssignments(flatTasks);

    const taken = new Map(students.map(s => [s.id, []])); // list of task meta

    function canTake(s) {
      const maxW = s.overrides?.maxNonCleaningTasksWeekend ?? 1;
      return taken.get(s.id).length < maxW;
    }

    function scoreCandidate(s, task, phase) {
      const got = taken.get(s.id);
      if (phase === 1) return got.length; // 0 first
      const hasHeavy = got.some(x => x.size === "heavy");
      const hasLight = got.some(x => x.size === "light");
      const wantPair =
        (task.size === "heavy" && hasLight && !hasHeavy) ||
        (task.size === "light" && hasHeavy && !hasLight);
      return (wantPair ? -10 : 0) + got.length;
    }

    function fillTask(task, phase) {
      let slotsLeft = task.slots;
      while (slotsLeft > 0) {
        const candidates = students
          .filter(s => isEligibleForNonCleaningTask(task.day, s))
          .filter(s => {
            if (canTake(s)) return true;
            return (info.mode === "knapt" && phase === 2);
          })
          .sort((a,b) => {
            const sa = scoreCandidate(a, task, phase);
            const sb = scoreCandidate(b, task, phase);
            if (sa !== sb) return sa - sb;
            return a.id.localeCompare(b.id);
          });

        if (!candidates.length) break;

        const s = candidates[0];

        // in knapt phase 2: temporarily allow one extra
        if (info.mode === "knapt" && phase === 2 && !canTake(s)) {
          s.overrides.maxNonCleaningTasksWeekend = (s.overrides.maxNonCleaningTasksWeekend ?? 1) + 1;
        }

        A.tasks[task.day][task.key].push(s.name);
        taken.get(s.id).push({ day: task.day, key: task.key, size: task.size, kind: task.kind });
        slotsLeft--;
      }
    }

    // phase 1
    for (const t of flatTasks) fillTask(t, 1);

    // phase 2 fill missing
    if (info.mode === "knapt") {
      for (const t of flatTasks) {
        const missing = t.slots - A.tasks[t.day][t.key].length;
        if (missing > 0) fillTask({ ...t, slots: missing }, 2);
      }
    }

    return { A, info };
  }

  // -------------------------
  // Cleaning – stable Sat/Sun plan
  // -------------------------
  function makeStableCleaningPlan(students, gangs, commonAreas) {
    const warnings = [];
    const isSat = s => !!s.present?.lørdag;
    const isSun = s => !!s.present?.søndag;
    const keyId = s => s.id ?? s.name;

    const presentSat = students.filter(isSat);
    const presentSun = students.filter(isSun);
    const both = students.filter(s => (isSat(s) && isSun(s)));
    const satOnly = students.filter(s => isSat(s) && !isSun(s));
    const sunOnly = students.filter(s => !isSat(s) && isSun(s));

    function buildByGang(presentList) {
      const m = new Map();
      for (const s of presentList) {
        const g = s.gang ?? "(Ukendt gang)";
        if (!m.has(g)) m.set(g, []);
        m.get(g).push(s);
      }
      return m;
    }

    const byGangSat = buildByGang(presentSat);
    const byGangSun = buildByGang(presentSun);

    const gangSizeSat = new Map(gangs.map(g => [g, (byGangSat.get(g) || []).length]));
    const gangSizeSun = new Map(gangs.map(g => [g, (byGangSun.get(g) || []).length]));

    const assignedSat = new Set();
    const assignedSun = new Set();

    const plan = {};
    const rows = [];
    for (const g of gangs) rows.push(g);
    for (const a of commonAreas) rows.push(a);
    rows.push("(Ekstra – fordel manuelt)");
    for (const r of rows) plan[r] = { sat: [], sun: [], flag: "", note: "" };

    const bothPool = both.slice().sort((a,b) => {
      const ga = a.gang ?? "(Ukendt gang)";
      const gb = b.gang ?? "(Ukendt gang)";
      const sa = gangSizeSat.get(ga) ?? 0;
      const sb = gangSizeSat.get(gb) ?? 0;
      if (sb !== sa) return sb - sa;
      return String(keyId(a)).localeCompare(String(keyId(b)), "da");
    });

    const stableCommon = new Map();
    function stableCommonHasStudent(map, student) {
      for (const v of map.values()) {
        if (!v) continue;
        if (keyId(v) === keyId(student)) return true;
      }
      return false;
    }

    for (const area of commonAreas) {
      const pick = bothPool.find(s => !stableCommonHasStudent(stableCommon, s));
      if (pick) {
        stableCommon.set(area, pick);
        plan[area].sat = [pick.name];
        plan[area].sun = [pick.name];
        assignedSat.add(keyId(pick));
        assignedSun.add(keyId(pick));
      } else {
        stableCommon.set(area, null);
      }
    }

    function pickFromDayPool(candidates, assignedSet, gangSizeMap) {
      const available = candidates.filter(s => !assignedSet.has(keyId(s)));
      available.sort((a,b) => {
        const ga = a.gang ?? "(Ukendt gang)";
        const gb = b.gang ?? "(Ukendt gang)";
        const sa = gangSizeMap.get(ga) ?? 0;
        const sb = gangSizeMap.get(gb) ?? 0;
        if (sb !== sa) return sb - sa;
        return String(keyId(a)).localeCompare(String(keyId(b)), "da");
      });
      return available[0] || null;
    }

    for (const area of commonAreas) {
      if (stableCommon.get(area)) continue;

      const satPick =
        pickFromDayPool(both, assignedSat, gangSizeSat) ||
        pickFromDayPool(satOnly, assignedSat, gangSizeSat) ||
        pickFromDayPool(presentSat, assignedSat, gangSizeSat);

      if (satPick) {
        plan[area].sat = [satPick.name];
        assignedSat.add(keyId(satPick));
      } else {
        warnings.push(`Fællesområde "${area}" er ubemandet lørdag.`);
      }

      const sunPick =
        pickFromDayPool(both, assignedSun, gangSizeSun) ||
        pickFromDayPool(sunOnly, assignedSun, gangSizeSun) ||
        pickFromDayPool(presentSun, assignedSun, gangSizeSun);

      if (sunPick) {
        plan[area].sun = [sunPick.name];
        assignedSun.add(keyId(sunPick));
      } else {
        warnings.push(`Fællesområde "${area}" er ubemandet søndag.`);
      }

      const satName = plan[area].sat[0] || "";
      const sunName = plan[area].sun[0] || "";
      if (satName && sunName && satName !== sunName) plan[area].flag = "SKIFT";
    }

    function assignHallsForDay(dayKey, presentList, assignedSet, gangs) {
      const extras = [];
      for (const g of gangs) {
        const list = presentList
          .filter(s => (s.gang ?? "(Ukendt gang)") === g && !assignedSet.has(keyId(s)))
          .sort((a,b) => String(keyId(a)).localeCompare(String(keyId(b)), "da"));

        const chosen = list.slice(0, 2);
        for (const s of chosen) assignedSet.add(keyId(s));
        plan[g][dayKey] = chosen.map(s => s.name);

        const rest = list.slice(2);
        for (const s of rest) {
          assignedSet.add(keyId(s));
          extras.push(`${s.name} (${g})`);
        }
      }

      const still = presentList.filter(s => !assignedSet.has(keyId(s)));
      for (const s of still) {
        assignedSet.add(keyId(s));
        extras.push(`${s.name} (${s.gang ?? "Ukendt"})`);
      }
      return extras;
    }

    const extraSat = assignHallsForDay("sat", presentSat, assignedSat, gangs);
    const extraSun = assignHallsForDay("sun", presentSun, assignedSun, gangs);

    plan["(Ekstra – fordel manuelt)"].sat = extraSat;
    plan["(Ekstra – fordel manuelt)"].sun = extraSun;
    if (extraSat.length || extraSun.length) plan["(Ekstra – fordel manuelt)"].flag = "SKIFT";

    for (const g of gangs) {
      const a = (plan[g].sat || []).join("|");
      const b = (plan[g].sun || []).join("|");
      if (a && b && a !== b) plan[g].flag = "SKIFT";
    }

    return {
      rows,
      plan,
      meta: {
        bothCount: both.length,
        satOnlyCount: satOnly.length,
        sunOnlyCount: sunOnly.length,
        commonAreas: commonAreas.length,
        warnings
      }
    };
  }

  // -------------------------
  // Rendering
  // -------------------------
  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function fmt(list){ return (!list || list.length===0) ? "—" : list.join(", "); }

  function taskLabel(key) {
    const map = {
      mokost_før: "Mokost (før)",
      mokost_efter: "Mokost (efter)",
      eftermiddag: "Eftermiddag",
      aftensmad_før: "Aftensmad (før)",
      aftensmad_efter: "Aftensmad (efter)",
      aftenservering: "Aftenservering"
    };
    return map[key] || key;
  }

  function dayCard(title, obj) {
    const keys = Object.keys(obj);
    const lines = keys.map(key => `
      <div style="margin:6px 0;">
        <div class="small" style="margin-bottom:2px;"><b>${esc(taskLabel(key))}</b></div>
        <div>${esc(fmt(obj[key]))}</div>
      </div>
    `).join("");
    return `<div class="card"><h2>${esc(title)}</h2>${lines}</div>`;
  }

  function renderScreenTable(students) {
    const tbody = document.getElementById("screenTbody");
    tbody.innerHTML = students
      .slice()
      .sort((a,b)=>a.name.localeCompare(b.name,"da"))
      .map(s => {
        const fre = s.present?.fredag ? "checked" : "";
        const lør = s.present?.lørdag ? "checked" : "";
        const søn = s.present?.søndag ? "checked" : "";
        const hjem12 = s.leaveSat12 ? "checked" : "";
        const kitchen = s.roles?.kitchenCrew ? "checked" : "";
        return `
          <tr data-id="${esc(s.id)}">
            <td>${esc(s.name)}</td>
            <td>${esc(s.gang)}</td>
            <td>${esc(s.room)}</td>
            <td class="center"><input type="checkbox" data-f="fre" ${fre}></td>
            <td class="center"><input type="checkbox" data-f="lør" ${lør}></td>
            <td class="center"><input type="checkbox" data-f="søn" ${søn}></td>
            <td class="center"><input type="checkbox" data-f="hjem12" ${hjem12}></td>
            <td class="center"><input type="checkbox" data-f="kitchen" ${kitchen}></td>
            <td class="small">${esc(s.k_grp || "")}</td>
          </tr>
        `;
      }).join("");

    tbody.querySelectorAll("tr").forEach(tr => {
      const id = tr.getAttribute("data-id");
      const s = students.find(x => x.id === id);
      if (!s) return;
      tr.querySelectorAll("input[type=checkbox]").forEach(cb => {
        cb.addEventListener("change", () => {
          const f = cb.getAttribute("data-f");
          if (f === "fre") s.present.fredag = cb.checked;
          if (f === "lør") s.present.lørdag = cb.checked;
          if (f === "søn") s.present.søndag = cb.checked;

          if (f === "hjem12") {
            s.leaveSat12 = cb.checked;
            if (cb.checked) s.present.søndag = false;
          }

          if (f === "kitchen") {
            s.roles.kitchenCrew = cb.checked;
            s.overrides.excludeNonCleaningTasks = cb.checked;
          }

          if (f === "søn" && cb.checked) s.leaveSat12 = false;

          updateStatus();
        });
      });
    });
  }

  function renderPrint(students, assignments, info, cleaningStable) {
    const count = (day) => students.filter(s => s.present?.[day]).length;
    const home12 = students.filter(s => s.leaveSat12).length;
    const kitchenCrew = students.filter(s => s.roles?.kitchenCrew).map(s => s.name).sort((a,b)=>a.localeCompare(b,"da"));

    document.getElementById("page1").innerHTML = `
      <h2>Weekend – køkkenoverblik</h2>
      <p class="small">Udskrift: ${esc(new Date().toLocaleString("da-DK"))}</p>
      <p class="small">
        <b>Antal på HU:</b> Fre ${count("fredag")} · Lør ${count("lørdag")} · Søn ${count("søndag")}
        · <b>Hjem lør 12:</b> ${home12}
      </p>
      <p class="small"><b>Køkkenelever:</b> ${esc(kitchenCrew.join(", ") || "—")}</p>
      <p class="small"><b>Mode:</b> ${esc(info.mode)} (behov ${info.need}, kapacitet ${info.capacity}, tjans-berettigede ${info.eligibleCount})</p>

      <div class="grid" style="grid-template-columns:repeat(3, minmax(240px, 1fr)); gap:10px;">
        ${dayCard("Fredag", assignments.tasks.fredag)}
        ${dayCard("Lørdag", assignments.tasks.lørdag)}
        ${dayCard("Søndag", assignments.tasks.søndag)}
      </div>
    `;

    const rows = students.slice().sort((a,b)=>a.name.localeCompare(b.name,"da")).map(s=>`
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.gang)}</td>
        <td>${esc(s.room)}</td>
        <td class="center">${s.present.fredag ? "x" : ""}</td>
        <td class="center">${s.present.lørdag ? "x" : ""}</td>
        <td class="center">${s.present.søndag ? "x" : ""}</td>
        <td class="center">${s.leaveSat12 ? "x" : ""}</td>
        <td class="center">${s.roles.kitchenCrew ? "x" : ""}</td>
        <td class="small">${esc(s.k_grp || "")}</td>
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

    const { rows: cRowsOrder, plan, meta } = cleaningStable;
    const cRows = cRowsOrder.map(r => `
      <tr>
        <td><b>${esc(r)}</b></td>
        <td>${esc((plan[r].sat || []).join(", "))}</td>
        <td>${esc((plan[r].sun || []).join(", "))}</td>
        <td class="small center">${plan[r].flag ? "SKIFT" : ""}</td>
        <td class="small"></td>
      </tr>
    `).join("");

    const warn = (meta.warnings || []).map(w => `<li>${esc(w)}</li>`).join("");

    document.getElementById("page3").innerHTML = `
      <h2>Rengøring (stabil plan)</h2>
      <p class="small">
        Begge dage: ${meta.bothCount} · Kun lørdag: ${meta.satOnlyCount} · Kun søndag: ${meta.sunOnlyCount}
      </p>
      ${meta.warnings.length ? `<ul class="small">${warn}</ul>` : ""}
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

  function updateStatus() {
    const count = (day) => students.filter(s => s.present?.[day]).length;
    const home12 = students.filter(s => s.leaveSat12).length;
    const kitchenCrew = students.filter(s => s.roles?.kitchenCrew).length;
    document.getElementById("seedPill").textContent = `seed: ${seed}`;
    document.getElementById("status").textContent =
      `Elever: ${students.length} · Fre ${count("fredag")} Lør ${count("lørdag")} Søn ${count("søndag")} · Hjem lør 12: ${home12} · Køkkenelever: ${kitchenCrew}`;
  }

  // -------------------------
  // UI wiring
  // -------------------------
  const csvFileEl = document.getElementById("csvFile");
  const csvInfoEl = document.getElementById("csvInfo");

  let students = makeFakeStudents(34);

  let flat = flattenTaskPlan(taskPlan);
  let assigned = assignNonCleaningTasks(students, flat);
  let cleaningStable = makeStableCleaningPlan(students, GANGS, commonAreas);

  function regenerateAndRender() {
    students.forEach(s => {
      if (!s.present) s.present = { fredag:true, lørdag:true, søndag:true };
      if (!s.roles) s.roles = { kitchenCrew:false };
      if (!s.overrides) s.overrides = { maxNonCleaningTasksWeekend:1, excludeNonCleaningTasks:false };
      s.overrides.excludeNonCleaningTasks = !!s.roles.kitchenCrew;
      if (s.leaveSat12) s.present.søndag = false;
      if (s.present.søndag) s.leaveSat12 = false;
    });

    flat = flattenTaskPlan(taskPlan);
    assigned = assignNonCleaningTasks(students, flat);
    cleaningStable = makeStableCleaningPlan(students, GANGS, commonAreas);

    renderScreenTable(students);
    updateStatus();
    renderPrint(students, assigned.A, assigned.info, cleaningStable);
  }

  document.getElementById("btnGenerate").addEventListener("click", () => {
    regenerateAndRender();
  });

  document.getElementById("btnShuffle").addEventListener("click", () => {
    seed = Math.floor(Math.random() * 2**31);
    students = makeFakeStudents(34);
    csvInfoEl.textContent = "Demo-data genereret.";
    regenerateAndRender();
  });

  document.getElementById("btnPrint").addEventListener("click", () => {
    regenerateAndRender();
    window.print();
  });

  document.getElementById("btnUseDemo").addEventListener("click", () => {
    students = makeFakeStudents(34);
    csvInfoEl.textContent = "Skiftet til demo-data.";
    regenerateAndRender();
  });

  document.getElementById("btnLoadCsv").addEventListener("click", async () => {
    const file = csvFileEl.files && csvFileEl.files[0];
    if (!file) {
      csvInfoEl.textContent = "Vælg først en CSV-fil.";
      return;
    }
    try {
      const text = await file.text();
      const parsed = studentsFromCsvText(text);
      students = parsed.students;

      students.forEach(s => {
        s.present = { fredag:true, lørdag:true, søndag:true };
        s.roles = { kitchenCrew:false };
        s.overrides = { maxNonCleaningTasksWeekend:1, excludeNonCleaningTasks:false };
        s.leaveSat12 = false;
      });

      csvInfoEl.textContent = `Indlæst: ${students.length} elever · delimiter "${parsed.delim}" · headers ${parsed.headers.length}.`;
      regenerateAndRender();
    } catch (err) {
      console.error(err);
      csvInfoEl.textContent = "Kunne ikke indlæse CSV. Tjek format/kolonnenavne.";
    }
  });

  regenerateAndRender();
})();
