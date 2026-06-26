/* ============================================================
   app.js
   Loads LAST. The main entry point — wires up everything that
   isn't owned by a single domain module: the header stats, the
   main-tab / day navigator, the daily-view subtabs, and the
   footer's data-tools toolbar (CSV export, JSON backup/restore,
   reset cycle). Then runs the init sequence.

   A few things live directly on the App namespace (rather than
   under App.Storage/Habits/Challenge/Analytics) because they're
   genuinely cross-cutting and every other module needs them:

     App.curKey         — the date currently shown in the Daily /
                           21-Day views (a plain string, "YYYY-MM-DD")
     App.renderHeader()  — recomputes + repaints the header stats
     App.renderDayNav()  — recomputes + repaints the day navigator
     App.setCurKey(key)  — changes the viewed date and re-renders
     App.switchMainTab() — switches between 21-Day / Daily / Analytics

   habits.js reads App.curKey directly; challenge.js calls
   App.renderHeader/App.renderDayNav/App.setCurKey/App.switchMainTab
   from its own event handlers (e.g. clicking a day-column header
   jumps the Daily view to that date). This file is the only one
   that *assigns* App.curKey — every other module only reads it.

   LOAD ORDER: storage.js, theme.js, habits.js, challenge.js,
   analytics.js, then this file. As storage.js's header explains,
   load order only matters in the sense that every file must be
   parsed before init() runs below — none of the modules above call
   into each other at parse time, only inside functions that fire
   later, so by the time init() executes everything is ready.
   ============================================================ */

(function(){
  "use strict";
  var U = App.Util;

  var activeMainTab = "daily";

  /* ---------- dom ---------- */
  var dom = {};
  function cacheDom(){
    dom.hdrCycle = document.getElementById("hdrCycle");
    dom.hdrStreak = document.getElementById("hdrStreak");
    dom.hdrToday = document.getElementById("hdrToday");
    dom.hstatCycle = document.getElementById("hstatCycle");
    dom.hstatStreak = document.getElementById("hstatStreak");
    dom.hstatToday = document.getElementById("hstatToday");

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
  }

  /* ---------- render: header + day navigator ---------- */
  function renderHeader(){
    var cycle = App.Challenge.computeCycleStats();
    var streak = App.Analytics.computeStreak();
    dom.hdrCycle.textContent = cycle.overallPct + "%";
    dom.hdrStreak.textContent = streak;
    dom.hdrToday.textContent = U.fmtWeekdayDate(U.todayKey());
    dom.hstatStreak.classList.toggle("lit", streak >= 3);
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

  /* ---------- render: daily panel (cross-module) ---------- */
  function renderDailyPanel(){
    App.Habits.renderDailyPanel();
    App.Challenge.renderChallengeChecklist();
  }

  function renderEverything(){
    App.Challenge.rebuildCycleTable();
    App.Challenge.renderCycleDash();
    renderDailyPanel();
    renderHeader();
    renderDayNav();
    if(activeMainTab === "analytics") App.Analytics.renderAnalytics();
  }

  /* ---------- tabs + day navigation ---------- */
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
    if(U.keyToDate(nd) > U.todayDate()) return; // never navigate into the future
    setCurKey(nd);
  }

  /* ---------- footer: data tools ---------- */
  function backupJson(){
    U.downloadBlob(JSON.stringify(App.Storage.state, null, 2), "application/json", "tracker-backup-"+U.todayKey()+".json");
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
      if(App.Storage.isValidUnified(parsed)){
        if(confirm("Load this backup? It will replace your entire dataset — the 21-day grid and every daily log.")){
          App.Storage.replaceState(parsed);
          renderEverything();
          U.showToast("Backup restored ✓");
        }
      } else if(App.Storage.isLegacyCycleBackup(parsed)){
        if(confirm("This looks like an older 21-day-only backup. Load it into the 21-day grid? Your daily logs stay as they are.")){
          App.Storage.replaceCycle({ startDate: parsed.startDate, activities: parsed.activities, checks: parsed.checks });
          renderEverything();
          U.showToast("21-day grid restored ✓");
        }
      } else {
        alert("That JSON doesn't look like a backup from this tracker.");
      }
      dom.restoreInput.value = "";
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  function wireEvents(){
    dom.mainTabs.forEach(function(btn){ btn.addEventListener("click", function(){ switchMainTab(btn.dataset.tab); }); });
    dom.dailySubtabs.forEach(function(btn){ btn.addEventListener("click", function(){ switchSubTab(btn.dataset.subtab); }); });

    dom.navPrev.addEventListener("click", function(){ changeDay(-1); });
    dom.navNext.addEventListener("click", function(){ changeDay(1); });
    dom.navToday.addEventListener("click", function(){ setCurKey(U.todayKey()); });

    dom.hstatCycle.addEventListener("click", function(){ switchMainTab("cycle"); });
    dom.hstatStreak.addEventListener("click", function(){ switchMainTab("analytics"); });
    dom.hstatToday.addEventListener("click", function(){ switchMainTab("daily"); setCurKey(U.todayKey()); });

    dom.exportCsvBtn.addEventListener("click", function(){ App.Challenge.exportCsv(); });
    dom.exportDailyCsvBtn.addEventListener("click", function(){ App.Habits.exportCsv(); });
    dom.backupBtn.addEventListener("click", backupJson);
    dom.resetCycleBtn.addEventListener("click", function(){
      if(App.Challenge.resetCycle()){ renderHeader(); renderDayNav(); }
    });
    dom.restoreBtn.addEventListener("click", function(){ dom.restoreInput.click(); });
    dom.restoreInput.addEventListener("change", function(e){
      var file = e.target.files && e.target.files[0];
      if(!file) return;
      handleRestoreFile(file);
    });
  }

  /* ---------- init ---------- */
  function init(){
    cacheDom();

    App.Theme.init();
    App.Storage.init();
    App.curKey = U.todayKey();

    App.Habits.init();
    App.Challenge.init();
    App.Analytics.init();

    wireEvents();
    switchMainTab("daily");
    switchSubTab("habits");

    renderHeader();
    renderDayNav();
    App.Challenge.rebuildCycleTable();
    App.Challenge.renderCycleDash();
    renderDailyPanel();

    if(App.Storage.migrated) U.showToast("Imported your existing data ✓", 3500);
  }

  // Cross-module API surface — see file header for why these live on App directly.
  App.curKey = null;
  App.renderHeader = renderHeader;
  App.renderDayNav = renderDayNav;
  App.setCurKey = setCurKey;
  App.switchMainTab = switchMainTab;

  init();
})();