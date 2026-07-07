/* ============================================================
   habits.js – owns the daily log domain.
   Now supports dynamic subject rotation and routine blocks.
   ============================================================ */

App.Habits = (function(){
  "use strict";
  var U = App.Util;

  // fixed 10 habits – unchanged
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

  // fixed pomodoro blocks – unchanged
  var BLOCKS = [
    {id:"a",name:"Study A",time:"08:00 – 10:00",target:4},
    {id:"b",name:"Study B",time:"10:20 – 12:20",target:4},
    {id:"c",name:"Study C",time:"13:30 – 15:30",target:4},
    {id:"d",name:"Study D",time:"15:50 – 17:30",target:3},
    {id:"review",name:"Evening Review",time:"19:00 – 21:00",target:4}
  ];

  var RLABELS = ["","terrible","bad","rough","below avg","ok","decent","good","great","excellent","perfect"];
  var CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---- getters for dynamic data ----
  function getRoutineBlocks() {
    return App.Storage.getRoutineBlocks();
  }
  function getSubjectRotation() {
    return App.Storage.getSubjectRotation();
  }

  // ---- day record shape ----
  function emptyDay(){
    var h={}, po={}, rb={};
    HABITS.forEach(function(x){ h[x.id]=false; });
    BLOCKS.forEach(function(x){ po[x.id]=0; });
    var blocks = getRoutineBlocks();
    blocks.forEach(function(b){ rb[b.id]=false; });
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
    // rb: merge with current routine blocks, but keep existing values for ids that exist
    var currentBlocks = getRoutineBlocks();
    var rb = {};
    currentBlocks.forEach(function(b){ rb[b.id] = false; });
    if (d.rb && typeof d.rb === "object") {
      Object.keys(d.rb).forEach(function(id) {
        if (rb.hasOwnProperty(id)) rb[id] = !!d.rb[id];
      });
    }
    out.rb = rb;
    if(typeof out.rating !== "number") out.rating = 5;
    out.journal = typeof out.journal === "string" ? out.journal : "";
    out.priority = typeof out.priority === "string" ? out.priority : "";
    out.saved = !!out.saved;
    out.todos = Array.isArray(d.todos) ? d.todos.map(function(t) {
      return { id: t.id || U.uid(), text: t.text || '', done: !!t.done };
    }) : [];
    return out;
  }

  // ---- DOM cache ----
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
    // new routine add form elements
    dom.routineAddTime = document.getElementById("routineAddTime");
    dom.routineAddName = document.getElementById("routineAddName");
    dom.routineAddTask = document.getElementById("routineAddTask");
    dom.routineAddBtn = document.getElementById("routineAddBtn");
  }

  // ---- Render habits (unchanged) ----
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

  // ---- Render subject rotation (editable) ----
  function renderSubjectRotation(){
    var rotation = getSubjectRotation();
    var dow = U.keyToDate(App.curKey).getDay();
    var subjects = rotation[dow] || ["","","",""];
    var labels = ["Study A","Study B","Study C","Study D"];
    var html = labels.map(function(label, idx) {
      return '<div class="subject-chip">' +
        '<div class="subject-label">'+label+'</div>' +
        '<span class="subject-name editable" contenteditable="true" ' +
          'data-day="'+dow+'" data-block="'+idx+'">' +
          U.escapeHtml(subjects[idx] || '') +
        '</span></div>';
    }).join("");
    dom.subjectRotation.innerHTML = html;

    // wire events for subject name changes
    dom.subjectRotation.querySelectorAll('.subject-name.editable').forEach(function(el) {
      el.addEventListener('blur', function() {
        var day = parseInt(this.dataset.day);
        var block = parseInt(this.dataset.block);
        var newName = this.textContent.trim() || "Subject";
        var rotation = getSubjectRotation();
        if (!rotation[day]) rotation[day] = ["","","",""];
        rotation[day][block] = newName;
        App.Storage.setSubjectRotation(rotation);
        // re-render to reflect changes (though we already updated)
        renderSubjectRotation();
      });
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
      });
    });
  }

  // ---- Render routine checklist (editable, draggable, deletable) ----
  function renderRoutine(){
    var d = App.Storage.getDay(App.curKey);
    var blocks = getRoutineBlocks();
    var html = blocks.map(function(b, index) {
      var on = !!d.rb[b.id];
      return '<div class="routine-row'+(on?" done":"")+'" data-routine-id="'+b.id+'" draggable="true">' +
        '<span class="routine-drag-handle" title="Drag to reorder">⋮⋮</span>' +
        '<div class="routine-time editable" contenteditable="true" data-field="time">'+U.escapeHtml(b.time)+'</div>' +
        '<div class="routine-main">' +
          '<div class="routine-name editable" contenteditable="true" data-field="name">'+U.escapeHtml(b.name)+'</div>' +
          '<div class="routine-task editable" contenteditable="true" data-field="task">'+U.escapeHtml(b.task)+'</div>' +
        '</div>' +
        '<input class="native-check" type="checkbox" '+(on?"checked":"")+'>' +
        '<div class="check-box'+(on?" done":"")+'">'+(on?CHECK_SVG:"")+'</div>' +
        '<button class="routine-delete" data-id="'+b.id+'" title="Delete this step">✕</button>' +
        '</div>';
    }).join("");
    dom.routineList.innerHTML = html;

    // wire events: checkbox toggle, delete, editable blur, drag-drop
    dom.routineList.querySelectorAll('.routine-row').forEach(function(row) {
      var id = row.dataset.routineId;

      // checkbox
      var checkbox = row.querySelector('.native-check');
      checkbox.addEventListener('change', function() {
        App.Storage.mutateDay(App.curKey, function(d){ d.rb[id] = !d.rb[id]; });
        var on = App.Storage.state.days[App.curKey].rb[id];
        row.classList.toggle('done', on);
        row.querySelector('.check-box').classList.toggle('done', on);
        row.querySelector('.check-box').innerHTML = on ? CHECK_SVG : "";
        App.Habits.updateDailyStats();
      });

      // delete
      var delBtn = row.querySelector('.routine-delete');
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Delete this routine step?')) {
          var blocks = getRoutineBlocks();
          var newBlocks = blocks.filter(function(b) { return b.id !== id; });
          App.Storage.setRoutineBlocks(newBlocks);
          renderRoutine();
          App.Habits.updateDailyStats();
        }
      });

      // editable fields
      row.querySelectorAll('.editable').forEach(function(el) {
        el.addEventListener('blur', function() {
          var field = this.dataset.field;
          var newValue = this.textContent.trim();
          if (newValue === '') newValue = field === 'time' ? '00:00' : field === 'name' ? 'Step' : 'Task';
          var blocks = getRoutineBlocks();
          var block = blocks.find(function(b) { return b.id === id; });
          if (block) {
            block[field] = newValue;
            App.Storage.setRoutineBlocks(blocks);
          }
        });
        el.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
        });
      });
    });

    // drag & drop reordering
    var rows = dom.routineList.querySelectorAll('.routine-row');
    var dragSrcIndex = null;
    rows.forEach(function(row, idx) {
      row.addEventListener('dragstart', function(e) {
        dragSrcIndex = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.routineId);
      });
      row.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('drop', function(e) {
        e.preventDefault();
        var targetIndex = Array.from(rows).indexOf(this);
        if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
          var blocks = getRoutineBlocks();
          var item = blocks.splice(dragSrcIndex, 1)[0];
          blocks.splice(targetIndex, 0, item);
          App.Storage.setRoutineBlocks(blocks);
          renderRoutine();
          App.Habits.updateDailyStats();
        }
        dragSrcIndex = null;
      });
    });
  }

  // ---- Add new routine step ----
  function addRoutineStep() {
    var time = dom.routineAddTime.value.trim() || "00:00";
    var name = dom.routineAddName.value.trim() || "New step";
    var task = dom.routineAddTask.value.trim() || "";
    if (!name) return;
    var blocks = getRoutineBlocks();
    var newBlock = {
      id: U.uid(),
      time: time,
      name: name,
      task: task
    };
    blocks.push(newBlock);
    App.Storage.setRoutineBlocks(blocks);
    dom.routineAddTime.value = "";
    dom.routineAddName.value = "";
    dom.routineAddTask.value = "";
    renderRoutine();
    App.Habits.updateDailyStats();
  }

  // ---- Render pomodoro blocks (unchanged) ----
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

  // ---- Render review (unchanged) ----
  function renderReview(){
    var d = App.Storage.getDay(App.curKey);
    dom.rSlider.value = d.rating;
    dom.rNum.textContent = d.rating;
    dom.rLbl.textContent = RLABELS[d.rating] || "";
    dom.journalInput.value = d.journal || "";
    dom.priorityInput.value = d.priority || "";
  }

  // ---- Refresh saved badge ----
  function refreshSavedBadge(){
    var d = App.Storage.getDay(App.curKey);
    dom.savedBadge.classList.toggle("show", !!d.saved);
  }

  // ---- Update daily stats (uses dynamic routine length) ----
  function updateDailyStats() {
    var d = App.Storage.getDay(App.curKey);
    var hc = HABITS.filter(function(h){ return d.h[h.id]; }).length;
    var blocks = getRoutineBlocks();
    var rc = blocks.filter(function(b){ return d.rb[b.id]; }).length;
    var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
    dom.sHabits.textContent = hc + "/" + HABITS.length;
    dom.sRoutine.textContent = rc + "/" + blocks.length;
    dom.sPomos.textContent = totalP;
    dom.sRating.textContent = d.rating;
    var targetP = BLOCKS.reduce(function(a,b){ return a+b.target; }, 0);
    var todos = d.todos || [];
    var todoDone = todos.filter(function(t){ return t.done; }).length;
    var todoTotal = todos.length;
    var todoScore = todoTotal > 0 ? todoDone / todoTotal : 1;
    var pct = Math.round(
      (hc / HABITS.length * 0.35) +
      (rc / (blocks.length || 1) * 0.30) +
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

  // ---- Render all daily panels ----
  function renderDailyPanel() {
    renderHabits();
    renderSubjectRotation();
    renderRoutine();
    renderBlocks();
    renderReview();
    updateDailyStats();
  }

  // ---- Export CSV (uses dynamic routine) ----
  function exportCsv(){
    var state = App.Storage.state;
    var dates = Object.keys(state.days).sort();
    var blocks = getRoutineBlocks();
    var header = ["Date","Saved","Habits Done","Habits Total","Routine Done","Routine Total","Pomodoros","Rating","Priority","Journal"];
    var rows = [header];
    dates.forEach(function(key){
      var d = normalizeDay(state.days[key]);
      var hc = HABITS.filter(function(h){ return d.h[h.id]; }).length;
      var rc = blocks.filter(function(b){ return d.rb[b.id]; }).length;
      var totalP = Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
      rows.push([key, d.saved?"Yes":"No", hc, HABITS.length, rc, blocks.length, totalP, d.rating, d.priority||"", d.journal||""]);
    });
    U.downloadBlob(U.toCsv(rows), "text/csv;charset=utf-8;", "daily-log-"+U.todayKey()+".csv");
  }

  // ---- Init and wire events ----
  function wireEvents(){
    // habits checkbox change
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

    // pomodoro block clicks
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

    // rating slider
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

    // save day
    dom.saveDayBtn.addEventListener("click", function(){
      App.Storage.mutateDay(App.curKey, function(d){ d.saved = true; });
      refreshSavedBadge();
      App.renderHeader();
      U.showToast("Saved ✓");
    });

    // routine add button
    dom.routineAddBtn.addEventListener('click', addRoutineStep);
    dom.routineAddName.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addRoutineStep();
    });
  }

  function init(){
    cacheDom();
    wireEvents();
  }

  return {
    HABITS: HABITS,
    BLOCKS: BLOCKS,
    getRoutineBlocks: getRoutineBlocks,
    getSubjectRotation: getSubjectRotation,
    emptyDay: emptyDay,
    normalizeDay: normalizeDay,
    init: init,
    renderDailyPanel: renderDailyPanel,
    updateDailyStats: updateDailyStats,
    refreshSavedBadge: refreshSavedBadge,
    exportCsv: exportCsv,
    CHECK_SVG: CHECK_SVG
  };
})();

