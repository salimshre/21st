/* ============================================================
   analytics.js – reads from dynamic routine blocks.
   ============================================================ */

App.Analytics = (function(){
  "use strict";
  var U = App.Util;

  var HABIT_STREAK_MIN = 7;    // out of 10

  function getRoutineBlocks() {
    return App.Habits.getRoutineBlocks();
  }

  function getWeeklyStats(endKey){
    var H = App.Habits;
    var blocks = getRoutineBlocks();
    var state = App.Storage.state;
    var stats = { habitsCompleted:0, routineCompleted:0, totalDays:0, pomodoros:0, ratings:[], habitCounts:{}, routineCounts:{} };
    H.HABITS.forEach(function(h){ stats.habitCounts[h.id]=0; });
    blocks.forEach(function(b){ stats.routineCounts[b.id]=0; });
    for(var i=6; i>=0; i--){
      var key = U.addDays(endKey, -i);
      if(!state.days[key]) continue;
      var d = H.normalizeDay(state.days[key]);
      if(!d.saved) continue;
      stats.totalDays++;
      var hc = H.HABITS.filter(function(h){ return d.h[h.id]; }).length;
      var rc = blocks.filter(function(b){ return d.rb[b.id]; }).length;
      stats.habitsCompleted += hc;
      stats.routineCompleted += rc;
      stats.ratings.push(d.rating || 5);
      H.HABITS.forEach(function(h){ if(d.h[h.id]) stats.habitCounts[h.id]++; });
      blocks.forEach(function(b){ if(d.rb[b.id]) stats.routineCounts[b.id]++; });
      stats.pomodoros += Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
    }
    return stats;
  }

  function dayQuality(key){
    var H = App.Habits;
    var blocks = getRoutineBlocks();
    var state = App.Storage.state;
    var d = state.days[key];
    if(!d) return false;
    d = H.normalizeDay(d);
    if(!d.saved) return false;
    var hc = H.HABITS.filter(function(h){ return d.h[h.id]; }).length;
    var rc = blocks.filter(function(b){ return d.rb[b.id]; }).length;
    var routineThreshold = Math.min(blocks.length, 12);
    return hc >= HABIT_STREAK_MIN && rc >= routineThreshold;
  }

  function computeStreak(){
    var streak = 0, key = U.todayKey(), guard = 0;
    while(dayQuality(key) && guard < 3650){ streak++; key = U.addDays(key, -1); guard++; }
    return streak;
  }

  // ---- DOM cache ----
  var dom = {};
  function cacheDom(){
    dom.analyticsSummary = document.getElementById("analyticsSummary");
    dom.habitInsights = document.getElementById("habitInsights");
    dom.routineInsights = document.getElementById("routineInsights");
    dom.todoInsights = document.getElementById("todoInsights");
    dom.analyticsCycleWrap = document.getElementById("analyticsCycleWrap");
    dom.cycleHistoryAnalytics = document.getElementById("cycleHistoryAnalytics");
    dom.missedChallengeInsights = document.getElementById("missedChallengeInsights");
    dom.dataHealth = document.getElementById("dataHealth");
    dom.streakGrid = document.getElementById("streakGrid");
  }

  // ---- Todo insights (unchanged) ----
  function renderTodoInsights() {
    var state = App.Storage.state;
    var today = U.todayKey();
    var totalTodos = 0, doneTodos = 0;
    for (var i = 6; i >= 0; i--) {
      var key = U.addDays(today, -i);
      var d = state.days[key];
      if (!d) continue;
      var todos = d.todos || [];
      totalTodos += todos.length;
      doneTodos += todos.filter(function(t) { return t.done; }).length;
    }
    var pct = totalTodos ? Math.round((doneTodos / totalTodos) * 100) : 0;
    if (dom.todoInsights) {
      dom.todoInsights.innerHTML =
        '<div class="analytics-grid">' +
          '<div class="analytics-card">' +
            '<div class="analytics-big">' + pct + '%</div>' +
            '<div class="analytics-label">Todo Completion</div>' +
            '<div class="analytics-sub">' + doneTodos + '/' + totalTodos + ' done in last 7 days</div>' +
          '</div>' +
        '</div>';
    }
  }

  // ---- Cycle history and other helpers (unchanged) ----
  function cycleScore(cycle){
    return App.Challenge.computeCycleStats(cycle).overallPct;
  }

  function cycleLabel(cycle){
    return U.fmtWeekdayDate(cycle.startDate) + " - " + U.fmtWeekdayDate(U.addDays(cycle.startDate, App.Challenge.DAYS_IN_CYCLE - 1));
  }

  function formatDateTime(iso){
    if(!iso) return "Never";
    var d = new Date(iso);
    if(isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString([], { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  function backupAgeDays(iso){
    if(!iso) return Infinity;
    var d = new Date(iso);
    if(isNaN(d.getTime())) return Infinity;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  function renderCycleHistoryAnalytics(){
    if(!dom.cycleHistoryAnalytics) return;
    var state = App.Storage.state;
    var cycles = [{ label:"Current", cycle:state.cycle, current:true }].concat((state.history || []).map(function(h){
      return { label:h.label || cycleLabel(h.cycle), cycle:h.cycle, archivedAt:h.archivedAt };
    }));
    var scored = cycles.map(function(x){ return Object.assign({}, x, { score:cycleScore(x.cycle) }); });
    var previous = scored[1];
    var best = scored.reduce(function(a,b){ return b.score > a.score ? b : a; }, scored[0]);
    var worst = scored.reduce(function(a,b){ return b.score < a.score ? b : a; }, scored[0]);
    var delta = previous ? scored[0].score - previous.score : null;

    dom.cycleHistoryAnalytics.innerHTML =
      '<div class="health-grid">' +
        '<div class="health-item"><div class="health-label">Current vs previous</div><div class="health-value">'+(delta === null ? "—" : (delta >= 0 ? "+" : "") + delta + "%")+'</div><div class="health-sub">'+(previous ? previous.label : "No previous cycle yet")+'</div></div>' +
        '<div class="health-item ok"><div class="health-label">Best cycle</div><div class="health-value">'+best.score+'%</div><div class="health-sub">'+U.escapeHtml(best.label)+'</div></div>' +
        '<div class="health-item warn"><div class="health-label">Weakest cycle</div><div class="health-value">'+worst.score+'%</div><div class="health-sub">'+U.escapeHtml(worst.label)+'</div></div>' +
        '<div class="health-item"><div class="health-label">Cycles tracked</div><div class="health-value">'+scored.length+'</div><div class="health-sub">'+(state.history || []).length+' archived</div></div>' +
      '</div>' +
      '<div class="cycle-trend">' + scored.slice(0, 8).map(function(x){
        return '<div class="cycle-trend-row"><span>'+U.escapeHtml(x.label)+'</span><div class="habit-bar"><div class="habit-bar-fill" style="width:'+x.score+'%;background:var(--primary)"></div></div><strong>'+x.score+'%</strong></div>';
      }).join("") + '</div>';
  }

  function renderMissedChallengeInsights(){
    if(!dom.missedChallengeInsights) return;
    var C = App.Challenge;
    var cycle = App.Storage.state.cycle;
    var dayIdx = U.clamp(C.dayIndexForDate(U.todayKey()) - 1, 0, C.DAYS_IN_CYCLE - 1);
    var rows = C.groupedActivities(cycle).map(function(a){
      var arr = cycle.checks[a.id] || [];
      var missed = 0;
      for(var i=0; i<=dayIdx; i++) if(!arr[i]) missed++;
      return { activity:a, missed:missed, pct:Math.round(((dayIdx + 1 - missed) / (dayIdx + 1)) * 100) };
    }).filter(function(x){ return x.missed > 0; })
      .sort(function(a,b){ return b.missed - a.missed; })
      .slice(0, 10);
    if(!rows.length){
      dom.missedChallengeInsights.innerHTML = '<div class="challenge-empty">No missed challenge activities in the active cycle yet.</div>';
      return;
    }
    dom.missedChallengeInsights.innerHTML = rows.map(function(x){
      return '<div class="habit-insight-row"><div class="habit-insight-name">'+U.escapeHtml(x.activity.name)+'</div>' +
        '<div class="habit-insight-bar"><div class="habit-bar"><div class="habit-bar-fill" style="width:'+x.pct+'%;background:var(--danger)"></div></div>' +
        '<div class="habit-pct">'+x.missed+' missed</div></div></div>';
    }).join("");
  }

  function renderDataHealth(){
    if(!dom.dataHealth) return;
    var state = App.Storage.state;
    var meta = state.meta || {};
    var dayKeys = Object.keys(state.days || {});
    var savedDays = dayKeys.filter(function(k){ return state.days[k] && state.days[k].saved; }).length;
    var cycleDay = App.Challenge.dayIndexForDate(U.todayKey());
    var backupAge = backupAgeDays(meta.lastBackupAt);
    var backupStatus = backupAge === Infinity ? "Backup needed" : backupAge > 7 ? "Backup stale" : "Backup current";
    var backupTone = backupAge === Infinity || backupAge > 7 ? "warn" : "ok";
    var cycleText = cycleDay >= 1 && cycleDay <= App.Challenge.DAYS_IN_CYCLE ? "Day " + cycleDay + " of " + App.Challenge.DAYS_IN_CYCLE : "Outside cycle";

    dom.dataHealth.innerHTML =
      '<div class="health-grid">' +
        '<div class="health-item '+backupTone+'"><div class="health-label">Backup status</div><div class="health-value">'+backupStatus+'</div><div class="health-sub">'+formatDateTime(meta.lastBackupAt)+'</div></div>' +
        '<div class="health-item"><div class="health-label">Tracked days</div><div class="health-value">'+dayKeys.length+'</div><div class="health-sub">'+savedDays+' saved daily logs</div></div>' +
        '<div class="health-item"><div class="health-label">Cycle start</div><div class="health-value">'+state.cycle.startDate+'</div><div class="health-sub">'+cycleText+'</div></div>' +
        '<div class="health-item"><div class="health-label">Activities</div><div class="health-value">'+state.cycle.activities.length+'</div><div class="health-sub">21-day challenge tasks</div></div>' +
      '</div>';
  }

  function renderStreakGrid(){
    var today = U.todayKey();
    var cells = [];
    for(var i=27; i>=0; i--){
      var key = U.addDays(today, -i);
      cells.push({ key:key, on:dayQuality(key), today:key===today });
    }
    dom.streakGrid.innerHTML = cells.map(function(c){
      return '<div class="s-day'+(c.on?" on":"")+(c.today?" today":"")+'" title="'+c.key+'"></div>';
    }).join("");
  }

  // ---- Main renderAnalytics (uses dynamic routine) ----
  function renderAnalytics(){
    var H = App.Habits;
    var C = App.Challenge;
    var today = U.todayKey();
    var thisWeek = getWeeklyStats(today);
    var lastWeek = getWeeklyStats(U.addDays(today, -7));
    var cycle = C.computeCycleStats();
    var streak = computeStreak();

    var avgRating = thisWeek.ratings.length ? (thisWeek.ratings.reduce(function(a,b){return a+b;},0)/thisWeek.ratings.length).toFixed(1) : "—";
    var lastAvgRating = lastWeek.ratings.length ? (lastWeek.ratings.reduce(function(a,b){return a+b;},0)/lastWeek.ratings.length).toFixed(1) : "—";
    var thisHabitRate = thisWeek.habitsCompleted / (H.HABITS.length*7);
    var blocks = getRoutineBlocks();
    var thisRoutineRate = thisWeek.routineCompleted / (blocks.length*7);

    dom.analyticsSummary.innerHTML =
      '<div class="analytics-card"><div class="analytics-big">'+cycle.overallPct+'%</div><div class="analytics-label">21-Day Cycle</div><div class="analytics-sub">overall completion</div></div>' +
      '<div class="analytics-card"><div class="analytics-big">'+Math.round(thisHabitRate*100)+'%</div><div class="analytics-label">Habits</div><div class="analytics-sub">last 7 days</div></div>' +
      '<div class="analytics-card"><div class="analytics-big">'+Math.round(thisRoutineRate*100)+'%</div><div class="analytics-label">Routine</div><div class="analytics-sub">last 7 days</div></div>' +
      '<div class="analytics-card"><div class="analytics-big">'+streak+'</div><div class="analytics-label">Day Streak</div><div class="analytics-sub">🔥 consecutive</div></div>' +
      '<div class="analytics-card"><div class="analytics-big">'+thisWeek.pomodoros+'</div><div class="analytics-label">Pomodoros</div><div class="analytics-sub">'+(thisWeek.pomodoros/7).toFixed(1)+'/day</div></div>' +
      '<div class="analytics-card"><div class="analytics-big">'+avgRating+'</div><div class="analytics-label">Avg Rating</div><div class="analytics-sub">'+(lastAvgRating!=="—" ? "vs "+lastAvgRating+" last wk" : "—")+'</div></div>';

    dom.habitInsights.innerHTML = H.HABITS.map(function(h){
      var pct = Math.round(((thisWeek.habitCounts[h.id]||0)/7)*100);
      var color = pct>=80 ? "var(--success)" : pct>=50 ? "var(--primary)" : "var(--danger)";
      return '<div class="habit-insight-row"><div class="habit-insight-name">'+h.label+'</div>' +
        '<div class="habit-insight-bar"><div class="habit-bar"><div class="habit-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>' +
        '<div class="habit-pct">'+pct+'%</div></div></div>';
    }).join("");

    dom.routineInsights.innerHTML = blocks.map(function(b){
      var pct = Math.round(((thisWeek.routineCounts[b.id]||0)/7)*100);
      var color = pct>=80 ? "var(--success)" : pct>=50 ? "var(--primary)" : "var(--danger)";
      return '<div class="habit-insight-row"><div class="habit-insight-name">'+U.escapeHtml(b.name)+'</div>' +
        '<div class="habit-insight-bar"><div class="habit-bar"><div class="habit-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>' +
        '<div class="habit-pct">'+pct+'%</div></div></div>';
    }).join("");

    dom.analyticsCycleWrap.innerHTML = C.CAT_ORDER.map(function(c){
      if(!cycle.catTotal[c]) return "";
      var cat = C.CATEGORIES[c];
      var pct = Math.round((cycle.catChecked[c]/cycle.catTotal[c])*100);
      return '<div class="cat-mini"><div class="top"><span class="name">'+cat.label+'</span><span class="pct" style="color:var('+cat.varName+')">'+pct+'%</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:var('+cat.varName+')"></div></div></div>';
    }).join("");

    renderDataHealth();
    renderCycleHistoryAnalytics();
    renderMissedChallengeInsights();
    renderStreakGrid();
    renderTodoInsights();
  }

  function init(){
    cacheDom();
  }

  return {
    HABIT_STREAK_MIN: HABIT_STREAK_MIN,
    getWeeklyStats: getWeeklyStats,
    dayQuality: dayQuality,
    computeStreak: computeStreak,
    init: init,
    renderAnalytics: renderAnalytics,
    renderStreakGrid: renderStreakGrid,
    renderDataHealth: renderDataHealth
  };
})();

