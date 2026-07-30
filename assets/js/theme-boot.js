(function bootTheme() {
  try {
    var stored = localStorage.getItem("theme-mode");
    var mode = stored === "light" || stored === "dark" ? stored : "dark";
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
})();
