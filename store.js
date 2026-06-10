/**
 * PD Wessense — Shared Data Store
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all pages. Include this script first,
 * then use PD.* methods anywhere on the page.
 *
 * Personalised pages call PD.init('firstname') before anything else.
 * Generic pages use the default key 'essense-pd'.
 *
 * Usage examples:
 *   PD.init('rosanne')          // personalised namespace
 *   PD.profile()                // read profile
 *   PD.saveProfile({ name })    // write profile fields
 *   PD.summary()                // dashboard counts + time
 */

const PD = (() => {

  // ── Default schema ─────────────────────────────────────────────
  const DEFAULTS = {
    meta: {
      firstRunComplete: false,
      createdAt: '',
      lastActiveAt: ''
    },
    profile: {
      name: '',
      role: '',
      track: '',
      level: '',
      targetLevel: '',
      coach: '',
      pdTimeEnabled: false,
      pdTimeMinutes: 96,          // default = 1.6 hrs / 4% of week
      calendarSanctity: {
        enabled: false,
        day: 'Tuesday',
        time: '11:00',
        duration: '45 min'
      }
    },
    goals: [],
    actions: [],
    reflections: [],
    feedback: [],
    coaching: {
      nextSessionDate: '',
      nextSessionDuration: 30,    // minutes
      myTopics: '',
      commitments: [],            // [{ id, text, done }]
      lastSharedAt: null,
      prepShared: false
    }
  };

  // Suggested durations per reflection format (minutes)
  const FORMAT_DURATIONS = {
    written: 8,
    walk:    15,
    quick:   3,
    audio:   5,
    talk:    10
  };

  let _key = 'essense-pd';

  // ── Internal helpers ───────────────────────────────────────────

  function _defaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function _read() {
    try {
      const raw = localStorage.getItem(_key);
      if (!raw) return _defaults();
      // Deep merge: stored data over defaults so new fields always exist
      return _merge(_defaults(), JSON.parse(raw));
    } catch(e) {
      return _defaults();
    }
  }

  function _write(data) {
    try {
      if (!data.meta) data.meta = {};
      data.meta.lastActiveAt = new Date().toISOString();
      localStorage.setItem(_key, JSON.stringify(data));
      return true;
    } catch(e) {
      console.warn('[PD store] write failed:', e);
      return false;
    }
  }

  // Shallow-deep merge: arrays are replaced, objects are merged one level
  function _merge(target, source) {
    const out = { ...target };
    for (const k in source) {
      if (source[k] === null || source[k] === undefined) continue;
      if (Array.isArray(source[k])) {
        out[k] = source[k];
      } else if (typeof source[k] === 'object') {
        out[k] = { ...(target[k] || {}), ...source[k] };
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _now() {
    return new Date().toISOString();
  }

  function _weekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  function _isThisWeek(dateStr) {
    if (!dateStr) return false;
    try { return new Date(dateStr) >= _weekStart(); }
    catch(e) { return false; }
  }

  // ── Public API ─────────────────────────────────────────────────
  return {

    // Initialise namespace (call before anything on personalised pages)
    init(namespace) {
      _key = namespace ? `essense-pd-${namespace}` : 'essense-pd';
    },

    get key() { return _key; },

    // ── Full store ───────────────────────────────────────────────
    get()         { return _read(); },
    save(data)    { return _write(data); },

    // Wipe all data for this namespace (use for testing / reset)
    reset() {
      try { localStorage.removeItem(_key); return true; }
      catch(e) { return false; }
    },

    // ── First run ────────────────────────────────────────────────
    isFirstRun() {
      return !_read().meta.firstRunComplete;
    },
    completeFirstRun() {
      const data = _read();
      data.meta.firstRunComplete = true;
      if (!data.meta.createdAt) data.meta.createdAt = _now();
      return _write(data);
    },

    // ── Profile ──────────────────────────────────────────────────
    profile() {
      return _read().profile;
    },
    saveProfile(fields) {
      const data = _read();
      data.profile = { ...data.profile, ...fields };
      return _write(data);
    },

    // ── Goals ────────────────────────────────────────────────────
    goals() {
      return _read().goals;
    },
    goalById(id) {
      return _read().goals.find(g => g.id === id) || null;
    },
    saveGoal(goal) {
      const data = _read();
      const idx = data.goals.findIndex(g => g.id === goal.id);
      if (idx > -1) {
        data.goals[idx] = { ...data.goals[idx], ...goal };
      } else {
        data.goals.push({
          subgoals: [],
          dimension: '',
          linkedToFramework: false,
          frameworkAnchor: '',
          photo: null,
          ...goal,
          id: goal.id || _uid(),
          createdAt: _now()
        });
      }
      return _write(data);
    },
    deleteGoal(id) {
      const data = _read();
      data.goals = data.goals.filter(g => g.id !== id);
      return _write(data);
    },
    saveSubgoal(goalId, subgoal) {
      const data = _read();
      const goal = data.goals.find(g => g.id === goalId);
      if (!goal) return false;
      const idx = goal.subgoals.findIndex(s => s.id === subgoal.id);
      if (idx > -1) {
        goal.subgoals[idx] = { ...goal.subgoals[idx], ...subgoal };
      } else {
        goal.subgoals.push({ done: false, ...subgoal, id: subgoal.id || _uid() });
      }
      return _write(data);
    },

    // ── Actions ──────────────────────────────────────────────────
    actions() {
      return _read().actions;
    },
    actionsByGoal(goalId) {
      return _read().actions.filter(a => a.goalId === goalId);
    },
    saveAction(action) {
      const data = _read();
      const idx = data.actions.findIndex(a => a.id === action.id);
      if (idx > -1) {
        data.actions[idx] = { ...data.actions[idx], ...action };
      } else {
        data.actions.push({
          goalId: null,
          done: false,
          energy: '',
          note: '',
          minutesSpent: null,
          doneAt: null,
          ...action,
          id: action.id || _uid(),
          createdAt: _now()
        });
      }
      return _write(data);
    },
    markActionDone(id, minutesSpent) {
      const data = _read();
      const action = data.actions.find(a => a.id === id);
      if (!action) return false;
      action.done = true;
      action.doneAt = _now();
      action.minutesSpent = minutesSpent;
      return _write(data);
    },
    deleteAction(id) {
      const data = _read();
      data.actions = data.actions.filter(a => a.id !== id);
      return _write(data);
    },

    // ── Reflections ──────────────────────────────────────────────
    reflections() {
      return _read().reflections;
    },
    saveReflection(reflection) {
      const data = _read();
      data.reflections.unshift({
        goalId: null,
        energy: '',
        content: {},
        minutesSpent: null,
        sharedWithCoach: false,
        ...reflection,
        id: reflection.id || _uid(),
        date: reflection.date || _now()
      });
      return _write(data);
    },
    // Returns suggested minutes for a given format key
    suggestedMinutes(format) {
      return FORMAT_DURATIONS[format] || 10;
    },

    // ── Feedback ─────────────────────────────────────────────────
    feedback() {
      return _read().feedback;
    },
    saveFeedback(fb) {
      const data = _read();
      data.feedback.unshift({
        from: '',
        type: 'positive',
        text: '',
        sharedWithCoach: false,
        ...fb,
        id: fb.id || _uid(),
        date: fb.date || _now()
      });
      return _write(data);
    },

    // ── Coaching ─────────────────────────────────────────────────
    coaching() {
      return _read().coaching;
    },
    saveCoaching(fields) {
      const data = _read();
      data.coaching = { ...data.coaching, ...fields };
      return _write(data);
    },
    sharePrepWithCoach() {
      const data = _read();
      data.coaching.prepShared = true;
      data.coaching.lastSharedAt = _now();
      return _write(data);
    },

    // ── Time tracking ────────────────────────────────────────────
    minutesThisWeek() {
      const data = _read();
      let total = 0;

      // Completed actions this week
      data.actions
        .filter(a => a.done && _isThisWeek(a.doneAt))
        .forEach(a => { total += (Number(a.minutesSpent) || 0); });

      // Reflections this week
      data.reflections
        .filter(r => _isThisWeek(r.date))
        .forEach(r => { total += (Number(r.minutesSpent) || 0); });

      // Coach session this week
      if (_isThisWeek(data.coaching.nextSessionDate)) {
        total += (Number(data.coaching.nextSessionDuration) || 30);
      }

      return total;
    },

    // ── Dashboard summary (all counts in one call) ────────────────
    summary() {
      const data  = _read();
      const goals = data.goals;

      return {
        goalsCount:       goals.length,
        subgoalsTotal:    goals.reduce((s, g) => s + (g.subgoals || []).length, 0),
        subgoalsDone:     goals.reduce((s, g) => s + (g.subgoals || []).filter(sg => sg.done).length, 0),
        actionsTotal:     data.actions.length,
        actionsDone:      data.actions.filter(a => a.done).length,
        reflectionsCount: data.reflections.length,
        feedbackCount:    data.feedback.length,
        minutesThisWeek:  this.minutesThisWeek(),
        targetMinutes:    data.profile.pdTimeMinutes || 96,
        pdTimeEnabled:    data.profile.pdTimeEnabled || false
      };
    }

  };

})();
