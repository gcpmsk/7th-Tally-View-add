/* ================= SATYAM GOLD — App ================= */
'use strict';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; };
const nowTS = () => new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
const fmt = n => (Math.round(n*100)/100).toLocaleString('en-IN');
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),2200); }

/* ---------- 3D background shapes ---------- */
(function(){
  const colors=['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6'];
  const bg=$('#bg3d');
  for(let i=0;i<14;i++){
    const s=document.createElement('div'); s.className='bg-shape';
    const sz=30+Math.random()*90;
    s.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*95}%;top:${Math.random()*95}%;background:${colors[i%7]};animation-delay:${-Math.random()*14}s;animation-duration:${10+Math.random()*10}s;`;
    bg.appendChild(s);
  }
})();

/* ---------- navigation ---------- */
const SCREENS={login:'login-screen',home:'home-screen',notebook:'notebook-screen',sbook:'sbook-screen',orderbook:'orderbook-screen',tally:'tally-screen',attendance:'attendance-screen',call:'call-screen',emergency:'emergency-screen',chatai:'chatai-screen',recordbook:'recordbook-screen',recorddates:'recorddates-screen',recordview:'recordview-screen',printhome:'printhome-screen',changerec:'changerec-screen',cloud:'cloud-screen'};
let go=function(name){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $('#'+ (SCREENS[name]||SCREENS.home)).classList.add('active');
  window.scrollTo(0,0);
  if(name==='notebook') renderAll();
  if(name==='printhome') renderPrintHome();
  if(name==='sbook' && typeof renderSBook==='function') renderSBook();
  if(name==='tally' && typeof window.tvOpen==='function') window.tvOpen();
  if(name==='changerec') renderChangeRec();
}
/* 🕘 Change Record — पूरे system का date-wise बदलाव record (सिर्फ़ पढ़ने के लिए) */
function renderChangeRec(){
  const el=document.getElementById('chg-body'); if(!el) return;
  const all=readChangeLog().slice().sort((a,b)=>(b.t||0)-(a.t||0));
  if(!all.length){ el.innerHTML='<div class="chg-empty">— अभी कोई बदलाव record नहीं —<br><small>जो भी entry / paid / due बदलेगा वह यहाँ date + time के साथ save होगा</small></div>'; return; }
  const days={};
  all.forEach(x=>{ (days[x.date||'—']=days[x.date||'—']||[]).push(x); });
  el.innerHTML=Object.keys(days).sort((a,b)=>dateSortVal(b).localeCompare(dateSortVal(a))).map(d=>
    `<div class="chg-day"><h4>📅 ${esc(d)} — ${days[d].length} बदलाव</h4>
      ${days[d].map(x=>`<div class="chg-l">
        <div class="cl-t">🕐 ${esc(x.ts||'')}</div>
        <div class="cl-b"><b>${esc(x.name||'—')}</b> · <em>${esc(x.what||'')}</em>
          <div style="color:#7a869a;font-size:11px;">${esc(x.sec||'')}${x.note?' · '+esc(x.note):''}</div></div>
        <div class="cl-a ${x.old!==undefined&&x.neu!==undefined&&parseFloat(x.neu)<parseFloat(x.old)?'dn':''}">${x.old!==undefined&&x.old!==''?esc(String(x.old))+' → ':''}${x.neu!==undefined&&x.neu!==''?'₹'+esc(String(x.neu)):''}</div>
      </div>`).join('')}
    </div>`).join('');
}
window.renderChangeRec=renderChangeRec;
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');
  if(g){ go(g.dataset.go); }
});
$('#nb-back').addEventListener('click',()=>{
  if(CUR_DATE!==DATE){ exitEditDate(); renderAll(); toast('आज की तारीख़ पर वापस ✔'); }
  else go('home');
});

/* ---------- login ---------- */
$('#login-form').addEventListener('submit',e=>{
  e.preventDefault();
  if($('#lg-phone').value==='9631816666' && $('#lg-pass').value==='Satyam'){
    try{ sessionStorage.setItem('sg_login','1'); }catch(err){}
    go(hashScreen()||'home');
  }
  else { $('#login-err').style.display='block'; setTimeout(()=>$('#login-err').style.display='none',2500); }
});
/* Receipt/Slip page से वापस आने पर सीधे उसी screen पर — दोबारा login नहीं */
function hashScreen(){
  const h=(location.hash||'').replace('#','');
  if(h==='print') return 'printhome';
  if(h && SCREENS[h]) return h;
  return '';
}
window.addEventListener('DOMContentLoaded',()=>{
  let logged=false; try{ logged = sessionStorage.getItem('sg_login')==='1'; }catch(e){}
  if(logged){ const t=hashScreen(); go(t||'home'); }
});

/* ---------- state / storage ---------- */
const DATE = todayStr();
let CUR_DATE = DATE;           // date being rendered / edited
let KEY = 'sg_nb_'+DATE;
let DB = load();
migrate(DB);
let RECORD_EDIT = false;       // record-book back-date edit mode
function load(){ let d=null; try{ d=JSON.parse(localStorage.getItem(KEY)); }catch(e){ d=null; }
  if(!d) d=blank(); else { migrate(d); applyCarry(d,DATE); }
  return d; }
function blankRaw(){ return {opening:null,rokad:[],jama:[],maal:[],nagad:[],kharch:[],inhome:[],outhome:[],receipts:[],totals:null}; }
/* ---------- OUT HOME → अगले दिन रोकड (auto carry, self-healing) ---------- */
function ohArr(db){ const o=(db||{}).outhome; return Array.isArray(o)? o : (typeof o==='number'? [{amount:o}] : []); }
function ohSum(db){ return ohArr(db).reduce((a,x)=>a+(parseFloat(x.amount)||0),0); }
function dnum(ds){ const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(ds||''); return m? (+m[3])*10000+(+m[2])*100+(+m[1]) : 0; }
/* पिछले दिन जिसमें OUT HOME भरा गया — वहाँ जो बचा वह इस दिन का opening */
function carryFor(date){
  const tgt=dnum(date); if(!tgt) return null;
  let best=null,bestN=0;
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(!k || k.indexOf('sg_nb_')!==0) continue;
    const d=k.slice(6), n=dnum(d);
    if(!n || n>=tgt) continue;
    let db=null; try{ db=JSON.parse(localStorage.getItem(k)); }catch(e){ continue; }
    if(!db || db.outhome===null || db.outhome===undefined) continue;
    if(typeof db.outhome!=='number' && !(Array.isArray(db.outhome)&&db.outhome.length)) continue;
    if(n>bestN){ bestN=n; best=db; }
  }
  if(!best) return null;
  migrate(best);
  const T=computeTotals(best);
  return Math.round((T.grand - ohSum(best))*100)/100;
}
/* opening खाली हो तो पिछले दिन का बचा हुआ अपने आप भर दो */
function applyCarry(db,date){
  /* manual opening को कभी नहीं छेड़ेंगे — सिर्फ़ खाली या auto-carry वाला refresh होगा */
  if(db.opening!==null && db.opening!==undefined && !db.openingCarry) return db;
  const c=carryFor(date);
  if(c!==null && c!==undefined){ db.opening=c; db.openingCarry=true; }
  return db;
}
/* जिस दिन OUT HOME बदला — उसके बाद की सारी saved तारीख़ों का auto opening फिर से set */
function syncForwardCarry(fromDate){
  const base=dnum(fromDate); if(!base) return;
  const keys=[];
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf('sg_nb_')===0) keys.push(k); }
  keys.forEach(k=>{
    const d=k.slice(6); if(dnum(d)<=base) return;
    let db=null; try{ db=JSON.parse(localStorage.getItem(k)); }catch(e){ return; }
    if(!db) return;
    if(db.opening!==null && db.opening!==undefined && !db.openingCarry) return;
    migrate(db); applyCarry(db,d);
    localStorage.setItem(k,JSON.stringify(db));
  });
  /* आज की live DB भी refresh (अगर वह आगे की तारीख़ है) */
  if(dnum(CUR_DATE)>base && (DB.opening===null||DB.opening===undefined||DB.openingCarry)){ applyCarry(DB,CUR_DATE); save(); }
}
function blank(){ const b=blankRaw(); return applyCarry(b,DATE); }
/* back-date edit context */
function enterEditDate(d){ CUR_DATE=d; KEY='sg_nb_'+d; try{ DB=JSON.parse(localStorage.getItem(KEY))||blankRaw(); }catch(e){ DB=blankRaw(); } migrate(DB); applyCarry(DB,d); }
function exitEditDate(){ CUR_DATE=DATE; KEY='sg_nb_'+DATE; DB=load(); migrate(DB); }
/* edit stamp — जब भी कोई entry edit हो: समय (+ तारीख़ अगर back-date) + highlight */
function stampEdit(rec){ rec.edited=true; rec.ets=nowTS(); rec.edate = CUR_DATE!==DATE ? DATE : '';
  try{ logChange({sec:'notebook', what:'Edit', name:(rec.name||rec.label||'entry'), neu:(rec.amount!==undefined?rec.amount:(rec.total||'')), note:'Notebook '+(CUR_DATE||'')}); }catch(e){}
}
/* =========================================================
   🕘 CHANGE LOG — पूरे system का record (कोई delete/edit नहीं कर सकता)
========================================================= */
const CHG_KEY='sg_changelog';
function logChange(o){
  try{
    const a=JSON.parse(localStorage.getItem(CHG_KEY)||'[]');
    a.push(Object.assign({date:(typeof CUR_DATE!=='undefined'?CUR_DATE:todayStr()), ts:nowTS(), t:Date.now()},o||{}));
    localStorage.setItem(CHG_KEY,JSON.stringify(a.slice(-4000)));
  }catch(e){}
}
function readChangeLog(){ try{ return JSON.parse(localStorage.getItem(CHG_KEY)||'[]'); }catch(e){ return []; } }
window.logChange=logChange; window.readChangeLog=readChangeLog;

/* =========================================================
   🔎 PARTY SUGGEST — पूरे system का नाम+पता auto-fill
========================================================= */
function sgParties(){
  const map={};
  const add=(n,a,m)=>{ n=String(n||'').trim(); if(!n) return;
    const k=n.toUpperCase().replace(/\s+/g,' ')+'|'+String(a||'').trim().toUpperCase();
    if(!map[k]) map[k]={name:n,address:String(a||'').trim(),mob:m||''};
    else if(!map[k].address && a) map[k].address=String(a).trim();
    if(m && !map[k].mob) map[k].mob=m; };
  try{
    const man=JSON.parse(localStorage.getItem('sg_tv_manual')||'[]');
    (Array.isArray(man)?man:[]).forEach(p=>add(p.name,p.address,p.mob));
  }catch(e){}
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(!k) continue;
    try{
      if(k.indexOf('sg_nb_')===0){ const db=JSON.parse(localStorage.getItem(k))||{};
        ['jama','nagad','maal'].forEach(s=>(db[s]||[]).forEach(x=>add(x.name,x.address)));
      } else if(k.indexOf('sg_arcpt_')===0 || k.indexOf('sg_wrcpt_')===0){
        (JSON.parse(localStorage.getItem(k))||[]).forEach(r=>add(r.name||r.nameHi, r.address||r.addressHi));
      }
    }catch(e){}
  }
  try{ const mb=JSON.parse(localStorage.getItem('sg_mobiles')||'{}')||{};
    Object.values(map).forEach(p=>{ const kk=p.name.toUpperCase().replace(/\s+/g,' '); if(mb[kk]) p.mob=p.mob||mb[kk]; });
  }catch(e){}
  return Object.values(map);
}
window.sgParties=sgParties;
/* किसी भी name input पर suggestion box लगाओ */
function sgSuggest(nameInp, addrInp){
  if(!nameInp || nameInp.dataset.sgsug) return; nameInp.dataset.sgsug='1';
  const box=document.createElement('div'); box.className='sg-sug';
  nameInp.parentNode.style.position='relative';
  nameInp.parentNode.appendChild(box);
  const hide=()=>{ box.classList.remove('on'); box.innerHTML=''; };
  nameInp.addEventListener('input',()=>{
    const q=nameInp.value.trim().toUpperCase();
    if(q.length<1){ hide(); return; }
    const hits=sgParties().filter(p=>p.name.toUpperCase().includes(q)||String(p.address||'').toUpperCase().includes(q)).slice(0,8);
    if(!hits.length){ hide(); return; }
    box.innerHTML=hits.map((p,i)=>`<div class="sg-sug-i" data-i="${i}"><b>${esc(p.name)}</b>${p.address?`<i>(${esc(p.address)})</i>`:''}${p.mob?`<small>📱${esc(p.mob)}</small>`:''}</div>`).join('');
    box.classList.add('on');
    box.querySelectorAll('.sg-sug-i').forEach(el=>el.addEventListener('mousedown',ev=>{
      ev.preventDefault(); const p=hits[+el.dataset.i];
      nameInp.value=p.name; if(addrInp) addrInp.value=p.address||''; hide();
    }));
  });
  nameInp.addEventListener('blur',()=>setTimeout(hide,180));
}
window.sgSuggest=sgSuggest;
function editTag(r){ return r.edited? `<span class="ets">✎ ${r.ets}${r.edate?(' · '+r.edate):''}</span>`:''; }
function migrate(db){ ['rokad','jama','maal','nagad','kharch','inhome','receipts'].forEach(k=>{ if(!Array.isArray(db[k])) db[k]=[]; });
  /* OUT HOME — अब एक से ज़्यादा entry (पुराना single number अपने आप list बन जाएगा) */
  if(db.outhome===undefined||db.outhome===null) db.outhome=[];
  else if(typeof db.outhome==='number'){ const o={amount:db.outhome,ts:db.outhomeTs||''};
    if(db.outhomeOld!==undefined&&db.outhomeOld!==null) o.old=db.outhomeOld;
    if(db.outhomeEts) o.ets=db.outhomeEts;
    db.outhome=[o]; delete db.outhomeOld; delete db.outhomeEts; }
  else if(!Array.isArray(db.outhome)) db.outhome=[];
  /* पुरानी Plastic Bag entries — सिर्फ़ 25kg bag ही प्रति बोरा, बाक़ी 20kg/50kg/चोकर प्रति kg */
  db.maal.forEach(r=>{
    if(r && r.sub==='plastic_bag' && r.kind==='simple'){
      const u = (r.opt==='25kg bag') ? 'बोरा' : 'kg';
      r.rateUnit=u; r.qtyUnit=u;
    }
  });
}
function save(){ localStorage.setItem(KEY,JSON.stringify(DB)); try{ if(window.tvRefresh) tvRefresh(); }catch(e){} }
/* Tally की गाड़ी list — tally.js से (न मिले तो fallback) */
function VEH_LIST(){ return window.TV_VEHICLES || [
  {no:'BR34GA8293',kind:'pickup',label:'Pickup',icon:'🛻'},
  {no:'BR34GA8447',kind:'cngvan',label:'CNG Van',icon:'🚐'},
  {no:'BR34U9778', kind:'bike',  label:'Bike',   icon:'🏍️'},
  {no:'WA24AE4843',kind:'car',   label:'Car (Diesel)',icon:'🚗'} ]; }

const DEFAULT_RATES = { atta:1.25, bag_5_10:1, wheat_unloading:1, wheat_weight_unloading:1.5, chokar_loding:1, chokar_fill:1, wheat_fill:1, wheat_holar:1, e_rikshaw:4 };
function getRates(){ try{ return Object.assign({},DEFAULT_RATES,JSON.parse(localStorage.getItem('sg_rates')||'{}')); }catch(e){ return {...DEFAULT_RATES}; } }
function setRates(r){ localStorage.setItem('sg_rates',JSON.stringify(r)); }

const LABOUR_CATS = [
  {key:'atta',        name:'आटा लोडिंग',            short:'Atta Loding'},
  {key:'atta',        name:'सत्तू/बेसन लोडिंग',      short:'Sattu/Besan Loding', id:'sattu'},
  {key:'bag_5_10',    name:'5kg/10kg लोडिंग',        short:'5kg/10kg Loding'},
  {key:'wheat_unloading', name:'Wheat Unloading',    short:'Wheat Unloding'},
  {key:'wheat_weight_unloading', name:'Wheat Weight+Unloading', short:'Wheat Wt+Unlod'},
  {key:'chokar_loding', name:'चोकर लोडिंग',          short:'Chokar Loding'},
  {key:'chokar_fill', name:'चोकर Fill',              short:'Chokar Fill'},
  {key:'wheat_holar', name:'Wheat Holar',            short:'Wheat Holar'},
];

const ITEMS = { 'आटा':['गोल्ड','5kg','10kg','18kg'], 'सत्तू':['थैला 200g','थैला 500g'], 'बेसन':['थैला 200g','थैला 500g'], 'चोकर':['चोकर'] };

/* ---------- popup factory ---------- */
const ROOT = $('#popups-root');
function popup({title,body,foot,onOpen}){
  closePopup();
  const bk=document.createElement('div'); bk.className='pp-back open'; bk.id='live-popup';
  bk.innerHTML=`<div class="pp"><div class="pp-head">${title}</div><div class="pp-body">${body}</div><div class="pp-foot">${foot||''}</div></div>`;
  bk.addEventListener('click',e=>{ if(e.target===bk) closePopup(); });
  ROOT.appendChild(bk);
  if(onOpen) onOpen(bk);
  return bk;
}
function closePopup(){ const p=$('#live-popup'); if(p) p.remove(); }

function segRow(label,opts,sel){ // payment segments
  return `<div class="f-row"><label>${label}</label><div class="pay-seg">${opts.map(o=>`<div class="seg${o.v===sel?' sel':''}" data-v="${o.v}">${o.t}</div>`).join('')}</div></div>`;
}
function wireSeg(bk,cb){ bk.querySelectorAll('.pay-seg').forEach(sg=>sg.addEventListener('click',e=>{ const s=e.target.closest('.seg'); if(!s)return; sg.querySelectorAll('.seg').forEach(x=>x.classList.remove('sel')); s.classList.add('sel'); if(cb)cb(s.dataset.v,sg); })); }
function segVal(bk,idx=0){ const sgs=bk.querySelectorAll('.pay-seg'); const s=sgs[idx]?.querySelector('.seg.sel'); return s?s.dataset.v:null; }

/* =========================================================
   1) रोकड + नगदी बिक्री
========================================================= */
let rokadCart=[], rokadSel={item:null,sub:null};
function openRokad(editIdx=null){
  rokadCart=[]; rokadSel={item:null,sub:null};
  if(editIdx!==null){ rokadCart=JSON.parse(JSON.stringify(DB.rokad[editIdx].items)); }
  const bk=popup({
    title:'रोकड + नगदी बिक्री',
    body:`<div id="rk-step1">
        <div class="hint">Item चुनें 👇</div>
        <div class="chip-grid">${Object.keys(ITEMS).map(k=>`<div class="chip" data-item="${k}">${k}</div>`).join('')}</div>
        <div class="cart-view" id="rk-cart"></div>
      </div>
      <div id="rk-step2" style="display:none;">
        <div class="hint" id="rk-sub-hint"></div>
        <div class="chip-grid" id="rk-sub-grid"></div>
      </div>
      <div id="rk-step3" style="display:none;">
        <h3 style="text-align:center;margin-bottom:12px;font-family:'Noto Sans Devanagari';" id="rk-sel-name"></h3>
        <div class="f-row"><label>मात्रा (Qty)</label><input type="number" id="rk-qty" inputmode="decimal"></div>
        <div class="f-row"><label>Rate (1 का)</label><input type="number" id="rk-price" inputmode="decimal"></div>
        <div class="f-row"><label>Total</label><div class="ro" id="rk-total">0</div></div>
        ${segRow('Payment',[{v:'cash',t:'💵 Cash'},{v:'online',t:'🏦 A/C'},{v:'mix',t:'🔀 Mix'}],'cash')}
        <div id="rk-mix" style="display:none;">
          <div class="f-row"><label>Cash Paid</label><input type="number" id="rk-cash" inputmode="decimal"></div>
          <div class="f-row"><label>Online A/C</label><input type="number" id="rk-online" inputmode="decimal"></div>
        </div>
      </div>`,
    foot:`<button class="pp-btn addmore" id="rk-add">+ Add Item</button>
      <div style="display:flex;gap:8px;"><button class="pp-btn cancel" id="rk-cancel">Cancel</button><button class="pp-btn save" id="rk-save">✓ Save</button></div>`,
    onOpen(bk){
      const show=(n)=>{['rk-step1','rk-step2','rk-step3'].forEach((id,i)=>bk.querySelector('#'+id).style.display=(i===n-1?'block':'none'));};
      const renderCart=()=>{ const c=bk.querySelector('#rk-cart');
        c.innerHTML='<b>अभी तक:</b> '+(rokadCart.length? rokadCart.map(x=>`<div>• ${x.item} ${x.sub} ${x.qty}×${x.price} = <b>${fmt(x.total)}</b>${x.online>0?` <span style="color:#c0392b">(A/C ${x.online===x.total?'':fmt(x.online)})</span>`:''}</div>`).join(''):' (खाली)'); };
      renderCart();
      bk.querySelectorAll('[data-item]').forEach(ch=>ch.addEventListener('click',()=>{
        rokadSel.item=ch.dataset.item;
        const subs=ITEMS[rokadSel.item];
        if(subs.length===1){ rokadSel.sub=subs[0]; startQty(); return; }
        bk.querySelector('#rk-sub-hint').textContent=rokadSel.item+' — type चुनें';
        bk.querySelector('#rk-sub-grid').innerHTML=subs.map(s=>`<div class="chip" data-sub="${s}">${s}</div>`).join('');
        bk.querySelectorAll('[data-sub]').forEach(sc=>sc.addEventListener('click',()=>{ rokadSel.sub=sc.dataset.sub; startQty(); }));
        show(2);
      }));
      function startQty(){
        bk.querySelector('#rk-sel-name').textContent=rokadSel.item+' — '+rokadSel.sub;
        ['rk-qty','rk-price','rk-cash','rk-online'].forEach(id=>bk.querySelector('#'+id).value='');
        bk.querySelector('#rk-total').textContent='0';
        show(3); bk.querySelector('#rk-qty').focus();
      }
      const upd=()=>{ const t=(parseFloat(bk.querySelector('#rk-qty').value)||0)*(parseFloat(bk.querySelector('#rk-price').value)||0); bk.querySelector('#rk-total').textContent=fmt(t); };
      bk.querySelector('#rk-qty').addEventListener('input',upd);
      bk.querySelector('#rk-price').addEventListener('input',upd);
      wireSeg(bk,v=>{ bk.querySelector('#rk-mix').style.display = v==='mix'?'block':'none'; });
      bk.querySelector('#rk-cash').addEventListener('input',()=>{ const t=parseFloat(bk.querySelector('#rk-total').textContent.replace(/,/g,''))||0; bk.querySelector('#rk-online').value=Math.max(0,t-(parseFloat(bk.querySelector('#rk-cash').value)||0)); });
      bk.querySelector('#rk-online').addEventListener('input',()=>{ const t=parseFloat(bk.querySelector('#rk-total').textContent.replace(/,/g,''))||0; bk.querySelector('#rk-cash').value=Math.max(0,t-(parseFloat(bk.querySelector('#rk-online').value)||0)); });
      function collect(){
        const qty=parseFloat(bk.querySelector('#rk-qty').value)||0, price=parseFloat(bk.querySelector('#rk-price').value)||0;
        if(bk.querySelector('#rk-step3').style.display==='none') return true; // nothing pending
        if(qty<=0||price<=0){ toast('Qty और Rate भरें'); return false; }
        const total=qty*price; const pay=segVal(bk);
        let cash=total, online=0;
        if(pay==='online'){ cash=0; online=total; }
        else if(pay==='mix'){ cash=parseFloat(bk.querySelector('#rk-cash').value)||0; online=parseFloat(bk.querySelector('#rk-online').value)||0;
          if(Math.abs(cash+online-total)>0.01){ toast('Cash + A/C = Total होना चाहिए'); return false; } }
        rokadCart.push({item:rokadSel.item,sub:rokadSel.sub,qty,price,total,cash,online});
        return true;
      }
      bk.querySelector('#rk-add').addEventListener('click',()=>{ if(bk.querySelector('#rk-step3').style.display!=='none'){ if(!collect())return; } renderCart(); show(1); });
      bk.querySelector('#rk-cancel').addEventListener('click',closePopup);
      bk.querySelector('#rk-save').addEventListener('click',()=>{
        if(!collect())return;
        if(!rokadCart.length){ toast('कोई item नहीं जोड़ा गया'); return; }
        const total=rokadCart.reduce((a,x)=>a+x.total,0), cash=rokadCart.reduce((a,x)=>a+x.cash,0), online=rokadCart.reduce((a,x)=>a+x.online,0);
        if(editIdx!==null){ Object.assign(DB.rokad[editIdx],{items:rokadCart,total,cash,online}); stampEdit(DB.rokad[editIdx]); }
        else DB.rokad.push({items:rokadCart,total,cash,online,ts:nowTS(),cut:false});
        save(); closePopup(); renderAll();
        if(DB.opening===null) setTimeout(openOpening,250);
      });
    }
  });
}

/* opening amount beside रोकड header */
function openOpening(){
  popup({
    title:'रोकड — शुरुआती रक़म (Opening)',
    body:`<div class="pp-note">रोकड + नगदी बिक्री के बगल में लिखने वाला Amount${DB.openingCarry?' — <b>पिछले दिन OUT HOME के बाद जो बचा</b> वह अपने आप आया है 🪄':''}</div>
      <div class="f-row"><label>Amount</label><input type="number" id="op-amt" inputmode="decimal" value="${DB.opening??''}"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="op-save">✓ Save</button></div>`,
    onOpen(bk){
      bk.querySelector('#op-amt').focus();
      bk.querySelector('#op-save').addEventListener('click',()=>{ DB.opening=parseFloat(bk.querySelector('#op-amt').value)||0; DB.openingCarry=false; save(); closePopup(); renderAll(); });
    }
  });
}

/* =========================================================
   2) जमा खाते नाम
========================================================= */
function openJama(editIdx=null){
  const e = editIdx!==null? DB.jama[editIdx] : {};
  popup({
    title:'जमा खाते नाम',
    body:`<div class="f-row"><label>नाम</label><input type="text" id="jm-name" value="${e.name||''}"></div>
      <div class="f-row"><label>पता</label><input type="text" id="jm-addr" value="${e.address||''}"></div>
      <div class="f-row"><label>Amount</label><input type="number" id="jm-amt" inputmode="decimal" value="${e.amount??''}"></div>
      ${segRow('Payment',[{v:'cash',t:'💵 Cash'},{v:'online',t:'🏦 A/C'}], e.online>0?'online':'cash')}`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="jm-save">✓ Save</button></div>`,
    onOpen(bk){
      wireSeg(bk);
      sgSuggest(bk.querySelector('#jm-name'), bk.querySelector('#jm-addr'));
      bk.querySelector('#jm-save').addEventListener('click',()=>{
        const name=bk.querySelector('#jm-name').value.trim(), amt=parseFloat(bk.querySelector('#jm-amt').value)||0;
        if(!name||amt<=0){ toast('नाम और Amount भरें'); return; }
        const online = segVal(bk)==='online' ? amt : 0;
        const rec={name,address:bk.querySelector('#jm-addr').value.trim(),amount:amt,online,ts:e.ts||nowTS(),cut:e.cut||false,edited:e.edited,ets:e.ets,edate:e.edate};
        if(editIdx!==null){ stampEdit(rec); DB.jama[editIdx]=rec; } else { DB.jama.push(rec); logChange({sec:'जमा नाम खाते',what:'नयी entry',name:rec.name,neu:rec.amount,note:rec.address||''}); }
        save(); closePopup(); renderAll();
      });
    }
  });
}

