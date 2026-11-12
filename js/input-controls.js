/**
 * KinSprout 2.0 — Sophisticated Input Controls, Quick-Log Composer, Inline Editor,
 * N-Child Form Repeater & CRDT-Safe Undo Manager (input-controls.js)
 *
 * Exclusively owned by Worker W3 (`flash-inputs`).
 * Dual UMD (window.InputControls + module.exports).
 * Zero online/offline gating.
 * Invariant #5: Every gestational week input uses type="number" min="22" max="44" step="0.5".
 * Invariant #3: Mirror headCm and headCircumferenceCm; stamp updatedAt: Date.now();
 *               CRDT Undo strips tombstonedIds on restore or adds createdIds on undo-add.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InputControls = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Safe peer module resolution (window or require)
  const GrowthEngine = (typeof window !== 'undefined' && window.GrowthEngine) ||
    (typeof require === 'function' ? (function () {
      try { return require('./growth-engine.js'); } catch (e) { return null; }
    })() : null);

  // Constants
  const CHILD_PALETTE = ['#C85A32', '#2E6F5E', '#2563EB', '#7C3AED', '#D97706', '#DB2777'];

  const AAP_PRESET_SCHEDULE = [
    { key: 'birth', label: 'Birth', months: 0, visitType: 'birth' },
    { key: '1m', label: '1m Checkup', months: 1, visitType: 'well-child' },
    { key: '2m', label: '2m Checkup', months: 2, visitType: 'well-child' },
    { key: '4m', label: '4m Checkup', months: 4, visitType: 'well-child' },
    { key: '6m', label: '6m Checkup', months: 6, visitType: 'well-child' },
    { key: '9m', label: '9m Checkup', months: 9, visitType: 'well-child' },
    { key: '12m', label: '12m Checkup', months: 12, visitType: 'well-child' },
    { key: '15m', label: '15m Checkup', months: 15, visitType: 'well-child' },
    { key: '18m', label: '18m Checkup', months: 18, visitType: 'well-child' },
    { key: '24m', label: '24m Checkup', months: 24, visitType: 'well-child' },
    { key: '30m', label: '30m Checkup', months: 30, visitType: 'well-child' },
    { key: '3y', label: '3y Checkup', months: 36, visitType: 'well-child' },
    { key: '4y', label: '4y Checkup', months: 48, visitType: 'well-child' },
    { key: '5y', label: '5y Checkup', months: 60, visitType: 'well-child' }
  ];

  // Comprehensive 24+ CDC milestone catalog fallback
  const CDC_MILESTONES = [
    // 2 Months
    { key: 'cdc-2m-smile', title: 'Smiles when you talk or smile', category: 'language-social', targetAgeMonths: 2, description: 'Calms down when spoken to or picked up, smiles in response' },
    { key: 'cdc-2m-track', title: 'Tracks face & moves head', category: 'language-social', targetAgeMonths: 2, description: 'Watches you as you move, looks at your face' },
    { key: 'cdc-2m-head-up', title: 'Holds head up on tummy', category: 'gross-motor', targetAgeMonths: 2, description: 'Lifts head briefly when lying on tummy' },
    { key: 'cdc-2m-hands-open', title: 'Opens hands briefly', category: 'fine-motor', targetAgeMonths: 2, description: 'Does not keep hands in tight fists all the time' },

    // 4 Months
    { key: 'cdc-4m-laugh', title: 'Chuckles or laughs aloud', category: 'language-social', targetAgeMonths: 4, description: 'Makes sounds back when talked to, laughs spontaneously' },
    { key: 'cdc-4m-head-steady', title: 'Holds head steady unsupported', category: 'gross-motor', targetAgeMonths: 4, description: 'Holds head steady without support when being held' },
    { key: 'cdc-4m-roll-tummy', title: 'Pushes up on elbows on tummy', category: 'gross-motor', targetAgeMonths: 4, description: 'Pushes up on forearms when on tummy' },
    { key: 'cdc-4m-hands-mouth', title: 'Brings hands to mouth', category: 'fine-motor', targetAgeMonths: 4, description: 'Reaches for toy, brings hands to mouth' },

    // 6 Months
    { key: 'cdc-6m-roll-both', title: 'Rolls from tummy to back', category: 'gross-motor', targetAgeMonths: 6, description: 'Rolls over in both directions' },
    { key: 'cdc-6m-sit-support', title: 'Sits with brief support', category: 'gross-motor', targetAgeMonths: 6, description: 'Sits propped up with hands or brief support' },
    { key: 'cdc-6m-transfer-obj', title: 'Transfers toy from hand to hand', category: 'fine-motor', targetAgeMonths: 6, description: 'Passes a toy from one hand to the other' },
    { key: 'cdc-6m-squeal', title: 'Blows raspberries & squeals', category: 'language-social', targetAgeMonths: 6, description: 'Makes joyful vocal sounds and blows raspberries' },

    // 9 Months
    { key: 'cdc-9m-sit-alone', title: 'Sits without support', category: 'gross-motor', targetAgeMonths: 9, description: 'Sits steadily on floor without adult or cushion support' },
    { key: 'cdc-9m-pincer', title: 'Uses 2-finger pincer grasp', category: 'fine-motor', targetAgeMonths: 9, description: 'Picks up small objects using thumb and index finger' },
    { key: 'cdc-9m-peekaboo', title: 'Plays peek-a-boo', category: 'cognitive', targetAgeMonths: 9, description: 'Reacts, laughs, and looks when you play peek-a-boo' },
    { key: 'cdc-9m-babbles', title: 'Babbles "mama/baba/dada"', category: 'language-social', targetAgeMonths: 9, description: 'Strings consonant sounds together repeatedly' },

    // 12 Months
    { key: 'cdc-12m-stand-pull', title: 'Pulls up to stand', category: 'gross-motor', targetAgeMonths: 12, description: 'Pulls up on furniture and cruises along edges' },
    { key: 'cdc-12m-wave-bye', title: 'Waves "bye-bye"', category: 'language-social', targetAgeMonths: 12, description: 'Waves hello or bye-bye with open hand' },
    { key: 'cdc-12m-first-word', title: 'Says 1-2 specific words', category: 'language-social', targetAgeMonths: 12, description: 'Calls at least one parent "mama" or "dada" specifically' },
    { key: 'cdc-12m-cup-drink', title: 'Drinks from cup with help', category: 'cognitive', targetAgeMonths: 12, description: 'Sips from open cup or straw cup when held' },

    // 15 Months
    { key: 'cdc-15m-walk-indep', title: 'Takes independent steps', category: 'gross-motor', targetAgeMonths: 15, description: 'Walks a few steps without holding onto anything' },
    { key: 'cdc-15m-stack-blocks', title: 'Stacks 2 small blocks', category: 'fine-motor', targetAgeMonths: 15, description: 'Balances two small blocks or objects on top of each other' },
    { key: 'cdc-15m-point-ask', title: 'Points to show you something', category: 'language-social', targetAgeMonths: 15, description: 'Points index finger to ask for or point out an object' },

    // 18 Months
    { key: 'cdc-18m-walk-alone', title: 'Walks independently & runs', category: 'gross-motor', targetAgeMonths: 18, description: 'Walks confidently without support and begins to run' },
    { key: 'cdc-18m-scribble', title: 'Scribbles with crayon', category: 'fine-motor', targetAgeMonths: 18, description: 'Grasps crayon and marks paper' },
    { key: 'cdc-18m-words-3plus', title: 'Uses 3 or more spoken words', category: 'language-social', targetAgeMonths: 18, description: 'Says several meaningful words besides mama/dada' },
    { key: 'cdc-18m-spoon-feed', title: 'Feeds self with spoon', category: 'cognitive', targetAgeMonths: 18, description: 'Scoops food with spoon with some spills' },

    // 24 Months
    { key: 'cdc-24m-two-words', title: 'Says 2-word phrases ("more milk")', category: 'language-social', targetAgeMonths: 24, description: 'Combines at least two words into meaningful phrases' },
    { key: 'cdc-24m-kick-ball', title: 'Kicks a ball forward', category: 'gross-motor', targetAgeMonths: 24, description: 'Swings foot forward to kick a stationary ball' },
    { key: 'cdc-24m-stairs-feet', title: 'Climbs stairs two feet per step', category: 'gross-motor', targetAgeMonths: 24, description: 'Steps up stairs holding a hand or rail' },
    { key: 'cdc-24m-tower-blocks', title: 'Builds tower of 4+ blocks', category: 'fine-motor', targetAgeMonths: 24, description: 'Stacks four or more blocks without toppling' },

    // 36 Months (3 Years)
    { key: 'cdc-36m-tricycle', title: 'Pedals tricycle or balance bike', category: 'gross-motor', targetAgeMonths: 36, description: 'Pedals a 3-wheel tricycle or glides on balance bike' },
    { key: 'cdc-36m-conversation', title: 'Asks "who/what/where/why"', category: 'language-social', targetAgeMonths: 36, description: 'Speaks in 3-4 word sentences in back-and-forth dialogue' },
    { key: 'cdc-36m-circle', title: 'Draws a circle', category: 'fine-motor', targetAgeMonths: 36, description: 'Copies a rough circle when shown' },

    // 48 Months (4 Years)
    { key: 'cdc-48m-hop-foot', title: 'Hops on one foot', category: 'gross-motor', targetAgeMonths: 48, description: 'Hops forward on one foot without losing balance' },
    { key: 'cdc-48m-catch-ball', title: 'Catches a bounced ball', category: 'gross-motor', targetAgeMonths: 48, description: 'Catches large bounced ball most of the time' },
    { key: 'cdc-48m-story-tell', title: 'Tells simple stories from memory', category: 'language-social', targetAgeMonths: 48, description: 'Relates events from daycare or a book clearly' },

    // 60 Months (5 Years)
    { key: 'cdc-60m-skip', title: 'Skips and stands on 1 foot 10s', category: 'gross-motor', targetAgeMonths: 60, description: 'Maintains balance on one foot for 10 seconds, skips' },
    { key: 'cdc-60m-write-letters', title: 'Prints own name & letters', category: 'fine-motor', targetAgeMonths: 60, description: 'Writes first name or recognized alphabet letters' },
    { key: 'cdc-60m-tie-button', title: 'Buttons buttons & zips jacket', category: 'fine-motor', targetAgeMonths: 60, description: 'Fastens buttons and pulls up zippers independently' }
  ];

  // =========================================================================
  // 1. SMART DUAL-UNIT PARSERS & FORMATTERS
  // =========================================================================

  /**
   * Parse flexible height/length input in cm or imperial ft/in/totalInches into cm.
   * Returns rounded number (2 decimal places) or null if invalid/empty.
   */
  function parseFlexibleLengthCm(inputs) {
    if (!inputs || typeof inputs !== 'object') return null;
    const { cm, ft, inches, totalInches } = inputs;

    // Direct cm
    if (cm !== undefined && cm !== null && cm !== '') {
      const num = Number(cm);
      if (!isNaN(num) && num > 0) {
        return Math.round(num * 100) / 100;
      }
    }

    // Direct total inches
    if (totalInches !== undefined && totalInches !== null && totalInches !== '') {
      const tIn = Number(totalInches);
      if (!isNaN(tIn) && tIn > 0) {
        return Math.round(tIn * 2.54 * 100) / 100;
      }
    }

    // Split ft + inches
    const hasFt = ft !== undefined && ft !== null && ft !== '';
    const hasIn = inches !== undefined && inches !== null && inches !== '';
    if (hasFt || hasIn) {
      const ftNum = hasFt ? Number(ft) : 0;
      const inNum = hasIn ? Number(inches) : 0;
      if (!isNaN(ftNum) && !isNaN(inNum) && (ftNum > 0 || inNum > 0)) {
        const total = ftNum * 12 + inNum;
        return Math.round(total * 2.54 * 100) / 100;
      }
    }

    return null;
  }

  /**
   * Format cm into dual metric/imperial presentation object.
   */
  function formatLengthDual(cm) {
    if (cm === null || cm === undefined || cm === '' || isNaN(Number(cm))) return null;
    const num = Number(cm);
    if (num <= 0) return null;

    const cmRound = Math.round(num * 10) / 10;
    const totalInches = Math.round((num / 2.54) * 10) / 10;
    let ft = Math.floor(totalInches / 12);
    let inches = Math.round((totalInches % 12) * 10) / 10;
    if (inches >= 12) {
      ft += 1;
      inches = 0;
    }

    return {
      cm: cmRound,
      ft,
      inches,
      totalInches,
      labelMetric: `${cmRound} cm`,
      labelImperial: `${ft}' ${inches}" (${totalInches} in)`
    };
  }

  /**
   * Parse flexible weight input in kg or imperial lb/oz/totalLb into kg.
   * Returns rounded number (3 decimal places) or null if invalid/empty.
   */
  function parseFlexibleWeightKg(inputs) {
    if (!inputs || typeof inputs !== 'object') return null;
    const { kg, lb, oz, totalLb } = inputs;

    // Direct kg
    if (kg !== undefined && kg !== null && kg !== '') {
      const num = Number(kg);
      if (!isNaN(num) && num > 0) {
        return Math.round(num * 1000) / 1000;
      }
    }

    // Direct total lb
    if (totalLb !== undefined && totalLb !== null && totalLb !== '') {
      const tLb = Number(totalLb);
      if (!isNaN(tLb) && tLb > 0) {
        return Math.round((tLb / 2.20462262) * 1000) / 1000;
      }
    }

    // Split lb + oz
    const hasLb = lb !== undefined && lb !== null && lb !== '';
    const hasOz = oz !== undefined && oz !== null && oz !== '';
    if (hasLb || hasOz) {
      const lbNum = hasLb ? Number(lb) : 0;
      const ozNum = hasOz ? Number(oz) : 0;
      if (!isNaN(lbNum) && !isNaN(ozNum) && (lbNum > 0 || ozNum > 0)) {
        const totalPounds = lbNum + (ozNum / 16);
        return Math.round((totalPounds / 2.20462262) * 1000) / 1000;
      }
    }

    return null;
  }

  /**
   * Format kg into dual metric/imperial presentation object.
   */
  function formatWeightDual(kg) {
    if (kg === null || kg === undefined || kg === '' || isNaN(Number(kg))) return null;
    const num = Number(kg);
    if (num <= 0) return null;

    const kgRound = Math.round(num * 100) / 100;
    const totalLb = Math.round(num * 2.20462262 * 100) / 100;
    let lb = Math.floor(totalLb);
    let oz = Math.round((totalLb - lb) * 16 * 10) / 10;
    if (oz >= 16) {
      lb += 1;
      oz = 0;
    }

    return {
      kg: Math.round(num * 1000) / 1000,
      lb,
      oz,
      totalLb,
      labelMetric: `${kgRound} kg`,
      labelImperial: `${lb} lb ${oz} oz`
    };
  }

  /**
   * Parse flexible head circumference in cm or inches into cm.
   * Returns rounded number (2 decimal places) or null if invalid/empty.
   */
  function parseFlexibleHeadCm(inputs) {
    if (!inputs || typeof inputs !== 'object') return null;
    const { cm, inches } = inputs;

    if (cm !== undefined && cm !== null && cm !== '') {
      const num = Number(cm);
      if (!isNaN(num) && num > 0) {
        return Math.round(num * 100) / 100;
      }
    }

    if (inches !== undefined && inches !== null && inches !== '') {
      const inNum = Number(inches);
      if (!isNaN(inNum) && inNum > 0) {
        return Math.round(inNum * 2.54 * 100) / 100;
      }
    }

    return null;
  }

  /**
   * Format head circumference cm into dual presentation object.
   */
  function formatHeadDual(cm) {
    if (cm === null || cm === undefined || cm === '' || isNaN(Number(cm))) return null;
    const num = Number(cm);
    if (num <= 0) return null;

    const cmRound = Math.round(num * 10) / 10;
    const inches = Math.round((num / 2.54) * 10) / 10;

    return {
      cm: cmRound,
      inches,
      labelMetric: `${cmRound} cm`,
      labelImperial: `${inches} in`
    };
  }

  // =========================================================================
  // 2. AAP VISIT DATE PRESETS & LIVE AGE CALCULATOR
  // =========================================================================

  function addMonthsToDate(dateStr, months) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const target = new Date(Date.UTC(y, m + months, d));
    const expectedMonth = ((m + months) % 12 + 12) % 12;
    if (target.getUTCMonth() !== expectedMonth) {
      target.setUTCDate(0); // clamp to last day of previous month
    }
    return target.toISOString().split('T')[0];
  }

  /**
   * Generate 1-tap checkup date presets covering Today, Yesterday, Birth,
   * and standard AAP checkups (1m, 2m, 4m, 6m, 9m, 12m, 15m, 18m, 24m, 30m, 3y, 4y, 5y).
   */
  function getCheckupDatePresets(birthDateStr, todayStr) {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const todayDate = new Date(today + 'T00:00:00');
    const yesterdayDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    const presets = [];

    // 1. Today
    const todayAge = birthDateStr ? (GrowthEngine ? GrowthEngine.calculateAgeMonths(birthDateStr, today) : calculateFallbackAgeMonths(birthDateStr, today)) : null;
    presets.push({
      key: 'today',
      label: 'Today',
      months: todayAge,
      dateStr: today,
      isPastOrToday: true
    });

    // 2. Yesterday
    const yesterdayAge = birthDateStr ? (GrowthEngine ? GrowthEngine.calculateAgeMonths(birthDateStr, yesterdayStr) : calculateFallbackAgeMonths(birthDateStr, yesterdayStr)) : null;
    presets.push({
      key: 'yesterday',
      label: 'Yesterday',
      months: yesterdayAge,
      dateStr: yesterdayStr,
      isPastOrToday: true
    });

    // 3. Birth
    if (birthDateStr) {
      presets.push({
        key: 'birth',
        label: 'Birth',
        months: 0,
        dateStr: birthDateStr,
        isPastOrToday: birthDateStr <= today
      });
    }

    // 4. AAP Visits
    AAP_PRESET_SCHEDULE.forEach(item => {
      if (item.key === 'birth') return; // already added
      const targetDate = birthDateStr ? addMonthsToDate(birthDateStr, item.months) : '';
      presets.push({
        key: item.key,
        label: item.label,
        months: item.months,
        dateStr: targetDate,
        isPastOrToday: Boolean(targetDate && targetDate <= today)
      });
    });

    return presets;
  }

  function calculateFallbackAgeMonths(birthDateStr, targetDateStr) {
    if (!birthDateStr || !targetDateStr) return 0;
    const b = new Date(birthDateStr + 'T00:00:00');
    const t = new Date(targetDateStr + 'T00:00:00');
    if (isNaN(b.getTime()) || isNaN(t.getTime())) return 0;
    const diffMs = t.getTime() - b.getTime();
    return Math.max(0, Math.round((diffMs / (1000 * 60 * 60 * 24 * 30.4375)) * 100) / 100);
  }

  /**
   * Format exact chronological and corrected age at a given visit date.
   * Returns { ageMonths, chronologicalLabel, correctedAgeMonths, correctedLabel, isPrematureCorrected }
   */
  function formatExactAgeAtDate(birthDateStr, visitDateStr, gestationalWeeks = 40) {
    if (!birthDateStr || !visitDateStr) {
      return {
        ageMonths: 0,
        chronologicalLabel: '—',
        correctedAgeMonths: 0,
        correctedLabel: null,
        isPrematureCorrected: false
      };
    }

    const bDate = new Date(birthDateStr + 'T00:00:00');
    const vDate = new Date(visitDateStr + 'T00:00:00');
    if (isNaN(bDate.getTime()) || isNaN(vDate.getTime())) {
      return {
        ageMonths: 0,
        chronologicalLabel: '—',
        correctedAgeMonths: 0,
        correctedLabel: null,
        isPrematureCorrected: false
      };
    }

    const diffDays = Math.max(0, Math.round((vDate.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24)));
    const ageMonths = Math.max(0, Math.round((diffDays / 30.4375) * 100) / 100);

    // Build chronological label
    let chronologicalLabel = '';
    if (diffDays === 0) {
      chronologicalLabel = 'Birth';
    } else if (diffDays < 30) {
      const wks = Math.floor(diffDays / 7);
      const remDays = diffDays % 7;
      chronologicalLabel = `${diffDays}d (${wks}w ${remDays}d)`;
    } else if (diffDays < 730) {
      const mos = Math.floor(diffDays / 30.4375);
      const remDays = Math.floor(diffDays % 30.4375);
      const yrs = (diffDays / 365.25).toFixed(2);
      chronologicalLabel = `${mos}m ${remDays}d (${yrs} yr)`;
    } else {
      const yrs = Math.floor(diffDays / 365.25);
      const remMos = Math.floor((diffDays % 365.25) / 30.4375);
      chronologicalLabel = `${yrs}y ${remMos}m (${(diffDays / 365.25).toFixed(1)} yr)`;
    }

    // Prematurity correction (<37 weeks gestational age, applied up to 24 months)
    const gWeeks = Number(gestationalWeeks) || 40;
    const isPremature = gWeeks < 37;
    const weeksPremature = Math.max(0, 40 - gWeeks);
    const isPrematureCorrected = isPremature && ageMonths <= 24;

    let correctedAgeMonths = ageMonths;
    let correctedLabel = null;

    if (isPrematureCorrected) {
      const correctedDays = Math.max(0, diffDays - Math.round(weeksPremature * 7));
      correctedAgeMonths = Math.max(0, Math.round((correctedDays / 30.4375) * 100) / 100);

      if (correctedDays < 30) {
        correctedLabel = `${correctedDays}d (${Math.floor(correctedDays / 7)}w)`;
      } else if (correctedDays < 730) {
        const cMos = Math.floor(correctedDays / 30.4375);
        const cRemDays = Math.floor(correctedDays % 30.4375);
        correctedLabel = `${cMos}m ${cRemDays}d`;
      } else {
        const cYrs = Math.floor(correctedDays / 365.25);
        const cRemMos = Math.floor((correctedDays % 365.25) / 30.4375);
        correctedLabel = `${cYrs}y ${cRemMos}m`;
      }
    }

    return {
      ageMonths,
      chronologicalLabel,
      correctedAgeMonths,
      correctedLabel,
      isPrematureCorrected
    };
  }

  // =========================================================================
  // 3. LIVE PLAUSIBILITY & UNIT-SWAP GUARDRAIL
  // =========================================================================

  /**
   * Check draft measurement plausibility against WHO/CDC growth curves and
   * previous child measurements. Non-blocking; flags warnings with 1-click unit fixes.
   */
  function checkMeasurementPlausibility(child, draftMeasurement, unitSystem = 'metric') {
    const warnings = [];
    const previewStats = {
      height: null,
      weight: null,
      head: null,
      bmi: null,
      wfl: null
    };

    if (!draftMeasurement) {
      return { previewStats, warnings };
    }

    // Auto-compute BMI if height and weight are provided
    const hCm = draftMeasurement.heightCm;
    const wKg = draftMeasurement.weightKg;
    const headCm = draftMeasurement.headCm || draftMeasurement.headCircumferenceCm;
    let bmiVal = null;
    if (hCm && wKg && hCm > 0) {
      const hM = hCm / 100;
      bmiVal = Math.round((wKg / (hM * hM)) * 10) / 10;
    }

    const testMeas = {
      ...draftMeasurement,
      bmi: bmiVal,
      headCm: headCm,
      headCircumferenceCm: headCm
    };

    if (GrowthEngine && child) {
      try {
        previewStats.height = GrowthEngine.statsForMeasurement(child, testMeas, 'height');
        previewStats.weight = GrowthEngine.statsForMeasurement(child, testMeas, 'weight');
        previewStats.head = GrowthEngine.statsForMeasurement(child, testMeas, 'head');
        previewStats.bmi = GrowthEngine.statsForMeasurement(child, testMeas, 'bmi');
        if (typeof GrowthEngine.calculateWeightForLength === 'function' && hCm && wKg) {
          previewStats.wfl = GrowthEngine.calculateWeightForLength(child.sex || child.gender || 'M', hCm, wKg);
        }
      } catch (err) {
        // Safe guard against engine anomalies
      }
    }

    // Guardrail 1: Weight Plausibility & Unit-Swap
    if (wKg && previewStats.weight && typeof previewStats.weight.zScore === 'number') {
      const z = previewStats.weight.zScore;
      if (Math.abs(z) > 3.0) {
        if (unitSystem === 'metric' && z > 3.0) {
          // Entered lb into kg field? (e.g. 21.5 lb entered in kg mode -> 21.5 kg instead of 9.75 kg)
          const fixedKg = Math.round((wKg / 2.20462262) * 100) / 100;
          let swapPlausible = true;
          if (GrowthEngine && child) {
            const altStats = GrowthEngine.statsForMeasurement(child, { ...testMeas, weightKg: fixedKg }, 'weight');
            if (altStats && Math.abs(altStats.zScore) > 3.0) swapPlausible = false;
          }
          if (swapPlausible) {
            warnings.push({
              field: 'weight',
              message: `Unusual jump (${z > 0 ? '+' : ''}${z.toFixed(1)} SD). Entered lb in kg mode?`,
              fixLabel: `Convert ${wKg} lb → ${fixedKg} kg`,
              fixedValues: { weightKg: fixedKg }
            });
          } else {
            warnings.push({
              field: 'weight',
              message: `Weight (${wKg} kg) is an unusual outlier (${z > 0 ? '+' : ''}${z.toFixed(1)} SD). Please verify.`,
              fixLabel: null,
              fixedValues: null
            });
          }
        } else if (unitSystem === 'imperial' && z < -3.0) {
          // Entered kg into lb field? (e.g. 9.8 typed into lb field -> 4.4 kg instead of 9.8 kg)
          const typedVal = Math.round(wKg * 2.20462262 * 10) / 10;
          const fixedKg = typedVal;
          let swapPlausible = true;
          if (GrowthEngine && child) {
            const altStats = GrowthEngine.statsForMeasurement(child, { ...testMeas, weightKg: fixedKg }, 'weight');
            if (altStats && Math.abs(altStats.zScore) > 3.0) swapPlausible = false;
          }
          if (swapPlausible) {
            const fixedLb = Math.round(fixedKg * 2.20462262 * 10) / 10;
            warnings.push({
              field: 'weight',
              message: `Unusually low weight (${z.toFixed(1)} SD). Entered kg in lb mode?`,
              fixLabel: `Convert ${typedVal} kg → ${fixedLb} lb (${fixedKg} kg)`,
              fixedValues: { weightKg: fixedKg }
            });
          } else {
            warnings.push({
              field: 'weight',
              message: `Weight is an unusual outlier (${z.toFixed(1)} SD). Please verify.`,
              fixLabel: null,
              fixedValues: null
            });
          }
        } else {
          warnings.push({
            field: 'weight',
            message: `Weight is an unusual clinical outlier (${z > 0 ? '+' : ''}${z.toFixed(1)} SD).`,
            fixLabel: null,
            fixedValues: null
          });
        }
      }
    }

    // Guardrail 2: Height Drop Check & Z-Score Swap
    if (hCm && child && Array.isArray(child.measurements)) {
      const prevMs = child.measurements
        .filter(m => m.heightCm && m.id !== draftMeasurement.id && (m.date ? m.date < (draftMeasurement.date || '9999') : (m.ageMonths < (draftMeasurement.ageMonths || 9999))))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.ageMonths || 0) - (a.ageMonths || 0));

      if (prevMs.length > 0) {
        const prior = prevMs[0];
        if (hCm < prior.heightCm - 1.0) {
          const drop = Math.round((prior.heightCm - hCm) * 10) / 10;
          warnings.push({
            field: 'height',
            message: `Height (${hCm} cm) drops ${drop} cm below prior visit on ${prior.date || 'prior visit'} (${prior.heightCm} cm). Children rarely shrink!`,
            fixLabel: `Keep prior height (${prior.heightCm} cm)`,
            fixedValues: { heightCm: prior.heightCm }
          });
        }
      }
    }

    if (hCm && previewStats.height && typeof previewStats.height.zScore === 'number') {
      const z = previewStats.height.zScore;
      if (Math.abs(z) > 3.0 && !warnings.some(w => w.field === 'height')) {
        if (unitSystem === 'metric' && z < -3.0) {
          // Entered inches in cm mode (e.g. 30 inches entered as 30 cm)?
          const fixedCm = Math.round(hCm * 2.54 * 10) / 10;
          let swapPlausible = true;
          if (GrowthEngine && child) {
            const altStats = GrowthEngine.statsForMeasurement(child, { ...testMeas, heightCm: fixedCm }, 'height');
            if (altStats && Math.abs(altStats.zScore) > 3.0) swapPlausible = false;
          }
          if (swapPlausible) {
            warnings.push({
              field: 'height',
              message: `Height (${hCm} cm, Z=${z.toFixed(1)}) is unusually low. Entered inches in cm mode?`,
              fixLabel: `Convert ${hCm} in → ${fixedCm} cm`,
              fixedValues: { heightCm: fixedCm }
            });
          }
        } else if (unitSystem === 'imperial' && z > 3.0) {
          // Entered cm in inches mode (e.g. 76 cm entered into inches field)?
          const typedInches = Math.round((hCm / 2.54) * 10) / 10;
          const fixedCm = typedInches;
          let swapPlausible = true;
          if (GrowthEngine && child) {
            const altStats = GrowthEngine.statsForMeasurement(child, { ...testMeas, heightCm: fixedCm }, 'height');
            if (altStats && Math.abs(altStats.zScore) > 3.0) swapPlausible = false;
          }
          if (swapPlausible) {
            warnings.push({
              field: 'height',
              message: `Height is unusually high (${z.toFixed(1)} SD). Entered cm in inches mode?`,
              fixLabel: `Convert ${typedInches} cm → ${typedInches} cm`,
              fixedValues: { heightCm: fixedCm }
            });
          }
        }
      }
    }

    // Guardrail 3: Head Circumference Plausibility
    if (headCm && previewStats.head && typeof previewStats.head.zScore === 'number') {
      const z = previewStats.head.zScore;
      if (Math.abs(z) > 3.0) {
        if (unitSystem === 'metric' && z < -3.0) {
          const fixedCm = Math.round(headCm * 2.54 * 10) / 10;
          warnings.push({
            field: 'head',
            message: `Head circumference (${headCm} cm, Z=${z.toFixed(1)}) is unusually low. Entered inches?`,
            fixLabel: `Convert ${headCm} in → ${fixedCm} cm`,
            fixedValues: { headCm: fixedCm, headCircumferenceCm: fixedCm }
          });
        } else {
          warnings.push({
            field: 'head',
            message: `Head circumference (${headCm} cm) is an unusual outlier (${z > 0 ? '+' : ''}${z.toFixed(1)} SD).`,
            fixLabel: null,
            fixedValues: null
          });
        }
      }
    }

    return { previewStats, warnings };
  }

  // =========================================================================
  // 4. RICH SLIDE-OVER QUICK-LOG COMPOSER (`mountMeasurementComposer`)
  // =========================================================================

  /**
   * Mount the 3-mode Quick-Log slide-over drawer / modal composer.
   * Modes: 1. Checkup Vitals · 2. 1-Tap Milestone · 3. Photo OCR Shortcut.
   */
  function mountMeasurementComposer(containerEl, options = {}) {
    if (!containerEl) throw new Error('mountMeasurementComposer requires a valid container element');

    let {
      familyState = null,
      activeChildId = null,
      initialMeasurement = null,
      initialTab = 'vitals',
      preset = null,
      unitSystem = 'metric',
      onSubmit = null,
      onSubmitMilestone = null,
      onOpenPhotoScan = null,
      onCancel = null
    } = options;

    let currentChildId = activeChildId || (familyState?.children?.[0]?.id) || 'child-1';
    let currentUnitSystem = unitSystem || 'metric';
    let currentModeTab = initialTab || 'vitals'; // 'vitals' | 'milestone' | 'photo'
    let currentDraftValues = initialMeasurement ? { ...initialMeasurement } : {};
    let isTotalInchesView = false;
    let selectedMilestoneCategory = 'all';

    function getActiveChild() {
      const children = familyState?.children || [];
      return children.find(c => c.id === currentChildId) || children[0] || null;
    }

    // Render skeleton
    containerEl.classList.add('kp-composer-mounted');
    containerEl.innerHTML = `
      <div class="kp-composer-wrapper">
        <header class="kp-composer-header">
          <div class="kp-composer-title-wrap">
            <span class="kp-composer-badge-icon">🌱</span>
            <div>
              <h3 class="kp-composer-title">Quick-Log Pediatric Visit</h3>
              <p class="kp-composer-subtitle">Smart dual-unit biometrics & instant WHO/CDC percentiles</p>
            </div>
          </div>
          <button type="button" class="kp-btn-icon-close" id="kp-btn-composer-close" aria-label="Close Composer">✕</button>
        </header>

        <nav class="kp-composer-tabs" role="tablist">
          <button type="button" class="kp-composer-tab active" data-tab="vitals" role="tab" aria-selected="true">
            <span class="kp-tab-emoji">📏</span> Checkup Vitals
          </button>
          <button type="button" class="kp-composer-tab" data-tab="milestone" role="tab" aria-selected="false">
            <span class="kp-tab-emoji">🌟</span> 1-Tap Milestone
          </button>
          <button type="button" class="kp-composer-tab" data-tab="photo" role="tab" aria-selected="false">
            <span class="kp-tab-emoji">📸</span> Photo OCR
          </button>
        </nav>

        <div class="kp-composer-body">
          <!-- PANE 1: VITALS -->
          <div class="kp-pane kp-pane-vitals active" data-pane="vitals">
            <!-- Child Switcher Pills -->
            <div class="kp-form-section">
              <label class="kp-field-label">Child</label>
              <div class="kp-child-pills" id="kp-composer-child-pills"></div>
            </div>

            <!-- Visit Date & Presets -->
            <div class="kp-form-section">
              <div class="kp-field-label-row">
                <label class="kp-field-label" for="kp-input-date">Visit Date</label>
                <span class="kp-age-pill" id="kp-badge-live-age">Age: —</span>
              </div>
              <input type="date" id="kp-input-date" class="kp-input kp-date-input" required />
              
              <div class="kp-preset-row">
                <span class="kp-preset-label">AAP Presets:</span>
                <div class="kp-preset-scroll" id="kp-composer-presets-container"></div>
              </div>
            </div>

            <!-- Smart Biometrics Card -->
            <div class="kp-biometrics-card" id="kp-biometrics-container">
              <!-- Dynamically populated based on currentUnitSystem -->
            </div>

            <!-- Partial Entry Validation Hint -->
            <div class="kp-validation-hint">
              <span class="kp-hint-icon">💡</span>
              <span>Partial entry supported: enter at least one biometric (Height, Weight, or Head).</span>
            </div>

            <!-- Plausibility Banner -->
            <div class="kp-plausibility-banner" id="kp-plausibility-banner" style="display:none;"></div>

            <!-- Live Percentile Preview Strip -->
            <div class="kp-percentile-strip" id="kp-percentile-strip">
              <span class="kp-strip-metric" data-strip="height">Height: —</span>
              <span class="kp-strip-sep">•</span>
              <span class="kp-strip-metric" data-strip="weight">Weight: —</span>
              <span class="kp-strip-sep">•</span>
              <span class="kp-strip-metric" data-strip="head">Head: —</span>
              <span class="kp-strip-sep">•</span>
              <span class="kp-strip-metric" data-strip="bmi">BMI: —</span>
            </div>

            <!-- Visit Metadata -->
            <div class="kp-metadata-grid">
              <div class="kp-field-group">
                <label class="kp-field-label" for="kp-select-visittype">Visit Type</label>
                <select id="kp-select-visittype" class="kp-select">
                  <option value="well-child">Well-Child Visit</option>
                  <option value="home">Home Check</option>
                  <option value="birth">Birth / Delivery</option>
                  <option value="sick">Sick Visit</option>
                  <option value="hospital">Specialist / Hospital</option>
                </select>
              </div>

              <div class="kp-field-group">
                <label class="kp-field-label" for="kp-input-provider">Provider / Clinic</label>
                <input type="text" id="kp-input-provider" class="kp-input" placeholder="e.g. Dr. Patel, Eastside Pediatrics" />
              </div>
            </div>

            <div class="kp-form-section">
              <label class="kp-field-label" for="kp-textarea-notes">Clinical Notes & Observations</label>
              <textarea id="kp-textarea-notes" class="kp-textarea" rows="2" placeholder="Feeding, sleep patterns, immunizations, questions..."></textarea>
            </div>

            <div class="kp-form-actions">
              <button type="button" class="kp-btn kp-btn-secondary" id="kp-btn-cancel-vitals">Cancel</button>
              <button type="button" class="kp-btn kp-btn-primary" id="kp-btn-save-vitals">Save Checkup Record</button>
            </div>
          </div>

          <!-- PANE 2: 1-TAP MILESTONE -->
          <div class="kp-pane kp-pane-milestone" data-pane="milestone" style="display:none;">
            <div class="kp-form-section">
              <label class="kp-field-label">Child</label>
              <div class="kp-child-pills" id="kp-milestone-child-pills"></div>
            </div>

            <div class="kp-form-section">
              <label class="kp-field-label" for="kp-milestone-date">Achievement Date</label>
              <input type="date" id="kp-milestone-date" class="kp-input" />
            </div>

            <div class="kp-milestone-categories" id="kp-milestone-cat-filters">
              <button type="button" class="kp-cat-pill active" data-cat="all">All</button>
              <button type="button" class="kp-cat-pill" data-cat="gross-motor">Gross Motor</button>
              <button type="button" class="kp-cat-pill" data-cat="fine-motor">Fine Motor</button>
              <button type="button" class="kp-cat-pill" data-cat="language-social">Language & Social</button>
              <button type="button" class="kp-cat-pill" data-cat="cognitive">Cognitive</button>
            </div>

            <div class="kp-milestone-grid" id="kp-milestone-catalog-grid"></div>

            <div class="kp-custom-milestone-box">
              <label class="kp-field-label">Add Custom Milestone</label>
              <div class="kp-custom-ms-row">
                <input type="text" id="kp-custom-ms-title" class="kp-input" placeholder="e.g. Drank from straw cup independently" />
                <select id="kp-custom-ms-cat" class="kp-select">
                  <option value="gross-motor">Gross Motor</option>
                  <option value="fine-motor">Fine Motor</option>
                  <option value="language-social">Language & Social</option>
                  <option value="cognitive">Cognitive</option>
                </select>
                <button type="button" class="kp-btn kp-btn-primary" id="kp-btn-add-custom-ms">+ Log</button>
              </div>
            </div>
          </div>

          <!-- PANE 3: PHOTO OCR SHORTCUT -->
          <div class="kp-pane kp-pane-photo" data-pane="photo" style="display:none;">
            <div class="kp-ocr-shortcut-card">
              <div class="kp-ocr-icon-large">📸</div>
              <h4>Scan After-Visit Summary or Paper Chart</h4>
              <p>KinSprout's on-device privacy-first OCR extracts visit dates, lengths, weights, and head circumferences automatically with zero server uploads.</p>
              <button type="button" class="kp-btn kp-btn-primary kp-btn-lg" id="kp-btn-trigger-photo-scan">
                Open Photo Import Scanner
              </button>
              <div class="kp-ocr-tips">
                <strong>Tips for highest accuracy:</strong>
                <ul>
                  <li>Place paper flat with bright, even lighting.</li>
                  <li>Hold phone directly above the chart to avoid skewed angles.</li>
                  <li>Ensure dates and unit labels (cm/in, kg/lb) are visible.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // DOM References
    const dateInput = containerEl.querySelector('#kp-input-date');
    const liveAgeBadge = containerEl.querySelector('#kp-badge-live-age');
    const childPillsWrap = containerEl.querySelector('#kp-composer-child-pills');
    const milestoneChildPillsWrap = containerEl.querySelector('#kp-milestone-child-pills');
    const presetsContainer = containerEl.querySelector('#kp-composer-presets-container');
    const biometricsCard = containerEl.querySelector('#kp-biometrics-container');
    const plausibilityBanner = containerEl.querySelector('#kp-plausibility-banner');
    const percentileStrip = containerEl.querySelector('#kp-percentile-strip');
    const visitTypeSelect = containerEl.querySelector('#kp-select-visittype');
    const providerInput = containerEl.querySelector('#kp-input-provider');
    const notesTextarea = containerEl.querySelector('#kp-textarea-notes');
    const milestoneDateInput = containerEl.querySelector('#kp-milestone-date');

    // Initialize Default Date
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = initialMeasurement?.date || todayStr;
    milestoneDateInput.value = todayStr;

    if (initialMeasurement) {
      if (initialMeasurement.visitType) visitTypeSelect.value = initialMeasurement.visitType;
      if (initialMeasurement.provider) providerInput.value = initialMeasurement.provider;
      if (initialMeasurement.notes) notesTextarea.value = initialMeasurement.notes;
    }

    // Render Child Switcher Pills
    function renderChildPills() {
      const children = familyState?.children || [];
      const renderTo = (el) => {
        if (!el) return;
        el.innerHTML = '';
        children.forEach((c, idx) => {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `kp-child-pill ${c.id === currentChildId ? 'active' : ''}`;
          pill.dataset.childId = c.id;
          const color = c.color || CHILD_PALETTE[idx % CHILD_PALETTE.length];
          pill.innerHTML = `
            <span class="kp-child-dot" style="background-color: ${color};"></span>
            <span class="kp-child-name">${c.name || 'Child ' + (idx + 1)}</span>
          `;
          pill.addEventListener('click', () => {
            setChild(c.id);
          });
          el.appendChild(pill);
        });
      };
      renderTo(childPillsWrap);
      renderTo(milestoneChildPillsWrap);
    }

    // Render Presets
    function renderPresets() {
      if (!presetsContainer) return;
      presetsContainer.innerHTML = '';
      const child = getActiveChild();
      const presets = getCheckupDatePresets(child?.birthDate, todayStr);

      presets.forEach(p => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `kp-preset-chip ${p.dateStr === dateInput.value ? 'selected' : ''}`;
        chip.textContent = p.label;
        chip.title = p.dateStr ? `Set date to ${p.dateStr}` : p.label;
        chip.addEventListener('click', () => {
          if (p.dateStr) {
            dateInput.value = p.dateStr;
            if (p.key !== 'today' && p.key !== 'yesterday') {
              visitTypeSelect.value = 'well-child';
            }
            recalculate();
            renderPresets();
          }
        });
        presetsContainer.appendChild(chip);
      });
    }

    // Render Biometrics Form based on currentUnitSystem
    function renderBiometricsForm() {
      if (!biometricsCard) return;

      const isImp = currentUnitSystem === 'imperial';
      const m = currentDraftValues;

      // Length/Height values
      const lenDual = formatLengthDual(m.heightCm);
      // Weight values
      const wtDual = formatWeightDual(m.weightKg);
      // Head values
      const hdDual = formatHeadDual(m.headCm || m.headCircumferenceCm);

      if (!isImp) {
        // METRIC MODE
        biometricsCard.innerHTML = `
          <!-- Height Section -->
          <div class="kp-bio-row" data-metric="height">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Length / Height</span>
              <span class="kp-bio-dual-badge" id="kp-badge-dual-ht">${lenDual ? `= ${lenDual.labelImperial}` : '= —'}</span>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="height" data-delta="-0.1">−0.1</button>
              <div class="kp-input-affix-wrap">
                <input type="number" step="0.1" min="20" max="220" class="kp-input kp-bio-input" id="kp-val-ht-cm"
                  placeholder="e.g. 75.5" value="${m.heightCm != null ? m.heightCm : ''}" />
                <span class="kp-affix">cm</span>
              </div>
              <button type="button" class="kp-stepper-btn" data-field="height" data-delta="0.1">+0.1</button>
            </div>
            <div class="kp-slider-wrap">
              <input type="range" class="kp-range-slider" id="kp-slider-ht" min="40" max="140" step="0.5"
                value="${m.heightCm != null ? m.heightCm : 75}" />
            </div>
          </div>

          <!-- Weight Section -->
          <div class="kp-bio-row" data-metric="weight">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Weight</span>
              <span class="kp-bio-dual-badge" id="kp-badge-dual-wt">${wtDual ? `= ${wtDual.labelImperial}` : '= —'}</span>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="weight" data-delta="-0.05">−0.05</button>
              <div class="kp-input-affix-wrap">
                <input type="number" step="0.01" min="0.5" max="150" class="kp-input kp-bio-input" id="kp-val-wt-kg"
                  placeholder="e.g. 9.85" value="${m.weightKg != null ? m.weightKg : ''}" />
                <span class="kp-affix">kg</span>
              </div>
              <button type="button" class="kp-stepper-btn" data-field="weight" data-delta="0.05">+0.05</button>
            </div>
          </div>

          <!-- Head Circumference Section -->
          <div class="kp-bio-row" data-metric="head">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Head Circumference</span>
              <span class="kp-bio-dual-badge" id="kp-badge-dual-hc">${hdDual ? `= ${hdDual.labelImperial}` : '= —'}</span>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="head" data-delta="-0.1">−0.1</button>
              <div class="kp-input-affix-wrap">
                <input type="number" step="0.1" min="20" max="70" class="kp-input kp-bio-input" id="kp-val-hc-cm"
                  placeholder="e.g. 45.2" value="${(m.headCm || m.headCircumferenceCm) != null ? (m.headCm || m.headCircumferenceCm) : ''}" />
                <span class="kp-affix">cm</span>
              </div>
              <button type="button" class="kp-stepper-btn" data-field="head" data-delta="0.1">+0.1</button>
            </div>
          </div>
        `;
      } else {
        // IMPERIAL MODE
        biometricsCard.innerHTML = `
          <!-- Height Section -->
          <div class="kp-bio-row" data-metric="height">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Length / Height</span>
              <div class="kp-header-right">
                <button type="button" class="kp-btn-toggle-subtle" id="kp-btn-toggle-total-in">
                  ${isTotalInchesView ? '⇄ Ft + In' : '⇄ Total In'}
                </button>
                <span class="kp-bio-dual-badge" id="kp-badge-dual-ht">${lenDual ? `= ${lenDual.labelMetric}` : '= —'}</span>
              </div>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="height-imp" data-delta="-0.25">−0.25"</button>
              ${isTotalInchesView ? `
                <div class="kp-input-affix-wrap">
                  <input type="number" step="0.1" min="10" max="90" class="kp-input kp-bio-input" id="kp-val-ht-total-in"
                    placeholder="e.g. 30.5" value="${lenDual ? lenDual.totalInches : ''}" />
                  <span class="kp-affix">in</span>
                </div>
              ` : `
                <div class="kp-dual-inputs">
                  <div class="kp-input-affix-wrap">
                    <input type="number" step="1" min="0" max="7" class="kp-input kp-bio-input" id="kp-val-ht-ft"
                      placeholder="2" value="${lenDual ? lenDual.ft : ''}" />
                    <span class="kp-affix">ft</span>
                  </div>
                  <div class="kp-input-affix-wrap">
                    <input type="number" step="0.1" min="0" max="11.9" class="kp-input kp-bio-input" id="kp-val-ht-in"
                      placeholder="6.5" value="${lenDual ? lenDual.inches : ''}" />
                    <span class="kp-affix">in</span>
                  </div>
                </div>
              `}
              <button type="button" class="kp-stepper-btn" data-field="height-imp" data-delta="0.25">+0.25"</button>
            </div>
          </div>

          <!-- Weight Section -->
          <div class="kp-bio-row" data-metric="weight">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Weight</span>
              <span class="kp-bio-dual-badge" id="kp-badge-dual-wt">${wtDual ? `= ${wtDual.labelMetric}` : '= —'}</span>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="weight-imp" data-delta="-1oz">−1 oz</button>
              <div class="kp-dual-inputs">
                <div class="kp-input-affix-wrap">
                  <input type="number" step="1" min="0" max="250" class="kp-input kp-bio-input" id="kp-val-wt-lb"
                    placeholder="21" value="${wtDual ? wtDual.lb : ''}" />
                  <span class="kp-affix">lb</span>
                </div>
                <div class="kp-input-affix-wrap">
                  <input type="number" step="0.1" min="0" max="15.9" class="kp-input kp-bio-input" id="kp-val-wt-oz"
                    placeholder="8.0" value="${wtDual ? wtDual.oz : ''}" />
                  <span class="kp-affix">oz</span>
                </div>
              </div>
              <button type="button" class="kp-stepper-btn" data-field="weight-imp" data-delta="1oz">+1 oz</button>
            </div>
          </div>

          <!-- Head Circumference Section -->
          <div class="kp-bio-row" data-metric="head">
            <div class="kp-bio-header">
              <span class="kp-bio-label">Head Circumference</span>
              <span class="kp-bio-dual-badge" id="kp-badge-dual-hc">${hdDual ? `= ${hdDual.labelMetric}` : '= —'}</span>
            </div>
            <div class="kp-bio-controls">
              <button type="button" class="kp-stepper-btn" data-field="head-imp" data-delta="-0.1">−0.1"</button>
              <div class="kp-input-affix-wrap">
                <input type="number" step="0.1" min="10" max="28" class="kp-input kp-bio-input" id="kp-val-hc-in"
                  placeholder="e.g. 18.1" value="${hdDual ? hdDual.inches : ''}" />
                <span class="kp-affix">in</span>
              </div>
              <button type="button" class="kp-stepper-btn" data-field="head-imp" data-delta="0.1">+0.1"</button>
            </div>
          </div>
        `;
      }

      attachBiometricListeners();
    }

    // Attach listeners for biometric inputs, steppers & sliders
    function attachBiometricListeners() {
      // Toggle total inches in imperial mode
      const btnToggleTotalIn = biometricsCard.querySelector('#kp-btn-toggle-total-in');
      if (btnToggleTotalIn) {
        btnToggleTotalIn.addEventListener('click', () => {
          isTotalInchesView = !isTotalInchesView;
          renderBiometricsForm();
          recalculate();
        });
      }

      // Height slider (metric)
      const htSlider = biometricsCard.querySelector('#kp-slider-ht');
      const htCmInput = biometricsCard.querySelector('#kp-val-ht-cm');
      if (htSlider && htCmInput) {
        htSlider.addEventListener('input', () => {
          htCmInput.value = htSlider.value;
          currentDraftValues.heightCm = Number(htSlider.value);
          recalculate();
        });
      }

      // Input changes
      const allBioInputs = biometricsCard.querySelectorAll('.kp-bio-input');
      allBioInputs.forEach(input => {
        input.addEventListener('input', () => {
          syncDraftFromInputs();
          recalculate();
        });
      });

      // Stepper buttons
      const stepperBtns = biometricsCard.querySelectorAll('.kp-stepper-btn');
      stepperBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const field = btn.dataset.field;
          const delta = btn.dataset.delta;
          handleStepperClick(field, delta);
        });
      });
    }

    function syncDraftFromInputs() {
      if (currentUnitSystem === 'metric') {
        const htCm = biometricsCard.querySelector('#kp-val-ht-cm')?.value;
        const wtKg = biometricsCard.querySelector('#kp-val-wt-kg')?.value;
        const hcCm = biometricsCard.querySelector('#kp-val-hc-cm')?.value;

        currentDraftValues.heightCm = parseFlexibleLengthCm({ cm: htCm });
        currentDraftValues.weightKg = parseFlexibleWeightKg({ kg: wtKg });
        currentDraftValues.headCm = parseFlexibleHeadCm({ cm: hcCm });
        currentDraftValues.headCircumferenceCm = currentDraftValues.headCm;
      } else {
        // Imperial
        if (isTotalInchesView) {
          const totalIn = biometricsCard.querySelector('#kp-val-ht-total-in')?.value;
          currentDraftValues.heightCm = parseFlexibleLengthCm({ totalInches: totalIn });
        } else {
          const ft = biometricsCard.querySelector('#kp-val-ht-ft')?.value;
          const inVal = biometricsCard.querySelector('#kp-val-ht-in')?.value;
          currentDraftValues.heightCm = parseFlexibleLengthCm({ ft, inches: inVal });
        }

        const lb = biometricsCard.querySelector('#kp-val-wt-lb')?.value;
        const oz = biometricsCard.querySelector('#kp-val-wt-oz')?.value;
        currentDraftValues.weightKg = parseFlexibleWeightKg({ lb, oz });

        const inHc = biometricsCard.querySelector('#kp-val-hc-in')?.value;
        currentDraftValues.headCm = parseFlexibleHeadCm({ inches: inHc });
        currentDraftValues.headCircumferenceCm = currentDraftValues.headCm;
      }
    }

    function handleStepperClick(field, deltaStr) {
      syncDraftFromInputs();

      if (field === 'height') {
        const delta = parseFloat(deltaStr);
        let curr = currentDraftValues.heightCm || 75.0;
        curr = Math.max(20, Math.min(220, Math.round((curr + delta) * 10) / 10));
        currentDraftValues.heightCm = curr;
      } else if (field === 'weight') {
        const delta = parseFloat(deltaStr);
        let curr = currentDraftValues.weightKg || 9.0;
        curr = Math.max(0.5, Math.min(150, Math.round((curr + delta) * 100) / 100));
        currentDraftValues.weightKg = curr;
      } else if (field === 'head') {
        const delta = parseFloat(deltaStr);
        let curr = currentDraftValues.headCm || 45.0;
        curr = Math.max(20, Math.min(70, Math.round((curr + delta) * 10) / 10));
        currentDraftValues.headCm = curr;
        currentDraftValues.headCircumferenceCm = curr;
      } else if (field === 'height-imp') {
        const delta = parseFloat(deltaStr);
        let currCm = currentDraftValues.heightCm || 76.2; // 30 inches
        let totalIn = currCm / 2.54;
        totalIn = Math.max(10, Math.min(90, Math.round((totalIn + delta) * 10) / 10));
        currentDraftValues.heightCm = Math.round(totalIn * 2.54 * 100) / 100;
      } else if (field === 'weight-imp') {
        let currKg = currentDraftValues.weightKg || 9.0;
        let totalLb = currKg * 2.20462262;
        if (deltaStr === '1oz') {
          totalLb += (1 / 16);
        } else if (deltaStr === '-1oz') {
          totalLb = Math.max(1, totalLb - (1 / 16));
        }
        currentDraftValues.weightKg = Math.round((totalLb / 2.20462262) * 1000) / 1000;
      } else if (field === 'head-imp') {
        const delta = parseFloat(deltaStr);
        let currCm = currentDraftValues.headCm || 45.72; // 18 inches
        let inVal = currCm / 2.54;
        inVal = Math.max(8, Math.min(28, Math.round((inVal + delta) * 10) / 10));
        currentDraftValues.headCm = Math.round(inVal * 2.54 * 100) / 100;
        currentDraftValues.headCircumferenceCm = currentDraftValues.headCm;
      }

      renderBiometricsForm();
      recalculate();
    }

    // Recalculate Live Age, Badges, Plausibility & Percentile Strip
    function recalculate() {
      const child = getActiveChild();
      const visitDate = dateInput.value;

      // 1. Live Age
      const ageInfo = formatExactAgeAtDate(child?.birthDate, visitDate, child?.gestationalWeeks);
      if (liveAgeBadge) {
        let ageText = `Age: ${ageInfo.chronologicalLabel}`;
        if (ageInfo.isPrematureCorrected && ageInfo.correctedLabel) {
          ageText += ` • Corrected: ${ageInfo.correctedLabel}`;
        }
        liveAgeBadge.textContent = ageText;
      }

      // 2. Dual unit badges
      const htBadge = biometricsCard?.querySelector('#kp-badge-dual-ht');
      const wtBadge = biometricsCard?.querySelector('#kp-badge-dual-wt');
      const hcBadge = biometricsCard?.querySelector('#kp-badge-dual-hc');

      const lenDual = formatLengthDual(currentDraftValues.heightCm);
      const wtDual = formatWeightDual(currentDraftValues.weightKg);
      const hdDual = formatHeadDual(currentDraftValues.headCm || currentDraftValues.headCircumferenceCm);

      if (htBadge) htBadge.textContent = lenDual ? (currentUnitSystem === 'metric' ? `= ${lenDual.labelImperial}` : `= ${lenDual.labelMetric}`) : '= —';
      if (wtBadge) wtBadge.textContent = wtDual ? (currentUnitSystem === 'metric' ? `= ${wtDual.labelImperial}` : `= ${wtDual.labelMetric}`) : '= —';
      if (hcBadge) hcBadge.textContent = hdDual ? (currentUnitSystem === 'metric' ? `= ${hdDual.labelImperial}` : `= ${hdDual.labelMetric}`) : '= —';

      // Also sync range slider if metric
      const htSlider = biometricsCard?.querySelector('#kp-slider-ht');
      if (htSlider && currentDraftValues.heightCm) {
        htSlider.value = currentDraftValues.heightCm;
      }

      // 3. Plausibility & Percentile Strip
      const draftWithDate = {
        ...currentDraftValues,
        date: visitDate,
        ageMonths: ageInfo.ageMonths
      };

      const { previewStats, warnings } = checkMeasurementPlausibility(child, draftWithDate, currentUnitSystem);

      // Render Plausibility Warnings
      if (plausibilityBanner) {
        if (warnings.length > 0) {
          const w = warnings[0];
          plausibilityBanner.style.display = 'flex';
          plausibilityBanner.innerHTML = `
            <div class="kp-warn-content">
              <span class="kp-warn-icon">⚠️</span>
              <span class="kp-warn-msg">${w.message}</span>
            </div>
            ${w.fixLabel ? `<button type="button" class="kp-btn-fix" id="kp-btn-apply-fix">${w.fixLabel}</button>` : ''}
          `;

          const fixBtn = plausibilityBanner.querySelector('#kp-btn-apply-fix');
          if (fixBtn && w.fixedValues) {
            fixBtn.addEventListener('click', () => {
              Object.assign(currentDraftValues, w.fixedValues);
              renderBiometricsForm();
              recalculate();
            });
          }
        } else {
          plausibilityBanner.style.display = 'none';
          plausibilityBanner.innerHTML = '';
        }
      }

      // Render Percentile Strip
      if (percentileStrip) {
        const htEl = percentileStrip.querySelector('[data-strip="height"]');
        const wtEl = percentileStrip.querySelector('[data-strip="weight"]');
        const hcEl = percentileStrip.querySelector('[data-strip="head"]');
        const bmiEl = percentileStrip.querySelector('[data-strip="bmi"]');

        const fmtPct = (st, fallback) => {
          if (!st || st.percentile == null) return fallback;
          const p = GrowthEngine && typeof GrowthEngine.formatOrdinal === 'function' ? GrowthEngine.formatOrdinal(Math.round(st.percentile)) : `${Math.round(st.percentile)}%`;
          const z = typeof st.zScore === 'number' ? ` (${st.zScore > 0 ? '+' : ''}${st.zScore.toFixed(1)} SD)` : '';
          return `${p}${z}`;
        };

        if (htEl) htEl.textContent = `Height: ${fmtPct(previewStats.height, '—')}`;
        if (wtEl) wtEl.textContent = `Weight: ${fmtPct(previewStats.weight, '—')}`;
        if (hcEl) hcEl.textContent = `Head: ${fmtPct(previewStats.head, '—')}`;

        let bmiLabel = '—';
        if (previewStats.bmi && previewStats.bmi.value != null) {
          bmiLabel = `${previewStats.bmi.value.toFixed(1)}`;
          if (previewStats.bmi.percentile != null) {
            bmiLabel += ` (${Math.round(previewStats.bmi.percentile)}%)`;
          }
        }
        if (bmiEl) bmiEl.textContent = `BMI: ${bmiLabel}`;
      }
    }

    // Render Milestone Catalog Grid
    function renderMilestoneCatalog() {
      const grid = containerEl.querySelector('#kp-milestone-catalog-grid');
      if (!grid) return;

      const child = getActiveChild();
      const rawCatalog = (GrowthEngine && typeof GrowthEngine.getCDCMilestoneCatalog === 'function')
        ? GrowthEngine.getCDCMilestoneCatalog()
        : CDC_MILESTONES;

      const childAgeMonths = child?.birthDate ? formatExactAgeAtDate(child.birthDate, milestoneDateInput.value).ageMonths : 12;

      grid.innerHTML = '';

      const filtered = rawCatalog.filter(m => {
        if (selectedMilestoneCategory === 'all') return true;
        return m.category === selectedMilestoneCategory;
      });

      filtered.forEach(ms => {
        const isAchieved = (child?.milestones || []).some(m => m.key === ms.key || m.title === ms.title);
        const card = document.createElement('div');
        card.className = `kp-milestone-card ${isAchieved ? 'achieved' : ''}`;
        card.innerHTML = `
          <div class="kp-ms-header">
            <span class="kp-ms-cat-badge">${ms.category}</span>
            <span class="kp-ms-age-badge">${ms.targetAgeMonths}m</span>
          </div>
          <h5 class="kp-ms-title">${ms.title}</h5>
          <p class="kp-ms-desc">${ms.description || ''}</p>
          <div class="kp-ms-action">
            <span class="kp-ms-status">${isAchieved ? '✓ Achieved' : '+ Tap to Log'}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          if (typeof onSubmitMilestone === 'function') {
            const payload = {
              id: 'ms-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              childId: currentChildId,
              key: ms.key,
              title: ms.title,
              category: ms.category,
              date: milestoneDateInput.value,
              ageMonths: childAgeMonths,
              notes: ms.description || '',
              updatedAt: Date.now()
            };
            onSubmitMilestone(payload);
            // Reflect immediately in active child milestones
            if (child) {
              child.milestones = child.milestones || [];
              if (!child.milestones.some(m => m.key === ms.key)) {
                child.milestones.push(payload);
              }
            }
            renderMilestoneCatalog();
          }
        });

        grid.appendChild(card);
      });
    }

    // Attach Tab Navigation Listeners
    const tabBtns = containerEl.querySelectorAll('.kp-composer-tab');

    function switchTab(tab) {
      if (!tab) return;
      currentModeTab = tab;

      tabBtns.forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      containerEl.querySelectorAll('.kp-pane').forEach(p => {
        const isPaneActive = p.dataset.pane === tab;
        p.classList.toggle('active', isPaneActive);
        p.style.display = isPaneActive ? 'block' : 'none';
      });

      if (tab === 'milestone') {
        renderMilestoneCatalog();
      }
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // Milestone Category Filter Pills
    const catPills = containerEl.querySelectorAll('.kp-cat-pill');
    catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedMilestoneCategory = pill.dataset.cat;
        renderMilestoneCatalog();
      });
    });

    // Add Custom Milestone Button
    const btnAddCustomMs = containerEl.querySelector('#kp-btn-add-custom-ms');
    const inputCustomMsTitle = containerEl.querySelector('#kp-custom-ms-title');
    const selectCustomMsCat = containerEl.querySelector('#kp-custom-ms-cat');
    if (btnAddCustomMs && inputCustomMsTitle) {
      btnAddCustomMs.addEventListener('click', () => {
        const title = (inputCustomMsTitle.value || '').trim();
        if (!title) return;
        const child = getActiveChild();
        const age = child?.birthDate ? formatExactAgeAtDate(child.birthDate, milestoneDateInput.value).ageMonths : 0;
        const payload = {
          id: 'ms-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          childId: currentChildId,
          key: 'custom-' + Date.now(),
          title,
          category: selectCustomMsCat?.value || 'cognitive',
          date: milestoneDateInput.value,
          ageMonths: age,
          notes: 'Custom milestone logged from Quick-Log Composer',
          updatedAt: Date.now()
        };

        if (typeof onSubmitMilestone === 'function') {
          onSubmitMilestone(payload);
        }
        if (child) {
          child.milestones = child.milestones || [];
          child.milestones.push(payload);
        }
        inputCustomMsTitle.value = '';
        renderMilestoneCatalog();
      });
    }

    // Photo OCR Shortcut Button
    const btnTriggerPhotoScan = containerEl.querySelector('#kp-btn-trigger-photo-scan');
    if (btnTriggerPhotoScan) {
      btnTriggerPhotoScan.addEventListener('click', () => {
        if (typeof onOpenPhotoScan === 'function') {
          onOpenPhotoScan(currentChildId);
        }
      });
    }

    // Header Close & Cancel Buttons
    const btnClose = containerEl.querySelector('#kp-btn-composer-close');
    const btnCancel = containerEl.querySelector('#kp-btn-cancel-vitals');
    const handleClose = () => {
      if (typeof onCancel === 'function') onCancel();
    };
    if (btnClose) btnClose.addEventListener('click', handleClose);
    if (btnCancel) btnCancel.addEventListener('click', handleClose);

    // Save Checkup Button (Partial Entry Validation)
    const btnSaveVitals = containerEl.querySelector('#kp-btn-save-vitals');
    if (btnSaveVitals) {
      btnSaveVitals.addEventListener('click', () => {
        syncDraftFromInputs();

        const h = currentDraftValues.heightCm;
        const w = currentDraftValues.weightKg;
        const hd = currentDraftValues.headCm || currentDraftValues.headCircumferenceCm;

        // Partial entry: require at least one biometric
        if ((h == null || h <= 0) && (w == null || w <= 0) && (hd == null || hd <= 0)) {
          alert('Please enter at least one measurement (Height, Weight, or Head Circumference) to save.');
          return;
        }

        const child = getActiveChild();
        const visitDate = dateInput.value;
        const ageMonths = child?.birthDate ? formatExactAgeAtDate(child.birthDate, visitDate, child.gestationalWeeks).ageMonths : 0;

        const measurement = {
          id: initialMeasurement?.id || ('m-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)),
          childId: currentChildId,
          date: visitDate,
          ageMonths: ageMonths,
          heightCm: h !== undefined && h !== null && h > 0 ? h : null,
          weightKg: w !== undefined && w !== null && w > 0 ? w : null,
          headCm: hd !== undefined && hd !== null && hd > 0 ? hd : null,
          headCircumferenceCm: hd !== undefined && hd !== null && hd > 0 ? hd : null, // mirrored!
          visitType: visitTypeSelect.value,
          provider: (providerInput.value || '').trim(),
          notes: (notesTextarea.value || '').trim(),
          updatedAt: Date.now()
        };

        if (typeof onSubmit === 'function') {
          onSubmit(measurement, currentChildId);
        }
      });
    }

    // Date change listener
    dateInput.addEventListener('change', () => {
      recalculate();
      renderPresets();
    });

    // Public Controller API
    function setChild(id) {
      currentChildId = id;
      renderChildPills();
      renderPresets();
      recalculate();
    }

    function setFamilyState(newState) {
      familyState = newState;
      renderChildPills();
      renderPresets();
      recalculate();
    }

    function setUnitSystem(system) {
      if (currentUnitSystem === system) return;
      currentUnitSystem = system;
      renderBiometricsForm();
      recalculate();
    }

    function setValues(meas) {
      if (!meas) return;
      currentDraftValues = { ...meas };
      if (meas.date) dateInput.value = meas.date;
      if (meas.visitType) visitTypeSelect.value = meas.visitType;
      if (meas.provider) providerInput.value = meas.provider;
      if (meas.notes) notesTextarea.value = meas.notes;
      renderBiometricsForm();
      recalculate();
    }

    function prefillAtAge(ageMonths, childId) {
      if (childId) currentChildId = childId;
      const child = getActiveChild();
      let numMonths = 0;
      let label = '';

      if (typeof ageMonths === 'number') {
        numMonths = ageMonths;
        label = `${numMonths} Month Well-Child Visit`;
      } else if (typeof ageMonths === 'string') {
        const m = ageMonths.match(/(\d+(\.\d+)?)/);
        numMonths = m ? parseFloat(m[1]) : 0;
        label = ageMonths;
      } else if (typeof ageMonths === 'object' && ageMonths !== null) {
        numMonths = typeof ageMonths.months === 'number' ? ageMonths.months : (parseFloat(ageMonths.ageMonths) || 0);
        label = ageMonths.label || `${numMonths} Month Well-Child Visit`;
      }

      if (child && child.birthDate) {
        dateInput.value = addMonthsToDate(child.birthDate, numMonths);
      }
      visitTypeSelect.value = 'well-child';
      notesTextarea.value = label;
      renderChildPills();
      renderPresets();
      recalculate();
    }

    function focusFirst() {
      const firstInput = biometricsCard?.querySelector('input');
      if (firstInput) firstInput.focus();
    }

    function destroy() {
      containerEl.innerHTML = '';
      containerEl.classList.remove('kp-composer-mounted');
    }

    // Initial render
    renderChildPills();
    renderPresets();
    renderBiometricsForm();
    recalculate();

    if (preset) {
      prefillAtAge(preset, currentChildId);
    }

    if (currentModeTab && currentModeTab !== 'vitals') {
      switchTab(currentModeTab);
    }

    return {
      setChild,
      setFamilyState,
      setUnitSystem,
      setValues,
      setTab: switchTab,
      prefillAtAge,
      focusFirst,
      destroy
    };
  }

  // =========================================================================
  // 5. INLINE LEDGER ROW EDITOR (`mountInlineRowEditor`)
  // =========================================================================

  /**
   * Turn a table row (`trEl`) into an active inline editor.
   * Enter saves, Esc cancels. Mirrors headCircumferenceCm and sets updatedAt: Date.now().
   */
  function mountInlineRowEditor(trEl, options = {}) {
    if (!trEl) throw new Error('mountInlineRowEditor requires a valid <tr> element');

    const {
      measurement = {},
      child = null,
      unitSystem = 'metric',
      onSave = null,
      onCancel = null
    } = options;

    const colCount = trEl.children ? trEl.children.length : 9;
    const showChildCol = options.showChildColumn !== undefined ? options.showChildColumn : (colCount !== 8);
    const originalHtml = trEl.innerHTML;
    const isImp = unitSystem === 'imperial';

    // Format current values
    const lenDual = formatLengthDual(measurement.heightCm);
    const wtDual = formatWeightDual(measurement.weightKg);
    const hdDual = formatHeadDual(measurement.headCm || measurement.headCircumferenceCm);

    trEl.classList.add('kp-inline-editing-row');
    trEl.innerHTML = `
      <td>
        <input type="date" class="kp-inline-input kp-inline-date" value="${measurement.date || ''}" required />
      </td>
      ${showChildCol ? `
      <td>
        <span class="kp-inline-child-badge" style="border-left: 3px solid ${child?.color || '#C85A32'}; padding-left: 6px;">
          ${child?.name || 'Child'}
        </span>
      </td>
      ` : ''}
      <td class="tabular-nums">
        <span class="kp-inline-age" id="kp-inline-age-cell">
          ${child?.birthDate ? formatExactAgeAtDate(child.birthDate, measurement.date || '').chronologicalLabel : `${measurement.ageMonths || 0}m`}
        </span>
      </td>
      <td class="tabular-nums">
        ${isImp ? `
          <div class="kp-inline-dual">
            <input type="number" step="1" min="0" max="7" class="kp-inline-input kp-in-ht-ft" placeholder="ft" value="${lenDual ? lenDual.ft : ''}" style="width:36px;" />'
            <input type="number" step="0.1" min="0" max="11.9" class="kp-inline-input kp-in-ht-in" placeholder="in" value="${lenDual ? lenDual.inches : ''}" style="width:48px;" />"
          </div>
        ` : `
          <div class="kp-inline-unit-wrap">
            <input type="number" step="0.1" class="kp-inline-input kp-in-ht-cm" value="${measurement.heightCm != null ? measurement.heightCm : ''}" style="width:68px;" />
            <small>cm</small>
          </div>
        `}
      </td>
      <td class="tabular-nums">
        ${isImp ? `
          <div class="kp-inline-dual">
            <input type="number" step="1" min="0" max="250" class="kp-inline-input kp-in-wt-lb" placeholder="lb" value="${wtDual ? wtDual.lb : ''}" style="width:44px;" />lb
            <input type="number" step="0.1" min="0" max="15.9" class="kp-inline-input kp-in-wt-oz" placeholder="oz" value="${wtDual ? wtDual.oz : ''}" style="width:44px;" />oz
          </div>
        ` : `
          <div class="kp-inline-unit-wrap">
            <input type="number" step="0.01" class="kp-inline-input kp-in-wt-kg" value="${measurement.weightKg != null ? measurement.weightKg : ''}" style="width:68px;" />
            <small>kg</small>
          </div>
        `}
      </td>
      <td class="tabular-nums">
        ${isImp ? `
          <div class="kp-inline-unit-wrap">
            <input type="number" step="0.1" class="kp-inline-input kp-in-hd-in" value="${hdDual ? hdDual.inches : ''}" style="width:54px;" />
            <small>in</small>
          </div>
        ` : `
          <div class="kp-inline-unit-wrap">
            <input type="number" step="0.1" class="kp-inline-input kp-in-hd-cm" value="${(measurement.headCm || measurement.headCircumferenceCm) != null ? (measurement.headCm || measurement.headCircumferenceCm) : ''}" style="width:58px;" />
            <small>cm</small>
          </div>
        `}
      </td>
      <td class="tabular-nums">
        <span style="font-size:0.75rem; color:var(--ink-muted);">Auto</span>
      </td>
      <td>
        <input type="text" class="kp-inline-input kp-in-notes" value="${measurement.notes || ''}" placeholder="Notes" style="width:100%; min-width:90px;" />
      </td>
      <td style="text-align: right; white-space: nowrap;">
        <button type="button" class="kp-btn-inline kp-btn-inline-save" title="Save changes (Enter)">✓</button>
        <button type="button" class="kp-btn-inline kp-btn-inline-cancel" title="Cancel (Esc)">✕</button>
      </td>
    `;

    const dateEl = trEl.querySelector('.kp-inline-date');
    const ageCell = trEl.querySelector('#kp-inline-age-cell');
    const notesEl = trEl.querySelector('.kp-in-notes');
    const saveBtn = trEl.querySelector('.kp-btn-inline-save');
    const cancelBtn = trEl.querySelector('.kp-btn-inline-cancel');

    if (dateEl && child?.birthDate) {
      dateEl.addEventListener('change', () => {
        if (ageCell) {
          ageCell.textContent = formatExactAgeAtDate(child.birthDate, dateEl.value).chronologicalLabel;
        }
      });
    }

    function doSave() {
      const dateVal = dateEl.value;
      let heightCm = null;
      let weightKg = null;
      let headCm = null;

      if (!isImp) {
        heightCm = parseFlexibleLengthCm({ cm: trEl.querySelector('.kp-in-ht-cm')?.value });
        weightKg = parseFlexibleWeightKg({ kg: trEl.querySelector('.kp-in-wt-kg')?.value });
        headCm = parseFlexibleHeadCm({ cm: trEl.querySelector('.kp-in-hd-cm')?.value });
      } else {
        const ft = trEl.querySelector('.kp-in-ht-ft')?.value;
        const inVal = trEl.querySelector('.kp-in-ht-in')?.value;
        heightCm = parseFlexibleLengthCm({ ft, inches: inVal });

        const lb = trEl.querySelector('.kp-in-wt-lb')?.value;
        const oz = trEl.querySelector('.kp-in-wt-oz')?.value;
        weightKg = parseFlexibleWeightKg({ lb, oz });

        const inHd = trEl.querySelector('.kp-in-hd-in')?.value;
        headCm = parseFlexibleHeadCm({ inches: inHd });
      }

      if ((heightCm == null || heightCm <= 0) && (weightKg == null || weightKg <= 0) && (headCm == null || headCm <= 0)) {
        alert('Please provide at least one valid measurement (Height, Weight, or Head).');
        return;
      }

      const ageMonths = child?.birthDate ? formatExactAgeAtDate(child.birthDate, dateVal, child.gestationalWeeks).ageMonths : measurement.ageMonths;

      const updated = {
        ...measurement,
        date: dateVal,
        ageMonths,
        heightCm,
        weightKg,
        headCm,
        headCircumferenceCm: headCm, // mirrored!
        notes: (notesEl?.value || '').trim(),
        updatedAt: Date.now()
      };

      trEl.classList.remove('kp-inline-editing-row');
      if (typeof onSave === 'function') {
        onSave(updated);
      }
    }

    function doCancel() {
      trEl.classList.remove('kp-inline-editing-row');
      trEl.innerHTML = originalHtml;
      if (typeof onCancel === 'function') {
        onCancel();
      }
    }

    saveBtn.addEventListener('click', doSave);
    cancelBtn.addEventListener('click', doCancel);

    // Enter & Esc keyboard triggers
    trEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        doCancel();
      }
    });

    // Focus first input
    dateEl?.focus();
  }

  // =========================================================================
  // 6. DYNAMIC 1..N FAMILY & ONBOARDING REPEATER (`mountFamilyChildrenRepeater`)
  // =========================================================================

  /**
   * Mount dynamic 1..N family children form cards with dual-unit parent heights,
   * gestational week inputs (strictly step="0.5"), and tombstone tracking.
   */
  function mountFamilyChildrenRepeater(containerEl, options = {}) {
    if (!containerEl) throw new Error('mountFamilyChildrenRepeater requires a valid container element');

    let {
      children = [],
      parents = {},
      unitSystem = 'metric',
      isOnboarding = false,
      onChange = null
    } = options;

    let currentChildren = Array.isArray(children) && children.length > 0
      ? JSON.parse(JSON.stringify(children))
      : [
          {
            id: 'child-1',
            name: '',
            sex: 'M',
            birthDate: '',
            gestationalWeeks: 40.0,
            color: CHILD_PALETTE[0],
            measurements: [],
            milestones: []
          }
        ];

    let currentParents = { ...parents };
    const removedTombstoneIds = [];

    containerEl.classList.add('kp-repeater-mounted');

    function render() {
      const isImp = unitSystem === 'imperial';
      const mDual = formatLengthDual(currentParents.motherHeightCm);
      const fDual = formatLengthDual(currentParents.fatherHeightCm);

      containerEl.innerHTML = `
        <div class="kp-repeater-wrapper">
          <!-- Parents Genetic Heights Section -->
          <div class="kp-repeater-parents-card">
            <h4 class="kp-section-title">Mid-Parental Genetic Target Heights</h4>
            <p class="kp-section-subtitle">Used for mid-parental adult height projection & percentile channels.</p>
            
            <div class="kp-parents-grid">
              <div class="kp-parent-field">
                <label class="kp-field-label">Mother's Height</label>
                ${isImp ? `
                  <div class="kp-dual-inputs">
                    <div class="kp-input-affix-wrap">
                      <input type="number" step="1" min="3" max="7" class="kp-input kp-p-ht-ft" id="kp-mom-ft" placeholder="5" value="${mDual ? mDual.ft : ''}" />
                      <span class="kp-affix">ft</span>
                    </div>
                    <div class="kp-input-affix-wrap">
                      <input type="number" step="0.5" min="0" max="11.9" class="kp-input kp-p-ht-in" id="kp-mom-in" placeholder="5" value="${mDual ? mDual.inches : ''}" />
                      <span class="kp-affix">in</span>
                    </div>
                  </div>
                ` : `
                  <div class="kp-input-affix-wrap">
                    <input type="number" step="0.5" min="100" max="230" class="kp-input" id="kp-mom-cm" placeholder="165" value="${currentParents.motherHeightCm != null ? currentParents.motherHeightCm : ''}" />
                    <span class="kp-affix">cm</span>
                  </div>
                `}
              </div>

              <div class="kp-parent-field">
                <label class="kp-field-label">Father's Height</label>
                ${isImp ? `
                  <div class="kp-dual-inputs">
                    <div class="kp-input-affix-wrap">
                      <input type="number" step="1" min="3" max="7" class="kp-input kp-p-ht-ft" id="kp-dad-ft" placeholder="5" value="${fDual ? fDual.ft : ''}" />
                      <span class="kp-affix">ft</span>
                    </div>
                    <div class="kp-input-affix-wrap">
                      <input type="number" step="0.5" min="0" max="11.9" class="kp-input kp-p-ht-in" id="kp-dad-in" placeholder="10" value="${fDual ? fDual.inches : ''}" />
                      <span class="kp-affix">in</span>
                    </div>
                  </div>
                ` : `
                  <div class="kp-input-affix-wrap">
                    <input type="number" step="0.5" min="100" max="230" class="kp-input" id="kp-dad-cm" placeholder="178" value="${currentParents.fatherHeightCm != null ? currentParents.fatherHeightCm : ''}" />
                    <span class="kp-affix">cm</span>
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Children Cards Header -->
          <div class="kp-children-cards-header">
            <h4 class="kp-section-title">Children (${currentChildren.length})</h4>
            <p class="kp-section-subtitle">Add 1, 2, or 3+ children to your family studio.</p>
          </div>

          <!-- Children Cards List -->
          <div class="kp-children-cards-list" id="kp-cards-container"></div>

          <!-- Add Child Button -->
          <div class="kp-add-child-action">
            <button type="button" class="kp-btn kp-btn-secondary kp-btn-add-child" id="kp-btn-add-child-card">
              + Add Another Child
            </button>
          </div>
        </div>
      `;

      renderChildCards();
      attachParentListeners();
    }

    function renderChildCards() {
      const cardsList = containerEl.querySelector('#kp-cards-container');
      if (!cardsList) return;
      cardsList.innerHTML = '';

      currentChildren.forEach((child, index) => {
        const card = document.createElement('div');
        card.className = 'kp-child-card';
        card.dataset.index = index;
        card.style.borderLeft = `4px solid ${child.color || CHILD_PALETTE[index % CHILD_PALETTE.length]}`;

        card.innerHTML = `
          <div class="kp-card-header">
            <div class="kp-card-title-group">
              <span class="kp-card-badge-num">Child ${index + 1}</span>
              <span class="kp-card-child-name">${child.name || 'Untitled'}</span>
            </div>
            ${currentChildren.length > 1 ? `
              <button type="button" class="kp-btn-remove-child" data-index="${index}" title="Remove Child">✕ Remove</button>
            ` : ''}
          </div>

          <div class="kp-card-fields-grid">
            <div class="kp-field-group">
              <label class="kp-field-label" for="kp-c-name-${index}">Child's Name</label>
              <input type="text" id="kp-c-name-${index}" class="kp-input kp-child-name-input" value="${child.name || ''}" placeholder="e.g. Leo, Maya" required />
            </div>

            <div class="kp-field-group">
              <label class="kp-field-label" for="kp-c-sex-${index}">Biological Sex</label>
              <select id="kp-c-sex-${index}" class="kp-select kp-child-sex-select">
                <option value="M" ${child.sex === 'M' || child.gender === 'M' ? 'selected' : ''}>Male (Boy)</option>
                <option value="F" ${child.sex === 'F' || child.gender === 'F' ? 'selected' : ''}>Female (Girl)</option>
              </select>
            </div>

            <div class="kp-field-group">
              <label class="kp-field-label" for="kp-c-dob-${index}">Date of Birth</label>
              <input type="date" id="kp-c-dob-${index}" class="kp-input kp-child-dob-input" value="${child.birthDate || child.dob || ''}" required />
            </div>

            <div class="kp-field-group">
              <label class="kp-field-label" for="kp-c-gest-${index}">Gestational Weeks</label>
              <!-- Invariant #5: strictly type="number" min="22" max="44" step="0.5" -->
              <input type="number" id="kp-c-gest-${index}" min="22" max="44" step="0.5" class="kp-input kp-child-gest-input"
                value="${child.gestationalWeeks != null ? child.gestationalWeeks : 40.0}" />
              <small class="kp-help-text">Full term: 37–42 wks (40.0 default). Corrected age applies if &lt;37 wks.</small>
            </div>
          </div>

          <!-- Color Swatch Picker -->
          <div class="kp-card-color-picker">
            <span class="kp-color-picker-label">Accent Theme:</span>
            <div class="kp-palette-swatches">
              ${CHILD_PALETTE.map(color => `
                <button type="button" class="kp-swatch-dot ${child.color === color ? 'active' : ''}"
                  data-color="${color}" data-index="${index}" style="background-color: ${color};"
                  title="Select theme ${color}">
                </button>
              `).join('')}
            </div>
          </div>
        `;

        cardsList.appendChild(card);
      });

      attachChildCardListeners();
    }

    function attachParentListeners() {
      const isImp = unitSystem === 'imperial';
      if (!isImp) {
        const momCm = containerEl.querySelector('#kp-mom-cm');
        const dadCm = containerEl.querySelector('#kp-dad-cm');
        if (momCm) momCm.addEventListener('input', () => { currentParents.motherHeightCm = parseFlexibleLengthCm({ cm: momCm.value }); triggerChange(); });
        if (dadCm) dadCm.addEventListener('input', () => { currentParents.fatherHeightCm = parseFlexibleLengthCm({ cm: dadCm.value }); triggerChange(); });
      } else {
        const momFt = containerEl.querySelector('#kp-mom-ft');
        const momIn = containerEl.querySelector('#kp-mom-in');
        const dadFt = containerEl.querySelector('#kp-dad-ft');
        const dadIn = containerEl.querySelector('#kp-dad-in');

        const updateMom = () => { currentParents.motherHeightCm = parseFlexibleLengthCm({ ft: momFt?.value, inches: momIn?.value }); triggerChange(); };
        const updateDad = () => { currentParents.fatherHeightCm = parseFlexibleLengthCm({ ft: dadFt?.value, inches: dadIn?.value }); triggerChange(); };

        if (momFt) momFt.addEventListener('input', updateMom);
        if (momIn) momIn.addEventListener('input', updateMom);
        if (dadFt) dadFt.addEventListener('input', updateDad);
        if (dadIn) dadIn.addEventListener('input', updateDad);
      }

      // Add child card button
      const btnAdd = containerEl.querySelector('#kp-btn-add-child-card');
      if (btnAdd) {
        btnAdd.addEventListener('click', () => {
          addChildCard();
        });
      }
    }

    function attachChildCardListeners() {
      const cardsList = containerEl.querySelector('#kp-cards-container');
      if (!cardsList) return;

      // Inputs change
      currentChildren.forEach((child, index) => {
        const nameInput = cardsList.querySelector(`#kp-c-name-${index}`);
        const sexSelect = cardsList.querySelector(`#kp-c-sex-${index}`);
        const dobInput = cardsList.querySelector(`#kp-c-dob-${index}`);
        const gestInput = cardsList.querySelector(`#kp-c-gest-${index}`);

        if (nameInput) {
          nameInput.addEventListener('input', () => {
            child.name = nameInput.value.trim();
            const titleSpan = cardsList.querySelector(`[data-index="${index}"] .kp-card-child-name`);
            if (titleSpan) titleSpan.textContent = child.name || 'Untitled';
            triggerChange();
          });
        }

        if (sexSelect) {
          sexSelect.addEventListener('change', () => {
            child.sex = sexSelect.value;
            triggerChange();
          });
        }

        if (dobInput) {
          dobInput.addEventListener('change', () => {
            child.birthDate = dobInput.value;
            triggerChange();
          });
        }

        if (gestInput) {
          gestInput.addEventListener('input', () => {
            child.gestationalWeeks = parseFloat(gestInput.value) || 40.0;
            triggerChange();
          });
        }
      });

      // Swatch pickers
      const swatches = cardsList.querySelectorAll('.kp-swatch-dot');
      swatches.forEach(sw => {
        sw.addEventListener('click', () => {
          const idx = parseInt(sw.dataset.index, 10);
          const color = sw.dataset.color;
          if (currentChildren[idx]) {
            currentChildren[idx].color = color;
            renderChildCards();
            triggerChange();
          }
        });
      });

      // Remove child buttons
      const removeBtns = cardsList.querySelectorAll('.kp-btn-remove-child');
      removeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          removeChildCard(idx);
        });
      });
    }

    function removeChildCard(index) {
      if (currentChildren.length <= 1) return;
      const removed = currentChildren.splice(index, 1)[0];

      // Invariant #3: Tombstone child ID and all associated measurements & milestones
      if (removed && removed.id) {
        if (!removedTombstoneIds.includes(removed.id)) removedTombstoneIds.push(removed.id);
        (removed.measurements || []).forEach(m => {
          if (m.id && !removedTombstoneIds.includes(m.id)) removedTombstoneIds.push(m.id);
        });
        (removed.milestones || []).forEach(ms => {
          if (ms.id && !removedTombstoneIds.includes(ms.id)) removedTombstoneIds.push(ms.id);
        });
      }

      renderChildCards();
      triggerChange();
    }

    function addChildCard(childData) {
      const nextIndex = currentChildren.length;
      const nextColor = CHILD_PALETTE[nextIndex % CHILD_PALETTE.length];
      const newChild = childData || {
        id: 'child-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: '',
        sex: nextIndex % 2 === 0 ? 'M' : 'F',
        birthDate: '',
        gestationalWeeks: 40.0,
        color: nextColor,
        measurements: [],
        milestones: []
      };

      currentChildren.push(newChild);
      renderChildCards();
      triggerChange();

      // Focus new name input
      setTimeout(() => {
        const input = containerEl.querySelector(`#kp-c-name-${nextIndex}`);
        if (input) input.focus();
      }, 50);
    }

    function triggerChange() {
      if (typeof onChange === 'function') {
        onChange(getPayload());
      }
    }

    function getPayload() {
      return {
        children: currentChildren.map(c => ({
          ...c,
          gestationalWeeks: Number(c.gestationalWeeks) || 40.0,
          updatedAt: Date.now()
        })),
        parents: {
          fatherHeightCm: currentParents.fatherHeightCm || null,
          motherHeightCm: currentParents.motherHeightCm || null,
          updatedAt: Date.now()
        },
        removedTombstoneIds: [...removedTombstoneIds]
      };
    }

    function destroy() {
      containerEl.innerHTML = '';
      containerEl.classList.remove('kp-repeater-mounted');
    }

    render();

    return {
      getPayload,
      addChildCard,
      destroy
    };
  }

  // =========================================================================
  // 7. CRDT-SAFE UNDO MANAGER & FLOATING TOAST (`createUndoManager`)
  // =========================================================================

  /**
   * Factory for CRDT-Safe Undo Manager.
   * When undoing a delete: strips tombstonedIds from deletedIds and stamps updatedAt: Date.now() on restored records.
   * When undoing an add: pushes createdIds into deletedIds and stamps updatedAt: Date.now().
   */
  function createUndoManager(options = {}) {
    const {
      maxDepth = 20,
      onRestore = null,
      toastContainer = null
    } = options;

    const history = [];
    let activeToastEl = null;
    let toastTimeout = null;

    /**
     * Record an actionable state change.
     * Supports both recordAction({ label, prevStateSnapshot, createdIds, tombstonedIds })
     * and recordAction(label, prevStateSnapshot, createdIds, tombstonedIds).
     */
    function recordAction(arg1, arg2, arg3, arg4) {
      let label = '';
      let prevStateSnapshot = null;
      let createdIds = [];
      let tombstonedIds = [];

      if (typeof arg1 === 'object' && arg1 !== null && arg2 === undefined) {
        label = arg1.label || 'Action';
        prevStateSnapshot = arg1.prevStateSnapshot || arg1.prevFamilyStateClone;
        createdIds = arg1.createdIds || [];
        tombstonedIds = arg1.tombstonedIds || [];
      } else {
        label = arg1 || 'Action';
        prevStateSnapshot = arg2;
        createdIds = arg3 || [];
        tombstonedIds = arg4 || [];
      }

      if (!prevStateSnapshot) return;

      history.push({
        label,
        prevStateSnapshot: JSON.parse(JSON.stringify(prevStateSnapshot)),
        createdIds: Array.isArray(createdIds) ? [...createdIds] : [createdIds],
        tombstonedIds: Array.isArray(tombstonedIds) ? [...tombstonedIds] : [tombstonedIds],
        recordedAt: Date.now()
      });

      if (history.length > maxDepth) {
        history.shift();
      }

      showToast(label);
    }

    /**
     * Execute CRDT-Safe Undo.
     * Restores previous snapshot with correct tombstone reversals.
     */
    function undo() {
      if (history.length === 0) return null;
      const action = history.pop();
      const restoredState = JSON.parse(JSON.stringify(action.prevStateSnapshot));
      const now = Date.now();

      // Case 1: Undoing a delete action -> remove tombstonedIds from deletedIds and re-timestamp restored items
      if (action.tombstonedIds && action.tombstonedIds.length > 0) {
        const tombSet = new Set(action.tombstonedIds);

        if (Array.isArray(restoredState.deletedIds)) {
          restoredState.deletedIds = restoredState.deletedIds.filter(id => !tombSet.has(id));
        }

        if (Array.isArray(restoredState.children)) {
          restoredState.children.forEach(child => {
            if (tombSet.has(child.id)) child.updatedAt = now;
            if (Array.isArray(child.measurements)) {
              child.measurements.forEach(m => {
                if (tombSet.has(m.id)) m.updatedAt = now;
              });
            }
            if (Array.isArray(child.milestones)) {
              child.milestones.forEach(ms => {
                if (tombSet.has(ms.id)) ms.updatedAt = now;
              });
            }
          });
        }
      }

      // Case 2: Undoing an add action -> add createdIds to deletedIds (tombstone them)
      if (action.createdIds && action.createdIds.length > 0) {
        const delSet = new Set(restoredState.deletedIds || []);
        action.createdIds.forEach(id => delSet.add(id));
        restoredState.deletedIds = Array.from(delSet);

        // Also purge created items from children arrays
        const createSet = new Set(action.createdIds);
        if (Array.isArray(restoredState.children)) {
          restoredState.children = restoredState.children.filter(c => !createSet.has(c.id));
          restoredState.children.forEach(child => {
            if (Array.isArray(child.measurements)) {
              child.measurements = child.measurements.filter(m => !createSet.has(m.id));
            }
            if (Array.isArray(child.milestones)) {
              child.milestones = child.milestones.filter(ms => !createSet.has(ms.id));
            }
          });
        }
      }

      // Always stamp state.updatedAt = Date.now() so SyncManager propagates restoration
      restoredState.updatedAt = now;

      dismissToast();

      if (typeof onRestore === 'function') {
        onRestore(restoredState, action);
      }

      return restoredState;
    }

    function canUndo() {
      return history.length > 0;
    }

    function peekLabel() {
      return history.length > 0 ? history[history.length - 1].label : null;
    }

    function clear() {
      history.length = 0;
      dismissToast();
    }

    function showToast(label) {
      if (typeof document === 'undefined') return;

      dismissToast();

      const container = toastContainer || document.getElementById('toast-container') || document.body;
      const toast = document.createElement('div');
      toast.className = 'kp-undo-toast';
      toast.innerHTML = `
        <div class="kp-toast-main">
          <span class="kp-toast-label">${label}</span>
          <button type="button" class="kp-toast-btn-undo" id="kp-toast-undo-btn">Undo</button>
          <button type="button" class="kp-toast-btn-close" id="kp-toast-close-btn" aria-label="Dismiss">✕</button>
        </div>
        <div class="kp-toast-progress-track">
          <div class="kp-toast-progress-bar"></div>
        </div>
      `;

      const undoBtn = toast.querySelector('#kp-toast-undo-btn');
      const closeBtn = toast.querySelector('#kp-toast-close-btn');

      if (undoBtn) undoBtn.addEventListener('click', () => undo());
      if (closeBtn) closeBtn.addEventListener('click', () => dismissToast());

      container.appendChild(toast);
      activeToastEl = toast;

      // Auto dismiss after 8 seconds
      toastTimeout = setTimeout(() => {
        dismissToast();
      }, 8000);
    }

    function dismissToast() {
      if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
      }
      if (activeToastEl && activeToastEl.parentNode) {
        activeToastEl.classList.add('kp-toast-hiding');
        setTimeout(() => {
          if (activeToastEl && activeToastEl.parentNode) {
            activeToastEl.parentNode.removeChild(activeToastEl);
          }
          activeToastEl = null;
        }, 200);
      }
    }

    return {
      recordAction,
      undo,
      canUndo,
      peekLabel,
      clear,
      showToast,
      dismissToast
    };
  }

  // =========================================================================
  // 8. KEYBOARD SHORTCUTS & CHEAT-SHEET MODAL
  // =========================================================================

  /**
   * Bind global keyboard shortcuts (`L`, `M`, `U`, `1`–`6`, `[` / `]`, `Cmd+Z`, `?`).
   * Ignores keystrokes inside input, textarea, select, or contenteditable.
   * Returns unbind function.
   */
  function bindKeyboardShortcuts(handlers = {}) {
    if (typeof window === 'undefined') return () => {};

    const {
      onQuickLog = null,
      onQuickMilestone = null,
      onToggleUnits = null,
      onSwitchWorkspace = null,
      onCycleChild = null,
      onUndo = null,
      onShowHelp = null
    } = handlers;

    function handleKeyDown(e) {
      const target = e.target;
      const tag = target?.tagName?.toUpperCase();
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;

      // Allow Cmd+Z / Ctrl+Z even inside forms if not native undo
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'z' || e.key === 'Z')) {
        if (!isEditable && typeof onUndo === 'function') {
          e.preventDefault();
          onUndo();
          return;
        }
      }

      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      if (key === 'l' || key === 'L') {
        e.preventDefault();
        if (typeof onQuickLog === 'function') onQuickLog();
      } else if (key === 'm' || key === 'M') {
        e.preventDefault();
        if (typeof onQuickMilestone === 'function') onQuickMilestone();
      } else if (key === 'u' || key === 'U') {
        e.preventDefault();
        if (typeof onToggleUnits === 'function') onToggleUnits();
      } else if (key >= '1' && key <= '6') {
        e.preventDefault();
        const index = parseInt(key, 10) - 1;
        if (typeof onSwitchWorkspace === 'function') onSwitchWorkspace(index);
      } else if (key === '[') {
        e.preventDefault();
        if (typeof onCycleChild === 'function') onCycleChild(-1);
      } else if (key === ']') {
        e.preventDefault();
        if (typeof onCycleChild === 'function') onCycleChild(1);
      } else if (key === '?' || (key === '/' && e.shiftKey)) {
        e.preventDefault();
        if (typeof onShowHelp === 'function') {
          onShowHelp();
        } else {
          showShortcutsModal();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return function unbind() {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Display accessible keyboard shortcuts cheat-sheet modal with tactile <kbd> chips.
   */
  function showShortcutsModal() {
    if (typeof document === 'undefined') return;

    let existing = document.getElementById('kp-shortcuts-modal');
    if (existing) {
      existing.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'kp-shortcuts-modal';
    modal.className = 'kp-modal-overlay active';
    modal.innerHTML = `
      <div class="kp-modal-box kp-shortcuts-box">
        <header class="kp-modal-header">
          <div class="kp-modal-title-row">
            <span class="kp-modal-icon">⌨️</span>
            <h3>KinSprout Keyboard Shortcuts</h3>
          </div>
          <button type="button" class="kp-btn-close-modal" id="kp-btn-close-shortcuts" aria-label="Close">✕</button>
        </header>

        <div class="kp-shortcuts-grid">
          <div class="kp-shortcut-item">
            <kbd>L</kbd>
            <span>Open Quick-Log Drawer</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>M</kbd>
            <span>1-Tap Milestone Log</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>U</kbd>
            <span>Toggle Units (Metric / Imperial)</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>1</kbd>–<kbd>6</kbd>
            <span>Switch Workspace (Hub, Deep-Dive, Sibling, Photo, Ledger, Sync)</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>[</kbd> / <kbd>]</kbd>
            <span>Cycle Previous / Next Child</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd>
            <span>Undo Last Action (CRDT Safe)</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>?</kbd>
            <span>Show Keyboard Shortcuts Cheat-Sheet</span>
          </div>
          <div class="kp-shortcut-item">
            <kbd>Esc</kbd>
            <span>Close Active Drawer or Modal</span>
          </div>
        </div>

        <div class="kp-modal-footer">
          <button type="button" class="kp-btn kp-btn-secondary" id="kp-btn-dismiss-shortcuts">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      document.removeEventListener('keydown', handleEsc);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleEsc);
    modal.querySelector('#kp-btn-close-shortcuts')?.addEventListener('click', close);
    modal.querySelector('#kp-btn-dismiss-shortcuts')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  // =========================================================================
  // MODULE EXPORTS
  // =========================================================================

  return {
    // Dual-Unit Parsers & Formatters
    parseFlexibleLengthCm,
    formatLengthDual,
    parseFlexibleWeightKg,
    formatWeightDual,
    parseFlexibleHeadCm,
    formatHeadDual,

    // AAP Visit Date Presets & Live Age
    getCheckupDatePresets,
    formatExactAgeAtDate,

    // Live Plausibility & Unit-Swap Guardrail
    checkMeasurementPlausibility,

    // Slide-Over Quick-Log Composer
    mountMeasurementComposer,

    // Inline Ledger Row Editor
    mountInlineRowEditor,

    // Dynamic 1..N Family Repeater
    mountFamilyChildrenRepeater,

    // CRDT-Safe Undo Manager
    createUndoManager,

    // Keyboard Shortcuts
    bindKeyboardShortcuts,
    showShortcutsModal,

    // Constants & Catalogs
    CHILD_PALETTE,
    AAP_PRESET_SCHEDULE,
    CDC_MILESTONES
  };
}));
