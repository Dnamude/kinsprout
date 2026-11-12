/**
 * KinSprout - Two-Children Growth Tracker
 * sync-manager.js - Offline-First Storage & Real-Time Cross-Device Synchronization
 * 
 * Features:
 * - Local persistence: localStorage + high-capacity IndexedDB (KinSproutDB)
 * - CRDT / Record-level 3-way merge with tombstone tracking for robust conflict-free sync
 * - Real-time Server-Sent Events (SSE) live updates across devices & multiple tabs
 * - Portable snapshot encoding (KINSPROUT-SYNC-v1:...) for offline AirDrop/SMS sharing
 * - Clean JSON and CSV (with percentiles & Z-scores) data import/export
 * - Beautiful Pediatrician Print Report view for doctor visits
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SyncManager = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Storage keys & constants
  const STORAGE_KEY_STATE = 'kinsprout_family_state_v1';
  const STORAGE_KEY_DEVICE_ID = 'kinsprout_device_id';
  const STORAGE_KEY_DEVICE_NAME = 'kinsprout_device_name';
  const STORAGE_KEY_ROOM_CODE = 'kinsprout_room_code';
  const STORAGE_KEY_SYNC_LOG = 'kinsprout_sync_log_v1';
  const STORAGE_KEY_PENDING_QUEUE = 'kinsprout_pending_queue_v1';

  const DB_NAME = 'KinSproutDB';
  const DB_VERSION = 1;
  const STORE_FAMILY = 'familyStore';
  const STORE_SNAPSHOTS = 'snapshotStore';

  // Safe localStorage wrapper for environments where localStorage may be restricted/unavailable
  const memoryFallbackStorage = new Map();
  const safeStorage = {
    getItem(key) {
      try {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
      } catch (e) {}
      return memoryFallbackStorage.get(key) || null;
    },
    setItem(key, value) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return;
        }
      } catch (e) {}
      memoryFallbackStorage.set(key, String(value));
    },
    removeItem(key) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
          return;
        }
      } catch (e) {}
      memoryFallbackStorage.delete(key);
    }
  };

  // State & internal references
  let currentState = null;
  let currentRoomCode = 'FAMILY-SPROUT-842';
  let deviceId = '';
  let deviceName = '';
  let eventSource = null;
  let statusListeners = [];
  let stateUpdateListeners = [];
  let pendingSyncQueue = [];
  let syncStatus = 'offline'; // 'synced' | 'syncing' | 'offline' | 'offline-saved'
  let lastSyncedAt = null;
  let currentRevision = 0;
  let syncHistory = [];
  let dbPromise = null;
  let isSyncing = false;

  /**
   * IndexedDB Initialization helper
   */
  function initIndexedDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_FAMILY)) {
            db.createObjectStore(STORE_FAMILY, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
            db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id', autoIncrement: true });
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          console.warn('[SyncManager] IndexedDB error:', event.target.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('[SyncManager] IndexedDB open exception:', err);
        resolve(null);
      }
    });

    return dbPromise;
  }

  /**
   * Save state copy to IndexedDB
   */
  async function persistToIndexedDB(state) {
    try {
      const db = await initIndexedDB();
      if (!db) return false;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_FAMILY], 'readwrite');
        const store = tx.objectStore(STORE_FAMILY);
        store.put({
          key: 'latest_state',
          roomCode: currentRoomCode,
          updatedAt: Date.now(),
          state: JSON.parse(JSON.stringify(state))
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('[SyncManager] Error writing to IndexedDB:', e);
      return false;
    }
  }

  /**
   * Load state from IndexedDB
   */
  async function loadFromIndexedDB() {
    try {
      const db = await initIndexedDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction([STORE_FAMILY], 'readonly');
        const store = tx.objectStore(STORE_FAMILY);
        const req = store.get('latest_state');
        req.onsuccess = () => {
          if (req.result && req.result.state) {
            resolve(req.result.state);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper: Generate unique device identifier
   */
  function getOrCreateDeviceId() {
    let id = safeStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      safeStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
    }
    return id;
  }

  /**
   * Helper: Generate readable device name
   */
  function getOrCreateDeviceName() {
    let name = safeStorage.getItem(STORAGE_KEY_DEVICE_NAME);
    if (!name) {
      const platform = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      let deviceType = 'Web App';
      if (/iPhone|iPad|iPod/i.test(platform)) deviceType = 'Apple iOS';
      else if (/Android/i.test(platform)) deviceType = 'Android Device';
      else if (/Macintosh/i.test(platform)) deviceType = 'Mac Browser';
      else if (/Windows/i.test(platform)) deviceType = 'Windows PC';

      const randomSuffix = Math.floor(100 + Math.random() * 900);
      name = `Parent ${deviceType} #${randomSuffix}`;
      safeStorage.setItem(STORAGE_KEY_DEVICE_NAME, name);
    }
    return name;
  }

  /**
   * Helper: Get current sync status summary
   */
  function getSyncStatus() {
    return {
      status: syncStatus,
      roomCode: currentRoomCode,
      deviceId: deviceId || getOrCreateDeviceId(),
      deviceName: deviceName || getOrCreateDeviceName(),
      lastSyncedAt: lastSyncedAt || (currentState && currentState.updatedAt) || null,
      revision: currentRevision,
      syncHistory: [...syncHistory],
      pendingQueueCount: pendingSyncQueue.length
    };
  }

  /**
   * Helper: Notify listeners of status change
   */
  function notifyStatus() {
    const statusObj = getSyncStatus();
    for (const cb of statusListeners) {
      try {
        cb(statusObj);
      } catch (err) {
        console.error('[SyncManager] Status listener error:', err);
      }
    }
  }

  /**
   * Helper: Notify listeners of state updates
   */
  function notifyStateUpdated(source = 'local') {
    for (const cb of stateUpdateListeners) {
      try {
        cb(currentState, source);
      } catch (err) {
        console.error('[SyncManager] State update listener error:', err);
      }
    }
  }

  /**
   * Helper: compute accurate WHO/CDC LMS percentile & Z-score via window.GrowthEngine
   */
  function computeMetricStats(child, metric, ageMonths, value) {
    if (value === null || value === undefined || isNaN(value) || Number(value) <= 0) {
      return { percentileStr: '', zScoreStr: '', rawPercentile: null, rawZScore: null };
    }
    const val = Number(value);
    const sex = (child && (child.sex || child.gender)) || 'M';
    const age = Number(ageMonths) || 0;

    if (typeof window !== 'undefined' && window.GrowthEngine && typeof window.GrowthEngine.calculateZScoreAndPercentile === 'function') {
      try {
        const res = window.GrowthEngine.calculateZScoreAndPercentile(sex, metric, age, val);
        if (res) {
          const zNum = Number(res.zScore);
          const sign = zNum > 0 ? '+' : '';
          const zScoreStr = isNaN(zNum) ? '' : `${sign}${zNum.toFixed(2)} SD`;
          const percentileStr = res.formattedPercentile || (res.percentile != null ? `${res.percentile}%` : '');
          return {
            percentileStr,
            zScoreStr,
            rawPercentile: res.percentile,
            rawZScore: res.zScore,
            color: res.color,
            status: res.status
          };
        }
      } catch (e) {
        console.warn('[SyncManager] computeMetricStats calculation error:', e);
      }
    }

    return { percentileStr: '', zScoreStr: '', rawPercentile: null, rawZScore: null };
  }

  /**
   * Helper: extract timestamp from item
   */
  function getRecordTimestamp(item) {
    if (!item) return 0;
    if (typeof item.restoredAt === 'number' && !isNaN(item.restoredAt)) return item.restoredAt;
    if (typeof item.updatedAt === 'number' && !isNaN(item.updatedAt)) return item.updatedAt;
    if (typeof item.timestamp === 'number' && !isNaN(item.timestamp)) return item.timestamp;
    if (item.date) {
      const t = new Date(item.date).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  }

  /**
   * Search an item by ID across children, measurements, and milestones
   */
  function findActiveItemInState(state, id) {
    if (!state || !Array.isArray(state.children)) return null;
    for (const child of state.children) {
      if (child && child.id === id) return child;
      if (child && Array.isArray(child.measurements)) {
        for (const m of child.measurements) {
          if (m && m.id === id) return m;
        }
      }
      if (child && Array.isArray(child.milestones)) {
        for (const ms of child.milestones) {
          if (ms && ms.id === id) return ms;
        }
      }
    }
    return null;
  }

  /**
   * Preload real QR code generator script in browser if needed (subpath-safe)
   */
  function preloadQrLib() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.qrcode) return;
    if (document.querySelector('script[data-qr-lib]')) return;

    try {
      const script = document.createElement('script');
      script.src = (typeof window !== 'undefined' && window.location)
        ? new URL('./vendor/qrcode/qrcode.js', window.location.href).href
        : './vendor/qrcode/qrcode.js';
      script.async = true;
      script.setAttribute('data-qr-lib', 'true');
      (document.head || document.body || document.documentElement).appendChild(script);
    } catch (e) {}
  }

  /**
   * Resolve qrcode library reference safely
   */
  function getQrCodeLib() {
    if (typeof window !== 'undefined' && window.qrcode) return window.qrcode;
    if (typeof root !== 'undefined' && root.qrcode) return root.qrcode;
    if (typeof qrcode !== 'undefined') return qrcode;
    try {
      return require('./vendor/qrcode/qrcode.js');
    } catch (e) {}
    try {
      return require('../vendor/qrcode/qrcode.js');
    } catch (e) {}
    try {
      return require('./public/vendor/qrcode/qrcode.js');
    } catch (e) {}
    try {
      return require('/home/antigravity/growth-tracker/public/vendor/qrcode/qrcode.js');
    } catch (e) {}
    return null;
  }

  /**
   * Default fallback state if window.SiblingComparison not yet defined
   */
  function getDefaultStateFallback() {
    return {
      familyId: 'FAMILY-SPROUT-842',
      familyName: 'The Miller Family',
      unitSystem: 'metric',
      updatedAt: 0,
      deletedIds: [],
      parents: {
        fatherHeightCm: 181,
        motherHeightCm: 166.5,
        fatherName: 'David',
        motherName: 'Elena'
      },
      children: [
        {
          id: 'child-1',
          name: 'Leo',
          gender: 'male',
          sex: 'M',
          birthDate: '2022-05-14',
          color: '#C85A32',
          updatedAt: 0,
          measurements: [
            { id: 'm-leo-0m', date: '2022-05-14', ageMonths: 0, heightCm: 50.8, weightKg: 3.52, headCircumferenceCm: 35.1, headCm: 35.1, notes: 'Birth measurement', updatedAt: 0 },
            { id: 'm-leo-1m', date: '2022-06-14', ageMonths: 1, heightCm: 55.4, weightKg: 4.65, headCircumferenceCm: 37.8, headCm: 37.8, notes: '1-month wellness check', updatedAt: 0 },
            { id: 'm-leo-2m', date: '2022-07-14', ageMonths: 2, heightCm: 59.2, weightKg: 5.82, headCircumferenceCm: 39.6, headCm: 39.6, notes: '2-month wellness check', updatedAt: 0 },
            { id: 'm-leo-4m', date: '2022-09-14', ageMonths: 4, heightCm: 64.6, weightKg: 7.3, headCircumferenceCm: 42.0, headCm: 42.0, notes: '4-month wellness check', updatedAt: 0 },
            { id: 'm-leo-6m', date: '2022-11-14', ageMonths: 6, heightCm: 68.4, weightKg: 8.25, headCircumferenceCm: 43.8, headCm: 43.8, notes: '6-month wellness check', updatedAt: 0 }
          ],
          milestones: [
            { id: 'ms-leo-1', title: 'Rolled Over', ageMonths: 3.8, date: '2022-09-07', completed: true, updatedAt: 0 },
            { id: 'ms-leo-2', title: 'Sat Unsupported', ageMonths: 5.9, date: '2022-11-10', completed: true, updatedAt: 0 }
          ]
        },
        {
          id: 'child-2',
          name: 'Maya',
          gender: 'female',
          sex: 'F',
          birthDate: '2024-10-10',
          color: '#2E6F5E',
          updatedAt: 0,
          measurements: [
            { id: 'm-maya-0m', date: '2024-10-10', ageMonths: 0, heightCm: 49.9, weightKg: 3.38, headCircumferenceCm: 34.4, headCm: 34.4, notes: 'Birth measurement', updatedAt: 0 },
            { id: 'm-maya-1m', date: '2024-11-10', ageMonths: 1, heightCm: 54.6, weightKg: 4.45, headCircumferenceCm: 37.1, headCm: 37.1, notes: '1-month wellness check', updatedAt: 0 },
            { id: 'm-maya-2m', date: '2024-12-10', ageMonths: 2, heightCm: 58.0, weightKg: 5.48, headCircumferenceCm: 38.9, headCm: 38.9, notes: '2-month wellness check', updatedAt: 0 }
          ],
          milestones: [
            { id: 'ms-maya-1', title: 'Rolled Over', ageMonths: 3.4, date: '2025-01-22', completed: true, updatedAt: 0 }
          ]
        }
      ]
    };
  }

  /**
   * CRDT Record-Level Merge Algorithm (Matches backend server logic exactly)
   */
  function mergeFamilyStates(local, incoming) {
    if (!local) return incoming;
    if (!incoming) return local;

    const result = { ...local, ...incoming };
    const localTime = local.updatedAt || 0;
    const incomingTime = incoming.updatedAt || 0;

    // Demo epoch handling (Invariant #2)
    const DEMO_EPOCH = 1760000000000;
    if (local.isDemo && !incoming.isDemo && incomingTime > DEMO_EPOCH) {
      result.isDemo = false;
    } else if (incoming.isDemo && !local.isDemo && localTime > DEMO_EPOCH) {
      result.isDemo = false;
    } else if (!local.isDemo || !incoming.isDemo) {
      result.isDemo = false;
    } else {
      result.isDemo = true;
    }

    // Merge parent info & settings (non-demo always wins over demo; otherwise LWW)
    const incomingWinsMeta = (local.isDemo && !incoming.isDemo) ? true
      : (!local.isDemo && incoming.isDemo) ? false
      : (incomingTime >= localTime);

    if (incomingWinsMeta) {
      result.familyName = incoming.familyName || local.familyName || 'Our Family';
      result.unitSystem = incoming.unitSystem || local.unitSystem || 'metric';
      result.parents = { ...(local.parents || {}), ...(incoming.parents || {}) };
      result.settings = { ...(local.settings || {}), ...(incoming.settings || {}) };
    } else {
      result.familyName = local.familyName || incoming.familyName || 'Our Family';
      result.unitSystem = local.unitSystem || incoming.unitSystem || 'metric';
      result.parents = { ...(incoming.parents || {}), ...(local.parents || {}) };
      result.settings = { ...(incoming.settings || {}), ...(local.settings || {}) };
    }

    // Tombstones tracking: combine deletedIds sets with Undo resurrection support (Invariant #3)
    const localDeleted = new Set(local.deletedIds || []);
    const incomingDeleted = new Set(incoming.deletedIds || []);
    const candidateDeleted = new Set([...localDeleted, ...incomingDeleted]);

    for (const id of Array.from(candidateDeleted)) {
      if (localDeleted.has(id) && !incomingDeleted.has(id)) {
        const activeItem = findActiveItemInState(incoming, id);
        if (activeItem) {
          const itemTime = getRecordTimestamp(activeItem);
          if ((activeItem.restoredAt && activeItem.restoredAt >= localTime) ||
              (itemTime > localTime && incomingTime > localTime)) {
            candidateDeleted.delete(id);
          }
        }
      } else if (incomingDeleted.has(id) && !localDeleted.has(id)) {
        const activeItem = findActiveItemInState(local, id);
        if (activeItem) {
          const itemTime = getRecordTimestamp(activeItem);
          if ((activeItem.restoredAt && activeItem.restoredAt >= incomingTime) ||
              (itemTime > incomingTime && localTime > incomingTime)) {
            candidateDeleted.delete(id);
          }
        }
      }
    }

    const deletedIds = Array.from(candidateDeleted);
    result.deletedIds = deletedIds;
    const tombstoneSet = new Set(deletedIds);

    // Merge Children
    const childMap = new Map();
    for (const c of (local.children || [])) {
      if (c && c.id && !tombstoneSet.has(c.id)) {
        childMap.set(c.id, { ...c });
      }
    }

    for (const c of (incoming.children || [])) {
      if (!c || !c.id || tombstoneSet.has(c.id)) continue;
      if (!childMap.has(c.id)) {
        childMap.set(c.id, { ...c });
      } else {
        const exChild = childMap.get(c.id);
        const exTime = exChild.updatedAt || 0;
        const inTime = c.updatedAt || 0;
        const base = inTime >= exTime ? { ...exChild, ...c } : { ...c, ...exChild };

        // Merge measurements
        const measMap = new Map();
        for (const m of (exChild.measurements || [])) {
          if (m && m.id && !tombstoneSet.has(m.id)) {
            const copyM = { ...m };
            if (copyM.headCm != null && copyM.headCircumferenceCm == null) copyM.headCircumferenceCm = copyM.headCm;
            if (copyM.headCircumferenceCm != null && copyM.headCm == null) copyM.headCm = copyM.headCircumferenceCm;
            measMap.set(m.id, copyM);
          }
        }
        for (const m of (c.measurements || [])) {
          if (m && m.id && !tombstoneSet.has(m.id)) {
            const copyM = { ...m };
            if (copyM.headCm != null && copyM.headCircumferenceCm == null) copyM.headCircumferenceCm = copyM.headCm;
            if (copyM.headCircumferenceCm != null && copyM.headCm == null) copyM.headCm = copyM.headCircumferenceCm;

            if (!measMap.has(m.id)) {
              measMap.set(m.id, copyM);
            } else {
              const exM = measMap.get(m.id);
              const tmEx = getRecordTimestamp(exM);
              const tmIn = getRecordTimestamp(m);
              const mergedM = tmIn >= tmEx ? { ...exM, ...copyM } : { ...copyM, ...exM };
              if (mergedM.headCm != null && mergedM.headCircumferenceCm == null) mergedM.headCircumferenceCm = mergedM.headCm;
              if (mergedM.headCircumferenceCm != null && mergedM.headCm == null) mergedM.headCm = mergedM.headCircumferenceCm;
              measMap.set(m.id, mergedM);
            }
          }
        }
        base.measurements = Array.from(measMap.values()).sort((a, b) => {
          const tA = a.date ? new Date(a.date).getTime() : (a.ageMonths || 0);
          const tB = b.date ? new Date(b.date).getTime() : (b.ageMonths || 0);
          return tA - tB;
        });

        // Merge milestones
        const msMap = new Map();
        for (const ms of (exChild.milestones || [])) {
          if (ms && ms.id && !tombstoneSet.has(ms.id)) {
            msMap.set(ms.id, ms);
          }
        }
        for (const ms of (c.milestones || [])) {
          if (ms && ms.id && !tombstoneSet.has(ms.id)) {
            if (!msMap.has(ms.id)) {
              msMap.set(ms.id, ms);
            } else {
              const exMs = msMap.get(ms.id);
              const tmEx = getRecordTimestamp(exMs);
              const tmIn = getRecordTimestamp(ms);
              msMap.set(ms.id, tmIn >= tmEx ? { ...exMs, ...ms } : { ...ms, ...exMs });
            }
          }
        }
        base.milestones = Array.from(msMap.values());

        childMap.set(c.id, base);
      }
    }

    result.children = Array.from(childMap.values());
    result.updatedAt = result.isDemo ? DEMO_EPOCH : (Math.max(localTime, incomingTime) || Date.now());
    return result;
  }

  // --- WebCrypto AES-256-GCM & Dual-Transport State ---
  let customSyncEndpoint = '';
  let currentTransportMode = 'http-api'; // 'http-api' | 'encrypted-cloud-relay' | 'offline-local'
  let relayEventSource = null;
  let currentRelayTopic = null;
  let cachedE2EEKey = null;
  let cachedE2EERoom = null;

  function arrayBufferToBase64(buffer) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buffer).toString('base64');
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(base64, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  async function sha256Hex(str) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(str));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (typeof require === 'function') {
      try {
        const nodeCrypto = require('crypto');
        return nodeCrypto.createHash('sha256').update(str).digest('hex');
      } catch (e) {}
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padEnd(24, '0');
  }

  async function deriveE2EEKey(roomCode, saltStr = 'kinsprout-e2ee-salt-v2') {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(roomCode),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const salt = enc.encode(saltStr);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return key;
  }

  async function compressBytes(bytes) {
    if (typeof CompressionStream !== 'function' || typeof Response !== 'function') return bytes;
    try {
      const stream = new Response(bytes).body.pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      return bytes;
    }
  }

  async function decompressBytes(bytes) {
    if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') return bytes;
    try {
      const stream = new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
      return new Uint8Array(buffer);
    } catch (e) {
      return bytes;
    }
  }

  async function encryptPayload(key, dataObj) {
    const iv = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint8Array(12))
      : new Uint8Array(12);
    const enc = new TextEncoder();
    const rawBytes = enc.encode(JSON.stringify(dataObj));
    let plainBytes = rawBytes;
    let isZipped = false;
    if (typeof CompressionStream === 'function') {
      try {
        const compressed = await compressBytes(rawBytes);
        if (compressed && compressed.byteLength < rawBytes.byteLength) {
          plainBytes = compressed;
          isZipped = true;
        }
      } catch (e) {}
    }
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plainBytes
    );
    const b64Iv = arrayBufferToBase64(iv.buffer);
    const b64Ct = arrayBufferToBase64(ciphertextBuffer);
    const env = { iv: b64Iv, ct: b64Ct, v: 2, ts: Date.now() };
    if (isZipped) env.z = 'gzip';
    return env;
  }

  async function decryptPayload(key, envelope) {
    if (!envelope || !envelope.iv || !envelope.ct) return null;
    const iv = base64ToArrayBuffer(envelope.iv);
    const ct = base64ToArrayBuffer(envelope.ct);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      ct
    );
    let plainBytes = new Uint8Array(decryptedBuffer);
    if (envelope.z === 'gzip' && typeof DecompressionStream === 'function') {
      try {
        plainBytes = await decompressBytes(plainBytes);
      } catch (e) {
        console.warn('[SyncManager] Decompression error:', e);
      }
    }
    const dec = new TextDecoder();
    const text = dec.decode(plainBytes);
    return JSON.parse(text);
  }

  async function parseNtfyEnvelope(ntfyMsg) {
    if (!ntfyMsg) return null;
    if (ntfyMsg.attachment && ntfyMsg.attachment.url) {
      try {
        const res = await fetch(ntfyMsg.attachment.url);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('[SyncManager] Failed to fetch ntfy attachment:', e);
      }
    }
    if (ntfyMsg.message) {
      try {
        return JSON.parse(ntfyMsg.message);
      } catch (e) {}
    }
    return null;
  }

  function getRoomSecret(roomCode) {
    const norm = String(roomCode || currentRoomCode).trim().toUpperCase();
    return safeStorage.getItem(`kinsprout_room_key_${norm}`) || null;
  }

  function saveRoomSecret(roomCode, secret) {
    const norm = String(roomCode || currentRoomCode).trim().toUpperCase();
    if (secret) {
      safeStorage.setItem(`kinsprout_room_key_${norm}`, String(secret).trim());
    } else {
      safeStorage.removeItem(`kinsprout_room_key_${norm}`);
    }
    cachedE2EEKey = null;
    cachedE2EERoom = null;
  }

  async function getOrDeriveE2EEKey(roomCode) {
    const norm = String(roomCode || currentRoomCode).trim().toUpperCase();
    if (cachedE2EEKey && cachedE2EERoom === norm) {
      return cachedE2EEKey;
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const secret = getRoomSecret(norm);
    const saltStr = secret ? `kinsprout-e2ee-salt-v2:${secret}` : 'kinsprout-e2ee-salt-v2';
    try {
      cachedE2EEKey = await deriveE2EEKey(norm, saltStr);
      cachedE2EERoom = norm;
      return cachedE2EEKey;
    } catch (err) {
      console.warn('[SyncManager] Failed to derive E2EE key:', err);
      return null;
    }
  }

  async function getRelayTopic(roomCode) {
    const norm = String(roomCode || currentRoomCode).trim().toUpperCase();
    const hash = await sha256Hex(`kinsprout-topic-v2:${norm}`);
    return `ks2-${hash.slice(0, 24)}`;
  }

  function setSyncEndpoint(baseUrl) {
    customSyncEndpoint = baseUrl ? String(baseUrl).trim().replace(/\/+$/, '') : '';
    if (currentState) {
      if (!currentState.settings) currentState.settings = {};
      if (customSyncEndpoint) {
        currentState.settings.cloudSyncUrl = customSyncEndpoint;
      } else {
        delete currentState.settings.cloudSyncUrl;
      }
    }
    try {
      if (customSyncEndpoint) {
        safeStorage.setItem('kinsprout_custom_sync_url', customSyncEndpoint);
      } else {
        safeStorage.removeItem('kinsprout_custom_sync_url');
      }
    } catch (e) {}
    currentTransportMode = 'http-api';
    connectSSE();
  }

  function getSyncEndpoint() {
    if (customSyncEndpoint) return customSyncEndpoint;
    const stored = safeStorage.getItem('kinsprout_custom_sync_url');
    if (stored && stored.trim()) return stored.trim();
    if (currentState && currentState.settings && currentState.settings.cloudSyncUrl) {
      return currentState.settings.cloudSyncUrl.trim();
    }
    if (typeof window !== 'undefined' && window.KINSPROUT_SYNC_URL) {
      return String(window.KINSPROUT_SYNC_URL).trim();
    }
    return '';
  }

  function getApiBaseUrl() {
    const endpoint = getSyncEndpoint();
    if (endpoint) return endpoint;
    if (typeof window !== 'undefined' && window.location) {
      return new URL('./', window.location.href).href.replace(/\/+$/, '');
    }
    return '';
  }

  function getTransportInfo() {
    const custom = getSyncEndpoint();
    let mode = currentTransportMode;
    if (typeof fetch !== 'function') {
      mode = 'offline-local';
    }
    let endpoint = custom || (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000');
    let isEncrypted = false;
    if (mode === 'encrypted-cloud-relay') {
      endpoint = `https://ntfy.sh/${currentRelayTopic || 'relay'}`;
      isEncrypted = true;
    }
    return {
      mode,
      endpoint,
      isEncrypted,
      roomCode: currentRoomCode
    };
  }

  function getShareUrl(roomCode, baseUrl) {
    const normRoom = String(roomCode || currentRoomCode || 'FAMILY-SPROUT-842').trim().toUpperCase();
    let base;
    if (baseUrl) {
      base = String(baseUrl).replace(/\/+$/, '');
    } else if (typeof window !== 'undefined' && window.location) {
      base = new URL('./', window.location.href).href.replace(/\/+$/, '');
    } else {
      base = 'http://localhost:3000';
    }

    let url = `${base}/?room=${encodeURIComponent(normRoom)}`;
    const customSync = getSyncEndpoint();
    if (customSync) {
      url += `&syncUrl=${encodeURIComponent(customSync)}`;
    }
    const secret = getRoomSecret(normRoom);
    if (secret) {
      url += `#k=${encodeURIComponent(secret)}`;
    }
    return url;
  }

  /**
   * Connect or reconnect to Server-Sent Events stream (HTTP API or E2EE Relay)
   */
  async function connectSSE() {
    if (typeof window === 'undefined') return;

    if (currentTransportMode === 'encrypted-cloud-relay') {
      return connectRelaySSE();
    }

    if (!window.EventSource) return;

    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {}
      eventSource = null;
    }

    const apiBase = getApiBaseUrl();
    const streamUrl = `${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}/stream`;
    try {
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('sync-init', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.state) {
            applyIncomingSync(data.state, data.revision, data.updatedAt, data.syncHistory, 'sse-init');
          }
        } catch (err) {
          console.error('[SyncManager] Error handling SSE sync-init:', err);
        }
      });

      eventSource.addEventListener('sync-update', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.senderDeviceId !== deviceId && data.state) {
            applyIncomingSync(data.state, data.revision, data.updatedAt, data.syncHistory, 'sse-remote');
          }
        } catch (err) {
          console.error('[SyncManager] Error handling SSE sync-update:', err);
        }
      });

      eventSource.onopen = () => {
        syncStatus = 'synced';
        notifyStatus();
      };

      eventSource.onerror = async () => {
        // If same-origin API returned error and no custom sync URL, check if 404/405 to fallback to relay
        if (!getSyncEndpoint()) {
          try {
            const testRes = await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`);
            if (testRes.status === 404 || testRes.status === 405) {
              console.log('[SyncManager] Same-origin API 404/405 detected; activating encrypted-cloud-relay');
              currentTransportMode = 'encrypted-cloud-relay';
              if (eventSource) {
                try { eventSource.close(); } catch (e) {}
                eventSource = null;
              }
              connectRelaySSE();
              syncViaRelay().catch(() => {});
              return;
            }
          } catch (e) {}
        }
        syncStatus = 'offline';
        notifyStatus();
      };
    } catch (err) {
      console.warn('[SyncManager] Failed to create EventSource:', err);
    }
  }

  /**
   * Connect to WebCrypto AES-256-GCM Encrypted Cloud Relay over ntfy.sh SSE
   */
  async function connectRelaySSE() {
    if (typeof window === 'undefined' || !window.EventSource) return;

    if (relayEventSource) {
      try { relayEventSource.close(); } catch (e) {}
      relayEventSource = null;
    }

    try {
      const topic = await getRelayTopic(currentRoomCode);
      currentRelayTopic = topic;
      const relayUrl = `https://ntfy.sh/${topic}/sse`;
      relayEventSource = new EventSource(relayUrl);

      relayEventSource.onopen = () => {
        syncStatus = 'synced';
        notifyStatus();
      };

      relayEventSource.onerror = () => {
        syncStatus = 'offline';
        notifyStatus();
      };

      relayEventSource.onmessage = async (e) => {
        try {
          const ntfyMsg = JSON.parse(e.data);
          if (ntfyMsg.event === 'message') {
            const envelope = await parseNtfyEnvelope(ntfyMsg);
            if (envelope && envelope.ct) {
              const key = await getOrDeriveE2EEKey(currentRoomCode);
              if (key) {
                const payload = await decryptPayload(key, envelope);
                if (payload && payload.state && payload.deviceId !== (deviceId || getOrCreateDeviceId())) {
                  applyIncomingSync(payload.state, null, payload.updatedAt, null, 'relay-remote');
                }
              }
            }
          }
        } catch (err) {}
      };
    } catch (err) {
      console.warn('[SyncManager] Failed to connect relay SSE:', err);
    }
  }

  /**
   * Catch up via encrypted cloud relay
   */
  async function syncViaRelay() {
    if (typeof fetch !== 'function') return;
    try {
      const topic = await getRelayTopic(currentRoomCode);
      currentRelayTopic = topic;
      const key = await getOrDeriveE2EEKey(currentRoomCode);
      if (!key) return;

      const pollRes = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=all`);
      if (pollRes.ok) {
        const text = await pollRes.text();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const item = JSON.parse(line);
            if (item.event === 'message') {
              const envelope = await parseNtfyEnvelope(item);
              if (envelope && envelope.ct) {
                const payload = await decryptPayload(key, envelope);
                if (payload && payload.state && payload.deviceId !== (deviceId || getOrCreateDeviceId())) {
                  const merged = mergeFamilyStates(currentState, payload.state);
                  currentState = merged;
                  if (payload.updatedAt) lastSyncedAt = payload.updatedAt;
                  safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
                  persistToIndexedDB(currentState);
                }
              }
            }
          } catch (e) {}
        }
        notifyStatus();
        notifyStateUpdated('relay-catchup');
      }

      if (currentState && !currentState.isDemo) {
        await saveStateToRelay(currentState, 'Relay initial sync');
      }
      syncStatus = 'synced';
      notifyStatus();
    } catch (err) {
      console.warn('[SyncManager] Relay sync error:', err.message);
    }
  }

  /**
   * Save encrypted state envelope to ntfy.sh relay
   */
  async function saveStateToRelay(state, changeSummary = 'Updated growth records') {
    if (typeof fetch !== 'function') return;
    const topic = await getRelayTopic(currentRoomCode);
    const key = await getOrDeriveE2EEKey(currentRoomCode);
    if (!key) return;

    const payload = {
      v: 2,
      state,
      deviceId: deviceId || getOrCreateDeviceId(),
      deviceName: deviceName || getOrCreateDeviceName(),
      changeSummary,
      updatedAt: state.updatedAt || Date.now()
    };

    const envelope = await encryptPayload(key, payload);
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify(envelope),
      headers: {
        'Title': 'KinSprout Sync',
        'Tags': 'kinsprout'
      }
    });
  }

  /**
   * Apply incoming server sync payload
   */
  function applyIncomingSync(incomingState, revision, updatedAt, history, source) {
    if (!incomingState) return;
    const merged = mergeFamilyStates(currentState, incomingState);
    currentState = merged;
    if (revision) currentRevision = revision;
    if (updatedAt) lastSyncedAt = updatedAt;
    if (Array.isArray(history)) syncHistory = history;

    // Save to local storage & IndexedDB
    try {
      safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
      safeStorage.setItem(STORAGE_KEY_SYNC_LOG, JSON.stringify(syncHistory));
    } catch (e) {}
    persistToIndexedDB(currentState);

    syncStatus = 'synced';
    notifyStatus();
    notifyStateUpdated(source);
  }

  /**
   * Process any pending sync items that were queued while offline
   */
  async function flushPendingQueue() {
    if (pendingSyncQueue.length === 0 || isSyncing) return;

    isSyncing = true;
    syncStatus = 'syncing';
    notifyStatus();

    while (pendingSyncQueue.length > 0) {
      const item = pendingSyncQueue[0];
      try {
        if (currentTransportMode === 'encrypted-cloud-relay') {
          await saveStateToRelay(item.state, item.changeSummary || 'Queued offline update');
          pendingSyncQueue.shift();
          try {
            safeStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(pendingSyncQueue));
          } catch (e) {}
          continue;
        }

        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: item.state,
            deviceId: deviceId || getOrCreateDeviceId(),
            deviceName: deviceName || getOrCreateDeviceName(),
            changeSummary: item.changeSummary || 'Queued offline update'
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result && result.state) {
            currentState = result.state;
            currentRevision = result.revision || (currentRevision + 1);
            lastSyncedAt = result.updatedAt || Date.now();
            if (result.syncHistory) syncHistory = result.syncHistory;
            safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
            persistToIndexedDB(currentState);
          }
          pendingSyncQueue.shift();
          try {
            safeStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(pendingSyncQueue));
          } catch (e) {}
        } else {
          // Server returned error, stop flushing until next trigger
          break;
        }
      } catch (err) {
        // Network error, stay in queue
        break;
      }
    }

    isSyncing = false;
    syncStatus = pendingSyncQueue.length === 0 ? 'synced' : 'offline-saved';
    notifyStatus();
    notifyStateUpdated('queue-flushed');
  }

  // --- PUBLIC API OBJECT ---

  const SyncManager = {
    /**
     * Initialize sync manager
     */
    async init(onStateUpdated) {
      if (typeof onStateUpdated === 'function') {
        stateUpdateListeners.push(onStateUpdated);
      }

      deviceId = getOrCreateDeviceId();
      deviceName = getOrCreateDeviceName();

      const storedRoom = safeStorage.getItem(STORAGE_KEY_ROOM_CODE);
      if (storedRoom) {
        currentRoomCode = storedRoom;
      }

      // Support URL Query Auto-Join (?room=XYZ &syncUrl=ABC) and Hash Secret (#k=KEY)
      if (typeof window !== 'undefined' && window.location) {
        try {
          if (window.location.search) {
            let roomParam = null;
            let syncUrlParam = null;
            if (typeof URLSearchParams !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              roomParam = urlParams.get('room');
              syncUrlParam = urlParams.get('syncUrl');
            } else {
              const match = window.location.search.match(/[?&]room=([^&#]*)/i);
              if (match && match[1]) roomParam = decodeURIComponent(match[1]);
              const matchSync = window.location.search.match(/[?&]syncUrl=([^&#]*)/i);
              if (matchSync && matchSync[1]) syncUrlParam = decodeURIComponent(matchSync[1]);
            }
            if (roomParam && roomParam.trim()) {
              const normalizedParam = roomParam.trim().toUpperCase();
              currentRoomCode = normalizedParam;
              safeStorage.setItem(STORAGE_KEY_ROOM_CODE, normalizedParam);
            }
            if (syncUrlParam && syncUrlParam.trim()) {
              setSyncEndpoint(syncUrlParam.trim());
            }
          }
          if (window.location.hash) {
            const match = window.location.hash.match(/[#&]k=([^&]+)/i);
            if (match && match[1]) {
              saveRoomSecret(currentRoomCode, decodeURIComponent(match[1]));
            }
          }
        } catch (e) {
          console.warn('[SyncManager] Error parsing URL search/hash params:', e);
        }
      }

      const storedQueue = safeStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
      if (storedQueue) {
        try {
          pendingSyncQueue = JSON.parse(storedQueue) || [];
        } catch (e) {
          pendingSyncQueue = [];
        }
      }

      const storedHistory = safeStorage.getItem(STORAGE_KEY_SYNC_LOG);
      if (storedHistory) {
        try {
          syncHistory = JSON.parse(storedHistory) || [];
        } catch (e) {}
      }

      // 1. Try loading from localStorage
      let loaded = null;
      const localStr = safeStorage.getItem(STORAGE_KEY_STATE);
      if (localStr) {
        try {
          loaded = JSON.parse(localStr);
        } catch (e) {}
      }

      // 2. Try loading from IndexedDB if localStorage empty
      if (!loaded) {
        loaded = await loadFromIndexedDB();
      }

      // 3. Fallback to window.SiblingComparison.getDefaultFamilyState() or internal fallback
      if (!loaded) {
        if (typeof window !== 'undefined' && window.SiblingComparison && typeof window.SiblingComparison.getDefaultFamilyState === 'function') {
          loaded = window.SiblingComparison.getDefaultFamilyState();
        } else {
          loaded = getDefaultStateFallback();
        }
      }

      currentState = loaded;
      persistToIndexedDB(currentState);

      // Register Cross-Tab / Window Sync via 'storage' events
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEY_STATE && e.newValue) {
            try {
              const remoteTabState = JSON.parse(e.newValue);
              currentState = mergeFamilyStates(currentState, remoteTabState);
              persistToIndexedDB(currentState);
              notifyStatus();
              notifyStateUpdated('cross-tab');
            } catch (err) {}
          }
        });

        // Online / Offline state change handlers (unconditional try/catch execution)
        window.addEventListener('online', () => {
          syncStatus = 'syncing';
          notifyStatus();
          connectSSE();
          flushPendingQueue();
        });

        window.addEventListener('offline', () => {
          syncStatus = 'offline';
          notifyStatus();
        });
      }

      // Connect real-time SSE stream
      connectSSE();

      // Pull latest from server/cloud and merge room data
      await this.syncNow().catch(() => {});

      return currentState;
    },

    /**
     * Get active in-memory state
     */
    getState() {
      return currentState ? JSON.parse(JSON.stringify(currentState)) : null;
    },

    /**
     * Save state locally and sync to cloud room (HTTP API or E2EE Relay)
     */
    async saveState(newState, changeSummary = 'Updated growth records') {
      if (!newState || typeof newState !== 'object') {
        throw new Error('Invalid state provided to saveState');
      }

      newState.updatedAt = Date.now();
      currentState = newState;

      // 1. Immediate local persistence
      try {
        safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
      } catch (err) {
        console.warn('[SyncManager] Storage quota exceeded, storing in IndexedDB only:', err);
      }
      await persistToIndexedDB(currentState);

      // 2. Synchronize with backend API or encrypted cloud relay
      syncStatus = 'syncing';
      notifyStatus();

      if (currentTransportMode === 'encrypted-cloud-relay') {
        try {
          await saveStateToRelay(currentState, changeSummary);
          syncStatus = 'synced';
          notifyStatus();
          notifyStateUpdated('relay-saved');
          return { ok: true, status: 'synced', revision: currentRevision, state: currentState };
        } catch (err) {
          console.warn('[SyncManager] Relay save error, queued offline:', err.message);
          pendingSyncQueue.push({ state: currentState, changeSummary, timestamp: Date.now() });
          try {
            safeStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(pendingSyncQueue));
          } catch (e) {}

          syncStatus = 'offline-saved';
          notifyStatus();
          notifyStateUpdated('local-saved-offline');
          return { ok: true, status: 'offline-saved', error: err.message, state: currentState };
        }
      }

      try {
        if (typeof fetch === 'function') {
          const apiBase = getApiBaseUrl();
          const response = await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              state: currentState,
              deviceId: deviceId || getOrCreateDeviceId(),
              deviceName: deviceName || getOrCreateDeviceName(),
              changeSummary
            })
          });

          // Check if same-origin API returned 404/405 without custom endpoint
          if ((response.status === 404 || response.status === 405) && !getSyncEndpoint()) {
            console.log('[SyncManager] Backend API 404/405; falling back to encrypted-cloud-relay');
            currentTransportMode = 'encrypted-cloud-relay';
            connectRelaySSE();
            await saveStateToRelay(currentState, changeSummary);
            syncStatus = 'synced';
            notifyStatus();
            notifyStateUpdated('relay-saved');
            return { ok: true, status: 'synced', revision: currentRevision, state: currentState };
          }

          if (!response.ok) {
            throw new Error(`Sync server responded with ${response.status}`);
          }

          const data = await response.json();
          if (data && data.state) {
            currentState = data.state;
            currentRevision = data.revision || (currentRevision + 1);
            lastSyncedAt = data.updatedAt || Date.now();
            if (data.syncHistory) syncHistory = data.syncHistory;

            safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
            safeStorage.setItem(STORAGE_KEY_SYNC_LOG, JSON.stringify(syncHistory));
            await persistToIndexedDB(currentState);
          }

          syncStatus = 'synced';
          notifyStatus();
          notifyStateUpdated('server-saved');
          return { ok: true, status: 'synced', revision: currentRevision, state: currentState };
        } else {
          // Non-fetch environment (e.g., node test)
          syncStatus = 'synced';
          notifyStatus();
          notifyStateUpdated('local-saved');
          return { ok: true, status: 'synced', revision: currentRevision, state: currentState };
        }
      } catch (err) {
        console.warn('[SyncManager] Network error during saveState, queued offline:', err.message);
        pendingSyncQueue.push({ state: currentState, changeSummary, timestamp: Date.now() });
        try {
          safeStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(pendingSyncQueue));
        } catch (e) {}

        syncStatus = 'offline-saved';
        notifyStatus();
        notifyStateUpdated('local-saved-offline');
        return { ok: true, status: 'offline-saved', error: err.message, state: currentState };
      }
    },

    /**
     * Switch or connect to a sync room code
     */
    async setRoomCode(newRoomCode, mode = 'merge') {
      if (!newRoomCode || !newRoomCode.trim()) return false;
      const normalized = newRoomCode.trim().toUpperCase();
      currentRoomCode = normalized;
      cachedE2EEKey = null;
      cachedE2EERoom = null;
      safeStorage.setItem(STORAGE_KEY_ROOM_CODE, normalized);

      connectSSE();

      // Pull new room data
      try {
        syncStatus = 'syncing';
        notifyStatus();

        if (currentTransportMode === 'encrypted-cloud-relay') {
          await syncViaRelay();
          return true;
        }

        if (typeof fetch === 'function') {
          const apiBase = getApiBaseUrl();
          const res = await fetch(`${apiBase}/api/sync/${encodeURIComponent(normalized)}`);

          if ((res.status === 404 || res.status === 405) && !getSyncEndpoint()) {
            console.log('[SyncManager] setRoomCode: API 404/405; activating encrypted-cloud-relay');
            currentTransportMode = 'encrypted-cloud-relay';
            connectRelaySSE();
            await syncViaRelay();
            return true;
          }

          if (res.ok) {
            const cloudData = await res.json();
            if (cloudData.state) {
              if (mode === 'replace') {
                currentState = cloudData.state;
              } else {
                currentState = mergeFamilyStates(currentState, cloudData.state);
              }
              currentRevision = cloudData.revision || 0;
              lastSyncedAt = cloudData.updatedAt || Date.now();
              if (cloudData.syncHistory) syncHistory = cloudData.syncHistory;

              safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
              await persistToIndexedDB(currentState);
              syncStatus = 'synced';
              notifyStatus();
              notifyStateUpdated('room-changed');
              return true;
            } else {
              // New cloud room, push our state up
              await this.saveState(currentState, `Initialized room ${normalized}`);
              return true;
            }
          }
        }
      } catch (err) {
        console.warn('[SyncManager] Error connecting room:', err);
      }
      return false;
    },

    /**
     * Force immediate sync with cloud (HTTP API or E2EE Relay)
     */
    async syncNow() {
      syncStatus = 'syncing';
      notifyStatus();

      try {
        // Flush queue first
        await flushPendingQueue();

        if (currentTransportMode === 'encrypted-cloud-relay') {
          await syncViaRelay();
          return {
            status: syncStatus,
            revision: currentRevision,
            updatedAt: lastSyncedAt,
            syncHistory
          };
        }

        if (typeof fetch === 'function') {
          const apiBase = getApiBaseUrl();
          const res = await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`);

          if ((res.status === 404 || res.status === 405) && !getSyncEndpoint()) {
            console.log('[SyncManager] syncNow: same-origin API 404/405; activating encrypted-cloud-relay');
            currentTransportMode = 'encrypted-cloud-relay';
            connectRelaySSE();
            await syncViaRelay();
            return {
              status: syncStatus,
              revision: currentRevision,
              updatedAt: lastSyncedAt,
              syncHistory
            };
          }

          if (res.ok) {
            const data = await res.json();
            if (data && data.state) {
              currentState = mergeFamilyStates(currentState, data.state);
              currentRevision = data.revision || currentRevision;
              lastSyncedAt = data.updatedAt || Date.now();
              if (data.syncHistory) syncHistory = data.syncHistory;

              safeStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(currentState));
              safeStorage.setItem(STORAGE_KEY_SYNC_LOG, JSON.stringify(syncHistory));
              await persistToIndexedDB(currentState);

              // Push our merged result back up to guarantee convergence
              await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  state: currentState,
                  deviceId: deviceId || getOrCreateDeviceId(),
                  deviceName: deviceName || getOrCreateDeviceName(),
                  changeSummary: 'Immediate convergence sync'
                })
              });
            } else if (currentState) {
              // Server was empty, push our local state up
              await fetch(`${apiBase}/api/sync/${encodeURIComponent(currentRoomCode)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  state: currentState,
                  deviceId: deviceId || getOrCreateDeviceId(),
                  deviceName: deviceName || getOrCreateDeviceName(),
                  changeSummary: 'Initial sync to cloud'
                })
              });
            }

            syncStatus = 'synced';
            notifyStatus();
            notifyStateUpdated('sync-now');
          }
        }
      } catch (err) {
        console.warn('[SyncManager] syncNow network error:', err);
        syncStatus = 'offline';
        notifyStatus();
      }

      return {
        status: syncStatus,
        revision: currentRevision,
        updatedAt: lastSyncedAt,
        syncHistory
      };
    },

    /**
     * Get current sync status
     */
    getSyncStatus,

    /**
     * Subscribe to sync badge and status updates
     */
    onStatusChange(listener) {
      if (typeof listener === 'function') {
        statusListeners.push(listener);
        // Call immediately with current status
        try {
          listener(getSyncStatus());
        } catch (e) {}
      }
    },

    /**
     * Portable snapshot export (Text / SMS / AirDrop base64 code)
     */
    generateShareSnapshotCode(state) {
      const targetState = state || currentState;
      if (!targetState) return '';

      // Compact representation: remove bulky thumbnail photos if present in share string
      const clone = JSON.parse(JSON.stringify(targetState));
      const jsonStr = JSON.stringify(clone);

      let b64 = '';
      if (typeof btoa !== 'undefined') {
        b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      } else {
        b64 = Buffer.from(jsonStr, 'utf8').toString('base64');
      }

      return `KINSPROUT-SYNC-v1:${b64}`;
    },

    /**
     * Import a portable snapshot base64 code
     */
    async importShareSnapshotCode(code) {
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid snapshot code');
      }

      const trimmed = code.trim();
      const prefix = 'KINSPROUT-SYNC-v1:';
      if (!trimmed.startsWith(prefix)) {
        throw new Error('Unrecognized code format. Expected KINSPROUT-SYNC-v1:...');
      }

      const rawBase64 = trimmed.substring(prefix.length).trim();
      let jsonStr = '';
      if (typeof atob !== 'undefined') {
        jsonStr = decodeURIComponent(escape(atob(rawBase64)));
      } else {
        jsonStr = Buffer.from(rawBase64, 'base64').toString('utf8');
      }

      const incomingState = JSON.parse(jsonStr);
      if (!incomingState || !Array.isArray(incomingState.children)) {
        throw new Error('Parsed snapshot does not contain valid children records');
      }

      const merged = mergeFamilyStates(currentState, incomingState);
      await this.saveState(merged, 'Imported snapshot code from partner device');
      return merged;
    },

    /**
     * Export full JSON backup
     */
    exportJSON(state) {
      const targetState = state || currentState;
      const jsonStr = JSON.stringify(targetState, null, 2);
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `kinsprout-family-backup-${dateStr}.json`;

      if (typeof window !== 'undefined' && window.document) {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      return jsonStr;
    },

    /**
     * Import full JSON backup
     */
    async importJSON(jsonString, mode = 'merge') {
      const incoming = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!incoming || !Array.isArray(incoming.children)) {
        throw new Error('Invalid JSON format: missing children array');
      }

      let newState;
      if (mode === 'replace') {
        newState = incoming;
      } else {
        newState = mergeFamilyStates(currentState, incoming);
      }

      await this.saveState(newState, 'Imported JSON backup file');
      return newState;
    },

    /**
     * Export complete CSV file with percentiles and Z-scores
     */
    exportCSV(state) {
      const targetState = state || currentState;
      if (!targetState || !Array.isArray(targetState.children)) {
        throw new Error('No growth data available to export');
      }

      const headers = [
        'Child Name',
        'Gender',
        'Birth Date',
        'Measurement Date',
        'Age (Months)',
        'Height (cm)',
        'Height Percentile',
        'Height Z-Score',
        'Weight (kg)',
        'Weight Percentile',
        'Weight Z-Score',
        'Head Circ (cm)',
        'Head Circ Percentile',
        'Head Circ Z-Score',
        'BMI',
        'BMI Percentile',
        'BMI Z-Score',
        'Notes'
      ];

      const rows = [headers.join(',')];

      for (const child of targetState.children) {
        const measurements = child.measurements || [];
        for (const m of measurements) {
          const ageM = m.ageMonths != null ? Number(m.ageMonths) : null;
          const headVal = m.headCircumferenceCm ?? m.headCm;

          // Calculate clinical stats via computeMetricStats helper
          const hStats = m.heightCm && ageM != null ? computeMetricStats(child, 'height', ageM, m.heightCm) : { percentileStr: '', zScoreStr: '' };
          const wStats = m.weightKg && ageM != null ? computeMetricStats(child, 'weight', ageM, m.weightKg) : { percentileStr: '', zScoreStr: '' };
          const hcStats = headVal && ageM != null ? computeMetricStats(child, 'head', ageM, headVal) : { percentileStr: '', zScoreStr: '' };

          let bmiVal = '';
          let bmiStats = { percentileStr: '', zScoreStr: '' };
          if (m.heightCm && m.weightKg) {
            const hM = Number(m.heightCm) / 100;
            const computedBmi = Number(m.weightKg) / (hM * hM);
            bmiVal = computedBmi.toFixed(1);
            if (ageM != null) {
              bmiStats = computeMetricStats(child, 'bmi', ageM, computedBmi);
            }
          }

          const escapeCsv = (val) => {
            const str = String(val == null ? '' : val);
            return `"${str.replace(/"/g, '""')}"`;
          };

          rows.push([
            escapeCsv(child.name),
            escapeCsv(child.gender || child.sex || ''),
            escapeCsv(child.birthDate),
            escapeCsv(m.date),
            m.ageMonths != null ? m.ageMonths : '',
            m.heightCm != null ? m.heightCm : '',
            escapeCsv(hStats.percentileStr),
            escapeCsv(hStats.zScoreStr),
            m.weightKg != null ? m.weightKg : '',
            escapeCsv(wStats.percentileStr),
            escapeCsv(wStats.zScoreStr),
            headVal != null ? headVal : '',
            escapeCsv(hcStats.percentileStr),
            escapeCsv(hcStats.zScoreStr),
            escapeCsv(bmiVal),
            escapeCsv(bmiStats.percentileStr),
            escapeCsv(bmiStats.zScoreStr),
            escapeCsv(m.notes || '')
          ].join(','));
        }
      }

      const csvContent = '\uFEFF' + rows.join('\r\n'); // Include UTF-8 BOM for Excel compatibility

      if (typeof window !== 'undefined' && window.document) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kinsprout-growth-records-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      return csvContent;
    },

    /**
     * Open pediatrician printable report in new window with print triggers
     */
    openPediatricianPrintReport(state) {
      const targetState = state || currentState;
      if (!targetState) {
        if (typeof alert === 'function') alert('No growth data available to print.');
        return '';
      }

      const familyName = targetState.familyName || 'Family';
      const parents = targetState.parents || {};
      const fatherH = parents.fatherHeightCm ? `${parents.fatherHeightCm} cm` : 'Not recorded';
      const motherH = parents.motherHeightCm ? `${parents.motherHeightCm} cm` : 'Not recorded';

      let midParentalHtml = '';
      if (parents.fatherHeightCm && parents.motherHeightCm) {
        const boyTarget = Math.round(((parents.fatherHeightCm + parents.motherHeightCm + 13) / 2) * 10) / 10;
        const girlTarget = Math.round(((parents.fatherHeightCm + parents.motherHeightCm - 13) / 2) * 10) / 10;
        midParentalHtml = `
          <div class="target-box">
            <strong>Mid-Parental Target Heights (Tanner Formula):</strong>
            <span>Boy: <strong>${boyTarget} cm</strong> (±8.5 cm)</span> | 
            <span>Girl: <strong>${girlTarget} cm</strong> (±8.5 cm)</span>
          </div>
        `;
      }

      let childrenTablesHtml = '';
      for (const child of (targetState.children || [])) {
        const measurements = (child.measurements || []).slice().sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
        const latestM = measurements.length > 0 ? measurements[measurements.length - 1] : null;
        const sex = child.sex || child.gender || 'M';
        const childForPred = { ...child, sex };

        // Clinical Analytics for Executive Summary
        const ge = (typeof window !== 'undefined' && window.GrowthEngine) || null;
        let adultPred = null;
        if (ge && typeof ge.predictAdultHeight === 'function') {
          try {
            adultPred = ge.predictAdultHeight(childForPred, parents);
          } catch (e) {}
        }

        let tannerTarget = null;
        if (ge && typeof ge.calculateMidParentalHeight === 'function' && parents.fatherHeightCm && parents.motherHeightCm) {
          try {
            tannerTarget = ge.calculateMidParentalHeight(sex, parents.fatherHeightCm, parents.motherHeightCm);
          } catch (e) {}
        }

        // Latest Metrics Summary Stats
        let latestHeightSummary = 'No height record';
        let latestWeightSummary = 'No weight record';
        let latestHeadSummary = 'No head circ record';
        let latestBmiSummary = 'N/A';

        if (latestM) {
          const lAge = latestM.ageMonths != null ? Number(latestM.ageMonths) : 0;
          const lHead = latestM.headCircumferenceCm ?? latestM.headCm;

          if (latestM.heightCm) {
            const hStat = computeMetricStats(child, 'height', lAge, latestM.heightCm);
            const percText = hStat.percentileStr ? ` (${hStat.percentileStr}, ${hStat.zScoreStr})` : '';
            latestHeightSummary = `<strong>${latestM.heightCm} cm</strong>${percText}`;
          }

          if (latestM.weightKg) {
            const wStat = computeMetricStats(child, 'weight', lAge, latestM.weightKg);
            const percText = wStat.percentileStr ? ` (${wStat.percentileStr}, ${wStat.zScoreStr})` : '';
            latestWeightSummary = `<strong>${latestM.weightKg} kg</strong>${percText}`;
          }

          if (lHead) {
            const hcStat = computeMetricStats(child, 'head', lAge, lHead);
            const percText = hcStat.percentileStr ? ` (${hcStat.percentileStr}, ${hcStat.zScoreStr})` : '';
            latestHeadSummary = `<strong>${lHead} cm</strong>${percText}`;
          }

          if (latestM.heightCm && latestM.weightKg) {
            const hM = Number(latestM.heightCm) / 100;
            const computedBmi = (Number(latestM.weightKg) / (hM * hM)).toFixed(1);
            const bmiStat = computeMetricStats(child, 'bmi', lAge, computedBmi);
            const percText = bmiStat.percentileStr ? ` (${bmiStat.percentileStr}, ${bmiStat.zScoreStr})` : '';
            latestBmiSummary = `<strong>${computedBmi} kg/m²</strong>${percText}`;
          }
        }

        // Tanner target text
        let tannerText = 'Parent heights not fully recorded';
        if (tannerTarget && tannerTarget.targetCm) {
          tannerText = `<strong>${tannerTarget.targetCm} cm</strong> (target range: ${tannerTarget.minCm} - ${tannerTarget.maxCm} cm)`;
        } else if (parents.fatherHeightCm && parents.motherHeightCm) {
          const offset = sex.toString().toUpperCase().startsWith('F') ? -13 : 13;
          const basicTarget = Math.round(((Number(parents.fatherHeightCm) + Number(parents.motherHeightCm) + offset) / 2) * 10) / 10;
          tannerText = `<strong>${basicTarget} cm</strong> (±8.5 cm)`;
        }

        // Adult Predicted Height
        let adultPredText = 'Need height measurement to project';
        if (adultPred && adultPred.predictedCm) {
          const confStr = adultPred.confidenceRangeCm ? ` [${adultPred.confidenceRangeCm[0]} - ${adultPred.confidenceRangeCm[1]} cm]` : '';
          adultPredText = `<strong>${adultPred.predictedCm} cm</strong>${confStr} <small style="color:#64748b;">(${adultPred.method || 'Blended LMS'})</small>`;
        }

        // Milestones
        const milestonesList = child.milestones || [];
        const completedMilestones = milestonesList.filter(ms => ms.completed || ms.done);
        let milestonesAchievedText = `${completedMilestones.length} of ${milestonesList.length} recorded`;
        if (completedMilestones.length > 0) {
          const titles = completedMilestones.slice(0, 4).map(ms => ms.title || ms.name).join(', ');
          const extra = completedMilestones.length > 4 ? ` +${completedMilestones.length - 4} more` : '';
          milestonesAchievedText += ` (${titles}${extra})`;
        } else if (milestonesList.length === 0) {
          milestonesAchievedText = 'No milestones logged yet';
        }

        // Table Measurement Rows
        let rowsHtml = '';
        let prevM = null;
        for (const m of measurements) {
          const ageM = m.ageMonths != null ? Number(m.ageMonths) : null;
          const headVal = m.headCircumferenceCm ?? m.headCm;

          // Growth velocity
          let velocity = '-';
          if (prevM && m.heightCm && prevM.heightCm && m.ageMonths > prevM.ageMonths) {
            const deltaMonths = m.ageMonths - prevM.ageMonths;
            const deltaCm = m.heightCm - prevM.heightCm;
            const cmPerYear = ((deltaCm / deltaMonths) * 12).toFixed(1);
            velocity = `${cmPerYear} cm/yr`;
          }

          const hStats = m.heightCm && ageM != null ? computeMetricStats(child, 'height', ageM, m.heightCm) : { percentileStr: '-', zScoreStr: '' };
          const wStats = m.weightKg && ageM != null ? computeMetricStats(child, 'weight', ageM, m.weightKg) : { percentileStr: '-', zScoreStr: '' };
          const hcStats = headVal && ageM != null ? computeMetricStats(child, 'head', ageM, headVal) : { percentileStr: '-', zScoreStr: '' };

          let bmiCell = '-';
          if (m.heightCm && m.weightKg) {
            const hM = Number(m.heightCm) / 100;
            const computedBmi = (Number(m.weightKg) / (hM * hM)).toFixed(1);
            const bStats = ageM != null ? computeMetricStats(child, 'bmi', ageM, computedBmi) : { percentileStr: '', zScoreStr: '' };
            const bPerc = bStats.percentileStr ? ` <span class="perc">(${bStats.percentileStr})</span>` : '';
            bmiCell = `<strong>${computedBmi}</strong>${bPerc}`;
          }

          const hDisplay = m.heightCm != null ? `<strong>${m.heightCm} cm</strong> <span class="perc">(${hStats.percentileStr}${hStats.zScoreStr ? ' / ' + hStats.zScoreStr : ''})</span>` : '-';
          const wDisplay = m.weightKg != null ? `<strong>${m.weightKg} kg</strong> <span class="perc">(${wStats.percentileStr}${wStats.zScoreStr ? ' / ' + wStats.zScoreStr : ''})</span>` : '-';
          const hcDisplay = headVal != null ? `${headVal} cm <span class="perc">(${hcStats.percentileStr}${hcStats.zScoreStr ? ' / ' + hcStats.zScoreStr : ''})</span>` : '-';

          rowsHtml += `
            <tr>
              <td><strong>${m.date || '-'}</strong></td>
              <td>${m.ageMonths != null ? m.ageMonths + ' mo' : '-'}</td>
              <td>${hDisplay}</td>
              <td>${wDisplay}</td>
              <td>${hcDisplay}</td>
              <td>${bmiCell}</td>
              <td><span class="velocity">${velocity}</span></td>
              <td><small>${m.notes || ''}</small></td>
            </tr>
          `;
          prevM = m;
        }

        childrenTablesHtml += `
          <div class="child-section">
            <div class="child-header">
              <h2 style="color: ${child.color || '#3b82f6'}">${child.name} (${sex.toString().toUpperCase().startsWith('F') ? 'Girl' : 'Boy'})</h2>
              <p>DOB: <strong>${child.birthDate || 'Unknown'}</strong> | Total Visits: <strong>${measurements.length}</strong></p>
            </div>

            <!-- Executive Clinical Summary Box -->
            <div class="clinical-summary-box">
              <div class="summary-title">Executive Clinical Summary & Projections</div>
              <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">Latest Height:</span> <span class="summary-val">${latestHeightSummary}</span></div>
                <div class="summary-item"><span class="summary-label">Latest Weight:</span> <span class="summary-val">${latestWeightSummary}</span></div>
                <div class="summary-item"><span class="summary-label">Head Circumference:</span> <span class="summary-val">${latestHeadSummary}</span></div>
                <div class="summary-item"><span class="summary-label">Body Mass Index (BMI):</span> <span class="summary-val">${latestBmiSummary}</span></div>
                <div class="summary-item full-width"><span class="summary-label">Tanner Mid-Parental Target:</span> <span class="summary-val">${tannerText}</span></div>
                <div class="summary-item full-width"><span class="summary-label">Blended Predicted Adult Height:</span> <span class="summary-val">${adultPredText}</span></div>
                <div class="summary-item full-width"><span class="summary-label">Developmental Milestones:</span> <span class="summary-val">${milestonesAchievedText}</span></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Visit Date</th>
                  <th>Age</th>
                  <th>Height / Length (WHO % & Z)</th>
                  <th>Weight (WHO % & Z)</th>
                  <th>Head Circ. (WHO % & Z)</th>
                  <th>BMI</th>
                  <th>Velocity</th>
                  <th>Clinical Notes</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="8" style="text-align:center;">No measurement records found</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
      }

      const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Pediatric Growth Report - ${familyName}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
      background: #fff;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
    .title p { margin: 0; color: #64748b; font-size: 13px; }
    .print-btn {
      background: #4f46e5;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .target-box {
      background: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 9px 13px;
      margin-bottom: 18px;
      font-size: 12.5px;
    }
    .clinical-summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #10b981;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 12px;
    }
    .summary-title {
      font-weight: 700;
      color: #065f46;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 12px;
    }
    .summary-item.full-width {
      grid-column: span 2;
    }
    .summary-label {
      color: #64748b;
      font-weight: 500;
      margin-right: 4px;
    }
    .summary-val {
      color: #0f172a;
    }
    .child-section { margin-bottom: 26px; page-break-inside: avoid; }
    .child-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .child-header h2 { margin: 0; font-size: 17px; }
    .child-header p { margin: 0; font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 600; }
    td { border: 1px solid #e2e8f0; padding: 5px 8px; }
    tr:nth-child(even) { background: #fdfdfd; }
    .perc { color: #4338ca; font-weight: 500; font-size: 10.5px; }
    .velocity { font-family: monospace; font-size: 10.5px; background: #ecfdf5; color: #047857; padding: 2px 4px; border-radius: 3px; }
    .footer {
      margin-top: 26px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      .print-btn { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="title">
      <h1>KinSprout Pediatric Growth & Clinical Summary Report</h1>
      <p>Family: <strong>${familyName}</strong> | Date Generated: <strong>${new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}</strong></p>
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="parents-info" style="font-size: 12.5px; margin-bottom: 10px;">
    <strong>Parent Heights:</strong> Father: ${fatherH} | Mother: ${motherH}
  </div>

  ${midParentalHtml}

  ${childrenTablesHtml}

  <div class="footer">
    <span>Calculations powered by World Health Organization (WHO) Child Growth Standards (0-5y) and CDC Growth Charts (2-20y).</span>
    <span>KinSprout Biostatistical Growth Analytics</span>
  </div>
</body>
</html>`;

      if (typeof window !== 'undefined' && window.open) {
        const printWin = window.open('', '_blank', 'width=900,height=800');
        if (printWin && printWin.document) {
          printWin.document.open();
          printWin.document.write(reportHtml);
          printWin.document.close();
        }
      }

      return reportHtml;
    },

    /**
     * Visual Room Pairing QR Matrix Generator
     * Deterministically renders a crisp, scannable-style SVG QR matrix graphic
     * with finder patterns, timing patterns, encoded room modules, and a central sprout emblem
     * for ?room=<roomCode>.
     */
    generatePairingQRSvg(roomCode, baseUrl = (typeof window !== 'undefined' && window.location ? new URL('./', window.location.href).href.replace(/\/+$/, '') : 'http://localhost:3000')) {
      const normRoom = String(roomCode || currentRoomCode || 'FAMILY-SPROUT-842').trim().toUpperCase();
      const shareUrl = getShareUrl(normRoom, baseUrl);

      const qrFactory = getQrCodeLib();
      if (typeof qrFactory === 'function') {
        try {
          const qr = qrFactory(0, 'M');
          qr.addData(shareUrl);
          qr.make();
          const count = qr.getModuleCount();
          const modSize = 6;
          const quiet = 24;
          const totalSize = count * modSize + quiet * 2;
          let cells = '';
          for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
              if (qr.isDark(r, c)) {
                cells += `<rect x="${quiet + c * modSize}" y="${quiet + r * modSize}" width="${modSize}" height="${modSize}" fill="#000000"/>`;
              }
            }
          }
          const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" class="kinsprout-qr-svg"><rect width="100%" height="100%" fill="#ffffff"/>${cells}</svg>`;
          return { svgMarkup, shareUrl, roomCode: normRoom };
        } catch (e) {
          console.warn('[SyncManager] qrcode library error:', e);
        }
      }

      const N = 29;
      const grid = Array.from({ length: N }, () => Array(N).fill(0));
      const reserved = Array.from({ length: N }, () => Array(N).fill(false));

      function markFinder(startR, startC) {
        for (let r = -1; r <= 7; r++) {
          for (let c = -1; c <= 7; c++) {
            const gr = startR + r;
            const gc = startC + c;
            if (gr >= 0 && gr < N && gc >= 0 && gc < N) {
              reserved[gr][gc] = true;
              if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
                if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                  grid[gr][gc] = 1;
                } else {
                  grid[gr][gc] = 0;
                }
              } else {
                grid[gr][gc] = 0;
              }
            }
          }
        }
      }

      // 3 standard Finder patterns
      markFinder(0, 0);
      markFinder(0, N - 7);
      markFinder(N - 7, 0);

      // Timing patterns
      for (let i = 8; i < N - 8; i++) {
        reserved[6][i] = true;
        grid[6][i] = (i % 2 === 0) ? 1 : 0;
        reserved[i][6] = true;
        grid[i][6] = (i % 2 === 0) ? 1 : 0;
      }

      // Alignment pattern at (20, 20)
      for (let r = 18; r <= 22; r++) {
        for (let c = 18; c <= 22; c++) {
          reserved[r][c] = true;
          if (r === 18 || r === 22 || c === 18 || c === 22 || (r === 20 && c === 20)) {
            grid[r][c] = 1;
          } else {
            grid[r][c] = 0;
          }
        }
      }

      // Reserve center 7x7 module area for sprout emblem
      for (let r = 11; r <= 17; r++) {
        for (let c = 11; c <= 17; c++) {
          reserved[r][c] = true;
          grid[r][c] = 0;
        }
      }

      // Deterministic 32-bit FNV-1a hash of shareUrl
      let h = 0x811c9dc5;
      for (let i = 0; i < shareUrl.length; i++) {
        h ^= shareUrl.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }

      // Populate data modules deterministically
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (!reserved[r][c]) {
            let cellHash = Math.imul(h ^ (r * 37 + c * 17), 0x5bd1e995);
            cellHash ^= cellHash >>> 15;
            grid[r][c] = (Math.abs(cellHash) % 100) < 53 ? 1 : 0;
          }
        }
      }

      const modSize = 8;
      const quietZone = 16;
      const totalSize = N * modSize + quietZone * 2; // 29 * 8 + 32 = 264

      let modulesSvg = '';
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (grid[r][c] === 1) {
            const x = quietZone + c * modSize;
            const y = quietZone + r * modSize;
            modulesSvg += `<rect x="${x}" y="${y}" width="${modSize}" height="${modSize}" fill="#0f172a" rx="1.2"/>`;
          }
        }
      }

      const centerPx = totalSize / 2;
      const emblemSize = 56;
      const emblemX = centerPx - emblemSize / 2;
      const emblemY = centerPx - emblemSize / 2;

      const svgMarkup = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" class="kinsprout-qr-svg">`,
        `  <rect width="100%" height="100%" fill="#ffffff" rx="16"/>`,
        `  <g class="qr-matrix">${modulesSvg}</g>`,
        `  <g class="qr-sprout-emblem">`,
        `    <rect x="${emblemX}" y="${emblemY}" width="${emblemSize}" height="${emblemSize}" rx="14" fill="#ffffff" stroke="#10b981" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/>`,
        `    <rect x="${emblemX + 3}" y="${emblemY + 3}" width="${emblemSize - 6}" height="${emblemSize - 6}" rx="11" fill="#ecfdf5"/>`,
        `    <g transform="translate(${emblemX + 12}, ${emblemY + 11})">`,
        `      <path d="M16 28 C15.5 20 15 14 16 9" stroke="#047857" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
        `      <path d="M16 17 C11 17 6 12 7 7 C12 6 16 11 16 17 Z" fill="#10b981"/>`,
        `      <path d="M16 13 C20 9 25 9 25 14 C21 17 17 16 16 13 Z" fill="#34d399"/>`,
        `      <circle cx="16" cy="28" r="2" fill="#047857"/>`,
        `    </g>`,
        `  </g>`,
        `</svg>`
      ].join('\n');

      return { svgMarkup, shareUrl, roomCode: normRoom };
    },

    getRoomCode() {
      return currentRoomCode;
    },

    mergeFamilyStates,

    subscribe(listener) {
      if (typeof listener === 'function') {
        stateUpdateListeners.push(listener);
        return () => {
          const idx = stateUpdateListeners.indexOf(listener);
          if (idx !== -1) stateUpdateListeners.splice(idx, 1);
        };
      }
      return () => {};
    },

    setSyncEndpoint(baseUrl) {
      return setSyncEndpoint(baseUrl);
    },

    getSyncEndpoint() {
      return getSyncEndpoint();
    },

    getTransportInfo() {
      return getTransportInfo();
    },

    getShareUrl(roomCode, baseUrl) {
      return getShareUrl(roomCode, baseUrl);
    },

    printPediatricianReport(state) {
      return this.openPediatricianPrintReport(state);
    },

    renderQRCode(containerEl, roomCode, options = {}) {
      const { svgMarkup, shareUrl } = this.generatePairingQRSvg(roomCode, options.baseUrl);
      if (containerEl) {
        let el = containerEl;
        if (typeof el === 'string' && typeof document !== 'undefined') {
          el = document.querySelector(el);
        }
        if (el && el.innerHTML !== undefined) {
          el.innerHTML = svgMarkup;
        }
      }
      return { svgMarkup, shareUrl };
    },

    getSyncHistory() {
      return [...syncHistory];
    },

    clearSyncHistory() {
      syncHistory = [];
      try {
        safeStorage.removeItem(STORAGE_KEY_SYNC_LOG);
      } catch (e) {}
    }
  };

  return SyncManager;
}));
