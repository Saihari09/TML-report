// TML scoring engine.
// All thresholds are in one place so the clinical team can tune them.
// 4-tier: 'green' (4) | 'yellow' (3) | 'orange' (2) | 'red' (1)

const TIER = { green: 4, yellow: 3, orange: 2, red: 1 };
const tierFromScore = (s) => ({4:'green',3:'yellow',2:'orange',1:'red'}[s]);

// -----------------------------------------------------------------------------
// Movement: per-test thresholds.
// Reference ranges come from the TML mock template where specified;
// asymmetry % defaults follow standard sports-med convention.
// -----------------------------------------------------------------------------

const MOVEMENT_TESTS = {
  // Balance — ellipse area asymmetry (eyes closed)
  balanceAsymmetry: {
    label: "Single-Leg Balance Asymmetry (COM ellipse)",
    unit: "%",
    score: (pct) => pct == null ? null
      : pct < 10 ? 'green' : pct < 15 ? 'yellow' : pct < 25 ? 'orange' : 'red',
  },
  // Posture — shoulder drop in frontal plane
  shoulderDrop: {
    label: "Shoulder Drop (frontal)",
    unit: "cm",
    score: (cm) => cm == null ? null
      : cm < 1.0 ? 'green' : cm < 2.0 ? 'yellow' : cm < 3.0 ? 'orange' : 'red',
  },
  // Neck ROM lateral flexion (avg of L/R)
  neckLatFlex: {
    label: "Neck Lateral Flexion (avg)",
    unit: "°",
    ref: "56–65°",
    score: (deg) => deg == null ? null
      : deg >= 56 ? 'green' : deg >= 45 ? 'yellow' : deg >= 30 ? 'orange' : 'red',
  },
  neckRotation: {
    label: "Neck Rotation (avg)",
    unit: "°",
    ref: "66–75°",
    score: (deg) => deg == null ? null
      : deg >= 66 ? 'green' : deg >= 55 ? 'yellow' : deg >= 40 ? 'orange' : 'red',
  },
  // Trunk
  trunkExtension: {
    label: "Trunk Extension",
    unit: "°",
    ref: "26–45°",
    score: (deg) => deg == null ? null
      : deg >= 26 ? 'green' : deg >= 20 ? 'yellow' : deg >= 12 ? 'orange' : 'red',
  },
  trunkLatFlex: {
    label: "Trunk Lateral Flexion (avg)",
    unit: "°",
    ref: "26–45°",
    score: (deg) => deg == null ? null
      : deg >= 26 ? 'green' : deg >= 20 ? 'yellow' : deg >= 12 ? 'orange' : 'red',
  },
  trunkRotation: {
    label: "Trunk Rotation (avg)",
    unit: "°",
    ref: "31–45°",
    score: (deg) => deg == null ? null
      : deg >= 31 ? 'green' : deg >= 24 ? 'yellow' : deg >= 16 ? 'orange' : 'red',
  },
  // Dynamic lower body
  squatKneeFlexion: {
    label: "Overhead Squat — Knee Flexion (max)",
    unit: "°",
    score: (deg) => deg == null ? null
      : deg >= 110 ? 'green' : deg >= 100 ? 'yellow' : deg >= 85 ? 'orange' : 'red',
  },
  squatAsymmetry: {
    label: "Overhead Squat — L/R Asymmetry",
    unit: "%",
    score: (pct) => pct == null ? null
      : pct < 5 ? 'green' : pct < 8 ? 'yellow' : pct < 15 ? 'orange' : 'red',
  },
  sitToStand: {
    label: "Sit-to-Stand × 5",
    unit: "s",
    score: (s) => s == null ? null
      : s < 9 ? 'green' : s < 12 ? 'yellow' : s < 15 ? 'orange' : 'red',
  },
  countermovementJump: {
    label: "Countermovement Jump",
    unit: "cm",
    score: (cm) => cm == null ? null
      : cm >= 35 ? 'green' : cm >= 28 ? 'yellow' : cm >= 20 ? 'orange' : 'red',
  },
  // Strength
  gripAsymmetry: {
    label: "Grip Strength Asymmetry",
    unit: "%",
    score: (pct) => pct == null ? null
      : pct < 10 ? 'green' : pct < 15 ? 'yellow' : pct < 25 ? 'orange' : 'red',
  },
  quadAsymmetry: {
    label: "Quadriceps Asymmetry",
    unit: "%",
    score: (pct) => pct == null ? null
      : pct < 8 ? 'green' : pct < 15 ? 'yellow' : pct < 25 ? 'orange' : 'red',
  },
  // VALD HumanTrak — additional ROM tests
  trunkFlexion: {
    label: "Trunk Flexion",
    unit: "°",
    ref: "100–130°",
    score: (deg) => deg == null ? null
      : deg >= 100 ? 'green' : deg >= 79 ? 'yellow' : deg >= 60 ? 'orange' : 'red',
  },
  // Generic L/R asymmetry (used by Dynamo/VALD bilateral tests)
  asymmetryGeneric: {
    label: "L/R Asymmetry",
    unit: "%",
    score: (pct) => pct == null ? null
      : pct < 10 ? 'green' : pct < 15 ? 'yellow' : pct < 25 ? 'orange' : 'red',
  },
};

