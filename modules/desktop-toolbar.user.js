// ==UserScript==
// @name         OpenApuri - Desktop Sidebar
// @namespace    https://github.com/ljrant/OpenApuri
// @version      0.24.17
// @description  Finnish-first OpenApuri sidebar on every Wilma page
// @match        https://*.inschool.fi/*
// @updateURL    https://raw.githubusercontent.com/ljrant/OpenApuri/main/modules/desktop-toolbar.user.js
// @downloadURL  https://raw.githubusercontent.com/ljrant/OpenApuri/main/modules/desktop-toolbar.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
'use strict';
// One-time compatible copy of older local data; never overwrite OpenApuri values.
try {
  const prefix='wilma'+'tools.';
  for(const key of ['settings','lastGradebook','messageTemplates.v1','draftHistory.v1','composeRequest.v1','draftRestore.v1','sentTemplateImport.v1']){
    const target='openapuri.'+key;
    const old=localStorage.getItem(prefix+key);
    if(old!==null&&localStorage.getItem(target)===null)localStorage.setItem(target,old);
  }
} catch(e){console.warn('[OpenApuri] Aiemman tallennustiedon kopiointi ei onnistunut:',e)}

if(window.__openApuriHub)return;
const oaMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
window.__openApuriHub=true;
const KEY='openapuri.settings',lastKey='openapuri.lastGradebook';
const t={fi:{tools:'Työkalut',progress:'Ryhmänohjaajan arviointinäkymä',autosave:'Viestiluonnosten tallennus',write:'Kirjoita viesti',templates:'Viestipohjat',drafts:'Tallennetut viestit',settings:'Asetukset',language:'Kieli',close:'Sulje',open:'Avaa',install:'Asenna moduuli',hint:'Työkalut otetaan käyttöön tai pois käytöstä Tampermonkeyssa.',unknown:'Avaa ensin opiskelijan opintosuoritussivu, jotta pikavalinta voidaan tallentaa.',home:'Pikavalinta ryhmänohjaajan arviointiin',notEnabled:'Moduuli ei ole tällä sivulla käytettävissä.'},en:{tools:'Tools',progress:'Homeroom grade overview',autosave:'Message draft autosaver',write:'Compose message',templates:'Message templates',drafts:'Saved drafts',settings:'Settings',language:'Language',close:'Close',open:'Open',install:'Install module',hint:'Enable and disable modules in Tampermonkey.',unknown:'First open a student gradebook so the shortcut can be saved.',home:'Homeroom grade overview shortcut',notEnabled:'Module is not available on this page.'}};
let lang='fi';try{lang=JSON.parse(localStorage.getItem(KEY)||'{}').lang==='en'?'en':'fi'}catch{}
const x=k=>t[lang][k],grade=/^\/profiles\/students\/\d+\/choices\/?$/;
const css=document.createElement('style');css.textContent=`
#wt-side-toggle{display:none!important}
#wt-side-panel{position:fixed!important;bottom:0!important;left:0!important;right:0!important;top:auto!important;z-index:10020!important;background:var(--oa-surface,#f5fbf8)!important;border-top:3px solid var(--oa-primary,#147c6e)!important;box-shadow:0 -2px 10px #0002!important;padding:7px 14px!important;font:13px system-ui!important;color:var(--oa-text,#173c48)!important;box-sizing:border-box!important;display:flex!important;gap:9px!important;align-items:center!important;flex-wrap:wrap!important;min-height:46px!important;visibility:visible!important}
#wt-side-panel .oa-bottom-brand{color:var(--oa-primary-dark,#075b50);font-size:14px;font-weight:750;margin-right:4px}
#wt-side-panel .oa-bottom-search{display:flex;align-items:center;gap:5px;flex:1 1 270px;max-width:520px;margin:0}
#wt-side-panel .oa-bottom-search input{flex:1 1 auto;min-width:110px;height:32px;padding:4px 9px;border:1px solid var(--oa-border,#9cd7c5);border-radius:5px;background:#fff;color:var(--oa-text,#173c48);font:inherit}
#wt-side-panel button{font:inherit;border:1px solid transparent;background:transparent;color:var(--oa-primary-dark,#075b50);padding:6px 9px;cursor:pointer;border-radius:4px;white-space:nowrap}
#wt-side-panel .oa-bottom-search button{background:var(--oa-primary,#147c6e);color:white;font-weight:650}
#wt-side-panel button:hover{background:var(--oa-surface-accent,#e0f5eb)}
#wt-side-panel .oa-bottom-search button:hover{background:var(--oa-primary-dark,#075b50)}
body:has(#wt-side-panel){padding-bottom:54px!important}
@media(max-width:640px){#wt-side-panel{position:fixed!important;gap:5px!important;padding:5px 8px!important}#wt-side-panel .oa-bottom-brand{font-size:12px}#wt-side-panel .oa-bottom-search{flex-basis:180px}#wt-side-panel button{padding:5px 6px}}
`;document.head.append(css);
const btn=document.createElement('button');btn.id='wt-side-toggle';btn.hidden=true;
const panel=document.createElement('nav');panel.id='wt-side-panel';panel.setAttribute('aria-label','OpenApuri');document.body.append(panel);
const label=(tag,text)=>{const a=document.createElement(tag);a.textContent=text;return a};