/* =========================================================
   3) माल आवत खाते  — Wheat / Bag / Daal / Roast
========================================================= */
/* ---- Bag / Daal / Roast की definitions ---- */
const MAAL_SUBS = {
  /* Plastic Bag — सिर्फ़ 25kg bag का Rate प्रति बोरा; 20kg / 50kg / चोकर का Rate प्रति kg */
  plastic_bag  : {label:'Plastic Bag',  cat:'bag',   icon:'🧺', opts:['20kg bag','25kg bag','50kg bag','चोकर (Chokar)'], rateUnit:'kg', rateUnitBy:{'25kg bag':'बोरा'}, form:'simple', qtyLabel:'Qty (kg)', qtyUnit:'kg'},
  plastic_pouch: {label:'Plastic Pouch',cat:'bag',   icon:'🛍️', opts:['5kg pouch','10kg pouch','500gm','200gm'],        rateUnit:'kg',   form:'simple', qtyLabel:'Qty (kg)', qtyUnit:'kg'},
  sattu_daal   : {label:'Sattu daal',   cat:'daal',  icon:'🥣', rateUnit:'kg',   form:'simple', qtyLabel:'Qty (kg)', qtyUnit:'kg'},
  chana_daal   : {label:'Chana daal',   cat:'daal',  icon:'🫘', rateUnit:'kg',   form:'simple', qtyLabel:'Qty (kg)', qtyUnit:'kg'},
  wheat_roast  : {label:'Wheat Roast',  cat:'roast', icon:'🌾', rateUnit:'kg',   form:'simple', qtyLabel:'Qty', qtyUnit:''},
  jira         : {label:'Jira (जीरा)',  cat:'roast', icon:'🌿', rateUnit:'kg',   form:'simple', qtyLabel:'Qty', qtyUnit:''}
};
/* option के हिसाब से Rate unit — जैसे Plastic Bag में सिर्फ़ 25kg bag = प्रति बोरा */
function maalRateUnit(S,opt){
  if(!S) return '';
  if(S.rateUnitBy && opt && S.rateUnitBy[opt]) return S.rateUnitBy[opt];
  return S.rateUnit||'';
}
/* उसी unit से Qty का label/unit भी बदलेगा */
function maalQtyMeta(S,opt){
  if(!S) return {label:'Qty',unit:''};
  if(S.rateUnitBy){
    const u=maalRateUnit(S,opt);
    return {label:'Qty ('+u+')', unit:u};
  }
  return {label:S.qtyLabel||'Qty', unit:S.qtyUnit??''};
}
/* नयी माल आवत entry → पहले category चुनो */
function openMaalChooser(){
  popup({
    title:'📥 नयी माल आवत — क्या आया?',
    body:`<div class="print-choice">
        <button data-mc="wheat" style="border-color:#f1c40f;"><span class="pc-ico">🌾</span>Wheat<br><small style="color:#8a94a6">RST / FILL</small></button>
        <button data-mc="bag" style="border-color:#3498db;"><span class="pc-ico">🧺</span>Bag<br><small style="color:#8a94a6">Plastic Bag / Pouch</small></button>
        <button data-mc="daal" style="border-color:#e67e22;"><span class="pc-ico">🥣</span>Daal<br><small style="color:#8a94a6">Sattu / Chana</small></button>
        <button data-mc="roast" style="border-color:#9b59b6;"><span class="pc-ico">🔥</span>Roast<br><small style="color:#8a94a6">Wheat Roast / Jira</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelectorAll('[data-mc]').forEach(b=>b.addEventListener('click',()=>{
        const c=b.dataset.mc; closePopup();
        if(c==='wheat') openMaal(null,'plain');
        else openMaalSubChooser(c);
      }));
    }
  });
}
function openMaalSubChooser(cat){
  const titles={bag:'🧺 Bag — कौन सा?',daal:'🥣 Daal — कौन सा?',roast:'🔥 Roast — कौन सा?'};
  const keys=Object.keys(MAAL_SUBS).filter(k=>MAAL_SUBS[k].cat===cat);
  popup({
    title:titles[cat]||'चुनें',
    body:`<div class="print-choice">${keys.map(k=>`<button data-ms="${k}"><span class="pc-ico">${MAAL_SUBS[k].icon}</span>${MAAL_SUBS[k].label}<br><small style="color:#8a94a6">Rate / ${MAAL_SUBS[k].rateUnit}</small></button>`).join('')}</div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" id="ms-back">← पीछे</button><button class="pp-btn cancel" onclick="closePopup()">Cancel</button></div>`,
    onOpen(bk){
      bk.querySelector('#ms-back').addEventListener('click',()=>{ closePopup(); openMaalChooser(); });
      bk.querySelectorAll('[data-ms]').forEach(b=>b.addEventListener('click',()=>{
        const k=b.dataset.ms; closePopup();
        if(MAAL_SUBS[k].form==='rstfill') openMaal(null,k);
        else openMaalSimple(k,null);
      }));
    }
  });
}
/* edit dispatch — entry के हिसाब से सही popup */
function openMaalEntry(editIdx=null){
  if(editIdx===null){ openMaalChooser(); return; }
  const e=DB.maal[editIdx]||{};
  if(e.sub && MAAL_SUBS[e.sub] && MAAL_SUBS[e.sub].form==='simple') return openMaalSimple(e.sub,editIdx);
  openMaal(editIdx, e.sub||'plain');
}
/* ---------- simple form: Pouch / Daal / Roast (qty × rate) ---------- */
function openMaalSimple(subKey,editIdx=null){
  const S=MAAL_SUBS[subKey];
  const e = editIdx!==null? DB.maal[editIdx] : {};
  const serial = e.serial || (DB.maal.length+1);
  const opt0 = e.opt || (S.opts? S.opts[0] : '');
  const RU0  = maalRateUnit(S,opt0);
  const QM0  = maalQtyMeta(S,opt0);
  popup({
    title:`${S.icon} ${S.label} — माल आवत`,
    body:`<div class="pp-note">Serial No: <b>${serial}</b> &nbsp;|&nbsp; Rate <b id="ms-note-u">प्रति ${RU0}</b> — Total अपने आप 🪄</div>
      ${S.opts?`<div class="f-row"><label>${S.label}</label><select id="ms-opt">${S.opts.map(o=>`<option ${opt0===o?'selected':''}>${o}</option>`).join('')}</select></div>`:''}
      <div class="f-row"><label>नाम (Name)</label><input type="text" id="ms-name" value="${esc(e.name||'')}"></div>
      <div class="f-row"><label>पता (Address)</label><input type="text" id="ms-addr" value="${esc(e.address||'')}"></div>
      <div class="f-row"><label id="ms-qty-lbl">${QM0.label}</label><input type="number" id="ms-qty" inputmode="decimal" placeholder="0" value="${e.qty??''}"></div>
      <div class="f-row"><label id="ms-rate-lbl">Rate (प्रति ${RU0})</label><input type="number" id="ms-rate" inputmode="decimal" placeholder="बाद में" value="${e.rate??''}"></div>
      <div class="f-row"><label>Total Amount</label><div class="ro" id="ms-total">${e.amount?fmt(e.amount):'0'}</div></div>
      <div class="f-row"><label>गाडी नं०</label><input type="text" id="ms-veh" placeholder="(optional)" value="${esc(e.vehicle||'')}"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ms-save">✓ Save</button></div>`,
    onOpen(bk){
      const g=id=>bk.querySelector('#'+id);
      const curOpt=()=>S.opts? g('ms-opt').value : '';
      const upd=()=>{ const q=parseFloat(g('ms-qty').value)||0, r=parseFloat(g('ms-rate').value)||0; g('ms-total').textContent=fmt(q*r); };
      /* option बदलते ही Rate/Qty unit अपने आप बदलेगा (25kg bag = प्रति बोरा, बाक़ी = प्रति kg) */
      const updUnit=()=>{ const u=maalRateUnit(S,curOpt()), qm=maalQtyMeta(S,curOpt());
        const a=g('ms-note-u'); if(a) a.textContent='प्रति '+u;
        const b=g('ms-rate-lbl'); if(b) b.textContent='Rate (प्रति '+u+')';
        const c=g('ms-qty-lbl');  if(c) c.textContent=qm.label; };
      if(S.opts) g('ms-opt').addEventListener('change',updUnit);
      updUnit();
      g('ms-qty').addEventListener('input',upd); g('ms-rate').addEventListener('input',upd);
      g('ms-qty').focus();
      g('ms-save').addEventListener('click',()=>{
        const q=parseFloat(g('ms-qty').value);
        const qm=maalQtyMeta(S,curOpt());
        if(!(q>0)){ toast((qm.label||'Qty')+' भरें'); return; }
        const r=g('ms-rate').value.trim()===''?null:parseFloat(g('ms-rate').value);
        const rec={serial,kind:'simple',cat:S.cat,sub:subKey,label:S.label,
          opt:curOpt(),
          name:g('ms-name').value.trim(),address:g('ms-addr').value.trim(),
          qty:q,qtyUnit:qm.unit??'',rate:r,rateUnit:maalRateUnit(S,curOpt()),amount:(r||0)*q,
          vehicle:g('ms-veh').value.trim(),
          ts:e.ts||nowTS(),cut:e.cut||false};
        if(editIdx!==null){ rec.edited=e.edited; rec.ets=e.ets; rec.edate=e.edate; stampEdit(rec); DB.maal[editIdx]=rec; } else DB.maal.push(rec);
        save(); closePopup(); renderAll();
      });
    }
  });
}
function openMaal(editIdx=null, subKey='plain'){
  const e = editIdx!==null? DB.maal[editIdx] : {};
  if(editIdx!==null && e.sub) subKey=e.sub;
  const S = MAAL_SUBS[subKey] || null;      // null = सादा Wheat
  const serial = e.serial || (DB.maal.length+1);
  const kind = e.kind || 'rst';
  popup({
    title: S? `${S.icon} ${S.label} — माल आवत` : 'माल आवत खाते (🌾 Wheat)',
    body:`<div class="pp-note">Serial No: <b>${serial}</b> &nbsp;|&nbsp; Weight/Rate बाद में भी भर सकते हैं ✏️</div>
      <div class="f-row"><label>Type</label><div class="pay-seg" id="ml-kind"><div class="seg ${kind==='rst'?'sel':''}" data-v="rst">⚖️ RST</div><div class="seg ${kind==='fill'?'sel':''}" data-v="fill">📦 FILL</div></div></div>
      ${S&&S.opts?`<div class="f-row"><label>${S.label}</label><select id="ml-opt">${S.opts.map(o=>`<option ${e.opt===o?'selected':''}>${o}</option>`).join('')}</select></div>`:''}
      <div class="f-row"><label>नाम (Name)</label><input type="text" id="ml-name" value="${e.name||''}"></div>
      <div class="f-row"><label>पता (Address)</label><input type="text" id="ml-addr" value="${e.address||''}"></div>
      <div class="f-row" id="ml-pic-row" style="display:${kind==='fill'?'none':'flex'};"><label>Total बोरा (Pic)</label><input type="number" id="ml-pic" inputmode="numeric" value="${e.pic??''}"></div>
      <div class="f-row"><label>Dust (D)</label><input type="number" id="ml-dust" inputmode="numeric" placeholder="0" value="${e.dust??''}"></div>
      <div class="f-row"><label>Plastic बोरा (P)</label><input type="number" id="ml-plastic" inputmode="numeric" placeholder="0" value="${e.plastic??''}"></div>
      <div class="f-row"><label>पानी वाला (W)</label><input type="number" id="ml-wet" inputmode="numeric" placeholder="0" value="${e.wet??''}"></div>
      <div class="pp-note" style="background:#eef7ff;color:#1f618d;">W = पानी वाला wheat — check कर के जितना बोरा पानी वाला मिले वह यहाँ भरें</div>
      <hr style="border:none;border-top:1.5px dashed #dde3ec;margin:8px 0 12px;">
      <div id="ml-rst-fields" style="display:${kind==='rst'?'block':'none'};">
        <div class="f-row"><label>RST No</label><input type="text" id="ml-rst" placeholder="बाद में" value="${e.rst||''}"></div>
        <div class="f-row"><label>Gross Weight</label><input type="number" id="ml-gross" inputmode="decimal" placeholder="बाद में" value="${e.gross??''}"></div>
        <div class="f-row"><label>Tare Weight</label><input type="number" id="ml-tare" inputmode="decimal" placeholder="बाद में" value="${e.tare??''}"></div>
        <div class="f-row"><label>Nett Weight</label><input type="number" id="ml-nett" inputmode="decimal" placeholder="बाद में" value="${e.nett??''}"></div>
        <div class="f-row"><label>गाडी नं०</label><input type="text" id="ml-veh" placeholder="(NETT के नीचे दिखेगा)" value="${esc(e.vehicle||'')}"></div>
      </div>
      <div id="ml-fill-fields" style="display:${kind==='fill'?'block':'none'};">
        <div class="pp-note">बोरा weight series में लिखें — comma से (जैसे: 5,30,45,20) — बोरा count अपने आप 🪄</div>
        <div class="f-row"><label>Weights (kg)</label><input type="text" id="ml-weights" inputmode="decimal" placeholder="5,30,45,20" value="${(e.weights||[]).join(',')}"></div>
        <div class="f-row"><label>Total KG</label><div class="ro" id="ml-fill-total">${e.fillTotal?fmt(e.fillTotal)+' kg':'0 kg'}</div></div>
        <div class="f-row"><label>Total बोरा (Pic)</label><div class="ro" id="ml-fill-pic">${(e.weights||[]).length||0} बोरा (auto)</div></div>
      </div>
      <div class="f-row"><label>Rate (${S?'प्रति '+S.rateUnit:'सौदा'})</label><input type="number" id="ml-rate" inputmode="decimal" placeholder="बाद में summit" value="${e.rate??''}"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ml-save">✓ Save</button></div>`,
    onOpen(bk){
      const g=id=>bk.querySelector('#'+id);
      let curKind=kind;
      bk.querySelector('#ml-kind').addEventListener('click',e2=>{
        const s=e2.target.closest('.seg'); if(!s)return;
        bk.querySelectorAll('#ml-kind .seg').forEach(x=>x.classList.remove('sel')); s.classList.add('sel');
        curKind=s.dataset.v;
        g('ml-rst-fields').style.display = curKind==='rst'?'block':'none';
        g('ml-fill-fields').style.display = curKind==='fill'?'block':'none';
        g('ml-pic-row').style.display = curKind==='fill'?'none':'flex';
      });
      const autoNett=()=>{ const gr=parseFloat(g('ml-gross').value), tr=parseFloat(g('ml-tare').value); if(!isNaN(gr)&&!isNaN(tr)&&g('ml-nett').value==='') g('ml-nett').value=(gr-tr); };
      g('ml-gross').addEventListener('change',autoNett); g('ml-tare').addEventListener('change',autoNett);
      const parseWeights=()=>g('ml-weights').value.split(/[,\s]+/).map(x=>parseFloat(x)).filter(x=>!isNaN(x)&&x>0);
      g('ml-weights').addEventListener('input',()=>{ const w=parseWeights(); g('ml-fill-total').textContent=fmt(w.reduce((a,x)=>a+x,0))+' kg'; g('ml-fill-pic').textContent=w.length+' बोरा (auto)'; });
      g('ml-save').addEventListener('click',()=>{
        const name=g('ml-name').value.trim();
        let pic = curKind==='fill' ? parseWeights().length : parseFloat(g('ml-pic').value);
        if(!name){ toast('नाम भरें'); return; }
        if(curKind!=='fill' && !(pic>0)){ toast('Total बोरा भरें'); return; }
        if(curKind==='fill' && !(pic>0)){ toast('Weights भरें — बोरा count अपने आप होगा'); return; }
        const num=id=>{ const v=g(id).value.trim(); return v===''?null:parseFloat(v); };
        const rec={serial,kind:curKind,name,address:g('ml-addr').value.trim(),pic,
          dust:num('ml-dust')??0,plastic:num('ml-plastic')??0,wet:num('ml-wet')??0,rate:num('ml-rate'),
          ts:e.ts||nowTS(),cut:e.cut||false};
        if(S){ rec.cat=S.cat; rec.sub=subKey; rec.label=S.label; rec.rateUnit=S.rateUnit; if(S.opts) rec.opt=g('ml-opt').value; }
        if(curKind==='rst'){
          rec.rst=g('ml-rst').value.trim(); rec.gross=num('ml-gross'); rec.tare=num('ml-tare'); rec.nett=num('ml-nett');
          rec.vehicle=g('ml-veh')?g('ml-veh').value.trim():'';
        }else{
          const w=parseWeights(); rec.weights=w; rec.fillTotal=w.reduce((a,x)=>a+x,0);
        }
        if(editIdx!==null){ rec.edited=e.edited; rec.ets=e.ets; rec.edate=e.edate; stampEdit(rec); DB.maal[editIdx]=rec; } else DB.maal.push(rec);
        save(); closePopup(); renderAll();
      });
    }
  });
}

