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
    const p = c.patient || {};
    const dash = (v) => (v && String(v).trim()) ? v : '—';
    const ageSex = [p.age ? `${p.age} years` : null, p.sex || null].filter(Boolean).join('  ·  ') || '—';
    const kv = [
      ['Report Date',         dash(p.endpoint_date)],
      ['Programme',           dash(p.programme)],
      ['Patient Name',        dash(p.name)],
      ['Age / Sex',           ageSex],
      ['Patient ID',          dash(p.patient_id || p.employee_id)],
      ['Assessment Date',     dash(p.endpoint_date)],
      ['Referring Physician', dash(p.referring_physician)],
      ['Reviewed by',         dash(p.authored_by)],
    ];
    const grid = el('div', { class: 'kv-grid' });
    kv.forEach(([k, v]) => {
      grid.appendChild(el('div', { class: 'k' }, k));
      grid.appendChild(el('div', { class: 'v' }, v));
    });
    const team = p.clinical_team
      ? el('div', { style: 'grid-column: 1 / -1; margin-top: 8px;' }, [
          el('div', { class: 'k' }, 'Clinical Team'),
          el('div', { class: 'v' }, p.clinical_team),
        ])
      : null;
    if (team) grid.appendChild(team);

    return el('div', { class: 'page cover' }, [
      brandBand(),
      el('h1', {}, ['THE MOVEMENT LAB', el('span', { class: 'sub' }, 'Lifestyle, Realigned.')]),
      el('h2', {}, 'Patient Wellness Report'),
      el('div', { class: 'prepared' }, p.programme || ''),
      grid,
      pageFoot(),
    ]);
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
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '01'), '  MOVEMENT HEALTH']),
      el('p', { class: 'intro' }, 'Movement parameters were assessed using the HumanTrak 3D motion capture system. All measurements are standardised and comparable across assessment cycles.'),
      el('div', { class: 'subhead' }, 'Baseline — Movement Analysis Report'),
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

    // Composite — computed from movement tests only (questionnaire removed per clinical request).
    if (b.composite) {
      const tier = b.composite.tier;
      node.appendChild(el('div', { class: 'composite' }, [
        el('div', {}, [
          el('div', { class: 'score-label' }, 'Movement Score'),
          el('div', { class: 'score-num' }, [String(b.composite.scaled), el('small', {}, ' / 100')]),
          el('div', { class: 'verdict-band', style: `background: var(--st-${tier}-bg); color: var(--st-${tier})` }, b.composite.label),
        ]),
        el('div', {}, [
          el('div', { class: 'subhead', style: 'margin-top:0' }, 'Scoring Reference'),
          el('p', { class: 'muted', style: 'font-size: 9pt; margin:4px 0' },
            `Composite of ${b.composite.n || 'all measured'} movement tests. Each test is scored Red 1, Orange 2, Yellow 3, Green 4 and the sum is presented out of 100.`),
          el('div', { class: 'band-table' }, [
            el('div', { class: 'head' }, 'Range'), el('div', { class: 'head' }, 'Band'), el('div', { class: 'head' }, 'Interpretation'), el('div', { class: 'head' }, 'Action'),
            el('div', {}, '25–50'), el('div', { style:'color:var(--st-red);font-weight:600' }, 'Urgent Intervention'), el('div', {}, 'Poor mobility & function. At risk of worsening symptoms or injury.'), el('div', {}, 'MANDATORY'),
            el('div', {}, '51–75'), el('div', { style:'color:var(--st-orange);font-weight:600' }, 'Significant Issue'), el('div', {}, 'Early functional limitations.'), el('div', {}, 'STRONGLY RECOMMENDED'),
            el('div', {}, '76–100'), el('div', { style:'color:var(--st-green);font-weight:600' }, 'Normal'), el('div', {}, 'Good mobility & function.'), el('div', {}, 'MAINTAIN / ENCOURAGE'),
          ]),
        ]),
      ]));
    }
    node.appendChild(pageFoot());

    // Endpoint comparison + recommendations on a second page (omit if no endpoint data)
    if (!m.endpoint && !(m.recs && m.recs.length)) return [node];

    const node2 = el('div', { class: 'page' }, [brandBand()]);
    if (m.endpoint) {
      node2.appendChild(el('div', { class: 'section-bar' }, 'MOVEMENT — BASELINE vs END-POINT COMPARISON'));
      node2.appendChild(el('p', { class: 'intro' }, 'End-point measurements taken after the programme cycle.'));
      const rows = Object.entries(m.endpoint).map(([k, v]) => [
        prettyKey(k), v.baseline, v.endpoint, v.delta, statusPill(v.tier),
      ]);
      node2.appendChild(tableRowsRaw(
        ['Parameter', 'Baseline', 'End-Point', 'Δ Change', 'Status'],
        rows.map(r => r.map((cell, i) => i === 4 ? el('td', {}, cell) : cell))
      ));
    }
    if (m.recs && m.recs.length) {
      node2.appendChild(el('div', { class: 'section-bar' }, 'RECOMMENDATIONS — MOVEMENT'));
      const ul = el('ol', { class: 'recs' });
      m.recs.forEach(r => ul.appendChild(el('li', {}, r)));
      node2.appendChild(ul);
    }
    node2.appendChild(pageFoot());

    return [node, node2];
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
      const sex = (c.patient && c.patient.sex || '').toLowerCase();
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const byName = {};
      b.metrics.forEach(m => { byName[norm(m.metric)] = m.value_num; });
      const pick = (...keys) => { for (const k of keys) { const v = byName[norm(k)]; if (v != null && !isNaN(v)) return v; } return null; };

      // Derive the seven scored parameters.
      const weight   = pick('weight');
      const leanMass = pick('lean mass');
      const smm      = pick('skeletal muscle mass');
      const proteinPct = (leanMass != null && weight) ? +(((leanMass * 0.20) / weight) * 100).toFixed(1) : null;
      const values = {
        bmi:                  pick('body mass index bmi', 'bmi'),
        body_fat_pct:         pick('fat percentage', 'body fat percentage'),
        skeletal_muscle_mass: smm,
        skeletal_muscle_pct:  pick('skeletal muscle percentage'),
        protein_pct:          proteinPct,
        lean_mass_pct:        pick('lean mass percentage'),
        water_pct:            pick('water percentage', 'total body water percentage'),
      };
      // Score each; SMM(kg) scored via its %-of-weight proxy against the muscle-% band.
      const smmPct = (smm != null && weight) ? +((smm / weight) * 100).toFixed(1) : null;
      const smPctScorer = S.BCA_PARAMS.find(p => p.key === 'skeletal_muscle_pct').score;

      let points = 0, counted = 0;
      const rows = S.BCA_PARAMS.map(p => {
        const v = values[p.key];
        let tier = p.key === 'skeletal_muscle_mass' ? smPctScorer(smmPct, sex) : p.score(v, sex);
        if (tier) { points += S.tierToPoints(tier); counted++; }
        const shownVal = v == null ? '—' : (p.key === 'skeletal_muscle_mass' && smmPct != null ? `${v} (${smmPct}%)` : String(v));
        return [p.label, shownVal, p.unit, statusPill(tier)];
      });

      const scaled28 = counted ? Math.round((points / (counted * 4)) * S.BCA_MAX) : null;
      const band = S.bcaBand(scaled28, S.BCA_MAX);

      node.appendChild(el('div', { class: 'subhead' }, 'Body Composition — Scored Parameters'));
      node.appendChild(tableRows(['Parameter', 'Value', 'Unit', 'Status'], rows));

      if (scaled28 != null && band) {
        b._bcaScore = { score: scaled28, max: S.BCA_MAX, tier: band.tier, label: band.label }; // for overview
        node.appendChild(el('div', { class: 'composite', style: 'margin-top:12px' }, [
          el('div', {}, [
            el('div', { class: 'score-label' }, 'BCA Score'),
            el('div', { class: 'score-num' }, [String(scaled28), el('small', {}, ' / ' + S.BCA_MAX)]),
            el('div', { class: 'verdict-band', style: `background: var(--st-${band.tier}-bg); color: var(--st-${band.tier})` }, band.label),
          ]),
          el('div', {}, [
            el('div', { class: 'subhead', style: 'margin-top:0' }, 'How this is scored' ),
            el('p', { class: 'muted', style: 'font-size: 9pt; margin:4px 0' },
              'Seven body-composition parameters are each scored 1–4 (Red 1 → Green 4) for a maximum of 28 points. This BCA score combines with the nutrition questionnaire toward the overall Nutrition score (out of 100).'),
          ]),
        ]));
      }
    }
    node.appendChild(pageFoot());
    return node;
  }

  // ----- Nutrition -----
  function renderNutrition(c) {
    const n = c.nutrition || {};
    // Body composition now lives in the BCA section (scored /28); nutrition owns the
    // symptom questionnaire + recommendations.
    const hasNutri    = n.nutrimeter_baseline && n.nutrimeter_baseline.total > 0;
    const hasRecs     = Array.isArray(n.recs) && n.recs.length > 0;
    if (!hasNutri && !hasRecs) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '02'), '  NUTRITIONAL STATUS']),
      el('p', { class: 'intro' }, 'Nutritional status assessed through a structured dietary-symptom questionnaire and body-composition analysis conducted by the TML nutritionist.'),
    ]);
    if (n.nutrimeter_baseline) {
      const b = n.nutrimeter_baseline;
      node.appendChild(el('div', { class: 'subhead' }, 'TML Nutri Meter — Performance & Wellness Check'));
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 9pt' },
        'The TML Nutrition Screen captures the frequency of symptoms tied to nutritional status. Scoring is the sum of all responses (range 8–40).'));
      // table of questions
      const ths = ['Question (past 3 months — frequency)', 'Never (1)', 'Rarely (2)', 'Sometimes (3)', 'Often (4)', 'Always (5)'];
      const rows = window.TML_SCORING.NUTRI_METER_QUESTIONS.map((q, i) => {
        const resp = (n.nutrimeter_responses || [])[i];
        return [
          q,
          el('td', { class: 'center' }, resp === 1 ? '✓' : ''),
          el('td', { class: 'center' }, resp === 2 ? '✓' : ''),
          el('td', { class: 'center' }, resp === 3 ? '✓' : ''),
          el('td', { class: 'center' }, resp === 4 ? '✓' : ''),
          el('td', { class: 'center' }, resp === 5 ? '✓' : ''),
        ];
      });
      node.appendChild(tableRowsRaw(ths, rows));

      node.appendChild(el('div', { class: 'composite' }, [
        el('div', {}, [
          el('div', { class: 'score-label' }, 'Nutri Meter Score — Baseline'),
          el('div', { class: 'score-num' }, [String(b.total), el('small', {}, ' / ' + b.max)]),
          el('div', { class: 'verdict-band', style: `background: var(--st-${b.tier}-bg); color: var(--st-${b.tier})` }, b.label),
        ]),
        el('div', {}, [
          el('div', { class: 'subhead', style: 'margin-top:0' }, 'Nutri Meter Wellness Profile'),
          el('div', { class: 'band-table' }, [
            el('div', { class: 'head' }, 'Range'), el('div', { class: 'head' }, 'Band'), el('div', { class: 'head' }, 'Interpretation'), el('div', { class: 'head' }, 'Support'),
            el('div', {}, '8–16'),  el('div', { style:'color:var(--st-green);font-weight:600' }, 'Optimal'),     el('div', {}, 'Habits aligned with good wellbeing.'), el('div', {}, 'Preventive guidance.'),
            el('div', {}, '17–28'), el('div', { style:'color:var(--st-yellow);font-weight:600' }, 'Compromised'), el('div', {}, 'Subtle nutrition-related symptoms.'), el('div', {}, 'Targeted support.'),
            el('div', {}, '29–40'), el('div', { style:'color:var(--st-red);font-weight:600' }, 'Impaired'),     el('div', {}, 'Symptom cluster suggesting impaired nourishment.'), el('div', {}, '1:1 nutritionist consultation.'),
          ]),
        ]),
      ]));
    }
    if (n.recs) {
      node.appendChild(el('div', { class: 'section-bar' }, 'RECOMMENDATIONS — NUTRITION'));
      const ul = el('ol', { class: 'recs' });
      n.recs.forEach(r => ul.appendChild(el('li', {}, r)));
      node.appendChild(ul);
    }
    node.appendChild(pageFoot());
    return node;
  }

  // ----- Wellbeing -----
  function renderWellbeing(c) {
    const w = c.wellbeing || {};
    const hasRows = Array.isArray(w.rows) && w.rows.length > 0;
    const hasRecs = Array.isArray(w.recs) && w.recs.length > 0;
    if (!hasRows && !hasRecs) return null;
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '03'), '  MENTAL WELLBEING']),
      el('p', { class: 'intro' }, "Mental wellbeing was screened using two validated tools: the Perceived Stress Scale (PSS-10) for stress-load and the Pittsburgh Sleep Quality Index (PSQI) for sleep architecture. All data is handled in accordance with TML's data privacy policy."),
    ]);
    if (w.rows) {
      const rows = w.rows.map(r => [r.param, r.baseline, r.endpoint, r.delta, statusPill(r.tier)]);
      node.appendChild(tableRows(['Parameter', 'Baseline', 'End-Point', 'Δ Change', 'Status'], rows));
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
    if (w.recs) {
      node.appendChild(el('div', { class: 'section-bar' }, 'RECOMMENDATIONS — MENTAL WELLBEING'));
      const ul = el('ol', { class: 'recs' });
      w.recs.forEach(r => ul.appendChild(el('li', {}, r)));
      node.appendChild(ul);
    }
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
    if (b.recs && b.recs.length) {
      node.appendChild(el('div', { class: 'section-bar' }, 'RECOMMENDATIONS — BIOMARKERS'));
      const ul = el('ol', { class: 'recs' });
      b.recs.forEach(r => ul.appendChild(el('li', {}, r)));
      node.appendChild(ul);
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
      history:         () => renderBackground(caseData),          // alias until dedicated history lands
      summary:         () => renderSummary(caseData),
      movement:        () => renderMovement(caseData),
      movement_images: () => renderMovementGallery(caseData),
      bca:             () => caseData.bca ? renderBCA(caseData) : null,
      blood:           () => caseData.blood ? renderBlood(caseData) : null,
      nutrition:       () => renderNutrition(caseData),
      wellbeing:       () => renderWellbeing(caseData),
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

  // Placeholder renderers wired later (P2) — return null so includes referencing
  // them are safely skipped until implemented.
  function renderOverview() { return null; }
  function renderPrescriptions() { return null; }

  window.TML_RENDER = { render, renderCover, renderBackground, renderSummary, renderMovement, renderMovementGallery, renderBCA, renderNutrition, renderWellbeing, renderBlood, renderIntegrated };
})();
