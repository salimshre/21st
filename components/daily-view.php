\<section class="view-panel active" id="panel-daily">
    <div class="view narrow">
      <div class="stats">
        <div class="stat-card"><div class="stat-val" id="sHabits">0/10</div><div class="stat-lbl">habits</div></div>
        <div class="stat-card"><div class="stat-val" id="sRoutine">0/17</div><div class="stat-lbl">routine</div></div>
        <div class="stat-card"><div class="stat-val" id="sPomos">0</div><div class="stat-lbl">pomodoros</div></div>
        <div class="stat-card"><div class="stat-val" id="sRating">5</div><div class="stat-lbl">day rating</div></div>
        <div class="stat-card" id="statTodos" style="cursor:pointer;" title="Switch to Todos subtab">
          <div class="stat-val" id="sTodos">0/0</div>
          <div class="stat-lbl">todos <span style="font-size:14px;">➕</span></div>
        </div>
        <div class="stat-card" style="cursor:pointer; background:var(--card-bg-soft);" id="manageHabitsBtn">
          <div class="stat-val" style="font-size:16px;">⚙️</div>
          <div class="stat-lbl">Manage Habits</div>
        </div>
        <div class="stat-card" style="cursor:pointer; background:var(--card-bg-soft);" id="manageRoutineBtn">
          <div class="stat-val" style="font-size:16px;">⚙️</div>
          <div class="stat-lbl">Manage Routine</div>
        </div>
      </div>

      <div class="prog-head"><div class="sec-lbl" style="margin-bottom:0">Daily progress</div><div class="prog-pct" id="dailyProgPct">0%</div></div>
      <div class="prog-bar"><div class="prog-fill" id="dailyProgFill" style="width:0%"></div></div>

      <div class="subtabs" id="dailySubtabs">
        <button type="button" class="subtab active" data-subtab="habits">Habits</button>
        <button type="button" class="subtab" data-subtab="routine">Routine</button>
        <button type="button" class="subtab" data-subtab="blocks">Pomodoros</button>
        <button type="button" class="subtab" data-subtab="review">Review</button>
        <button type="button" class="subtab" data-subtab="todos">Todos</button>
      </div>

      <div class="subpanel active" id="sub-habits">
        <div class="sec-lbl">Today's habits</div>
        <div class="card" id="habits-list"></div>
        <div class="sec-lbl">Today's 21-day challenge</div>
        <div class="card challenge-daily" id="challengeChecklist"></div>
        <div class="sec-lbl">Challenge day note</div>
        <div class="card challenge-note-card">
          <textarea class="txt-area" id="challengeDayNote" placeholder="What worked, what failed, and what needs attention tomorrow?"></textarea>
        </div>
      </div>

      <div class="subpanel" id="sub-routine">
        <div class="sec-lbl">Subject rotation</div>
        <div class="today-subjects" id="subject-rotation"></div>
        <div class="sec-lbl">Routine checklist</div>
        <div class="card" id="routine-list"></div>
      </div>

      <div class="subpanel" id="sub-blocks">
        <div class="sec-lbl">Study blocks</div>
        <div class="card" id="blocks-list"></div>
      </div>

      <div class="subpanel" id="sub-review">
        <div class="sec-lbl">Day rating</div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="rating-wrap">
            <span class="rating-num" id="rNum">5</span>
            <input type="range" min="1" max="10" value="5" id="rSlider" style="flex:1">
            <span class="rating-lbl" id="rLbl">ok</span>
          </div>
        </div>
        <div class="sec-lbl">Break analysis journal</div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="hint">What broke? Why? What will you do differently?</div>
          <textarea class="txt-area" id="journalInput" placeholder="If nothing broke, write that — still useful data."></textarea>
          <input class="txt-input" id="priorityInput" type="text" placeholder="Tomorrow's #1 priority: e.g. Finish NM Chapter 4">
        </div>
      </div>

      <?php include __DIR__ . '/todo-view.php'; ?>

      <div class="save-bar">
        <button type="button" class="save-btn" id="saveDayBtn">💾 Save today</button>
        <span class="saved-badge" id="savedBadge">✓ saved</span>
      </div>
    </div>
  </section>
  