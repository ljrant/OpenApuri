// ==UserScript==
// @name         OpiskelijaHaku
// @namespace    https://github.com/ljrant/OpenApuri
// @version      0.6.17
// @description  Opiskelijoiden työjärjestysten opintojaksot ja opettajat
// @match        https://*.inschool.fi/profiles/students*
// @match        https://*.inschool.fi/profiles/teachers*
// @match        https://*.inschool.fi/
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/ljrant/OpenApuri/main/modules/OpiskelijaHaku.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/OpenApuri/main/modules/OpiskelijaHaku.user.js
// ==/UserScript==
(() => {
'use strict';
// Per-module state controlled by OpenApuri's in-app settings menu.
try {if(JSON.parse(localStorage.getItem('openapuri.modules.v1')||'{}').search===false)return;}catch{}

// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

// Prevent duplicated tool initialization inside the hidden schedule viewer.
const embedPage=new URLSearchParams(location.search).get('oh_embed')==='1';
if(window.top!==window.self&&!embedPage)return;
const homePage=location.pathname==='/';
const directoryPage=/^\/profiles\/students\/?$/.test(location.pathname);
const profilesPage=/^\/profiles\/(students|teachers)(?:\/|$)/.test(location.pathname);
if(!homePage&&!profilesPage||document.getElementById('oh-tab')||document.getElementById('oh-home'))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const norm=s=>clean(s).normalize('NFKC').toLocaleLowerCase('fi-FI');
const nameMatches=(name,query)=>{
  const words=norm(query).replace(/[,]+/g,' ').split(/\s+/).filter(Boolean);
  if(!words.length)return true;
  const parts=norm(name).replace(/[,]+/g,' ').split(/\s+/).filter(Boolean);
  return words.every(w=>parts.some(p=>p.startsWith(w)));
};
const studentRe=/^\/profiles\/students\/(\d+)\/?$/,teacherRe=/^\/profiles\/teachers\/(\d+)\/?$/;
const pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),fi=d=>d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear();
const parseDate=v=>{const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(v||'');if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null};
const weekStart=d=>{const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const css=make('style');css.textContent='#oh-panel{padding:16px;min-height:300px}#oh-panel *{box-sizing:border-box}#oh-panel .oh-fields{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}#oh-panel label{display:flex;flex-direction:column;gap:4px;flex:1;min-width:145px}#oh-panel input,#oh-panel textarea{border:1px solid #aab9c5;border-radius:4px;padding:8px;width:100%}#oh-panel textarea{min-height:100px}#oh-panel button{padding:7px 11px;margin:4px;border:1px solid #abc;background:#fff;border-radius:4px;cursor:pointer}#oh-panel button:disabled{opacity:.5}#oh-panel .oh-action{background:#176393;color:white}#oh-panel .oh-scroll{overflow:auto}#oh-panel table{width:100%;border-collapse:collapse}#oh-panel th,#oh-panel td{text-align:left;padding:8px;border-bottom:1px solid #dae1e6;vertical-align:top}#oh-panel th{background:#edf2f6}#oh-panel .oh-pill{display:inline-block;background:#eef5fa;padding:3px 6px;margin:3px;border-radius:4px}#oh-panel .oh-help{color:#576b79;font-size:12px;white-space:pre-wrap}@media(max-width:650px){#oh-panel label{min-width:100%}}';
css.textContent+='#oh-panel .oh-chooser{max-width:650px;margin:10px 0}#oh-panel .oh-choices{max-height:250px;overflow:auto;border:1px solid #b5c6d1;border-radius:5px;padding:4px;background:#fff}#oh-panel .oh-choice{display:block;width:100%;text-align:left;margin:0;padding:7px;border:0;border-bottom:1px solid #edf0f2;border-radius:0;background:#fff;color:#234b63}#oh-panel .oh-choice:hover{background:#eaf5fb}#oh-panel .oh-choice.oh-chosen{background:#dff0e5;color:#204b31;font-weight:600}#oh-panel .oh-time-toggle{display:flex;align-items:center;gap:8px;margin:8px 0;flex-direction:row;width:max-content;cursor:pointer}#oh-panel [hidden]{display:none!important}';document.head.append(css);
if(homePage){
  // Use an existing home dashboard card grid when present; never pin a wide
  // panel above the other Wilma dashboard cards.
  const card=make('section','panel panel-default');card.id='oh-home';
  card.style.cssText='min-width:0;margin:0 0 12px;background:#fff;border:1px solid #d4dfe7;border-radius:5px';
  const heading=make('h3','panel-heading','Opiskelija- ja henkilökuntahaku');
  heading.style.cssText='margin:0;padding:11px 14px;font-size:17px';
  const body=make('div','panel-body');body.style.cssText='padding:12px';
  const controls=make('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  const q=make('input');q.type='search';q.placeholder='Hae opiskelijaa tai opettajaa…';
  q.setAttribute('aria-label','Hae opiskelijoita ja henkilökuntaa');
  q.style.cssText='flex:1 1 200px;min-width:0;padding:7px;border:1px solid #c4d3df;border-radius:4px';
  const go=make('button','','Hae');go.style.cssText='padding:7px 12px;background:#176393;color:white;border:0;border-radius:4px;cursor:pointer';
  const expand=make('button','','Laajenna');expand.style.cssText='padding:7px 12px;background:white;border:1px solid #c4d3df;border-radius:4px;cursor:pointer';
  const frameHolder=make('div');frameHolder.hidden=true;
  const frame=make('iframe');frame.title='Laajennettu opiskelija- ja opettajahaku';
  frame.style.cssText='width:100%;height:690px;border:1px solid #dce6ed;margin-top:10px;background:#fff';
  const url=()=>{
    const u=new URL('/profiles/students/',location.origin);
    if(q.value.trim())u.searchParams.set('oh_q',q.value.trim());
    u.hash='opiskelijahaku';
    return u;
  };
  const navigate=()=>location.assign(url().href);
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();navigate()}});
  go.onclick=navigate;
  expand.onclick=()=>{
    frameHolder.hidden=!frameHolder.hidden;
    expand.textContent=frameHolder.hidden?'Laajenna':'Pienennä';
    if(!frameHolder.hidden){const u=url();u.searchParams.set('oh_embed','1');frame.src=u.href}
    else frame.removeAttribute('src');
  };
  controls.append(q,go,expand);frameHolder.append(frame);body.append(controls,frameHolder);card.append(heading,body);
  // Insert beside actual dashboard cards, retaining their native layout.
  const dashboard=$('main#main-content')||$('main');
  const existingCards=dashboard?[...dashboard.querySelectorAll('.panel, .card, .dashboard-card')].filter(el=>!el.closest('#oh-home')):[];
  const anchor=existingCards.find(el=>el.getBoundingClientRect().width>0)||existingCards[0];
  if(anchor?.parentElement){
    const parent=anchor.parentElement;
    // Match the dashboard's grid column width and placement.
    const column=anchor.closest('[class*="col-md-"],[class*="col-lg-"],[class*="col-sm-"]');
    if(column&&column.parentElement){
      const wrapper=make('div',column.className);
      wrapper.append(card);column.parentElement.insertBefore(wrapper,column.nextSibling);
    }else parent.insertBefore(card,anchor.nextSibling);
  }else (dashboard||document.body).append(card);
  return;
}
const tabs=$('main#main-content ul.nav.nav-tabs-primary')||$('ul.nav.nav-tabs-primary');
if(!tabs){console.warn('[OpiskelijaHaku] Välilehtipalkkia ei löydy');return}
const li=make('li');li.id='oh-tab';li.classList.add('oa-added-tab');
const link=make('a','','Haku');
link.href=directoryPage?'#opiskelijahaku':'/profiles/students/#opiskelijahaku';
link.setAttribute('role','tab');li.append(link);
tabs.insertBefore(li,$('.tabdrop',tabs));
if(!directoryPage)return; // Student profiles: keep Wilma's own tabs and navigate to the search.
const native=$('main#main-content .panel.tab-content')||$('.panel.tab-content');
if(!native){li.remove();console.warn('[OpiskelijaHaku] Sisältöpaneelia ei löydy');return}
const panel=make('section');panel.id='oh-panel';panel.hidden=true;native.insertAdjacentElement('afterend',panel);
let active=false,abort=null,rows=[],picked=new Map(),directory=new Map(),teacherDirectory=new Map(),directoryLoading=false,directoryLoaded=false,teacherDirectoryLoaded=false;
function changeTab(enabled){active=enabled;panel.hidden=!enabled;native.style.display=enabled?'none':'';li.classList.toggle('active',enabled);link.setAttribute('aria-selected',String(enabled))}
link.onclick=e=>{e.preventDefault();$$('li.active',tabs).forEach(n=>n.classList.remove('active'));changeTab(true);renderChoices()};
tabs.addEventListener('click',e=>{if(!e.target.closest('#oh-tab')&&e.target.closest('a'))changeTab(false)});
panel.append(make('h2','','Opiskelija- ja opettajahaku'),make('p','oh-help','Hae opiskelijoita tai henkilökuntaa nimellä, valitse henkilöt ja tarkastele työjärjestysten opintojaksoja, ajankohtia ja opetustiloja.'));
const searchPeeker=document.createElement('button');searchPeeker.type='button';searchPeeker.className='oa-peeker-settings';searchPeeker.title='OpenApuri · Asetukset';searchPeeker.setAttribute('aria-label','Avaa OpenApurin asetukset');searchPeeker.style.cssText='position:absolute;right:18px;bottom:-6px;top:auto;width:45px;height:46px;padding:0;margin:0;border:0;background:transparent;cursor:pointer;z-index:40;display:flex;align-items:center;justify-content:center';const searchPeekerImg=document.createElement('img');searchPeekerImg.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';searchPeekerImg.alt='';searchPeekerImg.style.cssText='display:block;width:45px;height:46px;object-fit:contain;pointer-events:none';searchPeeker.append(searchPeekerImg);searchPeeker.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'search'}}))});
const searchHeading=panel.querySelector('h2');searchHeading.style.position='relative';searchHeading.style.paddingRight='78px';searchHeading.append(searchPeeker);
const chooser=make('div','oh-chooser'),chooserLabel=make('label'),filter=make('input');
filter.type='search';filter.placeholder='Hae opiskelijaa tai henkilökuntaa nimellä…';filter.autocomplete='off';
chooserLabel.append(make('strong','','Etsi henkilöä'),filter);chooser.append(chooserLabel);

