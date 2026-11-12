/**
 * KinSprout Growth Engine (growth-engine.js)
 * Clinical-grade Biostatistical Growth Analytics for Pediatric Tracking
 *
 * Implements WHO Child Growth Standards (0–24 months) and CDC Growth Charts (24–240 months).
 * Utilizes the Box-Cox LMS method with Abramowitz & Stegun normal distribution approximations.
 *
 * Exposes window.GrowthEngine with:
 *  - Full LMS Reference Tables (Weight, Height, Head Circumference, BMI for M/F 0–240m)
 *  - Interpolation, Z-score, and Percentile calculations
 *  - Growth Velocity & spurt detection
 *  - Tanner Mid-Parental Target and Blended Adult Height Prediction
 *  - Clothing and Shoe Size Pediatric Projections
 *  - Comprehensive Unit Conversions
 */

(function (global) {
  'use strict';

  // =========================================================================
  // 1. LMS REFERENCE TABLES (WHO 0-24m + CDC 24-240m)
  // Anchor points at ages: 0, 1, 2, 3, 4, 6, 9, 12, 15, 18, 24, 30, 36, 42,
  // 48, 54, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204,
  // 216, 228, 240 months.
  // =========================================================================


  // Canonical Child Color Palette for 1..N children
  const CHILD_PALETTE = ['#C85A32', '#2E6F5E', '#3B5BDB', '#9C36B5', '#D97706', '#DB2777'];

  const LMS_TABLES = {
    // Boys ('M')
    M: {
      // Weight-for-Age (kg)
      weight: [
        { age: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
        { age: 1, L: 0.2297, M: 4.4709, S: 0.13495 },
        { age: 2, L: 0.1554, M: 5.6026, S: 0.12579 },
        { age: 3, L: 0.1030, M: 6.4258, S: 0.11970 },
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
        { age: 60, L: -0.2982, M: 18.3400, S: 0.14250 },
        { age: 72, L: -0.3664, M: 20.5200, S: 0.15430 },
        { age: 84, L: -0.4385, M: 22.9500, S: 0.16560 },
        { age: 96, L: -0.5126, M: 25.6800, S: 0.17640 },
        { age: 108, L: -0.5872, M: 28.7800, S: 0.18650 },
        { age: 120, L: -0.6606, M: 32.3200, S: 0.19580 },
        { age: 132, L: -0.7307, M: 36.3500, S: 0.20400 },
        { age: 144, L: -0.7954, M: 40.8900, S: 0.21090 },
        { age: 156, L: -0.8523, M: 45.8900, S: 0.21620 },
        { age: 168, L: -0.8990, M: 51.1900, S: 0.21950 },
        { age: 180, L: -0.9332, M: 56.4500, S: 0.22050 },
        { age: 192, L: -0.9525, M: 61.2100, S: 0.21890 },
        { age: 204, L: -0.9547, M: 65.0400, S: 0.21480 },
        { age: 216, L: -0.9380, M: 67.6200, S: 0.20810 },
        { age: 228, L: -0.8999, M: 69.0400, S: 0.19890 },
        { age: 240, L: -0.8385, M: 70.3000, S: 0.18730 }
      ],

      // Length / Height-for-Age (cm)
      height: [
        { age: 0, L: 1.0, M: 49.88, S: 0.03795 },
        { age: 1, L: 1.0, M: 54.72, S: 0.03559 },
        { age: 2, L: 1.0, M: 58.42, S: 0.03437 },
        { age: 3, L: 1.0, M: 61.43, S: 0.03362 },
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
        { age: 60, L: 1.0, M: 110.25, S: 0.04200 },
        { age: 72, L: 1.0, M: 116.30, S: 0.04320 },
        { age: 84, L: 1.0, M: 122.10, S: 0.04420 },
        { age: 96, L: 1.0, M: 127.80, S: 0.04520 },
        { age: 108, L: 1.0, M: 133.40, S: 0.04630 },
        { age: 120, L: 1.0, M: 138.90, S: 0.04760 },
        { age: 132, L: 1.0, M: 144.30, S: 0.04940 },
        { age: 144, L: 1.0, M: 150.10, S: 0.05200 },
        { age: 156, L: 1.0, M: 157.00, S: 0.05440 },
        { age: 168, L: 1.0, M: 164.50, S: 0.05220 },
        { age: 180, L: 1.0, M: 170.50, S: 0.04550 },
        { age: 192, L: 1.0, M: 174.10, S: 0.04120 },
        { age: 204, L: 1.0, M: 175.70, S: 0.03920 },
        { age: 216, L: 1.0, M: 176.40, S: 0.03840 },
        { age: 228, L: 1.0, M: 176.80, S: 0.03800 },
        { age: 240, L: 1.0, M: 177.00, S: 0.03800 }
      ],

      // Head Circumference-for-Age (cm)
      head: [
        { age: 0, L: 1.0, M: 34.46, S: 0.0360 },
        { age: 1, L: 1.0, M: 37.31, S: 0.0336 },
        { age: 2, L: 1.0, M: 39.14, S: 0.0323 },
        { age: 3, L: 1.0, M: 40.50, S: 0.0314 },
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
        { age: 60, L: 1.0, M: 51.02, S: 0.0304 },
        { age: 72, L: 1.0, M: 51.60, S: 0.0305 },
        { age: 84, L: 1.0, M: 52.10, S: 0.0306 },
        { age: 96, L: 1.0, M: 52.60, S: 0.0307 },
        { age: 108, L: 1.0, M: 53.00, S: 0.0308 },
        { age: 120, L: 1.0, M: 53.40, S: 0.0309 },
        { age: 132, L: 1.0, M: 53.80, S: 0.0310 },
        { age: 144, L: 1.0, M: 54.20, S: 0.0311 },
        { age: 156, L: 1.0, M: 54.60, S: 0.0312 },
        { age: 168, L: 1.0, M: 55.00, S: 0.0313 },
        { age: 180, L: 1.0, M: 55.20, S: 0.0314 },
        { age: 192, L: 1.0, M: 55.35, S: 0.0314 },
        { age: 204, L: 1.0, M: 55.45, S: 0.0315 },
        { age: 216, L: 1.0, M: 55.50, S: 0.0315 },
        { age: 228, L: 1.0, M: 55.52, S: 0.0315 },
        { age: 240, L: 1.0, M: 55.55, S: 0.0315 }
      ],

      // BMI-for-Age (kg/m²)
      bmi: [
        { age: 0, L: 0.35, M: 13.41, S: 0.0950 },
        { age: 1, L: 0.05, M: 14.90, S: 0.0910 },
        { age: 2, L: -0.15, M: 16.32, S: 0.0880 },
        { age: 3, L: -0.28, M: 16.92, S: 0.0860 },
        { age: 4, L: -0.38, M: 17.14, S: 0.0840 },
        { age: 6, L: -0.50, M: 17.20, S: 0.0820 },
        { age: 9, L: -0.60, M: 17.02, S: 0.0800 },
        { age: 12, L: -0.65, M: 16.80, S: 0.0780 },
        { age: 15, L: -0.68, M: 16.42, S: 0.0770 },
        { age: 18, L: -0.70, M: 16.10, S: 0.0760 },
        { age: 24, L: -0.72, M: 15.70, S: 0.0760 },
        { age: 30, L: -0.75, M: 15.50, S: 0.0760 },
        { age: 36, L: -0.80, M: 15.38, S: 0.0770 },
        { age: 42, L: -0.86, M: 15.32, S: 0.0780 },
        { age: 48, L: -0.93, M: 15.30, S: 0.0810 },
        { age: 54, L: -1.01, M: 15.32, S: 0.0840 },
        { age: 60, L: -1.10, M: 15.36, S: 0.0880 },
        { age: 72, L: -1.28, M: 15.48, S: 0.0960 },
        { age: 84, L: -1.44, M: 15.75, S: 0.1060 },
        { age: 96, L: -1.59, M: 16.14, S: 0.1160 },
        { age: 108, L: -1.72, M: 16.63, S: 0.1260 },
        { age: 120, L: -1.83, M: 17.22, S: 0.1360 },
        { age: 132, L: -1.93, M: 17.89, S: 0.1440 },
        { age: 144, L: -2.00, M: 18.63, S: 0.1510 },
        { age: 156, L: -2.05, M: 19.42, S: 0.1560 },
        { age: 168, L: -2.08, M: 20.24, S: 0.1600 },
        { age: 180, L: -2.09, M: 21.05, S: 0.1620 },
        { age: 192, L: -2.09, M: 21.75, S: 0.1630 },
        { age: 204, L: -2.07, M: 22.32, S: 0.1630 },
        { age: 216, L: -2.03, M: 22.75, S: 0.1620 },
        { age: 228, L: -1.98, M: 23.10, S: 0.1610 },
        { age: 240, L: -1.92, M: 23.40, S: 0.1600 }
      ]
    },

    // Girls ('F')
    F: {
      // Weight-for-Age (kg)
      weight: [
        { age: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
        { age: 1, L: 0.2444, M: 4.1873, S: 0.13459 },
        { age: 2, L: 0.1601, M: 5.1282, S: 0.12658 },
        { age: 3, L: 0.1009, M: 5.8449, S: 0.12132 },
        { age: 4, L: 0.0571, M: 6.4237, S: 0.11797 },
        { age: 6, L: 0.0033, M: 7.2970, S: 0.11475 },
        { age: 9, L: -0.0469, M: 8.2162, S: 0.11281 },
        { age: 12, L: -0.0783, M: 8.9525, S: 0.11202 },
        { age: 15, L: -0.1006, M: 9.5898, S: 0.11203 },
        { age: 18, L: -0.1179, M: 10.1770, S: 0.11246 },
        { age: 24, L: -0.1425, M: 11.4793, S: 0.11428 },
        { age: 30, L: -0.1755, M: 12.7200, S: 0.12060 },
        { age: 36, L: -0.2190, M: 13.8800, S: 0.12740 },
        { age: 42, L: -0.2685, M: 14.9700, S: 0.13470 },
        { age: 48, L: -0.3228, M: 16.0300, S: 0.14240 },
        { age: 54, L: -0.3807, M: 17.0700, S: 0.15040 },
        { age: 60, L: -0.4411, M: 18.1500, S: 0.15850 },
        { age: 72, L: -0.5654, M: 20.4600, S: 0.17480 },
        { age: 84, L: -0.6908, M: 23.1400, S: 0.19040 },
        { age: 96, L: -0.8128, M: 26.2400, S: 0.20460 },
        { age: 108, L: -0.9264, M: 29.7700, S: 0.21680 },
        { age: 120, L: -1.0268, M: 33.7200, S: 0.22630 },
        { age: 132, L: -1.1090, M: 38.0100, S: 0.23250 },
        { age: 144, L: -1.1685, M: 42.4800, S: 0.23480 },
        { age: 156, L: -1.2012, M: 46.8500, S: 0.23290 },
        { age: 168, L: -1.2037, M: 50.7000, S: 0.22670 },
        { age: 180, L: -1.1738, M: 53.6000, S: 0.21630 },
        { age: 192, L: -1.1105, M: 55.3300, S: 0.20230 },
        { age: 204, L: -1.0139, M: 56.2400, S: 0.18570 },
        { age: 216, L: -0.8858, M: 56.8800, S: 0.16780 },
        { age: 228, L: -0.7303, M: 57.4200, S: 0.15010 },
        { age: 240, L: -0.5532, M: 58.0000, S: 0.13450 }
      ],

      // Length / Height-for-Age (cm)
      height: [
        { age: 0, L: 1.0, M: 49.15, S: 0.03790 },
        { age: 1, L: 1.0, M: 53.69, S: 0.03556 },
        { age: 2, L: 1.0, M: 57.07, S: 0.03433 },
        { age: 3, L: 1.0, M: 59.80, S: 0.03358 },
        { age: 4, L: 1.0, M: 62.09, S: 0.03314 },
        { age: 6, L: 1.0, M: 65.73, S: 0.03273 },
        { age: 9, L: 1.0, M: 70.14, S: 0.03281 },
        { age: 12, L: 1.0, M: 74.02, S: 0.03328 },
        { age: 15, L: 1.0, M: 77.49, S: 0.03393 },
        { age: 18, L: 1.0, M: 80.71, S: 0.03468 },
        { age: 24, L: 1.0, M: 86.41, S: 0.03630 },
        { age: 30, L: 1.0, M: 91.10, S: 0.03760 },
        { age: 36, L: 1.0, M: 95.30, S: 0.03890 },
        { age: 42, L: 1.0, M: 99.10, S: 0.04000 },
        { age: 48, L: 1.0, M: 102.60, S: 0.04100 },
        { age: 54, L: 1.0, M: 105.88, S: 0.04180 },
        { age: 60, L: 1.0, M: 109.00, S: 0.04250 },
        { age: 72, L: 1.0, M: 115.20, S: 0.04360 },
        { age: 84, L: 1.0, M: 121.20, S: 0.04480 },
        { age: 96, L: 1.0, M: 127.00, S: 0.04600 },
        { age: 108, L: 1.0, M: 132.80, S: 0.04750 },
        { age: 120, L: 1.0, M: 138.50, S: 0.04940 },
        { age: 132, L: 1.0, M: 144.70, S: 0.05100 },
        { age: 144, L: 1.0, M: 151.10, S: 0.04980 },
        { age: 156, L: 1.0, M: 156.00, S: 0.04560 },
        { age: 168, L: 1.0, M: 159.20, S: 0.04180 },
        { age: 180, L: 1.0, M: 161.20, S: 0.03960 },
        { age: 192, L: 1.0, M: 162.30, S: 0.03870 },
        { age: 204, L: 1.0, M: 162.80, S: 0.03830 },
        { age: 216, L: 1.0, M: 163.10, S: 0.03810 },
        { age: 228, L: 1.0, M: 163.20, S: 0.03800 },
        { age: 240, L: 1.0, M: 163.30, S: 0.03800 }
      ],

      // Head Circumference-for-Age (cm)
      head: [
        { age: 0, L: 1.0, M: 33.88, S: 0.0357 },
        { age: 1, L: 1.0, M: 36.54, S: 0.0334 },
        { age: 2, L: 1.0, M: 38.30, S: 0.0320 },
        { age: 3, L: 1.0, M: 39.54, S: 0.0311 },
        { age: 4, L: 1.0, M: 40.57, S: 0.0305 },
        { age: 6, L: 1.0, M: 42.18, S: 0.0298 },
        { age: 9, L: 1.0, M: 43.89, S: 0.0293 },
        { age: 12, L: 1.0, M: 44.97, S: 0.0291 },
        { age: 15, L: 1.0, M: 45.74, S: 0.0291 },
        { age: 18, L: 1.0, M: 46.33, S: 0.0292 },
        { age: 24, L: 1.0, M: 47.23, S: 0.0294 },
        { age: 30, L: 1.0, M: 47.92, S: 0.0296 },
        { age: 36, L: 1.0, M: 48.49, S: 0.0298 },
        { age: 42, L: 1.0, M: 48.96, S: 0.0300 },
        { age: 48, L: 1.0, M: 49.36, S: 0.0301 },
        { age: 54, L: 1.0, M: 49.71, S: 0.0302 },
        { age: 60, L: 1.0, M: 50.02, S: 0.0303 },
        { age: 72, L: 1.0, M: 50.60, S: 0.0304 },
        { age: 84, L: 1.0, M: 51.10, S: 0.0305 },
        { age: 96, L: 1.0, M: 51.55, S: 0.0306 },
        { age: 108, L: 1.0, M: 51.95, S: 0.0307 },
        { age: 120, L: 1.0, M: 52.30, S: 0.0308 },
        { age: 132, L: 1.0, M: 52.65, S: 0.0309 },
        { age: 144, L: 1.0, M: 53.00, S: 0.0310 },
        { age: 156, L: 1.0, M: 53.35, S: 0.0311 },
        { age: 168, L: 1.0, M: 53.70, S: 0.0312 },
        { age: 180, L: 1.0, M: 53.95, S: 0.0313 },
        { age: 192, L: 1.0, M: 54.10, S: 0.0313 },
        { age: 204, L: 1.0, M: 54.20, S: 0.0314 },
        { age: 216, L: 1.0, M: 54.25, S: 0.0314 },
        { age: 228, L: 1.0, M: 54.28, S: 0.0314 },
        { age: 240, L: 1.0, M: 54.30, S: 0.0314 }
      ],

      // BMI-for-Age (kg/m²)
      bmi: [
        { age: 0, L: 0.38, M: 13.30, S: 0.0940 },
        { age: 1, L: 0.08, M: 14.52, S: 0.0900 },
        { age: 2, L: -0.12, M: 15.70, S: 0.0870 },
        { age: 3, L: -0.25, M: 16.32, S: 0.0850 },
        { age: 4, L: -0.34, M: 16.54, S: 0.0830 },
        { age: 6, L: -0.45, M: 16.62, S: 0.0810 },
        { age: 9, L: -0.55, M: 16.40, S: 0.0790 },
        { age: 12, L: -0.60, M: 16.18, S: 0.0770 },
        { age: 15, L: -0.64, M: 15.86, S: 0.0760 },
        { age: 18, L: -0.66, M: 15.58, S: 0.0750 },
        { age: 24, L: -0.70, M: 15.35, S: 0.0760 },
        { age: 30, L: -0.75, M: 15.18, S: 0.0770 },
        { age: 36, L: -0.81, M: 15.08, S: 0.0780 },
        { age: 42, L: -0.88, M: 15.02, S: 0.0800 },
        { age: 48, L: -0.96, M: 15.00, S: 0.0830 },
        { age: 54, L: -1.04, M: 15.02, S: 0.0870 },
        { age: 60, L: -1.13, M: 15.08, S: 0.0920 },
        { age: 72, L: -1.33, M: 15.28, S: 0.1020 },
        { age: 84, L: -1.52, M: 15.60, S: 0.1130 },
        { age: 96, L: -1.69, M: 16.03, S: 0.1250 },
        { age: 108, L: -1.83, M: 16.58, S: 0.1360 },
        { age: 120, L: -1.95, M: 17.24, S: 0.1460 },
        { age: 132, L: -2.04, M: 17.98, S: 0.1540 },
        { age: 144, L: -2.10, M: 18.78, S: 0.1600 },
        { age: 156, L: -2.13, M: 19.57, S: 0.1630 },
        { age: 168, L: -2.13, M: 20.30, S: 0.1640 },
        { age: 180, L: -2.10, M: 20.91, S: 0.1640 },
        { age: 192, L: -2.05, M: 21.40, S: 0.1630 },
        { age: 204, L: -1.99, M: 21.80, S: 0.1610 },
        { age: 216, L: -1.92, M: 22.12, S: 0.1590 },
        { age: 228, L: -1.84, M: 22.38, S: 0.1580 },
        { age: 240, L: -1.76, M: 22.60, S: 0.1570 }
      ]
    }
  };

  // Helper to normalize sex representation
  function normalizeSex(sex) {
    if (!sex) return 'M';
    const s = String(sex).trim().toUpperCase();
    if (s === 'F' || s === 'FEMALE' || s === 'GIRL') return 'F';
    if (s === 'M' || s === 'MALE' || s === 'BOY') return 'M';
    return 'M';
  }

  // Helper to normalize metric names
  function normalizeMetric(metric) {
    if (!metric) return 'weight';
    const m = String(metric).trim().toLowerCase();
    if (m === 'length' || m === 'stature' || m === 'heightcm' || m === 'height') return 'height';
    if (m === 'hc' || m === 'headcircumference' || m === 'head_circumference' || m === 'headcm' || m === 'head') return 'head';
    if (m === 'weightkg' || m === 'weight') return 'weight';
    if (m === 'bmi') return 'bmi';
    return m;
  }

  /**
   * Linear interpolation for LMS values at any given age in months.
   * Clamps gracefully to [0, 240] months.
   */
  function getLMS(sex, metric, ageMonths) {
    const s = normalizeSex(sex);
    const m = normalizeMetric(metric);
    const series = LMS_TABLES[s] && LMS_TABLES[s][m];
    if (!series || series.length === 0) {
      throw new Error(`Unsupported LMS series for sex: ${sex}, metric: ${metric}`);
    }

    const age = Math.max(0, Math.min(240, Number(ageMonths) || 0));

    if (age <= series[0].age) {
      return { L: series[0].L, M: series[0].M, S: series[0].S };
    }
    const last = series[series.length - 1];
    if (age >= last.age) {
      return { L: last.L, M: last.M, S: last.S };
    }

    for (let i = 0; i < series.length - 1; i++) {
      const p0 = series[i];
      const p1 = series[i + 1];
      if (age >= p0.age && age <= p1.age) {
        if (p1.age === p0.age) return { L: p0.L, M: p0.M, S: p0.S };
        const t = (age - p0.age) / (p1.age - p0.age);
        return {
          L: p0.L + t * (p1.L - p0.L),
          M: p0.M + t * (p1.M - p0.M),
          S: p0.S + t * (p1.S - p0.S)
        };
      }
    }

    return { L: last.L, M: last.M, S: last.S };
  }

  // =========================================================================
  // 2. CORE STATISTICAL AND BIOMETRIC METHODS
  // =========================================================================

  /**
   * Calculates exact age in months given two dates.
   * 1 average month = 30.4375 days.
   */
  function calculateAgeMonths(birthDateStr, measureDateStr) {
    if (!birthDateStr || !measureDateStr) return 0;
    const bDate = new Date(birthDateStr);
    const mDate = new Date(measureDateStr);
    if (isNaN(bDate.getTime()) || isNaN(mDate.getTime())) return 0;
    const diffMs = mDate.getTime() - bDate.getTime();
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
    return Math.max(0, Math.round(months * 100) / 100);
  }

  /**
   * Formats age nicely for pediatric UI presentation.
   * 0 -> "Birth", < 1m -> "X wks", < 24m -> "X.X mos", >= 24m -> "Xy Ym"
   */
  function formatAge(ageMonths) {
    if (ageMonths === null || ageMonths === undefined || isNaN(ageMonths)) return '';
    const age = Number(ageMonths);
    if (age <= 0.05) return 'Birth';
    if (age < 1) {
      const weeks = Math.max(1, Math.round((age * 30.4375) / 7));
      return `${weeks} ${weeks === 1 ? 'wk' : 'wks'}`;
    }
    if (age < 24) {
      const mos = Math.round(age * 10) / 10;
      return `${mos} mos`;
    }
    const years = Math.floor(age / 12);
    const remainingMonths = Math.round(age % 12);
    if (remainingMonths === 0) return `${years}y`;
    return `${years}y ${remainingMonths}m`;
  }

  /**
   * Calculates Body Mass Index (BMI = kg / m²).
   */
  function calculateBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm <= 0 || weightKg <= 0) return null;
    const heightM = Number(heightCm) / 100;
    const bmi = Number(weightKg) / (heightM * heightM);
    return Math.round(bmi * 100) / 100;
  }

  /**
   * Standard Normal Cumulative Distribution Function (CDF).
   * High-accuracy Abramowitz & Stegun rational approximation (formula 26.2.17).
   * Absolute error < 7.5e-8.
   */
  function normalCDF(z) {
    if (z === null || z === undefined || isNaN(z)) return null;
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

  /**
   * Inverse Standard Normal CDF (Quantile function).
   * Peter J. Acklam's high-precision rational approximation (relative error < 1.15e-9).
   */
  function inverseNormalCDF(p) {
    if (p <= 0.0000001) return -4.5;
    if (p >= 0.9999999) return 4.5;

    const a = [
      -3.969683028665376e+01,
       2.209460984245205e+02,
      -2.759285104469687e+02,
       1.383577518672690e+02,
      -3.066479806614716e+01,
       2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01,
       1.615858368580409e+02,
      -1.556989798598866e+02,
       6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
       4.374664141464968e+00,
       2.938163982698783e+00
    ];
    const d = [
       7.784695709041462e-03,
       3.224671290700398e-01,
       2.445134137142996e+00,
       3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  /**
   * Helper to format percentile into standard English ordinal strings.
   * e.g., 50 -> "50th", 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 99 -> "99th"
   */
  /**
   * Helper to format percentile into standard English ordinal strings.
   * e.g., 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th", 21 -> "21st", 71 -> "71st", 101 -> "101st"
   */
  function formatOrdinal(percentileVal) {
    if (percentileVal === null || percentileVal === undefined || isNaN(percentileVal)) return '';
    const rounded = Math.round(Number(percentileVal));
    const abs = Math.abs(rounded);
    const rem100 = abs % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${rounded}th`;
    const rem10 = abs % 10;
    if (rem10 === 1) return `${rounded}st`;
    if (rem10 === 2) return `${rounded}nd`;
    if (rem10 === 3) return `${rounded}rd`;
    return `${rounded}th`;
  }

  /**
   * Box-Cox LMS Calculation of Z-score and Percentile.
   * Formula:
   *   z = ((val / M)^L - 1) / (L * S)  if |L| > 1e-5
   *   z = ln(val / M) / S               if |L| <= 1e-5
   */
  function calculateZScoreAndPercentile(sexOrObj, metric, ageMonths, value, optionalChild) {
    let s, m, a, v, childRef;
    if (typeof sexOrObj === 'object' && sexOrObj !== null) {
      s = normalizeSex(sexOrObj.sex || sexOrObj.gender || 'M');
      m = normalizeMetric(sexOrObj.metric || sexOrObj.metricType || 'height');
      a = sexOrObj.ageMonths ?? 0;
      v = sexOrObj.value;
      childRef = sexOrObj.child || optionalChild;
      if (!childRef && sexOrObj.gestationalWeeks !== undefined) childRef = sexOrObj;
    } else {
      s = normalizeSex(sexOrObj);
      m = normalizeMetric(metric);
      a = ageMonths ?? 0;
      v = value;
      childRef = optionalChild;
    }

    if (v === null || v === undefined || isNaN(v) || Number(v) <= 0) {
      return null;
    }

    // Apply gestational-age correction if child is premature (<37w) and under 24m chronological age
    if (childRef && childRef.gestationalWeeks !== undefined && childRef.gestationalWeeks !== null) {
      const gWeeks = Number(childRef.gestationalWeeks);
      if (gWeeks < 37 && a < 24) {
        const weeksPremature = Math.max(0, 40 - gWeeks);
        a = Math.max(0, a - (weeksPremature * 7) / 30.4375);
      }
    }

    // Clinical Sanity Check: WHO head-circumference standards stop at 60 months
    if (m === 'head' && a > 60) {
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

    const val = Number(v);
    const { L, M, S } = getLMS(s, m, a);

    let z;
    if (Math.abs(L) > 1e-5) {
      z = (Math.pow(val / M, L) - 1) / (L * S);
    } else {
      z = Math.log(val / M) / S;
    }

    // Safety clamping for display & calculation stability
    const clampedZ = Math.max(-4.5, Math.min(4.5, z));
    const percentile = Math.max(0.01, Math.min(99.99, normalCDF(clampedZ) * 100));
    const roundedPercentile = Math.round(percentile * 10) / 10;
    const formattedPercentile = formatOrdinal(percentile);

    // Clinical categorization
    let status;
    let label;
    let color;

    if (percentile < 5) {
      status = 'Low (<5th)';
      label = percentile < 3 ? 'Below 3rd percentile' : 'Low (<5th percentile)';
      color = percentile < 3 ? '#ef4444' : '#f59e0b';
    } else if (percentile <= 85) {
      status = 'Healthy / Typical';
      label = 'Healthy / Typical';
      color = '#10b981';
    } else if (percentile <= 95) {
      status = 'High (85th-95th)';
      label = 'High (85th–95th percentile)';
      color = '#f59e0b';
    } else {
      status = 'Elevated (>95th)';
      label = 'Elevated (>95th percentile)';
      color = '#ef4444';
    }

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

  /**
   * Helper that computes biometric statistics for a measurement record,
   * automatically applying gestational age correction if child is premature (<37w) and under 24 months.
   */
  function statsForMeasurement(child, measurement, metric = 'height') {
    if (!child && !measurement) return null;

    // Auto-swap if arguments were passed in reverse order: (measurement, child, metric)
    if (
      child && measurement &&
      (child.heightCm !== undefined || child.weightKg !== undefined || child.headCm !== undefined || child.headCircumferenceCm !== undefined) &&
      (measurement.birthDate !== undefined || measurement.gestationalWeeks !== undefined || measurement.measurements !== undefined)
    ) {
      const tmp = child;
      child = measurement;
      measurement = tmp;
    } else if (child && !child.birthDate && measurement && measurement.birthDate) {
      const tmp = child;
      child = measurement;
      measurement = tmp;
    }

    if (!measurement) return null;
    const m = normalizeMetric(metric);
    let val = null;
    let age = 0;

    if (typeof measurement === 'number') {
      val = measurement;
      age = Number(arguments[3] ?? 0);
    } else if (typeof measurement === 'object') {
      // Safely mirror headCm and headCircumferenceCm
      if (measurement.headCm !== undefined && measurement.headCircumferenceCm === undefined) {
        measurement.headCircumferenceCm = measurement.headCm;
      } else if (measurement.headCircumferenceCm !== undefined && measurement.headCm === undefined) {
        measurement.headCm = measurement.headCircumferenceCm;
      }

      if (m === 'height') val = measurement.heightCm ?? measurement.height;
      else if (m === 'weight') val = measurement.weightKg ?? measurement.weight;
      else if (m === 'head') val = measurement.headCircumferenceCm ?? measurement.headCm ?? measurement.head;
      else if (m === 'bmi') {
        if (measurement.bmi != null) val = Number(measurement.bmi);
        else {
          const w = measurement.weightKg ?? measurement.weight;
          const h = measurement.heightCm ?? measurement.height;
          val = (w && h) ? calculateBMI(w, h) : null;
        }
      } else {
        val = measurement[m] ?? measurement.value;
      }

      if (measurement.ageMonths !== undefined && measurement.ageMonths !== null) {
        age = Number(measurement.ageMonths);
      } else if (child && child.birthDate && measurement.date) {
        age = calculateAgeMonths(child.birthDate, measurement.date);
      }
    }

    if (val === null || val === undefined || isNaN(val) || Number(val) <= 0) {
      return null;
    }

    const sex = child ? (child.sex || child.gender || 'M') : 'M';
    const gWeeks = child ? Number(child.gestationalWeeks || 40) : 40;
    let effectiveAge = age;
    let isCorrectionApplied = false;

    if (gWeeks < 37 && age < 24) {
      const weeksPremature = 40 - gWeeks;
      effectiveAge = Math.max(0, age - (weeksPremature * 7) / 30.4375);
      isCorrectionApplied = true;
    }

    const stats = calculateZScoreAndPercentile(sex, m, effectiveAge, val);
    if (!stats) return null;

    return {
      ...stats,
      chronologicalAgeMonths: age,
      correctedAgeMonths: Math.round(effectiveAge * 100) / 100,
      isCorrectionApplied
    };
  }

  /**
   * Flexible Percentile calculation wrapper:
   * - If 1st arg is object: returns full calculateZScoreAndPercentile object ({ percentile, zScore, ... })
   * - If 1st arg is number: called as (val, metric, age, sex), returns .percentile
   * - If 3rd arg is string: called as (gender, ageMonths, metricType, value), returns .percentile
   * - Otherwise: called as (sex, metric, age, val), returns .percentile
   */
  function calculatePercentile(a, b, c, d) {
    if (typeof a === 'object' && a !== null) {
      return calculateZScoreAndPercentile(a);
    }
    if (typeof a === 'number') {
      const res = calculateZScoreAndPercentile(d, b, c, a);
      return res ? res.percentile : null;
    }
    if (typeof c === 'string' && typeof b === 'number') {
      // Called as calculatePercentile(gender, ageMonths, metricType, value)
      const res = calculateZScoreAndPercentile(a, c, b, d);
      return res ? res.percentile : null;
    }
    const res = calculateZScoreAndPercentile(a, b, c, d);
    return res ? res.percentile : null;
  }

  /**
   * Flexible Z-score calculation wrapper:
   * - If 1st arg is object: returns .zScore
   * - If 1st arg is number: called as (val, metric, age, sex), returns .zScore
   * - If 3rd arg is string: called as (gender, ageMonths, metricType, value), returns .zScore
   * - Otherwise: called as (sex, metric, age, val), returns .zScore
   */
  function calculateZScore(a, b, c, d) {
    if (typeof a === 'object' && a !== null) {
      const res = calculateZScoreAndPercentile(a);
      return res ? res.zScore : null;
    }
    if (typeof a === 'number') {
      const res = calculateZScoreAndPercentile(d, b, c, a);
      return res ? res.zScore : null;
    }
    if (typeof c === 'string' && typeof b === 'number') {
      // Called as calculateZScore(gender, ageMonths, metricType, value)
      const res = calculateZScoreAndPercentile(a, c, b, d);
      return res ? res.zScore : null;
    }
    const res = calculateZScoreAndPercentile(a, b, c, d);
    return res ? res.zScore : null;
  }

  /**
   * Computes the biometric value corresponding to a specified percentile.
   * Inverse Box-Cox LMS:
   *   val = M * (1 + L * S * z)^(1 / L)
   */
  function valueFromPercentile(sex, metric, ageMonths, percentile) {
    let p = Number(percentile);
    if (p <= 0) p = 0.01;
    if (p >= 100) p = 99.99;
    const z = inverseNormalCDF(p / 100);
    const { L, M, S } = getLMS(sex, metric, ageMonths);

    let val;
    if (Math.abs(L) > 1e-5) {
      const base = Math.max(1e-6, 1 + L * S * z);
      val = M * Math.pow(base, 1 / L);
    } else {
      val = M * Math.exp(S * z);
    }
    return Math.round(val * 100) / 100;
  }

  /**
   * Generates WHO / CDC percentile curves across an age range.
   * Returns: { ages: [], p3: [], p10: [], p25: [], p50: [], p75: [], p90: [], p97: [] }
   */
  function getPercentileCurves(sex, metric, minAgeMonths = 0, maxAgeMonths = 60, stepMonths = 1) {
    const minAge = Math.max(0, Number(minAgeMonths) || 0);
    const maxAge = Math.min(240, Number(maxAgeMonths) || 60);
    const step = Math.max(0.25, Number(stepMonths) || 1);

    const curves = {
      ages: [],
      p3: [],
      p10: [],
      p25: [],
      p50: [],
      p75: [],
      p90: [],
      p97: []
    };

    for (let age = minAge; age <= maxAge + 1e-5; age += step) {
      const roundedAge = Math.round(age * 100) / 100;
      curves.ages.push(roundedAge);
      curves.p3.push(valueFromPercentile(sex, metric, roundedAge, 3));
      curves.p10.push(valueFromPercentile(sex, metric, roundedAge, 10));
      curves.p25.push(valueFromPercentile(sex, metric, roundedAge, 25));
      curves.p50.push(valueFromPercentile(sex, metric, roundedAge, 50));
      curves.p75.push(valueFromPercentile(sex, metric, roundedAge, 75));
      curves.p90.push(valueFromPercentile(sex, metric, roundedAge, 90));
      curves.p97.push(valueFromPercentile(sex, metric, roundedAge, 97));
    }

    return curves;
  }

  // =========================================================================
  // 2B. WHO WEIGHT-FOR-LENGTH REFERENCE STANDARDS (45.0–110.0 cm)
  // Accurate Box-Cox LMS parameters at 0.5 cm length increments from official
  // WHO Child Growth Standards expanded tables (M: L = -0.3521, F: L = -0.3833).
  // =========================================================================

  const WHO_WFL_TABLES = {
    M: {
      L: -0.3521,
      points: [
        [45.0, 2.441, 0.09182],
        [45.5, 2.5244, 0.09153],
        [46.0, 2.6077, 0.09124],
        [46.5, 2.6913, 0.09094],
        [47.0, 2.7755, 0.09065],
        [47.5, 2.8609, 0.09036],
        [48.0, 2.948, 0.09007],
        [48.5, 3.0377, 0.08977],
        [49.0, 3.1308, 0.08948],
        [49.5, 3.2276, 0.08919],
        [50.0, 3.3278, 0.0889],
        [50.5, 3.4311, 0.08861],
        [51.0, 3.5376, 0.08831],
        [51.5, 3.6477, 0.08801],
        [52.0, 3.762, 0.08771],
        [52.5, 3.8814, 0.08741],
        [53.0, 4.006, 0.08711],
        [53.5, 4.1354, 0.08681],
        [54.0, 4.2693, 0.08651],
        [54.5, 4.4066, 0.08621],
        [55.0, 4.5467, 0.08592],
        [55.5, 4.6892, 0.08563],
        [56.0, 4.8338, 0.08535],
        [56.5, 4.9796, 0.08507],
        [57.0, 5.1259, 0.08481],
        [57.5, 5.2721, 0.08455],
        [58.0, 5.418, 0.0843],
        [58.5, 5.5632, 0.08406],
        [59.0, 5.7074, 0.08383],
        [59.5, 5.8501, 0.08362],
        [60.0, 5.9907, 0.08342],
        [60.5, 6.1284, 0.08324],
        [61.0, 6.2632, 0.08308],
        [61.5, 6.3954, 0.08292],
        [62.0, 6.5251, 0.08279],
        [62.5, 6.6527, 0.08266],
        [63.0, 6.7786, 0.08255],
        [63.5, 6.9028, 0.08245],
        [64.0, 7.0255, 0.08236],
        [64.5, 7.1467, 0.08229],
        [65.0, 7.2666, 0.08223],
        [65.5, 7.3854, 0.08218],
        [66.0, 7.5034, 0.08215],
        [66.5, 7.6206, 0.08213],
        [67.0, 7.737, 0.08212],
        [67.5, 7.8526, 0.08212],
        [68.0, 7.9674, 0.08214],
        [68.5, 8.0816, 0.08216],
        [69.0, 8.1955, 0.08219],
        [69.5, 8.3092, 0.08224],
        [70.0, 8.4227, 0.08229],
        [70.5, 8.5358, 0.08235],
        [71.0, 8.648, 0.08241],
        [71.5, 8.7594, 0.08248],
        [72.0, 8.8697, 0.08254],
        [72.5, 8.9788, 0.08262],
        [73.0, 9.0865, 0.08269],
        [73.5, 9.1927, 0.08276],
        [74.0, 9.2974, 0.08283],
        [74.5, 9.401, 0.08289],
        [75.0, 9.5032, 0.08295],
        [75.5, 9.6041, 0.08301],
        [76.0, 9.7033, 0.08307],
        [76.5, 9.8007, 0.08311],
        [77.0, 9.8963, 0.08314],
        [77.5, 9.9902, 0.08317],
        [78.0, 10.0827, 0.08318],
        [78.5, 10.1741, 0.08318],
        [79.0, 10.2649, 0.08316],
        [79.5, 10.3558, 0.08313],
        [80.0, 10.4475, 0.08308],
        [80.5, 10.5405, 0.08301],
        [81.0, 10.6352, 0.08293],
        [81.5, 10.7322, 0.08284],
        [82.0, 10.8321, 0.08273],
        [82.5, 10.935, 0.0826],
        [83.0, 11.0415, 0.08246],
        [83.5, 11.1516, 0.08231],
        [84.0, 11.2651, 0.08215],
        [84.5, 11.3817, 0.08198],
        [85.0, 11.5007, 0.08181],
        [85.5, 11.6218, 0.08163],
        [86.0, 11.7444, 0.08145],
        [86.5, 11.8678, 0.08128],
        [87.0, 11.9916, 0.08111],
        [87.5, 12.1152, 0.08096],
        [88.0, 12.2382, 0.08082],
        [88.5, 12.3603, 0.08069],
        [89.0, 12.4815, 0.08058],
        [89.5, 12.6017, 0.08048],
        [90.0, 12.7209, 0.08041],
        [90.5, 12.8392, 0.08034],
        [91.0, 12.9569, 0.0803],
        [91.5, 13.0742, 0.08026],
        [92.0, 13.191, 0.08025],
        [92.5, 13.3075, 0.08025],
        [93.0, 13.4239, 0.08026],
        [93.5, 13.5404, 0.08029],
        [94.0, 13.6572, 0.08034],
        [94.5, 13.7746, 0.0804],
        [95.0, 13.8928, 0.08047],
        [95.5, 14.012, 0.08056],
        [96.0, 14.1325, 0.08067],
        [96.5, 14.2544, 0.08078],
        [97.0, 14.3782, 0.08092],
        [97.5, 14.5038, 0.08106],
        [98.0, 14.6316, 0.08122],
        [98.5, 14.7614, 0.08139],
        [99.0, 14.8934, 0.08157],
        [99.5, 15.0275, 0.08177],
        [100.0, 15.1637, 0.08198],
        [100.5, 15.3018, 0.0822],
        [101.0, 15.4419, 0.08243],
        [101.5, 15.5838, 0.08267],
        [102.0, 15.7276, 0.08292],
        [102.5, 15.8732, 0.08317],
        [103.0, 16.0206, 0.08343],
        [103.5, 16.1697, 0.0837],
        [104.0, 16.3204, 0.08397],
        [104.5, 16.4728, 0.08425],
        [105.0, 16.6268, 0.08453],
        [105.5, 16.7826, 0.08481],
        [106.0, 16.9401, 0.0851],
        [106.5, 17.0995, 0.08539],
        [107.0, 17.2607, 0.08568],
        [107.5, 17.4237, 0.08599],
        [108.0, 17.5885, 0.08629],
        [108.5, 17.7553, 0.0866],
        [109.0, 17.9242, 0.08691],
        [109.5, 18.0954, 0.08723],
        [110.0, 18.2689, 0.08755],
      ]
    },
    F: {
      L: -0.3833,
      points: [
        [45.0, 2.4607, 0.09029],
        [45.5, 2.5457, 0.09033],
        [46.0, 2.6306, 0.09037],
        [46.5, 2.7155, 0.0904],
        [47.0, 2.8007, 0.09044],
        [47.5, 2.8867, 0.09048],
        [48.0, 2.9741, 0.09052],
        [48.5, 3.0636, 0.09056],
        [49.0, 3.156, 0.0906],
        [49.5, 3.252, 0.09064],
        [50.0, 3.3518, 0.09068],
        [50.5, 3.4557, 0.09072],
        [51.0, 3.5636, 0.09076],
        [51.5, 3.6754, 0.0908],
        [52.0, 3.7911, 0.09085],
        [52.5, 3.9105, 0.09089],
        [53.0, 4.0332, 0.09093],
        [53.5, 4.1591, 0.09098],
        [54.0, 4.2875, 0.09102],
        [54.5, 4.4179, 0.09106],
        [55.0, 4.5498, 0.0911],
        [55.5, 4.6827, 0.09114],
        [56.0, 4.8162, 0.09118],
        [56.5, 4.95, 0.09121],
        [57.0, 5.0837, 0.09125],
        [57.5, 5.2173, 0.09128],
        [58.0, 5.3507, 0.0913],
        [58.5, 5.4834, 0.09132],
        [59.0, 5.6151, 0.09134],
        [59.5, 5.7454, 0.09135],
        [60.0, 5.8742, 0.09136],
        [60.5, 6.0014, 0.09137],
        [61.0, 6.127, 0.09137],
        [61.5, 6.2511, 0.09136],
        [62.0, 6.3738, 0.09135],
        [62.5, 6.4948, 0.09133],
        [63.0, 6.6144, 0.09131],
        [63.5, 6.7328, 0.09129],
        [64.0, 6.8501, 0.09126],
        [64.5, 6.9662, 0.09123],
        [65.0, 7.0812, 0.09119],
        [65.5, 7.195, 0.09115],
        [66.0, 7.3076, 0.0911],
        [66.5, 7.4189, 0.09106],
        [67.0, 7.5288, 0.09101],
        [67.5, 7.6375, 0.09096],
        [68.0, 7.7448, 0.0909],
        [68.5, 7.8509, 0.09085],
        [69.0, 7.9559, 0.09079],
        [69.5, 8.0599, 0.09074],
        [70.0, 8.163, 0.09068],
        [70.5, 8.2651, 0.09062],
        [71.0, 8.3666, 0.09056],
        [71.5, 8.4676, 0.0905],
        [72.0, 8.5679, 0.09043],
        [72.5, 8.6674, 0.09037],
        [73.0, 8.7661, 0.09031],
        [73.5, 8.8638, 0.09025],
        [74.0, 8.9601, 0.09018],
        [74.5, 9.0552, 0.09012],
        [75.0, 9.149, 0.09005],
        [75.5, 9.2418, 0.08999],
        [76.0, 9.3337, 0.08992],
        [76.5, 9.4252, 0.08985],
        [77.0, 9.5166, 0.08979],
        [77.5, 9.6086, 0.08972],
        [78.0, 9.7015, 0.08965],
        [78.5, 9.7957, 0.08959],
        [79.0, 9.8915, 0.08952],
        [79.5, 9.9892, 0.08946],
        [80.0, 10.0891, 0.0894],
        [80.5, 10.1916, 0.08934],
        [81.0, 10.2965, 0.08928],
        [81.5, 10.4041, 0.08923],
        [82.0, 10.514, 0.08918],
        [82.5, 10.6263, 0.08914],
        [83.0, 10.741, 0.0891],
        [83.5, 10.8578, 0.08906],
        [84.0, 10.9767, 0.08903],
        [84.5, 11.0974, 0.089],
        [85.0, 11.2198, 0.08898],
        [85.5, 11.3435, 0.08897],
        [86.0, 11.4684, 0.08895],
        [86.5, 11.594, 0.08895],
        [87.0, 11.7201, 0.08895],
        [87.5, 11.8461, 0.08895],
        [88.0, 11.972, 0.08896],
        [88.5, 12.0976, 0.08898],
        [89.0, 12.2229, 0.089],
        [89.5, 12.3477, 0.08903],
        [90.0, 12.4723, 0.08906],
        [90.5, 12.5965, 0.08909],
        [91.0, 12.7205, 0.08913],
        [91.5, 12.8443, 0.08918],
        [92.0, 12.9681, 0.08923],
        [92.5, 13.092, 0.08928],
        [93.0, 13.2158, 0.08934],
        [93.5, 13.3399, 0.08941],
        [94.0, 13.4643, 0.08948],
        [94.5, 13.5892, 0.08955],
        [95.0, 13.7146, 0.08963],
        [95.5, 13.8408, 0.08972],
        [96.0, 13.9676, 0.08981],
        [96.5, 14.0953, 0.0899],
        [97.0, 14.2239, 0.09],
        [97.5, 14.3537, 0.0901],
        [98.0, 14.4848, 0.09021],
        [98.5, 14.6174, 0.09033],
        [99.0, 14.7519, 0.09044],
        [99.5, 14.8882, 0.09057],
        [100.0, 15.0267, 0.09069],
        [100.5, 15.1676, 0.09083],
        [101.0, 15.3108, 0.09096],
        [101.5, 15.4564, 0.0911],
        [102.0, 15.6046, 0.09125],
        [102.5, 15.7553, 0.09139],
        [103.0, 15.9087, 0.09155],
        [103.5, 16.0645, 0.0917],
        [104.0, 16.2229, 0.09186],
        [104.5, 16.3837, 0.09203],
        [105.0, 16.547, 0.09219],
        [105.5, 16.7129, 0.09236],
        [106.0, 16.8814, 0.09254],
        [106.5, 17.0527, 0.09271],
        [107.0, 17.2269, 0.09289],
        [107.5, 17.4039, 0.09307],
        [108.0, 17.5839, 0.09326],
        [108.5, 17.7668, 0.09344],
        [109.0, 17.9526, 0.09363],
        [109.5, 18.1412, 0.09382],
        [110.0, 18.3324, 0.09401],
      ]
    }
  };


  /**
   * Retrieves or interpolates WHO Weight-for-Length LMS parameters
   * for a specified length in centimeters (45.0 to 110.0 cm).
   */
  function getWflLMS(sex, lengthCm) {
    const s = normalizeSex(sex);
    const tableObj = WHO_WFL_TABLES[s] || WHO_WFL_TABLES.M;
    const L = tableObj.L;
    const pts = tableObj.points;
    const len = Number(lengthCm);
    if (len <= pts[0][0]) {
      return { L, M: pts[0][1], S: pts[0][2] };
    }
    if (len >= pts[pts.length - 1][0]) {
      const last = pts[pts.length - 1];
      return { L, M: last[1], S: last[2] };
    }
    const idx = (len - 45.0) / 0.5;
    const i0 = Math.floor(idx);
    const i1 = Math.min(pts.length - 1, i0 + 1);
    const frac = idx - i0;
    const M = pts[i0][1] * (1 - frac) + pts[i1][1] * frac;
    const S = pts[i0][2] * (1 - frac) + pts[i1][2] * frac;
    return {
      L: Math.round(L * 10000) / 10000,
      M: Math.round(M * 10000) / 10000,
      S: Math.round(S * 100000) / 100000
    };
  }

  /**
   * Calculates Weight-for-Length Z-score and Percentile using WHO standards (45–110 cm).
   * Returns: { zScore, percentile, percentileFormatted, status, statusClass, L, M, S, lengthCm }
   */
  function calculateWeightForLength(sex, lengthCm, weightKg) {
    const len = Number(lengthCm);
    const wt = Number(weightKg);

    if (len === null || len === undefined || isNaN(len) || len < 45 || len > 110) {
      return {
        percentile: null,
        zScore: null,
        percentileFormatted: null,
        status: 'Outside WHO Length Range (45–110 cm)',
        statusClass: 'neutral',
        L: null,
        M: null,
        S: null,
        lengthCm: isNaN(len) ? null : len
      };
    }

    if (wt === null || wt === undefined || isNaN(wt) || wt <= 0) {
      return {
        percentile: null,
        zScore: null,
        percentileFormatted: null,
        status: 'No Weight Recorded',
        statusClass: 'neutral',
        L: null,
        M: null,
        S: null,
        lengthCm: len
      };
    }

    const s = normalizeSex(sex);
    const { L, M, S } = getWflLMS(s, len);

    let z;
    if (Math.abs(L) > 1e-5) {
      z = (Math.pow(wt / M, L) - 1) / (L * S);
    } else {
      z = Math.log(wt / M) / S;
    }

    const clampedZ = Math.max(-4.5, Math.min(4.5, z));
    const percentile = Math.max(0.01, Math.min(99.99, normalCDF(clampedZ) * 100));
    const roundedPercentile = Math.round(percentile * 10) / 10;
    const percentileFormatted = formatOrdinal(percentile);

    let status, statusClass;
    if (percentile < 3) {
      status = 'Severely Underweight (<3rd %ile)';
      statusClass = 'danger';
    } else if (percentile < 5) {
      status = 'Low (<5th %ile)';
      statusClass = 'warning';
    } else if (percentile <= 85) {
      status = 'Healthy / Typical';
      statusClass = 'healthy';
    } else if (percentile <= 97) {
      status = 'High (85th–97th %ile)';
      statusClass = 'warning';
    } else {
      status = 'Elevated (>97th %ile)';
      statusClass = 'danger';
    }

    return {
      zScore: Math.round(clampedZ * 100) / 100,
      percentile: roundedPercentile,
      percentileFormatted,
      status,
      statusClass,
      L,
      M,
      S,
      lengthCm: Math.round(len * 10) / 10
    };
  }

  /**
   * Generates WHO Weight-for-Length percentile reference curves across 45–110 cm.
   * Returns: { lengths, p3, p15, p50, p85, p97, points }
   */
  function getWeightForLengthCurves(sex, stepCm = 1) {
    const s = normalizeSex(sex);
    const step = Math.max(0.5, Number(stepCm) || 1);
    const lengths = [];
    const p3 = [];
    const p15 = [];
    const p50 = [];
    const p85 = [];
    const p97 = [];
    const points = [];

    const pToZ = (p) => inverseNormalCDF(p / 100);
    const z3 = pToZ(3);
    const z15 = pToZ(15);
    const z85 = pToZ(85);
    const z97 = pToZ(97);

    const calcVal = (M, L, S, z) => {
      if (Math.abs(L) > 1e-5) {
        return Math.round(M * Math.pow(Math.max(1e-6, 1 + L * S * z), 1 / L) * 100) / 100;
      }
      return Math.round(M * Math.exp(S * z) * 100) / 100;
    };

    for (let l = 45; l <= 110 + 1e-5; l += step) {
      const len = Math.round(l * 10) / 10;
      const { L, M, S } = getWflLMS(s, len);
      const v3 = calcVal(M, L, S, z3);
      const v15 = calcVal(M, L, S, z15);
      const v50 = Math.round(M * 100) / 100;
      const v85 = calcVal(M, L, S, z85);
      const v97 = calcVal(M, L, S, z97);

      lengths.push(len);
      p3.push(v3);
      p15.push(v15);
      p50.push(v50);
      p85.push(v85);
      p97.push(v97);
      points.push({
        length: len,
        p3: v3,
        p15: v15,
        p50: v50,
        p85: v85,
        p97: v97,
        L,
        M,
        S
      });
    }

    return { lengths, p3, p15, p50, p85, p97, points };
  }

  // =========================================================================
  // 3. VALUE-ADD PEDIATRIC ANALYTICS
  // =========================================================================

  /**
   * Mid-Parental Target Height (Tanner Formula).
   * Boys:  (Father Height + Mother Height + 13 cm) / 2
   * Girls: (Father Height + Mother Height - 13 cm) / 2
   * Confidence Range: targetCm ± 8.5 cm (representing 2 SDs of genetic variability).
   * Calculates target percentile and Z-score at age 240 months (20 years).
   */
  function calculateMidParentalHeight(a, b, c) {
    let sex, fatherHeightCm, motherHeightCm;
    if (typeof a === 'number') {
      fatherHeightCm = a;
      motherHeightCm = b;
      sex = c;
    } else {
      sex = a;
      fatherHeightCm = b;
      motherHeightCm = c;
    }

    const fH = Number(fatherHeightCm);
    const mH = Number(motherHeightCm);
    if (!fH || !mH || fH < 100 || mH < 100) return null;

    const s = normalizeSex(sex);
    const delta = s === 'M' ? 13 : -13;
    const targetCm = Math.round(((fH + mH + delta) / 2) * 10) / 10;
    const minCm = Math.round((targetCm - 8.5) * 10) / 10;
    const maxCm = Math.round((targetCm + 8.5) * 10) / 10;

    const adultAnalysis = calculateZScoreAndPercentile(s, 'height', 240, targetCm);

    return {
      targetCm,
      minCm,
      maxCm,
      rangeMinCm: minCm,
      rangeMaxCm: maxCm,
      targetPercentile: adultAnalysis ? adultAnalysis.percentile : 50,
      targetZScore: adultAnalysis ? adultAnalysis.zScore : 0
    };
  }

  /**
   * Blended Adult Height Prediction.
   * Combines child's established LMS percentile channel with Tanner mid-parental height,
   * dynamically weighting child's channel higher as child approaches adult maturity.
   */
  function predictAdultHeight(child, parents) {
    if (!child) return null;
    const s = normalizeSex(child.sex);
    const measurements = (child.measurements || [])
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        return { ...m, ageMonths: age };
      })
      .filter(m => m.heightCm && Number(m.heightCm) > 0)
      .sort((a, b) => a.ageMonths - b.ageMonths);

    const hasParents = parents && parents.fatherHeightCm && parents.motherHeightCm;
    const midParental = hasParents ? calculateMidParentalHeight(s, parents.fatherHeightCm, parents.motherHeightCm) : null;

    if (measurements.length === 0) {
      if (midParental) {
        return {
          predictedCm: midParental.targetCm,
          midParentalCm: midParental.targetCm,
          confidenceRangeCm: [midParental.minCm, midParental.maxCm],
          currentHeightPercentile: midParental.targetPercentile,
          currentZScore: midParental.targetZScore,
          method: 'Tanner Mid-Parental Height Alone (No child measurements yet)'
        };
      }
      const p50Adult = valueFromPercentile(s, 'height', 240, 50);
      return {
        predictedCm: p50Adult,
        midParentalCm: null,
        confidenceRangeCm: [p50Adult - 8.5, p50Adult + 8.5],
        currentHeightPercentile: 50,
        currentZScore: 0,
        method: 'Population Median (50th Percentile) Projection'
      };
    }

    const latest = measurements[measurements.length - 1];
    const currentAnalysis = calculateZScoreAndPercentile(s, 'height', latest.ageMonths, latest.heightCm);
    const currentZ = currentAnalysis ? currentAnalysis.zScore : 0;
    const currentPct = currentAnalysis ? currentAnalysis.percentile : 50;

    const projectedLMSHeight = valueFromPercentile(s, 'height', 240, currentPct);

    let predictedCm;
    let midParentalCm = null;
    let method;
    let confidenceSpread;

    if (midParental) {
      midParentalCm = midParental.targetCm;
      // As child matures, child's own canalized trajectory progressively dominates parental expectation:
      // age 0m: weight ~35% child, 65% parents -> age 240m: weight 85% child, 15% parents
      const wChild = Math.min(0.85, Math.max(0.35, 0.35 + (latest.ageMonths / 240) * 0.50));
      const wParent = 1.0 - wChild;
      predictedCm = Math.round((projectedLMSHeight * wChild + midParental.targetCm * wParent) * 10) / 10;
      confidenceSpread = Math.max(3.8, Math.round((8.5 * (1 - (latest.ageMonths / 240) * 0.55)) * 10) / 10);
      method = 'Blended LMS Channel + Tanner Mid-Parental Projection';
    } else {
      predictedCm = Math.round(projectedLMSHeight * 10) / 10;
      confidenceSpread = Math.max(4.5, Math.round((9.5 * (1 - (latest.ageMonths / 240) * 0.50)) * 10) / 10);
      method = 'LMS Channel Canalization Projection';
    }

    return {
      predictedCm,
      midParentalCm,
      confidenceRangeCm: [
        Math.round((predictedCm - confidenceSpread) * 10) / 10,
        Math.round((predictedCm + confidenceSpread) * 10) / 10
      ],
      currentHeightPercentile: currentPct,
      currentZScore: currentZ,
      method
    };
  }

  /**
   * Reference height velocity norms (cm/year) by age in months.
   */
  function getTypicalHeightVelocity(ageMonths) {
    if (ageMonths <= 12) return 25.0; // Infancy: ~25 cm/yr
    if (ageMonths <= 24) return 12.0; // Year 2: ~12 cm/yr
    if (ageMonths <= 36) return 8.5;  // Toddler: ~8.5 cm/yr
    if (ageMonths <= 48) return 7.0;  // Preschool: ~7 cm/yr
    if (ageMonths <= 120) return 5.5; // School age: ~5.5 cm/yr
    if (ageMonths <= 168) return 8.0; // Pubertal spurt: ~8 cm/yr
    return 3.0; // Late teens deceleration
  }

  /**
   * Growth Velocity and Clinical Alerts Analysis.
   * Evaluates velocity across consecutive measurements (delta >= 0.5 months),
   * detects growth spurts and clinical channel shifts.
   */
  function analyzeGrowthVelocity(child) {
    if (!child || !child.measurements || child.measurements.length < 2) {
      return [];
    }

    const s = normalizeSex(child.sex);
    const sorted = [...child.measurements]
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        const rawH = m.heightCm ?? m.height;
        const rawW = m.weightKg ?? m.weight;
        const rawHc = m.headCircumferenceCm ?? m.headCm ?? m.head;
        return {
          ...m,
          ageMonths: age,
          heightCm: rawH !== undefined && rawH !== null ? Number(rawH) : null,
          weightKg: rawW !== undefined && rawW !== null ? Number(rawW) : null,
          headCircumferenceCm: rawHc !== undefined && rawHc !== null ? Number(rawHc) : null
        };
      })
      .sort((a, b) => a.ageMonths - b.ageMonths);

    const intervals = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const deltaMonths = curr.ageMonths - prev.ageMonths;

      // Ignore intervals that are too close (< 0.5 months) to avoid measurement noise
      if (deltaMonths < 0.5) continue;

      const interval = {
        prevDate: prev.date || null,
        currDate: curr.date || null,
        prevAgeMonths: Math.round(prev.ageMonths * 100) / 100,
        currAgeMonths: Math.round(curr.ageMonths * 100) / 100,
        deltaMonths: Math.round(deltaMonths * 100) / 100,
        alerts: []
      };

      // Height Velocity (cm/year)
      if (prev.heightCm && curr.heightCm) {
        const heightGainCm = curr.heightCm - prev.heightCm;
        interval.heightGainCm = Math.round(heightGainCm * 10) / 10;
        interval.heightVelocityCmPerYear = Math.round(((heightGainCm / deltaMonths) * 12) * 100) / 100;

        const prevH = calculateZScoreAndPercentile(s, 'height', prev.ageMonths, prev.heightCm);
        const currH = calculateZScoreAndPercentile(s, 'height', curr.ageMonths, curr.heightCm);
        if (prevH && currH) {
          interval.prevHeightPercentile = prevH.percentile;
          interval.currHeightPercentile = currH.percentile;
          interval.heightPercentileDelta = Math.round((currH.percentile - prevH.percentile) * 10) / 10;
        }
      }

      // Weight Velocity (kg/year and grams/day)
      if (prev.weightKg && curr.weightKg) {
        const weightGainKg = curr.weightKg - prev.weightKg;
        interval.weightGainKg = Math.round(weightGainKg * 100) / 100;
        interval.weightVelocityKgPerYear = Math.round(((weightGainKg / deltaMonths) * 12) * 100) / 100;
        interval.weightVelocityGramsPerDay = Math.round(((weightGainKg * 1000) / (deltaMonths * 30.4375)) * 10) / 10;

        const prevW = calculateZScoreAndPercentile(s, 'weight', prev.ageMonths, prev.weightKg);
        const currW = calculateZScoreAndPercentile(s, 'weight', curr.ageMonths, curr.weightKg);
        if (prevW && currW) {
          interval.prevWeightPercentile = prevW.percentile;
          interval.currWeightPercentile = currW.percentile;
          interval.weightPercentileDelta = Math.round((currW.percentile - prevW.percentile) * 10) / 10;
        }
      }

      // Growth Spurt Detection
      let isSpurt = false;
      const expectedNorm = getTypicalHeightVelocity(curr.ageMonths);
      if (interval.heightPercentileDelta !== undefined && interval.heightPercentileDelta > 10) {
        isSpurt = true;
      } else if (interval.heightVelocityCmPerYear && interval.heightVelocityCmPerYear > expectedNorm * 1.25) {
        isSpurt = true;
      }
      interval.isSpurt = isSpurt;
      interval.isGrowthSpurt = isSpurt;

      if (isSpurt) {
        interval.alerts.push({
          type: 'growth_spurt',
          severity: 'info',
          title: 'Growth Spurt Detected',
          message: `Height velocity of ${interval.heightVelocityCmPerYear} cm/yr (${interval.heightPercentileDelta > 0 ? '+' : ''}${interval.heightPercentileDelta}% channel gain).`
        });
      }

      // Clinical Alerts: Crossing major percentile lines (|deltaPct| >= 25)
      if (interval.heightPercentileDelta !== undefined && Math.abs(interval.heightPercentileDelta) >= 25) {
        interval.alerts.push({
          type: 'height_channel_shift',
          severity: 'warning',
          title: 'Height Channel Shift',
          message: `Height shifted by ${interval.heightPercentileDelta > 0 ? '+' : ''}${interval.heightPercentileDelta} percentile points (${formatOrdinal(interval.prevHeightPercentile)} → ${formatOrdinal(interval.currHeightPercentile)}).`
        });
      }

      if (interval.weightPercentileDelta !== undefined && Math.abs(interval.weightPercentileDelta) >= 25) {
        interval.alerts.push({
          type: 'weight_channel_shift',
          severity: 'warning',
          title: 'Weight Channel Shift',
          message: `Weight shifted by ${interval.weightPercentileDelta > 0 ? '+' : ''}${interval.weightPercentileDelta} percentile points (${formatOrdinal(interval.prevWeightPercentile)} → ${formatOrdinal(interval.currWeightPercentile)}).`
        });
      }

      if (interval.weightVelocityGramsPerDay !== undefined && interval.weightVelocityGramsPerDay < -2 && curr.ageMonths <= 24) {
        interval.alerts.push({
          type: 'weight_faltering',
          severity: 'danger',
          title: 'Weight Deceleration Notice',
          message: `Negative weight velocity of ${interval.weightVelocityGramsPerDay} g/day during early developmental window.`
        });
      }

      intervals.push(interval);
    }

    return intervals;
  }

  /**
   * Pediatric Clothing Size Mapping.
   * Maps height (cm) and weight (kg) to realistic US/EU children's apparel sizes.
   */

  /**
   * Pediatric European Height Size (centimeters).
   */
  function mapEuHeightSize(heightCm) {
    const h = Number(heightCm) || 0;
    const euSizes = [50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122, 128, 134, 140, 146, 152];
    for (const sz of euSizes) {
      if (h <= sz) return sz;
    }
    return 158;
  }

  /**
   * Pediatric Diaper / Underwear Size Progression Mapping.
   */
  function mapDiaperSize(weightKg, ageMonths) {
    const w = Number(weightKg) || 0;
    const a = Number(ageMonths) || 0;
    if (a >= 36 && w >= 15.0) return 'Potty Trained / 3T-4T Training Pants';
    if (w < 4.5) return 'Newborn (NB)';
    if (w < 6.4) return 'Size 1';
    if (w < 8.2) return 'Size 2';
    if (w < 11.0) return 'Size 3';
    if (w < 14.5) return 'Size 4';
    if (w < 17.0) return 'Size 5';
    if (w < 20.0) return 'Size 6';
    return 'Size 7 / Youth';
  }

  /**
   * 4-Season Apparel, Footwear & Diaper Forecaster.
   * Projects the child along their canalized LMS percentile trajectories
   * across 4 upcoming calendar quarters (+3m, +6m, +9m, +12m).
   */
  function forecastSeasonalSizing(child, referenceDateStr, includeCurrent = false) {
    if (!child) return [];
    const s = normalizeSex(child.sex);
    const measurements = (child.measurements || [])
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        return { ...m, ageMonths: age };
      })
      .sort((a, b) => a.ageMonths - b.ageMonths);

    let refDate;
    if (referenceDateStr) {
      refDate = new Date(referenceDateStr);
      if (isNaN(refDate.getTime())) refDate = new Date();
    } else if (measurements.length > 0 && measurements[measurements.length - 1].date) {
      refDate = new Date(measurements[measurements.length - 1].date);
      if (isNaN(refDate.getTime())) refDate = new Date();
    } else {
      refDate = new Date();
    }

    const latestWithHeight = [...measurements].reverse().find(m => m.heightCm && Number(m.heightCm) > 0);
    const latestWithWeight = [...measurements].reverse().find(m => m.weightKg && Number(m.weightKg) > 0);

    const latestAge = measurements.length > 0
      ? measurements[measurements.length - 1].ageMonths
      : (child.birthDate ? calculateAgeMonths(child.birthDate, refDate) : 12);

    const currentHeight = latestWithHeight ? Number(latestWithHeight.heightCm) : (s === 'F' ? 86 : 88);
    const currentWeight = latestWithWeight ? Number(latestWithWeight.weightKg) : (s === 'F' ? 11.5 : 12.2);

    const heightAnalysis = calculateZScoreAndPercentile(s, 'height', latestAge, currentHeight);
    const weightAnalysis = calculateZScoreAndPercentile(s, 'weight', latestAge, currentWeight);
    const currentHeightPct = heightAnalysis ? heightAnalysis.percentile : 50;
    const currentWeightPct = weightAnalysis ? weightAnalysis.percentile : 50;

    const offsets = includeCurrent ? [0, 3, 6, 9, 12] : [3, 6, 9, 12];

    const results = offsets.map(monthsAhead => {
      const targetDate = new Date(refDate.getTime());
      targetDate.setMonth(targetDate.getMonth() + monthsAhead);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const targetDateStr = `${yyyy}-${mm}-${dd}`;

      const mIdx = targetDate.getMonth();
      let seasonName;
      if (mIdx === 11 || mIdx === 0 || mIdx === 1) seasonName = 'Winter';
      else if (mIdx >= 2 && mIdx <= 4) seasonName = 'Spring';
      else if (mIdx >= 5 && mIdx <= 7) seasonName = 'Summer';
      else seasonName = 'Fall';

      const season = `${seasonName} ${yyyy}`;
      const projectedAgeMonths = Math.round((latestAge + monthsAhead) * 10) / 10;
      const projectedHeightCm = Math.round(valueFromPercentile(s, 'height', projectedAgeMonths, currentHeightPct) * 10) / 10;
      const projectedWeightKg = Math.round(valueFromPercentile(s, 'weight', projectedAgeMonths, currentWeightPct) * 10) / 10;

      const clothingSizeUS = mapClothingSize(projectedHeightCm, projectedWeightKg);
      const euHeightSize = mapEuHeightSize(projectedHeightCm);
      const shoeInfo = mapShoeSize(projectedAgeMonths);
      const diaperSize = mapDiaperSize(projectedWeightKg, projectedAgeMonths);

      return {
        season,
        monthsAhead,
        targetDate: targetDateStr,
        projectedAgeMonths,
        projectedHeightCm,
        projectedWeightKg,
        clothingSizeUS,
        euHeightSize,
        shoeSizeUS: shoeInfo.us,
        shoeSizeEU: shoeInfo.eu,
        diaperSize
      };
    });

    if (!includeCurrent) {
      const snapDateStr = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-${String(refDate.getDate()).padStart(2, '0')}`;
      const mIdx = refDate.getMonth();
      let snapSeasonName;
      if (mIdx === 11 || mIdx === 0 || mIdx === 1) snapSeasonName = 'Winter';
      else if (mIdx >= 2 && mIdx <= 4) snapSeasonName = 'Spring';
      else if (mIdx >= 5 && mIdx <= 7) snapSeasonName = 'Summer';
      else snapSeasonName = 'Fall';

      const shoeInfo = mapShoeSize(latestAge);
      results.current = {
        season: `${snapSeasonName} ${refDate.getFullYear()}`,
        monthsAhead: 0,
        targetDate: snapDateStr,
        projectedAgeMonths: Math.round(latestAge * 10) / 10,
        projectedHeightCm: Math.round(currentHeight * 10) / 10,
        projectedWeightKg: Math.round(currentWeight * 10) / 10,
        clothingSizeUS: mapClothingSize(currentHeight, currentWeight),
        euHeightSize: mapEuHeightSize(currentHeight),
        shoeSizeUS: shoeInfo.us,
        shoeSizeEU: shoeInfo.eu,
        diaperSize: mapDiaperSize(currentWeight, latestAge)
      };
    }

    return results;
  }

  function mapClothingSize(heightCm, weightKg) {
    const h = Number(heightCm) || 0;
    const w = Number(weightKg) || 0;

    if (h < 61 || w < 5.7) return '0-3M';
    if (h < 67 || w < 7.5) return '3-6M';
    if (h < 72 || w < 9.3) return '6-9M';
    if (h < 78 || w < 11.1) return '9-12M';
    if (h < 83 || w < 12.5) return '12-18M';
    if (h < 88 || w < 13.6) return '18-24M';
    if (h < 94 || w < 15.0) return '2T';
    if (h < 100 || w < 16.5) return '3T';
    if (h < 106 || w < 18.5) return '4T';
    if (h < 114 || w < 21.0) return '5T';
    if (h < 125 || w < 25.0) return 'Youth XS (6-7)';
    if (h < 136 || w < 32.0) return 'Youth S (8)';
    return 'Youth M (10-12)';
  }

  /**
   * Pediatric Shoe Size Progression Mapping.
   */
  function mapShoeSize(ageMonths) {
    const age = Number(ageMonths) || 0;
    if (age < 3) return { us: '0-1', eu: '15-16' };
    if (age < 6) return { us: '1-2', eu: '16-17' };
    if (age < 9) return { us: '2.5-3', eu: '18' };
    if (age < 12) return { us: '3.5-4', eu: '19-20' };
    if (age < 18) return { us: '4.5-5', eu: '20-21' };
    if (age < 24) return { us: '5.5-6', eu: '21-22' };
    if (age < 36) return { us: '7-8', eu: '23-24' };
    if (age < 48) return { us: '8.5-9.5', eu: '25-26' };
    if (age < 60) return { us: '10-11', eu: '27-28' };
    if (age < 72) return { us: '11.5-12.5', eu: '29-30' };
    if (age < 84) return { us: '13-1Y', eu: '31-32' };
    if (age < 108) return { us: '1.5Y-2.5Y', eu: '33-34' };
    if (age < 132) return { us: '3Y-4Y', eu: '35-36' };
    return { us: '4.5Y-6Y', eu: '37-38' };
  }

  /**
   * Predicts current and upcoming (+6 months) clothing and shoe sizes
   * tracking along the child's LMS canalization curve.
   */
  function estimateClothingAndShoeSize(child) {
    if (!child) return null;
    const s = normalizeSex(child.sex);
    const measurements = (child.measurements || [])
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        return { ...m, ageMonths: age };
      })
      .sort((a, b) => a.ageMonths - b.ageMonths);

    const latestWithHeight = [...measurements].reverse().find(m => m.heightCm && Number(m.heightCm) > 0);
    const latestWithWeight = [...measurements].reverse().find(m => m.weightKg && Number(m.weightKg) > 0);
    const latestAge = measurements.length > 0 ? measurements[measurements.length - 1].ageMonths : 0;

    const currentHeight = latestWithHeight ? Number(latestWithHeight.heightCm) : (s === 'F' ? 86 : 88);
    const currentWeight = latestWithWeight ? Number(latestWithWeight.weightKg) : (s === 'F' ? 11.5 : 12.2);

    const heightAnalysis = calculateZScoreAndPercentile(s, 'height', latestAge, currentHeight);
    const weightAnalysis = calculateZScoreAndPercentile(s, 'weight', latestAge, currentWeight);
    const currentHeightPct = heightAnalysis ? heightAnalysis.percentile : 50;
    const currentWeightPct = weightAnalysis ? weightAnalysis.percentile : 50;

    const currentClothingSize = mapClothingSize(currentHeight, currentWeight);
    const shoeInfo = mapShoeSize(latestAge);

    // Project 6 months ahead along LMS percentile trajectory
    const futureAge = latestAge + 6;
    const projectedHeightIn6Mo = valueFromPercentile(s, 'height', futureAge, currentHeightPct);
    const projectedWeightIn6Mo = valueFromPercentile(s, 'weight', futureAge, currentWeightPct);
    const nextClothingSize = mapClothingSize(projectedHeightIn6Mo, projectedWeightIn6Mo);
    const nextShoeInfo = mapShoeSize(futureAge);

    const insight = `At ${formatAge(latestAge)}, wearing size ${currentClothingSize} (Shoes: US ${shoeInfo.us} / EU ${shoeInfo.eu}). Tracking along the ${formatOrdinal(Math.round(currentHeightPct))} percentile, projected in 6 months (${formatAge(futureAge)}) to reach ~${projectedHeightIn6Mo.toFixed(1)} cm and ~${projectedWeightIn6Mo.toFixed(1)} kg, sizing into ${nextClothingSize} (Shoes: US ${nextShoeInfo.us}).`;

    return {
      currentClothingSize,
      nextClothingSize,
      projectedHeightIn6Mo: Math.round(projectedHeightIn6Mo * 10) / 10,
      projectedWeightIn6Mo: Math.round(projectedWeightIn6Mo * 10) / 10,
      currentShoeSizeUS: shoeInfo.us,
      currentShoeSizeEU: shoeInfo.eu,
      nextShoeSizeUS: nextShoeInfo.us,
      nextShoeSizeEU: nextShoeInfo.eu,
      insight
    };
  }

  /**
   * Corrected Age Calculation for Premature Infants.
   * Corrects chronological age for prematurity (< 37 weeks gestation) up to 24 months chronological age.
   * Prematurity deficit: (40 - gestationalWeeks) * 7 days.
   * 1 average month = 30.4375 days.
   */
  function calculateCorrectedAgeMonths(birthDateStr, measureDateStr, gestationalWeeks = 40) {
    const chronologicalMonths = calculateAgeMonths(birthDateStr, measureDateStr);
    const gWeeks = Number(gestationalWeeks) || 40;
    const isPremature = gWeeks < 37;
    const weeksPremature = Math.max(0, 40 - gWeeks);
    const isCorrectionApplied = isPremature && chronologicalMonths <= 24;

    let correctedMonths = chronologicalMonths;
    if (isPremature && chronologicalMonths <= 24) {
      correctedMonths = Math.max(0, chronologicalMonths - (weeksPremature * 7) / 30.4375);
    }
    correctedMonths = Math.round(correctedMonths * 100) / 100;

    const effectiveAgeMonths = isCorrectionApplied ? correctedMonths : chronologicalMonths;

    return {
      chronologicalMonths,
      correctedMonths,
      effectiveAgeMonths,
      isPremature,
      weeksPremature,
      isCorrectionApplied
    };
  }

  /**
   * Adiposity Rebound Analysis.
   * Evaluates BMI trajectory across infancy and childhood to detect timing of adiposity rebound.
   * Normal rebound occurs around 5–7 years (60–84 months).
   * Early rebound (< 5 years / < 60 months) is a significant pediatric risk factor for later obesity.
   */
  function analyzeAdiposityRebound(child) {
    if (!child || !child.measurements || child.measurements.length === 0) {
      return {
        status: 'Infant Growth Phase',
        latestBmi: null,
        latestBmiPercentile: null,
        infancyPeakBmi: null,
        nadirBmi: null,
        nadirAgeMonths: null,
        clinicalNote: 'No measurements available to evaluate BMI trajectory.'
      };
    }

    const s = normalizeSex(child.sex);
    const sorted = [...child.measurements]
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        const rawH = m.heightCm ?? m.height;
        const rawW = m.weightKg ?? m.weight;
        const h = rawH !== undefined && rawH !== null ? Number(rawH) : null;
        const w = rawW !== undefined && rawW !== null ? Number(rawW) : null;
        const bmi = (w && h && h > 0) ? calculateBMI(w, h) : (m.bmi ? Number(m.bmi) : null);
        return {
          ...m,
          ageMonths: age,
          bmi
        };
      })
      .filter(m => m.bmi !== null && !isNaN(m.bmi) && m.bmi > 0)
      .sort((a, b) => a.ageMonths - b.ageMonths);

    if (sorted.length === 0) {
      return {
        status: 'Infant Growth Phase',
        latestBmi: null,
        latestBmiPercentile: null,
        infancyPeakBmi: null,
        nadirBmi: null,
        nadirAgeMonths: null,
        clinicalNote: 'Insufficient height and weight records to compute BMI.'
      };
    }

    const latest = sorted[sorted.length - 1];
    const latestAnalysis = calculateZScoreAndPercentile(s, 'bmi', latest.ageMonths, latest.bmi);
    const latestBmiPercentile = latestAnalysis ? latestAnalysis.percentile : null;

    // Infancy peak: typically between 4 and 12 months (or within first 15 months)
    const infantPoints = sorted.filter(m => m.ageMonths <= 15);
    let infancyPeakBmi = null;
    if (infantPoints.length > 0) {
      infancyPeakBmi = Math.max(...infantPoints.map(p => p.bmi));
    }

    // Childhood nadir: lowest BMI after 12 months
    const postInfancyPoints = sorted.filter(m => m.ageMonths >= 12);
    let nadirBmi = null;
    let nadirAgeMonths = null;

    if (postInfancyPoints.length > 0) {
      let lowest = postInfancyPoints[0];
      for (const pt of postInfancyPoints) {
        if (pt.bmi < lowest.bmi) {
          lowest = pt;
        }
      }
      nadirBmi = lowest.bmi;
      nadirAgeMonths = Math.round(lowest.ageMonths * 10) / 10;
    }

    let status = 'Healthy Canalization';
    let clinicalNote = '';

    if (latest.ageMonths < 24) {
      status = 'Infant Growth Phase';
      clinicalNote = `Child is currently in normal physiologic infancy phase (${formatAge(latest.ageMonths)}). BMI typically increases during the first year of life and decreases during early childhood until the adiposity rebound.`;
    } else if (nadirAgeMonths !== null && nadirAgeMonths < 60 && sorted.length >= 3) {
      // Check if subsequent measurements show an upward trend after the nadir
      const postNadir = sorted.filter(m => m.ageMonths > nadirAgeMonths);
      const isReboundingEarly = postNadir.length > 0 && postNadir.some(m => m.bmi > nadirBmi + 0.5);
      if (isReboundingEarly || (latestBmiPercentile !== null && latestBmiPercentile >= 85)) {
        status = 'Early Rebound Watch';
        clinicalNote = `Adiposity nadir observed at ${formatAge(nadirAgeMonths)} (BMI ${nadirBmi}), followed by upward acceleration before 60 months. Early adiposity rebound (< 5.5 years) warrants monitoring of lifestyle and nutrition canalization.`;
      } else {
        status = 'Healthy Canalization';
        clinicalNote = `BMI tracking along expected pediatric canal (${latest.bmi} kg/m², ${latestBmiPercentile !== null ? formatOrdinal(latestBmiPercentile) : 'median'}). Nadir identified at ${formatAge(nadirAgeMonths)}.`;
      }
    } else {
      status = 'Healthy Canalization';
      clinicalNote = `Normal physiologic BMI progression observed (${latest.bmi} kg/m², ${latestBmiPercentile !== null ? formatOrdinal(latestBmiPercentile) : 'median'}). Growth canalization remains stable.`;
    }

    return {
      status,
      latestBmi: latest.bmi,
      latestBmiPercentile,
      infancyPeakBmi,
      nadirBmi,
      nadirAgeMonths,
      clinicalNote
    };
  }

  /**
   * AAP Bright Futures Well-Child Visit Schedule & Adherence Analytics.
   * Reference schedule milestones: 0, 1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60 months.
   */
  const AAP_WELL_CHILD_VISITS = [
    { ageMonths: 0, label: 'Newborn (3–5 days)', expectedMilestones: 'Regains birth weight by 10–14 days; tracks faces briefly', nutritionFocus: 'Exclusive breastfeeding or infant formula on demand' },
    { ageMonths: 1, label: '1 Month Visit', expectedMilestones: 'Lifts head briefly when on tummy; turns head toward familiar sounds', nutritionFocus: '8–12 nursing sessions per 24h or 2–3 oz formula q2–3h' },
    { ageMonths: 2, label: '2 Month Visit', expectedMilestones: 'Social smile, tracks objects across midline, coos and gurgles', nutritionFocus: 'Vitamin D supplementation (400 IU/day) for breastfed infants' },
    { ageMonths: 4, label: '4 Month Visit', expectedMilestones: 'Holds head steady unsupported; rolls tummy-to-back; laughs aloud', nutritionFocus: 'Watch for head control and oral readiness for solids around 4–6m' },
    { ageMonths: 6, label: '6 Month Visit', expectedMilestones: 'Sits with support, rolls both ways, transfers objects hand to hand', nutritionFocus: 'Introduction of iron-rich single-ingredient purees/cereals' },
    { ageMonths: 9, label: '9 Month Visit', expectedMilestones: 'Sits unsupported, crawls or scoots, developing pincer grasp, plays peek-a-boo', nutritionFocus: 'Finger foods, diverse allergen exposure (peanut, egg, dairy)' },
    { ageMonths: 12, label: '12 Month Visit', expectedMilestones: 'Pulls to stand, says "mama/dada" specifically, waves bye-bye, 2-finger pincer', nutritionFocus: 'Transition to whole pasteurized cow milk (or fortified plant milk), 16–24 oz max' },
    { ageMonths: 15, label: '15 Month Visit', expectedMilestones: 'Walks independently, drinks from open cup, uses 3–5 spoken words', nutritionFocus: 'Self-feeding finger foods, 3 meals plus 2 healthy scheduled snacks' },
    { ageMonths: 18, label: '18 Month Visit', expectedMilestones: 'Runs, climbs onto chair, scribbles, says 10–20 words, uses spoon', nutritionFocus: 'Structured meal seating, avoid juice, water as primary hydration' },
    { ageMonths: 24, label: '24 Month Visit (2 Years)', expectedMilestones: '2-word phrases ("want milk"), kicks ball, runs well, climbs stairs', nutritionFocus: 'Transition from whole milk to 1% or skim dairy; family table meals' },
    { ageMonths: 30, label: '30 Month Visit (2.5 Years)', expectedMilestones: 'Jumps with both feet, speaks in short sentences, washes hands', nutritionFocus: 'Balanced colorful plate, responsive feeding, avoid coercion' },
    { ageMonths: 36, label: '36 Month Visit (3 Years)', expectedMilestones: 'Pedals tricycle, dresses with help, speaks in 3–4 word sentences', nutritionFocus: 'Limiting added sugars (< 25g/day), family style mealtime modeling' },
    { ageMonths: 48, label: '48 Month Visit (4 Years)', expectedMilestones: 'Hops on one foot, draws person with 3 parts, sings song from memory', nutritionFocus: '5-2-1-0 framework (5 veggies/fruits, <2h screens, 1h activity, 0 sugary drinks)' },
    { ageMonths: 60, label: '60 Month Visit (5 Years)', expectedMilestones: 'Skips, ties knots, counts to 10+, articulates clearly, dresses independently', nutritionFocus: 'School readiness breakfast nutrition, physical activity habituation' }
  ];


  /**
   * Curated CDC / AAP Developmental Milestones Catalog (Birth to 5 Years).
   * 36 evidence-based milestones across motor, speech, cognitive, social, and growth.
   */
  function getCDCMilestoneCatalog() {
    return [
      { key: 'social_smile_2m', title: 'Smiles spontaneously / Social Smile', category: 'social', targetAgeMonths: 2, typicalWindow: '1.5–3m', description: 'Smiles in response to your smile, voice, or talking.' },
      { key: 'coos_vowels_2m', title: 'Coos & makes vowel sounds', category: 'speech', targetAgeMonths: 2, typicalWindow: '1.5–3m', description: 'Makes sounds other than crying (cooing, gurgling) when spoken to.' },
      { key: 'tracks_face_2m', title: 'Tracks movement & watches faces', category: 'cognitive', targetAgeMonths: 2, typicalWindow: '1.5–3m', description: 'Follows moving items with eyes across midline and focuses on faces.' },
      { key: 'holds_head_steady_4m', title: 'Holds head steady unsupported', category: 'motor', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Holds head erect without bobbing when held in an upright seated position.' },
      { key: 'laughs_aloud_4m', title: 'Chuckles & laughs out loud', category: 'speech', targetAgeMonths: 4, typicalWindow: '3–5m', description: 'Chuckles, chortles, or laughs out loud when you make playful faces or sounds.' },
      { key: 'rolls_tummy_back_4m', title: 'Rolls from tummy to back', category: 'motor', targetAgeMonths: 4, typicalWindow: '3–6m', description: 'Pushes up on elbows during tummy time and turns body over onto back.' },
      { key: 'reaches_for_toy_4m', title: 'Reaches out to grasp toy', category: 'cognitive', targetAgeMonths: 4, typicalWindow: '3.5–5.5m', description: 'Swipes and reaches out both hands to grasp a dangling rattle or toy.' },
      { key: 'rolls_both_ways_6m', title: 'Rolls in both directions', category: 'motor', targetAgeMonths: 6, typicalWindow: '4.5–7m', description: 'Rolls front-to-back and back-to-front fluidly.' },
      { key: 'babbles_consonants_6m', title: 'Babbles consonants (ba-ba, da-da)', category: 'speech', targetAgeMonths: 6, typicalWindow: '5–8m', description: 'Strings consonant-vowel sounds together like "ba-ba" and "da-da".' },
      { key: 'sits_with_support_6m', title: 'Sits with tripod hand support', category: 'motor', targetAgeMonths: 6, typicalWindow: '5–7.5m', description: 'Sits up propping hands forward on floor or in a high chair with minimal sway.' },
      { key: 'doubled_birth_weight_6m', title: 'Doubles birth weight', category: 'growth', targetAgeMonths: 6, typicalWindow: '4–6m', description: 'Physical body mass doubles from initial newborn birth weight.' },
      { key: 'sits_unsupported_9m', title: 'Sits without support', category: 'motor', targetAgeMonths: 9, typicalWindow: '6–10m', description: 'Sits independently for extended play without toppling over or needing hands.' },
      { key: 'pincer_grasp_9m', title: 'Developing pincer grasp', category: 'motor', targetAgeMonths: 9, typicalWindow: '7–10m', description: 'Uses index finger and thumb to pick up small pieces of food or small objects.' },
      { key: 'peek_a_boo_9m', title: 'Plays peek-a-boo & looks for hidden objects', category: 'social', targetAgeMonths: 9, typicalWindow: '7–10m', description: 'Shows understanding of object permanence; reacts playfully to peek-a-boo.' },
      { key: 'pulls_to_stand_12m', title: 'Pulls to stand & cruises furniture', category: 'motor', targetAgeMonths: 12, typicalWindow: '9–13m', description: 'Pulls up to a standing position using a couch or table and steps sideways.' },
      { key: 'first_words_12m', title: 'Says mama or dada specifically', category: 'speech', targetAgeMonths: 12, typicalWindow: '10–14m', description: 'Uses "mama" or "dada" with intention toward the correct parent.' },
      { key: 'waves_bye_12m', title: 'Waves bye-bye & gestures', category: 'social', targetAgeMonths: 12, typicalWindow: '9–13m', description: 'Waves hand or shakes head "no" in meaningful social communication.' },
      { key: 'tripled_birth_weight_12m', title: 'Triples birth weight', category: 'growth', targetAgeMonths: 12, typicalWindow: '10–14m', description: 'Healthy infant weight reaches approximately 3x initial birth measurement.' },
      { key: 'walks_independently_15m', title: 'Takes first independent steps / Walks alone', category: 'motor', targetAgeMonths: 15, typicalWindow: '11–16m', description: 'Walks forward across a room without holding onto furniture or hands.' },
      { key: 'drinks_open_cup_15m', title: 'Drinks from an open cup & uses spoon', category: 'motor', targetAgeMonths: 15, typicalWindow: '12–17m', description: 'Drinks sips from a small open cup held by adult or self with minimal spilling.' },
      { key: 'spoken_vocabulary_15m', title: 'Says 3 to 5 clear words', category: 'speech', targetAgeMonths: 15, typicalWindow: '12–18m', description: 'Speaks at least three distinct words other than mama/dada.' },
      { key: 'walks_up_steps_18m', title: 'Walks up steps & climbs on furniture', category: 'motor', targetAgeMonths: 18, typicalWindow: '15–20m', description: 'Walks up stairs with hand held or crawling up onto couch/chair independently.' },
      { key: 'vocabulary_10_words_18m', title: 'Uses 10+ words & points to body parts', category: 'speech', targetAgeMonths: 18, typicalWindow: '15–21m', description: 'Speaks ten or more distinct words and points when asked "where is your nose?".' },
      { key: 'scribbles_spontaneously_18m', title: 'Scribbles with crayon', category: 'motor', targetAgeMonths: 18, typicalWindow: '15–21m', description: 'Grasps crayon or pencil and scribbles on paper without demonstration.' },
      { key: 'two_word_phrases_24m', title: 'Combines two words together', category: 'speech', targetAgeMonths: 24, typicalWindow: '20–26m', description: 'Speaks two-word phrases like "more milk", "big dog", or "daddy go".' },
      { key: 'kicks_ball_24m', title: 'Kicks a ball forward', category: 'motor', targetAgeMonths: 24, typicalWindow: '20–26m', description: 'Kicks a large ball forward without losing balance or falling.' },
      { key: 'parallel_play_24m', title: 'Engages in parallel play with other kids', category: 'social', targetAgeMonths: 24, typicalWindow: '20–28m', description: 'Plays alongside other children happily and notices when someone is upset.' },
      { key: 'tricycle_pedals_36m', title: 'Pedals a tricycle / 3-wheel scooter', category: 'motor', targetAgeMonths: 36, typicalWindow: '30–40m', description: 'Pedals a tricycle using alternating feet around curves.' },
      { key: 'sentences_3_words_36m', title: 'Converses in 3–4 word sentences', category: 'speech', targetAgeMonths: 36, typicalWindow: '30–40m', description: 'Asks questions (who, what, where) and speaks in sentences strangers can mostly understand.' },
      { key: 'draws_circle_36m', title: 'Copies a circle & stacks 6+ blocks', category: 'cognitive', targetAgeMonths: 36, typicalWindow: '30–42m', description: 'Copies a circular drawing and builds towers of 6 to 8 blocks.' },
      { key: 'hops_one_foot_48m', title: 'Hops on one foot & catches bounced ball', category: 'motor', targetAgeMonths: 48, typicalWindow: '42–52m', description: 'Hops on a single foot for a couple hops and catches a bounced ball most times.' },
      { key: 'tells_stories_48m', title: 'Tells simple stories & sings rhymes', category: 'speech', targetAgeMonths: 48, typicalWindow: '42–52m', description: 'Recounts what happened during their day and repeats rhymes or popular nursery songs.' },
      { key: 'cooperative_play_48m', title: 'Plays cooperatively & takes turns', category: 'social', targetAgeMonths: 48, typicalWindow: '42–54m', description: 'Cooperates with other children in imaginative play, sharing and taking turns.' },
      { key: 'counts_to_ten_60m', title: 'Counts to 10 & recognizes simple shapes', category: 'cognitive', targetAgeMonths: 60, typicalWindow: '54–66m', description: 'Counts ten or more objects correctly and identifies basic geometric shapes.' },
      { key: 'dresses_independently_60m', title: 'Dresses and buttons clothing alone', category: 'motor', targetAgeMonths: 60, typicalWindow: '54–66m', description: 'Dresses without help, fastening large buttons and pulling on sneakers.' },
      { key: 'speaks_clearly_60m', title: 'Speaks clearly in complex sentences', category: 'speech', targetAgeMonths: 60, typicalWindow: '54–66m', description: 'Uses future and past tense; strangers understand 100% of speech.' }
    ];
  }

  /**
   * Comprehensive Clinical Deep-Dive Synthesis for a Single Child.
   * Returns: {
   *   latestStats,
   *   wflStats,
   *   channelStability: { metric, driftPctPoints, deltaZ, isCrossingChannels, summary },
   *   velocitySummary,
   *   catchUpStatus,
   *   milestoneProgress: { achievedCount, totalRelevant, dueCount, upcoming },
   *   adultPrediction,
   *   adiposityRebound,
   *   seasonalSizing,
   *   wellChildSchedule
   * }
   */
  function analyzeChildDeepDive(child, parents) {
    if (!child) return null;

    const s = normalizeSex(child.sex);
    const measurements = (child.measurements || [])
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (child.birthDate && m.date ? calculateAgeMonths(child.birthDate, m.date) : 0);
        return { ...m, ageMonths: age };
      })
      .sort((a, b) => a.ageMonths - b.ageMonths);

    const latestMeas = measurements.length > 0 ? measurements[measurements.length - 1] : null;

    const latestStats = latestMeas ? {
      measurement: latestMeas,
      height: statsForMeasurement(child, latestMeas, 'height'),
      weight: statsForMeasurement(child, latestMeas, 'weight'),
      head: statsForMeasurement(child, latestMeas, 'head'),
      bmi: statsForMeasurement(child, latestMeas, 'bmi')
    } : null;

    const wflStats = latestMeas && latestMeas.heightCm && latestMeas.weightKg
      ? calculateWeightForLength(s, latestMeas.heightCm, latestMeas.weightKg)
      : calculateWeightForLength(s, 0, 0);

    let driftPctPoints = 0;
    let deltaZ = 0;
    let isCrossingChannels = false;
    let summary = 'No measurements recorded yet to evaluate channel canalization.';

    if (measurements.length >= 2) {
      const firstMeas = measurements.find(m => m.heightCm && Number(m.heightCm) > 0) || measurements[0];
      const lastMeas = [...measurements].reverse().find(m => m.heightCm && Number(m.heightCm) > 0) || latestMeas;
      const statFirst = statsForMeasurement(child, firstMeas, 'height');
      const statLast = statsForMeasurement(child, lastMeas, 'height');

      if (statFirst && statLast && statFirst.zScore !== null && statLast.zScore !== null) {
        deltaZ = Math.round((statLast.zScore - statFirst.zScore) * 100) / 100;
        driftPctPoints = Math.round((statLast.percentile - statFirst.percentile) * 10) / 10;
        isCrossingChannels = Math.abs(deltaZ) >= 1.0 || Math.abs(driftPctPoints) >= 25;
        if (isCrossingChannels) {
          summary = `Growth trajectory shifted by ${driftPctPoints > 0 ? '+' : ''}${driftPctPoints} percentile points (ΔZ: ${deltaZ > 0 ? '+' : ''}${deltaZ} SD) across checkups. Channel crossing detected.`;
        } else {
          summary = `Consistent canalization tracking along the ${formatOrdinal(statLast.percentile)} percentile (ΔZ: ${deltaZ > 0 ? '+' : ''}${deltaZ} SD). Channel is stable.`;
        }
      }
    } else if (measurements.length === 1 && latestStats && latestStats.height) {
      summary = `Baseline visit recorded at the ${formatOrdinal(latestStats.height.percentile)} percentile (${latestStats.height.zScore > 0 ? '+' : ''}${latestStats.height.zScore} SD). Stability evaluated after 2+ checkups.`;
    }

    const channelStability = {
      metric: 'height',
      driftPctPoints,
      deltaZ,
      isCrossingChannels,
      summary
    };

    const velocitySummary = analyzeGrowthVelocity(child);

    const gWeeks = child.gestationalWeeks !== undefined && child.gestationalWeeks !== null
      ? Number(child.gestationalWeeks)
      : 40;
    const isPremature = gWeeks < 37;
    const latestAge = latestMeas ? latestMeas.ageMonths : (child.birthDate ? calculateAgeMonths(child.birthDate, new Date()) : 0);

    let catchUpStatus;
    if (isPremature) {
      const weeksPremature = Math.max(0, 40 - gWeeks);
      const correctedAgeMonths = Math.max(0, latestAge - (weeksPremature * 7) / 30.4375);
      const isComplete = latestAge >= 24;
      catchUpStatus = {
        isPremature: true,
        gestationalWeeks: gWeeks,
        weeksPremature,
        isCatchingUp: !isComplete,
        isCorrectionApplied: !isComplete,
        correctedAgeMonths: Math.round(correctedAgeMonths * 10) / 10,
        chronologicalAgeMonths: Math.round(latestAge * 10) / 10,
        summary: isComplete
          ? 'Prematurity catch-up complete (child reached 24 months). Standard chronological reference curves applied.'
          : `Gestational age correction active (${weeksPremature} weeks premature: corrected age ${Math.round(correctedAgeMonths * 10) / 10}m vs chronological ${Math.round(latestAge * 10) / 10}m).`
      };
    } else {
      catchUpStatus = {
        isPremature: false,
        gestationalWeeks: gWeeks,
        weeksPremature: 0,
        isCatchingUp: false,
        isCorrectionApplied: false,
        correctedAgeMonths: Math.round(latestAge * 10) / 10,
        chronologicalAgeMonths: Math.round(latestAge * 10) / 10,
        summary: 'Full-term birth (≥37 weeks). Standard growth curves applied.'
      };
    }

    const catalog = getCDCMilestoneCatalog();
    const childMilestones = Array.isArray(child.milestones) ? child.milestones : [];
    const achievedKeys = new Set(childMilestones.map(m => (m.key || m.title || '').trim().toLowerCase()));

    let achievedCount = childMilestones.length;
    let dueCount = 0;
    const upcoming = [];

    catalog.forEach(item => {
      const isAchieved = achievedKeys.has(item.key.toLowerCase()) || achievedKeys.has(item.title.toLowerCase());
      if (!isAchieved) {
        if (item.targetAgeMonths <= latestAge) {
          dueCount++;
        } else if (item.targetAgeMonths <= latestAge + 6) {
          upcoming.push(item);
        }
      }
    });

    const totalRelevant = catalog.filter(item => item.targetAgeMonths <= latestAge + 6).length;
    const milestoneProgress = {
      achievedCount,
      totalRelevant,
      dueCount,
      upcoming
    };

    const adultPrediction = predictAdultHeight(child, parents);
    const adiposityRebound = analyzeAdiposityRebound(child);
    const seasonalSizing = forecastSeasonalSizing(child);
    const wellChildSchedule = getWellChildSchedule(child);

    return {
      latestStats,
      wflStats,
      channelStability,
      velocitySummary,
      catchUpStatus,
      milestoneProgress,
      adultPrediction,
      adiposityRebound,
      seasonalSizing,
      wellChildSchedule
    };
  }

  function getWellChildSchedule(child) {
    if (!child) {
      return {
        completedCount: 0,
        totalStandardCount: AAP_WELL_CHILD_VISITS.length,
        adherencePercent: 0,
        nextVisit: null,
        schedule: []
      };
    }

    const birthDateStr = child.birthDate || child.dob;
    const bDate = birthDateStr ? new Date(birthDateStr) : null;
    const validBirth = bDate && !isNaN(bDate.getTime());

    // Calculate current age in months
    const today = new Date();
    const currentAgeMonths = validBirth
      ? Math.max(0, (today.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
      : 0;

    const measurements = (child.measurements || [])
      .map(m => {
        const age = m.ageMonths !== undefined && m.ageMonths !== null
          ? Number(m.ageMonths)
          : (birthDateStr && m.date ? calculateAgeMonths(birthDateStr, m.date) : 0);
        return { ...m, ageMonths: age };
      });

    const schedule = AAP_WELL_CHILD_VISITS.map(visit => {
      // Due date calculation
      let dueDate = null;
      if (validBirth) {
        const d = new Date(bDate.getTime() + visit.ageMonths * 30.4375 * 24 * 60 * 60 * 1000);
        dueDate = d.toISOString().split('T')[0];
      }

      // Check if any measurement matches this visit window
      // Allowed tolerance: +/- 1.5 months for early visits, +/- 3 months for visits >= 24m
      const tolerance = visit.ageMonths <= 12 ? 1.0 : (visit.ageMonths <= 24 ? 1.5 : 3.0);
      const matched = measurements.filter(m => Math.abs(m.ageMonths - visit.ageMonths) <= tolerance);

      const isCompleted = matched.length > 0;
      const isPastDue = !isCompleted && currentAgeMonths > (visit.ageMonths + tolerance);
      const isUpcoming = !isCompleted && !isPastDue;

      return {
        ageMonths: visit.ageMonths,
        label: visit.label,
        dueDate,
        expectedMilestones: visit.expectedMilestones,
        nutritionFocus: visit.nutritionFocus,
        isCompleted,
        isPastDue,
        isUpcoming,
        completedDate: matched.length > 0 ? (matched[0].date || null) : null,
        matchedMeasurementCount: matched.length
      };
    });

    const completedCount = schedule.filter(s => s.isCompleted).length;
    const totalStandardCount = AAP_WELL_CHILD_VISITS.length;
    const adherencePercent = Math.round((completedCount / totalStandardCount) * 100);

    // Identify next visit: first upcoming or past-due visit
    const nextVisitEntry = schedule.find(s => !s.isCompleted && s.ageMonths >= currentAgeMonths - 1)
      || schedule.find(s => !s.isCompleted)
      || null;

    const nextVisit = nextVisitEntry ? {
      ageMonths: nextVisitEntry.ageMonths,
      label: nextVisitEntry.label,
      dueDate: nextVisitEntry.dueDate,
      expectedMilestones: nextVisitEntry.expectedMilestones,
      nutritionFocus: nextVisitEntry.nutritionFocus
    } : null;

    return {
      completedCount,
      totalStandardCount,
      adherencePercent,
      nextVisit,
      schedule
    };
  }

  // =========================================================================
  // 4. UNIT CONVERSIONS AND PRESENTATION UTILITIES
  // =========================================================================

  const convertUnits = {
    kgToLb: (kg) => Math.round(Number(kg) * 2.20462262 * 100) / 100,

    lbToKg: (lb) => Math.round((Number(lb) / 2.20462262) * 100) / 100,

    kgToLbOz: (kg) => {
      const totalLb = Number(kg) * 2.20462262;
      const lb = Math.floor(totalLb);
      const oz = Math.round((totalLb - lb) * 16 * 10) / 10;
      return { lb, oz };
    },

    lbOzToKg: (lb, oz) => {
      const totalLb = (Number(lb) || 0) + (Number(oz) || 0) / 16;
      return Math.round((totalLb / 2.20462262) * 100) / 100;
    },

    cmToIn: (cm) => Math.round((Number(cm) / 2.54) * 100) / 100,

    inToCm: (inches) => Math.round(Number(inches) * 2.54 * 100) / 100,

    cmToFtIn: (cm) => {
      const totalIn = Number(cm) / 2.54;
      const ft = Math.floor(totalIn / 12);
      const inVal = Math.round((totalIn % 12) * 10) / 10;
      return { ft, in: inVal };
    },

    ftInToCm: (ft, inches) => {
      const totalIn = (Number(ft) || 0) * 12 + (Number(inches) || 0);
      return Math.round(totalIn * 2.54 * 100) / 100;
    },

    formatValue: (val, metric, unitSystem = 'metric') => {
      if (val === null || val === undefined || isNaN(val)) return '—';
      const num = Number(val);
      const m = normalizeMetric(metric);

      if (unitSystem === 'imperial') {
        if (m === 'weight') {
          const totalLb = num * 2.20462262;
          const lb = Math.floor(totalLb);
          const oz = Math.round((totalLb - lb) * 16 * 10) / 10;
          return `${lb} lb ${oz} oz`;
        }
        if (m === 'height') {
          const totalIn = num / 2.54;
          const ft = Math.floor(totalIn / 12);
          const inVal = Math.round((totalIn % 12) * 10) / 10;
          return `${totalIn.toFixed(1)} in (${ft}'${inVal}")`;
        }
        if (m === 'head') {
          const totalIn = num / 2.54;
          return `${totalIn.toFixed(1)} in`;
        }
        if (m === 'bmi') {
          return `${num.toFixed(1)} kg/m²`;
        }
      }

      // Default metric
      if (m === 'weight') return `${num.toFixed(1)} kg`;
      if (m === 'height') return `${num.toFixed(1)} cm`;
      if (m === 'head') return `${num.toFixed(1)} cm`;
      if (m === 'bmi') return `${num.toFixed(1)} kg/m²`;
      return `${num.toFixed(1)}`;
    }
  };

  // =========================================================================
  // 5. PUBLIC API EXPORT
  // =========================================================================

  const GrowthEngine = {
    CHILD_PALETTE,
    WHO_WFL_TABLES,
    getWflLMS,
    calculateWeightForLength,
    getWeightForLengthCurves,
    forecastSeasonalSizing,
    getCDCMilestoneCatalog,
    analyzeChildDeepDive,
    LMS_TABLES,
    getLMS,
    calculateAgeMonths,
    formatAge,
    calculateBMI,
    normalCDF,
    inverseNormalCDF,
    formatOrdinal,
    calculateZScoreAndPercentile,
    calculatePercentile,
    calculateZScore,
    valueFromPercentile,
    getPercentileCurves,
    calculateMidParentalHeight,
    calculateMidParentalTarget: calculateMidParentalHeight,
    predictAdultHeight,
    analyzeGrowthVelocity,
    estimateClothingAndShoeSize,
    calculateCorrectedAgeMonths,
    statsForMeasurement,
    analyzeAdiposityRebound,
    getWellChildSchedule,
    convertUnits,
    DISCLAIMER: 'Percentiles use WHO (0-2y) and CDC (2-20y) reference data for information only. Discuss your child\'s growth with their pediatrician.'
  };

  // Attach to window in browser environments
  if (typeof window !== 'undefined') {
    window.GrowthEngine = GrowthEngine;
  }

  // Export for CommonJS / Node testing environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GrowthEngine;
  }

  return GrowthEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
