# Verification — 28 October 2026

## Automated checks

- TypeScript strict type check: passed.
- Seven Node tests: passed. Cover symmetric normal probabilities, monotonic uncertainty, reproduction of seed forecasts, Brier scoring, normalization and timestamp exclusion, malformed input rejection, cutoff boundary and spreadsheet formula escaping.
- Eight browser-driven API assertions: passed. Cover ledger access, baseline count, rejection of invalid probabilities, unsafe source URLs, inconsistent model inputs, and early outcome recording; verify that rejected requests change neither record count.
- Production build: passed before browser QA; final source rebuilt during packaging.

The API browser fixture is retained at `tests/api-browser.html`; temporarily copy it into `public/` only for local QA. The responsive fixture at `tests/responsive-browser.html` provides 390 px and 800 px embedded viewports. Neither fixture is shipped as a public asset. The optional Node API smoke test requires direct local access to the preview server; this managed environment isolates that server, so its equivalent browser-driven checks were used.

## Browser workflows checked

- Race selection updates candidate, probability, rationale and evidence.
- Model revision: increasing Kansas uncertainty from 5 to 7 changes its probability from 57.9% to 55.7%; source and reasoning are required.
- Committing a model revision creates a server-timestamped record and retains the baseline.
- Reloading retrieves the committed revision from D1.
- Import rejects a probability of 58 rather than treating it as 58%.
- A well-formed JSON proposal produces a review panel before commitment; committing it creates a separate record with preserved evidence.
- Hypothetical results update the scenario Brier score while actual outcomes remain zero and scorecards stay empty.
- Outcome-entry control is disabled before the cutoff; API rejects premature outcome writes.
- JSON export contains all five baseline forecasts, both local test revisions, five race definitions, source evidence, and no outcomes.
- Phone (390 px), tablet (800 px) and desktop layouts inspected visually.
- Native dialog semantics, form labels, focus styles, keyboard-accessible controls, chart text alternatives and reduced-motion CSS provided.
- Primary text, muted labels, faint labels and accent text checked for contrast against the main light surfaces; faint and accent colours were darkened during QA.

The two explicitly labelled local QA records were removed from the local test database after verification. Hosted data starts independently from the five source-controlled baseline records.

## Limits

No real outcomes exist yet, so there is no empirical accuracy or calibration claim. Certified-result entry is user-reviewed. This is owner-private and relies on the Sites platform access boundary; it has not been security-audited for public multi-user hosting. There is no autonomous agent fleet or live market data connection. No external paid service is needed to use the research handoff, model editor or ledger.

## National edition — 28 October 2026

- Fresh dependency installation in an isolated copy using pnpm 11.25.0, frozen lockfile and the package cache: 640 packages installed successfully. This verifies the lockfile independently of the preinstalled project dependency tree; it is not a test of a fresh internet registry download.
- 868 unique catalogue records; category counts 435/35/36/218/144. Candidate option uniqueness and minimum option count tested.
- 14 core tests: old baseline math, probability distributions, exact option validation, evidence URL rejection, spoofed timestamp stripping, scoring, special-rule prompts, append-only SQLite persistence and cutoff boundaries.
- Local HTTP smoke: page and ledger, hostile Origin and Host rejection, malformed JSON/proposal rejection, validated save/read, body-size cap.
- Runner smoke with a local stub: all 868 briefs, command adapter, validation, output persistence, resume without duplicate calls, explicit import and coverage. No paid model or national forecasting run was performed.
- Browser: search by contest ID; Alaska four-option source/notes; review checkbox and JSON commit; reload persistence; all eight Wisconsin House districts including added WI-02; mobile 390px and tablet 800px layouts.
- The sole browser QA forecast used method `Local QA national` in the local preview database and was removed after verification. It is not a seed or production record.
- Standalone local storage and hosted D1 are separate. Production depends on the owner-private platform boundary. No public access changes were made.
