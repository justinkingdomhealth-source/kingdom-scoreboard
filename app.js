// ══════════════════ SEED ══════════════════
const SEED={
  members:[
    {id:'m1', name:'Mike B',         emoji:'🚴🏻‍♂️',division:1},
    {id:'m2', name:'Doug D',         emoji:'🩸',   division:1},
    {id:'m3', name:'Jon O',          emoji:'🎣',   division:1},
    {id:'m4', name:'Eamon',          emoji:'🙏🏻', division:1},
    {id:'m5', name:'AJ',             emoji:'🌹',   division:2},
    {id:'m6', name:'Malik A',        emoji:'🌎',   division:2},
    {id:'m7', name:'Parker J',       emoji:'🧊',   division:2},
    {id:'m8', name:'Ben K',          emoji:'🔮',   division:2},
    {id:'m9', name:'Gabby',          emoji:'🎀',   division:3},
    {id:'m10',name:'Caine',          emoji:'🍊',   division:3},
    {id:'m11',name:'Spencer H',      emoji:'🎰',   division:3},
    {id:'m12',name:'Jessica Wilson', emoji:'💅',   division:3},
  ],
  scores:{
    m1:{medicare:0,ancillary:0,life:0,uhc:0},
    m2:{medicare:0,ancillary:0,life:0,uhc:0},
    m3:{medicare:0,ancillary:0,life:0,uhc:0},
    m4:{medicare:0,ancillary:0,life:0,uhc:0},
    m5:{medicare:0,ancillary:0,life:0,uhc:0},
    m6:{medicare:0,ancillary:0,life:0,uhc:0},
    m7:{medicare:0,ancillary:0,life:0,uhc:0},
    m8:{medicare:0,ancillary:0,life:0,uhc:0},
    m9:{medicare:0,ancillary:0,life:0,uhc:0},
    m10:{medicare:0,ancillary:0,life:0,uhc:0},
    m11:{medicare:0,ancillary:0,life:0,uhc:0},
    m12:{medicare:0,ancillary:0,life:0,uhc:0},
  },
  running:{
    m1:{medicare:0,ancillary:0,life:0},
    m2:{medicare:0,ancillary:0,life:0},
    m3:{medicare:0,ancillary:0,life:0},
    m4:{medicare:0,ancillary:0,life:0},
    m5:{medicare:0,ancillary:0,life:0},
    m6:{medicare:0,ancillary:0,life:0},
    m7:{medicare:0,ancillary:0,life:0},
    m8:{medicare:0,ancillary:0,life:0},
    m9:{medicare:0,ancillary:0,life:0},
    m10:{medicare:0,ancillary:0,life:0},
    m11:{medicare:0,ancillary:0,life:0},
    m12:{medicare:0,ancillary:0,life:0}},
  champs:{},history:[],pw:'king1',
  updated:new Date().toISOString()
};

const PRODS=[{key:'medicare',label:'Medicare'},{key:'ancillary',label:'Ancillary'},{key:'life',label:'Life Ins.'}];
const CAT_MAP=[{words:['medicare'],key:'medicare'},{words:['ancillary'],key:'ancillary'},{words:['life'],key:'life'}];
const DRIVE='mcp__e2e0a882-ce76-4636-b5f7-199957a698c8';
const LOCAL_KEY='khg_v13';

let db=(()=>{try{const s=localStorage.getItem(LOCAL_KEY);if(s){const p=JSON.parse(s);if(p.members?.length)return p;}}catch(e){}return JSON.parse(JSON.stringify(SEED));})();
let curView='total',pendingAction=null,parsedScores=null;

function save(){db.updated=new Date().toISOString();try{localStorage.setItem(LOCAL_KEY,JSON.stringify(db));}catch(e){}}
let _st=null;
function debouncedSave(){clearTimeout(_st);_st=setTimeout(()=>{save();render();},500);}

// ── PUBLISH TO TEAM ──
// Works in three environments, in priority order:
//   1. Cowork (window.cowork present)        -> publish a JSON file to Google Drive (original behavior)
//   2. Deployed web + Supabase configured    -> push the shared board row to the cloud (everyone sees it)
//   3. Local-only (no cloud configured)      -> save to this browser only, tell the user honestly
function flashPub(text,revert){const btn=document.getElementById('pubBtn');if(!btn)return;btn.textContent=text;btn.disabled=revert;if(revert)setTimeout(()=>{btn.textContent='📢 Publish to Team';btn.disabled=false;},2500);}
async function publishToTeam(){
  flashPub('📡 Publishing…',true);
  save();
  // 1) Cowork / Google Drive
  if(window.cowork&&window.cowork.callMcpTool){
    try{
      await window.cowork.callMcpTool(`${DRIVE}__create_file`,{
        title:'KHG_Scoreboard_LIVE.json',
        textContent:JSON.stringify(db),
        contentMimeType:'application/json',
        disableConversionToGoogleType:true
      });
      flashPub('✅ Published!',true);
    }catch(e){flashPub('⚠️ Failed',true);}
    return;
  }
  // 2) Deployed web with Supabase cloud sync
  if(window.cloudSync&&window.cloudSync.enabled){
    try{await window.cloudSync.push(db);flashPub('✅ Published!',true);}
    catch(e){flashPub('⚠️ Failed',true);}
    return;
  }
  // 3) Local-only mode
  flashPub('💾 Saved on this device',true);
}