/* =========================================================
   4) नगद नाम खाते  (serial auto-fill, home/ac/counter)
========================================================= */
function openNagad(editIdx=null){
  const e = editIdx!==null? DB.nagad[editIdx] : {};
  popup({
    title:'नगद नाम खाते',
    body:`<div class="pp-note">माल आवत का Serial No डालें → नाम-पता अपने आप 🪄</div>
      <div class="f-row"><label>Serial No</label><input type="number" id="ng-serial" inputmode="numeric" placeholder="(optional)" value="${e.serialRef??''}"></div>
      <div class="f-row"><label>नाम</label><input type="text" id="ng-name" list="ng-staff-list" value="${e.name||''}"></div>
      <datalist id="ng-staff-list">${(attStaffGlobal()||[]).map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>
      <div class="f-row"><label>पता</label><input type="text" id="ng-addr" value="${e.address||''}"></div>
      <div class="f-row"><label>Amount</label><input type="number" id="ng-amt" inputmode="decimal" value="${e.amount??''}"></div>
      ${segRow('कहाँ से दिया',[{v:'cash',t:'💵 Mill'},{v:'online',t:'🏦 A/C'},{v:'home',t:'🏠 Home'}], e.mode||'cash')}
      <div class="f-row"><label>Item ले गया</label><select id="ng-item"><option value="">— नहीं —</option>${['आटा बोरा','सत्तू','बेसन','आटा','चोकर'].map(x=>`<option ${e.item===x?'selected':''}>${x}</option>`).join('')}</select></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ng-save">✓ Save</button></div>`,
    onOpen(bk){
      wireSeg(bk);
      sgSuggest(bk.querySelector('#ng-name'), bk.querySelector('#ng-addr'));
      bk.querySelector('#ng-serial').addEventListener('input',()=>{
        const sn=parseInt(bk.querySelector('#ng-serial').value);
        const m=DB.maal.find(x=>x.serial===sn);
        if(m){ bk.querySelector('#ng-name').value=m.name; bk.querySelector('#ng-addr').value=m.address||''; toast('Serial '+sn+' → '+m.name); }
      });
      bk.querySelector('#ng-save').addEventListener('click',()=>{
        const name=bk.querySelector('#ng-name').value.trim(), amt=parseFloat(bk.querySelector('#ng-amt').value)||0;
        if(!name||amt<=0){ toast('नाम और Amount भरें'); return; }
        const rec={name,address:bk.querySelector('#ng-addr').value.trim(),amount:amt,
          serialRef:parseInt(bk.querySelector('#ng-serial').value)||null,
          mode:segVal(bk)||'cash', item:bk.querySelector('#ng-item').value||'',
          ts:e.ts||nowTS(),cut:e.cut||false};
        if(editIdx!==null){ rec.edited=e.edited; rec.ets=e.ets; rec.edate=e.edate; stampEdit(rec); DB.nagad[editIdx]=rec; } else { DB.nagad.push(rec); logChange({sec:'नगद नाम खाते',what:'नयी entry',name:rec.name,neu:rec.amount,note:rec.address||''}); }
        save(); closePopup(); renderAll();
      });
    }
  });
}

/* =========================================================
   5) नगद खर्च  (mill / advance-pending / labour / van)
========================================================= */
function openKharch(editIdx=null){
  const e = editIdx!==null? DB.kharch[editIdx] : null;
  if(e && e.type==='pending' && e.pending){ return openPendingFill(editIdx); }
  if(e && e.type==='labour'){ return openLabour(editIdx); }
  popup({
    title:'नगद खर्च',
    body:`<div class="f-row"><label>खर्च Type</label><select id="kh-type">
        <option value="mill">🏭 मिल खर्च</option>
        <option value="pending">⏳ Advance (बाद में exact)</option>
        <option value="labour">👷 Labour</option>
        <option value="van">🚐 वेन</option>
        <option value="erik">🛵 E-Rikshaw</option>
      </select></div>
      <div id="kh-mill">
        <div class="f-row"><label>खर्च का नाम</label><input type="text" id="kh-name" value="${e?(e.name||''):''}"></div>
        <div class="f-row"><label>अमाउंट</label><input type="number" id="kh-amt" inputmode="decimal" value="${e?(e.amount??''):''}"></div>
      </div>
      <div id="kh-pending" style="display:none;">
        <div class="pp-note">अभी सिर्फ़ ₹ दिया — exact खर्च बाद में entry पर click कर के भरें</div>
        <div class="f-row"><label>किसको / नाम</label><input type="text" id="kh-p-name"></div>
        <div class="f-row"><label>दिया अमाउंट</label><input type="number" id="kh-p-amt" inputmode="decimal"></div>
      </div>
      <div id="kh-erik" style="display:none;">
        <div class="pp-note">आटा Receipt No भरें → नाम / पता / Quantity अपने आप 🪄 — फिर Amount भरें</div>
        <div class="f-row"><label>Receipt No</label><input type="number" id="kh-e-rno" inputmode="numeric"></div>
        <div class="f-row"><label>नाम</label><input type="text" id="kh-e-name"></div>
        <div class="f-row"><label>पता</label><input type="text" id="kh-e-addr"></div>
        <div class="f-row"><label>Quantity</label><input type="number" id="kh-e-qty" inputmode="numeric"></div>
        <div class="f-row"><label>Amount ₹</label><input type="number" id="kh-e-amt" inputmode="decimal" placeholder="रेट/अमाउंट भरें"></div>
      </div>
      <div id="kh-van" style="display:none;">
        <div class="f-row"><label>वेन Option</label><select id="kh-van-type"><option value="gadi">🚐 गाडी खर्च (Daily)</option><option value="petrol">⛽ Fuel</option></select></div>
        <div id="kh-van-petrol" style="display:none;">
          ${segRow('गाड़ी',[{v:'van',t:'🚐 Van'},{v:'bike',t:'🏍️ Bike'}],'van')}
          <div id="kh-van-details">
            <div class="f-row"><label>Van No</label><select id="kh-van-no">${VEH_LIST().filter(v=>v.kind!=='bike').map(v=>`<option value="${v.no}">${v.icon} ${v.no} — ${v.label}</option>`).join('')}</select></div>
            <div class="f-row"><label>Driver नाम</label><input type="text" id="kh-driver"></div>
          </div>
          <div id="kh-bike-details" style="display:none;">
            <div class="f-row"><label>Bike No</label><div class="ro" id="kh-bike-no">${VEH_LIST().find(v=>v.kind==='bike')?.no||''}</div></div>
          </div>
        </div>
        <div class="f-row"><label>अमाउंट</label><input type="number" id="kh-van-amt" inputmode="decimal"></div>
      </div>
      <div id="kh-gadi" style="display:none;">
        <div class="f-row"><label>गाड़ी चुनें</label><select id="kh-gadi-no"><option value="">— कोई नहीं —</option>${VEH_LIST().map(v=>`<option value="${v.no}">${v.icon} ${v.no} — ${v.label}</option>`).join('')}</select></div>
      </div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="kh-save">✓ Save</button></div>`,
    onOpen(bk){
      wireSeg(bk,()=>{ const isVan = bk.querySelector('.pay-seg .seg.sel')?.dataset.v==='van';
        bk.querySelector('#kh-van-details').style.display = isVan?'block':'none';
        bk.querySelector('#kh-bike-details').style.display = isVan?'none':'block'; });
      const typeSel=bk.querySelector('#kh-type');
      typeSel.addEventListener('change',()=>{
        const v=typeSel.value;
        if(v==='labour'){ closePopup(); openLabour(); return; }
        bk.querySelector('#kh-mill').style.display = v==='mill'?'block':'none';
        bk.querySelector('#kh-pending').style.display = v==='pending'?'block':'none';
        bk.querySelector('#kh-van').style.display = v==='van'?'block':'none';
        bk.querySelector('#kh-erik').style.display = v==='erik'?'block':'none';
      });
      bk.querySelector('#kh-e-rno').addEventListener('input',()=>{
        const rn=parseInt(bk.querySelector('#kh-e-rno').value);
        if(!rn) return;
        /* 1) आटा Print receipt (atta-receipt.html) से — नाम / पता / Quantity auto */
        let rc=(loadArr(ARC_KEY(CUR_DATE))||[]).filter(r=>!r.cancelled).find(r=>parseInt(r.no)===rn);
        if(rc){
          bk.querySelector('#kh-e-name').value = rc.nameHi||rc.name||'';
          bk.querySelector('#kh-e-addr').value = rc.addressHi||rc.address||'';
          const tq=(rc.items||[]).reduce((a,x)=>a+(parseFloat(x.qty)||0),0);
          bk.querySelector('#kh-e-qty').value=tq||'';
          toast('Receipt '+rn+' → '+(rc.nameHi||rc.name)); return;
        }
        /* 2) fallback — app के अंदर बनी receipt */
        const r2=(DB.receipts||[]).find(r=>r.no===rn);
        if(r2){ bk.querySelector('#kh-e-name').value=r2.name; bk.querySelector('#kh-e-addr').value=r2.address||'';
          bk.querySelector('#kh-e-qty').value=r2.items.reduce((a,x)=>a+(x.qty||0),0);
          toast('Receipt '+rn+' → '+r2.name); }
      });
      bk.querySelector('#kh-van-type').addEventListener('change',()=>{
        const isP = bk.querySelector('#kh-van-type').value==='petrol';
        bk.querySelector('#kh-van-petrol').style.display = isP?'block':'none';
        bk.querySelector('#kh-gadi').style.display = isP?'none':'block';
      });
      bk.querySelector('#kh-gadi').style.display = bk.querySelector('#kh-van-type').value==='gadi'?'block':'none';
      bk.querySelector('#kh-save').addEventListener('click',()=>{
        const v=typeSel.value; let rec=null;
        if(v==='mill'){
          const name=bk.querySelector('#kh-name').value.trim(), amt=parseFloat(bk.querySelector('#kh-amt').value)||0;
          if(!name||amt<=0){ toast('नाम और अमाउंट भरें'); return; }
          rec={type:'mill',name,amount:amt,mk:'product'};
        }else if(v==='pending'){
          const name=bk.querySelector('#kh-p-name').value.trim(), amt=parseFloat(bk.querySelector('#kh-p-amt').value)||0;
          if(!name||amt<=0){ toast('नाम और अमाउंट भरें'); return; }
          rec={type:'pending',name,amount:amt,pending:true,given:amt};
        }else if(v==='erik'){
          const q=parseFloat(bk.querySelector('#kh-e-qty').value)||0;
          const nm=bk.querySelector('#kh-e-name').value.trim();
          const amt=parseFloat(bk.querySelector('#kh-e-amt').value)||0;
          if(!nm||amt<=0){ toast('नाम और Amount भरें'); return; }
          const ad=bk.querySelector('#kh-e-addr').value.trim();
          rec={type:'erik',name:`E-Rikshaw ${nm}(${ad?ad+'-':''}${q||0})`,amount:amt};
        }else if(v==='van'){
          const amt=parseFloat(bk.querySelector('#kh-van-amt').value)||0;
          if(amt<=0){ toast('अमाउंट भरें'); return; }
          const vt=bk.querySelector('#kh-van-type').value;
          if(vt==='gadi'){
            const gno=bk.querySelector('#kh-gadi-no').value;
            rec={type:'van',name:'गाडी खर्च (Daily)'+(gno?' '+gno:''),amount:amt,mk:'gadi',mkSub:'maint',vehNo:gno||''};
          }
          else{
            const veh=segVal(bk)||'van';
            if(veh==='bike'){
              const bno=(VEH_LIST().find(v=>v.kind==='bike')||{}).no||'';
              rec={type:'van',name:`Bike ${bno} (Fuel)`,amount:amt,mk:'gadi',mkSub:'fuel',vehNo:bno};
            }else{
              const no=bk.querySelector('#kh-van-no').value.trim(), dr=bk.querySelector('#kh-driver').value.trim();
              rec={type:'van',name:`${no} (Fuel)${dr?' '+dr:''}`,amount:amt,mk:'gadi',mkSub:'fuel',vehNo:no,driver:dr};
            }
          }
        }
        rec.ts=e?e.ts:nowTS(); rec.cut=e?e.cut:false;
        if(editIdx!==null){ rec.edited=e&&e.edited; rec.ets=e&&e.ets; rec.edate=e&&e.edate; stampEdit(rec); DB.kharch[editIdx]=rec; } else { DB.kharch.push(rec); logChange({sec:'नगद खर्च',what:'नयी entry',name:rec.name,neu:rec.amount}); }
        save(); closePopup(); renderAll();
      });
      if(e){ typeSel.value=e.type==='van'?'van':'mill'; typeSel.dispatchEvent(new Event('change')); }
    }
  });
}

/* pending → fill exact later */
function openPendingFill(idx){
  const e=DB.kharch[idx];
  popup({
    title:'⏳ Advance खर्च — Exact भरें',
    body:`<div class="pp-note"><b>${e.name}</b> को ₹${fmt(e.given)} दिया था — अब exact खर्च भरें</div>
      <div class="f-row"><label>खर्च का नाम</label><input type="text" id="pf-name" value="${e.name}"></div>
      <div class="f-row"><label>Exact अमाउंट</label><input type="number" id="pf-amt" inputmode="decimal" value="${e.given}"></div>`,
    foot:`<button class="pp-btn cancel" onclick="closePopup()">बाद में</button>
      <button class="pp-btn save" id="pf-save">✓ Exact Save</button>`,
    onOpen(bk){
      bk.querySelector('#pf-amt').focus();
      bk.querySelector('#pf-save').addEventListener('click',()=>{
        const amt=parseFloat(bk.querySelector('#pf-amt').value)||0;
        if(amt<=0){ toast('अमाउंट भरें'); return; }
        e.name=bk.querySelector('#pf-name').value.trim()||e.name;
        e.amount=amt; e.pending=false; stampEdit(e);
        save(); closePopup(); renderAll(); toast('Exact खर्च save ✔');
      });
    }
  });
}

/* Labour multi-category */
function openLabour(editIdx=null){
  const rates=getRates();
  const e = editIdx!==null? DB.kharch[editIdx] : null;
  const rows=LABOUR_CATS.map((c,i)=>{
    const prev = e? (e.labour.find(l=>l.name===c.name)||{}) : {};
    return `<div class="lab-qty-grid"><div class="lname">${c.name} <small style="color:#98a1b3">@${rates[c.key]}</small></div>
      <input type="number" inputmode="decimal" class="lab-qty" data-i="${i}" placeholder="बोरा" value="${prev.qty??''}">
      <div class="lamt" data-i="${i}">${prev.amt?fmt(prev.amt):'—'}</div></div>`;
  }).join('');
  popup({
    title:'👷 Labour खर्च',
    body:`<div class="pp-note">बोरा number भरें → अमाउंट अपने आप (rate से multiply)</div>
      ${rows}
      <div class="lab-qty-grid"><div class="lname">➕ Add Amount</div>
        <input type="number" inputmode="decimal" id="lab-add" placeholder="₹" value="${e? (e.labour.find(l=>l.name==='Add Amount')?.amt??'') : ''}">
        <div class="lamt" id="lab-add-show">—</div></div>
      <div class="big-total-preview" id="lab-total">Total: ₹0</div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="lab-save">✓ Final Submit</button></div>`,
    onOpen(bk){
      const recompute=()=>{
        let total=0;
        bk.querySelectorAll('.lab-qty').forEach(inp=>{
          const i=+inp.dataset.i, q=parseFloat(inp.value)||0, amt=q*rates[LABOUR_CATS[i].key];
          bk.querySelector(`.lamt[data-i="${i}"]`).textContent = q>0? fmt(amt):'—';
          total+=amt;
        });
        const add=parseFloat(bk.querySelector('#lab-add').value)||0;
        bk.querySelector('#lab-add-show').textContent = add>0? fmt(add):'—';
        total+=add;
        bk.querySelector('#lab-total').textContent='Total: ₹'+fmt(total);
        return total;
      };
      bk.querySelectorAll('.lab-qty').forEach(i=>i.addEventListener('input',recompute));
      bk.querySelector('#lab-add').addEventListener('input',recompute);
      recompute();
      bk.querySelector('#lab-save').addEventListener('click',()=>{
        const labour=[];
        bk.querySelectorAll('.lab-qty').forEach(inp=>{
          const i=+inp.dataset.i, q=parseFloat(inp.value)||0;
          if(q>0) labour.push({name:LABOUR_CATS[i].name,short:LABOUR_CATS[i].short,qty:q,amt:q*rates[LABOUR_CATS[i].key]});
        });
        const add=parseFloat(bk.querySelector('#lab-add').value)||0;
        if(add>0) labour.push({name:'Add Amount',short:'Add Amount',qty:null,amt:add});
        if(!labour.length){ toast('कुछ भरें'); return; }
        const total=labour.reduce((a,x)=>a+x.amt,0);
        const rec={type:'labour',name:'Labour',amount:total,labour,ts:e?e.ts:nowTS(),cut:e?e.cut:false};
        if(editIdx!==null){ rec.edited=e&&e.edited; rec.ets=e&&e.ets; rec.edate=e&&e.edate; stampEdit(rec); DB.kharch[editIdx]=rec; } else { DB.kharch.push(rec); logChange({sec:'नगद खर्च',what:'नयी entry',name:rec.name,neu:rec.amount}); }
        save(); closePopup(); renderAll();
      });
    }
  });
}

