/* ============================================================
   storage.js
   Loads FIRST. Defines App.Util and App.Storage.
   Now also manages subjectRotation and routineBlocks.
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

  var SCHEMA_VERSION = 2;
  var STORAGE_KEY = "routineos_unified_v1";
  var LEGACY_CYCLE_KEY = "challenge21_v2";
  var LEGACY_DAY_PREFIX = "day:";

  var state = null;
  var migrated = false;

  // ---- default subject rotation ----
  function defaultSubjectRotation() {
    return [
      ["Numerical Methods","DSA","Architecture","Economics"],
      ["DSA","Architecture","Numerical Methods","OOAD"],
      ["Architecture","Economics","DSA","Numerical Methods"],
      ["Economics","Numerical Methods","OOAD","Architecture"],
      ["Numerical Methods","OOAD","Economics","DSA"],
      ["Light review only","Light review only","Light review only","Light review only"],
      ["Full revision / past papers","Full revision / past papers","Full revision / past papers","Full revision / past papers"]
    ];
  }

  // ---- default routine blocks ----
  function defaultRoutineBlocks() {
    return [
      { id: U.uid(), time: "06:00 – 06:05", name: "Wake-up", task: "Affirmation, positive thought, today's to-do" },
      { id: U.uid(), time: "06:05 – 07:30", name: "Workout", task: "Bhutkhel workout according to weekly plan" },
      { id: U.uid(), time: "07:30 – 08:00", name: "Breakfast", task: "Proper breakfast, no screen" },
      { id: U.uid(), time: "08:00 – 10:00", name: "Study A", task: "Step 1 x 4 pomodoros" },
      { id: U.uid(), time: "10:00 – 10:20", name: "Long Break", task: "Walk, water, rest away from desk" },
      { id: U.uid(), time: "10:20 – 12:20", name: "Study B", task: "Step 1 x 4 pomodoros" },
      { id: U.uid(), time: "12:20 – 12:30", name: "Prep", task: "Pack steel lunchbox, quick rest" },
      { id: U.uid(), time: "12:30 – 13:30", name: "Lunch", task: "Eat lunch, no screen" },
      { id: U.uid(), time: "13:30 – 15:30", name: "Study C", task: "Step 1 x 4 pomodoros" },
      { id: U.uid(), time: "15:30 – 15:50", name: "Long Break", task: "Walk, stretch, hydrate" },
      { id: U.uid(), time: "15:50 – 17:30", name: "Study D", task: "Weak subject or revision, 3 pomodoros" },
      { id: U.uid(), time: "17:30 – 18:00", name: "Free Time", task: "Rest, social, phone, guilt-free" },
      { id: U.uid(), time: "18:00 – 19:00", name: "Dinner", task: "Prep, eat, rest" },
      { id: U.uid(), time: "19:00 – 21:00", name: "Review", task: "Flashcards and today's material only" },
      { id: U.uid(), time: "21:00 – 22:30", name: "Light Work", task: "Blog, project, reading, or creative work" },
      { id: U.uid(), time: "22:30 – 23:00", name: "Wind-down", task: "Read today's subject notes, one sentence for tomorrow" },
      { id: U.uid(), time: "23:00", name: "Sleep", task: "Device off, lights off" }
    ];
  }

  // ---- sanitisation helpers ----
  function sanitizeMeta(meta){
    var m = (meta && typeof meta === "object") ? meta : {};
    return {
      lastBackupAt: typeof m.lastBackupAt === "string" ? m.lastBackupAt : "",
      lastBackupFile: typeof m.lastBackupFile === "string" ? m.lastBackupFile : ""
    };
  }

  function sanitizeChallengeNotes(notes){
    var out = {};
    var src = (notes && typeof notes === "object") ? notes : {};
    Object.keys(src).forEach(function(cycleKey){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(cycleKey)) return;
      var cycleNotes = src[cycleKey];
      if(!cycleNotes || typeof cycleNotes !== "object") return;
      out[cycleKey] = {};
      Object.keys(cycleNotes).forEach(function(day){
        var idx = Number(day);
        if(idx >= 0 && idx < App.Challenge.DAYS_IN_CYCLE && typeof cycleNotes[day] === "string"){
          out[cycleKey][idx] = cycleNotes[day];
        }
      });
    });
    return out;
  }

  function sanitizeCycleTemplates(templates){
    var out = [];
    var list = Array.isArray(templates) ? templates : [];
    list.forEach(function(t){
      if(!t || typeof t !== "object") return;
      var name = typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Template";
      var activities = Array.isArray(t.activities) ? t.activities : [];
      var cleanActivities = activities.map(function(a){
        var cat = a && App.Challenge.CATEGORIES[a.cat] ? a.cat : "mind";
        return { id: U.uid(), name: a && typeof a.name === "string" && a.name.trim() ? a.name.trim() : "Activity", cat: cat };
      });
      out.push({
        id: typeof t.id === "string" ? t.id : U.uid(),
        name: name,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
        activities: cleanActivities
      });
    });
    return out;
  }

  function sanitizeHistory(history){
    var out = [];
    var list = Array.isArray(history) ? history : [];
    list.forEach(function(entry){
      if(!entry || typeof entry !== "object") return;
      var cycle = App.Challenge.sanitizeCycle(entry.cycle);
      out.push({
        id: typeof entry.id === "string" ? entry.id : U.uid(),
        archivedAt: typeof entry.archivedAt === "string" ? entry.archivedAt : new Date().toISOString(),
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : ("Cycle " + (out.length + 1)),
        cycle: cycle
      });
    });
    return out;
  }

  function sanitizeDays(days){
    var out = {};
    var d = (days && typeof days === "object") ? days : {};
    Object.keys(d).forEach(function(k){
      if(/^\d{4}-\d{2}-\d{2}$/.test(k)) out[k] = App.Habits.normalizeDay(d[k]);
    });
    return out;
  }

  function sanitizeSubjectRotation(data){
    var def = defaultSubjectRotation();
    if (!data || !Array.isArray(data) || data.length !== 7) return def;
    return data.map(function(day, idx) {
      if (!Array.isArray(day) || day.length !== 4) return def[idx];
      return day.map(function(s) { return typeof s === "string" ? s : ""; });
    });
  }

  function sanitizeRoutineBlocks(data){
    var def = defaultRoutineBlocks();
    if (!Array.isArray(data) || data.length === 0) return def;
    return data.map(function(item) {
      return {
        id: typeof item.id === "string" ? item.id : U.uid(),
        time: typeof item.time === "string" ? item.time : "",
        name: typeof item.name === "string" ? item.name : "",
        task: typeof item.task === "string" ? item.task : ""
      };
    });
  }

  function sanitizeState(s){
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: sanitizeMeta(s && s.meta),
      cycle: App.Challenge.sanitizeCycle(s && s.cycle),
      history: sanitizeHistory(s && s.history),
      cycleTemplates: sanitizeCycleTemplates(s && s.cycleTemplates),
      challengeNotes: sanitizeChallengeNotes(s && s.challengeNotes),
      days: sanitizeDays(s && s.days),
      subjectRotation: sanitizeSubjectRotation(s && s.subjectRotation),
      routineBlocks: sanitizeRoutineBlocks(s && s.routineBlocks)
    };
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
    var result = { cycle: null, days: {}, subjectRotation: null, routineBlocks: null };
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
    if(!result.subjectRotation) result.subjectRotation = defaultSubjectRotation();
    if(!result.routineBlocks) result.routineBlocks = defaultRoutineBlocks();
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
        if(parsed && parsed.cycle) {
          // migrate older versions
          if (!parsed.subjectRotation) parsed.subjectRotation = defaultSubjectRotation();
          if (!parsed.routineBlocks) parsed.routineBlocks = defaultRoutineBlocks();
          return sanitizeState(parsed);
        }
      }
    }catch(e){ console.error("Could not read saved tracker data:", e); }

    var legacy = tryMigrateLegacy();
    if(legacy){
      migrated = true;
      var sanitized = sanitizeState(legacy);
      persist(sanitized);
      return sanitized;
    }
    // fresh start
    return sanitizeState({
      cycle: App.Challenge.defaultCycle(),
      days: {},
      subjectRotation: defaultSubjectRotation(),
      routineBlocks: defaultRoutineBlocks()
    });
  }

  function init(){
    state = load();
  }

  function save(){ persist(state); }

  function markBackupDownloaded(filename){
    if(!state.meta) state.meta = sanitizeMeta({});
    state.meta.lastBackupAt = new Date().toISOString();
    state.meta.lastBackupFile = filename || "";
    save();
  }

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

  // ---- new getters/setters ----
  function getSubjectRotation() {
    return state.subjectRotation || defaultSubjectRotation();
  }
  function setSubjectRotation(rotation) {
    state.subjectRotation = sanitizeSubjectRotation(rotation);
    save();
  }
  function getRoutineBlocks() {
    return state.routineBlocks || defaultRoutineBlocks();
  }
  function setRoutineBlocks(blocks) {
    state.routineBlocks = sanitizeRoutineBlocks(blocks);
    save();
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    init: init,
    save: save,
    markBackupDownloaded: markBackupDownloaded,
    get state(){ return state; },
    getDay: getDay,
    mutateDay: mutateDay,
    replaceState: replaceState,
    replaceCycle: replaceCycle,
    sanitizeState: sanitizeState,
    isValidUnified: isValidUnified,
    isLegacyCycleBackup: isLegacyCycleBackup,
    get migrated(){ return migrated; },
    getSubjectRotation: getSubjectRotation,
    setSubjectRotation: setSubjectRotation,
    getRoutineBlocks: getRoutineBlocks,
    setRoutineBlocks: setRoutineBlocks,
    defaultSubjectRotation: defaultSubjectRotation,
    defaultRoutineBlocks: defaultRoutineBlocks
  };
})();
