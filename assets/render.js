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
    if (!tier) return el('span', { class: 'muted' }, '—');
    const txt = label || ({ green: 'Normal', yellow: 'Mild', orange: 'Significant', red: 'Urgent' })[tier];
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
    const kv = [
      ['Report Date', p.endpoint_date || ''],
      ['Programme', p.programme || ''],
      ['Employee Name', p.name || ''],
      ['Age / Sex', `${p.age || ''} years  ·  ${p.sex || ''}`],
      ['Employee ID', p.employee_id || ''],
      ['Department', p.department || ''],
      ['Assessment — Baseline', p.baseline_date || ''],
      ['Assessment — End-Point', p.endpoint_date || ''],
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
      el('h2', {}, 'Employee Wellbeing Report'),
      el('div', { class: 'prepared' }, p.client ? `Prepared for ${p.client}` : ''),
      grid,
      pageFoot(p.client ? `Part of the ${p.programme || 'TML'} × ${p.client} cycle.` : ''),
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
      node.appendChild(el('div', { class: 'subhead' }, '1 · Balance Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Right (mm²)', 'Left (mm²)', 'Asymmetry', 'Status'],
        [['Single-Leg Balance (Eyes Closed) — COM 95% Ellipse Area',
          b.balance.right_mm2, b.balance.left_mm2, b.balance.asym_pct + '%',
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.balanceAsymmetry.score(b.balance.asym_pct))]]
      ));
    }

    // 2. Posture
    if (b.posture) {
      node.appendChild(el('div', { class: 'subhead' }, '2 · Posture Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Shoulder Drop (cm)', 'Status'],
        [['Static Posture Analysis (Frontal Plane)', b.posture.shoulder_drop_cm,
          statusPill(window.TML_SCORING.MOVEMENT_TESTS.shoulderDrop.score(b.posture.shoulder_drop_cm))]]
      ));
    }

    // 3. Neck ROM
    if (b.neck) {
      node.appendChild(el('div', { class: 'subhead' }, '3 · Neck Range of Motion'));
      const avgLat = (b.neck.lat_flex_right + b.neck.lat_flex_left) / 2;
      const avgRot = (b.neck.rotation_right + b.neck.rotation_left) / 2;
      node.appendChild(tableRows(
        ['Test', 'Right (°)', 'Left (°)', 'Reference', 'Asymmetry', 'Status'],
        [
          ['Neck Lateral Flexion', b.neck.lat_flex_right, b.neck.lat_flex_left, b.neck.lat_flex_ref, b.neck.lat_flex_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.neckLatFlex.score(avgLat))],
          ['Neck Rotation', b.neck.rotation_right, b.neck.rotation_left, b.neck.rotation_ref, b.neck.rotation_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.neckRotation.score(avgRot))],
        ]
      ));
    }

    // 4. Trunk ROM
    if (b.trunk) {
      node.appendChild(el('div', { class: 'subhead' }, '4 · Trunk Range of Motion'));
      const avgLat = (b.trunk.lat_flex_right + b.trunk.lat_flex_left) / 2;
      const avgRot = (b.trunk.rotation_right + b.trunk.rotation_left) / 2;
      node.appendChild(tableRows(
        ['Test', 'Right / Obs (°)', 'Left (°)', 'Reference (°)', 'Asymmetry', 'Status'],
        [
          ['Trunk Extension', b.trunk.extension, '—', b.trunk.extension_ref, '—',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.trunkExtension.score(b.trunk.extension))],
          ['Trunk Lateral Flexion', b.trunk.lat_flex_right, b.trunk.lat_flex_left, b.trunk.lat_flex_ref, b.trunk.lat_flex_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.trunkLatFlex.score(avgLat))],
          ['Trunk Rotation', b.trunk.rotation_right, b.trunk.rotation_left, b.trunk.rotation_ref, b.trunk.rotation_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.trunkRotation.score(avgRot))],
        ]
      ));
    }

    // 5. Dynamic
    if (b.dynamic) {
      node.appendChild(el('div', { class: 'subhead' }, '5 · Dynamic Lower-Body Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Right / Value', 'Left / —', 'Asymmetry / Unit', 'Status'],
        [
          ['Overhead Squat — Knee Flexion (Max)', b.dynamic.squat_right_deg + '°', b.dynamic.squat_left_deg + '°', b.dynamic.squat_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.squatAsymmetry.score(b.dynamic.squat_asym))],
          ['Sit-to-Stand × 5', b.dynamic.sit_to_stand_s + ' sec', '—', 'Duration',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.sitToStand.score(b.dynamic.sit_to_stand_s))],
          ['Countermovement Jump', b.dynamic.cmj_cm + ' cm', '—', 'Jump Height',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.countermovementJump.score(b.dynamic.cmj_cm))],
        ]
      ));
    }

    // 6. Strength
    if (b.strength) {
      node.appendChild(el('div', { class: 'subhead' }, '6 · Strength Assessment'));
      node.appendChild(tableRows(
        ['Test', 'Right (N)', 'Left (N)', 'Asymmetry', 'Status'],
        [
          ['Grip Strength', b.strength.grip_right_n, b.strength.grip_left_n, b.strength.grip_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.gripAsymmetry.score(b.strength.grip_asym))],
          ['Quadriceps Strength (Knee Extension)', b.strength.quad_right_n, b.strength.quad_left_n, b.strength.quad_asym + '%',
            statusPill(window.TML_SCORING.MOVEMENT_TESTS.quadAsymmetry.score(b.strength.quad_asym))],
        ]
      ));
    }

    // 7. Questionnaire (compact)
    if (b.questionnaire && window.TML_SCORING.MOVEMENT_QUESTIONNAIRE) {
      node.appendChild(el('div', { class: 'subhead' }, '7 · Subjective Assessment'));
      const ths = ['S.No.', 'Question', 'Always', 'More Freq.', 'Rarely', 'Never', 'Score'];
      const rows = window.TML_SCORING.MOVEMENT_QUESTIONNAIRE.map((q, i) => {
        const a = (b.questionnaire || [])[i] || {};
        const tick = (key) => a.answer === key ? '✓' : '';
        return [
          q.id,
          q.q,
          el('td', { class: 'center' }, tick('always')),
          el('td', { class: 'center' }, tick('more_freq')),
          el('td', { class: 'center' }, tick('rarely')),
          el('td', { class: 'center' }, tick('never')),
          el('td', { class: 'center', style: 'font-weight:600' }, a.score || ''),
        ];
      });
      node.appendChild(tableRowsRaw(ths, rows));
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 8.5pt; margin-top:4px;' },
        'Scoring:  Always — 1   More Frequently — 2   Rarely — 3   Never — 4'));
    }

    // Composite
    if (b.composite) {
      const tier = b.composite.tier;
      node.appendChild(el('div', { class: 'composite' }, [
        el('div', {}, [
          el('div', { class: 'score-label' }, 'Total Score'),
          el('div', { class: 'score-num' }, [String(b.composite.scaled), el('small', {}, ' / 100')]),
          el('div', { class: 'verdict-band', style: `background: var(--st-${tier}-bg); color: var(--st-${tier})` }, b.composite.label),
        ]),
        el('div', {}, [
          el('div', { class: 'subhead', style: 'margin-top:0' }, 'Scoring Reference'),
          el('p', { class: 'muted', style: 'font-size: 9pt; margin:4px 0' },
            '12 movement tests + 12 questionnaire items = 24 components. Maximum: 24 × 4 = 96. Each component is scored Red 1, Orange 2, Yellow 3, Green 4 and summed (presented out of 100).'),
          el('div', { class: 'band-table' }, [
            el('div', { class: 'head' }, 'Range'), el('div', { class: 'head' }, 'Band'), el('div', { class: 'head' }, 'Interpretation'), el('div', { class: 'head' }, 'Programme'),
            el('div', {}, '25–50'), el('div', { style:'color:var(--st-red);font-weight:600' }, 'Urgent Intervention'), el('div', {}, 'Poor mobility & function. At risk of worsening symptoms or injury.'), el('div', {}, 'MANDATORY'),
            el('div', {}, '51–75'), el('div', { style:'color:var(--st-orange);font-weight:600' }, 'Significant Issue'), el('div', {}, 'Early functional limitations. Symptoms increasing with work duration.'), el('div', {}, 'STRONGLY RECOMMENDED'),
            el('div', {}, '76–100'), el('div', { style:'color:var(--st-green);font-weight:600' }, 'Normal'), el('div', {}, 'Good mobility & function. No major work limitations.'), el('div', {}, 'OPTIONAL / ENCOURAGED'),
          ]),
        ]),
      ]));
    }
    node.appendChild(pageFoot());

    // Endpoint comparison + recommendations on a second page
    const node2 = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, 'MOVEMENT — BASELINE vs END-POINT COMPARISON'),
      el('p', { class: 'intro' }, 'End-point measurements taken after the 12-week Thrive cycle.'),
    ]);
    if (m.endpoint) {
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

  // ----- Nutrition -----
  function renderNutrition(c) {
    const n = c.nutrition || {};
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '02'), '  NUTRITIONAL STATUS']),
      el('p', { class: 'intro' }, 'Nutritional parameters were assessed through a structured dietary-intake review, body-composition analysis and metabolic screening conducted by the TML nutritionist.'),
    ]);
    if (n.body_comp) {
      node.appendChild(el('div', { class: 'subhead' }, 'Body Composition & Metabolic Markers'));
      const rows = n.body_comp.map(r => [r.param, r.baseline, r.endpoint, r.delta, statusPill(r.tier)]);
      node.appendChild(tableRows(['Parameter', 'Baseline', 'End-Point', 'Δ Change', 'Status'], rows));
    }
    if (n.nutrimeter_baseline) {
      const b = n.nutrimeter_baseline;
      node.appendChild(el('div', { class: 'subhead' }, 'TML Nutri Meter — Performance & Wellness Check'));
      node.appendChild(el('p', { class: 'muted', style: 'font-size: 9pt' },
        'The Nutri Meter identifies the frequency of symptoms that indicate poor nutritional status. Scoring is the sum of all responses (range 10–50).'));
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
            el('div', {}, '10–20'), el('div', { style:'color:var(--st-green);font-weight:600' }, 'Optimal'), el('div', {}, 'Patterns support energy, focus and recovery.'), el('div', {}, 'Preventive guidance.'),
            el('div', {}, '21–35'), el('div', { style:'color:var(--st-yellow);font-weight:600' }, 'Compromised'), el('div', {}, 'Subtle signs nutrition is affecting performance.'), el('div', {}, 'Early intervention.'),
            el('div', {}, '36–50'), el('div', { style:'color:var(--st-red);font-weight:600' }, 'Impaired'), el('div', {}, 'Affecting recovery, mental clarity and day-to-day performance.'), el('div', {}, '1:1 clinical consultation.'),
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
    const node = el('div', { class: 'page' }, [
      brandBand(),
      el('div', { class: 'section-bar' }, [el('span', { class: 'num' }, '05'), '  INTEGRATED SUMMARY & NEXT STEPS']),
      el('p', { class: 'intro' }, 'The following summary draws together observations across all domains. Where parameters intersect — e.g. stress impacting sleep impacting physical recovery, or weight loss impacting joint loading and metabolic markers — these connections are noted here.'),
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
    const include = opts.include || ['cover', 'background', 'summary', 'movement', 'nutrition', 'wellbeing', 'blood', 'integrated'];
    if (include.includes('cover'))      host.appendChild(renderCover(caseData));
    if (include.includes('background')) host.appendChild(renderBackground(caseData));
    if (include.includes('summary'))    host.appendChild(renderSummary(caseData));
    if (include.includes('movement'))   renderMovement(caseData).forEach(p => host.appendChild(p));
    if (include.includes('nutrition'))  host.appendChild(renderNutrition(caseData));
    if (include.includes('wellbeing'))  host.appendChild(renderWellbeing(caseData));
    if (include.includes('blood') && caseData.blood)     host.appendChild(renderBlood(caseData));
    if (include.includes('integrated')) host.appendChild(renderIntegrated(caseData));
  }

  window.TML_RENDER = { render, renderCover, renderBackground, renderSummary, renderMovement, renderNutrition, renderWellbeing, renderBlood, renderIntegrated };
})();