/* Rate settings — triple-click नगद खर्च header, password = hour + date (hint नहीं दिखाना) */
let khHeadClicks=0, khHeadTimer=null;
$('#kharch-head').addEventListener('click',()=>{
  khHeadClicks++;
  clearTimeout(khHeadTimer);
  khHeadTimer=setTimeout(()=>{
    if(khHeadClicks>=3) openRatePassword();
    else openKharch();
    khHeadClicks=0;
  },380);
});
function currentPassword(){
  const d=new Date(); let h=d.getHours()%12; if(h===0)h=12;
  return `${h}${String(d.getDate()).padStart(2,'0')}`;
}
function openRatePassword(){ askPassword(()=>openRateSettings()); }
function askPassword(onOk,title='🔐 Password'){
  popup({
    title,
    body:`<div class="f-row"><label>Password</label><input type="password" id="rp-pass" inputmode="numeric"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="rp-go">Unlock 🔓</button></div>`,
    onOpen(bk){
      bk.querySelector('#rp-pass').focus();
      const go=()=>{ if(bk.querySelector('#rp-pass').value===currentPassword()){ closePopup(); onOk(); } else toast('गलत Password ❌'); };
      bk.querySelector('#rp-go').addEventListener('click',go);
      bk.querySelector('#rp-pass').addEventListener('keydown',e=>{ if(e.key==='Enter')go(); });
    }
  });
}
function openRateSettings(){
  const rates=getRates();
  const defs=[
    {k:'atta', n:'आटा / सत्तू / बेसन लोडिंग (1 pc)'},
    {k:'bag_5_10', n:'5kg / 10kg (1 pc)'},
    {k:'wheat_unloading', n:'Wheat Unloading'},
    {k:'wheat_weight_unloading', n:'Wheat Weight + Unloading'},
    {k:'chokar_loding', n:'चोकर लोडिंग'},
    {k:'chokar_fill', n:'चोकर Fill'},
    {k:'wheat_holar', n:'Wheat Holar'},
  ];
  popup({
    title:'⚙️ Labour Rate Settings',
    body:`<div class="rate-grid">${defs.map(d=>`<div class="rname">${d.n}</div><input type="number" step="0.01" data-rk="${d.k}" value="${rates[d.k]}">`).join('')}</div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="rt-save">✓ Save Rates</button></div>`,
    onOpen(bk){
      bk.querySelector('#rt-save').addEventListener('click',()=>{
        const r=getRates();
        bk.querySelectorAll('[data-rk]').forEach(i=>{ r[i.dataset.rk]=parseFloat(i.value)||0; });
        setRates(r); closePopup(); toast('Rates save ✔');
      });
    }
  });
}

