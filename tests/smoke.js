const assert = require("node:assert/strict");

const baseUrl = process.env.ROUTINE_OS_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(baseUrl + path);
  assert.equal(res.status, 200, `${path} returned ${res.status}`);
  return res.text();
}

(async () => {
  console.log("Starting Routine OS smoke tests...\n");

  // ---- Test 1: HTML Structure ----
  console.log("Testing HTML structure...");
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
    "id=\"restoreInput\"",
    "id=\"routine-list\"",
    "id=\"subject-rotation\""
  ];
  requiredHtml.forEach((needle) => assert.ok(html.includes(needle), `Missing ${needle}`));
  console.log("✓ HTML structure OK\n");

  // ---- Test 2: Asset Availability ----
  console.log("Testing asset availability...");
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
  console.log("✓ All assets loaded\n");

  // ---- Test 3: Challenge Functions ----
  console.log("Testing challenge module...");
  const challengeJs = await get("/assets/js/challenge.js");
  assert.ok(challengeJs.includes("challenge-cat-bar"), "Checklist category progress bars missing");
  assert.ok(challengeJs.includes("renderChallengeChecklist"), "Challenge checklist renderer missing");
  console.log("✓ Challenge module OK\n");

  // ---- Test 4: Routine/Habits Functions ----
  console.log("Testing habits/routine module...");
  const habitsJs = await get("/assets/js/habits.js");
  assert.ok(habitsJs.includes("renderRoutine"), "Routine checklist renderer missing");
  assert.ok(habitsJs.includes("getRoutineBlocks"), "Routine blocks getter missing");
  assert.ok(habitsJs.includes("addRoutineStep"), "Add routine step function missing");
  assert.ok(habitsJs.includes("renderSubjectRotation"), "Subject rotation renderer missing");
  console.log("✓ Habits/Routine module OK\n");

  // ---- Test 5: Analytics Functions ----
  console.log("Testing analytics module...");
  const analyticsJs = await get("/assets/js/analytics.js");
  assert.ok(analyticsJs.includes("renderDataHealth"), "Data Health renderer missing");
  assert.ok(analyticsJs.includes("getRoutineBlocks"), "Analytics routine blocks getter missing");
  console.log("✓ Analytics module OK\n");

  // ---- Test 6: App Initialization ----
  console.log("Testing app initialization...");
  const appJs = await get("/assets/js/app.js");
  assert.ok(appJs.includes("pre-restore-backup"), "Restore safety backup missing");
  console.log("✓ App initialization OK\n");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Routine OS smoke test PASSED ✓");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
})().catch((err) => {
  console.error("\n✗ Test FAILED");
  console.error(err);
  process.exit(1);
});
