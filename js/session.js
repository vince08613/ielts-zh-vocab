/* Training round engine (pure, serializable).
   New words: the words of a round are mixed and asked again and again, 英译中 and English
   (中译英 or 听写), until each word has the configured number of unaided correct answers in
   both (default 4 + 4). Then the word leaves the round and gets its first spaced review.
   New-word rounds contain only their own words; due reviews and relearning of review
   failures run in their own 到期复习 / 只练错词 rounds.

   state: { get(key), put(record), cards() } where records are
     W:<uid>       learning record of a new word (cnt = correct answers so far)
     <uid>|<skill> long-term card (scheduler.js)                                */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports
  const api = factory(isNode ? require('./scheduler.js') : root.VocabApp.scheduler)
  if (isNode)
    module.exports = api
  else
    root.VocabApp.session = api
})(typeof self !== 'undefined' ? self : this, (S) => {
  'use strict'

  const ACTIVE = 6 // new words in play at the same time
  const CHECK = ['check1', 'check2', 'final', 'recheck', 'xcheck']
  // Lower runs first: relearning checks, due reviews, new words, early practice, end-of-round checks.
  const PRIORITY = { check1: 0, check2: 0, recheck: 0, xcheck: 0, review: 1, intro: 2, learn: 2, retry: 2, extra: 3, final: 4 }
  // Which counter an answer adds to: 听写 counts as English.
  const GROUP = { meaning: 'meaning', spell: 'spell', listen: 'spell' }
  const SKILL_NAME = { meaning: '英译中', spell: '中译英', listen: '听写' }

  function rand(s) {
    s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
    return s.seed / 4294967296
  }
  const between = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1))

  function newLearn(uid, now, cfg) {
    return { k: `W:${uid}`, uid, state: 'learning', intro: now, introDay: S.dayKey(now, cfg.dayStart), cnt: { meaning: 0, spell: 0 }, streak: 0, fails: { meaning: 0, spell: 0, listen: 0 }, hints: 0, tries: 0, grad: 0, gradDay: '' }
  }

  /** The learning record of a word that has really been introduced (not new, not marked as known). */
  function learnOf(state, uid) {
    const w = state.get(`W:${uid}`)
    return w && (w.state === 'learning' || w.state === 'done') ? w : null
  }

  const counts = w => Object.assign({ meaning: 0, spell: 0 }, w && w.cnt)

  /** Correct answers still needed: { meaning, spell }. */
  function left(w, cfg) {
    const c = counts(w)
    return { meaning: Math.max(0, cfg.meaningTarget - c.meaning), spell: Math.max(0, cfg.spellTarget - c.spell) }
  }

  const finished = (w, cfg) => {
    const l = left(w, cfg)
    return !l.meaning && !l.spell
  }

  /**
   * mode: daily | due | wrong
   * queue: the words of this round (unfinished words first, then new ones)
   * wrongKeys: card keys trained in "wrong" mode
   * scope: optional uid prefix such as "03:" that limits due reviews pulled into the round
   */
  function create({ mode, now, cfg, queue = [], newCount = 0, wrongKeys = [], state, audio = true, seed, scope = '' }) {
    const s = {
      v: 3, id: `${now.toString(36)}${Math.floor((seed || now) % 1e4).toString(36)}`, mode, created: now, scope,
      day: S.dayKey(now, cfg.dayStart), step: 0, seq: 0, seed: (seed || now) >>> 0,
      round: queue.slice(), pending: queue.slice(), active: [], reviews: 0,
      tasks: [], newCount, last: {}, current: null, noAudio: !audio,
      stats: { answered: 0, right: 0, wrong: 0, hinted: 0, intro: 0, graduated: [], relearned: 0, reviews: 0, extra: 0 },
    }
    if (mode === 'wrong') {
      for (const k of wrongKeys) {
        const c = state.get(k)
        if (!S.isReviewCard(c))
          continue
        const purpose = !S.isDue(c, now) ? 'extra' : c.phase === 'relearn' ? 'check1' : 'review'
        add(s, { uid: c.uid, skill: c.skill, k, track: 'card', purpose, due: c.due })
      }
    }
    return s
  }

  function add(s, t) {
    t.id = ++s.seq
    t.minStep = t.minStep || 0
    t.minAt = t.minAt || 0
    t.made = s.step
    s.tasks.push(t)
    return t
  }

  function addGapped(s, t, now, steps, ms) {
    return add(s, Object.assign(t, { minStep: s.step + steps, minAt: now + ms }))
  }

  /** Next question type for a word: the first test is 英译中, then whichever still needs answers. */
  function pickSkill(s, w, cfg) {
    if (!w || !w.tries)
      return 'meaning'
    const l = left(w, cfg)
    let g
    if (l.meaning && l.spell)
      g = rand(s) * (l.meaning + l.spell) < l.meaning ? 'meaning' : 'spell'
    else
      g = l.spell ? 'spell' : 'meaning'
    if (g === 'spell' && cfg.dictation && !s.noAudio && rand(s) < 0.3)
      return 'listen'
    return g
  }

  /** Bring new words into play, up to ACTIVE at a time. */
  function activate(s, state, cfg) {
    const cap = Math.min(ACTIVE, cfg.groupSize)
    let n = 0
    while (s.active.length < cap && s.pending.length) {
      const uid = s.pending.shift()
      const w = learnOf(state, uid)
      if (w && w.state === 'done')
        continue
      s.active.push(uid)
      if (!w)
        add(s, { uid, skill: '', track: 'learn', purpose: 'intro', minStep: s.step + 2 * n })
      add(s, { uid, skill: pickSkill(s, w, cfg), track: 'learn', purpose: 'learn', minStep: s.step + (w ? between(s, 0, 2) : 3 + 2 * n) })
      n++
    }
  }

  function gapNeed(t, cfg) {
    // A first test of a review card waits longer after the word's answer was on screen.
    if (t.purpose === 'review' || t.purpose === 'extra')
      return [cfg.revealGapSteps, cfg.revealGapMs]
    return [cfg.gapSteps, t.track === 'learn' ? cfg.learnGapMs : cfg.gapMs]
  }

  /**
   * Timestamp from which t may be asked (0 = now). The same word always needs 3 other
   * questions or some time in between; for new words minStep only orders the mix.
   */
  function readyAt(s, t, cfg) {
    if (t.track === 'learn' && t.purpose !== 'intro' && s.tasks.some(x => x.uid === t.uid && x.purpose === 'intro'))
      return Infinity
    let at = t.track === 'learn' || s.step >= t.minStep ? 0 : t.minAt
    const l = s.last[t.uid]
    if (t.purpose !== 'intro' && l) {
      const [steps, ms] = gapNeed(t, cfg)
      if (s.step - l.step < steps)
        at = Math.max(at, l.at + ms)
    }
    return at
  }

  function priority(s, t) {
    if (t.purpose === 'final' && s.step - t.made >= 25)
      return 0.5
    return PRIORITY[t.purpose]
  }

  function compare(s, a, b) {
    const p = priority(s, a) - priority(s, b)
    if (p)
      return p
    if (a.purpose === 'review' && b.purpose === 'review')
      return a.due - b.due || a.id - b.id
    if (a.track === 'learn' && b.track === 'learn')
      return (a.minStep > s.step) - (b.minStep > s.step) || a.minStep - b.minStep || a.id - b.id
    return a.minStep - b.minStep || a.id - b.id
  }

  /** Add due reviews (到期复习 rounds only; new-word rounds never pull reviews in). */
  function refreshDue(s, state, cfg, now) {
    if (s.mode !== 'due')
      return 0
    const have = new Set(s.tasks.filter(t => t.track === 'card').map(t => t.k))
    let added = 0
    for (const c of S.dueList(state.cards(), now)) {
      if (s.scope && !c.uid.startsWith(s.scope))
        continue
      if (have.has(c.k) || (c.skill === 'listen' && (!cfg.scheduleListen || s.noAudio)))
        continue
      add(s, { uid: c.uid, skill: c.skill, k: c.k, track: 'card', purpose: c.phase === 'relearn' ? 'check1' : 'review', due: c.due })
      s.reviews = (s.reviews || 0) + 1
      added++
    }
    return added
  }

  /** 听写 off or no audio: new-word 听写 questions become 中译英; review 听写 cards are dropped. */
  function dropListen(s, keepCards) {
    for (const t of s.tasks) {
      if (t.track === 'learn' && t.skill === 'listen')
        t.skill = 'spell'
    }
    if (!keepCards)
      s.tasks = s.tasks.filter(t => t.skill !== 'listen')
  }

  function pick(s, cfg, now) {
    const ready = s.tasks.filter(t => readyAt(s, t, cfg) <= now)
    return ready.length ? ready.sort((a, b) => compare(s, a, b))[0] : null
  }

  /**
   * Pick the next task. Returns { task } | { wait: ms } | { done: true }.
   * Due cards are re-read from state each call, so reopening the app catches up.
   */
  function next(s, state, cfg, now) {
    if (s.current)
      return { task: s.current.task }
    refreshDue(s, state, cfg, now)
    if ((s.noAudio || !cfg.dictation) && s.tasks.some(t => t.skill === 'listen'))
      dropListen(s, !s.noAudio)
    activate(s, state, cfg)
    const task = pick(s, cfg, now)
    if (task) {
      s.current = { task, startedAt: now }
      return { task }
    }
    if (s.tasks.length)
      return { wait: Math.max(1000, Math.min(...s.tasks.map(t => readyAt(s, t, cfg))) - now) }
    s.done = true
    return { done: true }
  }

  function dropChain(s, uid, skill, track) {
    s.tasks = s.tasks.filter(t => !(t.uid === uid && t.skill === skill && t.track === track && CHECK.includes(t.purpose)))
  }

  function progressText(w, cfg) {
    const c = counts(w)
    return `中文 ${Math.min(c.meaning, cfg.meaningTarget)}/${cfg.meaningTarget} · 英文 ${Math.min(c.spell, cfg.spellTarget)}/${cfg.spellTarget}`
  }

  function applyLearn(s, state, cfg, now, t, out, put, res) {
    const w = learnOf(state, t.uid) || newLearn(t.uid, now, cfg)
    w.cnt = counts(w)
    w.fails = Object.assign({ meaning: 0, spell: 0, listen: 0 }, w.fails)
    w.tries++
    const g = GROUP[t.skill]
    const ok = out.result === 'right'
    let note
    let retry = false
    if (ok && !out.hinted) {
      w.cnt[g]++
      w.streak++
      note = progressText(w, cfg)
    }
    else if (ok) {
      w.hints++
      retry = true
      note = `用了提示，这次不计数 · 3～5 题后再考 · ${progressText(w, cfg)}`
    }
    else {
      w.streak = 0
      w.fails[t.skill]++
      let penalty = '这次不计数'
      if (cfg.wrongPenalty === 'one' && w.cnt[g] > 0) {
        w.cnt[g]--
        penalty = '扣 1 次'
      }
      else if (cfg.wrongPenalty === 'reset' && w.cnt[g] > 0) {
        w.cnt[g] = 0
        penalty = `${g === 'meaning' ? '中文' : '英文'}清零`
      }
      retry = true
      note = `${penalty} · 3～5 题后再考 · ${progressText(w, cfg)}`
    }
    if (finished(w, cfg)) {
      w.state = 'done'
      w.grad = now
      w.gradDay = S.dayKey(now, cfg.dayStart)
      const skills = cfg.scheduleListen ? ['meaning', 'spell', 'listen'] : ['meaning', 'spell']
      for (const skill of skills) {
        const k = `${t.uid}|${skill}`
        put(S.graduate(state.get(k) || S.newCard(t.uid, skill), now, cfg, w.fails[skill] || 0))
      }
      s.active = s.active.filter(u => u !== t.uid)
      s.stats.graduated.push(t.uid)
      res.graduated = true
      note = `本轮完成 · ${S.fmtInterval(S.intervalMs(null, 0, cfg))}后首次复习`
    }
    else {
      const gap = retry ? between(s, 3, 5) : between(s, 3, 6)
      add(s, { uid: t.uid, skill: retry ? t.skill : pickSkill(s, w, cfg), track: 'learn', purpose: retry ? 'retry' : 'learn', minStep: s.step + gap })
    }
    put(w)
    return note
  }

  function nextDue(c) {
    return `下次 ${S.fmtInterval(c.due - c.last)}后`
  }

  function applyCard(s, state, cfg, now, t, out, put) {
    let c = state.get(t.k)
    const ok = out.result === 'right'
    const clean = ok && !out.hinted
    const restart = () => {
      c = S.review(c, 'fail', now, cfg)
      dropChain(s, t.uid, t.skill, 'card')
      addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: 'check1' }, now, between(s, 3, 5) + 1, 60000)
    }
    let note
    if (t.purpose === 'extra' || t.purpose === 'xcheck') {
      c = S.extra(c, clean, now, cfg)
      s.stats.extra++
      if (clean) {
        note = '加练已记录，不改变复习级别'
      }
      else {
        addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: 'xcheck' }, now, between(s, 3, 5) + 1, 60000)
        note = '加练出错，已改为到期 · 3～5 题后再考'
      }
    }
    else if (t.purpose === 'review') {
      s.stats.reviews++
      if (clean) {
        c = S.review(c, out.hard ? 'hard' : 'good', now, cfg)
        note = `${out.hard ? '困难，保持当前级别' : `复习通过，升到第 ${c.level + 1} 级`} · ${nextDue(c)}`
      }
      else if (ok) {
        c = S.review(c, 'hinted', now, cfg)
        addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: 'recheck' }, now, between(s, 3, 5) + 1, 60000)
        note = '用了提示，不升级 · 3～5 题后再考'
      }
      else {
        restart()
        note = '进入重学 · 3～5 题后再考'
      }
    }
    else if (!clean) {
      if (ok) {
        c = Object.assign({}, c, { hints: c.hints + 1 })
        addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: t.purpose }, now, between(s, 3, 5) + 1, 60000)
        note = '用了提示，不计入 · 3～5 题后再考'
      }
      else {
        restart()
        note = '重学计数清零 · 3～5 题后再考'
      }
    }
    else if (t.purpose === 'check1') {
      addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: 'check2' }, now, between(s, 10, 15) + 1, 180000)
      note = '10～15 题后再检查一次'
    }
    else if (t.purpose === 'check2') {
      addGapped(s, { uid: t.uid, skill: t.skill, k: t.k, track: 'card', purpose: 'final' }, now, 6, 300000)
      note = '本轮结束前再混合复测一次'
    }
    else if (t.purpose === 'final') {
      c = S.relearned(c, now, cfg)
      s.stats.relearned++
      note = `重学通过 · ${nextDue(c)}`
    }
    else { // recheck after a hinted review: remembered, but not independently
      c = S.review(c, 'hard', now, cfg)
      note = `提示后已答对，保持当前级别 · ${nextDue(c)}`
    }
    put(c)
    return note
  }

  /**
   * Apply the answer to the current task.
   * out: { result: 'right'|'wrong'|'seen', hinted, hard, kind: answer|unknown|manual, answer, ms, slow }
   * Returns { task, changes, log, note, graduated } or null when nothing is pending.
   */
  function commit(s, state, cfg, now, out) {
    const cur = s.current
    if (!cur)
      return null
    const t = cur.task
    const changes = []
    const put = (rec) => {
      state.put(rec)
      changes.push(rec)
    }
    const res = { task: t, changes, note: '', graduated: false }
    s.tasks = s.tasks.filter(x => x.id !== t.id)
    s.step++
    s.last[t.uid] = { step: s.step, at: now }
    if (t.purpose === 'intro') {
      if (!learnOf(state, t.uid))
        put(newLearn(t.uid, now, cfg))
      s.stats.intro++
    }
    else {
      s.stats.answered++
      if (out.result === 'right' && !out.hinted)
        s.stats.right++
      else if (out.result === 'right')
        s.stats.hinted++
      else
        s.stats.wrong++
      res.note = t.track === 'learn' ? applyLearn(s, state, cfg, now, t, out, put, res) : applyCard(s, state, cfg, now, t, out, put)
    }
    res.log = {
      t: now, sid: s.id, mode: s.mode, uid: t.uid, skill: t.skill || 'intro', purpose: t.purpose,
      res: t.purpose === 'intro' ? 'seen' : out.result, hinted: !!out.hinted, hard: !!out.hard,
      kind: out.kind || 'answer', ans: out.answer || '', ms: out.ms || 0, slow: !!out.slow, grad: res.graduated,
    }
    s.current = null
    return res
  }

  /** The note commit() would produce, without changing anything. */
  function preview(s, state, cfg, now, out) {
    const overlay = new Map()
    const copy = v => (v ? JSON.parse(JSON.stringify(v)) : v)
    const shadow = {
      get: k => (overlay.has(k) ? overlay.get(k) : copy(state.get(k))),
      put: r => overlay.set(r.k, r),
      cards: () => state.cards(),
    }
    const r = commit(copy(s), shadow, cfg, now, out)
    return r ? r.note : ''
  }

  /** No audio can be played: 听写 becomes 中译英, the current 听写 question is asked again as 中译英. */
  function disableAudio(s) {
    s.noAudio = true
    if (s.current && s.current.task.skill === 'listen')
      s.current = null
    dropListen(s, false)
  }

  /** Questions left in this round (estimate: each word still needs its remaining correct answers). */
  function remaining(s, cfg, state) {
    let n = s.tasks.filter(t => t.track === 'card' || t.purpose === 'intro').length
    for (const uid of s.active.concat(s.pending)) {
      const w = state ? learnOf(state, uid) : null
      if (w && w.state === 'done')
        continue
      const l = left(w, cfg)
      n += l.meaning + l.spell + (w || s.active.includes(uid) ? 0 : 1)
    }
    return n
  }

  return { create, next, commit, preview, disableAudio, remaining, newLearn, learnOf, counts, left, SKILL_NAME, ACTIVE }
})