const OA_LOGO='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriLogo.png';
const OA_PREFS_KEY='openapuri.modules.v1';
const OA_MODULES=[
 ['general','Yleiset','Kaikkien moduulien yhteiset asetukset'],
 ['progress','Opintoseuranta','Ryhmänohjaajan opintoseuranta'],
 ['search','OpiskelijaHaku','Opiskelijoiden ja henkilökunnan haku'],
 ['templates','Viestipohjat','Viestipohjien muokkaaminen'],
 ['seating','Istumajärjestys','Pöytäjärjestykset, arvonta ja yhdistelmäryhmät'],
 ['draftsChrome','Viestiluonnokset · Chrome','Viestien tallennus tietokoneella'],
 ['draftsAndroid','Viestiluonnokset · Android','Viestien tallennus Firefox Androidissa'],
 ['toolbar','Työkalupalkki','Wilman OpenApuri-toiminnot']
];
const oaRead=()=>{try{return JSON.parse(localStorage.getItem(OA_PREFS_KEY)||'{}')||{}}catch{return {}}};
const oaWrite=(id,value)=>{const d=oaRead();d[id]=value;localStorage.setItem(OA_PREFS_KEY,JSON.stringify(d))};
const oaGlobal=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
const oaElement=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const oaStyle=document.createElement('style');
oaStyle.textContent=`

#oa-module-menu[hidden],#oa-groups-list[hidden]{display:none!important}
#oa-module-menu{position:fixed;z-index:2147483500;display:flex;flex-direction:column;width:220px;max-width:calc(100vw - 16px);padding:6px;border:1px solid var(--oa-border);border-radius:7px;background:var(--oa-surface);box-shadow:0 8px 24px #0003}
#oa-module-menu a,#oa-module-menu button{display:block;width:100%;padding:9px;border:0;border-radius:4px;background:transparent;text-align:left;text-decoration:none;color:var(--oa-primary-dark);cursor:pointer;font:13px system-ui}
#oa-module-menu a:hover,#oa-module-menu button:hover{background:var(--oa-surface-accent)}
#wt-side-panel .oa-bottom-groups{position:relative;flex:0 0 auto}
#wt-side-panel .oa-groups-popup{position:absolute;bottom:calc(100% + 8px);left:0;z-index:2147483490;width:min(300px,85vw);max-height:min(420px,65vh);overflow:auto;padding:6px;border:1px solid var(--oa-border);border-radius:7px;background:var(--oa-surface);box-shadow:0 -8px 24px #0003}
#wt-side-panel .oa-groups-popup a{display:block;padding:8px;color:var(--oa-primary-dark);text-decoration:none;border-radius:4px}
#wt-side-panel .oa-groups-popup a:hover{background:var(--oa-surface-accent)}
#wt-side-panel .oa-groups-popup p{margin:6px}
#oa-dialog .oa-template-field{display:flex;flex-direction:column;gap:4px;margin:10px 0}
#oa-dialog .oa-template-field input,#oa-dialog .oa-template-field select,#oa-dialog .oa-template-field textarea{padding:8px;border:1px solid var(--oa-border);border-radius:5px;background:white;color:var(--oa-text)}
#oa-dialog .oa-template-actions{display:flex;gap:8px;margin:12px 0}
#oa-dialog .oa-template-actions button{padding:8px;border:1px solid var(--oa-border);border-radius:5px;background:var(--oa-surface-accent);color:var(--oa-primary-dark)}
/* OpenApuri design tokens: edit these values to retheme all OA UI.
   Use var(--oa-*) in existing and future OpenApuri cards, tabs and toolbars. */
:root{
 --oa-navy:#13475e;--oa-teal:#135f67;--oa-primary:#147c6e;
 --oa-primary-dark:#075b50;--oa-mint:#53d3bd;
 --oa-surface:#f5fbf8;--oa-surface-accent:#e0f5eb;
 --oa-border:#9cd7c5;--oa-text:#173c48;--oa-muted:#52716c;
}
/* Shared theme application. Keep native Wilma sprite backgrounds unchanged. */
#oa-dialog .oa-head,#oh-panel>h2,#wt-header{background:var(--oa-surface-accent)!important;color:var(--oa-primary-dark)!important;border-color:var(--oa-border)!important}
#oh-panel,#wt-panel,#oh-home{border-color:var(--oa-primary)!important}
#oh-tab>a,#wt-class-assessment-tab>a,#wt-class-issues-tab>a{color:var(--oa-primary-dark)!important}
#wt-message-library #wt-library-tabs{border-bottom-color:var(--oa-border)!important}
#wt-message-library #wt-library-tabs button{color:var(--oa-primary-dark)!important}
#wt-message-toolbar,#wt-message-library{color:var(--oa-text)!important;background:var(--oa-surface)!important;border-color:var(--oa-border)!important}
#wt-message-toolbar{position:relative!important;padding-right:70px!important;border-left:4px solid var(--oa-primary)!important;border-radius:6px!important}
#wt-message-toolbar [role="tab"],#wt-library-tabs button{color:var(--oa-primary-dark)!important}
#wt-message-toolbar [aria-selected="true"],#wt-library-tabs button[aria-selected="true"]{border-bottom-color:var(--oa-primary)!important;font-weight:700!important}
#wt-message-library{border-left:4px solid var(--oa-primary)!important}
#wt-message-library>.oa-message-header{position:relative!important;display:flex!important;align-items:center!important;min-height:54px!important;margin:-16px -16px 16px!important;padding:10px 70px 10px 16px!important;background:var(--oa-surface-accent)!important;border-bottom:2px solid var(--oa-border)!important;color:var(--oa-primary-dark)!important;font-weight:700!important}
#wt-message-library input,#wt-message-library select,#wt-message-library textarea{border-color:var(--oa-border)!important}
#wt-message-library button:not(.oa-peeker-settings){accent-color:var(--oa-primary)}
#wt-message-toolbar>.oa-message-peeker,#wt-message-library .oa-message-header>.oa-message-peeker{position:absolute!important;display:flex!important;align-items:center!important;justify-content:center!important;right:14px!important;top:auto!important;bottom:-6px!important;width:44px!important;height:46px!important;border:0!important;background:transparent!important;padding:0!important;cursor:pointer!important;z-index:40!important}
#wt-message-toolbar>.oa-message-peeker img,#wt-message-library .oa-message-header>.oa-message-peeker img{display:block!important;width:44px!important;height:46px!important;object-fit:contain!important;pointer-events:none!important}
#wt-message-toolbar>.oa-message-peeker:focus-visible,#wt-message-library .oa-message-header>.oa-message-peeker:focus-visible{outline:2px solid var(--oa-primary)!important;outline-offset:2px!important}
#oa-dialog[hidden]{display:none!important}
#oa-dialog{position:fixed;inset:0;z-index:2147483600;color:#243a4b;font:14px system-ui,sans-serif}
#oa-dialog .oa-shade{position:absolute;inset:0;background:#12263899}
#oa-dialog .oa-window{position:absolute;inset:0;margin:auto;width:min(820px,calc(100vw - 24px));height:min(650px,calc(100vh - 24px));background:white;border-radius:11px;box-shadow:0 12px 56px #0005;display:flex;flex-direction:column;overflow:hidden}
#oa-dialog .oa-head{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:#edf4f9;border-bottom:1px solid #d4e2eb;font-weight:700;font-size:18px}
#oa-dialog button{font:inherit;cursor:pointer}
#oa-dialog .oa-close{border:0;background:transparent;font-size:28px}
#oa-dialog .oa-grid{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0;flex:1}
#oa-dialog .oa-nav{padding:12px;background:#f7f9fb;display:flex;flex-direction:column;gap:5px;border-right:1px solid #dce5ec}
#oa-dialog .oa-nav button{padding:10px;border:0;border-radius:6px;text-align:left;background:transparent;color:#294e68}
#oa-dialog .oa-nav button[aria-current=page]{background:#dcecf7;font-weight:bold}
#oa-dialog .oa-content{padding:22px;overflow:auto}
#oa-dialog .oa-content h2{font-size:21px;margin:0 0 14px}
#oa-dialog .oa-content p{line-height:1.5}
#oa-dialog .oa-content label{display:flex;gap:10px;align-items:center;margin:16px 0}
#oa-dialog .oa-content input[type=checkbox]{width:19px;height:19px}
#oa-dialog .oa-content a{color:#146392}
#oa-dialog .oa-foot{background:#f7fafc;padding:10px 16px;font-size:12px;color:#526c80;border-top:1px solid #dce5ec}
#oa-launcher{display:inline-flex!important;align-items:center!important;vertical-align:middle;justify-content:center!important;border:0!important;background:transparent!important;cursor:pointer;border-radius:0!important;padding:0!important;flex:0 0 auto;line-height:1;height:40px!important;max-height:40px!important;box-sizing:border-box!important}
#oa-launcher:hover,#oa-launcher:focus-visible{background:#ffffff26!important;outline:2px solid #b6e9e0;outline-offset:1px}
#oa-launcher img{display:block!important;width:40px!important;height:40px!important;min-width:0!important;min-height:0!important;max-width:40px!important;max-height:40px!important;object-fit:contain;transform:scale(1.08);transform-origin:center}
#oa-brand-group{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;flex:0 0 auto!important;min-width:max-content;vertical-align:middle;max-height:44px!important;white-space:nowrap}
#oa-brand-group>.navbar-brand,#oa-brand-group>a:not(#oa-launcher){float:none!important;display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;width:max-content!important;min-width:0!important;max-width:none!important;padding-left:4px!important;padding-right:4px!important;margin-left:0!important;margin-right:0!important;box-sizing:border-box!important}
#oa-brand-group>.navbar-brand img,#oa-brand-group>a:not(#oa-launcher) img{max-height:40px!important;width:auto!important;object-fit:contain}
#oa-brand-group{padding:0!important;margin:0!important}
#oa-brand-group #oa-launcher{margin-left:0!important;margin-right:0!important}
/* Tighten the logo area's inherited grid spacing, not the other native navbar items. */
#oa-brand-group:has(> .navbar-brand){margin-left:0!important}
.oa-active-header{background:#135a63!important;background-image:linear-gradient(105deg,#13475e,#135f67)!important;box-shadow:inset 0 -4px #53d3bd!important}
.oa-active-header #oa-brand-group{background:transparent!important}
#oa-dialog .oa-head{background:#e6f5f1!important;border-bottom:3px solid #168b80!important}
#oa-dialog .oa-nav button[aria-current=page]{background:#d8f4e9!important;color:#075b50!important}
#wt-side-panel{border-top:3px solid #26a899!important;background:#f0faf6!important}
#wt-message-toolbar{border-left:5px solid #168b80!important;background:#edf8f4!important}
#oh-home{border:2px solid #238d83!important;background:#fcfffd!important;box-shadow:0 3px 12px #066a5920!important}
#oh-home>.panel-heading{background:#e0f5eb!important;color:#075b50!important;border-bottom:2px solid #9cd7c5!important}
#oh-panel{border:2px solid #238d83!important;border-radius:8px!important;background:#f9fffc!important;padding:14px!important}
#oh-panel>h2{background:#e0f5eb!important;color:#075b50!important;margin:-14px -14px 12px!important;padding:13px 16px!important;border-bottom:2px solid #9cd7c5!important}
/* Native Wilma sprite geometry and green active outline remain untouched.
   A small mint marker inside the tab distinguishes OpenApuri from native tabs.
   Never tint the link/pseudo-element backgrounds: sprite transparency would
   reveal a rectangular block outside the sloped silhouette. */
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab>a{color:#096b5c!important;font-weight:600!important}
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab>a:hover{color:#075b50!important}
ul.nav-tabs.nav-tabs-primary>li.oa-added-tab.active>a{color:#096b5c!important}
/* The monkey peeks from the lower edge of the active OpenApuri content header.
   Never put it in a tab, so inactive tabs cannot display monkeys. */
#oh-panel>h2,#wt-panel>#wt-header{position:relative!important;overflow:visible!important}
#oh-panel>h2>.oa-peeker-settings,#wt-header>.oa-peeker-settings{position:absolute!important;right:18px!important;bottom:-6px!important;top:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;width:45px!important;height:46px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;cursor:pointer!important;z-index:40!important}
#oh-panel>h2>.oa-peeker-settings img,#wt-header>.oa-peeker-settings img{display:block!important;width:45px!important;height:46px!important;object-fit:contain!important;pointer-events:none!important}
#oh-panel>h2>.oa-peeker-settings:hover,#wt-header>.oa-peeker-settings:hover{transform:translateY(-2px)!important}
#oh-panel>h2>.oa-peeker-settings:focus-visible,#wt-header>.oa-peeker-settings:focus-visible{outline:2px solid #087266!important;outline-offset:1px!important}
#wt-panel{border:2px solid #238d83!important}
#wt-header{background:#e0f5eb!important;color:#075b50!important;border-bottom:2px solid #9cd7c5!important}
#oh-panel .oh-recipient-panel{background:#eaf8f2!important;border:1px solid #7bbdaa!important}
#oh-panel .oh-action{background:#147c6e!important;color:#fff!important;border-color:#147c6e!important}
#wt-message-library{border-left:4px solid #168b80!important}
@media(max-width:600px){#oa-launcher{height:36px!important;max-height:36px!important}#oa-launcher img{width:36px!important;height:36px!important;max-width:36px!important;max-height:36px!important}#oa-brand-group{gap:2px!important}}
@media(max-width:600px){#oa-dialog .oa-grid{display:flex;flex-direction:column}#oa-dialog .oa-nav{flex-direction:row;overflow:auto;flex-shrink:0;border-right:0;border-bottom:1px solid #dce5ec}#oa-dialog .oa-nav button{white-space:nowrap}}
`;
document.head.append(oaStyle);
const oaDialog=oaElement('div');oaDialog.id='oa-dialog';oaDialog.hidden=true;
oaDialog.innerHTML='<div class="oa-shade"></div><section class="oa-window" role="dialog" aria-modal="true" aria-label="OpenApurin asetukset"><header class="oa-head"><span>OpenApuri · Asetukset</span><button class="oa-close" type="button" aria-label="Sulje">×</button></header><div class="oa-grid"><nav class="oa-nav" aria-label="Moduulien asetukset"></nav><div class="oa-content" tabindex="-1"></div></div><footer class="oa-foot">Asetukset tallentuvat Wilman selaintallennukseen. Muutokset tulevat voimaan viimeistään sivun päivityksen jälkeen.</footer></section>';
document.body.append(oaDialog);
let oaReturnFocus=null;

