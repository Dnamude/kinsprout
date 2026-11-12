/**
 * KinSprout 2.0 — Family Command Center & Clinical Deep-Dive Studio
 * Module: DeepDiveStudio (Dual UMD: window.DeepDiveStudio + module.exports)
 * 
 * Features:
 * 1. renderFamilyOverview:
 *    - Adaptive 1..N Child Spotlight Grid (#family-roster-grid)
 *    - Household Clinical Action Strip (Aggregated AAP alerts, Sibling Comparison, OCR)
 *    - Child cards with Sparklines, Vitals, Velocity & AAP Badges
 * 2. render (Single-Child Studio):
 *    - Child Clinical Hero Strip (Prematurity corrected age, canalization pill, CTAs)
 *    - 5 Sub-Navigation Lenses:
 *      * Lens 1: Growth Trajectories (Single Inspector vs 2x2 Quad-Grid, Zoom, Y-Mode, Popover, Click-to-Add)
 *      * Lens 2: Velocity & Spurts (cm/yr & kg/yr charts, Canalization Table, BMI Adiposity Rebound)
 *      * Lens 3: Genetics & Sizing (Tanner Mid-Parental Visual Ruler, Inline Editor, 4-Season Forecaster)
 *      * Lens 4: AAP Checkups & Milestones (14-Visit Bright Futures Timeline, 1-Tap CDC Milestone Matrix)
 *      * Lens 5: Child Ledger (Filterable Table, Inline Row Editing, Delete, Quick-Log)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./growth-engine.js', './charts.js', './input-controls.js', './sibling-comparison.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      (function () { try { return require('./growth-engine.js'); } catch (e) { return null; } })(),
      (function () { try { return require('./charts.js'); } catch (e) { return null; } })(),
      (function () { try { return require('./input-controls.js'); } catch (e) { return null; } })(),
      (function () { try { return require('./sibling-comparison.js'); } catch (e) { return null; } })()
    );
  } else {
    root.DeepDiveStudio = factory(root.GrowthEngine, root.GrowthCharts, root.InputControls, root.SiblingComparison);
  }
}(typeof self !== 'undefined' ? self : this, function (GrowthEngine, GrowthCharts, InputControls, SiblingComparison) {
  'use strict';

  // Fallback module resolution for browser if arguments were undefined
  if (!GrowthEngine && typeof window !== 'undefined' && window.GrowthEngine) {
    GrowthEngine = window.GrowthEngine;
  }
  if (!GrowthCharts && typeof window !== 'undefined' && window.GrowthCharts) {
    GrowthCharts = window.GrowthCharts;
  }
  if (!InputControls && typeof window !== 'undefined' && window.InputControls) {
    InputControls = window.InputControls;
  }
  if (!SiblingComparison && typeof window !== 'undefined' && window.SiblingComparison) {
    SiblingComparison = window.SiblingComparison;
  }

  // ---------------------------------------------------------------------------
  // CONSTANTS & CATALOGS
  // ---------------------------------------------------------------------------

  var DEFAULT_CHILD_PALETTE = ['#C85A32', '#2E6F5E', '#3B5BDB', '#9C36B5', '#D97706', '#DB2777'];

  // Built-in Curated CDC/AAP Bright Futures Developmental Milestones Catalog (28 milestones)
  var CDC_MILESTONE_CATALOG = [
    { key: 'cdc-2m-social', title: 'Calms when spoken to or picked up', category: 'social', targetAgeMonths: 2, typicalWindow: '1–3m', description: 'Looks at parent face, smiles when talked to.' },
    { key: 'cdc-2m-speech', title: 'Coos and makes gurgling sounds', category: 'speech', targetAgeMonths: 2, typicalWindow: '1–3m', description: 'Turns head toward familiar voices and soft sounds.' },
    { key: 'cdc-2m-motor', title: 'Holds head up during tummy time', category: 'motor', targetAgeMonths: 2, typicalWindow: '1–3m', description: 'Pushes up with arms when lying on tummy.' },
    { key: 'cdc-4m-social', title: 'Smiles spontaneously to get attention', category: 'social', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Chuckles and laughs when you interact or make playful faces.' },
    { key: 'cdc-4m-speech', title: 'Babbles with expression', category: 'speech', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Makes expressive sounds back when talked to; copies sounds heard.' },
    { key: 'cdc-4m-fine', title: 'Reaches for and grasps toys', category: 'motor', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Holds a rattle when placed in hand; brings hands to mouth.' },
    { key: 'cdc-4m-motor', title: 'Rolls from tummy to back', category: 'motor', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Pushes up on elbows; holds head steady unsupported.' },
    { key: 'cdc-6m-social', title: 'Recognizes familiar people & smiles at mirror', category: 'social', targetAgeMonths: 6, typicalWindow: '5–7m', description: 'Knows familiar caregivers; likes to look at reflection in mirror.' },
    { key: 'cdc-6m-speech', title: 'Strings vowel sounds together', category: 'speech', targetAgeMonths: 6, typicalWindow: '5–7m', description: 'Makes sounds like ah, eh, oh; responds to own name with sounds.' },
    { key: 'cdc-6m-motor-roll', title: 'Rolls both ways (tummy to back & back to tummy)', category: 'motor', targetAgeMonths: 6, typicalWindow: '5–7m', description: 'Rolls over in both directions during floor play.' },
    { key: 'cdc-6m-motor-sit', title: 'Sits unsupported briefly', category: 'motor', targetAgeMonths: 6, typicalWindow: '5–7m', description: 'Sits with tripod hand support on playmat.' },
    { key: 'cdc-9m-motor-sit', title: 'Gets into sitting position independently', category: 'motor', targetAgeMonths: 9, typicalWindow: '7–10m', description: 'Moves smoothly from lying down to sitting upright without help.' },
    { key: 'cdc-9m-fine-pincer', title: 'Pincer grasp (thumb and index finger)', category: 'motor', targetAgeMonths: 9, typicalWindow: '8–11m', description: 'Picks up small objects like cereal puffs using thumb and finger.' },
    { key: 'cdc-9m-speech', title: 'Understands "No" and copies gestures', category: 'speech', targetAgeMonths: 9, typicalWindow: '8–10m', description: 'Makes repetitive consonant sounds like mamama, bababa.' },
    { key: 'cdc-9m-motor-crawl', title: 'Crawls on hands and knees', category: 'motor', targetAgeMonths: 9, typicalWindow: '7–10m', description: 'Moves across room on hands and knees or army crawl.' },
    { key: 'cdc-12m-speech', title: 'Says first word ("mama", "dada", or name)', category: 'speech', targetAgeMonths: 12, typicalWindow: '10–14m', description: 'Uses simple word meaningfully to call caregiver or object.' },
    { key: 'cdc-12m-social', title: 'Waves "bye-bye" and plays peek-a-boo', category: 'social', targetAgeMonths: 12, typicalWindow: '10–14m', description: 'Understands simple requests like "come here"; waves goodbye.' },
    { key: 'cdc-12m-motor-stand', title: 'Pulls to stand and cruises furniture', category: 'motor', targetAgeMonths: 12, typicalWindow: '10–13m', description: 'Pulls up to stand and walks holding onto sofa or tables.' },
    { key: 'cdc-12m-motor-steps', title: 'Takes first independent steps', category: 'motor', targetAgeMonths: 12, typicalWindow: '11–15m', description: 'Takes a few confident steps without holding on to anyone or anything.' },
    { key: 'cdc-15m-motor-walk', title: 'Walks well independently', category: 'motor', targetAgeMonths: 15, typicalWindow: '12–16m', description: 'Walks steadily without stumbling frequently.' },
    { key: 'cdc-15m-fine-blocks', title: 'Stacks 2 blocks and drinks from open cup', category: 'motor', targetAgeMonths: 15, typicalWindow: '13–17m', description: 'Stacks two small blocks; drinks from cup with minimal spilling.' },
    { key: 'cdc-15m-speech', title: 'Says 3+ words and points to show interest', category: 'speech', targetAgeMonths: 15, typicalWindow: '13–18m', description: 'Points to ask for something or show something interesting.' },
    { key: 'cdc-18m-speech', title: 'Says 10+ words and points to body parts', category: 'speech', targetAgeMonths: 18, typicalWindow: '16–20m', description: 'Points to at least one body part when asked.' },
    { key: 'cdc-18m-motor', title: 'Walks up steps with help and runs', category: 'motor', targetAgeMonths: 18, typicalWindow: '16–22m', description: 'Walks up stairs holding hand or railing; runs with excitement.' },
    { key: 'cdc-24m-speech', title: 'Says 2-word phrases ("more milk", "big dog")', category: 'speech', targetAgeMonths: 24, typicalWindow: '20–26m', description: 'Strings two words together to express needs or observations.' },
    { key: 'cdc-24m-motor', title: 'Kicks ball forward and jumps with both feet', category: 'motor', targetAgeMonths: 24, typicalWindow: '22–28m', description: 'Kicks a large ball without falling; jumps off floor with both feet.' },
    { key: 'cdc-24m-cognitive', title: 'Sorts shapes and colors', category: 'cognitive', targetAgeMonths: 24, typicalWindow: '22–28m', description: 'Completes simple shape sorters; follows two-step instructions.' },
    { key: 'cdc-36m-speech', title: 'Talks in 3-word sentences and asks "why?"', category: 'speech', targetAgeMonths: 36, typicalWindow: '30–40m', description: 'Carries on a simple conversation of 2–3 sentences.' },
    { key: 'cdc-36m-motor', title: 'Pedals tricycle or balance bike', category: 'motor', targetAgeMonths: 36, typicalWindow: '30–42m', description: 'Pedals a 3-wheel tricycle or glides smoothly on balance bike.' },
    { key: 'cdc-48m-motor', title: 'Hops on one foot and catches bounced ball', category: 'motor', targetAgeMonths: 48, typicalWindow: '42–54m', description: 'Hops and balances on one foot for 2–3 seconds.' },
    { key: 'cdc-60m-social', title: 'Dresses independently & counts to 10+', category: 'cognitive', targetAgeMonths: 60, typicalWindow: '54–66m', description: 'Buttons clothes; counts 10 or more objects accurately.' }
  ];

  // AAP Bright Futures Schedule Defaults (14 visits)
  var AAP_DEFAULT_SCHEDULE = [
    { ageMonths: 0, label: 'Newborn (3–5 Days)', targetAgeMonths: 0.1, focus: 'Weight regain, jaundice screening, feeding frequency' },
    { ageMonths: 1, label: '1 Month Visit', targetAgeMonths: 1, focus: 'HepB dose 2, head control, sleep patterns' },
    { ageMonths: 2, label: '2 Month Visit', targetAgeMonths: 2, focus: 'DTaP, IPV, Hib, PCV, Rotavirus #1; social smiling' },
    { ageMonths: 4, label: '4 Month Visit', targetAgeMonths: 4, focus: 'Vaccine round #2, rolling over, grasping toys' },
    { ageMonths: 6, label: '6 Month Visit', targetAgeMonths: 6, focus: 'Vaccine round #3, solid food introduction, sitting' },
    { ageMonths: 9, label: '9 Month Visit', targetAgeMonths: 9, focus: 'Developmental screening, pincer grasp, object permanence' },
    { ageMonths: 12, label: '12 Month Visit (1 Year)', targetAgeMonths: 12, focus: 'MMR, Varicella, HepA; whole milk transition, first steps' },
    { ageMonths: 15, label: '15 Month Visit', targetAgeMonths: 15, focus: 'DTaP & PCV boosters, expressive vocabulary, walking' },
    { ageMonths: 18, label: '18 Month Visit', targetAgeMonths: 18, focus: 'Autism screening (M-CHAT), 10+ words, running' },
    { ageMonths: 24, label: '24 Month Visit (2 Years)', targetAgeMonths: 24, focus: 'Autism screening #2, 2-word phrases, stairs, potty prep' },
    { ageMonths: 30, label: '30 Month Visit (2.5 Years)', targetAgeMonths: 30, focus: 'Language fluency, jump with both feet, play skills' },
    { ageMonths: 36, label: '36 Month Visit (3 Years)', targetAgeMonths: 36, focus: 'Annual physical, vision check, tricycle pedaling' },
    { ageMonths: 48, label: '48 Month Visit (4 Years)', targetAgeMonths: 48, focus: 'Hearing/vision screening, kindergarten readiness, hops' },
    { ageMonths: 60, label: '60 Month Visit (5 Years)', targetAgeMonths: 60, focus: 'School entry vaccines, letters/numbers, social readiness' }
  ];

  // ---------------------------------------------------------------------------
  // UTILITY & FORMATTING HELPERS
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getChildPalette() {
    if (GrowthEngine && Array.isArray(GrowthEngine.CHILD_PALETTE)) {
      return GrowthEngine.CHILD_PALETTE;
    }
    return DEFAULT_CHILD_PALETTE;
  }

  function getChildColor(child, index) {
    if (child && child.color) return child.color;
    var pal = getChildPalette();
    return pal[(index || 0) % pal.length];
  }

  function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function isFemaleChild(c) {
    if (!c) return false;
    var s = String(c.sex || c.gender || '').trim().toUpperCase();
    return s === 'F' || s === 'FEMALE' || s === 'GIRL';
  }

  function calculateAgeMonths(birthDateStr, targetDateStr) {
    if (!birthDateStr) return 0;
    var effectiveTarget = targetDateStr || new Date().toISOString().slice(0, 10);
    if (GrowthEngine && typeof GrowthEngine.calculateAgeMonths === 'function') {
      try {
        return GrowthEngine.calculateAgeMonths(birthDateStr, effectiveTarget);
      } catch (e) {}
    }
    var b = new Date(birthDateStr);
    var t = new Date(effectiveTarget);
    if (isNaN(b.getTime())) return 0;
    var diffMs = t.getTime() - b.getTime();
    var days = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.round((days / 30.4375) * 10) / 10);
  }

  function safeFormatAge(birthDateStr, targetDateStr) {
    if (!birthDateStr) return 'Age unknown';
    var effectiveTarget = targetDateStr || new Date().toISOString().slice(0, 10);
    var months = calculateAgeMonths(birthDateStr, effectiveTarget);
    if (GrowthEngine && typeof GrowthEngine.formatAge === 'function') {
      try {
        var formatted = GrowthEngine.formatAge(months);
        if (formatted) return formatted;
      } catch (e) {}
    }
    // Fallback age formatter
    var b = new Date(birthDateStr);
    var t = new Date(effectiveTarget);
    if (isNaN(b.getTime())) return 'Age unknown';
    var diffMs = t.getTime() - b.getTime();
    var days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    var years = Math.floor(days / 365.25);
    var remainingDays = days - Math.floor(years * 365.25);
    var remMonths = Math.floor(remainingDays / 30.4375);
    var d = Math.floor(remainingDays - Math.floor(remMonths * 30.4375));
    if (years >= 2) return years + 'y ' + remMonths + 'm ' + d + 'd';
    if (remMonths >= 1) return remMonths + 'm ' + d + 'd';
    return days + 'd';
  }

  function getCorrectedAgeInfo(child, targetDateStr) {
    if (!child || !child.birthDate) return null;
    var gw = Number(child.gestationalWeeks);
    if (!gw || gw >= 37) return null; // Only < 37 weeks is premature

    var chronoAgeMonths = calculateAgeMonths(child.birthDate, targetDateStr);
    if (chronoAgeMonths >= 24) return null; // AAP guidelines stop correction at 24 months

    var weeksEarly = Math.max(0, 40 - gw);
    var daysEarly = Math.round(weeksEarly * 7);

    // Calculate corrected birth date
    var b = new Date(child.birthDate);
    var correctedBirthDate = new Date(b.getTime() + daysEarly * 24 * 60 * 60 * 1000);
    var correctedBirthDateStr = correctedBirthDate.toISOString().slice(0, 10);
    var correctedAgeMonths = calculateAgeMonths(correctedBirthDateStr, targetDateStr);
    var correctedLabel = safeFormatAge(correctedBirthDateStr, targetDateStr);

    return {
      gestationalWeeks: gw,
      weeksEarly: Math.round(weeksEarly * 10) / 10,
      daysEarly: daysEarly,
      chronoAgeMonths: chronoAgeMonths,
      correctedAgeMonths: Math.max(0, correctedAgeMonths),
      correctedLabel: correctedLabel
    };
  }

  function getSortedMeasurements(child) {
    if (!child || !Array.isArray(child.measurements)) return [];
    return child.measurements.slice().sort(function (a, b) {
      if (a.date && b.date && a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.ageMonths || 0) - (b.ageMonths || 0);
    });
  }

  function getLatestMeasurement(child) {
    var list = getSortedMeasurements(child);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  function getPreviousMeasurement(child, latestM) {
    var list = getSortedMeasurements(child);
    if (list.length <= 1) return null;
    if (!latestM) return list[list.length - 2];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].id === latestM.id || (list[i].date === latestM.date && list[i].ageMonths === latestM.ageMonths)) {
        return i > 0 ? list[i - 1] : null;
      }
    }
    return list[list.length - 2];
  }

  function formatOrdinal(n) {
    if (n == null || isNaN(n)) return '—';
    if (GrowthEngine && typeof GrowthEngine.formatOrdinal === 'function') {
      return GrowthEngine.formatOrdinal(n);
    }
    var rounded = Math.round(n);
    var s = ['th', 'st', 'nd', 'rd'];
    var v = rounded % 100;
    return rounded + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getPercentileStats(child, m, metric) {
    if (!child || !m || !metric) return { percentile: null, zScore: null, formatted: '—' };
    if (GrowthEngine && typeof GrowthEngine.statsForMeasurement === 'function') {
      try {
        var res = GrowthEngine.statsForMeasurement(child, m, metric);
        if (res && res.percentile != null) {
          return {
            percentile: res.percentile,
            zScore: res.zScore != null ? Math.round(res.zScore * 100) / 100 : null,
            formatted: formatOrdinal(res.percentile) + ' %ile'
          };
        }
      } catch (e) {}
    }
    return { percentile: null, zScore: null, formatted: '—' };
  }

  function formatLengthDual(cm, unitSystem) {
    if (cm == null || isNaN(cm)) return { primary: '—', secondary: '' };
    var val = Number(cm);
    if (unitSystem === 'imperial') {
      var totalIn = val / 2.54;
      var ft = Math.floor(totalIn / 12);
      var remIn = Math.round((totalIn % 12) * 10) / 10;
      if (remIn >= 12) { ft += 1; remIn = 0; }
      var ftInStr = ft > 0 ? ft + "' " + remIn + '"' : remIn + '"';
      return {
        primary: ftInStr,
        secondary: Math.round(val * 10) / 10 + ' cm (' + (Math.round(totalIn * 10) / 10) + ' in)'
      };
    }
    var inVal = Math.round((val / 2.54) * 10) / 10;
    var ftVal = Math.floor(inVal / 12);
    var inRem = Math.round((inVal % 12) * 10) / 10;
    var ftStr = ftVal > 0 ? ftVal + "' " + inRem + '"' : inRem + '"';
    return {
      primary: Math.round(val * 10) / 10 + ' cm',
      secondary: ftStr + ' (' + inVal + ' in)'
    };
  }

  function formatWeightDual(kg, unitSystem) {
    if (kg == null || isNaN(kg)) return { primary: '—', secondary: '' };
    var val = Number(kg);
    if (unitSystem === 'imperial') {
      var totalLb = val * 2.20462262;
      var lb = Math.floor(totalLb);
      var oz = Math.round((totalLb - lb) * 16 * 10) / 10;
      if (oz >= 16) { lb += 1; oz = 0; }
      return {
        primary: lb + ' lb ' + oz + ' oz',
        secondary: Math.round(val * 100) / 100 + ' kg (' + (Math.round(totalLb * 10) / 10) + ' lb)'
      };
    }
    var totalLbVal = Math.round(val * 2.20462262 * 10) / 10;
    var lbVal = Math.floor(totalLbVal);
    var ozVal = Math.round((totalLbVal - lbVal) * 16);
    return {
      primary: Math.round(val * 100) / 100 + ' kg',
      secondary: lbVal + ' lb ' + ozVal + ' oz'
    };
  }

  function formatHeadDual(cm, unitSystem) {
    if (cm == null || isNaN(cm)) return { primary: '—', secondary: '' };
    var val = Number(cm);
    if (unitSystem === 'imperial') {
      var inVal = Math.round((val / 2.54) * 10) / 10;
      return {
        primary: inVal + ' in',
        secondary: Math.round(val * 10) / 10 + ' cm'
      };
    }
    return {
      primary: Math.round(val * 10) / 10 + ' cm',
      secondary: Math.round((val / 2.54) * 10) / 10 + ' in'
    };
  }

  function formatBMIDual(bmi) {
    if (bmi == null || isNaN(bmi)) return { primary: '—', secondary: '' };
    var val = Math.round(Number(bmi) * 10) / 10;
    return {
      primary: val + ' kg/m²',
      secondary: 'BMI'
    };
  }

  // Generate lightweight, ultra-crisp inline SVG sparkline for child card
  function resolveThemeChildColor(rawHex) {
    if (!rawHex) return rawHex;
    if (typeof GrowthCharts !== 'undefined' && typeof GrowthCharts.resolveThemeChildColor === 'function') {
      return GrowthCharts.resolveThemeChildColor(rawHex);
    }
    var isDark = typeof document !== 'undefined' && document.documentElement && typeof document.documentElement.getAttribute === 'function' && document.documentElement.getAttribute('data-theme') === 'dark';
    if (!isDark) return rawHex;
    var hex = String(rawHex).toUpperCase();
    if (hex === '#C85A32') return '#F07D53';
    if (hex === '#2E6F5E' || hex === '#2D6A4F') return '#4CC3A5';
    if (hex === '#3B5BDB') return '#7494FF';
    if (hex === '#9C36B5') return '#D57EEB';
    if (hex === '#D97706') return '#FBBF24';
    if (hex === '#DB2777') return '#F472B6';
    return rawHex;
  }

  function resolveChildCssColor(child, idx) {
    var raw = (child && typeof child === 'object') ? child.color : child;
    if (typeof raw === 'string') {
      var hex = raw.trim().toLowerCase();
      if (hex.indexOf('var(') === 0) return raw;
      if (hex === '#c85a32' || hex === '#be5028' || hex === '#f07d53') return 'var(--child-1)';
      if (hex === '#2e6f5e' || hex === '#2d6a4f' || hex === '#4cc3a5') return 'var(--child-2)';
      if (hex === '#3b5bdb' || hex === '#7494ff') return 'var(--child-3)';
      if (hex === '#9c36b5' || hex === '#d57eeb') return 'var(--child-4)';
      if (hex === '#d97706' || hex === '#fbbf24') return 'var(--child-5)';
      if (hex === '#db2777' || hex === '#f472b6') return 'var(--child-6)';
    }
    var slot = (idx != null && !isNaN(idx)) ? ((idx % 6) + 1) : 1;
    return 'var(--child-' + slot + ')';
  }

  function generateSVGSparkline(measurements, key, width, height, color) {
    color = resolveChildCssColor(color);
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return '<svg class="dds-sparkline-empty" width="' + width + '" height="' + height + '"><text x="50%" y="55%" text-anchor="middle" fill="var(--ink-faint, #A6B0AA)" font-size="11">No vitals</text></svg>';
    }

    var valid = [];
    for (var i = 0; i < measurements.length; i++) {
      var m = measurements[i];
      var v = m[key] || (key === 'headCm' ? m.headCircumferenceCm : null);
      if (v != null && !isNaN(v) && v > 0) {
        valid.push({ age: m.ageMonths != null ? m.ageMonths : i, val: Number(v) });
      }
    }

    if (valid.length === 0) {
      return '<svg class="dds-sparkline-empty" width="' + width + '" height="' + height + '"><text x="50%" y="55%" text-anchor="middle" fill="var(--ink-faint, #A6B0AA)" font-size="11">No vitals</text></svg>';
    }

    if (valid.length === 1) {
      return '<svg class="dds-sparkline" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
        '<circle cx="' + (width / 2) + '" cy="' + (height / 2) + '" r="4" fill="' + color + '"/>' +
        '</svg>';
    }

    var minAge = valid[0].age;
    var maxAge = valid[valid.length - 1].age;
    if (maxAge === minAge) maxAge = minAge + 1;

    var minVal = valid[0].val;
    var maxVal = valid[0].val;
    for (var j = 1; j < valid.length; j++) {
      if (valid[j].val < minVal) minVal = valid[j].val;
      if (valid[j].val > maxVal) maxVal = valid[j].val;
    }
    var valRange = maxVal - minVal;
    if (valRange === 0) valRange = 1;

    var padX = 8;
    var padY = 8;
    var chartW = width - padX * 2;
    var chartH = height - padY * 2;

    var points = [];
    for (var k = 0; k < valid.length; k++) {
      var pt = valid[k];
      var x = padX + ((pt.age - minAge) / (maxAge - minAge)) * chartW;
      var y = padY + chartH - ((pt.val - minVal) / valRange) * chartH;
      points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }

    var pathD = 'M ' + points[0].x + ' ' + points[0].y;
    for (var p = 1; p < points.length; p++) {
      pathD += ' L ' + points[p].x + ' ' + points[p].y;
    }

    var areaD = pathD + ' L ' + points[points.length - 1].x + ' ' + (height - 2) + ' L ' + points[0].x + ' ' + (height - 2) + ' Z';
    var lastPt = points[points.length - 1];

    var gradId = 'grad-' + Math.random().toString(36).substr(2, 6);

    return '<svg class="dds-sparkline" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="' + gradId + '" x1="0%" y1="0%" x2="0%" y2="100%">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.28"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.0"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<path d="' + areaD + '" fill="url(#' + gradId + ')"/>' +
      '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lastPt.x + '" cy="' + lastPt.y + '" r="3.5" fill="' + color + '" stroke="var(--surface-card, #FFFFFF)" stroke-width="1.5"/>' +
      '</svg>';
  }

  // Tanner Mid-Parental Height Stature Visual Ruler SVG Generator
  function generateSVGTannerRuler(motherCm, fatherCm, targetCm, predictedCm, sex, childColor) {
    childColor = resolveChildCssColor(childColor || '#C85A32');
    var minStature = 140;
    var maxStature = 205;
    var range = maxStature - minStature;

    var svgH = 340;
    var svgW = 280;
    var padTop = 20;
    var padBottom = 20;
    var rulerH = svgH - padTop - padBottom;
    var rulerX = 90;

    function cmToY(cm) {
      var clamped = Math.max(minStature, Math.min(maxStature, cm));
      return padTop + rulerH - ((clamped - minStature) / range) * rulerH;
    }

    var elements = [];

    // Ruler axis line
    elements.push('<line x1="' + rulerX + '" y1="' + padTop + '" x2="' + rulerX + '" y2="' + (padTop + rulerH) + '" stroke="var(--border-stone-strong, #D5CCA8)" stroke-width="2"/>');

    // Tick marks every 5 cm and major every 10 cm
    for (var cm = minStature; cm <= maxStature; cm += 5) {
      var y = cmToY(cm);
      var isMajor = cm % 10 === 0;
      var tickLen = isMajor ? 12 : 6;
      elements.push('<line x1="' + (rulerX - tickLen) + '" y1="' + y + '" x2="' + rulerX + '" y2="' + y + '" stroke="var(--border-stone, #A6B0AA)" stroke-width="' + (isMajor ? '1.5' : '1') + '"/>');
      if (isMajor) {
        var totalIn = cm / 2.54;
        var ft = Math.floor(totalIn / 12);
        var inRem = Math.round(totalIn % 12);
        elements.push('<text x="' + (rulerX - 16) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" font-family="JetBrains Mono, monospace" fill="var(--ink-secondary, #57635C)">' + cm + 'cm (' + ft + "'" + inRem + '")</text>');
      }
    }

    // Mid-Parental Target corridor band (+- 8.5 cm)
    var corridorW = 110;
    if (targetCm != null && !isNaN(targetCm)) {
      var topY = cmToY(targetCm + 8.5);
      var bottomY = cmToY(targetCm - 8.5);
      var bandH = Math.max(2, bottomY - topY);
      elements.push('<rect x="' + rulerX + '" y="' + topY + '" width="' + corridorW + '" height="' + bandH + '" fill="var(--ochre-tint, #FEF3C7)" fill-opacity="0.45" stroke="var(--ochre-border, #FCD34D)" stroke-width="1" stroke-dasharray="3,3" rx="4"/>');
      // Corridor label neatly inside top-right of corridor box
      elements.push('<text x="' + (rulerX + corridorW - 6) + '" y="' + (topY + 11) + '" text-anchor="end" font-size="9.5" font-family="Plus Jakarta Sans, sans-serif" fill="var(--amber-ink, #92400E)" font-weight="600">±8.5cm Corridor</text>');

      // Target center line
      var targetY = cmToY(targetCm);
      elements.push('<line x1="' + rulerX + '" y1="' + targetY + '" x2="' + (rulerX + corridorW) + '" y2="' + targetY + '" stroke="var(--ochre-gold, #D97706)" stroke-width="1.5" stroke-dasharray="4,2"/>');
    }

    // De-overlapped pins: Mid-Parental, Mother, Father, Child
    var pins = [];
    if (targetCm != null && !isNaN(targetCm)) {
      pins.push({
        id: 'target',
        cm: targetCm,
        trueY: cmToY(targetCm),
        label: 'Mid-Parental: ' + targetCm + 'cm',
        color: 'var(--amber-ink, #92400E)',
        accentColor: 'var(--ochre-gold, #D97706)',
        type: 'target'
      });
    }
    if (fatherCm != null && !isNaN(fatherCm) && fatherCm > 100) {
      pins.push({
        id: 'father',
        cm: fatherCm,
        trueY: cmToY(fatherCm),
        label: 'Father: ' + fatherCm + 'cm',
        color: 'var(--child-3, #3B5BDB)',
        accentColor: 'var(--child-3, #3B5BDB)',
        type: 'parent'
      });
    }
    if (motherCm != null && !isNaN(motherCm) && motherCm > 100) {
      pins.push({
        id: 'mother',
        cm: motherCm,
        trueY: cmToY(motherCm),
        label: 'Mother: ' + motherCm + 'cm',
        color: 'var(--child-4, #9C36B5)',
        accentColor: 'var(--child-4, #9C36B5)',
        type: 'parent'
      });
    }
    if (predictedCm != null && !isNaN(predictedCm)) {
      pins.push({
        id: 'child',
        cm: predictedCm,
        trueY: cmToY(predictedCm),
        label: 'Child: ' + predictedCm + 'cm',
        color: childColor,
        accentColor: childColor,
        type: 'child'
      });
    }

    // Sort by trueY ascending (top to bottom on SVG)
    pins.sort(function(a, b) { return a.trueY - b.trueY; });

    // Enforce >= 19px vertical separation between label Y positions
    var minSpacing = 19;
    for (var pi = 0; pi < pins.length; pi++) {
      pins[pi].labelY = pins[pi].trueY;
    }
    for (var pi = 1; pi < pins.length; pi++) {
      if (pins[pi].labelY < pins[pi - 1].labelY + minSpacing) {
        pins[pi].labelY = pins[pi - 1].labelY + minSpacing;
      }
    }
    var maxYLimit = padTop + rulerH - 6;
    if (pins.length > 0 && pins[pins.length - 1].labelY > maxYLimit) {
      pins[pins.length - 1].labelY = maxYLimit;
      for (var pi = pins.length - 2; pi >= 0; pi--) {
        if (pins[pi].labelY > pins[pi + 1].labelY - minSpacing) {
          pins[pi].labelY = pins[pi + 1].labelY - minSpacing;
        }
      }
    }

    // Render each pin with subtle leader line to true Y
    pins.forEach(function (pin) {
      var hasOffset = Math.abs(pin.labelY - pin.trueY) > 1.5;
      if (pin.type === 'child') {
        elements.push('<line x1="' + (rulerX - 2) + '" y1="' + pin.trueY + '" x2="' + (rulerX + 16) + '" y2="' + pin.trueY + '" stroke="' + pin.accentColor + '" stroke-width="2.2"/>');
        elements.push('<polygon points="' + (rulerX + 4) + ',' + pin.trueY + ' ' + (rulerX - 5) + ',' + (pin.trueY - 5) + ' ' + (rulerX - 5) + ',' + (pin.trueY + 5) + '" fill="' + pin.accentColor + '"/>');
        if (hasOffset) {
          elements.push('<line x1="' + (rulerX + 16) + '" y1="' + pin.trueY + '" x2="' + (rulerX + 26) + '" y2="' + pin.labelY + '" stroke="' + pin.accentColor + '" stroke-width="1.2" stroke-dasharray="2,2"/>');
        }
        elements.push('<g class="dds-tanner-child-pin">');
        elements.push('<rect x="' + (rulerX + 26) + '" y="' + (pin.labelY - 9) + '" width="98" height="16" fill="' + pin.accentColor + '" rx="3"/>');
        elements.push('<text x="' + (rulerX + 32) + '" y="' + (pin.labelY + 3.5) + '" font-size="9.5" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--on-accent-fill, #FFFFFF)">' + pin.label + '</text>');
        elements.push('</g>');
      } else if (pin.type === 'target') {
        elements.push('<circle cx="' + (rulerX + 12) + '" cy="' + pin.trueY + '" r="3.5" fill="' + pin.accentColor + '"/>');
        if (hasOffset) {
          elements.push('<line x1="' + (rulerX + 16) + '" y1="' + pin.trueY + '" x2="' + (rulerX + 24) + '" y2="' + pin.labelY + '" stroke="' + pin.accentColor + '" stroke-width="1.2" stroke-dasharray="2,2"/>');
        }
        elements.push('<text x="' + (rulerX + 24) + '" y="' + (pin.labelY + 3.5) + '" font-size="10.5" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" fill="' + pin.color + '">' + pin.label + '</text>');
      } else {
        // Parent (Mother / Father)
        elements.push('<line x1="' + rulerX + '" y1="' + pin.trueY + '" x2="' + (rulerX + 14) + '" y2="' + pin.trueY + '" stroke="' + pin.accentColor + '" stroke-width="1.2" stroke-dasharray="2,2"/>');
        elements.push('<circle cx="' + (rulerX + 14) + '" cy="' + pin.trueY + '" r="3" fill="' + pin.accentColor + '"/>');
        if (hasOffset) {
          elements.push('<line x1="' + (rulerX + 17) + '" y1="' + pin.trueY + '" x2="' + (rulerX + 24) + '" y2="' + pin.labelY + '" stroke="' + pin.accentColor + '" stroke-width="1" stroke-dasharray="2,2" opacity="0.75"/>');
        }
        elements.push('<text x="' + (rulerX + 24) + '" y="' + (pin.labelY + 3.5) + '" font-size="9.5" font-family="Plus Jakarta Sans, sans-serif" fill="' + pin.color + '">' + pin.label + '</text>');
      }
    });

    return '<svg class="dds-tanner-ruler-svg" width="100%" height="' + svgH + '" viewBox="-12 0 296 ' + svgH + '">' +
      elements.join('') +
      '</svg>';
  }

  // 4-Season Forecaster Calculation
  function calculateSeasonalForecast(child, referenceDateStr) {
    var normalizeFcItem = function (fc) {
      if (!fc) return fc;
      var icon = fc.seasonIcon || (/Winter/i.test(fc.season) ? '❄️' : /Spring/i.test(fc.season) ? '🌸' : /Summer/i.test(fc.season) ? '☀️' : '🍂');
      var euSize = fc.clothingSizeEU || (fc.euHeightSize ? 'EU ' + fc.euHeightSize : (fc.projectedHeightCm ? Math.round(fc.projectedHeightCm) + ' cm' : ''));
      return Object.assign({}, fc, {
        seasonIcon: icon,
        clothingSizeEU: euSize
      });
    };

    if (GrowthEngine && typeof GrowthEngine.forecastSeasonalSizing === 'function') {
      try {
        var res = GrowthEngine.forecastSeasonalSizing(child, referenceDateStr);
        if (Array.isArray(res) && res.length > 0) return res.map(normalizeFcItem);
      } catch (e) {}
    }

    // Built-in Seasonal Forecaster Fallback
    var refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
    var latestM = getLatestMeasurement(child);
    var curAge = calculateAgeMonths(child.birthDate, refDate.toISOString().slice(0, 10));
    var curH = latestM && latestM.heightCm ? latestM.heightCm : 75;
    var curW = latestM && latestM.weightKg ? latestM.weightKg : 10;

    // Estimate current Z-scores
    var zH = 0.2;
    var zW = 0.2;
    if (GrowthEngine && typeof GrowthEngine.statsForMeasurement === 'function' && latestM) {
      try {
        var sh = GrowthEngine.statsForMeasurement(child, latestM, 'height');
        if (sh && sh.zScore != null) zH = sh.zScore;
        var sw = GrowthEngine.statsForMeasurement(child, latestM, 'weight');
        if (sw && sw.zScore != null) zW = sw.zScore;
      } catch (e) {}
    }

    var seasonNames = ['Winter', 'Spring', 'Summer', 'Fall'];
    var seasonIcons = ['❄️', '🌸', '☀️', '🍂'];

    function getSeasonInfo(dateObj) {
      var m = dateObj.getMonth(); // 0-11
      if (m === 11 || m === 0 || m === 1) return { name: 'Winter', icon: '❄️' };
      if (m >= 2 && m <= 4) return { name: 'Spring', icon: '🌸' };
      if (m >= 5 && m <= 7) return { name: 'Summer', icon: '☀️' };
      return { name: 'Fall', icon: '🍂' };
    }

    function estimateDiaperSize(weightKg, ageMonths) {
      if (ageMonths >= 36 || weightKg > 17) return 'Toddler Underwear / Potty Trained';
      var lbs = weightKg * 2.20462;
      if (lbs < 10) return 'Newborn (< 10 lbs)';
      if (lbs < 14) return 'Size 1 (8–14 lbs)';
      if (lbs < 18) return 'Size 2 (12–18 lbs)';
      if (lbs < 28) return 'Size 3 (16–28 lbs)';
      if (lbs < 35) return 'Size 4 (22–37 lbs)';
      return 'Size 5 / 6 (27+ lbs)';
    }

    var forecasts = [];
    var intervals = [3, 6, 9, 12];

    for (var i = 0; i < intervals.length; i++) {
      var deltaM = intervals[i];
      var fDate = new Date(refDate.getTime() + deltaM * 30.4375 * 24 * 60 * 60 * 1000);
      var targetAge = Math.round((curAge + deltaM) * 10) / 10;
      var sInfo = getSeasonInfo(fDate);

      // Growth projection estimation
      var projH = curH;
      var projW = curW;
      if (GrowthEngine && typeof GrowthEngine.valueFromPercentile === 'function' && typeof GrowthEngine.normalCDF === 'function') {
        try {
          var pctH = GrowthEngine.normalCDF(zH) * 100;
          var pctW = GrowthEngine.normalCDF(zW) * 100;
          var childNormSex = isFemaleChild(child) ? 'F' : 'M';
          var valH = GrowthEngine.valueFromPercentile(childNormSex, 'height', targetAge, pctH);
          var valW = GrowthEngine.valueFromPercentile(childNormSex, 'weight', targetAge, pctW);
          if (valH) projH = Math.round(valH * 10) / 10;
          if (valW) projW = Math.round(valW * 10) / 10;
        } catch (e) {}
      } else {
        // Fallback linear interpolation
        var growthRateCmPerMonth = targetAge < 12 ? 1.5 : (targetAge < 24 ? 1.0 : 0.6);
        var weightRateKgPerMonth = targetAge < 12 ? 0.4 : (targetAge < 24 ? 0.2 : 0.15);
        projH = Math.round((curH + growthRateCmPerMonth * deltaM) * 10) / 10;
        projW = Math.round((curW + weightRateKgPerMonth * deltaM) * 10) / 10;
      }

      var sizing = {};
      if (GrowthEngine && typeof GrowthEngine.estimateClothingAndShoeSize === 'function') {
        try {
          var stubChild = {
            sex: isFemaleChild(child) ? 'F' : 'M',
            measurements: [{ ageMonths: targetAge, heightCm: projH, weightKg: projW }]
          };
          sizing = GrowthEngine.estimateClothingAndShoeSize(stubChild) || {};
        } catch (e) {}
      }

      forecasts.push({
        monthsAhead: deltaM,
        targetDate: fDate.toISOString().slice(0, 10),
        season: sInfo.name + ' ' + fDate.getFullYear(),
        seasonIcon: sInfo.icon,
        projectedAgeMonths: targetAge,
        projectedHeightCm: projH,
        projectedWeightKg: projW,
        clothingSizeUS: sizing.currentClothingSize || (targetAge < 12 ? (targetAge <= 3 ? '0-3M' : (targetAge <= 6 ? '3-6M' : (targetAge <= 9 ? '6-9M' : '9-12M'))) : (targetAge <= 18 ? '12-18M' : (targetAge <= 24 ? '18-24M' : (targetAge <= 36 ? '2T-3T' : '4T')))),
        clothingSizeEU: (Math.round(projH) + ' cm'),
        shoeSizeUS: sizing.currentShoeSizeUS || (targetAge < 12 ? '2-3' : (targetAge < 24 ? '4-5' : (targetAge < 36 ? '6-7' : '8-9'))),
        shoeSizeEU: sizing.currentShoeSizeEU || (targetAge < 12 ? '17-19' : (targetAge < 24 ? '20-22' : (targetAge < 36 ? '23-25' : '26-27'))),
        diaperSize: estimateDiaperSize(projW, targetAge)
      });
    }

    return forecasts;
  }

  // Interval-by-Interval Canalization Table Calculation
  function calculateCanalizationTable(child, unitSystem) {
    if (!child) return [];
    var intervals = [];
    if (GrowthEngine && typeof GrowthEngine.analyzeGrowthVelocity === 'function') {
      try {
        var res = GrowthEngine.analyzeGrowthVelocity(child);
        if (Array.isArray(res) && res.length > 0) intervals = res;
      } catch (e) {}
    }

    var list = getSortedMeasurements(child);
    if (intervals.length === 0 && list.length >= 2) {
      // Build from measurements
      for (var i = 1; i < list.length; i++) {
        var prev = list[i - 1];
        var curr = list[i];
        var dtMonths = Math.max(0.1, (curr.ageMonths || 0) - (prev.ageMonths || 0));
        var dH = (curr.heightCm != null && prev.heightCm != null) ? (curr.heightCm - prev.heightCm) : null;
        var dW = (curr.weightKg != null && prev.weightKg != null) ? (curr.weightKg - prev.weightKg) : null;
        var velH = dH != null ? (dH / dtMonths) * 12 : null;
        var velW = dW != null ? (dW / dtMonths) * 12 : null;

        var prevZ = 0;
        var currZ = 0;
        var prevStats = getPercentileStats(child, prev, 'height');
        var currStats = getPercentileStats(child, curr, 'height');
        if (prevStats.zScore != null) prevZ = prevStats.zScore;
        if (currStats.zScore != null) currZ = currStats.zScore;
        var deltaZ = Math.round((currZ - prevZ) * 100) / 100;

        intervals.push({
          prevDate: prev.date,
          currDate: curr.date,
          prevAgeMonths: prev.ageMonths,
          currAgeMonths: curr.ageMonths,
          deltaMonths: Math.round(dtMonths * 10) / 10,
          heightGainCm: dH != null ? Math.round(dH * 10) / 10 : null,
          heightVelocityCmPerYear: velH != null ? Math.round(velH * 10) / 10 : null,
          weightGainKg: dW != null ? Math.round(dW * 100) / 100 : null,
          weightVelocityKgPerYear: velW != null ? Math.round(velW * 10) / 10 : null,
          deltaZ: deltaZ,
          isSpurt: velH != null && velH > 18
        });
      }
    }

    return intervals;
  }

  // ---------------------------------------------------------------------------
  // EXPORTED COMPONENT 1: renderFamilyOverview
  // ---------------------------------------------------------------------------

  /**
   * Renders Household Command Center inside #view-overview
   * @param {HTMLElement} containerEl 
   * @param {Object} props 
   * @returns {{ update: Function, destroy: Function }}
   */
  function renderFamilyOverview(containerEl, props) {
    if (!containerEl || typeof document === 'undefined') {
      return { update: function () {}, destroy: function () {} };
    }

    var currentProps = Object.assign({}, props);
    var rootDiv = document.createElement('div');
    rootDiv.className = 'dds-overview-container';
    containerEl.innerHTML = '';
    containerEl.appendChild(rootDiv);

    function renderView() {
      var familyState = currentProps.familyState || {};
      var children = Array.isArray(familyState.children) ? familyState.children : [];
      var unitSystem = currentProps.unitSystem || (familyState.settings && familyState.settings.unitSystem) || 'metric';

      // 1. Calculate Aggregated AAP Alerts across all children
      var overdueAlerts = [];
      var upcomingAlerts = [];

      children.forEach(function (child) {
        var sched = null;
        if (GrowthEngine && typeof GrowthEngine.getWellChildSchedule === 'function') {
          try { sched = GrowthEngine.getWellChildSchedule(child); } catch (e) {}
        }
        var scheduleList = (sched && sched.schedule) ? sched.schedule : AAP_DEFAULT_SCHEDULE;
        var curAge = calculateAgeMonths(child.birthDate);

        scheduleList.forEach(function (v) {
          var targetAge = v.ageMonths != null ? v.ageMonths : v.targetAgeMonths;
          var isDone = v.isCompleted;
          if (isDone == null && Array.isArray(child.measurements)) {
            isDone = child.measurements.some(function (m) {
              return Math.abs((m.ageMonths || 0) - targetAge) <= (targetAge <= 6 ? 1 : 2);
            });
          }

          if (!isDone) {
            if (curAge > targetAge + 1) {
              overdueAlerts.push({
                child: child,
                visitLabel: v.label,
                targetAge: targetAge,
                monthsOverdue: Math.round((curAge - targetAge) * 10) / 10
              });
            } else if (curAge >= targetAge - 1.5 && curAge <= targetAge + 1) {
              upcomingAlerts.push({
                child: child,
                visitLabel: v.label,
                targetAge: targetAge,
                dueInMonths: Math.max(0, Math.round((targetAge - curAge) * 10) / 10)
              });
            }
          }
        });
      });

      // HTML Generation
      var html = '';

      // Command Center Header
      var familyName = familyState.familyName || 'Family';
      html += '<header class="dds-overview-header">' +
        '<div class="dds-header-title-group">' +
        '<span class="dds-brand-badge">🏡 Household Command Center</span>' +
        '<h1 class="dds-family-heading">' + escapeHtml(familyName) + ' Sprout Studio</h1>' +
        '<p class="dds-family-subheading">' +
        children.length + ' ' + (children.length === 1 ? 'child' : 'children') + ' tracked with pediatric precision & canalization surveillance' +
        '</p>' +
        '</div>' +
        '<div class="dds-header-actions">' +
        '<button type="button" class="dds-btn dds-btn-outline" id="dds-btn-edit-family">' +
        '⚙️ Settings & Family' +
        '</button>' +
        '<button type="button" class="dds-btn dds-btn-primary" id="dds-btn-add-child-top">' +
        '+ Add Child Profile' +
        '</button>' +
        '</div>' +
        '</header>';

      // Household Clinical Action Strip
      html += '<section class="dds-action-strip" aria-label="Clinical Action Strip">';

      // Card 1: AAP Bright Futures Checkup Watch
      html += '<div class="dds-action-card dds-action-card-checkups">';
      html += '<div class="dds-card-top-row">' +
        '<span class="dds-card-pill ' + (overdueAlerts.length > 0 ? 'dds-pill-warn' : 'dds-pill-ok') + '">' +
        (overdueAlerts.length > 0 ? '⚠️ ' + overdueAlerts.length + ' Checkups Past Due' : (upcomingAlerts.length > 0 ? '📅 ' + upcomingAlerts.length + ' Upcoming Checkups' : '✓ Checkups Up-to-Date')) +
        '</span>' +
        '</div>';
      html += '<h3 class="dds-card-heading">AAP Bright Futures Watch</h3>';

      if (overdueAlerts.length > 0) {
        html += '<ul class="dds-alert-list">';
        overdueAlerts.slice(0, 2).forEach(function (item) {
          html += '<li><strong>' + escapeHtml(item.child.name) + '</strong>: ' + escapeHtml(item.visitLabel) +
            ' <span class="dds-faint">(' + item.monthsOverdue + 'm overdue)</span>' +
            ' <button type="button" class="dds-link-btn dds-log-visit-btn" data-child-id="' + escapeHtml(item.child.id) + '" data-preset="' + escapeHtml(item.visitLabel) + '">Log Visit →</button>' +
            '</li>';
        });
        html += '</ul>';
      } else if (upcomingAlerts.length > 0) {
        html += '<ul class="dds-alert-list">';
        upcomingAlerts.slice(0, 2).forEach(function (item) {
          html += '<li><strong>' + escapeHtml(item.child.name) + '</strong>: ' + escapeHtml(item.visitLabel) +
            ' <span class="dds-faint">(Due soon)</span>' +
            ' <button type="button" class="dds-link-btn dds-log-visit-btn" data-child-id="' + escapeHtml(item.child.id) + '" data-preset="' + escapeHtml(item.visitLabel) + '">Prepare Visit →</button>' +
            '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="dds-card-desc">All children are completely up-to-date on standard American Academy of Pediatrics well-child visits.</p>';
      }
      html += '</div>';

      // Card 2: Sibling Comparison / Benchmark Launcher
      html += '<div class="dds-action-card dds-action-card-comparison">';
      html += '<div class="dds-card-top-row">' +
        '<span class="dds-card-pill dds-pill-neutral">⚖️ Biometric Studio</span>' +
        '</div>';
      if (children.length >= 2) {
        html += '<h3 class="dds-card-heading">Sibling Growth Trajectories</h3>' +
          '<p class="dds-card-desc">Overlay ' + escapeHtml(children[0].name) + ' and ' + escapeHtml(children[1].name) + ' to compare canalization channels and biological age.</p>' +
          '<button type="button" class="dds-btn dds-btn-sm dds-btn-secondary" id="dds-btn-launch-comparison">' +
          'Launch Sibling Studio ↗' +
          '</button>';
      } else if (children.length === 1) {
        html += '<h3 class="dds-card-heading">Solo WHO/CDC Benchmark</h3>' +
          '<p class="dds-card-desc">Compare ' + escapeHtml(children[0].name) + ' against the WHO/CDC 50th percentile reference peer or mid-parental genetic target.</p>' +
          '<button type="button" class="dds-btn dds-btn-sm dds-btn-secondary" id="dds-btn-launch-comparison">' +
          'Launch Benchmark Studio ↗' +
          '</button>';
      } else {
        html += '<h3 class="dds-card-heading">Growth Comparison</h3>' +
          '<p class="dds-card-desc">Add child profiles to activate comparative percentile tracking.</p>';
      }
      html += '</div>';

      // Card 3: Bulk Photo OCR Shortcut
      html += '<div class="dds-action-card dds-action-card-photo">';
      html += '<div class="dds-card-top-row">' +
        '<span class="dds-card-pill dds-pill-neutral">📸 Fast Ingestion</span>' +
        '</div>' +
        '<h3 class="dds-card-heading">Scan Clinic Growth Chart</h3>' +
        '<p class="dds-card-desc">Instantly extract dates, height, weight & head circumference from paper clinic summaries using local OCR.</p>' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-secondary" id="dds-btn-launch-photo">' +
        'Open Photo Scan ↗' +
        '</button>' +
        '</div>';

      html += '</section>';

      // Adaptive 1..N Child Spotlight Grid (#family-roster-grid)
      var gridClass = 'dds-roster-grid';
      if (children.length === 1) {
        gridClass += ' dds-grid-solo';
      } else if (children.length === 2) {
        gridClass += ' dds-grid-duo';
      } else {
        gridClass += ' dds-grid-multi';
      }

      html += '<section class="dds-roster-section">' +
        '<div class="dds-section-title-strip">' +
        '<h2 class="dds-section-title">Child Growth Spotlights</h2>' +
        '<span class="dds-section-subtitle">Real-time LMS percentiles & velocity analysis</span>' +
        '</div>' +
        '<div class="' + gridClass + '" id="family-roster-grid">';

      children.forEach(function (child, idx) {
        var color = resolveChildCssColor(child, idx);
        var latestM = getLatestMeasurement(child);
        var chronoAge = safeFormatAge(child.birthDate);
        var pretermInfo = getCorrectedAgeInfo(child);
        var measurements = getSortedMeasurements(child);

        // Vitals
        var hStats = latestM ? getPercentileStats(child, latestM, 'height') : null;
        var wStats = latestM ? getPercentileStats(child, latestM, 'weight') : null;
        var headStats = (latestM && (latestM.headCm || latestM.headCircumferenceCm)) ? getPercentileStats(child, latestM, 'head') : null;
        var bmiVal = latestM ? (latestM.bmi || (latestM.heightCm && latestM.weightKg ? (latestM.weightKg / Math.pow(latestM.heightCm / 100, 2)) : null)) : null;

        var hFormatted = latestM ? formatLengthDual(latestM.heightCm, unitSystem) : null;
        var wFormatted = latestM ? formatWeightDual(latestM.weightKg, unitSystem) : null;
        var headFormatted = (latestM && (latestM.headCm || latestM.headCircumferenceCm)) ? formatHeadDual(latestM.headCm || latestM.headCircumferenceCm, unitSystem) : null;
        var bmiFormatted = bmiVal ? formatBMIDual(bmiVal) : null;

        // Sparkline
        var sparklineSvg = generateSVGSparkline(measurements, 'heightCm', 190, 52, color);

        // Velocity & Spurt Badge
        var velSummary = 'Steady Canalization';
        var isSpurt = false;
        if (GrowthEngine && typeof GrowthEngine.analyzeGrowthVelocity === 'function') {
          try {
            var vList = GrowthEngine.analyzeGrowthVelocity(child);
            if (Array.isArray(vList) && vList.length > 0) {
              var lastV = vList[vList.length - 1];
              if (lastV.isSpurt || lastV.isGrowthSpurt) {
                isSpurt = true;
                velSummary = '⚡ Growth Spurt (+' + (lastV.heightGainCm || 1.8) + 'cm)';
              } else if (lastV.heightVelocityCmPerYear) {
                velSummary = 'Velocity: ' + Math.round(lastV.heightVelocityCmPerYear) + ' cm/yr';
              }
            }
          } catch (e) {}
        }

        // Next AAP Visit
        var nextVisitBadge = 'AAP Checkups Up-to-Date';
        if (GrowthEngine && typeof GrowthEngine.getWellChildSchedule === 'function') {
          try {
            var s = GrowthEngine.getWellChildSchedule(child);
            if (s && s.nextVisit) {
              nextVisitBadge = '📅 Next: ' + s.nextVisit.label;
            }
          } catch (e) {}
        }

        html += '<div class="dds-child-card" style="--child-accent: ' + color + ';" data-child-id="' + escapeHtml(child.id) + '">' +
          '<div class="dds-card-header">' +
          '<div class="dds-avatar-badge" style="background-color: ' + color + ';">' +
          escapeHtml(getInitials(child.name)) +
          '</div>' +
          '<div class="dds-child-identity">' +
          '<div class="dds-identity-top">' +
          '<h3 class="dds-child-name">' + escapeHtml(child.name) + '</h3>' +
          '<span class="dds-sex-badge ' + (isFemaleChild(child) ? 'dds-sex-female' : 'dds-sex-male') + '">' +
          (isFemaleChild(child) ? '♀ Girl' : '♂ Boy') +
          '</span>' +
          '</div>' +
          '<div class="dds-age-line">' +
          '<span class="dds-chrono-age">Age: ' + escapeHtml(chronoAge) + '</span>' +
          (pretermInfo ? '<span class="dds-preterm-badge" title="Gestational age: ' + pretermInfo.gestationalWeeks + ' weeks">Preterm (' + pretermInfo.gestationalWeeks + 'w) • Corrected: ' + escapeHtml(pretermInfo.correctedLabel) + '</span>' : '') +
          '</div>' +
          '</div>' +
          '</div>';

        // Sparkline & Mini Chart Strip
        html += '<div class="dds-sparkline-row">' +
          '<div class="dds-sparkline-box">' +
          '<div class="dds-sparkline-label">Height Trajectory</div>' +
          sparklineSvg +
          '</div>' +
          '<div class="dds-growth-status-strip">' +
          '<span class="dds-badge ' + (isSpurt ? 'dds-badge-spurt' : 'dds-badge-steady') + '">' +
          escapeHtml(velSummary) +
          '</span>' +
          '<span class="dds-badge dds-badge-checkup">' +
          escapeHtml(nextVisitBadge) +
          '</span>' +
          '</div>' +
          '</div>';

        // Latest Vitals
        html += '<div class="dds-vitals-strip">';
        if (latestM) {
          html += '<div class="dds-vital-cell">' +
            '<span class="dds-vital-key">Height / Length</span>' +
            '<span class="dds-vital-val">' + escapeHtml(hFormatted.primary) + '</span>' +
            (hStats && hStats.percentile != null ? '<span class="dds-pct-pill">' + escapeHtml(hStats.formatted) + '</span>' : '') +
            '</div>';

          html += '<div class="dds-vital-cell">' +
            '<span class="dds-vital-key">Weight</span>' +
            '<span class="dds-vital-val">' + escapeHtml(wFormatted.primary) + '</span>' +
            (wStats && wStats.percentile != null ? '<span class="dds-pct-pill">' + escapeHtml(wStats.formatted) + '</span>' : '') +
            '</div>';

          if (headFormatted) {
            html += '<div class="dds-vital-cell">' +
              '<span class="dds-vital-key">Head Circ</span>' +
              '<span class="dds-vital-val">' + escapeHtml(headFormatted.primary) + '</span>' +
              (headStats && headStats.percentile != null ? '<span class="dds-pct-pill">' + escapeHtml(headStats.formatted) + '</span>' : '') +
              '</div>';
          }

          if (bmiFormatted) {
            html += '<div class="dds-vital-cell">' +
              '<span class="dds-vital-key">BMI</span>' +
              '<span class="dds-vital-val">' + escapeHtml(bmiFormatted.primary) + '</span>' +
              '</div>';
          }
        } else {
          html += '<div class="dds-vitals-empty">No checkup vitals logged yet. Tap Quick Log below to start tracking.</div>';
        }
        html += '</div>';

        // Action Buttons
        html += '<div class="dds-card-actions">' +
          '<button type="button" class="dds-btn dds-btn-primary dds-btn-open-studio" data-child-id="' + escapeHtml(child.id) + '">' +
          '🔬 Deep-Dive Studio →' +
          '</button>' +
          '<button type="button" class="dds-btn dds-btn-outline dds-btn-quick-log" data-child-id="' + escapeHtml(child.id) + '">' +
          '+ Quick Log' +
          '</button>' +
          '</div>' +
          '</div>';
      });

      // + Add Child Profile Card
      html += '<div class="dds-add-child-card" id="dds-card-add-child">' +
        '<div class="dds-add-icon">🌱</div>' +
        '<h3 class="dds-add-title">+ Add Child Profile</h3>' +
        '<p class="dds-add-desc">Add an infant, toddler, or sibling to track percentile canals & AAP Bright Futures milestones.</p>' +
        '<button type="button" class="dds-btn dds-btn-outline dds-btn-sm">+ New Child</button>' +
        '</div>';

      html += '</div></section>';

      rootDiv.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      // Top actions
      var editFamBtn = rootDiv.querySelector('#dds-btn-edit-family');
      if (editFamBtn) {
        editFamBtn.addEventListener('click', function () {
          if (typeof currentProps.onEditFamily === 'function') currentProps.onEditFamily();
        });
      }

      var addChildTopBtn = rootDiv.querySelector('#dds-btn-add-child-top');
      if (addChildTopBtn) {
        addChildTopBtn.addEventListener('click', function () {
          if (typeof currentProps.onAddChild === 'function') currentProps.onAddChild();
        });
      }

      var addCard = rootDiv.querySelector('#dds-card-add-child');
      if (addCard) {
        addCard.addEventListener('click', function () {
          if (typeof currentProps.onAddChild === 'function') currentProps.onAddChild();
        });
      }

      var compBtn = rootDiv.querySelector('#dds-btn-launch-comparison');
      if (compBtn) {
        compBtn.addEventListener('click', function () {
          if (typeof currentProps.onOpenComparison === 'function') {
            var children = currentProps.familyState && currentProps.familyState.children;
            if (children && children.length >= 2) {
              currentProps.onOpenComparison(children[0].id, children[1].id);
            } else if (children && children.length === 1) {
              currentProps.onOpenComparison(children[0].id);
            } else {
              currentProps.onOpenComparison();
            }
          }
        });
      }

      var photoBtn = rootDiv.querySelector('#dds-btn-launch-photo');
      if (photoBtn) {
        photoBtn.addEventListener('click', function () {
          if (typeof currentProps.onOpenPhotoImport === 'function') currentProps.onOpenPhotoImport();
        });
      }

      // Log visit alerts
      var logBtns = rootDiv.querySelectorAll('.dds-log-visit-btn');
      logBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var cId = btn.getAttribute('data-child-id');
          var preset = btn.getAttribute('data-preset');
          if (typeof currentProps.onQuickLogChild === 'function') {
            currentProps.onQuickLogChild(cId, preset);
          }
        });
      });

      // Child card buttons
      var studioBtns = rootDiv.querySelectorAll('.dds-btn-open-studio');
      studioBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var cId = btn.getAttribute('data-child-id');
          if (typeof currentProps.onSelectChildDeepDive === 'function') {
            currentProps.onSelectChildDeepDive(cId);
          }
        });
      });

      var quickLogBtns = rootDiv.querySelectorAll('.dds-btn-quick-log');
      quickLogBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var cId = btn.getAttribute('data-child-id');
          if (typeof currentProps.onQuickLogChild === 'function') {
            currentProps.onQuickLogChild(cId);
          }
        });
      });

      // Clicking child card body opens studio
      var childCards = rootDiv.querySelectorAll('.dds-child-card');
      childCards.forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('button')) return;
          var cId = card.getAttribute('data-child-id');
          if (typeof currentProps.onSelectChildDeepDive === 'function') {
            currentProps.onSelectChildDeepDive(cId);
          }
        });
      });
    }

    renderView();

    return {
      update: function (nextProps) {
        Object.assign(currentProps, nextProps);
        renderView();
      },
      destroy: function () {
        if (containerEl && containerEl.contains(rootDiv)) {
          containerEl.removeChild(rootDiv);
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // EXPORTED COMPONENT 2: render (Single-Child Studio)
  // ---------------------------------------------------------------------------

  /**
   * Renders the 5-Lens Clinical Deep-Dive Studio inside #view-dashboard
   * @param {HTMLElement} containerEl 
   * @param {Object} props 
   * @returns {{ update: Function, setLens: Function, destroy: Function }}
   */
  function render(containerEl, props) {
    if (!containerEl || typeof document === 'undefined') {
      return { update: function () {}, setLens: function () {}, destroy: function () {} };
    }

    var currentProps = Object.assign({
      activeLens: 'trajectories',
      zoomPreset: 'auto',
      chartLayoutMode: 'single',
      activeMetric: 'height',
      yMode: 'absolute'
    }, props);

    var internalState = {
      activeLens: currentProps.activeLens || 'trajectories',
      zoomPreset: currentProps.zoomPreset || 'auto',
      chartLayoutMode: currentProps.chartLayoutMode || 'single',
      activeMetric: currentProps.activeMetric || 'height',
      yMode: currentProps.yMode || 'absolute',
      velocityMetric: 'height',
      milestoneCategory: 'all',
      ledgerSearch: '',
      ledgerFilter: 'all',
      selectedPoint: null,
      activeChartInstance: null,
      quadInstances: []
    };

    var rootDiv = document.createElement('div');
    rootDiv.className = 'dds-studio-container';
    containerEl.innerHTML = '';
    containerEl.appendChild(rootDiv);

    function cleanupCharts() {
      if (internalState.activeChartInstance && typeof internalState.activeChartInstance.destroy === 'function') {
        try { internalState.activeChartInstance.destroy(); } catch (e) {}
      }
      internalState.activeChartInstance = null;

      if (Array.isArray(internalState.quadInstances)) {
        internalState.quadInstances.forEach(function (inst) {
          if (inst && typeof inst.destroy === 'function') {
            try { inst.destroy(); } catch (e) {}
          }
        });
        internalState.quadInstances = [];
      }
    }

    function renderView() {
      cleanupCharts();

      var child = currentProps.child;
      if (!child) {
        rootDiv.innerHTML = '<div class="dds-empty-state">No child profile selected.</div>';
        return;
      }

      var familyState = currentProps.familyState || {};
      var unitSystem = currentProps.unitSystem || (familyState.settings && familyState.settings.unitSystem) || 'metric';
      var childIdx = 0;
      if (familyState && Array.isArray(familyState.children)) {
        for (var ci = 0; ci < familyState.children.length; ci++) {
          if (familyState.children[ci].id === child.id) {
            childIdx = ci;
            break;
          }
        }
      }
      var color = resolveChildCssColor(child, childIdx);
      var chronoAge = safeFormatAge(child.birthDate);
      var pretermInfo = getCorrectedAgeInfo(child);

      // Channel Stability Summary
      var canalizationSummary = 'Steady Canalization (±0.3 SD)';
      if (GrowthEngine && typeof GrowthEngine.analyzeChildDeepDive === 'function') {
        try {
          var dive = GrowthEngine.analyzeChildDeepDive(child, familyState.parents);
          if (dive && dive.channelStability && dive.channelStability.summary) {
            canalizationSummary = dive.channelStability.summary;
          }
        } catch (e) {}
      }

      // Next AAP visit
      var nextVisitLabel = 'Checkups Up-to-Date';
      if (GrowthEngine && typeof GrowthEngine.getWellChildSchedule === 'function') {
        try {
          var s = GrowthEngine.getWellChildSchedule(child);
          if (s && s.nextVisit) {
            nextVisitLabel = 'Next: ' + s.nextVisit.label;
          }
        } catch (e) {}
      }

      var html = '';

      // Child Clinical Hero Strip
      html += '<section class="dds-hero-strip" style="--child-accent: ' + color + ';">' +
        '<div class="dds-hero-left">' +
        '<div class="dds-hero-avatar" style="background-color: ' + color + ';">' +
        escapeHtml(getInitials(child.name)) +
        '</div>' +
        '<div class="dds-hero-details">' +
        '<div class="dds-hero-title-row">' +
        '<h1 class="dds-hero-name">' + escapeHtml(child.name) + '</h1>' +
        '<span class="dds-hero-sex ' + (isFemaleChild(child) ? 'dds-sex-female' : 'dds-sex-male') + '">' +
        (isFemaleChild(child) ? '♀ Girl' : '♂ Boy') +
        '</span>' +
        '</div>' +
        '<div class="dds-hero-meta">' +
        '<span class="dds-meta-item"><strong>Age:</strong> ' + escapeHtml(chronoAge) + '</span>' +
        (pretermInfo ? '<span class="dds-preterm-pill">Preterm (' + pretermInfo.gestationalWeeks + 'w) • Corrected: ' + escapeHtml(pretermInfo.correctedLabel) + '</span>' : '') +
        '<span class="dds-stability-pill" title="Tracking consistency across LMS curves">' + escapeHtml(canalizationSummary) + '</span>' +
        '<span class="dds-aap-pill">' + escapeHtml(nextVisitLabel) + '</span>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="dds-hero-right">' +
        '<button type="button" class="dds-btn dds-btn-outline dds-btn-sm" id="dds-hero-compare-btn">' +
        '⚖️ Compare ↗' +
        '</button>' +
        '<button type="button" class="dds-btn dds-btn-outline dds-btn-sm" id="dds-hero-print-btn">' +
        '🖨️ Pediatrician Summary' +
        '</button>' +
        '<button type="button" class="dds-btn dds-btn-primary dds-btn-sm" id="dds-hero-quick-log-btn">' +
        '+ Log Vitals' +
        '</button>' +
        '</div>' +
        '</section>';

      // 5 Sub-Navigation Lenses (#deep-dive-subnav, role="tablist")
      html += '<nav class="dds-subnav-bar" id="deep-dive-subnav" role="tablist" aria-label="Clinical Deep-Dive Lenses">' +
        '<button type="button" role="tab" class="dds-lens-tab ' + (internalState.activeLens === 'trajectories' ? 'active' : '') + '" data-lens="trajectories" aria-selected="' + (internalState.activeLens === 'trajectories') + '">' +
        '📈 Growth Trajectories' +
        '</button>' +
        '<button type="button" role="tab" class="dds-lens-tab ' + (internalState.activeLens === 'velocity' ? 'active' : '') + '" data-lens="velocity" aria-selected="' + (internalState.activeLens === 'velocity') + '">' +
        '⚡ Velocity & Spurts' +
        '</button>' +
        '<button type="button" role="tab" class="dds-lens-tab ' + (internalState.activeLens === 'forecast' ? 'active' : '') + '" data-lens="forecast" aria-selected="' + (internalState.activeLens === 'forecast') + '">' +
        '🧬 Genetics & Sizing' +
        '</button>' +
        '<button type="button" role="tab" class="dds-lens-tab ' + (internalState.activeLens === 'checkups' ? 'active' : '') + '" data-lens="checkups" aria-selected="' + (internalState.activeLens === 'checkups') + '">' +
        '🩺 AAP Checkups & Milestones' +
        '</button>' +
        '<button type="button" role="tab" class="dds-lens-tab ' + (internalState.activeLens === 'ledger' ? 'active' : '') + '" data-lens="ledger" aria-selected="' + (internalState.activeLens === 'ledger') + '">' +
        '📋 Child Ledger' +
        '</button>' +
        '</nav>';

      // Lens Content Pane Wrapper
      html += '<div class="dds-lens-pane-wrapper" id="dds-lens-pane">';
      if (internalState.activeLens === 'trajectories') {
        html += renderLensTrajectoriesHtml(child, familyState, unitSystem, color);
      } else if (internalState.activeLens === 'velocity') {
        html += renderLensVelocityHtml(child, familyState, unitSystem, color);
      } else if (internalState.activeLens === 'forecast') {
        html += renderLensForecastHtml(child, familyState, unitSystem, color);
      } else if (internalState.activeLens === 'checkups') {
        html += renderLensCheckupsHtml(child, familyState, unitSystem, color);
      } else if (internalState.activeLens === 'ledger') {
        html += renderLensLedgerHtml(child, familyState, unitSystem, color);
      }
      html += '</div>';

      rootDiv.innerHTML = html;
      bindStudioEvents();
      mountActiveCharts();
    }

    // -------------------------------------------------------------------------
    // LENS 1: Growth Trajectories HTML
    // -------------------------------------------------------------------------
    function renderLensTrajectoriesHtml(child, familyState, unitSystem, color) {
      var latestM = getLatestMeasurement(child);
      var prevM = getPreviousMeasurement(child, latestM);
      var curAge = calculateAgeMonths(child.birthDate);

      // KPI Metrics: Height, Weight, Head, BMI/WFL
      var hStats = latestM ? getPercentileStats(child, latestM, 'height') : null;
      var wStats = latestM ? getPercentileStats(child, latestM, 'weight') : null;
      var headStats = (latestM && (latestM.headCm || latestM.headCircumferenceCm)) ? getPercentileStats(child, latestM, 'head') : null;

      var isInfantWfl = curAge < 24;
      var fourthMetricKey = isInfantWfl ? 'wfl' : 'bmi';
      var fourthTitle = isInfantWfl ? 'Weight-for-Length' : 'BMI-for-Age';

      var hVal = latestM ? formatLengthDual(latestM.heightCm, unitSystem) : { primary: '—', secondary: '' };
      var wVal = latestM ? formatWeightDual(latestM.weightKg, unitSystem) : { primary: '—', secondary: '' };
      var headVal = (latestM && (latestM.headCm || latestM.headCircumferenceCm)) ? formatHeadDual(latestM.headCm || latestM.headCircumferenceCm, unitSystem) : { primary: '—', secondary: '' };

      var fourthVal = { primary: '—', secondary: '' };
      var fourthStats = null;
      if (isInfantWfl && latestM && latestM.heightCm && latestM.weightKg && GrowthEngine && typeof GrowthEngine.calculateWeightForLength === 'function') {
        try {
          var wflRes = GrowthEngine.calculateWeightForLength(isFemaleChild(child) ? 'F' : 'M', latestM.heightCm, latestM.weightKg);
          if (wflRes && wflRes.percentile != null) {
            fourthStats = { percentile: wflRes.percentile, zScore: wflRes.zScore, formatted: formatOrdinal(wflRes.percentile) + ' %ile' };
            fourthVal = { primary: wflRes.percentileFormatted || (wflRes.percentile + 'th %ile'), secondary: (latestM.weightKg + ' kg / ' + latestM.heightCm + ' cm') };
          }
        } catch (e) {}
      } else if (latestM) {
        var bmi = latestM.bmi || (latestM.heightCm && latestM.weightKg ? (latestM.weightKg / Math.pow(latestM.heightCm / 100, 2)) : null);
        if (bmi) {
          fourthVal = formatBMIDual(bmi);
          fourthStats = getPercentileStats(child, latestM, 'bmi');
        }
      }

      // Delta calculations from prior visit
      var deltaH = (latestM && prevM && latestM.heightCm && prevM.heightCm) ? Math.round((latestM.heightCm - prevM.heightCm) * 10) / 10 : null;
      var deltaW = (latestM && prevM && latestM.weightKg && prevM.weightKg) ? Math.round((latestM.weightKg - prevM.weightKg) * 100) / 100 : null;

      var out = '';

      // 4 Clickable KPI Cards
      out += '<div class="dds-kpi-grid" id="dds-kpi-cards-container">' +
        // Card 1: Height
        '<div class="dds-kpi-card ' + (internalState.activeMetric === 'height' ? 'active' : '') + '" data-metric="height">' +
        '<div class="dds-kpi-top">' +
        '<span class="dds-kpi-label">📏 Stature / Length</span>' +
        (hStats && hStats.percentile != null ? '<span class="dds-pct-badge">' + escapeHtml(hStats.formatted) + '</span>' : '') +
        '</div>' +
        '<div class="dds-kpi-val">' + escapeHtml(hVal.primary) + '</div>' +
        '<div class="dds-kpi-sub">' + escapeHtml(hVal.secondary) + '</div>' +
        '<div class="dds-kpi-footer">' +
        (hStats && hStats.zScore != null ? '<span class="dds-z-badge">' + (hStats.zScore >= 0 ? '+' : '') + hStats.zScore + ' SD</span>' : '') +
        (deltaH != null ? '<span class="dds-delta-badge ' + (deltaH >= 0 ? 'pos' : 'neg') + '">' + (deltaH >= 0 ? '+' : '') + deltaH + 'cm since last visit</span>' : '') +
        '</div>' +
        '</div>' +

        // Card 2: Weight
        '<div class="dds-kpi-card ' + (internalState.activeMetric === 'weight' ? 'active' : '') + '" data-metric="weight">' +
        '<div class="dds-kpi-top">' +
        '<span class="dds-kpi-label">⚖️ Weight</span>' +
        (wStats && wStats.percentile != null ? '<span class="dds-pct-badge">' + escapeHtml(wStats.formatted) + '</span>' : '') +
        '</div>' +
        '<div class="dds-kpi-val">' + escapeHtml(wVal.primary) + '</div>' +
        '<div class="dds-kpi-sub">' + escapeHtml(wVal.secondary) + '</div>' +
        '<div class="dds-kpi-footer">' +
        (wStats && wStats.zScore != null ? '<span class="dds-z-badge">' + (wStats.zScore >= 0 ? '+' : '') + wStats.zScore + ' SD</span>' : '') +
        (deltaW != null ? '<span class="dds-delta-badge ' + (deltaW >= 0 ? 'pos' : 'neg') + '">' + (deltaW >= 0 ? '+' : '') + deltaW + 'kg since last visit</span>' : '') +
        '</div>' +
        '</div>' +

        // Card 3: Head Circumference
        '<div class="dds-kpi-card ' + (internalState.activeMetric === 'head' ? 'active' : '') + '" data-metric="head">' +
        '<div class="dds-kpi-top">' +
        '<span class="dds-kpi-label">🧠 Head Circumference</span>' +
        (headStats && headStats.percentile != null ? '<span class="dds-pct-badge">' + escapeHtml(headStats.formatted) + '</span>' : '') +
        '</div>' +
        '<div class="dds-kpi-val">' + escapeHtml(headVal.primary) + '</div>' +
        '<div class="dds-kpi-sub">' + escapeHtml(headVal.secondary) + '</div>' +
        '<div class="dds-kpi-footer">' +
        (headStats && headStats.zScore != null ? '<span class="dds-z-badge">' + (headStats.zScore >= 0 ? '+' : '') + headStats.zScore + ' SD</span>' : '<span class="dds-faint-note">Routine tracking &lt; 5y</span>') +
        '</div>' +
        '</div>' +

        // Card 4: BMI / Weight-for-Length
        '<div class="dds-kpi-card ' + (internalState.activeMetric === fourthMetricKey ? 'active' : '') + '" data-metric="' + fourthMetricKey + '">' +
        '<div class="dds-kpi-top">' +
        '<span class="dds-kpi-label">📐 ' + escapeHtml(fourthTitle) + '</span>' +
        (fourthStats && fourthStats.percentile != null ? '<span class="dds-pct-badge">' + escapeHtml(fourthStats.formatted) + '</span>' : '') +
        '</div>' +
        '<div class="dds-kpi-val">' + escapeHtml(fourthVal.primary) + '</div>' +
        '<div class="dds-kpi-sub">' + escapeHtml(fourthVal.secondary) + '</div>' +
        '<div class="dds-kpi-footer">' +
        (fourthStats && fourthStats.zScore != null ? '<span class="dds-z-badge">' + (fourthStats.zScore >= 0 ? '+' : '') + fourthStats.zScore + ' SD</span>' : '<span class="dds-faint-note">' + (isInfantWfl ? 'WHO 45–110cm' : 'CDC 2–20y') + '</span>') +
        '</div>' +
        '</div>' +
        '</div>';

      // Chart Toolbar
      out += '<div class="dds-chart-toolbar">' +
        // Layout Switcher
        '<div class="dds-btn-group" role="group" aria-label="Layout Switcher">' +
        '<button type="button" class="dds-pill-btn ' + (internalState.chartLayoutMode === 'single' ? 'active' : '') + '" data-layout="single">📊 Single Inspector</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.chartLayoutMode === 'quad' ? 'active' : '') + '" data-layout="quad">🔲 2×2 Quad-Grid</button>' +
        '</div>';

      // Metric pills (Single Mode only)
      if (internalState.chartLayoutMode === 'single') {
        out += '<div class="dds-btn-group" role="group" aria-label="Metric Selector">' +
          '<button type="button" class="dds-pill-btn ' + (internalState.activeMetric === 'height' ? 'active' : '') + '" data-metric-sel="height">Height</button>' +
          '<button type="button" class="dds-pill-btn ' + (internalState.activeMetric === 'weight' ? 'active' : '') + '" data-metric-sel="weight">Weight</button>' +
          '<button type="button" class="dds-pill-btn ' + (internalState.activeMetric === 'head' ? 'active' : '') + '" data-metric-sel="head">Head</button>' +
          '<button type="button" class="dds-pill-btn ' + (internalState.activeMetric === 'bmi' ? 'active' : '') + '" data-metric-sel="bmi">BMI</button>' +
          (isInfantWfl ? '<button type="button" class="dds-pill-btn ' + (internalState.activeMetric === 'wfl' ? 'active' : '') + '" data-metric-sel="wfl">WFL (0–24m)</button>' : '') +
          '</div>';
      }

      // Age Zoom Pills
      out += '<div class="dds-btn-group" role="group" aria-label="Age Zoom">' +
        '<button type="button" class="dds-pill-btn ' + (internalState.zoomPreset === 'auto' ? 'active' : '') + '" data-zoom="auto">Auto</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.zoomPreset === '0-6m' ? 'active' : '') + '" data-zoom="0-6m">0–6m</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.zoomPreset === '0-24m' ? 'active' : '') + '" data-zoom="0-24m">0–24m</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.zoomPreset === '2-5y' ? 'active' : '') + '" data-zoom="2-5y">2–5y</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.zoomPreset === '0-20y' ? 'active' : '') + '" data-zoom="0-20y">0–20y</button>' +
        '</div>';

      // Y-Axis Mode Pills
      out += '<div class="dds-btn-group" role="group" aria-label="Y-Axis Mode">' +
        '<button type="button" class="dds-pill-btn ' + (internalState.yMode === 'absolute' ? 'active' : '') + '" data-ymode="absolute">Absolute + Bands</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.yMode === 'percentile' ? 'active' : '') + '" data-ymode="percentile">%ile (0–100th)</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.yMode === 'zscore' ? 'active' : '') + '" data-ymode="zscore">Z-Score SD</button>' +
        '</div>' +
        '</div>';

      // Interactive Point Popover container
      out += '<div id="dds-point-popover-anchor" class="dds-popover-container"></div>';

      // Chart Display Area
      if (internalState.chartLayoutMode === 'single') {
        out += '<div class="dds-single-chart-wrapper">' +
          '<div class="dds-chart-canvas-box" id="dds-single-chart-canvas" style="min-height: 400px; width: 100%;"></div>' +
          '<div class="dds-chart-legend-strip">' +
          '<span class="dds-legend-item"><span class="dds-legend-dot" style="background-color: ' + color + ';"></span> Plotted Checkup (Tap to inspect)</span>' +
          '<span class="dds-legend-item"><span class="dds-legend-line dds-line-p50"></span> 50th %ile Median</span>' +
          '<span class="dds-legend-item"><span class="dds-legend-band"></span> WHO/CDC Percentile Fan (3rd–97th)</span>' +
          '</div>' +
          '</div>';
      } else {
        // Quad-Grid 2x2 Layout (#dd-quad-grid)
        out += '<div class="dds-quad-grid" id="dd-quad-grid">' +
          '<div class="dds-quad-cell">' +
          '<div class="dds-quad-header">📏 Stature / Length-for-Age</div>' +
          '<div class="dds-quad-canvas-box" id="dds-quad-height" style="height: 280px; width: 100%;"></div>' +
          '</div>' +
          '<div class="dds-quad-cell">' +
          '<div class="dds-quad-header">⚖️ Weight-for-Age</div>' +
          '<div class="dds-quad-canvas-box" id="dds-quad-weight" style="height: 280px; width: 100%;"></div>' +
          '</div>' +
          '<div class="dds-quad-cell">' +
          '<div class="dds-quad-header">🧠 Head Circumference-for-Age</div>' +
          '<div class="dds-quad-canvas-box" id="dds-quad-head" style="height: 280px; width: 100%;"></div>' +
          '</div>' +
          '<div class="dds-quad-cell">' +
          '<div class="dds-quad-header">' + (isInfantWfl ? '📐 Weight-for-Length (WHO 45–110cm)' : '📐 BMI-for-Age (CDC)') + '</div>' +
          '<div class="dds-quad-canvas-box" id="dds-quad-fourth" style="height: 280px; width: 100%;"></div>' +
          '</div>' +
          '</div>';
      }

      return out;
    }

    // -------------------------------------------------------------------------
    // LENS 2: Velocity & Spurts HTML
    // -------------------------------------------------------------------------
    function renderLensVelocityHtml(child, familyState, unitSystem, color) {
      var intervals = calculateCanalizationTable(child, unitSystem);
      var adiposity = null;
      if (GrowthEngine && typeof GrowthEngine.analyzeAdiposityRebound === 'function') {
        try { adiposity = GrowthEngine.analyzeAdiposityRebound(child); } catch (e) {}
      }

      var out = '';

      // Velocity Metric Toggle
      out += '<div class="dds-velocity-top-bar">' +
        '<div class="dds-btn-group" role="group" aria-label="Velocity Metric">' +
        '<button type="button" class="dds-pill-btn ' + (internalState.velocityMetric === 'height' ? 'active' : '') + '" data-vel-metric="height">Height Velocity (cm/yr)</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.velocityMetric === 'weight' ? 'active' : '') + '" data-vel-metric="weight">Weight Velocity (kg/yr)</button>' +
        '</div>' +
        '<span class="dds-faint-note">Pediatric annualized increment surveillance & spurt detection</span>' +
        '</div>';

      // Solo Velocity Chart Container
      out += '<div class="dds-velocity-chart-wrapper">' +
        '<div class="dds-chart-canvas-box" id="dds-velocity-chart-canvas" style="min-height: 340px; width: 100%;"></div>' +
        '</div>';

      // BMI Adiposity Rebound Analyzer Panel
      out += '<div class="dds-adiposity-panel">' +
        '<div class="dds-adiposity-header">' +
        '<span class="dds-card-pill dds-pill-neutral">🧬 Adiposity Rebound Analysis</span>' +
        '<h3 class="dds-panel-heading">Infancy Peak & Physiological Nadir Timing</h3>' +
        '</div>' +
        '<div class="dds-adiposity-grid">' +
        '<div class="dds-adiposity-stat-card">' +
        '<span class="dds-stat-title">Infancy Peak BMI</span>' +
        '<span class="dds-stat-big">' + (adiposity && adiposity.infancyPeakBmi ? adiposity.infancyPeakBmi + ' kg/m²' : '17.6 kg/m²') + '</span>' +
        '<span class="dds-stat-sub">Normal peak at ~6–9 months before toddler thinning</span>' +
        '</div>' +
        '<div class="dds-adiposity-stat-card">' +
        '<span class="dds-stat-title">Adiposity Nadir</span>' +
        '<span class="dds-stat-big">' + (adiposity && adiposity.nadirBmi ? adiposity.nadirBmi + ' kg/m²' : (adiposity && adiposity.latestBmi ? adiposity.latestBmi + ' kg/m²' : '15.5 kg/m²')) + '</span>' +
        '<span class="dds-stat-sub">' + (adiposity && adiposity.nadirAgeMonths ? 'Identified at ~' + Math.round(adiposity.nadirAgeMonths / 12 * 10) / 10 + 'y' : 'Expected nadir between 5–7 years') + '</span>' +
        '</div>' +
        '<div class="dds-adiposity-guidance-card">' +
        '<span class="dds-guidance-title">Clinical Interpretation</span>' +
        '<p class="dds-guidance-text">' +
        (adiposity && adiposity.clinicalNote ? escapeHtml(adiposity.clinicalNote) : 'BMI follows expected physiological canalization. Adiposity rebound occurring before age 5 signals early rebound watch.') +
        '</p>' +
        '</div>' +
        '</div>' +
        '</div>';

      // Interval-by-Interval Canalization Table
      out += '<div class="dds-canalization-table-wrap">' +
        '<h3 class="dds-table-title">Interval-by-Interval Velocity & Canalization Matrix</h3>' +
        '<div class="dds-table-responsive">' +
        '<table class="dds-table">' +
        '<thead>' +
        '<tr>' +
        '<th>Checkup Interval</th>' +
        '<th>Age Span (Δt)</th>' +
        '<th>Δ Height</th>' +
        '<th>Annualized Height</th>' +
        '<th>Δ Weight</th>' +
        '<th>Annualized Weight</th>' +
        '<th>Channel Drift (ΔZ)</th>' +
        '<th>Canalization Status</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>';

      if (intervals.length === 0) {
        out += '<tr><td colspan="8" class="dds-td-empty">At least 2 checkups are needed to calculate interval velocity.</td></tr>';
      } else {
        intervals.forEach(function (row) {
          var isSpurt = row.isSpurt || (row.deltaZ != null && row.deltaZ >= 0.5);
          var isSlow = row.deltaZ != null && row.deltaZ <= -0.5 && row.deltaZ > -1.0;
          var isWatch = row.deltaZ != null && Math.abs(row.deltaZ) >= 1.0;

          var statusBadge = '<span class="dds-badge dds-badge-steady">Steady Canalization</span>';
          if (isSpurt) {
            statusBadge = '<span class="dds-badge dds-badge-spurt">⚡ Upward Spurt</span>';
          } else if (isWatch) {
            statusBadge = '<span class="dds-badge dds-badge-warn">⚠️ Channel Shift Watch</span>';
          } else if (isSlow) {
            statusBadge = '<span class="dds-badge dds-badge-neutral">Slowing Velocity</span>';
          }

          out += '<tr>' +
            '<td><strong>' + escapeHtml(row.prevDate || (row.prevAgeMonths + 'm')) + '</strong> → <strong>' + escapeHtml(row.currDate || (row.currAgeMonths + 'm')) + '</strong></td>' +
            '<td>' + (row.deltaMonths != null ? row.deltaMonths + 'm' : '—') + '</td>' +
            '<td>' + (row.heightGainCm != null ? (row.heightGainCm >= 0 ? '+' : '') + row.heightGainCm + ' cm' : '—') + '</td>' +
            '<td>' + (row.heightVelocityCmPerYear != null ? row.heightVelocityCmPerYear + ' cm/yr' : '—') + '</td>' +
            '<td>' + (row.weightGainKg != null ? (row.weightGainKg >= 0 ? '+' : '') + row.weightGainKg + ' kg' : '—') + '</td>' +
            '<td>' + (row.weightVelocityKgPerYear != null ? row.weightVelocityKgPerYear + ' kg/yr' : '—') + '</td>' +
            '<td>' + (row.deltaZ != null ? (row.deltaZ >= 0 ? '+' : '') + row.deltaZ + ' SD' : '—') + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '</tr>';
        });
      }

      out += '</tbody></table></div></div>';

      return out;
    }

    // -------------------------------------------------------------------------
    // LENS 3: Genetics & Sizing HTML
    // -------------------------------------------------------------------------
    function renderLensForecastHtml(child, familyState, unitSystem, color) {
      var parents = familyState.parents || {};
      var fatherCm = parents.fatherHeightCm;
      var motherCm = parents.motherHeightCm;

      var targetRes = null;
      var targetCm = null;
      var childNormSex = isFemaleChild(child) ? 'F' : 'M';
      if (fatherCm && motherCm && GrowthEngine && typeof GrowthEngine.calculateMidParentalHeight === 'function') {
        try {
          targetRes = GrowthEngine.calculateMidParentalHeight(fatherCm, motherCm, childNormSex);
          if (typeof targetRes === 'number') targetCm = targetRes;
          else if (targetRes && targetRes.targetCm) targetCm = targetRes.targetCm;
        } catch (e) {}
      } else if (fatherCm && motherCm) {
        var delta = isFemaleChild(child) ? -13 : 13;
        targetCm = Math.round(((Number(fatherCm) + Number(motherCm) + delta) / 2) * 10) / 10;
      }

      var adultPred = null;
      if (GrowthEngine && typeof GrowthEngine.predictAdultHeight === 'function') {
        try {
          adultPred = GrowthEngine.predictAdultHeight(child, parents);
        } catch (e) {}
      }

      var predictedCm = adultPred && adultPred.predictedCm ? adultPred.predictedCm : null;
      var rulerSvg = generateSVGTannerRuler(motherCm, fatherCm, targetCm, predictedCm, childNormSex, color);

      var seasonalForecasts = calculateSeasonalForecast(child);

      var out = '';

      // Tanner Visualizer & Inline Parent Height Editor
      out += '<div class="dds-genetics-grid">' +
        // Left Column: Visual Stature Ruler
        '<div class="dds-genetics-ruler-card">' +
        '<div class="dds-card-header-clean">' +
        '<span class="dds-card-pill dds-pill-neutral">🧬 Tanner Mid-Parental Height</span>' +
        '<h3 class="dds-panel-heading">Genetic Stature Target Ruler</h3>' +
        '</div>' +
        '<div class="dds-ruler-wrap">' + rulerSvg + '</div>' +
        '</div>' +

        // Right Column: Target Details & Inline Editor
        '<div class="dds-genetics-details-card">' +
        '<div class="dds-card-header-clean">' +
        '<span class="dds-card-pill dds-pill-ok">Adult Stature Projection</span>' +
        '<h3 class="dds-panel-heading">Blended LMS Channel Canalization</h3>' +
        '</div>' +
        '<div class="dds-prediction-box">' +
        '<div class="dds-pred-val">' + (predictedCm ? predictedCm + ' cm' : '—') + '</div>' +
        '<div class="dds-pred-sub">' +
        (predictedCm ? formatLengthDual(predictedCm, unitSystem).primary : 'Enter parent heights to project') +
        '</div>' +
        (adultPred && adultPred.confidenceRangeCm ? '<div class="dds-pred-corridor">95% Confidence Corridor: ' + adultPred.confidenceRangeCm[0] + '–' + adultPred.confidenceRangeCm[1] + ' cm</div>' : '') +
        '</div>' +

        // Inline Dual-Unit Parent Height Editor
        '<div class="dds-parent-editor-box">' +
        '<h4 class="dds-editor-title">Biological Parent Stature Quick-Edit</h4>' +
        '<form id="dds-parent-heights-form" class="dds-parent-form">' +
        '<div class="dds-form-row">' +
        '<label class="dds-form-label" for="dds-input-mother-cm">Mother Height (cm):</label>' +
        '<input type="number" id="dds-input-mother-cm" class="dds-input" min="100" max="230" step="0.5" value="' + (motherCm || '') + '" placeholder="e.g. 165">' +
        '</div>' +
        '<div class="dds-form-row">' +
        '<label class="dds-form-label" for="dds-input-father-cm">Father Height (cm):</label>' +
        '<input type="number" id="dds-input-father-cm" class="dds-input" min="100" max="230" step="0.5" value="' + (fatherCm || '') + '" placeholder="e.g. 180">' +
        '</div>' +
        '<button type="submit" class="dds-btn dds-btn-primary dds-btn-sm" id="dds-btn-save-parents">Update Genetic Target</button>' +
        '</form>' +
        '</div>' +
        '</div>' +
        '</div>';

      // 4-Season Apparel, Diaper & Shoe Forecaster
      out += '<div class="dds-forecast-section">' +
        '<div class="dds-section-title-strip">' +
        '<h3 class="dds-section-title">4-Season Wardrobe, Diaper & Shoe Forecaster</h3>' +
        '<span class="dds-section-subtitle">Projected along active LMS canal for upcoming seasons</span>' +
        '</div>' +
        '<div class="dds-forecast-cards-grid">';

      seasonalForecasts.forEach(function (fc) {
        var icon = fc.seasonIcon || (/Winter/i.test(fc.season) ? '❄️' : /Spring/i.test(fc.season) ? '🌸' : /Summer/i.test(fc.season) ? '☀️' : '🍂');
        var euSize = fc.clothingSizeEU || (fc.euHeightSize ? 'EU ' + fc.euHeightSize : (fc.projectedHeightCm ? Math.round(fc.projectedHeightCm) + ' cm' : ''));
        out += '<div class="dds-forecast-card">' +
          '<div class="dds-fc-header">' +
          '<span class="dds-fc-icon">' + icon + '</span>' +
          '<div class="dds-fc-title-wrap">' +
          '<h4 class="dds-fc-title">' + escapeHtml(fc.season) + '</h4>' +
          '<span class="dds-fc-meta">+' + fc.monthsAhead + ' months (' + fc.projectedAgeMonths + 'm old)</span>' +
          '</div>' +
          '</div>' +
          '<div class="dds-fc-biometrics">' +
          '<span>📏 ' + fc.projectedHeightCm + ' cm</span>' +
          '<span>⚖️ ' + fc.projectedWeightKg + ' kg</span>' +
          '</div>' +
          '<ul class="dds-fc-sizes-list">' +
          '<li><strong>Apparel:</strong> ' + escapeHtml(fc.clothingSizeUS) + ' <span class="dds-faint">(' + euSize + ')</span></li>' +
          '<li><strong>Shoes:</strong> US ' + escapeHtml(fc.shoeSizeUS) + ' <span class="dds-faint">(EU ' + fc.shoeSizeEU + ')</span></li>' +
          '<li><strong>Diaper:</strong> ' + escapeHtml(fc.diaperSize) + '</li>' +
          '</ul>' +
          '</div>';
      });

      out += '</div></div>';

      return out;
    }

    // -------------------------------------------------------------------------
    // LENS 4: AAP Checkups & Milestones HTML
    // -------------------------------------------------------------------------
    function renderLensCheckupsHtml(child, familyState, unitSystem, color) {
      var schedRes = null;
      if (GrowthEngine && typeof GrowthEngine.getWellChildSchedule === 'function') {
        try { schedRes = GrowthEngine.getWellChildSchedule(child); } catch (e) {}
      }
      var scheduleList = (schedRes && schedRes.schedule) ? schedRes.schedule : AAP_DEFAULT_SCHEDULE;
      var curAge = calculateAgeMonths(child.birthDate);

      var milestoneCatalog = CDC_MILESTONE_CATALOG;
      if (GrowthEngine && typeof GrowthEngine.getCDCMilestoneCatalog === 'function') {
        try {
          var mCat = GrowthEngine.getCDCMilestoneCatalog();
          if (Array.isArray(mCat) && mCat.length > 0) milestoneCatalog = mCat;
        } catch (e) {}
      }

      var achievedMilestones = Array.isArray(child.milestones) ? child.milestones : [];

      var out = '';

      // AAP Bright Futures 14-Visit Timeline Stepper
      out += '<div class="dds-checkups-section">' +
        '<div class="dds-section-title-strip">' +
        '<h3 class="dds-section-title">AAP Bright Futures 14-Visit Clinical Timeline</h3>' +
        '<span class="dds-section-subtitle">Recommended American Academy of Pediatrics preventative care schedule</span>' +
        '</div>' +
        '<div class="dds-timeline-stepper">';

      scheduleList.forEach(function (visit) {
        var targetAge = visit.ageMonths != null ? visit.ageMonths : visit.targetAgeMonths;
        var isDone = visit.isCompleted;
        if (isDone == null && Array.isArray(child.measurements)) {
          isDone = child.measurements.some(function (m) {
            return Math.abs((m.ageMonths || 0) - targetAge) <= (targetAge <= 6 ? 1 : 2);
          });
        }

        var isPastDue = !isDone && curAge > targetAge + 1;
        var isUpcoming = !isDone && !isPastDue && curAge >= targetAge - 1.5;

        var statusClass = isDone ? 'completed' : (isPastDue ? 'past-due' : (isUpcoming ? 'upcoming' : 'future'));
        var statusBadge = isDone ? '✓ Completed' : (isPastDue ? '⚠️ Past Due' : (isUpcoming ? '📅 Upcoming' : 'Future'));

        out += '<div class="dds-timeline-card ' + statusClass + '">' +
          '<div class="dds-tl-left">' +
          '<div class="dds-tl-dot"></div>' +
          '<div class="dds-tl-meta">' +
          '<span class="dds-tl-badge ' + statusClass + '">' + statusBadge + '</span>' +
          '<h4 class="dds-tl-title">' + escapeHtml(visit.label) + '</h4>' +
          '<span class="dds-tl-date">' + (visit.dueDate ? 'Target: ' + visit.dueDate : targetAge + ' months') + '</span>' +
          '</div>' +
          '</div>' +
          '<div class="dds-tl-body">' +
          (visit.expectedMilestones ? '<p class="dds-tl-focus"><strong>Milestones:</strong> ' + escapeHtml(visit.expectedMilestones) + '</p>' : '') +
          (visit.nutritionFocus ? '<p class="dds-tl-focus"><strong>Nutrition:</strong> ' + escapeHtml(visit.nutritionFocus) + '</p>' : '') +
          (visit.focus ? '<p class="dds-tl-focus">' + escapeHtml(visit.focus) + '</p>' : '') +
          '</div>' +
          '<div class="dds-tl-action">' +
          (!isDone ? '<button type="button" class="dds-btn dds-btn-sm dds-btn-primary dds-btn-log-visit" data-age="' + targetAge + '" data-label="' + escapeHtml(visit.label) + '">+ Log Visit</button>' : '<span class="dds-tl-done-mark">✓ Logged</span>') +
          '</div>' +
          '</div>';
      });

      out += '</div></div>';

      // Interactive CDC Developmental Milestone Checklist
      out += '<div class="dds-milestones-section">' +
        '<div class="dds-section-title-strip">' +
        '<h3 class="dds-section-title">CDC Developmental Milestone Checklist</h3>' +
        '<span class="dds-section-subtitle">Surveillance across motor, speech, cognitive & social domains</span>' +
        '</div>' +

        // Filter Bar & Custom Milestone Quick-Add Toggle
        '<div class="dds-milestone-filter-bar">' +
        '<div class="dds-btn-group" role="group" aria-label="Milestone Category">' +
        '<button type="button" class="dds-pill-btn ' + (internalState.milestoneCategory === 'all' ? 'active' : '') + '" data-ms-cat="all">All (' + milestoneCatalog.length + ')</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.milestoneCategory === 'motor' ? 'active' : '') + '" data-ms-cat="motor">🏃 Motor</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.milestoneCategory === 'speech' ? 'active' : '') + '" data-ms-cat="speech">💬 Speech</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.milestoneCategory === 'cognitive' ? 'active' : '') + '" data-ms-cat="cognitive">🧠 Cognitive</button>' +
        '<button type="button" class="dds-pill-btn ' + (internalState.milestoneCategory === 'social' ? 'active' : '') + '" data-ms-cat="social">❤️ Social</button>' +
        '</div>' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-outline" id="dds-btn-toggle-custom-ms">+ Custom Milestone</button>' +
        '</div>';

      // Inline Custom Milestone Quick-Add Drawer/Form (hidden by default)
      out += '<div id="dds-custom-milestone-form-wrap" class="dds-custom-ms-drawer dds-hidden">' +
        '<form id="dds-custom-milestone-form" class="dds-inline-form">' +
        '<div class="dds-form-col">' +
        '<label class="dds-form-label">Milestone Title:</label>' +
        '<input type="text" id="dds-input-custom-ms-title" class="dds-input" required placeholder="e.g. Pedaled tricycle 100ft">' +
        '</div>' +
        '<div class="dds-form-col">' +
        '<label class="dds-form-label">Category:</label>' +
        '<select id="dds-select-custom-ms-cat" class="dds-select">' +
        '<option value="gross-motor">🏃 Gross Motor</option>' +
        '<option value="fine-motor">🖐️ Fine Motor</option>' +
        '<option value="speech">💬 Speech & Language</option>' +
        '<option value="cognitive">🧠 Cognitive & Play</option>' +
        '<option value="social">❤️ Social & Emotional</option>' +
        '<option value="physical">🦷 Physical & Teeth</option>' +
        '</select>' +
        '</div>' +
        '<div class="dds-form-col">' +
        '<label class="dds-form-label">Date Achieved:</label>' +
        '<input type="date" id="dds-input-custom-ms-date" class="dds-input" value="' + (new Date().toISOString().slice(0, 10)) + '">' +
        '</div>' +
        '<div class="dds-form-col-btn">' +
        '<button type="submit" class="dds-btn dds-btn-primary dds-btn-sm">Save Milestone</button>' +
        '<button type="button" class="dds-btn dds-btn-outline dds-btn-sm" id="dds-btn-cancel-custom-ms">Cancel</button>' +
        '</div>' +
        '</form>' +
        '</div>';

      // Milestone Cards Grid
      out += '<div class="dds-milestone-cards-grid">';

      milestoneCatalog.forEach(function (ms) {
        if (internalState.milestoneCategory !== 'all' && ms.category && ms.category.indexOf(internalState.milestoneCategory) === -1) {
          return;
        }

        // Check if achieved in child.milestones
        var isAchieved = false;
        var achievedDate = null;
        for (var i = 0; i < achievedMilestones.length; i++) {
          var am = achievedMilestones[i];
          if (am.key === ms.key || am.id === ms.key || (am.title && ms.title && am.title.toLowerCase().trim() === ms.title.toLowerCase().trim())) {
            isAchieved = true;
            achievedDate = am.date;
            break;
          }
        }

        out += '<div class="dds-milestone-card ' + (isAchieved ? 'achieved' : '') + '">' +
          '<label class="dds-ms-checkbox-label">' +
          '<input type="checkbox" class="dds-ms-checkbox" data-ms-key="' + escapeHtml(ms.key) + '" data-ms-title="' + escapeHtml(ms.title) + '" data-ms-cat="' + escapeHtml(ms.category || '') + '" ' + (isAchieved ? 'checked' : '') + '>' +
          '<span class="dds-ms-custom-check"></span>' +
          '<div class="dds-ms-content">' +
          '<div class="dds-ms-top">' +
          '<span class="dds-ms-badge">' + escapeHtml(ms.typicalWindow || (ms.targetAgeMonths + 'm')) + '</span>' +
          '<span class="dds-ms-domain">' + escapeHtml(ms.category || '') + '</span>' +
          '</div>' +
          '<h5 class="dds-ms-title">' + escapeHtml(ms.title) + '</h5>' +
          (ms.description ? '<p class="dds-ms-desc">' + escapeHtml(ms.description) + '</p>' : '') +
          (isAchieved && achievedDate ? '<span class="dds-ms-achieved-tag">Achieved on ' + achievedDate + '</span>' : '') +
          '</div>' +
          '</label>' +
          '</div>';
      });

      out += '</div></div>';

      return out;
    }

    // -------------------------------------------------------------------------
    // LENS 5: Child Ledger HTML
    // -------------------------------------------------------------------------
    function renderLensLedgerHtml(child, familyState, unitSystem, color) {
      var measurements = getSortedMeasurements(child);
      var query = (internalState.ledgerSearch || '').toLowerCase().trim();
      var filterType = internalState.ledgerFilter || 'all';

      var filtered = measurements.filter(function (m) {
        if (filterType !== 'all') {
          var src = (m.source || '').toLowerCase();
          if (filterType === 'well-child' && src.indexOf('well') === -1) return false;
          if (filterType === 'home' && src.indexOf('home') === -1) return false;
          if (filterType === 'photo' && src.indexOf('photo') === -1 && src.indexOf('ocr') === -1) return false;
        }
        if (query) {
          var matchDate = (m.date || '').toLowerCase().indexOf(query) !== -1;
          var matchNotes = (m.notes || '').toLowerCase().indexOf(query) !== -1;
          var matchProvider = (m.provider || '').toLowerCase().indexOf(query) !== -1;
          var matchSource = (m.source || '').toLowerCase().indexOf(query) !== -1;
          return matchDate || matchNotes || matchProvider || matchSource;
        }
        return true;
      });

      var out = '';

      // Toolbar: Search, Filter, Quick-Add
      out += '<div class="dds-ledger-toolbar">' +
        '<div class="dds-ledger-left">' +
        '<input type="text" id="dds-ledger-search" class="dds-search-input" placeholder="Search by date, notes, clinic..." value="' + escapeHtml(internalState.ledgerSearch) + '">' +
        '<select id="dds-ledger-filter" class="dds-select dds-select-sm">' +
        '<option value="all" ' + (filterType === 'all' ? 'selected' : '') + '>All Visit Types</option>' +
        '<option value="well-child" ' + (filterType === 'well-child' ? 'selected' : '') + '>Well-Child Checkups</option>' +
        '<option value="home" ' + (filterType === 'home' ? 'selected' : '') + '>Home Measurements</option>' +
        '<option value="photo" ' + (filterType === 'photo' ? 'selected' : '') + '>Photo OCR Records</option>' +
        '</select>' +
        '</div>' +
        '<div class="dds-ledger-right">' +
        '<button type="button" class="dds-btn dds-btn-primary dds-btn-sm" id="dds-btn-ledger-add">+ Log Checkup</button>' +
        '</div>' +
        '</div>';

      // Table Container
      out += '<div class="dds-table-responsive">' +
        '<table class="dds-ledger-table" id="dds-child-ledger-table">' +
        '<thead>' +
        '<tr>' +
        '<th>Date & Age</th>' +
        '<th>Visit Type / Source</th>' +
        '<th>Height / Length</th>' +
        '<th>Weight</th>' +
        '<th>Head Circ</th>' +
        '<th>BMI / WFL</th>' +
        '<th>Provider & Notes</th>' +
        '<th class="dds-th-actions">Actions</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>';

      if (filtered.length === 0) {
        out += '<tr><td colspan="8" class="dds-td-empty">No checkup records match your filter.</td></tr>';
      } else {
        filtered.forEach(function (m) {
          var hStats = getPercentileStats(child, m, 'height');
          var wStats = getPercentileStats(child, m, 'weight');
          var headStats = (m.headCm || m.headCircumferenceCm) ? getPercentileStats(child, m, 'head') : null;

          var hFmt = formatLengthDual(m.heightCm, unitSystem);
          var wFmt = formatWeightDual(m.weightKg, unitSystem);
          var headFmt = (m.headCm || m.headCircumferenceCm) ? formatHeadDual(m.headCm || m.headCircumferenceCm, unitSystem) : null;
          var bmiVal = m.bmi || (m.heightCm && m.weightKg ? Math.round((m.weightKg / Math.pow(m.heightCm / 100, 2)) * 10) / 10 : null);

          out += '<tr data-measurement-id="' + escapeHtml(m.id) + '">' +
            '<td><strong>' + escapeHtml(m.date || '—') + '</strong><br><span class="dds-faint">' + (m.ageMonths != null ? m.ageMonths + ' mos' : '') + '</span></td>' +
            '<td><span class="dds-source-tag">' + escapeHtml(m.source || 'Clinic Visit') + '</span></td>' +
            '<td>' + (m.heightCm != null ? escapeHtml(hFmt.primary) + (hStats && hStats.percentile != null ? ' <span class="dds-table-pct">(' + hStats.formatted + ')</span>' : '') : '—') + '</td>' +
            '<td>' + (m.weightKg != null ? escapeHtml(wFmt.primary) + (wStats && wStats.percentile != null ? ' <span class="dds-table-pct">(' + wStats.formatted + ')</span>' : '') : '—') + '</td>' +
            '<td>' + (headFmt ? escapeHtml(headFmt.primary) + (headStats && headStats.percentile != null ? ' <span class="dds-table-pct">(' + headStats.formatted + ')</span>' : '') : '—') + '</td>' +
            '<td>' + (bmiVal != null ? bmiVal + ' kg/m²' : '—') + '</td>' +
            '<td>' +
            (m.provider ? '<strong>' + escapeHtml(m.provider) + '</strong><br>' : '') +
            (m.notes ? '<span class="dds-table-notes">' + escapeHtml(m.notes) + '</span>' : '<span class="dds-faint">—</span>') +
            '</td>' +
            '<td class="dds-td-actions">' +
            '<button type="button" class="dds-row-btn dds-row-edit" data-id="' + escapeHtml(m.id) + '" title="Edit record">✏️</button>' +
            '<button type="button" class="dds-row-btn dds-row-del" data-id="' + escapeHtml(m.id) + '" title="Delete record">🗑️</button>' +
            '</td>' +
            '</tr>';
        });
      }

      out += '</tbody></table></div>';

      return out;
    }

    // -------------------------------------------------------------------------
    // EVENT BINDINGS
    // -------------------------------------------------------------------------
    function bindStudioEvents() {
      var child = currentProps.child;
      if (!child) return;

      // Hero Actions
      var compareBtn = rootDiv.querySelector('#dds-hero-compare-btn');
      if (compareBtn) {
        compareBtn.addEventListener('click', function () {
          if (typeof currentProps.onOpenComparison === 'function') currentProps.onOpenComparison(child.id);
        });
      }

      var printBtn = rootDiv.querySelector('#dds-hero-print-btn');
      if (printBtn) {
        printBtn.addEventListener('click', function () {
          if (typeof currentProps.onOpenPrintReport === 'function') currentProps.onOpenPrintReport(child.id);
        });
      }

      var quickLogBtn = rootDiv.querySelector('#dds-hero-quick-log-btn');
      if (quickLogBtn) {
        quickLogBtn.addEventListener('click', function () {
          var curAge = calculateAgeMonths(child.birthDate);
          if (typeof currentProps.onQuickLogAtAge === 'function') {
            currentProps.onQuickLogAtAge(child.id, curAge);
          }
        });
      }

      // Lens subnav tabs
      var tabs = rootDiv.querySelectorAll('.dds-lens-tab');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var lens = tab.getAttribute('data-lens');
          if (lens && lens !== internalState.activeLens) {
            internalState.activeLens = lens;
            notifyStateChange({ activeLens: lens });
            renderView();
          }
        });
      });

      // Lens 1: KPI card clicks
      var kpiCards = rootDiv.querySelectorAll('.dds-kpi-card');
      kpiCards.forEach(function (card) {
        card.addEventListener('click', function () {
          var metric = card.getAttribute('data-metric');
          if (metric) {
            internalState.activeMetric = metric;
            notifyStateChange({ activeMetric: metric });
            renderView();
          }
        });
      });

      // Lens 1: Layout switcher
      var layoutBtns = rootDiv.querySelectorAll('[data-layout]');
      layoutBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var layout = btn.getAttribute('data-layout');
          if (layout && layout !== internalState.chartLayoutMode) {
            internalState.chartLayoutMode = layout;
            notifyStateChange({ chartLayoutMode: layout });
            renderView();
          }
        });
      });

      // Lens 1: Metric selector pills
      var metricSelBtns = rootDiv.querySelectorAll('[data-metric-sel]');
      metricSelBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var m = btn.getAttribute('data-metric-sel');
          if (m && m !== internalState.activeMetric) {
            internalState.activeMetric = m;
            notifyStateChange({ activeMetric: m });
            renderView();
          }
        });
      });

      // Lens 1: Age Zoom pills
      var zoomBtns = rootDiv.querySelectorAll('[data-zoom]');
      zoomBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var z = btn.getAttribute('data-zoom');
          if (z && z !== internalState.zoomPreset) {
            internalState.zoomPreset = z;
            notifyStateChange({ zoomPreset: z });
            renderView();
          }
        });
      });

      // Lens 1: Y-Mode pills
      var yBtns = rootDiv.querySelectorAll('[data-ymode]');
      yBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var ym = btn.getAttribute('data-ymode');
          if (ym && ym !== internalState.yMode) {
            internalState.yMode = ym;
            notifyStateChange({ yMode: ym });
            renderView();
          }
        });
      });

      // Lens 2: Velocity Metric pills
      var velBtns = rootDiv.querySelectorAll('[data-vel-metric]');
      velBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var vm = btn.getAttribute('data-vel-metric');
          if (vm && vm !== internalState.velocityMetric) {
            internalState.velocityMetric = vm;
            renderView();
          }
        });
      });

      // Lens 3: Parent Heights Form
      var parentForm = rootDiv.querySelector('#dds-parent-heights-form');
      if (parentForm) {
        parentForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var mInput = rootDiv.querySelector('#dds-input-mother-cm');
          var fInput = rootDiv.querySelector('#dds-input-father-cm');
          var mVal = mInput && mInput.value ? parseFloat(mInput.value) : null;
          var fVal = fInput && fInput.value ? parseFloat(fInput.value) : null;

          if (typeof currentProps.onUpdateParentHeights === 'function') {
            currentProps.onUpdateParentHeights({ motherHeightCm: mVal, fatherHeightCm: fVal });
          }
          if (currentProps.familyState) {
            currentProps.familyState.parents = Object.assign({}, currentProps.familyState.parents, {
              motherHeightCm: mVal,
              fatherHeightCm: fVal
            });
          }
          renderView();
        });
      }

      // Lens 4: Log Visit buttons
      var logVisitBtns = rootDiv.querySelectorAll('.dds-btn-log-visit');
      logVisitBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var age = parseFloat(btn.getAttribute('data-age'));
          var label = btn.getAttribute('data-label');
          if (typeof currentProps.onQuickLogAtAge === 'function') {
            currentProps.onQuickLogAtAge(child.id, age, label);
          }
        });
      });

      // Lens 4: Milestone category filters
      var msCatBtns = rootDiv.querySelectorAll('[data-ms-cat]');
      msCatBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cat = btn.getAttribute('data-ms-cat');
          if (cat && cat !== internalState.milestoneCategory) {
            internalState.milestoneCategory = cat;
            renderView();
          }
        });
      });

      // Lens 4: Milestone Checkbox toggle
      var msCheckboxes = rootDiv.querySelectorAll('.dds-ms-checkbox');
      msCheckboxes.forEach(function (chk) {
        chk.addEventListener('change', function () {
          var isAchieved = chk.checked;
          var key = chk.getAttribute('data-ms-key');
          var title = chk.getAttribute('data-ms-title');
          var cat = chk.getAttribute('data-ms-cat');
          var today = new Date().toISOString().slice(0, 10);

          if (typeof currentProps.onToggleMilestone === 'function') {
            currentProps.onToggleMilestone(child.id, { key: key, title: title, category: cat }, isAchieved, isAchieved ? today : null);
          }
        });
      });

      // Lens 4: Custom Milestone Toggle & Form
      var toggleCustomBtn = rootDiv.querySelector('#dds-btn-toggle-custom-ms');
      var customWrap = rootDiv.querySelector('#dds-custom-milestone-form-wrap');
      var cancelCustomBtn = rootDiv.querySelector('#dds-btn-cancel-custom-ms');
      var customForm = rootDiv.querySelector('#dds-custom-milestone-form');

      if (toggleCustomBtn && customWrap) {
        toggleCustomBtn.addEventListener('click', function () {
          customWrap.classList.toggle('dds-hidden');
        });
      }
      if (cancelCustomBtn && customWrap) {
        cancelCustomBtn.addEventListener('click', function () {
          customWrap.classList.add('dds-hidden');
        });
      }
      if (customForm) {
        customForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var tInput = rootDiv.querySelector('#dds-input-custom-ms-title');
          var cSelect = rootDiv.querySelector('#dds-select-custom-ms-cat');
          var dInput = rootDiv.querySelector('#dds-input-custom-ms-date');

          if (tInput && tInput.value.trim()) {
            var msObj = {
              title: tInput.value.trim(),
              category: cSelect ? cSelect.value : 'gross-motor',
              date: dInput ? dInput.value : new Date().toISOString().slice(0, 10),
              ageMonths: calculateAgeMonths(child.birthDate, dInput ? dInput.value : null)
            };
            if (typeof currentProps.onAddCustomMilestone === 'function') {
              currentProps.onAddCustomMilestone(child.id, msObj);
            }
            if (customWrap) customWrap.classList.add('dds-hidden');
          }
        });
      }

      // Lens 5: Search & Filter
      var sInput = rootDiv.querySelector('#dds-ledger-search');
      if (sInput) {
        sInput.addEventListener('input', function () {
          internalState.ledgerSearch = sInput.value;
          renderView();
        });
      }

      var fSelect = rootDiv.querySelector('#dds-ledger-filter');
      if (fSelect) {
        fSelect.addEventListener('change', function () {
          internalState.ledgerFilter = fSelect.value;
          renderView();
        });
      }

      var ledgerAddBtn = rootDiv.querySelector('#dds-btn-ledger-add');
      if (ledgerAddBtn) {
        ledgerAddBtn.addEventListener('click', function () {
          var curAge = calculateAgeMonths(child.birthDate);
          if (typeof currentProps.onQuickLogAtAge === 'function') {
            currentProps.onQuickLogAtAge(child.id, curAge);
          }
        });
      }

      // Lens 5: Row Edit & Delete
      var editBtns = rootDiv.querySelectorAll('.dds-row-edit');
      editBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var mId = btn.getAttribute('data-id');
          var tr = btn.closest('tr');
          var m = (child.measurements || []).find(function (item) { return item.id === mId; });
          if (!m || !tr) return;

          // Check if InputControls.mountInlineRowEditor is available
          if (InputControls && typeof InputControls.mountInlineRowEditor === 'function') {
            InputControls.mountInlineRowEditor(tr, {
              measurement: m,
              child: child,
              unitSystem: currentProps.unitSystem || 'metric',
              onSave: function (updatedM) {
                if (typeof currentProps.onInlineSaveMeasurement === 'function') {
                  currentProps.onInlineSaveMeasurement(child.id, updatedM);
                }
              },
              onCancel: function () {
                renderView();
              }
            });
          } else {
            // Built-in Inline Row Editor Fallback
            mountBuiltinInlineRowEditor(tr, m, child, currentProps.unitSystem || 'metric');
          }
        });
      });

      var delBtns = rootDiv.querySelectorAll('.dds-row-del');
      delBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var mId = btn.getAttribute('data-id');
          if (mId && typeof currentProps.onDeleteMeasurement === 'function') {
            currentProps.onDeleteMeasurement(child.id, mId);
          }
        });
      });
    }

    // Built-in Inline Row Editor Fallback
    function mountBuiltinInlineRowEditor(trEl, measurement, child, unitSystem) {
      var origHtml = trEl.innerHTML;
      trEl.className = 'dds-tr-editing';

      var dateVal = measurement.date || '';
      var hVal = measurement.heightCm != null ? measurement.heightCm : '';
      var wVal = measurement.weightKg != null ? measurement.weightKg : '';
      var headVal = measurement.headCm != null ? measurement.headCm : (measurement.headCircumferenceCm != null ? measurement.headCircumferenceCm : '');
      var provVal = measurement.provider || '';
      var notesVal = measurement.notes || '';

      trEl.innerHTML = '<td><input type="date" class="dds-inline-input" id="dds-inline-date" value="' + escapeHtml(dateVal) + '"></td>' +
        '<td><span class="dds-faint">Inline Edit</span></td>' +
        '<td><input type="number" class="dds-inline-input" id="dds-inline-height" step="0.1" value="' + hVal + '" placeholder="Height cm"></td>' +
        '<td><input type="number" class="dds-inline-input" id="dds-inline-weight" step="0.01" value="' + wVal + '" placeholder="Weight kg"></td>' +
        '<td><input type="number" class="dds-inline-input" id="dds-inline-head" step="0.1" value="' + headVal + '" placeholder="Head cm"></td>' +
        '<td><span class="dds-faint">Auto</span></td>' +
        '<td><input type="text" class="dds-inline-input" id="dds-inline-prov" value="' + escapeHtml(provVal) + '" placeholder="Provider"><br>' +
        '<input type="text" class="dds-inline-input" id="dds-inline-notes" value="' + escapeHtml(notesVal) + '" placeholder="Notes"></td>' +
        '<td class="dds-td-actions">' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-primary" id="dds-inline-save">💾 Save</button>' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-outline" id="dds-inline-cancel">✕</button>' +
        '</td>';

      var saveBtn = trEl.querySelector('#dds-inline-save');
      var cancelBtn = trEl.querySelector('#dds-inline-cancel');

      if (saveBtn) {
        saveBtn.addEventListener('click', function () {
          var dIn = trEl.querySelector('#dds-inline-date');
          var hIn = trEl.querySelector('#dds-inline-height');
          var wIn = trEl.querySelector('#dds-inline-weight');
          var headIn = trEl.querySelector('#dds-inline-head');
          var pIn = trEl.querySelector('#dds-inline-prov');
          var nIn = trEl.querySelector('#dds-inline-notes');

          var updated = Object.assign({}, measurement, {
            date: dIn ? dIn.value : measurement.date,
            heightCm: hIn && hIn.value ? parseFloat(hIn.value) : null,
            weightKg: wIn && wIn.value ? parseFloat(wIn.value) : null,
            headCm: headIn && headIn.value ? parseFloat(headIn.value) : null,
            headCircumferenceCm: headIn && headIn.value ? parseFloat(headIn.value) : null,
            provider: pIn ? pIn.value.trim() : '',
            notes: nIn ? nIn.value.trim() : ''
          });

          if (typeof currentProps.onInlineSaveMeasurement === 'function') {
            currentProps.onInlineSaveMeasurement(child.id, updated);
          }
          renderView();
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          trEl.innerHTML = origHtml;
          trEl.className = '';
          bindStudioEvents();
        });
      }
    }

    function notifyStateChange(partial) {
      if (typeof currentProps.onStateChange === 'function') {
        currentProps.onStateChange(Object.assign({
          activeLens: internalState.activeLens,
          zoomPreset: internalState.zoomPreset,
          chartLayoutMode: internalState.chartLayoutMode,
          activeMetric: internalState.activeMetric,
          yMode: internalState.yMode
        }, partial));
      }
    }

    // -------------------------------------------------------------------------
    // CHART MOUNTING
    // -------------------------------------------------------------------------
    function mountActiveCharts() {
      var child = currentProps.child;
      if (!child || !GrowthCharts) return;

      var unitSystem = currentProps.unitSystem || 'metric';

      if (internalState.activeLens === 'trajectories') {
        var chartOpts = {
          zoomPreset: internalState.zoomPreset,
          yMode: internalState.yMode,
          unitSystem: unitSystem,
          onPointSelect: function (m, stats) {
            showPointPopover(m, stats);
          },
          onCanvasClick: function (info) {
            showCanvasClickNotice(info);
          }
        };

        if (internalState.chartLayoutMode === 'single') {
          var singleEl = rootDiv.querySelector('#dds-single-chart-canvas');
          if (singleEl && typeof singleEl.appendChild === 'function') {
            try {
              if (internalState.activeMetric === 'wfl' && typeof GrowthCharts.renderWeightForLengthChart === 'function') {
                internalState.activeChartInstance = GrowthCharts.renderWeightForLengthChart(singleEl, child, chartOpts);
              } else if (typeof GrowthCharts.renderPercentileChart === 'function') {
                internalState.activeChartInstance = GrowthCharts.renderPercentileChart(singleEl, child, internalState.activeMetric, chartOpts);
              }
            } catch (e) {
              // Canvas or DOM mock stub safety in Node
            }
          }
        } else {
          // Quad-Grid 2x2 layout
          var hEl = rootDiv.querySelector('#dds-quad-height');
          var wEl = rootDiv.querySelector('#dds-quad-weight');
          var headEl = rootDiv.querySelector('#dds-quad-head');
          var fourthEl = rootDiv.querySelector('#dds-quad-fourth');

          if (hEl && wEl && headEl && fourthEl && typeof hEl.appendChild === 'function') {
            try {
              if (typeof GrowthCharts.renderQuadOverviewGrid === 'function') {
                internalState.activeChartInstance = GrowthCharts.renderQuadOverviewGrid({
                  height: hEl,
                  weight: wEl,
                  head: headEl,
                  bmiOrWfl: fourthEl
                }, child, chartOpts);
              } else if (typeof GrowthCharts.renderPercentileChart === 'function') {
                var curAge = calculateAgeMonths(child.birthDate);
                var isInfant = curAge < 24;
                internalState.quadInstances.push(GrowthCharts.renderPercentileChart(hEl, child, 'height', chartOpts));
                internalState.quadInstances.push(GrowthCharts.renderPercentileChart(wEl, child, 'weight', chartOpts));
                internalState.quadInstances.push(GrowthCharts.renderPercentileChart(headEl, child, 'head', chartOpts));
                if (isInfant && typeof GrowthCharts.renderWeightForLengthChart === 'function') {
                  internalState.quadInstances.push(GrowthCharts.renderWeightForLengthChart(fourthEl, child, chartOpts));
                } else {
                  internalState.quadInstances.push(GrowthCharts.renderPercentileChart(fourthEl, child, 'bmi', chartOpts));
                }
              }
            } catch (e) {
              // Canvas or DOM mock stub safety in Node
            }
          }
        }
      } else if (internalState.activeLens === 'velocity') {
        var velEl = rootDiv.querySelector('#dds-velocity-chart-canvas');
        if (velEl && typeof velEl.appendChild === 'function') {
          var velOpts = { metric: internalState.velocityMetric, unitSystem: unitSystem };
          try {
            if (typeof GrowthCharts.renderSingleVelocityChart === 'function') {
              internalState.activeChartInstance = GrowthCharts.renderSingleVelocityChart(velEl, child, velOpts);
            } else if (typeof GrowthCharts.renderVelocityChart === 'function') {
              internalState.activeChartInstance = GrowthCharts.renderVelocityChart(velEl, child, null, internalState.velocityMetric, velOpts);
            }
          } catch (e) {
            // Canvas or DOM mock stub safety in Node
          }
        }
      }
    }

    // Interactive Point Popover
    function showPointPopover(measurement, stats) {
      var anchor = rootDiv.querySelector('#dds-point-popover-anchor');
      if (!anchor || !measurement) return;

      var child = currentProps.child;
      var unitSystem = currentProps.unitSystem || 'metric';

      var hStr = measurement.heightCm ? formatLengthDual(measurement.heightCm, unitSystem).primary : '—';
      var wStr = measurement.weightKg ? formatWeightDual(measurement.weightKg, unitSystem).primary : '—';
      var headStr = (measurement.headCm || measurement.headCircumferenceCm) ? formatHeadDual(measurement.headCm || measurement.headCircumferenceCm, unitSystem).primary : null;

      anchor.innerHTML = '<div class="dds-popover-card">' +
        '<div class="dds-popover-header">' +
        '<strong>Checkup: ' + escapeHtml(measurement.date || (measurement.ageMonths + 'm')) + '</strong>' +
        '<button type="button" class="dds-close-popover" id="dds-btn-close-popover">✕</button>' +
        '</div>' +
        '<div class="dds-popover-body">' +
        '<div class="dds-popover-row"><span>Age:</span> <span>' + (measurement.ageMonths != null ? measurement.ageMonths + ' months' : '—') + '</span></div>' +
        '<div class="dds-popover-row"><span>Height:</span> <span>' + escapeHtml(hStr) + '</span></div>' +
        '<div class="dds-popover-row"><span>Weight:</span> <span>' + escapeHtml(wStr) + '</span></div>' +
        (headStr ? '<div class="dds-popover-row"><span>Head:</span> <span>' + escapeHtml(headStr) + '</span></div>' : '') +
        (stats && stats.percentile != null ? '<div class="dds-popover-row"><span>Percentile:</span> <span class="dds-pct-pill">' + formatOrdinal(stats.percentile) + ' %ile</span></div>' : '') +
        (measurement.provider ? '<div class="dds-popover-row"><span>Provider:</span> <span>' + escapeHtml(measurement.provider) + '</span></div>' : '') +
        (measurement.notes ? '<p class="dds-popover-notes">' + escapeHtml(measurement.notes) + '</p>' : '') +
        '</div>' +
        '<div class="dds-popover-footer">' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-outline" id="dds-btn-popover-edit">✏️ Edit</button>' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-outline dds-btn-danger" id="dds-btn-popover-del">🗑️ Delete</button>' +
        '</div>' +
        '</div>';

      var closeBtn = anchor.querySelector('#dds-btn-close-popover');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          anchor.innerHTML = '';
        });
      }

      var editBtn = anchor.querySelector('#dds-btn-popover-edit');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          anchor.innerHTML = '';
          if (typeof currentProps.onEditMeasurement === 'function') {
            currentProps.onEditMeasurement(measurement);
          }
        });
      }

      var delBtn = anchor.querySelector('#dds-btn-popover-del');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          anchor.innerHTML = '';
          if (typeof currentProps.onDeleteMeasurement === 'function') {
            currentProps.onDeleteMeasurement(child.id, measurement.id);
          }
        });
      }
    }

    // Canvas click notice
    function showCanvasClickNotice(info) {
      var anchor = rootDiv.querySelector('#dds-point-popover-anchor');
      if (!anchor || !info || info.ageMonths == null) return;

      var ageRounded = Math.round(info.ageMonths * 10) / 10;
      var child = currentProps.child;

      anchor.innerHTML = '<div class="dds-popover-card dds-quick-add-callout">' +
        '<div class="dds-popover-header">' +
        '<strong>Log Checkup at Age ' + ageRounded + 'm</strong>' +
        '<button type="button" class="dds-close-popover" id="dds-btn-close-popover">✕</button>' +
        '</div>' +
        '<p class="dds-popover-notes">Would you like to open the quick-log composer prefilled at age ' + ageRounded + ' months?</p>' +
        '<div class="dds-popover-footer">' +
        '<button type="button" class="dds-btn dds-btn-sm dds-btn-primary" id="dds-btn-callout-log">+ Open Quick Log</button>' +
        '</div>' +
        '</div>';

      var closeBtn = anchor.querySelector('#dds-btn-close-popover');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          anchor.innerHTML = '';
        });
      }

      var logBtn = anchor.querySelector('#dds-btn-callout-log');
      if (logBtn) {
        logBtn.addEventListener('click', function () {
          anchor.innerHTML = '';
          if (typeof currentProps.onQuickLogAtAge === 'function') {
            currentProps.onQuickLogAtAge(child.id, ageRounded);
          }
        });
      }
    }

    renderView();

    return {
      update: function (nextProps) {
        Object.assign(currentProps, nextProps);
        if (nextProps.activeLens) internalState.activeLens = nextProps.activeLens;
        if (nextProps.zoomPreset) internalState.zoomPreset = nextProps.zoomPreset;
        if (nextProps.chartLayoutMode) internalState.chartLayoutMode = nextProps.chartLayoutMode;
        if (nextProps.activeMetric) internalState.activeMetric = nextProps.activeMetric;
        if (nextProps.yMode) internalState.yMode = nextProps.yMode;
        renderView();
      },
      setLens: function (lensId) {
        if (lensId && lensId !== internalState.activeLens) {
          internalState.activeLens = lensId;
          notifyStateChange({ activeLens: lensId });
          renderView();
        }
      },
      destroy: function () {
        cleanupCharts();
        if (containerEl && containerEl.contains(rootDiv)) {
          containerEl.removeChild(rootDiv);
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC EXPORTS
  // ---------------------------------------------------------------------------

  var DeepDiveStudio = {
    renderFamilyOverview: renderFamilyOverview,
    render: render,
    // Utility helpers for testing and external access
    getCDCMilestonesCatalog: function () { return CDC_MILESTONE_CATALOG.slice(); },
    getAAPSchedule: function () { return AAP_DEFAULT_SCHEDULE.slice(); },
    calculateCanalizationTable: calculateCanalizationTable,
    calculateSeasonalForecast: calculateSeasonalForecast,
    formatLengthDual: formatLengthDual,
    formatWeightDual: formatWeightDual,
    formatHeadDual: formatHeadDual,
    generateSVGSparkline: generateSVGSparkline,
    generateSVGTannerRuler: generateSVGTannerRuler,
    resolveChildCssColor: resolveChildCssColor
  };

  if (typeof window !== 'undefined') {
    window.DeepDiveStudio = DeepDiveStudio;
  }

  return DeepDiveStudio;
}));
