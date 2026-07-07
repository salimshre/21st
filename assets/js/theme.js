/* ============================================================
   theme.js – Light/Dark mode with inline head fix.
   ============================================================ */

App.Theme = (function(){
  "use strict";

  var THEME_KEY = "routineos_theme_v1";
  var DEFAULT_THEME = "light";

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
