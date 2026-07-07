/* ============================================================
   app.js – Main entry with keyboard shortcuts, focus mode,
   tutorial (fixed), and notification reminders.
   ============================================================ */

(function(){
  "use strict";
  var U = App.Util;

  var activeMainTab = "daily";
  var dom = {};

  function cacheDom(){
    dom.hdrCycle = document.getElementById("hdrCycle");
    dom.hdrStreak = document.getElementById("hdrStreak");
    dom.hdrToday = document.getElementById("hdrToday");
    dom.hdrBackup = document.getElementById("hdrBackup");
    dom.hdrTodos = document.getElementById("hdrTodos");
    dom.hstatCycle = document.getElementById("hstatCycle");
    dom.hstatStreak = document.getElementById("hstatStreak");
    dom.hstatToday = document.getElementById("hstatToday");
    dom.headerBackupBtn = document.getElementById("headerBackupBtn");
    dom.mainTabs = Array.from(document.querySelectorAll(".maintab"));
    dom.panels = Array.from(document.querySelectorAll(".view-panel"));
    dom.daynav = document.getElementById("daynav");
    dom.navPrev = document.getElementById("navPrev");
    dom.navNext = document.getElementById("navNext");
    dom.navToday = document.getElementById("navToday");
    dom.navTitle = document.getElementById("navTitle");
    dom.navSub = document.getElementById("navSub");
    dom.dailySubtabs = Array.from(document.querySelectorAll(".subtab"));
    dom.subPanels = Array.from(document.querySelectorAll(".subpanel"));
    dom.exportCsvBtn = document.getElementById("exportCsvBtn");
    dom.exportDailyCsvBtn = document.getElementById("exportDailyCsvBtn");
    dom.backupBtn = document.getElementById("backupBtn");
    dom.restoreBtn = document.getElementById("restoreBtn");
    dom.restoreInput = document.getElementById("restoreInput");
    dom.resetCycleBtn = document.getElementById("resetCycleBtn");
    dom.statTodos = document.getElementById("statTodos");
    dom.focusToggle = document.getElementById("focusToggle");
    dom.helpBtn = document.getElementById("helpBtn");
    dom.tourOverlay = document.getElementById("tourOverlay");
    dom.quickStartCycle = document.getElementById("quickStartCycle");
    dom.exportMarkdownBtn = document.getElementById("exportMarkdownBtn");
  }

  // ---- Render header ----
  function renderHeader(){
    var cycle = App.Challenge.computeCycleStats();
    var streak = App.Analytics.computeStreak();
    var lastBackupAt = (App.Storage.state.meta || {}).lastBackupAt;
    var backupAge = Infinity;
    if(lastBackupAt){
      var backupDate = new Date(lastBackupAt);
      if(!isNaN(backupDate.getTime())) backupAge = Math.floor((Date.now() - backupDate.getTime()) / 86400000);
    }
    dom.hdrCycle.textContent = cycle.overallPct + "%";
    dom.hdrStreak.textContent = streak;
    dom.hdrToday.textContent = U.fmtWeekdayDate(U.todayKey());
    dom.hdrBackup.textContent = backupAge === Infinity ? "Now" : backupAge + "d";
    dom.hstatStreak.classList.toggle("lit", streak >= 3);
    dom.headerBackupBtn.classList.toggle("warn", backupAge === Infinity || backupAge > 7);

    var d = App.Storage.getDay(App.curKey);
    var todos = d.todos || [];
    var done = todos.filter(function(t){ return t.done; }).length;
    var total = todos.length;
    if (dom.hdrTodos) dom.hdrTodos.textContent = done + '/' + total;
  }

  function renderDayNav(){
    var DAYS_IN_CYCLE = App.Challenge.DAYS_IN_CYCLE;
    var idx = App.Challenge.dayIndexForDate(App.curKey);
    var inCycle = idx >= 1 && idx <= DAYS_IN_CYCLE;
    var isToday = App.curKey === U.todayKey();

    dom.navTitle.textContent = isToday ? "Today" : U.fmtWeekdayDate(App.curKey);
    dom.navTitle.title = App.curKey;
    if(inCycle){
      dom.navSub.textContent = "Day " + idx + " of " + DAYS_IN_CYCLE + "-day cycle";
    } else if(idx < 1){
      dom.navSub.textContent = "Cycle starts " + U.fmtWeekdayDate(App.Storage.state.cycle.startDate);
    } else {
      dom.navSub.textContent = "Outside current 21-day cycle";
    }
    dom.navToday.classList.toggle("is-today", isToday);
    dom.navNext.disabled = isToday;
  }

  function renderDailyPanel(){
    App.Habits.renderDailyPanel();
    App.Challenge.renderChallengeChecklist();
    if (typeof App.Todos !== 'undefined' && App.Todos.renderTodos) {
      App.Todos.renderTodos();
    }
    renderHeader();
  }

  function renderEverything(){
    App.Challenge.rebuildCycleTable();
    App.Challenge.renderCycleDash();
    renderDailyPanel();
    renderHeader();
    renderDayNav();
    if(activeMainTab === "analytics") App.Analytics.renderAnalytics();
  }

  // ---- Tabs ----
  function switchMainTab(tab){
    activeMainTab = tab;
    dom.mainTabs.forEach(function(b){ b.classList.toggle("active", b.dataset.tab === tab); });
    dom.panels.forEach(function(p){ p.classList.toggle("active", p.id === "panel-" + tab); });
    dom.daynav.style.display = (tab === "analytics") ? "none" : "flex";
    if(tab === "cycle"){
      App.Challenge.updateCycleHighlight();
      requestAnimationFrame(App.Challenge.scrollToViewingColumn);
    }
    if(tab === "analytics") App.Analytics.renderAnalytics();
  }

  function switchSubTab(name){
    dom.dailySubtabs.forEach(function(b){ b.classList.toggle("active", b.dataset.subtab === name); });
    dom.subPanels.forEach(function(p){ p.classList.toggle("active", p.id === "sub-" + name); });
    if (name === 'todos' && typeof App.Todos !== 'undefined') {
      App.Todos.renderTodos();
    }
  }

  function setCurKey(key){
    App.curKey = key;
    renderDayNav();
    renderDailyPanel();
    App.Challenge.updateCycleHighlight();
    if(activeMainTab === "cycle") App.Challenge.scrollToViewingColumn();
  }

  function changeDay(delta){
    var nd = U.addDays(App.curKey, delta);
    if(U.keyToDate(nd) > U.todayDate()) return;
    setCurKey(nd);
  }

  // ---- Backup/restore ----
  function backupJson(prefix){
    var name = (prefix || "tracker-backup") + "-" + U.todayKey() + ".json";
    U.downloadBlob(JSON.stringify(App.Storage.state, null, 2), "application/json", name);
    App.Storage.markBackupDownloaded(name);
    if(activeMainTab === "analytics") App.Analytics.renderAnalytics();
    return name;
  }

  function handleRestoreFile(file){
    var reader = new FileReader();
    reader.onload = function(){
      var parsed;
      try{ parsed = JSON.parse(String(reader.result)); }
      catch(err){
        alert("That file isn't valid JSON — make sure it's a backup exported from this tracker.");
        dom.restoreInput.value = ""; return;
      }
      // Show preview
      var summary = "Backup summary:\n";
      if(parsed.days) summary += "• " + Object.keys(parsed.days).length + " daily logs\n";
      if(parsed.cycle) summary += "• 21-day cycle: " + parsed.cycle.activities.length + " activities\n";
      if(parsed.history) summary += "• " + parsed.history.length + " archived cycles\n";
      if(!confirm("This will replace your entire dataset.\n\n" + summary + "\nContinue?")) return;

      if(App.Storage.isValidUnified(parsed)){
        backupJson("pre-restore-backup");
        App.Storage.replaceState(parsed);
        renderEverything();
        U.showToast("Safety backup downloaded, then backup restored ✓", 3500, "success");
      } else if(App.Storage.isLegacyCycleBackup(parsed)){
        if(confirm("This looks like an older 21-day-only backup. Load it into the 21-day grid? Your daily logs stay as they are.")){
          backupJson("pre-restore-backup");
          App.Storage.replaceCycle({ startDate: parsed.startDate, activities: parsed.activities, checks: parsed.checks });
          renderEverything();
          U.showToast("Safety backup downloaded, then 21-day grid restored ✓", 3500, "success");
        }
      } else {
        alert("That JSON doesn't look like a backup from this tracker.");
      }
      dom.restoreInput.value = "";
    };
    reader.readAsText(file);
  }

  // ---- Export Markdown ----
  function exportMarkdown(){
    var today = U.todayKey();
    var d = App.Storage.getDay(today);
    var habits = App.Storage.getHabits();
    var routine = App.Storage.getRoutineBlocks();
    var md = "# Daily Log: " + today + "\n\n";
    md += "## Habits\n";
    habits.forEach(function(h){ md += "- [ " + (d.h[h.id] ? "x" : " ") + " ] " + h.label + "\n"; });
    md += "\n## Routine\n";
    routine.forEach(function(b){ md += "- [ " + (d.rb[b.id] ? "x" : " ") + " ] " + b.name + " (" + b.time + ")\n"; });
    md += "\n## Rating: " + d.rating + "/10\n";
    md += "\n## Journal\n" + (d.journal || "—") + "\n";
    md += "\n## Priority\n" + (d.priority || "—") + "\n";
    U.downloadBlob(md, "text/markdown;charset=utf-8;", "daily-log-"+today+".md");
    U.showToast("Markdown exported", 1500, "success");
  }

  // ---- Keyboard shortcuts ----
  function handleKeys(e){
    if(e.ctrlKey && e.key === "s"){
      e.preventDefault();
      var saveBtn = document.getElementById("saveDayBtn");
      if(saveBtn) saveBtn.click();
    }
    if(e.key === "ArrowLeft" && !e.target.closest("input,textarea,select")){
      e.preventDefault();
      changeDay(-1);
    }
    if(e.key === "ArrowRight" && !e.target.closest("input,textarea,select")){
      e.preventDefault();
      changeDay(1);
    }
    if(e.key === "?" && !e.target.closest("input,textarea,select")){
      e.preventDefault();
      showTour();
    }
  }

  // ---- Focus mode ----
  function toggleFocusMode(){
    var body = document.body;
    body.classList.toggle("focus-mode");
    var state = App.Storage.state;
    state.meta.focusMode = body.classList.contains("focus-mode");
    App.Storage.save();
  }

  // ---- Tutorial (fixed) ----
  function showTour(){
    var overlay = dom.tourOverlay;
    if(!overlay) return;

    // If already visible, just bring it to front
    if(overlay.style.display === "block") return;

    var steps = [
      { target: "#hstatCycle", text: "This shows your 21-day progress." },
      { target: "#hstatStreak", text: "Your current streak of quality days." },
      { target: "#hstatToday", text: "Jump back to today." },
      { target: "#hdrBackup", text: "Backup your data regularly." },
      { target: "#saveDayBtn", text: "Don't forget to save each day!" }
    ];
    var currentStep = 0;

    var tooltip = overlay.querySelector(".tour-tooltip");
    var textEl = overlay.querySelector("#tourText");
    var nextBtn = overlay.querySelector(".tour-next");
    var skipBtn = overlay.querySelector(".tour-skip");

    function updateStep(index){
      if(index >= steps.length){
        // Tour finished
        overlay.style.display = "none";
        completeTour();
        return;
      }
      var step = steps[index];
      var el = document.querySelector(step.target);
      if(el){
        var rect = el.getBoundingClientRect();
        textEl.textContent = step.text;
        // Position tooltip below the target
        tooltip.style.top = (rect.bottom + 10) + "px";
        tooltip.style.left = (rect.left + rect.width/2 - 120) + "px";
        if(index === steps.length - 1){
          nextBtn.textContent = "Got it!";
        } else {
          nextBtn.textContent = "Next →";
        }
        overlay.style.display = "block";
      } else {
        // target not found, skip to next
        updateStep(index + 1);
      }
    }

    function completeTour(){
      App.Storage.state.meta.tourCompleted = true;
      App.Storage.save();
    }

    // Click handlers
    nextBtn.onclick = function(){
      updateStep(currentStep + 1);
      currentStep++;
    };
    skipBtn.onclick = function(){
      overlay.style.display = "none";
      completeTour();
    };
    // Click outside tooltip to close (optional)
    overlay.onclick = function(e){
      if(e.target === overlay){
        overlay.style.display = "none";
        completeTour();
      }
    };

    // Start from step 0
    currentStep = 0;
    updateStep(0);
  }

  // ---- Notification reminder ----
  function requestNotificationPermission(){
    if("Notification" in window && Notification.permission === "default"){
      Notification.requestPermission();
    }
  }
  function scheduleReminder(){
    var now = new Date();
    var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);
    if(now > target) target.setDate(target.getDate() + 1);
    var ms = target - now;
    setTimeout(function(){
      var todayKey = U.todayKey();
      var d = App.Storage.getDay(todayKey);
      if(!d.saved && "Notification" in window && Notification.permission === "granted"){
        new Notification("Routine OS Reminder", {
          body: "Don't forget to save today's progress!",
          icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🎯%3C/text%3E%3C/svg%3E"
        });
      }
      scheduleReminder();
    }, ms);
  }

  // ---- Events ----
  function wireEvents(){
    dom.mainTabs.forEach(function(btn){ btn.addEventListener("click", function(){ switchMainTab(btn.dataset.tab); }); });
    dom.dailySubtabs.forEach(function(btn){ btn.addEventListener("click", function(){ switchSubTab(btn.dataset.subtab); }); });

    dom.navPrev.addEventListener("click", function(){ changeDay(-1); });
    dom.navNext.addEventListener("click", function(){ changeDay(1); });
    dom.navToday.addEventListener("click", function(){ setCurKey(U.todayKey()); });

    dom.hstatCycle.addEventListener("click", function(){ switchMainTab("cycle"); });
    dom.hstatStreak.addEventListener("click", function(){ switchMainTab("analytics"); });
    dom.hstatToday.addEventListener("click", function(){ switchMainTab("daily"); setCurKey(U.todayKey()); });
    dom.headerBackupBtn.addEventListener("click", function(){ backupJson(); renderHeader(); });

    dom.exportCsvBtn.addEventListener("click", function(){ App.Challenge.exportCsv(); });
    dom.exportDailyCsvBtn.addEventListener("click", function(){ App.Habits.exportCsv(); });
    dom.backupBtn.addEventListener("click", function(){ backupJson(); });
    dom.resetCycleBtn.addEventListener("click", function(){
      if(App.Challenge.resetCycle()){ renderHeader(); renderDayNav(); }
    });
    dom.restoreBtn.addEventListener("click", function(){ dom.restoreInput.click(); });
    dom.restoreInput.addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      handleRestoreFile(file);
    });

    if (dom.statTodos) {
      dom.statTodos.addEventListener('click', function() {
        var todosBtn = dom.dailySubtabs.find(function(b) { return b.dataset.subtab === 'todos'; });
        if (todosBtn) todosBtn.click();
      });
    }

    // Focus mode
    if(dom.focusToggle){
      dom.focusToggle.addEventListener("click", toggleFocusMode);
      if(App.Storage.state.meta.focusMode){
        document.body.classList.add("focus-mode");
      }
    }

    // Help / Tour
    if(dom.helpBtn) dom.helpBtn.addEventListener("click", showTour);

    // Quick start cycle
    if(dom.quickStartCycle){
      dom.quickStartCycle.addEventListener("click", App.Challenge.quickStartNextCycle);
    }

    // Export Markdown
    if(dom.exportMarkdownBtn){
      dom.exportMarkdownBtn.addEventListener("click", exportMarkdown);
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeys);
  }

  // ---- Init ----
  function init(){
    cacheDom();

    App.Theme.init();
    App.Storage.init();
    App.curKey = U.todayKey();

    App.Habits.init();
    App.Challenge.init();
    App.Analytics.init();
    if (typeof App.Todos !== 'undefined') App.Todos.init();

    wireEvents();
    switchMainTab("daily");
    switchSubTab("habits");

    renderHeader();
    renderDayNav();
    App.Challenge.rebuildCycleTable();
    App.Challenge.renderCycleDash();
    renderDailyPanel();

    // Show tour only on first visit (and if not completed)
    if(!App.Storage.state.meta.tourCompleted){
      // Delay a bit so the DOM is fully rendered
      setTimeout(showTour, 600);
      // Do NOT set tourCompleted here – it will be set when the tour is finished or skipped.
    }

    // Notification permission & reminder
    requestNotificationPermission();
    scheduleReminder();

    // Auto-backup scheduler
    App.Storage.scheduleAutoBackup();

    if(App.Storage.migrated) U.showToast("Imported your existing data ✓", 3500, "success");
  }

  // Cross-module API
  App.curKey = null;
  App.renderHeader = renderHeader;
  App.renderDayNav = renderDayNav;
  App.setCurKey = setCurKey;
  App.switchMainTab = switchMainTab;

  init();
})();