// ── LOAD THE BOARD on open ──
// Cowork: pull the latest from Google Drive. Deployed web: lib/cloud.js has already
// pulled the shared Supabase row into localStorage before this script loaded, so we
// just render what's there.
async function initFromDrive(){
  const cached=(()=>{try{const s=localStorage.getItem(LOCAL_KEY);if(s){const p=JSON.parse(s);if(p.members?.length)return p;}}catch(e){}return null;})();
  // cloud.js may have seeded localStorage from the shared cloud row before we
  // loaded — that data is untrusted, so it goes through cleanBoard like any
  // other cloud input. (Purely-local data passes through unchanged.)
  if(cached){db=cleanBoard(cached)||db;}
  render();
  if(!(window.cowork&&window.cowork.callMcpTool))return; // web: cloud.js already synced
  try{
    const r=await window.cowork.callMcpTool(`${DRIVE}__search_files`,{query:"title contains 'KHG_Scoreboard_LIVE'",pageSize:10});
    const data=r.structuredContent??JSON.parse(r.content[0].text);
    const files=(data.files||[]).sort((a,b)=>new Date(b.modifiedTime||0)-new Date(a.modifiedTime||0));
    if(files.length){
      const r2=await window.cowork.callMcpTool(`${DRIVE}__download_file_content`,{fileId:files[0].id});
      const d2=r2.structuredContent??JSON.parse(r2.content[0].text);
      const raw=d2.content||d2.base64Content||d2.fileContent||d2.data;
      if(raw){const cb=cleanBoard(JSON.parse(atob(raw)));if(cb){db=cb;try{localStorage.setItem(LOCAL_KEY,JSON.stringify(db));}catch(e){}render();}}
    }
  }catch(e){/* use cached/seed */}
}

// ── CLOUD DATA HYGIENE ──
// The shared cloud row is writable by anyone with the site URL (that's the
// tradeoff for a no-login team board), so anything coming FROM the cloud is
// untrusted: rebuild it field-by-field, strip markup from strings, whitelist
// ids, and coerce numbers. Returns null if the blob isn't a plausible board.
function cleanBoard(data){
  try{
    if(!data||typeof data!=='object'||!Array.isArray(data.members))return null;
    const str=v=>String(v==null?'':v).replace(/[<>]/g,'').slice(0,120);
    const num=v=>{const n=Number(v);return isFinite(n)&&n>=0?Math.round(n):0;};
    const cnt=o=>({medicare:num(o&&o.medicare),ancillary:num(o&&o.ancillary),life:num(o&&o.life),uhc:num(o&&o.uhc)});
    const out={members:[],scores:{},running:{},champs:{},history:[],pw:String(data.pw||'king1').slice(0,64),updated:str(data.updated)};
    data.members.slice(0,200).forEach((m,i)=>{
      if(!m||typeof m!=='object')return;
      let id=String(m.id||'');if(!/^[\w-]{1,40}$/.test(id))id='fx'+i;
      const d=Number(m.division);
      out.members.push({id,name:str(m.name)||('Member '+(i+1)),emoji:str(m.emoji)||'⭐',division:d>=1&&d<=3?Math.round(d):3,inactive:!!m.inactive,hiddenFromBoard:!!m.hiddenFromBoard});
      out.scores[id]=cnt(data.scores&&data.scores[m.id]);
      out.running[id]=cnt(data.running&&data.running[m.id]);
      const c=(data.champs&&data.champs[m.id])||{};out.champs[id]={div1:num(c.div1),div2:num(c.div2),div3:num(c.div3)};
    });
    if(!out.members.length)return null;
    if(Array.isArray(data.history))out.history=data.history.slice(0,240).map(h=>({
      month:str(h&&h.month),d1:str(h&&h.d1),d2:str(h&&h.d2),d3:str(h&&h.d3),
      d1emoji:str(h&&h.d1emoji),d2emoji:str(h&&h.d2emoji),d3emoji:str(h&&h.d3emoji),
      up:Array.isArray(h&&h.up)?h.up.slice(0,20).map(x=>({name:str(x&&x.name),emoji:str(x&&x.emoji),from:num(x&&x.from),to:num(x&&x.to)})):[],
      dn:Array.isArray(h&&h.dn)?h.dn.slice(0,20).map(x=>({name:str(x&&x.name),emoji:str(x&&x.emoji),from:num(x&&x.from),to:num(x&&x.to)})):[],
      snapshot:(h&&h.snapshot&&typeof h.snapshot==='object')?Object.fromEntries(Object.entries(h.snapshot).slice(0,200).map(([k,s])=>[str(k),{name:str(s&&s.name),emoji:str(s&&s.emoji),division:num(s&&s.division),medicare:num(s&&s.medicare),ancillary:num(s&&s.ancillary),life:num(s&&s.life),uhc:num(s&&s.uhc),total:num(s&&s.total)}])):{}
    }));
    return out;
  }catch(e){return null;}
}

