<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Routine OS — Unified Tracker</title>
<script>
(function(){
  try{
    var theme = localStorage.getItem("routineos_theme_v1");
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }catch(e){
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
</script>
<link rel="stylesheet" href="assets/css/variables.css">
<link rel="stylesheet" href="assets/css/light-theme.css">
<link rel="stylesheet" href="assets/css/dark-theme.css">
<link rel="stylesheet" href="assets/css/app.css">
</head>
<body>

<div id="tourOverlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999;">
  <div class="tour-tooltip" style="position:absolute; background:var(--card-bg); padding:16px; border-radius:8px; max-width:300px; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
    <p id="tourText"></p>
    <div style="display:flex; gap:8px; margin-top:10px;">
      <button class="tour-next" style="background:var(--primary); border:none; color:#fff; padding:4px 12px; border-radius:4px; cursor:pointer;">Next</button>
      <button class="tour-skip" style="background:transparent; border:1px solid var(--border); padding:4px 12px; border-radius:4px; cursor:pointer;">Skip</button>
    </div>
  </div>
</div>

<?php include __DIR__ . '/components/header.php'; ?>
<?php include __DIR__ . '/components/navigation.php'; ?>

<main>
<?php include __DIR__ . '/components/challenge-view.php'; ?>
<?php include __DIR__ . '/components/daily-view.php'; ?>
<?php include __DIR__ . '/components/analytics-view.php'; ?>
</main>

<?php include __DIR__ . '/components/footer.php'; ?>

<div class="toast" id="toast"></div>

<script src="assets/js/storage.js"></script>
<script src="assets/js/theme.js"></script>
<script src="assets/js/habits.js"></script>
<script src="assets/js/challenge.js"></script>
<script src="assets/js/analytics.js"></script>
<script src="assets/js/todos.js"></script>
<script src="assets/js/app.js"></script>
</body>
</html>
