/* ============================================================
   storage.js
   Loads FIRST. Defines the shared App namespace plus two things:

   1. App.Util — small stateless helpers (date-key math, clamp, uid,
      CSV/download/toast) used by every other module.

   2. App.Storage — the generic persistence engine: localStorage I/O,
      legacy-data migration, schema validation, and state access
      (getDay/mutateDay). It deliberately does NOT know what a
      "habit" or "category" is — for the parts of the data shape that
      are domain-specific (the day record's fields, the cycle's
      activities/categories), it delegates to App.Habits.emptyDay()/
      normalizeDay() and App.Challenge.defaultCycle()/sanitizeCycle().

   That delegation means App.Storage only calls into App.Habits /
   App.Challenge at RUN time (inside functions, never at file-parse
   time), so script load order doesn't matter for those calls — by
   the time anything actually runs (after app.js's init()), every
   module is loaded. See app.js for the load order and init sequence.
   ============================================================ */

window.App = window.App || {};

App.Util = (function(){
  "use strict";

  function pad(n){ return String(n).padStart(2, "0"); }
  function todayDate(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function toKey(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function keyToDate(k){ var p = k.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
  function todayKey(){ return toKey(todayDate()); }
  function addDays(key, n){ var d = keyToDate(key); d.setDate(d.getDate()+n); return toKey(d); }
  function fmtWeekdayDate(key){
    var d = keyToDate(key);
    var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return days[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()];
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function uid(){ return "a" + Math.random().toString(36).slice(2, 9); }
  function escapeHtml(value){
    return String(value).replace(/[&<>"']/g, function(ch){
      return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch];
    });
  }

  function csvEscape(value){
    var s = String(value);
    if(s.indexOf(",") > -1 || s.indexOf('"') > -1 || s.indexOf("\n") > -1){
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  function toCsv(rows){
    return rows.map(function(r){ return r.map(csvEscape).join(","); }).join("\r\n");
  }
  function downloadBlob(content, mime, filename){
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var toastEl = null, toastTimer = null;
  function showToast(msg, duration){
    if(!toastEl) toastEl = document.getElementById("toast");
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove("show"); }, duration || 2000);
  }

  return {
    pad: pad, todayDate: todayDate, toKey: toKey, keyToDate: keyToDate, todayKey: todayKey,
    addDays: addDays, fmtWeekdayDate: fmtWeekdayDate, clamp: clamp, uid: uid, escapeHtml: escapeHtml,
    csvEscape: csvEscape, toCsv: toCsv, downloadBlob: downloadBlob, showToast: showToast
  };
})();

App.Storage = (function(){
  "use strict";
  var U = App.Util;

  var SCHEMA_VERSION = 1;
  var STORAGE_KEY = "routineos_unified_v1";
  var LEGACY_CYCLE_KEY = "challenge21_v2";
  var LEGACY_DAY_PREFIX = "day:";

  var state = null;
  var migrated = false;

  function sanitizeState(s){
    return {
      schemaVersion: SCHEMA_VERSION,
      cycle: App.Challenge.sanitizeCycle(s && s.cycle),
      days: sanitizeDays(s && s.days)
    };
  }
  function sanitizeDays(days){
    var out = {};
    var d = (days && typeof days === "object") ? days : {};
    Object.keys(d).forEach(function(k){
      if(/^\d{4}-\d{2}-\d{2}$/.test(k)) out[k] = App.Habits.normalizeDay(d[k]);
    });
    return out;
  }

  function isValidUnified(s){
    return !!(s && typeof s === "object" && s.cycle && Array.isArray(s.cycle.activities) &&
      s.cycle.checks && typeof s.cycle.checks === "object" && typeof s.cycle.startDate === "string");
  }
  function isLegacyCycleBackup(s){
    return !!(s && typeof s === "object" && Array.isArray(s.activities) &&
      s.checks && typeof s.checks === "object" && typeof s.startDate === "string");
  }

  function tryMigrateLegacy(){
    var found = false;
    var result = { cycle: null, days: {} };
    try{
      var raw = localStorage.getItem(LEGACY_CYCLE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(isLegacyCycleBackup(parsed)){
          result.cycle = { startDate: parsed.startDate, activities: parsed.activities, checks: parsed.checks };
          found = true;
        }
      }
    }catch(e){}
    try{
      for(var i=0; i<localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && k.indexOf(LEGACY_DAY_PREFIX) === 0){
          var dateKey = k.slice(LEGACY_DAY_PREFIX.length);
          if(/^\d{4}-\d{2}-\d{2}$/.test(dateKey)){
            try{ result.days[dateKey] = JSON.parse(localStorage.getItem(k)); found = true; }
            catch(e){}
          }
        }
      }
    }catch(e){}
    if(!found) return null;
    if(!result.cycle) result.cycle = App.Challenge.defaultCycle();
    return result;
  }

  function persist(s){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); return true; }
    catch(e){ console.error("Could not save tracker data:", e); return false; }
  }

  function load(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        if(parsed && parsed.cycle) return sanitizeState(parsed);
      }
    }catch(e){ console.error("Could not read saved tracker data:", e); }

    var legacy = tryMigrateLegacy();
    if(legacy){
      migrated = true;
      var sanitized = sanitizeState(legacy);
      persist(sanitized);
      return sanitized;
    }
    return sanitizeState({ cycle: App.Challenge.defaultCycle(), days: {} });
  }

  function init(){
    state = load();
  }
  function save(){ persist(state); }

  function getDay(key){
    return state.days[key] ? App.Habits.normalizeDay(state.days[key]) : App.Habits.emptyDay();
  }
  function mutateDay(key, fn){
    if(!state.days[key]) state.days[key] = App.Habits.emptyDay();
    fn(state.days[key]);
    save();
  }

  function replaceState(newState){
    state = sanitizeState(newState);
    save();
  }
  function replaceCycle(newCycle){
    state.cycle = App.Challenge.sanitizeCycle(newCycle);
    save();
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    init: init,
    save: save,
    get state(){ return state; },
    getDay: getDay,
    mutateDay: mutateDay,
    replaceState: replaceState,
    replaceCycle: replaceCycle,
    sanitizeState: sanitizeState,
    isValidUnified: isValidUnified,
    isLegacyCycleBackup: isLegacyCycleBackup,
    get migrated(){ return migrated; }
  };
})();