// ── LIVE UPDATES (web) ──
// lib/cloud.js calls this whenever the shared board changes in the cloud
// (another device saved). We sanitize, make sure it's strictly NEWER than what
// we're showing (a stale echo must never revert local edits), wait out any
// open edit modal, then swap it in and re-render on the spot.
function editModalOpen(){return ['adminOvr','pasteOvr','cmOvr'].some(id=>{const el=document.getElementById(id);return el&&!el.classList.contains('hidden');});}
window.applyCloudData=function(data){
  const clean=cleanBoard(data);
  if(!clean)return;
  if(db&&db.updated){
    const a=Date.parse(clean.updated),b=Date.parse(db.updated);
    if(!(a>b))return; // only strictly-newer versions may replace what we show
  }
  if(editModalOpen()){ // don't yank data out from under an admin mid-edit
    window.__pendingCloud=clean;
    clearTimeout(window.__cloudRetry);
    window.__cloudRetry=setTimeout(()=>{const p=window.__pendingCloud;window.__pendingCloud=null;if(p)window.applyCloudData(p);},1500);
    return;
  }
  db=clean;
  try{localStorage.setItem(LOCAL_KEY,JSON.stringify(db));}catch(e){}
  render();
};
function monthTotal(id){const s=db.scores[id]||{};return(s.medicare||0)+(s.ancillary||0)+(s.life||0);}
function runningTotal(id){const r=db.running?.[id]||{};return(r.medicare||0)+(r.ancillary||0)+(r.life||0);}
function pScore(id,p){return(db.scores[id]||{})[p]||0;}

// ── STARS ──
(()=>{
  const el=document.getElementById('stars');
  for(let i=0;i<130;i++){const s=document.createElement('div');s.className='star';const sz=Math.random()*2.5+.5;s.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;--d:${2+Math.random()*4}s;--delay:${-Math.random()*5}s;--lo:${.05+Math.random()*.12};--hi:${.3+Math.random()*.6}`;el.appendChild(s);}
  document.getElementById('monthBadge').textContent=new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
})();

// ── TABS ──
function setTab(btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  curView=btn.dataset.view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+curView).classList.add('active');
  render();
}

// ── RENDER ──
function render(){renderTotal();PRODS.forEach(p=>renderProd(p.key));renderAllTime();renderLastUp();}

function divM(div){return db.members.filter(m=>m.division==div && !m.inactive && !m.hiddenFromBoard).sort((a,b)=>monthTotal(b.id)-monthTotal(a.id));}

function renderTotal(){document.getElementById('div-sections').innerHTML=[1,2,3].map(d=>buildDiv(d)).join('');}

const DICONS={1:'👑',2:'🛡️',3:'🔥'};
const DNAMES={1:'Division 1',2:'Division 2',3:'Division 3'};
const DSUBS={1:'Elite Tier',2:'Challenger Tier',3:'Rising Stars'};

function buildDiv(div){
  const ms=divM(div),n=ms.length;
  let body='';
  if(!n){body='<div class="div-empty">No members in this division.</div>';}
  else if(div===1&&n>=2){
    const pc=Math.min(3,n),pm=ms.slice(0,pc),rm=ms.slice(pc);
    body+=buildPodium(pm,ms[n-1].id,n===pc);
    if(rm.length){body+='<div class="drows" style="margin-top:14px">';rm.forEach((m,i)=>body+=buildDRow(m,pc+i+1,div,false,i===rm.length-1));body+='</div>';}
  }else{
    body='<div class="drows">';ms.forEach((m,i)=>body+=buildDRow(m,i+1,div,i===0&&div>1,i===n-1&&div<3));body+='</div>';
  }
  return `<div class="div-section d${div} anim"><div class="div-hd"><div class="div-hd-l"><div class="div-icon-big">${DICONS[div]}</div><div><div class="div-name">${DNAMES[div]}</div><div class="div-sub">${DSUBS[div]}</div></div></div><div class="div-pill">${n} member${n!==1?'s':''}</div></div><div class="div-body">${body}</div></div>`;
}

function buildPodium(ms,relId,lastIsPodium){
  const disp=ms.length>=3?[ms[1],ms[0],ms[2]]:[ms[1]||null,ms[0],null];
  const cls=['ps2','ps1','ps3'],med=['🥈','🥇','🥉'];
  let h='<div class="podium">';
  disp.forEach((m,i)=>{
    if(!m)return;const t=monthTotal(m.id),isR=lastIsPodium&&m.id===relId;const ch=db.champs[m.id]||{};
    h+=`<div class="pslot ${cls[i]}${isR?' p-relegate':''}"><div class="pperson"><div class="pmedal">${med[i]}</div><div class="pemoji">${m.emoji}</div><div class="pname">${m.name}</div><div style="min-height:16px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${champBadges(ch)}</div><div class="pscore">${t}</div><div class="punit">this month</div>${isR?'<div style="font-size:11px;color:#f87171;margin-top:2px">⬇️ danger zone</div>':''}</div><div class="pstep"></div></div>`;
  });
  return h+'</div>';
}

function buildDRow(m,rank,div,isP,isR){
  const t=monthTotal(m.id),ch=db.champs[m.id]||{};
  return `<div class="drow${isP?' promo':''}${isR?' relegate':''}"><div class="drow-rank">${rank}</div><div class="drow-emoji">${m.emoji}</div><div class="drow-info"><div class="drow-name">${m.name}</div><div class="drow-badges">${champBadges(ch)}</div></div>${isP?'<div class="zone-arrow">⬆️</div>':''}${isR?'<div class="zone-arrow">⬇️</div>':''}<div><div class="drow-score">${t}</div><div class="drow-unit">this month</div></div></div>`;
}

function renderProd(prod){
  const el=document.getElementById('lb-'+prod);
  const sorted=[...db.members].filter(m=>!m.inactive&&!m.hiddenFromBoard).sort((a,b)=>pScore(b.id,prod)-pScore(a.id,prod));
  let rank=0,last=-1;
  el.innerHTML=sorted.map((m,i)=>{const s=pScore(m.id,prod);if(s!==last){rank=i+1;last=s;}const rCls=rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';const ch=db.champs[m.id]||{};
    return `<div class="lb-row ${rCls} anim"><div class="lb-rank-num">${rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank}</div><div class="lb-emoji">${m.emoji}</div><div class="lb-name"><div>${m.name}</div><div class="lb-badges">${champBadges(ch)}</div></div><div><div class="lb-score ${s===0?'zero-score':''}">${s}</div><div class="lb-unit">policies</div></div></div>`;
  }).join('');
}

