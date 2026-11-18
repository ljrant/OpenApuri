// ==UserScript==
// @name         OpiskelijaHaku
// @namespace    https://github.com/ljrant/WilmaTools
// @version      0.1.0
// @description  Opiskelijoiden työjärjestysten opintojaksot ja opettajat
// @match        https://*.inschool.fi/profiles/students*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/WilmaTools/main/modules/OpiskelijaHaku.user.js
// ==/UserScript==
(() => {
'use strict';
if(!/^\/profiles\/students\/?$/.test(location.pathname)||document.getElementById('oh-tab'))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const clean=s=>String(s||'').trim().replace(/\s+/g,' '),norm=s=>clean(s).toLocaleLowerCase('fi');
const studentRe=/^\/profiles\/students\/(\d+)\/?$/,teacherRe=/^\/profiles\/teachers\/(\d+)\/?$/;
const pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),fi=d=>d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear();
const parseDate=v=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(v||'');if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null};
const weekStart=d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const css=make('style');css.textContent='#oh-panel{padding:16px;min-height:300px}#oh-panel *{box-sizing:border-box}#oh-panel .oh-fields{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#oh-panel label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:145px}#oh-panel input,#oh-panel textarea{border:1px solid #aab9c5;border-radius:4px;padding:8px;width:100%}#oh-panel textarea{min-height:100px}#oh-panel button{padding:7px 11px;margin:4px;border:1px solid #abc;background:#fff;border-radius:4px;cursor:pointer}#oh-panel button:disabled{opacity:.5}#oh-panel .oh-action{background:#176393;color:white}#oh-panel .oh-scroll{overflow:auto}#oh-panel table{width:100%;border-collapse:collapse}#oh-panel th,#oh-panel td{text-align:left;padding:8px;border-bottom:1px solid #dae1e6;vertical-align:top}#oh-panel th{background:#edf2f6}#oh-panel .oh-pill{display:inline-block;background:#eef5fa;padding:3px 6px;margin:3px;border-radius:4px}#oh-panel .oh-help{color:#576b79;font-size:12px;white-space:pre-wrap}@media(max-width:650px){#oh-panel label{min-width:100%}}';
document.head.append(css);
const tabs=$('main#main-content ul.nav.nav-tabs-primary'),native=$('main#main-content .panel.tab-content');if(!tabs||!native){console.warn('[OpiskelijaHaku] Välilehtipalkkia ei löydy');return}
const li=make('li');li.id='oh-tab';const link=make('a','', 'OpiskelijaHaku');link.href='#opiskelijahaku';link.setAttribute('role','tab');li.append(link);tabs.insertBefore(li,$('.tabdrop',tabs));
const panel=make('section');panel.id='oh-panel';panel.hidden=true;native.insertAdjacentElement('afterend',panel);
let active=false,abort=null,rows=[],picked=new Map(),directory=new Map();
function changeTab(enabled){active=enabled;panel.hidden=!enabled;native.style.display=enabled?'none':'';li.classList.toggle('active',enabled);link.setAttribute('aria-selected',String(enabled))}
link.onclick=e=>{e.preventDefault();$$('li.active',tabs).forEach(n=>n.classList.remove('active'));changeTab(true)};
tabs.addEventListener('click',e=>{if(!e.target.closest('#oh-tab')&&e.target.closest('a'))changeTab(false)});
panel.append(make('h2','','OpiskelijaHaku'),make('p','oh-help','Kirjoita opiskelijoiden nimet yksi per rivi. Haku käyttää Wilman opiskelijaluetteloita ja hakee työjärjestystiedot saman kirjautuneen istunnon kautta.'));
const form=make('div','oh-fields'),namesLabel=make('label'),names=make('textarea');names.placeholder='Sukunimi Etunimi, yksi per rivi';namesLabel.append(make('strong','','Opiskelijat'),names);
const startLabel=make('label'),start=make('input');start.type='date';start.value=iso(new Date);startLabel.append(make('strong','','Alkaen'),start);
const endLabel=make('label'),end=make('input');end.type='date';const endDate=new Date;endDate.setDate(endDate.getDate()+13);end.value=iso(endDate);endLabel.append(make('strong','','Päättyen'),end);form.append(namesLabel,startLabel,endLabel);panel.append(form);
const actions=make('div'),find=make('button','','Etsi opiskelijat'),search=make('button','oh-action','Hae työjärjestykset'),cancel=make('button','','Keskeytä'),reset=make('button','','Tyhjennä');cancel.disabled=true;actions.append(find,search,cancel,reset);panel.append(actions);
const selection=make('div'),status=make('p','oh-help'),results=make('div','oh-scroll');panel.append(selection,status,results);
const say=(m,error)=>{status.textContent=m;status.style.color=error?'#9e2828':'#345d76'};
function readNames(doc){for(const a of $$('a[href]',doc)){let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}if(u.origin!==location.origin)continue;const m=studentRe.exec(u.pathname);if(!m)continue;const n=clean(a.textContent);if(n.length>2&&n.length<120)directory.set(m[1],{id:m[1],name:n})}}
readNames(document);
async function readDirectory(){
const urls=$$('main#main-content ul.nav.nav-tabs-primary a[href]').map(a=>{try{return new URL(a.href,location.href)}catch{return null}}).filter(u=>u&&u.origin===location.origin&&/^\/profiles\/students(?:\/[^/]+)?\/?$/.test(u.pathname));
for(const u of urls){if(u.href===location.href)continue;try{const r=await fetch(u.href,{credentials:'same-origin'});if(r.ok)readNames(new DOMParser().parseFromString(await r.text(),'text/html'))}catch(e){console.warn('[OpiskelijaHaku] Hakemisto:',e)}}
}
function renderPicked(){selection.replaceChildren(make('strong','','Valitut opiskelijat ('+picked.size+')'));const line=make('div');for(const p of picked.values()){const pill=make('span','oh-pill',p.name+' ');const remove=make('button','','×');remove.title='Poista';remove.onclick=()=>{picked.delete(p.id);renderPicked()};pill.append(remove);line.append(pill)}selection.append(line)}
find.onclick=async()=>{find.disabled=true;say('Haetaan Wilman opiskelijaluetteloita…');try{await readDirectory();const missing=[],ambiguous=[];for(const n of names.value.split(/[\n;,]+/).map(clean).filter(Boolean)){const exact=[...directory.values()].filter(p=>norm(p.name)===norm(n));const candidates=exact.length?exact:[...directory.values()].filter(p=>norm(p.name).includes(norm(n)));if(candidates.length===1)picked.set(candidates[0].id,candidates[0]);else if(!candidates.length)missing.push(n);else ambiguous.push(n)}renderPicked();say('Valittuja '+picked.size+'. Luettelossa '+directory.size+' opiskelijaa.'+(missing.length?' Ei löytynyt: '+missing.join(', ')+'.':'')+(ambiguous.length?' Useita osumia: '+ambiguous.join(', ')+'.':''))}catch(e){say('Hakuvirhe: '+e.message,true)}finally{find.disabled=false}};
cancel.onclick=()=>abort?.abort();reset.onclick=()=>{picked.clear();rows=[];names.value='';results.replaceChildren();renderPicked();say('Tyhjennetty.')};
function parseSchedule(html,person,week,from,to){
const doc=new DOMParser().parseFromString(html,'text/html');if(!$('#schedule-container',doc))throw Error('Työjärjestystä ei löytynyt');const out=[];
for(const block of $$('#schedule .block',doc)){
const course=clean($(':scope > span.class',block)?.textContent);if(!course)continue;
const teachers=new Map();for(const a of $$('a.teachers[href]',block)){let u;try{u=new URL(a.href,location.href)}catch{continue}const m=teacherRe.exec(u.pathname);if(!m||u.origin!==location.origin)continue;teachers.set(m[1],{id:m[1],name:clean(a.getAttribute('title')||a.textContent)})}
out.push({person,course,teachers:[...teachers.values()],week:iso(week),partial:week<from||new Date(week.getTime()+6*86400000)>to});
}
return out;
}
async function runPool(tasks,signal,update){let next=0,done=0;const output=new Array(tasks.length);async function worker(){while(next<tasks.length&&!signal.aborted){const i=next++;try{output[i]={rows:await tasks[i]()}}catch(e){output[i]={error:e.message}}update(++done,tasks.length)}}await Promise.all(Array.from({length:Math.min(3,tasks.length)},worker));return output}
search.onclick=async()=>{
if(abort)return;const from=parseDate(start.value),to=parseDate(end.value);if(!from||!to||from>to){say('Virheellinen ajanjakso.',true);return}if(!picked.size){say('Valitse opiskelijat ensin.',true);return}if((to-from)/86400000>111){say('Enintään 16 viikon ajanjakso.',true);return}if(picked.size>20){say('Enintään 20 opiskelijaa kerrallaan.',true);return}
const dates=[];for(let d=weekStart(from);d<=to;d.setDate(d.getDate()+7))dates.push(new Date(d));
if(dates.length*picked.size>120){say('Rajaa hakua: enintään 120 työjärjestyshakua kerralla.',true);return}
abort=new AbortController();const signal=abort.signal;search.disabled=true;cancel.disabled=false;results.replaceChildren();
const tasks=[...picked.values()].flatMap(p=>dates.map(d=>async()=>{const u=new URL('/profiles/students/'+p.id+'/schedule',location.origin);u.searchParams.set('date',fi(d));const response=await fetch(u,{credentials:'same-origin',signal});if(!response.ok)throw Error('HTTP '+response.status);return parseSchedule(await response.text(),p,d,from,to)}));
try{
const output=await runPool(tasks,signal,(n,total)=>say('Haettu '+n+'/'+total+' työjärjestystä…'));
const errors=output.filter(x=>x?.error).length,combined=new Map();
for(const o of output){if(!o?.rows)continue;for(const x of o.rows){const key=x.person.id+'|'+norm(x.course)+'|'+x.teachers.map(t=>t.id).sort().join(',');if(!combined.has(key))combined.set(key,{...x,weeks:new Set(),partial:false});const item=combined.get(key);item.weeks.add(x.week);item.partial ||=x.partial}}
rows=[...combined.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,'fi')||a.course.localeCompare(b.course,'fi'));renderResults();say((signal.aborted?'Keskeytetty. ':'Valmis. ')+rows.length+' opintojaksoriviä, '+errors+' epäonnistunutta hakua.'+(errors?' Tulos voi olla puutteellinen.':''),!!errors);
}catch(e){say('Hakuvirhe: '+e.message,true)}finally{abort=null;search.disabled=false;cancel.disabled=true}
};
function compose(list,type){
const persons=[...new Map(list.map(p=>[p.id,p])).values()];
if(!persons.length){say('Ei vastaanottajia.',true);return}
if(type==='students'){
const u=new URL('/messages/compose',location.origin);for(const p of persons)u.searchParams.append('r_student',p.id);window.open(u.href,'_blank','noopener');return
}
localStorage.setItem('wilmatools.composeRequest.v1',JSON.stringify({subject:'',body:'',recipientsNames:persons.map(p=>p.name),recipientRule:'opettajat',createdAt:Date.now()}));
window.open(location.origin+'/messages/compose#wt-library','_blank','noopener');
}
function renderResults(){
results.replaceChildren();if(!rows.length){results.append(make('p','','Opintojaksoja ei löytynyt.'));return}
const controls=make('div'),students=make('button','','Viesti valituille opiskelijoille'),teachers=make('button','','Viesti opettajille');controls.append(students,teachers);results.append(controls);
const table=make('table'),thead=make('thead'),head=make('tr');['Valitse','Opiskelija','Opintojakso / ryhmä','Opettajat','Viikkoja'].forEach(x=>head.append(make('th','',x)));thead.append(head);table.append(thead);
const body=make('tbody'),selected=new Set(rows.map((_,i)=>i));
rows.forEach((r,i)=>{const tr=make('tr'),cell=make('td'),cb=make('input');cb.type='checkbox';cb.checked=true;cb.setAttribute('aria-label','Valitse opintojaksorivi');cb.onchange=()=>cb.checked?selected.add(i):selected.delete(i);cell.append(cb);tr.append(cell,make('td','',r.person.name),make('td','',r.course));const tcell=make('td');if(!r.teachers.length)tcell.textContent='Opettaja ei ilmene';for(const teacher of r.teachers){const a=make('a','',teacher.name);a.href='/profiles/teachers/'+teacher.id;a.target='_blank';a.rel='noopener';tcell.append(a,document.createTextNode(' '))}tr.append(tcell,make('td','',String(r.weeks.size)+(r.partial?'*':'')));body.append(tr)});
table.append(body);results.append(table,make('p','oh-help','* Ajanjakson ensimmäinen tai viimeinen työjärjestysviikko saattaa sisältää myös rajauksen ulkopuolisia päiviä. Tarkista vastaavuus Wilmassa.'));
const chosen=()=>[...selected].map(i=>rows[i]);students.onclick=()=>compose(chosen().map(r=>r.person),'students');teachers.onclick=()=>compose(chosen().flatMap(r=>r.teachers),'teachers');
}
renderPicked();
})();