function oaTemplateSettings(main){
 const records=templates();let index=-1;
 const select=oaElement('select'),name=oaElement('input'),subject=oaElement('input'),body=oaElement('textarea');
 name.placeholder='Viestipohjan nimi';subject.placeholder='Aihe';body.placeholder='Viestin sisältö';body.rows=9;
 const field=(text,control)=>{const l=oaElement('label');l.className='oa-template-field';l.append(oaElement('span',text),control);main.append(l)};
 field('Viestipohja',select);field('Nimi',name);field('Aihe',subject);field('Viesti',body);
 const status=oaElement('p');
 function pick(i){index=i;const v=records[i]||{title:'',subject:'',body:''};name.value=v.title;subject.value=v.subject;body.value=v.body}
 function refresh(){select.replaceChildren();const blank=oaElement('option','Uusi pohja');blank.value='-1';select.append(blank);records.forEach((v,i)=>{const op=oaElement('option',v.title);op.value=String(i);select.append(op)});select.value=String(index)}
 select.onchange=()=>pick(Number(select.value));
 const actions=oaElement('div');actions.className='oa-template-actions';
 const save=oaElement('button','Tallenna'),del=oaElement('button','Poista'),fresh=oaElement('button','Uusi');
 for(const b of [save,del,fresh]){b.type='button';actions.append(b)}main.append(actions,status);
 save.onclick=()=>{
  if(!name.value.trim()||!subject.value.trim()){status.textContent='Anna nimi ja aihe.';return}
  const item={...(records[index]||{category:'Yleinen',recipientRule:'ei_valintaa',messageMode:'group'}),title:name.value.trim().slice(0,120),subject:subject.value.trim().slice(0,250),body:body.value};
  if(index<0){if(records.length>=150){status.textContent='Enintään 150 pohjaa.';return}index=records.length;records.push(item)}else records[index]=item;
  localStorage.setItem(TEMPLATE_KEY,JSON.stringify(records));refresh();status.textContent='Tallennettu';
 };
 del.onclick=()=>{if(index<0||!confirm('Poistetaanko pohja?'))return;records.splice(index,1);localStorage.setItem(TEMPLATE_KEY,JSON.stringify(records));pick(-1);refresh();status.textContent='Poistettu'};
 fresh.onclick=()=>{pick(-1);refresh();status.textContent=''};
 pick(-1);refresh();
}

