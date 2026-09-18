# Coupon Clipper (Chrome extension, Manifest V3)

Clips every coupon on a store's coupon page in one go. Albertsons-family
stores (Safeway, Vons, Acme, …), Raley's, and CVS ExtraCare.

## Hard rules

- **Never run `git add`, `git commit`, or `git push`.** Print the commands in a
  code block; the user runs them.
- **Never print the contents of `.env`** (test-account credentials) or paste
  user credentials into chat. Store API keys that are part of the shipped
  code (e.g. the CVS feed key) are fine to read and edit.
- Do not edit `public/manifest.json` by hand; it is generated from
  `src/shared/stores.json` by `npm run generate:manifest`.

## Commands

```sh
npm test                          # full vitest suite (jsdom, tests/setup.ts mocks chrome.*)
npx vitest run tests/<name>.test.ts   # one file — use this while iterating
npx tsc --noEmit                  # type-check only (fast)
npm run lint                      # eslint, zero warnings allowed
npm run build                     # manifest + tsc + two vite builds; only when build/manifest config changes
```

Done means: `npm test`, `npm run lint`, and `npx tsc --noEmit` all pass. Say
so with the output, or say which one you skipped.

## Architecture (read the contracts first)

- `src/shared/types.ts` — every message and storage shape. Start here.
- `src/adapters/types.ts` — the `StoreAdapter` interface every store implements.
- `src/adapters/{albertsons,cvs,raleys}.ts` — per-store implementations, chosen by
  `strategy` in `stores.json`. API "fast path" via `fetchUnclipped`, DOM fallback
  via `loadAll` + `getUnclipped` + `clip`.
- `src/content/` — content script, built as **one IIFE** (`vite.content.config.ts`).
  `engine.ts` runs a clip/count/load-all task with adaptive backoff; `index.ts`
  routes worker messages; `pageBridge.ts` / `raleysBridge.ts` talk to MAIN-world
  helpers; `overlay.ts` is the on-page progress UI.
- `src/background/index.ts` — service worker: the only writer of stats and
  per-store maps, owns auto-clip claims (`autoClip.ts`), badge, notifications.
- `src/popup/`, `src/options/` — React 18 + Tailwind. Talk to the worker only via
  `sendToWorker`.
- `src/shared/storage.ts` — all `chrome.storage` access. Read-merge-write goes
  through `createSerialQueue` because storage has no atomic update.

Message flow: popup → worker → content script (tab). Content → worker for
run reports and auto-clip claims. The tab replies `{ ok: false }` when busy.

## Invariants that have bitten us

- Clipping must be idempotent: a re-run, a duplicate offer across pages, or a
  retried storage write must not double-count or double-clip.
- Merchant DOMs change without notice. Check an element exists before using
  it; prefer the API path and treat the DOM path as a fallback.
- One auto-clip per store at a time, decided serially in the worker; a granted
  claim starts the cooldown immediately.
- Retrying a 429 waits at least `RATE_LIMIT_MIN_MS`; a stop request must be
  honored inside the per-coupon retry loop.
- `docs/README.md` (local, gitignored) documents each store's API quirks. Read
  it before touching adapter or clip logic.

## Code style

- Match the surrounding file. Small functions, early returns, `const` arrow
  functions, named exports.
- Comment only the *why* (site quirks, ordering constraints). No comments that
  restate the code.
- Booleans read as predicates (`isSignedIn`, `stopRequested`). Callback props
  are `onX`. Otherwise use the name that already exists for the concept.
- Extract a helper when the same logic appears a third time or when it makes a
  unit testable in isolation; never if it needs >3 config args or boolean
  flags. Do not refactor code the task does not touch.
- O(N) or better on coupon lists; use `Map`/`Set` for lookups.
- Every behavior change gets a test in `tests/`. Fixtures live in
  `tests/fixtures/`; `tests/helpers.ts` has the shared builders.

## Working efficiently (token budget)

- Do not read `dist/`, `node_modules/`, or `package-lock.json`.
- Before reading a file, `grep` for the symbol; read only the lines you need.
- Run the single test file for what you changed; run the full suite once at
  the end.
- `git diff --stat` before `git diff`. Pipe long output through `head`/`grep`.
- Prefer `Edit` over rewriting whole files.
- Don't restate this file, the plan, or the diff back to the user; report
  what changed and what was verified.