// Asymmetry % from left/right values.
// Definition: |L - R| / max(L, R) × 100, rounded to 1 dp.
// Returns null if either side is missing/zero.
function asymmetryFromLR(left, right) {
  if (left == null || right == null) return null;
  const a = Math.abs(left - right);
  const m = Math.max(Math.abs(left), Math.abs(right));
  if (m === 0) return null;
  return Math.round((a / m) * 1000) / 10;
}

// Tier label text (shown inside the status pill alongside the colour).
// Terminology per the Comprehensive TML Patient Report template.
const TIER_LABEL = { green: 'NORMAL', yellow: 'WATCH', orange: 'SIGNIFICANT', red: 'CRITICAL' };
// Full colour-key rows used across the report.
const TIER_KEY = [
  ['green',  'GREEN — Normal',       'Within reference range. Maintain current habits.'],
  ['yellow', 'YELLOW — Watch',       'Borderline. Monitor and add targeted support.'],
  ['orange', 'ORANGE — Significant', 'Clear deviation. Structured intervention recommended.'],
  ['red',    'RED — Critical',       'Marked deficit. Urgent clinical action required.'],
];

// Dynamo strength tests — value is the lower-side / higher-side ratio (asymmetry %).
// Scoring is the same as asymmetryGeneric. Absolute force is reported but not banded
// (norms depend heavily on age / sex / handedness — clinical team to tune later).
const DYNAMO_TESTS = {
  knee_flexion_seated:    { label: "Knee Flexion (Seated)",      unit: "kg" },
  knee_extension_seated:  { label: "Knee Extension (Seated)",    unit: "kg" },
  knee_extension_rom:     { label: "Knee Extension — Peak ROM",  unit: "°" },
  knee_flexion_prone_rom: { label: "Knee Flexion — Peak ROM",    unit: "°" },
  ankle_plantar_flexion:  { label: "Ankle Plantar Flexion",      unit: "kg" },
  ankle_dorsiflexion:     { label: "Ankle Dorsiflexion",         unit: "kg" },
  hip_er_force:           { label: "Hip External Rotation",      unit: "kg" },
  hip_er_rom:             { label: "Hip External Rotation — Peak ROM", unit: "°" },
  hip_ir_rom:             { label: "Hip Internal Rotation — Peak ROM", unit: "°" },
  hip_extension_rom:      { label: "Hip Extension — Peak ROM",   unit: "°" },
  hip_abd_force:          { label: "Hip Abduction (Supine)",     unit: "kg" },
  hip_abd_rom:            { label: "Hip Abduction — Peak ROM",   unit: "°" },
  hip_add_rom:            { label: "Hip Adduction — Peak ROM",   unit: "°" },
  hip_flexion_rom:        { label: "Hip Flexion — Peak ROM",     unit: "°" },
};

// TML Movement Questionnaire — clinical screen (9 items, 1-4 frequency).
// Based on the STarT Back / Keele MSK short-form pattern. Team will edit wording.
const MOVEMENT_QUESTIONNAIRE = [
  { id: 1, q: "Pain in the back, neck, or shoulders over the past 2 weeks", reverse: false },
  { id: 2, q: "Pain travelling down a limb (radiating pain) in the past 2 weeks", reverse: false },
  { id: 3, q: "Difficulty walking, climbing stairs, or standing for long periods", reverse: false },
  { id: 4, q: "Stiffness or restricted movement in any joint", reverse: false },
  { id: 5, q: "Engaging in structured physical activity (≥30 min) on most days", reverse: true },
  { id: 6, q: "Sleep disturbed by musculoskeletal pain or discomfort", reverse: false },
  { id: 7, q: "Pain or discomfort affects mood / concentration", reverse: false },
  { id: 8, q: "Avoiding activities you used to do because of pain or fear of pain", reverse: false },
  { id: 9, q: "Confidence in your body's strength and capability", reverse: true },
];
// answers: { always:1, more_freq:2, rarely:3, never:4 } — reverse-coded for "good" items
function scoreMovementQuestion(answerKey, reverse) {
  const map = { always: 1, more_freq: 2, rarely: 3, never: 4 };
  let v = map[answerKey];
  if (v == null) return null;
  if (reverse) v = 5 - v;
  return v;
}

