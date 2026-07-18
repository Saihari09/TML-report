// Renders a TML report from a normalised "case" object into an existing element.
// Each render*() returns a DocumentFragment / HTMLElement; render(case, host) is the entry point.

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(kids)) {
      if (c == null) continue;
      n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  };
  const statusPill = (tier, label) => {
    if (!tier) return el('span', { class: 'status none' }, '—');
    const txt = label || (window.TML_SCORING && window.TML_SCORING.TIER_LABEL ? window.TML_SCORING.TIER_LABEL[tier] : tier.toUpperCase());
    return el('span', { class: `status ${tier}` }, txt);
  };

  // Scan a rendered section for flagged (orange/red) rows → "Label — STATUS".
  function concernsFrom(node) {
    const out = [];
    node.querySelectorAll('table.r tbody tr').forEach(tr => {
      const pill = tr.querySelector('.status.red, .status.orange');
      if (!pill) return;
      const first = tr.querySelector('td');
      const name = first ? first.textContent.trim() : '';
      if (name) out.push(`${name} — ${pill.textContent.trim()}`);
    });
    return out;
  }

  // ----- Summary of Findings block (per section) -----
  function summaryOfFindings(bullets, headline) {
    const box = el('div', { class: 'findings' });
    box.appendChild(el('div', { class: 'findings-title' }, 'Summary of Findings'));
    if (headline) box.appendChild(el('div', { class: 'findings-headline' }, headline));
    const ul = el('ul', {});
    [].concat(bullets || []).filter(Boolean).forEach(b => ul.appendChild(el('li', {}, b)));
    box.appendChild(ul);
    return box;
  }

  // ----- Page chrome -----
  function brandBand(label = 'Confidential · For addressee only') {
    return el('div', { class: 'brand-band' }, [
      el('div', { class: 'wordmark' }, ['THE MOVEMENT LAB', el('span', {}, 'Lifestyle, Realigned.')]),
      el('div', { class: 'conf' }, label),
    ]);
  }
  function pageFoot(extra = '') {
    return el('div', { class: 'foot' }, [
      el('span', {}, 'THE MOVEMENT LAB · themovementlab.org.in · +91 90259 19626'),
      el('span', {}, extra),
    ]);
  }

  // ----- Cover -----
  function renderCover(c) {
    const S = window.TML_SCORING;
    const p = c.patient || {};
    const h = c.history || {};
    const dash = (v) => (v && String(v).trim()) ? v : '—';
    const ageSex = [p.age ? `${p.age} years` : null, p.sex || null].filter(Boolean).join('  ·  ') || '—';

    const node = el('div', { class: 'page cover-v2' }, [
      el('div', { class: 'cover-head' }, [
        el('div', { class: 'wordmark' }, ['THE MOVEMENT LAB', el('span', {}, 'Lifestyle, Realigned.')]),
        el('div', { class: 'report-title' }, 'Comprehensive TML Patient Report'),
      ]),
    ]);

    // Compact client-details block (two columns) at the top.
    const kv = [
      ['Client Name',       dash(p.name)],
      ['Report Date',       dash(p.endpoint_date)],
      ['Age / Sex',         ageSex],
      ['Assessment Date',   dash(p.endpoint_date)],
      ['Patient ID',        dash(p.patient_id || p.employee_id)],
      ['Programme',         dash(p.programme)],
      ['Lead Practitioner', dash(p.lead_practitioner || p.referring_physician)],
      ['Reporting By',      dash(p.reporting_by || p.authored_by)],
    ];
    const details = el('div', { class: 'client-details' });
    kv.forEach(([k, v]) => details.appendChild(el('div', { class: 'cd-row' }, [
      el('div', { class: 'cd-k' }, k), el('div', { class: 'cd-v' }, v),
    ])));
    node.appendChild(el('div', { class: 'section-mini' }, 'Client Details'));
    node.appendChild(details);

    // Presenting complaints (if provided).
    if (h.complaints && h.complaints.trim()) {
      node.appendChild(el('div', { class: 'section-mini' }, 'Presenting Complaints'));
      node.appendChild(el('p', { class: 'cover-complaints' }, h.complaints));
    }

    // Domain "at a glance" chips.
    const chips = [];
    if (c.blood && c.blood.values && Object.keys(c.blood.values).length) {
      const bf = S.bloodFlags(c.blood.values);
      const tier = bf.count === 0 ? 'green' : bf.count <= 2 ? 'yellow' : bf.count <= 4 ? 'orange' : 'red';
      chips.push(['🩸', 'Blood Profile', bf.count ? `${bf.count} Flags` : 'Normal', tier]);
    }
    const comp = c.movement && c.movement.baseline && c.movement.baseline.composite;
    if (comp) chips.push(['🏃', 'Movement', comp.label, comp.tier]);
    let bca = (c.bca && c.bca.metrics) ? S.computeBCA(c.bca.metrics, p.sex || '') : null;
    if (bca && bca.band) chips.push(['⚖️', 'Nutritional Profile', bca.band.label, bca.band.tier]);
    if (c.wellbeing && Array.isArray(c.wellbeing.rows) && c.wellbeing.rows.length) {
      const worst = c.wellbeing.rows.reduce((w, r) => rankTier(r.tier) > rankTier(w) ? r.tier : w, 'green');
      chips.push(['🧠', 'Mental Wellbeing', S.TIER_LABEL[worst], worst]);
    }
    if (chips.length) {
      node.appendChild(el('div', { class: 'section-mini' }, 'At a Glance'));
      const grid = el('div', { class: 'chip-grid' });
      chips.forEach(([ic, lbl, st, t]) => grid.appendChild(el('div', { class: 'ov-card' }, [
        el('div', { class: 'ov-ico' }, ic),
        el('div', { class: 'ov-label' }, lbl),
        el('div', { class: `ov-status ${t || 'none'}` }, st),
      ])));
      node.appendChild(grid);
    }

    // Colour key + brief overall summary.
    node.appendChild(el('div', { class: 'section-mini' }, 'Status Colour Key'));
    node.appendChild(statusKeyGrid());
    const overallText = (c.integrated && c.integrated.next_step && c.integrated.next_step.length > 30)
      ? c.integrated.next_step : null;
    if (overallText) {
      node.appendChild(el('div', { class: 'section-mini' }, 'Overall Summary'));
      node.appendChild(el('p', { class: 'cover-summary' }, overallText));
    }

    node.appendChild(pageFoot());
    return node;
  }

  // ----- Clinical background + status key -----
  function renderBackground(c) {
    const b = c.clinical_background || {};
    const rows = [
      ['Presenting Complaints', b.complaints],
      ['Anthropometry — Baseline', b.anthropometry_baseline],
      ['Metabolic Status', b.metabolic],
      ['Lifestyle / Occupational Profile', b.lifestyle],
      ['Medication / Supplements', b.medication],
      ['Red-Flag Screen', b.red_flags],
    ].filter(([, v]) => v);
    if (!rows.length) return null;
    const tbody = el('tbody');
    rows.forEach(([k, v]) => {
      tbody.appendChild(el('tr', {}, [
        el('td', { style: 'width: 30%; font-weight: 600; color: var(--tml-burgundy);' }, k),
        el('td', {}, v),
      ]));
    });

    const key = el('div', { class: 'status-key' });
    [
      ['green',  'GREEN — Normal',       'Within reference range. Good function and no immediate work limitation. Maintain current habits.'],
      ['yellow', 'YELLOW — Mild Variance','Borderline value. Minor functional impact. Monitor and add targeted support.'],
      ['orange', 'ORANGE — Significant',  'Clear deviation from norm. Early functional limitation. Structured intervention strongly recommended.'],
      ['red',    'RED — Urgent',          'Marked deficit or asymmetry. High risk of symptom progression or injury. Mandatory clinical action.'],
    ].forEach(([t, lbl, desc]) => {
      key.appendChild(el('div', { class: 'row' }, [
        el('span', { class: `swatch ${t}` }),
        el('div', {}, [
          el('div', { class: 'label' }, lbl),
          el('div', { class: 'desc' }, desc),
        ]),
      ]));
    });

    return el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'CLINICAL BACKGROUND'),
      el('table', { class: 'r' }, tbody),
      el('div', { class: 'section-bar' }, 'STATUS COLOUR KEY'),
      el('p', { class: 'intro' }, 'All status indicators in this report follow the four-tier colour code below. Status cells throughout the report show only the colour; refer to this key for interpretation.'),
      key,
      pageFoot(),
    ]);
  }

  // ----- Overall summary -----
  function renderSummary(c) {
    const m = (c.movement && c.movement.baseline && c.movement.baseline.composite) || {};
    const summaryCard = (title, verdict, delta, tier = 'green') =>
      el('div', { class: 'summary-card' }, [
        el('div', { class: 'title' }, title),
        el('div', { class: 'verdict', style: `color: var(--st-${tier})` }, verdict),
        el('div', { class: 'delta' }, delta),
      ]);

    return el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'OVERALL WELLBEING SUMMARY'),
      el('p', { class: 'intro' }, 'This report presents a before-and-after comparison of measurable wellbeing parameters across three domains — movement health, nutritional status and mental wellbeing — assessed at the start and close of the programme cycle.'),
      el('div', { class: 'summary-grid' }, [
        summaryCard('Movement Health',  'IMPROVED', `Composite: ${m.scaled || '?'} → end-point`, 'green'),
        summaryCard('Nutritional Status','IMPROVED', 'HbA1c 6.0% → 5.6%', 'green'),
        summaryCard('Mental Wellbeing', 'IMPROVED', 'PSS-10: 26 → 16 · PSQI: 13 → 6', 'green'),
      ]),
      // Programme outline
      c.programme ? el('div', { class: 'section-bar' }, 'INTERVENTION — THRIVE PROGRAMME OUTLINE') : null,
      c.programme ? el('p', { class: 'intro' }, c.programme.intro) : null,
      c.programme ? programmeTable(c.programme.modalities) : null,
      pageFoot(),
    ]);
  }
  function programmeTable(mods) {
    const thead = el('thead', {}, el('tr', {}, ['Modality', 'Frequency', 'Volume (12 wks.)', 'Focus'].map(h => el('th', {}, h))));
    const tbody = el('tbody');
    mods.forEach(m => {
      tbody.appendChild(el('tr', {}, [
        el('td', { style: 'font-weight:600' }, m.modality),
        el('td', {}, m.frequency),
        el('td', {}, m.volume),
        el('td', {}, m.focus),
      ]));
    });
    return el('table', { class: 'r' }, [thead, tbody]);
  }

  // ----- Movement -----
  function renderMovement(c) {
    const m = c.movement || {};
    const b = m.baseline || {};
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '01'), '  MOVEMENT ASSESSMENT']),
      el('p', { class: 'intro' }, 'Movement parameters assessed using the HumanTrak 3D motion-capture and dynamometry systems. All measurements are standardised and comparable across assessment cycles.'),
    ]);

    // 1. Balance
    if (b.balance) {
      node.appendChild(el('div', { class: 'subhead' }, 'Balance Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Right (mm²)', 'Left (mm²)', 'Asymmetry', 'Status'],
        [['Single-Leg Balance (Eyes Closed) — COM 95% Ellipse Area',
          b.balance.right_mm2, b.balance.left_mm2, b.balance.asym_pct + '%',
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.balanceAsymmetry.score(b.balance.asym_pct))]]
      ));
    }

    // 2. Posture
    if (b.posture && b.posture.shoulder_drop_cm != null) {
      node.appendChild(el('div', { class: 'subhead' }, 'Posture Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Shoulder Drop (cm)', 'Status'],
        [['Static Posture Analysis (Frontal Plane)', b.posture.shoulder_drop_cm,
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.shoulderDrop.score(b.posture.shoulder_drop_cm))]]
      ));
    }

    // 3. Neck ROM — status is colour-coded on the L/R asymmetry %.
    if (b.neck) {
      const asymTier = (l, r) => window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(window.TML_SCORING.asymmetryFromLR(l, r));
      const fmt = a => (a == null ? '—' : a + '%');
      const rows = [];
      if (b.neck.lat_flex_right != null || b.neck.lat_flex_left != null) {
        const a = b.neck.lat_flex_asym ?? window.TML_SCORING.asymmetryFromLR(b.neck.lat_flex_left, b.neck.lat_flex_right);
        rows.push(['Neck Lateral Flexion', b.neck.lat_flex_right ?? '—', b.neck.lat_flex_left ?? '—', b.neck.lat_flex_ref, fmt(a),
          statusPill(asymTier(b.neck.lat_flex_left, b.neck.lat_flex_right))]);
      }
      if (b.neck.rotation_right != null || b.neck.rotation_left != null) {
        const a = b.neck.rotation_asym ?? window.TML_SCORING.asymmetryFromLR(b.neck.rotation_left, b.neck.rotation_right);
        rows.push(['Neck Rotation', b.neck.rotation_right ?? '—', b.neck.rotation_left ?? '—', b.neck.rotation_ref, fmt(a),
          statusPill(asymTier(b.neck.rotation_left, b.neck.rotation_right))]);
      }
      if (rows.length) {
        node.appendChild(el('div', { class: 'subhead' }, 'Neck Range of Motion'));
        node.appendChild(tableRows(['Test', 'Right (°)', 'Left (°)', 'Reference', 'Asymmetry', 'Status'], rows));
      }
    }

    // 4. Trunk ROM
    if (b.trunk) {
      node.appendChild(el('div', { class: 'subhead' }, 'Trunk Range of Motion'));
      const avgLat = b.trunk.lat_flex_right != null && b.trunk.lat_flex_left != null
        ? (b.trunk.lat_flex_right + b.trunk.lat_flex_left) / 2 : null;
      const avgRot = b.trunk.rotation_right != null && b.trunk.rotation_left != null
        ? (b.trunk.rotation_right + b.trunk.rotation_left) / 2 : null;
      const rows = [];
      if (b.trunk.flexion != null) rows.push([
        'Trunk Flexion (Peak)', b.trunk.flexion, b.trunk.flexion_avg != null ? b.trunk.flexion_avg + ' avg' : '—',
        b.trunk.flexion_ref || '100–130', '—',
        statusPill(window.TML_SCORING.MOVEMENT_TESTS.trunkFlexion.score(b.trunk.flexion))
      ]);
      if (b.trunk.extension != null) rows.push([
        'Trunk Extension', b.trunk.extension,
        b.trunk.extension_avg != null ? b.trunk.extension_avg + ' avg' : '—',
        b.trunk.extension_ref, '—',
        statusPill(window.TML_SCORING.MOVEMENT_TESTS.trunkExtension.score(b.trunk.extension))
      ]);
      // L/R tests: status is the asymmetry tier (NOT the absolute ROM vs reference).
      const asymTier = (l, r) => window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(window.TML_SCORING.asymmetryFromLR(l, r));
      const fmtAsym = a => (a == null ? '—' : a + '%');
      if (b.trunk.lat_flex_right != null || b.trunk.lat_flex_left != null) {
        const a = b.trunk.lat_flex_asym ?? window.TML_SCORING.asymmetryFromLR(b.trunk.lat_flex_left, b.trunk.lat_flex_right);
        rows.push(['Trunk Lateral Flexion', b.trunk.lat_flex_right ?? '—', b.trunk.lat_flex_left ?? '—',
          b.trunk.lat_flex_ref, fmtAsym(a),
          statusPill(asymTier(b.trunk.lat_flex_left, b.trunk.lat_flex_right))]);
      }
      if (b.trunk.rotation_right != null || b.trunk.rotation_left != null) {
        const a = b.trunk.rotation_asym ?? window.TML_SCORING.asymmetryFromLR(b.trunk.rotation_left, b.trunk.rotation_right);
        rows.push(['Trunk Rotation', b.trunk.rotation_right ?? '—', b.trunk.rotation_left ?? '—',
          b.trunk.rotation_ref, fmtAsym(a),
          statusPill(asymTier(b.trunk.rotation_left, b.trunk.rotation_right))]);
      }
      if (rows.length) node.appendChild(tableRows(
        ['Test', 'Right / Obs (°)', 'Left (°)', 'Reference (°)', 'Asymmetry', 'Status'],
        rows
      ));
    }

    // 5. Dynamic
    if (b.dynamic) {
      const asymTier = (l, r) => window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(window.TML_SCORING.asymmetryFromLR(l, r));
      const rows = [];
      if (b.dynamic.squat_right_deg != null || b.dynamic.squat_left_deg != null) {
        const a = b.dynamic.squat_asym ?? window.TML_SCORING.asymmetryFromLR(b.dynamic.squat_left_deg, b.dynamic.squat_right_deg);
        rows.push(['Overhead Squat — Knee Flexion (Max)',
          (b.dynamic.squat_right_deg ?? '—') + '°', (b.dynamic.squat_left_deg ?? '—') + '°',
          (a ?? '—') + '%',
          statusPill(asymTier(b.dynamic.squat_left_deg, b.dynamic.squat_right_deg))]);
      }
      if (b.dynamic.sit_to_stand_s != null) {
        rows.push(['Sit-to-Stand × 5', b.dynamic.sit_to_stand_s + ' sec', '—', 'Duration',
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.sitToStand.score(b.dynamic.sit_to_stand_s))]);
      }
      if (b.dynamic.cmj_cm != null) {
        rows.push(['Countermovement Jump', b.dynamic.cmj_cm + ' cm', '—', 'Jump Height',
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.countermovementJump.score(b.dynamic.cmj_cm))]);
      }
      if (rows.length) {
        node.appendChild(el('div', { class: 'subhead' }, 'Dynamic Lower-Body Assessment'));
        node.appendChild(tableRows(['Test', 'Right / Value', 'Left / —', 'Asymmetry / Unit', 'Status'], rows));
      }
    }

    // 6. Strength — status colour applied to L/R asymmetry %.
    if (b.strength) {
      node.appendChild(el('div', { class: 'subhead' }, 'Strength Assessment'));
      const asymTier = (l, r) => window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(window.TML_SCORING.asymmetryFromLR(l, r));
      const rows = [];
      if (b.strength.grip_right_n != null || b.strength.grip_left_n != null) {
        const a = b.strength.grip_asym ?? window.TML_SCORING.asymmetryFromLR(b.strength.grip_left_n, b.strength.grip_right_n);
        rows.push(['Grip Strength', b.strength.grip_right_n, b.strength.grip_left_n, (a ?? '—') + '%',
          statusPill(asymTier(b.strength.grip_left_n, b.strength.grip_right_n))]);
      }
      if (b.strength.quad_right_n != null || b.strength.quad_left_n != null) {
        const a = b.strength.quad_asym ?? window.TML_SCORING.asymmetryFromLR(b.strength.quad_left_n, b.strength.quad_right_n);
        rows.push(['Quadriceps Strength (Knee Extension)', b.strength.quad_right_n, b.strength.quad_left_n, (a ?? '—') + '%',
          statusPill(asymTier(b.strength.quad_left_n, b.strength.quad_right_n))]);
      }
      if (rows.length) node.appendChild(tableRows(['Test', 'Right (N)', 'Left (N)', 'Asymmetry', 'Status'], rows));
    }

    // Additional VALD tests not covered by the hardcoded sections
    // (shoulder, elbow, hip IR, dorsiflexion, etc.)
    if (Array.isArray(b.additional_tests) && b.additional_tests.length) {
      node.appendChild(el('div', { class: 'subhead' }, 'Upper Body & Other Tests'));
      const asymTier = (l, r) => window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(window.TML_SCORING.asymmetryFromLR(l, r));
      const fmtAsym = a => (a == null ? '—' : a + '%');
      const rows = b.additional_tests.map(t => {
        const right = t.right ?? t.peak ?? '—';
        const left  = t.left  ?? t.avg  ?? '—';
        const asym  = t.asymmetry;
        return [t.title, right, left, fmtAsym(asym),
          statusPill(asym != null ? asymTier(t.left, t.right) : null)];
      });
      node.appendChild(tableRows(['Test', 'Right / Peak', 'Left / Avg', 'Asymmetry', 'Status'], rows));
    }

    // 6b. Dynamo strength (manual, from generator)
    if (Array.isArray(b.dynamo) && b.dynamo.length) {
      node.appendChild(el('div', { class: 'subhead' }, 'Dynamometer — Strength & ROM'));
      const rows = b.dynamo.map(r => [
        r.label,
        r.left != null ? r.left + ' ' + (r.unit || '') : '—',
        r.right != null ? r.right + ' ' + (r.unit || '') : '—',
        r.asymmetry != null ? r.asymmetry + '%' : '—',
        statusPill(r.tier),
      ]);
      node.appendChild(tableRows(['Test', 'Left', 'Right', 'Asymmetry', 'Status'], rows));
    }

    // Cumulative movement score — 4-tier band per the template.
    if (b.composite) {
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 9pt; margin:6px 0 0' },
        `Cumulative of ${b.composite.n || 'all measured'} movement tests, each scored 1–4 (Red 1 → Green 4) and presented out of 100.`));
      node.appendChild(cumulativeScoreBlock('Movement Score', b.composite.scaled, 100,
        { tier: b.composite.tier, label: b.composite.label }));
    }

    // Number the movement subsections 1.1, 1.2, … (direct-child subheads only,
    // so the cumulative-block's nested subheads are untouched).
    let sub = 0;
    node.querySelectorAll(':scope > .subhead').forEach(h => { sub++; h.textContent = `1.${sub}  ${h.textContent}`; });

    // Summary of Findings — derived from the status pills already rendered in this page.
    const concerns = [];
    node.querySelectorAll('table.r tbody tr').forEach(tr => {
      const pill = tr.querySelector('.status.red, .status.orange');
      if (!pill) return;
      const name = tr.querySelector('td') ? tr.querySelector('td').textContent.trim() : '';
      if (name) concerns.push(`${name} — ${pill.textContent.trim()}`);
    });
    const headline = b.composite ? `Movement score ${b.composite.scaled}/100 — ${b.composite.label}.` : null;
    node.appendChild(summaryOfFindings(
      concerns.length ? concerns : ['No significant movement restrictions or asymmetries detected.'],
      headline
    ));

    node.appendChild(pageFoot());
    // Cache concerns for the domain's Key Findings & Recommendations page.
    c._movementConcerns = concerns;
    return [node];
  }

  // ----- Movement gallery: rep photos extracted from the VALD HumanTrak PDF -----
  // Polished card: photo on top, structured values block underneath (NOT image text).
  function renderMovementGallery(c) {
    const tests = c.movement && c.movement.baseline && c.movement.baseline.vald_tests;
    if (!tests) return null;
    const withImg = Object.values(tests).filter(t => t && t.image);
    if (!withImg.length) return null;

    const valuesFor = (t) => {
      const pairs = [];
      if (t.peak != null) pairs.push(['Peak', t.peak + (t.title && /flex|ext|rotation|abd|posture|dorsi/i.test(t.title) ? '°' : '')]);
      if (t.avg  != null) pairs.push(['Average', t.avg + (t.title && /flex|ext|rotation|abd|posture|dorsi/i.test(t.title) ? '°' : '')]);
      if (t.left != null && t.right != null) {
        pairs.push(['Left',  t.left  + (typeof t.left  === 'number' ? '°' : '')]);
        pairs.push(['Right', t.right + (typeof t.right === 'number' ? '°' : '')]);
      }
      if (t.asymmetry != null) pairs.push(['Asymmetry', t.asymmetry + '%']);
      return pairs;
    };
    const asymTierFor = (t) =>
      t.asymmetry != null
        ? window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(t.asymmetry)
        : null;

    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'HUMANTRAK — REP SNAPSHOTS'),
      el('p', { class: 'intro' }, 'Reference frames from the HumanTrak motion-capture session, captured at the rep that produced the peak value for each test.'),
    ]);
    const grid = el('div', { class: 'snap-grid' });
    for (const t of withImg) {
      const tier = asymTierFor(t);
      const meta = el('div', { class: 'snap-meta' });
      for (const [k, v] of valuesFor(t)) {
        meta.appendChild(el('div', { class: 'snap-row' }, [
          el('span', { class: 'k' }, k),
          el('span', { class: 'v' }, String(v)),
        ]));
      }
      if (tier) meta.appendChild(el('div', { class: 'snap-row', style: 'margin-top:4px' }, [
        el('span', { class: 'k' }, 'Status'),
        statusPill(tier),
      ]));
      const card = el('div', { class: 'snap-card' }, [
        el('div', { class: 'snap-title' }, t.title || ''),
        el('div', { class: 'snap-photo' }, el('img', { src: t.image, alt: t.title || '' })),
        meta,
      ]);
      grid.appendChild(card);
    }
    node.appendChild(grid);
    node.appendChild(pageFoot());
    return node;
  }

  // ----- BCA (Body Composition Analysis) — separate page when supplied -----
  function renderBCA(c) {
    const b = c.bca;
    if (!b) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, b.section_num || '02'), '  BODY COMPOSITION ANALYSIS']),
      el('p', { class: 'intro' }, 'Body composition assessed via bioimpedance analysis. Values, units, and clinical status as reported by the BCA device; each parameter is colour-coded against the device-supplied band.'),
    ]);
    if (b.summary) {
      node.appendChild(el('div', { class: 'subhead' }, 'Health Summary'));
      node.appendChild(el('p', { style: 'font-size:10pt; line-height: 1.55;' }, b.summary));
    }
    if (b.critical && (b.critical.immediate || b.critical.monitoring)) {
      node.appendChild(el('div', { class: 'subhead' }, 'Critical Findings'));
      const grid = el('div', { class: 'two-col' });
      grid.appendChild(el('div', {}, [
        el('div', { class: 'title', style: 'color: var(--st-orange);' }, 'Immediate Attention'),
        el('p', { style: 'font-size:9.5pt; margin:0; line-height: 1.5;' }, b.critical.immediate || '—'),
      ]));
      grid.appendChild(el('div', {}, [
        el('div', { class: 'title', style: 'color: var(--st-yellow);' }, 'Keep Monitoring'),
        el('p', { style: 'font-size:9.5pt; margin:0; line-height: 1.5; white-space: pre-line;' }, b.critical.monitoring || '—'),
      ]));
      node.appendChild(grid);
    }
    if (b.metrics && b.metrics.length) {
      const S = window.TML_SCORING;
      const sex = (c.patient && c.patient.sex) || '';
      const bca = S.computeBCA(b.metrics, sex);
      if (bca) {
        node.appendChild(el('div', { class: 'subhead' }, 'Body Composition — Scored Parameters'));
        node.appendChild(tableRows(['Parameter', 'Value', 'Unit', 'Status'],
          bca.params.map(p => [p.label, p.value, p.unit, statusPill(p.tier)])));

        // Summary of Findings (item 7)
        const concerns = bca.params.filter(p => p.tier === 'red' || p.tier === 'orange');
        node.appendChild(summaryOfFindings(
          concerns.length
            ? concerns.map(p => `${p.label}: ${p.value}${p.unit && p.unit !== 'kg/m²' ? '' : ''} — ${(S.TIER_LABEL[p.tier]||p.tier)}`)
            : ['All scored body-composition parameters within acceptable range.'],
          bca.band ? `BCA composite ${bca.score}/${bca.max} — ${bca.band.label}.` : null
        ));

        if (bca.score != null && bca.band) {
          b._bcaScore = { score: bca.score, max: bca.max, tier: bca.band.tier, label: bca.band.label };
          node.appendChild(el('div', { class: 'composite', style: 'margin-top:12px' }, [
            el('div', {}, [
              el('div', { class: 'score-label' }, 'BCA Score'),
              el('div', { class: 'score-num' }, [String(bca.score), el('small', {}, ' / ' + bca.max)]),
              el('div', { class: 'verdict-band', style: `background: var(--st-${bca.band.tier}-bg); color: var(--st-${bca.band.tier})` }, bca.band.label),
            ]),
            el('div', {}, [
              el('div', { class: 'subhead', style: 'margin-top:0' }, 'How this is scored'),
              el('p', { class: 'muted', style: 'font-size: 9pt; margin:4px 0' },
                'Seven body-composition parameters are each scored 1–4 (Red 1 → Green 4) for a maximum of 28 points. This BCA score combines with the nutrition questionnaire toward the overall Nutrition score (out of 100).'),
            ]),
          ]));
        }
      }
    }
    node.appendChild(pageFoot());
    return node;
  }

  // ----- Nutrition: symptomatic assessment (5 categories, scored 1–4) -----
  function renderNutrition(c) {
    const S = window.TML_SCORING;
    const n = c.nutrition || {};
    const resp = n.symptom_responses;   // array of 1..4 (or null) per category
    if (!Array.isArray(resp) || !resp.some(r => r != null)) { c._nutritionConcerns = undefined; return null; }

    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '03'), '  NUTRITIONAL STATUS — SYMPTOMATIC ASSESSMENT']),
      el('p', { class: 'intro' }, 'Structured dietary-symptom screen across five domains. Each domain is rated by symptom frequency (Never 1 · Rarely 2 · Sometimes 3 · Often 4); more frequent symptoms indicate greater nutritional strain.'),
    ]);

    const ths = ['Symptom Domain', 'Never (1)', 'Rarely (2)', 'Sometimes (3)', 'Often (4)', 'Status'];
    const concerns = [];
    const rows = S.NUTRITION_SYMPTOM_CATEGORIES.map((cat, i) => {
      const r = resp[i];
      const tier = S.nutritionSymptomTier(r);
      if (tier === 'red' || tier === 'orange') concerns.push(`${cat} — ${S.TIER_LABEL[tier]}`);
      const tick = (v) => el('td', { class: 'center' }, r === v ? '✓' : '');
      return [cat, tick(1), tick(2), tick(3), tick(4), el('td', { class: 'center' }, statusPill(tier))];
    });
    node.appendChild(tableRowsRaw(ths, rows));

    const cum = S.nutritionCumulative(resp);
    if (cum) {
      node.appendChild(cumulativeScoreBlock('Nutrition Score', cum.scaled, 100, cum.band));
    }

    node.appendChild(pageFoot());
    c._nutritionConcerns = concerns;
    return node;
  }

  // Shared cumulative-score block (score /100 + 4-tier banding key).
  function cumulativeScoreBlock(label, scaled, max, band) {
    return el('div', { class: 'composite', style: 'margin-top:12px' }, [
      el('div', {}, [
        el('div', { class: 'score-label' }, label),
        el('div', { class: 'score-num' }, [String(scaled), el('small', {}, ' / ' + max)]),
        band ? el('div', { class: 'verdict-band', style: `background: var(--st-${band.tier}-bg); color: var(--st-${band.tier})` }, band.label) : null,
      ]),
      el('div', {}, [
        el('div', { class: 'subhead', style: 'margin-top:0' }, 'Interpretation'),
        el('div', { class: 'band-table cum' }, (() => {
          const kids = [el('div', { class: 'head' }, 'Range'), el('div', { class: 'head' }, 'Band'), el('div', { class: 'head' }, 'Meaning')];
          window.TML_SCORING.CUMULATIVE_KEY.forEach(([t, range, name, desc]) => {
            kids.push(el('div', {}, range));
            kids.push(el('div', { style: `color:var(--st-${t});font-weight:600` }, name));
            kids.push(el('div', {}, desc));
          });
          return kids;
        })()),
      ]),
    ]);
  }

  // ----- Wellbeing -----
  function renderWellbeing(c) {
    const w = c.wellbeing || {};
    const hasRows = Array.isArray(w.rows) && w.rows.length > 0;
    if (!hasRows) return null;   // recommendations live on the Prescriptions page
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '03'), '  MENTAL WELLBEING']),
      el('p', { class: 'intro' }, "Mental wellbeing was screened using two validated tools: the Perceived Stress Scale (PSS-10) for stress-load and the Pittsburgh Sleep Quality Index (PSQI) for sleep architecture. All data is handled in accordance with TML's data privacy policy."),
    ]);
    if (w.rows) {
      const rows = w.rows.map(r => [r.param, r.baseline, statusPill(r.tier)]);
      node.appendChild(tableRows(['Parameter', 'Score', 'Status'], rows));
      c._mentalConcerns = w.rows.filter(r => r.tier === 'red' || r.tier === 'orange')
        .map(r => `${r.param} — ${window.TML_SCORING.TIER_LABEL[r.tier] || r.tier}`);
    }
    node.appendChild(el('div', { class: 'two-col' }, [
      el('div', {}, [
        el('div', { class: 'title' }, 'PSS-10 — Interpretation'),
        el('ul', {}, [
          el('li', {}, '0–13  ·  Low perceived stress'),
          el('li', {}, '14–26  ·  Moderate stress'),
          el('li', {}, '27–40  ·  High perceived stress'),
        ]),
        w.pss_note ? el('p', { style: 'font-size:9pt; margin: 6px 0 0 0;' }, w.pss_note) : null,
      ]),
      el('div', {}, [
        el('div', { class: 'title' }, 'PSQI — Interpretation'),
        el('ul', {}, [
          el('li', {}, '≤ 5  ·  Good sleep quality'),
          el('li', {}, '> 5  ·  Poor sleep quality'),
        ]),
        w.psqi_note ? el('p', { style: 'font-size:9pt; margin: 6px 0 0 0;' }, w.psqi_note) : null,
      ]),
    ]));
    node.appendChild(pageFoot());
    return node;
  }

  // ----- Blood (used by blood.html and combined report) -----
  function renderBlood(c) {
    const b = c.blood || {};
    // Skip the entire section if no biomarkers AND no recommendations.
    const hasValues = b.values && Object.keys(b.values).length > 0;
    const hasRecs   = Array.isArray(b.recs) && b.recs.length > 0;
    if (!hasValues && !hasRecs) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, b.section_num || '04'), '  BLOOD BIOMARKERS']),
      el('p', { class: 'intro' }, b.intro || 'Biomarker values parsed from the laboratory report. Status colour is assigned by comparing each value against the printed Biological Reference Interval; clinical bands are used where the assay defines them (e.g. HbA1c, Glucose, Vitamin D).'),
    ]);
    if (b.meta) {
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 9pt; margin-bottom: 12px;' },
        `Lab: ${b.meta.lab || '—'} · Collected: ${b.meta.collected || '—'} · Reported: ${b.meta.reported || '—'} · Ref. by: ${b.meta.referred_by || '—'}`));
    }
    const groups = window.TML_SCORING.BIOMARKER_GROUPS;
    groups.forEach(g => {
      const rows = g.keys
        .filter(k => b.values && b.values[k] != null)
        .map(k => {
          const def = window.TML_SCORING.BIOMARKERS[k];
          const v = b.values[k];
          const tier = window.TML_SCORING.scoreBiomarker(k, v);
          return [
            def.label,
            String(v),
            def.unit,
            def.clinical ? def.clinical : `${def.ref.lo}–${def.ref.hi}`,
            statusPill(tier),
          ];
        });
      if (!rows.length) return;
      node.appendChild(el('div', { class: 'subhead' }, g.title));
      node.appendChild(tableRows(['Investigation', 'Value', 'Unit', 'Reference', 'Status'], rows));
    });
    if (b.pending && b.pending.length) {
      node.appendChild(el('div', { class: 'subhead' }, 'Pending'));
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 9.5pt' }, b.pending.join(', ')));
    }
    // Summary of Findings — flagged (non-green) biomarkers.
    if (b.values && Object.keys(b.values).length) {
      const bf = window.TML_SCORING.bloodFlags(b.values);
      const findings = bf.count ? bf.flags.map(f => `${f.label} — ${window.TML_SCORING.TIER_LABEL[f.tier] || f.tier}`)
                                : ['All biomarkers within their reference ranges.'];
      node.appendChild(summaryOfFindings(findings, `${bf.count} of ${Object.keys(b.values).length} markers flagged for review.`));
      c._bloodConcerns = bf.count ? findings : [];
    }
    node.appendChild(pageFoot());
    return node;
  }

  // ----- Integrated summary -----
  function renderIntegrated(c) {
    const i = c.integrated || {};
    const hasObs  = Array.isArray(i.observations) && i.observations.length > 0;
    const hasCont = Array.isArray(i.continue) && i.continue.length > 0;
    const hasAtt  = Array.isArray(i.attention) && i.attention.length > 0;
    const hasNext = i.next_step && i.next_step.trim().length > 30;  // skip the auto stub
    if (!hasObs && !hasCont && !hasAtt && !hasNext) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'INTEGRATED SUMMARY & NEXT STEPS'),
      el('p', { class: 'intro' }, 'The following summary draws together observations across the assessed domains. Where parameters intersect — e.g. asymmetry impacting joint loading, or stress impacting sleep impacting recovery — these connections are noted here.'),
    ]);
    if (i.observations) {
      node.appendChild(el('div', { class: 'subhead' }, 'Key Observations'));
      const ul = el('ol', { class: 'recs' });
      i.observations.forEach(o => ul.appendChild(el('li', {}, o)));
      node.appendChild(ul);
    }
    node.appendChild(el('div', { class: 'subhead' }, 'Priority Areas for Next Cycle'));
    node.appendChild(el('div', { class: 'two-col' }, [
      el('div', {}, [
        el('div', { class: 'title' }, 'Continue & Build On'),
        el('ul', {}, (i.continue || []).map(t => el('li', {}, t))),
      ]),
      el('div', {}, [
        el('div', { class: 'title' }, 'Needs Focused Attention'),
        el('ul', {}, (i.attention || []).map(t => el('li', {}, t))),
      ]),
    ]));
    if (i.next_step) {
      node.appendChild(el('div', { class: 'subhead' }, 'Recommended Next Step'));
      node.appendChild(el('p', { style: 'font-size: 10pt' }, i.next_step));
    }
    node.appendChild(pageFoot());
    return node;
  }

  // ----- helpers -----
  function tableRows(headers, rows) {
    const thead = el('thead', {}, el('tr', {}, headers.map(h => el('th', {}, h))));
    const tbody = el('tbody', {}, rows.map(r =>
      el('tr', {}, r.map((cell, idx) =>
        cell instanceof Node && cell.tagName === 'TD' ? cell
        : cell instanceof Node ? el('td', {}, cell)
        : el('td', { class: typeof cell === 'number' || /^-?\d/.test(String(cell)) ? 'num' : '' }, cell ?? '')
      ))
    ));
    return el('table', { class: 'r' }, [thead, tbody]);
  }
  function tableRowsRaw(headers, rows) {
    const thead = el('thead', {}, el('tr', {}, headers.map(h => el('th', {}, h))));
    const tbody = el('tbody', {}, rows.map(r =>
      el('tr', {}, r.map(cell =>
        cell instanceof Node && cell.tagName === 'TD' ? cell
        : cell instanceof Node ? el('td', {}, cell)
        : el('td', {}, cell ?? '')
      ))
    ));
    return el('table', { class: 'r' }, [thead, tbody]);
  }
  function prettyKey(k) {
    return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ----- Entry -----
  function render(caseData, host, opts = {}) {
    host.innerHTML = '';
    const include = opts.include || ['cover', 'background', 'movement', 'movement_images', 'bca', 'blood', 'nutrition', 'wellbeing', 'integrated'];

    // Section registry — each returns a node, an array of nodes, or null (skip).
    const SECTIONS = {
      cover:           () => renderCover(caseData),
      overview:        () => renderOverview(caseData),
      background:      () => renderBackground(caseData),
      history:         () => renderHistory(caseData),
      summary:         () => renderSummary(caseData),
      blood:           () => caseData.blood ? renderBlood(caseData) : null,
      blood_rx:        () => caseData._bloodConcerns === undefined ? null
                              : domainRxSignature({ title: 'BLOOD — KEY FINDINGS & RECOMMENDATIONS',
                                  findings: caseData._bloodConcerns, recs: caseData.blood && caseData.blood.recs,
                                  role: 'Consultant Physician Signature' }),
      movement:        () => renderMovement(caseData),
      movement_images: () => renderMovementGallery(caseData),
      movement_rx:     () => caseData._movementConcerns === undefined ? null
                              : domainRxSignature({ title: 'MOVEMENT — KEY FINDINGS & RECOMMENDATIONS',
                                  findings: caseData._movementConcerns, recs: caseData.movement && caseData.movement.recs,
                                  role: 'Physiotherapist Signature' }),
      bca:             () => caseData.bca ? renderBCA(caseData) : null,
      nutrition:       () => renderNutrition(caseData),
      nutrition_rx:    () => caseData._nutritionConcerns === undefined ? null
                              : domainRxSignature({ title: 'NUTRITION — KEY FINDINGS & RECOMMENDATIONS',
                                  findings: caseData._nutritionConcerns, recs: caseData.nutrition && caseData.nutrition.recs,
                                  role: 'Nutritionist Signature' }),
      wellbeing:       () => renderWellbeing(caseData),
      wellbeing_rx:    () => caseData._mentalConcerns === undefined ? null
                              : domainRxSignature({ title: 'MENTAL WELLBEING — KEY FINDINGS & RECOMMENDATIONS',
                                  findings: caseData._mentalConcerns, recs: caseData.wellbeing && caseData.wellbeing.recs,
                                  role: 'Psychologist Signature' }),
      prescriptions:   () => renderPrescriptions(caseData),
      integrated:      () => renderIntegrated(caseData),
    };

    // Render strictly in the order given by `include`.
    const seen = new Set();
    for (const key of include) {
      if (seen.has(key)) continue; seen.add(key);
      const fn = SECTIONS[key];
      if (!fn) continue;
      let out;
      try { out = fn(); } catch (e) { console.error('section', key, 'failed', e); continue; }
      if (!out) continue;
      (Array.isArray(out) ? out : [out]).forEach(p => { if (p) host.appendChild(p); });
    }

    // Renumber section bars that carry a .num badge, in document order.
    let n = 0;
    host.querySelectorAll('.section-bar .num').forEach(badge => {
      n++; badge.textContent = String(n).padStart(2, '0');
    });
  }

  // ----- Overview: overall scoring + icon status cards + interpretation (pages 1–2) -----
  function iconCard(icon, label, statusText, tier) {
    return el('div', { class: 'ov-card' }, [
      el('div', { class: 'ov-ico' }, icon),
      el('div', { class: 'ov-label' }, label),
      el('div', { class: `ov-status ${tier || 'none'}` }, statusText),
    ]);
  }
  function renderOverview(c) {
    const S = window.TML_SCORING;
    const cards = [];
    const scoreCards = [];

    // Movement
    const comp = c.movement && c.movement.baseline && c.movement.baseline.composite;
    if (comp) {
      scoreCards.push({ label: 'Movement Health', value: `${comp.scaled}/100`, sub: comp.label, tier: comp.tier });
      cards.push(iconCard('🏃', 'Movement', comp.label, comp.tier));
    }
    // BCA / body composition
    let bca = null;
    if (c.bca && c.bca.metrics) bca = S.computeBCA(c.bca.metrics, (c.patient && c.patient.sex) || '');
    if (bca && bca.score != null) {
      scoreCards.push({ label: 'Body Composition', value: `${bca.score}/${bca.max}`, sub: bca.band.label, tier: bca.band.tier });
      cards.push(iconCard('⚖️', 'Body Composition', bca.band.label, bca.band.tier));
    }
    // Blood
    if (c.blood && c.blood.values && Object.keys(c.blood.values).length) {
      const bf = S.bloodFlags(c.blood.values);
      const tier = bf.count === 0 ? 'green' : bf.count <= 2 ? 'yellow' : bf.count <= 4 ? 'orange' : 'red';
      scoreCards.push({ label: 'Blood Panel', value: `${bf.count} flag${bf.count === 1 ? '' : 's'}`, sub: bf.count ? 'Review' : 'Normal', tier });
      cards.push(iconCard('🩸', 'Blood Panel', bf.count ? `${bf.count} Flags` : 'Normal', tier));
    }
    // Mental
    if (c.wellbeing && Array.isArray(c.wellbeing.rows) && c.wellbeing.rows.length) {
      const worst = c.wellbeing.rows.reduce((w, r) => rankTier(r.tier) > rankTier(w) ? r.tier : w, 'green');
      cards.push(iconCard('🧠', 'Mental Wellbeing', S.TIER_LABEL[worst] || 'Assessed', worst));
    } else if ((c._pkg || '').match(/pkg3/)) {
      cards.push(iconCard('🧠', 'Mental Wellbeing', 'Not Tested', 'none'));
    }

    // Highlight the single worst movement finding as its own card (like the reference design)
    const worstMove = c.movement && c.movement.baseline && worstMovementFinding(c.movement.baseline);
    if (worstMove) cards.push(iconCard('⚠️', worstMove.label, worstMove.status, worstMove.tier));

    if (!cards.length && !scoreCards.length) return null;

    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('h1', { class: 'ov-title' }, 'Holistic Assessment — Overview'),
      el('p', { class: 'ov-sub' }, 'A single-page snapshot of every domain assessed in this report. Each score is explained in its own section on the following pages.'),
    ]);

    // Big score strip
    if (scoreCards.length) {
      const strip = el('div', { class: 'ov-scores' });
      scoreCards.forEach(s => strip.appendChild(el('div', { class: `ov-score ${s.tier}` }, [
        el('div', { class: 'ov-score-label' }, s.label),
        el('div', { class: 'ov-score-val' }, s.value),
        el('div', { class: 'ov-score-sub' }, s.sub || ''),
      ])));
      node.appendChild(strip);
    }

    // Icon cards grid
    const grid = el('div', { class: 'ov-grid' });
    cards.forEach(cd => grid.appendChild(cd));
    node.appendChild(grid);

    // Narrative
    node.appendChild(el('div', { class: 'subhead' }, 'How to Read This Report'));
    node.appendChild(el('p', { class: 'intro' },
      'Every measured parameter is graded on a four-tier scale. The colour and label indicate how far the value sits from the healthy reference range and what action it warrants.'));
    node.appendChild(statusKeyGrid());

    node.appendChild(pageFoot());
    return node;
  }
  function rankTier(t) { return { red: 4, orange: 3, yellow: 2, green: 1 }[t] || 0; }
  function worstMovementFinding(b) {
    // Prefer the highest bilateral asymmetry among neck/trunk.
    const cands = [];
    const push = (label, l, r) => {
      const a = window.TML_SCORING.asymmetryFromLR(l, r);
      if (a != null) cands.push({ label, a, tier: window.TML_SCORING.MOVEMENT_TESTS.asymmetryGeneric.score(a), status: a + '% asym' });
    };
    if (b.neck) { push('Neck Lateral Flexion', b.neck.lat_flex_left, b.neck.lat_flex_right); push('Neck Rotation', b.neck.rotation_left, b.neck.rotation_right); }
    if (b.trunk) { push('Trunk Lateral Flexion', b.trunk.lat_flex_left, b.trunk.lat_flex_right); push('Trunk Rotation', b.trunk.rotation_left, b.trunk.rotation_right); }
    cands.sort((x, y) => y.a - x.a);
    return cands[0] && (cands[0].tier === 'red' || cands[0].tier === 'orange') ? cands[0] : null;
  }
  function statusKeyGrid() {
    const key = el('div', { class: 'status-key' });
    (window.TML_SCORING.TIER_KEY).forEach(([t, lbl, desc]) => key.appendChild(el('div', { class: 'row' }, [
      el('span', { class: `swatch ${t}` }),
      el('div', {}, [el('div', { class: 'label' }, lbl), el('div', { class: 'desc' }, desc)]),
    ])));
    return key;
  }

  // ----- Per-domain Key Findings + Recommendations + Signature (template layout) -----
  function domainRxSignature(opts) {
    // opts: { num, title, findings:[], recs:[], role, cumulative:{scaled,max,band} }
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [opts.num ? el('span', { class: 'num' }, opts.num) : null, '  ' + opts.title]),
    ]);
    // Key Findings
    node.appendChild(el('div', { class: 'rx-title' }, 'Key Findings'));
    const kf = el('ul', { class: 'recs' });
    (opts.findings && opts.findings.length ? opts.findings : ['No significant findings recorded for this domain.'])
      .forEach(f => kf.appendChild(el('li', {}, f)));
    node.appendChild(kf);
    // Intervention / Programme
    node.appendChild(el('div', { class: 'rx-title' }, 'Intervention / Programme'));
    if (opts.recs && opts.recs.length) {
      const ul = el('ol', { class: 'recs' });
      opts.recs.forEach(r => ul.appendChild(el('li', {}, r)));
      node.appendChild(ul);
    } else {
      node.appendChild(el('p', { class: 'placeholder' }, '[To be completed by the practitioner]'));
    }
    // Follow-up
    node.appendChild(el('div', { class: 'rx-title' }, 'Follow-Up Plan & Review'));
    node.appendChild(el('p', { class: opts.followup ? '' : 'placeholder', style: 'font-size:9.5pt' },
      opts.followup || '[Re-assessment date, milestones and review triggers]'));
    // Signature
    node.appendChild(signatureBlock(opts.role));
    node.appendChild(pageFoot());
    return node;
  }
  function signatureBlock(role) {
    return el('div', { class: 'sig' }, [
      el('div', { class: 'sig-role' }, role || 'Practitioner Signature'),
      el('div', { class: 'sig-line' }, '________________________________________'),
      el('div', { class: 'sig-meta' }, [
        el('span', {}, '[Name & Designation]'),
        el('span', {}, 'Date: ____ / ____ / ________'),
      ]),
    ]);
  }

  // ----- Patient history & presenting complaints -----
  function renderHistory(c) {
    const h = c.history || {};
    const rows = [
      ['Presenting Complaints', h.complaints],
      ['History of Presenting Illness', h.hpi],
      ['Past Medical / Surgical History', h.pmh],
      ['Current Medications / Supplements', h.medications],
      ['Lifestyle & Occupation', h.lifestyle],
      ['Patient Goals', h.goals],
    ].filter(([, v]) => v && String(v).trim());
    if (!rows.length) return null;
    const tbody = el('tbody');
    rows.forEach(([k, v]) => tbody.appendChild(el('tr', {}, [
      el('td', { style: 'width: 32%; font-weight: 600; color: var(--tml-burgundy);' }, k),
      el('td', {}, v),
    ])));
    return el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '00'), '  PATIENT HISTORY & PRESENTING COMPLAINTS']),
      el('table', { class: 'r' }, tbody),
      pageFoot(),
    ]);
  }

  // ----- Prescriptions (Movement / Nutrition / Mental) + next steps -----
  function renderPrescriptions(c) {
    const blocks = [
      ['Movement Prescription',        (c.movement && c.movement.recs) || []],
      ['Nutrition Prescription',       (c.nutrition && c.nutrition.recs) || []],
      ['Mental Wellbeing Prescription',(c.wellbeing && c.wellbeing.recs) || []],
      ['Biomarker Follow-up',          (c.blood && c.blood.recs) || []],
    ].filter(([, arr]) => arr && arr.length);
    if (!blocks.length) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'PRESCRIPTIONS & NEXT STEPS'),
      el('p', { class: 'intro' }, 'Domain-specific recommendations from the TML clinical team. Follow alongside the findings in each section above.'),
    ]);
    blocks.forEach(([title, arr]) => {
      node.appendChild(el('div', { class: 'rx-block' }, [
        el('div', { class: 'rx-title' }, title),
        el('ol', { class: 'recs' }, arr.map(r => el('li', {}, r))),
      ]));
    });
    node.appendChild(pageFoot());
    return node;
  }

  window.TML_RENDER = { render, renderCover, renderBackground, renderSummary, renderMovement, renderMovementGallery, renderBCA, renderNutrition, renderWellbeing, renderBlood, renderIntegrated };
})();
