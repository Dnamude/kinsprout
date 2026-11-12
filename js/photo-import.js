/**
 * KinSprout - Two-Children Growth Tracker
 * photo-import.js - Computer Vision, OCR & Bulk Picture Import Specialist
 *
 * Responsibilities:
 * 1. Three Built-In Realistic Sample Medical/Growth Picture Generators (Bayview Pediatrics, Handwritten Baby Book, MyChart Flowsheet)
 * 2. Real Image OCR with self-hosted Tesseract.js (processImages)
 * 3. Smart Medical Natural Language & Table Parser (parseRawTextToRecords)
 * 4. Validation & Anomaly Detection (validateStagingRecords)
 * 5. Interactive Visual Bounding Box Inspector & Helper Utilities
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhotoImport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // CONSTANTS & REFERENCE DEFAULTS
  // =========================================================================

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 1000;

  // Default sibling profiles (used as fallback when familyState is not provided)
  const DEFAULT_CHILDREN = [
    {
      id: 'child-1',
      name: 'Leo',
      gender: 'male',
      birthDate: '2022-05-14',
      measurements: []
    },
    {
      id: 'child-2',
      name: 'Maya',
      gender: 'female',
      birthDate: '2024-10-10',
      measurements: []
    }
  ];

  // =========================================================================
  // UNIT CONVERSIONS & SANITIZATION HELPERS
  // =========================================================================

  const Units = {
    lbsOzToKg: function (lbs, oz) {
      const totalLbs = (parseFloat(lbs) || 0) + (parseFloat(oz) || 0) / 16;
      return Math.round(totalLbs * 0.45359237 * 100) / 100;
    },
    kgToLbsOz: function (kg) {
      const totalLbs = (parseFloat(kg) || 0) / 0.45359237;
      const lbs = Math.floor(totalLbs);
      const oz = Math.round((totalLbs - lbs) * 16 * 10) / 10;
      return { lbs, oz, formatted: `${lbs} lb ${oz} oz` };
    },
    inchesToCm: function (inches) {
      return Math.round((parseFloat(inches) || 0) * 2.54 * 10) / 10;
    },
    cmToInches: function (cm) {
      return Math.round(((parseFloat(cm) || 0) / 2.54) * 10) / 10;
    },
    ftInToCm: function (ft, inches) {
      const totalIn = (parseFloat(ft) || 0) * 12 + (parseFloat(inches) || 0);
      return Math.round(totalIn * 2.54 * 10) / 10;
    },
    gramsToKg: function (grams) {
      return Math.round(((parseFloat(grams) || 0) / 1000) * 100) / 100;
    }
  };

  /**
   * Calculate precise age in months between birth date and event date
   */
  function calculateAgeInMonths(birthDateStr, eventDateStr) {
    if (!birthDateStr || !eventDateStr) return 0;
    const b = new Date(birthDateStr);
    const e = new Date(eventDateStr);
    if (isNaN(b.getTime()) || isNaN(e.getTime())) return 0;
    const diffMs = e.getTime() - b.getTime();
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
    return Math.max(0, Math.round(months * 10) / 10);
  }

  /**
   * Helper to format Date object into YYYY-MM-DD
   */
  function formatDateISO(d) {
    if (!d || isNaN(d.getTime())) return '';
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  // =========================================================================
  // WHO / CDC LMS GROWTH STANDARDS APPROXIMATION (FALLBACK ENGINE)
  // Used when window.GrowthEngine is not loaded yet or for standalone tests
  // =========================================================================

  const GrowthNorms = {
    // Standard median (50th percentile) & approximate SD by age in months (0..60)
    boy: {
      weight: {
        // [month, medianKg, sdKg]
        points: [
          [0, 3.3, 0.4], [1, 4.5, 0.5], [2, 5.6, 0.6], [3, 6.4, 0.7], [4, 7.0, 0.75],
          [6, 7.9, 0.85], [9, 8.9, 0.95], [12, 9.6, 1.05], [15, 10.3, 1.15],
          [18, 10.9, 1.25], [24, 12.2, 1.4], [30, 13.3, 1.55], [36, 14.3, 1.7],
          [42, 15.3, 1.85], [48, 16.3, 2.0], [54, 17.3, 2.2], [60, 18.3, 2.4]
        ]
      },
      height: {
        points: [
          [0, 49.9, 1.9], [1, 54.7, 2.0], [2, 58.4, 2.1], [3, 61.4, 2.2], [4, 63.9, 2.3],
          [6, 67.6, 2.4], [9, 72.0, 2.5], [12, 75.7, 2.6], [15, 79.1, 2.7],
          [18, 82.3, 2.8], [24, 87.8, 3.1], [30, 92.4, 3.3], [36, 96.1, 3.5],
          [42, 99.8, 3.8], [48, 103.3, 4.0], [54, 106.7, 4.2], [60, 110.0, 4.5]
        ]
      },
      head: {
        points: [
          [0, 34.5, 1.2], [1, 36.9, 1.2], [2, 38.8, 1.2], [3, 40.3, 1.3], [4, 41.6, 1.3],
          [6, 43.3, 1.3], [9, 45.0, 1.3], [12, 46.1, 1.3], [15, 46.9, 1.4],
          [18, 47.4, 1.4], [24, 48.3, 1.4], [36, 49.8, 1.4], [48, 50.7, 1.4], [60, 51.4, 1.4]
        ]
      }
    },
    girl: {
      weight: {
        points: [
          [0, 3.2, 0.4], [1, 4.2, 0.5], [2, 5.1, 0.6], [3, 5.8, 0.65], [4, 6.4, 0.7],
          [6, 7.3, 0.8], [9, 8.2, 0.9], [12, 8.9, 1.0], [15, 9.6, 1.1],
          [18, 10.2, 1.2], [24, 11.5, 1.4], [30, 12.7, 1.5], [36, 13.9, 1.7],
          [42, 15.0, 1.9], [48, 16.1, 2.1], [54, 17.2, 2.3], [60, 18.2, 2.5]
        ]
      },
      height: {
        points: [
          [0, 49.1, 1.9], [1, 53.7, 2.0], [2, 57.1, 2.1], [3, 59.8, 2.2], [4, 62.1, 2.2],
          [6, 65.7, 2.3], [9, 70.1, 2.4], [12, 74.0, 2.5], [15, 77.5, 2.6],
          [18, 80.7, 2.8], [24, 86.4, 3.1], [30, 91.2, 3.3], [36, 95.1, 3.6],
          [42, 99.0, 3.8], [48, 102.7, 4.1], [54, 106.2, 4.3], [60, 109.4, 4.6]
        ]
      },
      head: {
        points: [
          [0, 33.9, 1.2], [1, 36.2, 1.2], [2, 38.0, 1.2], [3, 39.5, 1.2], [4, 40.7, 1.2],
          [6, 42.2, 1.2], [9, 43.8, 1.3], [12, 44.9, 1.3], [15, 45.6, 1.3],
          [18, 46.2, 1.3], [24, 47.2, 1.4], [36, 48.6, 1.4], [48, 49.5, 1.4], [60, 50.3, 1.4]
        ]
      }
    }
  };

  /**
   * Linear interpolation helper for growth reference points
   */
  function interpolateNorm(points, age) {
    if (age <= points[0][0]) return { median: points[0][1], sd: points[0][2] };
    const last = points[points.length - 1];
    if (age >= last[0]) return { median: last[1], sd: last[2] };

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (age >= p0[0] && age <= p1[0]) {
        const ratio = (age - p0[0]) / (p1[0] - p0[0]);
        return {
          median: p0[1] + ratio * (p1[1] - p0[1]),
          sd: p0[2] + ratio * (p1[2] - p0[2])
        };
      }
    }
    return { median: last[1], sd: last[2] };
  }

  /**
   * Standard normal cumulative distribution function (CDF) for Z-score -> percentile
   */
  function normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  /**
   * Robust percentile calculation using window.GrowthEngine if available, with internal fallback
   */
  function calculatePercentile(gender, ageMonths, metricType, value) {
    if (value === null || value === undefined || isNaN(value) || value <= 0) return null;

    // Check if external window.GrowthEngine is exposed
    if (typeof window !== 'undefined' && window.GrowthEngine) {
      try {
        if (typeof window.GrowthEngine.calculateZScoreAndPercentile === 'function') {
          const sex = (gender === 'female' || gender === 'F' || (typeof gender === 'string' && gender.toLowerCase().startsWith('f'))) ? 'F' : 'M';
          const metric = (metricType === 'headCircumference' || metricType === 'headCm') ? 'head' : metricType;
          const res = window.GrowthEngine.calculateZScoreAndPercentile(sex, metric, ageMonths, value);
          if (res && typeof res.percentile === 'number') {
            return Math.round(res.percentile * 10) / 10;
          }
        }
        if (typeof window.GrowthEngine.calculatePercentile === 'function') {
          const p = window.GrowthEngine.calculatePercentile(gender, ageMonths, metricType, value);
          if (p !== undefined && p !== null) return Math.round(p * 10) / 10;
        }
      } catch (err) {
        // Fallback to internal norms
      }
    }

    // Internal WHO/CDC approximation fallback
    const gKey = (gender || 'male').toLowerCase().startsWith('f') ? 'girl' : 'boy';
    const normGroup = GrowthNorms[gKey] && GrowthNorms[gKey][metricType];
    if (!normGroup) return 50.0;

    const { median, sd } = interpolateNorm(normGroup.points, Math.max(0, ageMonths || 0));
    if (sd <= 0) return 50.0;
    const z = (value - median) / sd;
    const pct = normalCDF(z) * 100;
    return Math.round(Math.max(0.1, Math.min(99.9, pct)) * 10) / 10;
  }

  // =========================================================================
  // 1. SAMPLE MEDICAL & GROWTH PICTURE GENERATORS
  // =========================================================================

  const SampleTemplates = [
    {
      id: 'pediatric-summary',
      title: 'Bayview Pediatrics — Combined Sibling Visit & Growth Summary',
      fileName: 'bayview_pediatrics_sibling_summary.png',
      badge: 'Official Clinic Record',
      category: 'Medical Encounter Summary',
      description:
        'Official pediatric clinic encounter summary with hospital letterhead, watermarks, clinic details, table layout with visit dates, sibling measurements for Leo and Maya, and physician signature stamp.',
      groundTruthText: `BAYVIEW PEDIATRICS & ADOLESCENT MEDICINE
3200 Pacific Heights Blvd, Suite 410, San Francisco, CA 94115 | Tel: (415) 555-0194
COMBINED SIBLING GROWTH & ENCOUNTER SUMMARY

GUARDIAN: Sarah & David Miller | PEDIATRICIAN: Dr. Elena Rostova, MD, FAAP
SIBLINGS: Leo Miller (DOB: 05/14/2022) | Maya Miller (DOB: 10/10/2024)

DATE        | PATIENT     | VISIT / AGE   | WEIGHT                  | HEIGHT / LENGTH    | HEAD CIRC (HC)     | CLINICAL IMPRESSION
05/16/2025  | Leo Miller  | 36 Mo Checkup | 34 lb 8 oz (15.65 kg)   | 96.5 cm (38.0 in)  | 50.1 cm (19.7 in)  | 3-Yr well child checkup. Active, speech normal.
04/18/2025  | Maya Miller | 6 Mo Checkup  | 16 lb 4 oz (7.37 kg)    | 66.8 cm (26.3 in)  | 42.6 cm (16.8 in)  | 6-Month well baby check. Sitting tripod, rolling.
11/20/2025  | Leo Miller  | 42 Mo Screen  | 36 lb 4 oz (16.44 kg)   | 100.5 cm (39.6 in) | 50.6 cm (19.9 in)  | Pre-K entrance screening, healthy development.
10/14/2025  | Maya Miller | 12 Mo Visit   | 21 lb 2 oz (9.58 kg)    | 75.4 cm (29.7 in)  | 45.3 cm (17.8 in)  | 1-Year Checkup. Walking assisted, pincer grasp.
04/16/2026  | Maya Miller | 18 Mo Checkup | 24 lb 8 oz (11.11 kg)   | 82.3 cm (32.4 in)  | 47.0 cm (18.5 in)  | 18-Month Checkup. 25+ words, running steadily.
08/14/2026  | Leo Miller  | 51 Mo / 4 Yr  | 39 lb 6 oz (17.85 kg)   | 106.4 cm (41.9 in) | 51.2 cm (20.2 in)  | 4-Year Checkup. Vision/hearing normal, vaccines given.

CLINICAL ATTESTATION: Dr. Elena Rostova, MD, FAAP (License #CA-PED-88412)
BAYVIEW PEDIATRICS CLINICAL RECORDS VERIFIED SEAL`,
      rawRecords: [
        {
          childName: 'Leo',
          date: '2025-05-16',
          ageMonths: 36.0,
          weightKg: 15.65,
          heightCm: 96.5,
          headCm: 50.1,
          headCircumferenceCm: 50.1,
          rawLine: '05/16/2025 | Leo Miller | 36 Mo Checkup | 34 lb 8 oz (15.65 kg) | 96.5 cm (38.0 in) | HC: 50.1 cm',
          notes: '3-Year well child checkup. Active, speech fluent.',
          boundingBox: { x: 0.05, y: 0.33, w: 0.9, h: 0.065 }
        },
        {
          childName: 'Maya',
          date: '2025-04-18',
          ageMonths: 6.2,
          weightKg: 7.37,
          heightCm: 66.8,
          headCm: 42.6,
          headCircumferenceCm: 42.6,
          rawLine: '04/18/2025 | Maya Miller | 6 Mo Checkup | 16 lb 4 oz (7.37 kg) | 66.8 cm (26.3 in) | HC: 42.6 cm',
          notes: '6-Month well baby check. Sitting tripod, rolling.',
          boundingBox: { x: 0.05, y: 0.405, w: 0.9, h: 0.065 }
        },
        {
          childName: 'Leo',
          date: '2025-11-20',
          ageMonths: 42.2,
          weightKg: 16.44,
          heightCm: 100.5,
          headCm: 50.6,
          headCircumferenceCm: 50.6,
          rawLine: '11/20/2025 | Leo Miller | 42 Mo Screen | 36 lb 4 oz (16.44 kg) | 100.5 cm (39.6 in) | HC: 50.6 cm',
          notes: 'Pre-K entrance screening, healthy growth.',
          boundingBox: { x: 0.05, y: 0.48, w: 0.9, h: 0.065 }
        },
        {
          childName: 'Maya',
          date: '2025-10-14',
          ageMonths: 12.0,
          weightKg: 9.58,
          heightCm: 75.4,
          headCm: 45.3,
          headCircumferenceCm: 45.3,
          rawLine: '10/14/2025 | Maya Miller | 12 Mo Visit | 21 lb 2 oz (9.58 kg) | 75.4 cm (29.7 in) | HC: 45.3 cm',
          notes: '1-Year Checkup. Walking assisted, pincer grasp.',
          boundingBox: { x: 0.05, y: 0.555, w: 0.9, h: 0.065 }
        },
        {
          childName: 'Maya',
          date: '2026-04-16',
          ageMonths: 18.1,
          weightKg: 11.11,
          heightCm: 82.3,
          headCm: 47.0,
          headCircumferenceCm: 47.0,
          rawLine: '04/16/2026 | Maya Miller | 18 Mo Checkup | 24 lb 8 oz (11.11 kg) | 82.3 cm (32.4 in) | HC: 47.0 cm',
          notes: '18-Month Checkup. 25+ words, running steadily.',
          boundingBox: { x: 0.05, y: 0.63, w: 0.9, h: 0.065 }
        },
        {
          childName: 'Leo',
          date: '2026-08-14',
          ageMonths: 51.0,
          weightKg: 17.85,
          heightCm: 106.4,
          headCm: 51.2,
          headCircumferenceCm: 51.2,
          rawLine: '08/14/2026 | Leo Miller | Wt: 39 lb 6 oz (17.85 kg) | Ht: 106.4 cm | HC: 51.2 cm | 4-Year Checkup',
          notes: '4-Year Checkup. Normal vision/hearing, immunizations given.',
          boundingBox: { x: 0.05, y: 0.705, w: 0.9, h: 0.065 }
        }
      ]
    },
    {
      id: 'baby-book-handwritten',
      title: 'Handwritten Baby Book & Doorframe Growth Chart Notes',
      fileName: 'baby_book_and_doorframe_notes.png',
      badge: 'Family Keepsake Notes',
      category: 'Handwritten Journal & Pencil Marks',
      description:
        'Styled like warm cream lined notebook paper with handwritten-style typography containing 5 historical measurements for Maya & Leo written in parent shorthand with doorframe tick marks and affectionate memories.',
      groundTruthText: `Leo & Maya's Growth Memories & Doorframe Marks ♡
Kitchen Doorframe & Memory Journal Notes

1. Leo 2nd Birthday doorframe mark! - 2024-05-15 - 28 lbs 2 oz, 34.6 inches tall (running everywhere!)
2. Maya 4m checkup - 2025-02-14 - 14 lbs 2 oz, 24.8 in, head circ 41.2 cm (smiled so big at Dr. Adams!)
3. Maya 8m checkup - 2025-06-12 - 18 lbs 6 oz, 27.8 inches, head 44.1 cm (two bottom teeth came in!)
4. Leo hallway pencil mark (summer) - 2025-08-20 - 35.1 lbs, 38.5 in (almost tall enough for big slide)
5. Maya 15 months doorframe tick mark - 2026-01-15 - 22.8 lbs, 31.0 in, HC 46.2 cm (walking and dancing!)`,
      rawRecords: [
        {
          childName: 'Leo',
          date: '2024-05-15',
          ageMonths: 24.0,
          weightKg: 12.76,
          heightCm: 87.9,
          headCm: null,
          headCircumferenceCm: null,
          rawLine: 'Leo 2nd Birthday doorframe mark! - 2024-05-15 - 28 lbs 2 oz, 34.6 inches tall',
          notes: '2nd Birthday doorframe pencil tick mark. Running in backyard.',
          boundingBox: { x: 0.1, y: 0.22, w: 0.82, h: 0.11 }
        },
        {
          childName: 'Maya',
          date: '2025-02-14',
          ageMonths: 4.1,
          weightKg: 6.41,
          heightCm: 63.0,
          headCm: 41.2,
          headCircumferenceCm: 41.2,
          rawLine: 'Maya 4m checkup - 2025-02-14 - 14 lbs 2 oz, 24.8 in, head circ 41.2 cm',
          notes: '4m checkup Valentine visit. Smiled at Dr. Adams.',
          boundingBox: { x: 0.1, y: 0.35, w: 0.82, h: 0.11 }
        },
        {
          childName: 'Maya',
          date: '2025-06-12',
          ageMonths: 8.0,
          weightKg: 8.33,
          heightCm: 70.6,
          headCm: 44.1,
          headCircumferenceCm: 44.1,
          rawLine: 'Maya 8m checkup - 2025-06-12 - 18 lbs 6 oz, 27.8 inches, head 44.1 cm',
          notes: '8m checkup. Two bottom teeth erupted.',
          boundingBox: { x: 0.1, y: 0.48, w: 0.82, h: 0.11 }
        },
        {
          childName: 'Leo',
          date: '2025-08-20',
          ageMonths: 39.2,
          weightKg: 15.92,
          heightCm: 97.8,
          headCm: null,
          headCircumferenceCm: null,
          rawLine: 'Leo hallway pencil mark (summer) - 2025-08-20 - 35.1 lbs, 38.5 in',
          notes: 'Summer hallway pencil mark. Almost tall enough for big slide.',
          boundingBox: { x: 0.1, y: 0.61, w: 0.82, h: 0.11 }
        },
        {
          childName: 'Maya',
          date: '2026-01-15',
          ageMonths: 15.1,
          weightKg: 10.34,
          heightCm: 78.7,
          headCm: 46.2,
          headCircumferenceCm: 46.2,
          rawLine: 'Maya 15 months doorframe tick mark - 2026-01-15 - 22.8 lbs, 31.0 in, HC 46.2 cm',
          notes: '15 months doorframe mark. Walking and dancing.',
          boundingBox: { x: 0.1, y: 0.74, w: 0.82, h: 0.11 }
        }
      ]
    },
    {
      id: 'portal-screenshot',
      title: 'MyChart Patient Portal — Vitals & Growth Flowsheet Screenshot',
      fileName: 'mychart_flowsheet_vitals_export.png',
      badge: 'EHR Patient Portal',
      category: 'Clinical Flowsheet Export',
      description:
        'Styled like a modern clinical EHR table screenshot with blue header bar, patient selector tabs, verified badges, and 5 vitals rows for Leo and Maya.',
      groundTruthText: `MYCHART CLINICAL PORTAL - VITALS & GROWTH FLOWSHEET
PATIENTS: Maya Miller & Leo Miller (Combined Sibling Flowsheet)
DEPARTMENT: Bayview Health System Pediatric Ambulatory Care

DATE        PATIENT      AGE          WEIGHT                   HEIGHT / LENGTH         HEAD CIRC  STATUS
02/10/2025  Maya Miller  4 mos        6.42 kg (14 lb 2.5 oz)   63.2 cm (24.9 in)       41.0 cm    Verified
05/18/2025  Leo Miller   3 yrs 0 mos  15.70 kg (34 lb 9.8 oz)  96.8 cm (38.1 in)       50.2 cm    Verified
08/15/2025  Maya Miller  10 mos       8.85 kg (19 lb 8.2 oz)   72.5 cm (28.5 in)       44.6 cm    Verified
02/20/2026  Leo Miller   3 yrs 9 mos  16.90 kg (37 lb 4.1 oz)  102.7 cm (40.4 in)      50.9 cm    Verified
07/11/2026  Maya Miller  21 mos       11.75 kg (25 lb 14.5 oz) 85.6 cm (33.7 in)       47.5 cm    Verified

Exported from Bayview Epic MyChart Patient Flowsheet v2026.3 | Verified Clinical Results`,
      rawRecords: [
        {
          childName: 'Maya',
          date: '2025-02-10',
          ageMonths: 4.0,
          weightKg: 6.42,
          heightCm: 63.2,
          headCm: 41.0,
          headCircumferenceCm: 41.0,
          rawLine: '02/10/2025 | Maya Miller | Age: 4 mos | Wt: 6.42 kg (14 lb 2.5 oz) | Ht: 63.2 cm | HC: 41.0 cm',
          notes: 'MyChart Vitals Flowsheet Verified',
          boundingBox: { x: 0.06, y: 0.35, w: 0.88, h: 0.08 }
        },
        {
          childName: 'Leo',
          date: '2025-05-18',
          ageMonths: 36.1,
          weightKg: 15.70,
          heightCm: 96.8,
          headCm: 50.2,
          headCircumferenceCm: 50.2,
          rawLine: '05/18/2025 | Leo Miller | Age: 3 yrs | Wt: 15.70 kg (34 lb 9.8 oz) | Ht: 96.8 cm | HC: 50.2 cm',
          notes: 'MyChart Well Child Exam Confirmed',
          boundingBox: { x: 0.06, y: 0.44, w: 0.88, h: 0.08 }
        },
        {
          childName: 'Maya',
          date: '2025-08-15',
          ageMonths: 10.1,
          weightKg: 8.85,
          heightCm: 72.5,
          headCm: 44.6,
          headCircumferenceCm: 44.6,
          rawLine: '08/15/2025 | Maya Miller | Age: 10 mos | Wt: 8.85 kg (19 lb 8.2 oz) | Ht: 72.5 cm | HC: 44.6 cm',
          notes: 'MyChart Pediatric Nurse Check',
          boundingBox: { x: 0.06, y: 0.53, w: 0.88, h: 0.08 }
        },
        {
          childName: 'Leo',
          date: '2026-02-20',
          ageMonths: 45.2,
          weightKg: 16.90,
          heightCm: 102.7,
          headCm: 50.9,
          headCircumferenceCm: 50.9,
          rawLine: '02/20/2026 | Leo Miller | Age: 3 yrs 9 mos | Wt: 16.90 kg (37 lb 4.1 oz) | Ht: 102.7 cm | HC: 50.9 cm',
          notes: 'MyChart Annual Follow-up Flowsheet',
          boundingBox: { x: 0.06, y: 0.62, w: 0.88, h: 0.08 }
        },
        {
          childName: 'Maya',
          date: '2026-07-11',
          ageMonths: 20.9,
          weightKg: 11.75,
          heightCm: 85.6,
          headCm: 47.5,
          headCircumferenceCm: 47.5,
          rawLine: '07/11/2026 | Maya Miller | Age: 21 mos | Wt: 11.75 kg (25 lb 14.5 oz) | Ht: 85.6 cm | HC: 47.5 cm',
          notes: 'MyChart Routine Pediatric Flowsheet',
          boundingBox: { x: 0.06, y: 0.71, w: 0.88, h: 0.08 }
        }
      ]
    },
    {
      id: 'camera-fridge-snapshot',
      title: 'Fridge Checkup Magnet Card (Camera Snapshot)',
      fileName: 'fridge_magnet_checkup_card.jpg',
      badge: 'Phone Camera Photo',
      category: 'Simulated Camera Capture',
      description:
        'Realistic phone camera capture of a pediatric reminder magnet card pinned to the family refrigerator, featuring recent checkup measurements for Leo and Maya with realistic camera lighting, slight perspective angle, and fridge magnet.',
      groundTruthText: `DR. ROSTOVA PEDIATRIC HEALTH CARD
REFRIGERATOR VISIT LOG & VACCINE SCHEDULE

CHILD: Leo Miller (DOB: 05/14/2022)
• 48 Mo Checkup (2026-05-14): Wt 17.40 kg (38 lb 5.8 oz) | Ht 105.8 cm (41.7 in) | HC: 51.0 cm
• 53.5 Mo Visit (2026-10-28): Wt 18.40 kg (40 lb 9.1 oz) | Ht 108.2 cm (42.6 in) | HC: 51.4 cm

CHILD: Maya Miller (DOB: 10/10/2024)
• 15 Mo Checkup (2026-01-10): Wt 10.25 kg (22 lb 9.5 oz) | Ht 79.0 cm (31.1 in) | HC: 46.4 cm
• 24 Mo Checkup (2026-10-10): Wt 12.20 kg (26 lb 14.3 oz) | Ht 87.5 cm (34.4 in) | HC: 48.0 cm

Call Bayview Pediatrics 24/7 Nurse Triage: (415) 555-0194`,
      rawRecords: [
        {
          childName: 'Leo',
          date: '2026-05-14',
          ageMonths: 48.0,
          weightKg: 17.40,
          heightCm: 105.8,
          headCm: 51.0,
          headCircumferenceCm: 51.0,
          rawLine: 'Leo Miller | 48 Mo Checkup (2026-05-14): Wt 17.40 kg | Ht 105.8 cm | HC 51.0 cm',
          notes: '4-Year preschool exam. Hops on one foot, fluent speech.',
          boundingBox: { x: 0.12, y: 0.32, w: 0.76, h: 0.11 }
        },
        {
          childName: 'Maya',
          date: '2026-01-10',
          ageMonths: 15.0,
          weightKg: 10.25,
          heightCm: 79.0,
          headCm: 46.4,
          headCircumferenceCm: 46.4,
          rawLine: 'Maya Miller | 15 Mo Checkup (2026-01-10): Wt 10.25 kg | Ht 79.0 cm | HC 46.4 cm',
          notes: '15-Month checkup. Walking independently, stacks blocks.',
          boundingBox: { x: 0.12, y: 0.45, w: 0.76, h: 0.11 }
        },
        {
          childName: 'Leo',
          date: '2026-10-28',
          ageMonths: 53.5,
          weightKg: 18.40,
          heightCm: 108.2,
          headCm: 51.4,
          headCircumferenceCm: 51.4,
          rawLine: 'Leo Miller | 53.5 Mo Visit (2026-10-28): Wt 18.40 kg | Ht 108.2 cm | HC 51.4 cm',
          notes: 'Autumn booster visit. Healthy growth along 68th percentile.',
          boundingBox: { x: 0.12, y: 0.58, w: 0.76, h: 0.11 }
        },
        {
          childName: 'Maya',
          date: '2026-10-10',
          ageMonths: 24.0,
          weightKg: 12.20,
          heightCm: 87.5,
          headCm: 48.0,
          headCircumferenceCm: 48.0,
          rawLine: 'Maya Miller | 24 Mo Checkup (2026-10-10): Wt 12.20 kg | Ht 87.5 cm | HC 48.0 cm',
          notes: '2-Year milestone visit! Two-word sentences, running and jumping.',
          boundingBox: { x: 0.12, y: 0.71, w: 0.76, h: 0.11 }
        }
      ]
    }
  ];

  /**
   * Return array of available sample template metadata
   */
  function getSampleTemplates() {
    return SampleTemplates.map(t => ({
      id: t.id,
      title: t.title,
      fileName: t.fileName,
      badge: t.badge,
      category: t.category,
      description: t.description,
      rowCount: t.rawRecords.length,
      groundTruthText: t.groundTruthText,
      rawRecords: t.rawRecords,
      preExtractedRecords: t.rawRecords,
      boundingBoxes: (t.rawRecords || []).map(r => r.boundingBox)
    }));
  }

  // =========================================================================
  // CANVAS RENDERING ENGINES FOR REALISTIC TEST IMAGES
  // =========================================================================

  function renderPediatricSummaryCanvas(canvas, template) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Background paper texture (crisp clinic white with faint warmth)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Subtle paper grain/grid
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Top primary header banner (Navy/Cyan)
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, '#0284C7');
    headerGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, 8);

    // Clinic Logo mark
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(60, 55, 24, 0, Math.PI * 2);
    ctx.fill();

    // Cross in logo
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(56, 41, 8, 28);
    ctx.fillRect(46, 51, 28, 8);

    // Clinic Title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('BAYVIEW PEDIATRICS & ADOLESCENT MEDICINE', 98, 50);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('3200 Pacific Heights Blvd, Suite 410, San Francisco, CA 94115 | Tel: (415) 555-0194', 98, 70);

    // Document Type Banner
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(35, 95, W - 70, 58);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(35, 95, W - 70, 58);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('ELECTRONIC HEALTH RECORD — COMBINED SIBLING GROWTH SUMMARY', 50, 120);

    ctx.fillStyle = '#475569';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Parents: Sarah & David Miller | Attending: Dr. Elena Rostova, MD, FAAP | Clinic ID: #BY-9402', 50, 140);

    // Sibling Patient Tags
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.roundRect(40, 165, 340, 48, 6);
    ctx.fill();
    ctx.strokeStyle = '#BAE6FD';
    ctx.stroke();

    ctx.fillStyle = '#0369A1';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('CHILD 1: Leo Miller (Male)', 52, 185);
    ctx.fillStyle = '#075985';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('DOB: 05/14/2022 | MRN: #BY-94021 | Blood: O+', 52, 202);

    ctx.fillStyle = '#FCE7F3';
    ctx.beginPath();
    ctx.roundRect(420, 165, 340, 48, 6);
    ctx.fill();
    ctx.strokeStyle = '#FBCFE8';
    ctx.stroke();

    ctx.fillStyle = '#BE185D';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('CHILD 2: Maya Miller (Female)', 432, 185);
    ctx.fillStyle = '#9D174D';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('DOB: 10/10/2024 | MRN: #BY-98514 | Blood: A+', 432, 202);

    // Section title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('GROWTH & ENCOUNTER FLOWSHEET', 40, 245);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Chronological multi-visit biometric recordings (Imperial & Metric values)', 40, 260);

    // Table Header
    const tableX = 35;
    const tableY = 275;
    const tableW = W - 70;
    const rowH = 75;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(tableX, tableY, tableW, 36);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('DATE', tableX + 15, tableY + 22);
    ctx.fillText('CHILD', tableX + 105, tableY + 22);
    ctx.fillText('VISIT / AGE', tableX + 185, tableY + 22);
    ctx.fillText('WEIGHT (LB & KG)', tableX + 285, tableY + 22);
    ctx.fillText('HEIGHT / LENGTH', tableX + 430, tableY + 22);
    ctx.fillText('HEAD CIRC', tableX + 560, tableY + 22);
    ctx.fillText('STATUS', tableX + 660, tableY + 22);

    // Table Rows
    const rows = template.rawRecords;
    rows.forEach((rec, idx) => {
      const curY = tableY + 36 + idx * rowH;

      // Row background
      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(tableX, curY, tableW, rowH);

      // Row border
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(tableX, curY, tableW, rowH);

      // Date
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(rec.date, tableX + 15, curY + 28);

      // Child badge
      const isLeo = rec.childName === 'Leo';
      ctx.fillStyle = isLeo ? '#E0F2FE' : '#FCE7F3';
      ctx.beginPath();
      ctx.roundRect(tableX + 100, curY + 12, 68, 22, 11);
      ctx.fill();
      ctx.fillStyle = isLeo ? '#0369A1' : '#BE185D';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(rec.childName, tableX + 115, curY + 27);

      // Visit/Age
      ctx.fillStyle = '#334155';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      const ageStr = `${rec.ageMonths.toFixed(1)} mo`;
      ctx.fillText(ageStr, tableX + 185, curY + 28);

      // Weight
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      const lbsOz = Units.kgToLbsOz(rec.weightKg);
      ctx.fillText(`${lbsOz.lbs} lb ${lbsOz.oz} oz`, tableX + 285, curY + 24);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(${rec.weightKg.toFixed(2)} kg)`, tableX + 285, curY + 40);

      // Height
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      const inVal = Units.cmToInches(rec.heightCm);
      ctx.fillText(`${rec.heightCm.toFixed(1)} cm`, tableX + 430, curY + 24);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(${inVal.toFixed(1)} in)`, tableX + 430, curY + 40);

      // Head Circ
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      if (rec.headCm) {
        ctx.fillText(`${rec.headCm.toFixed(1)} cm`, tableX + 560, curY + 24);
        ctx.fillStyle = '#64748B';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`(${Units.cmToInches(rec.headCm).toFixed(1)} in)`, tableX + 560, curY + 40);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('—', tableX + 560, curY + 28);
      }

      // Verified pill
      ctx.fillStyle = '#DCFCE7';
      ctx.beginPath();
      ctx.roundRect(tableX + 655, curY + 16, 62, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#15803D';
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.fillText('Verified', tableX + 668, curY + 30);

      // Clinical note line
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Note: ${rec.notes}`, tableX + 15, curY + 62);
    });

    // Verification Seal / Clinic Stamp
    ctx.save();
    ctx.translate(140, 880);
    ctx.rotate(-0.15);
    ctx.strokeStyle = 'rgba(185, 28, 28, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(185, 28, 28, 0.85)';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BAYVIEW PEDIATRICS', 0, -22);
    ctx.fillText('★ OFFICIAL HEALTH RECORD ★', 0, -8);
    ctx.fillText('VERIFIED CLINICAL DATA', 0, 6);
    ctx.fillText('DATE: 2026-08-14', 0, 20);
    ctx.restore();

    // Physician Signature
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Attending Pediatrician Signature:', 420, 860);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(420, 905);
    ctx.lineTo(720, 905);
    ctx.stroke();

    ctx.font = 'italic 20px "Brush Script MT", cursive, sans-serif';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('Dr. Elena Rostova, MD, FAAP', 440, 895);

    ctx.fillStyle = '#64748B';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('License: CA-MED-88412 | Board Certified Pediatrics', 420, 922);

    // Footer notice
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('CONFIDENTIAL HEALTHCARE RECORD — AUTHORIZED PATIENT & FAMILY ARCHIVE COPY', 35, 970);
  }

  function renderBabyBookCanvas(canvas, template) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Warm cream lined paper background
    ctx.fillStyle = '#FAF6EE';
    ctx.fillRect(0, 0, W, H);

    // Subtle paper texture speckles
    ctx.fillStyle = 'rgba(215, 200, 175, 0.12)';
    for (let i = 0; i < 400; i++) {
      const rx = (i * 97) % W;
      const ry = (i * 131) % H;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // Left pink margin line (notebook style)
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(85, 0);
    ctx.lineTo(85, H);
    ctx.stroke();

    // Horizontal notebook lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let y = 100; y < H - 40; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Doorframe ruler illustration on left margin
    ctx.fillStyle = '#D97706';
    ctx.fillRect(25, 120, 36, 750);
    ctx.strokeStyle = '#B45309';
    ctx.strokeRect(25, 120, 36, 750);

    ctx.fillStyle = '#78350F';
    ctx.font = 'bold 9px sans-serif';
    for (let hInch = 20; hInch <= 45; hInch += 5) {
      const markY = 850 - (hInch - 20) * 28;
      ctx.beginPath();
      ctx.moveTo(25, markY);
      ctx.lineTo(45, markY);
      ctx.stroke();
      ctx.fillText(`${hInch}"`, 48, markY + 3);
    }

    // Faux decorative washi tape at top corners
    ctx.save();
    ctx.translate(60, 35);
    ctx.rotate(-0.06);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.7)';
    ctx.fillRect(-40, -12, 120, 24);
    ctx.restore();

    ctx.save();
    ctx.translate(700, 40);
    ctx.rotate(0.08);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.fillRect(-50, -12, 120, 24);
    ctx.restore();

    // Handwritten Title
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 26px "Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive, sans-serif';
    ctx.fillText("Leo & Maya's Growth Memories & Doorframe Marks ♡", 110, 68);

    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 14px "Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif';
    ctx.fillText('Pencil tick marks from the pantry doorframe & pediatrician visit notes', 110, 92);

    // Entries
    const rows = template.rawRecords;
    const penColors = ['#1E3A8A', '#0F766E', '#831843', '#1E40AF', '#701A75'];

    rows.forEach((rec, idx) => {
      const box = rec.boundingBox;
      const startX = box.x * W;
      const startY = box.y * H;

      // Card-like soft highlight
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(254, 243, 199, 0.45)' : 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.roundRect(startX, startY, box.w * W, box.h * H, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
      ctx.stroke();

      // Pen ink text
      ctx.fillStyle = penColors[idx % penColors.length];
      ctx.font = 'bold 18px "Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif';

      const lbsOz = Units.kgToLbsOz(rec.weightKg);
      const inVal = Units.cmToInches(rec.heightCm);

      // Entry header with child icon
      const heart = rec.childName === 'Leo' ? '★' : '♥';
      ctx.fillText(`${heart} ${rec.childName} — ${rec.date} (${rec.notes})`, startX + 16, startY + 28);

      // Biometrics line
      ctx.font = '16px "Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif';
      let statsText = `Weight: ${lbsOz.lbs} lbs ${lbsOz.oz} oz (${rec.weightKg.toFixed(2)} kg)  |  Height: ${inVal.toFixed(1)} in (${rec.heightCm.toFixed(1)} cm)`;
      if (rec.headCm) {
        statsText += `  |  Head: ${rec.headCm.toFixed(1)} cm (${Units.cmToInches(rec.headCm).toFixed(1)} in)`;
      }
      ctx.fillText(statsText, startX + 16, startY + 54);

      // Memory note
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 14px "Caveat", "Segoe Print", "Bradley Hand", cursive, sans-serif';
      ctx.fillText(`“${rec.rawLine}”`, startX + 16, startY + 80);
    });

    // Coffee mug ring stain at bottom corner for realism!
    ctx.save();
    ctx.translate(680, 890);
    ctx.strokeStyle = 'rgba(180, 130, 80, 0.15)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Bottom note
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 14px "Caveat", "Segoe Print", cursive, sans-serif';
    ctx.fillText('Transcribed with love from our kitchen doorframe pencil marks.', 110, 940);
  }

  function renderPortalScreenshotCanvas(canvas, template) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Modern clinical EHR background (light slate)
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, W, H);

    // Browser/EHR Top Nav Bar (Navy `#1E3A8A`)
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(0, 0, W, 64);

    // Logo icon (Health Heart Pulse)
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(36, 32, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('♥ MyChart', 62, 37);

    ctx.fillStyle = '#93C5FD';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Bayview Health System Portal', 160, 37);

    // User profile pill
    ctx.fillStyle = '#172554';
    ctx.beginPath();
    ctx.roundRect(W - 220, 16, 195, 32, 16);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Sarah Miller (Family View)', W - 200, 36);

    // Subnav Tabs
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 64, W, 44);
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(0, 108);
    ctx.lineTo(W, 108);
    ctx.stroke();

    const tabs = ['Health Summary', 'Test Results', 'Growth Flowsheet', 'Medications', 'Visits'];
    tabs.forEach((tab, i) => {
      const tx = 35 + i * 140;
      const isActive = tab === 'Growth Flowsheet';
      if (isActive) {
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(tx - 5, 105, 125, 3);
        ctx.fillStyle = '#0284C7';
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = '13px system-ui, -apple-system, sans-serif';
      }
      ctx.fillText(tab, tx, 90);
    });

    // Content Card
    const cardX = 35;
    const cardY = 125;
    const cardW = W - 70;
    const cardH = 830;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card Header
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('Biometric & Growth Flowsheet (Combined Siblings)', cardX + 24, cardY + 36);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Patients: Maya Miller & Leo Miller | View: Chronological Flowsheet', cardX + 24, cardY + 58);

    // Filter Chips
    const chips = ['All Siblings (2)', 'Last 24 Months', 'Exported View', 'Verified EHR'];
    chips.forEach((c, idx) => {
      const cx = cardX + 24 + idx * 125;
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.roundRect(cx, cardY + 75, 115, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(c, cx + 12, cardY + 92);
    });

    // Flowsheet Table Header
    const tableTop = cardY + 120;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(cardX + 16, tableTop, cardW - 32, 38);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(cardX + 16, tableTop, cardW - 32, 38);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('ENCOUNTER DATE', cardX + 30, tableTop + 24);
    ctx.fillText('PATIENT', cardX + 160, tableTop + 24);
    ctx.fillText('AGE', cardX + 265, tableTop + 24);
    ctx.fillText('WEIGHT', cardX + 335, tableTop + 24);
    ctx.fillText('LENGTH / HEIGHT', cardX + 475, tableTop + 24);
    ctx.fillText('HEAD CIRC', cardX + 595, tableTop + 24);

    // Table rows
    const rows = template.rawRecords;
    const rowH = 88;

    rows.forEach((rec, idx) => {
      const curY = tableTop + 38 + idx * rowH;

      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      ctx.fillRect(cardX + 16, curY, cardW - 32, rowH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(cardX + 16, curY, cardW - 32, rowH);

      // Date
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(rec.date, cardX + 30, curY + 34);

      // Patient Name & Badge
      const isMaya = rec.childName === 'Maya';
      ctx.fillStyle = isMaya ? '#FCE7F3' : '#E0F2FE';
      ctx.beginPath();
      ctx.roundRect(cardX + 155, curY + 18, 92, 26, 13);
      ctx.fill();

      ctx.fillStyle = isMaya ? '#9D174D' : '#0369A1';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${rec.childName} Miller`, cardX + 166, curY + 35);

      // Age
      ctx.fillStyle = '#475569';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${rec.ageMonths.toFixed(1)} mo`, cardX + 265, curY + 34);

      // Weight
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${rec.weightKg.toFixed(2)} kg`, cardX + 335, curY + 30);
      const lbsOz = Units.kgToLbsOz(rec.weightKg);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(${lbsOz.lbs} lb ${lbsOz.oz} oz)`, cardX + 335, curY + 46);

      // Height
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${rec.heightCm.toFixed(1)} cm`, cardX + 475, curY + 30);
      const inVal = Units.cmToInches(rec.heightCm);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(${inVal.toFixed(1)} in)`, cardX + 475, curY + 46);

      // Head
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      if (rec.headCm) {
        ctx.fillText(`${rec.headCm.toFixed(1)} cm`, cardX + 595, curY + 30);
        ctx.fillStyle = '#64748B';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`(${Units.cmToInches(rec.headCm).toFixed(1)} in)`, cardX + 595, curY + 46);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('—', cardX + 595, curY + 34);
      }

      // Verified pill
      ctx.fillStyle = '#DEF7EC';
      ctx.beginPath();
      ctx.roundRect(cardX + 30, curY + 54, 85, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#03543F';
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.fillText('✓ Verified', cardX + 42, curY + 68);

      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Encounter notes: ${rec.notes}`, cardX + 130, curY + 68);
    });

    // Portal Footer
    ctx.fillStyle = '#64748B';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Epic MyChart Flowsheet Version 2026.3 | Bayview Health EHR', cardX + 24, cardY + cardH - 30);
    ctx.fillText('Protected Health Information (PHI) — For Parent Personal Health Record Only', cardX + 24, cardY + cardH - 14);
  }

  /**
   * Renders realistic phone-camera snapshot of refrigerator pediatric checkup magnet card
   */
  function renderCameraFridgeCanvas(canvas, template) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // 1. Refrigerator brushed stainless steel / pearl enamel background
    const fridgeGrad = ctx.createLinearGradient(0, 0, W, H);
    fridgeGrad.addColorStop(0, '#CBD5E1');
    fridgeGrad.addColorStop(0.3, '#E2E8F0');
    fridgeGrad.addColorStop(0.7, '#94A3B8');
    fridgeGrad.addColorStop(1, '#64748B');
    ctx.fillStyle = fridgeGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle brushed metal horizontal streaks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 4) {
      if ((y * 17) % 7 === 0) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    // 2. Realistic camera lens vignette / flash highlight
    const flashGrad = ctx.createRadialGradient(W * 0.45, H * 0.38, 50, W * 0.5, H * 0.5, W * 0.7);
    flashGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    flashGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    flashGrad.addColorStop(1, 'rgba(15, 23, 42, 0.45)');
    ctx.fillStyle = flashGrad;
    ctx.fillRect(0, 0, W, H);

    // 3. Card placement with slight perspective rotation & drop shadow
    ctx.save();
    ctx.translate(W * 0.5, H * 0.5);
    ctx.rotate(-0.018); // Natural slight camera tilt (~1 deg)
    ctx.translate(-W * 0.5, -H * 0.5);

    const cardX = 80;
    const cardY = 110;
    const cardW = 640;
    const cardH = 780;

    // Realistic soft drop shadow
    ctx.shadowColor = 'rgba(15, 23, 42, 0.38)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 16;

    // Card background: Clean clinical white laminated magnet card
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Card glossy laminate highlight
    const lamGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    lamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    lamGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.0)');
    lamGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = lamGrad;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.fill();

    // Card border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 14);
    ctx.stroke();

    // 4. Round red magnetic clip at top center holding the card to fridge
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    const magGrad = ctx.createRadialGradient(cardX + cardW / 2 - 8, cardY + 20, 4, cardX + cardW / 2, cardY + 28, 26);
    magGrad.addColorStop(0, '#EF4444');
    magGrad.addColorStop(0.7, '#B91C1C');
    magGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = magGrad;
    ctx.beginPath();
    ctx.arc(cardX + cardW / 2, cardY + 26, 22, 0, Math.PI * 2);
    ctx.fill();
    // Inner metallic ring of magnet
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cardX + cardW / 2, cardY + 26, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 5. Card Header
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BAYVIEW PEDIATRICS & ADOLESCENT CARE', cardX + cardW / 2, cardY + 75);

    ctx.fillStyle = '#C85A32';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('FAMILY REFRIGERATOR CHECKUP LOG & IMMUNIZATION REMINDER', cardX + cardW / 2, cardY + 98);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Attending: Dr. Elena Rostova, MD, FAAP | 24/7 Nurse Triage: (415) 555-0194', cardX + cardW / 2, cardY + 116);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 24, cardY + 128);
    ctx.lineTo(cardX + cardW - 24, cardY + 128);
    ctx.stroke();

    // 6. Child Sibling Tag Badges
    ctx.textAlign = 'left';

    // 7. Render 4 Measurement Sections corresponding to rawRecords
    const records = template.rawRecords || [];
    records.forEach((rec, idx) => {
      const box = rec.boundingBox;
      const bX = box.x * W;
      const bY = box.y * H;
      const bW = box.w * W;
      const bH = box.h * H;

      const isLeo = rec.childName === 'Leo';
      const accentColor = isLeo ? '#C85A32' : '#2E6F5E';
      const bgColor = isLeo ? 'rgba(200, 90, 50, 0.07)' : 'rgba(46, 111, 94, 0.07)';
      const borderColor = isLeo ? 'rgba(200, 90, 50, 0.28)' : 'rgba(46, 111, 94, 0.28)';

      // Row Card
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(bX, bY, bW, bH, 8);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Child tag
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(bX + 12, bY + 12, 70, 22, 11);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(rec.childName, bX + 26, bY + 27);

      // Visit & Date
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(rec.date, bX + 92, bY + 27);

      ctx.fillStyle = '#64748B';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`(${rec.ageMonths.toFixed(1)} mo checkup)`, bX + 180, bY + 27);

      // Biometrics
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      const lbsOz = Units.kgToLbsOz(rec.weightKg);
      const inVal = Units.cmToInches(rec.heightCm);
      const biometrics = `Wt: ${rec.weightKg.toFixed(2)} kg (${lbsOz.lbs} lb ${lbsOz.oz} oz)   •   Ht: ${rec.heightCm.toFixed(1)} cm (${inVal.toFixed(1)} in)   •   HC: ${rec.headCm.toFixed(1)} cm`;
      ctx.fillText(biometrics, bX + 14, bY + 54);

      // Notes
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`“${rec.notes}”`, bX + 14, bY + 76);
    });

    // 8. Card Footer with Nurse Hotline & Magnet attestation
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bayview Pediatrics 24/7 Patient Advice Hotline: (415) 555-0194', cardX + cardW / 2, cardY + cardH - 35);
    ctx.fillStyle = '#64748B';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText('Please bring this card or present KinSprout digital record to next scheduled well-child visit', cardX + cardW / 2, cardY + cardH - 18);

    ctx.restore(); // Restore perspective rotation
  }

  /**
   * Helper that simulates a camera capture sample of refrigerator card
   */
  function renderCameraCaptureSample(familyState) {
    return renderSampleImageToDataURL('camera-fridge-snapshot');
  }

  /**
   * Dynamically renders the selected sample document onto an HTML5 canvas and returns
   * { templateId, title, description, fileName, dataUrl, groundTruthText, boundingBoxes, preExtractedRecords }
   */
  function renderSampleImageToDataURL(templateId) {
    const template = SampleTemplates.find(t => t.id === templateId) || SampleTemplates[0];

    // Create offscreen canvas (or DOM canvas if document is available)
    let canvas;
    if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
    } else {
      // In non-browser / headless mock environments
      const mockResult = {
        templateId: template.id,
        title: template.title,
        description: template.description,
        fileName: template.fileName,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        groundTruthText: template.groundTruthText,
        boundingBoxes: template.rawRecords.map(r => r.boundingBox),
        preExtractedRecords: template.rawRecords,
        toString: function () {
          return this.dataUrl;
        }
      };
      return mockResult;
    }

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    if (template.id === 'pediatric-summary') {
      renderPediatricSummaryCanvas(canvas, template);
    } else if (template.id === 'baby-book-handwritten') {
      renderBabyBookCanvas(canvas, template);
    } else if (template.id === 'camera-fridge-snapshot') {
      renderCameraFridgeCanvas(canvas, template);
    } else {
      renderPortalScreenshotCanvas(canvas, template);
    }

    const dataUrl = canvas.toDataURL('image/png');

    return {
      templateId: template.id,
      title: template.title,
      description: template.description,
      fileName: template.fileName,
      dataUrl: dataUrl,
      groundTruthText: template.groundTruthText,
      boundingBoxes: template.rawRecords.map(r => r.boundingBox),
      preExtractedRecords: template.rawRecords,
      toString: function () {
        return this.dataUrl;
      }
    };
  }

  // =========================================================================
  // 3. SMART MEDICAL NATURAL LANGUAGE & TABLE PARSER
  // =========================================================================

  /**
   * Matches text against child names in familyState or falls back to smart age inference
   */
  function matchChildProfile(textLine, eventDate, measurements, familyState) {
    const children = (familyState && familyState.children && familyState.children.length > 0)
      ? familyState.children
      : DEFAULT_CHILDREN;

    const lower = (textLine || '').toLowerCase();

    // 1. Direct name matching
    for (const child of children) {
      const cName = (child.name || '').toLowerCase();
      if (cName.length >= 2) {
        const regex = new RegExp(`\\b${cName}\\b`, 'i');
        if (regex.test(lower)) {
          return { child, detectedName: child.name, confidence: 0.98 };
        }
      }
    }

    // 2. Gender / nickname hints
    if (/\b(boy|son|brother|he|his)\b/i.test(lower)) {
      const boy = children.find(c => (c.gender || '').toLowerCase().startsWith('m'));
      if (boy) return { child: boy, detectedName: boy.name, confidence: 0.85 };
    }
    if (/\b(girl|daughter|sister|she|her)\b/i.test(lower)) {
      const girl = children.find(c => (c.gender || '').toLowerCase().startsWith('f'));
      if (girl) return { child: girl, detectedName: girl.name, confidence: 0.85 };
    }

    // 3. Age & Biometric plausibility matching based on eventDate
    if (eventDate) {
      let bestChild = children[0];
      let bestScore = -9999;

      for (const child of children) {
        const ageMo = calculateAgeInMonths(child.birthDate, eventDate);
        if (ageMo >= 0) {
          let score = 10;
          // Check height plausibility
          if (measurements.heightCm) {
            const expH = calculatePercentile(child.gender, ageMo, 'height', measurements.heightCm);
            if (expH && expH >= 2 && expH <= 98) score += 30;
          }
          // Check weight plausibility
          if (measurements.weightKg) {
            const expW = calculatePercentile(child.gender, ageMo, 'weight', measurements.weightKg);
            if (expW && expW >= 2 && expW <= 98) score += 30;
          }
          if (score > bestScore) {
            bestScore = score;
            bestChild = child;
          }
        }
      }
      return { child: bestChild, detectedName: bestChild.name, confidence: 0.75 };
    }

    // Default to first child
    const fallbackChild = children[0] || DEFAULT_CHILDREN[0];
    return { child: fallbackChild, detectedName: fallbackChild.name, confidence: 0.6 };
  }

  /**
   * Parse messy date strings, relative ages, or natural language dates
   */
  function extractDateAndRelativeAge(lineText, childBirthDate) {
    let detectedDate = '';
    let relativeMonths = null;

    // Pattern 1: ISO YYYY-MM-DD
    const isoMatch = lineText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) {
      detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Pattern 2: US Format MM/DD/YYYY or MM/DD/YY
    if (!detectedDate) {
      const usMatch = lineText.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2}|\d{2})\b/);
      if (usMatch) {
        let yr = usMatch[3];
        if (yr.length === 2) yr = '20' + yr;
        const mo = String(usMatch[1]).padStart(2, '0');
        const da = String(usMatch[2]).padStart(2, '0');
        detectedDate = `${yr}-${mo}-${da}`;
      }
    }

    // Pattern 3: Month Name DD, YYYY (e.g. August 14, 2026 or 14-Aug-2026)
    if (!detectedDate) {
      const monthNames = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
      const mMatch = lineText.match(new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`, 'i'));
      if (mMatch) {
        const mStr = mMatch[1].toLowerCase().slice(0, 3);
        const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        const mo = monthMap[mStr] || '01';
        const da = String(mMatch[2]).padStart(2, '0');
        detectedDate = `${mMatch[3]}-${mo}-${da}`;
      }
    }

    // Pattern 4: Relative Age Expressions (e.g. "Maya 8m checkup", "6 mos", "18 months", "3 yrs", "Birth")
    const relMonthMatch = lineText.match(/\b(\d+(?:\.\d+)?)\s*(?:m|mos?|months?)\b/i);
    if (relMonthMatch) {
      relativeMonths = parseFloat(relMonthMatch[1]);
    } else {
      const relYearMatch = lineText.match(/\b(\d+(?:\.\d+)?)\s*(?:y|yrs?|years?)\b/i);
      if (relYearMatch) {
        relativeMonths = parseFloat(relYearMatch[1]) * 12;
      } else if (/\b(birth|newborn)\b/i.test(lineText)) {
        relativeMonths = 0;
      }
    }

    // If explicit date was not found, but relative age and childBirthDate exist, calculate date
    if (!detectedDate && relativeMonths !== null && childBirthDate) {
      const bDate = new Date(childBirthDate);
      if (!isNaN(bDate.getTime())) {
        const estDate = new Date(bDate.getTime() + relativeMonths * 30.4375 * 24 * 60 * 60 * 1000);
        detectedDate = formatDateISO(estDate);
      }
    }

    return { detectedDate, relativeMonths };
  }

  /**
   * Parse weights in lbs, lbs/oz, kg, or grams
   */
  function extractWeightKg(text) {
    // 1. Explicit kg with optional parentheses or labels: "15.65 kg", "wt: 17.85kg", "(15.70 kg)"
    const kgMatch = text.match(/(?:wt|weight)?[:\s]*(\d+(?:\.\d+)?)\s*kgs?\b/i);
    if (kgMatch) {
      return Math.round(parseFloat(kgMatch[1]) * 100) / 100;
    }

    // 2. Pounds and ounces: "34 lb 8 oz", "18 lbs 6 oz", "31 lbs 4 oz", "14# 2oz", OCR "28 Ib 4 oz"
    const lbsOzMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|#|[1I|]bs?|[1I|]b)\s*(\d+(?:\.\d+)?)\s*(?:oz|ounces?)/i);
    if (lbsOzMatch) {
      return Units.lbsOzToKg(lbsOzMatch[1], lbsOzMatch[2]);
    }

    // 3. Decimal pounds: "35.1 lbs", "31.25 lb", "22.8 lbs"
    const decLbsMatch = text.match(/(?:wt|weight)?[:\s]*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|[1I|]bs?|[1I|]b)\b/i);
    if (decLbsMatch) {
      return Math.round(parseFloat(decLbsMatch[1]) * 0.45359237 * 100) / 100;
    }

    // 4. Grams: "3450 g", "3200 grams"
    const gramsMatch = text.match(/(?:wt|weight)?[:\s]*(\d{3,5})\s*(?:g|grams?|gm)\b/i);
    if (gramsMatch) {
      return Units.gramsToKg(gramsMatch[1]);
    }

    return null;
  }

  /**
   * Parse heights in cm, inches, or feet & inches
   */
  function extractHeightCm(text) {
    if (!text || typeof text !== 'string') return null;

    // 1. Remove Head Circumference tokens to prevent accidental capture of HC as height
    let cleanText = text.replace(/(?:hc|head(?:\s*circ(?:umference)?)?)[:\s]*\d+(?:\.\d+)?\s*(?:cms?|centimeters?|in|inches|"|'')?\b/gi, ' ');

    // 2. Remove Weight tokens so numbers like 34 lb or 15 kg aren't confused
    cleanText = cleanText.replace(/(?:wt|weight)?[:\s]*\d+(?:\.\d+)?\s*(?:lbs?|pounds?|#|[1I|]bs?|[1I|]b|kgs?|kilograms?|g|grams?)\b/gi, ' ');
    cleanText = cleanText.replace(/\d+(?:\.\d+)?\s*(?:lbs?|#|[1I|]bs?|[1I|]b)\s*\d+(?:\.\d+)?\s*oz\b/gi, ' ');

    // 3. Feet and inches: "3 ft 2.5 in", "3' 2.5\"", "2 ft 10 in"
    const ftInMatch = cleanText.match(/(\d+)\s*(?:ft|feet|')\s*(\d+(?:\.\d+)?)\s*(?:in|inches|")?/i);
    if (ftInMatch) {
      return Units.ftInToCm(ftInMatch[1], ftInMatch[2]);
    }

    // 4. Explicit height/length label with cm: "ht: 106.4 cm", "height: 96.5 cm", "length 66.8 cm"
    const explicitCmMatch = cleanText.match(/(?:ht|height|length|len)[:\s]+(\d+(?:\.\d+)?)\s*cms?\b/i);
    if (explicitCmMatch) {
      return Math.round(parseFloat(explicitCmMatch[1]) * 10) / 10;
    }

    // 5. Explicit height/length label with inches: "ht: 38.0 in", "height: 27.8 inches", "length 26.3\""
    const explicitInMatch = cleanText.match(/(?:ht|height|length|len)[:\s]+(\d+(?:\.\d+)?)\s*(?:in|inches|")\b/i);
    if (explicitInMatch) {
      return Units.inchesToCm(explicitInMatch[1]);
    }

    // 6. Generic inches: "27.8 inches", "38.0 in", "34.8\"", "34.6 inches tall"
    const inMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*(?:in|inches|")(?:\s*tall)?\b/i);
    if (inMatch) {
      return Units.inchesToCm(inMatch[1]);
    }

    // 7. Generic centimeters: "106.4 cm", "96.5 cm", "100.5 cm"
    const cmMatch = cleanText.match(/(\d+(?:\.\d+)?)\s*cms?\b/i);
    if (cmMatch) {
      return Math.round(parseFloat(cmMatch[1]) * 10) / 10;
    }

    return null;
  }

  /**
   * Parse head circumference in cm or inches
   */
  function extractHeadCircumferenceCm(text) {
    // 1. Explicit HC with cm: "HC: 50.1 cm", "head circ 41.2 cm", "HC 49.8 cm", "head 44.1 cm"
    const hcCmMatch = text.match(/(?:hc|head(?:\s*circ(?:umference)?)?)[:\s]*(\d+(?:\.\d+)?)\s*cms?\b/i);
    if (hcCmMatch) {
      return Math.round(parseFloat(hcCmMatch[1]) * 10) / 10;
    }

    // 2. Explicit HC with inches: "HC: 19.7 in", "head 18.5 in"
    const hcInMatch = text.match(/(?:hc|head(?:\s*circ(?:umference)?)?)[:\s]*(\d+(?:\.\d+)?)\s*(?:in|inches|")\b/i);
    if (hcInMatch) {
      return Units.inchesToCm(hcInMatch[1]);
    }

    return null;
  }

  /**
   * Parse raw OCR text, copied portal text, CSV table, or parent notes into structured staging records
   */
  function parseRawTextToRecords(rawText, familyState, sourceImageName = 'Pasted / OCR Text') {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const stagedRecords = [];
    let currentChildContext = null;

    lines.forEach((line, lineIdx) => {
      // Skip header lines or pure dividers
      if (/^(date|patient|sibling|table|growth|encounter|bayview|mychart|---|=)/i.test(line) && !/\d{2,}/.test(line)) {
        // Check if header introduces a child context
        if (/\b(leo)\b/i.test(line)) currentChildContext = 'Leo';
        if (/\b(maya)\b/i.test(line)) currentChildContext = 'Maya';
        return;
      }

      // Check measurements on the line
      const weightKg = extractWeightKg(line);
      const heightCm = extractHeightCm(line);
      const headCm = extractHeadCircumferenceCm(line);

      // If no biometrics on this line, skip
      if (weightKg === null && heightCm === null && headCm === null) {
        return;
      }

      // Child matching
      const childMatch = matchChildProfile(
        currentChildContext ? `${currentChildContext} ${line}` : line,
        null,
        { weightKg, heightCm, headCm },
        familyState
      );

      const child = childMatch.child;
      const detectedChildName = childMatch.detectedName;

      // Date matching
      const { detectedDate, relativeMonths } = extractDateAndRelativeAge(line, child.birthDate);
      const finalDate = detectedDate || formatDateISO(new Date());

      // Age calculation
      const ageMonths = relativeMonths !== null && !detectedDate
        ? relativeMonths
        : calculateAgeInMonths(child.birthDate, finalDate);

      // Generate normalized bounding box estimate along vertical height of document
      const normalizedY = Math.max(0.08, Math.min(0.9, (lineIdx + 1) / Math.max(lines.length + 2, 10)));
      const boundingBox = {
        x: 0.05,
        y: Math.round(normalizedY * 1000) / 1000,
        w: 0.90,
        h: 0.08
      };

      const record = {
        id: 'stage-' + Math.random().toString(36).slice(2, 9),
        sourceImageName: sourceImageName,
        sourceDataUrl: '',
        childId: child.id || 'child-1',
        detectedChildName: detectedChildName,
        date: finalDate,
        ageMonths: Math.round(ageMonths * 10) / 10,
        weightKg: weightKg,
        heightCm: heightCm,
        headCm: headCm,
        headCircumferenceCm: headCm,
        rawLine: line,
        rawText: line,
        confidence: Math.round(childMatch.confidence * 100) / 100,
        status: 'valid',
        warnings: [],
        selected: true,
        notes: 'Extracted via Picture Bulk Import',
        boundingBox: boundingBox
      };

      stagedRecords.push(record);
    });

    return validateStagingRecords(stagedRecords, familyState);
  }

  // =========================================================================
  // 4. VALIDATION & ANOMALY DETECTION
  // =========================================================================

  /**
   * Recomputes percentiles, checks for extreme outliers, height shrinkage, and duplicates
   */
  function validateStagingRecords(records, familyState) {
    if (!Array.isArray(records)) return [];

    const children = (familyState && familyState.children && familyState.children.length > 0)
      ? familyState.children
      : DEFAULT_CHILDREN;

    const childMap = new Map();
    children.forEach(c => childMap.set(c.id, c));
    children.forEach(c => childMap.set(c.name.toLowerCase(), c));

    // Group records by child for temporal consistency checks (e.g., height shrinkage)
    const recordsByChild = {};

    return records.map(record => {
      const enriched = { ...record };
      enriched.warnings = Array.isArray(enriched.warnings) ? [...enriched.warnings] : [];

      // Find child profile
      let child = childMap.get(enriched.childId) || childMap.get((enriched.detectedChildName || '').toLowerCase());
      if (!child) {
        child = children[0] || DEFAULT_CHILDREN[0];
        enriched.childId = child.id;
        enriched.detectedChildName = child.name;
      }

      // Recompute ageMonths from child.birthDate and record.date
      if (child.birthDate && enriched.date) {
        enriched.ageMonths = calculateAgeInMonths(child.birthDate, enriched.date);
      }

      // Ensure headCm & headCircumferenceCm are mutually synced
      if (enriched.headCm === undefined || enriched.headCm === null) {
        enriched.headCm = (enriched.headCircumferenceCm !== undefined) ? enriched.headCircumferenceCm : null;
      }
      if (enriched.headCircumferenceCm === undefined || enriched.headCircumferenceCm === null) {
        enriched.headCircumferenceCm = (enriched.headCm !== undefined) ? enriched.headCm : null;
      }

      // Ensure rawText & rawLine are both present
      if (!enriched.rawText && enriched.rawLine) enriched.rawText = enriched.rawLine;
      if (!enriched.rawLine && enriched.rawText) enriched.rawLine = enriched.rawText;

      // Ensure boundingBox exists
      if (!enriched.boundingBox) {
        enriched.boundingBox = { x: 0.05, y: 0.35, w: 0.90, h: 0.08 };
      }

      // Calculate WHO/CDC Percentiles
      enriched.weightPct = calculatePercentile(child.gender, enriched.ageMonths, 'weight', enriched.weightKg);
      enriched.heightPct = calculatePercentile(child.gender, enriched.ageMonths, 'height', enriched.heightCm);
      enriched.headPct = calculatePercentile(child.gender, enriched.ageMonths, 'head', enriched.headCm);

      // Warning 1: Extreme Outliers (< 0.5th %ile or > 99.5th %ile)
      if (enriched.weightPct !== null && (enriched.weightPct < 0.5 || enriched.weightPct > 99.5)) {
        enriched.warnings.push(`Weight (${enriched.weightKg} kg / ${enriched.weightPct}%ile) is an extreme outlier — verify unit (lb vs kg)`);
      }
      if (enriched.heightPct !== null && (enriched.heightPct < 0.5 || enriched.heightPct > 99.5)) {
        enriched.warnings.push(`Height (${enriched.heightCm} cm / ${enriched.heightPct}%ile) is an extreme outlier — verify unit`);
      }
      if (enriched.headPct !== null && (enriched.headPct < 0.5 || enriched.headPct > 99.5)) {
        enriched.warnings.push(`Head circumference (${enriched.headCm} cm / ${enriched.headPct}%ile) is an extreme outlier`);
      }

      // Warning 2: Duplicate check against existing familyState records
      let isDuplicate = false;
      if (Array.isArray(child.measurements)) {
        const existingSameDate = child.measurements.find(m => m.date === enriched.date);
        if (existingSameDate) {
          isDuplicate = true;
          enriched.warnings.push(`A measurement for ${child.name} on ${enriched.date} already exists in records (will update)`);
        }
      }

      // Warning 3: Height Shrinkage Check
      if (!recordsByChild[enriched.childId]) {
        recordsByChild[enriched.childId] = [];
      }
      const existingHistory = [
        ...(Array.isArray(child.measurements) ? child.measurements : []),
        ...recordsByChild[enriched.childId]
      ].filter(m => m.heightCm && m.date);

      existingHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

      for (const hist of existingHistory) {
        if (new Date(hist.date) < new Date(enriched.date) && enriched.heightCm && hist.heightCm) {
          if (enriched.heightCm < hist.heightCm - 0.5) {
            enriched.warnings.push(`Height (${enriched.heightCm} cm) is lower than previous recorded height (${hist.heightCm} cm on ${hist.date})`);
            break;
          }
        }
      }
      recordsByChild[enriched.childId].push(enriched);

      // Status determination
      if (isDuplicate) {
        enriched.status = 'duplicate';
      } else if (enriched.warnings.length > 0) {
        enriched.status = 'warning';
      } else {
        enriched.status = 'valid';
      }

      return enriched;
    });
  }

  // =========================================================================
  // 2. REAL IMAGE OCR + BACKEND API + SMART HEURISTIC PARSER
  // =========================================================================

  /**
   * Helper to convert File / Blob to DataURL
   */
  function readFileAsDataURL(fileOrBlob) {
    return new Promise((resolve, reject) => {
      if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
        return resolve(fileOrBlob);
      }
      if (!fileOrBlob || !(fileOrBlob instanceof Blob)) {
        return resolve('');
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = err => reject(err);
      reader.readAsDataURL(fileOrBlob);
    });
  }

  /**
   * Lazily loads self-hosted Tesseract.js script from /vendor/tesseract/tesseract.min.js
   * @returns {Promise<Object>} window.Tesseract instance
   */
  let tesseractLoadPromise = null;
  function ensureTesseractLoaded() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Tesseract client OCR requires browser window'));
    }
    if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
      return Promise.resolve(window.Tesseract);
    }
    if (tesseractLoadPromise) return tesseractLoadPromise;

    tesseractLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="tesseract.min.js"]');
      if (existingScript) {
        if (window.Tesseract) return resolve(window.Tesseract);
        existingScript.addEventListener('load', () => resolve(window.Tesseract));
        existingScript.addEventListener('error', () => reject(new Error('Failed to load tesseract.min.js')));
        return;
      }
      const script = document.createElement('script');
      script.src = (typeof window !== 'undefined' && window.location) ? new URL('./vendor/tesseract/tesseract.min.js', window.location.href).href : './vendor/tesseract/tesseract.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          reject(new Error('window.Tesseract not found after script load'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load /vendor/tesseract/tesseract.min.js'));
      };
      (document.head || document.body || document.documentElement).appendChild(script);
    });

    return tesseractLoadPromise;
  }

  /**
   * Main entry point for processing uploaded images or sample templates.
   *
   * @param {Array<string|File|Blob|Object>} filesOrTemplates
   * @param {Object} familyState
   * @param {Function} onProgress - Callback: ({ step, percent, message, fileName, currentItem, totalItems })
   * @returns {Promise<Array<StagingRecord>>}
   */
  async function processImages(filesOrTemplates, familyState, onProgress) {
    const items = Array.isArray(filesOrTemplates)
      ? filesOrTemplates
      : (filesOrTemplates && typeof filesOrTemplates.length === 'number'
          ? Array.from(filesOrTemplates)
          : [filesOrTemplates]);
    const allStagingRecords = [];
    const totalItems = items.length;
    const rawTextParts = [];
    let hadOcrFailure = false;
    let anyReadableText = false;
    let anyImageProcessed = false;

    const notify = (step, percent, message, fileName, currentIdx) => {
      if (typeof onProgress === 'function') {
        onProgress({
          step,
          percent,
          message,
          fileName: fileName || 'Document',
          currentItem: currentIdx + 1,
          totalItems
        });
      }
    };

    for (let idx = 0; idx < totalItems; idx++) {
      const item = items[idx];
      let fileName = 'document.png';
      let dataUrl = '';
      let isSampleTemplate = false;
      let sampleData = null;

      // 1. Detect if this is a sample template ID or object
      if (typeof item === 'string' && SampleTemplates.some(t => t.id === item)) {
        isSampleTemplate = true;
        sampleData = renderSampleImageToDataURL(item);
        fileName = sampleData.fileName;
        dataUrl = sampleData.dataUrl;
        if (sampleData.groundTruthText) rawTextParts.push(sampleData.groundTruthText);
      } else if (item && item.templateId && SampleTemplates.some(t => t.id === item.templateId)) {
        isSampleTemplate = true;
        sampleData = renderSampleImageToDataURL(item.templateId);
        fileName = sampleData.fileName;
        dataUrl = sampleData.dataUrl;
        if (sampleData.groundTruthText) rawTextParts.push(sampleData.groundTruthText);
      } else if (item && item.dataUrl && item.groundTruthText) {
        // Pre-rendered sample
        isSampleTemplate = true;
        sampleData = item;
        fileName = item.fileName || 'sample.png';
        dataUrl = item.dataUrl;
        if (item.groundTruthText) rawTextParts.push(item.groundTruthText);
      } else if (item instanceof Blob || (typeof File !== 'undefined' && item instanceof File)) {
        fileName = item.name || 'uploaded_image.png';
        dataUrl = await readFileAsDataURL(item);
      } else if (item && item.dataUrl) {
        fileName = item.fileName || 'uploaded_image.png';
        dataUrl = item.dataUrl;
      }

      // Step 1: Preprocessing & Contrast (25%)
      notify(1, 25, 'Preprocessing image & enhancing contrast...', fileName, idx);
      await new Promise(r => setTimeout(r, 60));

      // Step 2: Scanning layout & OCR / Vision Extraction (60%)
      notify(2, 60, 'Scanning document layout & running text/vision extraction...', fileName, idx);
      let extractedRecords = [];

      if (isSampleTemplate && sampleData) {
        // High-precision ground truth records for realistic templates
        const children = (familyState && familyState.children && familyState.children.length > 0)
          ? familyState.children
          : DEFAULT_CHILDREN;

        extractedRecords = sampleData.preExtractedRecords.map(raw => {
          const matched = children.find(c => c.name.toLowerCase() === raw.childName.toLowerCase()) || children[0];
          const hcVal = raw.headCm !== undefined && raw.headCm !== null ? raw.headCm : (raw.headCircumferenceCm !== undefined ? raw.headCircumferenceCm : null);
          return {
            id: 'stage-' + Math.random().toString(36).slice(2, 9),
            sourceImageName: fileName,
            sourceDataUrl: dataUrl,
            childId: matched.id,
            detectedChildName: matched.name,
            date: raw.date,
            ageMonths: raw.ageMonths,
            weightKg: raw.weightKg,
            heightCm: raw.heightCm,
            headCm: hcVal,
            headCircumferenceCm: hcVal,
            rawLine: raw.rawLine || raw.rawText || '',
            rawText: raw.rawText || raw.rawLine || '',
            confidence: 0.98,
            status: 'valid',
            warnings: [],
            selected: true,
            notes: raw.notes || 'Extracted from ' + sampleData.title,
            boundingBox: raw.boundingBox
          };
        });
      } else {
        anyImageProcessed = true;
        let ocrText = '';
        let ocrLines = [];
        let naturalWidth = 1000;
        let naturalHeight = 1000;

        // Obtain natural image dimensions for normalized bounding boxes
        if (typeof Image !== 'undefined' && dataUrl) {
          try {
            await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                naturalWidth = img.naturalWidth || img.width || 1000;
                naturalHeight = img.naturalHeight || img.height || 1000;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = dataUrl;
            });
          } catch (e) {
            // Ignore dimension fetch failure
          }
        }

        // Real Client-Side OCR with self-hosted Tesseract.js
        let tessWorker = null;
        try {
          const Tesseract = await ensureTesseractLoaded();
          const tessBase = (typeof window !== 'undefined' && window.location) ? new URL('./vendor/tesseract', window.location.href).href.replace(/\/+$/, '') : './vendor/tesseract';
          tessWorker = await Tesseract.createWorker('eng', 1, {
            workerPath: `${tessBase}/worker.min.js`,
            corePath: tessBase,
            langPath: `${tessBase}/lang`,
            logger: (m) => {
              if (m && m.status && typeof onProgress === 'function') {
                const subPct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : 0;
                const overallPct = 30 + Math.round((subPct * 0.5));
                notify(2, overallPct, `OCR: ${m.status} (${subPct}%)`, fileName, idx);
              }
            }
          });

          const ocrResult = await tessWorker.recognize(dataUrl);
          if (ocrResult && ocrResult.data) {
            ocrText = (ocrResult.data.text || '').trim();
            if (Array.isArray(ocrResult.data.lines)) {
              ocrLines = ocrResult.data.lines;
            }
          }
        } catch (ocrErr) {
          console.warn('[PhotoImport] Tesseract client OCR error:', ocrErr);
          hadOcrFailure = true;
        } finally {
          if (tessWorker) {
            try {
              await tessWorker.terminate();
            } catch (tTermErr) {
              // Ignore termination error
            }
          }
        }

        // Parse OCR text into structured records
        if (ocrText) {
          anyReadableText = true;
          rawTextParts.push(ocrText);

          // Primary: Rich client-side parser with child profiles and unit handling
          extractedRecords = parseRawTextToRecords(ocrText, familyState, fileName);
          extractedRecords.forEach(r => (r.sourceDataUrl = dataUrl));

          // Secondary: If local parser found no biometric records, try backend /api/extract-photo
          if (extractedRecords.length === 0) {
            try {
              if (typeof fetch === 'function') {
                const syncBase = (typeof window !== 'undefined' && window.SyncManager && typeof window.SyncManager.getSyncEndpoint === 'function' && window.SyncManager.getSyncEndpoint()) || (typeof window !== 'undefined' && window.location ? new URL('./', window.location.href).href.replace(/\/+$/, '') : '');
                const res = await fetch(`${syncBase}/api/extract-photo`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fileName: fileName,
                    imageBase64: dataUrl,
                    OCRText: ocrText
                  })
                });
                if (res.ok) {
                  const resData = await res.json();
                  if (Array.isArray(resData.records) && resData.records.length > 0) {
                    extractedRecords = resData.records.map(r => ({
                      ...r,
                      sourceImageName: fileName,
                      sourceDataUrl: dataUrl
                    }));
                  }
                }
              }
            } catch (apiErr) {
              // Fall through
            }
          }

          // Attach accurate normalized bounding boxes from Tesseract lines where lines match
          if (ocrLines.length > 0 && extractedRecords.length > 0) {
            extractedRecords.forEach((record, recIdx) => {
              const recLineText = (record.rawLine || record.rawText || '').trim().toLowerCase();
              let matchedLine = null;

              if (recLineText) {
                matchedLine = ocrLines.find(ol => {
                  const t = (ol.text || '').trim().toLowerCase();
                  return t.includes(recLineText) || recLineText.includes(t);
                });
              }

              if (!matchedLine && ocrLines[recIdx]) {
                matchedLine = ocrLines[recIdx];
              }

              if (matchedLine && matchedLine.bbox && naturalWidth > 0 && naturalHeight > 0) {
                const bx0 = matchedLine.bbox.x0;
                const by0 = matchedLine.bbox.y0;
                const bx1 = matchedLine.bbox.x1;
                const by1 = matchedLine.bbox.y1;
                record.boundingBox = {
                  x: Math.round(Math.max(0, Math.min(1, bx0 / naturalWidth)) * 1000) / 1000,
                  y: Math.round(Math.max(0, Math.min(1, by0 / naturalHeight)) * 1000) / 1000,
                  w: Math.round(Math.max(0.02, Math.min(1, (bx1 - bx0) / naturalWidth)) * 1000) / 1000,
                  h: Math.round(Math.max(0.02, Math.min(1, (by1 - by0) / naturalHeight)) * 1000) / 1000
                };
                if (typeof matchedLine.confidence === 'number') {
                  record.ocrConfidence = Math.round(matchedLine.confidence) / 100;
                }
              }
            });
          }
        }
      }

      // Step 3: Parse biometric units and dates (90%)
      notify(3, 90, 'Parsing biometric units, dates, and matching child profiles...', fileName, idx);
      await new Promise(r => setTimeout(r, 60));

      // Step 4: Validation complete (100%)
      notify(4, 100, 'Validation complete', fileName, idx);

      const validated = validateStagingRecords(extractedRecords, familyState);

      // Derive honest confidence and selection criteria for OCR-derived records
      if (!isSampleTemplate) {
        validated.forEach(rec => {
          let fieldCount = 0;
          if (rec.weightKg !== null && rec.weightKg !== undefined) fieldCount++;
          if (rec.heightCm !== null && rec.heightCm !== undefined) fieldCount++;
          if (rec.headCm !== null && rec.headCm !== undefined) fieldCount++;

          const ocrConf = typeof rec.ocrConfidence === 'number' ? rec.ocrConfidence : 0.85;
          const completeness = fieldCount / 3;
          const rawConf = (ocrConf * 0.6) + (completeness * 0.4);
          const penalty = (Array.isArray(rec.warnings) && rec.warnings.length > 0) ? 0.2 : 0;
          const finalConfidence = Math.max(0.1, Math.min(0.99, Math.round((rawConf - penalty) * 100) / 100));

          rec.confidence = finalConfidence;

          // Deselect record if confidence < 0.8 or has warnings
          if (finalConfidence < 0.8 || (Array.isArray(rec.warnings) && rec.warnings.length > 0)) {
            rec.selected = false;
          } else {
            rec.selected = true;
          }
        });
      }

      allStagingRecords.push(...validated);
    }

    const combinedRawText = rawTextParts.join('\n\n');
    allStagingRecords.rawText = combinedRawText;
    allStagingRecords.records = allStagingRecords;

    // Honest result contract properties
    const firstFileName = (items[0] && items[0].name) || 'uploaded image';
    if (allStagingRecords.length > 0) {
      allStagingRecords.ocrStatus = 'ok';
      allStagingRecords.message = `Successfully extracted ${allStagingRecords.length} growth measurement record(s).`;
    } else if (hadOcrFailure && !anyReadableText) {
      allStagingRecords.ocrStatus = 'ocr-unavailable';
      allStagingRecords.message = 'Client OCR engine failed to load or run. Please verify your browser supports WebAssembly or enter values manually.';
    } else if (anyReadableText) {
      allStagingRecords.ocrStatus = 'no-measurements';
      allStagingRecords.message = `No growth measurements could be parsed from ${firstFileName}. Check the OCR text or add the values manually. Note that handwriting OCR can be unreliable.`;
    } else if (anyImageProcessed) {
      allStagingRecords.ocrStatus = 'no-text';
      allStagingRecords.message = `No readable text was detected in ${firstFileName}. Please ensure the image is clear and well-lit, or add values manually.`;
    } else {
      allStagingRecords.ocrStatus = 'ok';
      allStagingRecords.message = 'Ready.';
    }

    return allStagingRecords;
  }

  // =========================================================================
  // 5. INTERACTIVE VISUAL BOUNDING BOX INSPECTOR & HELPER UTILITIES
  // =========================================================================

  /**
   * Draw bounding box overlays on an HTML5 canvas for the visual refinement studio
   *
   * @param {HTMLCanvasElement|CanvasRenderingContext2D} target
   * @param {Array<Object>} boxesOrRecords - Array of { x, y, w, h } OR record objects with .boundingBox
   * @param {number} activeIndex - Index of currently focused box/record
   * @param {number} canvasW
   * @param {number} canvasH
   */
  function drawBoundingBoxes(target, boxesOrRecords, activeIndex = -1, canvasW = CANVAS_WIDTH, canvasH = CANVAS_HEIGHT) {
    if (!target || !Array.isArray(boxesOrRecords)) return;
    const ctx = typeof target.getContext === 'function' ? target.getContext('2d') : target;
    if (!ctx) return;

    // Use target canvas dimensions if available
    const actualW = target.width || canvasW || CANVAS_WIDTH;
    const actualH = target.height || canvasH || CANVAS_HEIGHT;

    boxesOrRecords.forEach((item, i) => {
      if (!item) return;
      // Extract bounding box whether passed directly or nested inside record
      const box = item.boundingBox ? item.boundingBox : (item.x !== undefined ? item : null);
      if (!box || typeof box.x !== 'number') return;

      const bx = box.x * actualW;
      const by = box.y * actualH;
      const bw = box.w * actualW;
      const bh = box.h * actualH;

      const isActive = i === activeIndex;

      // Determine child identity and styling
      const childName = item.detectedChildName || item.childName || '';
      const childId = item.childId || '';
      const isLeo = (childId === 'child-1' || childName.toLowerCase() === 'leo');
      const isMaya = (childId === 'child-2' || childName.toLowerCase() === 'maya');

      // Theme Colors:
      // Active: Vivid Highlight Gold/Amber `#D97706` / `#F59E0B`
      // Leo / child-1: Warm Terracotta `#C85A32`
      // Maya / child-2: Botanical Sage `#2E6F5E`
      // Default: Ocean Blue `#0284C7`
      let strokeColor = '#0284C7';
      let fillColor = 'rgba(2, 132, 199, 0.12)';
      let badgeColor = '#0284C7';

      if (isActive) {
        strokeColor = '#D97706'; // Vivid Highlight Gold
        fillColor = 'rgba(217, 119, 6, 0.24)';
        badgeColor = '#D97706';
      } else if (isLeo) {
        strokeColor = '#C85A32'; // Warm Terracotta
        fillColor = 'rgba(200, 90, 50, 0.12)';
        badgeColor = '#C85A32';
      } else if (isMaya) {
        strokeColor = '#2E6F5E'; // Botanical Sage
        fillColor = 'rgba(46, 111, 94, 0.12)';
        badgeColor = '#2E6F5E';
      }

      // Box fill highlight
      ctx.fillStyle = fillColor;
      ctx.fillRect(bx, by, bw, bh);

      // Box border
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isActive ? 3 : 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner accent markers for crisp vision studio look
      const cSize = Math.min(10, bw / 4, bh / 4);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isActive ? 4 : 2.5;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + cSize); ctx.lineTo(bx, by); ctx.lineTo(bx + cSize, by);
      ctx.stroke();
      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cSize, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + cSize);
      ctx.stroke();
      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cSize); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + cSize, by + bh);
      ctx.stroke();
      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cSize, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - cSize);
      ctx.stroke();

      // Top-left label pill showing `#${i+1} ${childName} (${heightCm}cm, ${weightKg}kg)`
      let pillText = `#${i + 1}`;
      if (childName) {
        pillText += ` ${childName}`;
      }
      const hasHt = typeof item.heightCm === 'number';
      const hasWt = typeof item.weightKg === 'number';
      if (hasHt && hasWt) {
        pillText += ` (${item.heightCm}cm, ${item.weightKg}kg)`;
      } else if (hasHt) {
        pillText += ` (${item.heightCm}cm)`;
      } else if (hasWt) {
        pillText += ` (${item.weightKg}kg)`;
      }

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(pillText);
      const pillW = Math.max(50, textMetrics.width + 14);
      const pillH = 22;
      const pillX = bx;
      const pillY = Math.max(2, by - pillH - 2);

      // Pill shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;

      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 5);
      ctx.fill();
      ctx.restore();

      // Pill border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 5);
      ctx.stroke();

      // Pill text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + 7, pillY + pillH / 2);
    });
  }

  /**
   * Interactive Hit-Testing:
   * Given normalized canvas coordinates normX (0..1) and normY (0..1),
   * returns index i of record whose boundingBox contains (normX, normY), or -1 if none.
   *
   * @param {Array<Object>} records - Array of records or boundingBox objects
   * @param {number} normX - 0..1
   * @param {number} normY - 0..1
   * @returns {number} Record index or -1
   */
  function getRecordIndexAtPoint(records, normX, normY) {
    if (!Array.isArray(records) || typeof normX !== 'number' || typeof normY !== 'number') {
      return -1;
    }

    for (let i = 0; i < records.length; i++) {
      const item = records[i];
      if (!item) continue;
      const box = item.boundingBox ? item.boundingBox : (item.x !== undefined ? item : null);
      if (!box || typeof box.x !== 'number') continue;

      if (
        normX >= box.x &&
        normX <= box.x + box.w &&
        normY >= box.y &&
        normY <= box.y + box.h
      ) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Refine or edit a staged record with instant re-validation
   */
  function refineRecord(record, updates, familyState) {
    const updated = { ...record, ...updates };
    const validated = validateStagingRecords([updated], familyState);
    return validated[0];
  }

  /**
   * Export staged records to standard CSV string
   */
  function exportRecordsToCSV(records) {
    if (!Array.isArray(records) || records.length === 0) return '';
    const headers = [
      'Child Name',
      'Date',
      'Age (Months)',
      'Weight (kg)',
      'Height (cm)',
      'Head Circ (cm)',
      'Weight %ile',
      'Height %ile',
      'Head %ile',
      'Status',
      'Confidence',
      'Source Image',
      'Raw Line',
      'Notes'
    ];

    const escapeCSV = val => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map(r => [
      escapeCSV(r.detectedChildName),
      escapeCSV(r.date),
      escapeCSV(r.ageMonths),
      escapeCSV(r.weightKg),
      escapeCSV(r.heightCm),
      escapeCSV(r.headCm),
      escapeCSV(r.weightPct),
      escapeCSV(r.heightPct),
      escapeCSV(r.headPct),
      escapeCSV(r.status),
      escapeCSV(r.confidence),
      escapeCSV(r.sourceImageName),
      escapeCSV(r.rawLine),
      escapeCSV(r.notes)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Creates an empty StagingRecord for manual entry
   *
   * @param {Object} familyState
   * @param {string} childId
   * @returns {Object} StagingRecord
   */
  function createBlankRecord(familyState, childId) {
    const children = (familyState && familyState.children && familyState.children.length > 0)
      ? familyState.children
      : DEFAULT_CHILDREN;

    let targetChild = null;
    if (childId) {
      targetChild = children.find(c => c.id === childId || c.name.toLowerCase() === childId.toLowerCase());
    }
    if (!targetChild) {
      targetChild = children[0] || DEFAULT_CHILDREN[0];
    }

    const todayStr = formatDateISO(new Date());
    const ageMonths = calculateAgeInMonths(targetChild.birthDate, todayStr);

    return {
      id: 'stage-' + Math.random().toString(36).slice(2, 9),
      sourceImageName: 'Manual Entry',
      sourceDataUrl: '',
      childId: targetChild.id,
      detectedChildName: targetChild.name,
      childName: targetChild.name,
      date: todayStr,
      ageMonths: Math.round(ageMonths * 10) / 10,
      weightKg: null,
      heightCm: null,
      headCm: null,
      headCircumferenceCm: null,
      weightPct: null,
      heightPct: null,
      headPct: null,
      rawLine: '',
      rawText: '',
      confidence: null,
      status: 'warning',
      warnings: ['Manual entry - fill in values'],
      selected: false,
      notes: 'Manually added record',
      boundingBox: { x: 0.05, y: 0.35, w: 0.90, h: 0.08 }
    };
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  return {
    // 1. Realistic Sample Picture Generators
    getSampleTemplates,
    renderSampleImageToDataURL,
    renderCameraCaptureSample,

    // 2. Real Image OCR + Vision Pipeline
    processImages,
    createBlankRecord,

    // 3. Smart Medical Natural Language & Table Parser
    parseRawTextToRecords,

    // 4. Validation, Growth Percentiles & Anomaly Detection
    validateStagingRecords,

    // 5. Unit conversions & Utilities
    convertUnits: Units,
    calculateAgeInMonths,
    calculatePercentile,
    drawBoundingBoxes,
    getRecordIndexAtPoint,
    refineRecord,
    exportRecordsToCSV,

    // Metadata
    version: '1.0.0',
    moduleName: 'PhotoImport'
  };
});
