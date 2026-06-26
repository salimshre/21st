/* ============================================================
   analytics.js
   Owns the "Analytics" view: weekly habit/routine completion
   rates, per-item insight bars, the 21-day-by-category breakdown,
   and the 28-day streak grid. Purely a read/derive-and-render
   layer — it never mutates App.Storage.state, it only reads from
   App.Habits (the fixed lists + normalizeDay) and App.Challenge
   (cycle stats + categories).

   Rendered lazily: app.js only calls renderAnalytics() when the
   Analytics tab is actually opened, since it's the most expensive
   render (iterates the last 7/28 days).
   ============================================================ */

App.Analytics = (function(){
  "use strict";
  var U = App.Util;

  var HABIT_STREAK_MIN = 7;    // out of 10 — threshold for a "good" day in the streak calc
  var ROUTINE_STREAK_MIN = 12; // out of 17

  /* ---------- derived data ---------- */
  function getWeeklyStats(endKey){
    var H = App.Habits;
    var state = App.Storage.state;
    var stats = { habitsCompleted:0, routineCompleted:0, totalDays:0, pomodoros:0, ratings:[], habitCounts:{}, routineCounts:{} };
    H.HABITS.forEach(function(h){ stats.habitCounts[h.id]=0; });
    H.ROUTINE_BLOCKS.forEach(function(b){ stats.routineCounts[b.id]=0; });
    for(var i=6; i>=0; i--){
      var key = U.addDays(endKey, -i);
      if(!state.days[key]) continue;
      var d = H.normalizeDay(state.days[key]);
      if(!d.saved) continue;
      stats.totalDays++;
      var hc = H.HABITS.filter(function(h){ return d.h[h.id]; }).length;
      var rc = H.ROUTINE_BLOCKS.filter(function(b){ return d.rb[b.id]; }).length;
      stats.habitsCompleted += hc;
      stats.routineCompleted += rc;
      stats.ratings.push(d.rating || 5);
      H.HABITS.forEach(function(h){ if(d.h[h.id]) stats.habitCounts[h.id]++; });
      H.ROUTINE_BLOCKS.forEach(function(b){ if(d.rb[b.id]) stats.routineCounts[b.id]++; });
      stats.pomodoros += Object.values(d.po).reduce(function(a,b){ return a+b; }, 0);
    }
    return stats;
  }

  function dayQuality(key){
    var H = App.Habits;
    var state = App.Storage.state;
    var d = state.days[key];
    if(!d) return false;
    d = H.normalizeDay(d);
    if(!d.saved) return false;
    var hc = H.HABITS.filter(function(h){ return d.h[h.id]; }).length;
    var rc = H.ROUTINE_BLOCKS.filter(function(b){ return d.rb[b.id]; }).length;
    return hc >= HABIT_STREAK_MIN && rc >= ROUTINE_STREAK_MIN;
  }

  function computeStreak(){
    var streak = 0, key = U.todayKey(), guard = 0;
    while(dayQuality(key) && guard < 3650){ streak++; key = U.addDays(key, -1); guard++; }
    return streak;
  }

  /* ---------- dom ---------- */
  var dom = {};
  function cacheDom(){
    dom.analyticsSummary = document.getElementById("analyticsSummary");
    dom.habitInsights = document.getElementById("habitInsights");
    dom.routineInsights = document.getElementById("routineInsights");
    dom.analyticsCycleWrap = document.getElementById("analyticsCycleWrap");
    dom.streakGrid = document.getElementById("streakGrid");
  }

  /* ---------- render ---------- */
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
    var thisRoutineRate = thisWeek.routineCompleted / (H.ROUTINE_BLOCKS.length*7);

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

    dom.routineInsights.innerHTML = H.ROUTINE_BLOCKS.map(function(b){
      var pct = Math.round(((thisWeek.routineCounts[b.id]||0)/7)*100);
      var color = pct>=80 ? "var(--success)" : pct>=50 ? "var(--primary)" : "var(--danger)";
      return '<div class="habit-insight-row"><div class="habit-insight-name">'+b.name+'</div>' +
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

    renderStreakGrid();
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

  function init(){
    cacheDom();
  }

  return {
    HABIT_STREAK_MIN: HABIT_STREAK_MIN, ROUTINE_STREAK_MIN: ROUTINE_STREAK_MIN,
    getWeeklyStats: getWeeklyStats, dayQuality: dayQuality, computeStreak: computeStreak,
    init: init, renderAnalytics: renderAnalytics, renderStreakGrid: renderStreakGrid
  };
})();