/* Group-name search. Group membership is read only from the selected group's
   main-page student profile links; never infer members from a similar name. */
const ohGroupResults=make('div','oh-group-results');chooser.append(ohGroupResults);
let ohGroups=null,ohGroupLoad=null;
async function ohFetchGroups(){
 if(ohGroups)return ohGroups;
 if(ohGroupLoad)return ohGroupLoad;
 ohGroupLoad=(async()=>{
  const res=await fetch('/groups',{credentials:'same-origin'});
  const final=new URL(res.url);
  if(!res.ok||final.origin!==location.origin||!/^\/groups\/?$/.test(final.pathname))throw Error('Ryhmien lataus epäonnistui');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html'),groups=new Map();
  for(const a of $('main a[href],#main-content a[href]',doc)){
   let u;try{u=new URL(a.getAttribute('href'),location.origin)}catch{continue}
   if(u.origin!==location.origin)continue;
   const match=u.pathname.match(/^\/groups\/(\d+)(?:\/|$)/),name=clean(a.textContent);
   if(match&&name&&name.length<120&&!groups.has(match[1]))groups.set(match[1],{id:match[1],name});
  }
  return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
 })();
 try{ohGroups=await ohGroupLoad;return ohGroups}finally{ohGroupLoad=null}
}
async function ohSelectGroup(group){
 try{
  say('Haetaan ryhmän '+group.name+' jäsenet…');
  const res=await fetch('/groups/'+encodeURIComponent(group.id),{credentials:'same-origin'});
  const final=new URL(res.url);
  if(!res.ok||final.origin!==location.origin||final.pathname.replace(/\/$/,'')!=='/groups/'+group.id)throw Error('Ryhmäsivua ei voitu avata');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html'),found=new Map();
  for(const a of $('main a[href],#main-content a[href]',doc)){
   let u;try{u=new URL(a.getAttribute('href'),location.origin)}catch{continue}
   if(u.origin!==location.origin)continue;
   const m=u.pathname.match(/^\/profiles\/students\/(\d+)\/?$/),name=clean(a.textContent);
   if(m&&name&&name.length<120)found.set(m[1],{id:m[1],name,type:'student'});
  }
  if(!found.size){say('Ryhmäsivulta ei löytynyt varmistettavia opiskelijalinkkejä. Valintoja ei muutettu.',true);return}
  const limit=250;let added=0;
  for(const p of found.values()){
   if(picked.size>=limit)break;
   if(!picked.has(personKey(p))){picked.set(personKey(p),p);added++}
   directory.set(p.id,p);
  }
  renderPicked();renderChoices();
  say('Ryhmän '+group.name+' opiskelijoita valittu: '+found.size+' (uusia '+added+').'+(picked.size>=limit?' Enimmäismäärä 250.':''));
 }catch(e){say('Ryhmän jäsenten haku epäonnistui: '+e.message,true)}
}
function ohRenderGroups(){
 ohGroupResults.replaceChildren();
 const q=norm(filter.value);if(!q||!ohGroups)return;
 const matches=ohGroups.filter(g=>nameMatches(g.name,q)).slice(0,25);
 if(!matches.length)return;
 ohGroupResults.append(make('strong','','Opetusryhmät – valitse kaikki ryhmän opiskelijat'));
 for(const group of matches){
  const button=make('button','oh-group-choice',group.name+' · valitse jäsenet');
  button.type='button';button.onclick=()=>ohSelectGroup(group);ohGroupResults.append(button);
 }
}

const chooserActions=make('div'),refresh=make('button','','Päivitä luettelo'),directoryStatus=make('span','oh-help','');
chooserActions.append(refresh,directoryStatus);chooser.append(chooserActions);
const choices=make('div','oh-choices');choices.setAttribute('role','listbox');choices.setAttribute('aria-multiselectable','true');chooser.append(choices);panel.append(chooser);
const form=make('div','oh-fields');
const startLabel=make('label'),start=make('input');start.type='date';start.value=iso(new Date);startLabel.append(make('strong','','Alkaen'),start);
const endLabel=make('label'),end=make('input');end.type='date';const endDate=new Date;end.value=iso(endDate);endLabel.append(make('strong','','Päättyen'),end);const timeLabel=make('label'),useTime=make('input');useTime.type='checkbox';useTime.style.width='auto';const timeText=make('span','','Rajaa myös kellonaikaan (valinnainen)');timeLabel.append(useTime,timeText);timeLabel.className='oh-time-toggle';
const clock=make('div','oh-fields');clock.hidden=true;const fromLabel=make('label'),fromTime=make('input');fromTime.type='time';fromTime.value='08:00';fromLabel.append(make('strong','','Alkaen klo'),fromTime);
const toLabel=make('label'),toTime=make('input');toTime.type='time';toTime.value='16:00';toLabel.append(make('strong','','Päättyen klo'),toTime);clock.append(fromLabel,toLabel);useTime.onchange=()=>{clock.hidden=!useTime.checked};
form.append(startLabel,endLabel);panel.append(form,timeLabel,clock);
const actions=make('div'),search=make('button','oh-action','Hae työjärjestykset'),cancel=make('button','','Keskeytä'),reset=make('button','','Tyhjennä valinnat');cancel.disabled=true;actions.append(search,cancel,reset);panel.append(actions);
const selection=make('div'),status=make('p','oh-help'),results=make('div','oh-scroll');panel.append(selection,status,results);
const say=(m,error)=>{status.textContent=m;status.style.color=error?'#9e2828':'#345d76'};
const personKey=p=>(p.type||'student')+':'+p.id;

