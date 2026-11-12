/**
 * KinSprout - Interactive SVG & Canvas Visualizations
 * window.GrowthCharts (v2.0 Frontier Visualization Engine)
 *
 * Exposes high-DPI responsive canvas charts and interactive SVG wall comparator:
 * 1. renderPercentileChart(containerEl, child, metric, options)
 * 2. renderComparisonChart(containerEl, childA, childB, metric, mode, options)
 * 3. renderVelocityChart(containerEl, childA, childB, metric, options)
 * 4. renderSingleVelocityChart(containerEl, child, options)
 * 5. renderHeightWall(containerEl, childA, childB, ageMonthsOrCompData, options)
 * 6. renderWeightForLengthChart(containerEl, child, options)
 * 7. renderQuadOverviewGrid(containersMap, child, options)
 */

(function (global) {
  'use strict';

  // --- Palette & Typography ---
  const PALETTE = {
    leo: '#C85A32',
    maya: '#2E6F5E',
    amber: '#D97706',
    ink: '#1E2923',
    inkMuted: '#64748B',
    inkLight: '#94A3B8',
    grid: '#E2E8F0',
    gridSubtle: '#F1F5F9',
    bg: '#FAF8F5',
    cardBg: 'rgba(255, 255, 255, 0.96)',
    cardBorder: 'rgba(30, 41, 35, 0.1)',
    bands: {
      outer: 'rgba(200, 90, 50, 0.05)',
      mid: 'rgba(200, 90, 50, 0.09)',
      core: 'rgba(200, 90, 50, 0.14)',
      median: '#1E2923',
      outerMaya: 'rgba(46, 111, 94, 0.05)',
      midMaya: 'rgba(46, 111, 94, 0.09)',
      coreMaya: 'rgba(46, 111, 94, 0.14)'
    }
  };

  const FONTS = {
    body: '-apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Inter", "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  };

  function isDarkTheme() {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    if (typeof document.documentElement.getAttribute !== 'function') return false;
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function resolveThemeChildColor(rawHex, isDark) {
    if (!rawHex) return rawHex;
    if (isDark === undefined) isDark = isDarkTheme();
    if (!isDark) return rawHex;
    const hex = String(rawHex).toUpperCase();
    if (hex === '#C85A32') return '#F07D53';
    if (hex === '#2E6F5E' || hex === '#2D6A4F') return '#4CC3A5';
    if (hex === '#3B5BDB') return '#7494FF';
    if (hex === '#9C36B5') return '#D57EEB';
    if (hex === '#D97706') return '#FBBF24';
    if (hex === '#DB2777') return '#F472B6';
    return rawHex;
  }

  function getChartThemePalette() {
    const isDark = isDarkTheme();
    if (isDark) {
      return {
        isDark: true,
        ink: '#F2EFE9',
        inkMuted: '#9EAEAA',
        inkLight: '#7A8E88',
        grid: 'rgba(158, 174, 170, 0.14)',
        gridSubtle: 'rgba(158, 174, 170, 0.07)',
        bg: '#141C1A',
        cardBg: 'rgba(24, 32, 30, 0.96)',
        cardBorder: 'rgba(158, 174, 170, 0.22)',
        leo: '#F07D53',
        leoFill: 'rgba(240, 125, 83, 0.18)',
        maya: '#4CC3A5',
        mayaFill: 'rgba(76, 195, 165, 0.18)',
        amber: '#F59E0B',
        bands: {
          outer: 'rgba(76, 195, 165, 0.08)',
          mid: 'rgba(76, 195, 165, 0.16)',
          core: 'rgba(76, 195, 165, 0.24)',
          inner: 'rgba(76, 195, 165, 0.16)',
          median: '#E2ECE9',
          outerMaya: 'rgba(76, 195, 165, 0.08)',
          midMaya: 'rgba(76, 195, 165, 0.16)',
          coreMaya: 'rgba(76, 195, 165, 0.24)'
        },
        pointHalo: '#141C1A',
        emptyBannerBg: 'rgba(24, 32, 30, 0.92)',
        emptyBannerBorder: isDark ? 'rgba(158, 174, 170, 0.24)' : 'rgba(27, 38, 33, 0.12)',
        legendBg: 'rgba(24, 32, 30, 0.94)',
        legendBorder: 'rgba(158, 174, 170, 0.22)',
        crosshair: 'rgba(242, 239, 233, 0.45)',
        curveOuter: 'rgba(242, 239, 233, 0.20)',
        curveMid: 'rgba(242, 239, 233, 0.30)',
        curveMedian: 'rgba(242, 239, 233, 0.68)',
        zeroAxis: 'rgba(242, 239, 233, 0.38)',
        wallBg: '#141C1A',
        wallBorder: '#2D3B37',
        wallFloor: '#26211B',
        wallFloorStroke: '#3E362C',
        wallWoodStart: '#2D261F',
        wallWoodMid: '#251F19',
        wallWoodEnd: '#302921',
        wallTick: '#8C7A65',
        wallRulerText: '#9EAEAA',
        wallCardBg: '#202B28',
        wallShoe: '#D6D1C7'
      };
    }
    return {
      isDark: false,
      ink: PALETTE.ink,
      inkMuted: PALETTE.inkMuted,
      inkLight: PALETTE.inkLight,
      grid: PALETTE.grid,
      gridSubtle: PALETTE.gridSubtle,
      bg: PALETTE.bg,
      cardBg: PALETTE.cardBg,
      cardBorder: PALETTE.cardBorder,
      leo: PALETTE.leo,
      leoFill: 'rgba(200, 90, 50, 0.12)',
      maya: PALETTE.maya,
      mayaFill: 'rgba(46, 111, 94, 0.12)',
      amber: PALETTE.amber,
      bands: {
        outer: 'rgba(46, 111, 94, 0.06)',
        mid: 'rgba(46, 111, 94, 0.10)',
        core: 'rgba(46, 111, 94, 0.14)',
        inner: 'rgba(46, 111, 94, 0.12)',
        median: '#1E2923',
        outerMaya: 'rgba(46, 111, 94, 0.05)',
        midMaya: 'rgba(46, 111, 94, 0.09)',
        coreMaya: 'rgba(46, 111, 94, 0.14)'
      },
      pointHalo: '#FFFFFF',
      emptyBannerBg: 'rgba(255, 255, 255, 0.92)',
      emptyBannerBorder: isDark ? 'rgba(158, 174, 170, 0.24)' : 'rgba(27, 38, 33, 0.12)',
      legendBg: 'rgba(255, 255, 255, 0.94)',
      legendBorder: 'rgba(30, 41, 35, 0.12)',
      crosshair: 'rgba(30, 41, 35, 0.42)',
      curveOuter: 'rgba(30, 41, 35, 0.16)',
      curveMid: 'rgba(30, 41, 35, 0.24)',
      curveMedian: 'rgba(30, 41, 35, 0.58)',
      zeroAxis: 'rgba(30, 41, 35, 0.35)',
      wallBg: '#FAF8F5',
      wallBorder: '#E2E8F0',
      wallFloor: '#EAD9C4',
      wallFloorStroke: '#CBB499',
      wallWoodStart: '#F3E5D3',
      wallWoodMid: '#EEDCC5',
      wallWoodEnd: '#F7EADB',
      wallTick: '#A68A68',
      wallRulerText: '#6B543E',
      wallCardBg: '#FFFFFF',
      wallShoe: '#1E2923'
    };
  }

  const activeChartControllers = new Set();

  function redrawAllActiveCharts() {
    for (const ctrl of Array.from(activeChartControllers)) {
      if (!ctrl) continue;
      if (ctrl.containerEl && typeof document !== 'undefined' && typeof document.contains === 'function') {
        if (!document.contains(ctrl.containerEl)) {
          if (typeof ctrl.destroy === 'function') {
            try { ctrl.destroy(); } catch (e) {}
          }
          activeChartControllers.delete(ctrl);
          continue;
        }
      }
      if (typeof ctrl.redraw === 'function') {
        try {
          ctrl.redraw();
        } catch (e) {}
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('kinsprout:themechange', () => {
      redrawAllActiveCharts();
    });
    if (window.matchMedia) {
      try {
        const darkMql = window.matchMedia('(prefers-color-scheme: dark)');
        if (darkMql && typeof darkMql.addEventListener === 'function') {
          darkMql.addEventListener('change', () => {
            redrawAllActiveCharts();
          });
        }
      } catch (e) {}
    }
  }

  // --- WHO Weight-for-Length Reference Data (LMS at 5cm increments from 45 to 110 cm) ---
  const WHO_WFL_LMS = {
    M: [
      { len: 45, L: -0.352, M: 2.44, S: 0.088 },
      { len: 50, L: -0.352, M: 3.33, S: 0.089 },
      { len: 55, L: -0.352, M: 4.54, S: 0.089 },
      { len: 60, L: -0.352, M: 5.95, S: 0.089 },
      { len: 65, L: -0.352, M: 7.37, S: 0.088 },
      { len: 70, L: -0.352, M: 8.64, S: 0.087 },
      { len: 75, L: -0.352, M: 9.74, S: 0.087 },
      { len: 80, L: -0.352, M: 10.74, S: 0.086 },
      { len: 85, L: -0.352, M: 11.77, S: 0.086 },
      { len: 90, L: -0.352, M: 12.92, S: 0.087 },
      { len: 95, L: -0.352, M: 14.18, S: 0.088 },
      { len: 100, L: -0.352, M: 15.54, S: 0.090 },
      { len: 105, L: -0.352, M: 17.03, S: 0.092 },
      { len: 110, L: -0.352, M: 18.66, S: 0.094 }
    ],
    F: [
      { len: 45, L: -0.383, M: 2.47, S: 0.092 },
      { len: 50, L: -0.383, M: 3.23, S: 0.093 },
      { len: 55, L: -0.383, M: 4.31, S: 0.093 },
      { len: 60, L: -0.383, M: 5.61, S: 0.093 },
      { len: 65, L: -0.383, M: 6.96, S: 0.092 },
      { len: 70, L: -0.383, M: 8.21, S: 0.091 },
      { len: 75, L: -0.383, M: 9.30, S: 0.090 },
      { len: 80, L: -0.383, M: 10.28, S: 0.090 },
      { len: 85, L: -0.383, M: 11.33, S: 0.091 },
      { len: 90, L: -0.383, M: 12.51, S: 0.092 },
      { len: 95, L: -0.383, M: 13.81, S: 0.094 },
      { len: 100, L: -0.383, M: 15.21, S: 0.096 },
      { len: 105, L: -0.383, M: 16.71, S: 0.098 },
      { len: 110, L: -0.383, M: 18.35, S: 0.100 }
    ]
  };

  // --- Normative Expected Pediatric Growth Velocity Bands (WHO / AAP) ---
  const EXPECTED_VELOCITY = {
    height: {
      '0-6m': { min: 20, max: 28, median: 24 },
      '6-12m': { min: 12, max: 18, median: 15 },
      '12-18m': { min: 10, max: 14, median: 12 },
      '18-24m': { min: 8, max: 12, median: 10 },
      '2-3y': { min: 7, max: 10, median: 8.5 },
      '3-4y': { min: 6, max: 9, median: 7.5 },
      '4-5y': { min: 5, max: 8, median: 6.5 }
    },
    weight: {
      '0-6m': { min: 6.0, max: 9.0, median: 7.5 },
      '6-12m': { min: 3.5, max: 5.5, median: 4.5 },
      '12-18m': { min: 2.0, max: 3.5, median: 2.5 },
      '18-24m': { min: 1.5, max: 2.8, median: 2.0 },
      '2-3y': { min: 1.5, max: 2.5, median: 2.0 },
      '3-4y': { min: 1.5, max: 2.5, median: 2.0 },
      '4-5y': { min: 1.5, max: 2.5, median: 2.0 }
    },
    head: {
      '0-6m': { min: 10, max: 14, median: 12 },
      '6-12m': { min: 4, max: 7, median: 5.5 },
      '12-18m': { min: 2, max: 3.5, median: 2.8 },
      '18-24m': { min: 1.5, max: 2.5, median: 2.0 },
      '2-3y': { min: 1.0, max: 1.8, median: 1.4 },
      '3-4y': { min: 0.8, max: 1.4, median: 1.1 },
      '4-5y': { min: 0.6, max: 1.2, median: 0.9 }
    }
  };

  // --- Biometric Normalization & Metric Field Extraction Helpers ---
  function getMeasurementValue(m, metric) {
    if (!m) return null;
    if (metric === 'height') return m.heightCm ?? m.height ?? null;
    if (metric === 'weight') return m.weightKg ?? m.weight ?? null;
    if (metric === 'head') return m.headCircumferenceCm ?? m.headCm ?? m.head ?? null;
    if (metric === 'bmi') {
      if (m.bmi != null && !isNaN(m.bmi)) return Number(m.bmi);
      const w = m.weightKg ?? m.weight;
      const h = m.heightCm ?? m.height;
      if (w > 0 && h > 0) return Number((w / Math.pow(h / 100, 2)).toFixed(2));
      return null;
    }
    return m[metric] ?? null;
  }

  function normalizeSex(c) {
    if (!c) return 'M';
    const s = String(c.sex || c.gender || (typeof c === 'string' ? c : 'M')).toUpperCase();
    return (s.startsWith('F') || s === 'GIRL') ? 'F' : 'M';
  }

  function normalizeCurves(rawCurves) {
    if (!rawCurves) return null;
    const xKey = Array.isArray(rawCurves.lengths) ? 'lengths' : (Array.isArray(rawCurves.ages) ? 'ages' : null);
    if (xKey && (Array.isArray(rawCurves.p50) || Array.isArray(rawCurves.points))) {
      const keys = ['p3', 'p10', 'p15', 'p25', 'p50', 'p75', 'p85', 'p90', 'p97'];
      const xArr = rawCurves[xKey];
      const normalized = { ages: xArr, lengths: xArr };
      keys.forEach(k => {
        const arr = rawCurves[k] || [];
        if (arr.length > 0 && typeof arr[0] === 'number') {
          normalized[k] = xArr.map((xVal, idx) => ({
            age: xVal,
            len: xVal,
            lengthCm: xVal,
            value: arr[idx]
          }));
        } else if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
          normalized[k] = arr.map(pt => ({
            ...pt,
            len: pt.len ?? pt.lengthCm ?? pt.length ?? pt.age,
            lengthCm: pt.lengthCm ?? pt.len ?? pt.length ?? pt.age,
            age: pt.age ?? pt.len ?? pt.lengthCm ?? pt.length,
            value: pt.value ?? pt.val
          }));
        } else {
          normalized[k] = arr;
        }
      });
      return normalized;
    }
    // If already in object-array format: { p50: [{age, value}], ... }
    if (Array.isArray(rawCurves.p50) && rawCurves.p50.length > 0 && typeof rawCurves.p50[0] === 'object' && rawCurves.p50[0] !== null) {
      const normalized = { ...rawCurves };
      const keys = ['p3', 'p10', 'p15', 'p25', 'p50', 'p75', 'p85', 'p90', 'p97'];
      keys.forEach(k => {
        if (Array.isArray(normalized[k])) {
          normalized[k] = normalized[k].map(pt => ({
            ...pt,
            len: pt.len ?? pt.lengthCm ?? pt.length ?? pt.age,
            lengthCm: pt.lengthCm ?? pt.len ?? pt.length ?? pt.age,
            age: pt.age ?? pt.len ?? pt.lengthCm ?? pt.length,
            value: pt.value ?? pt.val
          }));
        }
      });
      return normalized;
    }
    return rawCurves;
  }

  function colorToRgba(colorStr, opacity) {
    if (!colorStr) return `rgba(200, 90, 50, ${opacity})`;
    if (colorStr.startsWith('#')) {
      let hex = colorStr.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    if (colorStr.startsWith('rgb(')) {
      return colorStr.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    }
    if (colorStr.startsWith('rgba(')) {
      return colorStr.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
    }
    return colorStr;
  }

  function calcStats(engine, sexOrChild, metric, ageMonths, val, optionalChild) {
    if (val === null || val === undefined || isNaN(val) || Number(val) <= 0) {
      return { zScore: NaN, percentile: NaN };
    }
    const childRef = (typeof sexOrChild === 'object' && sexOrChild !== null) ? sexOrChild : optionalChild;
    const s = normalizeSex(sexOrChild);
    if (engine && typeof engine.calculateZScoreAndPercentile === 'function') {
      try {
        const res = engine.calculateZScoreAndPercentile(s, metric, ageMonths, Number(val), childRef);
        if (res && res.percentile !== undefined) {
          return { zScore: res.zScore, percentile: res.percentile };
        }
      } catch (e) {
        // quiet fallback
      }
    }
    // Fallback if GrowthEngine not ready
    const z = calculateFallbackZScore(Number(val), metric, ageMonths, s);
    const pct = zScoreToPercentile(z);
    return { zScore: z, percentile: pct };
  }

  function getChildColor(child) {
    if (child && child.color) return resolveThemeChildColor(child.color);
    return (normalizeSex(child) === 'F') ? resolveThemeChildColor(PALETTE.maya) : resolveThemeChildColor(PALETTE.leo);
  }

  function getMetricUnits(metric, unitSystem) {
    const isImp = unitSystem === 'imperial';
    switch (metric) {
      case 'height':
        return isImp ? 'in' : 'cm';
      case 'weight':
        return isImp ? 'lb' : 'kg';
      case 'head':
        return isImp ? 'in' : 'cm';
      case 'bmi':
        return 'kg/m²';
      default:
        return '';
    }
  }

  function getMetricLabel(metric) {
    switch (metric) {
      case 'height': return 'Height';
      case 'weight': return 'Weight';
      case 'head': return 'Head Circumference';
      case 'bmi': return 'BMI';
      case 'wfl':
      case 'weight-for-length':
        return 'Weight-for-Length';
      default: return metric;
    }
  }

  function formatValue(val, metric, unitSystem) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const isImp = unitSystem === 'imperial';
    if (metric === 'height' || metric === 'head') {
      if (isImp) {
        const totalInches = val / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = (totalInches % 12).toFixed(1);
        return feet > 0 ? `${feet}′ ${inches}″` : `${inches}″`;
      }
      return `${Number(val).toFixed(1)} cm`;
    }
    if (metric === 'weight') {
      if (isImp) {
        return `${(val * 2.20462).toFixed(1)} lb`;
      }
      return `${Number(val).toFixed(2)} kg`;
    }
    if (metric === 'bmi') {
      return `${Number(val).toFixed(1)} kg/m²`;
    }
    return String(val);
  }

  function convertValueToDisplay(val, metric, unitSystem) {
    if (val === null || val === undefined || isNaN(val)) return val;
    const isImp = unitSystem === 'imperial';
    if (metric === 'height' || metric === 'head') {
      return isImp ? (val / 2.54) : val;
    }
    if (metric === 'weight') {
      return isImp ? (val * 2.20462) : val;
    }
    return val;
  }

  function formatDualValue(val, metric) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (metric === 'height' || metric === 'head') {
      const cmStr = `${Number(val).toFixed(1)} cm`;
      const totalInches = val / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = (totalInches % 12).toFixed(1);
      const impStr = feet > 0 ? `${feet}′ ${inches}″ (${totalInches.toFixed(1)} in)` : `${inches} in`;
      return `${cmStr} · ${impStr}`;
    }
    if (metric === 'weight') {
      const kgStr = `${Number(val).toFixed(2)} kg`;
      const lbStr = `${(val * 2.20462).toFixed(1)} lb`;
      return `${kgStr} · ${lbStr}`;
    }
    if (metric === 'bmi') {
      return `${Number(val).toFixed(1)} kg/m²`;
    }
    return String(val);
  }

  function formatAgeLabel(months, compact = false) {
    if (months === null || months === undefined || isNaN(months)) return '—';
    const m = Math.round(months * 10) / 10;
    if (compact) {
      if (m === 0) return '0m';
      if (m < 12) return `${m}m`;
      const yrs = Math.floor(m / 12);
      const rem = Math.round(m % 12);
      if (rem === 0) return `${yrs}y`;
      return `${yrs}y ${rem}m`;
    }
    if (m < 12) {
      return `${m} mo`;
    }
    const yrs = Math.floor(m / 12);
    const remMonths = Math.round(m % 12);
    if (remMonths === 0) return `${yrs} yr${yrs > 1 ? 's' : ''}`;
    return `${yrs}y ${remMonths}m`;
  }

  function formatFullAge(months) {
    if (months === null || months === undefined || isNaN(months)) return '—';
    const totalMonths = Math.floor(months);
    const days = Math.round((months - totalMonths) * 30.4375);
    const yrs = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    const parts = [];
    if (yrs > 0) parts.push(`${yrs} yr${yrs > 1 ? 's' : ''}`);
    if (m > 0 || yrs === 0) parts.push(`${m} mo${m !== 1 ? 's' : ''}`);
    if (days > 0 && yrs < 2) parts.push(`${days} d`);
    return parts.join(' ');
  }

  
  function safeFillRect(ctx, x, y, w, h) {
    if (typeof ctx.fillRect === "function") {
      ctx.fillRect(x, y, w, h);
    } else if (typeof ctx.rect === "function") {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
    }
  }

  function safeStrokeRect(ctx, x, y, w, h) {
    if (typeof ctx.strokeRect === "function") {
      ctx.strokeRect(x, y, w, h);
    } else if (typeof ctx.rect === "function") {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();
    }
  }

  function safeClip(ctx) {
    if (typeof ctx.clip === "function") {
      ctx.clip();
    }
  }

  function setupHighDPICanvas(canvas, width, height) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = Math.max(10, Math.round(width || 600));
    const h = Math.max(10, Math.round(height || 360));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (canvas.style) {
      canvas.style.display = 'block';
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    return { ctx, dpr };
  }

  function getSafeEngine() {
    if (typeof window !== 'undefined' && window.GrowthEngine) return window.GrowthEngine;
    if (typeof globalThis !== 'undefined' && globalThis.GrowthEngine) return globalThis.GrowthEngine;
    if (typeof require === 'function') {
      try {
        return require('./growth-engine.js');
      } catch (e) {}
    }
    return null;
  }

  function getSafeSiblingComparison() {
    if (typeof window !== 'undefined' && window.SiblingComparison) return window.SiblingComparison;
    if (typeof globalThis !== 'undefined' && globalThis.SiblingComparison) return globalThis.SiblingComparison;
    if (typeof require === 'function') {
      try {
        return require('./sibling-comparison.js');
      } catch (e) {}
    }
    return null;
  }

  // --- Fallback percentiles if GrowthEngine is not loaded yet ---
  function fallbackPercentileCurves(sex, metric, minAge = 0, maxAge = 60, step = 0.5) {
    const curves = { p3: [], p10: [], p25: [], p50: [], p75: [], p90: [], p97: [] };
    const isBoy = normalizeSex(sex) === 'M';
    for (let m = minAge; m <= maxAge + 0.001; m += step) {
      let median = 0;
      let spread = 0;
      if (metric === 'height') {
        const base = isBoy ? 50 : 49.2;
        const rate = isBoy ? 1.6 : 1.55;
        median = base + (m * rate * (1 - Math.min(0.8, m * 0.004)));
        spread = 2.0 + m * 0.05;
      } else if (metric === 'weight') {
        const base = isBoy ? 3.3 : 3.2;
        median = base + (m * 0.5 * (1 - Math.min(0.8, m * 0.003)));
        spread = 0.5 + m * 0.06;
      } else if (metric === 'head') {
        const base = isBoy ? 35 : 34.5;
        median = base + Math.sqrt(Math.max(0, m)) * 3.5;
        spread = 1.0 + m * 0.02;
      } else {
        median = 16.0 - (m * 0.015);
        spread = 1.2 + m * 0.02;
      }
      curves.p3.push({ age: m, value: median - 1.88 * spread });
      curves.p10.push({ age: m, value: median - 1.28 * spread });
      curves.p25.push({ age: m, value: median - 0.67 * spread });
      curves.p50.push({ age: m, value: median });
      curves.p75.push({ age: m, value: median + 0.67 * spread });
      curves.p90.push({ age: m, value: median + 1.28 * spread });
      curves.p97.push({ age: m, value: median + 1.88 * spread });
    }
    return curves;
  }

  function calculateFallbackZScore(val, metric, ageMonths, sex) {
    const isBoy = normalizeSex(sex) === 'M';
    let median = 50;
    let sd = 3;
    if (metric === 'height') {
      median = (isBoy ? 50 : 49.2) + ageMonths * 1.55;
      sd = 3.2;
    } else if (metric === 'weight') {
      median = (isBoy ? 3.3 : 3.2) + ageMonths * 0.45;
      sd = 1.2;
    } else if (metric === 'head') {
      median = (isBoy ? 35 : 34.5) + Math.sqrt(Math.max(0, ageMonths)) * 3.5;
      sd = 1.4;
    } else {
      median = 16.5;
      sd = 1.5;
    }
    const z = (val - median) / sd;
    return Math.max(-4, Math.min(4, z));
  }

  function zScoreToPercentile(z) {
    if (isNaN(z)) return 50;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const prob = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const p = z > 0 ? (1 - prob) * 100 : prob * 100;
    return Math.max(0.1, Math.min(99.9, p));
  }

  function getWflLMSFallback(sex, lengthCm) {
    const s = normalizeSex(sex);
    const table = WHO_WFL_LMS[s] || WHO_WFL_LMS.M;
    const lClamped = Math.max(45, Math.min(110, lengthCm));
    for (let i = 0; i < table.length - 1; i++) {
      if (lClamped >= table[i].len && lClamped <= table[i + 1].len) {
        const f = (lClamped - table[i].len) / (table[i + 1].len - table[i].len);
        return {
          L: table[i].L + f * (table[i + 1].L - table[i].L),
          M: table[i].M + f * (table[i + 1].M - table[i].M),
          S: table[i].S + f * (table[i + 1].S - table[i].S)
        };
      }
    }
    return table[table.length - 1];
  }

  function valueFromLMS(L, M, S, Z) {
    if (Math.abs(L) < 0.01) return M * Math.exp(S * Z);
    return M * Math.pow(Math.max(0.001, 1 + L * S * Z), 1 / L);
  }

  function zScoreFromLMS(L, M, S, value) {
    if (value <= 0) return -4;
    if (Math.abs(L) < 0.01) return Math.log(value / M) / S;
    return (Math.pow(value / M, L) - 1) / (L * S);
  }

  function getWeightForLengthCurvesFallback(sex, minLen = 45, maxLen = 110, step = 1) {
    const curves = { p3: [], p10: [], p15: [], p25: [], p50: [], p75: [], p85: [], p90: [], p97: [] };
    const zMap = {
      p3: -1.88,
      p10: -1.28,
      p15: -1.036,
      p25: -0.67,
      p50: 0,
      p75: 0.67,
      p85: 1.036,
      p90: 1.28,
      p97: 1.88
    };
    for (let len = minLen; len <= maxLen + 0.001; len += step) {
      const { L, M, S } = getWflLMSFallback(sex, len);
      Object.keys(zMap).forEach(k => {
        curves[k].push({ age: len, value: valueFromLMS(L, M, S, zMap[k]) });
      });
    }
    return curves;
  }

  // --- Smooth Spline Helper for Canvas ---
  function drawSpline(ctx, points, tension = 0.3) {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[0].x, points[0].y);
      return;
    }
    if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i !== points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  // --- Helper to interpolate measurement value from sorted list at age ---
  function interpValFromList(mList, metric, age) {
    if (!mList || mList.length === 0) return null;
    const pts = mList.map(m => ({
      age: m.ageMonths ?? m.age_months ?? 0,
      val: getMeasurementValue(m, metric)
    })).filter(p => p.val !== null && !isNaN(p.val));
    if (pts.length === 0) return null;
    if (pts.length === 1) return pts[0].val;
    if (age <= pts[0].age) return pts[0].val;
    if (age >= pts[pts.length - 1].age) return pts[pts.length - 1].val;
    for (let i = 0; i < pts.length - 1; i++) {
      if (age >= pts[i].age && age <= pts[i + 1].age) {
        const denom = pts[i + 1].age - pts[i].age;
        if (denom === 0) return pts[i].val;
        const f = (age - pts[i].age) / denom;
        return pts[i].val + f * (pts[i + 1].val - pts[i].val);
      }
    }
    return pts[pts.length - 1].val;
  }

  // --- HTML Tooltip Creator ---
  function createTooltip(containerEl, idPrefix = 'ks-tooltip') {
    if (typeof document === 'undefined') return null;
    let tooltip = containerEl.querySelector(`.${idPrefix}`);
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = idPrefix;
      tooltip.style.position = 'absolute';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.display = 'none';
      tooltip.style.zIndex = '50';
      tooltip.style.backgroundColor = 'var(--surface-elevated, rgba(255, 255, 255, 0.96))';
      tooltip.style.border = '1px solid var(--border-stone, rgba(30, 41, 35, 0.12))';
      tooltip.style.borderRadius = '10px';
      tooltip.style.padding = '10px 14px';
      tooltip.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)';
      tooltip.style.fontFamily = FONTS.body;
      tooltip.style.fontSize = '12px';
      tooltip.style.color = 'var(--ink-primary, #1B2621)';
      tooltip.style.backdropFilter = 'blur(8px)';
      tooltip.style.webkitBackdropFilter = 'blur(8px)';
      tooltip.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
      tooltip.style.maxWidth = '280px';
      containerEl.style.position = 'relative';
      containerEl.appendChild(tooltip);
    }
    return tooltip;
  }

  // --- Prior Visit Delta Helper ---
  function getPriorMeasurement(mList, targetMeasurementOrAge, metric) {
    if (!mList || mList.length === 0) return null;
    const valid = mList.filter(m => {
      const v = getMeasurementValue(m, metric);
      return v !== null && v !== undefined && !isNaN(v);
    }).sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0));

    if (valid.length === 0) return null;

    let targetAge = 0;
    if (typeof targetMeasurementOrAge === 'number') {
      targetAge = targetMeasurementOrAge;
    } else if (targetMeasurementOrAge && typeof targetMeasurementOrAge === 'object') {
      targetAge = targetMeasurementOrAge.ageMonths ?? targetMeasurementOrAge.age_months ?? 0;
    }

    let prior = null;
    for (let i = valid.length - 1; i >= 0; i--) {
      const a = valid[i].ageMonths ?? valid[i].age_months ?? 0;
      if (a < targetAge - 0.05) {
        prior = valid[i];
        break;
      }
    }
    return prior;
  }

  function formatPriorDelta(currentVal, currentAge, priorMeasurement, metric, unitSystem) {
    if (!priorMeasurement || currentVal === null || isNaN(currentVal)) return null;
    const priorVal = getMeasurementValue(priorMeasurement, metric);
    const priorAge = priorMeasurement.ageMonths ?? priorMeasurement.age_months ?? 0;
    if (priorVal === null || isNaN(priorVal)) return null;

    const diff = currentVal - priorVal;
    const dAge = currentAge - priorAge;
    const sign = diff >= 0 ? '+' : '';
    const diffStr = `${sign}${formatValue(diff, metric, unitSystem)}`;

    let rateStr = '';
    if (dAge > 0.1) {
      const ratePerMonth = diff / dAge;
      const rSign = ratePerMonth >= 0 ? '+' : '';
      const u = getMetricUnits(metric, unitSystem);
      rateStr = ` (${rSign}${Number(ratePerMonth.toFixed(2))} ${u}/mo)`;
    }
    return {
      priorAgeStr: formatAgeLabel(priorAge),
      diffStr,
      rateStr,
      fullText: `Δ from prior visit (${formatAgeLabel(priorAge)}): ${diffStr}${rateStr}`
    };
  }

  function resolveAgeRange(options = {}, latestAge = 24) {
    let minAge = 0;
    let maxAge = 24;

    const zoom = options.zoomPreset;
    if (zoom === '0-6m') {
      minAge = 0; maxAge = 6;
    } else if (zoom === '0-24m') {
      minAge = 0; maxAge = 24;
    } else if (zoom === '2-5y') {
      minAge = 24; maxAge = 60;
    } else if (zoom === '0-20y') {
      minAge = 0; maxAge = 240;
    } else if (options.ageRange && Array.isArray(options.ageRange)) {
      minAge = Math.max(0, Number(options.ageRange[0]) || 0);
      maxAge = Math.max(minAge + 0.5, Number(options.ageRange[1]) || 24);
    } else {
      if (options.minAgeMonths !== undefined) minAge = Math.max(0, Number(options.minAgeMonths) || 0);
      if (options.maxAgeMonths !== undefined) {
        maxAge = Math.max(minAge + 0.5, Number(options.maxAgeMonths) || 24);
      } else {
        if (latestAge <= 6) maxAge = 6;
        else if (latestAge <= 12) maxAge = 12;
        else if (latestAge <= 24) maxAge = 24;
        else if (latestAge <= 36) maxAge = 36;
        else if (latestAge <= 60) maxAge = 60;
        else maxAge = Math.ceil((latestAge + 6) / 12) * 12;
        maxAge = Math.max(maxAge, latestAge + 1);
      }
    }
    return { minAge, maxAge };
  }

  /**
   * 1. RENDER PERCENTILE CHART
   * WHO / CDC Percentile Fan Chart with optional Dual-Sibling ("Both") Overlay
   */
  function renderPercentileChart(containerEl, child, arg3, arg4) {
    if (!containerEl || typeof document === 'undefined') return null;
    let metric = 'height';
    let options = {};
    if (typeof arg3 === 'string') {
      metric = arg3;
      options = (arg4 && typeof arg4 === 'object') ? { ...arg4 } : {};
    } else if (arg3 && typeof arg3 === 'object') {
      options = { ...arg3 };
      metric = options.metric || 'height';
    } else if (arg4 && typeof arg4 === 'object') {
      options = { ...arg4 };
    }

    if (metric === 'wfl' || metric === 'weight-for-length' || metric === 'weight_for_length') {
      return renderWeightForLengthChart(containerEl, child, options);
    }

    const unitSystem = options.unitSystem || 'metric';
    const parents = options.parents || (child ? child.parents : null) || {};
    const showTargetHeight = options.showTargetHeight !== false;
    const compareChild = options.compareChild || null;
    const yMode = options.yMode || 'absolute'; // 'absolute' | 'percentile' | 'zscore'

    // Filter measurements that have this metric
    const measurements = ((child && child.measurements) || [])
      .filter(m => {
        const v = getMeasurementValue(m, metric);
        return v !== undefined && v !== null && !isNaN(v);
      })
      .sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0));

    const measurementsCompare = compareChild ? (((compareChild && compareChild.measurements) || [])
      .filter(m => {
        const v = getMeasurementValue(m, metric);
        return v !== undefined && v !== null && !isNaN(v);
      })
      .sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0))) : [];

    const latestAgeA = measurements.length ? (measurements[measurements.length - 1].ageMonths ?? measurements[measurements.length - 1].age_months ?? 24) : 24;
    const latestAgeB = measurementsCompare.length ? (measurementsCompare[measurementsCompare.length - 1].ageMonths ?? measurementsCompare[measurementsCompare.length - 1].age_months ?? 24) : 24;
    const latestAge = Math.max(latestAgeA, latestAgeB);

    const { minAge, maxAge } = resolveAgeRange(options, latestAge);

    // Setup DOM
    containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    const isMobile = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 640;
    const fixedH = options.height || parseInt(containerEl.style && containerEl.style.height, 10) || (isMobile ? 300 : (parseInt(containerEl.style && containerEl.style.minHeight, 10) || 380));
    wrapper.style.width = '100%';
    wrapper.style.height = fixedH + 'px';
    wrapper.style.minHeight = fixedH + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    containerEl.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    const tooltip = createTooltip(wrapper, 'ks-percentile-tooltip');

    // Curves from GrowthEngine or fallback
    const engine = getSafeEngine();
    const sex = normalizeSex(child);
    let curves = null;
    const curveStep = (maxAge - minAge) > 60 ? 1 : 0.5;

    if (engine && typeof engine.getPercentileCurves === 'function') {
      try {
        const raw = engine.getPercentileCurves(sex, metric, minAge, maxAge, curveStep);
        curves = normalizeCurves(raw);
      } catch (err) {
        // quiet fallback
      }
    }
    if (!curves || !curves.p50 || curves.p50.length === 0) {
      curves = fallbackPercentileCurves(sex, metric, minAge, maxAge, curveStep);
    }

    // Mid-parental target height calculation
    let targetHeightData = null;
    if (showTargetHeight && metric === 'height' && parents && (parents.fatherHeightCm || parents.father) && (parents.motherHeightCm || parents.mother)) {
      const fH = parents.fatherHeightCm || parents.father || 178;
      const mH = parents.motherHeightCm || parents.mother || 164;
      const s = normalizeSex(child);
      const mp = (engine && typeof engine.calculateMidParentalHeight === 'function')
        ? engine.calculateMidParentalHeight(s, fH, mH)
        : (engine && typeof engine.calculateMidParentalTarget === 'function')
          ? engine.calculateMidParentalTarget(fH, mH, s)
          : null;

      if (mp) {
        targetHeightData = {
          targetCm: mp.targetCm,
          minCm: mp.minCm ?? mp.rangeMinCm,
          maxCm: mp.maxCm ?? mp.rangeMaxCm
        };
      } else {
        const mid = s === 'F' ? ((fH - 13) + mH) / 2 : (fH + (mH + 13)) / 2;
        targetHeightData = { targetCm: mid, minCm: mid - 5, maxCm: mid + 5 };
      }
    }

    // Calculate Y domain based on yMode
    let minY = Infinity;
    let maxY = -Infinity;

    if (yMode === 'percentile') {
      minY = 0;
      maxY = 100;
    } else if (yMode === 'zscore') {
      minY = -3.5;
      maxY = 3.5;
    } else {
      // Absolute values
      ['p3', 'p10', 'p25', 'p50', 'p75', 'p90', 'p97'].forEach(k => {
        if (curves[k]) {
          curves[k].forEach(pt => {
            if (pt.age >= minAge && pt.age <= maxAge) {
              if (pt.value < minY) minY = pt.value;
              if (pt.value > maxY) maxY = pt.value;
            }
          });
        }
      });
      measurements.forEach(m => {
        const age = m.ageMonths ?? m.age_months ?? 0;
        if (age >= minAge - 1 && age <= maxAge + 1) {
          const v = getMeasurementValue(m, metric);
          if (v !== null && !isNaN(v)) {
            if (v < minY) minY = v;
            if (v > maxY) maxY = v;
          }
        }
      });
      if (compareChild) {
        measurementsCompare.forEach(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          if (age >= minAge - 1 && age <= maxAge + 1) {
            const v = getMeasurementValue(m, metric);
            if (v !== null && !isNaN(v)) {
              if (v < minY) minY = v;
              if (v > maxY) maxY = v;
            }
          }
        });
      }

      if (minY === Infinity) {
        minY = metric === 'height' ? 45 : metric === 'weight' ? 2 : 12;
        maxY = metric === 'height' ? 120 : metric === 'weight' ? 25 : 20;
      }
      const yPad = (maxY - minY) * 0.08;
      minY = Math.max(0, minY - yPad);
      maxY = maxY + yPad;
    }

    let childColor = getChildColor(child);
    let compareColor = compareChild ? getChildColor(compareChild) : null;

    let chartWidth = 0;
    let chartHeight = 0;
    const padding = { top: 34, right: 54, bottom: 44, left: 54 };
    let externalCrosshairAge = null;

    function toScreenX(age) {
      const ageSpan = Math.max(0.1, maxAge - minAge);
      return padding.left + ((age - minAge) / ageSpan) * (chartWidth - padding.left - padding.right);
    }
    function fromScreenX(sx) {
      const ratio = (sx - padding.left) / Math.max(1, chartWidth - padding.left - padding.right);
      return Math.max(minAge, Math.min(maxAge, minAge + ratio * (maxAge - minAge)));
    }
    function toScreenY(val) {
      const ySpan = Math.max(0.01, maxY - minY);
      return (chartHeight - padding.bottom) - ((val - minY) / ySpan) * (chartHeight - padding.top - padding.bottom);
    }
    function fromScreenY(sy) {
      const ratio = ((chartHeight - padding.bottom) - sy) / Math.max(1, chartHeight - padding.top - padding.bottom);
      return minY + ratio * (maxY - minY);
    }

    function getPointYVal(m, ch) {
      const v = getMeasurementValue(m, metric);
      const age = m.ageMonths ?? m.age_months ?? 0;
      if (v === null || isNaN(v)) return 0;
      if (yMode === 'percentile') {
        const stats = calcStats(engine, ch, metric, age, v);
        return isNaN(stats.percentile) ? 50 : stats.percentile;
      }
      if (yMode === 'zscore') {
        const stats = calcStats(engine, ch, metric, age, v);
        return isNaN(stats.zScore) ? 0 : stats.zScore;
      }
      return v;
    }

    function draw() {
      const pal = getChartThemePalette();
      childColor = getChildColor(child);
      compareColor = compareChild ? getChildColor(compareChild) : null;

      const rect = (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect()) || {};
      chartWidth = rect.width || 600;
      chartHeight = rect.height || 360;

      if (chartWidth < 420) {
        padding.top = 28;
        padding.right = 38;
        padding.bottom = 40;
        padding.left = 48;
      } else {
        padding.top = 34;
        padding.right = 54;
        padding.bottom = 44;
        padding.left = 54;
      }

      const { ctx } = setupHighDPICanvas(canvas, chartWidth, chartHeight);

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 1. Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.gridSubtle;

      // X grid
      const isMobileChart = chartWidth < 420;
      const plotW = Math.max(80, chartWidth - padding.left - padding.right);
      const maxTicks = Math.max(4, Math.floor(plotW / 46));
      const ageSpan = maxAge - minAge;
      const stepCandidates = [1, 2, 3, 6, 12, 24, 36, 48, 60];
      let xStep = 12;
      for (let i = 0; i < stepCandidates.length; i++) {
        const cand = stepCandidates[i];
        if (Math.ceil(ageSpan / cand) <= maxTicks) {
          xStep = cand;
          break;
        }
        xStep = cand;
      }

      ctx.font = `11px ${FONTS.mono}`;
      ctx.fillStyle = pal.inkLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const firstX = Math.ceil(minAge / xStep) * xStep;
      for (let age = firstX; age <= maxAge; age += xStep) {
        const sx = toScreenX(age);
        ctx.beginPath();
        ctx.strokeStyle = (age % 12 === 0) ? pal.grid : pal.gridSubtle;
        ctx.moveTo(sx, padding.top);
        ctx.lineTo(sx, chartHeight - padding.bottom);
        ctx.stroke();

        ctx.fillText(formatAgeLabel(age, isMobileChart), sx, chartHeight - padding.bottom + 8);
      }

      ctx.font = `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText('Age', chartWidth / 2, chartHeight - 14);

      // Y grid
      if (yMode === 'percentile') {
        // Percentile bands background
        const isDark = isDarkTheme();
        const bOuter = colorToRgba(childColor, isDark ? 0.08 : 0.05);
        const bMid = colorToRgba(childColor, isDark ? 0.16 : 0.09);
        const bCore = colorToRgba(childColor, isDark ? 0.24 : 0.14);

        const fillPctBand = (pLow, pHigh, col) => {
          const syTop = toScreenY(pHigh);
          const syBot = toScreenY(pLow);
          ctx.fillStyle = col;
          safeFillRect(ctx, padding.left, syTop, chartWidth - padding.left - padding.right, syBot - syTop);
        };

        fillPctBand(3, 97, bOuter);
        fillPctBand(10, 90, bMid);
        fillPctBand(25, 75, bCore);

        const pctTicks = [3, 10, 25, 50, 75, 90, 97];
        pctTicks.forEach(p => {
          const sy = toScreenY(p);
          ctx.beginPath();
          ctx.strokeStyle = p === 50 ? pal.curveMedian : pal.grid;
          ctx.lineWidth = p === 50 ? 1.5 : 1;
          ctx.setLineDash(p === 50 ? [] : [3, 3]);
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = p === 50 ? `bold 10px ${FONTS.mono}` : `9px ${FONTS.mono}`;
          ctx.fillStyle = p === 50 ? pal.ink : pal.inkLight;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${p}%`, padding.left - 6, sy);

          // Right label
          ctx.textAlign = 'left';
          ctx.fillText(`${p}th`, chartWidth - padding.right + 6, sy);
        });
      } else if (yMode === 'zscore') {
        const isDark = isDarkTheme();
        const bMid = colorToRgba(childColor, isDark ? 0.12 : 0.07);
        const bCore = colorToRgba(childColor, isDark ? 0.20 : 0.13);

        const z2Sy = toScreenY(2);
        const zMinus2Sy = toScreenY(-2);
        const z1Sy = toScreenY(1);
        const zMinus1Sy = toScreenY(-1);

        ctx.fillStyle = bMid;
        safeFillRect(ctx, padding.left, z2Sy, chartWidth - padding.left - padding.right, zMinus2Sy - z2Sy);
        ctx.fillStyle = bCore;
        safeFillRect(ctx, padding.left, z1Sy, chartWidth - padding.left - padding.right, zMinus1Sy - z1Sy);

        const zTicks = [-3, -2, -1, 0, 1, 2, 3];
        zTicks.forEach(z => {
          const sy = toScreenY(z);
          ctx.beginPath();
          ctx.strokeStyle = z === 0 ? pal.zeroAxis : pal.grid;
          ctx.lineWidth = z === 0 ? 1.5 : 1;
          ctx.setLineDash(z === 0 ? [] : [3, 3]);
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = z === 0 ? `bold 10px ${FONTS.mono}` : `9px ${FONTS.mono}`;
          ctx.fillStyle = z === 0 ? pal.ink : pal.inkLight;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${z > 0 ? '+' : ''}${z} SD`, padding.left - 6, sy);
        });
      } else {
        // Absolute Y grid
        const ySpan = maxY - minY;
        const rawStep = ySpan / 6;
        let yStep = Math.pow(10, Math.floor(Math.log10(rawStep)));
        if (rawStep / yStep > 5) yStep *= 5;
        else if (rawStep / yStep > 2) yStep *= 2;
        if (yStep <= 0) yStep = 1;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const firstY = Math.ceil(minY / yStep) * yStep;

        for (let yVal = firstY; yVal <= maxY; yVal += yStep) {
          const sy = toScreenY(yVal);
          ctx.beginPath();
          ctx.strokeStyle = pal.gridSubtle;
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();

          const disp = unitSystem === 'imperial'
            ? (metric === 'height' || metric === 'head' ? (yVal / 2.54).toFixed(0) : (yVal * 2.20462).toFixed(0))
            : yVal.toFixed(yStep < 1 ? 1 : 0);
          ctx.fillStyle = pal.inkLight;
          ctx.font = `10px ${FONTS.mono}`;
          ctx.fillText(disp, padding.left - 8, sy);
        }

        // Fan Bands in Absolute mode
        function fillBand(curveLow, curveHigh, color) {
          if (!curveLow || !curveHigh || curveLow.length === 0) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
          safeClip(ctx);

          ctx.beginPath();
          const ptsHigh = curveHigh.filter(p => p.age >= minAge - 0.5 && p.age <= maxAge + 0.5).map(p => ({ x: toScreenX(p.age), y: toScreenY(p.value) }));
          const ptsLow = curveLow.filter(p => p.age >= minAge - 0.5 && p.age <= maxAge + 0.5).map(p => ({ x: toScreenX(p.age), y: toScreenY(p.value) }));

          if (ptsHigh.length && ptsLow.length) {
            drawSpline(ctx, ptsHigh, 0.2);
            for (let i = ptsLow.length - 1; i >= 0; i--) {
              ctx.lineTo(ptsLow[i].x, ptsLow[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
          }
          ctx.restore();
        }

        const isDark = isDarkTheme();
        const bOuter = colorToRgba(childColor, isDark ? 0.08 : 0.05);
        const bMid = colorToRgba(childColor, isDark ? 0.16 : 0.09);
        const bCore = colorToRgba(childColor, isDark ? 0.24 : 0.14);

        fillBand(curves.p3, curves.p97, bOuter);
        fillBand(curves.p10, curves.p90, bMid);
        fillBand(curves.p25, curves.p75, bCore);

        // Percentile Curve Lines
        function drawCurveLine(curve, strokeStyle, lineWidth = 1, isDashed = false) {
          if (!curve || curve.length === 0) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
          safeClip(ctx);

          ctx.beginPath();
          if (isDashed) ctx.setLineDash([4, 4]);
          else ctx.setLineDash([]);
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;
          const pts = curve.filter(p => p.age >= minAge - 0.5 && p.age <= maxAge + 0.5).map(p => ({ x: toScreenX(p.age), y: toScreenY(p.value) }));
          drawSpline(ctx, pts, 0.2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }

        drawCurveLine(curves.p3, pal.curveOuter, 1, true);
        drawCurveLine(curves.p10, pal.curveMid, 1, true);
        drawCurveLine(curves.p25, pal.curveMid, 1, true);
        drawCurveLine(curves.p50, pal.curveMedian, 1.5, false);
        drawCurveLine(curves.p75, pal.curveMid, 1, true);
        drawCurveLine(curves.p90, pal.curveMid, 1, true);
        drawCurveLine(curves.p97, pal.curveOuter, 1, true);

        // Direct Right-Edge Labels
        const rightLabels = [
          { key: 'p97', text: '97th' },
          { key: 'p90', text: '90th' },
          { key: 'p75', text: '75th' },
          { key: 'p50', text: '50th' },
          { key: 'p25', text: '25th' },
          { key: 'p10', text: '10th' },
          { key: 'p3', text: '3rd' }
        ];

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        rightLabels.forEach(({ key, text }) => {
          const arr = curves[key];
          if (arr && arr.length) {
            const visible = arr.filter(p => p.age <= maxAge);
            const last = visible.length ? visible[visible.length - 1] : arr[arr.length - 1];
            if (last) {
              const lx = chartWidth - padding.right + 6;
              const ly = toScreenY(last.value);
              ctx.font = key === 'p50' ? `bold 10px ${FONTS.mono}` : `9px ${FONTS.mono}`;
              ctx.fillStyle = key === 'p50' ? pal.ink : pal.inkMuted;
              ctx.fillText(text, lx, ly);
            }
          }
        });
      }

      // Y Axis Unit Label
      ctx.save();
      ctx.translate(chartWidth < 420 ? 11 : 14, chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = chartWidth < 420 ? `10px ${FONTS.body}` : `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      const yAxisTitle = yMode === 'percentile' ? `${getMetricLabel(metric)} Percentile (%)`
        : yMode === 'zscore' ? `${getMetricLabel(metric)} Z-Score (SD)`
        : `${getMetricLabel(metric)} (${getMetricUnits(metric, unitSystem)})`;
      ctx.fillText(yAxisTitle, 0, 0);
      ctx.restore();

      // Mid-parental target projection (height only, absolute mode)
      if (yMode === 'absolute' && targetHeightData && maxAge >= 36) {
        const targetSy = toScreenY(targetHeightData.targetCm);
        const minSy = toScreenY(targetHeightData.minCm ?? targetHeightData.rangeMinCm);
        const maxSy = toScreenY(targetHeightData.maxCm ?? targetHeightData.rangeMaxCm);
        const targetStartX = toScreenX(Math.max(minAge, maxAge - 6));
        const targetEndX = chartWidth - padding.right;

        if (targetEndX > targetStartX) {
          ctx.fillStyle = 'rgba(217, 119, 6, 0.12)';
          safeFillRect(ctx, targetStartX, maxSy, targetEndX - targetStartX, minSy - maxSy);

          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = pal.amber;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(targetStartX, targetSy);
          ctx.lineTo(targetEndX, targetSy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = `9px ${FONTS.body}`;
          ctx.fillStyle = pal.amber;
          ctx.textAlign = 'right';
          ctx.fillText('Target', targetStartX - 4, targetSy);
        }
      }

      // Draw Child Measurements
      function drawMeasurementsCurve(mList, color, ch) {
        if (!mList || mList.length === 0) return [];
        const visibleM = mList.filter(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          return age >= minAge - 1 && age <= maxAge + 1;
        });
        if (visibleM.length === 0) return [];

        const pts = visibleM.map(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          const yVal = getPointYVal(m, ch);
          const val = getMeasurementValue(m, metric);
          return {
            x: toScreenX(age),
            y: toScreenY(yVal),
            age,
            val,
            yVal,
            m,
            date: m.date || m.visitDate,
            photoImport: Boolean(m.photoImport || m.source === 'photo' || m.importedFromPhoto)
          };
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
        safeClip(ctx);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        drawSpline(ctx, pts, 0.25);
        ctx.stroke();

        pts.forEach(pt => {
          if (pt.photoImport) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
            ctx.strokeStyle = pal.amber;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pt.x + 7, pt.y - 7, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = pal.amber;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = pal.pointHalo;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });

        ctx.restore();
        return pts;
      }

      drawMeasurementsCurve(measurements, childColor, child);

      if (compareChild && measurementsCompare.length > 0) {
        drawMeasurementsCurve(measurementsCompare, compareColor, compareChild);
      }

      // Empty state banner
      if (measurements.length === 0 && (!compareChild || measurementsCompare.length === 0)) {
        ctx.save();
        const midX = padding.left + (chartWidth - padding.left - padding.right) / 2;
        const midY = padding.top + (chartHeight - padding.top - padding.bottom) / 2;
        const bannerW = 200;
        const bannerH = 40;

        ctx.fillStyle = pal.emptyBannerBg;
        ctx.strokeStyle = pal.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH, 8);
        else ctx.rect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH);
        ctx.fill();
        ctx.stroke();

        ctx.font = `600 13px ${FONTS.body}`;
        ctx.fillStyle = pal.inkMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No measurements yet', midX, midY);
        ctx.restore();
      }

      // Dual-Child Legend
      if (compareChild) {
        ctx.save();
        ctx.font = `600 11px ${FONTS.body}`;
        const nameA = child?.name || 'Child 1';
        const nameB = compareChild?.name || 'Child 2';
        const wA = ctx.measureText(nameA).width;
        const wB = ctx.measureText(nameB).width;
        const badgeW = 20 + wA + 24 + wB + 16;
        const badgeH = 24;
        const lx = padding.left + 8;
        const ly = padding.top + 6;

        ctx.fillStyle = pal.legendBg;
        ctx.strokeStyle = pal.legendBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly, badgeW, badgeH, 6);
        else ctx.rect(lx, ly, badgeW, badgeH);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lx + 12, ly + 12, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = childColor;
        ctx.fill();

        ctx.fillStyle = pal.ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameA, lx + 20, ly + 12);

        const xB = lx + 20 + wA + 16;
        ctx.beginPath();
        ctx.arc(xB, ly + 12, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = compareColor;
        ctx.fill();

        ctx.fillStyle = pal.ink;
        ctx.fillText(nameB, xB + 8, ly + 12);
        ctx.restore();
      }

      // External crosshair line if synchronized
      if (externalCrosshairAge !== null && externalCrosshairAge >= minAge && externalCrosshairAge <= maxAge) {
        const sx = toScreenX(externalCrosshairAge);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = pal.crosshair;
        ctx.lineWidth = 1.5;
        ctx.moveTo(sx, padding.top);
        ctx.lineTo(sx, chartHeight - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Interactive pointer handling
    function updateTooltipForAge(targetAge, targetX, targetY) {
      if (!tooltip) return;
      const isSnappedPoint = (targetY !== undefined && targetY !== null);

      let nearestA = null;
      let minDistanceA = Infinity;
      measurements.forEach(m => {
        const age = m.ageMonths ?? m.age_months ?? 0;
        const v = getMeasurementValue(m, metric);
        if (v === null || isNaN(v)) return;
        const sx = toScreenX(age);
        const sy = toScreenY(getPointYVal(m, child));
        const dist = Math.hypot(targetX - sx, (targetY || sy) - sy);
        if (dist < minDistanceA) {
          minDistanceA = dist;
          nearestA = { ...m, sx, sy, age, val: v };
        }
      });

      let nearestB = null;
      let minDistanceB = Infinity;
      if (compareChild) {
        measurementsCompare.forEach(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          const v = getMeasurementValue(m, metric);
          if (v === null || isNaN(v)) return;
          const sx = toScreenX(age);
          const sy = toScreenY(getPointYVal(m, compareChild));
          const dist = Math.hypot(targetX - sx, (targetY || sy) - sy);
          if (dist < minDistanceB) {
            minDistanceB = dist;
            nearestB = { ...m, sx, sy, age, val: v };
          }
        });
      }

      const isSnappedA = nearestA && minDistanceA < 24;
      const valA = isSnappedA ? nearestA.val : interpValFromList(measurements, metric, targetAge);
      const ageA = isSnappedA ? nearestA.age : targetAge;
      const statsA = valA !== null ? calcStats(engine, child, metric, ageA, valA) : null;

      const priorMA = getPriorMeasurement(measurements, isSnappedA ? nearestA : targetAge, metric);
      const priorDeltaA = valA !== null ? formatPriorDelta(valA, ageA, priorMA, metric, unitSystem) : null;

      const pal = getChartThemePalette();

      if (compareChild) {
        const isSnappedB = nearestB && minDistanceB < 24;
        const valB = isSnappedB ? nearestB.val : interpValFromList(measurementsCompare, metric, targetAge);
        const ageB = isSnappedB ? nearestB.age : targetAge;
        const statsB = valB !== null ? calcStats(engine, compareChild, metric, ageB, valB) : null;
        const nameA = child ? child.name : 'Child 1';
        const nameB = compareChild ? compareChild.name : 'Child 2';

        let deltaHtml = '';
        if (valA !== null && valB !== null) {
          const diff = valA - valB;
          const tallerName = diff >= 0 ? nameA : nameB;
          const absDiff = Math.abs(diff);
          deltaHtml = `
            <div style="font-size:11px; font-weight:700; color:${pal.amber}; text-align:center; padding-top:4px;">
              Δ Difference: ${tallerName} +${formatValue(absDiff, metric, unitSystem)}
            </div>
          `;
        }

        const pctAStr = statsA && !isNaN(statsA.percentile) ? `${statsA.percentile.toFixed(1)}%` : '—';
        const zAStr = statsA && !isNaN(statsA.zScore) ? `${statsA.zScore >= 0 ? '+' : ''}${statsA.zScore.toFixed(2)} SD` : '—';
        const pctBStr = statsB && !isNaN(statsB.percentile) ? `${statsB.percentile.toFixed(1)}%` : '—';
        const zBStr = statsB && !isNaN(statsB.zScore) ? `${statsB.zScore >= 0 ? '+' : ''}${statsB.zScore.toFixed(2)} SD` : '—';

        tooltip.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
            <span style="font-weight:700; color:${pal.ink}; font-size:12px;">Sibling Overlay</span>
            <span style="font-family:${FONTS.mono}; font-size:11px; color:${pal.inkLight};">Age: ${formatFullAge(targetAge)}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; padding:6px 0; border-top:1px solid ${pal.grid}; border-bottom:1px solid ${pal.grid}; margin-bottom:4px;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:${childColor}; font-size:12px;">${nameA}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:800; color:${pal.ink}; font-size:13px;">${valA !== null ? formatValue(valA, metric, unitSystem) : '—'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:10px; color:${pal.inkMuted};">
                <span>${valA !== null ? formatDualValue(valA, metric) : ''}</span>
                <span><strong style="color:${childColor}; font-family:${FONTS.mono};">${pctAStr}</strong> · <span style="font-family:${FONTS.mono};">${zAStr}</span></span>
              </div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; color:${compareColor}; font-size:12px;">${nameB}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:800; color:${pal.ink}; font-size:13px;">${valB !== null ? formatValue(valB, metric, unitSystem) : '—'}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:10px; color:${pal.inkMuted};">
                <span>${valB !== null ? formatDualValue(valB, metric) : ''}</span>
                <span><strong style="color:${compareColor}; font-family:${FONTS.mono};">${pctBStr}</strong> · <span style="font-family:${FONTS.mono};">${zBStr}</span></span>
              </div>
            </div>
          </div>
          ${deltaHtml}
        `;
      } else {
        // Single Child Tooltip
        let dateStr = '—';
        let ageStr = formatFullAge(targetAge);
        let valPrimary = '';
        let valDual = '';
        let percentileText = '';
        let zScoreText = '';
        let isPhoto = false;

        if (isSnappedA) {
          dateStr = nearestA.date || 'Recorded Checkup';
          ageStr = formatFullAge(nearestA.age);
          valPrimary = formatValue(nearestA.val, metric, unitSystem);
          valDual = formatDualValue(nearestA.val, metric);
          isPhoto = Boolean(nearestA.photoImport || nearestA.source === 'photo' || nearestA.importedFromPhoto);

          const z = statsA ? statsA.zScore : NaN;
          const pct = statsA ? statsA.percentile : NaN;
          zScoreText = !isNaN(z) ? `${z >= 0 ? '+' : ''}${z.toFixed(2)} SD` : '—';
          percentileText = !isNaN(pct) ? `${pct.toFixed(1)}%` : '—';
        } else if (valA !== null) {
          dateStr = 'Interpolated Track';
          valPrimary = formatValue(valA, metric, unitSystem);
          valDual = formatDualValue(valA, metric);
          const z = statsA ? statsA.zScore : NaN;
          const pct = statsA ? statsA.percentile : NaN;
          zScoreText = !isNaN(z) ? `${z >= 0 ? '+' : ''}${z.toFixed(2)} SD` : '—';
          percentileText = !isNaN(pct) ? `${pct.toFixed(1)}%` : '—';
        } else {
          dateStr = 'Reference Median';
          const p50Arr = curves.p50 || [];
          let interp50 = 0;
          for (let i = 0; i < p50Arr.length - 1; i++) {
            if (targetAge >= p50Arr[i].age && targetAge <= p50Arr[i + 1].age) {
              const f = (targetAge - p50Arr[i].age) / Math.max(0.001, p50Arr[i + 1].age - p50Arr[i].age);
              interp50 = p50Arr[i].value + f * (p50Arr[i + 1].value - p50Arr[i].value);
              break;
            }
          }
          valPrimary = `Median: ${formatValue(interp50, metric, unitSystem)}`;
          valDual = formatDualValue(interp50, metric);
          percentileText = '50th percentile';
          zScoreText = '0.00 SD';
        }

        tooltip.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
            <span style="font-weight:700; color:${childColor}; font-size:13px;">${child ? child.name : 'Child'}</span>
            <span style="font-family:${FONTS.mono}; font-size:11px; color:${pal.inkLight};">${dateStr}</span>
          </div>
          <div style="font-size:11px; color:${pal.inkMuted}; margin-bottom:6px;">Age: <strong style="color:${pal.ink}; font-family:${FONTS.mono};">${ageStr}</strong></div>
          <div style="padding:6px 0; border-top:1px solid ${pal.grid}; border-bottom:1px solid ${pal.grid}; margin-bottom:6px;">
            <div style="font-size:15px; font-weight:800; font-family:${FONTS.mono}; color:${pal.ink};">${valPrimary}</div>
            <div style="font-size:11px; color:${pal.inkMuted};">${valDual}</div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; gap:12px;">
            <div>Percentile: <strong style="color:${childColor}; font-family:${FONTS.mono};">${percentileText}</strong></div>
            <div>Z-Score: <strong style="font-family:${FONTS.mono}; color:${pal.ink};">${zScoreText}</strong></div>
          </div>
          ${priorDeltaA ? `
            <div style="margin-top:6px; font-size:10px; color:${pal.amber}; font-weight:600;">
              ${priorDeltaA.fullText}
            </div>
          ` : ''}
          ${isPhoto ? `
            <div style="margin-top:6px; display:inline-flex; align-items:center; gap:4px; font-size:10px; color:${pal.amber}; font-weight:600;">
              <span>📷</span> Bulk Photo Entry
            </div>
          ` : ''}
        `;
      }

      tooltip.style.display = 'block';
      tooltip.style.maxWidth = Math.min(280, chartWidth - 16) + 'px';
      const tipWidth = tooltip.offsetWidth || 230;
      const tipHeight = tooltip.offsetHeight || 90;
      let left = targetX + 14;
      if (left + tipWidth > chartWidth - 8) {
        left = targetX - tipWidth - 14;
      }
      left = Math.max(8, Math.min(chartWidth - tipWidth - 8, left));
      let top = (targetY ?? toScreenY(minY + (maxY - minY) * 0.5)) - 40;
      top = Math.max(8, Math.min(chartHeight - tipHeight - 8, top));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function handlePointer(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      const clientY = (evt.touches ? evt.touches[0].clientY : evt.clientY);
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        if (tooltip) tooltip.style.display = 'none';
        draw();
        if (typeof options.onCrosshairMove === 'function') options.onCrosshairMove(null);
        return;
      }

      const cursorAge = fromScreenX(mx);
      externalCrosshairAge = null;

      draw();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pal = getChartThemePalette();
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = pal.crosshair;
        ctx.lineWidth = 1;
        ctx.moveTo(mx, padding.top);
        ctx.lineTo(mx, chartHeight - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      updateTooltipForAge(cursorAge, mx, my);

      if (typeof options.onCrosshairMove === 'function') {
        options.onCrosshairMove(cursorAge);
      }
    }

    function handlePointerLeave() {
      if (tooltip) tooltip.style.display = 'none';
      draw();
      if (typeof options.onCrosshairMove === 'function') {
        options.onCrosshairMove(null);
      }
    }

    function handleCanvasClick(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = evt.clientX || 0;
      const clientY = evt.clientY || 0;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        return;
      }

      let bestPoint = null;
      let bestDist = 14;

      const checkPoints = (list, ch) => {
        list.forEach(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          if (age < minAge - 0.5 || age > maxAge + 0.5) return;
          const v = getMeasurementValue(m, metric);
          if (v === null || isNaN(v)) return;
          const sx = toScreenX(age);
          const sy = toScreenY(getPointYVal(m, ch));
          const dist = Math.hypot(mx - sx, my - sy);
          if (dist <= bestDist) {
            bestDist = dist;
            bestPoint = {
              measurement: m,
              stats: calcStats(engine, ch, metric, age, v)
            };
          }
        });
      };

      checkPoints(measurements, child);
      if (compareChild) checkPoints(measurementsCompare, compareChild);

      if (bestPoint && typeof options.onPointSelect === 'function') {
        options.onPointSelect(bestPoint.measurement, bestPoint.stats);
      } else if (!bestPoint && typeof options.onCanvasClick === 'function') {
        const clickedAge = Math.round(fromScreenX(mx) * 10) / 10;
        const clickedVal = Math.round(fromScreenY(my) * 100) / 100;
        options.onCanvasClick({ ageMonths: clickedAge, value: clickedVal, metric });
      }
    }

    function handleDocTouchOutside(evt) {
      if (wrapper && !wrapper.contains(evt.target)) {
        if (tooltip) tooltip.style.display = 'none';
        draw();
      }
    }

    canvas.addEventListener('mousemove', handlePointer);
    canvas.addEventListener('mouseleave', handlePointerLeave);
    canvas.addEventListener('touchstart', handlePointer, { passive: true });
    canvas.addEventListener('touchmove', handlePointer, { passive: true });
    canvas.addEventListener('click', handleCanvasClick);
    if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', handleDocTouchOutside, { passive: true });
    }

    draw();
    let resizeObserver = null;
    let lastW = chartWidth, lastH = chartHeight;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries && entries[0];
        const w = (entry && entry.contentRect && entry.contentRect.width) || (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect().width) || 0;
        const h = (entry && entry.contentRect && entry.contentRect.height) || (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect().height) || 0;
        if (Math.abs(w - lastW) >= 1 || Math.abs(h - lastH) >= 1) {
          lastW = w;
          lastH = h;
          draw();
        }
      });
      resizeObserver.observe(wrapper);
    }

    const controller = {
      containerEl,
      destroy: () => {
        activeChartControllers.delete(controller);
        if (resizeObserver) resizeObserver.disconnect();
        canvas.removeEventListener('mousemove', handlePointer);
        canvas.removeEventListener('mouseleave', handlePointerLeave);
        canvas.removeEventListener('touchstart', handlePointer);
        canvas.removeEventListener('touchmove', handlePointer);
        canvas.removeEventListener('click', handleCanvasClick);
        if (typeof document !== 'undefined') {
          document.removeEventListener('touchstart', handleDocTouchOutside);
        }
      },
      redraw: draw,
      setExternalCrosshair: (ageMonths) => {
        if (ageMonths === null || ageMonths === undefined) {
          externalCrosshairAge = null;
          if (tooltip) tooltip.style.display = 'none';
          draw();
        } else {
          externalCrosshairAge = ageMonths;
          draw();
          updateTooltipForAge(externalCrosshairAge, toScreenX(externalCrosshairAge), null);
        }
      }
    };
    activeChartControllers.add(controller);
    return controller;
  }

  /**
   * 2. RENDER COMPARISON CHART
   * Dual-Child Sibling Overlay Chart (Absolute cm/kg, Sex-Normalized % 0-100, or Z-Score -3 to +3)
   */
  function renderComparisonChart(containerEl, childA, childB, arg4, arg5, arg6) {
    if (!containerEl || typeof document === 'undefined') return null;
    let metric = 'height';
    let mode = 'absolute';
    let options = {};
    if (typeof arg4 === 'string') {
      metric = arg4;
      if (typeof arg5 === 'string') {
        mode = arg5;
        options = (arg6 && typeof arg6 === 'object') ? { ...arg6 } : {};
      } else if (arg5 && typeof arg5 === 'object') {
        options = { ...arg5 };
        mode = options.mode || 'absolute';
      }
    } else if (arg4 && typeof arg4 === 'object') {
      options = { ...arg4 };
      metric = options.metric || 'height';
      mode = options.mode || 'absolute';
    }

    const unitSystem = options.unitSystem || 'metric';
    const onAgeSelect = typeof options.onAgeSelect === 'function' ? options.onAgeSelect : null;
    let highlightAge = options.highlightAgeMonths !== undefined ? options.highlightAgeMonths : null;

    containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    const isMobile = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 640;
    const fixedH = options.height || parseInt(containerEl.style && containerEl.style.height, 10) || (isMobile ? 300 : (parseInt(containerEl.style && containerEl.style.minHeight, 10) || 380));
    wrapper.style.width = '100%';
    wrapper.style.height = fixedH + 'px';
    wrapper.style.minHeight = fixedH + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    containerEl.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    const tooltip = createTooltip(wrapper, 'ks-comparison-tooltip');

    const engine = getSafeEngine();
    const colorA = getChildColor(childA);
    const colorB = childB ? getChildColor(childB) : PALETTE.inkLight;

    const mListA = ((childA && childA.measurements) || [])
      .filter(m => {
        const v = getMeasurementValue(m, metric);
        return v !== undefined && v !== null && !isNaN(v);
      })
      .sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0));

    const mListB = ((childB && childB.measurements) || [])
      .filter(m => {
        const v = getMeasurementValue(m, metric);
        return v !== undefined && v !== null && !isNaN(v);
      })
      .sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0));

    const latestAgeA = mListA.length ? (mListA[mListA.length - 1].ageMonths ?? mListA[mListA.length - 1].age_months ?? 24) : 24;
    const latestAgeB = mListB.length ? (mListB[mListB.length - 1].ageMonths ?? mListB[mListB.length - 1].age_months ?? 24) : 24;
    const latestAge = Math.max(latestAgeA, latestAgeB);

    const { minAge, maxAge } = resolveAgeRange(options, latestAge);

    function getPointY(m, ch) {
      const val = getMeasurementValue(m, metric);
      const age = m.ageMonths ?? m.age_months ?? 0;
      if (val === null || isNaN(val)) return 0;
      if (mode === 'percentile') {
        const stats = calcStats(engine, ch, metric, age, val);
        return isNaN(stats.percentile) ? 50 : stats.percentile;
      }
      if (mode === 'zscore') {
        const stats = calcStats(engine, ch, metric, age, val);
        return isNaN(stats.zScore) ? 0 : stats.zScore;
      }
      return val;
    }

    let minY = 0;
    let maxY = 100;
    if (mode === 'percentile') {
      minY = 0;
      maxY = 100;
    } else if (mode === 'zscore') {
      minY = -3.5;
      maxY = 3.5;
    } else {
      minY = Infinity;
      maxY = -Infinity;
      [...mListA, ...mListB].forEach(m => {
        const age = m.ageMonths ?? m.age_months ?? 0;
        if (age >= minAge - 1 && age <= maxAge + 1) {
          const v = getMeasurementValue(m, metric);
          if (v !== null && !isNaN(v)) {
            if (v < minY) minY = v;
            if (v > maxY) maxY = v;
          }
        }
      });
      if (minY === Infinity) {
        minY = metric === 'height' ? 45 : 2;
        maxY = metric === 'height' ? 115 : 20;
      }
      const pad = (maxY - minY) * 0.12;
      minY = Math.max(0, minY - pad);
      maxY = maxY + pad;
    }

    let chartWidth = 0;
    let chartHeight = 0;
    const padding = { top: 32, right: 48, bottom: 44, left: 54 };

    function toScreenX(age) {
      const ageSpan = Math.max(0.1, maxAge - minAge);
      return padding.left + ((age - minAge) / ageSpan) * (chartWidth - padding.left - padding.right);
    }
    function toScreenY(val) {
      const ySpan = Math.max(0.01, maxY - minY);
      return (chartHeight - padding.bottom) - ((val - minY) / ySpan) * (chartHeight - padding.top - padding.bottom);
    }
    function fromScreenX(sx) {
      const ratio = (sx - padding.left) / Math.max(1, chartWidth - padding.left - padding.right);
      return Math.max(minAge, Math.min(maxAge, minAge + ratio * (maxAge - minAge)));
    }

    function draw() {
      const rect = (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect()) || {};
      chartWidth = rect.width || 600;
      chartHeight = rect.height || 360;
      const { ctx } = setupHighDPICanvas(canvas, chartWidth, chartHeight);
      const pal = getChartThemePalette();
      const activeColorA = getChildColor(childA);
      const activeColorB = childB ? getChildColor(childB) : pal.inkLight;

      if (chartWidth < 420) {
        padding.top = 28;
        padding.right = 38;
        padding.bottom = 40;
        padding.left = 48;
      } else {
        padding.top = 32;
        padding.right = 48;
        padding.bottom = 44;
        padding.left = 54;
      }

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // 1. Grid & Axes
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.gridSubtle;

      const plotW = Math.max(10, chartWidth - padding.left - padding.right);
      const isMobileChart = chartWidth < 420;
      const ageSpan = maxAge - minAge;
      const maxTicks = Math.max(4, Math.floor(plotW / 46));
      const stepCandidates = [1, 2, 3, 6, 12, 24, 36, 48, 60];
      let xStep = stepCandidates[stepCandidates.length - 1];
      for (let i = 0; i < stepCandidates.length; i++) {
        if (ageSpan / stepCandidates[i] <= maxTicks) {
          xStep = stepCandidates[i];
          break;
        }
      }

      ctx.font = `11px ${FONTS.mono}`;
      ctx.fillStyle = pal.inkLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const firstX = Math.ceil(minAge / xStep) * xStep;
      for (let age = firstX; age <= maxAge; age += xStep) {
        const sx = toScreenX(age);
        ctx.beginPath();
        ctx.strokeStyle = (age % 12 === 0) ? pal.grid : pal.gridSubtle;
        ctx.moveTo(sx, padding.top);
        ctx.lineTo(sx, chartHeight - padding.bottom);
        ctx.stroke();

        ctx.fillText(formatAgeLabel(age, isMobileChart), sx, chartHeight - padding.bottom + 8);
      }

      ctx.font = `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText('Comparison Age (Months)', chartWidth / 2, chartHeight - 14);

      if (mode === 'percentile') {
        const bands = pal.isDark ? [
          { y1: 25, y2: 75, color: 'rgba(76, 195, 165, 0.12)' },
          { y1: 10, y2: 90, color: 'rgba(76, 195, 165, 0.06)' }
        ] : [
          { y1: 25, y2: 75, color: 'rgba(30, 41, 35, 0.04)' },
          { y1: 10, y2: 90, color: 'rgba(30, 41, 35, 0.02)' }
        ];
        bands.forEach(b => {
          const syTop = toScreenY(b.y2);
          const syBot = toScreenY(b.y1);
          ctx.fillStyle = b.color;
          safeFillRect(ctx, padding.left, syTop, chartWidth - padding.left - padding.right, syBot - syTop);
        });

        const pLines = [10, 25, 50, 75, 90];
        pLines.forEach(p => {
          const sy = toScreenY(p);
          ctx.beginPath();
          ctx.strokeStyle = p === 50 ? pal.curveMedian : pal.grid;
          ctx.setLineDash(p === 50 ? [4, 4] : [2, 2]);
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = `10px ${FONTS.mono}`;
          ctx.fillStyle = p === 50 ? pal.ink : pal.inkLight;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${p}%`, padding.left - 6, sy);
        });
      } else if (mode === 'zscore') {
        const z0 = toScreenY(0);
        ctx.beginPath();
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 1.5;
        ctx.moveTo(padding.left, z0);
        ctx.lineTo(chartWidth - padding.right, z0);
        ctx.stroke();

        const zPlus2 = toScreenY(2);
        const zMinus2 = toScreenY(-2);
        ctx.fillStyle = pal.isDark ? 'rgba(76, 195, 165, 0.12)' : 'rgba(46, 111, 94, 0.04)';
        safeFillRect(ctx, padding.left, zPlus2, chartWidth - padding.left - padding.right, zMinus2 - zPlus2);

        [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
          const sy = toScreenY(z);
          ctx.beginPath();
          ctx.strokeStyle = pal.grid;
          ctx.setLineDash([2, 2]);
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = `10px ${FONTS.mono}`;
          ctx.fillStyle = z === 0 ? pal.ink : pal.inkLight;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${z > 0 ? '+' : ''}${z} SD`, padding.left - 6, sy);
        });
      } else {
        if (engine && typeof engine.getPercentileCurves === 'function') {
          const rawBoy = engine.getPercentileCurves('M', metric, minAge, maxAge, 1);
          const rawGirl = engine.getPercentileCurves('F', metric, minAge, maxAge, 1);
          const boy50 = normalizeCurves(rawBoy)?.p50 || [];
          const girl50 = normalizeCurves(rawGirl)?.p50 || [];

          if (boy50.length > 0) {
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = pal.isDark ? 'rgba(235, 130, 95, 0.4)' : 'rgba(200, 90, 50, 0.25)';
            ctx.lineWidth = 1;
            drawSpline(ctx, boy50.filter(p => p.age >= minAge && p.age <= maxAge).map(p => ({ x: toScreenX(p.age), y: toScreenY(p.value) })), 0.2);
            ctx.stroke();
          }
          if (girl50.length > 0) {
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = pal.isDark ? 'rgba(76, 195, 165, 0.4)' : 'rgba(46, 111, 94, 0.25)';
            ctx.lineWidth = 1;
            drawSpline(ctx, girl50.filter(p => p.age >= minAge && p.age <= maxAge).map(p => ({ x: toScreenX(p.age), y: toScreenY(p.value) })), 0.2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }

        const ySpan = maxY - minY;
        const rawStep = ySpan / 6;
        let yStep = Math.pow(10, Math.floor(Math.log10(rawStep)));
        if (rawStep / yStep > 5) yStep *= 5;
        else if (rawStep / yStep > 2) yStep *= 2;
        if (yStep <= 0) yStep = 1;

        const firstY = Math.ceil(minY / yStep) * yStep;
        for (let yVal = firstY; yVal <= maxY; yVal += yStep) {
          const sy = toScreenY(yVal);
          ctx.beginPath();
          ctx.strokeStyle = pal.gridSubtle;
          ctx.moveTo(padding.left, sy);
          ctx.lineTo(chartWidth - padding.right, sy);
          ctx.stroke();

          const disp = unitSystem === 'imperial'
            ? (metric === 'height' || metric === 'head' ? (yVal / 2.54).toFixed(0) : (yVal * 2.20462).toFixed(0))
            : yVal.toFixed(yStep < 1 ? 1 : 0);
          ctx.fillStyle = pal.inkLight;
          ctx.font = `10px ${FONTS.mono}`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(disp, padding.left - 6, sy);
        }
      }

      ctx.save();
      ctx.translate(chartWidth < 420 ? 11 : 14, chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = chartWidth < 420 ? `10px ${FONTS.body}` : `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      const yAxisTitle = mode === 'percentile' ? 'Sex-Normalized Percentile (%)'
        : mode === 'zscore' ? 'WHO Z-Score (Standard Deviations)'
        : `${getMetricLabel(metric)} (${getMetricUnits(metric, unitSystem)})`;
      ctx.fillText(yAxisTitle, 0, 0);
      ctx.restore();

      // Plot Child curves
      function plotChild(child, mList, color, isBenchmark = false) {
        if (!mList || mList.length === 0) return [];
        const visibleM = mList.filter(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          return age >= minAge - 1 && age <= maxAge + 1;
        });
        if (visibleM.length === 0) return [];

        const pts = visibleM.map(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          const yVal = getPointY(m, child);
          const val = getMeasurementValue(m, metric);
          return {
            x: toScreenX(age),
            y: toScreenY(yVal),
            age,
            val,
            yVal,
            m
          };
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
        safeClip(ctx);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        if (isBenchmark) ctx.setLineDash([6, 4]);
        else ctx.setLineDash([]);
        drawSpline(ctx, pts, 0.25);
        ctx.stroke();
        ctx.setLineDash([]);

        pts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = pal.pointHalo;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });

        ctx.restore();
        return pts;
      }

      plotChild(childA, mListA, activeColorA, Boolean(childA && childA.isBenchmark));
      if (childB) {
        plotChild(childB, mListB, activeColorB, Boolean(childB.isBenchmark));
      }

      if (mListA.length === 0 && (!childB || mListB.length === 0)) {
        ctx.save();
        const midX = padding.left + (chartWidth - padding.left - padding.right) / 2;
        const midY = padding.top + (chartHeight - padding.top - padding.bottom) / 2;
        const bannerW = 200;
        const bannerH = 40;

        ctx.fillStyle = pal.emptyBannerBg;
        ctx.strokeStyle = pal.emptyBannerBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH, 8);
        else ctx.rect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH);
        ctx.fill();
        ctx.stroke();

        ctx.font = `600 13px ${FONTS.body}`;
        ctx.fillStyle = pal.inkMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No measurements yet', midX, midY);
        ctx.restore();
      }

      // Highlight age cursor
      if (highlightAge !== null && highlightAge !== undefined && highlightAge >= minAge && highlightAge <= maxAge) {
        const hx = toScreenX(highlightAge);

        ctx.beginPath();
        ctx.strokeStyle = pal.amber;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(hx, padding.top);
        ctx.lineTo(hx, chartHeight - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = pal.amber;
        ctx.beginPath();
        ctx.arc(hx, padding.top, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = `bold 10px ${FONTS.mono}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = pal.amber;
        ctx.fillText(`${highlightAge}m`, hx, padding.top - 8);
      }
    }

    let isDraggingAge = false;

    function handlePointer(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      const clientY = (evt.touches ? evt.touches[0].clientY : evt.clientY);
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        if (!isDraggingAge && tooltip) {
          tooltip.style.display = 'none';
        }
        return;
      }

      const cursorAge = Math.round(fromScreenX(mx) * 2) / 2;

      if (isDraggingAge || evt.type === 'click') {
        highlightAge = cursorAge;
        draw();
        if (onAgeSelect) onAgeSelect(cursorAge);
      }

      const valA = interpValFromList(mListA, metric, cursorAge);
      const valB = childB ? interpValFromList(mListB, metric, cursorAge) : null;
      let deltaStr = '';
      if (valA !== null && valB !== null) {
        const diff = valA - valB;
        const nameA = childA ? childA.name : 'Child A';
        const nameB = childB ? childB.name : 'Child B';
        const taller = diff >= 0 ? nameA : nameB;
        const absDiff = Math.abs(diff);
        deltaStr = `${taller} +${formatValue(absDiff, metric, unitSystem)}`;
      }

      const formatOrdVal = (p) => {
        if (engine && typeof engine.formatOrdinal === 'function') {
          return engine.formatOrdinal(p);
        }
        return `${Math.round(p)}th`;
      };

      let valADisp = 'No data';
      let valBDisp = 'No data';
      if (valA !== null) {
        if (mode === 'percentile') {
          const p = calcStats(engine, childA, metric, cursorAge, valA).percentile;
          valADisp = !isNaN(p) ? `${formatValue(valA, metric, unitSystem)} (${formatOrdVal(p)} %)` : formatValue(valA, metric, unitSystem);
        } else if (mode === 'zscore') {
          const z = calcStats(engine, childA, metric, cursorAge, valA).zScore;
          valADisp = `${formatValue(valA, metric, unitSystem)} (${z >= 0 ? '+' : ''}${z.toFixed(2)} SD)`;
        } else {
          valADisp = formatValue(valA, metric, unitSystem);
        }
      }
      if (valB !== null) {
        if (mode === 'percentile') {
          const p = calcStats(engine, childB, metric, cursorAge, valB).percentile;
          valBDisp = !isNaN(p) ? `${formatValue(valB, metric, unitSystem)} (${formatOrdVal(p)} %)` : formatValue(valB, metric, unitSystem);
        } else if (mode === 'zscore') {
          const z = calcStats(engine, childB, metric, cursorAge, valB).zScore;
          valBDisp = `${formatValue(valB, metric, unitSystem)} (${z >= 0 ? '+' : ''}${z.toFixed(2)} SD)`;
        } else {
          valBDisp = formatValue(valB, metric, unitSystem);
        }
      }

      if (tooltip) {
        const pal = getChartThemePalette();
        const activeColorA = getChildColor(childA);
        const activeColorB = childB ? getChildColor(childB) : pal.inkLight;
        tooltip.innerHTML = `
          <div style="font-size:11px; color:var(--ink-secondary, ${pal.inkMuted}); margin-bottom:6px;">
            Comparison Age: <strong style="color:var(--ink-primary, ${pal.ink}); font-family:${FONTS.mono};">${formatFullAge(cursorAge)}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; padding:6px 0; border-top:1px solid var(--border-stone, ${pal.grid}); border-bottom:1px solid var(--border-stone, ${pal.grid}); margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:${activeColorA}; font-weight:700;">${childA ? childA.name : 'Child A'}:</span>
              <span style="font-family:${FONTS.mono}; font-weight:700; color:var(--ink-primary, ${pal.ink});">${valADisp}</span>
            </div>
            ${childB ? `
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:${activeColorB}; font-weight:700;">${childB.name || 'Child B'}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:700; color:var(--ink-primary, ${pal.ink});">${valBDisp}</span>
              </div>
            ` : ''}
          </div>
          ${deltaStr ? `
            <div style="font-size:11px; font-weight:700; color:var(--amber-ink, ${pal.amber}); text-align:center;">
              Δ Difference: ${deltaStr}
            </div>
          ` : ''}
          <div style="font-size:9px; color:var(--ink-faint, ${pal.inkLight}); margin-top:4px; text-align:center;">
            Click/drag to set comparison age
          </div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.maxWidth = Math.min(280, chartWidth - 16) + 'px';
        const tipWidth = tooltip.offsetWidth || 230;
        const tipHeight = tooltip.offsetHeight || 120;
        let left = mx + 16;
        if (left + tipWidth > chartWidth - 8) {
          left = mx - tipWidth - 16;
        }
        left = Math.max(8, Math.min(chartWidth - tipWidth - 8, left));
        let top = my - 40;
        top = Math.max(8, Math.min(chartHeight - tipHeight - 8, top));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    }

    canvas.addEventListener('mousedown', (e) => {
      isDraggingAge = true;
      handlePointer(e);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('mouseup', () => { isDraggingAge = false; });
    }
    canvas.addEventListener('mousemove', handlePointer);
    canvas.addEventListener('mouseleave', () => {
      if (!isDraggingAge && tooltip) tooltip.style.display = 'none';
    });
    canvas.addEventListener('click', handlePointer);

    canvas.addEventListener('touchstart', (e) => {
      isDraggingAge = true;
      handlePointer(e);
    }, { passive: true });
    if (typeof window !== 'undefined') {
      window.addEventListener('touchend', () => { isDraggingAge = false; });
    }
    canvas.addEventListener('touchmove', handlePointer, { passive: true });

    const onDocTouchStart = (evt) => {
      if (tooltip && wrapper && typeof wrapper.contains === 'function' && !wrapper.contains(evt.target)) {
        tooltip.style.display = 'none';
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', onDocTouchStart, { passive: true });
    }

    draw();
    let lastW = chartWidth;
    let lastH = chartHeight;
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        if (!entries || !entries.length) return;
        const entry = entries[0];
        const w = (entry.contentRect && entry.contentRect.width) || wrapper.clientWidth;
        const h = (entry.contentRect && entry.contentRect.height) || wrapper.clientHeight;
        if (Math.abs(w - lastW) >= 1 || Math.abs(h - lastH) >= 1) {
          lastW = w;
          lastH = h;
          draw();
        }
      });
      resizeObserver.observe(wrapper);
    }

    const controller = {
      containerEl,
      destroy: () => {
        if (resizeObserver) resizeObserver.disconnect();
        if (typeof document !== 'undefined') {
          document.removeEventListener('touchstart', onDocTouchStart);
        }
        activeChartControllers.delete(controller);
      },
      redraw: draw,
      setHighlightAge: (age) => {
        highlightAge = age;
        draw();
      }
    };
    activeChartControllers.add(controller);
    return controller;
  }

  /**
   * 3. RENDER VELOCITY CHART
   * Growth Velocity & Spurt Chart (cm/year or kg/year across age intervals)
   */
  function renderVelocityChart(containerEl, childA, childB, arg4, arg5) {
    if (!containerEl || typeof document === 'undefined') return null;
    let metric = 'height';
    let options = {};
    if (typeof arg4 === 'string') {
      metric = arg4;
      options = (arg5 && typeof arg5 === 'object') ? { ...arg5 } : {};
    } else if (arg4 && typeof arg4 === 'object') {
      options = { ...arg4 };
      metric = options.metric || 'height';
    }

    const unitSystem = options.unitSystem || 'metric';
    const isSolo = !childB;

    containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    const isMobile = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 640;
    const fixedH = options.height || parseInt(containerEl.style && containerEl.style.height, 10) || (isMobile ? 300 : (parseInt(containerEl.style && containerEl.style.minHeight, 10) || 380));
    wrapper.style.width = '100%';
    wrapper.style.height = fixedH + 'px';
    wrapper.style.minHeight = fixedH + 'px';
    wrapper.style.position = 'relative';
    containerEl.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    const tooltip = createTooltip(wrapper, 'ks-velocity-tooltip');

    const colorA = getChildColor(childA);
    const colorB = childB ? getChildColor(childB) : null;

    const brackets = [
      { id: '0-6m', label: '0–6m', minAge: 0, maxAge: 6 },
      { id: '6-12m', label: '6–12m', minAge: 6, maxAge: 12 },
      { id: '12-18m', label: '12–18m', minAge: 12, maxAge: 18 },
      { id: '18-24m', label: '18–24m', minAge: 18, maxAge: 24 },
      { id: '2-3y', label: '2–3y', minAge: 24, maxAge: 36 },
      { id: '3-4y', label: '3–4y', minAge: 36, maxAge: 48 },
      { id: '4-5y', label: '4–5y', minAge: 48, maxAge: 60 }
    ];

    function computeVelocities(child) {
      if (!child || !child.measurements) return [];
      const mList = child.measurements
        .filter(m => {
          const v = getMeasurementValue(m, metric);
          return v !== undefined && v !== null && !isNaN(v);
        })
        .sort((a, b) => (a.ageMonths ?? a.age_months ?? 0) - (b.ageMonths ?? b.age_months ?? 0));

      return brackets.map(br => {
        const inBracket = mList.filter(m => {
          const age = m.ageMonths ?? m.age_months ?? 0;
          return age >= br.minAge && age <= br.maxAge;
        });

        let ratePerYear = null;
        let isSpurt = false;

        if (inBracket.length >= 2) {
          const first = inBracket[0];
          const last = inBracket[inBracket.length - 1];
          const dAgeMonths = (last.ageMonths ?? last.age_months ?? 0) - (first.ageMonths ?? first.age_months ?? 0);
          if (dAgeMonths > 0.5) {
            const vLast = getMeasurementValue(last, metric);
            const vFirst = getMeasurementValue(first, metric);
            const dVal = vLast - vFirst;
            ratePerYear = (dVal / dAgeMonths) * 12;
          }
        } else if (mList.length >= 2) {
          const findValAt = (age) => {
            const a0 = mList[0].ageMonths ?? mList[0].age_months ?? 0;
            const aEnd = mList[mList.length - 1].ageMonths ?? mList[mList.length - 1].age_months ?? 0;
            if (age <= a0) return getMeasurementValue(mList[0], metric);
            if (age >= aEnd) return null;
            for (let i = 0; i < mList.length - 1; i++) {
              const a1 = mList[i].ageMonths ?? mList[i].age_months ?? 0;
              const a2 = mList[i + 1].ageMonths ?? mList[i + 1].age_months ?? 0;
              if (age >= a1 && age <= a2) {
                const denom = a2 - a1;
                if (denom === 0) return getMeasurementValue(mList[i], metric);
                const f = (age - a1) / denom;
                const v1 = getMeasurementValue(mList[i], metric);
                const v2 = getMeasurementValue(mList[i + 1], metric);
                return v1 + f * (v2 - v1);
              }
            }
            return null;
          };
          const v1 = findValAt(br.minAge);
          const v2 = findValAt(br.maxAge);
          if (v1 !== null && v2 !== null) {
            const dAge = br.maxAge - br.minAge;
            ratePerYear = ((v2 - v1) / dAge) * 12;
          }
        }

        if (ratePerYear !== null) {
          if (metric === 'height') {
            if (br.maxAge <= 12 && ratePerYear >= 18) isSpurt = true;
            else if (br.maxAge > 12 && ratePerYear >= 10) isSpurt = true;
          } else if (metric === 'weight') {
            if (br.maxAge <= 12 && ratePerYear >= 6.5) isSpurt = true;
            else if (br.maxAge > 12 && ratePerYear >= 3.8) isSpurt = true;
          } else if (metric === 'head') {
            if (br.maxAge <= 12 && ratePerYear >= 8) isSpurt = true;
            else if (br.maxAge > 12 && ratePerYear >= 3) isSpurt = true;
          }
        }

        return {
          ...br,
          rate: ratePerYear,
          isSpurt
        };
      });
    }

    const vDataA = computeVelocities(childA);
    const vDataB = childB ? computeVelocities(childB) : [];

    const unitLabel = metric === 'height'
      ? (unitSystem === 'imperial' ? 'in/yr' : 'cm/yr')
      : metric === 'weight'
        ? (unitSystem === 'imperial' ? 'lb/yr' : 'kg/yr')
        : (unitSystem === 'imperial' ? 'in/yr' : 'cm/yr');

    let chartWidth = 0;
    let chartHeight = 0;
    const padding = { top: 36, right: 24, bottom: 44, left: 54 };

    function draw() {
      const rect = (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect()) || {};
      chartWidth = rect.width || 600;
      chartHeight = rect.height || 320;
      const { ctx } = setupHighDPICanvas(canvas, chartWidth, chartHeight);
      const pal = getChartThemePalette();
      const activeColorA = getChildColor(childA);
      const activeColorB = childB ? getChildColor(childB) : null;

      if (chartWidth < 420) {
        padding.top = 28;
        padding.right = 24;
        padding.bottom = 40;
        padding.left = 48;
      } else {
        padding.top = 36;
        padding.right = 24;
        padding.bottom = 44;
        padding.left = 54;
      }

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      let maxRate = 0;
      [...vDataA, ...vDataB].forEach(d => {
        if (d.rate !== null && d.rate > maxRate) maxRate = d.rate;
      });
      maxRate = Math.max(metric === 'height' ? 28 : metric === 'weight' ? 10 : 15, maxRate * 1.25);

      const numYSteps = 5;
      const stepVal = maxRate / numYSteps;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = `10px ${FONTS.mono}`;
      ctx.fillStyle = pal.inkLight;

      for (let i = 0; i <= numYSteps; i++) {
        const val = i * stepVal;
        const sy = (chartHeight - padding.bottom) - (val / maxRate) * (chartHeight - padding.top - padding.bottom);

        ctx.beginPath();
        ctx.strokeStyle = i === 0 ? pal.grid : pal.gridSubtle;
        ctx.moveTo(padding.left, sy);
        ctx.lineTo(chartWidth - padding.right, sy);
        ctx.stroke();

        const disp = unitSystem === 'imperial'
          ? (metric === 'height' || metric === 'head' ? (val / 2.54).toFixed(1) : (val * 2.20462).toFixed(1))
          : val.toFixed(1);
        ctx.fillText(disp, padding.left - 6, sy);
      }

      ctx.save();
      ctx.translate(chartWidth < 420 ? 11 : 14, chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = chartWidth < 420 ? `10px ${FONTS.body}` : `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText(`Annualized Velocity (${unitLabel})`, 0, 0);
      ctx.restore();

      const availWidth = chartWidth - padding.left - padding.right;
      const groupWidth = availWidth / brackets.length;
      const barWidth = isSolo ? Math.min(34, groupWidth - 18) : Math.min(22, (groupWidth - 16) / 2);

      const compactLabels = {
        '0-6m': '0-6m',
        '6-12m': '6-12m',
        '12-18m': '12-18',
        '18-24m': '18-24',
        '2-3y': '2-3y',
        '3-4y': '3-4y',
        '4-5y': '4-5y'
      };

      brackets.forEach((br, i) => {
        const groupCenterX = padding.left + i * groupWidth + groupWidth / 2;
        const da = vDataA[i];
        const db = vDataB[i];

        // Draw Normative Pediatric Velocity Band behind bars
        const ref = (EXPECTED_VELOCITY[metric] && EXPECTED_VELOCITY[metric][br.id]) || { min: 0, max: 0, median: 0 };
        if (ref.max > 0) {
          const syTop = (chartHeight - padding.bottom) - (ref.max / maxRate) * (chartHeight - padding.top - padding.bottom);
          const syBot = (chartHeight - padding.bottom) - (ref.min / maxRate) * (chartHeight - padding.top - padding.bottom);
          const bandX = padding.left + i * groupWidth + 4;
          const bandW = groupWidth - 8;

          ctx.fillStyle = pal.isDark ? 'rgba(76, 195, 165, 0.12)' : 'rgba(46, 111, 94, 0.08)';
          safeFillRect(ctx, bandX, syTop, bandW, syBot - syTop);

          ctx.strokeStyle = pal.isDark ? 'rgba(76, 195, 165, 0.3)' : 'rgba(46, 111, 94, 0.2)';
          ctx.setLineDash([2, 2]);
          safeStrokeRect(ctx, bandX, syTop, bandW, syBot - syTop);
          ctx.setLineDash([]);
        }

        // Bracket X label
        const xLabel = (chartWidth < 420 && compactLabels[br.id]) ? compactLabels[br.id] : br.label;
        ctx.font = chartWidth < 420 ? `9.5px ${FONTS.mono}` : `11px ${FONTS.mono}`;
        ctx.fillStyle = pal.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(xLabel, groupCenterX, chartHeight - padding.bottom + 8);

        function drawBar(data, color, offsetX) {
          if (!data || data.rate === null) return;
          const zeroY = chartHeight - padding.bottom;
          const plotH = chartHeight - padding.top - padding.bottom;
          const rateVal = Math.max(0, data.rate);
          const barH = (rateVal / maxRate) * plotH;
          const bx = groupCenterX + offsetX - barWidth / 2;
          const by = zeroY - barH;

          ctx.fillStyle = color;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bx, by, barWidth, barH, [4, 4, 0, 0]);
          } else {
            ctx.rect(bx, by, barWidth, barH);
          }
          ctx.fill();

          if (data.isSpurt) {
            ctx.fillStyle = pal.amber;
            ctx.beginPath();
            ctx.arc(bx + barWidth / 2, by - 8, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `bold 9px ${FONTS.mono}`;
            ctx.textAlign = 'center';
            ctx.fillText('⚡', bx + barWidth / 2, by - 16);
          }
        }

        if (isSolo) {
          drawBar(da, activeColorA, 0);
        } else {
          drawBar(da, activeColorA, -barWidth / 2 - 2);
          drawBar(db, activeColorB, barWidth / 2 + 2);
        }
      });

      const hasAnyData = vDataA.some(d => d.rate !== null) || vDataB.some(d => d.rate !== null);
      if (!hasAnyData) {
        ctx.save();
        const midX = padding.left + (chartWidth - padding.left - padding.right) / 2;
        const midY = padding.top + (chartHeight - padding.top - padding.bottom) / 2;
        const bannerW = 200;
        const bannerH = 40;

        ctx.fillStyle = pal.emptyBannerBg;
        ctx.strokeStyle = pal.emptyBannerBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH, 8);
        else ctx.rect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH);
        ctx.fill();
        ctx.stroke();

        ctx.font = `600 13px ${FONTS.body}`;
        ctx.fillStyle = pal.inkMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No measurements yet', midX, midY);
        ctx.restore();
      }
    }

    function handlePointer(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      const clientY = (evt.touches ? evt.touches[0].clientY : evt.clientY);
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        if (tooltip) tooltip.style.display = 'none';
        return;
      }

      const availWidth = chartWidth - padding.left - padding.right;
      const groupWidth = availWidth / brackets.length;
      const idx = Math.floor((mx - padding.left) / groupWidth);
      if (idx < 0 || idx >= brackets.length) {
        if (tooltip) tooltip.style.display = 'none';
        return;
      }

      const br = brackets[idx];
      const da = vDataA[idx];
      const db = vDataB[idx];
      const ref = (EXPECTED_VELOCITY[metric] && EXPECTED_VELOCITY[metric][br.id]) || { min: 0, max: 0, median: 0 };

      const formatRate = (rate) => {
        if (rate === null || isNaN(rate)) return 'No data';
        const disp = unitSystem === 'imperial'
          ? (metric === 'height' || metric === 'head' ? (rate / 2.54).toFixed(1) : (rate * 2.20462).toFixed(1))
          : rate.toFixed(1);
        return `${disp} ${unitLabel}`;
      };

      if (tooltip) {
        const pal = getChartThemePalette();
        const activeColorA = getChildColor(childA);
        const activeColorB = childB ? getChildColor(childB) : null;
        if (isSolo) {
          tooltip.innerHTML = `
            <div style="font-weight:700; color:var(--ink-primary, ${pal.ink}); font-size:12px; margin-bottom:4px;">
              Interval: ${br.label} (${br.minAge}–${br.maxAge} months)
            </div>
            <div style="padding:6px 0; border-top:1px solid var(--border-stone, ${pal.grid}); border-bottom:1px solid var(--border-stone, ${pal.grid}); margin-bottom:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:${activeColorA}; font-weight:700;">${childA ? childA.name : 'Child'}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:800; font-size:13px; color:var(--ink-primary, ${pal.ink});">${formatRate(da ? da.rate : null)}</span>
              </div>
              <div style="font-size:10px; color:var(--ink-secondary, ${pal.inkMuted}); margin-top:2px;">
                Normative Band: ${ref.min}–${ref.max} ${unitLabel}
              </div>
            </div>
            ${(da && da.isSpurt) ? `
              <div style="font-size:10px; color:var(--amber-ink, ${pal.amber}); font-weight:700; display:flex; align-items:center; gap:4px;">
                <span>⚡</span> Accelerated growth spurt detected!
              </div>
            ` : ''}
          `;
        } else {
          tooltip.innerHTML = `
            <div style="font-weight:700; color:var(--ink-primary, ${pal.ink}); font-size:12px; margin-bottom:6px;">
              Bracket: ${br.label} (${br.minAge}–${br.maxAge} months)
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; padding:6px 0; border-top:1px solid var(--border-stone, ${pal.grid}); border-bottom:1px solid var(--border-stone, ${pal.grid});">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:${activeColorA}; font-weight:700;">${childA ? childA.name : 'Child A'}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:700; color:var(--ink-primary, ${pal.ink});">${formatRate(da ? da.rate : null)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:${activeColorB}; font-weight:700;">${childB ? childB.name : 'Child B'}:</span>
                <span style="font-family:${FONTS.mono}; font-weight:700; color:var(--ink-primary, ${pal.ink});">${formatRate(db ? db.rate : null)}</span>
              </div>
            </div>
            ${((da && da.isSpurt) || (db && db.isSpurt)) ? `
              <div style="margin-top:6px; font-size:10px; color:var(--amber-ink, ${pal.amber}); font-weight:700; display:flex; align-items:center; gap:4px;">
                <span>⚡</span> Growth spurt detected in this interval!
              </div>
            ` : ''}
          `;
        }

        tooltip.style.display = 'block';
        tooltip.style.maxWidth = Math.min(280, chartWidth - 16) + 'px';
        const tipWidth = tooltip.offsetWidth || 230;
        const tipHeight = tooltip.offsetHeight || 100;
        let left = mx + 16;
        if (left + tipWidth > chartWidth - 8) {
          left = mx - tipWidth - 16;
        }
        left = Math.max(8, Math.min(chartWidth - tipWidth - 8, left));
        let top = my - 40;
        top = Math.max(8, Math.min(chartHeight - tipHeight - 8, top));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    }

    canvas.addEventListener('mousemove', handlePointer);
    canvas.addEventListener('mouseleave', () => { if (tooltip) tooltip.style.display = 'none'; });
    canvas.addEventListener('touchstart', handlePointer, { passive: true });
    canvas.addEventListener('touchmove', handlePointer, { passive: true });

    const onDocTouchStart = (evt) => {
      if (tooltip && wrapper && typeof wrapper.contains === 'function' && !wrapper.contains(evt.target)) {
        tooltip.style.display = 'none';
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', onDocTouchStart, { passive: true });
    }

    draw();
    let lastW = chartWidth;
    let lastH = chartHeight;
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        if (!entries || !entries.length) return;
        const entry = entries[0];
        const w = (entry.contentRect && entry.contentRect.width) || wrapper.clientWidth;
        const h = (entry.contentRect && entry.contentRect.height) || wrapper.clientHeight;
        if (Math.abs(w - lastW) >= 1 || Math.abs(h - lastH) >= 1) {
          lastW = w;
          lastH = h;
          draw();
        }
      });
      resizeObserver.observe(wrapper);
    }

    const controller = {
      containerEl,
      destroy: () => {
        if (resizeObserver) resizeObserver.disconnect();
        if (typeof document !== 'undefined') {
          document.removeEventListener('touchstart', onDocTouchStart);
        }
        activeChartControllers.delete(controller);
      },
      redraw: draw
    };
    activeChartControllers.add(controller);
    return controller;
  }

  function renderSingleVelocityChart(containerEl, child, options = {}) {
    return renderVelocityChart(containerEl, child, null, options);
  }

  /**
   * 4. RENDER HEIGHT WALL
   * Interactive SVG Side-by-Side Height Wall & Silhouette Comparator with auto-scaling ceiling
   */
  function renderHeightWall(containerEl, childA, childB, arg4, arg5) {
    if (!containerEl || typeof document === 'undefined') return null;
    let comparisonData = null;
    let options = {};
    if (typeof arg4 === 'number') {
      comparisonData = { ageMonths: arg4 };
      options = (arg5 && typeof arg5 === 'object') ? { ...arg5 } : {};
    } else if (arg4 && typeof arg4 === 'object') {
      comparisonData = arg4;
      options = (arg5 && typeof arg5 === 'object') ? { ...arg5 } : {};
    } else if (arg5 && typeof arg5 === 'object') {
      options = { ...arg5 };
    }

    const unitSystem = options.unitSystem || 'metric';

    containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    const isMobileWall = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 520;
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.minHeight = isMobileWall ? '0px' : '420px';
    wrapper.style.position = 'relative';
    wrapper.style.borderRadius = '12px';
    wrapper.style.overflow = 'hidden';
    containerEl.appendChild(wrapper);

    const getLatestHeight = (c) => {
      const ms = ((c && c.measurements) || []).filter(m => {
        const v = getMeasurementValue(m, 'height');
        return v !== undefined && v !== null && !isNaN(v);
      });
      return ms.length ? getMeasurementValue(ms[ms.length - 1], 'height') : 85;
    };
    const getLatestWeight = (c) => {
      const ms = ((c && c.measurements) || []).filter(m => {
        const v = getMeasurementValue(m, 'weight');
        return v !== undefined && v !== null && !isNaN(v);
      });
      return ms.length ? getMeasurementValue(ms[ms.length - 1], 'weight') : 12;
    };

    function drawWall() {
      const pal = getChartThemePalette();
      wrapper.style.background = pal.wallBg;
      wrapper.style.border = '1px solid ' + pal.wallBorder;

      const hasChildB = Boolean(childB && (
        (childB.measurements && childB.measurements.length > 0) ||
        childB.heightCm != null ||
        childB.height != null ||
        (comparisonData && comparisonData.childB)
      ));
      const isBenchmarkB = Boolean(childB && childB.isBenchmark);

      let hA = 85;
      let wA = 12;
      let hB = 83;
      let wB = 11.5;
      let pctA = 50;
      let pctB = 50;
      let compTitle = hasChildB ? 'At Same Age Comparison' : 'Growth Height Wall';
      let ageA = null;
      let ageB = null;

      if (comparisonData) {
        if (comparisonData.childA) {
          hA = comparisonData.childA.heightCm ?? comparisonData.childA.height ?? getMeasurementValue(comparisonData.childA, 'height') ?? hA;
          wA = comparisonData.childA.weightKg ?? comparisonData.childA.weight ?? getMeasurementValue(comparisonData.childA, 'weight') ?? wA;
          pctA = comparisonData.childA.heightStats?.percentile ?? comparisonData.childA.heightPercentile ?? comparisonData.childA.percentileHeight ?? pctA;
          ageA = comparisonData.childA.ageMonths ?? comparisonData.ageMonths ?? null;
        }
        if (comparisonData.childB && hasChildB) {
          hB = comparisonData.childB.heightCm ?? comparisonData.childB.height ?? getMeasurementValue(comparisonData.childB, 'height') ?? hB;
          wB = comparisonData.childB.weightKg ?? comparisonData.childB.weight ?? getMeasurementValue(comparisonData.childB, 'weight') ?? wB;
          pctB = comparisonData.childB.heightStats?.percentile ?? comparisonData.childB.heightPercentile ?? comparisonData.childB.percentileHeight ?? pctB;
          ageB = comparisonData.childB.ageMonths ?? comparisonData.ageMonths ?? null;
        }
        if (comparisonData.ageMonths !== undefined && comparisonData.ageMonths !== null) {
          compTitle = `At Biological Age ${comparisonData.ageMonths} Months`;
        } else {
          compTitle = hasChildB ? 'Current Heights (Today)' : 'Current Stature (Today)';
        }
      } else {
        hA = getLatestHeight(childA);
        wA = getLatestWeight(childA);
        if (hasChildB) {
          hB = getLatestHeight(childB);
          wB = getLatestWeight(childB);
          compTitle = 'Current Heights (Today)';
        } else {
          compTitle = 'Current Stature (Today)';
        }
      }

      const engine = getSafeEngine();
      if (pctA == null || pctA === 50) {
        const lastMA = (childA?.measurements || [])[childA?.measurements?.length - 1];
        const effAgeA = ageA ?? lastMA?.ageMonths ?? 24;
        const statA = calcStats(engine, childA, 'height', effAgeA, hA);
        if (!isNaN(statA.percentile)) pctA = statA.percentile;
      }
      if (hasChildB && (pctB == null || pctB === 50)) {
        const lastMB = (childB?.measurements || [])[childB?.measurements?.length - 1];
        const effAgeB = ageB ?? lastMB?.ageMonths ?? 24;
        const statB = calcStats(engine, childB, 'height', effAgeB, hB);
        if (!isNaN(statB.percentile)) pctB = statB.percentile;
      }

      // Dynamic auto-scale maxWallCm up to 200cm
      const maxH = Math.max(hA, hasChildB ? hB : hA, 85);
      const minWallCm = 40;
      const maxWallCm = Math.min(200, Math.max(130, Math.ceil((maxH + 15) / 10) * 10));
      const wallHeight = 440;
      const wallWidth = 620;

      function cmToY(cm) {
        const r = (cm - minWallCm) / (maxWallCm - minWallCm);
        return (wallHeight - 40) - r * (wallHeight - 80);
      }

      const yA = cmToY(hA);
      const yB = cmToY(hB);
      const floorY = cmToY(minWallCm);

      // Build SVG Ruler ticks
      let rulerTicksLeft = '';
      let rulerTicksRight = '';
      for (let c = minWallCm; c <= maxWallCm; c += 5) {
        const cy = cmToY(c);
        const isMajor = c % 10 === 0;
        const tickW = isMajor ? 16 : 9;
        rulerTicksLeft += `
          <line x1="36" y1="${cy}" x2="${36 + tickW}" y2="${cy}" stroke="${pal.wallTick}" stroke-width="${isMajor ? 1.5 : 1}" />
          ${isMajor ? `<text x="30" y="${cy + 3}" fill="${pal.wallRulerText}" font-size="11" font-family="${FONTS.mono}" text-anchor="end">${c}</text>` : ''}
        `;
      }

      const minInches = Math.floor(minWallCm / 2.54);
      const maxInches = Math.ceil(maxWallCm / 2.54);
      for (let inch = minInches; inch <= maxInches; inch += 2) {
        const c = inch * 2.54;
        if (c < minWallCm || c > maxWallCm) continue;
        const cy = cmToY(c);
        const isFoot = inch % 12 === 0;
        const tickW = isFoot ? 18 : 10;
        const feet = Math.floor(inch / 12);
        const remIn = inch % 12;
        const label = isFoot ? `${feet}′` : `${inch}″`;
        rulerTicksRight += `
          <line x1="${wallWidth - 36}" y1="${cy}" x2="${wallWidth - 36 - tickW}" y2="${cy}" stroke="${pal.wallTick}" stroke-width="${isFoot ? 1.5 : 1}" />
          <text x="${wallWidth - 28}" y="${cy + 3}" fill="${pal.wallRulerText}" font-size="11" font-family="${FONTS.mono}" text-anchor="start">${label}</text>
        `;
      }

      function generateSilhouetteSVG(cx, headY, color, isFemale, name, isBenchmark = false) {
        const totalH = floorY - headY;
        const headRadius = Math.max(14, totalH * 0.14);
        const headCenterY = headY + headRadius;
        const torsoY = headCenterY + headRadius + 4;
        const hipY = headY + totalH * 0.58;
        const bodyWidth = headRadius * 1.6;
        const op = isBenchmark ? 0.45 : 0.92;
        const shadowColor = pal.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(30, 41, 35, 0.08)';

        return `
          <g class="ks-child-silhouette" data-name="${name}">
            <ellipse cx="${cx}" cy="${floorY + 2}" rx="${headRadius * 1.8}" ry="4" fill="${shadowColor}" />

            ${isFemale ? `
              <path d="M ${cx - bodyWidth * 0.5} ${torsoY}
                       L ${cx + bodyWidth * 0.5} ${torsoY}
                       L ${cx + bodyWidth * 0.9} ${hipY + 8}
                       L ${cx - bodyWidth * 0.9} ${hipY + 8} Z"
                    fill="${color}" opacity="${op}" rx="4" />
            ` : `
              <rect x="${cx - bodyWidth * 0.6}" y="${torsoY}" width="${bodyWidth * 1.2}" height="${hipY - torsoY + 4}" rx="6" fill="${color}" opacity="${op}" />
            `}

            <line x1="${cx - bodyWidth * 0.3}" y1="${hipY + 4}" x2="${cx - bodyWidth * 0.3}" y2="${floorY}" stroke="${color}" stroke-width="${Math.max(5, bodyWidth * 0.25)}" stroke-linecap="round" opacity="${op}" />
            <line x1="${cx + bodyWidth * 0.3}" y1="${hipY + 4}" x2="${cx + bodyWidth * 0.3}" y2="${floorY}" stroke="${color}" stroke-width="${Math.max(5, bodyWidth * 0.25)}" stroke-linecap="round" opacity="${op}" />

            <ellipse cx="${cx - bodyWidth * 0.3 - 2}" cy="${floorY}" rx="${headRadius * 0.45}" ry="3.5" fill="${pal.wallShoe}" />
            <ellipse cx="${cx + bodyWidth * 0.3 + 2}" cy="${floorY}" rx="${headRadius * 0.45}" ry="3.5" fill="${pal.wallShoe}" />

            <circle cx="${cx}" cy="${headCenterY}" r="${headRadius}" fill="#F6D3B3" opacity="${op}" />
            
            ${isFemale ? `
              <path d="M ${cx - headRadius} ${headCenterY} C ${cx - headRadius} ${headCenterY - headRadius * 1.3}, ${cx + headRadius} ${headCenterY - headRadius * 1.3}, ${cx + headRadius} ${headCenterY}" fill="#3C2A1E" opacity="${op}" />
              <circle cx="${cx - headRadius - 2}" cy="${headCenterY - 2}" r="${headRadius * 0.45}" fill="#3C2A1E" opacity="${op}" />
              <circle cx="${cx + headRadius + 2}" cy="${headCenterY - 2}" r="${headRadius * 0.45}" fill="#3C2A1E" opacity="${op}" />
              <circle cx="${cx - headRadius - 2}" cy="${headCenterY - 6}" r="3" fill="${color}" />
              <circle cx="${cx + headRadius + 2}" cy="${headCenterY - 6}" r="3" fill="${color}" />
            ` : `
              <path d="M ${cx - headRadius} ${headCenterY - 2} C ${cx - headRadius} ${headCenterY - headRadius * 1.4}, ${cx + headRadius} ${headCenterY - headRadius * 1.4}, ${cx + headRadius} ${headCenterY - 2}" fill="#5A3E26" opacity="${op}" />
              <path d="M ${cx - 4} ${headCenterY - headRadius - 2} L ${cx} ${headCenterY - headRadius - 6} L ${cx + 4} ${headCenterY - headRadius - 2} Z" fill="#5A3E26" opacity="${op}" />
            `}

            <circle cx="${cx - headRadius * 0.35}" cy="${headCenterY + 1}" r="1.5" fill="#2E231F" />
            <circle cx="${cx + headRadius * 0.35}" cy="${headCenterY + 1}" r="1.5" fill="#2E231F" />
            <path d="M ${cx - 3} ${headCenterY + 5} Q ${cx} ${headCenterY + 7} ${cx + 3} ${headCenterY + 5}" stroke="#C85A32" stroke-width="1.2" fill="none" stroke-linecap="round" />
          </g>
        `;
      }

      const posAX = hasChildB ? 200 : wallWidth / 2;
      const posBX = 420;

      const isFemaleA = normalizeSex(childA) === 'F';
      const isFemaleB = normalizeSex(childB) === 'F';
      const nameA = childA ? childA.name : 'Child 1';
      const nameB = childB ? (childB.name || (isBenchmarkB ? 'WHO 50th Peer' : 'Child 2')) : '';
      const colorA = getChildColor(childA);
      const colorB = childB ? (isBenchmarkB ? pal.inkMuted : getChildColor(childB)) : pal.inkMuted;

      const deltaCm = hA - hB;
      let deltaText = '';
      if (Math.abs(deltaCm) < 0.2) {
        deltaText = 'Identical height';
      } else if (deltaCm > 0) {
        deltaText = `${nameA} +${deltaCm.toFixed(1)} cm taller`;
      } else {
        deltaText = `${nameB} +${Math.abs(deltaCm).toFixed(1)} cm taller`;
      }

      const formatWallOrd = (p) => {
        if (engine && typeof engine.formatOrdinal === 'function') return engine.formatOrdinal(p);
        return `${Math.round(p)}th`;
      };

      const pctDispA = (pctA != null && !isNaN(pctA)) ? ` · ${formatWallOrd(pctA)} %` : '';
      const pctDispB = (pctB != null && !isNaN(pctB)) ? ` · ${formatWallOrd(pctB)} %` : '';

      const svgHTML = `
        <svg viewBox="0 0 ${wallWidth} ${wallHeight}" width="100%" style="display:block; width:100%; height:auto;" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="rulerWoodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="${pal.wallWoodStart}" />
              <stop offset="50%" stop-color="${pal.wallWoodMid}" />
              <stop offset="100%" stop-color="${pal.wallWoodEnd}" />
            </linearGradient>
          </defs>

          <rect x="0" y="${floorY}" width="${wallWidth}" height="40" fill="${pal.wallFloor}" />
          <line x1="0" y1="${floorY}" x2="${wallWidth}" y2="${floorY}" stroke="${pal.wallFloorStroke}" stroke-width="2" />

          <rect x="36" y="24" width="28" height="${floorY - 24}" fill="url(#rulerWoodGrad)" stroke="${pal.wallFloorStroke}" stroke-width="1.5" rx="3" />
          ${rulerTicksLeft}
          <text x="50" y="20" fill="${pal.wallRulerText}" font-size="11" font-family="${FONTS.mono}" font-weight="700" text-anchor="middle">CM</text>

          <rect x="${wallWidth - 64}" y="24" width="28" height="${floorY - 24}" fill="url(#rulerWoodGrad)" stroke="${pal.wallFloorStroke}" stroke-width="1.5" rx="3" />
          ${rulerTicksRight}
          <text x="${wallWidth - 50}" y="20" fill="${pal.wallRulerText}" font-size="11" font-family="${FONTS.mono}" font-weight="700" text-anchor="middle">IN</text>

          ${generateSilhouetteSVG(posAX, yA, colorA, isFemaleA, nameA)}
          ${hasChildB ? generateSilhouetteSVG(posBX, yB, colorB, isFemaleB, nameB, isBenchmarkB) : ''}

          <g>
            <line x1="64" y1="${yA}" x2="${hasChildB ? posAX + 70 : wallWidth - 64}" y2="${yA}" stroke="${colorA}" stroke-width="1.8" stroke-dasharray="4,3" />
            <line x1="${posAX - 60}" y1="${yA}" x2="${posAX + 60}" y2="${yA}" stroke="${colorA}" stroke-width="2.5" />
            <circle cx="${posAX}" cy="${yA}" r="4" fill="${colorA}" stroke="#FFFFFF" stroke-width="2" />
          </g>

          ${hasChildB ? `
            <g>
              <line x1="${posBX - 70}" y1="${yB}" x2="${wallWidth - 64}" y2="${yB}" stroke="${colorB}" stroke-width="1.8" stroke-dasharray="4,3" />
              <line x1="${posBX - 60}" y1="${yB}" x2="${posBX + 60}" y2="${yB}" stroke="${colorB}" stroke-width="2.5" />
              <circle cx="${posBX}" cy="${yB}" r="4" fill="${colorB}" stroke="#FFFFFF" stroke-width="2" />
            </g>

            <g transform="translate(${(posAX + posBX) / 2}, ${(yA + yB) / 2})">
              <line x1="0" y1="${(yA - yB) / 2}" x2="0" y2="${(yB - yA) / 2}" stroke="${pal.amber}" stroke-width="2" />
              <line x1="-12" y1="${(yA - yB) / 2}" x2="12" y2="${(yA - yB) / 2}" stroke="${pal.amber}" stroke-width="2" />
              <line x1="-12" y1="${(yB - yA) / 2}" x2="12" y2="${(yB - yA) / 2}" stroke="${pal.amber}" stroke-width="2" />

              <rect x="-75" y="-12" width="150" height="24" rx="12" fill="${pal.wallCardBg}" stroke="${pal.amber}" stroke-width="1.5" />
              <text x="0" y="4" fill="${pal.amber}" font-size="12" font-family="${FONTS.mono}" font-weight="800" text-anchor="middle">
                Δ ${deltaText}
              </text>
            </g>

            <g transform="translate(${posBX}, ${Math.min(yB - 42, 60)})">
              <rect x="-65" y="-14" width="130" height="28" rx="6" fill="${pal.wallCardBg}" stroke="${colorB}" stroke-width="1.5" />
              <text x="0" y="-1" fill="${colorB}" font-size="12" font-family="${FONTS.body}" font-weight="800" text-anchor="middle">${nameB}</text>
              <text x="0" y="10" fill="${pal.ink}" font-size="11" font-family="${FONTS.mono}" font-weight="600" text-anchor="middle">${formatValue(hB, 'height', unitSystem)}${pctDispB}</text>
            </g>
          ` : ''}

          <g transform="translate(${posAX}, ${Math.min(yA - 42, 60)})">
            <rect x="-65" y="-14" width="130" height="28" rx="6" fill="${pal.wallCardBg}" stroke="${colorA}" stroke-width="1.5" />
            <text x="0" y="-1" fill="${colorA}" font-size="12" font-family="${FONTS.body}" font-weight="800" text-anchor="middle">${nameA}</text>
            <text x="0" y="10" fill="${pal.ink}" font-size="11" font-family="${FONTS.mono}" font-weight="600" text-anchor="middle">${formatValue(hA, 'height', unitSystem)}${pctDispA}</text>
          </g>

          <text x="${wallWidth / 2}" y="24" fill="${pal.inkMuted}" font-size="13" font-family="${FONTS.body}" font-weight="600" text-anchor="middle">
            ${compTitle}
          </text>
        </svg>
      `;

      wrapper.innerHTML = svgHTML;
    }

    drawWall();

    const controller = {
      containerEl,
      get svgHTML() { return wrapper.innerHTML; },
      redraw: drawWall,
      update: (newCompData) => {
        if (newCompData !== undefined) comparisonData = newCompData;
        drawWall();
      },
      destroy: () => {
        activeChartControllers.delete(controller);
        wrapper.innerHTML = '';
      }
    };
    activeChartControllers.add(controller);
    return controller;
  }

  /**
   * 5. RENDER WEIGHT-FOR-LENGTH CHART
   * WHO Growth Standard Weight-for-Length curves (45cm to 110cm)
   */
  function renderWeightForLengthChart(containerEl, child, options = {}) {
    if (!containerEl || typeof document === 'undefined') return null;
    const unitSystem = options.unitSystem || 'metric';
    const sex = normalizeSex(child);

    // Filter checkup points that have BOTH height/length and weight
    const measurements = ((child && child.measurements) || [])
      .map(m => {
        const len = getMeasurementValue(m, 'height');
        const wt = getMeasurementValue(m, 'weight');
        return {
          ...m,
          lengthCm: len,
          weightKg: wt,
          date: m.date || m.visitDate
        };
      })
      .filter(m => m.lengthCm !== null && m.weightKg !== null && !isNaN(m.lengthCm) && !isNaN(m.weightKg) && m.lengthCm >= 40 && m.lengthCm <= 125 && m.weightKg > 0)
      .sort((a, b) => a.lengthCm - b.lengthCm);

    const minLen = 45;
    const maxLen = 110;

    containerEl.innerHTML = '';
    const wrapper = document.createElement('div');
    const isMobile = typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 640;
    const fixedH = options.height || parseInt(containerEl.style && containerEl.style.height, 10) || (isMobile ? 300 : (parseInt(containerEl.style && containerEl.style.minHeight, 10) || 380));
    wrapper.style.width = '100%';
    wrapper.style.height = fixedH + 'px';
    wrapper.style.minHeight = fixedH + 'px';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    containerEl.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    const tooltip = createTooltip(wrapper, 'ks-wfl-tooltip');

    const engine = getSafeEngine();
    let curves = null;
    if (engine && typeof engine.getWeightForLengthCurves === 'function') {
      try {
        const raw = engine.getWeightForLengthCurves(sex, 1);
        curves = normalizeCurves(raw);
      } catch (e) {
        // quiet fallback
      }
    }
    if (!curves || !curves.p50 || curves.p50.length === 0) {
      curves = getWeightForLengthCurvesFallback(sex, minLen, maxLen, 1);
    }

    // Ensure all curve points have len and value
    ['p3', 'p10', 'p15', 'p25', 'p50', 'p75', 'p85', 'p90', 'p97'].forEach(k => {
      if (Array.isArray(curves[k])) {
        curves[k] = curves[k].map(p => ({
          ...p,
          len: p.len ?? p.lengthCm ?? p.length ?? p.age,
          value: p.value ?? p.val
        }));
      }
    });

    let minY = Infinity;
    let maxY = -Infinity;
    ['p3', 'p10', 'p15', 'p25', 'p50', 'p75', 'p85', 'p90', 'p97'].forEach(k => {
      if (curves[k]) {
        curves[k].forEach(pt => {
          if (pt.value < minY) minY = pt.value;
          if (pt.value > maxY) maxY = pt.value;
        });
      }
    });
    measurements.forEach(m => {
      if (m.weightKg < minY) minY = m.weightKg;
      if (m.weightKg > maxY) maxY = m.weightKg;
    });

    if (minY === Infinity) {
      minY = 2.0;
      maxY = 24.0;
    }
    const yPad = (maxY - minY) * 0.08;
    minY = Math.max(0, minY - yPad);
    maxY = maxY + yPad;

    let chartWidth = 0;
    let chartHeight = 0;
    const padding = { top: 34, right: 54, bottom: 44, left: 54 };

    function toScreenX(len) {
      return padding.left + ((len - minLen) / (maxLen - minLen)) * (chartWidth - padding.left - padding.right);
    }
    function toScreenY(wt) {
      return (chartHeight - padding.bottom) - ((wt - minY) / (maxY - minY)) * (chartHeight - padding.top - padding.bottom);
    }
    function fromScreenX(sx) {
      const ratio = (sx - padding.left) / (chartWidth - padding.left - padding.right);
      return Math.max(minLen, Math.min(maxLen, minLen + ratio * (maxLen - minLen)));
    }
    function fromScreenY(sy) {
      const ratio = ((chartHeight - padding.bottom) - sy) / (chartHeight - padding.top - padding.bottom);
      return minY + ratio * (maxY - minY);
    }

    function draw() {
      const rect = (wrapper.getBoundingClientRect && wrapper.getBoundingClientRect()) || {};
      chartWidth = rect.width || 600;
      chartHeight = rect.height || 360;
      const { ctx } = setupHighDPICanvas(canvas, chartWidth, chartHeight);
      const pal = getChartThemePalette();
      const activeChildColor = getChildColor(child);

      if (chartWidth < 420) {
        padding.top = 28;
        padding.right = 38;
        padding.bottom = 40;
        padding.left = 48;
      } else {
        padding.top = 34;
        padding.right = 54;
        padding.bottom = 44;
        padding.left = 54;
      }

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      // X Grid: Length 45 to 110 cm
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.gridSubtle;
      ctx.font = `11px ${FONTS.mono}`;
      ctx.fillStyle = pal.inkLight;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const lenStep = chartWidth < 380 ? 15 : (chartWidth < 520 ? 10 : 5);
      for (let len = 45; len <= 110; len += lenStep) {
        const sx = toScreenX(len);
        ctx.beginPath();
        ctx.strokeStyle = (len % 10 === 0) ? pal.grid : pal.gridSubtle;
        ctx.moveTo(sx, padding.top);
        ctx.lineTo(sx, chartHeight - padding.bottom);
        ctx.stroke();

        const disp = unitSystem === 'imperial' ? (len / 2.54).toFixed(0) : len;
        ctx.fillText(disp, sx, chartHeight - padding.bottom + 8);
      }

      ctx.font = `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText(`Length / Stature (${unitSystem === 'imperial' ? 'in' : 'cm'})`, chartWidth / 2, chartHeight - 14);

      // Y Grid: Weight in kg
      const ySpan = maxY - minY;
      const rawStep = ySpan / 6;
      let yStep = Math.pow(10, Math.floor(Math.log10(rawStep)));
      if (rawStep / yStep > 5) yStep *= 5;
      else if (rawStep / yStep > 2) yStep *= 2;
      if (yStep <= 0) yStep = 1;

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const firstY = Math.ceil(minY / yStep) * yStep;

      for (let wt = firstY; wt <= maxY; wt += yStep) {
        const sy = toScreenY(wt);
        ctx.beginPath();
        ctx.strokeStyle = pal.gridSubtle;
        ctx.moveTo(padding.left, sy);
        ctx.lineTo(chartWidth - padding.right, sy);
        ctx.stroke();

        const disp = unitSystem === 'imperial' ? (wt * 2.20462).toFixed(0) : wt.toFixed(0);
        ctx.fillStyle = pal.inkLight;
        ctx.font = `10px ${FONTS.mono}`;
        ctx.fillText(disp, padding.left - 8, sy);
      }

      ctx.save();
      ctx.translate(chartWidth < 420 ? 11 : 14, chartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.font = chartWidth < 420 ? `10px ${FONTS.body}` : `11px ${FONTS.body}`;
      ctx.fillStyle = pal.inkMuted;
      ctx.fillText(`Weight (${unitSystem === 'imperial' ? 'lb' : 'kg'})`, 0, 0);
      ctx.restore();

      // Bands
      function fillBand(cLow, cHigh, color) {
        if (!cLow || !cHigh || cLow.length === 0 || cHigh.length === 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
        safeClip(ctx);

        ctx.beginPath();
        const ptsHigh = cHigh.map(p => ({ x: toScreenX(p.len ?? p.lengthCm ?? p.age), y: toScreenY(p.value) }));
        const ptsLow = cLow.map(p => ({ x: toScreenX(p.len ?? p.lengthCm ?? p.age), y: toScreenY(p.value) }));

        drawSpline(ctx, ptsHigh, 0.2);
        for (let i = ptsLow.length - 1; i >= 0; i--) {
          ctx.lineTo(ptsLow[i].x, ptsLow[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      const bOuter = colorToRgba(activeChildColor, pal.isDark ? 0.08 : 0.05);
      const bMid = colorToRgba(activeChildColor, pal.isDark ? 0.14 : 0.09);
      const bCore = colorToRgba(activeChildColor, pal.isDark ? 0.22 : 0.14);

      const outerLow = curves.p3;
      const outerHigh = curves.p97;
      const midLow = curves.p10 || curves.p15 || curves.p25;
      const midHigh = curves.p90 || curves.p85 || curves.p75;
      const coreLow = curves.p25 || curves.p15;
      const coreHigh = curves.p75 || curves.p85;

      if (outerLow && outerHigh) fillBand(outerLow, outerHigh, bOuter);
      if (midLow && midHigh && midLow !== outerLow) fillBand(midLow, midHigh, bMid);
      if (coreLow && coreHigh && coreLow !== midLow) fillBand(coreLow, coreHigh, bCore);

      function drawCurveLine(curve, strokeStyle, lineWidth = 1, isDashed = false) {
        if (!curve || curve.length === 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
        safeClip(ctx);

        ctx.beginPath();
        if (isDashed) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        const pts = curve.map(p => ({ x: toScreenX(p.len ?? p.lengthCm ?? p.age), y: toScreenY(p.value) }));
        drawSpline(ctx, pts, 0.2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (curves.p3) drawCurveLine(curves.p3, pal.curveOuter, 1, true);
      if (curves.p10) drawCurveLine(curves.p10, pal.curveMid, 1, true);
      if (curves.p15) drawCurveLine(curves.p15, pal.curveMid, 1, true);
      if (curves.p25) drawCurveLine(curves.p25, pal.curveMid, 1, true);
      if (curves.p50) drawCurveLine(curves.p50, pal.curveMedian, 1.5, false);
      if (curves.p75) drawCurveLine(curves.p75, pal.curveMid, 1, true);
      if (curves.p85) drawCurveLine(curves.p85, pal.curveMid, 1, true);
      if (curves.p90) drawCurveLine(curves.p90, pal.curveMid, 1, true);
      if (curves.p97) drawCurveLine(curves.p97, pal.curveOuter, 1, true);

      // Direct Right-Edge Labels
      const candidateLabels = [
        { key: 'p97', text: '97th' },
        { key: 'p90', text: '90th' },
        { key: 'p85', text: '85th' },
        { key: 'p75', text: '75th' },
        { key: 'p50', text: '50th' },
        { key: 'p25', text: '25th' },
        { key: 'p15', text: '15th' },
        { key: 'p10', text: '10th' },
        { key: 'p3', text: '3rd' }
      ];

      const rightLabels = candidateLabels.filter(l => Array.isArray(curves[l.key]) && curves[l.key].length > 0);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      rightLabels.forEach(({ key, text }) => {
        const arr = curves[key];
        if (arr && arr.length) {
          const last = arr[arr.length - 1];
          const lx = chartWidth - padding.right + 6;
          const ly = toScreenY(last.value);
          ctx.font = key === 'p50' ? `bold 10px ${FONTS.mono}` : `9px ${FONTS.mono}`;
          ctx.fillStyle = key === 'p50' ? pal.ink : pal.inkMuted;
          ctx.fillText(text, lx, ly);
        }
      });

      // Child Measurements
      if (measurements.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padding.left, padding.top, chartWidth - padding.left - padding.right, chartHeight - padding.top - padding.bottom);
        safeClip(ctx);

        const pts = measurements.map(m => ({
          x: toScreenX(m.lengthCm),
          y: toScreenY(m.weightKg),
          m
        }));

        ctx.beginPath();
        ctx.strokeStyle = activeChildColor;
        ctx.lineWidth = 3;
        drawSpline(ctx, pts, 0.25);
        ctx.stroke();

        pts.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = pal.pointHalo;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = activeChildColor;
          ctx.fill();
        });

        ctx.restore();
      } else {
        ctx.save();
        const midX = padding.left + (chartWidth - padding.left - padding.right) / 2;
        const midY = padding.top + (chartHeight - padding.top - padding.bottom) / 2;
        const bannerW = 220;
        const bannerH = 40;

        ctx.fillStyle = pal.emptyBannerBg;
        ctx.strokeStyle = pal.emptyBannerBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH, 8);
        else ctx.rect(midX - bannerW / 2, midY - bannerH / 2, bannerW, bannerH);
        ctx.fill();
        ctx.stroke();

        ctx.font = `600 13px ${FONTS.body}`;
        ctx.fillStyle = pal.inkMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No length-weight pairs yet', midX, midY);
        ctx.restore();
      }
    }

    function handlePointer(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = (evt.touches ? evt.touches[0].clientX : evt.clientX);
      const clientY = (evt.touches ? evt.touches[0].clientY : evt.clientY);
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        if (tooltip) tooltip.style.display = 'none';
        draw();
        return;
      }

      const cursorLen = fromScreenX(mx);
      let nearest = null;
      let minDistance = Infinity;

      measurements.forEach(m => {
        const sx = toScreenX(m.lengthCm);
        const sy = toScreenY(m.weightKg);
        const dist = Math.hypot(mx - sx, my - sy);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = { ...m, sx, sy };
        }
      });

      draw();
      const ctx = canvas.getContext('2d');
      const pal = getChartThemePalette();
      const activeChildColor = getChildColor(child);

      if (ctx) {
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = pal.crosshair;
        ctx.lineWidth = 1;
        const cx = (nearest && minDistance < 24) ? nearest.sx : mx;
        ctx.moveTo(cx, padding.top);
        ctx.lineTo(cx, chartHeight - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (tooltip) {
        const cx = (nearest && minDistance < 24) ? nearest.sx : mx;
        let lenVal = cursorLen;
        let wtVal = 0;
        let dateStr = 'Reference Length';
        let isSnapped = (nearest && minDistance < 24);

        if (isSnapped && ctx) {
          lenVal = nearest.lengthCm;
          wtVal = nearest.weightKg;
          dateStr = nearest.date || 'Recorded Checkup';

          ctx.beginPath();
          ctx.arc(nearest.sx, nearest.sy, 8, 0, Math.PI * 2);
          ctx.fillStyle = activeChildColor;
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        } else {
          // interpolate median at cursorLen
          const { L, M, S } = getWflLMSFallback(sex, cursorLen);
          wtVal = M;
        }

        const { L, M, S } = getWflLMSFallback(sex, lenVal);
        const z = zScoreFromLMS(L, M, S, wtVal);
        const pct = zScoreToPercentile(z);

        tooltip.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
            <span style="font-weight:700; color:${activeChildColor}; font-size:13px;">${child ? child.name : 'Child'} (WFL)</span>
            <span style="font-family:${FONTS.mono}; font-size:11px; color:var(--ink-faint, ${pal.inkLight});">${dateStr}</span>
          </div>
          <div style="padding:6px 0; border-top:1px solid var(--border-stone, ${pal.grid}); border-bottom:1px solid var(--border-stone, ${pal.grid}); margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span style="color:var(--ink-secondary, ${pal.inkMuted});">Length:</span>
              <strong style="font-family:${FONTS.mono}; color:var(--ink-primary, ${pal.ink});">${formatDualValue(lenVal, 'height')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:2px;">
              <span style="color:var(--ink-secondary, ${pal.inkMuted});">Weight:</span>
              <strong style="font-family:${FONTS.mono}; color:var(--ink-primary, ${pal.ink});">${formatDualValue(wtVal, 'weight')}</strong>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <div>Percentile: <strong style="color:${activeChildColor}; font-family:${FONTS.mono};">${pct.toFixed(1)}%</strong></div>
            <div>Z-Score: <strong style="font-family:${FONTS.mono}; color:var(--ink-primary, ${pal.ink});">${z >= 0 ? '+' : ''}${z.toFixed(2)} SD</strong></div>
          </div>
        `;

        tooltip.style.display = 'block';
        tooltip.style.maxWidth = Math.min(280, chartWidth - 16) + 'px';
        const tipWidth = tooltip.offsetWidth || 230;
        const tipHeight = tooltip.offsetHeight || 120;
        let left = cx + 14;
        if (left + tipWidth > chartWidth - 8) {
          left = cx - tipWidth - 14;
        }
        left = Math.max(8, Math.min(chartWidth - tipWidth - 8, left));
        let top = my - 40;
        top = Math.max(8, Math.min(chartHeight - tipHeight - 8, top));
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    }

    function handleCanvasClick(evt) {
      const rect = (canvas.getBoundingClientRect && canvas.getBoundingClientRect()) || { left: 0, top: 0, width: chartWidth, height: chartHeight };
      const clientX = evt.clientX || 0;
      const clientY = evt.clientY || 0;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      if (mx < padding.left || mx > chartWidth - padding.right || my < padding.top || my > chartHeight - padding.bottom) {
        return;
      }

      let bestPoint = null;
      let bestDist = 14;

      measurements.forEach(m => {
        const sx = toScreenX(m.lengthCm);
        const sy = toScreenY(m.weightKg);
        const dist = Math.hypot(mx - sx, my - sy);
        if (dist <= bestDist) {
          bestDist = dist;
          const { L, M, S } = getWflLMSFallback(sex, m.lengthCm);
          const z = zScoreFromLMS(L, M, S, m.weightKg);
          bestPoint = {
            measurement: m,
            stats: { zScore: z, percentile: zScoreToPercentile(z) }
          };
        }
      });

      if (bestPoint && typeof options.onPointSelect === 'function') {
        options.onPointSelect(bestPoint.measurement, bestPoint.stats);
      } else if (!bestPoint && typeof options.onCanvasClick === 'function') {
        const clickedLen = Math.round(fromScreenX(mx) * 10) / 10;
        const clickedWt = Math.round(fromScreenY(my) * 100) / 100;
        options.onCanvasClick({ lengthCm: clickedLen, weightKg: clickedWt });
      }
    }

    canvas.addEventListener('mousemove', handlePointer);
    canvas.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.style.display = 'none';
      draw();
    });
    canvas.addEventListener('touchstart', handlePointer, { passive: true });
    canvas.addEventListener('touchmove', handlePointer, { passive: true });
    canvas.addEventListener('click', handleCanvasClick);

    const onDocTouchStart = (evt) => {
      if (tooltip && wrapper && typeof wrapper.contains === 'function' && !wrapper.contains(evt.target)) {
        tooltip.style.display = 'none';
        draw();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('touchstart', onDocTouchStart, { passive: true });
    }

    draw();
    let lastW = chartWidth;
    let lastH = chartHeight;
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        if (!entries || !entries.length) return;
        const entry = entries[0];
        const w = (entry.contentRect && entry.contentRect.width) || wrapper.clientWidth;
        const h = (entry.contentRect && entry.contentRect.height) || wrapper.clientHeight;
        if (Math.abs(w - lastW) >= 1 || Math.abs(h - lastH) >= 1) {
          lastW = w;
          lastH = h;
          draw();
        }
      });
      resizeObserver.observe(wrapper);
    }

    const controller = {
      containerEl,
      destroy: () => {
        if (resizeObserver) resizeObserver.disconnect();
        if (typeof document !== 'undefined') {
          document.removeEventListener('touchstart', onDocTouchStart);
        }
        canvas.removeEventListener('mousemove', handlePointer);
        canvas.removeEventListener('click', handleCanvasClick);
        activeChartControllers.delete(controller);
      },
      redraw: draw
    };
    activeChartControllers.add(controller);
    return controller;
  }
  /**
   * 6. RENDER QUAD OVERVIEW GRID
   * Synchronized 4-chart clinical sparkline card layout
   */
  function renderQuadOverviewGrid(containersMap, child, options = {}) {
    if (!containersMap || typeof document === 'undefined') return null;

    const ms = (child && child.measurements) || [];
    const latestM = ms.length ? ms[ms.length - 1] : null;
    const latestAge = latestM ? (latestM.ageMonths ?? latestM.age_months ?? 0) : 0;
    const latestHeight = latestM ? (getMeasurementValue(latestM, 'height') ?? 0) : 0;
    const useWfl = latestAge < 24 && latestHeight <= 110;

    const controllers = {};

    function broadcastCrosshair(sourceKey, ageMonths) {
      Object.keys(controllers).forEach(k => {
        if (k !== sourceKey && controllers[k] && typeof controllers[k].setExternalCrosshair === 'function') {
          controllers[k].setExternalCrosshair(ageMonths);
        }
      });
    }

    if (containersMap.height) {
      controllers.height = renderPercentileChart(containersMap.height, child, 'height', {
        ...options,
        onCrosshairMove: (age) => broadcastCrosshair('height', age)
      });
    }

    if (containersMap.weight) {
      controllers.weight = renderPercentileChart(containersMap.weight, child, 'weight', {
        ...options,
        onCrosshairMove: (age) => broadcastCrosshair('weight', age)
      });
    }

    if (containersMap.head) {
      controllers.head = renderPercentileChart(containersMap.head, child, 'head', {
        ...options,
        onCrosshairMove: (age) => broadcastCrosshair('head', age)
      });
    }

    const fourthContainer = containersMap.bmiOrWfl || containersMap.bmi || containersMap.wfl;
    if (fourthContainer) {
      if (useWfl) {
        controllers.bmiOrWfl = renderWeightForLengthChart(fourthContainer, child, options);
      } else {
        controllers.bmiOrWfl = renderPercentileChart(fourthContainer, child, 'bmi', {
          ...options,
          onCrosshairMove: (age) => broadcastCrosshair('bmiOrWfl', age)
        });
      }
    }

    return {
      destroy: () => {
        Object.keys(controllers).forEach(k => {
          if (controllers[k] && typeof controllers[k].destroy === 'function') {
            controllers[k].destroy();
          }
        });
      },
      redraw: () => {
        Object.keys(controllers).forEach(k => {
          if (controllers[k] && typeof controllers[k].redraw === 'function') {
            controllers[k].redraw();
          }
        });
      }
    };
  }

  // --- Expose GrowthCharts on window & module ---
  const GrowthCharts = {
    renderPercentileChart,
    renderComparisonChart,
    renderVelocityChart,
    renderSingleVelocityChart,
    renderHeightWall,
    renderWeightForLengthChart,
    renderQuadOverviewGrid,
    getMeasurementValue,
    normalizeSex,
    normalizeCurves,
    calcStats,
    isDarkTheme,
    getChartThemePalette,
    resolveThemeChildColor,
    activeChartControllers,
    palette: PALETTE,
    fonts: FONTS
  };

  if (typeof window !== 'undefined') {
    window.GrowthCharts = GrowthCharts;
    try {
      window.dispatchEvent(new CustomEvent('growthcharts:ready', { detail: GrowthCharts }));
    } catch (e) {}
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GrowthCharts;
  }

  return GrowthCharts;
})(typeof globalThis !== 'undefined' ? globalThis : this);