/* =========================================================
   RENDER
========================================================= */
function esc(s){ return String(s??'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }

/* ---- column HTML builders (reused by live view + record book) ---- */
function buildRokad(db,live){
  return db.rokad.map((r,i)=>{
    const lines=r.items.map(it=>{
      let v=it.sub; if(v==='गोल्ड')v='Gold'; if(v==='चोकर')v='';
      let pay='';
      if(it.online>0&&it.cash>0) pay=` <span class="pay-mix">(<span class="cash-part">${fmt(it.cash)}</span>+<span class="ac-part">${fmt(it.online)} A/C</span>)</span>`;
      else if(it.online>0) pay=` <span class="ac-mark">(A/C)</span>`;
      const km = it.km? '(km)' : '';
      return `<div><span class="amt">${fmt(it.total)}</span>${esc(it.item)} ${esc(v)} ${it.qty}×${fmt(it.price)}${km}${pay}</div>`;
    }).join('');
    return `<div class="hw-entry ${r.cut?'cut':''} ${r.edited?'edited':''} ${r.online>0&&r.cash===0?'is-ac':''}" data-sec="rokad" data-i="${i}">${lines}<span class="ts">${r.ts}</span>${editTag(r)}</div>`;
  }).join('') + (live?`<div class="add-strip" data-add="rokad">+ नयी बिक्री entry</div>`:'');
}
function buildJama(db,live){
  return db.jama.map((r,i)=>
    `<div class="hw-entry ${r.cut?'cut':''} ${r.edited?'edited':''} ${r.online>0?'is-ac':''}" data-sec="jama" data-i="${i}">
      <span class="amt">${fmt(r.amount)}</span>${esc(r.name)}${r.address?` <small>(${esc(r.address)})</small>`:''}${r.online>0?` <span class="ac-mark">A/C</span>`:''}
      <span class="ts">${r.ts}</span>${editTag(r)}</div>`
  ).join('') + (live?`<div class="add-strip" data-add="jama">+ नयी जमा entry</div>`:'');
}
function buildMaal(db,live){
  return db.maal.map((r,i)=>{
    /* value हमेशा दिखे — भरा हो तो digit, खाली हो तो — */
    const w=(v,lbl)=>`<span class="m-cell"><span class="m-lbl">${lbl}</span>-${v===null||v===undefined||v===''?'<span style="color:#b6bcc9">—</span>':fmt(v)}</span>`;
    /* ---- simple (Pouch / Daal / Roast): ऊपर Total Amount → नाम → नीचे kg × rate ---- */
    if(r.kind==='simple'){
      const amt=(r.rate||0)*(r.qty||0);
      const u=r.qtyUnit||'';
      /* ऊपर Serial No, और नाम/label से पहले Amount (box में) */
      const un = u || r.rateUnit || 'kg';
      return `<div class="hw-entry maal-entry simple-entry ${r.cut?'cut':''} ${r.edited?'edited':''}" data-sec="maal" data-i="${i}">
        <div class="s-amt"><span class="maal-serial">${r.serial}</span></div>
        <div class="s-name"><span class="amt">${fmt(amt)}</span>${esc(r.label||'')}${r.opt?` <small>(${esc(r.opt)})</small>`:''}</div>
        ${r.name?`<div class="s-who">${esc(r.name)}${r.address?` (${esc(r.address)})`:''}</div>`:''}
        <div class="s-calc">${fmt(r.qty||0)}${esc(un)} × ${r.rate===null||r.rate===undefined?'<span style="color:#b6bcc9">?</span>':fmt(r.rate)}rs</div>
        ${r.vehicle?`<div class="m-veh">गाडी नं०- ${esc(r.vehicle)}</div>`:''}
        <span class="ts">${r.ts}</span>${editTag(r)}</div>`;
    }
    let mid='';
    if((r.kind||'rst')==='rst'){
      // line 1 : RST + GROSS   |   line 2 : TARE + NETT  (दोनों एक-एक line में)
      mid=`<div class="m-line">${r.rst?`<span class="m-cell"><span class="m-lbl">RST</span>-${esc(r.rst)}</span>`:''}${w(r.gross,'GROSS')}</div>
           <div class="m-line">${w(r.tare,'TARE')}${w(r.nett,'NETT')}</div>
           ${r.vehicle?`<div class="m-line m-veh">गाडी नं०- ${esc(r.vehicle)}</div>`:''}`;
    }else{
      const chips=(r.weights&&r.weights.length)? r.weights.map(x=>`<span class="fill-chip">${fmt(x)}</span>`).join('') : '<span style="color:#b6bcc9">—</span>';
      // बोरा count ऊपर वाले circle में ही दिखता है — यहाँ दोबारा नहीं
      mid=`<div class="fill-wrap"><span class="fill-tag">FILL</span>${chips}<span class="fill-sum">${r.fillTotal?fmt(r.fillTotal)+' kg':'—'}</span></div>`;
    }
    const isFill=(r.kind||'rst')==='fill';
    const picShow = isFill ? ((r.weights&&r.weights.length)||0) : r.pic;
    return `<div class="hw-entry maal-entry ${r.cut?'cut':''} ${r.edited?'edited':''}" data-sec="maal" data-i="${i}">
      <div class="m-top">
        <div class="m-left">
          <div class="m-name"><span class="maal-serial">${r.serial}</span>${r.label?`<span class="m-cat">${esc(r.label)}${r.opt?' · '+esc(r.opt):''}</span> `:''}${esc(r.name)}${r.address?` (${esc(r.address)})`:''}</div>
          ${mid}
        </div>
        <div class="maal-badge"><span class="dp">D&nbsp;P&nbsp;W</span><span class="dpw-val">${picShow} = ${r.dust||0}/${r.plastic||0}/${r.wet||0}</span></div>
        <div class="maal-rate ${r.rate===null||r.rate===undefined?'empty':''}">RATE-${r.rate===null||r.rate===undefined?'?':fmt(r.rate)}${r.rateUnit?'/'+(r.rateUnit==='बोरा'?'🧺बोरा':esc(r.rateUnit)):''}</div>
      </div>
      <span class="ts">${r.ts}</span>${editTag(r)}</div>`;
  }).join('') + (live?`<div class="add-strip" data-add="maal">+ नयी माल आवत entry (Wheat/Bag/Daal/Roast)</div>`:'') + buildIOCard(db,live);
}
function buildNagad(db,live){
  const modeTag={cash:'',online:' <span class="ac-mark">A/C</span>',home:' <b>(Home)</b>',counter:' (Con-ter)'};
  return db.nagad.map((r,i)=>
    `<div class="hw-entry ${r.cut?'cut':''} ${r.edited?'edited':''} ${r.mode==='online'?'is-ac':''} ${r.mode==='home'?'is-home':''}" data-sec="nagad" data-i="${i}">
      <span class="amt">${fmt(r.amount)}</span>${esc(r.name)}${r.address?` <small>(${esc(r.address)})</small>`:''}${r.item?` — ${esc(r.item)}`:''}${modeTag[r.mode]||''}
      <span class="ts">${r.ts}</span>${editTag(r)}</div>`
  ).join('') + (live?`<div class="add-strip" data-add="nagad">+ नयी नगद नाम entry</div>`:'');
}
function buildKharch(db,live){
  return db.kharch.map((r,i)=>{
    if(r.type==='labour'){
      return `<div class="hw-entry labour-entry ${r.cut?'cut':''} ${r.edited?'edited':''}" data-sec="kharch" data-i="${i}">
        <div class="lab-head"><span class="lab-total amt">${fmt(r.amount)}</span> Labour</div>
        <div class="branches">${r.labour.map(l=>`<div><span class="b-amt">${fmt(l.amt)}</span>${esc(l.short)}${l.qty?` (${l.qty})`:''}</div>`).join('')}</div>
        <span class="ts">${r.ts}</span>${editTag(r)}</div>`;
    }
    return `<div class="hw-entry ${r.cut?'cut':''} ${r.edited?'edited':''} ${r.pending?'pending-kharch':''}" data-sec="kharch" data-i="${i}">
      <span class="amt">${fmt(r.amount)}</span>${esc(r.name)}${r.pending?'<span class="pending-tag">Exact बाद में ⏳</span>':''}
      <span class="ts">${r.ts}</span>${editTag(r)}</div>`;
  }).join('') + (live?`<div class="add-strip" data-add="kharch">+ नयी खर्च entry</div>`:'');
}
/* पुराना amount cut + नया amount + छोटा time stamp */
function ioAmtHTML(cur,old,ets){
  const oldHTML=(old!==null&&old!==undefined)? `<span class="io-old">${fmt(old)}</span>` : '';
  return `${oldHTML}${fmt(cur)}${ets?`<span class="ts ed">✏️ ${esc(ets)}</span>`:''}`;
}
function buildInHome(db,live){
  const rows=(db.inhome||[]).map((a,i)=>`<div class="io-amt" data-io="in" data-i="${i}" title="बदलने के लिए click करें"><span class="plus">${i>0?'+':''}</span>${ioAmtHTML(a.amount,a.old,a.ets)} <span class="ts">${esc(a.ts||'')}</span></div>`).join('');
  const sum=(db.inhome||[]).reduce((s,a)=>s+a.amount,0);
  return rows + ((db.inhome||[]).length>1?`<div class="io-sum">${fmt(sum)}</div>`:'') + (!rows&&live?`<div style="color:#c3cad6;font-size:11px;font-family:'Kalam';">घर से लाया ₹…</div>`:'');
}
function buildOutHome(db,live){
  const L=ohArr(db);
  const rows=L.map((a,i)=>`<div class="io-amt" data-io="out" data-i="${i}" title="बदलने के लिए click करें"><span class="plus">${i>0?'+':''}</span>${ioAmtHTML(a.amount,a.old,a.ets)} <span class="ts">${esc(a.ts||'घर →')}</span></div>`).join('');
  const sum=L.reduce((s2,a)=>s2+(parseFloat(a.amount)||0),0);
  return rows + (L.length>1?`<div class="io-sum">${fmt(sum)}</div>`:'') + (!rows&&live?`<div style="color:#c3cad6;font-size:11px;font-family:'Kalam';">घर ले गया ₹…</div>`:'');
}
/* IN/OUT HOME — माल आवत column के अंदर best-design card */
function buildIOCard(db,live){
  const hasData=(db.inhome&&db.inhome.length)||ohArr(db).length;
  if(!live && !hasData) return '';
  return `<div class="io-card" data-nocol="1">
    <div class="io-head"><div class="in-h" id="inhome-head">🏠 IN HOME</div><div class="out-h" id="outhome-head">OUT HOME 🏠</div></div>
    <div class="io-body"><div class="io-bcol" id="col-inhome">${buildInHome(db,live)}</div><div class="io-bcol" id="col-outhome">${buildOutHome(db,live)}</div></div>
  </div>`;
}

function renderAll(){
  /* opening खाली / auto हो तो पिछले दिन के OUT HOME बचत से refresh */
  const _op=DB.opening; applyCarry(DB,CUR_DATE); if(DB.opening!==_op) save();
  $('#nb-date-l').textContent=CUR_DATE; $('#nb-date-r').textContent=CUR_DATE;
  $('#rokad-head-amt').textContent = DB.opening!==null? fmt(DB.opening):'';
  $('#col-rokad').innerHTML = buildRokad(DB,true);
  $('#col-jama').innerHTML  = buildJama(DB,true);
  $('#col-maal').innerHTML  = buildMaal(DB,true);
  $('#col-nagad').innerHTML = buildNagad(DB,true);
  $('#col-kharch').innerHTML= buildKharch(DB,true);
  const bb=$('#nb-back');
  if(CUR_DATE!==DATE){ bb.textContent='← आज पर वापस'; bb.style.background='linear-gradient(135deg,#f39c12,#d35400)'; }
  else{ bb.textContent='← Home'; bb.style.background=''; }
  renderTotals();
}

/* ---------- totals ---------- */
function computeTotals(db=DB){
  const alive=a=>(a||[]).filter(x=>!x.cut);
  const rokadAdd = (db.opening||0) + alive(db.rokad).reduce((a,x)=>a+x.total,0);
  const rokadAC  = alive(db.rokad).reduce((a,x)=>a+x.online,0);
  const jamaAdd  = alive(db.jama).reduce((a,x)=>a+x.amount,0);
  const jamaAC   = alive(db.jama).reduce((a,x)=>a+x.online,0);
  const ng=alive(db.nagad);
  const nagadAdd = ng.reduce((a,x)=>a+x.amount,0);                      // सबका add (जैसे जमा में)
  const nagadAC  = ng.filter(x=>x.mode==='online').reduce((a,x)=>a+x.amount,0);
  const nagadHome= ng.filter(x=>x.mode==='home').reduce((a,x)=>a+x.amount,0);
  const kharchT  = alive(db.kharch).reduce((a,x)=>a+x.amount,0);
  const inhomeT  = (db.inhome||[]).reduce((a,x)=>a+x.amount,0);
  const nagadFinal = nagadAdd - nagadAC - nagadHome;
  /* कुल Total = (रोकड + जमा + IN HOME) − (नगद नाम खाते + नगद खर्च)
     — नगद नाम खाते और नगद खर्च अब जुड़ते नहीं, घटते हैं */
  const grand = (rokadAdd-rokadAC)+(jamaAdd-jamaAC)+inhomeT-nagadFinal-kharchT;
  return {
    rokadAdd,rokadAC,rokadFinal:rokadAdd-rokadAC,
    jamaAdd,jamaAC,jamaFinal:jamaAdd-jamaAC,
    nagadAdd,nagadAC,nagadHome,nagadFinal,
    kharchT,inhomeT,grand
  };
}

function totalBlockHTML(add,ac,fin,label,extra=''){
  return `<div class="total-block">
    <div class="t-line"></div>
    <div class="t-row"><span class="t-num">${fmt(add)}</span></div>
    <div class="t-row red"><span class="t-num">-${fmt(ac)}</span><span class="t-lbl">A/C</span></div>
    <div class="t-line"></div>
    <div class="t-row green"><span class="t-num">${fmt(fin)}</span><span class="t-lbl final-name">→ ${label}</span></div>
    ${extra}</div>`;
}

function nagadBlockHTML(T){
  return `<div class="total-block">
    <div class="t-line"></div>
    <div class="t-row"><span class="t-num">${fmt(T.nagadAdd)}</span></div>
    <div class="t-row red"><span class="t-num">-${fmt(T.nagadAC)}</span><span class="t-lbl">A/C</span></div>
    ${T.nagadHome?`<div class="t-row red"><span class="t-num">-${fmt(T.nagadHome)}</span><span class="t-lbl">Home</span></div>`:''}
    <div class="t-line"></div>
    <div class="t-row green"><span class="t-num">${fmt(T.nagadFinal)}</span><span class="t-lbl final-name">→ नगद नाम खाते</span></div></div>`;
}
function grandBlockHTML(T){
  return `<div class="grand-block">
      <div class="t-row"><span class="t-num">${fmt(T.rokadFinal)}</span><span class="t-lbl">रोकड + नगदी बिक्री</span></div>
      <div class="t-row"><span class="t-num">${fmt(T.jamaFinal)}</span><span class="t-lbl">जमा खाते नाम</span></div>
      <div class="t-row red"><span class="t-num">-${fmt(T.nagadFinal)}</span><span class="t-lbl">नगद नाम खाते</span></div>
      <div class="t-row red"><span class="t-num">-${fmt(T.kharchT)}</span><span class="t-lbl">नगद खर्च</span></div>
      ${T.inhomeT?`<div class="t-row"><span class="t-num">${fmt(T.inhomeT)}</span><span class="t-lbl">IN HOME</span></div>`:''}
      <div class="t-line double"></div>
      <div class="t-row green" style="font-size:1.25em;"><span class="t-num">${fmt(T.grand)}</span><span class="t-lbl">कुल Total</span></div>
    </div>`;
}
function injectTotals(rootSel,T){
  const q=s=>document.querySelector(rootSel+' '+s);
  q('#col-rokad')?.insertAdjacentHTML('beforeend', totalBlockHTML(T.rokadAdd,T.rokadAC,T.rokadFinal,'रोकड + नगदी बिक्री',grandBlockHTML(T)));
  q('#col-jama')?.insertAdjacentHTML('beforeend', totalBlockHTML(T.jamaAdd,T.jamaAC,T.jamaFinal,'जमा खाते नाम'));
  q('#col-nagad')?.insertAdjacentHTML('beforeend', nagadBlockHTML(T));
  q('#col-kharch')?.insertAdjacentHTML('beforeend', `<div class="total-block"><div class="t-line"></div>
    <div class="t-row green"><span class="t-num">${fmt(T.kharchT)}</span><span class="t-lbl final-name">→ नगद खर्च Total</span></div></div>`);
}
function renderTotals(){
  $$('#notebook .total-block,#notebook .grand-block').forEach(x=>x.remove());
  if(!DB.totals) return;
  injectTotals('#notebook',DB.totals);
}

/* TOTAL button = toggle: एक बार = दिखाओ, दूसरी बार = हटाओ */
$('#nb-total-btn').addEventListener('click',()=>{
  if(DB.totals){ DB.totals=null; save(); renderAll(); toast('Total हट गया'); }
  else{ DB.totals=computeTotals(); save(); renderAll(); toast('Total बन गया ✔'); }
});

/* ---------- IN / OUT HOME (delegated — card re-created on every render) ---------- */
document.addEventListener('click',e=>{
  if(!e.target.closest('#notebook-screen')) return;
  const amt=e.target.closest('.io-amt');
  if(amt && amt.dataset.io==='in'){ editInHome(+amt.dataset.i); return; }
  if(amt && amt.dataset.io==='out'){ editOutHome(+amt.dataset.i); return; }
  if(e.target.closest('#inhome-head')||e.target.closest('#col-inhome')){ openInHome(); }
  else if(e.target.closest('#outhome-head')||e.target.closest('#col-outhome')){ openOutHome(); }
});
function openInHome(){
  popup({
    title:'🏠 IN HOME — घर से लाया',
    body:`<div class="pp-note">जब भी घर से पैसा आए — हर बार नया + होकर जुड़ेगा</div>
      <div class="f-row"><label>Amount</label><input type="number" id="ih-amt" inputmode="decimal"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ih-save">✓ Save</button></div>`,
    onOpen(bk){
      bk.querySelector('#ih-amt').focus();
      bk.querySelector('#ih-save').addEventListener('click',()=>{
        const a=parseFloat(bk.querySelector('#ih-amt').value)||0;
        if(a<=0){ toast('Amount भरें'); return; }
        DB.inhome.push({amount:a,ts:nowTS()}); save(); closePopup(); renderAll();
      });
    }
  });
}
/* IN HOME — amount edit (पुराना amount cut होकर दिखेगा + छोटा time stamp) */
function editInHome(i){
  const r=(DB.inhome||[])[i]; if(!r) return;
  popup({
    title:'✏️ IN HOME — Amount बदलें',
    body:`<div class="pp-note">पुराना amount <b>${fmt(r.amount)}</b> कट कर दिखेगा और नया amount के साथ छोटा time stamp आएगा</div>
      <div class="f-row"><label>नया Amount</label><input type="number" id="ihe-amt" inputmode="decimal" value="${r.amount}"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;">
      <button class="pp-btn cancel" id="ihe-del">🗑️ हटाएँ</button>
      <button class="pp-btn cancel" onclick="closePopup()">Cancel</button>
      <button class="pp-btn save" id="ihe-save">✓ Save</button></div>`,
    onOpen(bk){
      bk.querySelector('#ihe-amt').focus();
      bk.querySelector('#ihe-del').addEventListener('click',()=>{
        DB.inhome.splice(i,1); save(); closePopup(); renderAll(); toast('हटा दिया');
      });
      bk.querySelector('#ihe-save').addEventListener('click',()=>{
        const a=parseFloat(bk.querySelector('#ihe-amt').value)||0;
        if(a<=0){ toast('Amount भरें'); return; }
        if(a!==r.amount){ if(r.old===undefined||r.old===null) r.old=r.amount; r.amount=a; r.ets=nowTS(); }
        save(); closePopup(); renderAll(); toast('IN HOME update ✔');
      });
    }
  });
}
function openOutHome(){
  const T=computeTotals();
  popup({
    title:'🏠 OUT HOME — घर ले गया',
    body:`<div class="pp-note">जब भी घर पैसा जाए — हर बार नया + होकर जुड़ेगा<br>अभी कुल Total: <b>${fmt(T.grand)}</b> — जो बचेगा वह अगले दिन रोकड में अपने आप आएगा</div>
      <div class="f-row"><label>OUT Amount</label><input type="number" id="oh-amt" inputmode="decimal"></div>
      <div class="f-row"><label>अगला दिन रोकड</label><div class="ro" id="oh-carry">${fmt(T.grand-ohSum(DB))}</div></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="oh-save">✓ Save</button></div>`,
    onOpen(bk){
      const cur=ohSum(DB);
      const upd=()=>{ const o=parseFloat(bk.querySelector('#oh-amt').value)||0; bk.querySelector('#oh-carry').textContent=fmt(T.grand-cur-o); };
      bk.querySelector('#oh-amt').addEventListener('input',upd);
      bk.querySelector('#oh-amt').focus();
      bk.querySelector('#oh-save').addEventListener('click',()=>{
        const o=parseFloat(bk.querySelector('#oh-amt').value)||0;
        if(o<=0){ toast('Amount भरें'); return; }
        if(!Array.isArray(DB.outhome)) DB.outhome=ohArr(DB);
        DB.outhome.push({amount:o,ts:nowTS()});
        saveOutHome(T);
      });
    }
  });
}
/* OUT HOME — amount edit (पुराना amount cut होकर दिखेगा + छोटा time stamp) */
function editOutHome(i){
  const L=ohArr(DB); const r=L[i]; if(!r) return;
  DB.outhome=L;
  const T=computeTotals();
  popup({
    title:'✏️ OUT HOME — Amount बदलें',
    body:`<div class="pp-note">पुराना amount <b>${fmt(r.amount)}</b> कट कर दिखेगा और नया amount के साथ छोटा time stamp आएगा</div>
      <div class="f-row"><label>नया Amount</label><input type="number" id="ohe-amt" inputmode="decimal" value="${r.amount}"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;">
      <button class="pp-btn cancel" id="ohe-del">🗑️ हटाएँ</button>
      <button class="pp-btn cancel" onclick="closePopup()">Cancel</button>
      <button class="pp-btn save" id="ohe-save">✓ Save</button></div>`,
    onOpen(bk){
      bk.querySelector('#ohe-amt').focus();
      bk.querySelector('#ohe-del').addEventListener('click',()=>{ DB.outhome.splice(i,1); saveOutHome(T,'हटा दिया'); });
      bk.querySelector('#ohe-save').addEventListener('click',()=>{
        const a=parseFloat(bk.querySelector('#ohe-amt').value)||0;
        if(a<=0){ toast('Amount भरें'); return; }
        if(a!==r.amount){ if(r.old===undefined||r.old===null) r.old=r.amount; r.amount=a; r.ets=nowTS(); }
        saveOutHome(T,'OUT HOME update ✔');
      });
    }
  });
}
function saveOutHome(T,msg){
  save();
  const left=T.grand-ohSum(DB);
  localStorage.setItem('sg_carry',JSON.stringify({date:CUR_DATE,amount:left}));
  syncForwardCarry(CUR_DATE);
  closePopup(); renderAll();
  toast(msg||('अगले दिन रोकड में '+fmt(left)+' अपने आप आएगा ✔'));
}

/* ---------- column click / entry interactions ---------- */
const SEC_OPEN={rokad:openRokad,jama:openJama,maal:openMaalEntry,nagad:openNagad,kharch:openKharch};
const clickState={};
function handleEntryTap(entry){
  const key=entry.dataset.sec+entry.dataset.i;
  clickState[key]=(clickState[key]||0)+1;
  clearTimeout(entry._tapTm);
  entry._tapTm=setTimeout(()=>{
    const n=clickState[key]; clickState[key]=0;
    const sec=entry.dataset.sec, i=+entry.dataset.i;
    if(n>=4){ // 4 taps = cut ; cut entry + 4 taps = password → restore/delete
      if(!DB[sec][i].cut){
        DB[sec][i].cut=true; save(); renderAll();
        toast('Entry काट दी गई ✂️ (total में नहीं जुड़ेगी)');
      }else{
        askPassword(()=>openCutManage(sec,i),'🔐 कटी Entry — Password');
      }
    }else if(n>=2){ // double-tap = entry options (edit)
      openEntryOptions(sec,i);
    }else{
      if(sec==='kharch' && DB.kharch[i].pending){ openPendingFill(i); }
    }
  },320);
}
function openEntryOptions(sec,i){
  popup({
    title:'📝 Entry Options',
    body:`<div class="print-choice">
        <button id="eo-edit" style="border-color:#f39c12;"><span class="pc-ico">✏️</span>Edit करें<br><small style="color:#8a94a6">बदलने पर समय + highlight</small></button>
        <button id="eo-cut" style="border-color:#ff7675;"><span class="pc-ico">✂️</span>Cut करें<br><small style="color:#8a94a6">total से हटेगी</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelector('#eo-edit').addEventListener('click',()=>{ closePopup(); SEC_OPEN[sec](i); });
      bk.querySelector('#eo-cut').addEventListener('click',()=>{ closePopup(); DB[sec][i].cut=true; save(); renderAll(); toast('Entry काट दी गई ✂️'); });
    }
  });
}
function openCutManage(sec,i){
  popup({
    title:'✂️ कटी Entry',
    body:`<div class="print-choice">
        <button id="cm-restore"><span class="pc-ico">♻️</span>कट हटाएँ<br><small style="color:#8a94a6">वापस total में जुड़ेगी</small></button>
        <button id="cm-delete"><span class="pc-ico">🗑️</span>Entry हटाएँ<br><small style="color:#8a94a6">पूरी तरह delete</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelector('#cm-restore').addEventListener('click',()=>{ DB[sec][i].cut=false; save(); closePopup(); renderAll(); toast('Entry वापस जुड़ गई ✔'); });
      bk.querySelector('#cm-delete').addEventListener('click',()=>{ DB[sec].splice(i,1); save(); closePopup(); renderAll(); toast('Entry delete ✔'); });
    }
  });
}
document.addEventListener('click',e=>{
  const strip=e.target.closest('.add-strip');
  if(strip){ e.stopPropagation(); SEC_OPEN[strip.dataset.add](); return; }
  if(e.target.closest('.io-card')) return; // handled by IN/OUT delegation
  const entry=e.target.closest('.hw-entry');
  if(entry && entry.dataset.sec){ handleEntryTap(entry); return; }
  const col=e.target.closest('.nb-col');
  if(col && !e.target.closest('.total-block') && !e.target.closest('.grand-block')){
    const map={'col-rokad':'rokad','col-jama':'jama','col-maal':'maal','col-nagad':'nagad','col-kharch':'kharch'};
    const sec=map[col.id]; if(sec){ SEC_OPEN[sec](); }
  }
});
$('#rokad-head-amt').parentElement.addEventListener('click',e=>{ if(e.target.classList.contains('head-amt')||e.target.closest('.head-amt')){ e.stopPropagation(); openOpening(); } });
$('#rokad-head-amt').addEventListener('click',e=>{ e.stopPropagation(); openOpening(); });

/* ---------- print ---------- */
function openPrintChoice(){
  popup({
    title:'🖨️ Print — कौन सा चाहिए?',
    body:`<div class="print-choice">
        <button id="pr-plain"><span class="pc-ico">📄</span>Plain<br><small style="color:#8a94a6">बिना Total</small></button>
        <button id="pr-total"><span class="pc-ico">🧮</span>With Total<br><small style="color:#8a94a6">Total के साथ</small></button>
        <button id="pr-receipt"><span class="pc-ico">🧾</span>Receipt<br><small style="color:#8a94a6">ग्राहक Receipt</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelector('#pr-plain').addEventListener('click',()=>{ closePopup(); printNotebook(DB,CUR_DATE,false); });
      bk.querySelector('#pr-total').addEventListener('click',()=>{ closePopup(); DB.totals=computeTotals(); save(); renderAll(); printNotebook(DB,CUR_DATE,true); });
      bk.querySelector('#pr-receipt').addEventListener('click',()=>{ closePopup(); openReceipt(); });
    }
  });
}

/* build a static notebook snapshot for print (fits one A4 landscape) */
function notebookHTML(db,date,withTotal){
  const wrap=document.createElement('div');
  wrap.innerHTML=`<div class="notebook">
    <div class="nb-spine"></div>
    <div class="nb-page left">
      <div class="nb-date">${date}</div>
      <div class="nb-cols-head"><div class="nb-col-title"><span class="head-amt">${db.opening!==null&&db.opening!==undefined?fmt(db.opening):''}</span>रोकड + नगदी बिक्री</div><div class="nb-col-title">जमा खाते नाम</div></div>
      <div class="nb-body"><div class="nb-colline"></div>
        <div class="nb-col" id="col-rokad">${buildRokad(db,false)}</div>
        <div class="nb-col right-col" id="col-jama">${buildJama(db,false)}</div></div>
    </div>
    <div class="nb-page right">
      <div class="nb-date">${date}</div>
      <div class="nb-cols-head"><div class="nb-col-title">माल आवत खाते</div><div class="nb-col-title">नगद नाम खाते</div></div>
      <div class="nb-body"><div class="nb-colline"></div>
        <div class="nb-col" id="col-maal">${buildMaal(db,false)}</div>
        <div class="nb-col-stack">
          <div class="nb-col right-col" id="col-nagad">${buildNagad(db,false)}</div>
          <div class="kharch-divider">नगद खर्च</div>
          <div class="nb-col right-col" id="col-kharch">${buildKharch(db,false)}</div>
        </div></div>
    </div></div>`;
  return wrap;
}
/* =========================================================
   PRINT ENGINE  (पूरा नया — hidden iframe में असली page बनता है)
   पुराना तरीक़ा (body>* {display:none} + #print-stage) tablet/mobile
   browsers में blank white page दे रहा था। अब print अपने अलग
   document में होता है — कभी blank नहीं आएगा।
========================================================= */
const PRINT_FONTS='https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap';
function appCSS(){ return Array.from(document.querySelectorAll('style')).map(s=>s.textContent).join('\n'); }
function printOverrideCSS(landscape,overlay){
  const hide = overlay
    ? `@media print{
         body > *:not(#sg-print-overlay){display:none!important;}
         #sg-print-overlay{position:static!important;padding:0!important;overflow:visible!important;background:#fff!important;}
         #sg-print-overlay .pbar{display:none!important;}
       }`
    : `.bg-3d,.screen,#toast,#popups-root,#ph-viewer{display:none!important;}`;
  return `
  @page{size:A4 ${landscape?'landscape':'portrait'};margin:5mm;}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html,body{margin:0!important;padding:0!important;background:#fff!important;min-height:0!important;width:auto!important;overflow:visible!important;}
  ${hide}
  #pstage{overflow:hidden;page-break-after:avoid;break-after:avoid;page-break-inside:avoid;break-inside:avoid;}
  #pw{transform-origin:top left;display:block;}
  #pw{min-height:0;}
  #pw .notebook{box-shadow:none!important;animation:none!important;min-height:100%!important;
    flex-direction:row!important;border:1.5px solid #444;border-radius:0;background:#fff;display:flex;}
  #pw .nb-page{width:50%!important;padding:8px 10px 12px!important;background:#fff!important;box-shadow:none!important;border-radius:0!important;}
  #pw .nb-page.right{border-left:1.5px solid #444;}
  #pw .nb-spine{display:none!important;}
  #pw .add-strip{display:none!important;}
  #pw .nb-date{font-size:13px!important;}
  #pw .nb-col-title{font-size:13px!important;}
  #pw .nb-col-title .head-amt{font-size:12.5px!important;}
  #pw .hw-entry{font-size:11.5px!important;}
  #pw .maal-entry{font-size:11px!important;}
  #pw .sbook .sb-sub.big{font-size:1em!important;}
  #pw .total-block{font-size:11.5px!important;}
  #pw .kharch-divider{font-size:12.5px!important;}
  #pw .nb-col{min-height:40px!important;padding-bottom:6px!important;}
  #pw .io-card{margin-top:22px!important;}
  /* ---- ATTENDANCE : पूरा महीना (1 → last date) + P column एक ही page पर ---- */
  #pw .att-wrap{box-shadow:none!important;border:none!important;max-height:none!important;overflow:visible!important;width:auto!important;}
  #pw .att-table{font-size:9.5px;border-collapse:collapse!important;border-spacing:0!important;width:auto!important;min-width:0!important;}
  #pw .att-table th,#pw .att-table td{border:1px solid #999!important;padding:1.5px 2px!important;white-space:nowrap;}
  #pw .att-table thead th{position:static!important;background:#e9edf3!important;color:#111!important;font-size:9px!important;}
  #pw .att-table thead th .dow{font-size:7px!important;}
  #pw .att-table .st-name{position:static!important;box-shadow:none!important;min-width:0!important;
    background:#fff!important;color:#111!important;font-size:9.5px!important;padding:1.5px 5px!important;}
  #pw .att-table .att-mark{font-size:9px!important;}
  #pw .att-title{font-size:15px!important;padding:3px!important;}
  `;
}
const IS_IOS   = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document);
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0;

function printDocHTML(innerHTML,landscape){
  return `<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>SATYAM GOLD — Print</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="${PRINT_FONTS}">
    <style>${appCSS()}</style>
    <style>${printOverrideCSS(landscape,false)}
      .pbar{position:fixed;left:0;right:0;top:0;z-index:99;display:flex;gap:10px;justify-content:center;padding:10px;background:#243447;}
      .pbar button{padding:10px 22px;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer;font-family:'Poppins',sans-serif;}
      .pbar .go{background:#2ecc71;color:#fff;} .pbar .cl{background:#e9edf3;color:#40506b;}
      body{padding-top:56px;}
      @media print{ .pbar{display:none!important;} body{padding-top:0!important;} }
    </style></head><body>
    <div class="pbar"><button class="go" onclick="window.print()">🖨️ Print</button><button class="cl" onclick="window.close()">✖ बंद करें</button></div>
    <div id="pstage"><div id="pw">${innerHTML}</div></div></body></html>`;
}

/* mm-आधारित नाप — असली A4 page में जितना आता है उतना ही scale, इसलिए हमेशा 1 ही page */
function sgFitDoc(doc,landscape,stretch,grow){
  try{
    if(grow===undefined) grow = !!window.SG_GROW;
    const pw=doc.getElementById('pw'), st=doc.getElementById('pstage');
    if(!pw||!st) return;
    const probe=doc.createElement('div');
    probe.style.cssText='position:absolute;left:-9999px;top:0;width:100mm;height:10mm;';
    doc.body.appendChild(probe);
    let pxmm=probe.offsetWidth/100;
    probe.parentNode.removeChild(probe);
    if(!pxmm||!isFinite(pxmm)||pxmm<=0) pxmm=96/25.4;
    const M=5;                                        // @page margin (mm)
    const availW=((landscape?297:210)-2*M)*pxmm;
    const availH=((landscape?210:297)-2*M)*pxmm;
    pw.style.transform='none';
    pw.style.minHeight='0px';
    pw.style.width = stretch ? (availW+'px') : 'max-content';
    const mh=()=>Math.max(pw.scrollHeight, Math.ceil(pw.getBoundingClientRect().height), 1);
    const mw=()=>Math.max(pw.scrollWidth,  Math.ceil(pw.getBoundingClientRect().width),  1);
    let w=mw(), h=mh();
    let sc=Math.min(availW/w, availH/h);
    if(!grow){ sc=Math.min(1,sc); }
    else{
      /* grow mode — entry कम हों तो content ZOOM होकर पूरा A4 page भरेगा
         (layout width छोटी रखो और scale बड़ा करो → PDF में सब बड़ा दिखेगा),
         entry ज्यादा हों तो सिकुड़ कर हमेशा एक ही page में fit रहेगा */
      const MAXK=2.6;
      let k=Math.max(0.2, Math.min(MAXK, availH/h));
      for(let it=0; it<7; it++){
        pw.style.width=(availW/k)+'px';
        const hh=mh();
        let nk=Math.max(0.2, Math.min(MAXK, availH/hh));
        if(Math.abs(nk-k) <= 0.01){ k=nk; break; }
        k = k + (nk-k)*0.7;      /* damped — oscillation न हो */
      }
      pw.style.width=(availW/k)+'px';
      const hFin=mh();
      k=Math.max(0.2, Math.min(k, availH/hFin, MAXK));
      /* बची हुई खाली जगह भर दो, ताकि page आधा-खाली न दिखे */
      if(hFin*k < availH*0.99) pw.style.minHeight=Math.floor(availH/k)+'px';
      sc=k;
      h=mh();
    }
    pw.style.transformOrigin='top left';
    pw.style.transform='scale('+sc+')';
    st.style.width=Math.ceil(availW)+'px';
    st.style.height=Math.ceil(Math.min(h*sc,availH))+'px';
  }catch(err){}
}

/* Popup block होने पर — इसी page पर overlay बना कर print (Android fallback) */
function printViaOverlay(innerHTML,landscape,stretch){
  const oldO=document.getElementById('sg-print-overlay'); if(oldO) oldO.remove();
  const oldS=document.getElementById('sg-print-ovcss');   if(oldS) oldS.remove();
  const st=document.createElement('style'); st.id='sg-print-ovcss';
  st.textContent = printOverrideCSS(landscape,true) + `
    #sg-print-overlay{position:fixed;inset:0;background:#fff;z-index:99999;overflow:auto;padding:56px 8px 20px;}
    #sg-print-overlay .pbar{position:fixed;left:0;right:0;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:10px;background:#243447;}
    #sg-print-overlay .pbar button{padding:10px 22px;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer;}
    #sg-print-overlay .pbar .go{background:#2ecc71;color:#fff;} #sg-print-overlay .pbar .cl{background:#e9edf3;color:#40506b;}`;
  document.head.appendChild(st);
  const ov=document.createElement('div'); ov.id='sg-print-overlay';
  ov.innerHTML=`<div class="pbar"><button class="go">🖨️ Print</button><button class="cl">✖ बंद करें</button></div>
    <div id="pstage"><div id="pw">${innerHTML}</div></div>`;
  document.body.appendChild(ov);
  const close=()=>{ ov.remove(); st.remove(); };
  ov.querySelector('.cl').addEventListener('click',close);
  ov.querySelector('.go').addEventListener('click',()=>{ sgFitDoc(document,landscape,stretch); setTimeout(()=>window.print(),60); });
  setTimeout(()=>{ sgFitDoc(document,landscape,stretch); setTimeout(()=>{ try{ window.print(); }catch(e){} },120); },320);
}

/* भरोसेमंद Print —
   Tablet/Mobile (Android + iPad) पर iframe.print() पूरे app का screen छाप देता था
   (screenshot जैसा, 2 page) — इसलिए वहाँ हमेशा नयी tab में अपना साफ़ document बनता है।
   Desktop पर hidden iframe. दोनों जगह content mm-नाप से scale होकर 1 page में fit होता है। */
function printDocument(innerHTML,opt){
  opt = opt || {};
  const landscape = opt.landscape !== false;
  const stretch   = opt.stretch   !== false;
  window.SG_GROW = !!opt.grow;      // true → छोटा content भी पूरा page में बड़ा होकर fit होगा
  const html      = printDocHTML(innerHTML,landscape);
  toast('🖨️ Print तैयार हो रहा है…');

  if(IS_TOUCH || IS_IOS){
    let w=null; try{ w=window.open('','_blank'); }catch(e){}
    if(w && w.document){
      w.document.open(); w.document.write(html); w.document.close();
      const run=()=>{ sgFitDoc(w.document,landscape,stretch); try{ w.focus(); w.print(); }catch(e){} };
      const f=(w.document.fonts&&w.document.fonts.ready)?w.document.fonts.ready:Promise.resolve();
      f.catch(()=>{}).then(()=>setTimeout(run,600));
      return;
    }
    return printViaOverlay(innerHTML,landscape,stretch);
  }

  const old=document.getElementById('sg-print-frame'); if(old) old.remove();
  const fr=document.createElement('iframe');
  fr.id='sg-print-frame'; fr.setAttribute('aria-hidden','true');
  fr.style.cssText=`position:fixed;left:-20000px;top:0;width:1200px;height:1400px;border:0;background:#fff;`;
  document.body.appendChild(fr);
  const doc=fr.contentDocument||fr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  const fire=()=>{
    sgFitDoc(doc,landscape,stretch);
    let done=false;
    const cleanup=()=>{ if(done)return; done=true; setTimeout(()=>{ const f=document.getElementById('sg-print-frame'); if(f) f.remove(); },1000); };
    try{ fr.contentWindow.addEventListener('afterprint',cleanup); }catch(err){}
    try{ fr.contentWindow.focus(); fr.contentWindow.print(); }
    catch(err){ cleanup(); return printViaOverlay(innerHTML,landscape,stretch); }
    setTimeout(cleanup,120000);
  };
  const start=()=>{
    const f=(doc.fonts&&doc.fonts.ready)?doc.fonts.ready:Promise.resolve();
    f.catch(()=>{}).then(()=>setTimeout(fire,300));
  };
  if(doc.readyState==='complete') setTimeout(start,150);
  else fr.addEventListener('load',()=>setTimeout(start,150));
}
function printNotebook(db,date,withTotal){
  const snap=notebookHTML(db,date,withTotal);
  const host=document.createElement('div');
  host.appendChild(snap.firstElementChild);
  if(withTotal){
    // totals को detached DOM में ही inject करो
    const T=db.totals||computeTotals(db);
    const q=s=>host.querySelector(s);
    q('#col-rokad')?.insertAdjacentHTML('beforeend', totalBlockHTML(T.rokadAdd,T.rokadAC,T.rokadFinal,'रोकड + नगदी बिक्री',grandBlockHTML(T)));
    q('#col-jama')?.insertAdjacentHTML('beforeend', totalBlockHTML(T.jamaAdd,T.jamaAC,T.jamaFinal,'जमा खाते नाम'));
    q('#col-nagad')?.insertAdjacentHTML('beforeend', nagadBlockHTML(T));
    q('#col-kharch')?.insertAdjacentHTML('beforeend', `<div class="total-block"><div class="t-line"></div>
      <div class="t-row green"><span class="t-num">${fmt(T.kharchT)}</span><span class="t-lbl final-name">→ नगद खर्च Total</span></div></div>`);
  }
  printDocument(host.innerHTML,{landscape:true,stretch:true,grow:true});
}

/* triple-click date → direct print (with total) */
['nb-date-l','nb-date-r'].forEach(id=>{
  let c=0,t=null;
  $('#'+id).addEventListener('click',()=>{
    c++; clearTimeout(t);
    t=setTimeout(()=>{ if(c>=3){ DB.totals=DB.totals||computeTotals(); save(); renderAll(); printNotebook(DB,CUR_DATE,true); } c=0; },420);
  });
});

/* =========================================================
   RECEIPT PRINT (ग्राहक रसीद) — cash हुआ तो रोकड में (km) entry
========================================================= */
function openReceipt(){
  const rno=(DB.receipts.reduce((m,r)=>Math.max(m,r.no),0)||0)+1;
  let rItems=[];
  popup({
    title:'🧾 Receipt — No. '+rno,
    body:`<div class="f-row"><label>नाम</label><input type="text" id="rc-name"></div>
      <div class="f-row"><label>पता</label><input type="text" id="rc-addr"></div>
      <hr style="border:none;border-top:1.5px dashed #dde3ec;margin:8px 0 12px;">
      <div class="f-row"><label>Item</label><select id="rc-item">${Object.keys(ITEMS).map(k=>ITEMS[k].map(s=>`<option value="${k}|${s}">${k} ${s==='चोकर'?'':s}</option>`).join('')).join('')}</select></div>
      <div class="f-row"><label>Qty</label><input type="number" id="rc-qty" inputmode="numeric"></div>
      <div class="f-row"><label>Rate</label><input type="number" id="rc-rate" inputmode="decimal"></div>
      ${segRow('Payment',[{v:'cash',t:'💵 Cash'},{v:'online',t:'🏦 A/C'}],'cash')}
      <div class="cart-view" id="rc-cart"><b>Items:</b> (खाली)</div>
      <div class="big-total-preview" id="rc-total">Total: ₹0</div>`,
    foot:`<button class="pp-btn addmore" id="rc-add">+ Add Item</button>
      <div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="rc-print">🖨️ Save & Print</button></div>`,
    onOpen(bk){
      wireSeg(bk);
      const renderC=()=>{ bk.querySelector('#rc-cart').innerHTML='<b>Items:</b> '+(rItems.length?rItems.map(x=>`<div>• ${x.item} ${x.sub} — ${x.qty} × ${fmt(x.rate)} = <b>${fmt(x.qty*x.rate)}</b></div>`).join(''):'(खाली)');
        bk.querySelector('#rc-total').textContent='Total: ₹'+fmt(rItems.reduce((a,x)=>a+x.qty*x.rate,0)); };
      const collect=()=>{
        const q=parseFloat(bk.querySelector('#rc-qty').value)||0, rt=parseFloat(bk.querySelector('#rc-rate').value)||0;
        if(q<=0||rt<=0) return false;
        const [item,sub]=bk.querySelector('#rc-item').value.split('|');
        rItems.push({item,sub,qty:q,rate:rt});
        bk.querySelector('#rc-qty').value=''; bk.querySelector('#rc-rate').value='';
        return true;
      };
      bk.querySelector('#rc-add').addEventListener('click',()=>{ if(collect()) renderC(); else toast('Qty और Rate भरें'); });
      bk.querySelector('#rc-print').addEventListener('click',()=>{
        collect();
        const name=bk.querySelector('#rc-name').value.trim();
        if(!name){ toast('नाम भरें'); return; }
        if(!rItems.length){ toast('कोई item नहीं'); return; }
        const addr=bk.querySelector('#rc-addr').value.trim();
        const pay=segVal(bk)||'cash';
        const rc={no:rno,name,address:addr,items:rItems,pay,ts:nowTS()};
        DB.receipts.push(rc);
        // रोकड में (km) entry सिर्फ तभी जब नाम में "cash" लिखा हो (जैसे "cash" या "Avinash cash") — payment mode कुछ भी हो
        if(/cash/i.test(name)){
          const items=rItems.map(x=>({item:x.item,sub:x.sub,qty:x.qty,price:x.rate,total:x.qty*x.rate,
            cash:pay==='cash'?x.qty*x.rate:0,online:pay==='online'?x.qty*x.rate:0,km:true}));
          const total=items.reduce((a,x)=>a+x.total,0);
          DB.rokad.push({items,total,cash:pay==='cash'?total:0,online:pay==='online'?total:0,ts:nowTS(),cut:false,fromReceipt:rno});
        }
        save(); closePopup(); renderAll();
        printReceipt(rc);
      });
    }
  });
}
function printReceipt(rc){
  const total=rc.items.reduce((a,x)=>a+x.qty*x.rate,0);
  const html=`<div class="rcpt-paper">
    <h2>SATYAM GOLD</h2><div class="r-sub">CASH / CREDIT MEMO</div>
    <div class="rcpt-meta"><span>Receipt No: <b>${rc.no}</b></span><span>${CUR_DATE} &nbsp; ${rc.ts}</span></div>
    <div class="rcpt-meta"><span>नाम: <b>${esc(rc.name)}</b></span><span>पता: ${esc(rc.address||'—')}</span></div>
    <table><thead><tr><th>Particulars</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
      ${rc.items.map(x=>`<tr><td>${esc(x.item)} ${esc(x.sub==='चोकर'?'':x.sub)}</td><td>${x.qty}</td><td>${fmt(x.rate)}</td><td>${fmt(x.qty*x.rate)}</td></tr>`).join('')}
      <tr><td colspan="3" class="r-tot" style="text-align:right;">TOTAL</td><td class="r-tot">₹${fmt(total)}</td></tr>
    </tbody></table>
    <div style="text-align:center;font-size:11px;color:#888;margin-top:10px;">धन्यवाद! — ${rc.pay==='online'?'A/C Paid':'Cash Paid'}</div>
  </div>`;
  printDocument(html,{landscape:false,stretch:false});
}

/* =========================================================
   RECORD BOOK
========================================================= */
let recMode='nb', recDates=[], recIdx=-1;
function dateSortVal(d){ const p=d.split('-'); return p.length===3? p[2]+p[1]+p[0] : p[1]+p[0]; }
function listDates(prefix){
  const out=[];
  for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith(prefix)) out.push(k.slice(prefix.length)); }
  return out.sort((a,b)=>dateSortVal(b).localeCompare(dateSortVal(a)));
}
$('#rec-choose-nb').addEventListener('click',()=>{ recMode='nb'; showRecDates(); });
$('#rec-choose-sb').addEventListener('click',()=>{ recMode='sb'; showRecDates(); });
$('#rec-choose-att').addEventListener('click',()=>{ recMode='att'; showRecDates(); });
$('#rec-choose-pr')?.addEventListener('click',()=>{ recMode='pr'; showRecDates(); });
$('#rec-choose-ob')?.addEventListener('click',()=>{ recMode='ob'; showRecDates(); });
$('#rec-chg-btn')?.addEventListener('click',()=>go('changerec'));
function showRecDates(){
  const prefix = recMode==='nb'?'sg_nb_': recMode==='sb'?'sg_sb_': recMode==='pr'?'sg_arcpt_': recMode==='ob'?'sg_ord_':'sg_att_';
  if(recMode==='pr'){
    /* Atta + Wheat दोनों की तारीख़ें मिला कर */
    const set={};
    listDates('sg_arcpt_').forEach(d=>set[d]=1);
    listDates('sg_wrcpt_').forEach(d=>set[d]=1);
    recDates=Object.keys(set).sort((a,b)=>dateSortVal(b).localeCompare(dateSortVal(a)));
  } else if(recMode==='sb'){
    /* S.Book = Notebook + Atta receipt + Wheat slip + manual — किसी भी source की तारीख़ दिखे */
    const set={};
    ['sg_sb_','sg_nb_','sg_arcpt_','sg_wrcpt_'].forEach(pf=>listDates(pf).forEach(d=>set[d]=1));
    set[DATE]=1;
    recDates=Object.keys(set).sort((a,b)=>dateSortVal(b).localeCompare(dateSortVal(a)));
  } else if(recMode==='ob'){
    /* Order Book — आज की तारीख़ हमेशा दिखे (चाहे अभी कोई order न हो) + सभी पिछली तारीख़ें */
    const set={}; listDates('sg_ord_').forEach(d=>set[d]=1); set[DATE]=1;
    recDates=Object.keys(set).sort((a,b)=>dateSortVal(b).localeCompare(dateSortVal(a)));
  } else recDates=listDates(prefix);
  const titles={nb:'\ud83d\udcd4 Notebook \u2014 \u0924\u093e\u0930\u0940\u0916\u093c \u091a\u0941\u0928\u0947\u0902',sb:'\ud83d\udcda S.Book \u2014 \u0924\u093e\u0930\u0940\u0916\u093c \u091a\u0941\u0928\u0947\u0902',att:'\ud83d\uddd3\ufe0f Attendance \u2014 \u092e\u0939\u0940\u0928\u093e \u091a\u0941\u0928\u0947\u0902',pr:'\ud83d\udda8\ufe0f Print Record \u2014 \u0924\u093e\u0930\u0940\u0916\u093c \u091a\u0941\u0928\u0947\u0902',ob:'\ud83e\uddfe Order Book \u2014 \u0924\u093e\u0930\u0940\u0916\u093c \u091a\u0941\u0928\u0947\u0902'};
  $('#rec-dates-title').textContent=titles[recMode];
  // महीने के हिसाब से group — 6 महीने का data भी आसानी से मिलेगा
  const MN=['','जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितम्बर','अक्टूबर','नवम्बर','दिसम्बर'];
  let html='';
  if(recDates.length){
    if(recMode==='att'){
      html=recDates.map((d,i)=>`<div class="rec-date-card" data-ri="${i}">${d}<small>महीना देखें →</small></div>`).join('');
    }else{
      let lastMonth='';
      recDates.forEach((d,i)=>{
        const p=d.split('-'); const mkey=p[1]+'-'+p[2];
        if(mkey!==lastMonth){ lastMonth=mkey; html+=`<div class="rec-month-head">📆 ${MN[parseInt(p[1])]||p[1]} ${p[2]}</div>`; }
        html+=`<div class="rec-date-card" data-ri="${i}">${d}<small>दिन देखें →</small></div>`;
      });
    }
  }else html=`<div class="placeholder-card"><span class="big-ico">📭</span><h3>कोई record नहीं</h3><p>अभी तक कोई data save नहीं हुआ</p></div>`;
  $('#rec-dates-list').innerHTML=html;
  go('recorddates');
}
$('#rec-dates-list').addEventListener('click',e=>{
  const c=e.target.closest('.rec-date-card'); if(!c) return;
  recIdx=+c.dataset.ri; showRecordView();
});
function loadDB(prefix,d){ try{ const x=JSON.parse(localStorage.getItem(prefix+d)); if(x){migrate(x);} return x; }catch(e){ return null; } }
function showRecordView(){
  const d=recDates[recIdx]; if(!d) return;
  $('#rec-view-title').textContent=(recMode==='nb'?'\ud83d\udcd4 ':recMode==='sb'?'\ud83d\udcda ':recMode==='pr'?'\ud83d\udda8\ufe0f ':recMode==='ob'?'\ud83e\uddfe ':'\ud83d\uddd3\ufe0f ')+d;
  const wrap=$('#record-view-wrap');
  wrap.classList.remove('flip'); void wrap.offsetWidth; wrap.classList.add('flip');
  if(recMode==='pr'){
    wrap.innerHTML=printRecordHTML(d);
    go('recordview'); return;
  }
  if(recMode==='ob'){
    wrap.innerHTML=(typeof orderBookPrintHTML==='function')? orderBookPrintHTML(d,true) : '';
    go('recordview'); return;
  }
  if(recMode==='att'){
    wrap.innerHTML=`<div class="att-wrap" style="max-height:none;">${attTableHTML(d,false)}</div>`;
  }else if(recMode==='sb' && typeof sbookHTML==='function'){
    /* पुराने सब data के साथ — S.Book उसी तारीख़ का पूरा auto हिसाब */
    if(typeof sbSetDate==='function') sbSetDate(d);
    wrap.innerHTML=`<div class="notebook sbook">${sbookHTML(d,false)}</div>`;
  }else{
    const db=loadDB(recMode==='nb'?'sg_nb_':'sg_sb_',d)||blank();
    const snap=notebookHTML(db,d,true);
    wrap.innerHTML=''; wrap.appendChild(snap.firstElementChild);
    injectTotals('#record-view-wrap',computeTotals(db));
  }
  go('recordview');
}
$('#rec-prev').addEventListener('click',()=>{ if(recIdx<recDates.length-1){ recIdx++; showRecordView(); } else toast('\u0914\u0930 \u092a\u0941\u0930\u093e\u0928\u093e record \u0928\u0939\u0940\u0902'); });
$('#rec-next').addEventListener('click',()=>{ if(recIdx>0){ recIdx--; showRecordView(); } else toast('\u092f\u0939 \u0938\u092c\u0938\u0947 \u0928\u092f\u093e record \u0939\u0948'); });
$('#rec-print').addEventListener('click',()=>{
  const d=recDates[recIdx]; if(!d) return;
  if(recMode==='pr'){ printDocument(printRecordHTML(d),{landscape:false,stretch:true,grow:true}); return; }
  if(recMode==='ob'){ printDocument(orderBookPrintHTML(d,true),{landscape:false,stretch:true,grow:true}); return; }
  if(recMode==='att'){ printAttendance(d); return; }
  if(recMode==='sb' && typeof sbookHTML==='function'){
    if(typeof sbSetDate==='function') sbSetDate(d);
    printDocument(`<div class="notebook sbook sbook-print">${sbookHTML(d,false)}</div>`,{landscape:true,stretch:true,grow:true});
    return;
  }
  const db=loadDB('sg_nb_',d)||blank();
  db.totals=computeTotals(db);
  printNotebook(db,d,true);
});
/* back-date edit — password के बाद उस दिन की notebook खुलेगी; edit करने पर आज की तारीख़ + समय stamp होगा */
$('#rec-edit')?.addEventListener('click',()=>{
  const d=recDates[recIdx]; if(!d||recMode==='att') return;
  askPassword(()=>{ enterEditDate(d); go('notebook'); renderAll(); toast('⚠️ '+d+' की notebook edit हो रही है — बदलाव पर आज की तारीख़ stamp होगी'); },'🔐 पिछली तारीख़ Edit — Password');
});

/* =========================================================
   ATTENDANCE
========================================================= */
const MONTH_KEY = ()=>{ const d=new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; };
function attKey(mk){ return 'sg_att_'+mk; }
function loadAtt(mk){ try{ return JSON.parse(localStorage.getItem(attKey(mk)))||{staff:[],marks:{}}; }catch(e){ return {staff:[],marks:{}}; } }
function saveAtt(mk,a){ localStorage.setItem(attKey(mk),JSON.stringify(a)); }
function daysInMonth(mk){ const [mm,yy]=mk.split('-').map(Number); return new Date(yy,mm,0).getDate(); }
let ATT=loadAtt(MONTH_KEY());
function attStaffGlobal(){ try{ return JSON.parse(localStorage.getItem('sg_staff'))||[]; }catch(e){ return []; } }
function setStaffGlobal(s){ localStorage.setItem('sg_staff',JSON.stringify(s)); }
function adminPassword(name){
  const d=new Date(); let h=d.getHours()%12; if(h===0)h=12;
  return (name[0]||'a')+String(h)+String(String(d.getDate()).padStart(2,'0'));
}
const DOW=['Su','Mo','Tu','We','Th','Fr','Sa'];
function attTableHTML(mk,live){
  const a=live?ATT:loadAtt(mk);
  const nDays=daysInMonth(mk);
  const [mm,yy]=mk.split('-').map(Number);
  const isCurMonth = mk===MONTH_KEY(); const todayD=new Date().getDate();
  let head='<tr><th class="st-name">Staff (Sr.)</th>';
  for(let d=1;d<=nDays;d++){
    const dow=new Date(yy,mm-1,d).getDay();
    head+=`<th class="${isCurMonth&&d===todayD?'today-h':''} ${dow===0?'sun':''}">${d}<span class="dow">${DOW[dow]}</span></th>`;
  }
  head+='<th>P</th></tr>';
  const rows=a.staff.map((nm,si)=>{
    let tds=`<td class="st-name">${si+1}. ${esc(nm)}</td>`;
    let pc=0;
    for(let d=1;d<=nDays;d++){
      const m=a.marks[nm]?.[d];
      const future=isCurMonth&&d>todayD;
      const dow=new Date(yy,mm-1,d).getDay();
      let inner='';
      if(m){ if(m.v==='P')pc++;
        inner=`<span class="att-mark ${m.v==='P'?'p':'x'} ${m.late?'late':''}">${m.v==='P'?'P':'\u2715'}</span>`; }
      tds+=`<td class="att-cell ${isCurMonth&&d===todayD?'today-col':''} ${future?'future':''} ${dow===0?'sun':''}" data-s="${si}" data-d="${d}">${inner}</td>`;
    }
    tds+=`<td style="font-weight:800;color:#1e8449;">${pc}</td>`;
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table class="att-table"><thead>${head}</thead><tbody>${rows||`<tr><td class="st-name" colspan="${nDays+2}" style="text-align:center;color:#98a1b3;">Date \u092a\u0930 5 \u092c\u093e\u0930 click \u2192 Add Name</td></tr>`}</tbody></table>`;
}
function attLockKey(mk){ return 'sg_attlock_'+mk; }
function attLocks(mk){ try{ return JSON.parse(localStorage.getItem(attLockKey(mk)))||{}; }catch(e){ return {}; } }
function setAttLock(mk,d){ const l=attLocks(mk); l[d]=true; localStorage.setItem(attLockKey(mk),JSON.stringify(l)); }
function isAttLocked(mk,d){ return !!attLocks(mk)[d]; }
function renderAttendance(){
  ATT=loadAtt(MONTH_KEY());
  attStaffGlobal().forEach(n=>{ if(!ATT.staff.includes(n)) ATT.staff.push(n); });
  saveAtt(MONTH_KEY(),ATT);
  $('#att-date').textContent=DATE;
  $('#att-wrap').innerHTML=attTableHTML(MONTH_KEY(),true);
  // Final Submit \u2014 \u0938\u092c\u0915\u093e \u0906\u091c \u0915\u093e mark \u092c\u0928\u0928\u0947 \u092a\u0930 \u0939\u0940 \u0926\u093f\u0916\u0947; lock \u0915\u0947 \u092c\u093e\u0926 hide
  const d=new Date().getDate();
  const allMarked = ATT.staff.length>0 && ATT.staff.every(nm=>ATT.marks[nm]?.[d]);
  const locked = isAttLocked(MONTH_KEY(),d);
  const act=$('#att-actions');
  if(locked){ act.style.display='flex'; act.innerHTML=`<div class="att-locked-tag">\u2705 \u0906\u091c \u0915\u0940 attendance final \u0939\u094b \u0917\u0908 \ud83d\udd12</div>`; }
  else if(allMarked){ act.style.display='flex'; act.innerHTML=`<button class="att-final-btn" id="att-final-btn">\u2714 Final Submit</button>`;
    $('#att-final-btn').addEventListener('click',()=>{ setAttLock(MONTH_KEY(),new Date().getDate()); renderAttendance(); toast('Attendance final \u2714 \u0905\u092c \u092c\u0926\u0932\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f admin password \u0932\u0917\u0947\u0917\u093e'); }); }
  else{ act.style.display='none'; act.innerHTML=''; }
  requestAnimationFrame(()=>{ const t=$('#att-wrap .today-col'); if(t) t.scrollIntoView({block:'nearest',inline:'center'}); });
}
$('#att-add-name').addEventListener('click',()=>{
  popup({
    title:'\u2795 Staff Add \u0915\u0930\u0947\u0902',
    body:`<div class="f-row"><label>Staff \u0928\u093e\u092e</label><input type="text" id="st-name"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="st-save">\u2713 Add</button></div>`,
    onOpen(bk){
      bk.querySelector('#st-name').focus();
      bk.querySelector('#st-save').addEventListener('click',()=>{
        let n=bk.querySelector('#st-name').value.trim();
        if(!n){ toast('\u0928\u093e\u092e \u092d\u0930\u0947\u0902'); return; }
        if(!/\(mill staff\)/i.test(n)) n = n + ' (mill staff)';   /* Tally \u0915\u0947 Staff(Cr) \u092e\u0947\u0902 \u0906\u0938\u093e\u0928\u0940 \u0938\u0947 \u092a\u0939\u091a\u093e\u0928 */
        const g=attStaffGlobal(); if(!g.includes(n)) g.push(n); setStaffGlobal(g);
        if(!ATT.staff.includes(n)) ATT.staff.push(n);
        saveAtt(MONTH_KEY(),ATT); closePopup(); renderAttendance(); toast(n+' add \u0939\u0941\u0906 \u2714');
      });
    }
  });
});
/* पिछली तारीख़ / lock हुई तारीख़ → 3 बार click करने पर ही admin password खुलेगा
   (एक-दो बार ग़लती से touch होने पर password on नहीं होगा) */
let attTapCnt={}, attTapTm=null;
function attNeed3(key,onThird){
  attTapCnt[key]=(attTapCnt[key]||0)+1;
  clearTimeout(attTapTm);
  const n=attTapCnt[key];
  if(n>=3){ attTapCnt={}; onThird(); return; }
  toast(`🔒 पिछली तारीख़ — और ${3-n} बार click करें`);
  attTapTm=setTimeout(()=>{ attTapCnt={}; },1600);
}
$('#att-wrap').addEventListener('click',e=>{
  const cell=e.target.closest('.att-cell'); if(!cell||cell.classList.contains('future')) return;
  const si=+cell.dataset.s, d=+cell.dataset.d, nm=ATT.staff[si];
  const today=new Date().getDate();
  if(d===today && !isAttLocked(MONTH_KEY(),d)){ openMarkChoice(nm,d,false); }
  else if(d===today){ attNeed3('t'+si+'_'+d,()=>askAttAdmin(nm,()=>openMarkChoice(nm,d,false))); }
  else{ attNeed3(si+'_'+d,()=>askAttAdmin(nm,()=>openMarkChoice(nm,d,true))); }
});
function openMarkChoice(nm,d,late){
  popup({
    title:`${nm} \u2014 ${d} \u0924\u093e\u0930\u0940\u0916\u093c`,
    body:`<div class="print-choice">
        <button id="mk-p" style="border-color:#2ecc71;"><span class="pc-ico">\u2705</span>P<br><small style="color:#8a94a6">Present</small></button>
        <button id="mk-x" style="border-color:#ff7675;"><span class="pc-ico">\u274c</span>X<br><small style="color:#8a94a6">Absent</small></button>
        <button id="mk-clear"><span class="pc-ico">\ud83e\uddf9</span>Clear<br><small style="color:#8a94a6">\u0939\u091f\u093e\u090f\u0901</small></button>
      </div>${late?'<div class="pp-note" style="margin-top:10px;background:#ffe3e3;color:#c0392b;">\u26a0\ufe0f \u092a\u093f\u091b\u0932\u0940 \u0924\u093e\u0930\u0940\u0916\u093c \u2014 \u092f\u0939 mark \u0932\u093e\u0932 \u0918\u0947\u0930\u0947 \u092e\u0947\u0902 \u0926\u093f\u0916\u0947\u0917\u093e</div>':''}`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      const set=v=>{ ATT.marks[nm]=ATT.marks[nm]||{};
        if(v===null) delete ATT.marks[nm][d]; else ATT.marks[nm][d]={v,late};
        saveAtt(MONTH_KEY(),ATT); closePopup(); renderAttendance(); };
      bk.querySelector('#mk-p').addEventListener('click',()=>set('P'));
      bk.querySelector('#mk-x').addEventListener('click',()=>set('X'));
      bk.querySelector('#mk-clear').addEventListener('click',()=>set(null));
    }
  });
}
function askAttAdmin(nm,onOk){
  popup({
    title:'\ud83d\udd10 Admin Password',
    body:`<div class="f-row"><label>Password</label><input type="password" id="ad-pass"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ad-go">Unlock \ud83d\udd13</button></div>`,
    onOpen(bk){
      bk.querySelector('#ad-pass').focus();
      const go2=()=>{ const v=bk.querySelector('#ad-pass').value;
        if(v===adminPassword(nm.toLowerCase())||v===adminPassword(nm.toUpperCase())){ closePopup(); onOk(); } else toast('\u0917\u0932\u0924 Password \u274c'); };
      bk.querySelector('#ad-go').addEventListener('click',go2);
      bk.querySelector('#ad-pass').addEventListener('keydown',e=>{ if(e.key==='Enter')go2(); });
    }
  });
}
/* date पर 5 बार click → Add Name button toggle */
(function(){ let c=0,t=null;
  $('#att-date').addEventListener('click',()=>{ c++; clearTimeout(t);
    t=setTimeout(()=>{
      if(c>=5){ const b=$('#att-add-name'); const hidden=b.style.display==='none'; b.style.display=hidden?'':'none'; toast(hidden?'Add Name दिख रहा ✔':'Add Name छुप गया'); }
      c=0; },500); });
})();
function printAttendance(mk){
  printDocument(`<div class="att-title">SATYAM GOLD \u2014 Attendance (${mk})</div>${attTableHTML(mk,false)}`,{landscape:true,stretch:false});
}

/* hook attendance render into navigation */
const _goOrig=go;
go=function(name){ _goOrig(name); if(name==='attendance') renderAttendance(); };

/* =========================================================
   PRINT HOME — 🧾 Receipt Details  |  🌾 Wheat Details
   (सिर्फ़ आज की entries; 👁 पर पूरा receipt/slip preview)
========================================================= */
const ARC_KEY = d => 'sg_arcpt_' + d;      // Atta receipts (atta-receipt.html से)
const WRC_KEY = d => 'sg_wrcpt_' + d;      // Wheat slips  (wheat-slip.html से)
function loadArr(k){ try{ return JSON.parse(localStorage.getItem(k))||[]; }catch(e){ return []; } }
function phEmpty(ico,txt){ return `<div class="ph-empty"><span class="big">${ico}</span>${txt}</div>`; }
function n2(v){ const n=parseFloat(v); return isNaN(n)? '0.00' : n.toFixed(2); }

function renderPrintHome(){
  const d=DATE;
  $('#ph-date').textContent=d;
  const rc=loadArr(ARC_KEY(d)), wh=loadArr(WRC_KEY(d));
  $('#ph-rc-cnt').textContent=rc.length;
  $('#ph-wh-cnt').textContent=wh.length;

  /* ---- Receipt Details : Sr. No | नाम (पता) | Particulars + Qty | 👁 ---- */
  $('#ph-rcpt-list').innerHTML = rc.length ? rc.map((r,i)=>{
    const nm=r.nameHi||r.name||'—', ad=r.addressHi||r.address||'';
    const chips=(r.items||[]).map(it=>`<span class="ph-chip">${esc(it.name||'Item')} — ${esc(String(it.qty||'0'))}</span>`).join('');
    const box = r.cancelled
      ? `<div class="vbox cancel" title="Cancel हुआ">✖</div>`
      : (r.verified
        ? `<div class="vbox done" data-vdone="${i}" data-vby="${esc(r.vBy||'')}" data-vts="${esc(r.vts||'')}" title="3 बार click करें — किसने लिया दिखेगा">✔<span class="vts">${esc(r.vts||'')}</span></div>`
        : `<div class="vbox" data-vbox="${i}" title="Verify करने के लिए click करें">☐</div>`);
    const cls = (r.cancelled?' ph-cut':'') + (r.rateEdited?' ph-red':'');
    return `<div class="ph-row${cls}">
      ${box}
      <span class="ph-sr">${esc(String(r.no||(i+1)))}</span>
      <div class="ph-info">
        <div class="ph-name">${esc(nm)}${ad?` <small>(${esc(ad)})</small>`:''}${r.fromNo?` <span class="ph-tag">↩ #${esc(String(r.fromNo))} से</span>`:''}${r.millReturn?` <span class="ph-tag">🏭 Mill Return ${esc(String(r.millReturn))}</span>`:''}</div>
        <div class="ph-part">${chips||'<i style="color:#b6bcc9">कोई item नहीं</i>'}</div>
      </div>
      <button class="ph-eye" data-view="rc" data-i="${i}" title="पूरा Receipt देखें">👁</button>
    </div>`;
  }).join('') : phEmpty('🧾','आज कोई Atta Receipt नहीं बना<br><small>ऊपर 🖨️ Print → Atta Print</small>');
  updateVerifyBanner(rc);

  /* ---- Wheat Details : Sr. No | नाम (पता) | Total बोरा + Rate | 👁 ---- */
  $('#ph-wheat-list').innerHTML = wh.length ? wh.map((r,i)=>{
    const nm=r.nameHi||r.name||'—', ad=r.addressHi||r.address||'';
    return `<div class="ph-row">
      <span class="ph-sr" style="background:linear-gradient(135deg,#f39c12,#d35400);">${esc(String(r.serial||r.no||(i+1)))}</span>
      <div class="ph-info">
        <div class="ph-name">${esc(nm)}${ad?` <small>(${esc(ad)})</small>`:''}</div>
        <div class="ph-part">
          <span class="ph-chip gold">Total बोरा — ${esc(String(r.bags||'0'))}</span>
          <span class="ph-chip gold">RATE — ${esc(n2(r.rate))}</span>
          <span class="ph-chip">${r.mode==='fill'?'📦 FILL':'⚖️ RST'}</span>
        </div>
      </div>
      <button class="ph-eye" data-view="wh" data-i="${i}" title="पूरा Slip देखें">👁</button>
    </div>`;
  }).join('') : phEmpty('🌾','आज कोई Wheat Slip नहीं बना<br><small>ऊपर 🖨️ Print → Wheat Print</small>');
}

/* ---------- preview (PDF जैसा) ---------- */
function phHead(){
  return `<h1>SATYAM FOOD PRODUCT</h1>
    <div class="pv-sub">Vidyardhar, Khagaria<br>
    <b>GSTIN:</b> 10DWFPD7233GIZI &nbsp;|&nbsp; <b>FSSAI No:</b> 10421168000028 &nbsp;|&nbsp; <b>Mobile:</b> 9631816666</div>`;
}
function attaPreviewHTML(r){
  const rows=(r.items||[]).map((it,i)=>`<tr><td style="text-align:center;">${i+1}</td>
    <td><b>${esc(it.name||'-')}</b></td><td class="pv-right">${esc(String(it.qty||'-'))}</td>
    <td class="pv-right">${esc(String(it.rate||'-'))}</td><td class="pv-right"><b>${esc(it.amount||'0.00')}</b></td></tr>`).join('');
  return `<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span class="pv-tag">${esc(r.status||'DUE')}</span><span class="pv-tag">ORIGINAL COPY</span></div>
    ${phHead()}
    <table class="pv-info"><tr><td style="width:14%"><b>SI No:</b></td><td style="width:36%">${esc(String(r.no||''))}</td>
      <td style="width:14%"><b>Date:</b></td><td>${esc(r.dateStr||r.date||'')}</td></tr>
      <tr><td><b>Name:</b></td><td>${esc(r.name||r.nameHi||'-')}</td><td><b>Address:</b></td><td>${esc(r.address||r.addressHi||'-')}</td></tr>
      <tr><td><b>Driver:</b></td><td>${esc(r.driver||'-')}</td><td><b>Vehicle No:</b></td><td>${esc(r.vehicle||'-')}</td></tr></table>
    <table><thead><tr><th style="width:6%">#</th><th style="width:50%">Particulars</th>
      <th style="width:14%">Qty</th><th style="width:14%">Rate</th><th style="width:16%">Amount</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" style="text-align:center;">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="4" class="pv-right"><b>Total Amount (₹):</b></td><td class="pv-right"><b>${esc(r.total||'0.00')}</b></td></tr></tfoot></table>
    <div style="text-align:center;font-size:12px;font-weight:700;margin-top:14px;">Bank Details: A/c No: 60440573620, IFSC: MAHB0002230</div>
    <div class="pv-sign"><div>Receiver</div><div>Authorised Signatory</div></div>`;
}
function wheatPreviewHTML(r){
  const isFill = r.mode==='fill';
  const wtCols = isFill
    ? `<th style="width:36%">Weight Breakdown (Kg)</th><th style="width:14%">Total Wt (Kg)</th>`
    : `<th style="width:14%">Gross (Kg)</th><th style="width:14%">Tare (Kg)</th><th style="width:14%">Net (Kg)</th>`;
  const wtVals = isFill
    ? `<td style="font-size:11px;">${esc((r.weights||[]).map(w=>w+'kg').join(', ')||'-')}</td>
       <td style="text-align:center;"><b>${n2(r.totalWt)}</b></td>`
    : `<td style="text-align:center;"><b>${esc(String(r.gross||'-'))}</b></td>
       <td style="text-align:center;">${esc(String(r.tare||'-'))}</td>
       <td style="text-align:center;"><b>${esc(String(r.net||n2(r.totalWt)))}</b></td>`;
  const ded=[
    ['Gross Amount (Wt × Rate):', n2(r.grossAmt), true],
    [`Less: Weight Cut (${(r.cutKg100===undefined||r.cutKg100===null||r.cutKg100===0.5)?'1/2':r.cutKg100}kg/Qtl) [ ${n2(r.wtCutKg)} Kg ]:`, '- '+n2(r.wtCutRs), (r.wtCutRs||0)>0],
    [`Less: Unloading Charge (₹${r.unloadPerBag??4}/Bag):`, '- '+n2(r.unloadRs), (r.unloadRs||0)>0],
    ['Less: D/P/W Bag Damage Cut:', '- '+n2(r.bagCut), (r.bagCut||0)>0]
  ].filter(x=>x[2]).map(x=>`<tr><td>${esc(x[0])}</td><td class="pv-right"><b>${esc(x[1])}</b></td></tr>`).join('');
  return `<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><span class="pv-tag">ORIGINAL COPY</span></div>
    ${phHead()}
    <div class="pv-ttl">WHEAT PROCUREMENT SLIP (${isFill?'FILL':'RST'})</div>
    <table class="pv-info"><tr><td style="width:16%"><b>SI No / RST:</b></td><td style="width:34%">${esc(String(r.no||r.serial||''))} / ${esc(r.rst||(isFill?'FILL':'-'))}</td>
      <td style="width:14%"><b>Date:</b></td><td>${esc(r.dateStr||r.date||'')}</td></tr>
      <tr><td><b>Farmer Name:</b></td><td>${esc(r.nameHi||r.name||'-')}</td><td><b>Address:</b></td><td>${esc(r.addressHi||r.address||'-')}</td></tr>
      <tr><td><b>Vehicle No:</b></td><td>${esc(r.vehicle||'-')}</td><td><b>Driver Name:</b></td><td>${esc(r.driver||'-')}</td></tr></table>
    <table><thead><tr><th style="width:16%">Item</th><th style="width:20%">Bags Detail</th>${wtCols}<th style="width:14%">Rate (₹/Kg)</th></tr></thead>
      <tbody><tr><td style="text-align:center;"><b>Wheat (गेहूँ)</b></td>
        <td style="text-align:center;"><div style="border:1.5px solid #000;border-radius:50px;padding:2px 12px;display:inline-block;font-size:11px;font-weight:800;">
          <div style="font-size:8.5px;letter-spacing:2px;border-bottom:1px solid #000;">D P W</div>
          ${esc(String(r.bags||'0'))} = ${esc(String(r.d||'0'))}/${esc(String(r.p||'0'))}/${esc(String(r.w||'0'))}</div></td>
        ${wtVals}<td style="text-align:center;">${n2(r.rate)}</td></tr></tbody></table>
    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
      <table style="width:62%;"><tbody>${ded}
        <tr><td><b>FINAL PAYABLE AMOUNT (₹):</b></td><td class="pv-right" style="background:#f2f2f2;"><b>${n2(r.finalPay)}</b></td></tr>
      </tbody></table></div>
    <div class="pv-sign"><div>Farmer / Driver</div><div>Manager Auth.</div><div>Authorised Signatory</div></div>`;
}
function openPhViewer(title,html){
  $('#pv-title').textContent=title;
  $('#pv-paper').innerHTML=html;
  $('#ph-viewer').classList.add('on');
  window.scrollTo(0,0);
}
function closePhViewer(){ $('#ph-viewer').classList.remove('on'); }
$('#pv-close').addEventListener('click',closePhViewer);
$('#ph-viewer').addEventListener('click',e=>{ if(e.target.id==='ph-viewer') closePhViewer(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePhViewer(); });

document.addEventListener('click',e=>{
  const b=e.target.closest('.ph-eye'); if(!b) return;
  const i=+b.dataset.i;
  if(b.dataset.view==='rc'){
    const r=loadArr(ARC_KEY(DATE))[i]; if(!r) return;
    openPhViewer('🧾 Atta Receipt — No. '+(r.no||''), attaPreviewHTML(r));
  }else{
    const r=loadArr(WRC_KEY(DATE))[i]; if(!r) return;
    openPhViewer('🌾 Wheat Slip — Serial '+(r.serial||r.no||''), wheatPreviewHTML(r));
  }
});

/* 🖨️ Print → Atta Print / Wheat Print */
$('#ph-print-btn').addEventListener('click',()=>{
  popup({
    title:'🖨️ Print — कौन सा?',
    body:`<div class="print-choice">
        <button id="pc-atta"><span class="pc-ico">🧾</span>Atta Print<br><small style="color:#8a94a6">आटा / सत्तू / बेसन Receipt</small></button>
        <button id="pc-wheat"><span class="pc-ico">🌾</span>Wheat Print<br><small style="color:#8a94a6">गेहूँ Slip — Serial से auto fill</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelector('#pc-atta').addEventListener('click',()=>{ location.href='atta-receipt.html'; });
      bk.querySelector('#pc-wheat').addEventListener('click',()=>{ location.href='wheat-slip.html'; });
    }
  });
});

