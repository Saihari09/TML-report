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

  // ---------- Detect & dispatch ----------
  async function parseFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      return await parseExcel(file);
    }
    if (ext === 'pdf') {
      // try hitech-aware first; fall back to generic.
      try {
        const hi = await parseHitechPdf(file);
        if (Object.keys(hi.values).length >= 3) return hi;
      } catch (e) { console.warn('Hitech parser failed', e); }
      return await parseGenericLabPdf(file);
    }
    throw new Error("Unsupported file type: " + ext);
  }

  window.TML_PARSERS = { parseFile, parseExcel, parseHitechPdf, parseGenericLabPdf, aliasKey, BIOMARKER_ALIASES };
})();