// Composite: each of N components scored 1-4, summed, then proportionally scaled to 100.
// Template wording: "24 components, max 96. Banded 25-50 / 51-75 / 76-100."
function movementComposite(testScores, qScores) {
  const allValues = [...testScores, ...qScores].filter(x => x != null);
  if (!allValues.length) return null;
  const n = allValues.length;
  const sum = allValues.reduce((a, b) => a + b, 0);
  const max = n * 4;
  // Template: total out of 100 (24*4=96 ≈ 100, but the template presented 46/100 explicitly).
  // We replicate by scaling sum→100 against the theoretical max of 100.
  const scaled = Math.round((sum / max) * 100);
  return { sum, max, scaled, n };
}

// 4-tier cumulative band per the template: 100–76 Normal, 75–51 Watch, 50–25 Significant, <25 Critical.
function movementBand(scaled100) {
  if (scaled100 == null) return null;
  if (scaled100 < 25)  return { tier: 'red',    label: 'Critical',    blurb: 'Marked deficit. Urgent clinical action required.' };
  if (scaled100 <= 50) return { tier: 'orange', label: 'Significant', blurb: 'Clear deviation. Structured intervention recommended.' };
  if (scaled100 <= 75) return { tier: 'yellow', label: 'Watch',       blurb: 'Borderline. Monitor and add targeted support.' };
  return { tier: 'green', label: 'Normal', blurb: 'Within reference range. Maintain current habits.' };
}
// Shared cumulative-score band table rows (used by movement + nutrition cumulative blocks).
const CUMULATIVE_KEY = [
  ['green',  '100–76', 'Normal',      'Within reference range. Maintain current habits.'],
  ['yellow', '75–51',  'Watch',       'Borderline. Monitor and add targeted support.'],
  ['orange', '50–25',  'Significant', 'Clear deviation. Structured intervention recommended.'],
  ['red',    '< 25',   'Critical',    'Marked deficit. Urgent clinical action required.'],
];

// -----------------------------------------------------------------------------
// Nutrition Symptomatic Assessment — 5 categories, frequency scored 1–4.
// Per the Comprehensive TML Patient Report template + V3 correction
// ("nutrimeter scored out of 4 not 5"). Higher response = more symptoms = worse.
//   Never 1 · Rarely 2 · Sometimes 3 · Often 4
// Category tier: 1 green · 2 yellow · 3 orange · 4 red.
// Cumulative is a wellness score /100 (Never is best), banded via the 4-tier band.
// -----------------------------------------------------------------------------
const NUTRITION_SYMPTOM_CATEGORIES = [
  'Weight & Appetite',
  'Digestive & Hydration',
  'Energy & Metabolism',
  'Hormonal',
  'Food Behaviour',
];
const NUTRITION_FREQ_LABELS = ['Never (1)', 'Rarely (2)', 'Sometimes (3)', 'Often (4)'];

function nutritionSymptomTier(resp) {
  return resp == null ? null : ({ 1: 'green', 2: 'yellow', 3: 'orange', 4: 'red' }[resp] || null);
}
// responses: array of 1..4 (or null). Wellness points per answered category = 5 - resp.
function nutritionCumulative(responses) {
  const vals = (responses || []).filter(r => r != null);
  if (!vals.length) return null;
  const points = vals.reduce((a, r) => a + (5 - r), 0);
  const max = vals.length * 4;
  const scaled = Math.round((points / max) * 100);
  return { scaled, points, max, n: vals.length, band: movementBand(scaled) };
}

