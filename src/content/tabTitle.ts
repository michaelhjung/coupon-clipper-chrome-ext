let original: string | null = null;

export const setTitlePrefix = (prefix: string) => {
  if (original === null) original = document.title;
  document.title = `${prefix} · ${original}`;
};

export const restoreTitle = () => {
  if (original !== null) document.title = original;
  original = null;
};

// Keeps the current prefix (e.g. "✅ Done") until the user actually looks at
// the tab, so a finished run is visible from another tab.
export const restoreTitleWhenVisible = () => {
  if (document.visibilityState !== "hidden") {
    restoreTitle();
    return;
  }
  const onVisible = () => {
    if (document.visibilityState === "hidden") return;
    document.removeEventListener("visibilitychange", onVisible);
    restoreTitle();
  };
  document.addEventListener("visibilitychange", onVisible);
};