/* =========================================================
   ✅ ATTA RECEIPT — DOUBLE VERIFICATION SYSTEM (सिर्फ़ आटा में)
   box → serial no confirm → Verify / Edit / Cancel
========================================================= */
function saveArc(list){ try{ localStorage.setItem(ARC_KEY(DATE),JSON.stringify(list)); }catch(e){} }
function arcList(){ return loadArr(ARC_KEY(DATE)); }
function itemQty(it){ return parseFloat(it.qty)||0; }
function recTotalQty(r){ return (r.items||[]).reduce((a,x)=>a+itemQty(x),0); }
function recalcRec(r){
  let t=0;
  (r.items||[]).forEach(it=>{ const a=(parseFloat(it.qty)||0)*(parseFloat(it.rate)||0); it.amount=a.toFixed(2); t+=a; });
  r.total=t.toFixed(2);
}
function pendingVerify(list){ return (list||arcList()).filter(r=>!r.verified && !r.cancelled); }

/* box click → serial confirm */
document.addEventListener('click',e=>{
  const b=e.target.closest('.vbox[data-vbox]'); if(!b) return;
  const i=+b.dataset.vbox; askSerialThenOptions(i);
});
/* ✔ verified box → 3 बार click → \"Verify किसने लिया\" नाम दिखे; screen पर कहीं touch → हट जाए */
(function(){
  let vTapN=0, vTapT=0, vTapEl=null;
  function hideWhoTip(){
    const t=document.getElementById('vwho-tip');
    if(t){ t.classList.remove('on'); setTimeout(()=>t.remove(),180); }
    vTapN=0; vTapEl=null;
  }
  function showWhoTip(box){
    hideWhoTip();
    const tip=document.createElement('div');
    tip.id='vwho-tip'; tip.className='vwho-tip';
    tip.innerHTML=`<b>Verify किसने लिया</b><span>${esc(box.dataset.vby||'—')}</span><small>🕒 ${esc(box.dataset.vts||'')}</small>`;
    document.body.appendChild(tip);
    const rc=box.getBoundingClientRect();
    tip.style.top = (rc.bottom + window.scrollY + 8) + 'px';
    tip.style.left = Math.max(8, Math.min(rc.left + window.scrollX, window.innerWidth-190)) + 'px';
    requestAnimationFrame(()=>tip.classList.add('on'));
  }
  document.addEventListener('click',e=>{
    const box=e.target.closest('.vbox.done[data-vdone]');
    if(!box){ if(!e.target.closest('#vwho-tip')) hideWhoTip(); return; }
    const now=Date.now();
    if(vTapEl!==box || now-vTapT>800){ vTapN=0; vTapEl=box; }
    vTapT=now; vTapN++;
    if(vTapN>=3){ vTapN=0; showWhoTip(box); }
  },true);
  document.addEventListener('touchstart',e=>{ if(!e.target.closest('.vbox.done[data-vdone]') && !e.target.closest('#vwho-tip')) hideWhoTip(); },{passive:true});
  window.addEventListener('scroll',hideWhoTip,{passive:true});
})();

