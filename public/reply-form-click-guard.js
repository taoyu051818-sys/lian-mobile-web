document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest("[data-reply-form]")) return;
  event.stopPropagation();
}, true);
