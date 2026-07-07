/* ============================================================
   challenge.js – 21-Day challenge with reorder, multiple cycles,
   memoised stats, and auto-advance on refresh if cycle is complete.
   ============================================================ */

App.Challenge = (function(){
  "use strict";
  var U = App.Util;

  var DAYS_IN_CYCLE = 21;
  var currentCycleView = "current";
  var cycleCategoryFilter = "all";
  var cycleSearchTerm = "";
  var cycleCompactMode = false;

  var CATEGORIES = {
    mind:       { label:"🧠 Mind",       varName:"--mind" },
    learning:   { label:"📚 Learning",   varName:"--learning" },
    discipline: { label:"💪 Discipline", varName:"--discipline" },
    health:     { label:"🧍 Health",     varName:"--health" },
    diet:       { label:"🥗 Diet",       varName:"--diet" }
  };
  var CAT_ORDER = ["mind","learning","discipline","health","diet"];

  var DEFAULT_ACTIVITIES = [
    {name:"Affirmation",      cat:"mind",       checks:[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Meditate (5m)",    cat:"mind",       checks:[1,1,1,1,0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Gratitude",        cat:"mind",       checks:[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Self Talk (1m)",   cat:"mind",       checks:[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Journal",          cat:"mind",       checks:[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Study 3h",         cat:"learning",   checks:[1,1,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"Read 1p",          cat:"learning",   checks:[1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Plan Tmrw (5m)",   cat:"learning",   checks:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Wake < 6",         cat:"discipline", checks:[0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Sleep < 11",       cat:"discipline", checks:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"No Phone Bed",     cat:"discipline", checks:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Avoid Temptation", cat:"discipline", checks:[1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Digital Detox",    cat:"health",     checks:[1,0,1,0,1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Workout (3s)",     cat:"health",     checks:[0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"45m outdoor",      cat:"health",     checks:[1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Wash (AM)",        cat:"health",     checks:[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Running (PM)",     cat:"health",     checks:[0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Photo Hair",       cat:"health",     checks:[1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"Vitamin D (15m)",  cat:"health",     checks:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},
    {name:"2-4L Water",       cat:"diet",       checks:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0]},
    {name:"No Junk",          cat:"diet",       checks:[1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0]}
  ];
  var SEED_START_DATE = "2026-06-03";

  // ---- Cycle shape ----
  function defaultCycle(){
    var acts = DEFAULT_ACTIVITIES.map(function(a){ return { id:U.uid(), name:a.name, cat:a.cat }; });
    var checks = {};
    acts.forEach(function(a, i){
      var seed = DEFAULT_ACTIVITIES[i].checks;
      checks[a.id] = seed ? seed.map(function(v){ return !!v; }) : new Array(DAYS_IN_CYCLE).fill(false);
    });
    return { startDate: SEED_START_DATE, activities: acts, checks: checks };
  }

  function sanitizeCycle(cycle){
    var c = (cycle && typeof cycle === "object") ? cycle : defaultCycle();
    if(typeof c.startDate !== "string") c.startDate = U.todayKey();
    if(!Array.isArray(c.activities)) c.activities = [];
    if(!c.checks || typeof c.checks !== "object") c.checks = {};
    c.activities.forEach(function(a){
      if(!a.id) a.id = U.uid();
      if(!CATEGORIES[a.cat]) a.cat = "mind";
      var arr = c.checks[a.id];
      if(!Array.isArray(arr)){
        c.checks[a.id] = new Array(DAYS_IN_CYCLE).fill(false);
      } else if(arr.length !== DAYS_IN_CYCLE){
        var fixed = new Array(DAYS_IN_CYCLE).fill(false);
        for(var i=0; i<Math.min(arr.length, DAYS_IN_CYCLE); i++) fixed[i] = !!arr[i];
        c.checks[a.id] = fixed;
      } else {
        c.checks[a.id] = arr.map(function(v){ return !!v; });
      }
    });
    return c;
  }

  // ---- Memoised stats ----
  var _statsCache = {};
  function computeCycleStats(cycle){
    var key = cycle ? JSON.stringify(cycle) : "current";
    if(_statsCache[key]) return _statsCache[key];
    cycle = cycle || App.Storage.state.cycle;
    var totalChecked = 0, totalCells = 0;
    var catChecked = {}, catTotal = {};
    CAT_ORDER.forEach(function(c){ catChecked[c]=0; catTotal[c]=0; });
    cycle.activities.forEach(function(a){
      var arr = cycle.checks[a.id] || [];
      var c = arr.filter(Boolean).length;
      totalChecked += c; totalCells += DAYS_IN_CYCLE;
      if(catTotal[a.cat] === undefined){ catTotal[a.cat]=0; catChecked[a.cat]=0; }
      catChecked[a.cat] += c; catTotal[a.cat] += DAYS_IN_CYCLE;
    });
    var result = { overallPct: totalCells ? Math.round((totalChecked/totalCells)*100) : 0, catChecked:catChecked, catTotal:catTotal };
    _statsCache[key] = result;
    return result;
  }

  function invalidateStatsCache(){ _statsCache = {}; }

  // ---- Multiple cycles ----
  function getActiveCycles(){
    return App.Storage.getCycles() || [];
  }

  function addCycle(cycle){
    App.Storage.addCycle(sanitizeCycle(cycle));
    invalidateStatsCache();
  }

  function removeCycle(index){
    App.Storage.removeCycle(index);
    invalidateStatsCache();
  }

  // ---- Viewing cycle ----
  function getViewingCycle(){
    if(currentCycleView !== "current"){
      var cycles = getActiveCycles();
      var idx = parseInt(currentCycleView, 10);
      if(!isNaN(idx) && cycles[idx]) return cycles[idx];
      currentCycleView = "current";
    }
    return App.Storage.state.cycle;
  }

  function isViewingHistory(){
    return currentCycleView !== "current";
  }

  // ---- Helpers ----
  function cloneCycle(cycle){ return sanitizeCycle(JSON.parse(JSON.stringify(cycle))); }
  function cycleLabel(cycle){ return U.fmtWeekdayDate(cycle.startDate) + " - " + U.fmtWeekdayDate(U.addDays(cycle.startDate, DAYS_IN_CYCLE - 1)); }
  function archivedLabel(entry){ var archivedKey = (entry.archivedAt || "").slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(archivedKey) ? U.fmtWeekdayDate(archivedKey) : "unknown date"; }
  function cycleScore(cycle){ return computeCycleStats(cycle).overallPct; }
  function getHistoryEntry(id){ var history = App.Storage.state.history || []; return history.find(function(entry){ return entry.id === id; }) || null; }

  function groupedActivities(cycle){
    cycle = cycle || getViewingCycle();
    var groups = {};
    CAT_ORDER.forEach(function(c){ groups[c] = []; });
    cycle.activities.forEach(function(a){
      if(!groups[a.cat]) groups[a.cat] = [];
      groups[a.cat].push(a);
    });
    var out = [];
    CAT_ORDER.forEach(function(c){ out = out.concat(groups[c]); });
    return out;
  }

  function filteredActivities(cycle){
    var term = cycleSearchTerm.trim().toLowerCase();
    return groupedActivities(cycle).filter(function(a){
      if(cycleCategoryFilter !== "all" && a.cat !== cycleCategoryFilter) return false;
      if(term && a.name.toLowerCase().indexOf(term) === -1) return false;
      return true;
    });
  }

  function dayIndexForDate(key){
    var state = App.Storage.state;
    var start = U.keyToDate(state.cycle.startDate);
    var d = U.keyToDate(key);
    return Math.round((d - start) / 86400000) + 1;
  }

  function challengeDayIndex(){ return dayIndexForDate(App.curKey) - 1; }

  // ---- DOM refs ----
  var dom = {};
  function cacheDom(){
    dom.cycleStartInput = document.getElementById("cycleStartInput");
    dom.cycleHistorySelect = document.getElementById("cycleHistorySelect");
    dom.cycleHistoryStatus = document.getElementById("cycleHistoryStatus");
    dom.archiveCycleBtn = document.getElementById("archiveCycleBtn");
    dom.renameCycleBtn = document.getElementById("renameCycleBtn");
    dom.restoreCycleBtn = document.getElementById("restoreCycleBtn");
    dom.deleteCycleBtn = document.getElementById("deleteCycleBtn");
    dom.cycleCategoryFilter = document.getElementById("cycleCategoryFilter");
    dom.cycleSearchInput = document.getElementById("cycleSearchInput");
    dom.cycleCompactToggle = document.getElementById("cycleCompactToggle");
    dom.cycleTemplateSelect = document.getElementById("cycleTemplateSelect");
    dom.saveTemplateBtn = document.getElementById("saveTemplateBtn");
    dom.startTemplateBtn = document.getElementById("startTemplateBtn");
    dom.challengeAttention = document.getElementById("challengeAttention");
    dom.cycleOverallPct = document.getElementById("cycleOverallPct");
    dom.cycleOverallBar = document.getElementById("cycleOverallBar");
    dom.cycleCatWrap = document.getElementById("cycleCatWrap");
    dom.cycleTable = document.getElementById("cycleTable");
    dom.cycleHeadRow = document.getElementById("cycleHeadRow");
    dom.cycleBody = document.getElementById("cycleBody");
    dom.newActName = document.getElementById("newActName");
    dom.newActCat = document.getElementById("newActCat");
    dom.addActBtn = document.getElementById("addActBtn");
    dom.challengeChecklist = document.getElementById("challengeChecklist");
    dom.challengeDayNote = document.getElementById("challengeDayNote");
    dom.quickStartCycle = document.getElementById("quickStartCycle");
  }

  // ---- Render functions ----
  function populateCategorySelect(){
    CAT_ORDER.forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key; opt.textContent = CATEGORIES[key].label;
      dom.newActCat.appendChild(opt);
      var filterOpt = document.createElement("option");
      filterOpt.value = key; filterOpt.textContent = CATEGORIES[key].label;
      dom.cycleCategoryFilter.appendChild(filterOpt);
    });
  }

  function renderHistoryControls(){
    var history = App.Storage.state.history || [];
    var templates = App.Storage.state.cycleTemplates || [];
    if(isViewingHistory() && !getHistoryEntry(currentCycleView)) currentCycleView = "current";

    dom.cycleHistorySelect.innerHTML =
      '<option value="current">Current cycle</option>' +
      history.map(function(entry){
        var label = entry.label || cycleLabel(entry.cycle);
        return '<option value="'+U.escapeHtml(entry.id)+'">'+U.escapeHtml(label)+' · '+cycleScore(entry.cycle)+'%</option>';
      }).join("");
    dom.cycleHistorySelect.value = currentCycleView;
    dom.cycleTemplateSelect.innerHTML =
      '<option value="">Templates</option>' +
      templates.map(function(t){ return '<option value="'+U.escapeHtml(t.id)+'">'+U.escapeHtml(t.name)+'</option>'; }).join("");

    var viewingHistory = isViewingHistory();
    var entry = viewingHistory ? getHistoryEntry(currentCycleView) : null;
    dom.cycleHistoryStatus.textContent = viewingHistory && entry
      ? "Archived " + archivedLabel(entry)
      : (history.length ? history.length + " archived cycle" + (history.length === 1 ? "" : "s") : "No archived cycles yet");

    dom.cycleStartInput.disabled = viewingHistory;
    dom.newActName.disabled = viewingHistory;
    dom.newActCat.disabled = viewingHistory;
    dom.addActBtn.disabled = viewingHistory;
    dom.renameCycleBtn.disabled = !viewingHistory;
    dom.restoreCycleBtn.disabled = !viewingHistory;
    dom.deleteCycleBtn.disabled = !viewingHistory;
    dom.startTemplateBtn.disabled = !dom.cycleTemplateSelect.value;
    dom.cycleTable.classList.toggle("is-history-preview", viewingHistory);
  }

  function renderChallengeAttention(){
    if(!dom.challengeAttention) return;
    var cycle = App.Storage.state.cycle;
    var currentIdx = dayIndexForDate(U.todayKey()) - 1;
    if(currentIdx < 0){
      dom.challengeAttention.innerHTML = '<div class="challenge-empty">The active cycle has not started yet.</div>';
      return;
    }
    var maxIdx = U.clamp(currentIdx, 0, DAYS_IN_CYCLE - 1);
    var rows = groupedActivities(cycle).map(function(a){
      var arr = cycle.checks[a.id] || [];
      var misses = 0, streak = 0;
      for(var i=0; i<=maxIdx; i++) if(!arr[i]) misses++;
      for(var j=maxIdx; j>=0; j--){
        if(arr[j]) break;
        streak++;
      }
      return { activity:a, misses:misses, streak:streak };
    }).filter(function(x){ return x.misses > 0; })
      .sort(function(a,b){ return b.streak - a.streak || b.misses - a.misses; })
      .slice(0, 5);

    if(!rows.length){
      dom.challengeAttention.innerHTML = '<div class="challenge-empty">No missed challenge tasks in the active cycle yet.</div>';
      return;
    }
    dom.challengeAttention.innerHTML =
      '<div class="attention-head">Needs attention</div>' +
      rows.map(function(x){
        var cat = CATEGORIES[x.activity.cat] || CATEGORIES.mind;
        return '<div class="attention-row"><span class="cat-pill" style="background:var('+cat.varName+'-tint);color:var('+cat.varName+')">'+cat.label+'</span>' +
          '<span class="attention-name">'+U.escapeHtml(x.activity.name)+'</span>' +
          '<span class="attention-meta">'+x.misses+' missed · '+x.streak+' day streak</span></div>';
      }).join("");
  }

  function renderCycleDash(){
    var cycle = getViewingCycle();
    renderHistoryControls();
    dom.cycleStartInput.value = cycle.startDate;
    var stats = computeCycleStats(cycle);
    dom.cycleOverallPct.textContent = stats.overallPct + "%";
    dom.cycleOverallBar.style.width = stats.overallPct + "%";
    dom.cycleCatWrap.innerHTML = CAT_ORDER.map(function(c){
      if(!stats.catTotal[c]) return "";
      var cat = CATEGORIES[c];
      var pct = Math.round((stats.catChecked[c] / stats.catTotal[c]) * 100);
      return '<div class="cat-mini"><div class="top"><span class="name">'+cat.label+'</span><span class="pct" style="color:var('+cat.varName+')">'+pct+'%</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var('+cat.varName+')"></div></div></div>';
    }).join("");
    renderChallengeAttention();
  }

  function buildCycleHeader(){
    Array.from(dom.cycleHeadRow.querySelectorAll("th.col-day")).forEach(function(th){ th.remove(); });
    var scoreTh = dom.cycleHeadRow.querySelector(".col-score");
    var cycle = getViewingCycle();
    var dayIndexes = cycleCompactMode ? [U.clamp(dayIndexForDate(App.curKey)-1, 0, DAYS_IN_CYCLE-1)] : Array.from({length:DAYS_IN_CYCLE}, function(_,i){ return i; });
    dayIndexes.forEach(function(dayIdx){
      var th = document.createElement("th");
      th.className = "col-day";
      th.scope = "col";
      th.textContent = "D" + (dayIdx + 1);
      th.dataset.dayIdx = dayIdx + 1;
      dom.cycleHeadRow.insertBefore(th, scoreTh);
    });
  }

  function updateScoreCell(tr, activityId){
    var cycle = getViewingCycle();
    var arr = cycle.checks[activityId] || [];
    var n = arr.filter(Boolean).length;
    var scoreTxt = tr.querySelector(".score-txt");
    var barFill = tr.querySelector(".col-score .score-bar > div");
    if(scoreTxt) scoreTxt.textContent = n + "/" + DAYS_IN_CYCLE;
    if(barFill) barFill.style.width = Math.round((n/DAYS_IN_CYCLE)*100) + "%";
  }

  function renderCycleBody(){
    var cycle = getViewingCycle();
    dom.cycleBody.innerHTML = "";
    var ordered = filteredActivities(cycle);
    var viewingHistory = isViewingHistory();
    var dayIndexes = cycleCompactMode ? [U.clamp(dayIndexForDate(App.curKey)-1, 0, DAYS_IN_CYCLE-1)] : Array.from({length:DAYS_IN_CYCLE}, function(_,i){ return i; });

    ordered.forEach(function(a, idx){
      var cat = CATEGORIES[a.cat] || CATEGORIES.mind;
      var tr = document.createElement("tr");
      tr.dataset.activityId = a.id;
      tr.draggable = !viewingHistory;

      var tdSn = document.createElement("td");
      tdSn.className = "col-sn";
      tdSn.textContent = idx + 1;
      tr.appendChild(tdSn);

      var tdAct = document.createElement("td");
      tdAct.className = "col-activity";
      var tools = document.createElement("div");
      tools.className = "act-row-tools";
      var nameSpan = document.createElement("span");
      nameSpan.className = "act-name";
      nameSpan.contentEditable = viewingHistory ? "false" : "true";
      nameSpan.spellcheck = false;
      nameSpan.textContent = a.name;
      nameSpan.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); nameSpan.blur(); } });
      var delBtn = document.createElement("button");
      delBtn.className = "del-btn"; delBtn.type = "button"; delBtn.title = "Delete activity";
      delBtn.setAttribute("aria-label", "Delete " + a.name);
      delBtn.textContent = "✕";
      tools.appendChild(nameSpan);
      if(!viewingHistory) tools.appendChild(delBtn);
      tdAct.appendChild(tools);
      tr.appendChild(tdAct);

      var tdCat = document.createElement("td");
      tdCat.className = "col-cat";
      var pill = document.createElement("span");
      pill.className = "cat-pill";
      pill.style.background = "var(" + cat.varName + "-tint)";
      pill.style.color = "var(" + cat.varName + ")";
      pill.textContent = cat.label;
      tdCat.appendChild(pill);
      tr.appendChild(tdCat);

      var checksArr = cycle.checks[a.id] || new Array(DAYS_IN_CYCLE).fill(false);

      dayIndexes.forEach(function(d){
        var tdDay = document.createElement("td");
        tdDay.className = "col-day";
        tdDay.dataset.dayIdx = d + 1;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chk" + (checksArr[d] ? " on" : "");
        btn.disabled = viewingHistory;
        btn.dataset.day = d;
        btn.setAttribute("aria-pressed", checksArr[d] ? "true" : "false");
        btn.setAttribute("aria-label", a.name + " — Day " + (d+1));
        btn.textContent = "✓";
        if(checksArr[d]){
          btn.style.background = "var(" + cat.varName + ")";
          btn.style.borderColor = "var(" + cat.varName + ")";
        }
        tdDay.appendChild(btn);
        tr.appendChild(tdDay);
      });

      var tdScore = document.createElement("td");
      tdScore.className = "col-score";
      var scoreTxt = document.createElement("span");
      scoreTxt.className = "score-txt";
      var barTrack = document.createElement("div");
      barTrack.className = "score-bar";
      var barFill = document.createElement("div");
      barFill.style.background = "var(" + cat.varName + ")";
      barTrack.appendChild(barFill);
      tdScore.appendChild(scoreTxt);
      tdScore.appendChild(barTrack);
      tr.appendChild(tdScore);

      dom.cycleBody.appendChild(tr);
      updateScoreCell(tr, a.id);
    });

    updateCycleHighlight();
  }

  function rebuildCycleTable(){
    buildCycleHeader();
    renderCycleBody();
  }

  function updateCycleHighlight(){
    var cycle = getViewingCycle();
    var start = cycle.startDate;
    var todayIdx = Math.round((U.keyToDate(U.todayKey()) - U.keyToDate(start)) / 86400000) + 1;
    var viewIdx = Math.round((U.keyToDate(App.curKey) - U.keyToDate(start)) / 86400000) + 1;
    document.querySelectorAll("#cycleHeadRow th.col-day").forEach(function(th){
      var i = Number(th.dataset.dayIdx);
      th.classList.toggle("is-today", i === todayIdx);
      th.classList.toggle("is-viewing", i === viewIdx);
    });
    document.querySelectorAll("#cycleBody td.col-day").forEach(function(td){
      var i = Number(td.dataset.dayIdx);
      td.classList.toggle("is-today", i === todayIdx);
      td.classList.toggle("is-viewing", i === viewIdx);
    });
  }

  function scrollToViewingColumn(){
    var th = dom.cycleHeadRow.querySelector("th.col-day.is-viewing");
    if(th && th.scrollIntoView) th.scrollIntoView({ inline:"center", block:"nearest" });
  }

  function renderChallengeDayNote(){
    if(!dom.challengeDayNote) return;
    var cycle = App.Storage.state.cycle;
    var dayIdx = challengeDayIndex();
    var inCycle = dayIdx >= 0 && dayIdx < DAYS_IN_CYCLE;
    dom.challengeDayNote.disabled = !inCycle;
    if(!inCycle){
      dom.challengeDayNote.value = "";
      dom.challengeDayNote.placeholder = "Challenge notes are available for dates inside the active cycle.";
      return;
    }
    var notes = App.Storage.state.challengeNotes || {};
    var cycleNotes = notes[cycle.startDate] || {};
    dom.challengeDayNote.placeholder = "What worked, what failed, and what needs attention tomorrow?";
    dom.challengeDayNote.value = cycleNotes[dayIdx] || "";
  }

  function renderChallengeChecklist(){
    var state = App.Storage.state;
    var dayIdx = challengeDayIndex();
    var cats = {};
    CAT_ORDER.forEach(function(c){ cats[c] = []; });
    state.cycle.activities.forEach(function(a){
      if(!cats[a.cat]) cats[a.cat] = [];
      cats[a.cat].push(a);
    });

    if(dayIdx < 0){
      dom.challengeChecklist.innerHTML =
        '<div class="challenge-empty">This cycle starts on '+U.escapeHtml(U.fmtWeekdayDate(state.cycle.startDate))+'. Move to that date to begin checking tasks.</div>';
      renderChallengeDayNote();
      return;
    }

    if(dayIdx >= DAYS_IN_CYCLE){
      // Auto-start a new cycle instead of showing the message
      // This is the fix for the "start next cycle" on refresh
      if(!App.Storage.state._autoCycleStarted){
        App.Storage.state._autoCycleStarted = true;
        // Archive current and start fresh
        startFreshCycle(null, true);
        // Re-render after the cycle is reset
        setTimeout(function(){
          App.setCurKey(U.todayKey());
          App.renderDayNav();
          App.renderHeader();
          U.showToast("New cycle started automatically (previous cycle archived)", 3000, "info");
        }, 100);
      } else {
        dom.challengeChecklist.innerHTML =
          '<div class="challenge-empty challenge-empty-actions">' +
            '<div>This 21-day cycle is complete. Start the next cycle to make today Day 1 again.</div>' +
            '<button type="button" class="inline-action" data-start-next-cycle>Start next 21-day cycle</button>' +
          '</div>';
        renderChallengeDayNote();
      }
      return;
    }

    var body = CAT_ORDER.map(function(catKey){
      var cat = CATEGORIES[catKey];
      var acts = cats[catKey] || [];
      var done = 0;
      if(!acts.length) return "";
      var rows = acts.map(function(a){
        var on = !!((state.cycle.checks[a.id] || [])[dayIdx]);
        if(on) done++;
        return '<label class="challenge-row" data-challenge-id="'+a.id+'" data-cat="'+catKey+'">' +
          '<input class="native-check" type="checkbox" data-challenge-id="'+a.id+'" data-challenge-day="'+dayIdx+'" '+(on?"checked":"")+'>' +
          '<div class="check-box'+(on?" done":"")+'">'+(on?App.Habits.CHECK_SVG:"")+'</div>' +
          '<span class="challenge-name'+(on?" done":"")+'">'+U.escapeHtml(a.name)+'</span></label>';
      }).join("");
      var pct = acts.length ? Math.round((done / acts.length) * 100) : 0;
      return '<div class="challenge-category" data-category="'+catKey+'">' +
        '<div class="challenge-cat-head"><div class="challenge-cat-title"><div class="challenge-cat-name">'+cat.label+'</div><div class="challenge-cat-progress">'+done+"/"+acts.length+' done · '+pct+'%</div></div>' +
        '<div class="challenge-cat-bar" aria-hidden="true"><div style="width:'+pct+'%;background:var('+cat.varName+')"></div></div></div>' +
        rows +
      '</div>';
    }).filter(Boolean).join("");

    if(!body){
      dom.challengeChecklist.innerHTML = '<div class="challenge-empty">No challenge activities are configured yet.</div>';
      renderChallengeDayNote();
      return;
    }
    dom.challengeChecklist.innerHTML = body;
    renderChallengeDayNote();
  }

  // ---- Data tools ----
  function exportCsv(){
    var cycle = getViewingCycle();
    var header = ["Activity","Category"];
    for(var d=1; d<=DAYS_IN_CYCLE; d++) header.push("Day "+d);
    header.push("S.n","Score");
    var rows = [header];
    groupedActivities(cycle).forEach(function(a, idx){
      var cat = CATEGORIES[a.cat] || CATEGORIES.mind;
      var arr = cycle.checks[a.id] || [];
      var row = [a.name, cat.label];
      for(var d2=0; d2<DAYS_IN_CYCLE; d2++) row.push(arr[d2] ? "Yes" : "No");
      row.push(idx+1, arr.filter(Boolean).length + "/" + DAYS_IN_CYCLE);
      rows.push(row);
    });
    var suffix = isViewingHistory() ? "history-" + cycle.startDate : U.todayKey();
    U.downloadBlob(U.toCsv(rows), "text/csv;charset=utf-8;", "21-day-grid-"+suffix+".csv");
  }

  function archiveCurrentCycle(silent){
    var state = App.Storage.state;
    if(!Array.isArray(state.history)) state.history = [];
    state.history.unshift({
      id: U.uid(),
      archivedAt: new Date().toISOString(),
      label: cycleLabel(state.cycle),
      cycle: cloneCycle(state.cycle)
    });
    App.Storage.save();
    rebuildCycleTable();
    renderCycleDash();
    if(!silent) U.showToast("Current cycle archived", 2000, "success");
  }

  function startFreshCycle(confirmText, archiveCurrent){
    if(confirmText && !confirm(confirmText)) return false;
    var state = App.Storage.state;
    if(archiveCurrent) archiveCurrentCycle(true);
    state.cycle.activities.forEach(function(a){ state.cycle.checks[a.id] = new Array(DAYS_IN_CYCLE).fill(false); });
    state.cycle.startDate = U.todayKey();
    currentCycleView = "current";
    // Reset the auto-cycle flag so it doesn't keep triggering
    state._autoCycleStarted = false;
    App.Storage.save();
    invalidateStatsCache();
    rebuildCycleTable();
    renderCycleDash();
    updateCycleHighlight();
    renderChallengeChecklist();
    return true;
  }

  function resetCycle(){
    var msg = isViewingHistory()
      ? "You are previewing an archived cycle. Reset the active current cycle anyway? This clears only the current cycle's 21-day checkmarks and starts it over from today. Archived cycles and daily logs are not affected."
      : "Clear all 21-day checkmarks in the active current cycle and start it over from today? Your daily logs (habits, routine, pomodoros, journal) are not affected. Export a CSV first if you want a record of this cycle.";
    return startFreshCycle(msg, false);
  }

  function startNextCycle(){
    return startFreshCycle("Start a new 21-day cycle from today? Your current 21-day checklist will be archived for preview, then the active cycle starts fresh from today. Your daily logs stay saved.", true);
  }

  // ---- Quick start from header ----
  function quickStartNextCycle(){
    if(!confirm("Start a new 21-day cycle from today? Your current cycle will be archived for preview.")) return;
    startNextCycle();
  }

  // ---- Reorder activities ----
  function reorderActivities(fromIndex, toIndex){
    var cycle = getViewingCycle();
    if(isViewingHistory()) return;
    var acts = cycle.activities;
    if(fromIndex < 0 || fromIndex >= acts.length || toIndex < 0 || toIndex >= acts.length) return;
    var moved = acts.splice(fromIndex, 1)[0];
    acts.splice(toIndex, 0, moved);
    App.Storage.save();
    invalidateStatsCache();
    rebuildCycleTable();
    renderCycleDash();
    U.showToast("Activities reordered", 1500, "success");
  }

  // ---- Events ----
  function wireEvents(){
    dom.cycleBody.addEventListener("click", function(e){
      var chk = e.target.closest(".chk");
      if(chk){
        if(isViewingHistory()) return;
        var tr = chk.closest("tr");
        var id = tr.dataset.activityId;
        var day = Number(chk.dataset.day);
        var state = App.Storage.state;
        var arr = state.cycle.checks[id];
        arr[day] = !arr[day];
        var isOn = arr[day];
        chk.classList.toggle("on", isOn);
        chk.setAttribute("aria-pressed", isOn ? "true" : "false");
        var a = state.cycle.activities.find(function(x){ return x.id === id; });
        var cat = CATEGORIES[(a && a.cat) || "mind"];
        if(isOn){ chk.style.background = "var("+cat.varName+")"; chk.style.borderColor = "var("+cat.varName+")"; }
        else { chk.style.background = ""; chk.style.borderColor = ""; }
        updateScoreCell(tr, id);
        App.Storage.save();
        invalidateStatsCache();
        renderCycleDash();
        App.renderHeader();
        if(day === challengeDayIndex()) renderChallengeChecklist();
        return;
      }
      var del = e.target.closest(".del-btn");
      if(del){
        if(isViewingHistory()) return;
        var tr2 = del.closest("tr");
        var id2 = tr2.dataset.activityId;
        var state2 = App.Storage.state;
        var a2 = state2.cycle.activities.find(function(x){ return x.id === id2; });
        if(a2 && confirm('Delete "'+a2.name+'"? This removes its checkmarks too.')){
          state2.cycle.activities = state2.cycle.activities.filter(function(x){ return x.id !== id2; });
          delete state2.cycle.checks[id2];
          App.Storage.save();
          invalidateStatsCache();
          renderCycleBody();
          renderCycleDash();
          App.renderHeader();
          renderChallengeChecklist();
        }
      }
    });

    dom.cycleBody.addEventListener("focusout", function(e){
      if(isViewingHistory()) return;
      if(!e.target.classList || !e.target.classList.contains("act-name")) return;
      var tr = e.target.closest("tr");
      var id = tr.dataset.activityId;
      var state = App.Storage.state;
      var a = state.cycle.activities.find(function(x){ return x.id === id; });
      if(!a) return;
      var val = e.target.textContent.trim();
      a.name = val || a.name;
      e.target.textContent = a.name;
      tr.querySelectorAll(".chk").forEach(function(b,i){ b.setAttribute("aria-label", a.name+" — Day "+(i+1)); });
      var delBtn = tr.querySelector(".del-btn");
      if(delBtn) delBtn.setAttribute("aria-label", "Delete "+a.name);
      App.Storage.save();
      invalidateStatsCache();
      renderChallengeChecklist();
    });

    dom.cycleStartInput.addEventListener("change", function(){
      if(isViewingHistory()) return;
      if(!dom.cycleStartInput.value) return;
      App.Storage.state.cycle.startDate = dom.cycleStartInput.value;
      App.Storage.save();
      invalidateStatsCache();
      rebuildCycleTable();
      renderCycleDash();
      App.renderDayNav();
      App.renderHeader();
      renderChallengeChecklist();
      scrollToViewingColumn();
    });

    dom.addActBtn.addEventListener("click", function(){
      if(isViewingHistory()) return;
      var name = dom.newActName.value.trim();
      if(!name){ dom.newActName.focus(); return; }
      var cat = dom.newActCat.value;
      var id = U.uid();
      var state = App.Storage.state;
      state.cycle.activities.push({ id:id, name:name, cat:cat });
      state.cycle.checks[id] = new Array(DAYS_IN_CYCLE).fill(false);
      dom.newActName.value = "";
      App.Storage.save();
      invalidateStatsCache();
      renderCycleBody();
      renderCycleDash();
      App.renderHeader();
      renderChallengeChecklist();
    });
    dom.newActName.addEventListener("keydown", function(e){ if(e.key === "Enter") dom.addActBtn.click(); });

    dom.cycleHeadRow.addEventListener("click", function(e){
      var th = e.target.closest("th.col-day");
      if(!th) return;
      if(isViewingHistory()){
        U.showToast("Archived cycle previews are read-only", 2000, "warning");
        return;
      }
      var idx = Number(th.dataset.dayIdx);
      var key = U.addDays(getViewingCycle().startDate, idx - 1);
      if(U.keyToDate(key) > U.todayDate()) return;
      App.switchMainTab("daily");
      App.setCurKey(key);
    });

    dom.cycleHistorySelect.addEventListener("change", function(){
      currentCycleView = dom.cycleHistorySelect.value || "current";
      invalidateStatsCache();
      rebuildCycleTable();
      renderCycleDash();
      updateCycleHighlight();
      scrollToViewingColumn();
    });

    dom.archiveCycleBtn.addEventListener("click", function(){
      if(confirm("Archive a snapshot of the current active cycle? This does not start a new cycle.")){
        archiveCurrentCycle(false);
      }
    });
    dom.renameCycleBtn.addEventListener("click", function(){
      var entry = getHistoryEntry(currentCycleView);
      if(!entry) return;
      var next = prompt("Rename archived cycle", entry.label || cycleLabel(entry.cycle));
      if(next === null) return;
      next = next.trim();
      if(!next) return;
      entry.label = next;
      App.Storage.save();
      renderCycleDash();
    });
    dom.restoreCycleBtn.addEventListener("click", function(){
      var entry = getHistoryEntry(currentCycleView);
      if(!entry) return;
      if(!confirm("Restore this archived cycle as the active current cycle? Your current active cycle will be archived first.")) return;
      archiveCurrentCycle(true);
      App.Storage.state.cycle = cloneCycle(entry.cycle);
      currentCycleView = "current";
      App.Storage.save();
      invalidateStatsCache();
      rebuildCycleTable();
      renderCycleDash();
      renderChallengeChecklist();
      App.renderHeader();
      App.renderDayNav();
      U.showToast("Archived cycle restored", 2000, "success");
    });
    dom.deleteCycleBtn.addEventListener("click", function(){
      var entry = getHistoryEntry(currentCycleView);
      if(!entry) return;
      if(!confirm('Delete archived cycle "'+(entry.label || cycleLabel(entry.cycle))+'"? This does not affect your current cycle.')) return;
      App.Storage.state.history = (App.Storage.state.history || []).filter(function(x){ return x.id !== entry.id; });
      currentCycleView = "current";
      App.Storage.save();
      invalidateStatsCache();
      rebuildCycleTable();
      renderCycleDash();
    });

    dom.cycleCategoryFilter.addEventListener("change", function(){
      cycleCategoryFilter = dom.cycleCategoryFilter.value || "all";
      rebuildCycleTable();
    });
    dom.cycleSearchInput.addEventListener("input", function(){
      cycleSearchTerm = dom.cycleSearchInput.value || "";
      renderCycleBody();
    });
    dom.cycleCompactToggle.addEventListener("change", function(){
      cycleCompactMode = !!dom.cycleCompactToggle.checked;
      rebuildCycleTable();
      scrollToViewingColumn();
    });

    dom.cycleTemplateSelect.addEventListener("change", function(){
      dom.startTemplateBtn.disabled = !dom.cycleTemplateSelect.value;
    });
    dom.saveTemplateBtn.addEventListener("click", function(){
      var name = prompt("Template name", "Challenge template " + U.todayKey());
      if(name === null) return;
      name = name.trim();
      if(!name) return;
      var state = App.Storage.state;
      if(!Array.isArray(state.cycleTemplates)) state.cycleTemplates = [];
      state.cycleTemplates.unshift({
        id: U.uid(),
        name: name,
        createdAt: new Date().toISOString(),
        activities: state.cycle.activities.map(function(a){ return { name:a.name, cat:a.cat }; })
      });
      App.Storage.save();
      renderCycleDash();
      U.showToast("Template saved", 2000, "success");
    });
    dom.startTemplateBtn.addEventListener("click", function(){
      var id = dom.cycleTemplateSelect.value;
      var template = (App.Storage.state.cycleTemplates || []).find(function(t){ return t.id === id; });
      if(!template) return;
      if(!confirm('Start a new current cycle from "'+template.name+'"? Your current cycle will be archived first.')) return;
      archiveCurrentCycle(true);
      var acts = template.activities.map(function(a){ return { id:U.uid(), name:a.name, cat:a.cat }; });
      var checks = {};
      acts.forEach(function(a){ checks[a.id] = new Array(DAYS_IN_CYCLE).fill(false); });
      App.Storage.state.cycle = { startDate: U.todayKey(), activities: acts, checks: checks };
      currentCycleView = "current";
      App.Storage.save();
      invalidateStatsCache();
      App.setCurKey(U.todayKey());
      rebuildCycleTable();
      renderCycleDash();
      renderChallengeChecklist();
      App.renderHeader();
      App.renderDayNav();
      U.showToast("Template cycle started", 2000, "success");
    });

    dom.challengeChecklist.addEventListener("change", function(e){
      var input = e.target;
      if(!input.matches || !input.matches("[data-challenge-id]")) return;
      var id = input.dataset.challengeId;
      var day = Number(input.dataset.challengeDay);
      var state = App.Storage.state;
      var arr = state.cycle.checks[id];
      if(!arr) return;
      arr[day] = !arr[day];
      App.Storage.save();
      invalidateStatsCache();
      renderChallengeChecklist();
      renderCycleDash();
      App.renderHeader();
      updateCycleHighlight();
    });

    dom.challengeDayNote.addEventListener("input", U.debounce(function(){
      var dayIdx = challengeDayIndex();
      if(dayIdx < 0 || dayIdx >= DAYS_IN_CYCLE) return;
      var state = App.Storage.state;
      if(!state.challengeNotes) state.challengeNotes = {};
      var cycleKey = state.cycle.startDate;
      if(!state.challengeNotes[cycleKey]) state.challengeNotes[cycleKey] = {};
      state.challengeNotes[cycleKey][dayIdx] = dom.challengeDayNote.value;
      App.Storage.save();
    }, 500));

    dom.challengeChecklist.addEventListener("click", function(e){
      var btn = e.target.closest("[data-start-next-cycle]");
      if(!btn) return;
      if(startNextCycle()){
        App.setCurKey(U.todayKey());
        App.renderDayNav();
        App.renderHeader();
        U.showToast("Next 21-day cycle started", 2000, "success");
      }
    });

    if(dom.quickStartCycle){
      dom.quickStartCycle.addEventListener("click", quickStartNextCycle);
    }

    var tbody = dom.cycleBody;
    var dragSrcIndex = null;
    tbody.addEventListener("dragstart", function(e){
      var row = e.target.closest("tr");
      if(!row || isViewingHistory()) return;
      dragSrcIndex = Array.from(tbody.children).indexOf(row);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.activityId);
    });
    tbody.addEventListener("dragover", function(e){
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    tbody.addEventListener("drop", function(e){
      e.preventDefault();
      if(isViewingHistory()) return;
      var targetRow = e.target.closest("tr");
      if(!targetRow) return;
      var targetIndex = Array.from(tbody.children).indexOf(targetRow);
      if(dragSrcIndex !== null && dragSrcIndex !== targetIndex){
        reorderActivities(dragSrcIndex, targetIndex);
      }
      dragSrcIndex = null;
    });
  }

  function init(){
    cacheDom();
    populateCategorySelect();
    wireEvents();
  }

  return {
    DAYS_IN_CYCLE: DAYS_IN_CYCLE,
    CATEGORIES: CATEGORIES,
    CAT_ORDER: CAT_ORDER,
    defaultCycle: defaultCycle,
    sanitizeCycle: sanitizeCycle,
    groupedActivities: groupedActivities,
    dayIndexForDate: dayIndexForDate,
    challengeDayIndex: challengeDayIndex,
    computeCycleStats: computeCycleStats,
    init: init,
    rebuildCycleTable: rebuildCycleTable,
    renderCycleDash: renderCycleDash,
    updateCycleHighlight: updateCycleHighlight,
    scrollToViewingColumn: scrollToViewingColumn,
    renderChallengeChecklist: renderChallengeChecklist,
    exportCsv: exportCsv,
    resetCycle: resetCycle,
    startNextCycle: startNextCycle,
    quickStartNextCycle: quickStartNextCycle,
    getViewingCycle: getViewingCycle,
    isViewingHistory: isViewingHistory,
    reorderActivities: reorderActivities,
    invalidateStatsCache: invalidateStatsCache
  };
})();