function askSerialThenOptions(i){
  const list=arcList(), r=list[i]; if(!r) return;
  popup({
    title:'🔐 Receipt Verify — Serial No डालें',
    body:`<div class="pp-note">इस line का Receipt Serial No भरें — तभी options खुलेंगे<br>
        <small>नाम: <b>${esc(r.nameHi||r.name||'-')}</b> · तारीख़: <b>${esc(r.dateStr||r.date||'')}</b></small></div>
      <div class="f-row"><label>Enter Receipt Serial No</label><input type="number" id="vs-no" inputmode="numeric" placeholder="Receipt का Serial No" autocomplete="off"></div>
      <div id="vs-err" style="display:none;color:#c0392b;font-weight:800;font-size:13px;margin-top:4px;"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="vs-go">आगे बढ़ें →</button></div>`,
    onOpen(bk){
      const inp=bk.querySelector('#vs-no'); inp.focus();
      const err=m=>{ const d=bk.querySelector('#vs-err'); d.style.display='block'; d.textContent=m; };
      const go=()=>{
        const v=parseInt(inp.value);
        if(!v){ err('❌ Serial No भरें'); return; }
        if(v!==parseInt(r.no)){ err('❌ गलत Serial No — दोबारा receipt देख कर भरें'); return; }
        if((r.date||'')!==DATE){ err('❌ यह receipt आज की तारीख़ का नहीं है — verify नहीं होगा'); return; }
        closePopup(); openVerifyOptions(i);
      };
      bk.querySelector('#vs-go').addEventListener('click',go);
      inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter') go(); });
    }
  });
}
function openVerifyOptions(i){
  const r=arcList()[i]; if(!r) return;
  popup({
    title:'✅ Receipt #'+esc(String(r.no))+' — क्या करना है?',
    body:`<div class="print-choice">
        <button id="vo-verify"><span class="pc-ico">✅</span>Verify<br><small style="color:#8a94a6">किसने लिया — चुनें</small></button>
        <button id="vo-edit"><span class="pc-ico">✏️</span>Edit<br><small style="color:#8a94a6">सिर्फ़ Rate बदलेगा</small></button>
        <button id="vo-cancel"><span class="pc-ico">❌</span>Cancel<br><small style="color:#8a94a6">दूसरे नाम / Mill Return</small></button>
      </div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">बंद करें</button>`,
    onOpen(bk){
      bk.querySelector('#vo-verify').addEventListener('click',()=>{ closePopup(); openVerifyWho(i); });
      bk.querySelector('#vo-edit').addEventListener('click',()=>{ closePopup(); openRcptEdit(i); });
      bk.querySelector('#vo-cancel').addEventListener('click',()=>{ closePopup(); openRcptCancel(i); });
    }
  });
}
const V_WHO=[{k:'our_driver',n:'1. हमारा Driver'},{k:'dukaandaar',n:'2. दुकानदार'},{k:'our_erik',n:'3. हमारा E-Rikshaw'},{k:'vishnu',n:'4. विष्णु'}];
function openVerifyWho(i){
  popup({
    title:'✅ किसको signature करा कर दिया?',
    body:`<div class="chip-grid">${V_WHO.map(w=>`<div class="chip" data-who="${w.k}" data-n="${w.n}">${w.n}</div>`).join('')}</div>
      <div class="pp-note">कोई एक चुनें → box time stamp के साथ बंद (lock) हो जाएगा 🔒</div>`,
    foot:`<span></span><button class="pp-btn cancel" onclick="closePopup()">Cancel</button>`,
    onOpen(bk){
      bk.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>{
        const list=arcList(), r=list[i]; if(!r) return;
        r.verified=true; r.vBy=c.dataset.n; r.vts=nowTS(); r.vdate=DATE;
        saveArc(list); closePopup(); renderPrintHome(); toast('✔ Verify हो गया — '+c.dataset.n+' ('+r.vts+')');
      }));
    }
  });
}
/* Edit — सिर्फ़ Rate; बाक़ी सब lock */
function openRcptEdit(i){
  const list=arcList(), r=list[i]; if(!r) return;
  const rows=(r.items||[]).map((it,k)=>`<tr>
      <td style="text-align:center;">${k+1}</td>
      <td><b>${esc(it.name||'-')}</b></td>
      <td class="pv-right">${esc(String(it.qty||'0'))}</td>
      <td class="pv-right"><input type="number" step="any" class="ed-rate" data-k="${k}" value="${esc(String(it.rate||''))}" style="width:80px;padding:4px;font-weight:800;text-align:right;border:1.5px solid #f39c12;border-radius:6px;"></td>
      <td class="pv-right ed-amt" data-k="${k}"><b>${esc(it.amount||'0.00')}</b></td></tr>`).join('');
  popup({
    title:'✏️ Receipt #'+esc(String(r.no))+' — सिर्फ़ Rate बदलें',
    body:`<div class="pv-paper" style="background:#fff;color:#000;padding:10px;border-radius:8px;">
        <div style="text-align:center;font-weight:900;font-size:16px;">SATYAM FOOD PRODUCT</div>
        <table class="pv-info"><tr><td><b>SI No:</b></td><td>${esc(String(r.no||''))}</td><td><b>Date:</b></td><td>${esc(r.dateStr||r.date||'')}</td></tr>
          <tr><td><b>Name:</b></td><td>${esc(r.name||r.nameHi||'-')}</td><td><b>Address:</b></td><td>${esc(r.address||r.addressHi||'-')}</td></tr></table>
        <table><thead><tr><th>#</th><th>Particulars</th><th>Qty</th><th>Rate ✏️</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4" class="pv-right"><b>Total (₹):</b></td><td class="pv-right"><b id="ed-total">${esc(r.total||'0.00')}</b></td></tr></tfoot></table>
      </div>
      <div class="pp-note">नाम / पता / Particulars / Qty नहीं बदलेगा — सिर्फ़ Rate</div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">Cancel</button><button class="pp-btn save" id="ed-save">✓ Save Rate</button></div>`,
    onOpen(bk){
      const calc=()=>{
        let t=0;
        bk.querySelectorAll('.ed-rate').forEach(ip=>{
          const k=+ip.dataset.k, q=parseFloat(r.items[k].qty)||0, rt=parseFloat(ip.value)||0;
          const a=q*rt; t+=a;
          bk.querySelector(`.ed-amt[data-k="${k}"]`).innerHTML='<b>'+a.toFixed(2)+'</b>';
        });
        bk.querySelector('#ed-total').textContent=t.toFixed(2);
      };
      bk.querySelectorAll('.ed-rate').forEach(ip=>ip.addEventListener('input',calc));
      bk.querySelector('#ed-save').addEventListener('click',()=>{
        bk.querySelectorAll('.ed-rate').forEach(ip=>{ r.items[+ip.dataset.k].rate=ip.value; });
        recalcRec(r);
        r.rateEdited=true; r.ets=nowTS();
        saveArc(list); closePopup(); renderPrintHome(); toast('✏️ Rate update हो गया — हर जगह लागू ✔');
      });
    }
  });
}
/* Cancel — दूसरे नाम पर / Mill Return; पूरा qty खत्म होना ज़रूरी */
function openRcptCancel(i){
  const list=arcList(), r=list[i]; if(!r) return;
  const items=r.items||[];
  const head=items.map(it=>`<th style="font-size:10px;">${esc(it.name||'Item')}<br><small>(${itemQty(it)})</small></th>`).join('');
  let n=0;
  const newRow=()=>{ n++; return `<tr data-cr="${n}">
      <td><input type="text" class="cc-name" placeholder="नया नाम" style="width:100%;padding:4px;"></td>
      <td><input type="text" class="cc-addr" placeholder="पता" style="width:100%;padding:4px;"></td>
      ${items.map((it,k)=>`<td><input type="number" step="any" class="cc-q" data-k="${k}" placeholder="0" style="width:64px;padding:4px;text-align:right;"></td>`).join('')}
      <td><button type="button" class="btn-x" style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:3px 8px;font-weight:800;">✕</button></td></tr>`; };
  popup({
    title:'❌ Receipt #'+esc(String(r.no))+' Cancel — किसके नाम गया?',
    body:`<div class="pv-paper" style="background:#fff;color:#000;padding:10px;border-radius:8px;">
        <div style="text-align:center;font-weight:900;">SATYAM FOOD PRODUCT — Receipt #${esc(String(r.no))}</div>
        <table class="pv-info"><tr><td><b>Name:</b></td><td>${esc(r.name||r.nameHi||'-')}</td><td><b>Address:</b></td><td>${esc(r.address||r.addressHi||'-')}</td></tr></table>
        <table><thead><tr><th>#</th><th>Particulars</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
          ${items.map((it,k)=>`<tr><td style="text-align:center;">${k+1}</td><td><b>${esc(it.name||'-')}</b></td>
            <td class="pv-right">${esc(String(it.qty||'0'))}</td><td class="pv-right">${esc(String(it.rate||'0'))}</td>
            <td class="pv-right"><b>${esc(it.amount||'0.00')}</b></td></tr>`).join('')}
        </tbody></table>
      </div>
      <div class="pp-note">नये नाम + Quantity भरें (एक से ज़्यादा दुकानदार भी). जो माल <b>मिल में वापस</b> आया वह Mill Return में भरें.<br>
        <b>पूरा Quantity खत्म होना ज़रूरी है</b> — नहीं तो Save नहीं होगा.</div>
      <div style="overflow:auto;">
        <table style="width:100%;font-size:12px;" id="cc-table">
          <thead><tr><th>नया नाम</th><th>पता</th>${head}<th></th></tr></thead>
          <tbody id="cc-body">${newRow()}</tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin:8px 0;"><button type="button" class="pp-btn" id="cc-add" style="background:#3498db;color:#fff;">➕ और दुकानदार</button></div>
      <div style="overflow:auto;"><table style="width:100%;font-size:12px;"><thead><tr><th>🏭 Mill Return (वापस मिल में)</th>${head}</tr></thead>
        <tbody><tr><td><b>मिल में जोड़ें</b></td>${items.map((it,k)=>`<td><input type="number" step="any" class="cc-mill" data-k="${k}" placeholder="0" style="width:64px;padding:4px;text-align:right;"></td>`).join('')}</tr></tbody></table></div>
      <div id="cc-bal" style="font-weight:800;font-size:13px;margin-top:8px;"></div>`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">बंद करें</button><button class="pp-btn save" id="cc-save">✓ Cancel & Save</button></div>`,
    onOpen(bk){
      const body=bk.querySelector('#cc-body');
      const bal=()=>{
        const left=items.map((it,k)=>{
          let used=0;
          bk.querySelectorAll(`.cc-q[data-k="${k}"]`).forEach(x=>used+=parseFloat(x.value)||0);
          const m=bk.querySelector(`.cc-mill[data-k="${k}"]`); used+=parseFloat(m&&m.value)||0;
          return {n:it.name||'Item', l:itemQty(it)-used};
        });
        bk.querySelector('#cc-bal').innerHTML = left.map(x=>
          `<span style="display:inline-block;margin-right:10px;color:${x.l===0?'#16a34a':'#c0392b'}">${esc(x.n)} बचा: ${x.l}</span>`).join('');
        return left;
      };
      const wire=()=>{
        bk.querySelectorAll('.cc-q,.cc-mill').forEach(x=>{ x.oninput=bal; });
        bk.querySelectorAll('#cc-body .btn-x').forEach(b=>{ b.onclick=()=>{ if(body.children.length>1){ b.closest('tr').remove(); wire(); bal(); } }; });
      };
      wire(); bal();
      bk.querySelector('#cc-add').addEventListener('click',()=>{ body.insertAdjacentHTML('beforeend',newRow()); wire(); bal(); });
      bk.querySelector('#cc-save').addEventListener('click',()=>{
        const left=bal();
        if(left.some(x=>Math.abs(x.l)>0.0001)){ toast('❌ पूरा Quantity खत्म नहीं हुआ'); return; }
        const fresh=[];
        Array.from(body.children).forEach(tr=>{
          const nm=tr.querySelector('.cc-name').value.trim();
          const ad=tr.querySelector('.cc-addr').value.trim();
          const its=[];
          tr.querySelectorAll('.cc-q').forEach(q=>{
            const k=+q.dataset.k, v=parseFloat(q.value)||0;
            if(v>0) its.push({name:items[k].name,qty:String(v),rate:items[k].rate,amount:(v*(parseFloat(items[k].rate)||0)).toFixed(2)});
          });
          if(!its.length) return;
          if(!nm){ toast('नाम भरें'); throw new Error('name'); }
          const nr={no:r.no,date:DATE,dateStr:r.dateStr||DATE,name:nm,nameHi:nm,address:ad,addressHi:ad,
            driver:r.driver||'',vehicle:r.vehicle||'',status:r.status||'DUE',items:its,total:'0.00',
            ts:nowTS(),fromNo:r.no,verified:false};
          recalcRec(nr); fresh.push(nr);
        });
        let mill=0; bk.querySelectorAll('.cc-mill').forEach(m=>mill+=parseFloat(m.value)||0);
        r.cancelled=true; r.cts=nowTS(); r.verified=false;
        if(mill>0) r.millReturn=mill;
        const out=arcList();
        out[i]=r;
        fresh.forEach(f=>out.push(f));
        saveArc(out); closePopup(); renderPrintHome();
        toast('❌ Receipt #'+r.no+' cancel — '+fresh.length+' नया receipt बना'+(mill>0?' · Mill Return '+mill:''));
      });
    }
  });
}