// (Legacy 8-item screen retained for the standalone wellbeing.html page.)
const NUTRI_METER_QUESTIONS = [
  "Unintentional weight change (up or down) in the past 3 months",
  "Skipping meals or eating fewer than 3 meals on most days",
  "Frequent cravings for sugar, salty, or processed foods",
  "Bloating, heaviness or discomfort after meals",
  "Low energy or afternoon crashes affecting daily activity",
  "Constipation or irregular bowel habits",
  "Inadequate water intake (less than 2 L/day for most days)",
  "Reliance on caffeine to get through the day",
];
function nutriMeterBand(total) {
  if (total == null) return null;
  if (total <= 16) return { tier: 'green',  label: 'Optimal Nourishment',     blurb: 'Habits aligned with good wellbeing.' };
  if (total <= 28) return { tier: 'yellow', label: 'Compromised Nourishment', blurb: 'Subtle nutrition-related symptoms; targeted support advised.' };
  return { tier: 'red', label: 'Impaired Nourishment', blurb: '1:1 nutritionist consultation recommended.' };
}

// -----------------------------------------------------------------------------
// PSS-10 (0-40) — standard scoring (items 4,5,7,8 reverse-coded)
// -----------------------------------------------------------------------------
function pss10Band(total) {
  if (total == null) return null;
  if (total <= 13) return { tier: 'green',  label: 'Low perceived stress' };
  if (total <= 26) return { tier: 'yellow', label: 'Moderate stress' };
  return { tier: 'red', label: 'High perceived stress' };
}

// -----------------------------------------------------------------------------
// PSQI (0-21) — cutoff 5
// -----------------------------------------------------------------------------
function psqiBand(total) {
  if (total == null) return null;
  if (total <= 5)  return { tier: 'green',  label: 'Good sleep quality' };
  if (total <= 10) return { tier: 'yellow', label: 'Poor sleep — mild' };
  if (total <= 15) return { tier: 'orange', label: 'Poor sleep — moderate' };
  return { tier: 'red', label: 'Poor sleep — severe' };
}

// -----------------------------------------------------------------------------
// Body composition / metabolic
// -----------------------------------------------------------------------------
const BODY_COMP = {
  bmi: (v) => v == null ? null
    : v < 18.5 ? 'orange' : v < 25 ? 'green' : v < 30 ? 'yellow' : v < 35 ? 'orange' : 'red',
  bodyFatPctMale:   (v) => v == null ? null : v < 20 ? 'green' : v < 25 ? 'yellow' : v < 30 ? 'orange' : 'red',
  bodyFatPctFemale: (v) => v == null ? null : v < 28 ? 'green' : v < 33 ? 'yellow' : v < 39 ? 'orange' : 'red',
  visceralFat:      (v) => v == null ? null : v < 10 ? 'green' : v < 13 ? 'yellow' : v < 18 ? 'orange' : 'red',
  hba1c:            (v) => v == null ? null : v < 5.7 ? 'green' : v < 6.5 ? 'yellow' : v < 8.0 ? 'orange' : 'red',
  fastingGlucose:   (v) => v == null ? null : v < 100 ? 'green' : v < 126 ? 'yellow' : v < 180 ? 'orange' : 'red',
};

// -----------------------------------------------------------------------------
// BCA scoring — 7 parameters × 4 points = 28 (contributes to the nutrition total of 100).
// Team-tunable bands. Sex-aware where the norm differs (percentages).
// Per clinical request: drop visceral fat & generic muscle mass; keep
// BMI, Body Fat %, Skeletal Muscle Mass, Skeletal Muscle %, Protein %, Lean Mass %, Water %.
// tierToPoints: green 4, yellow 3, orange 2, red 1.
// -----------------------------------------------------------------------------
const tierToPoints = (t) => ({ green: 4, yellow: 3, orange: 2, red: 1 }[t] || null);

