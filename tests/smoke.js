const assert = require("node:assert/strict");

const baseUrl = process.env.ROUTINE_OS_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(baseUrl + path);
  assert.equal(res.status, 200, `${path} returned ${res.status}`);
  return res.text();
}

(async () => {
  const html = await get("/");
  const requiredHtml = [
    "Routine OS",
    "assets/css/light-theme.css",
    "assets/css/dark-theme.css",
    "assets/js/storage.js",
    "assets/js/app.js",
    "id=\"themeToggle\"",
    "id=\"headerBackupBtn\"",
    "id=\"challengeChecklist\"",
    "id=\"challengeDayNote\"",
    "id=\"cycleHistorySelect\"",
    "id=\"cycleCategoryFilter\"",
    "id=\"cycleTemplateSelect\"",
    "id=\"dataHealth\"",
    "id=\"cycleHistoryAnalytics\"",
    "id=\"restoreInput\""
  ];
  requiredHtml.forEach((needle) => assert.ok(html.includes(needle), `Missing ${needle}`));

  const assets = [
    "/assets/css/variables.css",
    "/assets/css/light-theme.css",
    "/assets/css/dark-theme.css",
    "/assets/css/app.css",
    "/assets/js/storage.js",
    "/assets/js/theme.js",
    "/assets/js/habits.js",
    "/assets/js/challenge.js",
    "/assets/js/analytics.js",
    "/assets/js/todos.js",
    "/assets/js/app.js"
  ];

  for (const asset of assets) {
    const body = await get(asset);
    assert.ok(body.length > 0, `${asset} is empty`);
  }

  const challengeJs = await get("/assets/js/challenge.js");
  assert.ok(challengeJs.includes("challenge-cat-bar"), "Checklist category progress bars missing");
  assert.ok(challengeJs.includes("renderChallengeChecklist"), "Checklist renderer missing");

  const analyticsJs = await get("/assets/js/analytics.js");
  assert.ok(analyticsJs.includes("renderDataHealth"), "Data Health renderer missing");

  const appJs = await get("/assets/js/app.js");
  assert.ok(appJs.includes("pre-restore-backup"), "Restore safety backup missing");

  console.log("Routine OS smoke test passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