function renderAllTime(){
  const el=document.getElementById('lb-alltime');
  const sorted=[...db.members].filter(m=>!m.inactive).sort((a,b)=>runningTotal(b.id)-runningTotal(a.id));
  let rank=0,last=-1;
  el.innerHTML=sorted.map((m,i)=>{
    const t=runningTotal(m.id);if(t!==last){rank=i+1;last=t;}
    const r=db.running?.[m.id]||{};
    const atCls=rank===1?'at-1':rank===2?'at-2':rank===3?'at-3':'';
    const breakdown=PRODS.filter(p=>(r[p.key]||0)>0).map(p=>`<span class="at-chip">${p.label}: ${r[p.key]||0}</span>`).join('');
    return `<div class="alltime-row ${atCls} anim"><div class="at-rank">${rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank}</div><div class="lb-emoji">${m.emoji}</div><div><div class="lb-name">${m.name}</div><div class="at-breakdown">${breakdown||'<span style="color:#374151;font-size:11px">No deals yet</span>'}</div></div><div><div class="at-total ${t===0?'zero-score':''}">${t}</div><div class="at-label">total deals</div></div></div>`;
  }).join('');
}

function champBadges(ch){const p=[];if(ch?.div1)p.push(`<span class="cbadge cb1">👑×${ch.div1}</span>`);if(ch?.div2)p.push(`<span class="cbadge cb2">🛡️×${ch.div2}</span>`);if(ch?.div3)p.push(`<span class="cbadge cb3">🔥×${ch.div3}</span>`);return p.join('');}

function renderLastUp(){const el=document.getElementById('lastup');if(db.updated){const d=new Date(db.updated);el.textContent=`Updated ${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})} at ${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;}else el.textContent='';}

// ══════════════════ PASSWORD GATE ══════════════════
function openGate(action){
  pendingAction=action;
  document.getElementById('pwInp').value='';document.getElementById('pwErr').style.display='none';
  document.getElementById('pwOvr').classList.remove('hidden');
  setTimeout(()=>document.getElementById('pwInp').focus(),80);
}
function closeGate(){document.getElementById('pwOvr').classList.add('hidden');pendingAction=null;}
function checkPw(){
  if(document.getElementById('pwInp').value===db.pw){
    document.getElementById('pwOvr').classList.add('hidden');
    if(pendingAction==='paste')openPaste();
    else if(pendingAction==='cm')openCM();
    else if(pendingAction==='admin')openAdmin();
    else if(pendingAction==='publish')publishToTeam();
    pendingAction=null;
  }else{document.getElementById('pwErr').style.display='block';}
}

// ══════════════════ PASTE ══════════════════
function openPaste(){document.getElementById('pasteArea').value='';document.getElementById('parsePreview').innerHTML='';document.getElementById('pasteMsg').textContent='';document.getElementById('applyBtn').style.display='none';parsedScores=null;document.getElementById('pasteOvr').classList.remove('hidden');setTimeout(()=>document.getElementById('pasteArea').focus(),80);}
function closePaste(){document.getElementById('pasteOvr').classList.add('hidden');}
function detectCat(line){const l=line.toLowerCase();for(const c of CAT_MAP){if(c.words.some(w=>l.includes(w)))return c.key;}return null;}
function findMember(raw){
  const clean=raw.replace(/[\u{1F000}-\u{1FFFF}]|[☀-⟿]|[︀-️]|️/gu,'').replace(/[^\w\s]/g,'').trim().toLowerCase();
  if(!clean)return null;
  const active=db.members.filter(x=>!x.inactive);
  let m=active.find(x=>x.name.toLowerCase()===clean);if(m)return m;
  m=active.find(x=>x.name.toLowerCase().startsWith(clean)||clean.startsWith(x.name.toLowerCase()));if(m)return m;
  const tokens=clean.split(/\s+/).filter(Boolean);
  return active.find(x=>tokens.every(t=>x.name.toLowerCase().includes(t)))||null;
}
function previewPaste(){
  const text=document.getElementById('pasteArea').value.trim();
  if(!text){document.getElementById('pasteMsg').className='msg er';document.getElementById('pasteMsg').textContent='Paste something first.';return;}
  parsedScores={};const items=[];let cat=null;
  for(const raw of text.split('\n')){
    const line=raw.trim();if(!line)continue;
    const c=detectCat(line);if(c&&!/\d+\s*$/.test(line)){cat=c;continue;}
    if(!cat)continue;
    const m=line.match(/^(.+?)[-–]\s*(\d+)\s*$/);if(!m)continue;
    const member=findMember(m[1].trim());const score=parseInt(m[2]);
    if(member){
      if(!parsedScores[member.id])parsedScores[member.id]={};
      parsedScores[member.id][cat]=score;
      items.push(`<div class="parse-item p-ok">✓ ${member.emoji} <strong>${member.name}</strong> → ${PRODS.find(p=>p.key===cat)?.label}: <strong>${score}</strong></div>`);
    }else{
      items.push(`<div class="parse-item p-skip">✗ No match: "<strong>${m[1].trim()}</strong>"</div>`);
    }
  }
  const prev=document.getElementById('parsePreview');
  if(!items.length){prev.innerHTML='<div class="msg er" style="margin-top:10px">No scores found. Check the format.</div>';document.getElementById('applyBtn').style.display='none';}
  else{prev.innerHTML=`<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:12px 0 8px">Preview — ${items.length} entries</div>`+items.join('');document.getElementById('applyBtn').style.display='inline-flex';document.getElementById('pasteMsg').textContent='';}
}
function applyPaste(){
  if(!parsedScores)return;
  Object.entries(parsedScores).forEach(([id,cats])=>{if(!db.scores[id])db.scores[id]={medicare:0,ancillary:0,life:0,uhc:0};Object.entries(cats).forEach(([c,v])=>db.scores[id][c]=v);});
  db.updated=new Date().toISOString();save();render();closePaste();
}

// ══════════════════ CLOSE MONTH ══════════════════
function openCM(){
  const month=new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});
  document.getElementById('cmMonthName').textContent=month;
  document.getElementById('cmMsg').textContent='';

  // Preview what will happen (based on current state, BEFORE any changes)
  const s1=divM(1),s2=divM(2),s3=divM(3);
  const promoD2=s2[0]||null,promoD3=s3[0]||null;
  const relegD1=s1.length>1?s1[s1.length-1]:null;
  const relegD2=(s2.length>1&&promoD2&&s2[s2.length-1].id!==promoD2.id)?s2[s2.length-1]:null;

  let prev='';
  if(s1[0])prev+=`<div class="cm-preview-row">👑 Division 1 Champion: <strong>${s1[0].emoji} ${s1[0].name}</strong> (${monthTotal(s1[0].id)} deals)</div>`;
  if(s2[0])prev+=`<div class="cm-preview-row">🛡️ Division 2 Champion: <strong>${s2[0].emoji} ${s2[0].name}</strong> (${monthTotal(s2[0].id)} deals)</div>`;
  if(s3[0])prev+=`<div class="cm-preview-row">🔥 Division 3 Champion: <strong>${s3[0].emoji} ${s3[0].name}</strong> (${monthTotal(s3[0].id)} deals)</div>`;
  if(promoD2)prev+=`<div class="cm-preview-row" style="color:#22c55e">⬆️ ${promoD2.emoji} ${promoD2.name} → Division 1</div>`;
  if(promoD3)prev+=`<div class="cm-preview-row" style="color:#22c55e">⬆️ ${promoD3.emoji} ${promoD3.name} → Division 2</div>`;
  if(relegD1)prev+=`<div class="cm-preview-row" style="color:#f87171">⬇️ ${relegD1.emoji} ${relegD1.name} → Division 2</div>`;
  if(relegD2)prev+=`<div class="cm-preview-row" style="color:#f87171">⬇️ ${relegD2.emoji} ${relegD2.name} → Division 3</div>`;
  if(!prev)prev='<div style="color:#6b7280;font-size:13px">No members to process.</div>';
  document.getElementById('cmPreview').innerHTML=prev;
  document.getElementById('cmOvr').classList.remove('hidden');
}
function closeCM(){document.getElementById('cmOvr').classList.add('hidden');}