const BCA_PARAMS = [
  { key: 'bmi', label: 'BMI', unit: 'kg/m²',
    score: (v) => v == null ? null : (v >= 18.5 && v < 25) ? 'green' : (v >= 25 && v < 27) || (v >= 17 && v < 18.5) ? 'yellow' : (v >= 27 && v < 30) ? 'orange' : 'red' },
  { key: 'body_fat_pct', label: 'Body Fat %', unit: '%',
    score: (v, sex) => v == null ? null : (sex === 'female'
      ? (v < 28 ? 'green' : v < 33 ? 'yellow' : v < 39 ? 'orange' : 'red')
      : (v < 20 ? 'green' : v < 25 ? 'yellow' : v < 30 ? 'orange' : 'red')) },
  { key: 'skeletal_muscle_mass', label: 'Skeletal Muscle Mass', unit: 'kg',
    // Absolute SMM adequacy relative to weight is captured better by %; here we score by
    // SMM% derived from context if available, else neutral 'yellow'. Handled in compute().
    score: () => null },
  { key: 'skeletal_muscle_pct', label: 'Skeletal Muscle %', unit: '%',
    score: (v, sex) => v == null ? null : (sex === 'female'
      ? (v >= 34 ? 'green' : v >= 30 ? 'yellow' : v >= 26 ? 'orange' : 'red')
      : (v >= 40 ? 'green' : v >= 35 ? 'yellow' : v >= 30 ? 'orange' : 'red')) },
  { key: 'protein_pct', label: 'Protein %', unit: '%',
    score: (v) => v == null ? null : v >= 16 ? 'green' : v >= 14 ? 'yellow' : v >= 12 ? 'orange' : 'red' },
  { key: 'lean_mass_pct', label: 'Lean Mass %', unit: '%',
    score: (v, sex) => v == null ? null : (sex === 'female'
      ? (v >= 72 ? 'green' : v >= 67 ? 'yellow' : v >= 62 ? 'orange' : 'red')
      : (v >= 75 ? 'green' : v >= 70 ? 'yellow' : v >= 65 ? 'orange' : 'red')) },
  { key: 'water_pct', label: 'Water %', unit: '%',
    score: (v, sex) => v == null ? null : (sex === 'female'
      ? (v >= 50 && v <= 60 ? 'green' : v >= 45 ? 'yellow' : v >= 40 ? 'orange' : 'red')
      : (v >= 55 && v <= 65 ? 'green' : v >= 50 ? 'yellow' : v >= 45 ? 'orange' : 'red')) },
];
const BCA_MAX = BCA_PARAMS.length * 4;  // 28

function bcaBand(score, max) {
  if (score == null) return null;
  const pct = score / max;
  if (pct >= 0.85) return { tier: 'green',  label: 'Optimal' };
  if (pct >= 0.65) return { tier: 'yellow', label: 'Adequate' };
  if (pct >= 0.45) return { tier: 'orange', label: 'Suboptimal' };
  return { tier: 'red', label: 'Needs Attention' };
}

// Compute the scored BCA parameters + composite /28 from parsed FITTR metrics.
// metrics: array of { metric, value_num }. Returns { params, score, max, band }.
function computeBCA(metrics, sex) {
  if (!Array.isArray(metrics) || !metrics.length) return null;
  sex = (sex || '').toLowerCase();
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byName = {};
  metrics.forEach(m => { byName[norm(m.metric)] = m.value_num; });
  const pick = (...keys) => { for (const k of keys) { const v = byName[norm(k)]; if (v != null && !isNaN(v)) return v; } return null; };

  const weight   = pick('weight');
  const leanMass = pick('lean mass');
  const smm      = pick('skeletal muscle mass');
  const proteinPct = (leanMass != null && weight) ? +(((leanMass * 0.20) / weight) * 100).toFixed(1) : null;
  const smmPct = (smm != null && weight) ? +((smm / weight) * 100).toFixed(1) : null;
  const values = {
    bmi:                  pick('body mass index bmi', 'bmi'),
    body_fat_pct:         pick('fat percentage', 'body fat percentage'),
    skeletal_muscle_mass: smm,
    skeletal_muscle_pct:  pick('skeletal muscle percentage'),
    protein_pct:          proteinPct,
    lean_mass_pct:        pick('lean mass percentage'),
    water_pct:            pick('water percentage', 'total body water percentage'),
  };
  const smPctScorer = BCA_PARAMS.find(p => p.key === 'skeletal_muscle_pct').score;

  let points = 0, counted = 0;
  const params = BCA_PARAMS.map(p => {
    const v = values[p.key];
    const tier = p.key === 'skeletal_muscle_mass' ? smPctScorer(smmPct, sex) : p.score(v, sex);
    if (tier) { points += tierToPoints(tier); counted++; }
    const shownVal = v == null ? '—' : (p.key === 'skeletal_muscle_mass' && smmPct != null ? `${v} (${smmPct}%)` : String(v));
    return { key: p.key, label: p.label, value: shownVal, unit: p.unit, tier };
  });
  const score = counted ? Math.round((points / (counted * 4)) * BCA_MAX) : null;
  return { params, score, max: BCA_MAX, band: bcaBand(score, BCA_MAX) };
}

