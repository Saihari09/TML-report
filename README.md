# TML Report Generator

Static, client-side report generator for The Movement Lab's three wellness domains: blood biomarkers, HumanTrak movement screening, and nutrition + mental wellbeing. Designed for GitHub Pages.

## Why client-side only

Patient health data must not be uploaded. Every page parses files and renders the report entirely in the browser. Nothing leaves the device.

## Pages

| Page | Purpose |
|---|---|
| `index.html`     | Landing — links to each generator |
| `template.html`  | Reference report rendered from the Anandan T. mock data (the visual baseline) |
| `blood.html`     | Blood biomarker generator — upload Hitech PDF or TML Excel |
| `humantrak.html` | HumanTrak movement generator — upload Excel or fill the form |
| `wellbeing.html` | Nutrition + Nutri Meter + PSS-10 + PSQI |

## Architecture

- Vanilla JS + HTML, no build step.
- `assets/report.css` — TML brand (cream + burgundy + gold) and the 4-tier status colour system.
- `assets/scoring.js` — every threshold/band the clinical team needs to tune. **Edit this file** to adjust per-marker bands.
- `assets/parsers.js` — SheetJS for Excel/CSV; a Hitech-aware PDF parser plus a generic fallback.
- `assets/render.js` — DOM builder; one `render(case, host, { include })` call produces the report.
- `assets/sample-data.js` — the Anandan T. mock case used by `template.html` and the "Load sample" buttons.
- CDNs (loaded only on pages that need them): SheetJS (`xlsx`), `pdfjs-dist`.

## Deploy to GitHub Pages

1. `cd tml-report-generator`
2. `git init && git add . && git commit -m "tml report generator: initial"`
3. Push to a new GitHub repo.
4. In repo settings → Pages → deploy from `main` / root.
5. Done. The site loads from `https://<org>.github.io/<repo>/`.

No backend, no env vars. All CDNs are HTTPS.

## Where to tune scoring

`assets/scoring.js`:
- **Movement per-test thresholds** — `MOVEMENT_TESTS` object. Each entry has a `score(value)` function returning the tier.
- **Composite movement bands** — `movementBand()` (25–50 Urgent, 51–75 Significant, 76–100 Normal).
- **Nutri Meter bands** — `nutriMeterBand()` (10–20 / 21–35 / 36–50).
- **PSS-10 bands** — `pss10Band()` (0–13 / 14–26 / 27–40).
- **PSQI bands** — `psqiBand()` (≤5 / 6–10 / 11–15 / 16–21).
- **Body comp** — `BODY_COMP` object.
- **Biomarker bands** — `BIOMARKERS` object. Markers with explicit clinical bands (HbA1c, Glucose Fasting/PP, Vit D) override the generic ±10/±25% range logic.

## Known gaps / next steps

1. **Lab PDF coverage.** The PDF parser is tuned to Hitech Diagnostic. Apollo, Thyrocare, Dr. Lal etc. each have different column positions — add a per-lab branch in `parsers.js → parseHitechPdf` style, then dispatch in `parseFile`.
2. **HumanTrak CSV/Excel format.** The TML Excel template (`Download blank Excel template` button) uses `key, value` rows. Once you share a real HumanTrak export, we can add an auto-import for that format.
3. **Combined report.** `render()` already supports passing `{ include: [...] }` with all sections. Add a `combined.html` that merges three localStorage-saved cases into one document. (Currently each generator outputs its own report only.)
4. **Endpoint comparison data.** All three generators currently capture *baseline* values only. For the baseline-vs-endpoint two-column comparison tables seen in `template.html`, add a "Cycle End" toggle on each generator that re-uses the same form and stores both points.
5. **Asymmetry & per-test thresholds.** I used standard sports-med conventions (`<10/15/25%`); confirm with the clinical team and edit `scoring.js`.
6. **Print fidelity.** The CSS targets A4-friendly US Letter; the print stylesheet hides toolbars and tightens margins. Test in Chrome/Edge "Save as PDF" — Firefox print is less faithful.
7. **i18n / Tamil overlay** — not currently scoped; the design accommodates it (no fixed-width fields).

## Data privacy

This generator does not transmit, log, or persist any input. Closing the tab drops all state. Use `Print / Save as PDF` to retain a copy on the clinician's device.
