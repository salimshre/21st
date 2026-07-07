<section class="view-panel" id="panel-cycle">
    <div class="view">
      <div class="cycle-dash">
        <div class="dcard dcard-start">
          <label for="cycleStartInput">Cycle start date</label>
          <input type="date" id="cycleStartInput">
        </div>
        <div class="dcard dcard-overall">
          <div class="top"><span>Overall completion</span><span id="cycleOverallPct">0%</span></div>
          <div class="bar-track"><div class="bar-fill" id="cycleOverallBar" style="width:0%"></div></div>
        </div>
        <div class="dcard dcard-cats" id="cycleCatWrap"></div>
      </div>

      <div class="cycle-history-bar">
        <label for="cycleHistorySelect">Cycle preview</label>
        <select id="cycleHistorySelect">
          <option value="current">Current cycle</option>
        </select>
        <span id="cycleHistoryStatus" class="cycle-history-status"></span>
        <button type="button" class="mini-action" id="archiveCycleBtn">Archive current</button>
        <button type="button" class="mini-action" id="renameCycleBtn">Rename</button>
        <button type="button" class="mini-action" id="restoreCycleBtn">Restore</button>
        <button type="button" class="mini-action danger" id="deleteCycleBtn">Delete</button>
      </div>

      <div class="cycle-tools-bar">
        <label for="cycleCategoryFilter">Filter</label>
        <select id="cycleCategoryFilter">
          <option value="all">All categories</option>
        </select>
        <input type="search" id="cycleSearchInput" placeholder="Search activities">
        <label class="tool-check"><input type="checkbox" id="cycleCompactToggle"> Day column only</label>
        <label for="cycleTemplateSelect">Template</label>
        <select id="cycleTemplateSelect">
          <option value="">Templates</option>
        </select>
        <button type="button" class="mini-action" id="saveTemplateBtn">Save template</button>
        <button type="button" class="mini-action" id="startTemplateBtn">Start from template</button>
      </div>

      <div class="card attention-card" id="challengeAttention"></div>

      <p class="scroll-hint">
        Scroll right to see all 21 days →
        <span class="legend"><span class="dot dot-today"></span>today<span style="width:4px"></span><span class="dot dot-viewing"></span>day you're viewing</span>
      </p>

      <div class="table-shell" id="tableShell">
        <table id="cycleTable">
          <thead>
            <tr id="cycleHeadRow">
              <th class="col-sn" scope="col">#</th>
              <th class="col-activity" scope="col">Activity</th>
              <th class="col-cat" scope="col">Category</th>
              <th class="col-score" scope="col">Score</th>
            </tr>
          </thead>
          <tbody id="cycleBody"></tbody>
          <tfoot>
            <tr>
              <td>
                <div class="add-row">
                  <input type="text" id="newActName" placeholder="New activity name…">
                  <select id="newActCat"></select>
                  <button type="button" id="addActBtn">+ Add activity</button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
  