/* ---------- 📖 Record Book → Print Record (Atta receipts + Wheat slips उस दिन के) ---------- */
function printRecordHTML(d){
  const rc=loadArr(ARC_KEY(d)), wh=loadArr(WRC_KEY(d));
  const rcRows=rc.length? rc.map((r,i)=>{
    const items=(r.items||[]).map(it=>`${esc(it.name||'-')} ${esc(String(it.qty||0))}×${esc(String(it.rate||0))}`).join(', ');
    const st=r.cancelled?'❌ CANCEL':(r.verified?('✔ '+esc(r.vBy||'')+' '+esc(r.vts||'')):'☐ Pending');
    return `<tr style="${r.cancelled?'text-decoration:line-through;color:#c0392b;':(r.rateEdited?'color:#c0392b;':'')}">
      <td style="text-align:center;">${esc(String(r.no||(i+1)))}</td>
      <td><b>${esc(r.nameHi||r.name||'-')}</b><small> ${esc(r.addressHi||r.address||'')}</small></td>
      <td style="font-size:10.5px;">${items||'-'}</td>
      <td style="text-align:right;"><b>${esc(r.total||'0.00')}</b></td>
      <td style="font-size:10px;">${st}</td></tr>`;
  }).join('') : '<tr><td colspan="5" style="text-align:center;">— कोई Atta Receipt नहीं —</td></tr>';
  const whRows=wh.length? wh.map((r,i)=>`<tr>
      <td style="text-align:center;">${esc(String(r.serial||r.no||(i+1)))}</td>
      <td><b>${esc(r.nameHi||r.name||'-')}</b><small> ${esc(r.addressHi||r.address||'')}</small></td>
      <td style="text-align:center;">${esc(String(r.bags||0))}</td>
      <td style="text-align:center;">${n2(r.totalWt||r.net)}</td>
      <td style="text-align:center;">${n2(r.rate)}</td>
      <td style="text-align:right;"><b>${n2(r.finalPay)}</b></td>
      <td style="text-align:center;font-size:10px;">${r.mode==='fill'?'FILL':'RST'}</td></tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;">— कोई Wheat Slip नहीं —</td></tr>';
  const rcT=rc.filter(r=>!r.cancelled).reduce((a,r)=>a+(parseFloat(r.total)||0),0);
  const whT=wh.reduce((a,r)=>a+(parseFloat(r.finalPay)||0),0);
  return `<div class="rec-print-doc" style="background:#fff;color:#000;padding:10px 12px;font-family:'Poppins','Noto Sans Devanagari',sans-serif;">
    <div style="text-align:center;font-weight:900;font-size:19px;">SATYAM FOOD PRODUCT</div>
    <div style="text-align:center;font-size:11.5px;font-weight:700;margin-bottom:8px;">Print Record — ${esc(d)}</div>
    <div style="font-weight:900;font-size:13.5px;background:#243447;color:#fff;padding:4px 8px;border-radius:4px;">🧾 ATTA RECEIPTS (${rc.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:10px;" border="1">
      <thead style="background:#eef2f7;"><tr><th style="width:7%">Sr</th><th style="width:27%">नाम / पता</th><th style="width:36%">Particulars (Qty × Rate)</th><th style="width:14%">Total ₹</th><th style="width:16%">Verify</th></tr></thead>
      <tbody>${rcRows}</tbody>
      <tfoot><tr><td colspan="3" style="text-align:right;"><b>Atta Total (₹)</b></td><td style="text-align:right;"><b>${fmt(rcT)}</b></td><td></td></tr></tfoot></table>
    <div style="font-weight:900;font-size:13.5px;background:#7a4b00;color:#fff;padding:4px 8px;border-radius:4px;">🌾 WHEAT SLIPS (${wh.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;" border="1">
      <thead style="background:#fff5dd;"><tr><th style="width:7%">Sr</th><th style="width:30%">नाम / पता</th><th style="width:10%">बोरा</th><th style="width:13%">Wt (Kg)</th><th style="width:12%">Rate</th><th style="width:16%">Payable ₹</th><th style="width:12%">Mode</th></tr></thead>
      <tbody>${whRows}</tbody>
      <tfoot><tr><td colspan="5" style="text-align:right;"><b>Wheat Total (₹)</b></td><td style="text-align:right;"><b>${fmt(whT)}</b></td><td></td></tr></tfoot></table>
    <div class="pv-sign" style="display:flex;justify-content:space-between;margin-top:26px;font-size:11.5px;font-weight:700;">
      <div style="border-top:1px solid #000;padding-top:3px;width:30%;text-align:center;">Checked By</div>
      <div style="border-top:1px solid #000;padding-top:3px;width:30%;text-align:center;">Authorised Signatory</div></div>
  </div>`;
}

/* ---------- शाम 7 बजे reminder — सब box भरे बिना बार-बार popup ---------- */
function updateVerifyBanner(list){
  const el=$('#ph-vbanner'); if(!el) return;
  const p=pendingVerify(list);
  if(!p.length){ el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML=`⏰ <b>${p.length}</b> Receipt अभी verify नहीं हुए`;
}
function eveningPending(){
  if(new Date().getHours()<19) return [];
  return pendingVerify();
}
function nagVerify(force){
  const p=eveningPending();
  if(!p.length) return false;
  if($('#live-popup') && !force) return true;
  popup({
    title:'⏰ शाम हो गयी — Receipt Verify बाक़ी है',
    body:`<div class="pp-note">नीचे के Receipt अभी तक verify नहीं हुए. हर entry पर यह reminder आता रहेगा जब तक सब box भर न जाएँ.</div>
      ${p.map(r=>`<div style="padding:6px 10px;border:1.5px solid #f1c40f;border-radius:10px;margin-bottom:6px;font-weight:700;">
        #${esc(String(r.no))} — ${esc(r.nameHi||r.name||'-')} <small>(${esc(r.addressHi||r.address||'')})</small></div>`).join('')}`,
    foot:`<span></span><div style="display:flex;gap:8px;"><button class="pp-btn cancel" onclick="closePopup()">बाद में</button><button class="pp-btn save" id="nv-go">अभी Verify करें →</button></div>`,
    onOpen(bk){ bk.querySelector('#nv-go').addEventListener('click',()=>{ closePopup(); go('printhome'); }); }
  });
  return true;
}
const _saveOrig=save;
save=function(){ _saveOrig(); setTimeout(()=>nagVerify(),400); };
setInterval(()=>{ if(!$('#live-popup')) nagVerify(); },180000);

/* init */
renderAll();
setTimeout(()=>nagVerify(),1500);
window.closePopup=closePopup;