function oaRender(id){
 const nav=oaDialog.querySelector('.oa-nav'),main=oaDialog.querySelector('.oa-content');
 nav.replaceChildren();main.replaceChildren();
 for(const [key,title]of OA_MODULES){
  const button=oaElement('button',title);button.type='button';
  if(key===id)button.setAttribute('aria-current','page');
  button.onclick=()=>oaRender(key);nav.append(button);
 }
 const entry=OA_MODULES.find(x=>x[0]===id)||OA_MODULES[0];
 main.append(oaElement('h2',entry[1]),oaElement('p',entry[2]));
 const labeledToggle=(key,txt,checked,onchange)=>{
  const label=oaElement('label'),input=oaElement('input');input.type='checkbox';
  input.checked=checked;input.onchange=()=>onchange(input.checked);
  label.append(input,oaElement('span',txt));main.append(label);
 };
 const link=(txt,url)=>{
  const a=oaElement('a',txt);a.href=url;a.target='_blank';a.rel='noopener noreferrer';main.append(a);
 };
 const launch=(txt,url,moduleId)=>{
  const button=oaElement('button',txt);button.type='button';
  button.style.cssText='background:#176393;color:#fff;border:0;border-radius:6px;padding:10px 15px;margin:5px 0 12px;cursor:pointer;font-weight:600';
  button.onclick=()=>{
    if(moduleId&&oaRead()[moduleId]===false)oaWrite(moduleId,true);
    // Same-tab navigation is intentional: this is a module launcher.
    location.assign(url);
  };
  main.append(button);
 };
 if(id==='templates'){oaTemplateSettings(main);main.focus();return}
 if(id==='general'){
  const label=oaElement('label','Kieli');
  const select=oaElement('select');
  for(const [key,title]of [['fi','Suomi'],['en','English']]){
   const op=oaElement('option',title);op.value=key;select.append(op);
  }
  select.value=oaGlobal().lang==='en'?'en':'fi';
  select.onchange=()=>{lang=select.value;localStorage.setItem(KEY,JSON.stringify({...oaGlobal(),lang}));draw()};
  label.append(select);main.append(label);
 }else{
  if(id!=='toolbar')labeledToggle(id,'Moduuli käytössä',oaRead()[id]!==false,v=>oaWrite(id,v));
  if(id==='progress'){
   labeledToggle('progressEnabled','Opintoseuranta aktiivinen',oaGlobal().enabled!==false,v=>localStorage.setItem(KEY,JSON.stringify({...oaGlobal(),enabled:v})));
   main.append(oaElement('p','Opintoseurannan asetukset ja piilotettujen opintojaksojen valinnat säilyvät paikallisesti.'));
   launch('Avaa ryhmäluettelo','/groups','progress');
  }
  if(id==='seating'){
   const row=oaElement('label','Ryhmäni-valikon oletusvälilehti');row.className='oa-template-field';
   const select=oaElement('select');for(const [key,title]of OA_GROUP_VIEWS){const opt=oaElement('option',title);opt.value=key;select.append(opt)}
   select.value=localStorage.getItem(OA_GROUP_PREF)||'seating';
   select.onchange=()=>localStorage.setItem(OA_GROUP_PREF,select.value);
   row.append(select);main.append(row);
   const groupMatch=location.pathname.match(/^\/groups\/(\d+)(?:\/|$)/);
   launch('Avaa istumajärjestys',groupMatch?'/groups/'+groupMatch[1]+'/seating':'/groups','seating');
   main.append(oaElement('p','Istumajärjestykset ovat osa OpenApuria. Ryhmäkohtainen näkymä löytyy Wilman ryhmäsivulta.'));
  }
  if(id==='search'){
   launch('Avaa OpiskelijaHaku Wilmassa','/profiles/students/#opiskelijahaku','search');
   main.append(oaElement('p','Haku avautuu suoraan Wilman opiskelijaluettelossa. Jos OpiskelijaHaku on poistettu käytöstä vain OpenApurin asetuksista, painike ottaa sen samalla takaisin käyttöön.'));
  }
  if(id==='draftsChrome'||id==='draftsAndroid'){
   main.append(oaElement('p','Luonnosten automaattitallennus on käytössä, kun tämä moduuli on käytössä. Muutos vaatii sivun päivityksen.'));
   main.append(oaElement('p','Luonnoksia muokataan Wilman viestikirjastossa. Niitä ei lähetetä erilliselle palvelimelle.'));
   launch('Avaa viestinkirjoitus','/messages/compose',id);
  }
  if(id==='toolbar')main.append(oaElement('p','OpenApurin alapalkki ja haku näkyvät kaikilla Wilman sivuilla.'));
 }
 main.focus();
}
function oaOpen(tab='general'){
 if(oaDialog.hidden)oaReturnFocus=document.activeElement;
 oaDialog.hidden=false;oaRender(tab);
 oaDialog.querySelector('.oa-close').focus();
}
function oaClose(){oaDialog.hidden=true;oaReturnFocus?.focus?.()}
oaDialog.querySelector('.oa-close').onclick=oaClose;
oaDialog.querySelector('.oa-shade').onclick=oaClose;
oaDialog.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();oaClose()}
 if(e.key==='Tab'){
  const focusables=[...oaDialog.querySelectorAll('button,a[href],select,input')].filter(el=>el.getClientRects().length);
  if(!focusables.length)return;
  if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables[focusables.length-1].focus()}
  else if(!e.shiftKey&&document.activeElement===focusables[focusables.length-1]){e.preventDefault();focusables[0].focus()}
 }
});
window.addEventListener('openapuri:open-settings',e=>oaOpen(e.detail?.tab||'general'));
const oaLauncher=oaElement('button');oaLauncher.id='oa-launcher';oaLauncher.type='button';oaLauncher.title='OpenApuri · Asetukset';
oaLauncher.setAttribute('aria-label','Avaa OpenApurin asetukset');
const oaImg=oaElement('img');oaImg.alt='OpenApuri';oaImg.src=OA_LOGO;oaLauncher.append(oaImg);

