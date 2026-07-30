(function bootTheme() {
  try {
    var stored = localStorage.getItem("ws_games_theme_v1");
    if (stored !== "light" && stored !== "dark") {
      stored = localStorage.getItem("theme-mode");
    }
    var mode = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
})();