function executeCloseMonth(){
  const monthStr=new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'});

  // ── STEP 1: Capture state BEFORE any changes ──
  const s1=divM(1),s2=divM(2),s3=divM(3);

  // Champions
  const champ1=s1[0]||null,champ2=s2[0]||null,champ3=s3[0]||null;
  function award(m,key){if(!m)return;if(!db.champs[m.id])db.champs[m.id]={div1:0,div2:0,div3:0};db.champs[m.id][key]=(db.champs[m.id][key]||0)+1;}
  award(champ1,'div1');award(champ2,'div2');award(champ3,'div3');

  // ── STEP 2: Determine movements from ORIGINAL sorted lists ──
  const promoD2=s2[0]||null;   // top of Div 2 → Div 1
  const promoD3=s3[0]||null;   // top of Div 3 → Div 2
  const relegD1=s1.length>1?s1[s1.length-1]:null;  // bottom of Div 1 → Div 2
  // Bottom of Div 2, but NOT the person being promoted (promoD2)
  let relegD2=null;
  if(s2.length>1){const last=s2[s2.length-1];if(!promoD2||last.id!==promoD2.id)relegD2=last;}

  const up=[],dn=[];
  // ── STEP 3: Add current scores to running totals BEFORE reset ──
  if(!db.running)db.running={};
  db.members.forEach(m=>{
    if(!db.running[m.id])db.running[m.id]={medicare:0,ancillary:0,life:0,uhc:0};
    PRODS.forEach(p=>{db.running[m.id][p.key]=(db.running[m.id][p.key]||0)+(db.scores[m.id]?.[p.key]||0);});
  });

  // ── STEP 4: Save snapshot for history ──
  const snapshot={};
  db.members.forEach(m=>{
    const s=db.scores[m.id]||{};
    snapshot[m.id]={name:m.name,emoji:m.emoji,division:m.division,
      medicare:s.medicare||0,ancillary:s.ancillary||0,life:s.life||0,uhc:s.uhc||0,
      total:monthTotal(m.id)};
  });

  // ── STEP 5: Apply division changes ──
  if(promoD2){promoD2.division=1;up.push({name:promoD2.name,emoji:promoD2.emoji,from:2,to:1});}
  if(promoD3){promoD3.division=2;up.push({name:promoD3.name,emoji:promoD3.emoji,from:3,to:2});}
  if(relegD1){relegD1.division=2;dn.push({name:relegD1.name,emoji:relegD1.emoji,from:1,to:2});}
  if(relegD2){relegD2.division=3;dn.push({name:relegD2.name,emoji:relegD2.emoji,from:2,to:3});}

  // ── STEP 6: Reset monthly scores ──
  db.members.forEach(m=>{db.scores[m.id]={medicare:0,ancillary:0,life:0,uhc:0};});

  // ── STEP 7: Save history ──
  if(!db.history)db.history=[];
  db.history.push({
    month:monthStr,
    d1:champ1?.name||'',d2:champ2?.name||'',d3:champ3?.name||'',
    d1emoji:champ1?.emoji||'',d2emoji:champ2?.emoji||'',d3emoji:champ3?.emoji||'',
    up,dn,snapshot
  });

  db.updated=new Date().toISOString();
  save();render();closeCM();

  const msg=document.getElementById('cmMsg');
  msg.className='msg ok';
  msg.innerHTML='✅ Month closed! Check History to see the full recap.';

  const cel=document.createElement('div');cel.className='celebrate';cel.textContent='🏆';document.body.appendChild(cel);setTimeout(()=>cel.remove(),2200);
}

