// Client-side parsers for blood reports (Hitech PDF) and Excel templates.
// SheetJS (XLSX) and pdf.js are loaded via CDN by each page that needs them.

(function () {
  // ---------- biomarker key aliases ----------
  // Many lab synonyms; mapped to scoring.js keys.
  const BIOMARKER_ALIASES = {
    // glucose / metabolic
    'glucose fasting':              'glucose_fasting',
    'glucose, fasting':             'glucose_fasting',
    'fasting plasma glucose':       'glucose_fasting',
    'fasting glucose':              'glucose_fasting',
    'glucose post prandial':        'glucose_pp',
    'glucose, post prandial':       'glucose_pp',
    'glucose post-prandial':        'glucose_pp',
    'hba1c':                        'hba1c',
    'glycated hemoglobin':          'hba1c',
    'insulin - fasting':            'insulin_fasting',
    'insulin fasting':              'insulin_fasting',
    'insulin, fasting':             'insulin_fasting',
    // inflammation
    'c reactive protein':           'crp',
    'c reactive protein (crp)':     'crp',
    'c-reactive protein':           'crp',
    'crp':                          'crp',
    'esr':                          'esr',
    'erythrocyte sedimentation rate': 'esr',
    // vits/mins
    'magnesium':                    'magnesium',
    'magnesium, serum':             'magnesium',
    'ferritin':                     'ferritin',
    'vitamin d':                    'vitd',
    'vitamin d total':              'vitd',
    'vitamin d total - 25 hydroxy': 'vitd',
    'vitamin d total - 25 hydroxy (oh)': 'vitd',
    '25-hydroxy vitamin d':         'vitd',
    'vitamin e':                    'vite',
    'vitamin e - quantitative':     'vite',
    'vitamin b12':                  'vitb12',
    'b12':                          'vitb12',
    'zinc':                         'zinc',
    'zinc by icpms':                'zinc',
    'zinc by icpms, serum':         'zinc',
    'zinc, serum':                  'zinc',
    // CBC
    'haemoglobin':                  'hb',
    'hemoglobin':                   'hb',
    'haemoglobin (hb)':             'hb',
    'erythrocyte (rbc) count':      'rbc',
    'rbc count':                    'rbc',
    'rbc':                          'rbc',
    'pcv':                          'pcv',
    'pcv (packed cell volume)':     'pcv',
    'hematocrit':                   'pcv',
    'mcv':                          'mcv',
    'mcv (mean corpuscular volume)':'mcv',
    'mch':                          'mch',
    'mch (mean corpuscular hb)':    'mch',
    'mchc':                         'mchc',
    'mchc (mean corpuscular hb concn.)': 'mchc',
    'rdw':                          'rdw',
    'rdw (red cell distribution width)': 'rdw',
    'total leucocytes (wbc) count': 'wbc',
    'total leucocytes count':       'wbc',
    'wbc':                          'wbc',
    'wbc count':                    'wbc',
    'absolute neutrophils count':   'neutrophils_abs',
    'absolute neutrophil count':    'neutrophils_abs',
    'absolute lymphocyte count':    'lymphocytes_abs',
    'absolute lymphocytes count':   'lymphocytes_abs',
    'absolute monocyte count':      'monocytes_abs',
    'absolute monocytes count':     'monocytes_abs',
    'absolute eosinophil count':    'eosinophils_abs',
    'absolute eosinophils count':   'eosinophils_abs',
    'absolute basophil count':      'basophils_abs',
    'absolute basophils count':     'basophils_abs',
    'neutrophils':                  'neutrophils_pct',
    'lymphocytes':                  'lymphocytes_pct',
    'monocytes':                    'monocytes_pct',
    'eosinophils':                  'eosinophils_pct',
    'basophils':                    'basophils_pct',
    'platelets':                    'platelets',
    'platelet count':               'platelets',
    'mpv':                          'mpv',
    'mpv (mean platelet volume)':   'mpv',
    'pdw':                          'pdw',
    'pdw (platelet distribution width)': 'pdw',
  };

  function aliasKey(rawName) {
    if (!rawName) return null;
    const base = String(rawName).trim().toLowerCase().replace(/\s+/g, ' ');
    // try a series of progressively more aggressive normalisations
    const tries = new Set();
    tries.add(base);
    tries.add(base.replace(/\(.*?\)$/, '').trim());
    tries.add(base.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim());
    // strip trailing ", serum" / ", plasma" / ", whole blood" / ", edta whole blood"
    const stripSuffix = s => s.replace(/,\s*(serum|plasma|whole blood|edta whole blood|edta)\s*$/i, '').trim();
    [...tries].forEach(t => tries.add(stripSuffix(t)));
    // strip non-alphanum trailing punctuation
    [...tries].forEach(t => tries.add(t.replace(/[,;:.\-]+$/, '').trim()));
    for (const t of tries) if (t && BIOMARKER_ALIASES[t]) return BIOMARKER_ALIASES[t];
    return null;
  }

  function numFromString(s) {
    if (s == null) return null;
    const m = String(s).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  // ---------- Hitech PDF parser ----------
  // Strategy: extract every text item with x,y per page; group into lines by y;
  // then in each line, find a biomarker label followed by a numeric "Observed Value"
  // and a unit / reference. The Hitech layout uses 4 columns: Investigation | Observed Value | Unit | Biological Reference Interval.
  async function parseHitechPdf(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const values = {};
    const meta = {};
    let patient = {};

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // Group items into rows by Y (tolerance 3 units)
      const items = content.items.map(it => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
      })).filter(it => it.str && it.str.trim());

      // sort by -y then x
      items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

      // group into rows
      const rows = [];
      let cur = [], lastY = null;
      for (const it of items) {
        if (lastY == null || Math.abs(it.y - lastY) <= 3) {
          cur.push(it);
        } else {
          if (cur.length) rows.push(cur);
          cur = [it];
        }
        lastY = it.y;
      }
      if (cur.length) rows.push(cur);

      // patient / meta capture from page 1.
      // Layout: left column (x < 280) has Name/Age/Address; right column (x >= 280) has VID/Referred/Collected/Reported.
      if (p === 1) {
        for (const row of rows) {
          const left  = row.filter(it => it.x < 280).map(r => r.str).join(' ').replace(/\s+/g, ' ').trim();
          const right = row.filter(it => it.x >= 280).map(r => r.str).join(' ').replace(/\s+/g, ' ').trim();
          const grab = (text, re) => { const m = text.match(re); return m ? m[1].trim() : null; };
          patient.name    = patient.name    || grab(left,  /^Name\s*:\s*(.+)$/i);
          patient.age_sex = patient.age_sex || grab(left,  /Age\s*\/\s*Gender\s*:\s*(.+)$/i);
          meta.referred_by = meta.referred_by || grab(right, /Referred\s*by\s*:\s*(.+)$/i);
          meta.collected   = meta.collected   || grab(right, /Collected\s*On\s*:\s*(.+)$/i);
          meta.reported    = meta.reported    || grab(right, /Reported\s*On\s*:\s*(.+)$/i);
        }
        meta.lab = meta.lab || 'Hitech Diagnostic Centre';
      }

      // Find label/value rows by column positions.
      // Strategy: for each row, identify the leftmost cluster (label) and the next numeric cluster.
      for (const row of rows) {
        if (row.length < 2) continue;
        // skip page furniture
        const joined = row.map(r => r.str).join(' ').trim();
        if (/^Investigation|Observed Value|Biological|MEDICAL LABORATORY|Sample Collected|Page \d|Processing Location|VID No|PID No|Pincode|Address|Contact No|^Note|Limitations|Interpretation|Reference|Disclaimer|Caution|Clinical Utility|Associated Tests|Remark/i.test(joined)) continue;

        // Hitech layout: Investigation x≈31, Observed Value x≈224, Unit x≈335, Reference x≈398.
        const labelParts = row.filter(it => it.x < 200);
        const valueParts = row.filter(it => it.x >= 200 && it.x < 320);
        if (!labelParts.length || !valueParts.length) continue;

        const label = labelParts.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
        const valStr = valueParts.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
        const key = aliasKey(label);
        if (!key) continue;
        const num = numFromString(valStr);
        if (num == null) continue;
        values[key] = num;
      }
    }
    return { values, patient, meta };
  }

  // ---------- Generic table-style PDF fallback ----------
  // Best-effort: pull every line, regex out "label ... number ... number-number".
  async function parseGenericLabPdf(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const values = {};
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      // crude line split
      const lines = text.split(/\s{2,}|\n/);
      for (const line of lines) {
        // strip leading bullets / arrows
        const clean = line.replace(/^[•\-\*\s]+/, '').trim();
        const m = clean.match(/^([A-Za-z][A-Za-z\s\(\)\-,\.\/]+?)\s+(-?\d+(?:\.\d+)?)/);
        if (!m) continue;
        const key = aliasKey(m[1]);
        if (!key) continue;
        if (values[key] == null) values[key] = parseFloat(m[2]);
      }
    }
    return { values, patient: {}, meta: {} };
  }

  // ---------- Excel parser ----------
  // Expected sheet: a "Blood" sheet with columns: marker_key | value (or label | value)
  // Falls back to scanning any two-column shape "label | number".
  async function parseExcel(file) {
    if (!window.XLSX) throw new Error("SheetJS not loaded");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const out = { values: {}, sheets: {} };

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      out.sheets[name] = rows;
      for (const r of rows) {
        if (!r || r.length < 2) continue;
        const a = String(r[0]).trim();
        const b = r[1];
        if (!a || b === '' || b == null) continue;
        // try direct key (snake_case from scoring.js)
        if (window.TML_SCORING && window.TML_SCORING.BIOMARKERS[a]) {
          out.values[a] = Number(b);
          continue;
        }
        const k = aliasKey(a);
        if (k) {
          const n = Number(String(b).replace(/[,\s]/g, ''));
          if (!Number.isNaN(n)) out.values[k] = n;
        }
      }
    }
    return out;
  }

  // ---------- VALD HumanTrak PDF parser ----------
  // VALD reports: one test per page. Header has Patient + Last test + Practitioner.
  // Each page has a test title at (x≈71, y≈89), then Peak/Average or Left/Right values
  // at x≈284–428 around y≈130–200, and a "Detailed results" table at the bottom.
  async function parseVALDHumantrak(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const patient = {};
    const meta = {};
    const tests = {};   // { keyed_test_name: { ... } }

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items.map(it => ({
        s: it.str, x: it.transform[4], y: it.transform[5]
      })).filter(it => it.s && it.s.trim());

      // Header capture (any page).
      for (let i = 0; i < items.length - 1; i++) {
        const s = items[i].s.trim();
        const next = items[i+1] ? items[i+1].s.trim() : '';
        if (/^Patient:?$/i.test(s) && !patient.name) patient.name = next;
        if (/^DOB:?$/i.test(s) && !patient.dob) patient.dob = items[i+1].s.trim();
        if (/^Last test:?$/i.test(s) && !meta.last_test) meta.last_test = items[i+1].s.trim();
        if (/^Practitioner:?$/i.test(s) && !meta.practitioner) meta.practitioner = items[i+1].s.trim();
      }
      // Page 1 of VALD reports often has the name as a standalone item at top-left,
      // followed by a DOB block on the line below. Grab the topmost item only.
      if (!patient.name) {
        const candidates = items
          .filter(it => it.x < 200 && it.x > 80 && it.y > 700)
          .filter(it => !/^DOB|^The Movement Lab|^Lifestyle/i.test(it.s.trim()))
          .sort((a, b) => b.y - a.y);
        if (candidates.length) {
          patient.name = candidates[0].s.trim();
        }
      }
      // Sanitize: strip anything starting with "DOB" / "(NN years)" / "Last test"
      if (patient.name) {
        patient.name = patient.name.replace(/\s*DOB[:\s].*$/i, '').replace(/\s*\(\d+\s*years?\).*$/, '').trim();
      }

      // Test title is the largest-y left-column item.
      const title = items.find(it => it.x < 120 && it.y > 700 && it.y < 800);
      if (!title) continue;
      const testName = title.s.trim();
      const key = testKey(testName);
      if (!key) continue;

      // Locate "Peak" / "Average" / "Left" / "Right" labels in the result panel (x>=280)
      const rightCol = items.filter(it => it.x >= 270);
      const findLabel = (re) => rightCol.find(it => re.test(it.s.trim()));
      const pickValueNear = (label) => {
        if (!label) return null;
        // value sits a few lines BELOW the label (smaller y in pdfjs space)
        const candidates = rightCol
          .filter(it => Math.abs(it.x - label.x) < 30 && it.y < label.y && (label.y - it.y) < 30)
          .filter(it => /^-?\d+(\.\d+)?$/.test(it.s.trim()));
        candidates.sort((a, b) => b.y - a.y);
        return candidates.length ? parseFloat(candidates[0].s) : null;
      };

      const peakLbl = findLabel(/^Peak$/i);
      const avgLbl  = findLabel(/^Average$/i);
      const leftLbl  = findLabel(/^Left$/i);
      const rightLbl = findLabel(/^Right$/i);
      // Sit-to-Stand uses "Test Duration" instead of Peak.
      const durLbl = findLabel(/^Test Duration$/i);

      let peak = pickValueNear(peakLbl);
      if (peak == null) peak = pickValueNear(durLbl);
      const avg  = pickValueNear(avgLbl);
      const leftV = pickValueNear(leftLbl);
      const rightV= pickValueNear(rightLbl);

      // "X% greater on the [right/left] side" line. PDF.js fragments this string;
      // join all right-column items on the line into one searchable buffer.
      let asym = null, dominant = null;
      const joined = rightCol.map(it => it.s).join(' ');
      const mAsym = joined.match(/(\d+(?:\.\d+)?)\s*%\s*greater/i);
      if (mAsym) asym = parseFloat(mAsym[1]);
      const mDom = joined.match(/on the\s+(right|left)\s*side/i);
      if (mDom) dominant = mDom[1].toLowerCase();
      // Fallback: compute asymmetry from L/R if not stated
      if (asym == null && leftV != null && rightV != null && Math.max(leftV, rightV) > 0) {
        asym = Math.round(Math.abs(leftV - rightV) / Math.max(leftV, rightV) * 1000) / 10;
      }

      tests[key] = {
        title: testName,
        peak, avg, left: leftV, right: rightV,
        asymmetry: asym, dominant,
      };
    }

    return { source: 'vald-humantrak', patient, meta, tests };
  }

  function testKey(title) {
    const t = title.toLowerCase().trim();
    if (/sit to stand/.test(t)) return 'sit_to_stand';
    if (/trunk flexion/.test(t)) return 'trunk_flexion';
    if (/trunk extension/.test(t)) return 'trunk_extension';
    if (/trunk lateral flexion|trunk lat/.test(t)) return 'trunk_lat_flex';
    if (/trunk rotation|spinal rotation/.test(t)) return 'trunk_rotation';
    if (/neck lateral flexion/.test(t)) return 'neck_lat_flex';
    if (/neck rotation/.test(t)) return 'neck_rotation';
    if (/overhead squat|squat/.test(t)) return 'squat';
    if (/countermovement|cmj/.test(t)) return 'cmj';
    if (/single.?leg balance|balance/.test(t)) return 'balance';
    if (/shoulder drop|posture/.test(t)) return 'posture';
    return null;
  }

  // ---------- PDF source detection ----------
  // Look at the first page's text to decide which parser to invoke.
  async function detectPdfSource(file) {
    if (!window.pdfjsLib) throw new Error("pdf.js not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(' ').toLowerCase();

    if (/powered by\s*vald|practitioner:|sit to stand|trunk flexion/.test(text)) return 'vald-humantrak';
    if (/hitech|biological reference interval/.test(text)) return 'hitech-blood';
    if (/biological reference interval|investigation\s+observed value/.test(text)) return 'generic-blood';
    // Image-only pdf (Dynamo) — no text at all
    if (text.trim().length < 50) return 'image-only';
    return 'unknown';
  }

  // ---------- Detect & dispatch ----------
  async function parseFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      return await parseExcel(file);
    }
    if (ext === 'pdf') {
      const src = await detectPdfSource(file);
      if (src === 'vald-humantrak') {
        return await parseVALDHumantrak(file);
      }
      if (src === 'image-only') {
        return { source: 'image-only', error: 'PDF is image-only (no extractable text). Enter values manually.' };
      }
      // Lab PDFs: try hitech-aware first; fall back to generic.
      try {
        const hi = await parseHitechPdf(file);
        if (Object.keys(hi.values).length >= 3) return { source: 'hitech-blood', ...hi };
      } catch (e) { console.warn('Hitech parser failed', e); }
      const g = await parseGenericLabPdf(file);
      return { source: 'generic-blood', ...g };
    }
    throw new Error("Unsupported file type: " + ext);
  }

  window.TML_PARSERS = { parseFile, parseExcel, parseHitechPdf, parseGenericLabPdf, parseVALDHumantrak, detectPdfSource, aliasKey, BIOMARKER_ALIASES, testKey };
})();
