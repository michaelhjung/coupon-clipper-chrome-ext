import { log } from "../shared/log";

// Clipping goes through the store API, so the page does not know about it.
// We patch the card ourselves and keep patching as the site re-renders cards
// from its stale gallery (e.g. after "Load more" or a React re-mount).
// `render` patches one card and returns true when it found one to patch.
export const createClippedMarker = (render: (id: string) => boolean) => {
  const clippedIds = new Set<string>();
  let observer: MutationObserver | null = null;

  const watch = () => {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver(() => {
      let patched = 0;
      for (const id of clippedIds) if (render(id)) patched++;
      if (patched) log.info(`patched ${patched} late-rendered card(s) as clipped`);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  return {
    mark: (id: string) => {
      clippedIds.add(id);
      render(id);
      watch();
    },
  };
};