// Blood: count out-of-range markers ("flags") from parsed biomarker values.
function bloodFlags(values) {
  if (!values) return { count: 0, flags: [] };
  const flags = [];
  for (const [k, v] of Object.entries(values)) {
    const tier = scoreBiomarker(k, v);
    if (tier && tier !== 'green') flags.push({ key: k, label: (BIOMARKERS[k] && BIOMARKERS[k].label) || k, tier });
  }
  return { count: flags.length, flags };
}

// -----------------------------------------------------------------------------
// Blood biomarker bands
// Each biomarker has: label, unit, ref { lo, hi }, optional clinical bands.
// score(value) returns 'green'/'yellow'/'orange'/'red' based on:
//   - in [lo, hi] -> green
//   - within ±10% of nearest bound -> yellow
//   - within ±10–25% -> orange
//   - >25% deviation -> red
// Markers with explicit clinical bands (HbA1c, FPG, Vit D) override this.
// -----------------------------------------------------------------------------
function bandFromRange(value, lo, hi) {
  if (value == null) return null;
  if (value >= lo && value <= hi) return 'green';
  const span = (hi - lo) || Math.max(Math.abs(hi), 1);
  const dev = value < lo ? (lo - value) / span : (value - hi) / span;
  if (dev <= 0.10) return 'yellow';
  if (dev <= 0.25) return 'orange';
  return 'red';
}

const BIOMARKERS = {
  // Glucose
  glucose_fasting:   { label: "Glucose, Fasting",       unit: "mg/dL", ref: { lo: 70, hi: 99 },
    score: (v) => v == null ? null : v < 100 ? 'green' : v < 126 ? 'yellow' : v < 180 ? 'orange' : 'red',
    clinical: "Normal <100; IFG 100–125; Diabetes ≥126" },
  glucose_pp:        { label: "Glucose, Post Prandial", unit: "mg/dL", ref: { lo: 70, hi: 140 },
    score: (v) => v == null ? null : v < 140 ? 'green' : v < 200 ? 'yellow' : v < 250 ? 'orange' : 'red',
    clinical: "Normal <140; IGT 140–199; Diabetes ≥200" },
  insulin_fasting:   { label: "Insulin, Fasting",       unit: "µIU/mL", ref: { lo: 2.6, hi: 24.9 } },
  hba1c:             { label: "HbA1c",                   unit: "%", ref: { lo: 4.0, hi: 5.6 },
    score: (v) => v == null ? null : v < 5.7 ? 'green' : v < 6.5 ? 'yellow' : v < 8.0 ? 'orange' : 'red',
    clinical: "Normal <5.7; Pre-diabetes 5.7–6.4; Diabetes ≥6.5" },
  // Inflammation
  crp:               { label: "C-Reactive Protein (CRP)", unit: "mg/L", ref: { lo: 0, hi: 5.0 } },
  esr:               { label: "ESR",                     unit: "mm/hr", ref: { lo: 0, hi: 15 } },
  // Minerals
  magnesium:         { label: "Magnesium, Serum",        unit: "mg/dL", ref: { lo: 1.6, hi: 2.6 } },
  ferritin:          { label: "Ferritin",                unit: "ng/mL", ref: { lo: 30, hi: 400 } },
  // Vitamins
  vitd:              { label: "Vitamin D (25-OH)",       unit: "ng/mL", ref: { lo: 30, hi: 100 },
    score: (v) => v == null ? null : v >= 30 && v <= 100 ? 'green' : v >= 20 ? 'orange' : 'red',
    clinical: "Deficiency <20; Insufficiency 20–30; Sufficiency 30–100" },
  vite:              { label: "Vitamin E",               unit: "mg/L", ref: { lo: 5.5, hi: 18 } },
  vitb12:            { label: "Vitamin B12",             unit: "pg/mL", ref: { lo: 200, hi: 900 } },
  zinc:              { label: "Zinc, Serum",             unit: "µg/dL", ref: { lo: 70, hi: 120 } },
  // CBC
  hb:                { label: "Haemoglobin (Hb)",        unit: "g/dL", ref: { lo: 13.0, hi: 17.0 } },
  rbc:               { label: "RBC Count",                unit: "mill/cu.mm", ref: { lo: 4.5, hi: 5.5 } },
  pcv:               { label: "PCV (Hematocrit)",         unit: "%", ref: { lo: 40, hi: 50 } },
  mcv:               { label: "MCV",                      unit: "fL", ref: { lo: 83, hi: 101 } },
  mch:               { label: "MCH",                      unit: "pg", ref: { lo: 27, hi: 32 } },
  mchc:              { label: "MCHC",                     unit: "g/dL", ref: { lo: 31.5, hi: 34.5 } },
  rdw:               { label: "RDW",                      unit: "%", ref: { lo: 11.6, hi: 14.0 } },
  wbc:               { label: "Total Leucocytes (WBC)",   unit: "cells/cu.mm", ref: { lo: 4000, hi: 11000 } },
  neutrophils_abs:   { label: "Abs. Neutrophils",         unit: "cells/cu.mm", ref: { lo: 2000, hi: 7000 } },
  lymphocytes_abs:   { label: "Abs. Lymphocytes",         unit: "cells/cu.mm", ref: { lo: 1000, hi: 3000 } },
  monocytes_abs:     { label: "Abs. Monocytes",           unit: "cells/cu.mm", ref: { lo: 200, hi: 1000 } },
  eosinophils_abs:   { label: "Abs. Eosinophils",         unit: "cells/cu.mm", ref: { lo: 20, hi: 500 } },
  basophils_abs:     { label: "Abs. Basophils",           unit: "cells/cu.mm", ref: { lo: 20, hi: 100 } },
  neutrophils_pct:   { label: "Neutrophils",              unit: "%", ref: { lo: 40, hi: 75 } },
  lymphocytes_pct:   { label: "Lymphocytes",              unit: "%", ref: { lo: 20, hi: 40 } },
  monocytes_pct:     { label: "Monocytes",                unit: "%", ref: { lo: 2, hi: 10 } },
  eosinophils_pct:   { label: "Eosinophils",              unit: "%", ref: { lo: 1, hi: 6 } },
  basophils_pct:     { label: "Basophils",                unit: "%", ref: { lo: 0, hi: 1 } },
  platelets:         { label: "Platelet Count",            unit: "×10³/µL", ref: { lo: 150, hi: 450 } },
  mpv:               { label: "MPV",                      unit: "fL", ref: { lo: 6, hi: 9.5 } },
  pdw:               { label: "PDW",                      unit: "fL", ref: { lo: 9, hi: 17 } },
};