// ══════════════════ HISTORY ══════════════════
function openHistory(){
  const el=document.getElementById('histItems');
  if(!db.history?.length){el.innerHTML='<div style="color:#6b7280;font-size:13px;padding:16px 0;text-align:center">No closed months yet.</div>';}
  else{
    el.innerHTML=[...db.history].reverse().map((h,i)=>{
      const idx=db.history.length-1-i;
      const upStr=h.up?.map(x=>`${x.emoji} ${x.name} D${x.from}→D${x.to}`).join(' · ')||'';
      const dnStr=h.dn?.map(x=>`${x.emoji} ${x.name} D${x.from}→D${x.to}`).join(' · ')||'';
      return `<div class="hitem" onclick="openHD(${idx})">
        <div class="hmonth">${h.month} <span style="font-size:12px;color:#4b5563;font-weight:400">→ click to view</span></div>
        <div class="hchamps">👑 ${h.d1emoji||''} ${h.d1||'—'} &nbsp;🛡️ ${h.d2emoji||''} ${h.d2||'—'} &nbsp;🔥 ${h.d3emoji||''} ${h.d3||'—'}</div>
        ${upStr?`<div class="hmov mov-up">⬆️ ${upStr}</div>`:''}
        ${dnStr?`<div class="hmov mov-dn">⬇️ ${dnStr}</div>`:''}
      </div>`;
    }).join('');
  }
  document.getElementById('histOvr').classList.remove('hidden');
}
function closeHistory(){document.getElementById('histOvr').classList.add('hidden');}

function openHD(idx){
  const h=db.history[idx];if(!h)return;
  document.getElementById('hdTitle').textContent='📅 '+h.month;
  const snap=h.snapshot||{};
  const sorted=Object.entries(snap).map(([id,d])=>({id,...d})).sort((a,b)=>b.total-a.total);
  let html=`<div class="hd-section">
    <div class="hd-section-title">Division Champions</div>
    <div class="hd-champs">
      ${h.d1?`<div class="hd-champ" style="border-color:rgba(212,175,55,.3)"><div class="hd-champ-div">👑 Division 1</div><div class="hd-champ-name">${h.d1emoji||''} ${h.d1}</div></div>`:''}
      ${h.d2?`<div class="hd-champ" style="border-color:rgba(143,168,200,.25)"><div class="hd-champ-div">🛡️ Division 2</div><div class="hd-champ-name">${h.d2emoji||''} ${h.d2}</div></div>`:''}
      ${h.d3?`<div class="hd-champ" style="border-color:rgba(184,115,51,.25)"><div class="hd-champ-div">🔥 Division 3</div><div class="hd-champ-name">${h.d3emoji||''} ${h.d3}</div></div>`:''}
    </div>
  </div>`;

  if((h.up?.length||h.dn?.length)){
    html+=`<div class="hd-section"><div class="hd-section-title">Movements</div>`;
    h.up?.forEach(x=>{html+=`<div style="font-size:13px;color:#22c55e;padding:4px 0">⬆️ ${x.emoji} ${x.name} promoted: Division ${x.from} → Division ${x.to}</div>`;});
    h.dn?.forEach(x=>{html+=`<div style="font-size:13px;color:#f87171;padding:4px 0">⬇️ ${x.emoji} ${x.name} relegated: Division ${x.from} → Division ${x.to}</div>`;});
    html+=`</div>`;
  }

  html+=`<div class="hd-section"><div class="hd-section-title">Full Leaderboard — ${h.month}</div>`;
  sorted.forEach((m,i)=>{
    const breakdown=PRODS.filter(p=>m[p.key]>0).map(p=>`${p.label}: ${m[p.key]}`).join('  ·  ');
    const div=m.division;const divColor=div===1?'#d4af37':div===2?'#8fa8c8':'#b87333';
    html+=`<div class="hd-row">
      <div class="hd-rank">${i+1}</div>
      <div class="hd-emoji">${m.emoji}</div>
      <div style="flex:1"><div class="hd-name">${m.name}</div><div class="hd-breakdown">${breakdown||'No sales'} &nbsp;<span style="color:${divColor};font-size:10px;font-weight:700">Div ${div}</span></div></div>
      <div><div class="hd-score">${m.total}</div><div style="font-size:10px;color:#6b7280;text-align:right">total</div></div>
    </div>`;
  });
  html+=`</div>`;

  document.getElementById('hdContent').innerHTML=html;
  document.getElementById('histOvr').classList.add('hidden');
  document.getElementById('hdOvr').classList.remove('hidden');
}
function closeHD(){document.getElementById('hdOvr').classList.add('hidden');document.getElementById('histOvr').classList.remove('hidden');}

