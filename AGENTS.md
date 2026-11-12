# AGENTS.md

This file says **how we work**. It delegates the rest:

- **What we build** (scope, requirements, targets, licensing, roadmap, Growth) →
  [`docs/PRD.md`](docs/PRD.md).
- **How it is built** (stack, module layout, data sources and their contracts, world
  generation, rendering, art direction, security, privacy, build and deploy) →
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

If a request conflicts with either document, say so before acting. If a change makes
either document wrong, update it in the same commit.

## 1. Project

**Wattscape**: a browser "screensaver" in minimal pixel art that shows, live, how
electricity is produced and consumed in the user's region of France. A relief map of
France, north up, that zooms from the whole country to the region (its landmarks, its power
plants, its towns), whose every moving part is driven by open data: RTE éCO2mix for
the grid, Open-Meteo for the weather, the sun's real position for day and night, the
date for the seasons. Inspired by
[Infinite Jungle](https://github.com/0xfe/jungle) and
[Electricity Maps](https://app.electricitymaps.com/).

### Read before you start

| When you…                                        | Read first                                               |
| ------------------------------------------------ | -------------------------------------------------------- |
| start or scope a feature                         | `docs/PRD.md`, `docs/BACKLOG.md`                         |
| revisit a choice already made                    | `docs/DECISIONS.md`                                      |
| touch code, dependencies, CI or the build        | `docs/ARCHITECTURE.md`                                   |
| read, show or explain a figure from an API       | `docs/ARCHITECTURE.md` § Data sources, `docs/SOURCES.md` |
| draw a sprite, landmark, palette or animation    | `docs/ARCHITECTURE.md` § Art direction, `ASSETS.md`      |
| add or draw a landmark                           | `docs/POI.md`                                            |
| use a new data source or dataset                 | `docs/DATA-SOURCES.md`                                   |
| touch geolocation, network calls or URL settings | `docs/ARCHITECTURE.md` § Privacy and § Security          |
| rely on a web API (geolocation, fullscreen, …)   | `docs/ARCHITECTURE.md` § Browser quirks                  |

### Non-negotiables

Short on purpose: each rule is detailed in the linked document, but holds even when
you haven't read it.

- **Every figure is true and traceable.** A number on screen, or an animation that
  claims to show one, comes from a named live source with its timestamp, or is
  visibly labelled as sample data. Never invent, extrapolate or silently fill a value
  (ARCHITECTURE § Data sources).
- **The position stays private.** The GPS position is never stored, logged or sent
  anywhere except, rounded to 0.1°, to the weather API; the region lookup runs
  offline (ARCHITECTURE § Privacy).
- **Reproducible world.** The scene is a pure function of (seed, area, data, time):
  no `Math.random`, no wall-clock reads outside the clock module (ARCHITECTURE §
  World generation).
- **API data and URL settings are untrusted.** Validate at the boundary; never
  `innerHTML`/`eval` (ARCHITECTURE § Security).
- **No third-party art, and landmarks are drawn in code.** Every asset has an
  `ASSETS.md` entry; a landmark is drawn only when it is GO in `docs/POI.md`, and a
  data source is used only when it is GO in `docs/DATA-SOURCES.md` (PRD § Content
  and licensing).
- **Public repo.** Every commit is published: apply §5 "Privacy, secrets &
  publishing" before every push.

### Language

- Code, comments, commits, PRs and docs: **English**.
- No hard-coded user-facing strings: every UI string lands with all supported
  translations (FR + EN) in the same commit (ARCHITECTURE § Internationalization).

---

## 2. Behavior

- Be direct and push back when you disagree; if my approach has problems, say so.
- When unsure about something, say you're unsure rather than guessing confidently.
- When something fails, investigate the root cause before retrying.
- Keep diffs scoped to the task: no drive-by reformats or unrelated refactors.
- After a significant or novel effort (a release, a multi-step feature, anything
  with surprises or irreversible steps), proactively offer to capture what was
  non-obvious into the relevant AGENTS.md or memory.
  - Skip this for routine or trivial tasks — the point is signal, not ritual.

---

## 3. Teaching

I'm always picking up new systems and domains (here: the electricity grid, open
energy data, pixel art). When a key term surfaces that I likely haven't internalized,
explain it in 1–2 sentences and then move on.

Format:

```markdown
> 💡 One- or two-sentence explanation.
```

---

## 4. Tooling

### JavaScript / TypeScript

- Use **npm** with a committed `package-lock.json`; install with `npm ci` in CI.
- Pin the Node version in `.nvmrc` and `package.json#engines`.
- Before each commit, this must pass:

  ```sh
  npm run typecheck && npm run lint && npm test
  ```

### Python (scripts only, if ever needed)

- Always use **uv** (`uv venv`, `uv pip install`, `uv run`, `uvx`).
- Never use `python -m venv` or bare `pip`.

### Code style & conventions

- TypeScript `strict: true`; no `any` (use `unknown` + narrowing); no non-null `!`
  without a comment explaining why it is safe.
- ESLint + Prettier, enforced in CI; formatting is never mixed into a feature diff.
  When a Markdown table cell outgrows its column, Prettier realigns the whole table:
  reword the cell to fit, or realign the table in a commit of its own.
- Every exception in a config file (a Dependabot `ignore`, a pinned version, a lint
  rule turned off) carries a comment next to it: why it is there, and when to remove
  it.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, …).