function readNames(doc,kind='students'){
const re=kind==='teachers'?teacherRe:studentRe,store=kind==='teachers'?teacherDirectory:directory;
for(const a of $$('a[href]',doc)){
  let u;try{u=new URL(a.getAttribute('href'),kind==='teachers'?location.origin+'/profiles/teachers/':location.href)}catch{continue}
  if(u.origin!==location.origin)continue;
  const m=re.exec(u.pathname);if(!m)continue;
  const n=clean(a.textContent);
  if(n.length>2&&n.length<120)store.set(m[1],{id:m[1],name:n,type:kind==='teachers'?'teacher':'student'});
}
}
// Do not seed the picker from the default 'Ohjaamasi tai valvomasi opiskelijat' overview.
// Names are loaded explicitly from the directory's full-list / alphabetical views.
function renderChoices(){
  ohRenderGroups();
  choices.replaceChildren();
  const q=norm(filter.value);
  const people=[...directory.values(),...teacherDirectory.values()]
    .filter(p=>nameMatches(p.name,q))
    .sort((a,b)=>a.name.localeCompare(b.name,'fi')||personKey(a).localeCompare(personKey(b)));
  const visible=people.slice(0,80);
  for(const person of visible){
    const chosen=picked.has(personKey(person));
    const button=make('button','oh-choice'+(chosen?' oh-chosen':''),(chosen?'✓ ':'')+person.name);
    if(person.type==='teacher'){
      const marker=make('span','oh-staff-tag','Ope');
      marker.style.cssText='margin-left:7px;font-size:11px;font-weight:400;color:#7a8994;opacity:.8';
      button.append(marker);
    }
    button.type='button';button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(chosen));
    button.onclick=()=>{
      const key=personKey(person);
      if(picked.has(key))picked.delete(key);
      else if(picked.size<250)picked.set(key,person);
      else{say('Enintään 250 henkilöä kerrallaan.',true);return}
      renderPicked();renderChoices();
    };
    choices.append(button);
  }
  if(!visible.length)choices.append(make('div','oh-help',directoryLoading?'Nimiluetteloita ladataan…':!directoryLoaded&&!teacherDirectoryLoaded?'Kirjoita nimi tai paina Päivitä luettelot.':'Ei osumia.'));
  directoryStatus.textContent=(directoryLoading?'Ladataan… ':'')+directory.size+' opiskelijaa · '+teacherDirectory.size+' henkilökunnan jäsentä · osumia '+people.length+(people.length>80?' (näytetään 80)':'');
}
filter.addEventListener('input',()=>{
  renderChoices();
  if(!ohGroups&&!ohGroupLoad&&filter.value.trim())ohFetchGroups().then(renderChoices).catch(e=>console.warn('[OpenApuri Haku] Ryhmäluettelo:',e));
  if(!directoryLoading&&(!directoryLoaded||!teacherDirectoryLoaded))readDirectory();
});
async function readDirectory(force=false){
  if(directoryLoading)return;
  if(!force&&directoryLoaded&&teacherDirectoryLoaded)return;
  directoryLoading=true;refresh.disabled=true;renderChoices();
  say('Ladataan opiskelija- ja opettajaluetteloa…');
  const loadKind=async kind=>{
    const teacherMode=kind==='teachers';
    if(!force&&(teacherMode?teacherDirectoryLoaded:directoryLoaded))return {kind,skipped:true};
    const store=teacherMode?teacherDirectory:directory;
    const base='/profiles/'+kind;
    try{
      const links=[];
      if(teacherMode){
        const res=await fetch(base,{credentials:'same-origin'});
        if(!res.ok)throw Error('HTTP '+res.status);
        const doc=new DOMParser().parseFromString(await res.text(),'text/html');
        readNames(doc,kind);
        links.push(...$$('a[href]',doc));
      }else links.push(...$$('main#main-content a[href]').filter(a=>!a.closest('#oh-panel')));
      const urls=new Map();
      for(const a of links){
        let u;try{u=new URL(a.getAttribute('href'),location.origin+base+'/')}catch{continue}
        if(u.origin!==location.origin)continue;
        const path=u.pathname.replace(/\/$/,'');
        const isAlpha=new RegExp('^'+base+'/[a-zåäö]$','i').test(path);
        if(isAlpha||path===base+'/all'||(path===base&&norm(a.textContent)==='kaikki'))urls.set(u.href,u);
      }
      const queue=[...urls.values()].slice(0,42);let next=0,failed=0;
      async function worker(){
        while(next<queue.length){
          const u=queue[next++];
          try{
            const res=await fetch(u.href,{credentials:'same-origin'});
            if(!res.ok)throw Error('HTTP '+res.status);
            readNames(new DOMParser().parseFromString(await res.text(),'text/html'),kind);
          }catch(e){failed++;console.warn('[OpiskelijaHaku] Luetteloa ei voitu hakea:',e)}
          if(next%4===0)renderChoices();
        }
      }
      await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
      if(teacherMode)teacherDirectoryLoaded=true;else directoryLoaded=queue.length>0;
      return {kind,count:store.size,failed,missing:!queue.length&&!teacherMode};
    }catch(e){return {kind,error:e.message}}
  };
  try{
    const summary=await Promise.all([loadKind('students'),loadKind('teachers')]);
    const errors=summary.filter(x=>x.error||x.missing);
    say('Luettelot: '+directory.size+' opiskelijaa ja '+teacherDirectory.size+' henkilökunnan jäsentä.'+
      (errors.length?' Huomautus: '+errors.map(x=>x.kind+(x.error?' ('+x.error+')':' (luettelolinkkejä ei löytynyt)')).join(', '):''),Boolean(errors.length));
  }finally{directoryLoading=false;refresh.disabled=false;renderChoices()}
}
refresh.onclick=()=>{directoryLoaded=false;teacherDirectoryLoaded=false;readDirectory(true)};
function renderPicked(){
 selection.replaceChildren(make('strong','','Valitut henkilöt ('+picked.size+')'));
 const line=make('div');
 for(const p of picked.values()){
  const pill=make('span','oh-pill',p.name+' '),remove=make('button','','×');
  remove.type='button';remove.title='Poista';
  remove.onclick=()=>{picked.delete(personKey(p));renderPicked();renderChoices()};
  pill.append(remove);line.append(pill);
 }
 selection.append(line);
 if(picked.size){
  const compose=make('button','oh-action','Kirjoita viesti valituille ('+picked.size+')');
  compose.type='button';compose.style.cssText='display:block;margin:10px 0';
  compose.onclick=()=>{
   const url=new URL('/messages/compose',location.origin);
   for(const p of picked.values()){
    if(!/^\d+$/.test(String(p.id)))continue;
    url.searchParams.append(p.type==='teacher'?'r_teacher':'r_student',String(p.id));
   }
   if(!url.search){say('Vastaanottajia ei löytynyt.',true);return}
   // Wilma opens the compose page with verified explicit recipient IDs.
   window.open(url.href,'_blank','noopener');
  };
  selection.append(compose);
 }
}
cancel.onclick=()=>abort?.abort();
reset.onclick=()=>{picked.clear();rows=[];filter.value='';results.replaceChildren();renderPicked();renderChoices();say('Valinnat tyhjennetty.')};
function blockMoment(block,week){
const source=[block.querySelector('h3.sr-only')?.textContent,block.getAttribute('data-original-title'),block.getAttribute('title')].filter(Boolean).join(' ');
const dateMatch=source.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
let date=null;
function day(d,m,y){const x=new Date(y,m-1,d,12);return x.getDate()===d&&x.getMonth()===m-1&&x.getFullYear()===y?x:null}
if(dateMatch)date=day(+dateMatch[1],+dateMatch[2],+dateMatch[3]);
if(!date){const partial=source.match(/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/);if(partial)for(const y of [week.getFullYear()-1,week.getFullYear(),week.getFullYear()+1]){const x=day(+partial[1],+partial[2],y);if(x&&Math.abs(x-week)<7*86400000){date=x;break}}}
if(!date){const days=['maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai','sunnuntai'];const found=days.flatMap((x,i)=>new RegExp('(?:^|[\\s,;])'+x+'(?=\\s|[,:;.]|$)','i').test(source)?[i]:[]);if(found.length===1){date=new Date(week);date.setDate(date.getDate()+found[0])}}
const scrubbed=source.replace(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g,' ').replace(/\b\d{1,2}\.\d{1,2}\.(?!\d)/g,' ');
const ranges=[...scrubbed.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)];
let time=ranges.length===2?{start:+ranges[0][1]*60+(+ranges[0][2]),end:+ranges[1][1]*60+(+ranges[1][2])}:null;
if(time&&time.end<=time.start)time=null;
return {date,time};
}
// Extract date and time from the rendered Wilma grid when lesson text lacks them.
// Only calibrated ruler coordinates and identifiable weekday headings are accepted.
function gridLessonMoment(block,week){
  const root=block.closest('.schedule');
  const axis=root?.querySelector('.hourlist.hours-container')||root?.querySelector('.hourlist');
  const container=block.closest('.schedule-container');
  if(!root||!axis||!container)return {date:null,time:null};
  const clock=s=>{
    const m=String(s||'').match(/(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/);
    return m?(+m[1]*60+(+m[2])):null;
  };
  const ticks=[];
  const walk=axis.querySelectorAll('.hour, .time, [class*="label"], span, div');
  for(const el of walk){
    if(el.children.length&&el.textContent.trim().length>16)continue;
    const value=clock(el.textContent);
    if(value===null)continue;
    const r=el.getBoundingClientRect();
    if(r.height<=0||r.width<=0)continue;
    // Prefer leaf text positions, avoiding duplicated times in ancestor nodes.
    if([...el.children].some(c=>clock(c.textContent)!==null))continue;
    ticks.push({value,y:r.top+r.height/2});
  }
  ticks.sort((a,b)=>a.y-b.y);
  const pairs=[];
  for(const tick of ticks)if(!pairs.some(p=>Math.abs(p.y-tick.y)<3))pairs.push(tick);
  let time=null;
  if(pairs.length>=2){
    const a=pairs[0],b=pairs[pairs.length-1],scale=(b.y-a.y)/(b.value-a.value);
    if(Number.isFinite(scale)&&scale>.3&&scale<10){
      const r=block.getBoundingClientRect();
      const toMin=y=>Math.round((a.value+(y-a.y)/scale)/5)*5;
      const start=toMin(r.top),end=toMin(r.bottom);
      if(start>=0&&end<=1440&&end>start)time={start,end};
    }
  }
  const weekdays=['ma','ti','ke','to','pe','la','su'];
  const header=root.querySelector('.weekday-container');
  const headings=[];
  if(header){
    const dayRe=/(maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|(?:^|[\s(])(?:ma|ti|ke|to|pe|la|su)(?:[\s.)]|$))/i;
    for(const el of header.querySelectorAll('*')){
      if(el.children.length&&[...el.children].some(c=>dayRe.test(c.textContent)))continue;
      const label=String(el.textContent||'').trim();
      if(!label||!dayRe.test(label))continue;
      const x=el.getBoundingClientRect();
      if(x.width<=0)continue;
      const low=label.toLocaleLowerCase('fi');
      const d=low.match(/maanantai|tiistai|keskiviikko|torstai|perjantai|lauantai|sunnuntai|(?:^|[\s(])(ma|ti|ke|to|pe|la|su)(?=[\s.)]|$)/);
      if(!d)continue;
      const day=d[0].trim().replace(/[().]/g,'');
      let index=weekdays.indexOf(day);
      if(index<0)index=['maanantai','tiistai','keskiviikko','torstai','perjantai','lauantai','sunnuntai'].indexOf(day);
      if(index>=0)headings.push({index,x:x.left+x.width/2});
    }
  }
  let date=null;
  if(headings.length){
    const middle=block.getBoundingClientRect(),x=middle.left+middle.width/2;
    const best=headings.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a);
    // Ensure it lies within a plausible weekday column, never choose a faraway label.
    const spacing=headings.length>1?Math.min(...headings.slice(1).map((h,i)=>Math.abs(h.x-headings[i].x)).filter(n=>n>4)):container.getBoundingClientRect().width/5;
    if(Math.abs(best.x-x)<=Math.max(25,spacing*.6)){
      date=new Date(week);date.setDate(date.getDate()+best.index);
    }
  }
  return {date,time};
}
function lessonLabel(l){
const day=l.date?fi(new Date(l.date+'T12:00:00')):'Viikko '+l.week+' (päivä tuntematon)';
return day+(l.time?' '+pad(Math.floor(l.time.start/60))+':'+pad(l.time.start%60)+'–'+pad(Math.floor(l.time.end/60))+':'+pad(l.time.end%60):' (kellonaika tuntematon)');
}
function parseSchedule(html,person,week,from,to,clockRange){
const doc=typeof html==='string'?new DOMParser().parseFromString(html,'text/html'):html;
const schedule=$('#schedule-container',doc)||$('#schedule',doc);
if(!schedule)throw Error('Työjärjestyksen sisältö puuttuu haetusta sivusta (mahdollinen käyttöoikeus- tai kirjautumisongelma).');
const blocks=$$('.block',schedule);
if(!blocks.length)throw Error('NO_SCHEDULE_BLOCKS');
const out=[];let foundCourses=0,ignoredByDate=0,ignoredByTime=0;
for(const block of blocks){
// .class is the timetable group, NOT the course. Wilma shows the
// course in the first span of .info; its title may contain the full name.
const info=$(':scope > .info',block);
const subject=info?.querySelector(':scope > span:not(.sr-only)');
const shortCourse=clean(subject?.textContent);
const longCourse=clean(subject?.getAttribute('title'));
const genericTitle=/^(opintojakso|kurssi|course|oppiaine|subject|näytä|avaa)$/i;
const course=longCourse&&!genericTitle.test(longCourse)&&longCourse.length>=shortCourse.length?longCourse:shortCourse;
if(!course)continue;
const group=clean($(':scope > .class',block)?.textContent);
const groupUrls=[];
for(const link of $$('a[href]',block)){
  let u;try{u=new URL(link.getAttribute('href'),location.origin)}catch{continue}
  if(u.origin===location.origin&&/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(u.pathname))groupUrls.push(u.pathname);
}
const roomNode=$(':scope > .info .rooms',block)||$(':scope > .info .room',block)||
  $('a.rooms',block)||$('a.room',block)||$('.rooms',block)||$('.room',block)||
  $('a[href*="/profiles/rooms/"]',block)||$('a[href*="/profiles/facilities/"]',block)||
  $('a[href*="/profiles/classrooms/"]',block)||$('[data-room]',block);
const room=clean(roomNode?.getAttribute('title')||roomNode?.getAttribute('data-room')||roomNode?.textContent||'');
foundCourses++;
const moment=blockMoment(block,week);
if((!moment.date||!moment.time)&&block.isConnected){
  const fromGrid=gridLessonMoment(block,week);
  if(!moment.date)moment.date=fromGrid.date;
  if(!moment.time)moment.time=fromGrid.time;
}
if(moment.date&&(moment.date<from||moment.date>to)){ignoredByDate++;continue}
if(clockRange){
if(!moment.time){parseSchedule.unknownTimes=(parseSchedule.unknownTimes||0)+1;ignoredByTime++;continue}
if(moment.time.end<=clockRange.start||moment.time.start>=clockRange.end){ignoredByTime++;continue}
}
const teachers=new Map();for(const a of $$('a.teachers[href]',block)){let u;try{u=new URL(a.href,location.href)}catch{continue}const m=teacherRe.exec(u.pathname);if(!m||u.origin!==location.origin)continue;teachers.set(m[1],{id:m[1],name:clean(a.getAttribute('title')||a.textContent)})}
out.push({person,course,group,groupUrls,teachers:[...teachers.values()],week:iso(week),lesson:{date:moment.date?iso(moment.date):null,time:moment.time,week:iso(week),room},partial:!moment.date&&(week<from||new Date(week.getTime()+6*86400000)>to)});
}
if(blocks.length&&foundCourses===0)throw Error('Työjärjestysmerkintöjä löytyi, mutta opintojaksotietoa ei tunnistettu.');
// Genuine empty results are possible after applying date/time filters.
return {rows:out,stats:{blocks:blocks.length,courses:foundCourses,ignoredByDate,ignoredByTime}};
}
function parseExportSchedule(data,person,week,from,to,clockRange){
  if(!data||!Array.isArray(data.Schedule))return null;
  const out=[];
  const parseTime=v=>{
    const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(v||''));
    return m?+m[1]*60+(+m[2]):null;
  };
  for(const entry of data.Schedule){
    const day=Number(entry?.Day);
    if(!Number.isInteger(day)||day<1||day>7)continue;
    const d=new Date(week);d.setDate(week.getDate()+day-1);
    if(d<from||d>to)continue;
    const start=parseTime(entry.Start),end=parseTime(entry.End);
    const time=start!==null&&end!==null&&end>start?{start,end}:null;
    if(clockRange&&(!time||time.end<=clockRange.start||time.start>=clockRange.end))continue;
    for(const group of Array.isArray(entry.Groups)?entry.Groups:[]){
      const course=clean(group?.FullCaption||group?.Caption||group?.ShortCaption);
      if(!course)continue;
      const groupName=clean(group?.Class||entry.Class||'');
      const rawRooms=group?.Rooms||entry.Rooms||group?.Room||entry.Room;
      const room=Array.isArray(rawRooms)?rawRooms.map(x=>clean(x?.LongCaption||x?.Caption||x?.Name||x)).filter(Boolean).join(', '):clean(rawRooms?.LongCaption||rawRooms?.Caption||rawRooms?.Name||(typeof rawRooms==='string'?rawRooms:''));
      const teacherList=new Map();
      for(const t of Array.isArray(group.Teachers)?group.Teachers:[]){
        const id=String(t?.Id||'');
        if(!/^\d+$/.test(id))continue;
        teacherList.set(id,{id,name:clean(t.LongCaption||t.Caption||'Opettaja')});
      }
      out.push({person,course,group:groupName,groupUrls:[],teachers:[...teacherList.values()],
        week:iso(week),lesson:{date:iso(d),time,week:iso(week),room},partial:false});
    }
  }
  return out;
}
let exportNotAvailable=false;
async function tryExportSchedule(person,week,from,to,clockRange,signal){
  if(exportNotAvailable)return null;
  const url=new URL('/schedule/export/students/'+encodeURIComponent(person.id)+'/',location.origin);
  url.searchParams.set('date',fi(week));
  const response=await fetch(url.href,{credentials:'same-origin',signal,headers:{Accept:'application/json'}});
  if(!response.ok){
    if(response.status===401||response.status===403||response.status===404)exportNotAvailable=true;
    return null;
  }
  const raw=await response.text();
  // Older Wilma instances may return JSON with text/html or text/plain.
  if(!/^\s*\{/.test(raw))return null;
  let data;try{data=JSON.parse(raw)}catch{return null}
  const rows=parseExportSchedule(data,person,week,from,to,clockRange);
  if(!rows?.length)return null;
  return {rows,stats:{blocks:rows.length,courses:rows.length,ignoredByDate:0,ignoredByTime:0,source:'json'}};
}
async function renderedSchedule(url,signal,parse){
  // Parse *while attached*: removing the iframe invalidates layout geometry.
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    frame.style.cssText='position:fixed;left:-20000px;top:0;width:1100px;height:800px;visibility:hidden;pointer-events:none;border:0';
    let completed=false,interval=null,timeout=null,loaded=false;
    const cleanup=()=>{clearInterval(interval);clearTimeout(timeout);signal.removeEventListener('abort',abort);frame.remove()};
    const finish=(err,doc)=>{
      if(completed)return;
      completed=true;
      try{if(err)reject(err);else resolve(parse(doc))}catch(e){reject(e)}
      finally{cleanup()}
    };
    const abort=()=>finish(new Error('Haku keskeytettiin.'));
    if(signal.aborted)return reject(new Error('Haku keskeytettiin.'));
    signal.addEventListener('abort',abort,{once:true});
    frame.addEventListener('load',()=>{loaded=true});
    frame.addEventListener('error',()=>finish(new Error('Työjärjestyksen avaus epäonnistui.')));
    interval=setInterval(()=>{
      let doc;try{doc=frame.contentDocument}catch{return}
      if(!doc)return;
      if(doc.querySelector('#schedule .block')){
        // Allow one paint so getBoundingClientRect reflects rendered grid.
        clearInterval(interval);
        requestAnimationFrame(()=>requestAnimationFrame(()=>finish(null,doc)));
      }else if(loaded&&!doc.querySelector('#schedule-container'))finish(new Error('Työjärjestys puuttuu ladatulta sivulta.'));
    },170);
    timeout=setTimeout(()=>{
      let doc;try{doc=frame.contentDocument}catch{}
      if(doc?.querySelector('#schedule .block'))finish(null,doc);
      else finish(new Error('Wilman työjärjestyksen lataus aikakatkaistiin.'));
    },9000);
    frame.src=url.href;document.body.append(frame);
  });
}
async function runPool(tasks,signal,update){let next=0,done=0;const output=new Array(tasks.length);async function worker(){while(next<tasks.length&&!signal.aborted){const i=next++;try{const result=await tasks[i]();output[i]={rows:result.rows,stats:result.stats}}catch(e){output[i]={error:e.message}}update(++done,tasks.length)}}await Promise.all(Array.from({length:Math.min(3,tasks.length)},worker));return output}
search.onclick=async()=>{
if(abort)return;const from=parseDate(start.value),to=parseDate(end.value);
const clockRange=useTime.checked?{start:fromTime.value,end:toTime.value}:null;
if(clockRange){if(!/^\d\d:\d\d$/.test(clockRange.start)||!/^\d\d:\d\d$/.test(clockRange.end)||clockRange.start>=clockRange.end){say('Tarkista kellonaikarajaus. Päättymisajan on oltava alkamisajan jälkeen.',true);return}clockRange.start=+clockRange.start.slice(0,2)*60+(+clockRange.start.slice(3));clockRange.end=+clockRange.end.slice(0,2)*60+(+clockRange.end.slice(3))}
parseSchedule.unknownTimes=0;if(!from||!to||from>to){say('Virheellinen ajanjakso.',true);return}if(!picked.size){say('Valitse opiskelijat ensin.',true);return}if((to-from)/86400000>111){say('Enintään 16 viikon ajanjakso.',true);return}if(picked.size>20){say('Enintään 20 opiskelijaa kerrallaan.',true);return}
const dates=[];for(let d=weekStart(from);d<=to;d.setDate(d.getDate()+7))dates.push(new Date(d));
if(dates.length*picked.size>120){say('Rajaa hakua: enintään 120 työjärjestyshakua kerralla.',true);return}
abort=new AbortController();const signal=abort.signal;search.disabled=true;cancel.disabled=false;results.replaceChildren();
const tasks=[...picked.values()].flatMap(p=>dates.map(d=>async()=>{
// Prefer structured Wilma timetable data with explicit Day/Start/End.
if(p.type!=='teacher')try{
  const exported=await tryExportSchedule(p,d,from,to,clockRange,signal);
  if(exported)return exported;
}catch(e){if(signal.aborted)throw e}
// Not all Wilma instances grant access to export; fall back to existing view.
const u=new URL('/profiles/'+(p.type==='teacher'?'teachers':'students')+'/'+p.id+'/schedule',location.origin);u.searchParams.set('date',fi(d));
const response=await fetch(u,{credentials:'same-origin',signal});
if(!response.ok)throw Error('HTTP '+response.status);
const html=await response.text();
let fallback=null;
try{fallback=parseSchedule(html,p,d,from,to,clockRange)}
catch(e){if(e.message!=='NO_SCHEDULE_BLOCKS')throw e}
if(fallback&&fallback.rows.length&&fallback.rows.every(x=>x.lesson?.date&&x.lesson?.time))return fallback;
try{return await renderedSchedule(u,signal,doc=>parseSchedule(doc,p,d,from,to,clockRange))}
catch(e){
  if(signal.aborted)throw e;
  if(fallback)return fallback;
  if(e.message==='NO_SCHEDULE_BLOCKS')return {rows:[],stats:{blocks:0,courses:0,ignoredByDate:0,ignoredByTime:0}};
  throw e;
}
}));
try{
const output=await runPool(tasks,signal,(n,total)=>say('Haettu '+n+'/'+total+' työjärjestystä…'));
const failed=output.filter(x=>x?.error);
const errors=failed.length,combined=new Map();
const totalBlocks=output.reduce((n,o)=>n+(o?.stats?.blocks||0),0);
const totalCourses=output.reduce((n,o)=>n+(o?.stats?.courses||0),0);
for(const o of output){if(!o?.rows)continue;for(const x of o.rows){const key=personKey(x.person)+'|'+norm(x.course);if(!combined.has(key))combined.set(key,{...x,teachers:[],teacherIds:new Set(),groups:new Set(),groupUrls:new Set(),weeks:new Set(),lessons:new Map(),partial:false});
const item=combined.get(key);item.weeks.add(x.week);item.partial ||=x.partial;
if(x.group)item.groups.add(x.group);
for(const u of x.groupUrls||[])item.groupUrls.add(u);
for(const t of x.teachers)if(!item.teacherIds.has(t.id)){item.teacherIds.add(t.id);item.teachers.push(t)}
const l=x.lesson;if(l){const key=(l.date||'week:'+l.week)+'|'+(l.time?l.time.start+'-'+l.time.end:'?')+'|'+norm(x.group)+'|'+norm(l.room||'');if(!item.lessons.has(key))item.lessons.set(key,l)}
}}
rows=[...combined.values()].sort((a,b)=>a.person.name.localeCompare(b.person.name,'fi')||a.course.localeCompare(b.course,'fi'));
renderResults();
const firstError=failed[0]?.error||'';
say((signal.aborted?'Keskeytetty. ':'Valmis. ')+rows.length+' opintojaksoa, työjärjestysmerkintöjä '+totalBlocks+', tunnistettuja opintojaksoja '+totalCourses+', epäonnistuneita viikkohakuja '+errors+'.'+(firstError?' Esimerkkivirhe: '+firstError:'')+(parseSchedule.unknownTimes?' '+parseSchedule.unknownTimes+' merkintää ilman tunnistettavaa kellonaikaa.':''),errors>0||totalBlocks===0);
}catch(e){say('Hakuvirhe: '+e.message,true)}finally{abort=null;search.disabled=false;cancel.disabled=true}
};
function uniquePeople(list){
  return [...new Map(list.filter(p=>p&&/^\d+$/.test(String(p.id))).map(p=>[String(p.id),p])).values()];
}
async function guardianRecipients(students){
  const confirmed=new Set(),missing=[];
  // A guardian recipient is not the student's ID. Read Wilma's own
  // message links; do not manufacture r_guardian parameters.
  for(const p of uniquePeople(students)){
    try{
      const url=new URL('/profiles/students/'+encodeURIComponent(p.id),location.origin);
      const response=await fetch(url.href,{credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      const ids=new Set();
      for(const a of $$('a[href]',doc)){
        let u;try{u=new URL(a.getAttribute('href'),location.origin)}catch{continue}
        if(u.origin!==location.origin||u.pathname!=='/messages/compose')continue;
        for(const id of u.searchParams.getAll('r_guardian'))if(/^\d+$/.test(id))ids.add(id);
      }
      if(!ids.size)missing.push(p.name);
      for(const id of ids)confirmed.add(id);
    }catch(e){missing.push(p.name)}
  }
  return {ids:[...confirmed],missing};
}
async function selectedCourseStudents(courseRows){
  // The selected student's own timetable proves that student attends the
  // lesson. Teacher timetables do NOT prove course membership by themselves.
  const recipients=new Map(),unresolved=[];
  for(const row of courseRows)if(row.person.type!=='teacher')
    recipients.set(String(row.person.id),row.person);
  const rosterUrls=new Set();
  for(const row of courseRows.filter(r=>r.person.type==='teacher')){
    const urls=[...(row.groupUrls||[])];
    if(!urls.length)unresolved.push(row.course+' ('+row.person.name+'): ryhmän opiskelijaluetteloon ei ole linkkiä');
    else urls.forEach(u=>rosterUrls.add(u));
  }
  for(const path of rosterUrls){
    try{
      const url=new URL(path,location.origin);
      if(url.origin!==location.origin||!/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(url.pathname))throw Error('Virheellinen ryhmälinkki');
      const res=await fetch(url.href,{credentials:'same-origin'});
      if(!res.ok)throw Error('HTTP '+res.status);
      const doc=new DOMParser().parseFromString(await res.text(),'text/html');
      // Class profiles expose their own enrolled pupils as student profile
      // anchors, without the older #students / .student-list container.
      // Limit the search to the class page's main article/content; never
      // scrape navigation, sidebar, or unrelated Wilma directories.
      const roster=doc.querySelector('#students, .student-list, .students-list, [data-role="students"], table.students, table.student-list, #group-students');
      const classProfile=/^\/profiles\/classes\/\d+\/?$/.test(url.pathname);
      const main=doc.querySelector('main#main-content')||doc.querySelector('#main-content');
      let root=roster;
      if(!root&&classProfile)root=main;
      if(!root){
        unresolved.push('Ryhmän opiskelijaluetteloa ei voitu tunnistaa: '+url.pathname);
        continue;
      }
      const studentLinks=new Map();
      for(const a of $$('a[href]',root)){
        if(a.closest('nav, header, footer, aside, .sidebar, .navigation, .navbar, .breadcrumb, .pagination'))continue;
        let link;try{link=new URL(a.getAttribute('href'),url)}catch{continue}
        const m=studentRe.exec(link.pathname);
        if(link.origin!==location.origin||!m)continue;
        const name=clean(a.textContent);
        if(!name||name.length>120)continue;
        studentLinks.set(m[1],{id:m[1],name,type:'student'});
      }
      const count=studentLinks.size;
      if(!count){
        unresolved.push('Ryhmän jäsenluettelossa ei ollut tunnistettavia opiskelijaprofiileja: '+url.pathname);
        continue;
      }
      if(classProfile&&!roster){
        // Class profile fallback is less specific than an explicit roster.
        // Show the provenance in the compose warning rather than presenting
        // the selection as independently verified membership.
        unresolved.push('Tarkista ryhmän '+url.pathname+' '+count+' opiskelijavastaanottajaa Wilmassa: opiskelijat poimittiin ryhmäsivun pääsisällöstä.');
      }
      for(const [id,p] of studentLinks)recipients.set(id,p);
    }catch(e){unresolved.push('Ryhmän opiskelijoiden hakeminen epäonnistui')}
  }
  return {students:[...recipients.values()],unresolved};
}
async function composeForSelection(courseRows,kinds,button,options={}){
 if(!courseRows.length){say('Valitse vähintään yksi opintojakso.',true);return}
 if(!options.draftRecipients&&!kinds.students&&!kinds.courseStudents&&!kinds.teachers&&!kinds.guardians){say('Valitse vastaanottajaryhmä.',true);return}
 const students=uniquePeople(courseRows.filter(r=>r.person.type!=='teacher').map(r=>r.person));
 const teachers=uniquePeople([...courseRows.flatMap(r=>r.teachers),...courseRows.filter(r=>r.person.type==='teacher').map(r=>r.person)]);
 const url=new URL('/messages/compose',location.origin);
 const useDraft=Boolean(options.draftRecipients);
 const tab=!useDraft&&(kinds.guardians||kinds.courseStudents)?window.open('about:blank','_blank'):null;
 if(!useDraft&&(kinds.guardians||kinds.courseStudents)&&!tab){say('Selain esti uuden viesti-ikkunan.',true);return}
 if(useDraft){
   for(const pair of options.draftRecipients.recipientQuery||[]){
     const [key,value]=String(pair).split('=');
     if(['r_student','r_teacher','r_personnel','r_guardian','r_class','r_classguardian'].includes(key)&&/^\d+$/.test(value||''))url.searchParams.append(key,value);
   }
 }else{
   if(kinds.students)students.forEach(p=>url.searchParams.append('r_student',String(p.id)));
   if(kinds.teachers)teachers.forEach(p=>url.searchParams.append('r_teacher',String(p.id)));
 }
 const missing=[];
 if(!useDraft&&kinds.courseStudents){
   button.disabled=true;say('Tarkistetaan valittujen opintojaksojen opiskelijat…');
   try{
     const found=await selectedCourseStudents(courseRows);
     const existing=new Set(url.searchParams.getAll('r_student'));
     for(const p of found.students)if(!existing.has(String(p.id))){url.searchParams.append('r_student',String(p.id));existing.add(String(p.id))}
     missing.push(...found.unresolved);
   }catch(e){missing.push('Opintojaksojen opiskelijoiden hakeminen epäonnistui')}
   finally{button.disabled=false}
 }
 if(!useDraft&&kinds.teachers&&!teachers.length)missing.push('Opettajien tunnisteita ei löytynyt');
 if(!useDraft&&kinds.guardians){
   button.disabled=true;say('Haetaan huoltajien vastaanottajatietoja…');
   try{const g=await guardianRecipients(students);g.ids.forEach(id=>url.searchParams.append('r_guardian',id));missing.push(...g.missing.map(name=>'Huoltaja ei löytynyt: '+name))}
   catch(e){missing.push('Huoltajien haku epäonnistui')}
   finally{button.disabled=false}
 }
 const savedSnapshot=useDraft&&!url.search?options.draftRecipients.recipients:null;
 if(!url.search&&!savedSnapshot&&!useDraft){tab?.close();say('Vastaanottajia ei löytynyt. '+missing.join('; '),true);return}
 if(useDraft&&!url.search&&!savedSnapshot)missing.push('Luonnoksessa ei ollut palautettavia vastaanottajatunnisteita');
 const names=options.addNames?'Valitut opiskelijat:\n'+students.map(p=>p.name).join('\n'):'';
 const body=[String(options.body||''),names].filter(Boolean).join('\n\n');
 const transfer={
   createdAt:Date.now(),subject:String(options.subject||''),body,
   bodyHtml:options.bodyHtml||'',
   missingRecipients:missing,
   recipientQuery:[...url.searchParams].map(([key,val])=>key+'='+val),
   savedRecipients:savedSnapshot
 };
 localStorage.setItem('openapuri.composeRequest.v1',JSON.stringify(transfer));
 if(tab){try{tab.opener=null;tab.location.replace(url.href)}catch(e){tab.close();say('Viestin avaus epäonnistui.',true);return}}
 else window.open(url.href,'_blank','noopener');
 say('Wilman viestinkirjoitus avattu.'+(missing.length?' Huomautus näytetään viestisivulla: '+missing.join('; '):''),missing.length>0);
}
function renderResults(){
results.replaceChildren();
if(!rows.length){results.append(make('p','oh-help','Opintojaksoja ei löytynyt. Tarkista hakutilanteesta myös mahdolliset latausvirheet.'));return}
const actions=make('div');
const recipientToggle=make('button','oh-action','Valitse viestin vastaanottajat');
const recipientPanel=make('div','oh-recipient-panel');recipientPanel.hidden=true;
recipientPanel.style.cssText='padding:10px;margin:6px 0 12px;border:1px solid #cad7df;border-radius:6px';
const kinds={};
for(const [kind,label,defaultChecked] of [
  ['students','Opiskelijat',true],
  ['courseStudents','Valittujen opintojaksojen opiskelijat',false],
  ['teachers','Opettajat',false],
  ['guardians','Huoltajat',false]
]){
  const option=make('label');
  option.style.cssText='display:inline-flex;flex-direction:row;align-items:center;gap:6px;margin:5px 15px 5px 0;min-width:0;cursor:pointer';
  const cb=make('input');cb.type='checkbox';cb.checked=defaultChecked;cb.style.width='auto';
  kinds[kind]=cb;option.append(cb,make('span','',label));recipientPanel.append(option);
}
const addNames=make('input');addNames.type='checkbox';addNames.style.width='auto';
const namesLabel=make('label');namesLabel.style.cssText='display:flex;flex-direction:row;align-items:center;gap:8px;margin:7px 0';
namesLabel.append(addNames,make('span','','Lisää valittujen opiskelijoiden nimet viestitekstiin'));
recipientPanel.append(namesLabel);
const templateSelect=make('select');templateSelect.style.cssText='width:100%;padding:7px;margin:6px 0';
const titleInput=make('input');titleInput.placeholder='Viestin otsikko';titleInput.style.margin='5px 0';
const messageBody=make('textarea');messageBody.rows=4;messageBody.placeholder='Viestin sisältö';messageBody.style.cssText='width:100%;min-height:72px;margin:5px 0';
let templateHtml='',templateText='',activeDraft=null;
const getSaved=(key)=>{try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data:[]}catch{return []}};
let templates=[];
function reloadTemplates(){
 templates=[
 ...getSaved('openapuri.messageTemplates.v1').filter(t=>t?.title).map(t=>({kind:'template',name:'Pohja: '+t.title,subject:t.subject||'',body:t.body||'',html:t.bodyHtml||''})),
 ...getSaved('openapuri.draftHistory.v1').filter(t=>t?.subject).map(t=>({kind:'draft',name:'Luonnos: '+t.subject,subject:t.subject||'',body:t.bodyHtml||'',html:t.bodyHtml||'',recipientQuery:t.recipientQuery||[],recipients:t.recipients||null}))];
 templateSelect.replaceChildren();const first=make('option','','Valitse viestipohja tai tallennettu luonnos');first.value='';templateSelect.append(first);
 templates.forEach((t,i)=>{const el=make('option','',t.name);el.value=String(i);templateSelect.append(el)});
}
reloadTemplates();
templateSelect.onchange=()=>{
 activeDraft=null;
 if(templateSelect.value===''){draftRecipientsCheckbox.checked=false;draftRecipientsLabel.hidden=true;return}
 const t=templates[Number(templateSelect.value)];if(!t)return;
 activeDraft=t.kind==='draft'?t:null;
 draftRecipientsCheckbox.checked=Boolean(activeDraft);draftRecipientsLabel.hidden=!activeDraft;
 titleInput.value=t.subject;const safe=make('div');safe.innerHTML=t.html||t.body;templateText=safe.textContent||t.body;
 messageBody.value=templateText;templateHtml=t.html;
};
const draftRecipientsLabel=make('label');draftRecipientsLabel.hidden=true;
 draftRecipientsLabel.style.cssText='display:flex;flex-direction:row;gap:8px;align-items:center;margin:7px 0';
 const draftRecipientsCheckbox=make('input');draftRecipientsCheckbox.type='checkbox';draftRecipientsCheckbox.style.width='auto';
 draftRecipientsLabel.append(draftRecipientsCheckbox,make('span','','Käytä valitun luonnoksen vastaanottajia (korvaa valitut opiskelijat/opettajat)'));
 const refreshTemplates=make('button','','Päivitä tallennetut pohjat');refreshTemplates.onclick=reloadTemplates;
recipientPanel.append(make('strong','','Viestipohjat ja tallennetut luonnokset'),templateSelect,refreshTemplates,draftRecipientsLabel,titleInput,messageBody);
const openMessage=make('button','oh-action','Avaa viesti Wilmassa');
openMessage.style.display='block';
recipientPanel.append(openMessage,make('p','oh-help','Valitse yksi tai useampi vastaanottajaryhmä. Viestiä ei lähetetä automaattisesti. Tarkista vastaanottajat Wilmassa.'));
recipientToggle.onclick=()=>{recipientPanel.hidden=!recipientPanel.hidden};
actions.append(recipientToggle,recipientPanel);results.append(actions);
const byStudent=new Map();
rows.forEach((r,i)=>{const key=personKey(r.person);if(!byStudent.has(key))byStudent.set(key,{person:r.person,items:[]});byStudent.get(key).items.push({r,i})});
const selected=new Set(rows.map((_,i)=>i));
const onlyTeachers=rows.every(r=>r.person.type==='teacher');
if(onlyTeachers){kinds.students.checked=false;kinds.courseStudents.checked=false;kinds.teachers.checked=true;kinds.guardians.checked=false}
for(const {person,items} of byStudent.values()){
  const section=make('section','oh-student-group'),heading=make('h3');
  const personLink=make('a','',person.name);
  personLink.href='/profiles/'+(person.type==='teacher'?'teachers':'students')+'/'+encodeURIComponent(person.id);
  personLink.target='_blank';personLink.rel='noopener noreferrer';
  heading.append(personLink);
  if(person.type==='teacher'){
    const marker=make('span','oh-staff-tag','Ope');marker.style.cssText='margin-left:7px;font-size:11px;font-weight:400;color:#7a8994;opacity:.8';heading.append(marker);
  }
  heading.append(document.createTextNode(' · '+items.length+' opintojaksoa'));
  heading.style.cssText='font-size:16px;margin:12px 0 5px;font-weight:600';
  section.append(heading);
  const table=make('table'),thead=make('thead'),tr=make('tr');
  ['','Opintojakso','Opettaja(t)','Oppituntien ajankohdat','Opetustila'].forEach(x=>tr.append(make('th','',x)));
  thead.append(tr);table.append(thead);
  const body=make('tbody');
  for(const {r,i} of items){
    const row=make('tr'),pick=make('td'),cb=make('input');cb.type='checkbox';cb.checked=true;cb.setAttribute('aria-label','Valitse '+r.course);
    cb.onchange=()=>cb.checked?selected.add(i):selected.delete(i);pick.append(cb);
    const courseCell=make('td');
    const groupLinks=[...(r.groupUrls||[])].filter(path=>/^\/(?:groups|profiles\/(?:groups|classes))\/\d+\/?$/.test(String(path)));
    if(groupLinks.length){
      const courseLink=make('a','',r.course);
      courseLink.href=groupLinks[0];courseLink.target='_blank';courseLink.rel='noopener noreferrer';
      courseCell.append(courseLink);
      if(groupLinks.length>1){
        const extra=make('span','', ' ');
        for(let n=1;n<groupLinks.length;n++){
          const a=make('a','', 'Ryhmä '+(n+1));
          a.href=groupLinks[n];a.target='_blank';a.rel='noopener noreferrer';
          extra.append(' ',a);
        }
        courseCell.append(extra);
      }
    }else courseCell.textContent=r.course;
    row.append(pick,courseCell);
    const teacherCell=make('td');
    if(!r.teachers.length)teacherCell.textContent='Ei opettajatietoa';
    else for(const teacher of r.teachers){
      const a=make('a','',teacher.name);a.href='/profiles/teachers/'+teacher.id;a.target='_blank';a.rel='noopener';teacherCell.append(a,document.createTextNode(' '));
    }
    const lessonCell=make('td');
const lessons=[...(r.lessons?.values()||[])].sort((a,b)=>(a.date||a.week).localeCompare(b.date||b.week)||(a.time?.start??-1)-(b.time?.start??-1));
lessons.forEach((l,j)=>{if(j)lessonCell.append(document.createTextNode(' · '));lessonCell.append(make('span','',lessonLabel(l)))});
if(!lessons.length)lessonCell.textContent='Ajankohta ei tiedossa';
const roomCell=make('td');
lessons.forEach((l,j)=>{if(j)roomCell.append(document.createTextNode(' · '));roomCell.append(make('span','',l.room||'Ei huonetietoa'))});
if(!lessons.length)roomCell.textContent='Ei huonetietoa';
row.append(teacherCell,lessonCell,roomCell);body.append(row);
  }
  table.append(body);section.append(table);results.append(section);
}
results.append(make('p','oh-help','Opintojakso näkyy opiskelijaa kohden vain kerran. Ryhmämerkintöjä ei esitetä opintojakson niminä. Ajanjakson reunaviikot voivat sisältää myös sen ulkopuolisia opetuspäiviä.'));
const chosen=()=>[...selected].map(i=>rows[i]).filter(Boolean);
openMessage.onclick=()=>composeForSelection(chosen(),{students:kinds.students.checked,courseStudents:kinds.courseStudents.checked,teachers:kinds.teachers.checked,guardians:kinds.guardians.checked},openMessage,
{addNames:addNames.checked,subject:titleInput.value,body:messageBody.value,bodyHtml:templateHtml&&messageBody.value===templateText?templateHtml:'',draftRecipients:activeDraft&&draftRecipientsCheckbox.checked?activeDraft:null});
}

renderPicked();renderChoices();
if(directoryPage){
  const params=new URLSearchParams(location.search);
  let pending=null;try{pending=sessionStorage.getItem('openapuri.pendingSearch.v1');sessionStorage.removeItem('openapuri.pendingSearch.v1')}catch{}
  filter.value=pending!==null?pending:(params.get('oh_q')||'');
  link.click();
  if(filter.value)readDirectory();
  if(embedPage){
    const hide=make('style');hide.textContent='body>header,body>nav,#navigation,.navbar,.breadcrumb,#oh-tab{display:none!important} main#main-content{padding:0!important} #oh-panel{padding:8px!important}';document.head.append(hide);
  }
}
})();