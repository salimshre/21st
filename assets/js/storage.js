/* ============================================================
   storage.js – Unified data layer with versioning, auto-backup,
   custom lists, memoisation, and schema v2.
   FIXED: sanitizeDays no longer calls App.Habits.normalizeDay
   at load time – normalization happens in getDay() instead.
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
  function showToast(msg, duration, type, undoCallback){
    if(!toastEl) toastEl = document.getElementById("toast");
    if(!toastEl) return;
    toastEl.className = "toast";
    if(type) toastEl.classList.add("toast-" + type);
    toastEl.innerHTML = msg;
    if(undoCallback){
      var btn = document.createElement("button");
      btn.className = "undo-btn";
      btn.textContent = "Undo";
      btn.style.marginLeft = "10px";
      btn.onclick = function(e){
        e.stopPropagation();
        undoCallback();
        hideToast();
      };
      toastEl.appendChild(btn);
    }
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    if(duration !== 0){
      toastTimer = setTimeout(hideToast, duration || 3000);
    }
  }
  function hideToast(){
    if(toastEl) toastEl.classList.remove("show");
    clearTimeout(toastTimer);
  }

  function debounce(fn, delay){
    var timer = null;
    return function(){
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function(){ fn.apply(self, args); }, delay);
    };
  }

  function memoize(fn){
    var cache = {};
    return function(key){
      if(cache[key] !== undefined) return cache[key];
      var result = fn.apply(this, arguments);
      cache[key] = result;
      return result;
    };
  }

  return {
    pad: pad, todayDate: todayDate, toKey: toKey, keyToDate: keyToDate, todayKey: todayKey,
    addDays: addDays, fmtWeekdayDate: fmtWeekdayDate, clamp: clamp, uid: uid, escapeHtml: escapeHtml,
    csvEscape: csvEscape, toCsv: toCsv, downloadBlob: downloadBlob,
    showToast: showToast, hideToast: hideToast, debounce: debounce, memoize: memoize
  };
})();

App.Storage = (function(){
  "use strict";
  var U = App.Util;

  var SCHEMA_VERSION = 2;
  var STORAGE_KEY = "routineos_unified_v2";
  var LEGACY_CYCLE_KEY = "challenge21_v2";
  var LEGACY_DAY_PREFIX = "day:";

  var state = null;
  var migrated = false;
  var _memoCache = {};

  // ---- Default lists ----
  function defaultHabitList(){
    return [
      {id:"alarm", label:"Alarm clock used (no phone)"},
      {id:"affirm", label:"Affirmation done"},
      {id:"workout", label:"Workout completed"},
      {id:"breakfast", label:"Breakfast eaten (no screen)"},
      {id:"study_blocks", label:"All 4 study blocks done"},
      {id:"lunch", label:"Lunch before 1:30 PM"},
      {id:"review", label:"Evening review done"},
      {id:"device_off", label:"Device off by 22:30"},
      {id:"presleep", label:"Pre-sleep note reading"},
      {id:"sleep", label:"Slept by 23:00"}
    ];
  }
  function defaultRoutineBlocks(){
    return [
      {id:"wake", time:"06:00 – 06:05", name:"Wake-up", task:"Affirmation, positive thought, today's to-do"},
      {id:"workout_block", time:"06:05 – 07:30", name:"Workout", task:"Bhutkhel workout according to weekly plan"},
      {id:"breakfast_block", time:"07:30 – 08:00", name:"Breakfast", task:"Proper breakfast, no screen"},
      {id:"study_a", time:"08:00 – 10:00", name:"Study A", task:"Step 1 x 4 pomodoros"},
      {id:"break_1", time:"10:00 – 10:20", name:"Long Break", task:"Walk, water, rest away from desk"},
      {id:"study_b", time:"10:20 – 12:20", name:"Study B", task:"Step 1 x 4 pomodoros"},
      {id:"prep", time:"12:20 – 12:30", name:"Prep", task:"Pack steel lunchbox, quick rest"},
      {id:"lunch_block", time:"12:30 – 13:30", name:"Lunch", task:"Eat lunch, no screen"},
      {id:"study_c", time:"13:30 – 15:30", name:"Study C", task:"Step 1 x 4 pomodoros"},
      {id:"break_2", time:"15:30 – 15:50", name:"Long Break", task:"Walk, stretch, hydrate"},
      {id:"study_d", time:"15:50 – 17:30", name:"Study D", task:"Weak subject or revision, 3 pomodoros"},
      {id:"free_time", time:"17:30 – 18:00", name:"Free Time", task:"Rest, social, phone, guilt-free"},
      {id:"dinner", time:"18:00 – 19:00", name:"Dinner", task:"Prep, eat, rest"},
      {id:"review_block", time:"19:00 – 21:00", name:"Review", task:"Flashcards and today's material only"},
      {id:"light_work", time:"21:00 – 22:30", name:"Light Work", task:"Blog, project, reading, or creative work"},
      {id:"wind_down", time:"22:30 – 23:00", name:"Wind-down", task:"Read today's subject notes, one sentence for tomorrow"},
      {id:"sleep_block", time:"23:00", name:"Sleep", task:"Device off, lights off"}
    ];
  }

  // ---- Sanitizers ----
  function sanitizeCustomLists(lists){
    var out = { habits: [], routine: [] };
    if(lists && typeof lists === "object"){
      if(Array.isArray(lists.habits)){
        out.habits = lists.habits.filter(function(h){ return h && typeof h.id === "string" && typeof h.label === "string"; });
      }
      if(Array.isArray(lists.routine)){
        out.routine = lists.routine.filter(function(r){ return r && typeof r.id === "string" && typeof r.name === "string"; });
      }
    }
    if(!out.habits.length) out.habits = defaultHabitList();
    if(!out.routine.length) out.routine = defaultRoutineBlocks();
    return out;
  }

  function sanitizeMeta(meta){
    var m = (meta && typeof meta === "object") ? meta : {};
    return {
      lastBackupAt: typeof m.lastBackupAt === "string" ? m.lastBackupAt : "",
      lastBackupFile: typeof m.lastBackupFile === "string" ? m.lastBackupFile : "",
      firstVisit: typeof m.firstVisit === "string" ? m.firstVisit : U.todayKey(),
      tourCompleted: !!m.tourCompleted,
      focusMode: !!m.focusMode,
      language: typeof m.language === "string" ? m.language : "en"
    };
  }

  function sanitizeCycles(cycles){
    var out = [];
    var list = Array.isArray(cycles) ? cycles : [];
    list.forEach(function(c){
      out.push(App.Challenge.sanitizeCycle(c));
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

  // ---- FIX: sanitizeDays now preserves raw data instead of normalizing ----
  function sanitizeDays(days){
    var out = {};
    var d = (days && typeof days === "object") ? days : {};
    Object.keys(d).forEach(function(k){
      if(/^\d{4}-\d{2}-\d{2}$/.test(k)){
        // Keep the raw data as-is; normalization happens in getDay()
        out[k] = d[k];
      }
    });
    return out;
  }

  function sanitizeState(s){
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: sanitizeMeta(s && s.meta),
      customLists: sanitizeCustomLists(s && s.customLists),
      cycle: App.Challenge.sanitizeCycle(s && s.cycle),
      cycles: sanitizeCycles(s && s.cycles),
      history: sanitizeHistory(s && s.history),
      cycleTemplates: sanitizeCycleTemplates(s && s.cycleTemplates),
      challengeNotes: sanitizeChallengeNotes(s && s.challengeNotes),
      days: sanitizeDays(s && s.days)
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
      sanitized.customLists = { habits: defaultHabitList(), routine: defaultRoutineBlocks() };
      persist(sanitized);
      return sanitized;
    }
    var fresh = sanitizeState({ cycle: App.Challenge.defaultCycle(), days: {} });
    fresh.customLists = { habits: defaultHabitList(), routine: defaultRoutineBlocks() };
    return fresh;
  }

  function invalidateCache(){
    _memoCache = {};
  }

  function save(){
    persist(state);
    invalidateCache();
  }

  function markBackupDownloaded(filename){
    if(!state.meta) state.meta = sanitizeMeta({});
    state.meta.lastBackupAt = new Date().toISOString();
    state.meta.lastBackupFile = filename || "";
    save();
  }

  // ---- FIX: getDay now normalizes on access ----
  function getDay(key){
    var raw = state.days[key] || {};
    // Normalize only when accessed – by then App.Habits is fully loaded
    return App.Habits.normalizeDay(raw);
  }

  function mutateDay(key, fn){
    if(!state.days[key]) state.days[key] = {};
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

  function getHabits(){
    return state.customLists.habits;
  }

  function getRoutineBlocks(){
    return state.customLists.routine;
  }

  function updateHabits(newList){
    state.customLists.habits = newList;
    save();
  }

  function updateRoutineBlocks(newList){
    state.customLists.routine = newList;
    save();
  }

  function getCycles(){
    return state.cycles || [];
  }

  function addCycle(cycle){
    if(!Array.isArray(state.cycles)) state.cycles = [];
    state.cycles.push(App.Challenge.sanitizeCycle(cycle));
    save();
  }

  function removeCycle(index){
    if(Array.isArray(state.cycles) && state.cycles[index]){
      state.cycles.splice(index, 1);
      save();
    }
  }

  function init(){
    state = load();
    if(!state.customLists) state.customLists = { habits: defaultHabitList(), routine: defaultRoutineBlocks() };
    save();
  }

  function scheduleAutoBackup(){
    var now = new Date();
    var night = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    var msToMidnight = night.getTime() - now.getTime();
    setTimeout(function(){
      var filename = "auto-backup-" + U.todayKey() + ".json";
      U.downloadBlob(JSON.stringify(state, null, 2), "application/json", filename);
      markBackupDownloaded(filename);
      U.showToast("Auto-backup saved: " + filename, 4000, "success");
      scheduleAutoBackup();
    }, msToMidnight + 1000);
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
    getHabits: getHabits,
    getRoutineBlocks: getRoutineBlocks,
    updateHabits: updateHabits,
    updateRoutineBlocks: updateRoutineBlocks,
    getCycles: getCycles,
    addCycle: addCycle,
    removeCycle: removeCycle,
    scheduleAutoBackup: scheduleAutoBackup,
    sanitizeState: sanitizeState,
    isValidUnified: isValidUnified,
    isLegacyCycleBackup: isLegacyCycleBackup,
    get migrated(){ return migrated; },
    invalidateCache: invalidateCache
  };
})();