// ══════════════════ ADMIN ══════════════════
function openAdmin(){
  ['addMsg','saveMsg','pwChMsg'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='';});
  document.getElementById('nName').value='';document.getElementById('nEmoji').value='';
  renderAList();document.getElementById('adminOvr').classList.remove('hidden');
}
function closeAdmin(){document.getElementById('adminOvr').classList.add('hidden');}

function autoSaveScore(id,key,val,type){
  const v=Math.max(0,parseInt(val)||0);
  if(type==='s'){if(!db.scores[id])db.scores[id]={};db.scores[id][key]=v;}
  else{if(!db.running)db.running={};if(!db.running[id])db.running[id]={medicare:0,ancillary:0,life:0};db.running[id][key]=v;}
  debouncedSave();
}

function hideFromBoard(id){const m=db.members.find(x=>x.id===id);if(m){m.hiddenFromBoard=true;save();renderAList();render();}}
function restoreToBoard(id){const m=db.members.find(x=>x.id===id);if(m){m.hiddenFromBoard=false;save();renderAList();render();}}

function renderAList(){
  const el=document.getElementById('aList');
  const active=db.members.filter(m=>!m.inactive&&!m.hiddenFromBoard);
  const hidden=db.members.filter(m=>!m.inactive&&m.hiddenFromBoard);
  const archived=db.members.filter(m=>m.inactive);
  if(!active.length&&!archived.length){el.innerHTML='<div style="color:#4b5563;font-size:13px;text-align:center;padding:16px 0">No members yet.</div>';return;}
  const sorted=[...active].sort((a,b)=>a.division-b.division||(monthTotal(b.id)-monthTotal(a.id)));
  let html=sorted.map(m=>{const s=db.scores[m.id]||{};const r=db.running?.[m.id]||{};
    return `<div class="ambr"><div class="ambr-hd"><span style="font-size:20px">${m.emoji}</span><div class="ambr-name">${m.name}</div>
      <select class="inp bsm" style="width:auto;padding:5px 8px;font-size:12px" onchange="movDiv('${m.id}',this.value)">
        <option value="1" ${m.division==1?'selected':''}>Div 1</option>
        <option value="2" ${m.division==2?'selected':''}>Div 2</option>
        <option value="3" ${m.division==3?'selected':''}>Div 3</option>
      </select>
      <button class="btn bsm" style="background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.3);font-size:11px" onclick="hideFromBoard('${m.id}')">Remove from Board</button>
      <button class="btn bred bsm" onclick="rmMember('${m.id}')">Archive All</button></div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">This Month</div>
      <div class="sgrid">${PRODS.map(p=>`<div class="scell"><div class="sclbl">${p.label}</div><input type="number" min="0" class="scinp" id="s_${m.id}_${p.key}" value="${s[p.key]||0}" oninput="autoSaveScore('${m.id}','${p.key}',this.value,'s')"/></div>`).join('')}</div>
      <div style="font-size:10px;color:#d4af37;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px">📈 Historical Totals (Pre-Board)</div>
      <div class="sgrid">${PRODS.map(p=>`<div class="scell"><div class="sclbl">${p.label}</div><input type="number" min="0" class="scinp" id="r_${m.id}_${p.key}" value="${r[p.key]||0}" style="border-color:rgba(212,175,55,.4)" oninput="autoSaveScore('${m.id}','${p.key}',this.value,'r')"/></div>`).join('')}</div>
    </div>`;
  }).join('');
  if(hidden.length){
    html+=`<div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)"><div style="font-size:11px;color:#fbbf24;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">👻 Hidden from Board (All-Time still counts)</div>`;
    html+=hidden.map(m=>{const r=db.running?.[m.id]||{};const total=PRODS.reduce((t,p)=>t+(r[p.key]||0),0);
      return `<div class="ambr" style="opacity:.8;border-color:rgba(251,191,36,.2)"><div class="ambr-hd"><span style="font-size:20px">${m.emoji}</span><div class="ambr-name" style="color:#fbbf24">${m.name} <span style="font-size:10px;color:#6b7280">(hidden · ${total} all-time deals)</span></div>
        <button class="btn bsm" style="background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.3)" onclick="restoreToBoard('${m.id}')">↩ Restore to Board</button>
        <button class="btn bred bsm" onclick="deleteMemberForever('${m.id}')">🗑 Delete</button></div></div>`;
    }).join('');
    html+=`</div>`;
  }
  if(archived.length){
    html+=`<div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px">📦 Fully Archived (hidden everywhere)</div>`;
    html+=archived.map(m=>{const s=db.scores[m.id]||{};const r=db.running?.[m.id]||{};const total=PRODS.reduce((t,p)=>(t+(r[p.key]||0)),0);
      return `<div class="ambr" style="opacity:.7;border-color:rgba(107,114,128,.2)"><div class="ambr-hd"><span style="font-size:20px">${m.emoji}</span><div class="ambr-name" style="color:#6b7280">${m.name} <span style="font-size:10px;color:#4b5563">(archived · ${total} all-time deals)</span></div>
        <button class="btn bsm" style="background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.3)" onclick="reactivateMember('${m.id}')">↩ Restore</button>
        <button class="btn bred bsm" onclick="deleteMemberForever('${m.id}')">🗑 Delete</button></div>
      </div>`;
    }).join('');
    html+=`</div>`;
  }
  el.innerHTML=html;
}

