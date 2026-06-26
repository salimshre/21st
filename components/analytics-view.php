<section class="view-panel" id="panel-analytics">
    <div class="view narrow">
      <div class="sec-lbl">Weekly + cycle summary</div>
      <div class="analytics-grid" id="analyticsSummary"></div>

      <div class="sec-lbl">Data health</div>
      <div class="card data-health" id="dataHealth"></div>

      <div class="sec-lbl">Habit insights (last 7 days)</div>
      <div class="card" id="habitInsights"></div>

      <div class="sec-lbl">Routine block insights (last 7 days)</div>
      <div class="card" id="routineInsights"></div>

      <div class="sec-lbl">Todo completion (last 7 days)</div>
      <div class="card" id="todoInsights"></div>

      <div class="sec-lbl">21-day cycle by category</div>
      <div class="dcard-cats card" id="analyticsCycleWrap" style="padding:16px;"></div>

      <div class="sec-lbl">Cycle history analytics</div>
      <div class="card data-health" id="cycleHistoryAnalytics"></div>

      <div class="sec-lbl">Missed challenge activities</div>
      <div class="card" id="missedChallengeInsights"></div>

      <div class="sec-lbl">28-day streak</div>
      <div class="card">
        <div class="streak-grid" id="streakGrid"></div>
        <div class="streak-sub"><span>28 days ago</span><span>today</span></div>
      </div>

      <?php include __DIR__ . '/journal-view.php'; ?>




    </div>
  </section>