const oaModulePopup=oaElement('div');oaModulePopup.id='oa-module-menu';oaModulePopup.hidden=true;document.body.append(oaModulePopup);
const oaMenuItems=[['Haku','/profiles/students/#opiskelijahaku'],['Ryhmäni','/groups'],['Istumajärjestys','/groups'],['Arviointinäkymä','/groups'],['Viestit','/messages'],['Kirjoita viesti','/messages/compose']];
function oaCloseMenu(){oaModulePopup.hidden=true;oaLauncher.setAttribute('aria-expanded','false')}
function oaToggleMenu(){
 if(!oaModulePopup.hidden){oaCloseMenu();return}
 oaModulePopup.replaceChildren();
 const groupId=location.pathname.match(/^\/groups\/(\d+)(?:\/|$)/)?.[1];
 for(const [name,href]of oaMenuItems){
  const a=oaElement('a',name);a.href=groupId&&name==='Istumajärjestys'?'/groups/'+groupId+'/seating':href;oaModulePopup.append(a);
 }
 const settings=oaElement('button','Asetukset');settings.type='button';settings.onclick=()=>{oaCloseMenu();oaOpen()};oaModulePopup.append(settings);
 const r=oaLauncher.getBoundingClientRect();
 oaModulePopup.style.top=Math.min(r.bottom+5,innerHeight-255)+'px';oaModulePopup.style.left=Math.max(8,Math.min(r.left,innerWidth-234))+'px';
 oaModulePopup.hidden=false;oaLauncher.setAttribute('aria-expanded','true');
}
oaLauncher.setAttribute('aria-haspopup','menu');oaLauncher.setAttribute('aria-expanded','false');
oaLauncher.onclick=e=>{e.stopPropagation();oaToggleMenu()};
document.addEventListener('click',e=>{if(!oaModulePopup.hidden&&!oaModulePopup.contains(e.target)&&e.target!==oaLauncher)oaCloseMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')oaCloseMenu()});

function markActiveHeader(logo){
  // Color only the original top branding bar, leaving native content unchanged.
  let bar=logo.closest('header,nav.navbar,.navbar,#header,[role="banner"],.header');
  if(!bar)bar=logo.parentElement;
  let candidate=bar;
  for(let step=0;candidate&&step<5;step++,candidate=candidate.parentElement){
    if(candidate===document.body)break;
    if(candidate.getBoundingClientRect().width>=window.innerWidth*.72){bar=candidate;break}
  }
  if(bar&&bar!==document.body&&bar!==document.documentElement)bar.classList.add('oa-active-header');
}
function placeLauncher(){
  const logo=document.querySelector('header .navbar-brand,nav .navbar-brand,.navbar-header .navbar-brand,header a.brand,#header .logo,.navbar-brand');
  if(!logo)return false;
  // Find the visible Viestit/Messages navigation entry. The logos belong between
  // this entry and the application grid, not in the original branding column.
  const root=logo.closest('header,nav.navbar,.navbar,#header,[role="banner"],.header')||document.querySelector('header,nav.navbar,.navbar');
  if(!root)return false;
  const visible=el=>!!(el.getClientRects().length);
  const matches=[...root.querySelectorAll('a,button,[role="menuitem"]')].filter(el=>
    visible(el)&&/^(?:Viestit|Messages)(?:\s*\(\d+\))?$/i.test((el.textContent||'').trim()));
  // Some Wilma layouts place messages in a separate navbar node.
  const message=matches[0]||[...document.querySelectorAll('header a,nav a,.navbar a')].find(el=>
    visible(el)&&/^(?:Viestit|Messages)(?:\s*\(\d+\))?$/i.test((el.textContent||'').trim()));
  if(!message)return false;
  const navbar=message.closest('.navbar-nav,ul.nav,nav,header,.navbar,[role="navigation"]')||message.parentElement;
  if(!navbar)return false;
  // Insert immediately after the top-level messages item, preserving the native
  // nine-square app menu and avoiding changes to its click handlers.
  let item=message;
  while(item.parentElement&&item.parentElement!==navbar)item=item.parentElement;
  if(item===navbar||!item.parentElement)return false;
  let group=document.getElementById('oa-brand-group');
  if(!group){
    group=document.createElement(navbar.tagName==='UL'||navbar.tagName==='OL'?'li':'span');
    group.id='oa-brand-group';
  }
  item.before(group);
  group.append(logo);
  group.append(oaLauncher);
  oaLauncher.style.cssText='';
  markActiveHeader(group);
  return true;
}
if(!placeLauncher()){
  oaLauncher.style.cssText='position:fixed;top:8px;right:12px;background:#135a63;z-index:2147483000;border:1px solid #c6d8e3';
  document.body.append(oaLauncher);
  let tries=0;
  const interval=setInterval(()=>{if(placeLauncher()||++tries>30)clearInterval(interval)},500);
}

const savedGrade=()=>{const value=localStorage.getItem(lastKey)||'';return /^\/profiles\/students\/\d+\/choices(?:\/?|\/?\?.*)$/.test(value)?value:null};
const route=()=>grade.test(location.pathname)?location.pathname+'?view=gradebook':savedGrade();
function linkProgress(){if(/^\/profiles\/classes\/\d+\/?$/.test(location.pathname)){document.querySelector('#wt-class-assessment-tab a')?.click();return}location.assign('/')}

const TEMPLATE_KEY='openapuri.messageTemplates.v1';
function templates(){try{const a=JSON.parse(localStorage.getItem(TEMPLATE_KEY)||'[]');return Array.isArray(a)?a.filter(v=>v&&typeof v.title==='string'&&typeof v.subject==='string'&&typeof v.body==='string').slice(0,50):[]}catch{return []}}
function saveTemplates(data){localStorage.setItem(TEMPLATE_KEY,JSON.stringify(data))}
function openMessageLibrary(section){
 if(location.pathname.startsWith('/messages/compose')){
  window.dispatchEvent(new Event('openapuri:open-library'));
  return;
 }
 location.assign('/messages/compose#wt-library'+(section==='templates'?'-templates':''));
}
function templateEditor(){openMessageLibrary('templates')}
function draftSidebar(){openMessageLibrary('drafts')}

const OA_GROUP_PREF='openapuri.groupOpeningTab.v1';
const OA_GROUP_VIEWS=[['seating','Istumajärjestys'],['main','Ryhmän etusivu'],['assessment','Arviointinäkymä'],['issues','Huomiot']];
const oaGroupDestination=id=>{
 const n=encodeURIComponent(id),tab=localStorage.getItem(OA_GROUP_PREF)||'seating';
 return tab==='main'?'/groups/'+n:tab==='assessment'?'/profiles/classes/'+n+'/#wt-assessment':tab==='issues'?'/profiles/classes/'+n+'/#wt-issues':'/groups/'+n+'/seating';
};
let oaGroupsCache=null,oaGroupsFetch=null;
async function oaGetGroups(){
 if(oaGroupsCache)return oaGroupsCache;
 if(oaGroupsFetch)return oaGroupsFetch;
 oaGroupsFetch=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/groups',{credentials:'same-origin',signal:controller.signal});
   const url=new URL(response.url);
   if(!response.ok||url.origin!==location.origin||url.pathname!=='/groups'&&url.pathname!=='/groups/')throw Error('Ryhmäsivun lataus epäonnistui');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');
   const groups=new Map();
   for(const a of doc.querySelectorAll('main a[href],#main-content a[href]')){
    const dest=new URL(a.getAttribute('href'),location.origin),m=dest.origin===location.origin&&dest.pathname.match(/^\/groups\/(\d+)(?:\/|$)/);
    const name=(a.textContent||'').replace(/\s+/g,' ').trim();
    if(m&&name&&name.length<110&&!groups.has(m[1]))groups.set(m[1],{id:m[1],name});
   }
   oaGroupsCache=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));return oaGroupsCache;
  }finally{clearTimeout(timer)}
 })();
 try{return await oaGroupsFetch}finally{oaGroupsFetch=null}
}
async function oaFillGroups(box){
 box.replaceChildren();box.append(label('p','Haetaan opetusryhmiä…'));
 try{
  const groups=await oaGetGroups();
  if(!box.isConnected)return;
  box.replaceChildren();
  if(!groups.length)box.append(label('p','Opetusryhmiä ei löytynyt.'));
  for(const g of groups){const a=label('a',g.name);a.href=oaGroupDestination(g.id);box.append(a)}
  const all=label('a','Kaikki ryhmät');all.href='/groups';box.append(all);
 }catch(e){box.replaceChildren();const a=label('a','Avaa ryhmäluettelo');a.href='/groups';box.append(a)}
}

