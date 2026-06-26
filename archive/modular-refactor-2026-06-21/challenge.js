/* ============================================================
   challenge.js
   Owns the "21-day challenge" domain: categories, the cycle's
   activities/checks grid, and everything derived from it — cycle
   stats, the 21-Day view's dashboard + scrollable table, and the
   "Today's 21-day challenge" checklist that appears grouped by
   Habit Category inside the Daily view's Habits subtab.

   This is also where the shape of a cycle record is defined
   (defaultCycle/sanitizeCycle) — storage.js calls into these
   rather than knowing the shape itself, mirroring how habits.js
   owns emptyDay/normalizeDay for the daily-log domain.

   The checklist here and the grid in the 21-Day view both read and
   write the SAME underlying data (App.Storage.state.cycle) — there
   is only one source of truth, so checking a task off in either
   place keeps the other in sync automatically.
   ============================================================ */

App.Challenge = (function(){
  "use strict";
  var U = App.Util;

  var DAYS_IN_CYCLE = 21;

  var CATEGORIES = {
    mind:       { label:"🧠 Mind",       varName:"--mind" },
    learning:   { label:"📚 Learning",   varName:"--learning" },
    discipline: { label:"💪 Discipline", varName:"--discipline" },
    health:     { label:"🧍 Health",     varName:"--health" },
    diet:       { label:"🥗 Diet",       varName:"--diet" }
  };
  var CAT_ORDER = ["mind","learning","discipline","health","diet"];

  // Seeds real prior progress (Day 1–18) so the app opens reflecting where the
  // user actually is, instead of starting blank. Index 0 = Day 1 ... Index 20 = Day 21.
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

  /* ---------- cycle record shape ---------- */
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

  /* ---------- derived data ---------- */
  function groupedActivities(){
    var state = App.Storage.state;
    var groups = {};
    CAT_ORDER.forEach(function(c){ groups[c] = []; });
    state.cycle.activities.forEach(function(a){
      if(!groups[a.cat]) groups[a.cat] = [];
      groups[a.cat].push(a);
    });
    var out = [];
    CAT_ORDER.forEach(function(c){ out = out.concat(groups[c]); });
    return out;
  }

  function dayIndexForDate(key){
    var state = App.Storage.state;
    var start = U.keyToDate(state.cycle.startDate);
    var d = U.keyToDate(key);
    return Math.round((d - start) / 86400000) + 1; // 1-based; may fall outside 1..DAYS_IN_CYCLE
  }

  function challengeDayIndex(){
    return dayIndexForDate(App.curKey) - 1;
  }

  function computeCycleStats(){
    var state = App.Storage.state;
    var totalChecked = 0, totalCells = 0;
    var catChecked = {}, catTotal = {};
    CAT_ORDER.forEach(function(c){ catChecked[c]=0; catTotal[c]=0; });
    state.cycle.activities.forEach(function(a){
      var arr = state.cycle.checks[a.id] || [];
      var c = arr.filter(Boolean).length;
      totalChecked += c; totalCells += DAYS_IN_CYCLE;
      if(catTotal[a.cat] === undefined){ catTotal[a.cat]=0; catChecked[a.cat]=0; }
      catChecked[a.cat] += c; catTotal[a.cat] += DAYS_IN_CYCLE;
    });
    return { overallPct: totalCells ? Math.round((totalChecked/totalCells)*100) : 0, catChecked:catChecked, catTotal:catTotal };
  }

  /* ---------- dom ---------- */
  var dom = {};
  function cacheDom(){
    dom.cycleStartInput = document.getElementById("cycleStartInput");
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

    var footTd = dom.cycleTable.querySelector("tfoot td");
    if(footTd) footTd.colSpan = 3 + DAYS_IN_CYCLE + 1;
  }

  function populateCategorySelect(){
    CAT_ORDER.forEach(function(key){
      var opt = document.createElement("option");
      opt.value = key; opt.textContent = CATEGORIES[key].label;
      dom.newActCat.appendChild(opt);
    });
  }

  /* ---------- render: 21-Day dashboard + table ---------- */
  function renderCycleDash(){
    var state = App.Storage.state;
    dom.cycleStartInput.value = state.cycle.startDate;
    var stats = computeCycleStats();
    dom.cycleOverallPct.textContent = stats.overallPct + "%";
    dom.cycleOverallBar.style.width = stats.overallPct + "%";
    dom.cycleCatWrap.innerHTML = CAT_ORDER.map(function(c){
      if(!stats.catTotal[c]) return "";
      var cat = CATEGORIES[c];
      var pct = Math.round((stats.catChecked[c] / stats.catTotal[c]) * 100);
      return '<div class="cat-mini"><div class="top"><span class="name">'+cat.label+'</span><span class="pct" style="color:var('+cat.varName+')">'+pct+'%</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var('+cat.varName+')"></div></div></div>';
    }).join("");
  }

  function buildCycleHeader(){
    Array.from(dom.cycleHeadRow.querySelectorAll("th.col-day")).forEach(function(th){ th.remove(); });
    var scoreTh = dom.cycleHeadRow.querySelector(".col-score");
    for(var d=1; d<=DAYS_IN_CYCLE; d++){
      var th = document.createElement("th");
      th.className = "col-day";
      th.scope = "col";
      th.textContent = "D" + d;
      th.dataset.dayIdx = d;
      dom.cycleHeadRow.insertBefore(th, scoreTh);
    }
  }

  function updateScoreCell(tr, activityId){
    var state = App.Storage.state;
    var arr = state.cycle.checks[activityId] || [];
    var n = arr.filter(Boolean).length;
    var scoreTxt = tr.querySelector(".score-txt");
    var barFill = tr.querySelector(".col-score .score-bar > div");
    if(scoreTxt) scoreTxt.textContent = n + "/" + DAYS_IN_CYCLE;
    if(barFill) barFill.style.width = Math.round((n/DAYS_IN_CYCLE)*100) + "%";
  }

  function renderCycleBody(){
    var state = App.Storage.state;
    dom.cycleBody.innerHTML = "";
    var ordered = groupedActivities();

    ordered.forEach(function(a, idx){
      var cat = CATEGORIES[a.cat] || CATEGORIES.mind;
      var tr = document.createElement("tr");
      tr.dataset.activityId = a.id;

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
      nameSpan.contentEditable = "true";
      nameSpan.spellcheck = false;
      nameSpan.setAttribute("aria-label", "Activity name, editable");
      nameSpan.textContent = a.name;
      nameSpan.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); nameSpan.blur(); } });
      var delBtn = document.createElement("button");
      delBtn.className = "del-btn"; delBtn.type = "button"; delBtn.title = "Delete activity";
      delBtn.setAttribute("aria-label", "Delete " + a.name);
      delBtn.textContent = "✕";
      tools.appendChild(nameSpan);
      tools.appendChild(delBtn);
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

      var checksArr = state.cycle.checks[a.id] || new Array(DAYS_IN_CYCLE).fill(false);

      for(var d=0; d<DAYS_IN_CYCLE; d++){
        var tdDay = document.createElement("td");
        tdDay.className = "col-day";
        tdDay.dataset.dayIdx = d + 1;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chk" + (checksArr[d] ? " on" : "");
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
      }

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
    var todayIdx = dayIndexForDate(U.todayKey());
    var viewIdx = dayIndexForDate(App.curKey);
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

  /* ---------- render: Today's 21-day challenge checklist (Daily view) ---------- */
  function renderChallengeChecklist(){
    var state = App.Storage.state;
    var dayIdx = challengeDayIndex();
    var cats = {};
    CAT_ORDER.forEach(function(c){ cats[c] = []; });
    state.cycle.activities.forEach(function(a){
      if(!cats[a.cat]) cats[a.cat] = [];
      cats[a.cat].push(a);
    });

    if(dayIdx < 0 || dayIdx >= DAYS_IN_CYCLE){
      dom.challengeChecklist.innerHTML =
        '<div class="challenge-empty">The current date is outside the active 21-day cycle. Move back into the cycle to check today\'s tasks.</div>';
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
      return '<div class="challenge-category" data-category="'+catKey+'">' +
        '<div class="challenge-cat-head"><div class="challenge-cat-name">'+cat.label+'</div><div class="challenge-cat-progress">'+done+"/"+acts.length+' done</div></div>' +
        rows +
      '</div>';
    }).filter(Boolean).join("");

    if(!body){
      dom.challengeChecklist.innerHTML = '<div class="challenge-empty">No challenge activities are configured yet.</div>';
      return;
    }
    dom.challengeChecklist.innerHTML = body;
  }

  /* ---------- data tools ---------- */
  function exportCsv(){
    var state = App.Storage.state;
    var header = ["Activity","Category"];
    for(var d=1; d<=DAYS_IN_CYCLE; d++) header.push("Day "+d);
    header.push("S.n","Score");
    var rows = [header];
    groupedActivities().forEach(function(a, idx){
      var cat = CATEGORIES[a.cat] || CATEGORIES.mind;
      var arr = state.cycle.checks[a.id] || [];
      var row = [a.name, cat.label];
      for(var d2=0; d2<DAYS_IN_CYCLE; d2++) row.push(arr[d2] ? "Yes" : "No");
      row.push(idx+1, arr.filter(Boolean).length + "/" + DAYS_IN_CYCLE);
      rows.push(row);
    });
    U.downloadBlob(U.toCsv(rows), "text/csv;charset=utf-8;", "21-day-grid-"+U.todayKey()+".csv");
  }

  function resetCycle(){
    if(!confirm("Clear all 21-day checkmarks and start this cycle over from today? Your daily logs (habits, routine, pomodoros, journal) are not affected. Export a CSV first if you want a record of this cycle.")) return false;
    var state = App.Storage.state;
    state.cycle.activities.forEach(function(a){ state.cycle.checks[a.id] = new Array(DAYS_IN_CYCLE).fill(false); });
    state.cycle.startDate = U.todayKey();
    App.Storage.save();
    rebuildCycleTable();
    renderCycleDash();
    updateCycleHighlight();
    return true;
  }

  /* ---------- events ---------- */
  function wireEvents(){
    // -- the 21-day grid: toggle a check, rename/delete an activity, add one --
    dom.cycleBody.addEventListener("click", function(e){
      var chk = e.target.closest(".chk");
      if(chk){
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
        renderCycleDash();
        App.renderHeader();
        // Keep the daily checklist in sync if this check belongs to the day being viewed.
        if(day === challengeDayIndex()) renderChallengeChecklist();
        return;
      }
      var del = e.target.closest(".del-btn");
      if(del){
        var tr2 = del.closest("tr");
        var id2 = tr2.dataset.activityId;
        var state2 = App.Storage.state;
        var a2 = state2.cycle.activities.find(function(x){ return x.id === id2; });
        if(a2 && confirm('Delete "'+a2.name+'"? This removes its checkmarks too.')){
          state2.cycle.activities = state2.cycle.activities.filter(function(x){ return x.id !== id2; });
          delete state2.cycle.checks[id2];
          App.Storage.save();
          renderCycleBody();
          renderCycleDash();
          App.renderHeader();
          renderChallengeChecklist();
        }
      }
    });

    dom.cycleBody.addEventListener("focusout", function(e){
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
      renderChallengeChecklist();
    });

    dom.cycleStartInput.addEventListener("change", function(){
      if(!dom.cycleStartInput.value) return;
      App.Storage.state.cycle.startDate = dom.cycleStartInput.value;
      App.Storage.save();
      rebuildCycleTable();
      renderCycleDash();
      App.renderDayNav();
      App.renderHeader();
      renderChallengeChecklist();
      scrollToViewingColumn();
    });

    dom.addActBtn.addEventListener("click", function(){
      var name = dom.newActName.value.trim();
      if(!name){ dom.newActName.focus(); return; }
      var cat = dom.newActCat.value;
      var id = U.uid();
      var state = App.Storage.state;
      state.cycle.activities.push({ id:id, name:name, cat:cat });
      state.cycle.checks[id] = new Array(DAYS_IN_CYCLE).fill(false);
      dom.newActName.value = "";
      App.Storage.save();
      renderCycleBody();
      renderCycleDash();
      App.renderHeader();
      renderChallengeChecklist();
    });
    dom.newActName.addEventListener("keydown", function(e){ if(e.key === "Enter") dom.addActBtn.click(); });

    // -- clicking a day column header jumps the Daily view to that date --
    dom.cycleHeadRow.addEventListener("click", function(e){
      var th = e.target.closest("th.col-day");
      if(!th) return;
      var idx = Number(th.dataset.dayIdx);
      var key = U.addDays(App.Storage.state.cycle.startDate, idx - 1);
      if(U.keyToDate(key) > U.todayDate()) return;
      App.switchMainTab("daily");
      App.setCurKey(key);
    });

    // -- Today's 21-day challenge checklist (Daily view, grouped by Habit Category) --
    // This is the piece that lets users mark challenge tasks complete directly from
    // the checklist and keeps that completion synced with the 21-day grid above.
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
      renderChallengeChecklist();
      renderCycleDash();
      App.renderHeader();
      updateCycleHighlight();
    });
  }

  function init(){
    cacheDom();
    populateCategorySelect();
    wireEvents();
  }

  return {
    DAYS_IN_CYCLE: DAYS_IN_CYCLE, CATEGORIES: CATEGORIES, CAT_ORDER: CAT_ORDER,
    defaultCycle: defaultCycle, sanitizeCycle: sanitizeCycle,
    groupedActivities: groupedActivities, dayIndexForDate: dayIndexForDate,
    challengeDayIndex: challengeDayIndex, computeCycleStats: computeCycleStats,
    init: init,
    rebuildCycleTable: rebuildCycleTable, renderCycleBody: renderCycleBody,
    renderCycleDash: renderCycleDash, updateCycleHighlight: updateCycleHighlight,
    scrollToViewingColumn: scrollToViewingColumn, renderChallengeChecklist: renderChallengeChecklist,
    exportCsv: exportCsv, resetCycle: resetCycle
  };
})();