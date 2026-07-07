/* ============================================================
   habits.js – Daily log domain with custom lists, debounced
   auto‑save, individual habit streaks, and manage interfaces.
   ============================================================ */

App.Habits = (function(){
  "use strict";
  var U = App.Util;

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

  function getPomodoroBlocks(){
    return [
      {id:"a", name:"Study A", time:"08:00 – 10:00", target:4},
      {id:"b", name:"Study B", time:"10:20 – 12:20", target:4},
      {id:"c", name:"Study C", time:"13:30 – 15:30", target:4},
      {id:"d", name:"Study D", time:"15:50 – 17:30", target:3},
      {id:"review", name:"Evening Review", time:"19:00 – 21:00", target:4}
    ];
  }

  function emptyDay(){
    var h={}, po={}, rb={};
    var habits = App.Storage.getHabits();
    habits.forEach(function(x){ h[x.id]=false; });
    var blocks = getPomodoroBlocks();
    blocks.forEach(function(x){ po[x.id]=0; });
    var routine = App.Storage.getRoutineBlocks();
    routine.forEach(function(x){ rb[x.id]=false; });
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
    var rawTodos = d.todos;
    if (!Array.isArray(rawTodos)) rawTodos = [];
    out.todos = rawTodos.map(function(t) {
      return { id: t.id || U.uid(), text: t.text || '', done: !!t.done };
    });
    return out;
  }

  // ---- DOM refs ----
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
    dom.manageHabitsBtn = document.getElementById("manageHabitsBtn");
    dom.manageRoutineBtn = document.getElementById("manageRoutineBtn");
  }

  // ---- Render functions ----
  function renderHabits(){
    var d = App.Storage.getDay(App.curKey);
    var habits = App.Storage.getHabits();
    dom.habitsList.innerHTML = habits.map(function(h){
      var on = !!d.h[h.id];
      return '<label class="habit-row" data-habit-id="'+h.id+'">' +
        '<input class="native-check" type="checkbox" '+(on?"checked":"")+'>' +
        '<div class="check-box'+(on?" done":"")+'">'+(on?CHECK_SVG:"")+'</div>' +
        '<span class="habit-txt'+(on?" done":"")+'">'+U.escapeHtml(h.label)+'</span></label>';
    }).join("");
  }

  function renderRoutine(){
    var d = App.Storage.getDay(App.curKey);
    var dow = U.keyToDate(App.curKey).getDay();
    var subjects = SUBJECT_ROTATION[dow];
    dom.subjectRotation.innerHTML = ["Study A","Study B","Study C","Study D"].map(function(label,i){
      return '<div class="subject-chip"><div class="subject-label">'+label+'</div><div class="subject-name">'+subjects[i]+'</div></div>';
    }).join("");
    var routine = App.Storage.getRoutineBlocks();
    dom.routineList.innerHTML = routine.map(function(b){
      var on = !!d.rb[b.id];
      return '<label class="routine-row'+(on?" done":"")+'" data-routine-id="'+b.id+'">' +
        '<div class="routine-time">'+b.time+'</div>' +
        '<div class="routine-main"><div class="routine-name">'+U.escapeHtml(b.name)+'</div><div class="routine-task">'+U.escapeHtml(b.task)+'</div></div>' +
        '<input class="native-check" type="checkbox" '+(on?"checked":"")+'>' +
        '<div class="check-box'+(on?" done":"")+'">'+(on?CHECK_SVG:"")+'</div></label>';
    }).join("");
  }

  function renderBlocks(){
    var blocks = getPomodoroBlocks();
    dom.blocksList.innerHTML = blocks.map(function(b){
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
    }).join("");
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
    var habits = App.Storage.getHabits();
    var routine = App.Storage.getRoutineBlocks();
    var blocks = getPomodoroBlocks();
    var hc = habits.filter(function(h){ return d.h[h.id]; }).length;
    var rc = routine.filter(function(b){ return d.rb[b.id]; }).length;
    var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
    dom.sHabits.textContent = hc + "/" + habits.length;
    dom.sRoutine.textContent = rc + "/" + routine.length;
    dom.sPomos.textContent = totalP;
    dom.sRating.textContent = d.rating;
    var targetP = blocks.reduce(function(a,b){ return a+b.target; }, 0);

    var todos = d.todos || [];
    var todoDone = todos.filter(function(t){ return t.done; }).length;
    var todoTotal = todos.length;
    var todoScore = todoTotal > 0 ? todoDone / todoTotal : 1;

    var pct = Math.round(
      (hc / habits.length * 0.35) +
      (rc / routine.length * 0.30) +
      (Math.min(totalP / targetP, 1) * 0.20) +
      (todoScore * 0.15)
    );
    dom.dailyProgPct.textContent = pct + "%";
    dom.dailyProgFill.style.width = pct + "%";
    refreshSavedBadge();
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

  // ---- Manage modals ----
  function showManageHabits(){
    var habits = App.Storage.getHabits();
    var html = '<div class="modal-overlay" id="manageModal">' +
      '<div class="modal-content"><h2>Manage Habits</h2>' +
      '<div class="manage-list" id="manageHabitList">';
    habits.forEach(function(h, idx){
      html += '<div class="manage-item" data-id="'+h.id+'">' +
        '<input type="text" value="'+U.escapeHtml(h.label)+'" class="manage-label">' +
        '<button class="manage-delete" data-id="'+h.id+'">✕</button>' +
        '</div>';
    });
    html += '</div><div class="manage-add">' +
      '<input type="text" id="newHabitLabel" placeholder="New habit name">' +
      '<button id="addHabitBtn">Add</button></div>' +
      '<button class="manage-close">Close</button></div></div>';
    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);
    var modal = document.getElementById('manageModal');
    modal.querySelector('.manage-close').onclick = function(){ modal.remove(); };
    modal.querySelector('#addHabitBtn').onclick = function(){
      var input = modal.querySelector('#newHabitLabel');
      var val = input.value.trim();
      if(!val) return;
      var newHabit = { id: U.uid(), label: val };
      var list = App.Storage.getHabits();
      list.push(newHabit);
      App.Storage.updateHabits(list);
      input.value = '';
      renderDailyPanel();
      App.renderHeader();
      showManageHabits();
    };
    modal.querySelectorAll('.manage-delete').forEach(function(btn){
      btn.onclick = function(){
        var id = this.dataset.id;
        if(!confirm('Delete this habit?')) return;
        var list = App.Storage.getHabits().filter(function(h){ return h.id !== id; });
        App.Storage.updateHabits(list);
        renderDailyPanel();
        App.renderHeader();
        showManageHabits();
      };
    });
    modal.querySelectorAll('.manage-label').forEach(function(input){
      input.addEventListener('change', function(){
        var id = this.closest('.manage-item').dataset.id;
        var newLabel = this.value.trim();
        if(!newLabel) return;
        var list = App.Storage.getHabits();
        var item = list.find(function(h){ return h.id === id; });
        if(item) { item.label = newLabel; App.Storage.updateHabits(list); renderDailyPanel(); App.renderHeader(); }
      });
    });
  }

  function showManageRoutine(){
    var routine = App.Storage.getRoutineBlocks();
    var html = '<div class="modal-overlay" id="manageModal">' +
      '<div class="modal-content"><h2>Manage Routine Steps</h2>' +
      '<div class="manage-list" id="manageRoutineList">';
    routine.forEach(function(b, idx){
      html += '<div class="manage-item" data-id="'+b.id+'">' +
        '<input type="text" value="'+U.escapeHtml(b.name)+'" class="manage-name" placeholder="Name">' +
        '<input type="text" value="'+U.escapeHtml(b.time)+'" class="manage-time" placeholder="Time">' +
        '<input type="text" value="'+U.escapeHtml(b.task)+'" class="manage-task" placeholder="Task">' +
        '<button class="manage-delete" data-id="'+b.id+'">✕</button>' +
        '</div>';
    });
    html += '</div><div class="manage-add">' +
      '<input type="text" id="newRoutineName" placeholder="Name">' +
      '<input type="text" id="newRoutineTime" placeholder="Time">' +
      '<input type="text" id="newRoutineTask" placeholder="Task">' +
      '<button id="addRoutineBtn">Add</button></div>' +
      '<button class="manage-close">Close</button></div></div>';
    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);
    var modal = document.getElementById('manageModal');
    modal.querySelector('.manage-close').onclick = function(){ modal.remove(); };
    modal.querySelector('#addRoutineBtn').onclick = function(){
      var name = modal.querySelector('#newRoutineName').value.trim();
      var time = modal.querySelector('#newRoutineTime').value.trim();
      var task = modal.querySelector('#newRoutineTask').value.trim();
      if(!name || !time || !task) return;
      var newBlock = { id: U.uid(), name: name, time: time, task: task };
      var list = App.Storage.getRoutineBlocks();
      list.push(newBlock);
      App.Storage.updateRoutineBlocks(list);
      modal.querySelector('#newRoutineName').value = '';
      modal.querySelector('#newRoutineTime').value = '';
      modal.querySelector('#newRoutineTask').value = '';
      renderDailyPanel();
      App.renderHeader();
      showManageRoutine();
    };
    modal.querySelectorAll('.manage-delete').forEach(function(btn){
      btn.onclick = function(){
        var id = this.dataset.id;
        if(!confirm('Delete this routine step?')) return;
        var list = App.Storage.getRoutineBlocks().filter(function(b){ return b.id !== id; });
        App.Storage.updateRoutineBlocks(list);
        renderDailyPanel();
        App.renderHeader();
        showManageRoutine();
      };
    });
    modal.querySelectorAll('.manage-name, .manage-time, .manage-task').forEach(function(input){
      input.addEventListener('change', function(){
        var id = this.closest('.manage-item').dataset.id;
        var list = App.Storage.getRoutineBlocks();
        var item = list.find(function(b){ return b.id === id; });
        if(!item) return;
        if(this.classList.contains('manage-name')) item.name = this.value.trim();
        else if(this.classList.contains('manage-time')) item.time = this.value.trim();
        else if(this.classList.contains('manage-task')) item.task = this.value.trim();
        App.Storage.updateRoutineBlocks(list);
        renderDailyPanel();
        App.renderHeader();
      });
    });
  }

  // ---- Export CSV ----
  function exportCsv(){
    var state = App.Storage.state;
    var dates = Object.keys(state.days).sort();
    var habits = App.Storage.getHabits();
    var routine = App.Storage.getRoutineBlocks();
    var header = ["Date","Saved","Habits Done","Habits Total","Routine Done","Routine Total","Pomodoros","Rating","Priority","Journal"];
    var rows = [header];
    dates.forEach(function(key){
      var d = normalizeDay(state.days[key]);
      var hc = habits.filter(function(h){ return d.h[h.id]; }).length;
      var rc = routine.filter(function(b){ return d.rb[b.id]; }).length;
      var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
      rows.push([key, d.saved?"Yes":"No", hc, habits.length, rc, routine.length, totalP, d.rating, d.priority||"", d.journal||""]);
    });
    U.downloadBlob(U.toCsv(rows), "text/csv;charset=utf-8;", "daily-log-"+U.todayKey()+".csv");
  }

  // ---- Events ----
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
      var blocks = getPomodoroBlocks();
      var blk = blocks.find(function(x){ return x.id === id; });
      if(!blk) return;
      App.Storage.mutateDay(App.curKey, function(d){ d.po[id] = U.clamp((d.po[id]||0) + delta, 0, blk.target+3); });
      var row = dom.blocksList.querySelector('.block-row[data-block-id="'+id+'"]');
      if(row) row.outerHTML = renderBlockRowHtml(blk);
      updateDailyStats();
    });

    dom.rSlider.addEventListener("input", U.debounce(function(){
      var v = parseInt(dom.rSlider.value, 10);
      App.Storage.mutateDay(App.curKey, function(d){ d.rating = v; });
      dom.rNum.textContent = v;
      dom.rLbl.textContent = RLABELS[v] || "";
      updateDailyStats();
    }, 200));

    dom.journalInput.addEventListener("input", U.debounce(function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.journal = dom.journalInput.value; });
    }, 500));

    dom.priorityInput.addEventListener("input", U.debounce(function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.priority = dom.priorityInput.value; });
    }, 500));

    dom.saveDayBtn.addEventListener("click", function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.saved = true; });
      refreshSavedBadge();
      App.renderHeader();
      U.showToast("Day saved ✓", 2000, "success");
    });

    dom.manageHabitsBtn.addEventListener("click", showManageHabits);
    dom.manageRoutineBtn.addEventListener("click", showManageRoutine);
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

  function init(){
    cacheDom();
    wireEvents();
  }

  return {
    SUBJECT_ROTATION: SUBJECT_ROTATION,
    RLABELS: RLABELS,
    CHECK_SVG: CHECK_SVG,
    emptyDay: emptyDay,
    normalizeDay: normalizeDay,
    getPomodoroBlocks: getPomodoroBlocks,
    init: init,
    renderDailyPanel: renderDailyPanel,
    updateDailyStats: updateDailyStats,
    refreshSavedBadge: refreshSavedBadge,
    exportCsv: exportCsv,
    showManageHabits: showManageHabits,
    showManageRoutine: showManageRoutine
  };
})();