- Small PRs: one feature or fix per PR.

### Shell

- In shell chains that gate a commit, never pipe the test runner into a filter
  (`npm test | tail && git commit` masks failures).
- Check exit codes directly, or use `set -o pipefail`.

---

## 5. Engineering discipline

### Bugs & reviews

- Before reporting a suspected bug in a review, reproduce it with a small script or
  test; report measured behavior, not hypotheses.
- Every bug fix (review finding, backlog item) lands with a **regression test in the
  same commit** as the fix.
- When a test fails in CI but passes locally:
  1. Reproduce it in a matching environment (container).
  2. Check which side the oracle/spec says is correct _before_ relaxing the test.
  3. Remember that the committed artifact, not the test, may be the wrong side.

### Code review

- Every change goes through a **pull request**; nothing is pushed directly to `main`.
  A pushed branch is not done: open its PR in the same step and share the link.
- Before opening or updating a PR, run a self-review of the diff (`/code-review`)
  and fix confirmed findings first. Always ask:
  - can an async result (a fetch, a geolocation answer, a timer) land after the state
    it was started for changed (the area was switched, the tab was hidden)?
  - what does the scene show when a source is down, late, `null`, `0` or absurd?
- Run `/security-review` on any PR that touches untrusted input (API responses, URL
  settings), network calls, the CSP, dependencies, or CI/deployment config.
- CI must be green (typecheck, lint, tests, build) before merge.
- **Definition of done** for a feature:
  1. visible in the deployed build;
  2. tested (enumerated unit tests, plus a frame snapshot for rendering changes);
  3. documented (PRD/ARCHITECTURE/BACKLOG statuses updated);
  4. strings translated (FR + EN);
  5. the PR shows a screenshot or GIF for any visible change, linked by commit SHA
     (a permalink), so it survives the branch's deletion. Shoot it at day **and**
     night, and in at least two regions, from fixed data (`?sample=…&at=…`) so the
     picture can be reproduced.

### Security

The app is a static site with no backend, so the real attack surface is small and
specific. Focus on it:

- **Untrusted API data** (éCO2mix, Open-Meteo) and **URL settings** (`?area=`,
  `?at=`, …):
  - parse with a strict validator; reject unknown shapes, non-finite or out-of-range
    numbers and oversized strings; a bad answer degrades to "data unavailable", never
    to a crash or a made-up value;
  - never inject API text into the DOM via `innerHTML`, `eval` or `new Function`;
    use `textContent`.
- **Content Security Policy:** ship a strict CSP (`default-src 'self'`, no
  `unsafe-inline`/`unsafe-eval`, no third-party scripts at runtime); `connect-src`
  lists exactly the API hosts in ARCHITECTURE § Data sources, nothing else.
- **Supply chain:**
  - keep runtime dependencies minimal (target: none); justify each new dependency in
    its PR;
  - committed lockfile, `npm ci` only; run `npm audit --omit=dev` in CI;
  - enable Dependabot (security updates) on the repo.
- **GitHub Actions:**
  - pin third-party actions to a full commit SHA;
  - set least-privilege `permissions:` per workflow (Pages deploy only gets
    `pages: write` and `id-token: write`);
  - never use `pull_request_target` with checkout of untrusted code.
- **Secrets:** the project needs none (both APIs are keyless). Run a secret scanner
  (e.g. gitleaks) in CI over the full history, and enable GitHub secret scanning +
  push protection.

### Performance

