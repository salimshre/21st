<footer class="app-footer">
  <div class="footer-inner">
    <div class="toolbar">
      <button class="tbtn" id="exportCsvBtn" type="button">Export 21-Day CSV</button>
      <button class="tbtn" id="exportDailyCsvBtn" type="button">Export Daily Log CSV</button>
      <button class="tbtn" id="backupBtn" type="button">Backup JSON</button>
      <button class="tbtn" id="restoreBtn" type="button">Restore JSON</button>
      <input type="file" id="restoreInput" accept="application/json" style="display:none">
      <button class="tbtn danger" id="resetCycleBtn" type="button">Reset cycle (clear 21-day checks)</button>
      <button class="tbtn" onclick="window.print()">🖨️ Print PDF</button>
      <button class="tbtn" id="exportMarkdownBtn">Export Markdown</button>
      <button class="tbtn" onclick="window.open('preview.php?file=README.md', '_blank')">📄 README</button>
      <button class="tbtn" onclick="window.open('preview.php?file=improved_routine.md', '_blank')">📄 Routine</button>
      <button class="tbtn" onclick="window.open('preview.php?file=agents.txt', '_blank')">📄 Agents</button>
      <button class="tbtn" onclick="document.querySelector('[data-tab=\'analytics\']').click(); setTimeout(function(){ document.getElementById('journalSearch')?.focus(); }, 300);">📓 Journal</button>
    </div>
    <p class="footer-note">
      Everything — the 21-day grid and every daily log — lives in one browser-local save file (localStorage),
      fully offline. It won't sync across browsers or devices on its own. Use <strong>Backup JSON</strong> for a
      full copy of the unified dataset and <strong>Restore JSON</strong> to bring it back, on this browser, a new
      one, or another device. Restore automatically downloads a safety backup first. The CSV exports give
      read-only copies for spreadsheets.
    </p>
  </div>
</footer>