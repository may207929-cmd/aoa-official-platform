(function () {
  const year = new Date().getFullYear();
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = year;
  });
})();