function draw(){
 panel.replaceChildren();
 panel.style.display='flex';
 const heading=label('strong','OpenApuri');heading.className='oa-bottom-brand';panel.append(heading);
 const searchForm=label('form','');searchForm.className='oa-bottom-search';
 const searchInput=label('input','');searchInput.type='search';searchInput.name='haku';searchInput.placeholder=lang==='fi'?'Hae opiskelijaa tai henkilökuntaa…':'Search students or staff…';searchInput.setAttribute('aria-label',lang==='fi'?'Haku':'Search');searchInput.autocomplete='off';
 const go=label('button',lang==='fi'?'Haku':'Search');go.type='submit';
 searchForm.append(searchInput,go);
 searchForm.onsubmit=event=>{
  event.preventDefault();
  if(oaRead().search===false)oaWrite('search',true);
  const term=searchInput.value.trim();
  try{sessionStorage.setItem('openapuri.pendingSearch.v1',term)}catch{}
  if(/^\/profiles\/students\/?$/.test(location.pathname)){
   const tab=document.querySelector('#oh-tab>a');tab?.click();
   const input=document.querySelector('#oh-chooser input[type="search"]');
   if(input){input.value=term;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return}
  }
  location.assign('/profiles/students/#opiskelijahaku');
 };
 panel.append(searchForm);
 const groups=label('div','');groups.className='oa-bottom-groups';
 const trigger=label('button',lang==='fi'?'Ryhmäni ▴':'My groups ▴');trigger.type='button';trigger.setAttribute('aria-controls','oa-groups-list');trigger.setAttribute('aria-expanded','false');
 const list=label('div','');list.id='oa-groups-list';list.className='oa-groups-popup';list.hidden=true;
 trigger.onclick=()=>{list.hidden=!list.hidden;trigger.setAttribute('aria-expanded',String(!list.hidden));if(!list.hidden)oaFillGroups(list)};
 groups.append(trigger,list);panel.append(groups);
 const commands=[
  [lang==='fi'?'Kirjoita viesti':'Compose',()=>location.assign('/messages/compose')]
 ];
 for(const [name,fn] of commands){const control=label('button',name);control.type='button';control.onclick=fn;panel.append(control)}
 const settings=label('button',lang==='fi'?'Asetukset':'Settings');settings.type='button';settings.onclick=()=>oaOpen();panel.append(settings);
}
draw();
window.addEventListener('openapuri:open-templates',()=>templateEditor());
window.addEventListener('openapuri:open-drafts',()=>draftSidebar());

