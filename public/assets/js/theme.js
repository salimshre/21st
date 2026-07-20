/* ============================================================
   theme.js
   Light/Dark mode. Persists the choice to its own localStorage key
   (separate from the tracker data key, so clearing one never affects
   the other) and restores it automatically on future visits.

   The FLASH-OF-WRONG-THEME problem: by the time this file (loaded
   near the end of <body>) runs, the page has likely already painted.
   To avoid a visible flash, index.php applies the saved theme via a
   tiny inline <script> in <head> BEFORE any CSS loads — that inline
   snippet is the actual fix; this module's init() just syncs the
   toggle button's icon/label to whatever theme is already applied,
   and wires the click handler.
   ============================================================ */

App.Theme = (function(){
  "use strict";

  var THEME_KEY = "routineos_theme_v1";
  var DEFAULT_THEME = "light"; // per spec: Light = the original 21-Day Challenge look

  function getSaved(){
    try{ return localStorage.getItem(THEME_KEY); }
    catch(e){ return null; }
  }

  function current(){
    return document.documentElement.getAttribute("data-theme") || DEFAULT_THEME;
  }

  function applyToButton(theme){
    var btn = document.getElementById("themeToggle");
    if(!btn) return;
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }

  function set(theme){
    if(theme !== "light" && theme !== "dark") theme = DEFAULT_THEME;
    document.documentElement.setAttribute("data-theme", theme);
    try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
    applyToButton(theme);
  }

  function toggle(){
    set(current() === "dark" ? "light" : "dark");
  }

  function init(){
    // The inline <head> script already set data-theme on <html>; this just
    // makes sure it's a valid value and syncs the toggle button to match.
    var saved = getSaved();
    var theme = (saved === "dark" || saved === "light") ? saved : DEFAULT_THEME;
    if(document.documentElement.getAttribute("data-theme") !== theme){
      document.documentElement.setAttribute("data-theme", theme);
    }
    applyToButton(theme);

    var btn = document.getElementById("themeToggle");
    if(btn) btn.addEventListener("click", toggle);
  }

  return { init: init, set: set, toggle: toggle, current: current };
})();