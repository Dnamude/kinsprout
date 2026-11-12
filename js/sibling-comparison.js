/**
 * KinSprout - Two-Children Growth Tracker
 * Sibling Comparison & Longitudinal Dataset Specialist (sibling-comparison.js)
 * 
 * Provides:
 *  - Rich default two-children longitudinal dataset (Leo & Maya Miller) with 14 & 10 checkups and 8 milestones each
 *  - Exact-age interpolation engine across discrete pediatric visits
 *  - Projected percentile continuation along latest LMS Z-scores for age extrapolation
 *  - Head-to-head sibling comparison with absolute delta and sex-normalized WHO/CDC percentile rankings
 *  - Standard milestone age comparison table (0-48 months)
 *  - Milestone race engine comparing developmental and biometric achievement ages
 *  - Safe fallback if called before GrowthEngine is loaded
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SiblingComparison = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. SAFE GROWTH ENGINE ACCESS & INTERNAL WHO/CDC FALLBACK CALCULATOR
  // =========================================================================

  const CHILD_PALETTE = ['#C85A32', '#2E6F5E', '#3B5BDB', '#9C36B5', '#D97706', '#DB2777'];

  function getSafeEngine() {
    if (typeof window !== 'undefined' && window.GrowthEngine) {
      return window.GrowthEngine;
    }
    if (typeof globalThis !== 'undefined' && globalThis.GrowthEngine) {
      return globalThis.GrowthEngine;
    }
    if (typeof require === 'function') {
      try {
        return require('./growth-engine.js');
      } catch (e) {}
    }
    return null;
  }

  // Standard Normal CDF Approximation (Abramowitz & Stegun formula 26.2.17)
  function internalNormalCDF(z) {
    if (z === null || z === undefined || isNaN(z)) return 0.5;
    const numZ = Number(z);
    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const oneOverSqrt2Pi = 0.3989422804014327;

    if (numZ >= 0) {
      const t = 1.0 / (1.0 + p * numZ);
      const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
      return 1.0 - oneOverSqrt2Pi * Math.exp(-0.5 * numZ * numZ) * poly;
    } else {
      const t = 1.0 / (1.0 - p * numZ);
      const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
      return oneOverSqrt2Pi * Math.exp(-0.5 * numZ * numZ) * poly;
    }
  }

  // Internal Fallback LMS Norms (WHO Child Growth Standards 0-24m + CDC 24-60m)
  const FALLBACK_LMS = {
    M: {
      weight: [
        { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
        { age: 1, L: 0.2297, M: 4.4709, S: 0.13495 },
        { age: 2, L: 0.1554, M: 5.6026, S: 0.12579 },
        { age: 4, L: 0.0637, M: 7.0396, S: 0.11580 },
        { age: 6, L: 0.0125, M: 7.9351, S: 0.11195 },
        { age: 9, L: -0.0381, M: 8.8785, S: 0.10967 },
        { age: 12, L: -0.0716, M: 9.6465, S: 0.10874 },
        { age: 15, L: -0.0964, M: 10.3121, S: 0.10860 },
        { age: 18, L: -0.1165, M: 10.9238, S: 0.10889 },
        { age: 24, L: -0.1482, M: 12.1517, S: 0.11003 },
        { age: 30, L: -0.1608, M: 13.3400, S: 0.11520 },
        { age: 36, L: -0.1824, M: 14.3300, S: 0.12050 },
        { age: 42, L: -0.2078, M: 15.3500, S: 0.12560 },
        { age: 48, L: -0.2359, M: 16.3300, S: 0.13100 },
        { age: 54, L: -0.2662, M: 17.3200, S: 0.13670 },
        { age: 60, L: -0.2982, M: 18.3400, S: 0.14250 }
      ],
      height: [
        { age: 0, L: 1.0, M: 49.88, S: 0.03795 },
        { age: 1, L: 1.0, M: 54.72, S: 0.03559 },
        { age: 2, L: 1.0, M: 58.42, S: 0.03437 },
        { age: 4, L: 1.0, M: 63.89, S: 0.03316 },
        { age: 6, L: 1.0, M: 67.62, S: 0.03274 },
        { age: 9, L: 1.0, M: 71.96, S: 0.03277 },
        { age: 12, L: 1.0, M: 75.75, S: 0.03318 },
        { age: 15, L: 1.0, M: 79.14, S: 0.03378 },
        { age: 18, L: 1.0, M: 82.32, S: 0.03448 },
        { age: 24, L: 1.0, M: 87.80, S: 0.03598 },
        { age: 30, L: 1.0, M: 92.35, S: 0.03720 },
        { age: 36, L: 1.0, M: 96.48, S: 0.03840 },
        { age: 42, L: 1.0, M: 100.28, S: 0.03950 },
        { age: 48, L: 1.0, M: 102.50, S: 0.04050 },
        { age: 54, L: 1.0, M: 107.13, S: 0.04130 },
        { age: 60, L: 1.0, M: 110.25, S: 0.04200 }
      ],
      head: [
        { age: 0, L: 1.0, M: 34.46, S: 0.0360 },
        { age: 1, L: 1.0, M: 37.31, S: 0.0336 },
        { age: 2, L: 1.0, M: 39.14, S: 0.0323 },
        { age: 4, L: 1.0, M: 41.57, S: 0.0308 },
        { age: 6, L: 1.0, M: 43.25, S: 0.0300 },
        { age: 9, L: 1.0, M: 45.02, S: 0.0295 },
        { age: 12, L: 1.0, M: 46.10, S: 0.0293 },
        { age: 15, L: 1.0, M: 46.88, S: 0.0293 },
        { age: 18, L: 1.0, M: 47.48, S: 0.0294 },
        { age: 24, L: 1.0, M: 48.33, S: 0.0296 },
        { age: 30, L: 1.0, M: 49.00, S: 0.0298 },
        { age: 36, L: 1.0, M: 49.54, S: 0.0300 },
        { age: 42, L: 1.0, M: 50.00, S: 0.0301 },
        { age: 48, L: 1.0, M: 50.39, S: 0.0302 },
        { age: 54, L: 1.0, M: 50.72, S: 0.0303 },
        { age: 60, L: 1.0, M: 51.02, S: 0.0304 }
      ],
      bmi: [
        { age: 0, L: 0.35, M: 13.41, S: 0.0950 },
        { age: 1, L: 0.05, M: 14.90, S: 0.0910 },
        { age: 2, L: -0.15, M: 16.32, S: 0.0880 },
        { age: 4, L: -0.38, M: 17.14, S: 0.0840 },
        { age: 6, L: -0.50, M: 17.20, S: 0.0820 },
        { age: 9, L: -0.60, M: 17.02, S: 0.0800 },
        { age: 12, L: -0.65, M: 16.80, S: 0.0780 },
        { age: 18, L: -0.70, M: 16.10, S: 0.0760 },
        { age: 24, L: -0.72, M: 15.70, S: 0.0760 },
        { age: 36, L: -0.80, M: 15.52, S: 0.0770 },
        { age: 48, L: -0.92, M: 15.40, S: 0.0800 },
        { age: 60, L: -1.05, M: 15.35, S: 0.0840 }
      ]
    },
    F: {
      weight: [
        { age: 0, L: 0.3798, M: 3.2322, S: 0.14171 },
        { age: 1, L: 0.2520, M: 4.1873, S: 0.13450 },
        { age: 2, L: 0.1800, M: 5.1282, S: 0.12780 },
        { age: 4, L: 0.0890, M: 6.4237, S: 0.11890 },
        { age: 6, L: 0.0380, M: 7.2972, S: 0.11540 },
        { age: 9, L: -0.0120, M: 8.2140, S: 0.11410 },
        { age: 12, L: -0.0460, M: 8.9486, S: 0.11450 },
        { age: 15, L: -0.0710, M: 9.5852, S: 0.11580 },
        { age: 18, L: -0.0920, M: 10.1656, S: 0.11770 },
        { age: 24, L: -0.1260, M: 11.4789, S: 0.12260 },
        { age: 30, L: -0.1500, M: 12.6800, S: 0.12840 },
        { age: 36, L: -0.1800, M: 13.8500, S: 0.13450 },
        { age: 42, L: -0.2100, M: 14.9500, S: 0.14080 },
        { age: 48, L: -0.2400, M: 16.0200, S: 0.14720 },
        { age: 54, L: -0.2800, M: 17.0600, S: 0.15380 },
        { age: 60, L: -0.3200, M: 18.0800, S: 0.16050 }
      ],
      height: [
        { age: 0, L: 1.0, M: 49.14, S: 0.03790 },
        { age: 1, L: 1.0, M: 53.69, S: 0.03560 },
        { age: 2, L: 1.0, M: 57.07, S: 0.03440 },
        { age: 4, L: 1.0, M: 62.09, S: 0.03330 },
        { age: 6, L: 1.0, M: 65.73, S: 0.03300 },
        { age: 9, L: 1.0, M: 70.14, S: 0.03310 },
        { age: 12, L: 1.0, M: 74.02, S: 0.03360 },
        { age: 15, L: 1.0, M: 77.49, S: 0.03430 },
        { age: 18, L: 1.0, M: 80.71, S: 0.03470 },
        { age: 24, L: 1.0, M: 86.40, S: 0.03600 },
        { age: 30, L: 1.0, M: 91.18, S: 0.03750 },
        { age: 36, L: 1.0, M: 95.35, S: 0.03900 },
        { age: 42, L: 1.0, M: 99.12, S: 0.04020 },
        { age: 48, L: 1.0, M: 102.70, S: 0.04130 },
        { age: 54, L: 1.0, M: 106.10, S: 0.04220 },
        { age: 60, L: 1.0, M: 109.40, S: 0.04300 }
      ],
      head: [
        { age: 0, L: 1.0, M: 33.88, S: 0.0350 },
        { age: 1, L: 1.0, M: 36.54, S: 0.0330 },
        { age: 2, L: 1.0, M: 38.29, S: 0.0318 },
        { age: 4, L: 1.0, M: 40.64, S: 0.0305 },
        { age: 6, L: 1.0, M: 42.23, S: 0.0298 },
        { age: 9, L: 1.0, M: 43.90, S: 0.0294 },
        { age: 12, L: 1.0, M: 44.95, S: 0.0293 },
        { age: 15, L: 1.0, M: 45.69, S: 0.0294 },
        { age: 18, L: 1.0, M: 46.25, S: 0.0295 },
        { age: 24, L: 1.0, M: 47.16, S: 0.0298 },
        { age: 30, L: 1.0, M: 47.88, S: 0.0300 },
        { age: 36, L: 1.0, M: 48.47, S: 0.0302 },
        { age: 42, L: 1.0, M: 48.97, S: 0.0304 },
        { age: 48, L: 1.0, M: 49.40, S: 0.0306 },
        { age: 54, L: 1.0, M: 49.78, S: 0.0308 },
        { age: 60, L: 1.0, M: 50.12, S: 0.0310 }
      ],
      bmi: [
        { age: 0, L: 0.38, M: 13.30, S: 0.0940 },
        { age: 1, L: 0.08, M: 14.52, S: 0.0900 },
        { age: 2, L: -0.12, M: 15.70, S: 0.0870 },
        { age: 4, L: -0.34, M: 16.54, S: 0.0830 },
        { age: 6, L: -0.45, M: 16.62, S: 0.0810 },
        { age: 9, L: -0.55, M: 16.40, S: 0.0790 },
        { age: 12, L: -0.60, M: 16.18, S: 0.0770 },
        { age: 18, L: -0.66, M: 15.58, S: 0.0750 },
        { age: 24, L: -0.70, M: 15.35, S: 0.0760 },
        { age: 36, L: -0.81, M: 15.08, S: 0.0780 },
        { age: 48, L: -0.96, M: 15.00, S: 0.0830 },
        { age: 60, L: -1.13, M: 15.08, S: 0.0920 }
      ]
    }
  };

  function normalizeSexKey(sex) {
    if (!sex) return 'M';
    const s = String(sex).trim().toUpperCase();
    return (s === 'F' || s === 'FEMALE' || s === 'GIRL') ? 'F' : 'M';
  }

  function normalizeMetricKey(metric) {
    if (!metric) return 'weight';
    const m = String(metric).trim().toLowerCase();
    if (m === 'length' || m === 'stature') return 'height';
    if (m === 'headcircumference' || m === 'head_circumference' || m === 'hc') return 'head';
    return m;
  }

  function getFallbackLMS(sex, metric, ageMonths) {
    const sKey = normalizeSexKey(sex);
    const mKey = normalizeMetricKey(metric);
    const table = (FALLBACK_LMS[sKey] && FALLBACK_LMS[sKey][mKey]) || FALLBACK_LMS.M.weight;
    const age = Math.max(0, Number(ageMonths) || 0);

    if (age <= table[0].age) {
      return { L: table[0].L, M: table[0].M, S: table[0].S };
    }
    const last = table[table.length - 1];
    if (age >= last.age) {
      return { L: last.L, M: last.M, S: last.S };
    }

    for (let i = 0; i < table.length - 1; i++) {
      const p0 = table[i];
      const p1 = table[i + 1];
      if (age >= p0.age && age <= p1.age) {
        const factor = (age - p0.age) / (p1.age - p0.age);
        return {
          L: p0.L + factor * (p1.L - p0.L),
          M: p0.M + factor * (p1.M - p0.M),
          S: p0.S + factor * (p1.S - p0.S)
        };
      }
    }
    return { L: last.L, M: last.M, S: last.S };
  }

  function computeZAndPercentile(sex, metric, ageMonths, value, optionalChild) {
    if (value === null || value === undefined || isNaN(value) || Number(value) <= 0) {
      return null;
    }

    const engine = getSafeEngine();
    let s = sex;
    let m = metric;
    let a = ageMonths ?? 0;
    let childRef = optionalChild;

    // Apply gestational-age correction if child is premature (<37w) and under 24m chronological age
    if (childRef && childRef.gestationalWeeks !== undefined && childRef.gestationalWeeks !== null) {
      const gWeeks = Number(childRef.gestationalWeeks);
      if (gWeeks < 37 && a < 24) {
        const weeksPremature = Math.max(0, 40 - gWeeks);
        a = Math.max(0, a - (weeksPremature * 7) / 30.4375);
      }
    }

    const normM = (m || '').toString().trim().toLowerCase();
    const isHead = normM === 'head' || normM === 'headcircumference' || normM === 'head_circumference' || normM === 'headcm' || normM === 'hc';

    // WHO head circumference stops at 60 months
    if (isHead && a > 60) {
      return {
        zScore: null,
        percentile: null,
        formattedPercentile: null,
        label: 'WHO reference standards stop at 60 months',
        status: 'Beyond WHO Reference Age (>60m)',
        color: '#64748B',
        L: null,
        M: null,
        S: null
      };
    }

    // Check if GrowthEngine is available with positional or object calling convention
    if (engine && typeof engine.calculateZScoreAndPercentile === 'function') {
      try {
        const res = engine.calculateZScoreAndPercentile(s, m, a, value, childRef);
        if (res && res.percentile !== undefined && res.zScore !== undefined) {
          return res;
        }
      } catch (e) {}
    }

    // High-precision internal LMS fallback
    const val = Number(value);
    const { L, M, S } = getFallbackLMS(s, m, a);
    let z;
    if (Math.abs(L) > 1e-5) {
      z = (Math.pow(val / M, L) - 1) / (L * S);
    } else {
      z = Math.log(val / M) / S;
    }
    const clampedZ = Math.max(-4.5, Math.min(4.5, z));
    const percentile = Math.max(0.01, Math.min(99.99, internalNormalCDF(clampedZ) * 100));
    const roundedPercentile = Math.round(percentile * 10) / 10;

    let status = 'Healthy / Typical';
    let label = 'Healthy / Typical';
    let color = '#10b981';
    if (percentile < 5) {
      status = 'Low (<5th)';
      label = percentile < 3 ? 'Below 3rd percentile' : 'Low (<5th percentile)';
      color = percentile < 3 ? '#ef4444' : '#f59e0b';
    } else if (percentile > 95) {
      status = 'Elevated (>95th)';
      label = 'Elevated (>95th percentile)';
      color = '#ef4444';
    } else if (percentile > 85) {
      status = 'High (85th-95th)';
      label = 'High (85th–95th percentile)';
      color = '#f59e0b';
    }

    const formatOrd = (engine && typeof engine.formatOrdinal === 'function')
      ? engine.formatOrdinal
      : (p) => {
          const r = Math.round(Number(p));
          const rem100 = Math.abs(r) % 100;
          if (rem100 >= 11 && rem100 <= 13) return `${r}th`;
          const rem10 = Math.abs(r) % 10;
          if (rem10 === 1) return `${r}st`;
          if (rem10 === 2) return `${r}nd`;
          if (rem10 === 3) return `${r}rd`;
          return `${r}th`;
        };
    const formattedPercentile = formatOrd(percentile);

    return {
      zScore: Math.round(clampedZ * 100) / 100,
      percentile: roundedPercentile,
      formattedPercentile,
      label,
      status,
      color,
      L: Math.round(L * 10000) / 10000,
      M: Math.round(M * 1000) / 1000,
      S: Math.round(S * 10000) / 10000
    };
  }

  // Inverse LMS to compute biometric value from a Z-score at a given age
  function valueFromZScore(sex, metric, ageMonths, zScore) {
    const engine = getSafeEngine();
    const sKey = normalizeSexKey(sex);
    const mKey = normalizeMetricKey(metric);
    let L, M, S;

    if (engine && typeof engine.getLMS === 'function') {
      const lms = engine.getLMS(sKey, mKey, ageMonths);
      L = lms.L;
      M = lms.M;
      S = lms.S;
    } else {
      const lms = getFallbackLMS(sKey, mKey, ageMonths);
      L = lms.L;
      M = lms.M;
      S = lms.S;
    }

    const z = Number(zScore);
    let val;
    if (Math.abs(L) > 1e-5) {
      const base = Math.max(1e-6, 1 + L * S * z);
      val = M * Math.pow(base, 1 / L);
    } else {
      val = M * Math.exp(S * z);
    }
    return Math.round(val * 100) / 100;
  }

  function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0 || weightKg <= 0) return null;
    const hM = Number(heightCm) / 100;
    return Math.round((Number(weightKg) / (hM * hM)) * 100) / 100;
  }

  // =========================================================================
  // 2. RICH DEFAULT TWO-CHILDREN DATASET (THE MILLER FAMILY)
  // =========================================================================

  /**
   * Returns a complete, realistic FamilyState object with two children (Leo & Maya).
   * Populated with 14 checkups for Leo (0-53.5m) and 10 checkups for Maya (0-24.5m),
   * along with 8 physical & developmental milestones for each.
   */
  function getDefaultFamilyState() {
    return {
      familyId: 'FAMILY-SPROUT-842',
      familyName: 'The Miller Family',
      updatedAt: 1760000000000,
      unitSystem: 'metric',
      parents: {
        fatherHeightCm: 181.0,
        motherHeightCm: 166.5,
        fatherName: 'David',
        motherName: 'Elena'
      },
      children: [
        {
          id: 'child-1',
          name: 'Leo',
          sex: 'M',
          gender: 'male',
          birthDate: '2022-05-14',
          color: '#C85A32',
          secondaryColor: '#F6E7E1',
          gestationalWeeks: 40,
          measurements: [
            {
              id: 'm-leo-0m',
              ageMonths: 0,
              date: '2022-05-14',
              weightKg: 3.52,
              heightCm: 50.8,
              headCm: 35.1,
              headCircumferenceCm: 35.1,
              source: 'Birth Hospital Record',
              notes: 'Healthy full-term boy born at St. Jude Hospital. Vigorous cry, APGAR 9/9.'
            },
            {
              id: 'm-leo-1m',
              ageMonths: 1,
              date: '2022-06-14',
              weightKg: 4.65,
              heightCm: 55.4,
              headCm: 37.8,
              headCircumferenceCm: 37.8,
              source: '1-Month Well Visit',
              notes: 'Feeding well on breastmilk. Gaining weight consistently along 65th percentile.'
            },
            {
              id: 'm-leo-2m',
              ageMonths: 2,
              date: '2022-07-14',
              weightKg: 5.82,
              heightCm: 59.2,
              headCm: 39.6,
              headCircumferenceCm: 39.6,
              source: '2-Month Well Visit',
              notes: 'Smiles socially! First round of standard immunizations administered smoothly.'
            },
            {
              id: 'm-leo-4m',
              ageMonths: 4,
              date: '2022-09-14',
              weightKg: 7.30,
              heightCm: 64.6,
              headCm: 42.0,
              headCircumferenceCm: 42.0,
              source: '4-Month Well Visit',
              notes: 'Excellent head control during tummy time. Pushes up on forearms.'
            },
            {
              id: 'm-leo-6m',
              ageMonths: 6,
              date: '2022-11-14',
              weightKg: 8.25,
              heightCm: 68.4,
              headCm: 43.8,
              headCircumferenceCm: 43.8,
              source: '6-Month Well Visit',
              notes: 'Doubled birth weight comfortably. Started pureed vegetables and oatmeal.'
            },
            {
              id: 'm-leo-9m',
              ageMonths: 9,
              date: '2023-02-14',
              weightKg: 9.25,
              heightCm: 72.8,
              headCm: 45.5,
              headCircumferenceCm: 45.5,
              source: '9-Month Well Visit',
              notes: 'Crawling enthusiastically across the living room. Pincer grasp developing.'
            },
            {
              id: 'm-leo-12m',
              ageMonths: 12,
              date: '2023-05-14',
              weightKg: 10.10,
              heightCm: 76.7,
              headCm: 46.7,
              headCircumferenceCm: 46.7,
              source: '12-Month Well Visit',
              notes: 'First birthday checkup! Tripled birth weight. Cruises along coffee table.'
            },
            {
              id: 'm-leo-15m',
              ageMonths: 15,
              date: '2023-08-14',
              weightKg: 10.80,
              heightCm: 80.2,
              headCm: 47.4,
              headCircumferenceCm: 47.4,
              source: '15-Month Well Visit',
              notes: 'Walking independently everywhere. Stacking 3 blocks.'
            },
            {
              id: 'm-leo-18m',
              ageMonths: 18,
              date: '2023-11-14',
              weightKg: 11.50,
              heightCm: 83.2,
              headCm: 48.1,
              headCircumferenceCm: 48.1,
              source: '18-Month Well Visit',
              notes: 'Uses 15+ single words. Loves climbing onto chairs.'
            },
            {
              id: 'm-leo-24m',
              ageMonths: 24,
              date: '2024-05-14',
              weightKg: 12.75,
              heightCm: 88.9,
              headCm: 48.9,
              headCircumferenceCm: 48.9,
              source: '24-Month Well Visit',
              notes: 'Two-year milestone! 2-3 word sentences. Runs smoothly and jumps with both feet.'
            },
            {
              id: 'm-leo-30m',
              ageMonths: 30,
              date: '2024-11-14',
              weightKg: 14.10,
              heightCm: 93.8,
              headCm: 49.6,
              headCircumferenceCm: 49.6,
              source: 'Photo Import: Pediatric Printout',
              notes: 'Imported via clinic visit summary. Potty training going well.'
            },
            {
              id: 'm-leo-36m',
              ageMonths: 36,
              date: '2025-05-14',
              weightKg: 15.20,
              heightCm: 98.2,
              headCm: 50.1,
              headCircumferenceCm: 50.1,
              source: '3-Year Well Visit',
              notes: 'Pedaling tricycle! Beginning of a notable height growth spurt.'
            },
            {
              id: 'm-leo-42m',
              ageMonths: 42,
              date: '2025-11-14',
              weightKg: 16.35,
              heightCm: 102.5,
              headCm: 50.6,
              headCircumferenceCm: 50.6,
              source: 'Photo Import: Pediatric Printout',
              notes: 'Growth spurt continued; height velocity peaked at ~8.6 cm/year over this interval.'
            },
            {
              id: 'm-leo-48m',
              ageMonths: 48,
              date: '2026-05-14',
              weightKg: 17.40,
              heightCm: 105.8,
              headCm: 51.0,
              headCircumferenceCm: 51.0,
              source: '4-Year Well Visit',
              notes: 'Preschool physical exam completed. Hops on one foot, draws circles.'
            },
            {
              id: 'm-leo-53_5m',
              ageMonths: 53.5,
              date: '2026-10-28',
              weightKg: 18.40,
              heightCm: 108.2,
              headCm: 51.4,
              headCircumferenceCm: 51.4,
              source: 'Photo Import: Pediatric Printout',
              notes: 'Latest checkup. Tracks around 68th percentile for weight and 65th percentile for height.'
            }
          ],
          milestones: [
            {
              id: 'ms-leo-1',
              title: 'Rolled Over',
              category: 'gross-motor',
              ageMonths: 3.8,
              date: '2022-09-07',
              notes: 'Rolled from tummy to back during afternoon tummy time!'
            },
            {
              id: 'ms-leo-2',
              title: 'Sat Unsupported',
              category: 'gross-motor',
              ageMonths: 5.9,
              date: '2022-11-10',
              notes: 'Sat steadily on playmat without hands touching ground for >60 seconds.'
            },
            {
              id: 'ms-leo-3',
              title: 'Doubled Birth Weight',
              category: 'growth',
              ageMonths: 5.7,
              date: '2022-11-04',
              notes: 'Reached 7.04 kg (doubled birth weight of 3.52 kg).'
            },
            {
              id: 'ms-leo-4',
              title: 'First Tooth',
              category: 'physical',
              ageMonths: 6.8,
              date: '2022-12-08',
              notes: 'Lower central incisor cut through gum.'
            },
            {
              id: 'ms-leo-5',
              title: 'Crawled',
              category: 'gross-motor',
              ageMonths: 8.4,
              date: '2023-01-26',
              notes: 'Full four-point hands-and-knees crawl across nursery carpet.'
            },
            {
              id: 'ms-leo-6',
              title: 'Tripled Birth Weight',
              category: 'growth',
              ageMonths: 12.8,
              date: '2023-06-07',
              notes: 'Reached 10.56 kg (tripled birth weight of 3.52 kg).'
            },
            {
              id: 'ms-leo-7',
              title: 'First Independent Steps',
              category: 'gross-motor',
              ageMonths: 13.5,
              date: '2023-06-28',
              notes: 'Took 6 confident steps from sofa into Dad\'s outstretched arms.'
            },
            {
              id: 'ms-leo-8',
              title: 'First 2-Word Phrase',
              category: 'language',
              ageMonths: 20.2,
              date: '2024-01-20',
              notes: 'Said "More berry!" while sitting at the breakfast table.'
            },
            {
              id: 'ms-leo-9',
              title: 'Pedaled Tricycle',
              category: 'gross-motor',
              ageMonths: 35.0,
              date: '2025-04-14',
              notes: 'Rode red Radio Flyer tricycle all the way around the driveway.'
            }
          ]
        },
        {
          id: 'child-2',
          name: 'Maya',
          sex: 'F',
          gender: 'female',
          birthDate: '2024-10-10',
          color: '#2E6F5E',
          secondaryColor: '#DFEFEA',
          gestationalWeeks: 39.5,
          measurements: [
            {
              id: 'm-maya-0m',
              ageMonths: 0,
              date: '2024-10-10',
              weightKg: 3.38,
              heightCm: 49.9,
              headCm: 34.4,
              headCircumferenceCm: 34.4,
              source: 'Birth Hospital Record',
              notes: 'Healthy baby girl born at City Maternity Center. Alert and nursing immediately.'
            },
            {
              id: 'm-maya-1m',
              ageMonths: 1,
              date: '2024-11-10',
              weightKg: 4.45,
              heightCm: 54.6,
              headCm: 37.1,
              headCircumferenceCm: 37.1,
              source: '1-Month Well Visit',
              notes: 'Lifting chin off exam table. Strong suck reflex and steady weight gain.'
            },
            {
              id: 'm-maya-2m',
              ageMonths: 2,
              date: '2024-12-10',
              weightKg: 5.48,
              heightCm: 58.0,
              headCm: 38.9,
              headCircumferenceCm: 38.9,
              source: '2-Month Well Visit',
              notes: 'Big expressive smiles for mom and big brother Leo! Cooing responsively.'
            },
            {
              id: 'm-maya-4m',
              ageMonths: 4,
              date: '2025-02-10',
              weightKg: 6.85,
              heightCm: 63.2,
              headCm: 41.2,
              headCircumferenceCm: 41.2,
              source: '4-Month Well Visit',
              notes: 'Reaches out and grasps rattle with both hands. Laughs out loud.'
            },
            {
              id: 'm-maya-6m',
              ageMonths: 6,
              date: '2025-04-10',
              weightKg: 7.78,
              heightCm: 66.9,
              headCm: 42.8,
              headCircumferenceCm: 42.8,
              source: '6-Month Well Visit',
              notes: 'Sitting up with minimal support. Started avocado and sweet potato purees.'
            },
            {
              id: 'm-maya-9m',
              ageMonths: 9,
              date: '2025-07-10',
              weightKg: 8.75,
              heightCm: 71.4,
              headCm: 44.5,
              headCircumferenceCm: 44.5,
              source: '9-Month Well Visit',
              notes: 'Babbles "ma-ma" and "da-da". Pulling up to stand on low furniture.'
            },
            {
              id: 'm-maya-12m',
              ageMonths: 12,
              date: '2025-10-10',
              weightKg: 9.55,
              heightCm: 75.4,
              headCm: 45.6,
              headCircumferenceCm: 45.6,
              source: '12-Month Well Visit',
              notes: 'First birthday checkup! Tripled birth weight. Stands unsupported for 5 seconds.'
            },
            {
              id: 'm-maya-15m',
              ageMonths: 15,
              date: '2026-01-10',
              weightKg: 10.25,
              heightCm: 79.0,
              headCm: 46.4,
              headCircumferenceCm: 46.4,
              source: '15-Month Well Visit',
              notes: 'Walking confidently without assistance. Babbles expressively.'
            },
            {
              id: 'm-maya-18m',
              ageMonths: 18,
              date: '2026-04-10',
              weightKg: 11.00,
              heightCm: 82.2,
              headCm: 47.1,
              headCircumferenceCm: 47.1,
              source: '18-Month Well Visit',
              notes: 'Shows 20+ words. Loves reading board books. Tracking ~76th female WHO percentile.'
            },
            {
              id: 'm-maya-24_5m',
              ageMonths: 24.5,
              date: '2026-10-25',
              weightKg: 12.60,
              heightCm: 88.4,
              headCm: 48.3,
              headCircumferenceCm: 48.3,
              source: 'Photo Import: Pediatric Printout',
              notes: 'Latest checkup. Tracking ~77th female percentile for weight and ~70th percentile for height.'
            }
          ],
          milestones: [
            {
              id: 'ms-maya-1',
              title: 'Rolled Over',
              category: 'gross-motor',
              ageMonths: 3.4,
              date: '2025-01-22',
              notes: 'Rolled tummy to back 12 days earlier than Leo did!'
            },
            {
              id: 'ms-maya-2',
              title: 'Doubled Birth Weight',
              category: 'growth',
              ageMonths: 5.3,
              date: '2025-03-20',
              notes: 'Reached 6.76 kg (doubled birth weight of 3.38 kg).'
            },
            {
              id: 'ms-maya-3',
              title: 'Sat Unsupported',
              category: 'gross-motor',
              ageMonths: 5.5,
              date: '2025-03-26',
              notes: 'Sat solidly upright without toppling over while playing with blocks.'
            },
            {
              id: 'ms-maya-4',
              title: 'First Tooth',
              category: 'physical',
              ageMonths: 6.2,
              date: '2025-04-16',
              notes: 'Lower front tooth arrived right after 6 month birthday.'
            },
            {
              id: 'ms-maya-5',
              title: 'Crawled',
              category: 'gross-motor',
              ageMonths: 7.9,
              date: '2025-06-06',
              notes: 'Fast army crawl evolved into full hands-and-knees scoot.'
            },
            {
              id: 'ms-maya-6',
              title: 'First Independent Steps',
              category: 'gross-motor',
              ageMonths: 12.2,
              date: '2025-10-16',
              notes: 'Took independent walking steps earlier than brother Leo!'
            },
            {
              id: 'ms-maya-7',
              title: 'Tripled Birth Weight',
              category: 'growth',
              ageMonths: 12.4,
              date: '2025-10-22',
              notes: 'Reached 10.14 kg (tripled birth weight of 3.38 kg).'
            },
            {
              id: 'ms-maya-8',
              title: 'First 2-Word Phrase',
              category: 'language',
              ageMonths: 18.5,
              date: '2026-04-25',
              notes: 'Said "Hi puppy!" when visiting grandma\'s golden retriever.'
            }
          ]
        }
      ],
      isDemo: true
    };
  }

  /**
   * Builds a valid empty FamilyState from an array of children specifications:
   * [{ name, sex, birthDate, gestationalWeeks }]
   * Generates ids 'child-1', 'child-2', default colours '#C85A32' / '#2E6F5E', isDemo: false.
   */
  function getEmptyFamilyState(childrenInput = 1) {
    const defaultSecondary = ['#F6E7E1', '#E5EFEA', '#DBEAFE', '#F3E8FF', '#FEF3C7', '#FCE7F3'];
    const now = Date.now();

    let inputList = [];
    if (typeof childrenInput === 'number') {
      const count = Math.max(1, childrenInput);
      for (let i = 0; i < count; i++) {
        inputList.push({
          id: `child-${i + 1}`,
          name: `Child ${i + 1}`,
          sex: i === 0 ? 'M' : 'F'
        });
      }
    } else if (Array.isArray(childrenInput)) {
      if (childrenInput.length === 0) {
        inputList = [{ id: 'child-1', name: 'Child 1', sex: 'M' }];
      } else {
        inputList = childrenInput;
      }
    } else if (childrenInput && typeof childrenInput === 'object') {
      inputList = [childrenInput];
    } else {
      inputList = [{ id: 'child-1', name: 'Child 1', sex: 'M' }];
    }

    const children = inputList.map((c, idx) => {
      const id = c.id || `child-${idx + 1}`;
      const rawSex = c.sex || c.gender || (idx === 0 ? 'M' : 'F');
      const s = String(rawSex).trim().toUpperCase();
      const normalizedSex = (s === 'F' || s === 'FEMALE' || s === 'GIRL') ? 'F' : 'M';
      const color = c.color || (idx === 0 ? '#C85A32' : (idx === 1 ? '#2E6F5E' : CHILD_PALETTE[idx % CHILD_PALETTE.length]));
      const secondaryColor = c.secondaryColor || defaultSecondary[idx % defaultSecondary.length];

      return {
        id,
        name: c.name || `Child ${idx + 1}`,
        sex: normalizedSex,
        gender: normalizedSex === 'F' ? 'female' : 'male',
        birthDate: c.birthDate || '',
        color,
        secondaryColor,
        gestationalWeeks: c.gestationalWeeks !== undefined && c.gestationalWeeks !== null ? Number(c.gestationalWeeks) : 40,
        measurements: Array.isArray(c.measurements) ? c.measurements : [],
        milestones: Array.isArray(c.milestones) ? c.milestones : [],
        updatedAt: c.updatedAt || now
      };
    });

    return {
      version: 2,
      familyId: `FAMILY-${now}`,
      familyName: 'My Family',
      updatedAt: now,
      deletedIds: [],
      unitSystem: 'metric',
      settings: {
        unitSystem: 'metric',
        standard: 'WHO_CDC',
        correctPrematurity: true
      },
      parents: {
        fatherHeightCm: 178.0,
        motherHeightCm: 165.0,
        fatherName: '',
        motherName: ''
      },
      children,
      isDemo: false
    };
  }

  /**
   * Generates a synthetic WHO / CDC 50th-percentile benchmark peer child
   * matching the active child's sex, birthDate, and measurement ages.
   * Enables 1-child families to use Sibling Studio comparison charts, tables, and Height Wall.
   */
  function createBenchmarkPeer(child, parents, mode = 'who50') {
    const s = child ? String(child.sex || child.gender || 'M').trim().toUpperCase() : 'M';
    const normalizedSex = (s === 'F' || s === 'FEMALE' || s === 'GIRL') ? 'F' : 'M';
    const birthDate = child ? (child.birthDate || '2024-01-01') : '2024-01-01';
    const now = Date.now();

    const engine = getSafeEngine();

    // Determine target checkup ages based on child's actual recorded checkups
    let targetAges = [];
    if (child && Array.isArray(child.measurements) && child.measurements.length > 0) {
      targetAges = child.measurements.map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? (engine ? engine.calculateAgeMonths(child.birthDate, m.date) : 0) : 0);
        return {
          ageMonths: Math.round(age * 10) / 10,
          date: m.date || birthDate
        };
      });
    } else {
      // Standard AAP milestone visit ages if child has no visits yet
      targetAges = [0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60].map(a => ({
        ageMonths: a,
        date: birthDate
      }));
    }

    const peerMeasurements = targetAges.map((entry, idx) => {
      const age = entry.ageMonths;
      let hVal = null;
      let wVal = null;
      let headVal = null;

      if (engine && typeof engine.valueFromPercentile === 'function') {
        hVal = engine.valueFromPercentile(normalizedSex, 'height', age, 50);
        wVal = engine.valueFromPercentile(normalizedSex, 'weight', age, 50);
        headVal = age <= 60 ? engine.valueFromPercentile(normalizedSex, 'head', age, 50) : null;
      } else {
        const hLms = getFallbackLMS(normalizedSex, 'height', age);
        const wLms = getFallbackLMS(normalizedSex, 'weight', age);
        const headLms = age <= 60 ? getFallbackLMS(normalizedSex, 'head', age) : null;
        hVal = hLms ? hLms.M : 75;
        wVal = wLms ? wLms.M : 9.5;
        headVal = headLms ? headLms.M : 46;
      }

      return {
        id: `meas-benchmark-${idx + 1}`,
        date: entry.date,
        ageMonths: age,
        heightCm: Math.round(hVal * 10) / 10,
        weightKg: Math.round(wVal * 10) / 10,
        headCm: headVal !== null ? Math.round(headVal * 10) / 10 : null,
        headCircumferenceCm: headVal !== null ? Math.round(headVal * 10) / 10 : null,
        notes: 'WHO / CDC 50th percentile normative median',
        source: 'WHO/CDC Standard',
        isBenchmark: true,
        updatedAt: now
      };
    });

    const peerMilestones = [
      { id: 'ms-bm-1', key: 'social_smile_2m', title: 'Social Smile', category: 'social', ageMonths: 2.0, targetAgeMonths: 2.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-2', key: 'rolls_both_ways_6m', title: 'Rolls Both Ways', category: 'motor', ageMonths: 5.5, targetAgeMonths: 6.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-3', key: 'sits_unsupported_9m', title: 'Sits Unsupported', category: 'motor', ageMonths: 7.0, targetAgeMonths: 9.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-4', key: 'pulls_to_stand_12m', title: 'Pulls to Stand', category: 'motor', ageMonths: 9.5, targetAgeMonths: 12.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-5', key: 'first_words_12m', title: 'First Words (Mama/Dada)', category: 'speech', ageMonths: 11.5, targetAgeMonths: 12.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-6', key: 'walks_independently_15m', title: 'Walks Alone', category: 'motor', ageMonths: 12.5, targetAgeMonths: 15.0, notes: 'CDC 50th percentile normative age' },
      { id: 'ms-bm-7', key: 'two_word_phrases_24m', title: 'First 2-Word Phrase', category: 'speech', ageMonths: 20.0, targetAgeMonths: 24.0, notes: 'CDC 50th percentile normative age' }
    ];

    return {
      id: 'benchmark-peer',
      name: 'WHO/CDC 50th %ile Peer',
      isBenchmark: true,
      sex: normalizedSex,
      gender: normalizedSex === 'F' ? 'female' : 'male',
      birthDate,
      gestationalWeeks: 40,
      color: '#64748B',
      secondaryColor: '#E2E8F0',
      measurements: peerMeasurements,
      milestones: peerMilestones,
      updatedAt: now
    };
  }

  /**
   * Resolves the comparison pair from FamilyState, supporting 0, 1, 2, or N children.
   * If family has 1 child, returns mode: 'solo' with a synthetic WHO/CDC benchmark peer as childB.
   * If family has 2+ children, returns mode: 'pair' with resolved childA and childB.
   */
  function resolveComparisonPair(familyState, preferredAId, preferredBId) {
    const children = (familyState && Array.isArray(familyState.children)) ? familyState.children : [];

    if (children.length === 0) {
      return {
        mode: 'empty',
        childA: null,
        childB: null,
        benchmarkPeer: null,
        availableChildren: []
      };
    }

    if (children.length === 1) {
      const childA = children[0];
      const benchmarkPeer = createBenchmarkPeer(childA, familyState.parents);
      return {
        mode: 'solo',
        childA,
        childB: benchmarkPeer,
        benchmarkPeer,
        availableChildren: [childA]
      };
    }

    // 2 or more children
    let childA = null;
    if (preferredAId) {
      childA = children.find(c => c && c.id === preferredAId);
    }
    if (!childA) {
      childA = children[0];
    }

    let childB = null;
    if (preferredBId && preferredBId !== childA.id) {
      childB = children.find(c => c && c.id === preferredBId);
    }
    if (!childB) {
      childB = children.find(c => c && c.id !== childA.id) || children[1];
    }

    return {
      mode: 'pair',
      childA,
      childB,
      benchmarkPeer: null,
      availableChildren: children
    };
  }

  // =========================================================================
  // 3. EXACT-AGE INTERPOLATION & PROJECTION ENGINE
  // =========================================================================

  /**
   * Sorts child measurements in ascending order by ageMonths.
   */
  function getSortedMeasurements(child) {
    if (!child || !Array.isArray(child.measurements)) return [];
    return child.measurements
      .slice()
      .filter(m => m && typeof m.ageMonths === 'number' && !isNaN(m.ageMonths))
      .sort((a, b) => a.ageMonths - b.ageMonths);
  }

  /**
   * Linearly interpolates or projects a child's measurements at an exact target age in months.
   * If targetAgeMonths exceeds the child's maximum recorded age and allowProjection is false,
   * returns { available: false, maxRecordedAge, childName }.
   */
  function interpolateAtAge(child, targetAgeMonths, allowProjection = false) {
    if (!child) {
      return { available: false, reason: 'Child record is undefined' };
    }

    const measurements = getSortedMeasurements(child);
    if (measurements.length === 0) {
      return { available: false, reason: 'No measurements recorded', childName: child.name };
    }

    const targetAge = Math.max(0, Number(targetAgeMonths) || 0);
    const minM = measurements[0];
    const maxM = measurements[measurements.length - 1];
    const minAge = minM.ageMonths;
    const maxAge = maxM.ageMonths;

    // 1. Beyond max recorded age
    if (targetAge > maxAge) {
      if (!allowProjection) {
        return {
          available: false,
          reason: 'Target age exceeds recorded range',
          maxRecordedAge: maxAge,
          childName: child.name
        };
      }
      return projectBeyondMaxAge(child, measurements, targetAge);
    }

    // 2. Before min recorded age
    if (targetAge < minAge) {
      if (Math.abs(targetAge - minAge) < 0.25) {
        const headVal = minM.headCm ?? minM.headCircumferenceCm;
        return createInterpolatedResult(child, targetAge, minM.weightKg, minM.heightCm, headVal, false, false, minM.date);
      }
      if (allowProjection) {
        return projectBeyondMaxAge(child, measurements, targetAge);
      }
      return {
        available: false,
        reason: 'Target age is before earliest recorded measurement',
        minRecordedAge: minAge,
        childName: child.name
      };
    }

    // 3. Exact match within 0.15 months
    for (let i = 0; i < measurements.length; i++) {
      const m = measurements[i];
      if (Math.abs(m.ageMonths - targetAge) <= 0.15) {
        const headVal = m.headCm ?? m.headCircumferenceCm;
        return createInterpolatedResult(
          child,
          targetAge,
          m.weightKg,
          m.heightCm,
          headVal,
          false,
          false,
          m.date
        );
      }
    }

    // 4. Bracketed linear interpolation between surrounding checkups (m1, m2)
    let m1 = measurements[0];
    let m2 = measurements[measurements.length - 1];

    for (let i = 0; i < measurements.length - 1; i++) {
      if (targetAge >= measurements[i].ageMonths && targetAge <= measurements[i + 1].ageMonths) {
        m1 = measurements[i];
        m2 = measurements[i + 1];
        break;
      }
    }

    const span = m2.ageMonths - m1.ageMonths;
    const factor = span > 0 ? (targetAge - m1.ageMonths) / span : 0;

    const weightKg = (m1.weightKg != null && m2.weightKg != null)
      ? Math.round((m1.weightKg + factor * (m2.weightKg - m1.weightKg)) * 100) / 100
      : (m1.weightKg != null ? m1.weightKg : m2.weightKg);

    const heightCm = (m1.heightCm != null && m2.heightCm != null)
      ? Math.round((m1.heightCm + factor * (m2.heightCm - m1.heightCm)) * 10) / 10
      : (m1.heightCm != null ? m1.heightCm : m2.heightCm);

    const m1Head = m1.headCm ?? m1.headCircumferenceCm;
    const m2Head = m2.headCm ?? m2.headCircumferenceCm;
    const headCm = (m1Head != null && m2Head != null)
      ? Math.round((m1Head + factor * (m2Head - m1Head)) * 10) / 10
      : (m1Head != null ? m1Head : m2Head);

    const nearestRecordDate = factor < 0.5 ? m1.date : m2.date;

    return createInterpolatedResult(
      child,
      targetAge,
      weightKg,
      heightCm,
      headCm,
      true, // isInterpolated
      false, // isProjected
      nearestRecordDate
    );
  }

  /**
   * Projects future growth along the child's latest known LMS Z-score trajectory.
   */
  function projectBeyondMaxAge(child, sortedMeasurements, targetAge) {
    const latest = sortedMeasurements[sortedMeasurements.length - 1];
    const sex = child.sex || child.gender || 'M';

    const latestHead = latest.headCm ?? latest.headCircumferenceCm;

    // Calculate latest Z-scores
    const latestWeightStats = latest.weightKg ? computeZAndPercentile(sex, 'weight', latest.ageMonths, latest.weightKg, child) : null;
    const latestHeightStats = latest.heightCm ? computeZAndPercentile(sex, 'height', latest.ageMonths, latest.heightCm, child) : null;
    const latestHeadStats = latestHead ? computeZAndPercentile(sex, 'head', latest.ageMonths, latestHead, child) : null;

    const zWeight = latestWeightStats ? latestWeightStats.zScore : 0.5;
    const zHeight = latestHeightStats ? latestHeightStats.zScore : 0.5;
    const zHead = latestHeadStats ? latestHeadStats.zScore : 0.5;

    const projectedWeightKg = valueFromZScore(sex, 'weight', targetAge, zWeight);
    const projectedHeightCm = valueFromZScore(sex, 'height', targetAge, zHeight);
    const projectedHeadCm = valueFromZScore(sex, 'head', targetAge, zHead);

    return createInterpolatedResult(
      child,
      targetAge,
      projectedWeightKg,
      projectedHeightCm,
      projectedHeadCm,
      false, // not interpolated between records
      true,  // isProjected
      latest.date
    );
  }

  /**
   * Construct standard result payload with complete WHO/CDC stats for each metric.
   */
  function createInterpolatedResult(child, targetAge, weightKg, heightCm, headCm, isInterpolated, isProjected, nearestRecordDate) {
    const sex = child.sex || child.gender || 'M';
    const bmi = calcBMI(weightKg, heightCm);

    const weightStats = weightKg != null ? computeZAndPercentile(sex, 'weight', targetAge, weightKg, child) : null;
    const heightStats = heightCm != null ? computeZAndPercentile(sex, 'height', targetAge, heightCm, child) : null;
    const headStats = headCm != null ? computeZAndPercentile(sex, 'head', targetAge, headCm, child) : null;
    const bmiStats = bmi != null ? computeZAndPercentile(sex, 'bmi', targetAge, bmi, child) : null;

    return {
      available: true,
      isInterpolated: !!isInterpolated,
      isProjected: !!isProjected,
      ageMonths: targetAge,
      childName: child.name,
      childSex: sex,
      weightKg,
      heightCm,
      headCm,
      headCircumferenceCm: headCm,
      bmi,
      weightStats,
      heightStats,
      headStats,
      bmiStats,
      heightPercentile: heightStats ? heightStats.percentile : null,
      weightPercentile: weightStats ? weightStats.percentile : null,
      headPercentile: headStats ? headStats.percentile : null,
      bmiPercentile: bmiStats ? bmiStats.percentile : null,
      percentileHeight: heightStats ? heightStats.percentile : null,
      percentileWeight: weightStats ? weightStats.percentile : null,
      nearestRecordDate: nearestRecordDate || null
    };
  }

  /**
   * Convenience wrapper that projects along child's LMS Z-score if targetAge exceeds max recorded age.
   */
  function interpolateOrProjectAtAge(child, targetAgeMonths) {
    return interpolateAtAge(child, targetAgeMonths, true);
  }

  // =========================================================================
  // 4. HEAD-TO-HEAD SIBLING COMPARISON
  // =========================================================================

  /**
   * Generates a comprehensive head-to-head comparison of childA vs childB at an exact age.
   * Compares absolute measurements (cm, kg) and sex-normalized percentile ranks.
   */
  function compareAtAge(childA, childB, ageMonths, includeProjection = true) {
    if (!childA || !childB) {
      return {
        available: false,
        error: 'Both childA and childB must be provided'
      };
    }

    const aData = includeProjection
      ? interpolateOrProjectAtAge(childA, ageMonths)
      : interpolateAtAge(childA, ageMonths, false);

    const bData = includeProjection
      ? interpolateOrProjectAtAge(childB, ageMonths)
      : interpolateAtAge(childB, ageMonths, false);

    if (!aData.available || !bData.available) {
      return {
        available: false,
        ageMonths,
        childA: aData,
        childB: bData,
        error: `Data unavailable for ${!aData.available ? childA.name : childB.name} at ${ageMonths} months`
      };
    }

    // Biometric deltas (A - B)
    const heightDiffCm = (aData.heightCm != null && bData.heightCm != null)
      ? Math.round((aData.heightCm - bData.heightCm) * 10) / 10
      : null;

    const weightDiffKg = (aData.weightKg != null && bData.weightKg != null)
      ? Math.round((aData.weightKg - bData.weightKg) * 100) / 100
      : null;

    const headDiffCm = (aData.headCm != null && bData.headCm != null)
      ? Math.round((aData.headCm - bData.headCm) * 10) / 10
      : null;

    const bmiDiff = (aData.bmi != null && bData.bmi != null)
      ? Math.round((aData.bmi - bData.bmi) * 100) / 100
      : null;

    // Percentile rank and Z-score deltas (Sex-normalized!)
    const heightPctDiff = (aData.heightStats && bData.heightStats)
      ? Math.round((aData.heightStats.percentile - bData.heightStats.percentile) * 10) / 10
      : null;

    const weightPctDiff = (aData.weightStats && bData.weightStats)
      ? Math.round((aData.weightStats.percentile - bData.weightStats.percentile) * 10) / 10
      : null;

    const heightZDiff = (aData.heightStats && bData.heightStats)
      ? Math.round((aData.heightStats.zScore - bData.heightStats.zScore) * 100) / 100
      : null;

    const weightZDiff = (aData.weightStats && bData.weightStats)
      ? Math.round((aData.weightStats.zScore - bData.weightStats.zScore) * 100) / 100
      : null;

    // Format human-friendly narrative comparison
    const summaryInsight = generateSummaryInsight({
      childA,
      childB,
      aData,
      bData,
      ageMonths,
      heightDiffCm,
      weightDiffKg,
      heightPctDiff,
      weightPctDiff
    });

    const delta = {
      heightCm: heightDiffCm,
      weightKg: weightDiffKg,
      headCm: headDiffCm,
      bmi: bmiDiff,
      heightPct: heightPctDiff,
      weightPct: weightPctDiff
    };

    return {
      available: true,
      ageMonths,
      childA: aData,
      childB: bData,
      leo: aData,
      maya: bData,
      heightDiffCm,
      weightDiffKg,
      headDiffCm,
      bmiDiff,
      heightPctDiff,
      weightPctDiff,
      heightZDiff,
      weightZDiff,
      delta,
      summaryInsight,
      narrative: summaryInsight
    };
  }

  /**
   * Generates a warm, clinically clear narrative explaining the comparison.
   */
  function generateSummaryInsight(opts) {
    const { childA, childB, aData, bData, ageMonths, heightDiffCm, weightDiffKg, heightPctDiff, weightPctDiff } = opts;
    const nameA = childA.name || 'Child 1';
    const nameB = childB.name || 'Child 2';

    const ageLabel = ageMonths === 0
      ? 'birth'
      : `${ageMonths} ${ageMonths === 1 ? 'month' : 'months'}`;

    if (heightDiffCm === null || weightDiffKg === null) {
      return `At ${ageLabel}, both ${nameA} and ${nameB} have healthy recorded measurements.`;
    }

    // Absolute height comparison
    let heightSentence = '';
    if (Math.abs(heightDiffCm) < 0.2) {
      heightSentence = `${nameA} and ${nameB} were virtually identical in height (${aData.heightCm} cm)`;
    } else if (heightDiffCm > 0) {
      heightSentence = `${nameA} was ${heightDiffCm} cm taller in absolute height (${aData.heightCm} cm vs ${bData.heightCm} cm)`;
    } else {
      heightSentence = `${nameB} was ${Math.abs(heightDiffCm)} cm taller in absolute height (${bData.heightCm} cm vs ${aData.heightCm} cm)`;
    }

    // Percentile rank comparison
    let pctSentence = '';
    const engine = getSafeEngine();
    const safeFormatOrd = (engine && typeof engine.formatOrdinal === 'function')
      ? engine.formatOrdinal
      : (p) => {
          const r = Math.round(Number(p));
          const rem100 = Math.abs(r) % 100;
          if (rem100 >= 11 && rem100 <= 13) return `${r}th`;
          const rem10 = Math.abs(r) % 10;
          if (rem10 === 1) return `${r}st`;
          if (rem10 === 2) return `${r}nd`;
          if (rem10 === 3) return `${r}rd`;
          return `${r}th`;
        };

    const pctStrA = (aData.heightStats && aData.heightStats.formattedPercentile)
      ? `${aData.heightStats.formattedPercentile} percentile`
      : `${safeFormatOrd(aData.heightStats ? aData.heightStats.percentile : 50)} percentile`;
    const pctStrB = (bData.heightStats && bData.heightStats.formattedPercentile)
      ? `${bData.heightStats.formattedPercentile} percentile`
      : `${safeFormatOrd(bData.heightStats ? bData.heightStats.percentile : 50)} percentile`;

    const pronounB = (childB.sex === 'F' || childB.gender === 'female') ? 'her' : 'his';

    if (heightPctDiff !== null && Math.abs(heightPctDiff) >= 1.0) {
      if (heightPctDiff > 0) {
        pctSentence = `, while ${nameA} tracked higher on the sex-adjusted WHO growth curve (${pctStrA} vs ${nameB}'s ${pctStrB}).`;
      } else {
        pctSentence = `, while ${nameB} tracked higher on ${pronounB} sex-adjusted WHO growth curve (${pctStrB} vs ${nameA}'s ${pctStrA}).`;
      }
    } else {
      pctSentence = `, with both tracking at roughly the same sex-adjusted percentile (${pctStrA} vs ${pctStrB}).`;
    }

    let projectionNote = '';
    if (aData.isProjected || bData.isProjected) {
      const projNames = [aData.isProjected ? nameA : null, bData.isProjected ? nameB : null].filter(Boolean).join(' and ');
      projectionNote = ` (Note: ${projNames}'s values are projected along their latest LMS trajectory).`;
    }

    return `At ${ageLabel}, ${heightSentence}${pctSentence}${projectionNote}`;
  }

  // =========================================================================
  // 5. STANDARD MILESTONE AGES TABLE
  // =========================================================================

  /**
   * Generates a comparison across standard WHO well-visit ages:
   * [0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48]
   */
  function getStandardComparisonTable(childA, childB) {
    const standardAges = [0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48];
    const results = [];

    for (const age of standardAges) {
      const row = compareAtAge(childA, childB, age, true);
      const ageLabel = age === 0 ? 'Birth' : `${age}m`;
      results.push({
        ageMonths: age,
        ageLabel,
        available: row.available,
        data: row,
        label: ageLabel,
        leo: row.available ? row.childA : null,
        maya: row.available ? row.childB : null,
        childA: row.available ? row.childA : null,
        childB: row.available ? row.childB : null,
        delta: {
          heightCm: row.available ? row.heightDiffCm : null,
          weightKg: row.available ? row.weightDiffKg : null,
          headCm: row.available ? row.headDiffCm : null
        }
      });
    }

    return results;
  }

  // =========================================================================
  // 6. DEVELOPMENTAL & BIOMETRIC MILESTONE RACE
  // =========================================================================

  /**
   * Helper to compute when a child reached specific biometric milestones
   * from their longitudinal measurement series (e.g. Doubled Birth Weight, Reached 75cm, Reached 10kg).
   */
  function deriveBiometricMilestones(child) {
    const measurements = getSortedMeasurements(child);
    if (measurements.length === 0) return [];

    const birth = measurements[0];
    const derived = [];

    // 1. Doubled Birth Weight
    if (birth.weightKg) {
      const targetWeight = birth.weightKg * 2;
      for (let i = 0; i < measurements.length - 1; i++) {
        const m1 = measurements[i];
        const m2 = measurements[i + 1];
        if (m1.weightKg && m2.weightKg && m1.weightKg <= targetWeight && m2.weightKg >= targetWeight) {
          const frac = (targetWeight - m1.weightKg) / (m2.weightKg - m1.weightKg);
          const ageMonths = Math.round((m1.ageMonths + frac * (m2.ageMonths - m1.ageMonths)) * 10) / 10;
          derived.push({
            title: 'Doubled Birth Weight',
            category: 'growth',
            ageMonths,
            date: m2.date,
            notes: `Target: ${targetWeight.toFixed(2)} kg`
          });
          break;
        }
      }
    }

    // 2. Tripled Birth Weight
    if (birth.weightKg) {
      const targetWeight = birth.weightKg * 3;
      for (let i = 0; i < measurements.length - 1; i++) {
        const m1 = measurements[i];
        const m2 = measurements[i + 1];
        if (m1.weightKg && m2.weightKg && m1.weightKg <= targetWeight && m2.weightKg >= targetWeight) {
          const frac = (targetWeight - m1.weightKg) / (m2.weightKg - m1.weightKg);
          const ageMonths = Math.round((m1.ageMonths + frac * (m2.ageMonths - m1.ageMonths)) * 10) / 10;
          derived.push({
            title: 'Tripled Birth Weight',
            category: 'growth',
            ageMonths,
            date: m2.date,
            notes: `Target: ${targetWeight.toFixed(2)} kg`
          });
          break;
        }
      }
    }

    // 3. Reached 75 cm Height
    for (let i = 0; i < measurements.length - 1; i++) {
      const m1 = measurements[i];
      const m2 = measurements[i + 1];
      if (m1.heightCm && m2.heightCm && m1.heightCm <= 75.0 && m2.heightCm >= 75.0) {
        const frac = (75.0 - m1.heightCm) / (m2.heightCm - m1.heightCm);
        const ageMonths = Math.round((m1.ageMonths + frac * (m2.ageMonths - m1.ageMonths)) * 10) / 10;
        derived.push({
          title: 'Reached 75 cm Height',
          category: 'growth',
          ageMonths,
          date: m2.date,
          notes: 'Standard 1-year infant stature threshold'
        });
        break;
      }
    }

    // 4. Reached 85 cm Height
    for (let i = 0; i < measurements.length - 1; i++) {
      const m1 = measurements[i];
      const m2 = measurements[i + 1];
      if (m1.heightCm && m2.heightCm && m1.heightCm <= 85.0 && m2.heightCm >= 85.0) {
        const frac = (85.0 - m1.heightCm) / (m2.heightCm - m1.heightCm);
        const ageMonths = Math.round((m1.ageMonths + frac * (m2.ageMonths - m1.ageMonths)) * 10) / 10;
        derived.push({
          title: 'Reached 85 cm Height',
          category: 'growth',
          ageMonths,
          date: m2.date,
          notes: 'Standard toddler stature threshold'
        });
        break;
      }
    }

    // 5. Reached 10 kg Weight
    for (let i = 0; i < measurements.length - 1; i++) {
      const m1 = measurements[i];
      const m2 = measurements[i + 1];
      if (m1.weightKg && m2.weightKg && m1.weightKg <= 10.0 && m2.weightKg >= 10.0) {
        const frac = (10.0 - m1.weightKg) / (m2.weightKg - m1.weightKg);
        const ageMonths = Math.round((m1.ageMonths + frac * (m2.ageMonths - m1.ageMonths)) * 10) / 10;
        derived.push({
          title: 'Reached 10 kg Weight',
          category: 'growth',
          ageMonths,
          date: m2.date,
          notes: 'Standard 10 kg milestone'
        });
        break;
      }
    }

    return derived;
  }

  /**
   * Compares milestone timing across childA and childB.
   * Matches recorded developmental milestones (motor, language, physical)
   * and automatically computed biometric growth milestones.
   */
  function compareMilestones(childA, childB) {
    if (!childA || !childB) return [];

    const nameA = childA.name || 'Child A';
    const nameB = childB.name || 'Child B';

    // Build unified map of milestones for childA
    const mapA = new Map();
    (childA.milestones || []).forEach(m => {
      if (m && m.title) mapA.set(m.title.trim().toLowerCase(), m);
    });
    deriveBiometricMilestones(childA).forEach(m => {
      const key = m.title.trim().toLowerCase();
      if (!mapA.has(key)) mapA.set(key, m);
    });

    // Build unified map of milestones for childB
    const mapB = new Map();
    (childB.milestones || []).forEach(m => {
      if (m && m.title) mapB.set(m.title.trim().toLowerCase(), m);
    });
    deriveBiometricMilestones(childB).forEach(m => {
      const key = m.title.trim().toLowerCase();
      if (!mapB.has(key)) mapB.set(key, m);
    });

    // Collect all unique milestone titles
    const allTitles = new Map();
    mapA.forEach((v, k) => allTitles.set(k, { title: v.title, category: v.category }));
    mapB.forEach((v, k) => {
      if (!allTitles.has(k)) {
        allTitles.set(k, { title: v.title, category: v.category });
      }
    });

    const comparisons = [];

    allTitles.forEach((meta, key) => {
      const mA = mapA.get(key);
      const mB = mapB.get(key);

      const ageA = mA && typeof mA.ageMonths === 'number' ? mA.ageMonths : null;
      const ageB = mB && typeof mB.ageMonths === 'number' ? mB.ageMonths : null;
      const dateA = mA ? mA.date : null;
      const dateB = mB ? mB.date : null;

      let fasterChildName = null;
      let fasterChildId = null;
      let diffMonths = null;
      let diffWeeksLabel = null;

      const idA = childA.id || 'child-1';
      const idB = childB.id || 'child-2';

      if (ageA !== null && ageB !== null) {
        diffMonths = Math.round(Math.abs(ageA - ageB) * 10) / 10;
        const diffWeeks = Math.max(1, Math.round((diffMonths * 30.4375) / 7));

        if (Math.abs(ageA - ageB) < 0.1) {
          fasterChildName = 'Tied';
          fasterChildId = 'Tied';
          diffWeeksLabel = 'Same age';
        } else if (ageA < ageB) {
          fasterChildName = nameA;
          fasterChildId = idA;
          diffWeeksLabel = `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} earlier`;
        } else {
          fasterChildName = nameB;
          fasterChildId = idB;
          diffWeeksLabel = `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} earlier`;
        }
      }

      comparisons.push({
        title: meta.title,
        category: meta.category || 'general',
        childAAgeMonths: ageA,
        childBAgeMonths: ageB,
        childADate: dateA,
        childBDate: dateB,
        fasterChildName,
        fasterChildId,
        diffMonths,
        diffWeeksLabel
      });
    });

    // Sort by childAAgeMonths or childBAgeMonths
    comparisons.sort((a, b) => {
      const valA = a.childAAgeMonths ?? a.childBAgeMonths ?? 999;
      const valB = b.childAAgeMonths ?? b.childBAgeMonths ?? 999;
      return valA - valB;
    });

    return comparisons;
  }

  // =========================================================================
  // 7. OVERLAP & RANGE HELPERS
  // =========================================================================

  /**
   * Returns the maximum age in months for which both children have recorded measurements,
   * along with the maximum age across any child.
   */
  function getOverlapMaxAge(childA, childB) {
    const listA = getSortedMeasurements(childA);
    const listB = getSortedMeasurements(childB);

    const maxA = listA.length > 0 ? listA[listA.length - 1].ageMonths : 0;
    const maxB = listB.length > 0 ? listB[listB.length - 1].ageMonths : 0;

    const overlapMaxAge = Math.min(maxA, maxB);
    const maxAnyChildAge = Math.max(maxA, maxB);

    return {
      overlapMaxAge,
      maxAnyChildAge,
      childAMaxAge: maxA,
      childBMaxAge: maxB
    };
  }

  // =========================================================================
  // 8. DOMINANCE TIMELINE & SIBLING VELOCITIES (NEW COMPARISON UPGRADES)
  // =========================================================================

  /**
   * Evaluates compareAtAge across specified developmental ages (defaulting to standard checkup milestones 0-48m).
   * Identifies height/weight/percentile channel leaders, crossover transitions, and the biological
   * age where the siblings were most identical in stature (twinMatchAge) and percentile channel (pctTwinMatchAge).
   */
  function generateDominanceTimeline(childA, childB, ages = [0, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48]) {
    if (!childA || !childB) {
      return {
        points: [],
        twinMatchAge: null,
        pctTwinMatchAge: null,
        crossoverEvents: [],
        headline: 'Child data not available for dominance timeline.'
      };
    }

    const nameA = childA.name || 'Child A';
    const nameB = childB.name || 'Child B';
    const idA = childA.id || 'child-1';
    const idB = childB.id || 'child-2';
    const points = [];

    let minHeightDiff = Infinity;
    let twinMatchPoint = null;

    let minPctDiff = Infinity;
    let pctTwinMatchPoint = null;

    const crossoverEvents = [];

    for (const age of ages) {
      const comp = compareAtAge(childA, childB, age, true);
      if (!comp || !comp.available) continue;

      const heightDiffCm = comp.heightDiffCm;
      const weightDiffKg = comp.weightDiffKg;
      const heightPctDiff = comp.heightPctDiff;

      let heightLeader = 'Tied';
      let heightLeaderId = 'Tied';
      if (heightDiffCm !== null) {
        if (Math.abs(heightDiffCm) < 0.2) {
          heightLeader = 'Tied';
          heightLeaderId = 'Tied';
        } else if (heightDiffCm > 0) {
          heightLeader = nameA;
          heightLeaderId = idA;
        } else {
          heightLeader = nameB;
          heightLeaderId = idB;
        }
      }

      let weightLeader = 'Tied';
      let weightLeaderId = 'Tied';
      if (weightDiffKg !== null) {
        if (Math.abs(weightDiffKg) < 0.1) {
          weightLeader = 'Tied';
          weightLeaderId = 'Tied';
        } else if (weightDiffKg > 0) {
          weightLeader = nameA;
          weightLeaderId = idA;
        } else {
          weightLeader = nameB;
          weightLeaderId = idB;
        }
      }

      let pctLeader = 'Tied';
      let pctLeaderId = 'Tied';
      if (heightPctDiff !== null) {
        if (Math.abs(heightPctDiff) < 1.0) {
          pctLeader = 'Tied';
          pctLeaderId = 'Tied';
        } else if (heightPctDiff > 0) {
          pctLeader = nameA;
          pctLeaderId = idA;
        } else {
          pctLeader = nameB;
          pctLeaderId = idB;
        }
      }

      const isProjected = !!(comp.childA?.isProjected || comp.childB?.isProjected);
      const ageLabel = age === 0 ? 'Birth' : `${age}m`;

      const pt = {
        ageMonths: age,
        ageLabel,
        heightLeader,
        heightLeaderId,
        weightLeader,
        weightLeaderId,
        pctLeader,
        pctLeaderId,
        heightDiffCm,
        weightDiffKg,
        heightPctDiff,
        isProjected
      };
      points.push(pt);

      // Evaluate closest physical stature match
      if (heightDiffCm !== null && Math.abs(heightDiffCm) < minHeightDiff) {
        minHeightDiff = Math.abs(heightDiffCm);
        twinMatchPoint = pt;
      }

      // Evaluate closest percentile match
      if (heightPctDiff !== null && Math.abs(heightPctDiff) < minPctDiff) {
        minPctDiff = Math.abs(heightPctDiff);
        pctTwinMatchPoint = pt;
      }

      // Detect crossovers against previous point
      if (points.length >= 2) {
        const prev = points[points.length - 2];
        // Height leader switch (ignoring intermediate ties)
        if (prev.heightLeader !== 'Tied' && pt.heightLeader !== 'Tied' && prev.heightLeader !== pt.heightLeader) {
          crossoverEvents.push({
            type: 'height',
            metric: 'Height',
            fromAge: prev.ageMonths,
            toAge: pt.ageMonths,
            previousLeader: prev.heightLeader,
            newLeader: pt.heightLeader,
            description: `Height leadership switched from ${prev.heightLeader} to ${pt.newLeader} between ${prev.ageLabel} and ${pt.ageLabel}.`
          });
        }
        // Percentile channel leader switch
        if (prev.pctLeader !== 'Tied' && pt.pctLeader !== 'Tied' && prev.pctLeader !== pt.pctLeader) {
          crossoverEvents.push({
            type: 'percentile',
            metric: 'Percentile Channel',
            fromAge: prev.ageMonths,
            toAge: pt.ageMonths,
            previousLeader: prev.pctLeader,
            newLeader: pt.pctLeader,
            description: `Sex-adjusted percentile channel leadership crossed over from ${prev.pctLeader} to ${pt.pctLeader} between ${prev.ageLabel} and ${pt.ageLabel}.`
          });
        }
      }
    }

    // Build concise, insightful clinical headline
    let headline = '';
    if (twinMatchPoint) {
      const matchAgeDesc = twinMatchPoint.ageMonths === 0 ? 'at birth' : `at ${twinMatchPoint.ageMonths} months`;
      const diffDesc = Math.abs(twinMatchPoint.heightDiffCm) < 0.2
        ? 'virtually identical heights'
        : `a mere ${Math.abs(twinMatchPoint.heightDiffCm).toFixed(1)} cm height difference`;
      headline = `${nameA} and ${nameB} reached closest stature synchronization ${matchAgeDesc} with ${diffDesc}.`;
      if (crossoverEvents.length > 0) {
        headline += ` Detected ${crossoverEvents.length} developmental crossover ${crossoverEvents.length === 1 ? 'interval' : 'intervals'}.`;
      }
    } else {
      headline = `Longitudinal timeline evaluated across ${points.length} developmental checkup ages.`;
    }

    return {
      points,
      twinMatchAge: twinMatchPoint ? twinMatchPoint.ageMonths : null,
      pctTwinMatchAge: pctTwinMatchPoint ? pctTwinMatchPoint.ageMonths : null,
      twinMatchPoint,
      pctTwinMatchPoint,
      crossoverEvents,
      headline
    };
  }

  /**
   * Compares annualized growth velocities (cm/yr and kg/yr) between childA and childB
   * across key developmental pediatric stages:
   *  - Infancy (0–12m)
   *  - Toddlerhood (12–24m)
   *  - Preschool (24–48m)
   */
  function compareSiblingVelocities(childA, childB) {
    if (!childA || !childB) {
      return {
        stages: [],
        summary: 'Both children must be provided for velocity comparison.'
      };
    }

    const nameA = childA.name || 'Child A';
    const nameB = childB.name || 'Child B';

    const stageDefs = [
      { id: 'infancy', name: 'Infancy (0–12m)', startMonths: 0, endMonths: 12 },
      { id: 'toddlerhood', name: 'Toddlerhood (12–24m)', startMonths: 12, endMonths: 24 },
      { id: 'preschool', name: 'Preschool (24–48m)', startMonths: 24, endMonths: 48 }
    ];

    const stages = stageDefs.map(def => {
      const aStart = interpolateOrProjectAtAge(childA, def.startMonths);
      const aEnd = interpolateOrProjectAtAge(childA, def.endMonths);
      const bStart = interpolateOrProjectAtAge(childB, def.startMonths);
      const bEnd = interpolateOrProjectAtAge(childB, def.endMonths);

      const durYears = (def.endMonths - def.startMonths) / 12;

      const aValid = aStart?.available && aEnd?.available && aStart.heightCm != null && aEnd.heightCm != null && aStart.weightKg != null && aEnd.weightKg != null;
      const bValid = bStart?.available && bEnd?.available && bStart.heightCm != null && bEnd.heightCm != null && bStart.weightKg != null && bEnd.weightKg != null;

      if (!aValid || !bValid) {
        return {
          id: def.id,
          name: def.name,
          startMonths: def.startMonths,
          endMonths: def.endMonths,
          available: false
        };
      }

      // Height velocities (cm/year)
      const aHeightGainCm = Math.round((aEnd.heightCm - aStart.heightCm) * 10) / 10;
      const aHeightVelocityCmPerYear = Math.round((aHeightGainCm / durYears) * 10) / 10;

      const bHeightGainCm = Math.round((bEnd.heightCm - bStart.heightCm) * 10) / 10;
      const bHeightVelocityCmPerYear = Math.round((bHeightGainCm / durYears) * 10) / 10;

      const heightVelocityDiff = Math.round((aHeightVelocityCmPerYear - bHeightVelocityCmPerYear) * 10) / 10;

      // Weight velocities (kg/year)
      const aWeightGainKg = Math.round((aEnd.weightKg - aStart.weightKg) * 100) / 100;
      const aWeightVelocityKgPerYear = Math.round((aWeightGainKg / durYears) * 100) / 100;

      const bWeightGainKg = Math.round((bEnd.weightKg - bStart.weightKg) * 100) / 100;
      const bWeightVelocityKgPerYear = Math.round((bWeightGainKg / durYears) * 100) / 100;

      const weightVelocityDiff = Math.round((aWeightVelocityKgPerYear - bWeightVelocityKgPerYear) * 100) / 100;

      const idA = childA.id || 'child-1';
      const idB = childB.id || 'child-2';

      let heightSpeedLeader = 'Tied';
      let heightSpeedLeaderId = 'Tied';
      if (Math.abs(heightVelocityDiff) >= 0.2) {
        heightSpeedLeader = heightVelocityDiff > 0 ? nameA : nameB;
        heightSpeedLeaderId = heightVelocityDiff > 0 ? idA : idB;
      }

      let weightSpeedLeader = 'Tied';
      let weightSpeedLeaderId = 'Tied';
      if (Math.abs(weightVelocityDiff) >= 0.1) {
        weightSpeedLeader = weightVelocityDiff > 0 ? nameA : nameB;
        weightSpeedLeaderId = weightVelocityDiff > 0 ? idA : idB;
      }

      const isProjected = !!(aStart.isProjected || aEnd.isProjected || bStart.isProjected || bEnd.isProjected);

      return {
        id: def.id,
        name: def.name,
        startMonths: def.startMonths,
        endMonths: def.endMonths,
        available: true,
        isProjected,
        childA: {
          id: idA,
          name: nameA,
          heightGainCm: aHeightGainCm,
          heightVelocityCmPerYear: aHeightVelocityCmPerYear,
          weightGainKg: aWeightGainKg,
          weightVelocityKgPerYear: aWeightVelocityKgPerYear
        },
        childB: {
          id: idB,
          name: nameB,
          heightGainCm: bHeightGainCm,
          heightVelocityCmPerYear: bHeightVelocityCmPerYear,
          weightGainKg: bWeightGainKg,
          weightVelocityKgPerYear: bWeightVelocityKgPerYear
        },
        delta: {
          heightVelocityCmPerYear: heightVelocityDiff,
          weightVelocityKgPerYear: weightVelocityDiff
        },
        heightSpeedLeader,
        heightSpeedLeaderId,
        weightSpeedLeader,
        weightSpeedLeaderId
      };
    });

    const validStages = stages.filter(s => s.available);
    const summary = validStages.map(s => {
      const hLead = s.heightSpeedLeader === 'Tied' ? 'tied in stature gain' : `${s.heightSpeedLeader} grew faster (+${Math.abs(s.delta.heightVelocityCmPerYear)} cm/yr)`;
      return `${s.name}: ${hLead}.`;
    }).join(' ');

    return {
      childAName: nameA,
      childBName: nameB,
      stages,
      summary
    };
  }

  // =========================================================================
  // 9. PUBLIC API EXPORT
  // =========================================================================

  const SiblingComparison = {
    CHILD_PALETTE,
    getDefaultFamilyState,
    getEmptyFamilyState,
    createBenchmarkPeer,
    resolveComparisonPair,
    interpolateAtAge,
    interpolateOrProjectAtAge,
    compareAtAge,
    getStandardComparisonTable,
    compareMilestones,
    getOverlapMaxAge,
    generateDominanceTimeline,
    compareSiblingVelocities,
    // Statistical utilities exposed for direct testing
    computeZAndPercentile,
    valueFromZScore,
    getFallbackLMS
  };

  if (typeof window !== 'undefined') {
    window.SiblingComparison = SiblingComparison;
  }

  return SiblingComparison;
}));