function safePath(a){try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin?u.pathname+u.search:null}catch{return null}}
function txt(s){return String(s||'').replace(/\s+/g,' ').trim()}
function makeLink(text,url){const a=label('a',text);a.href=url;a.style.cssText='display:inline-block;margin:2px 12px 3px 0;color:#125f91;text-decoration:underline';return a}
function makeAction(text,fn){const a=label('button',text);a.type='button';a.style.cssText='padding:0;margin:2px 12px 3px 0;border:0;background:transparent;color:#125f91;text-decoration:underline;font:inherit;cursor:pointer;text-align:left';a.onclick=fn;return a}
function getSection(title){
 const h=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(el=>txt(el.textContent).toLowerCase()===title.toLowerCase());if(!h)return null;
 for(let p=h.parentElement;p&&p!==document.body;p=p.parentElement){
  if(p.querySelectorAll('h1,h2,h3,h4,h5,h6').length>1)break;
  if(p.querySelector('a[href]')&&p.getBoundingClientRect().width>180)return p;
 }return h.parentElement;
}
function info(msg){alert(msg)}
async function groupDoc(url){
 const r=await fetch(url,{credentials:'same-origin',redirect:'follow',cache:'no-store'});
 const final=new URL(r.url);
 if(!r.ok||final.origin!==location.origin||!/^\/(?:groups|profiles\/classes)\/\d+(?:\/|$)/.test(final.pathname))throw Error('Ryhmäsivun haku epäonnistui');
 return new DOMParser().parseFromString(await r.text(),'text/html');
}
function studentNames(doc){
 const found=new Map();
 for(const a of doc.querySelectorAll('a[href]')){
   const href=safePath(a);const match=href&&href.match(/^\/profiles\/students\/(\d+)(?:\/|$|\?)/);
   const name=txt(a.textContent);
   if(match&&name&&name.length<120&&!found.has(match[1]))found.set(match[1],name);
 }
 return [...found.values()].sort((a,b)=>a.localeCompare(b,'fi'));
}
async function copyStudents(url){
 try{
  const names=studentNames(await groupDoc(url));
  if(!names.length)return info(lang==='fi'?'Opiskelijalinkkejä ei löydy ryhmäsivun HTML:stä.':'Student links were not found in the group page HTML.');
  const value=names.join('\n');
  try{await navigator.clipboard.writeText(value);info((lang==='fi'?'Kopioitu opiskelijaa: ':'Students copied: ')+names.length)}
  catch{prompt(lang==='fi'?'Kopioi nimilista':'Copy student names',value)}
 }catch(e){info(e.message)}
}
function groupMessageLinks(doc){
 const candidates={students:new Set(),guardians:new Set(),both:new Set(),group:new Set()};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);
  if(!path||!path.startsWith('/messages/compose'))continue;
  const name=txt(a.textContent).toLocaleLowerCase('fi');
  const single=/opiskelijalle|oppilaalle|huoltajalle|yksittäiselle|single student|single guardian|single parent/i.test(name);
  if(single)continue;
  // Student-specific rows frequently contain actions named "Viesti opiskelijoille".
  // Those actions must not be mistaken for class-wide Wilma links.
  const row=a.closest('tr,li,.student,.student-row');
  if(row&&row.querySelector('a[href*="/profiles/students/"]'))continue;
  const student=/opiskelijoille|opiskelijat|oppilaille|students\b/i.test(name);
  const guardian=/huoltajille|huoltajat|guardians\b|parents\b/i.test(name);
  if(student&&guardian)candidates.both.add(path);
  else if(student)candidates.students.add(path);
  else if(guardian)candidates.guardians.add(path);
  else if(/viesti ryhmälle|message group/i.test(name))candidates.group.add(path);
 }
 const links={students:null,guardians:null,both:null,group:null};
 for(const type of Object.keys(links)){
  const options=[...candidates[type]];
  // Several different recipient URLs for the same action = ambiguous.
  if(options.length===1)links[type]=options[0];
 }
 const groups=['students','guardians','both'];
 for(const type of groups){
  if(links[type]&&groups.some(other=>other!==type&&links[other]===links[type]))links[type]=null;
 }
 return links;
}
async function groupMessage(url,type){
 const match=String(url||'').match(/\/profiles\/classes\/(\d+)\/?/);
 if(match&&['students','guardians','both'].includes(type)){
  const params=new URLSearchParams();
  if(type==='students'||type==='both')params.set('r_class',match[1]);
  if(type==='guardians'||type==='both')params.set('r_classguardian',match[1]);
  location.assign('/messages/compose?'+params.toString());return;
 }
 try{
  const links=groupMessageLinks(await groupDoc(url)),target=links[type]||(type==='group'?links.group:null);
  if(target)location.assign(target);
  else info('Ryhmän viestilinkkiä ei löytynyt. Vastaanottajia ei valittu.');
 }catch(e){info(e.message)}
}
function gradingLinks(doc){
 const found={grading:null,attendance:null};
 for(const a of doc.querySelectorAll('a[href]')){
  const path=safePath(a);if(!path)continue;
  if(/\/grading\/?(?:\?|$)/.test(path))found.grading=path;
  if(/\/attendance_edit\/?(?:\?|$)/.test(path))found.attendance=path;
 }return found;
}
function compactBlock(){const block=document.createElement('div');block.className='wt-inline-tools';block.style.cssText='margin:5px 0 4px;padding:6px 0;border-top:1px solid #dfe8ee;font:13px/1.5 system-ui';return block}
async function openHomeroomGrades(groupUrl){location.assign(groupUrl)}
function improveHomeroomLayout(home,tools,groupUrl){
 if(home.dataset.wtLayout==='yes')return;
 const heading=[...home.querySelectorAll('h1,h2,h3,h4,h5,h6')].find(h=>txt(h.textContent)==='Ohjausryhmäsi');
 const classLink=[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(!heading||!classLink)return;
 const links=[...home.querySelectorAll('a[href]')].filter(a=>!a.closest('#wt-home-tools'));
 const attendance=links.find(a=>/\/attendance_edit\/?(?:\?|$)/.test(safePath(a)||'')||/^Tuntimerkinnät$/i.test(txt(a.textContent)));
 const extras=links.filter(a=>a!==attendance&&/viikoittain|viikottain|yhteenvetona/i.test(txt(a.textContent)));
 const pending=links.find(a=>/^\/profiles\/classes\/\d+\/pending\/?(?:\?|$)/.test(safePath(a)||''));
 const layout=document.createElement('div');layout.id='wt-home-layout';layout.style.cssText='display:grid!important;grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr)!important;gap:10px;align-items:start;margin:5px 0;width:100%;box-sizing:border-box';
 const left=document.createElement('div');left.style.cssText='min-width:0;display:flex;flex-direction:column;gap:6px';
 const top=document.createElement('div');top.style.cssText='display:flex;flex-wrap:wrap;align-items:baseline;gap:12px';
 const classLine=classLink.closest('h6')||classLink.parentElement;
 classLink.style.cssText='font:600 18px/1.3 system-ui,sans-serif;color:#155d92;text-decoration:underline';
 const copy=tools.querySelector('button');if(copy)top.append(copy);
 left.append(top);
 const right=document.createElement('div');right.style.cssText='min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding-left:10px;border-left:1px solid #e2e8ed';
 const grade=makeAction(lang==='fi'?'▣  Arviointinäkymä':'▣  Grade overview',()=>openHomeroomGrades(groupUrl));
 grade.style.cssText='font-weight:700;font-size:16px;color:#125a90;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer';
 right.append(grade);
 if(attendance){
  const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%';
  attendance.style.cssText='font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:5px';
  const ico=label('span','▤');ico.setAttribute('aria-hidden','true');ico.style.cssText='font:18px/1 system-ui;color:#155d92;text-decoration:none';attendance.prepend(ico);
  line.append(attendance);
  if(pending){
    const pendingContainer=pending.parentElement;
    pending.style.cssText='display:inline-block;float:none!important;margin:0!important;font-size:12px!important;white-space:nowrap';
    line.append(pending);
    if(pendingContainer&&pendingContainer.classList.contains('pull-right')){pendingContainer.style.display='none';const emptyRow=pendingContainer.parentElement;if(emptyRow&&emptyRow.matches('.margin-bottom.clearfix')&&!emptyRow.textContent.trim())emptyRow.style.display='none';}
  }
  right.append(line);
 }
 if(extras.length){const details=document.createElement('details');details.style.cssText='font-size:12px;color:#637789';const summary=label('summary',lang==='fi'?'Muut tuntimerkintänäkymät':'Other attendance views');details.append(summary);for(const a of extras){a.style.cssText='display:inline-block;margin:5px 9px 0 0;font-size:12px';details.append(a)}right.append(details)}
 const messages=tools.querySelector('div');if(messages){messages.style.cssText='display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center';left.append(messages)}
 layout.append(left,right);
 // Remove empty wrappers from Wilma's original layout after moving their links.
 if(classLine&&classLine!==heading&&classLine.parentElement)classLine.remove();
 heading.style.cssText='display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:5px';
 heading.append(classLink);
 tools.replaceChildren(layout);
 heading.insertAdjacentElement('afterend',tools);
 // Use a predictable full-width grid regardless of Wilma's original block styles.
 tools.style.display='block';tools.style.width='100%';
 console.info('[OpenApuri] Homeroom two-column layout v0.15.0 applied');
 tools.style.cssText='border:0;margin:0;padding:0;font:15px/1.4 system-ui';
 for(const a of tools.querySelectorAll('button,a')){if(!a.classList.contains('badge')){a.style.fontSize='15px';a.style.lineHeight='1.4'}}
 const style=document.createElement('style');style.textContent='#wt-home-tools button,#wt-home-tools a:not(.badge),#wt-course-links button,#wt-course-links a{font-family:system-ui,sans-serif!important;font-size:15px!important;line-height:1.45!important}#wt-course-links{font:15px/1.45 system-ui,sans-serif!important}#wt-home-tools .badge{font-size:12px!important}@media(max-width:560px){#wt-home-layout{grid-template-columns:1fr!important}#wt-home-layout>div:nth-child(2){border-left:0!important;border-top:1px solid #e2e8ed;padding:10px 0 0!important}}';home.append(style);
 home.dataset.wtLayout='yes';
}
function attachHome(){
 const home=getSection('Ohjausryhmäsi'),period=getSection('Ryhmät tässä jaksossa');
 const classAnchor=home&&[...home.querySelectorAll('a[href]')].find(a=>/^\/profiles\/classes\/\d+\/?$/.test(safePath(a)||''));
 if(home&&classAnchor&&!home.querySelector('#wt-home-tools')){
  const url=safePath(classAnchor),tools=compactBlock();tools.id='wt-home-tools';
  // Original class title remains the navigable Wilma link.
  // Open the current teacher's actual homeroom; do not reuse an unrelated last student.
  tools.append(makeAction(lang==='fi'?'Kopioi opiskelijalista':'Copy student list',()=>copyStudents(url)));
  const messages=document.createElement('div');
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille':'Message students',()=>groupMessage(url,'students')));
  messages.append(makeAction(lang==='fi'?'Viesti huoltajille':'Message guardians',()=>groupMessage(url,'guardians')));
  messages.append(makeAction(lang==='fi'?'Viesti opiskelijoille ja huoltajille':'Message students and guardians',()=>groupMessage(url,'both')));
  tools.append(messages);home.append(tools);
 }
 if(home&&classAnchor&&home.querySelector('#wt-home-tools')&&home.dataset.wtLayout!=='yes'){
  improveHomeroomLayout(home,home.querySelector('#wt-home-tools'),safePath(classAnchor));
 }
 if(!period)return;
 // Preserve every native Wilma course row, title, icon and link unchanged.
 // Add only an envelope icon after the existing action icons, once per group.
 const groups=new Map();
 for(const anchor of period.querySelectorAll('a[href]')){
   const href=safePath(anchor);
   if(href&&/^\/(?:groups|profiles\/classes)\/\d+\/?$/.test(href)&&!groups.has(href))groups.set(href,anchor);
 }
 for(const [groupUrl,anchor]of groups){
   let container=anchor.parentElement;
   let icons=null;
   for(let level=0;level<6&&container&&container!==period;level++,container=container.parentElement){
     const candidates=[...container.querySelectorAll('div,span,ul')].filter(el=>{
       if(el.querySelector('#wt-group-mail'))return false;
       const actions=[...el.querySelectorAll('a[href]')].filter(a=>a!==anchor&&(a.querySelector('svg,i,[class*="icon"]')||a.children.length===0&&!txt(a.textContent)));
       return actions.length>=3&&actions.length<=6&&el.querySelectorAll('a[href]').length<=8;
     });
     if(candidates.length){icons=candidates.sort((x,y)=>x.querySelectorAll('a[href]').length-y.querySelectorAll('a[href]').length)[0];break}
   }
   if(!icons||icons.querySelector('[data-wt-group-mail]'))continue;
   const mail=document.createElement('button');mail.type='button';mail.dataset.wtGroupMail='yes';
   mail.setAttribute('aria-label',lang==='fi'?'Viesti ryhmälle':'Message group');
   mail.title=lang==='fi'?'Viesti ryhmälle':'Message group';
   mail.style.cssText='display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;padding:0 3px;margin:0;border:0;background:transparent;color:#0096d6;cursor:pointer';
   mail.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
   mail.onclick=()=>groupMessage(groupUrl,'group');
   icons.append(mail);
 }

}
function swapTwoHomepageBoxes(){
 const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 const byTitle=t=>headings.find(h=>txt(h.textContent)===t);
 const notices=byTitle('Ilmoitukset'),groups=byTitle('Ryhmät tässä jaksossa');
 if(!notices||!groups)return;
 // Only swap two boxes sharing the same immediate parent. Never move a whole column or timetable.
 function card(h){
  for(let p=h;p&&p.parentElement&&p!==document.body;p=p.parentElement){
   if(p===document.body||p.contains(notices)&&p.contains(groups))break;
   if(p.matches('.panel,.card,.well,.widget,.box,.dashboard-widget'))return p;
  }
  return null;
 }
 const a=card(notices),b=card(groups);
 if(!a||!b||a===b||a.parentElement!==b.parentElement)return;
 if(b.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING){
  // Groups currently after notices: move just the groups box before notices.
  a.before(b);
 }
}



function oaMessagePeeker(host){
 if(!host||host.querySelector(':scope > .oa-message-peeker'))return;
 host.style.position='relative';
 const button=document.createElement('button');button.type='button';button.className='oa-message-peeker';
 button.title='OpenApuri · Viestiasetukset';button.setAttribute('aria-label','Avaa viestityökalujen asetukset');
 const img=document.createElement('img');img.src='https://raw.githubusercontent.com/ljrant/OpenApuri/main/OpenApuriPeeker.png';img.alt='';
 button.append(img);
 button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent('openapuri:open-settings',{detail:{tab:'draftsChrome'}}))});
 host.prepend(button);
}
function installUnifiedMessageBar(){
 if(!/^\/messages\/(?:compose(?:\/)?|\d+\/?)$/.test(location.pathname))return;
 const main=document.querySelector('main#main-content');
 if(!main||document.getElementById('wt-message-toolbar'))return;
 if(/^\/messages\/compose\/?$/.test(location.pathname))return; // Viestikirjasto owns the unified compose navigation.
 const compose=/^\/messages\/compose\/?$/.test(location.pathname);
 const bar=document.createElement('section');bar.id='wt-message-toolbar';
 bar.setAttribute('aria-label','OpenApuri viestityökalut');
 oaMessagePeeker(bar);
 bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:7px 9px;margin:0 0 12px;background:var(--oa-surface);border:1px solid var(--oa-border);border-radius:5px;font:12px system-ui;color:#29465c;max-width:100%;box-sizing:border-box;';
 const brand=document.createElement('strong');brand.textContent='OpenApuri';brand.style.cssText='font-size:12px;margin-right:6px';bar.append(brand);
 const button=(name,action)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');b.style.cssText='background:transparent;color:var(--oa-primary-dark);border:0;border-bottom:2px solid transparent;padding:7px 11px;cursor:pointer;font:13px system-ui';b.addEventListener('click',action);bar.append(b);return b};
 bar.setAttribute('role','tablist');
 const activate=(name)=>{
  for(const b of bar.querySelectorAll('[role="tab"]')){
   const active=b.dataset.tab===name;b.setAttribute('aria-selected',String(active));
   b.style.borderBottomColor=active?'var(--oa-primary)':'transparent';
   b.style.fontWeight=active?'600':'400';
  }
  if(compose)window.dispatchEvent(new CustomEvent('openapuri:show-library',{detail:{section:name}}));
 };
 const message=button('Viesti',()=>activate('message'));message.dataset.tab='message';
 const templates=button('Viestipohjat',()=>{if(compose)activate('templates');else location.assign('/messages/compose#wt-library-templates')});templates.dataset.tab='templates';
 const drafts=button('Luonnokset',()=>{if(compose)activate('drafts');else location.assign('/messages/compose#wt-library')});drafts.dataset.tab='drafts';
 if(!compose){const save=button('Tallenna viestipohjaksi',()=>{
   const frame=document.querySelector('iframe#message-wrapper');
   const body=frame?.contentDocument?.querySelector('body > .ckeditor, body .ckeditor');
   if(!body||!body.textContent.trim()){alert('Viestisisältöä ei löydy. Odota viestin latautumista.');return}
   const h=main.querySelector('h1');
   const subject=(h?.textContent||'').trim().slice(0,250);
   localStorage.setItem('openapuri.sentTemplateImport.v1',JSON.stringify({subject,body:(body.innerText||body.textContent||'').trim(),bodyHtml:body.innerHTML,createdAt:Date.now()}));
   location.assign('/messages/compose#wt-library-templates');
  });save.setAttribute('role','button')}
 else{const save=button('Tallenna nykyinen pohjaksi',()=>{activate('templates');window.dispatchEvent(new CustomEvent('openapuri:save-compose-template'))});save.setAttribute('role','button')}
 const active=compose?(location.hash==='#wt-library'?'drafts':location.hash==='#wt-library-templates'?'templates':'message'):'message';
 for(const b of bar.querySelectorAll('[role="tab"]')){const yes=b.dataset.tab===active;b.setAttribute('aria-selected',String(yes));b.style.borderBottomColor=yes?'var(--oa-primary)':'transparent'}
 window.addEventListener('openapuri:library-closed',()=>{for(const b of bar.querySelectorAll('[role="tab"]')){const yes=b.dataset.tab==='message';b.setAttribute('aria-selected',String(yes));b.style.borderBottomColor=yes?'var(--oa-primary)':'transparent'}});
 main.insertAdjacentElement('afterbegin',bar);
}
if(/^\/messages\//.test(location.pathname)){
 installUnifiedMessageBar();
 let checks=0;const wait=setInterval(()=>{installUnifiedMessageBar();if(++checks>25)clearInterval(wait)},450);
}
if(['/', '/index','/dashboard','/home'].includes(location.pathname)){
 attachHome();swapTwoHomepageBoxes();
 // Wilma can render the homepage blocks after DOMContentLoaded.
 let tries=0;
 const interval=setInterval(()=>{attachHome();swapTwoHomepageBoxes();if(++tries>=12)clearInterval(interval)},1000);
}
})();