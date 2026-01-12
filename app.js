const App={
 data: JSON.parse(localStorage.getItem('weekend-data')||'{}'),
 save(){localStorage.setItem('weekend-data',JSON.stringify(this.data));},
 reset(){localStorage.removeItem('weekend-data');location.reload();}
};

const UI={
 show(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='weekend')UI.renderWeekend();
  if(id==='sunday')UI.renderSunday();
  if(id==='brand')UI.renderBrand();
  if(id==='help')UI.renderHelp();
 }
};

const Demo={
 load(){
  const houses=['Komponisten','Tankegangen','Mellemtiden','Vest','Øst','Treenigheden','Arken','Rebild','Sibelius','Einstein'];
  App.data.students=[];
  for(let i=1;i<=150;i++){
    const house=houses[i%houses.length];
    App.data.students.push({
      id:i,name:'Elev '+i,house,room:String((i%20)+1),
      weekend:Math.random()<0.6,returned:false
    });
  }
  App.save();UI.show('weekend');
 }
};

UI.renderWeekend=function(){
 const el=document.getElementById('weekend');
 el.innerHTML='<h2>Weekendvagt</h2>';
 (App.data.students||[]).filter(s=>s.weekend).forEach(s=>{
  el.innerHTML+=`<div class="student"><div><b>${s.name}</b><br>${s.house} · ${s.room}</div>
  <input type="checkbox" checked onchange="s.weekend=this.checked;App.save();UI.renderWeekend()"></div>`;
 });
};

UI.renderSunday=function(){
 const el=document.getElementById('sunday');
 el.innerHTML='<h2>Søndagsliste</h2>';
 (App.data.students||[]).forEach(s=>{
  el.innerHTML+=`<div class="student"><div>${s.name}</div>
  <input type="checkbox" ${s.weekend?'checked':''} onchange="s.returned=this.checked;App.save()"></div>`;
 });
};

UI.renderBrand=function(){
 const el=document.getElementById('brand');
 el.innerHTML='<h2>Brandliste</h2>';
 const g={};
 (App.data.students||[]).filter(s=>s.weekend).forEach(s=>{
  const k=s.house+' '+s.room;g[k]=(g[k]||0)+1;
 });
 for(const k in g)el.innerHTML+=`<div>${k}: ${g[k]}</div>`;
};

UI.renderHelp=function(){
 document.getElementById('help').innerHTML='<h2>Quickstart</h2><p>Indlæs demo eller Excel. Alt gemmes lokalt.</p>';
};

document.getElementById('fileInput').addEventListener('change',e=>{
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();
 r.onload=ev=>{
  const wb=XLSX.read(ev.target.result,{type:'binary'});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  App.data.students=rows.map((r,i)=>({
    id:i,name:r.Navn||r.Fornavn+' '+r.Efternavn,
    house:r.StudentHouse||r.Hus,room:r.Værelse||'',
    weekend:(r['Hvor er du i weekenden? (6087)']||'').includes('HU'),
    returned:false
  }));
  App.save();UI.show('weekend');
 };
 r.readAsBinaryString(f);
});

UI.show('weekend');
