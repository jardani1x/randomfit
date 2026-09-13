'use strict';
(() => {
  // One absolute instant for every city; never parse a timezone-less date.
  const FALLBACK_CONFIG = {
    releaseUTC: '2026-09-14T17:00:00Z', status: 'expected',
    sourceURL: 'https://www.macrumors.com/2026/09/13/ios-27-release-date-time-zones/'
  };
  const $ = (id) => document.getElementById(id);
  const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const storage = {
    get(key, fallback) { try { const v = localStorage.getItem('ios27.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem('ios27.' + key, JSON.stringify(value)); } catch { /* Private mode can disable persistence. */ } }
  };
  // Independently curated cities. Conversion uses the browser's IANA time zone data.
  const rows = [
    ['singapore','Singapore','Singapore','SG','Asia/Singapore','Asia','SGT',true],
    ['cupertino','Cupertino','United States','US','America/Los_Angeles','Americas','California San Francisco Los Angeles Pacific PT PDT PST',true],
    ['new-york','New York','United States','US','America/New_York','Americas','Eastern ET EDT EST',true],
    ['london','London','United Kingdom','GB','Europe/London','Europe','Britain England UK BST GMT',true],
    ['paris','Paris','France','FR','Europe/Paris','Europe','CEST CET',true],
    ['dubai','Dubai','United Arab Emirates','AE','Asia/Dubai','Asia','UAE GST',true],
    ['new-delhi','New Delhi','India','IN','Asia/Kolkata','Asia','Mumbai Bombay Bengaluru IST',true],
    ['hong-kong','Hong Kong','Hong Kong','HK','Asia/Hong_Kong','Asia','HKT',true],
    ['tokyo','Tokyo','Japan','JP','Asia/Tokyo','Asia','JST',true],
    ['seoul','Seoul','South Korea','KR','Asia/Seoul','Asia','KST',true],
    ['sydney','Sydney','Australia','AU','Australia/Sydney','Oceania','Eastern AEST AEDT',true],
    ['auckland','Auckland','New Zealand','NZ','Pacific/Auckland','Oceania','Wellington NZST NZDT',true],
    ['kuala-lumpur','Kuala Lumpur','Malaysia','MY','Asia/Kuala_Lumpur','Asia','MYT'],
    ['beijing','Beijing','China','CN','Asia/Shanghai','Asia','Shanghai CST'],
    ['taipei','Taipei','Taiwan','TW','Asia/Taipei','Asia','CST'],
    ['jakarta','Jakarta','Indonesia','ID','Asia/Jakarta','Asia','Western WIB'],
    ['bangkok','Bangkok','Thailand','TH','Asia/Bangkok','Asia','ICT'],
    ['manila','Manila','Philippines','PH','Asia/Manila','Asia','PHT'],
    ['kathmandu','Kathmandu','Nepal','NP','Asia/Kathmandu','Asia','NPT'],
    ['riyadh','Riyadh','Saudi Arabia','SA','Asia/Riyadh','Asia','AST'],
    ['berlin','Berlin','Germany','DE','Europe/Berlin','Europe','CEST CET'],
    ['rome','Rome','Italy','IT','Europe/Rome','Europe','CEST CET'],
    ['madrid','Madrid','Spain','ES','Europe/Madrid','Europe','mainland CEST CET'],
    ['amsterdam','Amsterdam','Netherlands','NL','Europe/Amsterdam','Europe','CEST CET'],
    ['brussels','Brussels','Belgium','BE','Europe/Brussels','Europe','CEST CET'],
    ['vienna','Vienna','Austria','AT','Europe/Vienna','Europe','CEST CET'],
    ['zurich','Zurich','Switzerland','CH','Europe/Zurich','Europe','CEST CET'],
    ['dublin','Dublin','Ireland','IE','Europe/Dublin','Europe','IST GMT'],
    ['lisbon','Lisbon','Portugal','PT','Europe/Lisbon','Europe','WEST WET'],
    ['luxembourg','Luxembourg','Luxembourg','LU','Europe/Luxembourg','Europe','CEST CET'],
    ['copenhagen','Copenhagen','Denmark','DK','Europe/Copenhagen','Europe','CEST CET'],
    ['oslo','Oslo','Norway','NO','Europe/Oslo','Europe','CEST CET'],
    ['stockholm','Stockholm','Sweden','SE','Europe/Stockholm','Europe','CEST CET'],
    ['warsaw','Warsaw','Poland','PL','Europe/Warsaw','Europe','CEST CET'],
    ['helsinki','Helsinki','Finland','FI','Europe/Helsinki','Europe','EEST EET'],
    ['tallinn','Tallinn','Estonia','EE','Europe/Tallinn','Europe','Baltic EEST EET'],
    ['riga','Riga','Latvia','LV','Europe/Riga','Europe','Baltic EEST EET'],
    ['vilnius','Vilnius','Lithuania','LT','Europe/Vilnius','Europe','Baltic EEST EET'],
    ['athens','Athens','Greece','GR','Europe/Athens','Europe','EEST EET'],
    ['chicago','Chicago','United States','US','America/Chicago','Americas','Central CDT CST'],
    ['denver','Denver','United States','US','America/Denver','Americas','Mountain MDT MST'],
    ['phoenix','Phoenix','United States','US','America/Phoenix','Americas','Arizona Mountain MST'],
    ['honolulu','Honolulu','United States','US','Pacific/Honolulu','Americas','Hawaii HST'],
    ['anchorage','Anchorage','United States','US','America/Anchorage','Americas','Alaska AKDT AKST'],
    ['vancouver','Vancouver','Canada','CA','America/Vancouver','Americas','Pacific PDT PST'],
    ['toronto','Toronto','Canada','CA','America/Toronto','Americas','Eastern EDT EST'],
    ['halifax','Halifax','Canada','CA','America/Halifax','Americas','Atlantic ADT AST'],
    ['san-juan','San Juan','Puerto Rico','PR','America/Puerto_Rico','Americas','AST'],
    ['mexico-city','Mexico City','Mexico','MX','America/Mexico_City','Americas','CST'],
    ['sao-paulo','S\u00e3o Paulo','Brazil','BR','America/Sao_Paulo','Americas','Brazil East BRT'],
    ['buenos-aires','Buenos Aires','Argentina','AR','America/Argentina/Buenos_Aires','Americas','ART'],
    ['johannesburg','Johannesburg','South Africa','ZA','Africa/Johannesburg','Africa','SAST'],
    ['cairo','Cairo','Egypt','EG','Africa/Cairo','Africa','EEST EET'],
    ['perth','Perth','Australia','AU','Australia/Perth','Oceania','Western AWST'],
    ['adelaide','Adelaide','Australia','AU','Australia/Adelaide','Oceania','Central ACST ACDT'],
    ['melbourne','Melbourne','Australia','AU','Australia/Melbourne','Oceania','Eastern AEST AEDT'],
    ['chatham','Chatham Islands','New Zealand','NZ','Pacific/Chatham','Oceania','CHAST CHADT']
  ];
  const cities = rows.map(([id,name,country,code,zone,region,aliases,popular=false]) => ({id,name,country,code,zone,region,aliases,popular}));
  const byId = new Map(cities.map(c => [c.id, c]));
  let config = FALLBACK_CONFIG;
  let release = new Date(config.releaseUTC);
  let format24 = storage.get('format24', false) === true;
  let spotlight = byId.has(storage.get('city','singapore')) ? storage.get('city','singapore') : 'singapore';
  const savedPins = storage.get('favourites',['singapore']);
  const favourites = new Set(Array.isArray(savedPins) ? savedPins.filter(id => byId.has(id)) : ['singapore']);
  let filter = 'popular';
  let query = '';
  let sort = 'recommended';
  let cardNodes = [];
  let reached = null;
  let tickTimer;
  let toastTimer;
  const cache = new Map();

  function formatter(zone, options) {
    const key = zone + JSON.stringify(options);
    if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat('en-GB', {timeZone:zone,...options}));
    return cache.get(key);
  }
  function timeParts(date, zone, seconds=false) {
    const opts = {hour:'2-digit',minute:'2-digit',hourCycle:format24?'h23':'h12'};
    if(seconds) opts.second = '2-digit';
    const parts = formatter(zone,opts).formatToParts(date);
    let time = parts.filter(p => p.type!=='dayPeriod').map(p=>p.value).join('').trim();
    if(!format24) time = time.replace(/^0/,'');
    return {time,period:parts.find(p=>p.type==='dayPeriod')?.value.toUpperCase() || ''};
  }
  function plainTime(date,zone,seconds=false) {const p=timeParts(date,zone,seconds);return p.time+(p.period?' '+p.period:'');}
  function dateText(date,zone,long=false) {
    return formatter(zone,long?{weekday:'long',day:'numeric',month:'long',year:'numeric'}:{weekday:'short',day:'numeric',month:'short'}).format(date);
  }
  function dateKey(date,zone) {
    return formatter(zone,{year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>p.value).join('-');
  }
  function offsetText(date,zone) {
    try {const val=formatter(zone,{timeZoneName:'longOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName').value;return val==='GMT'?'UTC+00:00':val.replace('GMT','UTC');}
    catch {return formatter(zone,{timeZoneName:'short'}).formatToParts(date).find(p=>p.type==='timeZoneName').value;}
  }
  function offsetMinutes(zone) {
    const s=offsetText(release,zone),m=s.match(/UTC([+-])(\d{2}):(\d{2})/);
    return m?(m[1]==='-'?-1:1)*(+m[2]*60 + +m[3]):0;
  }
  function flag(code) {return /^[A-Z]{2}$/.test(code)?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'\u25ce';}
  function make(tag,cls,text) {const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function toast(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);}
  function setFormattedTime(el,date,zone,seconds=false,periodClass='period') {
    const p=timeParts(date,zone,seconds);
    el.replaceChildren(document.createTextNode(p.time));
    if(p.period)el.append(make('span',periodClass,p.period));
  }
  function buildCitySelect() {
    const selected = spotlight;
    $('spotlight-city').replaceChildren();
    [...cities].sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{const o=make('option','',c.name);o.value=c.id;$('spotlight-city').append(o);});
    $('spotlight-city').value=selected;
  }
  function updateSpotlight() {
    const c=byId.get(spotlight);
    setFormattedTime($('spotlight-release'),release,c.zone);
    $('spotlight-date').textContent=dateText(release,c.zone,true);
    $('spotlight-zone').textContent=c.zone+' \u00b7 '+offsetText(release,c.zone);
    $('spotlight-now').textContent=plainTime(new Date(),c.zone,true);
  }
  function visibleCities() {
    // A search deliberately includes every city, rather than hiding matches outside Popular.
    let list=cities.filter(c=>query ? normalize([c.name,c.country,c.zone,c.region,c.aliases].join(' ')).includes(query) :
      filter==='all' ? true : filter==='popular'?c.popular:filter==='favourites'?favourites.has(c.id):c.region===filter);
    if(sort==='alphabetical')list.sort((a,b)=>a.name.localeCompare(b.name));
    else if(sort==='timezone')list.sort((a,b)=>offsetMinutes(a.zone)-offsetMinutes(b.zone)||a.name.localeCompare(b.name));
    return list;
  }
  function renderCards() {
    const list=visibleCities();
    const frag=document.createDocumentFragment();
    cardNodes=[];
    for(const c of list) {
      const card=make('article','clock-card'+(c.id===spotlight?' is-spotlight':''));
      card.dataset.city=c.id;
      card.setAttribute('aria-label',c.name+' current time and expected iOS 27 release');
      const head=make('div','card-heading');
      const f=make('span','flag',flag(c.code));f.setAttribute('aria-hidden','true');
      const names=make('div','city-titles');names.append(make('h3','',c.name),make('p','',c.country));
      const pin=make('button','pin-button');
      pin.setAttribute('aria-label',(favourites.has(c.id)?'Remove ':'Add ')+c.name+(favourites.has(c.id)?' from':' to')+' favourites');
      pin.setAttribute('aria-pressed',String(favourites.has(c.id)));
      pin.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
      pin.addEventListener('click',()=>{
        const had=favourites.has(c.id);had?favourites.delete(c.id):favourites.add(c.id);
        storage.set('favourites',[...favourites]);
        if(filter==='favourites'&&!query){renderCards();const next=$('clock-grid').querySelector('.pin-button');if(next)next.focus();else $('reset-filters').focus();}
        else {pin.setAttribute('aria-pressed',String(!had));pin.setAttribute('aria-label',(!had?'Remove ':'Add ')+c.name+(!had?' from':' to')+' favourites');}
        toast(c.name+(had?' removed from':' added to')+' favourites');
      });
      head.append(f,names,pin);
      const clockRow=make('div','card-clock-row');
      const clock=make('time','card-clock');
      const offset=make('span','card-offset');
      clockRow.append(clock,offset);
      const today=make('span','card-today');
      const bottom=make('div','card-release');
      const label=make('span','card-release-label','EXPECTED RELEASE');
      const releaseValue=make('div','card-release-value',plainTime(release,c.zone));
      const releaseDate=make('span','card-release-date'+(dateKey(release,c.zone)!==dateKey(release,'UTC')?' date-next':''),dateText(release,c.zone)+' 2026');
      releaseValue.append(releaseDate);bottom.append(label,releaseValue);
      card.append(head,clockRow,today,bottom);frag.append(card);
      cardNodes.push({c,clock,offset,today});
    }
    $('clock-grid').replaceChildren(frag);
    $('empty-state').hidden=list.length!==0;
    const emptyFavourites=filter==='favourites'&&!query;
    $('empty-title').textContent=emptyFavourites?'Your favourites start here':'No matching cities';
    $('empty-description').textContent=emptyFavourites?'Tap the star on any city to keep it here.':'Try a different city, country or time zone.';
    $('results-count').textContent=query?list.length+' '+(list.length===1?'match':'matches')+' across all '+cities.length+' cities':list.length+' '+(list.length===1?'city':'cities')+' \u00b7 current time + expected release';
    tick();
  }
  function updateFormat() {
    $('format-12').setAttribute('aria-pressed',String(!format24));
    $('format-24').setAttribute('aria-pressed',String(format24));
    storage.set('format24',format24);
    updateSpotlight();renderCards();
  }
  function setFilter(value) {
    filter=value;query='';$('city-search').value='';
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
    renderCards();
  }
  function tick() {
    const now=new Date();
    const diff=release.getTime()-now.getTime();
    let remaining=Math.max(0,Math.ceil(diff/1000));
    const days=Math.floor(remaining/86400);remaining%=86400;
    const hours=Math.floor(remaining/3600);remaining%=3600;
    const minutes=Math.floor(remaining/60),seconds=remaining%60;
    for(const [key,value] of Object.entries({days,hours,minutes,seconds}))$(key).textContent=String(value).padStart(2,'0');
    $('countdown').setAttribute('aria-label',diff>0?`${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds until expected rollout`:'Expected release time reached. Actual availability is not verified.');
    const isReached=diff<=0;
    if(reached!==isReached){
      reached=isReached;
      $('countdown-heading').replaceChildren(make('span','status-dot amber'),document.createTextNode(isReached?'Expected release time reached':'Expected release in'));
      $('countdown-note').textContent=isReached?'Check Software Update on your iPhone. Availability is not verified here.':'One expected rollout moment. Different local times.';
    }
    $('spotlight-now').textContent=plainTime(now,byId.get(spotlight).zone,true);
    const iso=now.toISOString();
    for(const {c,clock,offset,today} of cardNodes){
      setFormattedTime(clock,now,c.zone,true);clock.dateTime=iso;
      const o=offsetText(now,c.zone);if(offset.textContent!==o)offset.textContent=o;
      const d=dateText(now,c.zone);if(today.textContent!==d)today.textContent=d;
    }
  }
  function scheduleTick(){clearTimeout(tickTimer);tick();if(!document.hidden)tickTimer=setTimeout(scheduleTick,1000-(Date.now()%1000)+15);}
  function applyTheme(theme) {
    const chosen=theme==='light'?'light':'dark';document.documentElement.dataset.theme=chosen;
    $('theme-button').setAttribute('aria-label','Switch to '+(chosen==='dark'?'light':'dark')+' theme');
    document.querySelector('meta[name="theme-color"]').setAttribute('content',chosen==='dark'?'#0b101b':'#f5f7fc');
    storage.set('theme',chosen);
  }
  function setCalendarLink() {
    const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const params=new URLSearchParams({action:'TEMPLATE',text:'iOS 27 - expected rollout',dates:stamp(release)+'/'+stamp(new Date(+release+900000)),details:'Estimated rollout time based on MacRumors (13 September 2026). Exact timing and device availability are not guaranteed.\n'+config.sourceURL,ctz:byId.get(spotlight).zone});
    $('google-calendar').href='https://calendar.google.com/calendar/render?'+params;
  }
  async function init() {
    applyTheme(storage.get('theme','dark'));
    // Fetch an editable same-origin configuration; the dated fallback also works offline.
    try {
      const response=await fetch('./release.json',{cache:'no-cache'});
      if(response.ok){const c=await response.json();if(c.status==='expected'&&Number.isFinite(Date.parse(c.releaseUTC))){config={...FALLBACK_CONFIG,...c};release=new Date(config.releaseUTC);}}
    } catch { /* Use the embedded, dated estimate rather than breaking the clocks. */ }
    $('global-release-label').textContent=formatter('UTC',{day:'numeric',month:'short',year:'numeric'}).format(release)+' \u00b7 '+formatter('UTC',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(release)+' UTC / '+formatter('America/Los_Angeles',{hour:'numeric',minute:'2-digit',hourCycle:'h12',timeZoneName:'short'}).format(release);
    buildCitySelect();updateFormat();setCalendarLink();
    $('format-12').addEventListener('click',()=>{format24=false;updateFormat();});
    $('format-24').addEventListener('click',()=>{format24=true;updateFormat();});
    $('spotlight-city').addEventListener('change',e=>{spotlight=e.target.value;storage.set('city',spotlight);updateSpotlight();renderCards();setCalendarLink();});
    $('use-local').addEventListener('click',()=>{
      const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
      if(!zone){toast('Your browser did not provide a time zone. Please choose a city.');return;}
      // Resolve aliases such as Asia/Calcutta without guessing a city from a UTC offset.
      const canon=z=>{try{return new Intl.DateTimeFormat('en',{timeZone:z}).resolvedOptions().timeZone;}catch{return z;}};
      let city=cities.find(c=>canon(c.zone)===canon(zone));
      if(!city){city={id:'device-zone',name:zone.split('/').pop().replace(/_/g,' '),country:'Device time zone',code:'',zone,region:'Other',aliases:zone,popular:false};cities.push(city);byId.set(city.id,city);}
      spotlight=city.id;buildCitySelect();updateSpotlight();renderCards();setCalendarLink();
      if(city.id!=='device-zone')storage.set('city',spotlight);
      toast('Using your device time zone: '+zone);
    });
    $('city-search').addEventListener('input',e=>{query=normalize(e.target.value.trim());document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(!query&&b.dataset.filter===filter)));renderCards();});
    $('city-sort').addEventListener('change',e=>{sort=e.target.value;renderCards();});
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
    $('reset-filters').addEventListener('click',()=>setFilter('all'));
    $('theme-button').addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    $('share-button').addEventListener('click',async()=>{
      const payload={title:'iOS 27 Release World Clock',text:'Live world clocks and the countdown to the expected iOS 27 rollout.',url:location.origin+location.pathname};
      try {if(navigator.share){await navigator.share(payload);return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(payload.url);toast('Website link copied');return;}toast('Share this page by copying its address from your browser.');}
      catch(e){if(e.name!=='AbortError')toast('Sharing is unavailable. Copy this page\'s address from your browser.');}
    });
    document.addEventListener('click',e=>{if(!$('calendar-menu').contains(e.target))$('calendar-menu').open=false;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$('calendar-menu').open=false;});
    document.addEventListener('visibilitychange',scheduleTick);
    window.addEventListener('pageshow',scheduleTick);
    scheduleTick();
  }
  init().catch(err=>{console.error('Clock initialization failed',err);$('results-count').textContent='Could not load live clocks. Please refresh the page.';});
})();
