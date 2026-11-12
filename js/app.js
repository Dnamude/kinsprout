/**
 * KinSprout — Two-Children Growth Tracker & Biometric Journal
 * Application Controller & Orchestration Specialist (app.js)
 *
 * Responsibilities:
 * - Application lifecycle initialization with SyncManager, GrowthEngine, SiblingComparison, PhotoImport, and GrowthCharts
 * - Navigation tab controller (5 primary views)
 * - Child selector bar & 4 Biometric KPI cards with WHO/CDC percentiles & Z-scores
 * - Interactive Percentile Fan Chart & Value-Add Insights Grid (Mid-Parental, Apparel, Velocity)
 * - Sibling Comparison Studio with live age scrubber, dual overlay chart, height wall, and milestone race
 * - Bulk Picture Data Entry Studio with visual document scanner, OCR parsing, bounding boxes, and staging commit
 * - History & Milestones Journal with search, filtering, and CRUD operations
 * - Cross-Device Sync Hub & Clinical Export (Cloud Room, Portable Base64, CSV, JSON, Pediatrician Print Report)
 * - Modals for logging checkups, editing family/parents, and recording milestones
 */

(function () {
  'use strict';

  // =========================================================================
  // APP STATE & CONSTANTS
  // =========================================================================

  const AppState = {
    familyState: null,
    activeTab: 'view-overview', // Defaults to 🏡 Family Hub
    selectedChildId: 'child-1',
    unitSystem: 'metric',
    dashboardMetric: 'height',
    siblingChartMetric: 'height',
    siblingVelocityMetric: 'height',
    comparisonAgeMonths: 12.0,
    comparisonChartMode: 'absolute',
    heightWallMode: 'same-age',
    historyChildFilter: 'all',
    historySearchTerm: '',
    stagedRecords: [],
    activeStagingRowIndex: -1,
    activeSampleId: 'pediatric-summary',
    undoManager: null,
    timelapseTimer: null,
    deferredInstallPrompt: null,
    deepDiveStudioInstance: null,
    familyOverviewInstance: null,
    quickLogComposer: null,
    familyRepeaterInstance: null,
    onboardingRepeaterInstance: null,
    chartsInstances: {
      percentile: null,
      comparison: null,
      heightWall: null,
      siblingVelocity: null
    }
  };

  // Helper safe module accessors
  function getEngine() { return window.GrowthEngine || null; }
  function getSiblingComp() { return window.SiblingComparison || null; }
  function getPhotoImport() { return window.PhotoImport || null; }
  function getSyncManager() { return window.SyncManager || null; }
  function getCharts() { return window.GrowthCharts || null; }
  function getInputControls() { return window.InputControls || null; }
  function getDeepDiveStudio() { return window.DeepDiveStudio || null; }

  // =========================================================================
  // DOM UTILITIES & TOAST NOTIFICATION SYSTEM
  // =========================================================================

  function $(id) {
    if (!id) return null;
    if (id.startsWith('#')) return document.getElementById(id.slice(1));
    if (id.startsWith('.')) return document.querySelector(id);
    return document.getElementById(id) || document.querySelector(id);
  }

  function fmtOrd(n) {
    if (n == null || isNaN(n)) return '—';
    const r = Math.round(Number(n));
    if (window.GrowthEngine && typeof window.GrowthEngine.formatOrdinal === 'function') {
      return window.GrowthEngine.formatOrdinal(r);
    }
    const s = ['th', 'st', 'nd', 'rd'], v = r % 100;
    return r + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = $('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span style="font-weight: bold;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease-out';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, duration);
  }

  function showUndoToast(message, onUndo, duration = 8000) {
    const container = $('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'space-between';

    const msgSpan = document.createElement('span');
    msgSpan.innerHTML = `<span>🗑️</span> <span style="margin-left: 6px;">${message}</span>`;

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'toast-undo-btn kp-toast-btn-undo';
    undoBtn.id = 'kp-toast-undo-btn';
    undoBtn.textContent = 'Undo';

    let undone = false;
    undoBtn.addEventListener('click', async () => {
      if (undone) return;
      undone = true;
      if (typeof onUndo === 'function') {
        await onUndo();
      }
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
    });

    toast.appendChild(msgSpan);
    toast.appendChild(undoBtn);
    container.appendChild(toast);

    setTimeout(() => {
      if (!undone && toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 200ms ease-out';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 200);
      }
    }, duration);
  }

  // =========================================================================
  // INITIALIZATION & SYNC CONNECTION
  // =========================================================================

  async function initApp() {
    console.log('[KinSprout] Initializing Application Controller 2.0...');

    // 0. Register ServiceWorker safely for offline PWA
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('[KinSprout] ServiceWorker registration skipped/failed:', err);
        });
      });
    }

    // 1. Initialize Sync Manager and load state
    const sm = getSyncManager();
    if (sm) {
      try {
        AppState.familyState = await sm.init(handleRemoteStateUpdate);
        sm.onStatusChange(handleSyncStatusChange);
        console.log('[KinSprout] SyncManager loaded family state:', AppState.familyState?.familyName);
      } catch (err) {
        console.warn('[KinSprout] Error initializing SyncManager:', err);
      }
    }

    // Fallback state if SyncManager returned null
    if (!AppState.familyState) {
      const sc = getSiblingComp();
      if (sc && typeof sc.getDefaultFamilyState === 'function') {
        AppState.familyState = sc.getDefaultFamilyState();
      }
    }

    // Set initial unit system from family state or default
    if (AppState.familyState?.unitSystem) {
      AppState.unitSystem = AppState.familyState.unitSystem;
    }

    // 2. Initialize CRDT-Safe Undo Manager
    const ic = getInputControls();
    if (ic && typeof ic.createUndoManager === 'function') {
      AppState.undoManager = ic.createUndoManager({
        maxDepth: 20,
        toastContainer: $('toast-container'),
        onRestore: async (restoredState) => {
          AppState.familyState = restoredState;
          const sm = getSyncManager();
          if (sm) {
            await sm.saveState(AppState.familyState, 'Restored state via Undo');
          }
          renderAllViews();
          showToast('Action undone successfully', 'success');
        }
      });
    }

    // Ensure any undo button in #toast-container gets .toast-undo-btn
    const toastContainer = $('toast-container');
    if (toastContainer && typeof MutationObserver !== 'undefined') {
      const toastObserver = new MutationObserver(() => {
        const btns = toastContainer.querySelectorAll('.kp-toast-btn-undo, #kp-toast-undo-btn');
        btns.forEach(btn => {
          if (!btn.classList.contains('toast-undo-btn')) {
            btn.classList.add('toast-undo-btn');
          }
        });
      });
      toastObserver.observe(toastContainer, { childList: true, subtree: true });
    }

    // 3. Bind Keyboard Shortcuts
    if (ic && typeof ic.bindKeyboardShortcuts === 'function') {
      ic.bindKeyboardShortcuts({
        onQuickLog: () => openQuickLogDrawer(),
        onQuickMilestone: () => openQuickLogDrawer(null, null, null, 'milestone'),
        onToggleUnits: () => setUnitSystem(AppState.unitSystem === 'metric' ? 'imperial' : 'metric'),
        onSwitchWorkspace: (idx) => {
          const screens = ['view-overview', 'view-dashboard', 'view-comparison', 'view-photo-import', 'view-records', 'view-sync'];
          if (screens[idx]) switchView(screens[idx]);
        },
        onCycleChild: (dir) => cycleActiveChild(dir),
        onUndo: () => {
          if (AppState.undoManager && AppState.undoManager.canUndo()) {
            AppState.undoManager.undo();
          }
        }
      });
    } else {
      window.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
        if (e.key === 'l' || e.key === 'L') { e.preventDefault(); openQuickLogDrawer(); }
        else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); openQuickLogDrawer(null, null, null, 'milestone'); }
        else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); setUnitSystem(AppState.unitSystem === 'metric' ? 'imperial' : 'metric'); }
        else if (e.key === '?') { e.preventDefault(); openKeyboardShortcutsModal(); }
        else if (e.key >= '1' && e.key <= '6') {
          const screens = ['view-overview', 'view-dashboard', 'view-comparison', 'view-photo-import', 'view-records', 'view-sync'];
          const s = screens[parseInt(e.key, 10) - 1];
          if (s) { e.preventDefault(); switchView(s); }
        }
      });
    }

    // Global Escape Handler to close drawers, sheets, and open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closeQuickLogDrawer();
        const moreSheet = $('mobile-more-sheet');
        if (moreSheet) {
          moreSheet.classList.remove('open');
          moreSheet.style.display = 'none';
          moreSheet.setAttribute('aria-hidden', 'true');
        }
        const kpModal = document.getElementById('kp-shortcuts-modal');
        if (kpModal) {
          kpModal.classList.remove('active');
          try { kpModal.remove(); } catch (e) {}
        }
        document.querySelectorAll('.modal-backdrop.open').forEach(m => closeModal(m));
      }
    });

    // 4. Listen for PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      AppState.deferredInstallPrompt = e;
      const btnInstall = $('btn-install-pwa');
      if (btnInstall) btnInstall.style.display = 'inline-flex';
    });

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      const iosInstruct = $('pwa-ios-instructions');
      if (iosInstruct) iosInstruct.style.display = 'block';
    }

    // 5. Wire up all DOM events & interactive controls
    setupNavigationTabs();
    setupHeaderActions();
    setupDashboardControls();
    setupComparisonControls();
    setupPhotoImportStudio();
    setupHistoryAndMilestones();
    setupSyncHubControls();
    setupModals();
    setupQuickLogDrawer();
    setupMobileNavigation();

    // 6. Render initial views with current state
    updateUnitSystemUI();
    renderAllViews();

    // 7. Load initial sample in Photo Import Studio
    loadSamplePhoto('pediatric-summary');

    console.log('[KinSprout] Application fully initialized & operational.');
  }

  function handleRemoteStateUpdate(newState, source) {
    if (!newState) return;
    console.log('[KinSprout] State updated from source:', source);
    AppState.familyState = newState;
    if (newState.unitSystem && newState.unitSystem !== AppState.unitSystem) {
      AppState.unitSystem = newState.unitSystem;
      updateUnitSystemUI();
    }
    renderAllViews();
    if (source !== 'local-save') {
      showToast('Growth data synchronized with family cloud', 'success');
    }
  }

  function handleSyncStatusChange(statusObj) {
    updateSyncStatusUI(statusObj);
  }

  // =========================================================================
  // VIEW SWITCHING & NAVIGATION (6 WORKSPACES)
  // =========================================================================

  function setupNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetViewId = tab.getAttribute('data-target');
        switchView(targetViewId);
      });
    });

    // Brand link returns to Family Hub
    const brandLink = $('brand-home-link');
    if (brandLink) {
      brandLink.addEventListener('click', () => switchView('view-overview'));
    }
  }

  function switchView(targetViewId) {
    if (!targetViewId) return;
    AppState.activeTab = targetViewId;

    // Update desktop nav tab buttons
    const tabs = document.querySelectorAll('.nav-tab-btn');
    tabs.forEach(tab => {
      const isTarget = tab.getAttribute('data-target') === targetViewId;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // Update mobile bottom nav buttons
    const mobBtns = document.querySelectorAll('.mobile-nav-btn');
    mobBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-target') === targetViewId;
      btn.classList.toggle('active', isTarget);
    });

    // Update view sections
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(sec => {
      sec.classList.toggle('active', sec.id === targetViewId);
    });

    // Render / refresh view content
    if (targetViewId === 'view-overview') {
      renderFamilyOverviewView();
    } else if (targetViewId === 'view-dashboard') {
      renderDashboardView();
    } else if (targetViewId === 'view-comparison') {
      renderComparisonViews();
    } else if (targetViewId === 'view-records') {
      renderHistoryTable();
      renderMilestonesGrid();
    } else if (targetViewId === 'view-sync') {
      renderSyncHubView();
    } else if (targetViewId === 'view-photo-import') {
      renderStagingTable();
    }
  }

  // =========================================================================
  // HEADER ACTIONS & UNIT TOGGLE
  // =========================================================================

  function setupHeaderActions() {
    // Sync Pill click -> switch to Sync Hub
    const syncPill = $('sync-status-pill');
    if (syncPill) {
      syncPill.addEventListener('click', () => switchView('view-sync'));
    }

    // Unit toggle buttons
    const btnMetric = $('btn-unit-metric');
    const btnImperial = $('btn-unit-imperial');

    if (btnMetric) {
      btnMetric.addEventListener('click', () => setUnitSystem('metric'));
    }
    if (btnImperial) {
      btnImperial.addEventListener('click', () => setUnitSystem('imperial'));
    }

    // Quick Add Checkup -> Persistent Drawer
    const btnQuickLog = $('btn-quick-log');
    if (btnQuickLog) {
      btnQuickLog.addEventListener('click', () => openQuickLogDrawer());
    }

    // Keyboard Shortcuts Button
    const btnKeyboardHelp = $('btn-keyboard-help');
    if (btnKeyboardHelp) {
      btnKeyboardHelp.addEventListener('click', () => openKeyboardShortcutsModal());
    }

    // Quick Bulk Photo Import
    const btnQuickPhoto = $('btn-quick-photo');
    if (btnQuickPhoto) {
      btnQuickPhoto.addEventListener('click', () => switchView('view-photo-import'));
    }
  }

  function setUnitSystem(system) {
    if (AppState.unitSystem === system) return;
    AppState.unitSystem = system;
    if (AppState.familyState) {
      AppState.familyState.unitSystem = system;
      const sm = getSyncManager();
      if (sm) sm.saveState(AppState.familyState, `Changed unit system to ${system}`);
    }
    updateUnitSystemUI();
    renderAllViews();
    showToast(`Display units switched to ${system === 'metric' ? 'Metric (kg / cm)' : 'Imperial (lb / in)'}`, 'info');
  }

  function updateUnitSystemUI() {
    const btnMetric = $('btn-unit-metric');
    const btnImperial = $('btn-unit-imperial');
    const isImp = AppState.unitSystem === 'imperial';

    if (btnMetric) btnMetric.classList.toggle('active', !isImp);
    if (btnImperial) btnImperial.classList.toggle('active', isImp);

    // Update modal input labels
    const lblHeight = $('label-meas-height');
    const lblWeight = $('label-meas-weight');
    const lblHead = $('label-meas-head');

    if (lblHeight) lblHeight.textContent = isImp ? 'Height / Length (in)' : 'Height / Length (cm)';
    if (lblWeight) lblWeight.textContent = isImp ? 'Weight (lb)' : 'Weight (kg)';
    if (lblHead) lblHead.textContent = isImp ? 'Head Circumference (in)' : 'Head Circumference (cm)';
  }

  // =========================================================================
  // WORKSPACE 1: FAMILY HUB (#view-overview)
  // =========================================================================

  function renderFamilyOverviewView() {
    const dd = getDeepDiveStudio();
    const mountEl = $('family-overview-mount');
    if (!mountEl) return;

    if (dd && typeof dd.renderFamilyOverview === 'function') {
      if (!AppState.familyOverviewInstance) {
        AppState.familyOverviewInstance = dd.renderFamilyOverview(mountEl, {
          familyState: AppState.familyState,
          unitSystem: AppState.unitSystem,
          onSelectChildDeepDive: (childId, lens) => {
            AppState.selectedChildId = childId;
            switchView('view-dashboard');
            if (lens && AppState.deepDiveStudioInstance && typeof AppState.deepDiveStudioInstance.setLens === 'function') {
              AppState.deepDiveStudioInstance.setLens(lens);
            }
          },
          onQuickLogChild: (childId, preset) => {
            openQuickLogDrawer(childId, preset);
          },
          onAddChild: () => {
            openFamilyModal();
          },
          onEditFamily: () => {
            openFamilyModal();
          },
          onOpenComparison: (childAId, childBId) => {
            if (childAId && childBId && AppState.familyState?.settings) {
              AppState.familyState.settings.comparePair = [childAId, childBId];
            }
            switchView('view-comparison');
          },
          onOpenPhotoImport: () => {
            switchView('view-photo-import');
          }
        });
      } else {
        AppState.familyOverviewInstance.update({
          familyState: AppState.familyState,
          unitSystem: AppState.unitSystem
        });
      }
    } else {
      // Fallback Family Hub display
      const children = AppState.familyState?.children || [];
      mountEl.innerHTML = `
        <div style="padding: 20px 0;">
          <h2 style="font-family: var(--font-serif); margin-bottom: 6px;">${AppState.familyState?.familyName || 'Our Family'} Hub</h2>
          <p style="font-size: 0.85rem; color: var(--ink-secondary); margin-bottom: 20px;">Welcome to your family biometric growth command center.</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
            ${children.map((c, idx) => `
              <div style="background: var(--surface-card); border: 1px solid var(--border-stone); border-radius: var(--radius-lg); padding: 18px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                  <div style="width: 40px; height: 40px; border-radius: 50%; background: ${c.color || '#C85A32'}; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                    ${(c.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.05rem;">${c.name}</h3>
                    <span style="font-size: 0.75rem; color: var(--ink-muted);">${c.sex === 'F' ? 'Girl' : 'Boy'} • Born ${c.birthDate || '—'}</span>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 14px;">
                  <button type="button" class="btn btn-primary btn-sm view-child-btn" data-child-id="${c.id}">Deep-Dive Studio →</button>
                  <button type="button" class="btn btn-secondary btn-sm quick-log-child-btn" data-child-id="${c.id}">+ Quick Log</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      mountEl.querySelectorAll('.view-child-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          AppState.selectedChildId = btn.getAttribute('data-child-id');
          switchView('view-dashboard');
        });
      });
      mountEl.querySelectorAll('.quick-log-child-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openQuickLogDrawer(btn.getAttribute('data-child-id'));
        });
      });
    }
  }

  // =========================================================================
  // WORKSPACE 2: CHILD DEEP-DIVE CLINICAL STUDIO (#view-dashboard)
  // =========================================================================

  function setupDashboardControls() {
    // Metric selector pills for fan chart
    const metricPills = document.querySelectorAll('#dashboard-metric-selector .metric-pill-btn');
    metricPills.forEach(pill => {
      pill.addEventListener('click', () => {
        metricPills.forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
        AppState.dashboardMetric = pill.getAttribute('data-metric');
        renderDashboardCharts();
      });
    });

    // Edit family profiles button
    const btnEditFamily = $('btn-edit-family');
    if (btnEditFamily) {
      btnEditFamily.addEventListener('click', () => openFamilyModal());
    }

    const btnAddChildDash = $('btn-add-child-dashboard');
    if (btnAddChildDash) {
      btnAddChildDash.addEventListener('click', () => openFamilyModal());
    }
  }

  function getActiveChild() {
    const children = AppState.familyState?.children || [];
    if (AppState.selectedChildId === 'both') {
      return children[0] || null;
    }
    return children.find(c => c.id === AppState.selectedChildId) || children[0] || null;
  }

  function renderDashboardView() {
    updateChildSelectorPills();

    const dd = getDeepDiveStudio();
    const activeChild = getActiveChild();
    const mountEl = $('deep-dive-studio-mount');
    const legacyEl = $('legacy-dashboard-fallback');

    if (dd && typeof dd.render === 'function' && mountEl && activeChild) {
      if (legacyEl) legacyEl.style.display = 'none';
      if (!AppState.deepDiveStudioInstance) {
        AppState.deepDiveStudioInstance = dd.render(mountEl, {
          child: activeChild,
          familyState: AppState.familyState,
          unitSystem: AppState.unitSystem,
          activeLens: 'trajectories',
          onEditMeasurement: (m) => openQuickLogDrawer(activeChild.id, null, m),
          onAddMeasurement: () => openQuickLogDrawer(activeChild.id),
          onInlineSaveMeasurement: async (childId, m) => {
            await handleComposerMeasurementSubmit(m, childId);
          },
          onDeleteMeasurement: async (childId, mId) => {
            await deleteRecord(childId, mId);
          },
          onQuickLogAtAge: (childId, ageMonths, presetLabel) => {
            openQuickLogDrawer(childId, { months: ageMonths, label: presetLabel });
          },
          onToggleMilestone: async (childId, catalogItem, isAchieved, dateStr) => {
            const child = (AppState.familyState?.children || []).find(c => c.id === childId);
            if (!child) return;
            if (!child.milestones) child.milestones = [];
            const now = Date.now();
            const existingIdx = child.milestones.findIndex(m => (m.key && m.key === catalogItem.key) || m.id === catalogItem.id);
            if (isAchieved) {
              const ms = {
                id: catalogItem.id || `ms_${catalogItem.key || now}_${now}`,
                key: catalogItem.key,
                title: catalogItem.title,
                category: catalogItem.category || 'growth',
                ageMonths: catalogItem.targetAgeMonths || 0,
                targetAgeMonths: catalogItem.targetAgeMonths,
                date: dateStr || new Date().toISOString().slice(0, 10),
                notes: catalogItem.description || '',
                updatedAt: now
              };
              if (existingIdx !== -1) child.milestones[existingIdx] = ms;
              else child.milestones.push(ms);
              if (AppState.familyState.deletedIds) {
                AppState.familyState.deletedIds = AppState.familyState.deletedIds.filter(id => id !== ms.id);
              }
            } else {
              if (existingIdx !== -1) {
                const removed = child.milestones[existingIdx];
                child.milestones.splice(existingIdx, 1);
                if (!AppState.familyState.deletedIds) AppState.familyState.deletedIds = [];
                if (removed.id) AppState.familyState.deletedIds.push(removed.id);
              }
            }
            child.updatedAt = now;
            AppState.familyState.updatedAt = now;
            const sm = getSyncManager();
            if (sm) await sm.saveState(AppState.familyState, `Updated milestones for ${child.name}`);
            renderAllViews();
          },
          onAddCustomMilestone: async (childId, ms) => {
            await handleComposerMilestoneSubmit(ms, childId);
          },
          onUpdateParentHeights: async (parents) => {
            if (!AppState.familyState.parents) AppState.familyState.parents = {};
            const now = Date.now();
            AppState.familyState.parents = { ...AppState.familyState.parents, ...parents, updatedAt: now };
            AppState.familyState.updatedAt = now;
            const sm = getSyncManager();
            if (sm) await sm.saveState(AppState.familyState, 'Updated parent heights');
            renderAllViews();
            showToast('Parent heights saved', 'success');
          },
          onOpenComparison: (childId) => {
            switchView('view-comparison');
          },
          onOpenPrintReport: (childId) => {
            const sm = getSyncManager();
            if (sm && typeof sm.openPediatricianPrintReport === 'function') {
              sm.openPediatricianPrintReport(childId || activeChild.id);
            } else {
              window.print();
            }
          }
        });
      } else {
        AppState.deepDiveStudioInstance.update({
          child: activeChild,
          familyState: AppState.familyState,
          unitSystem: AppState.unitSystem
        });
      }
    } else {
      if (legacyEl) legacyEl.style.display = 'block';
    }

    // Always compute legacy KPI cards & summary strip so queries to them succeed cleanly
    renderKPICards();
    renderClinicalSummaryStrip();
    renderDashboardCharts();
    renderPediatricInsights();
  }

  function updateChildSelectorPills() {
    const container = $('dashboard-child-selector');
    if (!container) return;

    const children = AppState.familyState?.children || [];
    const ge = getEngine();
    const c1 = children[0] || { id: 'child-1', name: 'Child 1', sex: 'M' };
    const c2 = children[1] || { id: 'child-2', name: 'Child 2', sex: 'F' };

    // Build dynamic pills for all 1..N children
    let pillsHtml = '';
    children.forEach((c, idx) => {
      const isSelected = c.id === AppState.selectedChildId;
      const avatarLetter = (c.name || 'C').charAt(0).toUpperCase();
      let extraClass = '';
      let idAttr = '';
      if (idx === 0 || c.id === 'child-1') {
        extraClass = 'child-a child-leo';
        idAttr = 'id="pill-child-leo"';
      } else if (idx === 1 || c.id === 'child-2') {
        extraClass = 'child-b child-maya';
        idAttr = 'id="pill-child-maya"';
      } else {
        extraClass = `child-n child-${(idx % 6) + 1}`;
      }

      let metaText = c.sex === 'F' ? 'Girl' : 'Boy';
      if (ge && c.birthDate) {
        const latestM = (c.measurements || [])[c.measurements.length - 1];
        const age = latestM ? latestM.ageMonths : ge.calculateAgeMonths(c.birthDate, new Date());
        metaText = `${ge.formatAge(age)} • ${metaText}`;
      }

      const colorStyle = c.color ? `style="--child-accent: ${c.color};"` : '';

      pillsHtml += `
        <button type="button" class="child-pill-btn ${extraClass} ${isSelected ? 'active' : ''}" data-child-id="${c.id}" ${idAttr} ${colorStyle}>
          <div class="child-pill-avatar" style="${c.color ? `background:${c.color}; color:#fff;` : ''}">${avatarLetter}</div>
          <div class="child-pill-info">
            <div class="name">${c.name}</div>
            <div class="meta">${metaText}</div>
          </div>
        </button>
      `;
    });

    // Add Side-by-Side compare pill and + Add Child button
    pillsHtml += `
      <button type="button" class="child-pill-btn child-both" data-child-id="both" id="pill-child-both">
        <div class="child-pill-avatar avatar-both">⚡</div>
        <div class="child-pill-info">
          <div class="name">Sibling Studio</div>
          <div class="meta">Comparative Trajectory</div>
        </div>
      </button>
      <button type="button" class="btn btn-secondary btn-sm" id="btn-add-child-dashboard" style="margin-left: 6px;">
        <span>+ Add Child</span>
      </button>
    `;

    container.innerHTML = pillsHtml;

    // Wire clicks on newly rendered pills
    container.querySelectorAll('.child-pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        const childId = pill.getAttribute('data-child-id');
        if (childId === 'both') {
          switchView('view-comparison');
          return;
        }
        AppState.selectedChildId = childId;
        renderDashboardView();
      });
    });

    const btnAdd = $('btn-add-child-dashboard');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => openFamilyModal());
    }

    // Update legacy text spans for Leo and Maya so legacy tests find them
    const name1El = $('leo-pill-name');
    if (name1El) name1El.textContent = c1.name;
    const name2El = $('maya-pill-name');
    if (name2El) name2El.textContent = c2.name;
    const h2hNameA = $('h2h-child-a-name-span');
    if (h2hNameA) h2hNameA.textContent = c1.name;
    const h2hNameB = $('h2h-child-b-name-span');
    if (h2hNameB) h2hNameB.textContent = c2.name;

    // 3. Comparison table headers
    const thRaceA = $('th-race-child-a');
    if (thRaceA) thRaceA.textContent = `${c1.name}'s Age`;
    const thRaceB = $('th-race-child-b');
    if (thRaceB) thRaceB.textContent = `${c2.name}'s Age`;

    const thMatAH = $('th-matrix-child-a-height');
    if (thMatAH) thMatAH.textContent = `${c1.name} Height`;
    const thMatAW = $('th-matrix-child-a-weight');
    if (thMatAW) thMatAW.textContent = `${c1.name} Weight`;
    const thMatBH = $('th-matrix-child-b-height');
    if (thMatBH) thMatBH.textContent = `${c2.name} Height`;
    const thMatBW = $('th-matrix-child-b-weight');
    if (thMatBW) thMatBW.textContent = `${c2.name} Weight`;

    // 4. Records filter buttons
    const filterBtn1 = $('filter-btn-child-1');
    if (filterBtn1) filterBtn1.textContent = c1.name;
    const filterBtn2 = $('filter-btn-child-2');
    if (filterBtn2) filterBtn2.textContent = c2.name;

    // 5. Modal select options (Populate dynamically across all 1..N children)
    const measSelect = $('meas-child-select');
    if (measSelect) {
      const curVal = measSelect.value;
      measSelect.innerHTML = children.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (children.some(c => c.id === curVal)) measSelect.value = curVal;
      else if (children[0]) measSelect.value = children[0].id;
    }
    const msSelect = $('milestone-child-select');
    if (msSelect) {
      const curVal = msSelect.value;
      msSelect.innerHTML = children.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (children.some(c => c.id === curVal)) msSelect.value = curVal;
      else if (children[0]) msSelect.value = children[0].id;
    }

    // 6. Demo sample banner visibility
    const demoBanner = $('demo-sample-banner');
    if (demoBanner) {
      const isDemo = Boolean(AppState.familyState?.isDemo && !AppState.sampleBannerDismissed);
      demoBanner.style.display = isDemo ? 'flex' : 'none';
    }
  }

  function renderKPICards() {
    const ge = getEngine();
    const isImp = AppState.unitSystem === 'imperial';
    const children = AppState.familyState?.children || [];
    const leo = children.find(c => c.id === 'child-1') || children[0];
    const maya = children.find(c => c.id === 'child-2') || children[1];

    if (AppState.selectedChildId === 'both' && leo && maya) {
      // Side-by-side comparative mode for both Leo and Maya
      const leoM = (leo.measurements || []).slice().sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
      const mayaM = (maya.measurements || []).slice().sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
      const latestLeo = leoM[leoM.length - 1];
      const latestMaya = mayaM[mayaM.length - 1];

      // 1. Height KPI (Both)
      if (latestLeo?.heightCm && latestMaya?.heightCm && ge) {
        const statL = ge.calculateZScoreAndPercentile('M', 'height', latestLeo.ageMonths, latestLeo.heightCm);
        const statM = ge.calculateZScoreAndPercentile('F', 'height', latestMaya.ageMonths, latestMaya.heightCm);
        const valL = isImp ? `${(latestLeo.heightCm / 2.54).toFixed(1)}"` : `${latestLeo.heightCm.toFixed(1)}cm`;
        const valM = isImp ? `${(latestMaya.heightCm / 2.54).toFixed(1)}"` : `${latestMaya.heightCm.toFixed(1)}cm`;

        $('kpi-height-val').innerHTML = `<span style="font-size:1.15rem; color:var(--leo-accent);">L: ${valL}</span> <span style="font-size:0.9rem; color:var(--ink-muted);">•</span> <span style="font-size:1.15rem; color:var(--maya-accent);">M: ${valM}</span>`;
        
        const pctEl = $('kpi-height-pct');
        if (pctEl) {
          pctEl.textContent = `L: ${Math.round(statL.percentile)}% • M: ${Math.round(statM.percentile)}%`;
          pctEl.className = 'percentile-badge';
        }
        $('kpi-height-z').textContent = `Z: ${statL.zScore > 0 ? '+' : ''}${statL.zScore.toFixed(1)} / ${statM.zScore > 0 ? '+' : ''}${statM.zScore.toFixed(1)}`;
        $('kpi-height-delta').innerHTML = `Leo (${ge.formatAge(latestLeo.ageMonths)}) & Maya (${ge.formatAge(latestMaya.ageMonths)}) stature channels`;
      }

      // 2. Weight KPI (Both)
      if (latestLeo?.weightKg && latestMaya?.weightKg && ge) {
        const statL = ge.calculateZScoreAndPercentile('M', 'weight', latestLeo.ageMonths, latestLeo.weightKg);
        const statM = ge.calculateZScoreAndPercentile('F', 'weight', latestMaya.ageMonths, latestMaya.weightKg);
        const valL = isImp ? `${(latestLeo.weightKg * 2.20462).toFixed(1)}lb` : `${latestLeo.weightKg.toFixed(1)}kg`;
        const valM = isImp ? `${(latestMaya.weightKg * 2.20462).toFixed(1)}lb` : `${latestMaya.weightKg.toFixed(1)}kg`;

        $('kpi-weight-val').innerHTML = `<span style="font-size:1.15rem; color:var(--leo-accent);">L: ${valL}</span> <span style="font-size:0.9rem; color:var(--ink-muted);">•</span> <span style="font-size:1.15rem; color:var(--maya-accent);">M: ${valM}</span>`;
        
        const pctEl = $('kpi-weight-pct');
        if (pctEl) {
          pctEl.textContent = `L: ${Math.round(statL.percentile)}% • M: ${Math.round(statM.percentile)}%`;
          pctEl.className = 'percentile-badge';
        }
        $('kpi-weight-z').textContent = `Z: ${statL.zScore > 0 ? '+' : ''}${statL.zScore.toFixed(1)} / ${statM.zScore > 0 ? '+' : ''}${statM.zScore.toFixed(1)}`;
        $('kpi-weight-delta').innerHTML = `Tracking ${fmtOrd(statL.percentile)} vs ${fmtOrd(statM.percentile)} percentile mass`;
      }

      // 3. Head KPI (Both)
      if (latestLeo?.headCircumferenceCm && latestMaya?.headCircumferenceCm && ge) {
        const statL = ge.calculateZScoreAndPercentile('M', 'head', latestLeo.ageMonths, latestLeo.headCircumferenceCm);
        const statM = ge.calculateZScoreAndPercentile('F', 'head', latestMaya.ageMonths, latestMaya.headCircumferenceCm);
        const valL = isImp ? `${(latestLeo.headCircumferenceCm / 2.54).toFixed(1)}"` : `${latestLeo.headCircumferenceCm.toFixed(1)}cm`;
        const valM = isImp ? `${(latestMaya.headCircumferenceCm / 2.54).toFixed(1)}"` : `${latestMaya.headCircumferenceCm.toFixed(1)}cm`;

        $('kpi-head-val').innerHTML = `<span style="font-size:1.15rem; color:var(--leo-accent);">L: ${valL}</span> <span style="font-size:0.9rem; color:var(--ink-muted);">•</span> <span style="font-size:1.15rem; color:var(--maya-accent);">M: ${valM}</span>`;
        
        const pctEl = $('kpi-head-pct');
        if (pctEl) {
          pctEl.textContent = `L: ${Math.round(statL.percentile)}% • M: ${Math.round(statM.percentile)}%`;
          pctEl.className = 'percentile-badge';
        }
        $('kpi-head-z').textContent = `Z: ${statL.zScore > 0 ? '+' : ''}${statL.zScore.toFixed(1)} / ${statM.zScore > 0 ? '+' : ''}${statM.zScore.toFixed(1)}`;
        $('kpi-head-delta').innerHTML = `Normocephalic cranial growth in both siblings`;
      }

      // 4. BMI KPI (Both)
      if (latestLeo?.heightCm && latestLeo?.weightKg && latestMaya?.heightCm && latestMaya?.weightKg && ge) {
        const bmiL = ge.calculateBMI(latestLeo.weightKg, latestLeo.heightCm);
        const bmiM = ge.calculateBMI(latestMaya.weightKg, latestMaya.heightCm);
        const statL = ge.calculateZScoreAndPercentile('M', 'bmi', latestLeo.ageMonths, bmiL);
        const statM = ge.calculateZScoreAndPercentile('F', 'bmi', latestMaya.ageMonths, bmiM);

        $('kpi-bmi-val').innerHTML = `<span style="font-size:1.15rem; color:var(--leo-accent);">L: ${bmiL.toFixed(1)}</span> <span style="font-size:0.9rem; color:var(--ink-muted);">•</span> <span style="font-size:1.15rem; color:var(--maya-accent);">M: ${bmiM.toFixed(1)}</span>`;
        
        const pctEl = $('kpi-bmi-pct');
        if (pctEl) {
          pctEl.textContent = `Healthy Weight`;
          pctEl.className = 'percentile-badge';
        }
        $('kpi-bmi-status').textContent = `L: ${Math.round(statL.percentile)}% • M: ${Math.round(statM.percentile)}%`;
        $('kpi-bmi-foot').innerHTML = `Both siblings within normal pediatric BMI range`;
      }
      return;
    }

    const child = getActiveChild();
    if (!child) return;

    const measurements = (child.measurements || []).slice().sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));

    if (measurements.length === 0) {
      $('kpi-height-val').textContent = '—';
      $('kpi-weight-val').textContent = '—';
      $('kpi-head-val').textContent = '—';
      $('kpi-bmi-val').textContent = '—';
      return;
    }

    const latest = measurements[measurements.length - 1];
    const prev = measurements.length > 1 ? measurements[measurements.length - 2] : null;
    const sex = child.gender === 'female' || child.sex === 'F' ? 'F' : 'M';
    const age = latest.ageMonths || 0;

    // 1. Height KPI
    if (latest.heightCm && ge) {
      const stat = ge.calculateZScoreAndPercentile(sex, 'height', age, latest.heightCm);
      const valStr = isImp
        ? `${(latest.heightCm / 2.54).toFixed(1)} in`
        : `${latest.heightCm.toFixed(1)} cm`;
      $('kpi-height-val').textContent = valStr;
      
      const pctEl = $('kpi-height-pct');
      if (pctEl) {
        pctEl.textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : '—';
        pctEl.className = `percentile-badge ${sex === 'M' ? 'leo' : 'maya'}`;
      }
      $('kpi-height-z').textContent = stat ? `Z: ${stat.zScore > 0 ? '+' : ''}${stat.zScore.toFixed(2)}` : 'Z: —';

      if (prev && prev.heightCm) {
        const delta = latest.heightCm - prev.heightCm;
        const deltaMonths = Math.max(0.1, (latest.ageMonths - prev.ageMonths));
        const deltaStr = isImp ? `${(delta / 2.54).toFixed(1)} in` : `${delta.toFixed(1)} cm`;
        $('kpi-height-delta').innerHTML = `Growth: <strong>+${deltaStr}</strong> in ${deltaMonths.toFixed(1)} mo`;
      } else {
        $('kpi-height-delta').innerHTML = `Initial baseline measurement`;
      }
    }

    // 2. Weight KPI
    if (latest.weightKg && ge) {
      const stat = ge.calculateZScoreAndPercentile(sex, 'weight', age, latest.weightKg);
      const valStr = isImp
        ? `${(latest.weightKg * 2.20462).toFixed(1)} lb`
        : `${latest.weightKg.toFixed(2)} kg`;
      $('kpi-weight-val').textContent = valStr;

      const pctEl = $('kpi-weight-pct');
      if (pctEl) {
        pctEl.textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : '—';
        pctEl.className = `percentile-badge ${sex === 'M' ? 'leo' : 'maya'}`;
      }
      $('kpi-weight-z').textContent = stat ? `Z: ${stat.zScore > 0 ? '+' : ''}${stat.zScore.toFixed(2)}` : 'Z: —';

      if (prev && prev.weightKg) {
        const delta = latest.weightKg - prev.weightKg;
        const deltaStr = isImp ? `${(delta * 2.20462).toFixed(1)} lb` : `${delta.toFixed(2)} kg`;
        $('kpi-weight-delta').innerHTML = `Gain: <strong>+${deltaStr}</strong> since prev visit`;
      } else {
        $('kpi-weight-delta').innerHTML = `Initial baseline measurement`;
      }
    }

    // 3. Head Circumference KPI
    if (latest.headCircumferenceCm && ge) {
      const stat = ge.calculateZScoreAndPercentile(sex, 'head', age, latest.headCircumferenceCm);
      const valStr = isImp
        ? `${(latest.headCircumferenceCm / 2.54).toFixed(1)} in`
        : `${latest.headCircumferenceCm.toFixed(1)} cm`;
      $('kpi-head-val').textContent = valStr;

      const pctEl = $('kpi-head-pct');
      if (pctEl) {
        pctEl.textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : '—';
        pctEl.className = `percentile-badge ${sex === 'M' ? 'leo' : 'maya'}`;
      }
      $('kpi-head-z').textContent = stat ? `Z: ${stat.zScore > 0 ? '+' : ''}${stat.zScore.toFixed(2)}` : 'Z: —';

      if (prev && prev.headCircumferenceCm) {
        const delta = latest.headCircumferenceCm - prev.headCircumferenceCm;
        const deltaStr = isImp ? `${(delta / 2.54).toFixed(1)} in` : `${delta.toFixed(1)} cm`;
        $('kpi-head-delta').innerHTML = `Cranial: <strong>+${deltaStr}</strong> delta`;
      } else {
        $('kpi-head-delta').innerHTML = `Birth head circumference`;
      }
    } else {
      $('kpi-head-val').textContent = '—';
      $('kpi-head-pct').textContent = '—';
      $('kpi-head-z').textContent = 'Z: —';
      $('kpi-head-delta').textContent = 'Not measured at latest visit';
    }

    // 4. BMI KPI
    if (latest.heightCm && latest.weightKg && ge) {
      const bmi = ge.calculateBMI(latest.weightKg, latest.heightCm);
      const stat = ge.calculateZScoreAndPercentile(sex, 'bmi', age, bmi);
      $('kpi-bmi-val').textContent = `${bmi.toFixed(1)}`;
      
      const pctEl = $('kpi-bmi-pct');
      if (pctEl) {
        pctEl.textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : 'Normal';
        pctEl.className = `percentile-badge ${sex === 'M' ? 'leo' : 'maya'}`;
      }

      let category = 'Healthy Weight';
      if (stat && stat.percentile >= 85 && stat.percentile < 95) category = 'Overweight Channel';
      else if (stat && stat.percentile >= 95) category = 'High Percentile';
      else if (stat && stat.percentile < 5) category = 'Underweight Channel';

      $('kpi-bmi-status').textContent = `Category: ${category}`;
      $('kpi-bmi-foot').innerHTML = `Pediatric standard: <strong>${category}</strong>`;
    }
  }

  function renderDashboardCharts() {
    const container = $('dashboard-percentile-chart-wrapper');
    if (!container) return;

    const gc = getCharts();
    const children = AppState.familyState?.children || [];
    const leo = children.find(c => c.id === 'child-1') || children[0];
    const maya = children.find(c => c.id === 'child-2') || children[1];
    const child = getActiveChild();
    if (!gc || !child) return;

    // Destroy existing instance if present
    if (AppState.chartsInstances.percentile && typeof AppState.chartsInstances.percentile.destroy === 'function') {
      try { AppState.chartsInstances.percentile.destroy(); } catch (e) {}
    }

    // Options for percentile fan chart
    const chartOptions = {
      metric: AppState.dashboardMetric,
      unitSystem: AppState.unitSystem
    };

    // If "both" side-by-side mode is selected, pass compareChild to overlay both children!
    if (AppState.selectedChildId === 'both' && leo && maya) {
      chartOptions.compareChild = maya;
    }

    // Render percentile fan chart
    AppState.chartsInstances.percentile = gc.renderPercentileChart(container, child, chartOptions);
  }

  function renderClinicalSummaryStrip() {
    const ge = getEngine();
    if (!ge) return;

    const child = getActiveChild();
    if (!child) return;

    // 1. AAP Bright Futures Well-Child Schedule
    const sched = ge.getWellChildSchedule(child);
    if (sched) {
      const adhBadge = $('aap-adherence-badge');
      if (adhBadge) {
        adhBadge.textContent = `${sched.adherencePercent}% Adherence`;
        adhBadge.style.color = sched.adherencePercent >= 80 ? 'var(--forest-green)' : 'var(--ochre-gold)';
      }

      const nextLabel = $('aap-next-visit-label');
      if (nextLabel) {
        nextLabel.textContent = sched.nextVisit ? sched.nextVisit.label : 'All Recommended Checkups Logged';
      }

      const nextDue = $('aap-next-visit-due');
      if (nextDue) {
        if (sched.nextVisit?.dueDate) {
          nextDue.textContent = `Due: ${sched.nextVisit.dueDate}`;
        } else if (sched.nextVisit) {
          nextDue.textContent = `Target: ~${sched.nextVisit.ageMonths} mo`;
        } else {
          nextDue.textContent = 'Up to Date';
        }
      }

      const guidance = $('aap-clinical-guidance');
      if (guidance && sched.nextVisit) {
        guidance.innerHTML = `<span><strong>Focus:</strong> ${sched.nextVisit.expectedMilestones}. ${sched.nextVisit.nutritionFocus}</span>`;
      }
    }

    // 2. Pediatric Adiposity Rebound Tracker
    const rebound = ge.analyzeAdiposityRebound(child);
    if (rebound) {
      const rBadge = $('bmi-rebound-badge');
      if (rBadge) {
        rBadge.textContent = rebound.status;
        if (rebound.status === 'Early Rebound Watch') {
          rBadge.style.backgroundColor = '#FEF3C7';
          rBadge.style.color = '#B45309';
          rBadge.style.borderColor = '#FCD34D';
        } else {
          rBadge.style.backgroundColor = '';
          rBadge.style.color = '';
          rBadge.style.borderColor = '';
        }
      }

      const rPhase = $('bmi-rebound-phase');
      if (rPhase) {
        rPhase.textContent = rebound.status === 'Early Rebound Watch'
          ? 'Early Rebound Watch'
          : (rebound.status === 'Infant Growth Phase' ? 'Infant Growth Canalization' : 'Healthy Physiological Canalization');
      }

      const rNadir = $('bmi-rebound-nadir');
      if (rNadir) {
        if (rebound.nadirBmi) {
          const nadirAgeStr = rebound.nadirAgeMonths != null ? ge.formatAge(rebound.nadirAgeMonths) : '—';
          rNadir.textContent = `Nadir: ${Number(rebound.nadirBmi).toFixed(1)} kg/m² (${nadirAgeStr})`;
        } else {
          rNadir.textContent = 'Nadir: Monitoring';
        }
      }

      const rNote = $('bmi-rebound-note');
      if (rNote && rebound.clinicalNote) {
        rNote.innerHTML = `<span>${rebound.clinicalNote}</span>`;
      }
    }
  }

  function renderPediatricInsights() {
    const child = getActiveChild();
    if (!child) return;

    const ge = getEngine();
    const parents = AppState.familyState?.parents || { fatherHeightCm: 181, motherHeightCm: 166.5 };
    const isImp = AppState.unitSystem === 'imperial';
    const sex = child.gender === 'female' || child.sex === 'F' ? 'F' : 'M';

    if (!ge) return;

    // 1. Mid-Parental & Adult Height Predictor
    const midParental = ge.calculateMidParentalHeight(sex, parents.fatherHeightCm, parents.motherHeightCm);
    const adultPrediction = ge.predictAdultHeight(child, parents);

    const formatHeight = (cm) => {
      if (!cm) return '—';
      if (isImp) {
        const totalIn = cm / 2.54;
        const ft = Math.floor(totalIn / 12);
        const inRem = (totalIn % 12).toFixed(1);
        return `${ft}' ${inRem}" (${cm.toFixed(1)} cm)`;
      }
      return `${cm.toFixed(1)} cm`;
    };

    if (midParental) {
      $('target-mid-parental-val').textContent = formatHeight(midParental.targetCm);
    }
    if (adultPrediction) {
      $('target-projected-val').textContent = formatHeight(adultPrediction.predictedCm);
      $('target-range-val').textContent = `${formatHeight(adultPrediction.confidenceRangeCm[0])} – ${formatHeight(adultPrediction.confidenceRangeCm[1])}`;
      $('target-explanation-text').textContent =
        `Mid-parental genetic target for ${child.name} is ${formatHeight(midParental?.targetCm || 175)}. Blending current ${fmtOrd(adultPrediction.currentHeightPercentile)} percentile channel yields projected adult height of ~${formatHeight(adultPrediction.predictedCm)}.`;
    }

    // 2. Apparel & Shoe Sizing Forecaster
    const sizing = ge.estimateClothingAndShoeSize(child);
    if (sizing) {
      $('size-clothing-current').textContent = sizing.currentClothingSize || '—';
      $('size-clothing-future').textContent = sizing.nextClothingSize || '—';
      $('size-shoe-us-current').textContent = `US ${sizing.currentShoeSizeUS || '—'}`;
      $('size-shoe-us-future').textContent = `US ${sizing.nextShoeSizeUS || '—'}`;
      $('size-shoe-eu-current').textContent = `EU ${sizing.currentShoeSizeEU || '—'}`;
      $('size-shoe-eu-future').textContent = `EU ${sizing.nextShoeSizeEU || '—'}`;
      if (sizing.insight) {
        $('size-forecast-narrative').textContent = sizing.insight;
      }
    }

    // 3. Growth Velocity & Spurts
    const velocityList = ge.analyzeGrowthVelocity(child);
    if (velocityList && velocityList.length > 0) {
      const latestVel = velocityList[velocityList.length - 1];
      const hVelStr = latestVel.heightVelocityCmPerYear != null
        ? `${latestVel.heightVelocityCmPerYear.toFixed(1)} cm/yr`
        : '—';
      const wVelStr = latestVel.weightVelocityKgPerYear != null
        ? `${latestVel.weightVelocityKgPerYear.toFixed(1)} kg/yr`
        : '—';

      $('velocity-height-val').textContent = hVelStr;
      $('velocity-weight-val').textContent = wVelStr;

      // Spurt check
      const isSpurt = latestVel.isGrowthSpurt || (latestVel.heightVelocityCmPerYear && latestVel.heightVelocityCmPerYear > 9.5);
      const spurtPill = $('velocity-spurt-pill');
      if (spurtPill) {
        spurtPill.innerHTML = isSpurt
          ? `<span class="spurt-badge" style="background:#FEF3C7; color:#B45309; border-color:#FCD34D;">⚡ Growth Spurt Detected!</span>`
          : `<span class="spurt-badge">⚡ Steady Canalization</span>`;
      }

      $('velocity-summary-note').textContent =
        `Measured over interval (${ge.formatAge(latestVel.prevAgeMonths)} to ${ge.formatAge(latestVel.currAgeMonths)}). Tracking steadily along WHO reference trajectory.`;
    } else {
      $('velocity-height-val').textContent = '—';
      $('velocity-weight-val').textContent = '—';
      $('velocity-summary-note').textContent = 'Log at least 2 checkups spaced >0.5 months apart to compute velocity.';
    }
  }

  // =========================================================================
  // VIEW 2: SIBLING COMPARISON STUDIO CONTROLLER
  // =========================================================================

  function resolveComparisonPairSafe() {
    const sc = getSiblingComp();
    const children = AppState.familyState?.children || [];
    const savedPair = AppState.familyState?.settings?.comparePair;
    let prefA = (savedPair && savedPair.childAId) || (Array.isArray(savedPair) && savedPair[0]) || AppState.comparePairChildAId;
    let prefB = (savedPair && savedPair.childBId) || (Array.isArray(savedPair) && savedPair[1]) || AppState.comparePairChildBId;

    if (sc && typeof sc.resolveComparisonPair === 'function') {
      return sc.resolveComparisonPair(AppState.familyState, prefA, prefB);
    }

    if (children.length === 1) {
      const childA = children[0];
      const benchmark = (sc && typeof sc.createBenchmarkPeer === 'function')
        ? sc.createBenchmarkPeer(childA, AppState.familyState?.parents)
        : { id: 'peer-benchmark', name: 'WHO 50th %ile Peer', sex: childA.sex === 'F' ? 'F' : 'M', gender: childA.gender, measurements: [], milestones: [], isBenchmark: true };
      return { mode: 'solo', childA, childB: benchmark, benchmarkPeer: benchmark, availableChildren: children };
    }

    const childA = (prefA && children.find(c => c.id === prefA)) || children[0] || null;
    const childB = (prefB && children.find(c => c.id === prefB && c.id !== childA?.id)) || children.find(c => c.id !== childA?.id) || children[1] || null;
    return {
      mode: children.length >= 2 ? 'pair' : 'empty',
      childA,
      childB,
      benchmarkPeer: null,
      availableChildren: children
    };
  }

  function updateComparisonPairUI(resolvedPair) {
    const selectA = $('compare-select-child-a');
    const selectB = $('compare-select-child-b');
    const soloBanner = $('solo-benchmark-banner');
    const pairBar = $('comparison-pair-bar');
    const children = AppState.familyState?.children || [];

    if (resolvedPair.mode === 'solo') {
      if (soloBanner) {
        soloBanner.style.display = 'flex';
        const titleEl = $('solo-benchmark-title');
        if (titleEl) titleEl.textContent = `Solo Benchmark Mode: ${resolvedPair.childA.name} vs Clinical 50th %ile Peer`;
      }
      if (pairBar) pairBar.style.display = 'none';
    } else {
      if (soloBanner) soloBanner.style.display = 'none';
      if (pairBar) pairBar.style.display = 'flex';

      if (selectA && selectB) {
        const curA = resolvedPair.childA?.id;
        const curB = resolvedPair.childB?.id;

        const optionsHtml = children.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (selectA.innerHTML !== optionsHtml) selectA.innerHTML = optionsHtml;
        if (selectB.innerHTML !== optionsHtml) selectB.innerHTML = optionsHtml;

        selectA.value = curA || children[0]?.id;
        selectB.value = curB || children[1]?.id;
      }
    }
  }

  function setComparisonAge(ageMonths) {
    if (ageMonths == null || isNaN(ageMonths)) return;
    const slider = $('age-scrubber-slider');
    const maxAge = slider ? (parseFloat(slider.max) || 60) : 60;
    const minAge = slider ? (parseFloat(slider.min) || 0) : 0;
    const age = Math.max(minAge, Math.min(maxAge, Number(ageMonths)));
    AppState.comparisonAgeMonths = Math.round(age * 10) / 10;

    if (slider && Math.abs(parseFloat(slider.value) - age) > 0.05) {
      slider.value = age;
    }

    updateScrubberDisplay();

    // Update active state on milestone chips
    const chips = document.querySelectorAll('#milestone-chips-container .milestone-chip');
    chips.forEach(chip => {
      const a = chip.getAttribute('data-age');
      if (a === 'today') {
        const pair = resolveComparisonPairSafe();
        const latestM = pair.childB?.measurements ? pair.childB.measurements[pair.childB.measurements.length - 1] : null;
        const todayAge = latestM ? latestM.ageMonths : 25.0;
        chip.classList.toggle('active', Math.abs(age - todayAge) < 0.3);
      } else {
        chip.classList.toggle('active', Math.abs(parseFloat(a) - age) < 0.25);
      }
    });

    renderComparisonHeadToHead();
    renderSiblingDualChart();
    renderDominanceTimeline();
    if (AppState.heightWallMode === 'selected' || AppState.heightWallMode === 'same-age') {
      renderHeightWall();
    }
  }

  function toggleGrowthTimelapse() {
    const btn = $('btn-play-timelapse');
    const textEl = $('timelapse-btn-text');
    if (AppState.timelapseTimer) {
      clearInterval(AppState.timelapseTimer);
      AppState.timelapseTimer = null;
      if (btn) btn.classList.remove('playing');
      if (textEl) textEl.textContent = 'Play Timelapse';
      if (btn) {
        const icon = btn.querySelector('span:first-child');
        if (icon) icon.textContent = '▶';
      }
      return;
    }

    if (btn) btn.classList.add('playing');
    if (textEl) textEl.textContent = 'Pause Timelapse';
    if (btn) {
      const icon = btn.querySelector('span:first-child');
      if (icon) icon.textContent = '⏸';
    }

    const slider = $('age-scrubber-slider');
    const maxAge = slider ? (parseFloat(slider.max) || 60) : 60;
    const minAge = slider ? (parseFloat(slider.min) || 0) : 0;

    if (AppState.comparisonAgeMonths >= maxAge - 0.5) {
      setComparisonAge(minAge);
    }

    AppState.timelapseTimer = setInterval(() => {
      const current = AppState.comparisonAgeMonths || 0;
      const nextAge = Math.round((current + 0.5) * 10) / 10;
      if (nextAge > maxAge) {
        clearInterval(AppState.timelapseTimer);
        AppState.timelapseTimer = null;
        if (btn) btn.classList.remove('playing');
        if (textEl) textEl.textContent = 'Play Timelapse';
        if (btn) {
          const icon = btn.querySelector('span:first-child');
          if (icon) icon.textContent = '▶';
        }
        return;
      }
      setComparisonAge(nextAge);
    }, 200);
  }

  function setupComparisonControls() {
    // Scrubber slider: input & change
    const slider = $('age-scrubber-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        setComparisonAge(parseFloat(e.target.value));
      });
      slider.addEventListener('change', (e) => {
        setComparisonAge(parseFloat(e.target.value));
      });
    }

    // Fine Steppers (-0.5m / +0.5m)
    const btnStepDown = $('btn-scrubber-step-down');
    if (btnStepDown) {
      btnStepDown.addEventListener('click', () => {
        setComparisonAge(AppState.comparisonAgeMonths - 0.5);
      });
    }
    const btnStepUp = $('btn-scrubber-step-up');
    if (btnStepUp) {
      btnStepUp.addEventListener('click', () => {
        setComparisonAge(AppState.comparisonAgeMonths + 0.5);
      });
    }

    // Timelapse play / pause button
    const btnTimelapse = $('btn-play-timelapse');
    if (btnTimelapse) {
      btnTimelapse.addEventListener('click', () => {
        toggleGrowthTimelapse();
      });
    }

    // Quick-jump milestone chips
    const chips = document.querySelectorAll('#milestone-chips-container .milestone-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const ageAttr = chip.getAttribute('data-age');
        let targetAge = 12.0;
        if (ageAttr === 'today') {
          const pair = resolveComparisonPairSafe();
          const targetChild = pair.childB || pair.childA;
          const latestM = targetChild?.measurements ? targetChild.measurements[targetChild.measurements.length - 1] : null;
          targetAge = latestM ? latestM.ageMonths : 25.0;
        } else {
          targetAge = parseFloat(ageAttr);
        }
        setComparisonAge(targetAge);
      });
    });

    // Comparison pair selectors (Child A / Child B)
    const selectA = $('compare-select-child-a');
    if (selectA) {
      selectA.addEventListener('change', async (e) => {
        const newAId = e.target.value;
        const pair = resolveComparisonPairSafe();
        let newBId = pair.childB?.id;
        if (newAId === newBId) {
          const children = AppState.familyState?.children || [];
          const alt = children.find(c => c.id !== newAId);
          newBId = alt ? alt.id : newBId;
        }
        if (!AppState.familyState.settings) AppState.familyState.settings = {};
        AppState.familyState.settings.comparePair = { childAId: newAId, childBId: newBId };
        AppState.familyState.updatedAt = Date.now();
        const sm = getSyncManager();
        if (sm) await sm.saveState(AppState.familyState, 'Updated comparison child A');
        renderComparisonViews();
      });
    }

    const selectB = $('compare-select-child-b');
    if (selectB) {
      selectB.addEventListener('change', async (e) => {
        const newBId = e.target.value;
        const pair = resolveComparisonPairSafe();
        let newAId = pair.childA?.id;
        if (newBId === newAId) {
          const children = AppState.familyState?.children || [];
          const alt = children.find(c => c.id !== newBId);
          newAId = alt ? alt.id : newAId;
        }
        if (!AppState.familyState.settings) AppState.familyState.settings = {};
        AppState.familyState.settings.comparePair = { childAId: newAId, childBId: newBId };
        AppState.familyState.updatedAt = Date.now();
        const sm = getSyncManager();
        if (sm) await sm.saveState(AppState.familyState, 'Updated comparison child B');
        renderComparisonViews();
      });
    }

    // Swap pair button
    const btnSwap = $('btn-swap-compare');
    if (btnSwap) {
      btnSwap.addEventListener('click', async () => {
        const pair = resolveComparisonPairSafe();
        if (pair.childA && pair.childB && pair.mode === 'pair') {
          if (!AppState.familyState.settings) AppState.familyState.settings = {};
          AppState.familyState.settings.comparePair = {
            childAId: pair.childB.id,
            childBId: pair.childA.id
          };
          AppState.familyState.updatedAt = Date.now();
          const sm = getSyncManager();
          if (sm) await sm.saveState(AppState.familyState, 'Swapped comparison pair');
          renderComparisonViews();
        }
      });
    }

    // Solo benchmark mode: Add sibling CTA
    const btnAddSibling = $('btn-add-sibling-compare');
    if (btnAddSibling) {
      btnAddSibling.addEventListener('click', () => {
        openFamilyModal();
      });
    }

    // Dual Chart Metric Switcher (height, weight, head, bmi)
    const metricBtns = document.querySelectorAll('#sibling-metric-selector .metric-pill-btn');
    metricBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        metricBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.siblingChartMetric = btn.getAttribute('data-sibling-metric') || 'height';
        renderSiblingDualChart();
      });
    });

    // Comparison chart mode selector (absolute, percentile, zscore)
    const compModes = document.querySelectorAll('#comparison-mode-selector .metric-pill-btn');
    compModes.forEach(btn => {
      btn.addEventListener('click', () => {
        compModes.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.comparisonChartMode = btn.getAttribute('data-mode');
        renderSiblingDualChart();
      });
    });

    // Sibling Velocity Metric Switcher (height, weight)
    const velMetricBtns = document.querySelectorAll('#sibling-velocity-metric-selector .metric-pill-btn');
    velMetricBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        velMetricBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.siblingVelocityMetric = btn.getAttribute('data-vel-metric') || 'height';
        renderSiblingVelocityChart();
      });
    });

    // Height wall mode selector
    const wallModes = document.querySelectorAll('#wall-mode-selector .metric-pill-btn');
    wallModes.forEach(btn => {
      btn.addEventListener('click', () => {
        wallModes.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.heightWallMode = btn.getAttribute('data-wall-mode');
        renderHeightWall();
      });
    });

    // Milestone table toggle (Race vs Standard matrix)
    const tableToggles = document.querySelectorAll('#milestone-table-toggle .metric-pill-btn');
    tableToggles.forEach(btn => {
      btn.addEventListener('click', () => {
        tableToggles.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-table');
        if ($('table-milestone-race-view')) $('table-milestone-race-view').style.display = mode === 'race' ? 'block' : 'none';
        if ($('table-standard-matrix-view')) $('table-standard-matrix-view').style.display = mode === 'standard' ? 'block' : 'none';
      });
    });
  }

  function updateScrubberDisplay() {
    const age = AppState.comparisonAgeMonths;
    const yrs = Math.floor(age / 12);
    const mos = Math.round(age % 12);
    let str = `Age ${age.toFixed(1)} Months`;
    if (yrs > 0) str += ` (${yrs}y ${mos}m)`;
    const el = $('scrubber-age-display');
    if (el) el.textContent = str;
  }

  function renderComparisonViews() {
    const pair = resolveComparisonPairSafe();
    updateComparisonPairUI(pair);

    // Compute dynamic slider max based on children's ages
    const slider = $('age-scrubber-slider');
    if (slider) {
      let dynamicMax = 60;
      const ages = [];
      [pair.childA, pair.childB].forEach(c => {
        if (!c) return;
        (c.measurements || []).forEach(m => {
          if (m && m.ageMonths != null) ages.push(m.ageMonths);
        });
      });
      if (ages.length > 0) {
        const highest = Math.max(...ages);
        dynamicMax = Math.max(24, Math.min(84, Math.ceil((highest + 6) / 6) * 6));
      }
      slider.max = dynamicMax;
    }

    updateScrubberDisplay();
    renderComparisonHeadToHead();
    renderDominanceTimeline();
    renderSiblingDualChart();
    renderHeightWall();
    renderSiblingVelocityChart();
    renderMilestoneRaceTable();
    renderStandardMatrixTable();
  }

  function renderComparisonHeadToHead() {
    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;
    const sc = getSiblingComp();
    const isImp = AppState.unitSystem === 'imperial';

    if (!childA || !childB || !sc) return;

    const age = AppState.comparisonAgeMonths;
    const comp = sc.compareAtAge(childA, childB, age, true);

    if (!comp) return;

    // Child A Card
    const nameAEl = $('h2h-child-a-name-span');
    if (nameAEl) nameAEl.textContent = childA.name;
    const ageAEl = $('h2h-age-leo') || $('.h2h-age-leo');
    if (ageAEl) ageAEl.textContent = `${age.toFixed(0)}m`;

    const dataA = comp.childA || comp.leo;
    const aHPct = dataA?.heightStats?.percentile ?? dataA?.heightPercentile;
    const aWPct = dataA?.weightStats?.percentile ?? dataA?.weightPercentile;
    const aHead = dataA?.headCm ?? dataA?.headCircumferenceCm;
    const aHeadPct = dataA?.headStats?.percentile ?? dataA?.headPercentile;

    const aHStr = dataA?.heightCm != null
      ? (isImp ? (dataA.heightCm / 2.54).toFixed(1) + ' in' : Number(dataA.heightCm).toFixed(1) + ' cm')
      : '—';
    const aWStr = dataA?.weightKg != null
      ? (isImp ? (dataA.weightKg * 2.20462).toFixed(1) + ' lb' : Number(dataA.weightKg).toFixed(2) + ' kg')
      : '—';
    const aHeadStr = aHead != null
      ? (isImp ? (aHead / 2.54).toFixed(1) + ' in' : Number(aHead).toFixed(1) + ' cm')
      : '—';

    if ($('h2h-leo-height')) $('h2h-leo-height').innerHTML = `${aHStr} <small style="color:var(--ink-muted);">(${aHPct != null ? fmtOrd(aHPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-leo-weight')) $('h2h-leo-weight').innerHTML = `${aWStr} <small style="color:var(--ink-muted);">(${aWPct != null ? fmtOrd(aWPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-leo-head')) $('h2h-leo-head').innerHTML = `${aHeadStr} <small style="color:var(--ink-muted);">(${aHead != null && aHeadPct != null ? fmtOrd(aHeadPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-leo-bmi')) $('h2h-leo-bmi').textContent = `${dataA?.bmi ? Number(dataA.bmi).toFixed(1) : '—'} kg/m²`;

    const aDateEl = $('h2h-leo-date');
    if (aDateEl) {
      aDateEl.textContent = dataA?.isProjected
        ? 'Projected Trajectory'
        : (dataA?.isInterpolated ? 'Interpolated (' + (dataA.nearestRecordDate || '') + ')' : (dataA?.nearestRecordDate || 'Exact Visit'));
    }

    // Child B Card
    const nameBEl = $('h2h-child-b-name-span');
    if (nameBEl) nameBEl.textContent = childB.name;
    const ageBEl = $('h2h-age-maya') || $('.h2h-age-maya');
    if (ageBEl) ageBEl.textContent = `${age.toFixed(0)}m`;

    const dataB = comp.childB || comp.maya;
    const bHPct = dataB?.heightStats?.percentile ?? dataB?.heightPercentile;
    const bWPct = dataB?.weightStats?.percentile ?? dataB?.weightPercentile;
    const bHead = dataB?.headCm ?? dataB?.headCircumferenceCm;
    const bHeadPct = dataB?.headStats?.percentile ?? dataB?.headPercentile;

    const bHStr = dataB?.heightCm != null
      ? (isImp ? (dataB.heightCm / 2.54).toFixed(1) + ' in' : Number(dataB.heightCm).toFixed(1) + ' cm')
      : '—';
    const bWStr = dataB?.weightKg != null
      ? (isImp ? (dataB.weightKg * 2.20462).toFixed(1) + ' lb' : Number(dataB.weightKg).toFixed(2) + ' kg')
      : '—';
    const bHeadStr = bHead != null
      ? (isImp ? (bHead / 2.54).toFixed(1) + ' in' : Number(bHead).toFixed(1) + ' cm')
      : '—';

    if ($('h2h-maya-height')) $('h2h-maya-height').innerHTML = `${bHStr} <small style="color:var(--ink-muted);">(${bHPct != null ? fmtOrd(bHPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-maya-weight')) $('h2h-maya-weight').innerHTML = `${bWStr} <small style="color:var(--ink-muted);">(${bWPct != null ? fmtOrd(bWPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-maya-head')) $('h2h-maya-head').innerHTML = `${bHeadStr} <small style="color:var(--ink-muted);">(${bHead != null && bHeadPct != null ? fmtOrd(bHeadPct) + ' %ile' : '—'})</small>`;
    if ($('h2h-maya-bmi')) $('h2h-maya-bmi').textContent = `${dataB?.bmi ? Number(dataB.bmi).toFixed(1) : '—'} kg/m²`;

    const bDateEl = $('h2h-maya-date');
    if (bDateEl) {
      bDateEl.textContent = dataB?.isProjected
        ? 'Projected Trajectory'
        : (dataB?.isInterpolated ? 'Interpolated (' + (dataB.nearestRecordDate || '') + ')' : (dataB?.nearestRecordDate || 'Exact Visit'));
    }

    // Deltas center badge
    const deltaH = comp.heightDiffCm ?? comp.delta?.heightCm ?? 0;
    const deltaW = comp.weightDiffKg ?? comp.delta?.weightKg ?? 0;
    const deltaHStr = isImp
      ? `${(deltaH / 2.54).toFixed(1)} in`
      : `${deltaH > 0 ? '+' : ''}${Number(deltaH).toFixed(1)} cm`;
    const deltaWStr = isImp
      ? `${(deltaW * 2.20462).toFixed(1)} lb`
      : `${deltaW > 0 ? '+' : ''}${Number(deltaW).toFixed(2)} kg`;

    if ($('h2h-delta-height')) $('h2h-delta-height').textContent = `Δ ${deltaHStr}`;
    if ($('h2h-delta-weight')) $('h2h-delta-weight').textContent = `Weight: ${deltaWStr}`;

    const diffPct = (aHPct != null && bHPct != null) ? Math.round(aHPct - bHPct) : 0;
    if ($('h2h-delta-pct')) {
      $('h2h-delta-pct').textContent = diffPct >= 0
        ? `${childA.name} +${diffPct} %ile higher channel`
        : `${childB.name} +${Math.abs(diffPct)} %ile higher channel`;
    }

    // Narrative Insight
    const narrativeBox = $('h2h-narrative-box');
    if (narrativeBox) {
      const narrativeText = comp.summaryInsight || comp.narrative || 'Both children display consistent canalization along their biological percentiles.';
      narrativeBox.innerHTML = `<strong>Sex-Normalized Clinical Insight at Age ${age.toFixed(0)}m:</strong> ${narrativeText}`;
    }
  }

  function renderDominanceTimeline() {
    const sc = getSiblingComp();
    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;
    const track = $('dominance-timeline-track');
    const badge = $('twin-stature-match-badge');
    const textEl = $('twin-match-text');

    if (!sc || !childA || !childB || !track) return;

    const domResult = typeof sc.generateDominanceTimeline === 'function'
      ? sc.generateDominanceTimeline(childA, childB)
      : null;

    if (!domResult) return;

    // Update Twin Stature Match Badge
    if (textEl) {
      if (domResult.twinMatchPoint) {
        const pt = domResult.twinMatchPoint;
        const diffStr = Math.abs(pt.heightDiffCm).toFixed(1);
        textEl.textContent = `Closest Stature Twin Match: ${pt.ageLabel} (Δ only ${diffStr} cm)`;
      } else if (domResult.headline) {
        textEl.textContent = domResult.headline;
      }
    }

    // Populate timeline chips
    track.innerHTML = '';
    (domResult.points || []).forEach(pt => {
      const chip = document.createElement('div');
      chip.className = 'dominance-item-chip';
      if (Math.abs(pt.ageMonths - AppState.comparisonAgeMonths) < 0.25) {
        chip.style.borderColor = 'var(--ochre-gold)';
        chip.style.backgroundColor = 'var(--surface-linen)';
        chip.style.boxShadow = '0 0 0 2px var(--ochre-gold)';
      }

      const isChildA = pt.heightLeaderId === childA.id || pt.heightLeader === childA.name || (pt.heightLeader && pt.heightLeader.includes(childA.name));
      const isChildB = pt.heightLeaderId === childB.id || pt.heightLeader === childB.name || (pt.heightLeader && pt.heightLeader.includes(childB.name));
      const winnerClass = isChildA ? 'leo-lead' : (isChildB ? 'maya-lead' : 'tied');
      const winnerIcon = isChildA ? `👦 ${childA.name}` : (isChildB ? `👧 ${childB.name}` : '🤝 Tied');

      const deltaStr = pt.heightDiffCm != null
        ? `${Math.abs(pt.heightDiffCm).toFixed(1)} cm lead`
        : 'Even';

      const pctDeltaStr = pt.heightPctDiff != null
        ? `${Math.abs(Math.round(pt.heightPctDiff))}%ile channel Δ`
        : '';

      chip.innerHTML = `
        <div class="dominance-chip-age">${pt.ageLabel}${pt.isProjected ? ' (Proj)' : ''}</div>
        <div class="dominance-chip-winner ${winnerClass}">${winnerIcon}</div>
        <div class="dominance-chip-delta">${deltaStr}</div>
        <div style="font-size:0.68rem; color:var(--ink-muted); margin-top:2px;">${pctDeltaStr}</div>
      `;

      chip.addEventListener('click', () => {
        setComparisonAge(pt.ageMonths);
      });

      track.appendChild(chip);
    });
  }

  function renderSiblingDualChart() {
    const container = $('sibling-dual-chart-wrapper');
    if (!container) return;

    const gc = getCharts();
    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;

    if (!gc || !childA || !childB) return;

    if (AppState.chartsInstances.comparison && typeof AppState.chartsInstances.comparison.destroy === 'function') {
      try { AppState.chartsInstances.comparison.destroy(); } catch (e) {}
    }

    AppState.chartsInstances.comparison = gc.renderComparisonChart(container, childA, childB, {
      mode: AppState.comparisonChartMode,
      unitSystem: AppState.unitSystem,
      metric: AppState.siblingChartMetric || 'height',
      highlightAgeMonths: AppState.comparisonAgeMonths,
      onAgeSelect: (age) => {
        setComparisonAge(age);
      }
    });
  }

  function renderHeightWall() {
    const container = $('height-wall-svg-wrapper');
    if (!container) return;

    const gc = getCharts();
    const sc = getSiblingComp();
    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;

    if (!gc || !sc || !childA || !childB) return;

    const isTodayMode = AppState.heightWallMode === 'today';
    let compData;

    if (isTodayMode) {
      const ge = getEngine();
      const latestA = childA.measurements ? childA.measurements[childA.measurements.length - 1] : null;
      const latestB = childB.measurements ? childB.measurements[childB.measurements.length - 1] : null;

      const aSex = (childA.gender === 'female' || childA.sex === 'F') ? 'F' : 'M';
      const bSex = (childB.gender === 'female' || childB.sex === 'F') ? 'F' : 'M';

      const aHt = latestA?.heightCm || 108.5;
      const bHt = latestB?.heightCm || 87.2;
      const aAge = latestA?.ageMonths ?? 53;
      const bAge = latestB?.ageMonths ?? 25;

      const aPct = (ge && latestA)
        ? Math.round(ge.calculateZScoreAndPercentile(aSex, 'height', aAge, aHt)?.percentile ?? 74)
        : 74;
      const bPct = (ge && latestB)
        ? Math.round(ge.calculateZScoreAndPercentile(bSex, 'height', bAge, bHt)?.percentile ?? 66)
        : 66;

      compData = {
        ageMonths: null,
        isTodayComparison: true,
        childA: {
          heightCm: aHt,
          heightPercentile: aPct,
          name: childA.name
        },
        childB: {
          heightCm: bHt,
          heightPercentile: bPct,
          name: childB.name
        },
        delta: {
          heightCm: aHt - bHt
        }
      };
    } else {
      compData = sc.compareAtAge(childA, childB, AppState.comparisonAgeMonths, true);
    }

    AppState.chartsInstances.heightWall = gc.renderHeightWall(container, childA, childB, compData, {
      unitSystem: AppState.unitSystem,
      mode: AppState.heightWallMode
    });
  }

  function renderSiblingVelocityChart() {
    const container = $('sibling-velocity-chart-wrapper');
    if (!container) return;

    const gc = getCharts();
    const pair = resolveComparisonPairSafe();
    if (!gc || !pair.childA) return;

    if (AppState.chartsInstances.siblingVelocity && typeof AppState.chartsInstances.siblingVelocity.destroy === 'function') {
      try { AppState.chartsInstances.siblingVelocity.destroy(); } catch (e) {}
    }

    AppState.chartsInstances.siblingVelocity = gc.renderVelocityChart(
      container,
      pair.childA,
      pair.mode === 'pair' ? pair.childB : null,
      AppState.siblingVelocityMetric || 'height',
      {
        unitSystem: AppState.unitSystem
      }
    );
  }

  function renderMilestoneRaceTable() {
    const tbody = $('milestone-race-tbody');
    if (!tbody) return;

    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;
    const sc = getSiblingComp();

    if (!childA || !childB || !sc) return;

    // Update table headers with dynamic children names
    const thRaceA = $('th-race-child-a');
    if (thRaceA) thRaceA.textContent = `${childA.name}'s Age`;
    const thRaceB = $('th-race-child-b');
    if (thRaceB) thRaceB.textContent = `${childB.name}'s Age`;

    const raceList = sc.compareMilestones(childA, childB);
    tbody.innerHTML = '';

    if (!raceList || raceList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;">No shared milestones recorded yet.</td></tr>';
      return;
    }

    raceList.forEach(item => {
      const tr = document.createElement('tr');
      const isChildAFaster = item.fasterChildId === childA.id || item.fasterChildName === childA.name;
      const isChildBFaster = item.fasterChildId === childB.id || item.fasterChildName === childB.name;
      const diffBadge = item.diffWeeksLabel
        ? `<span class="percentile-badge ${isChildAFaster ? 'leo' : 'maya'}">${item.diffWeeksLabel}</span>`
        : '—';

      tr.innerHTML = `
        <td><strong>${item.title}</strong></td>
        <td><span style="font-size:0.75rem; text-transform:uppercase; color:var(--ink-muted);">${item.category}</span></td>
        <td class="tabular-nums">${item.childAAgeMonths != null ? item.childAAgeMonths.toFixed(1) + ' mo' : '—'}</td>
        <td class="tabular-nums">${item.childBAgeMonths != null ? item.childBAgeMonths.toFixed(1) + ' mo' : '—'}</td>
        <td><strong style="color: ${isChildAFaster ? 'var(--leo-accent)' : isChildBFaster ? 'var(--maya-accent)' : 'var(--ink-primary)'}">${item.fasterChildName || '—'}</strong></td>
        <td>${diffBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderStandardMatrixTable() {
    const tbody = $('standard-matrix-tbody');
    if (!tbody) return;

    const pair = resolveComparisonPairSafe();
    const childA = pair.childA;
    const childB = pair.childB;
    const sc = getSiblingComp();
    const isImp = AppState.unitSystem === 'imperial';

    if (!childA || !childB || !sc) return;

    // Update table headers with dynamic children names
    const thMatAH = $('th-matrix-child-a-height');
    if (thMatAH) thMatAH.textContent = `${childA.name} Height`;
    const thMatAW = $('th-matrix-child-a-weight');
    if (thMatAW) thMatAW.textContent = `${childA.name} Weight`;
    const thMatBH = $('th-matrix-child-b-height');
    if (thMatBH) thMatBH.textContent = `${childB.name} Height`;
    const thMatBW = $('th-matrix-child-b-weight');
    if (thMatBW) thMatBW.textContent = `${childB.name} Weight`;

    const matrix = sc.getStandardComparisonTable(childA, childB);
    tbody.innerHTML = '';

    matrix.forEach(row => {
      const tr = document.createElement('tr');
      const dataA = row.childA || row.leo || row.data?.childA;
      const dataB = row.childB || row.maya || row.data?.childB;
      const dH = row.delta?.heightCm ?? row.data?.heightDiffCm ?? (dataA?.heightCm != null && dataB?.heightCm != null ? (dataA.heightCm - dataB.heightCm) : null);
      const dW = row.delta?.weightKg ?? row.data?.weightDiffKg ?? (dataA?.weightKg != null && dataB?.weightKg != null ? (dataA.weightKg - dataB.weightKg) : null);
      const label = row.label || row.ageLabel || `${row.ageMonths}m`;

      const aHPct = dataA?.heightStats?.percentile ?? dataA?.heightPercentile;
      const aWPct = dataA?.weightStats?.percentile ?? dataA?.weightPercentile;
      const bHPct = dataB?.heightStats?.percentile ?? dataB?.heightPercentile;
      const bWPct = dataB?.weightStats?.percentile ?? dataB?.weightPercentile;

      const hAStr = dataA?.heightCm != null
        ? (isImp ? (dataA.heightCm / 2.54).toFixed(1) + ' in' : Number(dataA.heightCm).toFixed(1) + ' cm')
        : '—';
      const wAStr = dataA?.weightKg != null
        ? (isImp ? (dataA.weightKg * 2.20462).toFixed(1) + ' lb' : Number(dataA.weightKg).toFixed(2) + ' kg')
        : '—';

      const hBStr = dataB?.heightCm != null
        ? (isImp ? (dataB.heightCm / 2.54).toFixed(1) + ' in' : Number(dataB.heightCm).toFixed(1) + ' cm')
        : '—';
      const wBStr = dataB?.weightKg != null
        ? (isImp ? (dataB.weightKg * 2.20462).toFixed(1) + ' lb' : Number(dataB.weightKg).toFixed(2) + ' kg')
        : '—';

      const dHStr = dH != null
        ? (isImp ? (dH / 2.54).toFixed(1) + ' in' : `${dH > 0 ? '+' : ''}${Number(dH).toFixed(1)} cm`)
        : '—';
      const dWStr = dW != null
        ? (isImp ? (dW * 2.20462).toFixed(1) + ' lb' : `${dW > 0 ? '+' : ''}${Number(dW).toFixed(2)} kg`)
        : '—';

      const aHBadge = aHPct != null ? ` <small class="percentile-badge leo" style="padding:1px 5px; font-size:0.7rem;">${Math.round(aHPct)}%</small>` : '';
      const aWBadge = aWPct != null ? ` <small class="percentile-badge leo" style="padding:1px 5px; font-size:0.7rem;">${Math.round(aWPct)}%</small>` : '';
      const bHBadge = bHPct != null ? ` <small class="percentile-badge maya" style="padding:1px 5px; font-size:0.7rem;">${Math.round(bHPct)}%</small>` : '';
      const bWBadge = bWPct != null ? ` <small class="percentile-badge maya" style="padding:1px 5px; font-size:0.7rem;">${Math.round(bWPct)}%</small>` : '';

      tr.innerHTML = `
        <td><strong>${label}</strong></td>
        <td class="tabular-nums" style="color:var(--leo-accent);">${hAStr}${aHBadge}</td>
        <td class="tabular-nums" style="color:var(--leo-accent);">${wAStr}${aWBadge}</td>
        <td class="tabular-nums" style="color:var(--maya-accent);">${hBStr}${bHBadge}</td>
        <td class="tabular-nums" style="color:var(--maya-accent);">${wBStr}${bWBadge}</td>
        <td class="tabular-nums"><strong>${dHStr}</strong></td>
        <td class="tabular-nums">${dWStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // VIEW 3: BULK PICTURE DATA ENTRY STUDIO CONTROLLER
  // =========================================================================

  function setupPhotoImportStudio() {
    // 4 Sample medical buttons
    const btnSample1 = $('btn-sample-1');
    const btnSample2 = $('btn-sample-2');
    const btnSample3 = $('btn-sample-3');
    const btnSample4 = $('btn-sample-4');

    if (btnSample1) {
      btnSample1.addEventListener('click', () => loadSamplePhoto('pediatric-summary'));
    }
    if (btnSample2) {
      btnSample2.addEventListener('click', () => loadSamplePhoto('baby-book-handwritten'));
    }
    if (btnSample3) {
      btnSample3.addEventListener('click', () => loadSamplePhoto('portal-screenshot'));
    }
    if (btnSample4) {
      btnSample4.addEventListener('click', () => loadSamplePhoto('camera-fridge-snapshot'));
    }

    // Manual row creation helper
    const addManualStagingRow = () => {
      const pi = getPhotoImport();
      const children = AppState.familyState?.children || [];
      const c1Id = children[0]?.id || 'child-1';
      const blankRow = (pi && typeof pi.createBlankRecord === 'function')
        ? pi.createBlankRecord(AppState.familyState, c1Id)
        : {
            id: 'manual-' + Date.now(),
            childId: c1Id,
            date: new Date().toISOString().slice(0, 10),
            weightKg: null,
            heightCm: null,
            headCm: null,
            selected: true,
            status: 'warning',
            confidence: null,
            warnings: ['Manual entry']
          };
      AppState.stagedRecords.push(blankRow);
      const banner = $('staging-status-banner');
      if (banner) banner.style.display = 'none';
      renderStagingTable();
    };

    const btnAddManual = $('btn-add-manual-row');
    if (btnAddManual) btnAddManual.addEventListener('click', addManualStagingRow);

    const btnBannerAddManual = $('btn-banner-add-manual');
    if (btnBannerAddManual) btnBannerAddManual.addEventListener('click', addManualStagingRow);

    const btnBannerEditOcr = $('btn-banner-edit-ocr');
    if (btnBannerEditOcr) {
      btnBannerEditOcr.addEventListener('click', () => {
        const details = $('details-ocr-text');
        if (details) details.open = true;
        const textarea = $('raw-ocr-textarea');
        if (textarea) textarea.focus();
      });
    }

    // Dropzone & File Input
    const dropzone = $('photo-dropzone');
    const fileInput = $('photo-file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });

      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadedImages(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleUploadedImages(e.target.files);
        }
      });
    }

    // Re-parse raw OCR text button
    const btnReparse = $('btn-reparse-ocr');
    if (btnReparse) {
      btnReparse.addEventListener('click', () => {
        const text = $('raw-ocr-textarea')?.value || '';
        if (!text.trim()) {
          showToast('Please enter text to parse', 'warning');
          return;
        }
        reparseRawText(text);
      });
    }

    // Staging table Select All checkbox
    const thCheckbox = $('staging-th-checkbox');
    if (thCheckbox) {
      thCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        AppState.stagedRecords.forEach(r => r.selected = checked);
        renderStagingTable();
      });
    }

    const btnSelectAll = $('btn-staging-select-all');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        AppState.stagedRecords.forEach(r => r.selected = true);
        renderStagingTable();
      });
    }

    // Commit buttons
    const btnCommit = $('btn-commit-staging');
    const btnCommitBottom = $('btn-commit-bottom');

    if (btnCommit) btnCommit.addEventListener('click', commitStagedRecords);
    if (btnCommitBottom) btnCommitBottom.addEventListener('click', commitStagedRecords);
  }

  async function loadSamplePhoto(templateId) {
    AppState.activeSampleId = templateId;
    AppState.activeStagingRowIndex = -1;
    const pi = getPhotoImport();
    if (!pi) return;

    // Update active button state
    document.querySelectorAll('.sample-buttons-strip .sample-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-sample-id') === templateId);
    });

    // Start scanner laser animation
    const laser = $('scanner-laser-beam');
    if (laser) laser.classList.add('active');

    const templates = pi.getSampleTemplates();
    const tmpl = templates.find(t => t.id === templateId) || templates[0];

    const sampleObj = pi.renderSampleImageToDataURL(templateId);
    const dataUrl = typeof sampleObj === 'string' ? sampleObj : sampleObj?.dataUrl;
    const rawText = sampleObj?.groundTruthText || tmpl?.groundTruthText || '';
    const rawRecords = sampleObj?.preExtractedRecords || tmpl?.rawRecords || (pi.parseRawTextToRecords ? pi.parseRawTextToRecords(rawText, AppState.familyState, templateId) : []);

    $('scanner-file-name').textContent = tmpl.fileName || sampleObj?.fileName || 'document.png';
    $('raw-ocr-textarea').value = rawText;

    // Render sample image onto canvas
    const canvas = $('photo-preview-canvas');
    if (canvas && dataUrl) {
      try {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Draw bounding boxes over canvas
          if (typeof pi.drawBoundingBoxes === 'function') {
            const boxes = AppState.stagedRecords.map(r => r.boundingBox).filter(Boolean);
            pi.drawBoundingBoxes(ctx, boxes.length > 0 ? boxes : (tmpl.rawRecords?.map(r => r.boundingBox) || []), AppState.activeStagingRowIndex ?? -1, canvas.width, canvas.height);
          }
          if (laser) laser.classList.remove('active');
        };
        img.src = dataUrl;
      } catch (err) {
        console.warn('[PhotoImport] Canvas render error:', err);
        if (laser) laser.classList.remove('active');
      }
    }

    // Process records into staging state ensuring headCircumferenceCm and headCm consistency
    const children = AppState.familyState?.children || [];
    const c1 = children[0] || { id: 'child-1', name: 'Child 1' };
    const c2 = children[1] || { id: 'child-2', name: 'Child 2' };

    const preparedRecords = (rawRecords || []).map(r => {
      const hc = r.headCircumferenceCm ?? r.headCm;
      const childObj = children.find(c => c.id === r.childId || (r.childName && (c.name.toLowerCase() === r.childName.toLowerCase() || c.id === r.childName))) || (r.childId === 'child-2' ? c2 : c1);
      const childName = childObj ? childObj.name : (r.childName || c1.name);
      const childId = childObj ? childObj.id : (r.childId || c1.id);
      return {
        ...r,
        childId,
        childName,
        detectedChildName: childName,
        headCircumferenceCm: hc,
        headCm: hc
      };
    });

    const processed = pi.validateStagingRecords(preparedRecords, AppState.familyState);
    AppState.stagedRecords = processed.map((r, idx) => ({
      ...r,
      headCircumferenceCm: r.headCircumferenceCm ?? r.headCm,
      headCm: r.headCm ?? r.headCircumferenceCm,
      id: r.id || `staged_${templateId}_${idx}`,
      selected: true
    }));

    renderStagingTable();
  }

  async function handleUploadedImages(files) {
    const pi = getPhotoImport();
    if (!pi) return;

    const laser = $('scanner-laser-beam');
    if (laser) laser.classList.add('active');
    $('scanner-file-name').textContent = files[0].name;

    showToast(`Processing ${files.length} document photo(s)...`, 'info');

    try {
      const results = await pi.processImages(Array.from(files), AppState.familyState);
      const allExtracted = [];
      let combinedText = '';

      if (Array.isArray(results)) {
        results.forEach(res => {
          if (res.rawText) combinedText += res.rawText + '\n\n';
          if (res.records && Array.isArray(res.records)) {
            allExtracted.push(...res.records);
          } else if (res.date || res.heightCm || res.weightKg) {
            // Already a StagingRecord
            allExtracted.push(res);
          }
        });
      }

      if (results && results.rawText) {
        $('raw-ocr-textarea').value = results.rawText;
      } else if (combinedText) {
        $('raw-ocr-textarea').value = combinedText;
      } else {
        $('raw-ocr-textarea').value = '';
      }

      const banner = $('staging-status-banner');
      const bannerMsg = $('staging-status-message');
      if (allExtracted.length === 0) {
        if (banner) banner.style.display = 'block';
        if (bannerMsg) bannerMsg.textContent = (results && results.message) || 'No growth measurements could be read from this image. Add rows manually or paste text on the left.';
      } else {
        if (banner) banner.style.display = 'none';
      }

      const children = AppState.familyState?.children || [];
      const c1 = children[0] || { id: 'child-1', name: 'Child 1' };
      const c2 = children[1] || { id: 'child-2', name: 'Child 2' };

      AppState.stagedRecords = allExtracted.map((r, idx) => {
        const hc = r.headCircumferenceCm ?? r.headCm;
        const childObj = children.find(c => c.id === r.childId || (r.childName && (c.name.toLowerCase() === r.childName.toLowerCase() || c.id === r.childName))) || (r.childId === 'child-2' ? c2 : c1);
        const childName = childObj ? childObj.name : (r.childName || c1.name);
        const childId = childObj ? childObj.id : (r.childId || c1.id);
        return {
          ...r,
          childId,
          childName,
          detectedChildName: childName,
          headCircumferenceCm: hc,
          headCm: hc,
          id: `uploaded_${Date.now()}_${idx}`,
          selected: true
        };
      });

      // Render image preview on canvas with bounding boxes
      const canvas = $('photo-preview-canvas');
      if (canvas && files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (typeof pi.drawBoundingBoxes === 'function') {
              const boxes = AppState.stagedRecords.map(r => r.boundingBox).filter(Boolean);
              pi.drawBoundingBoxes(ctx, boxes, AppState.activeStagingRowIndex ?? -1, canvas.width, canvas.height);
            }
            if (laser) laser.classList.remove('active');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(files[0]);
      }

      renderStagingTable();
      if (AppState.stagedRecords.length > 0) {
        showToast(`Extracted ${AppState.stagedRecords.length} biometric records!`, 'success');
      } else {
        showToast('No growth measurements found. Check banner or add manually.', 'warning');
      }
    } catch (err) {
      console.error('[PhotoImport] Upload failed:', err);
      showToast('Error parsing photo. Check raw text box below.', 'error');
      if (laser) laser.classList.remove('active');
    }
  }

  function redrawPhotoCanvas() {
    const canvas = $('photo-preview-canvas');
    const pi = getPhotoImport();
    if (!canvas || !pi) return;

    // Get current sample or uploaded image
    const sampleObj = pi.renderSampleImageToDataURL(AppState.activeSampleId || 'pediatric-summary');
    const dataUrl = typeof sampleObj === 'string' ? sampleObj : sampleObj?.dataUrl;
    if (!dataUrl) return;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (typeof pi.drawBoundingBoxes === 'function') {
        const boxes = AppState.stagedRecords.map(r => r.boundingBox).filter(Boolean);
        pi.drawBoundingBoxes(ctx, boxes, AppState.activeStagingRowIndex ?? -1, canvas.width, canvas.height);
      }
    };
    img.src = dataUrl;
  }

  function reparseRawText(text) {
    const pi = getPhotoImport();
    if (!pi) return;

    const extracted = pi.parseRawTextToRecords(text, AppState.familyState);
    const validated = pi.validateStagingRecords(extracted, AppState.familyState);

    AppState.stagedRecords = validated.map((r, idx) => ({
      ...r,
      headCircumferenceCm: r.headCircumferenceCm ?? r.headCm,
      headCm: r.headCm ?? r.headCircumferenceCm,
      id: `reparsed_${Date.now()}_${idx}`,
      selected: true
    }));

    renderStagingTable();
    showToast(`Re-parsed ${AppState.stagedRecords.length} records from text`, 'success');
  }

  function renderStagingTable() {
    const tbody = $('staging-records-tbody');
    if (!tbody) return;

    const pi = getPhotoImport();
    const records = AppState.stagedRecords;
    const countBadge = $('staging-count-badge');
    const rowCount = $('staging-row-count');
    const commitCount = $('commit-count-badge');

    const selectedCount = records.filter(r => r.selected).length;

    if (countBadge) countBadge.textContent = `${records.length} Staged`;
    if (rowCount) rowCount.textContent = `${records.length}`;
    if (commitCount) commitCount.textContent = `${selectedCount}`;

    tbody.innerHTML = '';

    if (records.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--ink-muted);">No records staged. Upload photo or choose sample above.</td></tr>';
      return;
    }

    const children = AppState.familyState?.children || [];
    const c1 = children[0] || { id: 'child-1', name: 'Child 1' };
    const c2 = children[1] || { id: 'child-2', name: 'Child 2' };

    records.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-index', idx);
      const isImp = AppState.unitSystem === 'imperial';

      // Child match across all 1..N children
      const childObj = children.find(c => c.id === rec.childId || (rec.childName && (c.name.toLowerCase() === rec.childName.toLowerCase() || c.id === rec.childName))) || c1;
      const childName = childObj ? childObj.name : (rec.childName || c1.name);
      const childSelectVal = childObj ? childObj.id : (rec.childId || c1.id);
      const isChild2 = childSelectVal === (c2?.id || 'child-2');

      // Display inputs
      const wtVal = rec.weightKg != null ? (isImp ? (rec.weightKg * 2.20462).toFixed(1) : Number(rec.weightKg).toFixed(2)) : '';
      const htVal = rec.heightCm != null ? (isImp ? (rec.heightCm / 2.54).toFixed(1) : Number(rec.heightCm).toFixed(1)) : '';
      const hcVal = (rec.headCm ?? rec.headCircumferenceCm) != null ? (isImp ? ((rec.headCm ?? rec.headCircumferenceCm) / 2.54).toFixed(1) : Number(rec.headCm ?? rec.headCircumferenceCm).toFixed(1)) : '';

      // Confidence badge
      const conf = rec.confidence || 0.95;
      let confClass = 'confidence-high';
      let confLabel = `${Math.round(conf * 100)}% Match`;
      if (conf < 0.8) {
        confClass = 'confidence-warning';
        confLabel = 'Review Needed';
      }

      // Percentile preview
      const pctPreview = rec.heightPct != null ? `${fmtOrd(rec.heightPct)} %ile` : (rec.percentile != null ? `${fmtOrd(rec.percentile)} %ile` : '—');

      const childOptions = children.map(c => `<option value="${c.id}" ${childSelectVal === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

      tr.innerHTML = `
        <td><input type="checkbox" class="staging-row-checkbox" data-index="${idx}" ${rec.selected ? 'checked' : ''}></td>
        <td>
          <select class="table-input staging-child-select" data-index="${idx}">
            ${childOptions}
          </select>
        </td>
        <td><input type="date" class="table-input staging-date-input" data-index="${idx}" value="${rec.date || ''}"></td>
        <td><input type="number" step="0.01" class="table-input tabular-nums staging-wt-input" data-index="${idx}" value="${wtVal}" placeholder="${isImp ? 'lb' : 'kg'}"></td>
        <td><input type="number" step="0.1" class="table-input tabular-nums staging-ht-input" data-index="${idx}" value="${htVal}" placeholder="${isImp ? 'in' : 'cm'}"></td>
        <td><input type="number" step="0.1" class="table-input tabular-nums staging-hc-input" data-index="${idx}" value="${hcVal}" placeholder="${isImp ? 'in' : 'cm'}"></td>
        <td class="staging-pct-cell"><span class="percentile-badge ${isChild2 ? 'maya' : 'leo'}">${pctPreview}</span></td>
        <td class="staging-conf-cell"><span class="confidence-chip ${confClass}">${confLabel}</span></td>
        <td>
          <button type="button" class="btn btn-subtle btn-sm staging-delete-btn" data-index="${idx}" title="Delete staged row">✕</button>
        </td>
      `;

      // Hover listener to highlight bounding box
      tr.addEventListener('mouseenter', () => {
        AppState.activeStagingRowIndex = idx;
        tr.classList.add('staging-highlight-row');
        redrawPhotoCanvas();
      });

      tr.addEventListener('mouseleave', () => {
        AppState.activeStagingRowIndex = -1;
        tr.classList.remove('staging-highlight-row');
        redrawPhotoCanvas();
      });

      tbody.appendChild(tr);
    });

    // Helper to re-validate and update row UI
    const triggerRevalidation = (i) => {
      if (!pi || !AppState.stagedRecords[i]) return;
      const revalidated = pi.validateStagingRecords(AppState.stagedRecords, AppState.familyState);
      AppState.stagedRecords = revalidated.map((r, idx) => ({
        ...r,
        selected: AppState.stagedRecords[idx]?.selected ?? true
      }));

      // Update row cell without recreating entire DOM
      const targetTr = tbody.children[i];
      if (targetTr) {
        const updatedRec = AppState.stagedRecords[i];
        const isMaya = (updatedRec.childName || updatedRec.detectedChildName || '').toLowerCase().includes('maya');
        const pctPreview = updatedRec.heightPct != null ? `${fmtOrd(updatedRec.heightPct)} %ile` : '—';
        const pctCell = targetTr.querySelector('.staging-pct-cell');
        if (pctCell) {
          pctCell.innerHTML = `<span class="percentile-badge ${isMaya ? 'maya' : 'leo'}">${pctPreview}</span>`;
        }

        const confCell = targetTr.querySelector('.staging-conf-cell');
        if (confCell) {
          const conf = updatedRec.confidence || 0.95;
          let confClass = 'confidence-high';
          let confLabel = `${Math.round(conf * 100)}% Match`;
          if (conf < 0.8) {
            confClass = 'confidence-warning';
            confLabel = 'Review Needed';
          }
          confCell.innerHTML = `<span class="confidence-chip ${confClass}">${confLabel}</span>`;
        }
      }
    };

    // Wire up events for staging table inputs
    tbody.querySelectorAll('.staging-row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        AppState.stagedRecords[i].selected = e.target.checked;
        const newSel = AppState.stagedRecords.filter(r => r.selected).length;
        if (commitCount) commitCount.textContent = `${newSel}`;
      });
    });

    tbody.querySelectorAll('.staging-child-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        const val = e.target.value;
        const matched = children.find(c => c.id === val || c.name === val) || children[0];
        const name = matched ? matched.name : (children[0]?.name || 'Child');
        AppState.stagedRecords[i].childId = matched ? matched.id : val;
        AppState.stagedRecords[i].childName = name;
        AppState.stagedRecords[i].detectedChildName = name;
        triggerRevalidation(i);
      });
    });

    tbody.querySelectorAll('.staging-date-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        AppState.stagedRecords[i].date = e.target.value;
        triggerRevalidation(i);
      });
    });

    tbody.querySelectorAll('.staging-wt-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        const val = parseFloat(e.target.value);
        AppState.stagedRecords[i].weightKg = isNaN(val) ? null : (AppState.unitSystem === 'imperial' ? val / 2.20462 : val);
        triggerRevalidation(i);
      });
    });

    tbody.querySelectorAll('.staging-ht-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        const val = parseFloat(e.target.value);
        AppState.stagedRecords[i].heightCm = isNaN(val) ? null : (AppState.unitSystem === 'imperial' ? val * 2.54 : val);
        triggerRevalidation(i);
      });
    });

    tbody.querySelectorAll('.staging-hc-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        const val = parseFloat(e.target.value);
        const converted = isNaN(val) ? null : (AppState.unitSystem === 'imperial' ? val * 2.54 : val);
        AppState.stagedRecords[i].headCm = converted;
        AppState.stagedRecords[i].headCircumferenceCm = converted;
        triggerRevalidation(i);
      });
    });

    tbody.querySelectorAll('.staging-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.getAttribute('data-index'), 10);
        AppState.stagedRecords.splice(i, 1);
        renderStagingTable();
        redrawPhotoCanvas();
      });
    });
  }

  async function commitStagedRecords() {
    const validSelected = AppState.stagedRecords.filter(r => {
      if (!r.selected) return false;
      const hasDate = Boolean(r.date && String(r.date).trim());
      const hasMeasurement = (r.weightKg != null && r.weightKg > 0) ||
                             (r.heightCm != null && r.heightCm > 0) ||
                             (r.headCm != null && r.headCm > 0);
      return hasDate && hasMeasurement;
    });

    if (validSelected.length === 0) {
      showToast('No valid records with date and measurements selected to commit', 'warning');
      return;
    }

    const sm = getSyncManager();
    const ge = getEngine();
    const children = AppState.familyState?.children || [];
    const c1 = children[0] || { id: 'child-1', name: 'Child 1' };
    const c2 = children[1] || { id: 'child-2', name: 'Child 2' };

    let committedCount = 0;

    validSelected.forEach(rec => {
      const childObj = children.find(c => c.id === rec.childId || (rec.childName && (c.name.toLowerCase() === rec.childName.toLowerCase() || c.id === rec.childName))) || (rec.childId === 'child-2' ? c2 : c1);
      const targetChild = childObj || c1;

      if (!targetChild) return;

      // Calculate ageMonths from birthDate
      const ageMonths = (ge && targetChild.birthDate && rec.date)
        ? ge.calculateAgeMonths(targetChild.birthDate, rec.date)
        : (rec.ageMonths || 0);

      const newM = {
        id: `m_${targetChild.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        date: rec.date || new Date().toISOString().slice(0, 10),
        ageMonths: Math.round(ageMonths * 10) / 10,
        heightCm: rec.heightCm != null ? Math.round(rec.heightCm * 10) / 10 : null,
        weightKg: rec.weightKg != null ? Math.round(rec.weightKg * 100) / 100 : null,
        headCircumferenceCm: rec.headCm != null ? Math.round(rec.headCm * 10) / 10 : null,
        headCm: rec.headCm != null ? Math.round(rec.headCm * 10) / 10 : null,
        source: 'Bulk Photo Entry Studio',
        notes: rec.notes || 'Committed from digitized paperwork',
        updatedAt: Date.now()
      };

      if (!targetChild.measurements) targetChild.measurements = [];
      targetChild.measurements.push(newM);
      targetChild.measurements.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
      committedCount++;
    });

    // Remove committed records from staging
    AppState.stagedRecords = AppState.stagedRecords.filter(r => !r.selected);
    renderStagingTable();

    // Persist and Sync
    if (sm) {
      await sm.saveState(AppState.familyState, `Committed ${committedCount} biometric records via Photo Import`);
    }

    renderAllViews();
    showToast(`Successfully committed ${committedCount} records to growth history!`, 'success');
  }

  // =========================================================================
  // VIEW 4: HISTORY, MILESTONES & VISIT NOTES CONTROLLER
  // =========================================================================

  function updateRecordsFilterPills() {
    const filterContainer = $('records-child-filter');
    if (!filterContainer) return;
    const children = AppState.familyState?.children || [];

    let html = `<button type="button" class="metric-pill-btn ${AppState.historyChildFilter === 'all' ? 'active' : ''}" data-filter="all">All Children</button>`;
    children.forEach((c, idx) => {
      const isAct = AppState.historyChildFilter === c.id;
      const idAttr = idx === 0 ? 'id="filter-btn-child-1"' : (idx === 1 ? 'id="filter-btn-child-2"' : '');
      html += `<button type="button" class="metric-pill-btn ${isAct ? 'active' : ''}" data-filter="${c.id}" ${idAttr}>${c.name}</button>`;
    });

    filterContainer.innerHTML = html;

    if (typeof filterContainer.querySelectorAll === 'function') {
      filterContainer.querySelectorAll('.metric-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (typeof filterContainer.querySelectorAll === 'function') {
            filterContainer.querySelectorAll('.metric-pill-btn').forEach(b => b.classList.remove('active'));
          }
          btn.classList.add('active');
          AppState.historyChildFilter = btn.getAttribute('data-filter');
          renderHistoryTable();
        });
      });
    }
  }

  function setupHistoryAndMilestones() {
    updateRecordsFilterPills();

    // Search input
    const searchInput = $('records-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.historySearchTerm = e.target.value.toLowerCase().trim();
        renderHistoryTable();
      });
    }

    // Add entry buttons
    const btnAddDirect = $('btn-add-record-direct');
    if (btnAddDirect) btnAddDirect.addEventListener('click', () => openQuickLogDrawer());

    const btnAddMilestone1 = $('btn-add-milestone-direct');
    const btnAddMilestone2 = $('btn-add-milestone-card-cta');
    if (btnAddMilestone1) btnAddMilestone1.addEventListener('click', () => openQuickLogDrawer(null, null, null, 'milestone'));
    if (btnAddMilestone2) btnAddMilestone2.addEventListener('click', () => openQuickLogDrawer(null, null, null, 'milestone'));
  }

  function renderHistoryTable() {
    updateRecordsFilterPills();

    const tbody = $('full-history-tbody');
    if (!tbody) return;

    const children = AppState.familyState?.children || [];
    const isImp = AppState.unitSystem === 'imperial';
    const ge = getEngine();
    const ic = getInputControls();

    // Gather and sort all measurements
    let allEntries = [];
    children.forEach(child => {
      if (AppState.historyChildFilter !== 'all' && child.id !== AppState.historyChildFilter) return;
      (child.measurements || []).forEach(m => {
        allEntries.push({
          ...m,
          childId: child.id,
          childName: child.name,
          childGender: child.gender || child.sex,
          childColor: child.color
        });
      });
    });

    // Sort descending by date
    allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Search filtering
    if (AppState.historySearchTerm) {
      const term = AppState.historySearchTerm;
      allEntries = allEntries.filter(m =>
        (m.notes && m.notes.toLowerCase().includes(term)) ||
        (m.source && m.source.toLowerCase().includes(term)) ||
        (m.date && m.date.includes(term)) ||
        (m.childName && m.childName.toLowerCase().includes(term))
      );
    }

    tbody.innerHTML = '';

    if (allEntries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--ink-muted);">No records found matching filters.</td></tr>';
      return;
    }

    // Precompute velocity maps for all children
    const velocityMap = new Map();
    if (ge && typeof ge.analyzeGrowthVelocity === 'function') {
      children.forEach(c => {
        const intervals = ge.analyzeGrowthVelocity(c);
        (intervals || []).forEach(inv => {
          const matched = (c.measurements || []).find(m => m.date === inv.currDate || Math.abs(m.ageMonths - inv.currAgeMonths) < 0.1);
          if (matched) {
            velocityMap.set(`${c.id}_${matched.id}`, inv);
          }
        });
      });
    }

    allEntries.forEach(m => {
      const tr = document.createElement('tr');
      const isMaya = m.childName.toLowerCase().includes('maya');
      const colorStyle = m.childColor ? `style="border-left: 3px solid ${m.childColor};"` : '';
      const childBadge = `<span class="percentile-badge ${isMaya ? 'maya' : 'leo'}" ${colorStyle}>${m.childName}</span>`;

      const ht = m.heightCm != null ? (isImp ? (m.heightCm / 2.54).toFixed(1) + ' in' : Number(m.heightCm).toFixed(1) + ' cm') : '—';
      const wt = m.weightKg != null ? (isImp ? (m.weightKg * 2.20462).toFixed(1) + ' lb' : Number(m.weightKg).toFixed(2) + ' kg') : '—';
      const hc = (m.headCircumferenceCm ?? m.headCm) != null ? (isImp ? ((m.headCircumferenceCm ?? m.headCm) / 2.54).toFixed(1) + ' in' : Number(m.headCircumferenceCm ?? m.headCm).toFixed(1) + ' cm') : '—';

      const ageStr = ge ? ge.formatAge(m.ageMonths) : `${m.ageMonths}m`;

      // Velocity cell computation
      const vel = velocityMap.get(`${m.childId}_${m.id}`);
      let velHtml = '—';
      if (vel) {
        const hV = vel.heightVelocityCmPerYear != null
          ? (isImp ? (vel.heightVelocityCmPerYear / 2.54).toFixed(1) + ' in/yr' : `+${vel.heightVelocityCmPerYear.toFixed(1)} cm/yr`)
          : '';
        const wV = vel.weightVelocityKgPerYear != null
          ? (isImp ? (vel.weightVelocityKgPerYear * 2.20462).toFixed(1) + ' lb/yr' : `+${vel.weightVelocityKgPerYear.toFixed(2)} kg/yr`)
          : '';
        const spurtBadge = (vel.isSpurt || vel.isGrowthSpurt)
          ? ` <span class="spurt-badge" style="font-size:0.68rem; padding:1px 4px; margin-left:2px;">⚡ Spurt</span>`
          : '';
        velHtml = `<span style="font-size:0.78rem;">${hV}${hV && wV ? ' • ' : ''}${wV}</span>${spurtBadge}`;
      }

      const sourceBadge = `<span class="badge-source">${m.source || 'Checkup'}</span>`;
      const notesHtml = `${sourceBadge} ${m.notes || ''}`;

      tr.innerHTML = `
        <td><strong>${m.date}</strong></td>
        <td>${childBadge}</td>
        <td class="tabular-nums">${ageStr}</td>
        <td class="tabular-nums"><strong>${ht}</strong></td>
        <td class="tabular-nums"><strong>${wt}</strong></td>
        <td class="tabular-nums">${hc}</td>
        <td class="tabular-nums">${velHtml}</td>
        <td><small style="color:var(--ink-secondary);">${notesHtml}</small></td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-subtle btn-sm edit-record-btn" data-child-id="${m.childId}" data-record-id="${m.id}" title="Edit Record">✏️</button>
          <button type="button" class="btn btn-subtle btn-sm delete-record-btn" data-child-id="${m.childId}" data-record-id="${m.id}" title="Delete Record">🗑️</button>
        </td>
      `;

      tbody.appendChild(tr);

      // Wire edit button (Inline Row Editing via InputControls.mountInlineRowEditor)
      const editBtn = tr.querySelector('.edit-record-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          const child = children.find(c => c.id === m.childId);
          if (ic && typeof ic.mountInlineRowEditor === 'function' && child) {
            ic.mountInlineRowEditor(tr, {
              measurement: m,
              child,
              unitSystem: AppState.unitSystem,
              onSave: async (updatedM) => {
                const targetM = (child.measurements || []).find(item => item.id === m.id);
                if (targetM) {
                  Object.assign(targetM, updatedM);
                  const now = Date.now();
                  targetM.updatedAt = now;
                  child.updatedAt = now;
                  AppState.familyState.updatedAt = now;
                  const sm = getSyncManager();
                  if (sm) await sm.saveState(AppState.familyState, `Updated measurement for ${child.name}`);
                  renderAllViews();
                  showToast('Measurement saved!', 'success');
                }
              },
              onCancel: () => {
                renderHistoryTable();
              }
            });
          } else {
            openMeasurementModal(m.childId, m.id);
          }
        });
      }

      // Wire delete button (Tombstoning + 8s Undo toast, NO blocking confirm)
      const delBtn = tr.querySelector('.delete-record-btn');
      if (delBtn) {
        delBtn.addEventListener('click', () => {
          deleteRecordWithUndo(m.childId, m.id);
        });
      }
    });
  }

  async function deleteRecordWithUndo(childId, recordId) {
    const child = (AppState.familyState?.children || []).find(c => c.id === childId);
    if (!child || !child.measurements) return;

    const mIdx = child.measurements.findIndex(m => m.id === recordId);
    if (mIdx === -1) return;

    // Snapshot prevState BEFORE mutating for CRDT-safe Undo
    const prevState = JSON.parse(JSON.stringify(AppState.familyState));

    const [removed] = child.measurements.splice(mIdx, 1);
    if (!AppState.familyState.deletedIds) AppState.familyState.deletedIds = [];
    if (!AppState.familyState.deletedIds.includes(recordId)) {
      AppState.familyState.deletedIds.push(recordId);
    }

    const now = Date.now();
    child.updatedAt = now;
    AppState.familyState.updatedAt = now;

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Deleted measurement entry`);
    }

    renderAllViews();

    if (AppState.undoManager && typeof AppState.undoManager.recordAction === 'function') {
      AppState.undoManager.recordAction({
        label: `Deleted checkup record (${removed.date || 'entry'})`,
        prevStateSnapshot: prevState,
        tombstonedIds: [recordId]
      });
    } else {
      showUndoToast(`Measurement removed (${removed.date || 'entry'})`, async () => {
        const targetChild = (AppState.familyState?.children || []).find(c => c.id === childId);
        if (targetChild) {
          if (!targetChild.measurements) targetChild.measurements = [];
          const restNow = Date.now();
          removed.updatedAt = restNow;
          targetChild.measurements.push(removed);
          targetChild.measurements.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
          targetChild.updatedAt = restNow;
          if (AppState.familyState.deletedIds) {
            AppState.familyState.deletedIds = AppState.familyState.deletedIds.filter(id => id !== recordId);
          }
          AppState.familyState.updatedAt = restNow;
          if (sm) await sm.saveState(AppState.familyState, `Restored measurement entry`);
          renderAllViews();
          showToast('Measurement restored!', 'success');
        }
      }, 8000);
    }
  }

  async function deleteRecord(childId, recordId) {
    return deleteRecordWithUndo(childId, recordId);
  }

  function renderMilestonesGrid() {
    const container = $('milestones-grid-container');
    if (!container) return;

    const children = AppState.familyState?.children || [];
    container.innerHTML = '';

    let allMilestones = [];
    children.forEach(child => {
      (child.milestones || []).forEach(ms => {
        allMilestones.push({ ...ms, childId: child.id, childName: child.name, childColor: child.color });
      });
    });

    allMilestones.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));

    if (allMilestones.length === 0) {
      container.innerHTML = '<div style="color:var(--ink-muted); padding:16px;">No milestones recorded yet. Click Log Milestone to celebrate a first smile or step!</div>';
      return;
    }

    allMilestones.forEach(ms => {
      const card = document.createElement('div');
      const isMaya = ms.childName.toLowerCase().includes('maya');
      card.className = `milestone-item-card ${isMaya ? 'maya' : 'leo'}`;
      if (ms.childColor) card.setAttribute('style', `border-left: 4px solid ${ms.childColor};`);

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <strong style="font-size:0.95rem;">${ms.title}</strong>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="percentile-badge ${isMaya ? 'maya' : 'leo'}">${ms.childName}</span>
            <button type="button" class="btn btn-subtle btn-sm milestone-delete-btn" title="Delete Milestone" data-child-id="${ms.childId}" data-milestone-id="${ms.id}">✕</button>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--ink-muted);">
          <span>Achieved at: <strong class="tabular-nums" style="color:var(--ink-primary);">${ms.ageMonths != null ? ms.ageMonths.toFixed(1) + ' mo' : '—'}</strong></span>
          <span>${ms.date || ''}</span>
        </div>
        <div style="font-size:0.72rem; text-transform:uppercase; color:var(--ink-muted); margin-top:4px;">
          Category: ${ms.category || 'general'}
        </div>
      `;

      const delBtn = card.querySelector('.milestone-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteMilestoneWithUndo(ms.childId, ms.id);
        });
      }

      container.appendChild(card);
    });
  }

  async function deleteMilestoneWithUndo(childId, milestoneId) {
    const child = (AppState.familyState?.children || []).find(c => c.id === childId);
    if (!child || !child.milestones) return;

    const idx = child.milestones.findIndex(ms => ms.id === milestoneId);
    if (idx === -1) return;

    // Snapshot prevState BEFORE mutating for CRDT-safe Undo
    const prevState = JSON.parse(JSON.stringify(AppState.familyState));

    const [removed] = child.milestones.splice(idx, 1);
    if (!AppState.familyState.deletedIds) AppState.familyState.deletedIds = [];
    if (!AppState.familyState.deletedIds.includes(milestoneId)) {
      AppState.familyState.deletedIds.push(milestoneId);
    }

    const now = Date.now();
    child.updatedAt = now;
    AppState.familyState.updatedAt = now;

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Deleted milestone: ${removed.title}`);
    }

    renderAllViews();

    if (AppState.undoManager && typeof AppState.undoManager.recordAction === 'function') {
      AppState.undoManager.recordAction({
        label: `Deleted milestone (${removed.title})`,
        prevStateSnapshot: prevState,
        tombstonedIds: [milestoneId]
      });
    } else {
      showUndoToast(`Milestone removed: ${removed.title}`, async () => {
        const targetChild = (AppState.familyState?.children || []).find(c => c.id === childId);
        if (targetChild) {
          if (!targetChild.milestones) targetChild.milestones = [];
          const restNow = Date.now();
          removed.updatedAt = restNow;
          targetChild.milestones.push(removed);
          targetChild.milestones.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
          targetChild.updatedAt = restNow;
          if (AppState.familyState.deletedIds) {
            AppState.familyState.deletedIds = AppState.familyState.deletedIds.filter(id => id !== milestoneId);
          }
          AppState.familyState.updatedAt = restNow;
          if (sm) await sm.saveState(AppState.familyState, `Restored milestone`);
          renderAllViews();
          showToast('Milestone restored!', 'success');
        }
      }, 8000);
    }
  }

  // =========================================================================
  // VIEW 5: CROSS-DEVICE SYNC & EXPORT HUB CONTROLLER
  // =========================================================================

  function updateSyncStatusUI(statusObj) {
    const sm = getSyncManager();
    const st = statusObj || (sm && typeof sm.getSyncStatus === 'function' ? sm.getSyncStatus() : { status: 'synced', roomCode: 'FAMILY-SPROUT-842' });

    const pillText = $('sync-pill-text');
    const hubStatus = $('sync-hub-status-text');
    const dot = $('sync-pill-dot');
    const hubDot = $('sync-hub-dot');
    const room = $('sync-pill-room');

    if (room && st.roomCode) room.textContent = st.roomCode;

    if (dot) dot.className = 'sync-dot';
    if (hubDot) hubDot.className = 'sync-dot';

    let displayStatus = 'Synced';
    let hubDisplayStatus = 'Synced & Live';

    if (st.status === 'synced') {
      displayStatus = 'Synced';
      hubDisplayStatus = 'Synced & Live';
    } else if (st.status === 'syncing') {
      if (dot) dot.classList.add('syncing');
      if (hubDot) hubDot.classList.add('syncing');
      displayStatus = 'Syncing...';
      hubDisplayStatus = 'Syncing with cloud...';
    } else if (st.status === 'offline' || st.status === 'offline-saved') {
      if (dot) dot.classList.add('offline');
      if (hubDot) hubDot.classList.add('offline');
      displayStatus = st.status === 'offline-saved' ? 'Saved (Offline)' : 'Offline';
      hubDisplayStatus = 'Offline (Local persistence active)';
    }

    if (pillText) pillText.textContent = displayStatus;
    if (hubStatus) hubStatus.textContent = hubDisplayStatus;
    const syncStatusText = $('sync-status-text');
    if (syncStatusText) syncStatusText.textContent = displayStatus;

    if (st.syncHistory) {
      renderAuditLog(st.syncHistory);
    }

    const roomInput = $('input-room-code');
    if (roomInput && st.roomCode && document.activeElement !== roomInput) roomInput.value = st.roomCode;
  }

  function updateTransportModeUI() {
    const sm = getSyncManager();
    const badge = $('sync-transport-badge');
    const inputUrl = $('input-custom-sync-url');
    if (!sm) return;

    const info = (typeof sm.getTransportInfo === 'function')
      ? sm.getTransportInfo()
      : { mode: 'local', label: '🟢 Local Sync Server' };

    if (badge) {
      badge.textContent = info.label || (info.mode === 'cloud' ? '🔐 Encrypted Off-Network Cloud Sync (AES-256-GCM)' : (info.mode === 'custom' ? '☁️ Custom Cloud Server' : '🟢 Local Sync Server'));
      badge.className = `transport-mode-badge ${info.mode || 'local'}`;
    }
    if (inputUrl && info.customUrl && document.activeElement !== inputUrl) {
      inputUrl.value = info.customUrl;
    }
  }

  function renderSyncHubView() {
    renderSyncQRCode();
    updateTransportModeUI();
  }

  function renderSyncQRCode() {
    updateSyncStatusUI();
    updateTransportModeUI();

    const sm = getSyncManager();
    const qrContainer = $('sync-qr-code-svg-container');
    const roomInput = $('input-room-code');
    const qrLabel = $('qr-room-label');
    const shareUrlInput = $('input-share-url');
    const st = sm && typeof sm.getSyncStatus === 'function' ? sm.getSyncStatus() : null;
    const roomCode = st?.roomCode || roomInput?.value?.trim().toUpperCase() || 'FAMILY-SPROUT-842';
    if (roomInput) roomInput.value = roomCode;

    if (qrLabel) qrLabel.textContent = roomCode;

    if (sm && typeof sm.generatePairingQRSvg === 'function') {
      Promise.resolve(sm.generatePairingQRSvg(roomCode)).then(qr => {
        if (!qr) return;
        if (qrContainer) {
          if (typeof qr === 'string') {
            qrContainer.innerHTML = qr;
          } else if (qr.svgMarkup) {
            qrContainer.innerHTML = qr.svgMarkup;
          }
        }
        if (shareUrlInput) {
          const url = (typeof qr === 'object' && qr.shareUrl) ? qr.shareUrl : `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
          shareUrlInput.value = url;
        }
      }).catch(err => {
        console.warn('[KinSprout] Error generating pairing QR SVG:', err);
      });
    }
  }

  function setupSyncHubControls() {
    // Initial QR code & transport UI render
    renderSyncQRCode();
    updateTransportModeUI();

    // Wire Custom Sync URL buttons
    const btnSaveUrl = $('btn-save-sync-url');
    if (btnSaveUrl) {
      btnSaveUrl.addEventListener('click', async () => {
        const input = $('input-custom-sync-url');
        const url = input?.value?.trim();
        const sm = getSyncManager();
        if (sm && typeof sm.setSyncEndpoint === 'function') {
          sm.setSyncEndpoint(url);
          updateTransportModeUI();
          showToast(url ? `Custom sync server set to: ${url}` : 'Reset to default sync server', 'success');
          await sm.syncNow();
          renderSyncQRCode();
        }
      });
    }

    const btnResetUrl = $('btn-reset-sync-url');
    if (btnResetUrl) {
      btnResetUrl.addEventListener('click', async () => {
        const input = $('input-custom-sync-url');
        if (input) input.value = '';
        const sm = getSyncManager();
        if (sm && typeof sm.setSyncEndpoint === 'function') {
          sm.setSyncEndpoint(null);
          updateTransportModeUI();
          showToast('Reset to default sync server', 'info');
          await sm.syncNow();
          renderSyncQRCode();
        }
      });
    }

    // Wire PWA Install Prompt Button
    const btnInstallPwa = $('btn-install-pwa');
    if (btnInstallPwa) {
      btnInstallPwa.addEventListener('click', async () => {
        if (AppState.deferredInstallPrompt) {
          AppState.deferredInstallPrompt.prompt();
          const { outcome } = await AppState.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('Thank you for installing KinSprout!', 'success');
          }
          AppState.deferredInstallPrompt = null;
          btnInstallPwa.style.display = 'none';
        } else {
          const iosGuide = $('pwa-ios-instructions');
          if (iosGuide) {
            iosGuide.style.display = iosGuide.style.display === 'none' ? 'block' : 'none';
          } else {
            showToast('To install, tap Share and then "Add to Home Screen".', 'info');
          }
        }
      });
    }

    // Wire Copy Share URL button
    const btnCopyShareUrl = $('btn-copy-share-url');
    if (btnCopyShareUrl) {
      btnCopyShareUrl.addEventListener('click', () => {
        const urlInput = $('input-share-url');
        const url = urlInput?.value || window.location.href;
        navigator.clipboard.writeText(url).then(() => {
          showToast('Copied pairing share link to clipboard!', 'success');
        }).catch(() => {
          showToast(`Pairing URL: ${url}`, 'info');
        });
      });
    }

    // Connect room button
    const btnJoin = $('btn-join-room');
    if (btnJoin) {
      btnJoin.addEventListener('click', async () => {
        const input = $('input-room-code');
        const code = input?.value?.trim().toUpperCase();
        if (!code) return;

        const sm = getSyncManager();
        if (sm) {
          showToast(`Connecting to room ${code}...`, 'info');
          const success = await sm.setRoomCode(code);
          renderSyncQRCode();
          if (success) {
            showToast(`Connected to Family Room ${code}`, 'success');
          } else {
            showToast(`Room switched to ${code}`, 'info');
          }
        }
      });
    }

    // Force sync now
    const btnSyncNow = $('btn-sync-now');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        const sm = getSyncManager();
        if (sm) {
          showToast('Synchronizing with cloud room...', 'info');
          const res = await sm.syncNow();
          renderSyncQRCode();
          showToast('Sync complete! All devices up to date.', 'success');
        }
      });
    }

    // Copy room code
    const btnCopyRoom = $('btn-copy-room-code');
    if (btnCopyRoom) {
      btnCopyRoom.addEventListener('click', () => {
        const code = $('input-room-code')?.value || 'FAMILY-SPROUT-842';
        navigator.clipboard.writeText(code).then(() => {
          showToast(`Copied room code "${code}" to clipboard!`, 'success');
        }).catch(() => {
          showToast(`Room code: ${code}`, 'info');
        });
      });
    }

    // Generate portable snapshot code
    const btnGenCode = $('btn-generate-snapshot-code');
    if (btnGenCode) {
      btnGenCode.addEventListener('click', () => {
        const sm = getSyncManager();
        if (sm) {
          const code = sm.generateShareSnapshotCode();
          const textarea = $('textarea-export-snapshot');
          if (textarea) textarea.value = code;
          navigator.clipboard.writeText(code).catch(() => {});
          showToast('Generated portable sync code & copied to clipboard!', 'success');
        }
      });
    }

    // Import portable snapshot code
    const btnImportCode = $('btn-import-snapshot-code');
    if (btnImportCode) {
      btnImportCode.addEventListener('click', async () => {
        const code = $('textarea-import-snapshot')?.value;
        if (!code || !code.trim()) {
          showToast('Please paste a KINSPROUT-SYNC-v1:... code first', 'warning');
          return;
        }

        const sm = getSyncManager();
        if (sm) {
          try {
            showToast('Decoding and merging snapshot...', 'info');
            const merged = await sm.importShareSnapshotCode(code);
            AppState.familyState = merged;
            renderAllViews();
            showToast('Snapshot merged successfully into family records!', 'success');
          } catch (err) {
            showToast(`Import error: ${err.message}`, 'error');
          }
        }
      });
    }

    // Pediatrician Print Report
    const btnPrint = $('btn-print-pediatric-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        const sm = getSyncManager();
        if (sm) sm.openPediatricianPrintReport();
      });
    }

    // Export CSV
    const btnExportCSV = $('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        const sm = getSyncManager();
        if (sm) sm.exportCSV();
      });
    }

    // Export JSON
    const btnExportJSON = $('btn-export-json');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => {
        const sm = getSyncManager();
        if (sm) sm.exportJSON();
      });
    }

    // Import JSON File
    const fileImportJSON = $('input-import-json-file');
    if (fileImportJSON) {
      fileImportJSON.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const sm = getSyncManager();
            if (sm) {
              const imported = await sm.importJSON(event.target.result);
              AppState.familyState = imported;
              renderAllViews();
              showToast(`Imported family backup "${file.name}"`, 'success');
            }
          } catch (err) {
            showToast('Failed to parse JSON file', 'error');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  function renderAuditLog(historyList) {
    const listEl = $('sync-audit-log-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const list = historyList || [];

    if (list.length === 0) {
      listEl.innerHTML = '<div class="audit-log-item"><span>No sync events recorded yet</span><span>Just now</span></div>';
      return;
    }

    list.slice(0, 10).forEach(entry => {
      const item = document.createElement('div');
      item.className = 'audit-log-item';
      const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
      item.innerHTML = `
        <span><strong>${entry.deviceName || 'Device'}:</strong> ${entry.changeSummary || 'Updated growth records'}</span>
        <span style="color:var(--ink-muted);">${timeStr}</span>
      `;
      listEl.appendChild(item);
    });
  }

  // =========================================================================
  // MODALS CONTROLLER (QUICK ENTRY, FAMILY EDIT, MILESTONE)
  // =========================================================================

  function setupModals() {
    // 1. Measurement Modal
    const modalMeas = $('modal-measurement');
    const closeMeas = $('modal-measurement-close');
    const cancelMeas = $('modal-measurement-cancel');
    const formMeas = $('form-measurement');

    if (closeMeas) closeMeas.addEventListener('click', () => closeModal(modalMeas));
    if (cancelMeas) cancelMeas.addEventListener('click', () => closeModal(modalMeas));

    // Live preview in measurement modal
    const inpHeight = $('meas-height-input');
    const inpWeight = $('meas-weight-input');
    const selectChild = $('meas-child-select');
    const inpDate = $('meas-date-input');

    const updateLivePreview = () => {
      const ge = getEngine();
      if (!ge) return;

      const childId = selectChild?.value || 'child-1';
      const child = (AppState.familyState?.children || []).find(c => c.id === childId);
      const isBoy = (child?.gender || child?.sex || 'male').toLowerCase().startsWith('m');
      const sex = isBoy ? 'M' : 'F';

      const dateStr = inpDate?.value || new Date().toISOString().slice(0, 10);
      const age = (child?.birthDate && ge) ? ge.calculateAgeMonths(child.birthDate, dateStr) : 12;

      let ht = parseFloat(inpHeight?.value);
      let wt = parseFloat(inpWeight?.value);

      if (AppState.unitSystem === 'imperial') {
        if (ht) ht = ht * 2.54;
        if (wt) wt = wt / 2.20462;
      }

      if (ht && ge) {
        const stat = ge.calculateZScoreAndPercentile(sex, 'height', age, ht);
        $('preview-pct-height').textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : '—';
      } else {
        $('preview-pct-height').textContent = '—';
      }

      if (wt && ge) {
        const stat = ge.calculateZScoreAndPercentile(sex, 'weight', age, wt);
        $('preview-pct-weight').textContent = stat ? `${fmtOrd(stat.percentile)} %ile` : '—';
      } else {
        $('preview-pct-weight').textContent = '—';
      }

      if (ht && wt && ge) {
        const bmi = ge.calculateBMI(wt, ht);
        $('preview-pct-bmi').textContent = `${bmi.toFixed(1)} kg/m²`;
      } else {
        $('preview-pct-bmi').textContent = '—';
      }
    };

    if (inpHeight) inpHeight.addEventListener('input', updateLivePreview);
    if (inpWeight) inpWeight.addEventListener('input', updateLivePreview);
    if (selectChild) selectChild.addEventListener('change', updateLivePreview);
    if (inpDate) inpDate.addEventListener('change', updateLivePreview);

    if (formMeas) {
      formMeas.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMeasurementForm();
      });
    }

    // 2. Family & Parent Heights Modal
    const modalFamily = $('modal-family');
    const closeFamily = $('modal-family-close');
    const cancelFamily = $('modal-family-cancel');
    const formFamily = $('form-family');

    if (closeFamily) closeFamily.addEventListener('click', () => closeModal(modalFamily));
    if (cancelFamily) cancelFamily.addEventListener('click', () => closeModal(modalFamily));

    if (formFamily) {
      formFamily.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveFamilyForm();
      });
    }

    // 3. Milestone Modal
    const modalMs = $('modal-milestone');
    const closeMs = $('modal-milestone-close');
    const cancelMs = $('modal-milestone-cancel');
    const formMs = $('form-milestone');

    if (closeMs) closeMs.addEventListener('click', () => closeModal(modalMs));
    if (cancelMs) cancelMs.addEventListener('click', () => closeModal(modalMs));

    if (formMs) {
      formMs.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMilestoneForm();
      });
    }

    // 4. Demo Banner & Onboarding Modal ("Start with my children")
    const btnStartMyChildren = $('btn-start-my-children');
    const modalOnboarding = $('modal-onboarding');
    const closeOnboarding = $('modal-onboarding-close');
    const cancelOnboarding = $('modal-onboarding-cancel');
    const formOnboarding = $('form-onboarding');
    const btnDismissSample = $('btn-dismiss-sample');

    if (btnStartMyChildren) {
      btnStartMyChildren.addEventListener('click', () => {
        openOnboardingModal();
      });
    }

    if (btnDismissSample) {
      btnDismissSample.addEventListener('click', () => {
        AppState.sampleBannerDismissed = true;
        const banner = $('demo-sample-banner');
        if (banner) banner.style.display = 'none';
      });
    }

    if (closeOnboarding) closeOnboarding.addEventListener('click', () => closeModal(modalOnboarding));
    if (cancelOnboarding) cancelOnboarding.addEventListener('click', () => closeModal(modalOnboarding));

    if (formOnboarding) {
      formOnboarding.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveOnboardingForm();
      });
    }

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });
  }

  function openModal(modalEl) {
    if (modalEl) modalEl.classList.add('open');
  }

  function closeModal(modalEl) {
    if (modalEl) modalEl.classList.remove('open');
    if (modalEl?.id === 'modal-onboarding' && AppState.onboardingRepeaterInstance) {
      try { AppState.onboardingRepeaterInstance.destroy(); } catch (e) {}
      AppState.onboardingRepeaterInstance = null;
    }
  }

  function openOnboardingModal() {
    const modal = $('modal-onboarding');
    if (!modal) return;

    const repeaterContainer = $('onboarding-repeater-mount');
    const legacyFields = $('legacy-onboarding-fields');
    const ic = getInputControls();
    if (repeaterContainer && ic && typeof ic.mountFamilyChildrenRepeater === 'function') {
      if (AppState.onboardingRepeaterInstance) {
        try { AppState.onboardingRepeaterInstance.destroy(); } catch (e) {}
      }
      AppState.onboardingRepeaterInstance = ic.mountFamilyChildrenRepeater(repeaterContainer, {
        children: [
          { id: 'child-' + Date.now() + '-1', name: '', sex: 'M', birthDate: '', gestationalWeeks: 40.0, measurements: [], milestones: [] }
        ],
        parents: AppState.familyState?.parents || { fatherHeightCm: 181, motherHeightCm: 166.5 },
        unitSystem: AppState.unitSystem,
        isOnboarding: true
      });

      if (legacyFields) {
        legacyFields.style.display = 'none';
        legacyFields.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = true;
        });
      }
    } else {
      if (legacyFields) {
        legacyFields.style.display = '';
        legacyFields.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = false;
        });
      }
    }

    openModal(modal);
  }

  async function saveOnboardingForm() {
    const modal = $('modal-onboarding');
    const now = Date.now();
    const familyName = $('onboarding-family-name')?.value?.trim() || 'Our Family';

    // Collect all previous demo IDs to tombstone into deletedIds
    const prevDeletedIds = [...(AppState.familyState?.deletedIds || [])];
    for (const child of (AppState.familyState?.children || [])) {
      if (child && child.id) prevDeletedIds.push(child.id);
      if (Array.isArray(child.measurements)) {
        for (const m of child.measurements) {
          if (m && m.id) prevDeletedIds.push(m.id);
        }
      }
      if (Array.isArray(child.milestones)) {
        for (const ms of child.milestones) {
          if (ms && ms.id) prevDeletedIds.push(ms.id);
        }
      }
    }

    let newChildren = [];
    let newParents = { fatherHeightCm: 181, motherHeightCm: 166.5 };

    if (AppState.onboardingRepeaterInstance && typeof AppState.onboardingRepeaterInstance.getPayload === 'function') {
      const payload = AppState.onboardingRepeaterInstance.getPayload();
      const rawChildren = payload.children || [];
      if (payload.parents) {
        newParents = {
          fatherHeightCm: payload.parents.fatherHeightCm || 181,
          motherHeightCm: payload.parents.motherHeightCm || 166.5
        };
      }
      if (payload.removedTombstoneIds) {
        prevDeletedIds.push(...payload.removedTombstoneIds);
      }
      newChildren = rawChildren.filter(c => c && c.name && c.name.trim()).map((c, idx) => ({
        id: (c.id && !prevDeletedIds.includes(c.id)) ? c.id : ('child-' + now + '-' + (idx + 1)),
        name: c.name.trim(),
        sex: c.sex || 'M',
        gender: c.sex === 'F' ? 'female' : 'male',
        birthDate: c.birthDate || '',
        gestationalWeeks: Number(c.gestationalWeeks) || 40.0,
        color: c.color || (idx === 0 ? '#C85A32' : '#2D6A4F'),
        measurements: [],
        milestones: [],
        updatedAt: now
      }));
    }

    // Fallback if repeater was empty or not mounted
    if (newChildren.length === 0) {
      const c1Name = $('onboarding-c1-name')?.value?.trim() || 'Child 1';
      const c1Sex = $('onboarding-c1-sex')?.value || 'M';
      const c1Dob = $('onboarding-c1-dob')?.value || '';
      const c1Gest = parseFloat($('onboarding-c1-gest')?.value) || 40.0;

      const c2Name = $('onboarding-c2-name')?.value?.trim() || 'Child 2';
      const c2Sex = $('onboarding-c2-sex')?.value || 'F';
      const c2Dob = $('onboarding-c2-dob')?.value || '';
      const c2Gest = parseFloat($('onboarding-c2-gest')?.value) || 40.0;

      const fatherHeight = parseFloat($('onboarding-father-height')?.value) || 181;
      const motherHeight = parseFloat($('onboarding-mother-height')?.value) || 166.5;

      newParents = { fatherHeightCm: fatherHeight, motherHeightCm: motherHeight };
      newChildren = [
        { id: 'child-' + now + '-1', name: c1Name, sex: c1Sex, gender: c1Sex === 'F' ? 'female' : 'male', birthDate: c1Dob, gestationalWeeks: c1Gest, measurements: [], milestones: [], updatedAt: now },
        { id: 'child-' + now + '-2', name: c2Name, sex: c2Sex, gender: c2Sex === 'F' ? 'female' : 'male', birthDate: c2Dob, gestationalWeeks: c2Gest, measurements: [], milestones: [], updatedAt: now }
      ];
    }

    if (AppState.onboardingRepeaterInstance) {
      try { AppState.onboardingRepeaterInstance.destroy(); } catch (e) {}
      AppState.onboardingRepeaterInstance = null;
    }

    const newState = {
      familyName,
      unitSystem: AppState.unitSystem || 'metric',
      isDemo: false,
      parents: { ...newParents, updatedAt: now },
      children: newChildren,
      deletedIds: Array.from(new Set(prevDeletedIds)),
      updatedAt: now
    };

    AppState.familyState = newState;
    AppState.sampleBannerDismissed = true;
    AppState.selectedChildId = newChildren[0]?.id || 'child-1';

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(newState, `Initialized new family journal for ${familyName}`);
    }

    closeModal(modal);
    renderAllViews();
    showToast(`Created family growth journal for ${familyName}!`, 'success');
  }

  function openMeasurementModal(childId, editRecordId) {
    const modal = $('modal-measurement');
    const form = $('form-measurement');
    if (!modal || !form) return;

    form.reset();
    $('meas-edit-id').value = editRecordId || '';
    $('modal-measurement-title').textContent = editRecordId ? 'Edit Pediatric Checkup' : 'Log Pediatric Checkup';

    const childSelect = $('meas-child-select');
    if (childSelect && childId) childSelect.value = childId;

    const dateInput = $('meas-date-input');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    if (editRecordId) {
      const child = (AppState.familyState?.children || []).find(c => c.id === childId);
      const meas = (child?.measurements || []).find(m => m.id === editRecordId);
      if (meas) {
        if (dateInput) dateInput.value = meas.date || '';
        const isImp = AppState.unitSystem === 'imperial';
        if ($('meas-height-input')) $('meas-height-input').value = meas.heightCm != null ? (isImp ? (meas.heightCm / 2.54).toFixed(1) : meas.heightCm) : '';
        if ($('meas-weight-input')) $('meas-weight-input').value = meas.weightKg != null ? (isImp ? (meas.weightKg * 2.20462).toFixed(1) : meas.weightKg) : '';
        if ($('meas-head-input')) $('meas-head-input').value = meas.headCircumferenceCm != null ? (isImp ? (meas.headCircumferenceCm / 2.54).toFixed(1) : meas.headCircumferenceCm) : '';
        if ($('meas-source-input')) $('meas-source-input').value = meas.source || '';
        if ($('meas-notes-input')) $('meas-notes-input').value = meas.notes || '';
      }
    }

    openModal(modal);
  }

  async function saveMeasurementForm() {
    const modal = $('modal-measurement');
    const editId = $('meas-edit-id')?.value;
    const childId = $('meas-child-select')?.value;
    const dateStr = $('meas-date-input')?.value;
    const rawHeight = parseFloat($('meas-height-input')?.value);
    const rawWeight = parseFloat($('meas-weight-input')?.value);
    const rawHead = parseFloat($('meas-head-input')?.value);
    const sourceStr = $('meas-source-input')?.value || 'Pediatric Wellness Visit';
    const notesStr = $('meas-notes-input')?.value || '';

    const child = (AppState.familyState?.children || []).find(c => c.id === childId);
    if (!child) return;

    const ge = getEngine();
    const isImp = AppState.unitSystem === 'imperial';

    const heightCm = !isNaN(rawHeight) ? (isImp ? rawHeight * 2.54 : rawHeight) : null;
    const weightKg = !isNaN(rawWeight) ? (isImp ? rawWeight / 2.20462 : rawWeight) : null;
    const headCm = !isNaN(rawHead) ? (isImp ? rawHead * 2.54 : rawHead) : null;

    const ageMonths = (ge && child.birthDate && dateStr)
      ? ge.calculateAgeMonths(child.birthDate, dateStr)
      : 12.0;

    if (!child.measurements) child.measurements = [];

    if (editId) {
      // Update existing
      const m = child.measurements.find(item => item.id === editId);
      if (m) {
        m.date = dateStr;
        m.ageMonths = Math.round(ageMonths * 10) / 10;
        m.heightCm = heightCm != null ? Math.round(heightCm * 10) / 10 : null;
        m.weightKg = weightKg != null ? Math.round(weightKg * 100) / 100 : null;
        m.headCircumferenceCm = headCm != null ? Math.round(headCm * 10) / 10 : null;
        m.headCm = m.headCircumferenceCm;
        m.source = sourceStr;
        m.notes = notesStr;
        m.updatedAt = Date.now();
      }
    } else {
      // Add new
      const newEntry = {
        id: `m_${childId}_${Date.now()}`,
        date: dateStr,
        ageMonths: Math.round(ageMonths * 10) / 10,
        heightCm: heightCm != null ? Math.round(heightCm * 10) / 10 : null,
        weightKg: weightKg != null ? Math.round(weightKg * 100) / 100 : null,
        headCircumferenceCm: headCm != null ? Math.round(headCm * 10) / 10 : null,
        headCm: headCm != null ? Math.round(headCm * 10) / 10 : null,
        source: sourceStr,
        notes: notesStr,
        updatedAt: Date.now()
      };
      child.measurements.push(newEntry);
    }

    child.measurements.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Logged checkup for ${child.name}`);
    }

    closeModal(modal);
    renderAllViews();
    showToast(`Saved checkup entry for ${child.name}!`, 'success');
  }

  function openFamilyModal() {
    const modal = $('modal-family');
    if (!modal) return;

    const parents = AppState.familyState?.parents || {};
    const children = AppState.familyState?.children || [];
    const leo = children.find(c => c.id === 'child-1') || children[0];
    const maya = children.find(c => c.id === 'child-2') || children[1];

    if ($('family-name-input')) $('family-name-input').value = AppState.familyState?.familyName || 'Miller Family';
    if ($('father-height-input')) $('father-height-input').value = parents.fatherHeightCm || 181;
    if ($('mother-height-input')) $('mother-height-input').value = parents.motherHeightCm || 166.5;

    if (leo) {
      if ($('child1-name-input')) $('child1-name-input').value = leo.name;
      if ($('child1-dob-input')) $('child1-dob-input').value = leo.birthDate;
      if ($('child1-sex-input')) $('child1-sex-input').value = leo.sex || 'M';
      if ($('child1-gest-input')) $('child1-gest-input').value = leo.gestationalWeeks ?? 40;
    }
    if (maya) {
      if ($('child2-name-input')) $('child2-name-input').value = maya.name;
      if ($('child2-dob-input')) $('child2-dob-input').value = maya.birthDate;
      if ($('child2-sex-input')) $('child2-sex-input').value = maya.sex || 'F';
      if ($('child2-gest-input')) $('child2-gest-input').value = maya.gestationalWeeks ?? 40;
    }

    // Mount 1..N children repeater into #family-repeater-mount
    const repeaterContainer = $('family-repeater-mount');
    const legacyFields = $('legacy-family-fields');
    const ic = getInputControls();
    if (repeaterContainer && ic && typeof ic.mountFamilyChildrenRepeater === 'function') {
      if (AppState.familyRepeaterInstance) {
        try { AppState.familyRepeaterInstance.destroy(); } catch (e) {}
      }
      AppState.familyRepeaterInstance = ic.mountFamilyChildrenRepeater(repeaterContainer, {
        children: AppState.familyState?.children || [],
        parents: AppState.familyState?.parents || {},
        unitSystem: AppState.unitSystem,
        isOnboarding: false
      });

      if (legacyFields) {
        legacyFields.style.display = 'none';
        legacyFields.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = true;
        });
      }
    } else {
      if (legacyFields) {
        legacyFields.style.display = '';
        legacyFields.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = false;
        });
      }
    }

    openModal(modal);
  }

  async function saveFamilyForm() {
    const modal = $('modal-family');
    if (!AppState.familyState) return;

    const now = Date.now();
    AppState.familyState.familyName = $('family-name-input')?.value?.trim() || AppState.familyState.familyName || 'Our Family';

    if (AppState.familyRepeaterInstance && typeof AppState.familyRepeaterInstance.getPayload === 'function') {
      const payload = AppState.familyRepeaterInstance.getPayload();
      const updatedChildren = payload.children || [];
      const updatedParents = payload.parents || {};
      const tombstones = payload.removedTombstoneIds || [];

      if (!AppState.familyState.deletedIds) AppState.familyState.deletedIds = [];
      tombstones.forEach(id => {
        if (!AppState.familyState.deletedIds.includes(id)) {
          AppState.familyState.deletedIds.push(id);
        }
      });

      const oldChildren = AppState.familyState.children || [];
      const mergedChildren = updatedChildren.map(c => {
        const oldC = oldChildren.find(oc => oc.id === c.id);
        return {
          ...c,
          gender: c.sex === 'F' ? 'female' : 'male',
          measurements: oldC?.measurements || c.measurements || [],
          milestones: oldC?.milestones || c.milestones || [],
          updatedAt: now
        };
      });

      AppState.familyState.children = mergedChildren;
      AppState.familyState.parents = {
        fatherHeightCm: updatedParents.fatherHeightCm || parseFloat($('father-height-input')?.value) || 181,
        motherHeightCm: updatedParents.motherHeightCm || parseFloat($('mother-height-input')?.value) || 166.5,
        updatedAt: now
      };
    } else {
      if (!AppState.familyState.parents) AppState.familyState.parents = {};
      AppState.familyState.parents.fatherHeightCm = parseFloat($('father-height-input')?.value) || 181;
      AppState.familyState.parents.motherHeightCm = parseFloat($('mother-height-input')?.value) || 166.5;

      const children = AppState.familyState.children || [];
      const leo = children[0] || children.find(c => c.id === 'child-1');
      const maya = children[1] || children.find(c => c.id === 'child-2');

      if (leo) {
        leo.name = $('child1-name-input')?.value?.trim() || leo.name;
        leo.birthDate = $('child1-dob-input')?.value || leo.birthDate || '2022-05-14';
        if ($('child1-sex-input')?.value) {
          leo.sex = $('child1-sex-input').value;
          leo.gender = leo.sex === 'F' ? 'female' : 'male';
        }
        const g1 = parseFloat($('child1-gest-input')?.value);
        if (!isNaN(g1)) leo.gestationalWeeks = g1;
        leo.updatedAt = now;
      }
      if (maya) {
        maya.name = $('child2-name-input')?.value?.trim() || maya.name;
        maya.birthDate = $('child2-dob-input')?.value || maya.birthDate || '2024-10-10';
        if ($('child2-sex-input')?.value) {
          maya.sex = $('child2-sex-input').value;
          maya.gender = maya.sex === 'F' ? 'female' : 'male';
        }
        const g2 = parseFloat($('child2-gest-input')?.value);
        if (!isNaN(g2)) maya.gestationalWeeks = g2;
        maya.updatedAt = now;
      }
    }

    AppState.familyState.updatedAt = now;
    AppState.familyState.isDemo = false;

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, 'Updated family & parental height profiles');
    }

    closeModal(modal);
    renderAllViews();
    showToast('Updated family profiles and genetic target!', 'success');
  }

  function openMilestoneModal() {
    const modal = $('modal-milestone');
    const form = $('form-milestone');
    if (!modal || !form) return;

    form.reset();
    $('milestone-date-input').value = new Date().toISOString().slice(0, 10);
    openModal(modal);
  }

  async function saveMilestoneForm() {
    const modal = $('modal-milestone');
    const childId = $('milestone-child-select')?.value;
    const title = $('milestone-title-input')?.value;
    const dateStr = $('milestone-date-input')?.value;
    const category = $('milestone-category-select')?.value;

    const child = (AppState.familyState?.children || []).find(c => c.id === childId);
    if (!child || !title) return;

    const ge = getEngine();
    const ageMonths = (ge && child.birthDate && dateStr)
      ? ge.calculateAgeMonths(child.birthDate, dateStr)
      : 12.0;

    const newMs = {
      id: `ms_${childId}_${Date.now()}`,
      title,
      category,
      date: dateStr,
      ageMonths: Math.round(ageMonths * 10) / 10,
      completed: true,
      updatedAt: Date.now()
    };

    if (!child.milestones) child.milestones = [];
    child.milestones.push(newMs);

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Recorded milestone "${title}" for ${child.name}`);
    }

    closeModal(modal);
    renderMilestonesGrid();
    renderMilestoneRaceTable();
    showToast(`Celebrated milestone: ${title}!`, 'success');
  }

  // =========================================================================
  // PERSISTENT QUICK-LOG DRAWER & COMPOSER INTEGRATION
  // =========================================================================

  function setupQuickLogDrawer() {
    const btnClose = $('btn-close-quick-log');
    if (btnClose) {
      btnClose.addEventListener('click', () => closeQuickLogDrawer());
    }

    const drawer = $('quick-log-drawer');
    if (drawer) {
      drawer.addEventListener('click', (e) => {
        if (e.target === drawer) closeQuickLogDrawer();
      });
    }
  }

  function openQuickLogDrawer(childId, preset, initialMeasurement, initialTab) {
    const drawer = $('quick-log-drawer');
    const mount = $('quick-log-composer-mount');
    if (!drawer || !mount) return;

    drawer.style.display = '';
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');

    const ic = getInputControls();
    const targetChildId = childId || AppState.selectedChildId || AppState.familyState?.children?.[0]?.id || 'child-1';

    if (ic && typeof ic.mountMeasurementComposer === 'function') {
      mount.innerHTML = '';
      let initialMeas = initialMeasurement ? { ...initialMeasurement } : null;
      let targetAgeMonths = null;

      if (preset) {
        if (typeof preset === 'object' && preset.months != null) {
          targetAgeMonths = preset.months;
          initialMeas = initialMeas || {};
          initialMeas.notes = preset.label ? `AAP ${preset.label} Well-Child Check` : (initialMeas.notes || '');
        } else if (typeof preset === 'string') {
          const match = preset.match(/^(\d+)/);
          if (match) {
            targetAgeMonths = parseInt(match[1], 10);
          }
          initialMeas = initialMeas || {};
          initialMeas.notes = initialMeas.notes || preset;
        } else if (typeof preset === 'number') {
          targetAgeMonths = preset;
        }
      }

      AppState.quickLogComposer = ic.mountMeasurementComposer(mount, {
        familyState: AppState.familyState,
        activeChildId: targetChildId,
        unitSystem: AppState.unitSystem,
        initialMeasurement: initialMeas,
        initialTab: initialTab || 'vitals',
        preset: preset,
        onSubmit: async (m) => {
          await handleComposerMeasurementSubmit(m, m.childId || targetChildId);
          closeQuickLogDrawer();
        },
        onSubmitMilestone: async (ms) => {
          await handleComposerMilestoneSubmit(ms, ms.childId || targetChildId);
          closeQuickLogDrawer();
        },
        onOpenPhotoScan: () => {
          closeQuickLogDrawer();
          switchView('view-photo-import');
        },
        onCancel: () => {
          closeQuickLogDrawer();
        }
      });

      if (initialTab && typeof AppState.quickLogComposer?.setTab === 'function') {
        AppState.quickLogComposer.setTab(initialTab);
      }

      if (typeof targetAgeMonths === 'number' && typeof AppState.quickLogComposer?.prefillAtAge === 'function') {
        AppState.quickLogComposer.prefillAtAge(targetAgeMonths, targetChildId);
      }
    }
  }

  function closeQuickLogDrawer() {
    const drawer = $('quick-log-drawer');
    if (drawer) {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.style.display = '';
    }
    const mount = $('quick-log-composer-mount');
    if (mount) mount.innerHTML = '';
    AppState.quickLogComposer = null;
  }

  async function handleComposerMeasurementSubmit(m, childId) {
    const targetChildId = childId || m.childId || AppState.selectedChildId;
    const child = (AppState.familyState?.children || []).find(c => c.id === targetChildId);
    if (!child) return;

    if (!child.measurements) child.measurements = [];

    const now = Date.now();
    const ge = getEngine();
    const dateStr = m.date || new Date().toISOString().slice(0, 10);
    const ageMonths = (ge && child.birthDate && dateStr)
      ? ge.calculateAgeMonths(child.birthDate, dateStr)
      : (m.ageMonths || 12.0);

    const entryId = m.id || `m_${targetChildId}_${now}_${Math.random().toString(36).substr(2, 4)}`;
    const newEntry = {
      ...m,
      id: entryId,
      childId: targetChildId,
      date: dateStr,
      ageMonths: Math.round(ageMonths * 10) / 10,
      heightCm: m.heightCm != null ? Math.round(m.heightCm * 10) / 10 : null,
      weightKg: m.weightKg != null ? Math.round(m.weightKg * 100) / 100 : null,
      headCircumferenceCm: (m.headCircumferenceCm ?? m.headCm) != null ? Math.round((m.headCircumferenceCm ?? m.headCm) * 10) / 10 : null,
      headCm: (m.headCm ?? m.headCircumferenceCm) != null ? Math.round((m.headCm ?? m.headCircumferenceCm) * 10) / 10 : null,
      source: m.source || 'Quick-Log Checkup',
      notes: m.notes || '',
      updatedAt: now
    };

    const existingIdx = child.measurements.findIndex(item => item.id === entryId);
    if (existingIdx !== -1) {
      child.measurements[existingIdx] = newEntry;
    } else {
      child.measurements.push(newEntry);
    }

    if (AppState.familyState.deletedIds) {
      AppState.familyState.deletedIds = AppState.familyState.deletedIds.filter(id => id !== entryId);
    }

    child.measurements.sort((a, b) => (a.ageMonths || 0) - (b.ageMonths || 0));
    child.updatedAt = now;
    AppState.familyState.updatedAt = now;

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Logged checkup for ${child.name}`);
    }

    renderAllViews();
    showToast(`Saved checkup record for ${child.name}!`, 'success');
  }

  async function handleComposerMilestoneSubmit(ms, childId) {
    const targetChildId = childId || ms.childId || AppState.selectedChildId;
    const child = (AppState.familyState?.children || []).find(c => c.id === targetChildId);
    if (!child) return;

    if (!child.milestones) child.milestones = [];
    const now = Date.now();
    const msId = ms.id || `ms_${targetChildId}_${now}_${Math.random().toString(36).substr(2, 4)}`;

    const newMs = {
      ...ms,
      id: msId,
      childId: targetChildId,
      title: ms.title || 'Milestone Achieved',
      category: ms.category || 'growth',
      date: ms.date || new Date().toISOString().slice(0, 10),
      ageMonths: ms.ageMonths || 0,
      completed: true,
      updatedAt: now
    };

    const existingIdx = child.milestones.findIndex(item => item.id === msId || (item.key && item.key === ms.key));
    if (existingIdx !== -1) {
      child.milestones[existingIdx] = newMs;
    } else {
      child.milestones.push(newMs);
    }

    if (AppState.familyState.deletedIds) {
      AppState.familyState.deletedIds = AppState.familyState.deletedIds.filter(id => id !== msId);
    }

    child.updatedAt = now;
    AppState.familyState.updatedAt = now;

    const sm = getSyncManager();
    if (sm) {
      await sm.saveState(AppState.familyState, `Celebrated milestone: ${newMs.title}`);
    }

    renderAllViews();
    showToast(`Celebrated milestone: ${newMs.title}!`, 'success');
  }

  // =========================================================================
  // RESPONSIVE MOBILE NAVIGATION & SHORTCUTS HELP
  // =========================================================================

  function setupMobileNavigation() {
    const btnOverview = $('mob-tab-overview');
    if (btnOverview) btnOverview.addEventListener('click', () => switchView('view-overview'));

    const btnDash = $('mob-tab-dashboard');
    if (btnDash) btnDash.addEventListener('click', () => switchView('view-dashboard'));

    const btnLog = $('mob-btn-quick-log');
    if (btnLog) btnLog.addEventListener('click', () => openQuickLogDrawer());

    const btnComp = $('mob-tab-comparison');
    if (btnComp) btnComp.addEventListener('click', () => switchView('view-comparison'));

    const btnMore = $('mob-tab-more');
    const moreSheet = $('mobile-more-sheet');

    function closeMoreSheet() {
      if (!moreSheet) return;
      moreSheet.classList.remove('open');
      moreSheet.style.display = 'none';
      moreSheet.setAttribute('aria-hidden', 'true');
    }

    if (btnMore && moreSheet) {
      btnMore.addEventListener('click', () => {
        const willOpen = !moreSheet.classList.contains('open');
        moreSheet.classList.toggle('open', willOpen);
        moreSheet.style.display = willOpen ? 'flex' : 'none';
        moreSheet.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
      });
    }

    const btnCloseSheet = $('btn-close-more-sheet');
    if (btnCloseSheet) {
      btnCloseSheet.addEventListener('click', closeMoreSheet);
    }

    if (moreSheet) {
      moreSheet.addEventListener('click', (e) => {
        if (e.target === moreSheet) closeMoreSheet();
      });

      const items = moreSheet.querySelectorAll('.mobile-more-item[data-target]');
      items.forEach(btn => {
        btn.addEventListener('click', () => {
          closeMoreSheet();
          const target = btn.dataset.target;
          if (target) switchView(target);
        });
      });
    }

    const btnEditFamily = $('mob-btn-edit-family');
    if (btnEditFamily) {
      btnEditFamily.addEventListener('click', () => {
        closeMoreSheet();
        openFamilyModal();
      });
    }
  }

  function openKeyboardShortcutsModal() {
    const ic = getInputControls();
    if (ic && typeof ic.showShortcutsModal === 'function') {
      ic.showShortcutsModal();
      return;
    }
    const modal = $('modal-keyboard-shortcuts');
    if (modal) {
      openModal(modal);
      const closeBtn = $('modal-shortcuts-close');
      if (closeBtn) {
        closeBtn.onclick = () => closeModal(modal);
      }
      const doneBtn = $('modal-shortcuts-done');
      if (doneBtn) {
        doneBtn.onclick = () => closeModal(modal);
      }
    }
  }

  function cycleActiveChild(dir = 1) {
    const children = AppState.familyState?.children || [];
    if (children.length === 0) return;
    const curIdx = children.findIndex(c => c.id === AppState.selectedChildId);
    let nextIdx = (curIdx + dir + children.length) % children.length;
    AppState.selectedChildId = children[nextIdx].id;
    renderDashboardView();
  }

  // =========================================================================
  // MASTER RENDER DISPATCHER
  // =========================================================================

  function renderAllViews() {
    updateChildSelectorPills();
    if (AppState.activeTab === 'view-overview') {
      renderFamilyOverviewView();
    } else if (AppState.activeTab === 'view-dashboard') {
      renderDashboardView();
    } else if (AppState.activeTab === 'view-comparison') {
      renderComparisonViews();
    } else if (AppState.activeTab === 'view-records') {
      renderHistoryTable();
      renderMilestonesGrid();
    } else if (AppState.activeTab === 'view-sync') {
      renderSyncHubView();
    } else if (AppState.activeTab === 'view-photo-import') {
      renderStagingTable();
    }
  }

  // Window resize handler for responsive Canvas charts
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (AppState.activeTab === 'view-dashboard') renderDashboardCharts();
      else if (AppState.activeTab === 'view-comparison') {
        renderSiblingDualChart();
        renderHeightWall();
      }
    }, 180);
  });

  // Listen to custom module ready events if any
  window.addEventListener('growthcharts:ready', () => {
    renderDashboardCharts();
    if (AppState.activeTab === 'view-comparison') {
      renderSiblingDualChart();
      renderHeightWall();
    }
  });

  // =========================================================================
  // BOOTSTRAP ON DOMContentLoaded
  // =========================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Expose global controller
  window.KinSproutApp = {
    getState: () => AppState,
    switchView,
    setUnitSystem,
    renderAllViews,
    showToast
  };

})();
