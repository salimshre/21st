/* ============================================================
   habits.js
   Owns the "daily log" domain: the fixed 10-item habit list, the
   17-step routine checklist, the 5 pomodoro blocks, and the day
   review (rating/journal/priority). This is also where the shape of
   a day record is defined (emptyDay/normalizeDay) — storage.js calls
   into these rather than knowing the shape itself, so adding or
   renaming a habit/block/routine step only ever requires editing
   this one file.
   ============================================================ */

App.Habits = (function(){
  "use strict";
  var U = App.Util;

  var HABITS = [
    {id:"alarm",label:"Alarm clock used (no phone)"},
    {id:"affirm",label:"Affirmation done"},
    {id:"workout",label:"Workout completed"},
    {id:"breakfast",label:"Breakfast eaten (no screen)"},
    {id:"study_blocks",label:"All 4 study blocks done"},
    {id:"lunch",label:"Lunch before 1:30 PM"},
    {id:"review",label:"Evening review done"},
    {id:"device_off",label:"Device off by 22:30"},
    {id:"presleep",label:"Pre-sleep note reading"},
    {id:"sleep",label:"Slept by 23:00"}
  ];
  var BLOCKS = [
    {id:"a",name:"Study A",time:"08:00 – 10:00",target:4},
    {id:"b",name:"Study B",time:"10:20 – 12:20",target:4},
    {id:"c",name:"Study C",time:"13:30 – 15:30",target:4},
    {id:"d",name:"Study D",time:"15:50 – 17:30",target:3},
    {id:"review",name:"Evening Review",time:"19:00 – 21:00",target:4}
  ];
  var ROUTINE_BLOCKS = [
    {id:"wake",time:"06:00 – 06:05",name:"Wake-up",task:"Affirmation, positive thought, today's to-do"},
    {id:"workout_block",time:"06:05 – 07:30",name:"Workout",task:"Bhutkhel workout according to weekly plan"},
    {id:"breakfast_block",time:"07:30 – 08:00",name:"Breakfast",task:"Proper breakfast, no screen"},
    {id:"study_a",time:"08:00 – 10:00",name:"Study A",task:"Step 1 x 4 pomodoros"},
    {id:"break_1",time:"10:00 – 10:20",name:"Long Break",task:"Walk, water, rest away from desk"},
    {id:"study_b",time:"10:20 – 12:20",name:"Study B",task:"Step 1 x 4 pomodoros"},
    {id:"prep",time:"12:20 – 12:30",name:"Prep",task:"Pack steel lunchbox, quick rest"},
    {id:"lunch_block",time:"12:30 – 13:30",name:"Lunch",task:"Eat lunch, no screen"},
    {id:"study_c",time:"13:30 – 15:30",name:"Study C",task:"Step 1 x 4 pomodoros"},
    {id:"break_2",time:"15:30 – 15:50",name:"Long Break",task:"Walk, stretch, hydrate"},
    {id:"study_d",time:"15:50 – 17:30",name:"Study D",task:"Weak subject or revision, 3 pomodoros"},
    {id:"free_time",time:"17:30 – 18:00",name:"Free Time",task:"Rest, social, phone, guilt-free"},
    {id:"dinner",time:"18:00 – 19:00",name:"Dinner",task:"Prep, eat, rest"},
    {id:"review_block",time:"19:00 – 21:00",name:"Review",task:"Flashcards and today's material only"},
    {id:"light_work",time:"21:00 – 22:30",name:"Light Work",task:"Blog, project, reading, or creative work"},
    {id:"wind_down",time:"22:30 – 23:00",name:"Wind-down",task:"Read today's subject notes, one sentence for tomorrow"},
    {id:"sleep_block",time:"23:00",name:"Sleep",task:"Device off, lights off"}
  ];
  var SUBJECT_ROTATION = [
    ["Numerical Methods","DSA","Architecture","Economics"],
    ["DSA","Architecture","Numerical Methods","OOAD"],
    ["Architecture","Economics","DSA","Numerical Methods"],
    ["Economics","Numerical Methods","OOAD","Architecture"],
    ["Numerical Methods","OOAD","Economics","DSA"],
    ["Light review only","Light review only","Light review only","Light review only"],
    ["Full revision / past papers","Full revision / past papers","Full revision / past papers","Full revision / past papers"]
  ];
  var RLABELS = ["","terrible","bad","rough","below avg","ok","decent","good","great","excellent","perfect"];
  var CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- day record shape ---------- */
  function emptyDay(){
    var h={}, po={}, rb={};
    HABITS.forEach(function(x){ h[x.id]=false; });
    BLOCKS.forEach(function(x){ po[x.id]=0; });
    ROUTINE_BLOCKS.forEach(function(x){ rb[x.id]=false; });
    return { h:h, po:po, rb:rb, rating:5, journal:"", priority:"", saved:false, todos:[] };
  }
  function normalizeDay(raw){
    var base = emptyDay();
    var d = (raw && typeof raw === "object") ? raw : {};
    var out = {};
    for(var k in base) out[k] = base[k];
    for(var k2 in d) out[k2] = d[k2];
    out.h = Object.assign({}, base.h, d.h || {});
    out.po = Object.assign({}, base.po, d.po || {});
    out.rb = Object.assign({}, base.rb, d.rb || {});
    if(typeof out.rating !== "number") out.rating = 5;
    out.journal = typeof out.journal === "string" ? out.journal : "";
    out.priority = typeof out.priority === "string" ? out.priority : "";
    out.saved = !!out.saved;
    // Todos
    var rawTodos = d.todos;
    if (!Array.isArray(rawTodos)) rawTodos = [];
    out.todos = rawTodos.map(function(t) {
      return { id: t.id || U.uid(), text: t.text || '', done: !!t.done };
    });
    return out;
  }

  /* ---------- dom ---------- */
  var dom = {};
  function cacheDom(){
    dom.sHabits = document.getElementById("sHabits");
    dom.sRoutine = document.getElementById("sRoutine");
    dom.sPomos = document.getElementById("sPomos");
    dom.sRating = document.getElementById("sRating");
    dom.dailyProgPct = document.getElementById("dailyProgPct");
    dom.dailyProgFill = document.getElementById("dailyProgFill");

    dom.habitsList = document.getElementById("habits-list");
    dom.subjectRotation = document.getElementById("subject-rotation");
    dom.routineList = document.getElementById("routine-list");
    dom.blocksList = document.getElementById("blocks-list");
    dom.rSlider = document.getElementById("rSlider");
    dom.rNum = document.getElementById("rNum");
    dom.rLbl = document.getElementById("rLbl");
    dom.journalInput = document.getElementById("journalInput");
    dom.priorityInput = document.getElementById("priorityInput");
    dom.saveDayBtn = document.getElementById("saveDayBtn");
    dom.savedBadge = document.getElementById("savedBadge");
  }

  /* ---------- render ---------- */
  function renderHabits(){
    var d = App.Storage.getDay(App.curKey);
    dom.habitsList.innerHTML = HABITS.map(function(h){
      var on = !!d.h[h.id];
      return '<label class="habit-row" data-habit-id="'+h.id+'">' +
        '<input class="native-check" type="checkbox" '+(on?"checked":"")+'>' +
        '<div class="check-box'+(on?" done":"")+'">'+(on?CHECK_SVG:"")+'</div>' +
        '<span class="habit-txt'+(on?" done":"")+'">'+h.label+'</span></label>';
    }).join("");
  }

  function renderRoutine(){
    var d = App.Storage.getDay(App.curKey);
    var dow = U.keyToDate(App.curKey).getDay();
    var subjects = SUBJECT_ROTATION[dow];
    dom.subjectRotation.innerHTML = ["Study A","Study B","Study C","Study D"].map(function(label,i){
      return '<div class="subject-chip"><div class="subject-label">'+label+'</div><div class="subject-name">'+subjects[i]+'</div></div>';
    }).join("");
    dom.routineList.innerHTML = ROUTINE_BLOCKS.map(function(b){
      var on = !!d.rb[b.id];
      return '<label class="routine-row'+(on?" done":"")+'" data-routine-id="'+b.id+'">' +
        '<div class="routine-time">'+b.time+'</div>' +
        '<div class="routine-main"><div class="routine-name">'+b.name+'</div><div class="routine-task">'+b.task+'</div></div>' +
        '<input class="native-check" type="checkbox" '+(on?"checked":"")+'>' +
        '<div class="check-box'+(on?" done":"")+'">'+(on?CHECK_SVG:"")+'</div></label>';
    }).join("");
  }

  function renderBlockRowHtml(b){
    var d = App.Storage.getDay(App.curKey);
    var count = d.po[b.id] || 0;
    var dots = Array.from({length:b.target+2}, function(_,i){
      var cls = "pomo-dot";
      if(i < Math.min(count, b.target)) cls += " on";
      else if(i < count) cls += " extra";
      return '<div class="'+cls+'"></div>';
    }).join("");
    return '<div class="block-row" data-block-id="'+b.id+'">' +
      '<div class="block-info"><div class="block-name">'+b.name+'</div><div class="block-time">'+b.time+' · target '+b.target+'</div></div>' +
      '<div class="pomo-wrap"><div class="pomo-dots">'+dots+'</div>' +
      '<button type="button" class="p-btn" data-block-id="'+b.id+'" data-delta="-1" aria-label="Remove pomodoro">−</button>' +
      '<span class="p-count">'+count+'</span>' +
      '<button type="button" class="p-btn" data-block-id="'+b.id+'" data-delta="1" aria-label="Add pomodoro">+</button></div></div>';
  }
  function renderBlocks(){
    dom.blocksList.innerHTML = BLOCKS.map(renderBlockRowHtml).join("");
  }

  function renderReview(){
    var d = App.Storage.getDay(App.curKey);
    dom.rSlider.value = d.rating;
    dom.rNum.textContent = d.rating;
    dom.rLbl.textContent = RLABELS[d.rating] || "";
    dom.journalInput.value = d.journal || "";
    dom.priorityInput.value = d.priority || "";
  }

  function refreshSavedBadge(){
    var d = App.Storage.getDay(App.curKey);
    dom.savedBadge.classList.toggle("show", !!d.saved);
  }

  function updateDailyStats(){
  var d = App.Storage.getDay(App.curKey);
  var hc = HABITS.filter(function(h){ return d.h[h.id]; }).length;
  var rc = ROUTINE_BLOCKS.filter(function(b){ return d.rb[b.id]; }).length;
  var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
  dom.sHabits.textContent = hc + "/" + HABITS.length;
  dom.sRoutine.textContent = rc + "/" + ROUTINE_BLOCKS.length;
  dom.sPomos.textContent = totalP;
  dom.sRating.textContent = d.rating;
  var targetP = BLOCKS.reduce(function(a,b){ return a+b.target; }, 0);

  // --- Todo progress (NEW) ---
  var todos = d.todos || [];
  var todoDone = todos.filter(function(t){ return t.done; }).length;
  var todoTotal = todos.length;
  var todoScore = todoTotal > 0 ? todoDone / todoTotal : 1; // if no todos, consider it 100% for that part

  var pct = Math.round(
    (hc / HABITS.length * 0.35) +
    (rc / ROUTINE_BLOCKS.length * 0.30) +
    (Math.min(totalP / targetP, 1) * 0.20) +
    (todoScore * 0.15)
  );

  dom.dailyProgPct.textContent = pct + "%";
  dom.dailyProgFill.style.width = pct + "%";
  refreshSavedBadge();
  // Also update todos stat if available
  if (typeof App.Todos !== 'undefined' && App.Todos.updateTodoStats) {
    App.Todos.updateTodoStats();
  }
}

  function renderDailyPanel(){
    renderHabits();
    renderRoutine();
    renderBlocks();
    renderReview();
    updateDailyStats();
  }

  /* ---------- events ---------- */
  function wireEvents(){
    dom.habitsList.addEventListener("change", function(e){
      var row = e.target.closest("[data-habit-id]");
      if(!row) return;
      var id = row.dataset.habitId;
      App.Storage.mutateDay(App.curKey, function(d){ d.h[id] = !d.h[id]; });
      var on = App.Storage.state.days[App.curKey].h[id];
      row.querySelector(".check-box").classList.toggle("done", on);
      row.querySelector(".check-box").innerHTML = on ? CHECK_SVG : "";
      row.querySelector(".habit-txt").classList.toggle("done", on);
      updateDailyStats();
    });

    dom.routineList.addEventListener("change", function(e){
      var row = e.target.closest("[data-routine-id]");
      if(!row) return;
      var id = row.dataset.routineId;
      App.Storage.mutateDay(App.curKey, function(d){ d.rb[id] = !d.rb[id]; });
      var on = App.Storage.state.days[App.curKey].rb[id];
      row.classList.toggle("done", on);
      row.querySelector(".check-box").classList.toggle("done", on);
      row.querySelector(".check-box").innerHTML = on ? CHECK_SVG : "";
      updateDailyStats();
    });

    dom.blocksList.addEventListener("click", function(e){
      var btn = e.target.closest(".p-btn");
      if(!btn) return;
      var id = btn.dataset.blockId;
      var delta = Number(btn.dataset.delta);
      var blk = BLOCKS.find(function(x){ return x.id === id; });
      App.Storage.mutateDay(App.curKey, function(d){ d.po[id] = U.clamp((d.po[id]||0) + delta, 0, blk.target+3); });
      var row = dom.blocksList.querySelector('.block-row[data-block-id="'+id+'"]');
      if(row) row.outerHTML = renderBlockRowHtml(blk);
      updateDailyStats();
    });

    dom.rSlider.addEventListener("input", function(){
      var v = parseInt(dom.rSlider.value, 10);
      App.Storage.mutateDay(App.curKey, function(d){ d.rating = v; });
      dom.rNum.textContent = v;
      dom.rLbl.textContent = RLABELS[v] || "";
      updateDailyStats();
    });
    dom.journalInput.addEventListener("input", function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.journal = dom.journalInput.value; });
    });
    dom.priorityInput.addEventListener("input", function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.priority = dom.priorityInput.value; });
    });

    dom.saveDayBtn.addEventListener("click", function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.saved = true; });
      refreshSavedBadge();
      App.renderHeader();
      U.showToast("Saved ✓");
    });
  }

  function exportCsv(){
    var state = App.Storage.state;
    var dates = Object.keys(state.days).sort();
    var header = ["Date","Saved","Habits Done","Habits Total","Routine Done","Routine Total","Pomodoros","Rating","Priority","Journal"];
    var rows = [header];
    dates.forEach(function(key){
      var d = normalizeDay(state.days[key]);
      var hc = HABITS.filter(function(h){ return d.h[h.id]; }).length;
      var rc = ROUTINE_BLOCKS.filter(function(b){ return d.rb[b.id]; }).length;
      var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
      rows.push([key, d.saved?"Yes":"No", hc, HABITS.length, rc, ROUTINE_BLOCKS.length, totalP, d.rating, d.priority||"", d.journal||""]);
    });
    U.downloadBlob(U.toCsv(rows), "text/csv;charset=utf-8;", "daily-log-"+U.todayKey()+".csv");
  }

  function init(){
    cacheDom();
    wireEvents();
  }

  return {
    HABITS: HABITS, BLOCKS: BLOCKS, ROUTINE_BLOCKS: ROUTINE_BLOCKS,
    SUBJECT_ROTATION: SUBJECT_ROTATION, RLABELS: RLABELS, CHECK_SVG: CHECK_SVG,
    emptyDay: emptyDay, normalizeDay: normalizeDay,
    init: init, renderDailyPanel: renderDailyPanel, updateDailyStats: updateDailyStats,
    refreshSavedBadge: refreshSavedBadge, exportCsv: exportCsv
  };
})();


