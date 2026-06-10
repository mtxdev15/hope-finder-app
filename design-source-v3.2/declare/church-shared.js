/* ============================================================
   Declare — shared church data + helpers (used by both
   Church layout prototypes). Exposes:
     window.DECLARE_CHURCHES   — array of churches
     window.ChurchUtils        — { esc, haversine, fmtDist, byId,
                                    getMine, setMine, detailHTML }
   ============================================================ */
(function(){
  var CHURCHES = [
    { id:'kingdom-culture', mono:'KC', name:'Kingdom Culture Church', lang:'English', city:'Winter Garden, FL', lat:28.5546, lng:-81.5878, online:true,
      tag:'Spirit-led', style:'Charismatic', members:1200,
      pastor:'Jeremy Dunn', address:'12201 West Colonial Drive, Winter Garden, FL, USA',
      desc:'A presence-driven family where we lose to gain and die to live — helping people passionately pursue a life of Heaven on Earth.',
      site:'kingdomculturefl.com', email:'info@kingdomculturefl.com', phone:'(407) 490-3958',
      schedule:[ {day:'Sunday', items:[['8:30 AM','Sunday Service'],['10:30 AM','Sunday Service'],['12:30 PM','Sunday Service']]}, {day:'Wednesday', items:[['6:30 PM','Youth Service']]} ] },
    { id:'grace-community', mono:'GC', name:'Grace Community Church', lang:'English', city:'Orlando, FL', lat:28.5370, lng:-81.3790, online:true,
      tag:'Welcoming', style:'Contemporary', members:850,
      pastor:'Michael Reyes', address:'455 South Orange Avenue, Orlando, FL, USA',
      desc:'A family of believers learning to follow Jesus together — rooted in Scripture, formed by grace, and sent to love our city.',
      site:'gracecommunityorlando.com', email:'hello@gracecommunityorlando.com', phone:'(407) 555-0142',
      schedule:[ {day:'Sunday', items:[['9:00 AM','Morning Worship'],['11:00 AM','Morning Worship']]}, {day:'Wednesday', items:[['7:00 PM','Midweek Prayer']]} ] },
    { id:'hope-chapel', mono:'HC', name:'Hope Chapel', lang:'English', city:'Orlando, FL', lat:28.5710, lng:-81.3640, online:false,
      tag:'Tight-knit', style:'Contemporary', members:240,
      pastor:'David Okafor', address:'2890 North Mills Avenue, Orlando, FL, USA',
      desc:'A welcoming community for the weary and the searching — a place to belong before you believe.',
      site:'hopechapelfl.org', email:'connect@hopechapelfl.org', phone:'(407) 555-0199',
      schedule:[ {day:'Sunday', items:[['10:00 AM','Gathering']]}, {day:'Thursday', items:[['6:30 PM','Young Adults']]} ] },
    { id:'iglesia-vida', mono:'IV', name:'Iglesia Vida Nueva', lang:'Spanish', city:'Kissimmee, FL', lat:28.2920, lng:-81.3920, online:true,
      tag:'Para la familia', style:'Pentecostal', members:520,
      pastor:'Carlos Mendez', address:'1500 East Vine Street, Kissimmee, FL, USA',
      desc:'Una iglesia para toda la familia — predicando la esperanza del evangelio en español a nuestra comunidad.',
      site:'vidanuevafl.com', email:'info@vidanuevafl.com', phone:'(407) 555-0177',
      schedule:[ {day:'Domingo', items:[['9:30 AM','Servicio'],['11:30 AM','Servicio']]}, {day:'Viernes', items:[['7:00 PM','Estudio Bíblico']]} ] },
    { id:'living-water', mono:'LW', name:'Living Water Fellowship', lang:'English', city:'Clermont, FL', lat:28.5494, lng:-81.7729, online:true,
      tag:'Spirit-led', style:'Charismatic', members:430,
      pastor:'Andrew Boyd', address:'1605 Hooks Street, Clermont, FL, USA',
      desc:'A Spirit-filled family in the hills of Clermont — pursuing intimacy with God and authentic community.',
      site:'livingwaterclermont.com', email:'hello@livingwaterclermont.com', phone:'(352) 555-0120',
      schedule:[ {day:'Sunday', items:[['9:00 AM','Worship'],['11:00 AM','Worship']]}, {day:'Wednesday', items:[['7:00 PM','Midweek']]} ] },
    { id:'cornerstone-oviedo', mono:'CO', name:'Cornerstone Oviedo', lang:'English', city:'Oviedo, FL', lat:28.6700, lng:-81.2080, online:true,
      tag:'Family-first', style:'Contemporary', members:610,
      pastor:'Daniel Whitfield', address:'200 Alexandria Boulevard, Oviedo, FL, USA',
      desc:'A multi-generational church building strong families and deep roots in the Word, just east of Orlando.',
      site:'cornerstoneoviedo.org', email:'hello@cornerstoneoviedo.org', phone:'(407) 555-0150',
      schedule:[ {day:'Sunday', items:[['9:15 AM','Worship'],['11:15 AM','Worship']]}, {day:'Wednesday', items:[['6:45 PM','Family Night']]} ] },
    { id:'river-sanford', mono:'RS', name:'River City Church', lang:'English', city:'Sanford, FL', lat:28.8003, lng:-81.2731, online:false,
      tag:'Mission-driven', style:'Non-denominational', members:380,
      pastor:'Tomas Rivera', address:'401 South Park Avenue, Sanford, FL, USA',
      desc:'A church on mission for the city — generous, hospitable, and unashamed of the gospel of Jesus.',
      site:'rivercitysanford.com', email:'hi@rivercitysanford.com', phone:'(407) 555-0131',
      schedule:[ {day:'Sunday', items:[['10:00 AM','Gathering']]}, {day:'Tuesday', items:[['7:00 PM','Groups']]} ] },
    { id:'casa-de-fe', mono:'CF', name:'Casa de Fe', lang:'Spanish', city:'Orlando, FL', lat:28.5210, lng:-81.4100, online:true,
      tag:'Cálida', style:'Pentecostal', members:300,
      pastor:'Lucía Fuentes', address:'3100 South Kirkman Road, Orlando, FL, USA',
      desc:'Una casa de fe y esperanza donde cada persona es recibida como familia y encuentra un encuentro con Dios.',
      site:'casadefeorlando.com', email:'info@casadefeorlando.com', phone:'(407) 555-0144',
      schedule:[ {day:'Domingo', items:[['10:00 AM','Servicio'],['12:00 PM','Servicio']]}, {day:'Miércoles', items:[['7:30 PM','Oración']]} ] },
    { id:'liberty-hill', mono:'LH', name:'Liberty Hill Church', lang:'English', city:'Jersey City, NJ', lat:40.7178, lng:-74.0431, online:true,
      tag:'City-centered', style:'Reformed', members:520,
      pastor:'Marcus Bell', address:'215 Montgomery Street, Jersey City, NJ, USA',
      desc:'A diverse, city-centered church proclaiming the hope of the gospel to the greater New York area.',
      site:'libertyhillnj.org', email:'connect@libertyhillnj.org', phone:'(201) 555-0188',
      schedule:[ {day:'Sunday', items:[['9:30 AM','Gathering'],['11:30 AM','Gathering']]}, {day:'Tuesday', items:[['7:00 PM','Prayer Night']]} ] },
    { id:'redeemer-atl', mono:'RA', name:'Redeemer Atlanta', lang:'English', city:'Atlanta, GA', lat:33.7490, lng:-84.3880, online:true,
      tag:'Gospel-centered', style:'Reformed', members:1400,
      pastor:'Stephen Hayes', address:'659 Peachtree Street NE, Atlanta, GA, USA',
      desc:'A gospel-centered church in the heart of the city, helping people meet Jesus and grow as His disciples.',
      site:'redeemeratl.org', email:'hello@redeemeratl.org', phone:'(404) 555-0166',
      schedule:[ {day:'Sunday', items:[['9:00 AM','Worship'],['11:15 AM','Worship']]}, {day:'Wednesday', items:[['6:45 PM','Groups']]} ] }
  ];

  // "Sundays 8:30, 10:30 & 12:30" style summary from the first service day
  function serviceSummary(c){
    var d = c.schedule && c.schedule[0]; if(!d) return '';
    var times = d.items.map(function(it){ return it[0].replace(/:00/,'').replace(/ /,''); });
    var day = /Domingo/.test(d.day) ? 'Domingos' : (/Sunday/.test(d.day) ? 'Sundays' : d.day);
    var joined = times.length>1 ? times.slice(0,-1).join(', ')+' & '+times[times.length-1] : times[0];
    return day+' '+joined;
  }

  // suggested locations for the "Where" step
  var PLACES = [
    { id:'nearby', label:'Nearby', sub:'Find churches around you', icon:'near' },
    { id:'Orlando', label:'Orlando, FL', sub:'Central Florida', icon:'city' },
    { id:'Kissimmee', label:'Kissimmee, FL', sub:'Osceola County', icon:'city' },
    { id:'Clermont', label:'Clermont, FL', sub:'Lake County', icon:'city' },
    { id:'Oviedo', label:'Oviedo, FL', sub:'Seminole County', icon:'city' },
    { id:'Atlanta', label:'Atlanta, GA', sub:'Georgia', icon:'city' },
    { id:'Jersey City', label:'Jersey City, NJ', sub:'Greater New York', icon:'city' }
  ];

  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function byId(id){ for(var i=0;i<CHURCHES.length;i++){ if(CHURCHES[i].id===id) return CHURCHES[i]; } return null; }
  function getMine(){ try{ return localStorage.getItem('declare-church'); }catch(e){ return null; } }
  function setMine(id){ try{ if(id) localStorage.setItem('declare-church', id); else localStorage.removeItem('declare-church'); }catch(e){} }

  function haversine(aLat,aLng,bLat,bLng){
    var R=3958.8, toRad=Math.PI/180;
    var dLat=(bLat-aLat)*toRad, dLng=(bLng-aLng)*toRad;
    var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(aLat*toRad)*Math.cos(bLat*toRad)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  }
  function fmtDist(mi){ return mi<10 ? mi.toFixed(1)+' mi' : Math.round(mi)+' mi'; }

  // Full detail body (string). Pages insert into a scroll container and wire #setMine.
  function detailHTML(c, mine){
    var sched=(c.schedule||[]).map(function(s){
      return '<div class="day">'+esc(s.day)+'</div>'+s.items.map(function(it){
        return '<div class="svc"><span class="time">'+esc(it[0])+'</span><span class="what">'+esc(it[1])+'</span></div>'; }).join('');
    }).join('');
    var scheduleSec = sched
      ? '<div class="dsec"><div class="dlbl">Schedule</div>'+sched+'</div>'
      : (c.site ? '<div class="dsec"><div class="dlbl">Schedule</div><a class="drow" href="https://'+esc(c.site)+'" target="_blank" rel="noopener"><span class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span class="dt">View service times on their site</span></a></div>' : '');
    var connect='';
    if(c.site)  connect+='<a class="drow" href="https://'+esc(c.site)+'" target="_blank" rel="noopener"><span class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg></span><span class="dt">'+esc(c.site)+'</span></a>';
    if(c.email) connect+='<a class="drow" href="mailto:'+esc(c.email)+'"><span class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span><span class="dt">'+esc(c.email)+'</span></a>';
    if(c.phone) connect+='<a class="drow" href="tel:'+c.phone.replace(/[^0-9+]/g,'')+'"><span class="di"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg></span><span class="dt">'+esc(c.phone)+'</span></a>';
    return ''+
      '<div class="dhero"><div class="dmono">'+esc(c.mono)+'</div><div class="dname">'+esc(c.name)+'</div>'+(c.lang?'<div class="dlang">'+esc(c.lang)+'</div>':'')+'</div>'+
      '<div class="dsetwrap"><button class="dset'+(mine?' on':'')+'" id="setMine">'+(mine
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> My Church'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Set as My Church')+'</button></div>'+
      (c.desc ? '<div class="ddesc">'+esc(c.desc)+'</div>' : '')+
      (c.pastor ? '<div class="dsec"><div class="dlbl">Lead Pastor</div><div class="dval">'+esc(c.pastor)+'</div></div>' : '')+
      (c.address ? '<div class="dsec"><div class="dlbl">Address</div><div class="daddr"><div class="dval">'+esc(c.address)+'</div>'+
        '<a class="pin" href="https://maps.google.com/?q='+encodeURIComponent(c.address)+'" target="_blank" rel="noopener" aria-label="Open in maps"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a></div></div>' : '')+
      scheduleSec+
      (connect ? '<div class="dsec"><div class="dlbl">Connect</div>'+connect+'</div>' : '');
  }

  window.DECLARE_CHURCHES = CHURCHES;
  window.DECLARE_PLACES = PLACES;
  window.ChurchUtils = { esc:esc, byId:byId, getMine:getMine, setMine:setMine, haversine:haversine, fmtDist:fmtDist, detailHTML:detailHTML, serviceSummary:serviceSummary };
})();