function addMember(){
  const name=document.getElementById('nName').value.trim();
  const emoji=document.getElementById('nEmoji').value.trim()||'⭐';
  const div=parseInt(document.getElementById('nDiv').value);
  const msg=document.getElementById('addMsg');
  if(!name){msg.className='msg er';msg.textContent='Enter a name.';return;}
  if(db.members.find(m=>m.name.toLowerCase()===name.toLowerCase())){msg.className='msg er';msg.textContent='Already exists.';return;}
  const id='mbr_'+Date.now();
  db.members.push({id,name,emoji,division:div});
  db.scores[id]={medicare:0,ancillary:0,life:0,uhc:0};
  db.champs[id]={div1:0,div2:0,div3:0};
  if(!db.running)db.running={};
  db.running[id]={medicare:0,ancillary:0,life:0,uhc:0};
  save();
  document.getElementById('nName').value='';
  document.getElementById('nEmoji').value='⭐';
  document.getElementById('emojiBtn').textContent='⭐';
  document.querySelectorAll('.epick').forEach(el=>el.classList.remove('epick-selected'));
  msg.className='msg ok';msg.textContent=`✓ ${emoji} ${name} added!`;
  setTimeout(()=>msg.textContent='',2500);
  renderAList();render();
}
function rmMember(id){
  const m=db.members.find(x=>x.id===id);if(!confirm(`Archive ${m?.name}? Their data will be saved — you can restore them anytime.`))return;
  m.inactive=true;
  save();renderAList();render();
}
function reactivateMember(id){
  const m=db.members.find(x=>x.id===id);if(m){m.inactive=false;save();renderAList();render();}
}
function deleteMemberForever(id){
  const m=db.members.find(x=>x.id===id);if(!confirm(`Permanently delete ${m?.name} and ALL their data forever? This cannot be undone.`))return;
  db.members=db.members.filter(x=>x.id!==id);delete db.scores[id];delete db.champs[id];if(db.running)delete db.running[id];
  save();renderAList();render();
}
function movDiv(id,div){const m=db.members.find(x=>x.id===id);if(m){m.division=parseInt(div);save();render();}}
function saveScores(){
  if(!db.running)db.running={};
  db.members.forEach(m=>{
    if(!db.scores[m.id])db.scores[m.id]={};
    PRODS.forEach(p=>{const e=document.getElementById(`s_${m.id}_${p.key}`);if(e)db.scores[m.id][p.key]=Math.max(0,parseInt(e.value)||0);});
    if(!db.running[m.id])db.running[m.id]={medicare:0,ancillary:0,life:0,uhc:0};
    PRODS.forEach(p=>{const e=document.getElementById(`r_${m.id}_${p.key}`);if(e)db.running[m.id][p.key]=Math.max(0,parseInt(e.value)||0);});
  });
  db.updated=new Date().toISOString();save();
  const msg=document.getElementById('saveMsg');msg.className='msg ok';msg.textContent='✅ Saved!';setTimeout(()=>msg.textContent='',2500);render();
}
function changePw(){
  const pw=document.getElementById('nPw').value.trim();const msg=document.getElementById('pwChMsg');
  if(pw.length<4){msg.className='msg er';msg.textContent='Min 4 characters.';return;}
  db.pw=pw;save();document.getElementById('nPw').value='';msg.className='msg ok';msg.textContent='Updated!';setTimeout(()=>msg.textContent='',2500);
}

// ══════════════════ EMOJI PICKER ══════════════════
const EMOJI_LIST=[
  '⭐','🔥','💪','🏆','🎯','💰','👑','🚀','💎','⚡',
  '🌟','🎉','🏅','🎖️','🥇','💥','🎪','🌈','🦁','🐉',
  '🚴🏻‍♂️','🩸','🎣','🙏🏻','🌹','🌎','🧊','🔮','🎀','🍊',
  '🎰','💅','🌊','🎸','🦅','🐺','🏋️','🤝','💡','🎲',
  '🌙','☀️','❄️','🌴','🎭','🦊','🐯','🦋','🌺','🍀',
  '🎵','🎤','📊','💼','🏠','🚗','✈️','🎓','🏄','🤙',
  '👊','✌️','🤞','👆','🙌','💯','🆙','🔑','🛡️','⚔️',
  '🍕','☕','🎂','🍎','🦊','🐻','🦁','🐧','🦜','🐬'
];

function buildEmojiPicker(){
  const el=document.getElementById('emojiPicker');
  if(el.children.length)return;
  el.innerHTML=EMOJI_LIST.map(e=>`<span class="epick" onclick="selectEmoji('${e}')">${e}</span>`).join('');
}

function toggleEmojiPicker(){
  buildEmojiPicker();
  const el=document.getElementById('emojiPicker');
  el.classList.toggle('open');
}

function selectEmoji(e){
  document.getElementById('nEmoji').value=e;
  document.getElementById('emojiBtn').textContent=e;
  document.querySelectorAll('.epick').forEach(el=>el.classList.remove('epick-selected'));
  const picked=[...document.querySelectorAll('.epick')].find(el=>el.textContent===e);
  if(picked)picked.classList.add('epick-selected');
  document.getElementById('emojiPicker').classList.remove('open');
}

// Close emoji picker when clicking outside
document.addEventListener('click',function(e){
  const picker=document.getElementById('emojiPicker');
  const btn=document.getElementById('emojiBtn');
  if(picker&&btn&&!picker.contains(e.target)&&e.target!==btn){picker.classList.remove('open');}
});

initFromDrive();
