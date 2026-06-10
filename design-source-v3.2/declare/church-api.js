/* ============================================================
   Declare — ChurchAPI · the single data seam for Find a Church
   ------------------------------------------------------------
   The whole flow talks ONLY to this module. Swap providers
   without touching the UI.

     ChurchAPI.config({ googleKey, backendBase, radiusMiles })
     ChurchAPI.mode()                       -> 'live' | 'mock'
     ChurchAPI.geocode(query)               -> Promise<{lat,lng,label}>
     ChurchAPI.search({lat,lng,query,online,lang,when}) -> Promise<church[]>
     ChurchAPI.get(id)                       -> church | null   (sync, from cache)
     ChurchAPI.details(id)                   -> Promise<church> (full, enriched)

   PHASE 1 (discovery)  — Google Places API (New), client-side fetch.
   PHASE 2 (enrichment) — your backend merges "claimed" data:
                          { online, serviceTimes, pastor, desc, style, tag }.
   No events (phase 3) — intentionally out of scope.
   ============================================================ */
(function(){
  var CFG = {
    googleKey: '',                 // <-- set a Maps/Places API key to go LIVE
    backendBase: '',               // <-- your enrichment endpoint base, e.g. https://api.declare.app
    radiusMiles: 35
  };
  var cache = {};                  // id -> church (everything we've seen this session)
  var U = window.ChurchUtils;

  function mode(){ return CFG.googleKey ? 'live' : 'mock'; }
  function config(o){ Object.assign(CFG, o||{}); return CFG; }
  function put(list){ list.forEach(function(c){ cache[c.id]=Object.assign(cache[c.id]||{}, c); }); return list; }
  function get(id){ return cache[id]||(U&&U.byId?U.byId(id):null); }
  function miToM(mi){ return Math.round(mi*1609.34); }
  function initials(name){
    var w=(name||'').replace(/^(The|Iglesia|Casa de)\s+/i,'').split(/\s+/).filter(Boolean);
    return ((w[0]||'?')[0]+((w[1]||'')[0]||'')).toUpperCase();
  }

  /* ===========================================================
     MOCK provider — resolves from window.DECLARE_CHURCHES.
     Mirrors live latency so the UX (skeleton etc.) is identical.
     =========================================================== */
  var MOCK_PLACES = {
    nearby:{lat:28.5478,lng:-81.5640,label:'Nearby'}, online:null,
    'Orlando':{lat:28.5383,lng:-81.3792,label:'Orlando, FL'}, 'Kissimmee':{lat:28.2920,lng:-81.3920,label:'Kissimmee, FL'},
    'Clermont':{lat:28.5494,lng:-81.7729,label:'Clermont, FL'}, 'Oviedo':{lat:28.6700,lng:-81.2080,label:'Oviedo, FL'},
    'Atlanta':{lat:33.7490,lng:-84.3880,label:'Atlanta, GA'}, 'Jersey City':{lat:40.7178,lng:-74.0431,label:'Jersey City, NJ'}
  };
  function delay(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function mockGeocode(q){
    if(!q) return Promise.resolve(MOCK_PLACES.nearby);
    if(MOCK_PLACES[q]) return Promise.resolve(MOCK_PLACES[q]);
    var hit=Object.keys(MOCK_PLACES).find(function(k){ return k!=='nearby'&&k!=='online'&&k.toLowerCase().indexOf(q.toLowerCase())>-1; });
    return Promise.resolve(hit?MOCK_PLACES[hit]:MOCK_PLACES.nearby);
  }
  function mockSearch(p){
    return delay(820).then(function(){
      var src = window.DECLARE_CHURCHES.slice();
      var o = (p.lat!=null) ? {lat:p.lat,lng:p.lng} : null;
      src.forEach(function(c){ c._mi = o ? U.haversine(o.lat,o.lng,c.lat,c.lng) : 999; });
      var list = src;
      if(p.online) list = list.filter(function(c){ return c.online; });
      else if(o) list = list.filter(function(c){ return c._mi < (p.maxMi||60); });
      if(p.lang && p.lang!=='Any') list = list.filter(function(c){ return c.lang===p.lang; });
      if(p.when==='Sunday morning') list = list.filter(function(c){ return svcHalf(c,'AM'); });
      if(p.when==='Sunday evening') list = list.filter(function(c){ return svcHalf(c,'PM'); });
      if(p.when==='Midweek') list = list.filter(function(c){ return c.schedule.length>1; });
      list.sort(function(a,b){ return a._mi-b._mi; });
      return put(list.map(norm));
    });
  }
  function svcHalf(c,half){ var d=c.schedule[0]; if(!/Sunday|Domingo/.test(d.day)) return false; return d.items.some(function(it){return it[0].indexOf(half)>-1;}); }
  function mockDetails(id){ return delay(120).then(function(){ return get(id); }); }

  /* ===========================================================
     GOOGLE provider — Phase 1 discovery + Phase 2 enrichment.
     Uses Places API (New) which supports browser CORS with a key.
     Enable in Google Cloud: "Places API (New)" + "Geocoding API".
     Restrict the key by HTTP referrer to your domain.
     =========================================================== */
  var PLACES_BASE = 'https://places.googleapis.com/v1';
  var GEO_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
  var FIELD_MASK = [
    'places.id','places.displayName','places.formattedAddress','places.shortFormattedAddress',
    'places.location','places.websiteUri','places.internationalPhoneNumber',
    'places.regularOpeningHours','places.primaryType','places.addressComponents'
  ].join(',');

  function googleGeocode(q){
    if(!q) return Promise.resolve(MOCK_PLACES.nearby);
    return fetch(GEO_BASE+'?address='+encodeURIComponent(q)+'&key='+CFG.googleKey)
      .then(function(r){ return r.json(); })
      .then(function(j){
        var hit=j.results&&j.results[0];
        if(!hit) throw new Error('GEOCODE_EMPTY');
        var loc=hit.geometry.location;
        return { lat:loc.lat, lng:loc.lng, label:hit.formatted_address };
      });
  }

  function googleSearch(p){
    // Nearby in-person churches, OR a text search when a query string is present.
    var center = { latitude:p.lat, longitude:p.lng };
    var radius = miToM(CFG.radiusMiles);
    var req, body;
    if(p.query){
      req = PLACES_BASE+'/places:searchText';
      body = { textQuery: p.query+' church', locationBias:{ circle:{ center:center, radius:radius } }, maxResultCount:20 };
    } else {
      req = PLACES_BASE+'/places:searchNearby';
      body = { includedTypes:['church'], maxResultCount:20, locationRestriction:{ circle:{ center:center, radius:radius } } };
    }
    return fetch(req, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'X-Goog-Api-Key':CFG.googleKey, 'X-Goog-FieldMask':FIELD_MASK },
      body: JSON.stringify(body)
    })
    .then(function(r){ if(!r.ok) throw new Error('PLACES_'+r.status); return r.json(); })
    .then(function(j){ return (j.places||[]).map(function(pl){ return mapPlace(pl, center); }); })
    .then(enrichAll)                                  // phase 2 merge
    .then(function(list){
      if(p.online) list = list.filter(function(c){ return c.online; });
      if(p.lang && p.lang!=='Any') list = list.filter(function(c){ return !c.lang || c.lang===p.lang; });
      list.sort(function(a,b){ return a._mi-b._mi; });
      return put(list);
    });
  }

  function mapPlace(pl, center){
    var loc = pl.location||{};
    var mi = (center && loc.latitude!=null) ? U.haversine(center.latitude,center.longitude,loc.latitude,loc.longitude) : 999;
    var name = (pl.displayName&&pl.displayName.text)||'Church';
    var city = cityFrom(pl.addressComponents) || (pl.shortFormattedAddress||'').split(',').slice(-2,-1)[0] || '';
    return {
      id: pl.id, mono: initials(name), name: name, lang:'', city: city.trim(),
      lat: loc.latitude, lng: loc.longitude, _mi: mi,
      online: false,                                  // unknown until enriched
      address: pl.formattedAddress||'',
      site: (pl.websiteUri||'').replace(/^https?:\/\//,''),
      phone: pl.internationalPhoneNumber||'',
      schedule: hoursToSchedule(pl.regularOpeningHours),  // best-effort from Places hours
      _placesHours: !!pl.regularOpeningHours
    };
  }
  function cityFrom(comps){
    if(!comps) return '';
    var loc = comps.find(function(c){ return (c.types||[]).indexOf('locality')>-1; });
    var st  = comps.find(function(c){ return (c.types||[]).indexOf('administrative_area_level_1')>-1; });
    return [loc&&loc.longText, st&&st.shortText].filter(Boolean).join(', ');
  }
  function hoursToSchedule(h){
    // Google opening hours ≈ when the building is open, NOT service times.
    // We surface them only as a hint; real service times come from enrichment.
    if(!h||!h.weekdayDescriptions) return [];
    var sun = h.weekdayDescriptions.find(function(d){ return /^Sunday/.test(d); });
    if(!sun || /Closed/i.test(sun)) return [];
    return [{ day:'Sunday (hours)', items:[[ sun.replace(/^Sunday:\s*/,''), 'Open' ]] }];
  }

  function enrichAll(list){
    if(!CFG.backendBase || !list.length) return Promise.resolve(list);
    var ids = list.map(function(c){ return c.id; }).join(',');
    return fetch(CFG.backendBase.replace(/\/$/,'')+'/enrich?placeIds='+encodeURIComponent(ids))
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(map){
        // map: { placeId: { online, serviceTimes:[{day,items}], pastor, desc, style, tag, members, lang, email } }
        list.forEach(function(c){
          var e = map[c.id]; if(!e) return;
          if(e.online!=null) c.online = e.online;
          if(e.serviceTimes) c.schedule = e.serviceTimes;
          ['pastor','desc','style','tag','members','lang','email'].forEach(function(k){ if(e[k]!=null) c[k]=e[k]; });
        });
        return list;
      })
      .catch(function(){ return list; });
  }
  function googleDetails(id){
    var c = get(id);
    if(!CFG.backendBase) return Promise.resolve(c);
    return enrichAll([c]).then(function(l){ return l[0]; });
  }

  /* ===========================================================
     normalize a mock record to the same shape live data returns
     (so card/detail builders can stay provider-agnostic)
     =========================================================== */
  function norm(c){ return c; } // mock data already matches our shape

  /* ===========================================================
     public router
     =========================================================== */
  window.ChurchAPI = {
    config: config,
    mode: mode,
    geocode: function(q){ return mode()==='live' ? googleGeocode(q) : mockGeocode(q); },
    search:  function(p){ return mode()==='live' ? googleSearch(p)  : mockSearch(p);  },
    get: get,
    details: function(id){ return mode()==='live' ? googleDetails(id) : mockDetails(id); },
    _places: MOCK_PLACES
  };
})();