function scoreBiomarker(key, value) {
  const def = BIOMARKERS[key];
  if (!def) return null;
  if (def.score) return def.score(value);
  return bandFromRange(value, def.ref.lo, def.ref.hi);
}

// Grouping for display
const BIOMARKER_GROUPS = [
  { title: "Glucose & Insulin", keys: ["glucose_fasting", "glucose_pp", "hba1c", "insulin_fasting"] },
  { title: "Inflammation",      keys: ["crp", "esr"] },
  { title: "Vitamins & Minerals", keys: ["vitd", "vite", "vitb12", "magnesium", "zinc", "ferritin"] },
  { title: "CBC — Erythrocytes", keys: ["hb", "rbc", "pcv", "mcv", "mch", "mchc", "rdw"] },
  { title: "CBC — Leucocytes (absolute)", keys: ["wbc", "neutrophils_abs", "lymphocytes_abs", "monocytes_abs", "eosinophils_abs", "basophils_abs"] },
  { title: "CBC — Leucocytes (differential %)", keys: ["neutrophils_pct", "lymphocytes_pct", "monocytes_pct", "eosinophils_pct", "basophils_pct"] },
  { title: "CBC — Platelets", keys: ["platelets", "mpv", "pdw"] },
];

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------
window.TML_SCORING = {
  TIER, TIER_LABEL, TIER_KEY, CUMULATIVE_KEY, tierFromScore,
  MOVEMENT_TESTS, MOVEMENT_QUESTIONNAIRE, scoreMovementQuestion,
  DYNAMO_TESTS,
  movementComposite, movementBand,
  NUTRI_METER_QUESTIONS, nutriMeterBand,
  NUTRITION_SYMPTOM_CATEGORIES, NUTRITION_FREQ_LABELS, nutritionSymptomTier, nutritionCumulative,
  pss10Band, psqiBand,
  BODY_COMP,
  BCA_PARAMS, BCA_MAX, bcaBand, tierToPoints, computeBCA, bloodFlags,
  BIOMARKERS, BIOMARKER_GROUPS, scoreBiomarker, bandFromRange,
  asymmetryFromLR,
};
