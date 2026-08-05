
window.copyCodeSnippet = function (btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = "✓ Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove("copied");
    }, 2000);
  });
};
(() => {
  'use strict';

  /* ============================================================
     CONSTANTS
  ============================================================ */
  const STORE_KEY = 'akhilesh-dsa-newspaper-v2';
  const TZ = 'Asia/Kolkata';
  const INTERVALS = [1, 3, 7, 30, 90];
  const REWARDS = {
    checkin: 10,
    task: 3,
    problem: 15,
    revision: { ac: 8, hints: 4, failed: 1 },
    focusSession: 12
  };
  const RANKS = [
    { min: 0, name: 'Cub Reporter' },
    { min: 150, name: 'Staff Writer' },
    { min: 400, name: 'Senior Correspondent' },
    { min: 800, name: 'Desk Editor' },
    { min: 1500, name: 'Chief Editor' },
    { min: 2800, name: 'Editor-in-Chief' },
    { min: 5000, name: 'Press Baron' }
  ];
  const STREAK_FREEZE_MAX = 2;
  const MAX_DAILY_REVISIONS = 2;
  // Akhilesh already completed today's revision desk on 2026-06-29,
  // so pending/overdue revisions should be redistributed from tomorrow onward.
  const REVISION_SCHEDULE_START_DATE = '2026-06-30';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============================================================
     STATE
  ============================================================ */
  let state = loadState();
  let currentPage = 0;
  let currentMonth = todayISO().slice(0, 7) + '-01';
  let selectedDate = todayISO();
  let audioCtx = null;
  let soundEnabled = safeJSONParse(localStorage.getItem('az.soundEnabled'), true);

  // White noise state
  let whiteNoiseNode = null;
  let whiteNoiseGain = null;
  let whiteNoiseEnabled = safeJSONParse(localStorage.getItem('az.whiteNoiseEnabled'), false);
  let whiteNoiseVolume = safeJSONParse(localStorage.getItem('az.whiteNoiseVolume'), 0.3);
  const WHITE_NOISE_TYPES = ['white', 'brown', 'rain'];
  let whiteNoiseType = localStorage.getItem('az.whiteNoiseType') || 'white';
  let musicEnabled = safeJSONParse(localStorage.getItem('az.musicEnabled'), true);
  let toastTimer = null;
  let searchDebounceTimer = null;
  let dirty = false;
  let saveQueued = false;

  // ── Consistency & Accountability Engine ──
  const INACTIVITY_TAX = 15;


  // Focus timer state
  let focusState = {
    running: false,
    mode: 'focus', // focus | break
    remaining: 25 * 60,
    duration: 25 * 60,
    intervalId: null,
    problemId: ''
  };

  document.addEventListener('DOMContentLoaded', init);
  // Safety net: if init() throws partway through, don't leave the page dimmed forever.
  setTimeout(() => document.body?.classList.add('ready'), 1500);

  function safeJSONParse(raw, fallback) {
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  /* ============================================================
     INIT
  ============================================================ */
  function init() {
    // Header date (short format for the slim app header)
    const edEl = $('#editionDate');
    if (edEl) edEl.textContent = formatShortDate(todayISO());
    $('#todoDate').value = todayISO();
    $('#pSolveDate').value = todayISO();
    $('#pNextRevDate').value = addDaysISO(todayISO(), 1);
    $('#musicToggle').textContent = musicEnabled ? '♪' : '♬';
    $('#musicToggle').setAttribute('aria-pressed', String(musicEnabled));
    $('#soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
    $('#soundToggle').setAttribute('aria-pressed', String(soundEnabled));
    applyStreakFreezeIfNeeded();
    archivePendingTasksFromPreviousDays(); // NEW: mark old unfinished tasks as pending in calendar
    attachEvents();
    initFocusTimer();
    initCommandPalette();
    renderAll();
    loadStateFromBackend();
    tryAutoplay();
    requestAnimationFrame(() => $('#appRoot')?.classList.add('ready'));
  }

  function attachEvents() {
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchPage(Number(btn.dataset.page))));
    $('#startEditionBtn').addEventListener('click', () => startEdition(true));
    $('#silentStartBtn').addEventListener('click', () => startEdition(false));
    $('#musicToggle').addEventListener('click', toggleMusic);
    $('#soundToggle').addEventListener('click', toggleSound);
    $('#exportBtn').addEventListener('click', exportBackup);
    $('#checkinBtn').addEventListener('click', toggleCheckin);
    $('#todoForm').addEventListener('submit', addTodo);
    $('#editTaskForm')?.addEventListener('submit', saveEditTask);
    $('#editTaskCancelBtn')?.addEventListener('click', () => $('#editTaskDialog').close());
    $('#openProblemForm').addEventListener('click', () => openProblemDialog());
    $('#openProblemFormFront')?.addEventListener('click', () => openProblemDialog());
    $('#problemForm').addEventListener('submit', addProblem);
    $$('[data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('dialog')?.close());
    });

    $('#problemSearch').addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(renderProblems, 160);
    });
    $('#topicFilter').addEventListener('change', renderProblems);
    $('#difficultyFilter').addEventListener('change', renderProblems);
    $('#prevMonth').addEventListener('click', () => { currentMonth = addMonthsISO(currentMonth, -1); renderCalendar(); playPageRustle(.5); });
    $('#nextMonth').addEventListener('click', () => { currentMonth = addMonthsISO(currentMonth, 1); renderCalendar(); playPageRustle(.5); });
    $('#resetBtn').addEventListener('click', () => confirmDialog({
      title: 'Reset to uploaded backup?',
      body: 'This replaces every local change with the original backup data. This cannot be undone.',
      confirmLabel: 'Reset everything',
      danger: true
    }).then(ok => { if (ok) resetToSeed(); }));
    $('#importInput')?.addEventListener('change', importBackup);
    $('#headerImportInput')?.addEventListener('change', importBackup);
    $('#clearLedgerBtn').addEventListener('click', () => confirmDialog({
      title: 'Clear the new ledger?',
      body: 'All ledger entries earned in this app will be wiped. Your original backup coin balance stays untouched.',
      confirmLabel: 'Clear ledger',
      danger: true
    }).then(ok => { if (ok) clearNewLedger(); }));
    $('#musicVolDown').addEventListener('click', () => changeVolume(-0.1));
    $('#musicVolUp').addEventListener('click', () => changeVolume(0.1));

    const bgMusic = $('#bgMusic');
    bgMusic.addEventListener('error', () => toast('Background track failed to load. Music disabled for this session.', 'warn'));

    // Focus timer
    $('#focusStartPause').addEventListener('click', toggleFocusTimer);
    $('#focusReset').addEventListener('click', resetFocusTimer);
    $$('.focus-preset').forEach(btn => btn.addEventListener('click', () => setFocusDuration(Number(btn.dataset.minutes))));

    // White noise controls
    $('#whiteNoiseToggle')?.addEventListener('click', toggleWhiteNoise);
    $('#whiteNoiseVol')?.addEventListener('input', e => setWhiteNoiseVolume(Number(e.target.value)));
    $$('.wn-type-btn').forEach(btn => btn.addEventListener('click', () => setWhiteNoiseType(btn.dataset.noiseType)));
    updateWhiteNoiseUI();

    // Command palette
    $('#paletteOverlay').addEventListener('click', (e) => { if (e.target === $('#paletteOverlay')) closeCommandPalette(); });
    $('#paletteInput').addEventListener('input', renderPaletteResults);
    document.addEventListener('keydown', handleGlobalKeydown);

    // Streak freeze button
    $('#useFreezeBtn')?.addEventListener('click', useStreakFreeze);

    // Header palette button + digest copy button
    $('#paletteOpenBtn')?.addEventListener('click', toggleCommandPalette);
    $('#copyDigestBtn')?.addEventListener('click', copyDigest);

    // Motivation engine events
    $('#editGoalBtn')?.addEventListener('click', openGoalDialog);
    $('#goalForm')?.addEventListener('submit', saveGoal);
    $('#clearGoalBtn')?.addEventListener('click', clearGoal);
    $$('#goalDialog [data-close-dialog]').forEach(btn => {
      btn.addEventListener('click', () => $('#goalDialog')?.close());
    });

    window.addEventListener('beforeunload', () => { if (dirty) flushSave(); });
  }

  function handleGlobalKeydown(e) {
    const tag = document.activeElement?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (!$('#paletteOverlay').classList.contains('hidden')) closeCommandPalette();
      return;
    }
    if (typing) return;
    if (/^[1-7]$/.test(e.key)) {
      const idx = Number(e.key) - 1;
      if (idx <= 6) switchPage(idx);
    } else if (e.key.toLowerCase() === 'n') {
      openProblemDialog();
    } else if (e.key.toLowerCase() === 'c') {
      toggleCheckin();
    } else if (e.key === '?') {
      toggleCommandPalette();
    }
  }

  /* ============================================================
     STATE LOADING / NORMALIZATION
  ============================================================ */
  function loadState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try { return normalizeApp(JSON.parse(raw), false); }
      catch (err) { console.warn('Could not load saved state; falling back to seed.', err); }
    }
    // Migrate from v1 key if present
    const legacy = localStorage.getItem('akhilesh-dsa-newspaper-v1');
    if (legacy) {
      try { return normalizeApp(JSON.parse(legacy), false); }
      catch (err) { console.warn('Legacy state unreadable.', err); }
    }
    return normalizeApp(window.AZ_SEED_BACKUP?.appData || {}, true);
  }

  function normalizeApp(input, freshSeed) {
    const app = structuredCloneSafe(input);
    app.problems = Array.isArray(app.problems) ? app.problems : [];
    app.schedule = Array.isArray(app.schedule) ? app.schedule : [];
    app.todos = Array.isArray(app.todos) ? app.todos : [];
    app.calendarEvents = Array.isArray(app.calendarEvents) ? app.calendarEvents : [];
    app.meta = app.meta || {};
    app.meta.createdBy = app.meta.createdBy || 'Akhilesh Daily Revision Gazette';
    app.meta.baselineLoginDays = freshSeed ? [...(app.gamification?.loginDays || [])] : (app.meta.baselineLoginDays || []);
    app.meta.focusSessions = Array.isArray(app.meta.focusSessions) ? app.meta.focusSessions : [];

    app.gamification = app.gamification || {};
    if (typeof app.gamification.baseCoins !== 'number') app.gamification.baseCoins = Number(app.gamification.coins || 0);
    app.gamification.coinLedger = Array.isArray(app.gamification.coinLedger) ? app.gamification.coinLedger : [];
    app.gamification.loginDays = Array.isArray(app.gamification.loginDays) ? app.gamification.loginDays : [];
    app.gamification.checkinRewardDays = Array.isArray(app.gamification.checkinRewardDays) ? app.gamification.checkinRewardDays : [];
    app.gamification.streakFreezes = Number.isFinite(app.gamification.streakFreezes) ? app.gamification.streakFreezes : STREAK_FREEZE_MAX;
    app.gamification.freezeUsedDays = Array.isArray(app.gamification.freezeUsedDays) ? app.gamification.freezeUsedDays : [];
    app.gamification.lastFreezeRefill = app.gamification.lastFreezeRefill || todayISO().slice(0, 7);
    app.gamification.decayAppliedDays = Array.isArray(app.gamification.decayAppliedDays) ? app.gamification.decayAppliedDays : (safeJSONParse(localStorage.getItem('az.decayAppliedDays'), []) || []);
    app.gamification.goalConfig = app.gamification.goalConfig !== undefined ? app.gamification.goalConfig : safeJSONParse(localStorage.getItem('az.goalConfig'), null);
    app.gamification.pledges = app.gamification.pledges || safeJSONParse(localStorage.getItem('az.pledges'), {});

    app.problems = app.problems.map(p => normalizeProblem(p));

    app.todos = app.todos.map(t => ({
      id: t.id || uid('t'),
      title: t.title || t.text || 'Untitled task',
      date: isValidISO(t.date) ? t.date : todayISO(),
      done: Boolean(t.done),
      createdAt: t.createdAt || new Date().toISOString(),
      completedAt: isValidISO(t.completedAt) ? t.completedAt : (t.done ? todayISO() : ''),
      // pendingDays: array of ISO dates where task was not completed by end-of-day
      pendingDays: Array.isArray(t.pendingDays) ? t.pendingDays.filter(isValidISO) : []
    }));

    syncCoins(app);
    return app;
  }

  function normalizeProblem(p) {
    const solveDate = isValidISO(p.solveDate) ? p.solveDate : todayISO();
    let nextRevDate = isValidISO(p.nextRevDate) ? p.nextRevDate : addDaysISO(solveDate, 1);
    // Guard against a next-revision date earlier than the solve date (corrupt/garbage input)
    if (daysBetween(solveDate, nextRevDate) < 0) nextRevDate = addDaysISO(solveDate, 1);
    return {
      id: p.id || uid('p'),
      name: (p.name || 'Untitled Problem').trim() || 'Untitled Problem',
      url: p.url || '',
      status: p.status || 'Needs Revision',
      phase: p.phase || '',
      topic: (p.topic || 'Uncategorized').trim() || 'Uncategorized',
      difficulty: p.difficulty || 'Medium',
      solveDate,
      nextRevDate,
      interval: Number.isFinite(Number(p.interval)) && Number(p.interval) > 0 ? Number(p.interval) : 1,
      history: Array.isArray(p.history) ? p.history.filter(isValidISO) : [],
      revisionMistakes: Array.isArray(p.revisionMistakes) ? p.revisionMistakes : [],
      cfftd: p.cfftd || { c: '', f1: '', t: '', d: '', notes: '' },
      code: typeof p.code === 'string' ? p.code : '',
      codeLang: typeof p.codeLang === 'string' ? p.codeLang : 'cpp',
      createdAt: p.createdAt || new Date().toISOString(),
      archived: Boolean(p.archived)
    };
  }

  function structuredCloneSafe(obj) {
    try { return structuredClone(obj || {}); }
    catch { return JSON.parse(JSON.stringify(obj || {})); }
  }

  function isValidISO(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateFromISO(s).getTime());
  }

  /* ============================================================
     SAVE (debounced via rAF — avoids hammering localStorage on every render)
  ============================================================ */
  function saveState() {
    dirty = true;
    if (saveQueued) return;
    saveQueued = true;
    requestAnimationFrame(() => {
      saveQueued = false;
      flushSave();
    });
  }

  function flushSave() {
    syncCoins(state);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      dirty = false;
      saveStateToBackend();
    } catch (err) {
      console.error('Save failed', err);
      toast('Could not save — storage may be full. Export a backup to be safe.', 'warn');
    }
  }

  function syncCoins(app = state) {
    const ledgerTotal = (app.gamification.coinLedger || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    app.gamification.coins = Number(app.gamification.baseCoins || 0) + ledgerTotal;
  }

  /* ============================================================
     STREAK FREEZE
  ============================================================ */
  function applyStreakFreezeIfNeeded() {
    const month = todayISO().slice(0, 7);
    if (state.gamification.lastFreezeRefill !== month) {
      state.gamification.streakFreezes = STREAK_FREEZE_MAX;
      state.gamification.lastFreezeRefill = month;
      saveState();
    }
  }

  function yesterdayMissed() {
    const y = addDaysISO(todayISO(), -1);
    const days = new Set(state.gamification.loginDays || []);
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    return !days.has(y) && !frozen.has(y);
  }

  /* ============================================================
     DAILY TODO RESET — archive pending tasks from previous days into calendar
  ============================================================ */
  function archivePendingTasksFromPreviousDays() {
    const today = todayISO();
    let changed = false;
    state.todos.forEach(t => {
      // Skip completed tasks — they already have completedAt stamped
      if (t.done) return;
      // Only care about tasks whose assigned date is in the past
      if (!t.date || t.date >= today) return;
      // Walk every past day from task date up to (not including) today
      // and record it as a pending/missed day if not already noted
      let cursor = t.date;
      while (cursor < today) {
        if (!t.pendingDays.includes(cursor)) {
          t.pendingDays.push(cursor);
          changed = true;
        }
        cursor = addDaysISO(cursor, 1);
      }
    });
    if (changed) saveState();
  }

  function useStreakFreeze() {
    const y = addDaysISO(todayISO(), -1);
    if (state.gamification.streakFreezes <= 0) { toast('No streak freezes left this month.', 'warn'); return; }
    if (!yesterdayMissed()) { toast('Nothing to freeze — yesterday is already covered.'); return; }
    state.gamification.streakFreezes -= 1;
    state.gamification.freezeUsedDays.push(y);
    saveState();
    renderAll();
    celebrate('Streak freeze used. Yesterday is covered.');
  }

  /* ============================================================
     RENDER ORCHESTRATION
  ============================================================ */
  function renderAll() {
    syncCoins();
    if (enforceDailyRevisionLimit()) saveState();
    renderTicker();
    renderFrontPage();
    renderSchedule();
    renderTodos();
    renderFilters();
    renderProblems();
    renderCalendar();
    renderLedger();
    renderAnalytics();
    renderFocusProblemOptions();
    renderStudyHub();
    applyInactivityDecay();
    renderCoachBanner();
    renderWarRoom();
    renderPledge();
    renderChain();
    saveState();
  }

  function renderTicker() {
    const m = metricsForDate(todayISO());
    const due = dueProblems().length;
    const totalWaiting = allDueProblems().length;
    const waitingText = totalWaiting > due ? `${due}/${totalWaiting} revision${s(totalWaiting)} on today’s desk` : `${due} revision${s(due)} due`;
    const headline = `Latest News: Akhilesh solved ${m.solved} new problem${s(m.solved)} today, revised ${m.revisions}, completed ${m.tasks} task${s(m.tasks)}, has ${waitingText}, and owns ${state.gamification.coins} coins.`;
    $('#ticker').textContent = `${headline}  •  ${headline}  •  ${headline}`;
  }

  function renderFrontPage() {
    const today = todayISO();
    const m = metricsForDate(today);
    const due = dueProblems();
    const totalWaiting = allDueProblems();
    $('#todaySolved').textContent = m.solved;
    $('#todayRevised').textContent = m.revisions;
    $('#todayTasks').textContent = m.tasks;
    $('#coinCount').textContent = state.gamification.coins;
    $('#dueCount').textContent = due.length;

    // Sidebar mirrors
    const sCoins = $('#sidebarCoins');
    if (sCoins) sCoins.textContent = state.gamification.coins;
    const sStreak = $('#sidebarStreak');
    const streak = currentStreak();
    if (sStreak) sStreak.textContent = streak;
    // edition date in main content area
    const edMain = $('#editionDateMain');
    if (edMain) edMain.textContent = formatLongDate(today);

    $('#streakCount').textContent = streak;

    const rank = rankForXP(totalXP());
    $('#rankLabel').textContent = rank.name;
    $('#rankProgress').style.width = `${rankProgressPercent(totalXP())}%`;

    const totalAction = m.solved + m.revisions + m.tasks;
    $('#mainHeadline').textContent = totalAction
      ? `Akhilesh advances with ${totalAction} victory stamp${s(totalAction)} today.`
      : due.length
        ? `${due.length} revision${s(due.length)} on today's desk. Max ${MAX_DAILY_REVISIONS} only — no burnout edition.`
        : `The desk is clear, but the edition is still hungry.`;
    const carryText = totalWaiting.length > due.length
      ? ` ${totalWaiting.length - due.length} extra revision${s(totalWaiting.length - due.length)} moved forward automatically.`
      : '';
    $('#headlineSub').textContent = `Solved ${m.solved}, revised ${m.revisions}, finished ${m.tasks} task${s(m.tasks)}. Coin balance: ${state.gamification.coins}.${carryText}`;

    const claimed = state.gamification.checkinRewardDays.includes(today);
    $('#checkinBtn').textContent = claimed ? "✓ Undo Check-in −10" : 'Claim Daily Check-in +10';
    $('#checkinBtn').classList.toggle('danger', claimed);
    $('#checkinBtn').classList.toggle('gold-btn', !claimed);
    $('#streakCaption').textContent = state.gamification.loginDays.includes(today)
      ? "Today's flame is alive. Keep the edition burning."
      : 'Check in today to protect the streak.';

    const freezeRow = $('#freezeRow');
    if (freezeRow) {
      const showFreeze = yesterdayMissed() && state.gamification.streakFreezes > 0;
      freezeRow.classList.toggle('hidden', !showFreeze);
      $('#freezeCount').textContent = state.gamification.streakFreezes;
    }

    const dueList = $('#dueList');
    dueList.innerHTML = '';
    if (!due.length) {
      const baseDate = revisionSchedulingBaseDate();
      const cleanDeskText = todayISO() < baseDate
        ? `Today's revision is already done. Fresh revision desk starts tomorrow (${formatShortDate(baseDate)}).`
        : 'No revisions due. Add a problem or enjoy the clean desk.';
      dueList.append(emptyState(cleanDeskText));
    } else {
      due.forEach(p => dueList.append(revisionCard(p)));
      if (totalWaiting.length > due.length) {
        dueList.append(emptyState(`${totalWaiting.length - due.length} extra revision${s(totalWaiting.length - due.length)} was spread to the next light day. Daily cap: ${MAX_DAILY_REVISIONS}.`));
      }
    }
  }

  function revisionCard(p) {
    const div = document.createElement('div');
    div.className = 'item-card';
    const overdue = p.nextRevDate < todayISO();
    div.innerHTML = `
      <h4>${escapeHTML(p.name)}</h4>
      <div class="meta">
        <span>${escapeHTML(p.topic)}</span>
        <span>${escapeHTML(p.difficulty)}</span>
        <span class="${overdue ? 'overdue-text' : ''}">Due ${formatShortDate(p.nextRevDate)}</span>
        <span>Interval ${p.interval}d</span>
      </div>
      <div class="actions">
        ${p.url ? `<a class="btn ghost small" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">Open Problem</a>` : ''}
        <button class="btn primary small" data-revise="${p.id}">Complete Revision</button>
        <button class="btn ghost small" data-focus="${p.id}">Focus 25m</button>
        <button class="btn ghost small" data-deep-dive="${p.id}">Deep Dive</button>
        ${p.history.includes(todayISO()) ? `<button class="btn danger small" data-undo-revision="${p.id}">Undo Today</button>` : ''}
      </div>
    `;
    $('[data-revise]', div)?.addEventListener('click', () => openRevisionDialog(p.id));
    $('[data-undo-revision]', div)?.addEventListener('click', () => undoRevisionToday(p.id));
    $('[data-focus]', div)?.addEventListener('click', () => startFocusFor(p.id));
    $('[data-deep-dive]', div)?.addEventListener('click', () => openDetailModal(p.id));
    return div;
  }

  function renderSchedule() {
    const el = $('#scheduleList');
    el.innerHTML = '';
    const schedule = state.schedule || [];
    const done = schedule.filter(x => String(x.status).toLowerCase().includes('completed')).length;
    $('#scheduleProgress').textContent = schedule.length ? `${Math.round(done / schedule.length * 100)}%` : '0%';
    if (!schedule.length) return el.append(emptyState('No course schedule found in this backup.'));
    schedule.forEach(item => {
      const row = document.createElement('div');
      const status = String(item.status || '').toLowerCase();
      const dot = status.includes('completed') ? 'completed' : status.includes('progress') ? 'progress' : 'not';
      row.className = 'item-card schedule-row';
      row.innerHTML = `
        <div class="week">${escapeHTML(item.week || '')}</div>
        <div>
          <h4>${escapeHTML(item.theme || 'Untitled')}</h4>
          <div class="meta"><span>${escapeHTML(item.phase || '')}</span><span>${escapeHTML(item.topics || '')}</span></div>
        </div>
        <span class="status-dot ${dot}" title="${escapeAttr(item.status || '')}"></span>
      `;
      el.append(row);
    });
  }

  function renderTodos() {
    const el = $('#todoList');
    el.innerHTML = '';
    const today = todayISO();
    // Only show TODAY's tasks — fresh slate each day.
    // Past tasks are archived in pendingDays and visible on the calendar.
    const todayTasks = state.todos
      .filter(t => t.date === today)
      .sort((a, b) => {
         if (a.done !== b.done) return Number(a.done) - Number(b.done);
         const pVals = { 'high': 0, 'normal': 1, 'low': 2 };
         return (pVals[a.priority || 'normal'] || 1) - (pVals[b.priority || 'normal'] || 1);
      });

    if (!todayTasks.length) {
      el.append(emptyState("Fresh day, clean desk. Add today's tasks below."));
    } else {
      todayTasks.forEach(t => renderTaskRow(t, el));
    }

    // Render upcoming tasks
    let upcomingContainer = $('#upcomingTasksContainer');
    if (!upcomingContainer) {
      upcomingContainer = document.createElement('div');
      upcomingContainer.id = 'upcomingTasksContainer';
      el.parentNode.insertBefore(upcomingContainer, el.nextSibling);
    }
    
    const upcomingTasks = state.todos
      .filter(t => t.date > today)
      .sort((a, b) => {
         if (a.date !== b.date) return a.date.localeCompare(b.date);
         const pVals = { 'high': 0, 'normal': 1, 'low': 2 };
         return (pVals[a.priority || 'normal'] || 1) - (pVals[b.priority || 'normal'] || 1);
      });

    if (upcomingTasks.length > 0) {
      upcomingContainer.innerHTML = `
        <div class="section-head" style="margin-top:32px; margin-bottom:16px;">
          <div><p class="kicker">Looking Ahead</p><h2 style="font-size:1.2rem">Upcoming Tasks</h2></div>
        </div>
        <div id="upcomingTodoList" class="task-list"></div>
      `;
      const upcomingList = $('#upcomingTodoList', upcomingContainer) || $('#upcomingTodoList');
      upcomingTasks.forEach(t => renderTaskRow(t, upcomingList));
      upcomingContainer.style.display = 'block';
    } else {
      upcomingContainer.style.display = 'none';
    }
  }

  function renderTaskRow(t, container) {
    const row = document.createElement('div');
    row.className = `item-card task-row ${t.done ? 'done' : ''}`;
    let pBadge = '';
    if (t.priority === 'high') pBadge = '<span class="task-priority high">🔴 High</span>';
    else if (t.priority === 'low') pBadge = '<span class="task-priority low">🟢 Low</span>';
    
    let dateLabel = t.date === todayISO() ? 'Today' : formatShortDate(t.date);
    
    row.innerHTML = `
      <button class="check" data-toggle-task="${t.id}" title="Toggle task" aria-label="${t.done ? 'Mark task incomplete' : 'Mark task complete'}">${t.done ? '✓' : ''}</button>
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <h4 style="margin:0">${escapeHTML(t.title)}</h4>
          ${pBadge}
        </div>
        <div class="meta" style="margin-top:6px;"><span>${dateLabel}</span>${t.completedAt ? `<span>Completed ${formatShortDate(t.completedAt)}</span>` : ''}</div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
        <button class="btn ghost small" data-edit-task="${t.id}" aria-label="Edit task">Edit</button>
        <button class="btn ghost small" data-delete-task="${t.id}" aria-label="Delete task">Delete</button>
      </div>
    `;
    $('[data-toggle-task]', row).addEventListener('click', () => toggleTask(t.id));
    $('[data-delete-task]', row).addEventListener('click', () => deleteTask(t.id));
    $('[data-edit-task]', row).addEventListener('click', () => openEditTaskDialog(t.id));
    container.append(row);
  }

  function renderFilters() {
    const topics = unique(state.problems.map(p => p.topic).filter(Boolean));
    const diffs = unique(state.problems.map(p => p.difficulty).filter(Boolean));
    setSelectOptions($('#topicFilter'), topics, 'All topics');
    setSelectOptions($('#difficultyFilter'), diffs, 'All difficulties');
  }

  function setSelectOptions(select, values, placeholder) {
    const prev = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => `<option>${escapeHTML(v)}</option>`).join('');
    select.value = values.includes(prev) ? prev : '';
  }

  function renderProblems() {
    const table = $('#problemTable');
    table.innerHTML = '';
    const q = $('#problemSearch').value.trim().toLowerCase();
    const topic = $('#topicFilter').value;
    const diff = $('#difficultyFilter').value;
    let problems = state.problems.filter(p => !p.archived);
    if (q) problems = problems.filter(p => [p.name, p.topic, p.phase, p.difficulty, p.status].join(' ').toLowerCase().includes(q));
    if (topic) problems = problems.filter(p => p.topic === topic);
    if (diff) problems = problems.filter(p => p.difficulty === diff);
    problems.sort((a, b) => (a.nextRevDate || '').localeCompare(b.nextRevDate || ''));

    $('#problemCount').textContent = `${problems.length} problem${s(problems.length)}`;

    const header = document.createElement('div');
    header.className = 'problem-row header';
    header.innerHTML = '<span>Problem</span><span>Topic</span><span>Difficulty</span><span>Status</span><span>Next revision</span><span>Actions</span>';
    table.append(header);

    if (!problems.length) return table.append(emptyState('No matching problems in the archive.'));
    problems.forEach(p => {
      const wrapper = document.createElement('div');
      wrapper.className = 'problem-entry-wrap';
      const row = document.createElement('div');
      row.className = 'problem-row';
      const overdue = p.nextRevDate < todayISO();
      const hasCode = !!(p.code && p.code.trim());
      row.innerHTML = `
        <div class="problem-title" data-label="Problem">${p.url ? `<a href="${escapeAttr(p.url)}" target="_blank" rel="noopener">${escapeHTML(p.name)}</a>` : escapeHTML(p.name)}</div>
        <div data-label="Topic">${escapeHTML(p.topic)}</div>
        <div data-label="Difficulty"><span class="badge diff-${escapeAttr(p.difficulty.toLowerCase())}">${escapeHTML(p.difficulty)}</span></div>
        <div data-label="Status">${escapeHTML(p.status)}</div>
        <div data-label="Next revision" class="${overdue ? 'overdue-text' : ''}">${formatShortDate(p.nextRevDate)}<br><small>${daysUntilText(p.nextRevDate)}</small></div>
        <div data-label="Actions" class="actions">
          <button class="btn primary small" data-revise="${p.id}">Revise</button>
          ${p.history.includes(todayISO()) ? `<button class="btn danger small" data-undo-revision="${p.id}">Undo Today</button>` : ''}
          <button class="btn ghost small" data-edit-link="${p.id}">Link</button>
          <button class="btn ghost small" data-edit-problem="${p.id}">Edit</button>
          <button class="btn ghost small" data-deep-dive="${p.id}">Deep Dive</button>
          ${hasCode ? `<button class="btn ghost small code-toggle-btn" data-toggle-code="${p.id}"><span class="code-toggle-icon">▶</span> Code</button>` : ''}
          <button class="btn danger small" data-delete-problem="${p.id}">Delete</button>
        </div>
      `;
      $('[data-revise]', row).addEventListener('click', () => openRevisionDialog(p.id));
      $('[data-undo-revision]', row)?.addEventListener('click', () => undoRevisionToday(p.id));
      $('[data-edit-link]', row).addEventListener('click', () => editProblemLink(p.id));
      $('[data-edit-problem]', row).addEventListener('click', () => openProblemDialog(p.id));
      $('[data-deep-dive]', row).addEventListener('click', () => openDetailModal(p.id));
      $('[data-delete-problem]', row).addEventListener('click', () => deleteProblem(p.id));
      wrapper.append(row);

      // Code panel (hidden by default)
      if (hasCode) {
        const codePanel = document.createElement('div');
        codePanel.className = 'problem-code-panel collapsed';
        codePanel.id = `code-panel-${p.id}`;
        const lang = p.codeLang || 'cpp';
        const langLabel = lang ? lang.toUpperCase() : 'CODE';
        const escapedCode = escapeHTML(p.code);
        const highlighted = highlightCodeSyntax(escapedCode, lang);
        codePanel.innerHTML = `
          <div class="problem-code-header">
            <div class="problem-code-dots"><i></i><i></i><i></i></div>
            <span class="problem-code-lang">${escapeHTML(langLabel)}</span>
            <span class="problem-code-filename">${escapeHTML(p.name)}</span>
            <button class="problem-code-copy-btn" type="button" data-copy-code="${p.id}">📋 Copy</button>
          </div>
          <div class="problem-code-body">
            <div class="problem-code-lines">${generateLineNumbers(p.code)}</div>
            <pre class="problem-code-pre"><code>${highlighted}</code></pre>
          </div>
        `;
        $('[data-copy-code]', codePanel)?.addEventListener('click', (e) => {
          navigator.clipboard.writeText(p.code).then(() => {
            const btn = e.target;
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('copied'); }, 2000);
          });
        });
        wrapper.append(codePanel);

        $('[data-toggle-code]', row)?.addEventListener('click', () => {
          const panel = $(`#code-panel-${p.id}`);
          const btn = $(`[data-toggle-code="${p.id}"]`);
          if (panel) {
            const isCollapsed = panel.classList.contains('collapsed');
            panel.classList.toggle('collapsed');
            if (btn) {
              const icon = $('.code-toggle-icon', btn);
              if (icon) icon.textContent = isCollapsed ? '▼' : '▶';
            }
          }
        });
      }

      table.append(wrapper);
    });
  }

  function renderCalendar() {
    $('#monthLabel').textContent = monthName(currentMonth);
    const grid = $('#calendarGrid');
    grid.innerHTML = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
      const n = document.createElement('div');
      n.className = 'day-name';
      n.textContent = d;
      grid.append(n);
    });

    const first = dateFromISO(currentMonth);
    const startOffset = first.getUTCDay();
    const start = addDaysISO(currentMonth, -startOffset);
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    for (let i = 0; i < 42; i++) {
      const iso = addDaysISO(start, i);
      const m = metricsForDate(iso);
      const cell = document.createElement('button');
      cell.type = 'button';
      const outside = iso.slice(0, 7) !== currentMonth.slice(0, 7);
      const activity = m.solved + m.revisions + m.tasks + m.checkin;
      const hasPending = (m.pendingTasks || 0) > 0;
      const classes = ['day-cell'];
      if (outside) classes.push('outside');
      if (iso === todayISO()) classes.push('gold');
      else if (iso < todayISO()) {
        if (frozen.has(iso)) classes.push('frozen');
        else if (activity) classes.push('green');
        else if (hasPending) classes.push('pending-miss'); // had tasks but didn't finish them
        else classes.push('red');
      }
      if (iso === selectedDate) classes.push('selected');
      cell.className = classes.join(' ');
      cell.setAttribute('aria-label', `${formatLongDate(iso)}: ${activity} stamps${hasPending ? ', ' + m.pendingTasks + ' pending' : ''}`);
      let label;
      if (frozen.has(iso)) label = 'frozen';
      else if (activity && hasPending) label = `${activity} done, ${m.pendingTasks} pending`;
      else if (activity) label = `${activity} stamp${s(activity)}`;
      else if (hasPending && iso < todayISO()) label = `${m.pendingTasks} pending`;
      else if (iso < todayISO()) label = 'missed';
      else label = 'planned';
      cell.innerHTML = `<strong>${Number(iso.slice(8, 10))}</strong><small>${label}</small>`;
      cell.addEventListener('click', () => { selectedDate = iso; playTick(); renderCalendar(); renderSelectedDate(); });
      grid.append(cell);
    }
    renderSelectedDate();
  }

  function renderSelectedDate() {
    $('#selectedDateTitle').textContent = formatLongDate(selectedDate);
    const el = $('#selectedDateDetails');
    el.innerHTML = '';
    const m = metricsForDate(selectedDate);
    const pendingForDay = state.todos.filter(t => !t.done && (t.pendingDays || []).includes(selectedDate)).map(t => t.title);
    const cards = [
      ['Problems solved', m.solved, namesForSolvedDate(selectedDate)],
      ['Revisions stamped', m.revisions, namesForRevisedDate(selectedDate)],
      ['Tasks completed', m.tasks, tasksForDate(selectedDate).filter(t => t.done && t.completedAt === selectedDate).map(t => t.title)],
      ['Check-in', m.checkin, state.gamification.loginDays.includes(selectedDate) ? ['Daily flame recorded'] : []]
    ];
    
    // Add planned tasks if selectedDate is in the future or today
    if (selectedDate >= todayISO()) {
      const plannedTasks = state.todos.filter(t => t.date === selectedDate && !t.done).map(t => t.title);
      if (plannedTasks.length > 0) {
        cards.push(['Planned tasks', plannedTasks.length, plannedTasks]);
      }
    }
    cards.forEach(([title, count, names]) => {
      const div = document.createElement('div');
      div.className = 'item-card';
      div.innerHTML = `<h4>${title}: ${count}</h4><div class="meta">${names.length ? names.map(n => `<span>${escapeHTML(n)}</span>`).join('') : '<span>No stamp</span>'}</div>`;
      el.append(div);
    });
    // Show pending/missed tasks for this date if any
    if (pendingForDay.length && selectedDate < todayISO()) {
      const div = document.createElement('div');
      div.className = 'item-card';
      div.style.borderLeft = '3px solid var(--gold)';
      div.innerHTML = `<h4>⚠ Pending tasks (not completed): ${pendingForDay.length}</h4><div class="meta">${pendingForDay.map(n => `<span style="color:var(--ink-60)">${escapeHTML(n)}</span>`).join('')}</div>`;
      el.append(div);
    }
  }

  function renderLedger() {
    const el = $('#ledgerList');
    el.innerHTML = '';
    const entries = [...state.gamification.coinLedger].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!entries.length) return el.append(emptyState(`No new ledger entries yet. Seed coins preserved: ${state.gamification.baseCoins}.`));
    entries.slice(0, 80).forEach(e => {
      const row = document.createElement('div');
      row.className = `item-card ledger-entry ${Number(e.amount) >= 0 ? 'positive' : 'negative'}`;
      row.innerHTML = `
        <span class="amount">${Number(e.amount) >= 0 ? '+' : ''}${e.amount}</span>
        <div><h4>${escapeHTML(e.label || e.type || 'Reward')}</h4><div class="meta"><span>${formatDateTime(e.createdAt)}</span>${e.status === 'reversed' ? '<span>reversed</span>' : ''}</div></div>
        <span class="badge">${escapeHTML(e.type || 'coin')}</span>
      `;
      el.append(row);
    });
  }

  /* ============================================================
     ANALYTICS / MASTERY PAGE
  ============================================================ */
  function totalXP() {
    // XP derived from positive ledger entries only (reversals don't count against rank)
    return state.gamification.coinLedger
      .filter(e => Number(e.amount) > 0 && e.status !== 'reversed')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }

  function rankForXP(xp) {
    let current = RANKS[0];
    for (const r of RANKS) if (xp >= r.min) current = r;
    return current;
  }

  function rankProgressPercent(xp) {
    const idx = RANKS.findIndex(r => r === rankForXP(xp));
    const next = RANKS[idx + 1];
    if (!next) return 100;
    const cur = RANKS[idx];
    const span = next.min - cur.min;
    return Math.max(2, Math.min(100, Math.round(((xp - cur.min) / span) * 100)));
  }

  function topicStats() {
    const map = new Map();
    state.problems.filter(p => !p.archived).forEach(p => {
      if (!map.has(p.topic)) map.set(p.topic, { topic: p.topic, total: 0, ac: 0, hints: 0, failed: 0, revisions: 0 });
      const t = map.get(p.topic);
      t.total++;
      (p.revisionMistakes || []).forEach(m => {
        t.revisions++;
        if (m.outcome === 'ac') t.ac++;
        else if (m.outcome === 'hints') t.hints++;
        else if (m.outcome === 'failed') t.failed++;
      });
    });
    return [...map.values()].map(t => ({
      ...t,
      mastery: t.revisions ? Math.round((t.ac / t.revisions) * 100) : (t.total ? 40 : 0)
    })).sort((a, b) => b.total - a.total);
  }

  function outcomeBreakdown() {
    const out = { ac: 0, hints: 0, failed: 0 };
    state.problems.forEach(p => (p.revisionMistakes || []).forEach(m => {
      if (out[m.outcome] !== undefined) out[m.outcome]++;
    }));
    return out;
  }

  function last7DaysActivity() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const iso = addDaysISO(todayISO(), -i);
      const m = metricsForDate(iso);
      days.push({ iso, total: m.solved + m.revisions + m.tasks });
    }
    return days;
  }

  function weeklyDigestText() {
    const days = last7DaysActivity();
    const solved = state.problems.filter(p => days.some(d => d.iso === p.solveDate)).length;
    const revisions = days.reduce((sum, d) => {
      const m = metricsForDate(d.iso);
      return sum + m.revisions;
    }, 0);
    const tasks = days.reduce((sum, d) => sum + metricsForDate(d.iso).tasks, 0);
    const activedays = days.filter(d => d.total > 0).length;
    const stats = topicStats();
    const topTopic = stats[0]?.topic || '—';
    const streak = currentStreak();
    return [
      `AKHILESH DAILY REVISION GAZETTE — WEEKLY DIGEST`,
      `${formatShortDate(days[0].iso)} – ${formatShortDate(days[6].iso)}`,
      ``,
      `Problems solved: ${solved}`,
      `Revisions stamped: ${revisions}`,
      `Tasks completed: ${tasks}`,
      `Active days: ${activedays}/7`,
      `Current streak: ${streak} day${s(streak)}`,
      `Most-worked topic: ${topTopic}`,
      `Coin balance: ${state.gamification.coins}`,
      `Rank: ${rankForXP(totalXP()).name}`
    ].join('\n');
  }

  function renderAnalytics() {
    const wrap = $('#analyticsWrap');
    if (!wrap) return;

    // Summary stat strip
    const stats = topicStats();
    const breakdown = outcomeBreakdown();
    const totalRevisions = breakdown.ac + breakdown.hints + breakdown.failed;
    const accuracy = totalRevisions ? Math.round((breakdown.ac / totalRevisions) * 100) : 0;
    $('#statAccuracy').textContent = totalRevisions ? `${accuracy}%` : '—';
    $('#statTopics').textContent = stats.length;
    $('#statTotalProblems').textContent = state.problems.filter(p => !p.archived).length;
    $('#statTotalRevisions').textContent = totalRevisions;

    // 7-day bar chart
    const chart = $('#weeklyChart');
    chart.innerHTML = '';
    const days = last7DaysActivity();
    const max = Math.max(1, ...days.map(d => d.total));
    days.forEach(d => {
      const col = document.createElement('div');
      col.className = 'bar-col';
      const h = Math.max(4, Math.round((d.total / max) * 100));
      col.innerHTML = `
        <div class="bar-track"><div class="bar-fill" style="height:${h}%"><span class="bar-value">${d.total || ''}</span></div></div>
        <small>${new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(dateFromISO(d.iso))}</small>
      `;
      chart.append(col);
    });

    // Topic mastery rings
    const ringWrap = $('#topicMastery');
    ringWrap.innerHTML = '';
    if (!stats.length) {
      ringWrap.append(emptyState('No problems logged yet — mastery rings appear once you add problems.'));
    } else {
      stats.forEach(t => ringWrap.append(masteryRing(t)));
    }

    // Outcome breakdown bar
    const obWrap = $('#outcomeBreakdown');
    const totalOut = Math.max(1, totalRevisions);
    obWrap.innerHTML = `
      <div class="outcome-bar">
        <div class="seg ac" style="width:${breakdown.ac / totalOut * 100}%" title="Got AC: ${breakdown.ac}"></div>
        <div class="seg hints" style="width:${breakdown.hints / totalOut * 100}%" title="Needed hints: ${breakdown.hints}"></div>
        <div class="seg failed" style="width:${breakdown.failed / totalOut * 100}%" title="Forgot: ${breakdown.failed}"></div>
      </div>
      <div class="outcome-legend">
        <span><i class="dot ac-dot"></i>Got AC (${breakdown.ac})</span>
        <span><i class="dot hints-dot"></i>Needed hints (${breakdown.hints})</span>
        <span><i class="dot failed-dot"></i>Forgot/failed (${breakdown.failed})</span>
      </div>
    `;

    // Weekly digest text block
    $('#digestText').textContent = weeklyDigestText();

    // Focus session stats
    const sessions = state.meta.focusSessions || [];
    const totalFocusMin = Math.round(sessions.reduce((sum, x) => sum + (x.minutes || 0), 0));
    $('#statFocusMinutes').textContent = totalFocusMin;
    $('#statFocusSessions').textContent = sessions.length;
  }

  function masteryRing(t) {
    const div = document.createElement('div');
    div.className = 'mastery-ring-card';
    const pct = t.mastery;
    const circumference = 2 * Math.PI * 30;
    const offset = circumference - (pct / 100) * circumference;
    div.innerHTML = `
      <svg viewBox="0 0 72 72" class="mastery-svg">
        <circle cx="36" cy="36" r="30" class="ring-bg"></circle>
        <circle cx="36" cy="36" r="30" class="ring-fill" style="stroke-dasharray:${circumference};stroke-dashoffset:${offset}"></circle>
        <text x="36" y="41" text-anchor="middle" class="ring-text">${pct}%</text>
      </svg>
      <div class="mastery-label">
        <strong>${escapeHTML(t.topic)}</strong>
        <span>${t.total} problem${s(t.total)} · ${t.revisions} revision${s(t.revisions)}</span>
      </div>
    `;
    return div;
  }

  function copyDigest() {
    const text = weeklyDigestText();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Weekly digest copied to clipboard.'),
        () => toast('Could not copy — select and copy manually.', 'warn')
      );
    } else {
      toast('Clipboard not available in this browser.', 'warn');
    }
  }

  /* ============================================================
     FOCUS TIMER (Pomodoro-style)
  ============================================================ */
  function initFocusTimer() {
    updateFocusDisplay();
  }

  function renderFocusProblemOptions() {
    const select = $('#focusProblemSelect');
    if (!select) return;
    const prev = select.value;
    const problems = state.problems.filter(p => !p.archived);
    select.innerHTML = '<option value="">General focus session</option>' +
      problems.map(p => `<option value="${escapeAttr(p.id)}">${escapeHTML(p.name)}</option>`).join('');
    select.value = problems.some(p => p.id === prev) ? prev : (focusState.problemId || '');
  }

  function startFocusFor(problemId) {
    focusState.problemId = problemId;
    const select = $('#focusProblemSelect');
    if (select) select.value = problemId;
    switchPage(1);
    setTimeout(() => {
      $('#focusCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!focusState.running) toggleFocusTimer();
    }, 280);
  }

  function setFocusDuration(minutes) {
    if (focusState.running) { toast('Pause the timer before changing duration.'); return; }
    focusState.duration = minutes * 60;
    focusState.remaining = minutes * 60;
    focusState.mode = 'focus';
    $$('.focus-preset').forEach(b => b.classList.toggle('active', Number(b.dataset.minutes) === minutes));
    updateFocusDisplay();
  }

  function toggleFocusTimer() {
    unlockAudio();
    focusState.problemId = $('#focusProblemSelect')?.value || '';
    if (focusState.running) {
      clearInterval(focusState.intervalId);
      focusState.running = false;
    } else {
      focusState.running = true;
      focusState.intervalId = setInterval(focusTick, 1000);
    }
    updateFocusDisplay();
  }

  function focusTick() {
    focusState.remaining--;
    if (focusState.remaining <= 0) {
      clearInterval(focusState.intervalId);
      focusState.running = false;
      onFocusComplete();
      return;
    }
    updateFocusDisplay();
  }

  function onFocusComplete() {
    if (focusState.mode === 'focus') {
      const minutes = Math.round(focusState.duration / 60);
      state.meta.focusSessions.push({
        date: todayISO(),
        minutes,
        problemId: focusState.problemId || null,
        createdAt: new Date().toISOString()
      });
      const ledgerId = `focus:${Date.now()}`;
      addReward(ledgerId, REWARDS.focusSession, `Focus session complete (${minutes}m)`, { problemId: focusState.problemId });
      celebrate(`Focus session complete. +${REWARDS.focusSession} coins`);
      focusState.mode = 'break';
      focusState.duration = 5 * 60;
      focusState.remaining = 5 * 60;
      saveState();
      renderAll();
    } else {
      toast('Break finished. Ready for another focus round?');
      focusState.mode = 'focus';
      focusState.duration = 25 * 60;
      focusState.remaining = 25 * 60;
    }
    updateFocusDisplay();
    playPageRustle();
  }

  function resetFocusTimer() {
    clearInterval(focusState.intervalId);
    focusState.running = false;
    focusState.mode = 'focus';
    focusState.duration = 25 * 60;
    focusState.remaining = 25 * 60;
    $$('.focus-preset').forEach(b => b.classList.toggle('active', Number(b.dataset.minutes) === 25));
    updateFocusDisplay();
  }

  function updateFocusDisplay() {
    const min = Math.floor(focusState.remaining / 60).toString().padStart(2, '0');
    const sec = Math.floor(focusState.remaining % 60).toString().padStart(2, '0');
    const display = $('#focusTimeDisplay');
    if (display) display.textContent = `${min}:${sec}`;
    const label = $('#focusModeLabel');
    if (label) label.textContent = focusState.mode === 'focus' ? 'Focus block' : 'Short break';
    const btn = $('#focusStartPause');
    if (btn) btn.textContent = focusState.running ? 'Pause' : 'Start';
    const ring = $('#focusRing');
    if (ring) {
      const pct = 1 - focusState.remaining / focusState.duration;
      const circumference = 2 * Math.PI * 54;
      ring.style.strokeDasharray = `${circumference}`;
      ring.style.strokeDashoffset = `${circumference * (1 - pct)}`;
    }
    document.title = focusState.running
      ? `${min}:${sec} · ${focusState.mode === 'focus' ? 'Focus' : 'Break'} — Akhilesh Gazette`
      : 'Akhilesh Daily Revision Gazette';
  }

  /* ============================================================
     COMMAND PALETTE
  ============================================================ */
  let paletteCommands = [];

  function initCommandPalette() {
    paletteCommands = [
      { label: 'Go to Front Page', hint: '1', action: () => switchPage(0) },
      { label: 'Go to Desk Planner', hint: '2', action: () => switchPage(1) },
      { label: 'Go to Problem Log', hint: '3', action: () => switchPage(2) },
      { label: 'Go to Calendar', hint: '4', action: () => switchPage(3) },
      { label: 'Go to Mastery Desk', hint: '5', action: () => switchPage(4) },
      { label: 'Go to Reward Vault', hint: '6', action: () => switchPage(5) },
      { label: 'Go to Study Hub', hint: '7', action: () => switchPage(6) },
      { label: 'Add a new problem', hint: 'N', action: () => openProblemDialog() },
      { label: 'Toggle daily check-in', hint: 'C', action: () => toggleCheckin() },
      { label: 'Start 25-minute focus session', action: () => startFocusFor('') },
      { label: 'Export backup JSON', action: () => exportBackup() },
      { label: 'Copy weekly digest', action: () => copyDigest() },
      { label: 'Toggle music', action: () => toggleMusic() },
      { label: 'Toggle sound effects', action: () => toggleSound() }
    ];
  }

  function toggleCommandPalette() {
    const overlay = $('#paletteOverlay');
    if (overlay.classList.contains('hidden')) openCommandPalette();
    else closeCommandPalette();
  }

  function openCommandPalette() {
    const overlay = $('#paletteOverlay');
    overlay.classList.remove('hidden');
    $('#paletteInput').value = '';
    renderPaletteResults();
    setTimeout(() => $('#paletteInput').focus(), 30);
  }

  function closeCommandPalette() {
    $('#paletteOverlay').classList.add('hidden');
  }

  function renderPaletteResults() {
    const q = $('#paletteInput').value.trim().toLowerCase();
    const list = $('#paletteResults');
    list.innerHTML = '';
    const matches = paletteCommands.filter(c => c.label.toLowerCase().includes(q));
    if (!matches.length) {
      list.append(emptyState('No matching command.'));
      return;
    }
    matches.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-item';
      btn.innerHTML = `<span>${escapeHTML(c.label)}</span>${c.hint ? `<kbd>${escapeHTML(c.hint)}</kbd>` : ''}`;
      btn.addEventListener('click', () => { closeCommandPalette(); c.action(); });
      if (i === 0) btn.classList.add('highlighted');
      list.append(btn);
    });
  }

  /* ============================================================
     CUSTOM CONFIRM DIALOG (replaces native confirm())
  ============================================================ */
  function confirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise(resolve => {
      const dlg = $('#confirmDialog');
      $('#confirmTitle').textContent = title;
      $('#confirmBody').textContent = body;
      const okBtn = $('#confirmOkBtn');
      okBtn.textContent = confirmLabel;
      okBtn.classList.toggle('danger', danger);
      $('#confirmCancelBtn').textContent = cancelLabel;

      const cleanup = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onCancel);
      };
      const onOk = () => { cleanup(); dlg.close(); resolve(true); };
      const onCancel = () => { cleanup(); dlg.close(); resolve(false); };
      const cancelBtn = $('#confirmCancelBtn');
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
    });
  }

  /* ============================================================
     CUSTOM PROMPT DIALOG (replaces native prompt())
  ============================================================ */
  function promptDialog({ title, body, initialValue = '', placeholder = '' }) {
    return new Promise(resolve => {
      const dlg = $('#promptDialog');
      $('#promptTitle').textContent = title;
      $('#promptBody').textContent = body;
      const input = $('#promptInput');
      input.value = initialValue;
      input.placeholder = placeholder;

      const okBtn = $('#promptOkBtn');
      const cancelBtn = $('#promptCancelBtn');
      const cleanup = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onCancel);
      };
      const onOk = () => { const v = input.value; cleanup(); dlg.close(); resolve(v); };
      const onCancel = () => { cleanup(); dlg.close(); resolve(null); };
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
      setTimeout(() => input.focus(), 30);
    });
  }

  /* ============================================================
     TODOS
  ============================================================ */
  function addTodo(ev) {
    ev.preventDefault();
    const title = $('#todoInput').value.trim();
    if (!title) return;
    const priority = $('#todoPriority')?.value || 'normal';
    const today = todayISO();
    // Always assign new tasks to today — no carrying over to other dates
    state.todos.push({ id: uid('t'), title, priority, date: today, done: false, createdAt: new Date().toISOString(), completedAt: '', pendingDays: [] });
    $('#todoInput').value = '';
    if ($('#todoPriority')) $('#todoPriority').value = 'normal';
    // Keep the date input locked to today
    $('#todoDate').value = today;
    saveState();
    renderAll();
    playTick();
    toast('Task added to the desk.');
  }

  function toggleTask(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    const ledgerId = `task:done:${id}`;
    if (t.done) {
      t.completedAt = todayISO();
      addReward(ledgerId, REWARDS.task, `Task completed: ${t.title}`, { taskId: id });
      celebrate('Task completed. +3 coins');
    } else {
      t.completedAt = '';
      revertReward(ledgerId, 'Task unchecked');
      toast('Task unchecked. Coins reverted.');
      playTick();
    }
    saveState();
    renderAll();
  }

  async function deleteTask(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    const ok = await confirmDialog({
      title: 'Delete this task?',
      body: `"${t.title}" will be removed. Any task reward will be reversed.`,
      confirmLabel: 'Delete task',
      danger: true
    });
    if (!ok) return;
    revertReward(`task:done:${id}`, 'Task deleted');
    state.todos = state.todos.filter(x => x.id !== id);
    saveState();
    renderAll();
    toast('Task deleted. Any task reward was reverted.');
  }

  let editingTaskId = null;
  function openEditTaskDialog(id) {
    const t = state.todos.find(x => x.id === id);
    if (!t) return;
    editingTaskId = id;
    $('#editTaskTitle').value = t.title;
    $('#editTaskDate').value = t.date;
    $('#editTaskPriority').value = t.priority || 'normal';
    $('#editTaskDialog').showModal();
    setTimeout(() => $('#editTaskTitle').focus(), 30);
  }

  function saveEditTask(ev) {
    ev.preventDefault();
    if (!editingTaskId) return;
    const t = state.todos.find(x => x.id === editingTaskId);
    if (!t) return;
    
    t.title = $('#editTaskTitle').value.trim();
    if (!t.title) { toast('Task title is required.', 'warn'); return; }
    
    const newDate = $('#editTaskDate').value;
    if (newDate && isValidISO(newDate)) {
        t.date = newDate;
    }
    t.priority = $('#editTaskPriority').value || 'normal';
    
    saveState();
    renderAll();
    $('#editTaskDialog').close();
    toast('Task updated.');
  }

  /* ============================================================
     PROBLEMS — add / edit / delete
  ============================================================ */
  let editingProblemId = '';

  function openProblemDialog(id = '') {
    editingProblemId = id;
    const dlg = $('#problemDialog');
    const titleEl = $('#problemDialogTitle');
    const submitBtn = $('#problemSubmitBtn');
    if (id) {
      const p = state.problems.find(x => x.id === id);
      if (!p) return;
      titleEl.textContent = 'Edit Problem';
      submitBtn.textContent = 'Save Changes';
      $('#pName').value = p.name;
      $('#pUrl').value = p.url;
      $('#pTopic').value = p.topic;
      $('#pPhase').value = p.phase;
      $('#pDifficulty').value = p.difficulty;
      $('#pStatus').value = p.status;
      $('#pSolveDate').value = p.solveDate;
      $('#pNextRevDate').value = p.nextRevDate;
      $('#pNotes').value = p.cfftd?.notes || '';
      $('#pCode').value = p.code || '';
      $('#pCodeLang').value = p.codeLang || 'cpp';
    } else {
      titleEl.textContent = 'Add Problem';
      submitBtn.textContent = 'Publish Problem +15';
      $('#problemForm').reset();
      $('#pTopic').value = 'Binary Search';
      $('#pPhase').value = 'Phase 2';
      $('#pSolveDate').value = todayISO();
      $('#pNextRevDate').value = addDaysISO(todayISO(), 1);
      $('#pCode').value = '';
      $('#pCodeLang').value = 'cpp';
    }
    dlg.showModal();
    setTimeout(() => $('#pName').focus(), 30);
  }

  function addProblem(ev) {
    ev.preventDefault();
    const name = $('#pName').value.trim();
    if (!name) { toast('Problem name is required.', 'warn'); return; }

    const solveDate = isValidISO($('#pSolveDate').value) ? $('#pSolveDate').value : todayISO();
    let nextRevDate = isValidISO($('#pNextRevDate').value) ? $('#pNextRevDate').value : addDaysISO(solveDate, 1);
    if (daysBetween(solveDate, nextRevDate) < 0) {
      toast('Next revision date was before the solve date — corrected to solve date + 1.', 'warn');
      nextRevDate = addDaysISO(solveDate, 1);
    }
    const interval = Math.max(1, daysBetween(solveDate, nextRevDate) || 1);
    const problemTopic = $('#pTopic').value.trim() || 'Uncategorized';
    const scheduledNextRevDate = findRevisionSlot(nextRevDate, editingProblemId || '', null, problemTopic);

    if (editingProblemId) {
      const p = state.problems.find(x => x.id === editingProblemId);
      if (!p) return;
      p.name = name;
      p.url = $('#pUrl').value.trim();
      p.topic = $('#pTopic').value.trim() || 'Uncategorized';
      p.phase = $('#pPhase').value.trim();
      p.difficulty = $('#pDifficulty').value;
      p.status = $('#pStatus').value;
      p.solveDate = solveDate;
      p.nextRevDate = scheduledNextRevDate;
      p.interval = interval;
      p.cfftd = p.cfftd || { c: '', f1: '', t: '', d: '', notes: '' };
      p.cfftd.notes = $('#pNotes').value.trim();
      p.code = $('#pCode').value;
      p.codeLang = $('#pCodeLang').value || 'cpp';
      $('#problemDialog').close();
      saveState();
      renderAll();
      toast('Problem updated.');
    } else {
      const p = {
        id: uid('p'),
        name,
        url: $('#pUrl').value.trim(),
        topic: $('#pTopic').value.trim() || 'Uncategorized',
        phase: $('#pPhase').value.trim(),
        difficulty: $('#pDifficulty').value,
        status: $('#pStatus').value,
        solveDate,
        nextRevDate: scheduledNextRevDate,
        interval,
        history: [],
        revisionMistakes: [],
        cfftd: { c: '', f1: '', t: '', d: '', notes: $('#pNotes').value.trim() },
        code: $('#pCode').value,
        codeLang: $('#pCodeLang').value || 'cpp',
        createdAt: new Date().toISOString(),
        archived: false
      };
      state.problems.push(p);
      addReward(`problem:add:${p.id}`, REWARDS.problem, `New problem published: ${p.name}`, { problemId: p.id });
      $('#problemDialog').close();
      saveState();
      renderAll();
      celebrate('Problem added. +15 coins');
    }
    editingProblemId = '';
  }

  function openRevisionDialog(id) {
    openDetailModal(id, "revise");
  }

  function recordRevision(id, outcome, mistakes, notes) {
    const p = state.problems.find(x => x.id === id);
    if (!p) return;
    const today = todayISO();
    if (p.history.includes(today)) {
      toast('This problem is already revised today. Undo it first if you want to redo.', 'warn');
      return;
    }
    mistakes = mistakes.trim();
    notes = notes.trim();
    const prevInterval = Number(p.interval || 1);
    const prevNextRevDate = p.nextRevDate;
    const nextInterval = nextIntervalFor(prevInterval, outcome);
    const intendedNextRevDate = addDaysISO(today, nextInterval);
    const newNextRevDate = findRevisionSlot(intendedNextRevDate, id, null, p.topic || '');
    const ledgerId = `revision:${id}:${today}`;

    p.history.push(today);
    p.interval = nextInterval;
    p.nextRevDate = newNextRevDate;
    p.status = outcome === 'failed' ? 'Needs Revision' : 'Got AC';
    p.cfftd = p.cfftd || { c: '', f1: '', t: '', d: '', notes: '' };
    if (notes) p.cfftd.notes = notes;
    p.revisionMistakes.push({
      date: today,
      outcome,
      mistakes,
      notes,
      prevInterval,
      prevNextRevDate,
      newInterval: nextInterval,
      newNextRevDate,
      ledgerId,
      createdAt: new Date().toISOString()
    });
    addReward(ledgerId, REWARDS.revision[outcome], `Revision stamped: ${p.name} (${labelOutcome(outcome)})`, { problemId: id, outcome });
    saveState();
    renderAll();
    celebrate(`Revision stamped. +${REWARDS.revision[outcome]} coins`);
  }

  function undoRevisionToday(id) {
    const p = state.problems.find(x => x.id === id);
    if (!p) return;
    const today = todayISO();
    if (!p.history.includes(today)) return;
    const metaIndex = [...p.revisionMistakes].reverse().findIndex(m => m.date === today);
    let meta = null;
    if (metaIndex >= 0) {
      const realIndex = p.revisionMistakes.length - 1 - metaIndex;
      meta = p.revisionMistakes[realIndex];
      p.revisionMistakes.splice(realIndex, 1);
    }
    const historyIndex = p.history.lastIndexOf(today);
    if (historyIndex >= 0) p.history.splice(historyIndex, 1);
    if (meta?.prevInterval) p.interval = meta.prevInterval;
    if (meta?.prevNextRevDate) p.nextRevDate = meta.prevNextRevDate;
    revertReward(meta?.ledgerId || `revision:${id}:${today}`, 'Revision undone');
    saveState();
    renderAll();
    toast("Today's revision was undone. Coins and schedule were reverted.");
  }

  function toggleCheckin() {
    const today = todayISO();
    const claimed = state.gamification.checkinRewardDays.includes(today);
    const ledgerId = `checkin:${today}`;
    if (claimed) {
      state.gamification.checkinRewardDays = state.gamification.checkinRewardDays.filter(d => d !== today);
      if (!state.meta.baselineLoginDays.includes(today)) {
        state.gamification.loginDays = state.gamification.loginDays.filter(d => d !== today);
      }
      revertReward(ledgerId, 'Daily check-in undone');
      saveState();
      renderAll();
      toast('Daily check-in undone. +10 coins reverted.');
      playTick();
      return;
    }
    if (!state.gamification.loginDays.includes(today)) state.gamification.loginDays.push(today);
    state.gamification.checkinRewardDays.push(today);
    state.gamification.lastLoginDate = today;
    state.gamification.lastDailyRewardDate = today;
    addReward(ledgerId, REWARDS.checkin, 'Daily check-in claimed', { date: today });
    saveState();
    renderAll();
    celebrate('Daily check-in claimed. +10 coins');
  }

  async function editProblemLink(id) {
    const p = state.problems.find(x => x.id === id);
    if (!p) return;
    const url = await promptDialog({
      title: 'Update problem link',
      body: `Paste or update the link for "${p.name}".`,
      initialValue: p.url || '',
      placeholder: 'https://...'
    });
    if (url === null) return;
    p.url = url.trim();
    saveState();
    renderAll();
    toast('Problem link updated.');
  }

  async function deleteProblem(id) {
    const p = state.problems.find(x => x.id === id);
    if (!p) return;
    const ok = await confirmDialog({
      title: 'Delete this problem?',
      body: `"${p.name}" and its revision history will be removed. The +15 add-problem reward will be reverted if it came from this app.`,
      confirmLabel: 'Delete problem',
      danger: true
    });
    if (!ok) return;
    revertReward(`problem:add:${id}`, 'Problem deleted');
    state.problems = state.problems.filter(x => x.id !== id);
    saveState();
    renderAll();
    toast('Problem deleted. Add-problem reward reverted if applicable.');
  }

  /* ============================================================
     COIN LEDGER
  ============================================================ */
  function addReward(id, amount, label, meta = {}) {
    if (hasActiveLedger(id)) return false;
    state.gamification.coinLedger.push({
      id,
      type: meta.outcome ? 'revision' : id.split(':')[0],
      amount: Number(amount),
      label,
      meta,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    syncCoins();
    return true;
  }

  function revertReward(id, reason) {
    const original = [...state.gamification.coinLedger].reverse().find(e => e.id === id && e.status !== 'reversed' && Number(e.amount) > 0);
    if (!original) return false;
    original.status = 'reversed';
    state.gamification.coinLedger.push({
      id: `reversal:${id}:${Date.now()}`,
      type: 'reversal',
      amount: -Number(original.amount),
      label: `Reversal — ${original.label}`,
      meta: { reason, originalId: id },
      status: 'active',
      createdAt: new Date().toISOString()
    });
    syncCoins();
    return true;
  }

  function hasActiveLedger(id) {
    return state.gamification.coinLedger.some(e => e.id === id && e.status !== 'reversed' && Number(e.amount) > 0);
  }

  function clearNewLedger() {
    state.gamification.coinLedger = [];
    state.gamification.checkinRewardDays = [];
    state.gamification.coins = state.gamification.baseCoins;
    saveState();
    renderAll();
    toast('New ledger cleared. Backup coins preserved.');
  }

  function resetToSeed() {
    localStorage.removeItem(STORE_KEY);
    state = normalizeApp(window.AZ_SEED_BACKUP?.appData || {}, true);
    currentMonth = todayISO().slice(0, 7) + '-01';
    selectedDate = todayISO();
    saveState();
    renderAll();
    toast('Reset to uploaded backup.');
  }

  function exportBackup() {
    const payload = {
      version: 'AKHILESH_DSA_NEWSPAPER_REVISION_GAZETTE_V2',
      exportedAt: new Date().toISOString(),
      appData: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akhilesh-dsa-newspaper-backup-${todayISO()}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup exported.');
  }

  function importBackup(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        state = normalizeApp(data.appData || data, true);
        saveState();
        renderAll();
        toast('Backup imported into the Gazette.');
      } catch (err) {
        toast('Could not import JSON backup. Check the file is valid JSON.', 'warn');
        console.error(err);
      }
    };
    reader.onerror = () => toast('Could not read the selected file.', 'warn');
    reader.readAsText(file);
    ev.target.value = '';
  }

  /* ============================================================
     PAGE NAVIGATION (with page-turn animation)
  ============================================================ */
  function switchPage(page) {
    if (page === currentPage) return;
    currentPage = page;
    $$('.nav-btn').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.page) === page));
    const flip = $('#pageFlip');
    flip.classList.remove('turning');
    void flip.offsetWidth;
    flip.classList.add('turning');
    playPageRustle();
    setTimeout(() => {
      $$('.paper-spread').forEach(p => p.classList.toggle('active', Number(p.dataset.page) === page));
      renderAll();
      const active = $('.paper-spread.active');
      active?.focus?.();
    }, 230);
  }

  /* ============================================================
     AUDIO
  ============================================================ */
  function tryAutoplay() {
    const overlay = $('#startOverlay');
    const music = $('#bgMusic');
    music.volume = Number(localStorage.getItem('az.musicVolume') || 0.38);
    if (!musicEnabled) { overlay.classList.remove('hidden'); return; }
    music.play().then(() => overlay.classList.add('hidden')).catch(() => {
      overlay.classList.remove('hidden');
    });
  }

  function startEdition(withMusic) {
    unlockAudio();
    if (withMusic) {
      musicEnabled = true;
      localStorage.setItem('az.musicEnabled', 'true');
      $('#bgMusic').play().catch(() => toast('Browser blocked autoplay. Press the music button after any click.', 'warn'));
    } else {
      musicEnabled = false;
      localStorage.setItem('az.musicEnabled', 'false');
      $('#bgMusic').pause();
    }
    $('#musicToggle').textContent = musicEnabled ? '♪' : '♬';
    $('#musicToggle').setAttribute('aria-pressed', String(musicEnabled));
    $('#startOverlay').classList.add('hidden');
    if (whiteNoiseEnabled) startWhiteNoise();
    playPageRustle();
  }

  function toggleMusic() {
    const music = $('#bgMusic');
    unlockAudio();
    musicEnabled = !musicEnabled;
    localStorage.setItem('az.musicEnabled', JSON.stringify(musicEnabled));
    if (musicEnabled) music.play().catch(() => toast('Click Start Edition once to unlock music in this browser.', 'warn'));
    else music.pause();
    $('#musicToggle').textContent = musicEnabled ? '♪' : '♬';
    $('#musicToggle').setAttribute('aria-pressed', String(musicEnabled));
  }

  function toggleSound() {
    unlockAudio();
    soundEnabled = !soundEnabled;
    localStorage.setItem('az.soundEnabled', JSON.stringify(soundEnabled));
    $('#soundToggle').textContent = soundEnabled ? '🔊' : '🔇';
    $('#soundToggle').setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) playTick();
  }

  // ── WHITE NOISE ENGINE ──────────────────────────────────────────
  function generateWhiteNoiseBuffer(type, duration = 3) {
    if (!audioCtx) return null;
    const sr = audioCtx.sampleRate;
    const frameCount = sr * duration;
    const buffer = audioCtx.createBuffer(2, frameCount, sr);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      if (type === 'white') {
        for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
      } else if (type === 'brown') {
        let last = 0;
        for (let i = 0; i < frameCount; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
      } else if (type === 'rain') {
        // Layered rain: broad pink-ish noise + high freq sparkle
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
        for (let i = 0; i < frameCount; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
        }
      }
    }
    return buffer;
  }

  function startWhiteNoise() {
    if (!whiteNoiseEnabled) return;
    unlockAudio();
    if (!audioCtx) return;
    stopWhiteNoise(); // clean up any existing node

    const buffer = generateWhiteNoiseBuffer(whiteNoiseType, 4);
    if (!buffer) return;

    whiteNoiseGain = audioCtx.createGain();
    whiteNoiseGain.gain.setValueAtTime(0, audioCtx.currentTime);
    whiteNoiseGain.gain.linearRampToValueAtTime(whiteNoiseVolume, audioCtx.currentTime + 1.5);

    // filter for more pleasant sound
    const filter = audioCtx.createBiquadFilter();
    if (whiteNoiseType === 'white') {
      filter.type = 'lowpass';
      filter.frequency.value = 8000;
    } else if (whiteNoiseType === 'brown') {
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.3;
    }

    whiteNoiseNode = audioCtx.createBufferSource();
    whiteNoiseNode.buffer = buffer;
    whiteNoiseNode.loop = true;
    whiteNoiseNode.connect(filter).connect(whiteNoiseGain).connect(audioCtx.destination);
    whiteNoiseNode.start();
  }

  function stopWhiteNoise(fade = true) {
    if (!whiteNoiseNode) return;
    if (whiteNoiseGain && fade && audioCtx) {
      whiteNoiseGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
      setTimeout(() => {
        try { whiteNoiseNode?.stop(); } catch { }
        whiteNoiseNode = null;
        whiteNoiseGain = null;
      }, 1400);
    } else {
      try { whiteNoiseNode.stop(); } catch { }
      whiteNoiseNode = null;
      whiteNoiseGain = null;
    }
  }

  function toggleWhiteNoise() {
    whiteNoiseEnabled = !whiteNoiseEnabled;
    localStorage.setItem('az.whiteNoiseEnabled', JSON.stringify(whiteNoiseEnabled));
    updateWhiteNoiseUI();
    if (whiteNoiseEnabled) startWhiteNoise();
    else stopWhiteNoise();
  }

  function setWhiteNoiseVolume(val) {
    whiteNoiseVolume = val;
    localStorage.setItem('az.whiteNoiseVolume', JSON.stringify(val));
    if (whiteNoiseGain && audioCtx) {
      whiteNoiseGain.gain.setValueAtTime(val, audioCtx.currentTime);
    }
    const pct = $('#whiteNoiseVolPct');
    if (pct) pct.textContent = Math.round(val * 100) + '%';
  }

  function setWhiteNoiseType(type) {
    whiteNoiseType = type;
    localStorage.setItem('az.whiteNoiseType', type);
    $$('.wn-type-btn').forEach(b => b.classList.toggle('active', b.dataset.noiseType === type));
    if (whiteNoiseEnabled) {
      stopWhiteNoise(false);
      setTimeout(() => startWhiteNoise(), 100);
    }
  }

  function updateWhiteNoiseUI() {
    const toggle = $('#whiteNoiseToggle');
    if (toggle) {
      toggle.textContent = whiteNoiseEnabled ? '🌊 ON' : '🌊 OFF';
      toggle.classList.toggle('active', whiteNoiseEnabled);
    }
    $$('.wn-type-btn').forEach(b => b.classList.toggle('active', b.dataset.noiseType === whiteNoiseType));
    const volSlider = $('#whiteNoiseVol');
    if (volSlider) volSlider.value = whiteNoiseVolume;
    const pct = $('#whiteNoiseVolPct');
    if (pct) pct.textContent = Math.round(whiteNoiseVolume * 100) + '%';
  }
  // ── END WHITE NOISE ENGINE ──────────────────────────────────────

  function changeVolume(delta) {
    const music = $('#bgMusic');
    music.volume = Math.max(0, Math.min(1, music.volume + delta));
    localStorage.setItem('az.musicVolume', String(music.volume));
    toast(`Music volume: ${Math.round(music.volume * 100)}%`);
  }

  function unlockAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioCtx = null; return; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playPageRustle(scale = 1) {
    if (!soundEnabled) return;
    unlockAudio();
    if (!audioCtx) return;
    const duration = 0.42 * scale;
    const bufferSize = Math.floor(audioCtx.sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = Math.sin(Math.PI * t) * (1 - t * .35);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.16;
    }
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.8;
    gain.gain.value = 0.42;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  }

  function playTick() {
    if (!soundEnabled) return;
    unlockAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(650, audioCtx.currentTime);
    gain.gain.setValueAtTime(.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.18, audioCtx.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .09);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + .1);
  }

  function playCoin() {
    if (!soundEnabled) return;
    unlockAudio();
    if (!audioCtx) return;
    [784, 988, 1318].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      const start = audioCtx.currentTime + i * .055;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.16, start + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + .2);
    });
  }

  function celebrate(message) {
    playCoin();
    confettiBurst();
    toast(message);
  }

  function confettiBurst() {
    const canvas = $('#confettiCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // canvas 2d context unsupported/blocked — skip confetti, rest of celebrate() still runs
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const pieces = Array.from({ length: 110 }, () => ({
      x: innerWidth / 2 + (Math.random() - .5) * 180,
      y: innerHeight * .22,
      vx: (Math.random() - .5) * 9,
      vy: Math.random() * -7 - 2,
      r: Math.random() * 6 + 3,
      rot: Math.random() * 7,
      vr: (Math.random() - .5) * .25,
      life: 1
    }));
    let frame = 0;
    const colors = ['#201912', '#a3342f', '#2f6b4f', '#b88220', '#213e59'];
    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += .22;
        p.rot += p.vr;
        p.life -= .012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
      });
      if (frame < 95) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    draw();
  }

  function toast(msg, kind = 'ok') {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    el.classList.toggle('warn', kind === 'warn');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ============================================================
     DATA QUERIES
  ============================================================ */
  function activeRevisionProblems() {
    return state.problems.filter(p => !p.archived && p.nextRevDate);
  }

  function revisionPrioritySort(a, b) {
    const dateCmp = (a.nextRevDate || '').localeCompare(b.nextRevDate || '');
    if (dateCmp) return dateCmp;

    // Equal weightage: when multiple problems want the same date, prefer the one
    // that has been revised less often, then the one untouched for longer.
    const histCmp = (a.history?.length || 0) - (b.history?.length || 0);
    if (histCmp) return histCmp;

    const lastA = (a.history || []).at?.(-1) || (a.history || [])[((a.history || []).length - 1)] || a.solveDate || '';
    const lastB = (b.history || []).at?.(-1) || (b.history || [])[((b.history || []).length - 1)] || b.solveDate || '';
    const lastCmp = lastA.localeCompare(lastB);
    if (lastCmp) return lastCmp;

    return (a.createdAt || '').localeCompare(b.createdAt || '');
  }

  function addToRevisionLoad(load, date) {
    load.set(date, (load.get(date) || 0) + 1);
  }

  function maxISODate(a, b) {
    return a > b ? a : b;
  }

  function revisionSchedulingBaseDate() {
    return maxISODate(todayISO(), REVISION_SCHEDULE_START_DATE);
  }

  // Build two parallel maps from already-scheduled problems:
  //   count  — Map<date, number>       how many problems on that day
  //   topics — Map<date, Set<string>>  which topics are on that day
  function buildScheduleMaps(excludeId = '') {
    const baseDate = revisionSchedulingBaseDate();
    const count = new Map();
    const topics = new Map();
    activeRevisionProblems().forEach(p => {
      if (p.id !== excludeId && p.nextRevDate >= baseDate) {
        count.set(p.nextRevDate, (count.get(p.nextRevDate) || 0) + 1);
        if (!topics.has(p.nextRevDate)) topics.set(p.nextRevDate, new Set());
        topics.get(p.nextRevDate).add(p.topic || 'Uncategorized');
      }
    });
    return { count, topics };
  }

  // Find the earliest slot for a problem that is:
  //   1. Under the daily cap, AND
  //   2. Doesn't already have a problem from the same topic (preferred).
  // If no topic-clean slot is found within 60 days, falls back to
  // the first slot that is simply under the cap.
  // Pass maps = { count, topics } when calling in a loop to avoid
  // rebuilding from scratch each time (enforceDailyRevisionLimit does this).
  function findRevisionSlot(preferredDate, excludeProblemId = '', maps = null, topic = '') {
    const baseDate = revisionSchedulingBaseDate();
    let date = isValidISO(preferredDate) ? preferredDate : baseDate;
    if (date < baseDate) date = baseDate;

    const { count, topics } = maps || buildScheduleMaps(excludeProblemId);
    const t = topic || '';

    // First pass: find a slot under cap where this topic isn't present yet.
    if (t) {
      let d = date;
      for (let i = 0; i < 60; i++) {
        const cnt = count.get(d) || 0;
        const topicsOnDay = topics.get(d) || new Set();
        if (cnt < MAX_DAILY_REVISIONS && !topicsOnDay.has(t)) return d;
        d = addDaysISO(d, 1);
      }
    }

    // Fallback: any slot under the cap (topic-blind).
    while ((count.get(date) || 0) >= MAX_DAILY_REVISIONS) {
      date = addDaysISO(date, 1);
    }
    return date;
  }

  function enforceDailyRevisionLimit() {
    const baseDate = revisionSchedulingBaseDate();
    // Build fresh maps — we'll update them incrementally as we slot each problem.
    const maps = { count: new Map(), topics: new Map() };
    let changed = false;

    // Interleave problems by topic before slotting so that days naturally
    // get mixed topics (e.g. BS+TP on day 1, BS+TP on day 2) rather than
    // all BS first then all TP.
    const sorted = activeRevisionProblems().slice().sort(revisionPrioritySort);
    const byTopic = new Map();
    sorted.forEach(p => {
      const t = p.topic || 'Uncategorized';
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(p);
    });
    const interleaved = [];
    const qs = Array.from(byTopic.values());
    while (qs.some(q => q.length > 0)) {
      qs.forEach(q => { if (q.length > 0) interleaved.push(q.shift()); });
    }

    interleaved.forEach(p => {
      const preferred = p.nextRevDate < baseDate ? baseDate : p.nextRevDate;
      const slot = findRevisionSlot(preferred, p.id, maps, p.topic || '');
      if (slot !== p.nextRevDate) {
        p.nextRevDate = slot;
        changed = true;
      }
      // Update both maps so the next problem sees the updated load.
      maps.count.set(slot, (maps.count.get(slot) || 0) + 1);
      if (!maps.topics.has(slot)) maps.topics.set(slot, new Set());
      maps.topics.get(slot).add(p.topic || 'Uncategorized');
    });

    return changed;
  }

  function allDueProblems() {
    const today = todayISO();
    return state.problems
      .filter(p => !p.archived && p.nextRevDate && p.nextRevDate <= today)
      .sort(revisionPrioritySort);
  }

  function dueProblems() {
    const all = allDueProblems();
    if (all.length <= MAX_DAILY_REVISIONS) return all;

    // Group problems by topic. Within each queue, problems are already
    // sorted most-overdue first (from allDueProblems → revisionPrioritySort).
    const byTopic = new Map();
    all.forEach(p => {
      const t = p.topic || 'Uncategorized';
      if (!byTopic.has(t)) byTopic.set(t, []);
      byTopic.get(t).push(p);
    });

    // Sort the topic queues by how overdue their most urgent problem is.
    // This means when topics > cap (e.g. 6 topics, cap=4), the 4 topics
    // with the most overdue problems get picked first. The skipped topics
    // automatically become the most overdue tomorrow, so every topic
    // rotates through fairly over time — no topic ever gets permanently buried.
    const queues = Array.from(byTopic.values())
      .sort((a, b) => (a[0].nextRevDate || '').localeCompare(b[0].nextRevDate || ''));

    // Round-robin: one problem per topic per pass until cap is reached.
    const selected = [];
    while (selected.length < MAX_DAILY_REVISIONS) {
      let added = false;
      for (const q of queues) {
        if (selected.length >= MAX_DAILY_REVISIONS) break;
        if (q.length > 0) {
          selected.push(q.shift());
          added = true;
        }
      }
      if (!added) break; // all queues exhausted
    }
    return selected;
  }

  function metricsForDate(date) {
    return {
      solved: state.problems.filter(p => p.solveDate === date && !p.archived).length,
      revisions: state.problems.reduce((n, p) => n + (p.history || []).filter(d => d === date).length, 0),
      tasks: state.todos.filter(t => t.done && t.completedAt === date).length,
      // pending = tasks that were assigned to this date but NOT completed
      pendingTasks: state.todos.filter(t => !t.done && (t.pendingDays || []).includes(date)).length,
      checkin: state.gamification.loginDays.includes(date) ? 1 : 0
    };
  }

  function namesForSolvedDate(date) {
    return state.problems.filter(p => p.solveDate === date && !p.archived).map(p => p.name);
  }

  function namesForRevisedDate(date) {
    return state.problems.filter(p => (p.history || []).includes(date)).map(p => p.name);
  }

  function tasksForDate(date) {
    return state.todos.filter(t => t.date === date || t.completedAt === date);
  }

  function currentStreak() {
    const days = new Set(state.gamification.loginDays || []);
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    let cursor = days.has(todayISO()) ? todayISO() : addDaysISO(todayISO(), -1);
    let count = 0;
    while (days.has(cursor) || frozen.has(cursor)) {
      if (days.has(cursor)) count++;
      cursor = addDaysISO(cursor, -1);
    }
    return count;
  }

  /* ============================================================
     SPACED REPETITION LOGIC (fixed)
     Ladder: 1 -> 3 -> 7 -> 30 -> 90 days
     - AC: advance one full step up the ladder from the current interval.
     - Hints: advance, but capped — never jumps more than one step, and
       resets to the first rung once it would otherwise exceed 7 days,
       so shaky recall keeps coming back sooner than a clean AC.
     - Failed: hard reset to 1 day, no matter where it was.
  ============================================================ */
  function nextIntervalFor(current, outcome) {
    current = Number(current) > 0 ? Number(current) : 1;
    if (outcome === 'failed') return INTERVALS[0];

    // Find the ladder position at-or-above the current interval.
    let idx = INTERVALS.findIndex(x => x >= current);
    if (idx < 0) idx = INTERVALS.length - 1;

    if (outcome === 'hints') {
      // Cautious growth: move at most one rung, but cap at the 7-day rung
      // so a shaky recall never sails out to 30/90 days.
      const cappedIdx = Math.min(idx + 1, 2); // index 2 == 7 days
      return INTERVALS[Math.max(0, cappedIdx)];
    }

    // outcome === 'ac': advance one full rung up the ladder.
    return INTERVALS[Math.min(idx + 1, INTERVALS.length - 1)];
  }

  /* ============================================================
     PROBLEM DEEP DIVE MODAL
  ============================================================ */

  let activeDmTab = "notes";
  let activeDmProblemId = null;

  function openDetailModal(id, tab = "notes") {
    const p = state.problems.find(x => x.id === id);
    if (!p) return;
    activeDmProblemId = id;
    activeDmTab = tab;
    const modal = $("#detailModal");

    // Title & Meta
    const titleEl = $("#dmTitle");
    titleEl.innerHTML = p.url
      ? `<a href="${escapeAttr(p.url)}" target="_blank" rel="noopener">${escapeHTML(p.name)} ↗</a>`
      : escapeHTML(p.name);

    const metaEl = $("#dmMeta");
    const diffClass = p.difficulty ? `diff-${p.difficulty.toLowerCase()}` : "diff-medium";
    metaEl.innerHTML = `
      ${p.topic ? `<span class="dm-badge topic">📂 ${escapeHTML(p.topic)}</span>` : ""}
      ${p.pattern ? `<span class="dm-badge topic" style="background:#4f46e5;color:white">🧩 ${escapeHTML(p.pattern)}</span>` : ""}
      ${p.phase ? `<span class="dm-badge phase">${escapeHTML(p.phase)}</span>` : ""}
      ${p.difficulty ? `<span class="dm-badge ${diffClass}">${escapeHTML(p.difficulty)}</span>` : ""}
      ${p.time ? `<span class="dm-badge phase" style="border-color:var(--ink-30)">⏱ ${escapeHTML(p.time)}</span>` : ""}
      ${p.space ? `<span class="dm-badge phase" style="border-color:var(--ink-30)">💾 ${escapeHTML(p.space)}</span>` : ""}
      ${p.solveDate ? `<span class="dm-badge phase">🗓 Solved ${formatShortDate(p.solveDate)}</span>` : ""}
      <span class="dm-badge phase">🔄 Interval ${p.interval || 1}d</span>
    `;

    // Stats Strip
    const revs = p.revisionMistakes || [];
    const acCnt = revs.filter(m => m.outcome === "ac").length;
    const hCnt = revs.filter(m => m.outcome === "hints").length;
    const fCnt = revs.filter(m => m.outcome === "failed").length;
    const total = revs.length;

    $("#dmStatsStrip").innerHTML = `
      <div class="dm-stat"><span class="dm-stat-num gold">${total}</span><div class="dm-stat-lbl">Revisions</div></div>
      <div class="dm-stat"><span class="dm-stat-num green">${acCnt}</span><div class="dm-stat-lbl">Solved Alone</div></div>
      <div class="dm-stat"><span class="dm-stat-num gold">${hCnt}</span><div class="dm-stat-lbl">Needed Hints</div></div>
      <div class="dm-stat"><span class="dm-stat-num red">${fCnt}</span><div class="dm-stat-lbl">Forgot</div></div>
      <div class="dm-stat"><span class="dm-stat-num blue">${p.interval || 1}d</span><div class="dm-stat-lbl">Interval</div></div>
    `;

    // Setup Tabs
    $$("#detailModal [data-dm-tab]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.dmTab === activeDmTab);
      btn.onclick = () => {
        activeDmTab = btn.dataset.dmTab;
        renderDetailBody(p);
        $$("#detailModal [data-dm-tab]").forEach(b => b.classList.toggle("active", b.dataset.dmTab === activeDmTab));
      };
    });

    // Expand Button
    const expandBtn = $("#dmExpandBtn");
    if (expandBtn) {
      expandBtn.onclick = () => {
        modal.classList.toggle("fullscreen-mode");
        expandBtn.textContent = modal.classList.contains("fullscreen-mode") ? "🌁 Collapse View" : "🌁 Expand View";
      };
    }

    // Quick Revise Button
    const quickRevBtn = $("#dmQuickRevBtn");
    if (quickRevBtn) {
      quickRevBtn.onclick = () => {
        modal.close();
        openRevisionDialog(p.id);
      };
    }

    renderDetailBody(p);

    $("#detailModalClose").onclick = () => modal.close();
    modal.addEventListener("click", e => { if (e.target === modal) modal.close(); }, { once: true });

    modal.showModal();
    modal.scrollTop = 0;
  }

  function renderDetailBody(p) {
    const bodyEl = $("#dmBody");
    const revs = p.revisionMistakes || [];
    const acCnt = revs.filter(m => m.outcome === "ac").length;
    const hCnt = revs.filter(m => m.outcome === "hints").length;
    const fCnt = revs.filter(m => m.outcome === "failed").length;
    const total = revs.length;

    if (activeDmTab === "notes") {
      const cfftd = p.cfftd || {};
      const cfftdFields = [
        { key: "c", label: "Concept", icon: "🧠" },
        { key: "f1", label: "First Thought", icon: "💭" },
        { key: "t", label: "Technique", icon: "🛠️" },
        { key: "d", label: "Debugging", icon: "🐞" },
      ].filter(f => cfftd[f.key] && cfftd[f.key].trim());

      const hasFreeNotes = !!(cfftd.notes && cfftd.notes.trim());

      let html = "";
      if (cfftdFields.length) {
        html += `<div class="cfftd-grid">
          ${cfftdFields.map(f => `
            <div class="cfftd-chip cfftd-${f.key}">
              <div class="cfftd-chip-label"><span class="cfftd-chip-icon">${f.icon}</span>${f.label}</div>
              <div class="cfftd-chip-value">${renderRichNotes(cfftd[f.key])}</div>
            </div>
          `).join("")}
        </div>`;
      }

      if (hasFreeNotes) {
        html += `<div class="notes-freeform${cfftdFields.length ? " with-chips" : ""}">
          <div class="notes-freeform-label">Study Guide &amp; Master Notes</div>
          <div class="notes-rich">${renderRichNotes(cfftd.notes)}</div>
        </div>`;
      }

      // Solution code section in deep dive
      const hasCode = !!(p.code && p.code.trim());
      if (hasCode) {
        const lang = p.codeLang || 'cpp';
        const langLabel = lang ? lang.toUpperCase() : 'CODE';
        const escapedCode = escapeHTML(p.code);
        const highlighted = highlightCodeSyntax(escapedCode, lang);
        html += `<div class="dm-code-section">
          <div class="dm-section-title">💻 Solution Code</div>
          <div class="problem-code-panel">
            <div class="problem-code-header">
              <div class="problem-code-dots"><i></i><i></i><i></i></div>
              <span class="problem-code-lang">${escapeHTML(langLabel)}</span>
              <span class="problem-code-filename">${escapeHTML(p.name)}</span>
              <button class="problem-code-copy-btn" type="button" onclick="copyCodeSnippet(this, \`${escapeAttr(p.code)}\`)">📋 Copy</button>
            </div>
            <div class="problem-code-body">
              <div class="problem-code-lines">${generateLineNumbers(p.code)}</div>
              <pre class="problem-code-pre"><code>${highlighted}</code></pre>
            </div>
          </div>
        </div>`;
      }

      if (!cfftdFields.length && !hasFreeNotes && !hasCode) {
        html = `<div class="empty-state">No notes or code added for this problem yet. Click "Stamp Revision" or edit problem to add notes.</div>`;
      }

      bodyEl.innerHTML = html;
    } else if (activeDmTab === "timeline") {
      let html = `<div>
        <div class="dm-section-title">Outcome Breakdown</div>
        <div class="dm-accuracy-wrap">
          <svg class="dm-accuracy-ring" viewBox="0 0 80 80">
            ${dmDonut(acCnt, hCnt, fCnt, total)}
          </svg>
          <div class="dm-accuracy-bar-wrap">
            ${dmBar("Solved alone", acCnt, total, "ac")}
            ${dmBar("Needed hints", hCnt, total, "hints")}
            ${dmBar("Forgot/Failed", fCnt, total, "failed")}
          </div>
        </div>
      </div>`;

      if (p.history.length) {
        html += `<div style="margin-top:24px">
          <div class="dm-section-title">Revision Heatmap</div>
          <div class="dm-heatmap">${dmHeatmap(p)}</div>
          <div class="dm-heatmap-legend">
            <span><i class="dm-legend-dot" style="background:var(--green)"></i>Solved alone</span>
            <span><i class="dm-legend-dot" style="background:var(--gold)"></i>Needed hints</span>
            <span><i class="dm-legend-dot" style="background:var(--red)"></i>Forgot/Failed</span>
            <span><i class="dm-legend-dot" style="background:var(--blue)"></i>Revised (no log)</span>
          </div>
        </div>`;
      }

      html += `<div style="margin-top:24px">
        <div class="dm-section-title">Full Revision History Timeline</div>
        ${dmTimeline(p)}
      </div>`;

      bodyEl.innerHTML = html;
    } else if (activeDmTab === "schedule") {
      const currentInterval = Number(p.interval || 1);
      const nextDate = p.nextRevDate || todayISO();
      const isOverdue = nextDate < todayISO();
      const revCount = (p.history || []).length;
      
      const roadmap = [];
      let simDate = nextDate;
      let simInterval = currentInterval;
      
      roadmap.push({
        rung: simInterval,
        date: simDate,
        status: isOverdue ? '🔴 Overdue & Priority Next' : (simDate === todayISO() ? '🟡 Due Today' : '🟢 Next Scheduled Revision'),
        isNext: true,
        desc: `This problem is currently on the ${simInterval}-day interval step. It is scheduled for revision on ${formatLongDate(simDate)} (${daysUntilText(simDate)}).`
      });
      
      while (simInterval < 90 && roadmap.length < 5) {
        const nextInt = nextIntervalFor(simInterval, 'ac');
        if (nextInt <= simInterval) break;
        simDate = addDaysISO(simDate, nextInt);
        simInterval = nextInt;
        roadmap.push({
          rung: simInterval,
          date: simDate,
          status: simInterval === 90 ? '🏆 Mastery Target (90d Rung)' : '⏳ Projected on AC',
          isNext: false,
          desc: `If solved cleanly (AC), the next spaced interval increases to ${simInterval} days, scheduled for ${formatLongDate(simDate)}.`
        });
      }
      
      let html = `
        <div class="schedule-tab-wrap">
          <div class="schedule-overview-card" style="background:rgba(255,252,242,0.9);border:1px solid var(--border);border-left:4px solid var(--gold);padding:20px;border-radius:14px;margin-bottom:24px;box-shadow:0 8px 24px rgba(28,21,16,0.06);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:0.7rem;font-weight:800;color:var(--ink-60);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Current Spaced Repetition Rung</div>
                <div style="font-size:1.5rem;font-weight:900;color:var(--ink);">${currentInterval}-Day Revision Interval</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.7rem;font-weight:800;color:var(--ink-60);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Next Scheduled Date</div>
                <div style="font-size:1.3rem;font-weight:800;color:${isOverdue ? 'var(--red)' : 'var(--green)'};">${formatShortDate(nextDate)}</div>
                <div style="font-size:0.75rem;font-weight:700;color:var(--ink-60);">${daysUntilText(nextDate)}</div>
              </div>
            </div>
            <p style="margin:0;font-size:0.9rem;color:var(--ink-60);line-height:1.5;">
              This problem follows the 5-step interval ladder (<strong style="color:var(--ink);">1d → 3d → 7d → 30d → 90d</strong>). 
              You have revised this problem <strong style="color:var(--ink);">${revCount} time${revCount === 1 ? '' : 's'}</strong>. 
              The Revision Desk automatically handles topic-balancing and schedules this problem without crowding out your new daily problem solving.
            </p>
          </div>
          
          <div class="dm-section-title">Spaced Repetition Schedule Roadmap</div>
          <div class="schedule-roadmap-list" style="display:grid;gap:12px;margin-top:16px;">
            ${roadmap.map((step, idx) => `
              <div class="schedule-step-card ${step.isNext ? 'active-step' : 'projected-step'}" style="background:${step.isNext ? 'rgba(255,250,230,0.95)' : 'rgba(255,255,255,0.5)'};border:1px ${step.isNext ? 'solid' : 'dashed'} ${step.isNext ? 'var(--gold)' : 'var(--border)'};border-left:4px solid ${step.isNext ? 'var(--gold)' : 'var(--ink-25)'};padding:16px 20px;border-radius:12px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;">
                <div style="width:48px;height:48px;border-radius:50%;background:${step.isNext ? 'var(--gold)' : 'rgba(28,21,16,0.08)'};color:${step.isNext ? '#1a140e' : 'var(--ink-60)'};display:grid;place-items:center;font-weight:900;font-size:1rem;box-shadow:${step.isNext ? '0 4px 12px rgba(196,154,39,0.3)' : 'none'};">
                  ${step.rung}d
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                    <strong style="font-size:1rem;color:var(--ink);">${step.isNext ? 'Step ' + (idx + 1) + ': Upcoming Due Revision' : 'Step ' + (idx + 1) + ': Projected Revision'}</strong>
                    <span style="font-size:0.72rem;font-weight:800;padding:2px 8px;border-radius:12px;background:${step.isNext ? 'rgba(40,113,79,0.15)' : 'rgba(28,21,16,0.06)'};color:${step.isNext ? 'var(--green)' : 'var(--ink-60)'};">${step.status}</span>
                  </div>
                  <div style="font-size:0.85rem;color:var(--ink-60);line-height:1.4;">${step.desc}</div>
                </div>
                <div style="text-align:right;min-width:100px;">
                  <div style="font-size:0.7rem;font-weight:800;color:var(--ink-60);text-transform:uppercase;">Scheduled For</div>
                  <div style="font-size:1rem;font-weight:800;color:var(--ink);">${formatShortDate(step.date)}</div>
                  <div style="font-size:0.75rem;color:var(--ink-60);">${step.isNext ? daysUntilText(step.date) : '+' + step.rung + ' days'}</div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${(p.revisionMistakes && p.revisionMistakes.length > 0) ? `
            <div style="margin-top:28px;">
              <div class="dm-section-title">Completed Past Revisions Log</div>
              <div style="display:grid;gap:8px;margin-top:14px;">
                ${p.revisionMistakes.slice().reverse().map(rev => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.4);border:1px solid var(--border);border-radius:10px;font-size:0.85rem;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="dm-dot ${rev.outcome}" style="width:18px;height:18px;font-size:0.6rem;">●</span>
                      <strong style="color:var(--ink);">${formatLongDate(rev.date)}</strong>
                      <span style="color:var(--ink-60);">— ${labelOutcome(rev.outcome)}</span>
                    </div>
                    ${rev.mistakes ? `<span style="font-style:italic;color:var(--ink-60);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${escapeHTML(rev.mistakes)}"</span>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      bodyEl.innerHTML = html;
    } else if (activeDmTab === "revise") {

      const cfftd = p.cfftd || {};
      const cfftdFields = [
        { key: "f1", label: "First Thought / Intuition", icon: "💭" },
        { key: "c", label: "Core Concept", icon: "🧠" },
        { key: "t", label: "Technique", icon: "🛠️" },
        { key: "d", label: "Debugging / Gotchas", icon: "🐞" }
      ].filter(f => cfftd[f.key] && cfftd[f.key].trim());

      let recallHtml = '';
      if (cfftdFields.length > 0 || (cfftd.notes && cfftd.notes.trim())) {
        recallHtml = `
          <div class="active-recall-panel" style="margin-bottom:24px;background:var(--cream-3);border:2px solid var(--gold);border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(196,154,39,0.12);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <div>
                <h4 style="margin:0;font-size:1.1rem;color:var(--ink);">Active Recall Safety Net</h4>
                <p style="margin:4px 0 0;font-size:0.8rem;color:var(--ink-60);">Blanking out? Reveal hints progressively instead of looking at the full solution.</p>
              </div>
            </div>
            <div style="display:grid;gap:12px;">
              ${cfftdFields.map((f, i) => `
                <div class="recall-item" style="background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                  <button type="button" class="recall-reveal-btn" style="width:100%;text-align:left;padding:12px 16px;background:rgba(196,154,39,0.05);border:none;border-bottom:1px solid transparent;cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);transition:all 0.2s;" onclick="this.nextElementSibling.classList.toggle('hidden');this.style.borderBottomColor='var(--border)';this.style.background='#fff';">
                    <span style="font-size:1.2rem;">${f.icon}</span> 
                    Reveal Hint ${i+1}: ${f.label}
                  </button>
                  <div class="recall-content hidden" style="padding:16px;background:#fff;font-size:0.9rem;border-top:1px solid var(--border);">
                    <div class="notes-rich">${renderRichNotes(cfftd[f.key])}</div>
                  </div>
                </div>
              `).join('')}
              
              ${(cfftd.notes && cfftd.notes.trim()) ? `
                <div class="recall-item" style="background:#fff;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                  <button type="button" class="recall-reveal-btn" style="width:100%;text-align:left;padding:12px 16px;background:rgba(156,47,42,0.05);border:none;cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:700;color:var(--red);transition:all 0.2s;" onclick="this.nextElementSibling.classList.toggle('hidden');this.style.borderBottomColor='var(--border)';this.style.background='#fff';">
                    <span style="font-size:1.2rem;">🚨</span> 
                    Reveal Full Study Notes (Last Resort)
                  </button>
                  <div class="recall-content hidden" style="padding:16px;background:#fff;font-size:0.9rem;border-top:1px solid var(--border);">
                    <div class="notes-rich">${renderRichNotes(cfftd.notes)}</div>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        recallHtml = `
          <div class="active-recall-panel" style="margin-bottom:24px;background:var(--cream-3);border:1px dashed var(--ink-25);border-radius:12px;padding:20px;text-align:center;">
            <p style="margin:0;font-size:0.9rem;color:var(--ink-60);">No study notes or hints exist for this problem yet. Add them below after your revision so your future self has a safety net!</p>
          </div>
        `;
      }

      bodyEl.innerHTML = `
        <div style="max-width:640px;margin:0 auto;">
          <div id="feynmanPanel" style="margin-bottom:24px;background:rgba(255,255,255,0.9);border:1px solid var(--border);border-top:4px solid var(--gold);border-radius:12px;padding:24px;box-shadow:var(--shadow);">
            <div style="margin-bottom:16px;">
              <h4 style="margin:0;font-size:1.15rem;color:var(--ink);font-family:'Inter', sans-serif;">🗣️ Active Recall: Technical Pitch</h4>
              <p style="margin:4px 0 0;font-size:0.85rem;color:var(--ink-60);">If you can't explain it simply, you don't understand it well enough. Type a 2-sentence elevator pitch of your approach before unlocking the solution.</p>
            </div>
            <textarea id="feynmanInput" rows="3" style="width:100%;padding:14px;border-radius:8px;border:1px solid var(--border);font-family:'Inter', sans-serif;font-size:0.95rem;resize:vertical;margin-bottom:16px;background:var(--cream-3);box-shadow:inset 0 1px 2px rgba(0,0,0,0.02);" placeholder="E.g. I will use a sliding window to track the longest valid sequence... Time is O(N) and space is O(1)."></textarea>
            <div id="feynmanFeedback" style="display:none;margin-bottom:16px;padding:16px;border-radius:8px;background:rgba(181,137,0,0.05);border:1px dashed var(--gold);font-size:0.95rem;line-height:1.5;"></div>
            <button type="button" class="btn primary" id="feynmanSubmitBtn" style="width:100%;background:var(--ink);color:var(--cream-3);padding:12px;font-size:1rem;font-weight:600;letter-spacing:0.5px;">Lock in Explanation & Proceed</button>
          </div>

          <div id="hiddenRevisionContent" style="display:none;">
            ${recallHtml}
            <div style="background:rgba(255,252,242,0.9);padding:24px;border-radius:16px;border:1px solid var(--border);box-shadow:0 8px 24px rgba(28,21,16,0.06);">
              <h3 style="margin-top:0;font-size:1.15rem;color:var(--ink)">Stamp Revision for ${escapeHTML(p.name)}</h3>
            <p style="font-size:0.85rem;color:var(--ink-60);margin-bottom:18px;">Select how confident you felt solving this problem. The revision engine adapts your future study schedule based on your honest feedback.</p>
            <form id="dmReviseForm">
              <div style="margin-bottom:20px;">
                <strong style="display:block;margin-bottom:12px;color:var(--ink);font-size:0.9rem;">Revision Outcome &amp; Confidence Level</strong>
                <div style="display:grid;gap:12px;">
                  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--green);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(40,113,79,0.06);">
                    <input type="radio" name="dmRevOutcome" value="ac" checked style="margin-top:3px;cursor:pointer;accent-color:var(--green);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🟢 Understood (Confident Solve)</span>
                        <span style="font-size:0.75rem;background:rgba(40,113,79,0.15);color:var(--green);padding:2px 8px;border-radius:12px;margin-left:auto;">+8 Coins</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You solved the problem cleanly on your own without hints or notes.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Advances this problem up to the next Spaced Repetition Rung (<strong style="color:var(--green);">1d → 3d → 7d → 30d → 90d</strong>).
                      </div>
                    </div>
                  </label>
  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--gold);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(196,154,39,0.06);">
                    <input type="radio" name="dmRevOutcome" value="hints" style="margin-top:3px;cursor:pointer;accent-color:var(--gold);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🟡 Not Confident (Shaky / Needed Hints)</span>
                        <span style="font-size:0.75rem;background:rgba(196,154,39,0.2);color:#9c7814;padding:2px 8px;border-radius:12px;margin-left:auto;">+4 Coins</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You got stuck, looked at hints/notes, or felt shaky about your logic.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Keeps it on a shorter review leash (<strong style="color:#9c7814;">capped at 7 days max</strong>) so you review it again soon without pushing it out to 30 or 90 days.
                      </div>
                    </div>
                  </label>
  
                  <label class="rev-outcome-card" style="display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:flex-start;padding:16px;background:rgba(255,255,255,0.75);border:2px solid var(--red);border-radius:12px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(156,47,42,0.06);">
                    <input type="radio" name="dmRevOutcome" value="failed" style="margin-top:3px;cursor:pointer;accent-color:var(--red);width:18px;height:18px;">
                    <div>
                      <div style="font-weight:800;color:var(--ink);font-size:0.95rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span>🔴 Completely Forgot / Failed</span>
                        <span style="font-size:0.75rem;background:rgba(156,47,42,0.15);color:var(--red);padding:2px 8px;border-radius:12px;margin-left:auto;">+1 Coin</span>
                      </div>
                      <div style="font-size:0.82rem;color:var(--ink-60);margin-top:6px;line-height:1.4;">
                        <strong style="color:var(--ink);">When to select:</strong> You completely blanked out or couldn't solve it at all.<br>
                        <strong style="color:var(--ink);">What it does:</strong> Resets the interval back to <strong style="color:var(--red);">1 day</strong> so it appears on your desk tomorrow.
                      </div>
                    </div>
                  </label>
  
                </div>
              </div>
              <label style="display:block;margin-bottom:12px">
                <strong>Mistakes &amp; Observations</strong>
                <textarea id="dmRevMistakes" rows="3" class="wide-input notes-textarea" placeholder="What tripped you up?"></textarea>
              </label>
              <label style="display:block;margin-bottom:16px">
                <strong>CFFTD Note Update</strong>
                <textarea id="dmRevNotes" rows="4" class="wide-input notes-textarea" placeholder="Note for future self..."></textarea>
              </label>
              <button class="btn primary" type="submit" style="width:100%;padding:14px;font-size:1rem;font-weight:800;box-shadow:0 4px 14px rgba(196,154,39,0.3);">Submit Revision &amp; Claim Coins</button>
            </form>
          </div>
          </div> <!-- Close hiddenRevisionContent -->
        </div>
      `;

      const fInput = $("#feynmanInput");
      const fBtn = $("#feynmanSubmitBtn");
      const fFeedback = $("#feynmanFeedback");
      if (fBtn) {
        fBtn.addEventListener("click", async () => {
          if (fInput.value.trim().length < 15) {
            toast("Please type a real explanation (at least 15 characters).", "warn");
            return;
          }
          
          fBtn.disabled = true;
          const apiKey = state.gamification.geminiKey;
          
          if (apiKey) {
            fBtn.textContent = "🧠 AI Interviewer is grading your pitch...";
            try {
              const notesContent = (p.cfftd && Object.values(p.cfftd).join(' ')) || p.notes || "No notes available.";
              const prompt = `You are a strict Data Structures & Algorithms (DSA) technical interviewer. 
The candidate is solving the problem '${p.name}' (Topic: ${p.topic}). 
Your canonical solution notes are: ${notesContent}.

The candidate provided the following explanation/elevator pitch:
"${fInput.value}"

Grade their explanation out of 10 based on accuracy, mentioning of correct data structures/algorithms, and time/space complexity if applicable. 
Respond EXACTLY in this format, with no markdown formatting around the output, just raw text:
SCORE: X/10
FEEDBACK: [1-2 sentences of direct, actionable feedback. Point out if they missed complexity.]`;

              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
                })
              });
              
              const data = await res.json();
              if (data.error) throw new Error(data.error.message);
              
              const text = data.candidates[0].content.parts[0].text;
              
              fFeedback.innerHTML = `<strong style="color:var(--ink);font-family:'Inter', sans-serif;">🤖 AI Interviewer Feedback:</strong><br/>${text.replace(/\n/g, '<br/>')}`;
              fFeedback.style.display = "block";
              toast("Graded by AI!", "success");
            } catch (err) {
              console.error(err);
              fFeedback.innerHTML = `<strong style="color:var(--red);font-family:'Inter', sans-serif;">🚨 API Error:</strong><br/>${err.message}<br/><span style="font-size:0.8rem;color:var(--ink-60)">Check if your AdBlocker/Brave Shields are blocking the request, or if the API key is completely valid.</span>`;
              fFeedback.style.display = "block";
              fFeedback.style.borderColor = "var(--red)";
              fFeedback.style.background = "rgba(156,47,42,0.05)";
              toast("AI Grading failed. See error.", "warn");
            }
          } else {
             fFeedback.innerHTML = `<strong style="color:var(--red);">🚨 No API Key Found!</strong><br/>Please paste your key in the Reward Vault settings tab and hit Enter.`;
             fFeedback.style.display = "block";
             fFeedback.style.borderColor = "var(--red)";
             fFeedback.style.background = "rgba(156,47,42,0.05)";
             toast("Explanation locked manually (No key found).", "success");
          }
          
          $("#feynmanPanel").style.opacity = "0.8";
          fInput.disabled = true;
          fBtn.style.display = "none";
          $("#hiddenRevisionContent").style.display = "block";
        });
      }

      const form = $("#dmReviseForm");
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          const outcomeEl = document.querySelector('input[name="dmRevOutcome"]:checked');
          const outcome = outcomeEl ? outcomeEl.value : "ac";
          const mistakes = $("#dmRevMistakes").value;
          const notes = $("#dmRevNotes").value;

          recordRevision(p.id, outcome, mistakes, notes);
          openDetailModal(p.id, "timeline");
        };
      }
    }
  }

  function dmDonut(ac, hints, failed, total) {
    if (total === 0) {
      return `<circle cx="40" cy="40" r="30" fill="none" stroke="var(--ink-10)" stroke-width="10"/>
              <text x="40" y="44" text-anchor="middle" font-size="9" fill="var(--ink-60)" font-family="ui-sans-serif">No data</text>`;
    }
    const R = 30, C = 2 * Math.PI * R;
    const segments = [
      { val: ac, color: 'var(--green)' },
      { val: hints, color: 'var(--gold)' },
      { val: failed, color: 'var(--red)' },
    ];
    let offset = 0;
    let arcs = '';
    segments.forEach(seg => {
      const pct = seg.val / total;
      const dash = pct * C;
      if (dash > 0) {
        arcs += `<circle cx="40" cy="40" r="${R}" fill="none" stroke="${seg.color}" stroke-width="10"
          stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 40 40)"/>`;
        offset += dash;
      }
    });
    const pct = Math.round(ac / total * 100);
    return `${arcs}
      <text x="40" y="38" text-anchor="middle" font-size="13" font-weight="900" fill="var(--ink)" font-family="ui-sans-serif">${pct}%</text>
      <text x="40" y="50" text-anchor="middle" font-size="7.5" fill="var(--ink-60)" font-family="ui-sans-serif">accuracy</text>`;
  }

  // ── Accuracy bar row ──
  function dmBar(label, val, total, cls) {
    const pct = total > 0 ? Math.round(val / total * 100) : 0;
    return `<div class="dm-acc-row">
      <div class="dm-acc-label">${label}</div>
      <div class="dm-acc-track"><div class="dm-acc-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="dm-acc-count">${val}</div>
    </div>`;
  }

  // ── Heatmap cells ──
  function dmHeatmap(p) {
    const revMap = {};
    (p.revisionMistakes || []).forEach(m => { if (m.date) revMap[m.date] = m.outcome; });
    return p.history.slice().sort().map(date => {
      const outcome = revMap[date] || 'solved';
      const label = outcome === 'ac' ? '✓' : outcome === 'hints' ? '~' : outcome === 'failed' ? '✗' : '·';
      const title = `${formatShortDate(date)} — ${labelOutcome(outcome) || 'revised'}`;
      return `<div class="dm-heat-cell ${outcome}" title="${escapeAttr(title)}">${label}</div>`;
    }).join('');
  }

  // ── Timeline entries ──
  function dmTimeline(p) {
    const revMap = {};
    (p.revisionMistakes || []).forEach(m => { if (m.date) revMap[m.date] = m; });
    const allDates = [...new Set([...p.history, ...Object.keys(revMap)])].sort().reverse();

    if (!allDates.length) {
      return `<div class="dm-empty-timeline">No revision history yet — get cracking! 🔥</div>`;
    }

    const icons = { ac: '✓', hints: '~', failed: '✗', solved: '·' };

    return `<div class="dm-timeline">${allDates.map((date, i) => {
      const m = revMap[date];
      const outcome = m?.outcome || 'solved';
      const icon = icons[outcome] || '·';
      const isFirst = i === allDates.length - 1;

      // interval pill: how many days since previous revision
      let intervalPill = '';
      if (i < allDates.length - 1) {
        const prev = allDates[i + 1];
        const gap = daysBetween(prev, date);
        intervalPill = `<span class="dm-interval-pill">+${gap}d since last</span>`;
      } else {
        intervalPill = `<span class="dm-interval-pill">First revision</span>`;
      }

      // outcome label
      const outcomeLabel = outcome === 'ac'
        ? 'Solved Alone ✓'
        : outcome === 'hints'
          ? 'Needed Hints'
          : outcome === 'failed'
            ? 'Forgot / Failed'
            : 'Revised';

      // mistakes block
      const mistakesBlock = m?.mistakes
        ? `<div class="dm-entry-mistakes"><strong>Mistakes logged</strong><div class="notes-rich">${renderRichNotes(m.mistakes)}</div></div>`
        : '';

      // notes block
      const notesBlock = m?.notes
        ? `<div class="dm-entry-notes"><div class="dm-entry-notes-label">Note</div><div class="notes-rich">${renderRichNotes(m.notes)}</div></div>`
        : '';

      // interval info
      const intervalBlock = (m?.prevInterval && m?.newInterval)
        ? `<div class="dm-entry-notes" style="font-style:normal;color:var(--ink-60);font-size:.78rem;">
            Interval: ${m.prevInterval}d → ${m.newInterval}d &nbsp;·&nbsp; Next due ${formatShortDate(m.newNextRevDate)}
           </div>`
        : '';

      return `<div class="dm-entry">
        <div class="dm-entry-dot">
          <div class="dm-dot ${outcome}">${icon}</div>
        </div>
        <div class="dm-entry-card ${outcome}">
          <div class="dm-entry-header">
            <span class="dm-entry-date">${formatShortDate(date)}</span>
            <span class="dm-entry-outcome ${outcome}">${outcomeLabel}</span>
            ${intervalPill}
          </div>
          ${mistakesBlock}
          ${notesBlock}
          ${intervalBlock}
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function labelOutcome(outcome) {
    return outcome === 'ac' ? 'AC' : outcome === 'hints' ? 'needed hints' : 'forgot/failed';
  }

  function emptyState(text) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = text;
    return div;
  }

  function unique(arr) { return [...new Set(arr)].sort((a, b) => a.localeCompare(b)); }
  function s(n) { return Number(n) === 1 ? '' : 's'; }
  function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`; }

  /* ============================================================
     DATE HELPERS (IST-anchored "today", UTC-anchored arithmetic)
  ============================================================ */
  function todayISO() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function dateFromISO(iso) {
    return new Date(`${iso}T00:00:00Z`);
  }

  function isoFromDateUTC(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDaysISO(iso, days) {
    const d = dateFromISO(iso);
    d.setUTCDate(d.getUTCDate() + Number(days));
    return isoFromDateUTC(d);
  }

  function addMonthsISO(iso, months) {
    const d = dateFromISO(iso);
    d.setUTCMonth(d.getUTCMonth() + Number(months));
    d.setUTCDate(1);
    return isoFromDateUTC(d);
  }

  function daysBetween(a, b) {
    return Math.round((dateFromISO(b) - dateFromISO(a)) / 86400000);
  }

  function formatLongDate(iso) {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateFromISO(iso));
  }

  function formatShortDate(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dateFromISO(iso));
  }

  function monthName(iso) {
    return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateFromISO(iso));
  }

  function formatDateTime(value) {
    try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch { return value || '—'; }
  }

  function daysUntilText(iso) {
    const d = daysBetween(todayISO(), iso);
    if (d === 0) return 'Due today';
    if (d < 0) return `${Math.abs(d)} day${s(Math.abs(d))} overdue`;
    return `in ${d} day${s(d)}`;
  }

  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  function escapeAttr(str) { return escapeHTML(str).replace(/`/g, '&#96;'); }


  function generateLineNumbers(code) {
    const lines = String(code ?? '').split('\n');
    return lines.map((_, i) => `<span>${i + 1}</span>`).join('');
  }

  /* ============================================================
     RICH NOTES RENDERER
     Turns a plain-text notes field into structured HTML:
       ```lang            → a standalone, terminal-styled code block
       code```
       - item / * item    → a bullet list
       **bold**           → bold text
       `inline code`      → inline code chip
       blank-line breaks  → separate paragraphs
     Everything is HTML-escaped before formatting is applied, so
     pasted code or text can never break out of its block.
  ============================================================ */

  /* ============================================================
     ADVANCED MARKDOWN & CODE HIGHLIGHTING ENGINE
  ============================================================ */
  function renderRichNotes(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return "";

    const fenceRe = /```([a-zA-Z0-9+#.\-]*)[ \t]*\r?\n?([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0, m;
    while ((m = fenceRe.exec(text))) {
      if (m.index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, m.index) });
      parts.push({ type: "code", lang: (m[1] || "").trim(), value: m[2].replace(/\n$/, "") });
      lastIndex = fenceRe.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });

    return parts.map(part => part.type === "code"
      ? renderNoteCodeBlock(part.lang, part.value)
      : renderNoteTextBlock(part.value)
    ).join("");
  }

  function renderNoteCodeBlock(lang, code) {
    const label = lang ? lang.toUpperCase() : "CODE";
    const escapedCode = escapeHTML(code);
    const highlighted = highlightCodeSyntax(escapedCode, lang);

    return `<div class="note-code-block">
      <div class="note-code-bar">
        <div class="note-code-dots"><i></i><i></i><i></i></div>
        <span class="note-code-lang">${escapeHTML(label)}</span>
        <button class="note-copy-btn" type="button" onclick="copyCodeSnippet(this, \`${escapeAttr(code)}\`)">📋 Copy</button>
      </div>
      <pre><code>${highlighted}</code></pre>
    </div>`;
  }

  function highlightCodeSyntax(escaped, lang) {
    return escaped
      .replace(/(\x2f\x2f.*|\x2f\*[\s\S]*?\*\x2f|#.*)/g, '<span class="code-comment">$1</span>')
      .replace(/\b(int|long|double|float|char|bool|vector|map|unordered_map|set|unordered_set|queue|priority_queue|stack|pair|struct|class|public|private|void|return|if|else|while|for|break|continue|auto|using|namespace|typedef|new|delete|const|static|template|typename|include|import|from|def|fn|let|var|function|async|await)\b/g, '<span class="code-keyword">$1</span>')
      .replace(/\b(true|false|NULL|nullptr|None|std|cin|cout|endl)\b/g, '<span class="code-builtin">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="code-num">$1</span>');
  }

  function renderNoteTextBlock(raw) {
    const trimmed = raw.replace(/^\n+|\n+$/g, "");
    if (!trimmed.trim()) return "";

    const blocks = trimmed.split(/\n{2,}/);

    return blocks.map(block => {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      if (!lines.length) return "";

      // 1. Table (| Col | Col |)
      if (lines.length >= 2 && lines[0].includes("|") && lines[1].includes("|")) {
        return renderMarkdownTable(lines);
      }

      // 2. Heading (# Heading)
      if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) {
        const level = lines[0].match(/^(#{1,6})/)[1].length;
        const titleText = lines[0].replace(/^#{1,6}\s+/, "");
        return `<h${level} class="note-h${level}">${inlineNoteFormat(titleText)}</h${level}>`;
      }

      // 3. Blockquote (> text)
      if (lines.every(l => /^>\s*/.test(l))) {
        const quoteContent = lines.map(l => l.replace(/^>\s*/, "")).map(inlineNoteFormat).join("<br>");
        return `<blockquote class="note-quote">${quoteContent}</blockquote>`;
      }

      // 4. Bullet List (- item, * item)
      if (lines.every(l => /^[-*]\s+/.test(l))) {
        return `<ul class="note-list">${lines.map(l => `<li>${inlineNoteFormat(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }

      // 5. Numbered List (1. item)
      if (lines.every(l => /^\d+\.\s+/.test(l))) {
        return `<ol class="note-list numbered">${lines.map(l => `<li>${inlineNoteFormat(l.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
      }

      // 6. Paragraph
      return `<p>${lines.map(inlineNoteFormat).join("<br>")}</p>`;
    }).join("");
  }

  function renderMarkdownTable(lines) {
    const rows = lines.map(line => {
      return line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cell => cell.trim());
    });

    let headerRow = rows[0];
    let bodyRows = rows.slice(1);
    if (bodyRows.length && bodyRows[0].every(c => /^:?-+:?$/.test(c))) {
      bodyRows = bodyRows.slice(1);
    }

    const ths = headerRow.map(h => `<th>${inlineNoteFormat(h)}</th>`).join("");
    const trs = bodyRows.map(r => {
      const tds = r.map(c => `<td>${inlineNoteFormat(c)}</td>`).join("");
      return `<tr>${tds}</tr>`;
    }).join("");

    return `<div class="note-table-wrap">
      <table class="note-table">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
  }

  function inlineNoteFormat(line) {
    return escapeHTML(line)
      .replace(/\x60([^\x60]+)\x60/g, '<code class="note-inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  /* ============================================================
     BACKEND DB SYNC HELPERS
  ============================================================ */
  async function loadStateFromBackend() {
    const badge = $("#cloudSyncStatus");
    if (badge) {
      badge.textContent = "☁️ Syncing DB...";
      badge.className = "sync-badge syncing";
    }
    try {
      const res = await fetch("/api/data?t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.appData && Array.isArray(json.appData.problems)) {
          state = normalizeApp(json.appData, false);
          renderAll();
          if (badge) {
            badge.textContent = "☁️ SQLite DB Connected";
            badge.className = "sync-badge";
          }
          return;
        }
      }
    } catch (err) {
      console.warn("Backend server not reached, using local storage fallback.", err);
    }
    if (badge) {
      badge.textContent = "💾 Local Storage Mode";
      badge.className = "sync-badge offline";
    }
  }

  async function saveStateToBackend() {
    const badge = $("#cloudSyncStatus");
    if (badge) {
      badge.textContent = "☁️ Saving...";
      badge.className = "sync-badge syncing";
    }
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appData: state })
      });
      if (res.ok) {
        if (badge) {
          badge.textContent = "☁️ SQLite DB Connected";
          badge.className = "sync-badge";
        }
        return;
      }
    } catch (err) {
      console.warn("Could not post state to backend:", err);
    }
    if (badge) {
      badge.textContent = "💾 Saved Locally";
      badge.className = "sync-badge offline";
    }
  }


  /* ============================================================
     STUDY HUB & KNOWLEDGE BASE PAGE (PAGE 6)
  ============================================================ */
  let activeStudyHubProblemId = null;

  function renderStudyHub() {
    const listEl = $('#studyProblemList');
    const mainEl = $('#studyMainPane');
    const searchInput = $('#studySearchInput');
    if (!listEl || !mainEl) return;

    const query = (searchInput?.value || '').toLowerCase().trim();
    const problems = state.problems.filter(p => {
      if (!query) return true;
      return p.name.toLowerCase().includes(query) || (p.topic || '').toLowerCase().includes(query);
    });

    listEl.innerHTML = '';
    if (!problems.length) {
      listEl.append(emptyState('No problems found.'));
      mainEl.innerHTML = `<div class="empty-state">No matching problems found.</div>`;
      return;
    }

    if (!activeStudyHubProblemId || !problems.some(p => p.id === activeStudyHubProblemId)) {
      activeStudyHubProblemId = problems[0].id;
    }

    problems.forEach(p => {
      const card = document.createElement('div');
      card.className = `study-prob-card ${p.id === activeStudyHubProblemId ? 'active' : ''}`;
      card.innerHTML = `
        <div class="study-prob-title">${escapeHTML(p.name)}</div>
        <div class="study-prob-meta">
          <span>📂 ${escapeHTML(p.topic || 'General')}</span>
          <span>•</span>
          <span>${escapeHTML(p.difficulty || 'Medium')}</span>
        </div>
      `;
      card.onclick = () => {
        activeStudyHubProblemId = p.id;
        renderStudyHub();
      };
      listEl.append(card);
    });

    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', () => renderStudyHub());
    }

    const activeProblem = state.problems.find(p => p.id === activeStudyHubProblemId);
    if (activeProblem) {
      const cfftd = activeProblem.cfftd || {};
      const cfftdFields = [
        { key: 'c', label: 'Concept', icon: '🧠' },
        { key: 'f1', label: 'First Thought', icon: '💭' },
        { key: 't', label: 'Technique', icon: '🛠️' },
        { key: 'd', label: 'Debugging', icon: '🐞' },
      ].filter(f => cfftd[f.key] && cfftd[f.key].trim());

      const hasFreeNotes = !!(cfftd.notes && cfftd.notes.trim());

      let notesHtml = '';
      if (cfftdFields.length) {
        notesHtml += `<div class="cfftd-grid" style="margin-bottom:20px">
          ${cfftdFields.map(f => `
            <div class="cfftd-chip cfftd-${f.key}">
              <div class="cfftd-chip-label"><span class="cfftd-chip-icon">${f.icon}</span>${f.label}</div>
              <div class="cfftd-chip-value">${renderRichNotes(cfftd[f.key])}</div>
            </div>
          `).join('')}
        </div>`;
      }

      if (hasFreeNotes) {
        notesHtml += `<div class="notes-freeform${cfftdFields.length ? ' with-chips' : ''}">
          <div class="notes-freeform-label">Full Study Guide &amp; Master Notes</div>
          <div class="notes-rich">${renderRichNotes(cfftd.notes)}</div>
        </div>`;
      }

      if (!cfftdFields.length && !hasFreeNotes) {
        notesHtml = `<div class="empty-state" style="padding:40px 20px;text-align:center">
          <p style="margin-bottom:14px;font-size:1rem;color:var(--ink-60)">No study notes added yet for <strong>${escapeHTML(activeProblem.name)}</strong>.</p>
          <button class="btn primary small" type="button" onclick="openRevisionDialog('${activeProblem.id}')">✍️ Stamp Revision &amp; Add Notes</button>
        </div>`;
      }

      mainEl.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--gold)">
          <div>
            <span class="dm-badge topic">📂 ${escapeHTML(activeProblem.topic || 'General')}</span>
            <span class="dm-badge phase">${escapeHTML(activeProblem.phase || '')}</span>
            <h2 style="font-size:1.8rem;font-weight:900;margin:8px 0 4px;color:var(--ink)">
              ${activeProblem.url ? `<a href="${escapeAttr(activeProblem.url)}" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:underline">${escapeHTML(activeProblem.name)} ↗</a>` : escapeHTML(activeProblem.name)}
            </h2>
            <div style="font-size:0.82rem;color:var(--ink-60)">Solved ${formatShortDate(activeProblem.solveDate)} • Interval ${activeProblem.interval || 1}d • Next Due ${formatShortDate(activeProblem.nextRevDate)}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn primary small" type="button" onclick="openRevisionDialog('${activeProblem.id}')">⚡ Complete Revision</button>
            <button class="btn ghost small" type="button" onclick="openDetailModal('${activeProblem.id}')">📖 Open Full Deep Dive</button>
          </div>
        </div>
        ${notesHtml}
      `;
    }
  }


  /* ============================================================
     CONSISTENCY & ACCOUNTABILITY ENGINE
  ============================================================ */

  // ── Inactivity Decay: -15 coins for each missed day ──
  function applyInactivityDecay() {
    const today = todayISO();
    const loginDays = new Set(state.gamification.loginDays || []);
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    let changed = false;

    // Check all days from 30 days ago to yesterday
    for (let i = 1; i <= 30; i++) {
      const day = addDaysISO(today, -i);
      if (state.gamification.decayAppliedDays.includes(day)) continue;
      if (loginDays.has(day) || frozen.has(day)) continue;

      // This day was missed — apply decay
      const m = metricsForDate(day);
      if (m.solved + m.revisions + m.tasks > 0) continue; // Had some activity

      // Only apply if it's a day where the app existed (after first login)
      const firstLogin = (state.gamification.loginDays || []).sort()[0];
      if (!firstLogin || day < firstLogin) continue;

      state.gamification.coinLedger.push({
        id: `decay:${day}`,
        type: 'decay',
        amount: -INACTIVITY_TAX,
        label: `📉 Inactivity Tax — ${formatShortDate(day)}`,
        createdAt: new Date().toISOString(),
        date: day
      });
      state.gamification.decayAppliedDays.push(day);
      changed = true;
    }

    if (changed) {
      syncCoins();
      saveState();
    }
  }

  // ── Accountability Coach Messages ──
  function renderCoachBanner() {
    const banner = $('#coachBanner');
    const textEl = $('#coachText');
    const subEl = $('#coachSubText');
    if (!banner || !textEl) return;

    const today = todayISO();
    const streak = currentStreak();
    const m = metricsForDate(today);
    const todayActivity = m.solved + m.revisions + m.tasks;
    const due = dueProblems().length;
    const hour = new Date().getHours();
    const checkedIn = state.gamification.loginDays.includes(today);
    const yMissed = yesterdayMissed();
    const longestStreak = longestStreakEver();

    let icon = '🧠';
    let text = '';
    let sub = '';
    let mood = ''; // '', 'coach-danger', 'coach-success'

    if (yMissed && !checkedIn) {
      icon = '💀';
      text = `Yesterday was wasted. −${INACTIVITY_TAX} coins deducted. The chain broke. Are you going to let today die too?`;
      sub = `Your streak was ${longestStreak} days. Now it's gone.`;
      mood = 'coach-danger';
    } else if (!checkedIn && hour >= 20) {
      icon = '⚠️';
      text = `It's ${hour}:00. You still haven't checked in. The chain is about to snap.`;
      sub = `${streak} day streak on the line. Check in now or lose it all.`;
      mood = 'coach-danger';
    } else if (!checkedIn && hour >= 14) {
      icon = '⏰';
      text = `Half the day is gone. No check-in. No activity. The clock doesn't wait.`;
      sub = due > 0 ? `${due} revision${s(due)} waiting. Your future self is watching.` : 'At least check in to keep the chain alive.';
      mood = 'coach-danger';
    } else if (todayActivity === 0 && checkedIn && hour >= 12) {
      icon = '😐';
      text = `Checked in but did nothing. A check-in without action is just an alibi.`;
      sub = due > 0 ? `${due} problem${s(due)} due for revision. Open one.` : 'Solve a new problem. Add it to the log. Prove something.';
      mood = '';
    } else if (todayActivity >= 3) {
      icon = '🔥';
      text = `Domination. ${todayActivity} stamps today. The chain grows stronger.`;
      sub = streak > 1 ? `${streak}-day streak. You're building something unstoppable.` : 'First day of the new chain. Don\'t let tomorrow be different.';
      mood = 'coach-success';
    } else if (todayActivity > 0) {
      icon = '⚡';
      text = `${todayActivity} stamp${s(todayActivity)} so far. Decent, but don't stop.`;
      sub = due > 0 ? `${due} more revision${s(due)} waiting on the desk.` : 'Can you add one more problem today?';
      mood = '';
    } else if (hour < 10 && checkedIn) {
      icon = '☀️';
      text = `Morning check-in done. Streak: ${streak} day${s(streak)}. Now earn it.`;
      sub = due > 0 ? `${due} revision${s(due)} on the desk. Attack.` : 'Clean desk — solve a new problem today.';
      mood = '';
    } else if (hour < 10) {
      icon = '🌅';
      text = `New day. ${streak > 0 ? `${streak}-day streak alive.` : 'No active streak.'} Check in to keep the fire burning.`;
      sub = 'Consistency beats intensity. Every single day.';
      mood = '';
    } else {
      icon = '📰';
      text = streak > 0
        ? `${streak}-day streak active. ${due > 0 ? `${due} revision${s(due)} due.` : 'Desk is clear.'}`
        : 'No active streak. Today is the day to start one.';
      sub = 'The best time to start was yesterday. The next best time is now.';
      mood = '';
    }

    banner.className = 'coach-banner' + (mood ? ' ' + mood : '');
    $('#coachBanner .coach-icon').textContent = icon;
    textEl.textContent = text;
    subEl.textContent = sub;
  }

  // ── War Room: Goal Countdown ──
  function openGoalDialog() {
    const dialog = $('#goalDialog');
    if (!dialog) return;
    if (state.gamification.goalConfig) {
      $('#goalName').value = state.gamification.goalConfig.name || '';
      $('#goalDate').value = state.gamification.goalConfig.date || '';
      $('#goalTarget').value = state.gamification.goalConfig.target || '';
      const appProblems = state.problems.filter(p => !p.archived).length;
      $('#goalExternal').value = (state.gamification.goalConfig.external || 0) + appProblems;
    } else {
      $('#goalName').value = '';
      $('#goalDate').value = '';
      $('#goalTarget').value = '';
      $('#goalExternal').value = '0';
    }
    dialog.showModal();
  }

  function saveGoal(e) {
    e.preventDefault();
    const appProblems = state.problems.filter(p => !p.archived).length;
    const inputTotal = Number($('#goalExternal').value) || 0;
    state.gamification.goalConfig = {
      name: $('#goalName').value.trim(),
      date: $('#goalDate').value,
      target: Number($('#goalTarget').value) || 100,
      external: Math.max(0, inputTotal - appProblems),
      createdAt: state.gamification.goalConfig?.createdAt || todayISO()
    };
    saveState();
    $('#goalDialog')?.close();
    renderWarRoom();
    toast('Mission set. The countdown begins.');
  }

  function clearGoal() {
    state.gamification.goalConfig = null;
    saveState();
    $('#goalDialog')?.close();
    renderWarRoom();
    toast('Mission cleared.');
  }

  function renderWarRoom() {
    const el = $('#warRoomContent');
    const titleEl = $('#warRoomTitle');
    if (!el) return;

    if (!state.gamification.goalConfig) {
      titleEl.textContent = 'Set Your Mission';
      el.innerHTML = `<div class="war-room-empty">
        <p>No mission set. Define a goal to activate the countdown.</p>
        <button class="btn primary" type="button" id="wrSetGoalBtn">⚔ Set Mission</button>
      </div>`;
      $('#wrSetGoalBtn')?.addEventListener('click', openGoalDialog);
      return;
    }

    titleEl.textContent = state.gamification.goalConfig.name;
    const today = todayISO();
    const daysLeft = Math.max(0, daysBetween(today, state.gamification.goalConfig.date));
    const totalDays = Math.max(1, daysBetween(state.gamification.goalConfig.createdAt, state.gamification.goalConfig.date));
    const elapsed = totalDays - daysLeft;
    const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));

    const externalProgress = Number(state.gamification.goalConfig.external) || 0;
    const appProblems = state.problems.filter(p => !p.archived).length;
    const totalProblems = appProblems + externalProgress;
    const remaining = Math.max(0, state.gamification.goalConfig.target - totalProblems);
    // Use 1 decimal place instead of Math.ceil so the user can see fractional progress dynamically
    const dailyNeeded = daysLeft > 0 ? (remaining / daysLeft).toFixed(1) : remaining;

    // Active days count
    const loginDays = new Set(state.gamification.loginDays || []);
    let activeDays = 0;
    for (let i = 0; i < elapsed; i++) {
      const d = addDaysISO(state.gamification.goalConfig.createdAt, i);
      if (loginDays.has(d)) activeDays++;
    }

    // Update ring
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (pct / 100) * circumference;
    const fill = $('#cdRingFill');
    if (fill) {
      fill.style.strokeDasharray = circumference;
      fill.style.strokeDashoffset = offset;
      if (daysLeft <= 7) fill.style.stroke = '#9c2f2a';
      else if (daysLeft <= 30) fill.style.stroke = '#c49a27';
      else fill.style.stroke = '#28714f';
    }

    $('#cdDaysNum').textContent = daysLeft;
    $('#wrProblemsTotal').textContent = totalProblems;
    $('#wrProblemsNeeded').textContent = daysLeft > 0 ? `${dailyNeeded}/day` : '—';
    $('#wrDaysActive').textContent = activeDays;
  }

  // ── Daily Pledge System ──
  function renderPledge() {
    const el = $('#pledgeContent');
    const statusEl = $('#pledgeStatus');
    if (!el) return;

    const today = todayISO();
    const todayPledge = state.gamification.pledges[today];
    const m = metricsForDate(today);
    const hour = new Date().getHours();

    if (!todayPledge) {
      let suggestedProblems = 1;
      if (state.gamification.goalConfig) {
        const goal = state.gamification.goalConfig;
        const daysLeft = Math.max(0, daysBetween(today, goal.date));
        const appProblems = state.problems.filter(p => !p.archived).length;
        const remaining = Math.max(0, goal.target - (appProblems + (Number(goal.external) || 0)));
        if (remaining > 0) suggestedProblems = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
      }

      statusEl.textContent = '';
      statusEl.className = 'pledge-status';
      el.innerHTML = `
        <form id="pledgeForm" class="pledge-form">
          <label>Problems to solve
            <input type="number" id="pledgeProblems" min="0" value="${suggestedProblems}" />
          </label>
          <label>Revisions to do
            <input type="number" id="pledgeRevisions" min="0" value="1" />
          </label>
          <label>Tasks to complete
            <input type="number" id="pledgeTasks" min="0" value="2" />
          </label>
          <button class="btn primary small" type="submit">🤝 I Pledge</button>
        </form>
        <p style="font-size:.78rem;color:var(--ink-60);margin-top:10px;font-family:ui-sans-serif,system-ui">
          Commit to today's goals. Breaking a pledge costs you nothing — except self-respect.
        </p>
      `;
      $('#pledgeForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        state.gamification.pledges[today] = {
          problems: Number($('#pledgeProblems').value) || 0,
          revisions: Number($('#pledgeRevisions').value) || 0,
          tasks: Number($('#pledgeTasks').value) || 0,
          createdAt: new Date().toISOString()
        };
        saveState();
        renderPledge();
        toast('Pledge locked in. Now prove it.');
        playTick();
      });
    } else {
      const pSolved = m.solved >= todayPledge.problems;
      const pRevised = m.revisions >= todayPledge.revisions;
      const pTasks = m.tasks >= todayPledge.tasks;
      const allMet = pSolved && pRevised && pTasks;
      const metCount = [pSolved, pRevised, pTasks].filter(Boolean).length;

      if (allMet) {
        statusEl.textContent = '✓ PLEDGE KEPT';
        statusEl.className = 'pledge-status kept';
      } else if (hour >= 22) {
        statusEl.textContent = '✕ PLEDGE BROKEN';
        statusEl.className = 'pledge-status broken';
      } else {
        statusEl.textContent = `${metCount}/3 IN PROGRESS`;
        statusEl.className = 'pledge-status pending';
      }

      const pBar = (val, target, color) => {
        const pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 100;
        return `<div style="margin-top:10px;height:4px;background:rgba(28,21,16,0.06);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.8s cubic-bezier(.4,0,.15,1);"></div>
        </div>`;
      };

      el.innerHTML = `
        <div class="pledge-recap">
          <div class="pledge-metric">
            <span class="pm-num ${pSolved ? 'pm-achieved' : 'pm-behind'}">${m.solved}</span>
            <span class="pm-lbl">${pSolved ? '✓' : '○'} problems</span>
            <span class="pm-target">goal: ${todayPledge.problems}</span>
            ${pBar(m.solved, todayPledge.problems, pSolved ? 'var(--green)' : 'var(--red)')}
          </div>
          <div class="pledge-metric">
            <span class="pm-num ${pRevised ? 'pm-achieved' : 'pm-behind'}">${m.revisions}</span>
            <span class="pm-lbl">${pRevised ? '✓' : '○'} revisions</span>
            <span class="pm-target">goal: ${todayPledge.revisions}</span>
            ${pBar(m.revisions, todayPledge.revisions, pRevised ? 'var(--green)' : 'var(--red)')}
          </div>
          <div class="pledge-metric">
            <span class="pm-num ${pTasks ? 'pm-achieved' : 'pm-behind'}">${m.tasks}</span>
            <span class="pm-lbl">${pTasks ? '✓' : '○'} tasks</span>
            <span class="pm-target">goal: ${todayPledge.tasks}</span>
            ${pBar(m.tasks, todayPledge.tasks, pTasks ? 'var(--green)' : 'var(--red)')}
          </div>
        </div>
        ${allMet ? '<p style="font-size:.82rem;color:var(--green);margin-top:14px;font-family:ui-sans-serif,system-ui;font-weight:700;text-align:center">✓ Pledge fulfilled. You kept your word today.</p>' : ''}
        ${!allMet && hour < 22 ? `<p style="font-size:.82rem;color:var(--ink-60);margin-top:14px;font-family:ui-sans-serif,system-ui;font-weight:600;text-align:center">${metCount === 0 ? 'You gave your word. Keep it.' : metCount === 1 ? 'Progress started. Keep pushing.' : 'Almost there. Finish strong.'}</p>` : ''}
        ${!allMet && hour >= 22 ? '<p style="font-size:.82rem;color:var(--red);margin-top:14px;font-family:ui-sans-serif,system-ui;font-weight:700;text-align:center">Tomorrow is a new chance. Don\'t let it slip again.</p>' : ''}
      `;
    }
  }

  // ── The Chain: 30-Day Streak Visualization ──
  function longestStreakEver() {
    const days = [...(state.gamification.loginDays || [])].sort();
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    if (!days.length) return 0;
    let best = 0, run = 0;
    let prev = null;
    // Build a set of all "covered" days
    const allDays = new Set([...days, ...frozen]);
    const sorted = [...allDays].sort();
    for (const d of sorted) {
      if (!prev || daysBetween(prev, d) === 1) {
        run++;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = d;
    }
    return best;
  }

  function renderChain() {
    const grid = $('#chainGrid');
    const curEl = $('#chainCurrent');
    const bestEl = $('#chainBest');
    if (!grid) return;

    const today = todayISO();
    const streak = currentStreak();
    const best = longestStreakEver();
    if (curEl) curEl.textContent = streak;
    if (bestEl) bestEl.textContent = best;

    const loginDays = new Set(state.gamification.loginDays || []);
    const frozen = new Set(state.gamification.freezeUsedDays || []);
    const firstLogin = (state.gamification.loginDays || []).sort()[0] || today;

    grid.innerHTML = '';
    // Show last 30 days + today
    for (let i = 30; i >= 0; i--) {
      const day = addDaysISO(today, -i);
      const link = document.createElement('div');
      link.className = 'chain-link';

      const dayNum = Number(day.slice(8, 10));

      if (day > today) {
        link.classList.add('future');
        link.textContent = dayNum;
      } else if (day === today) {
        if (loginDays.has(day)) {
          link.classList.add('active', 'today');
          link.textContent = '✓';
        } else {
          link.classList.add('future');
          link.textContent = dayNum;
          link.style.border = '2px solid var(--gold)';
        }
      } else if (loginDays.has(day)) {
        link.classList.add('active');
        link.textContent = dayNum;
      } else if (frozen.has(day)) {
        link.classList.add('frozen');
        link.textContent = '❄';
      } else if (day >= firstLogin) {
        link.classList.add('missed');
        link.textContent = '✕';
      } else {
        link.classList.add('future');
        link.textContent = dayNum;
      }

      link.title = formatShortDate(day);
      grid.append(link);
    }
  }

  /* ============================================================
     AI GRADER CONFIGURATION
  ============================================================ */
  const geminiInput = $('#geminiApiKey');
  if (geminiInput) {
    if (state && state.gamification && state.gamification.geminiKey) {
      geminiInput.value = state.gamification.geminiKey;
    }
    
    geminiInput.addEventListener('input', (e) => {
      if (!state.gamification) state.gamification = {};
      state.gamification.geminiKey = e.target.value.trim();
      if (typeof saveState === 'function') saveState();
    });
    
    geminiInput.addEventListener('blur', () => {
       toast('Gemini API Key saved!', 'success');
    });
    
    geminiInput.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') {
           geminiInput.blur();
       }
    });
  }

})();