- A screensaver runs for hours, often on a laptop on battery: the budget is in
  ARCHITECTURE § Performance (frame rate cap, CPU, memory flat over time).
- Before optimizing, **profile**: Chrome DevTools Performance panel, or
  `node --cpu-prof` for headless world generation.
- Fix what the profiler shows, not what the analysis guessed.

### Testing

- For algorithmic code (region lookup, sun and moon position, world generation,
  palette dithering), prefer **randomized cross-checks against a naive reference
  implementation** or a published reference (e.g. the NOAA solar calculator) over
  example-based tests alone.
- Implementation plans and stories **enumerate the unit tests explicitly**:
  - per module, the test files;
  - per test file, the specific behaviors they assert.
- A "correctness strategy" paragraph is not a substitute for the enumerated test list.
- API parsers are tested against **recorded real responses** committed as fixtures
  (with their date and source), plus malformed and hostile variants. A fixture typed
  from documentation instead of recorded is labelled as such.

### Determinism & reproducibility

- Determinism claims need evidence: the same (seed, area, data, time) must render
  **the same frame**, checked by hashing frames in tests.
- Keep engine-dependent behavior out of world generation:
  - `Math.random` → use the seeded PRNG;
  - `Math.sin`, `cos`, `exp`, `log` and other transcendental functions (may differ
    by ~1 ulp across JS engines) must not decide _what_ is generated, only how it
    is animated;
  - wall-clock time → the injected clock;
  - iteration order of objects keyed by numeric-looking strings.
- Cross-platform claims need cross-engine evidence: run frame-hash tests in
  **at least two engines** (Node in CI + a headless browser via Playwright) before
  claiming them.
- The same holds for web platform APIs (geolocation, fullscreen, wake lock,
  `prefers-reduced-motion`): a claim about browser behavior is measured in Chromium,
  Firefox and WebKit, or stated as unverified.

### Faithfulness to the data and to the places

- Faithfulness to the data is the **acceptance criterion for the scene**: what moves
  on screen (a plume, a turning blade, a lit window) maps to a documented field and
  a documented formula in ARCHITECTURE § Data-to-scene mapping.
- Record every data caveat (sign conventions, missing values, delays, revisions) with
  provenance in ARCHITECTURE § Data sources.
- Log every external source consulted (dataset page, API doc, spec, photo of a
  landmark, person) in `docs/SOURCES.md` the day it is used, with what it gave; cite
  its id (`S-003`) where a fact is recorded.
- A claim on screen about a place or a technology (a caption, a fact) has a source
  in `docs/SOURCES.md`; when none was found, it is marked **provisional** and listed
  in the PR for Guillaume to check.
- Before saying where a value comes from, read its provenance in ARCHITECTURE: a
  field name read in a spec is not a field name seen in a live response.
- At the end of a step, put every provisional choice still open to Guillaume in one
  questionnaire: each with a recommendation and room for a free answer. Record the
  answers with their provenance ("Guillaume, date") in one PR.
- **Decisions are auditable.** Every decision (an answered question, a rejected
  option, a rule) gets an entry in `docs/DECISIONS.md`: context, options, decision,
  who and when, why, and what would make us revisit it. A later change reverses an
  entry with a new entry, never by editing the old one.

### Planning & backlog

- For multi-fix efforts (reviews, refactors):
  1. Record findings as a tracked backlog with acceptance criteria.
  2. Land **one commit per item**.
  3. Update the backlog status in the same commit.
- Maintain a **Growth** section in `docs/PRD.md` as the feature funnel:
  - new ideas and deferred scope land there first, with a status:
    `proposed` / `planned` / `done` / `rejected`;
  - scoped work graduates to the backlog;
  - statuses flip in the same commit that lands or rejects the feature.

### Documentation hygiene

- When changing documented behavior/semantics, sweep the whole repo for statements
  of the old behavior (docs, README, docstrings, test names, code comments).
- Update or delete them **in the same commit**: no dead code, no stale documentation.

### Privacy, secrets & publishing

- 🔒 **Before making a repo or package public (or publishing any artifact):**
  - scan the working tree **AND git history** for **secrets/PII**;
  - surface the **commit-author identity** that will become permanently public;
  - the current tree alone isn't enough — **history ships too**.
- Never commit a real user position: test fixtures use landmark coordinates.
- Verify a published artifact in a **clean room**: test the deployed GitHub Pages
  build, or `vite preview` of a fresh `npm ci && npm run build` in a clean checkout,
  never the dev server. Say which one was checked.
