/* Long-term review scheduling for one ability of one word ("card").
   A card key is `${uid}|${skill}` with skill in meaning | spell | listen.
   The ladder is a configurable training preset, not a universal forgetting curve. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).scheduler = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  const MIN = 60000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR

  // Review points in minutes. classic: the widely used Ebbinghaus-style schedule
  // (5 min, 30 min, 12 h, 1, 2, 4, 7, 15 days) plus 30 days; intense: 4 h instead of 12 h.
  const PRESETS = {
    classic: [5, 30, 720, 1440, 2880, 5760, 10080, 21600, 43200],
    intense: [5, 30, 240, 1440, 2880, 5760, 10080, 21600, 43200],
  }
  const CURVE_MIN = 20 // reviews at a review point before its interval is personalised
  const CURVE_WEIGHT = 30 // shrinks the adjustment toward 1 while data is still thin

  const DEFAULTS = {
    ladder: PRESETS.classic.slice(), // minutes
    newPerDay: 100,
    groupSize: 20,
    meaningTarget: 4, // unaided correct 英译中 answers a word needs in a round
    spellTarget: 4, // unaided correct English answers (中译英 or 听写) a word needs in a round
    wrongPenalty: 'none', // after a wrong answer: none | one (minus one) | reset (that ability back to 0)
    dictation: true, // some English questions are 听写
    scheduleListen: false, // also keep 听写 on the long-term ladder
    dayStart: 4, // a new study day starts at 04:00
    timed: false,
    timeLimit: 20, // seconds; slow answers are only flagged
    autoNext: true, // an answer judged right goes straight to the next question
    reviewFirst: true, // due reviews (a short checkpoint) before each new group
    checkpointCap: 60, // most reviews in one checkpoint, most at risk first
    adaptive: true, // personalise intervals of 1 day and longer from measured recall
    targetRecall: 0.9,
    protect: true, // fewer new words while reviews from earlier days are overdue
    stubbornFails: 3,
    stubbornFactor: 0.5,
    gapSteps: 3,
    gapMs: 60000,
    learnGapMs: 30000, // same word again after 3 other questions or 30 s
    revealGapSteps: 10,
    revealGapMs: 180000,
  }

  function config(over) {
    const c = Object.assign({}, DEFAULTS, over || {})
    if (!Array.isArray(c.ladder) || !c.ladder.length || c.ladder.some(m => !(m > 0)))
      c.ladder = DEFAULTS.ladder.slice()
    c.meaningTarget = Math.max(1, Math.min(10, Math.round(c.meaningTarget) || 4))
    c.spellTarget = Math.max(1, Math.min(10, Math.round(c.spellTarget) || 4))
    if (!['none', 'one', 'reset'].includes(c.wrongPenalty))
      c.wrongPenalty = 'none'
    c.groupSize = Math.max(5, Math.min(50, Math.round(c.groupSize) || 20))
    c.newPerDay = Math.max(0, Math.min(500, Math.round(c.newPerDay)))
    c.checkpointCap = Math.max(10, Math.min(300, Math.round(c.checkpointCap) || 60))
    c.targetRecall = Math.max(0.7, Math.min(0.97, Number(c.targetRecall) || 0.9))
    return c
  }

  const pad = n => String(n).padStart(2, '0')

  /** Calendar day of a timestamp, shifted so that 00:00-03:59 belongs to the previous day. */
  function dayKey(t, dayStart = DEFAULTS.dayStart) {
    const d = new Date(t - dayStart * HOUR)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  /** Timestamp when the study day containing t started. */
  function dayStartAt(t, dayStart = DEFAULTS.dayStart) {
    const d = new Date(t - dayStart * HOUR)
    d.setHours(0, 0, 0, 0)
    return d.getTime() + dayStart * HOUR
  }

  function intervalMs(card, level, cfg) {
    const l = Math.max(0, Math.min(level, cfg.ladder.length - 1))
    // levelFactor: personal adjustment from measured recall (personalCurve), 1 when unset.
    let ms = cfg.ladder[l] * MIN * ((cfg.levelFactor && cfg.levelFactor[l]) || 1)
    // Stubborn words come back sooner once intervals reach a day.
    if (card && card.stubborn && ms >= DAY)
      ms = Math.round(ms * cfg.stubbornFactor)
    return ms
  }

  function fmtInterval(ms) {
    if (ms < HOUR)
      return `${Math.max(1, Math.round(ms / MIN))} 分钟`
    if (ms < DAY)
      return `${Math.round((ms / HOUR) * 10) / 10} 小时`
    return `${Math.round((ms / DAY) * 10) / 10} 天`
  }

  function newCard(uid, skill) {
    return {
      k: `${uid}|${skill}`, uid, skill,
      phase: 'new', level: 0, due: 0, last: 0,
      reps: 0, lapses: 0, fails: 0, hints: 0, extra: 0, extraFails: 0, manual: 0,
      streak: 0, cross: 0, learned: 0, learnedDay: '', stubborn: false, hist: [],
    }
  }

  /** History entry [time, code] or, for an on-time review, [time, code, level tested, ms since the last review]. */
  function push(card, now, code, meta) {
    card.hist.push(meta ? [now, code, meta[0], meta[1]] : [now, code])
    if (card.hist.length > 30)
      card.hist.splice(0, card.hist.length - 30)
  }

  function markFail(card, cfg) {
    card.fails++
    if (card.fails >= cfg.stubbornFails)
      card.stubborn = true
  }

  /** A new word passed its first round: first review after ladder[0]. */
  function graduate(card, now, cfg, priorFails = 0) {
    const c = Object.assign(newCard(card.uid, card.skill), card)
    c.phase = 'review'
    c.level = 0
    c.streak = 0
    c.last = now
    c.learned = c.learned || now
    c.learnedDay = c.learnedDay || dayKey(now, cfg.dayStart)
    c.fails += priorFails
    if (c.fails >= cfg.stubbornFails)
      c.stubborn = true
    c.due = now + intervalMs(c, 0, cfg)
    push(c, now, 'G')
    return c
  }

  /**
   * Apply the result of a due review.
   * outcome: good (unaided, advance one level) | hard (correct but effortful, keep level)
   *        | fail (wrong, unknown or answer viewed: relearn) | hinted (no change, stays due)
   * The next due time always counts from `now`, the actual completion time.
   * test: this answer was the first attempt at a due card, so it measures recall after the
   * interval; it is kept in the history for the personal forgetting curve.
   */
  function review(card, outcome, now, cfg, test = false) {
    const c = Object.assign({}, card, { hist: card.hist.slice() })
    const meta = test ? [card.level, Math.max(0, now - card.last)] : null
    if (outcome === 'good' || outcome === 'hard') {
      const today = dayKey(now, cfg.dayStart)
      if (c.learnedDay && today > c.learnedDay && now - c.last >= 12 * HOUR)
        c.cross++
      if (outcome === 'good')
        c.level = Math.min(c.level + 1, cfg.ladder.length - 1)
      c.phase = 'review'
      c.reps++
      c.streak++
      if (c.stubborn && c.streak >= 3 && c.level >= 4)
        c.stubborn = false
      c.last = now
      c.due = now + intervalMs(c, c.level, cfg)
      push(c, now, outcome === 'good' ? 'g' : 'h', meta)
    }
    else if (outcome === 'hinted') {
      c.hints++
      push(c, now, 'i', meta)
    }
    else {
      if (c.phase !== 'relearn')
        c.lapses++
      markFail(c, cfg)
      c.phase = 'relearn'
      c.level = 0
      c.streak = 0
      c.last = now
      c.due = now // stays due until relearning passes
      push(c, now, 'w', meta)
    }
    return c
  }

  /** A failed card was relearned in session: restart from the shortest interval. */
  function relearned(card, now, cfg) {
    const c = Object.assign({}, card, { hist: card.hist.slice() })
    c.phase = 'review'
    c.level = 0
    c.last = now
    c.due = now + intervalMs(c, 0, cfg)
    push(c, now, 'R')
    return c
  }

  /** Practice before the card is due: logged separately, never advances the level. */
  function extra(card, ok, now, cfg) {
    const c = Object.assign({}, card, { hist: card.hist.slice() })
    c.extra++
    if (!ok) {
      c.extraFails++
      markFail(c, cfg)
      c.due = Math.min(c.due, now) // forgotten: make it a real due review
    }
    push(c, now, ok ? 'x' : 'X')
    return c
  }

  const isReviewCard = c => c && (c.phase === 'review' || c.phase === 'relearn')
  const isDue = (c, now) => isReviewCard(c) && c.due <= now

  /**
   * Forgetting risk of a due card: time since the last review relative to the planned interval.
   * A 5-minute card 20 minutes late (4x) is more at risk than a 7-day card one day late (1.1x).
   * Cards being relearned have no interval yet and come first.
   */
  const riskOf = (c, now) => (c.phase === 'relearn' ? Infinity : (now - c.last) / Math.max(MIN, c.due - c.last))

  function dueByRisk(cards, now) {
    return cards.filter(c => isDue(c, now)).map(c => [riskOf(c, now), c]).sort((a, b) => b[0] - a[0] || a[1].due - b[1].due).map(x => x[1])
  }

  /** Due cards, one per word ability, relearning and stubborn first, then most overdue. */
  function dueList(cards, now) {
    return cards.filter(c => isDue(c, now)).sort((a, b) =>
      (b.phase === 'relearn') - (a.phase === 'relearn') || (b.stubborn - a.stubborn) || a.due - b.due)
  }

  const BUCKETS = ['1 小时内', '今天', '明天', '2-3 天', '4-7 天', '8-30 天', '30 天后']

  /** Upcoming review counts per time bucket (not yet due cards only). */
  function forecast(cards, now, dayStart = DEFAULTS.dayStart) {
    const counts = BUCKETS.map(() => 0)
    const tomorrow = dayStartAt(now, dayStart) + DAY
    for (const c of cards) {
      if (!isReviewCard(c) || c.due <= now)
        continue
      const d = c.due
      let i
      if (d - now <= HOUR)
        i = 0
      else if (d < tomorrow)
        i = 1
      else if (d < tomorrow + DAY)
        i = 2
      else if (d < tomorrow + 3 * DAY)
        i = 3
      else if (d < tomorrow + 7 * DAY)
        i = 4
      else if (d < tomorrow + 30 * DAY)
        i = 5
      else
        i = 6
      counts[i]++
    }
    return BUCKETS.map((label, i) => ({ label, count: counts[i] }))
  }

  /**
   * Measured recall at each review point, from on-time reviews in the card histories.
   * For review points of a day or more with enough data, factor is the interval change that
   * would bring recall to cfg.targetRecall under exponential forgetting R(t) = exp(-t / S):
   * S is estimated from the recall observed after the mean actual gap. Bounded to 0.5-2.
   */
  function personalCurve(cards, cfg) {
    const rows = cfg.ladder.map((minutes, level) => ({ level, minutes, n: 0, ok: 0, gapSum: 0, gap: 0, recall: null, factor: 1 }))
    for (const c of cards) {
      for (const h of c.hist || []) {
        if (h.length < 4 || !'ghiw'.includes(h[1]))
          continue
        const r = rows[Math.max(0, Math.min(h[2], rows.length - 1))]
        r.n++
        if (h[1] === 'g' || h[1] === 'h')
          r.ok++
        r.gapSum += h[3]
      }
    }
    for (const r of rows) {
      if (!r.n)
        continue
      r.recall = r.ok / r.n
      r.gap = r.gapSum / r.n
      if (r.minutes < 1440 || r.n < CURVE_MIN)
        continue
      const p = (r.ok + 1) / (r.n + 2)
      const ideal = r.gap * Math.log(cfg.targetRecall) / Math.log(p)
      const w = r.n / (r.n + CURVE_WEIGHT)
      const f = Math.exp(w * Math.log(ideal / (r.minutes * MIN)))
      r.factor = Math.round(Math.max(0.5, Math.min(2, f)) * 100) / 100
    }
    return rows
  }

  /**
   * Expected questions per day if `perDay` new words are learned every day (all answers right,
   * nothing late). Each word: learning in its group, then one review per review point and ability.
   */
  function projectLoad(cfg, perDay, days = 30) {
    const abilities = cfg.scheduleListen ? 3 : 2
    const learn = perDay * ((cfg.meaningTarget + cfg.spellTarget) * 1.15 + 1)
    const offsets = []
    let t = 0
    for (let l = 0; l < cfg.ladder.length; l++) {
      t += intervalMs(null, l, cfg)
      offsets.push(t)
    }
    const review = new Array(days).fill(0)
    for (let d = 0; d < days; d++) {
      const start = d * DAY + 20 * HOUR // a cohort finished at 20:00
      for (const o of offsets) {
        const day = Math.floor((start + o) / DAY)
        if (day < days)
          review[day] += perDay * abilities
      }
    }
    return review.map(r => ({ learn, review: r, total: Math.round(learn + r) }))
  }

  /**
   * Word status: new | skipped (marked as already known) | learning (刚学过, round not passed) | passed (本轮通过)
   * | retained (跨天复习通过 for both 英译中 and 中译英).
   */
  function wordStatus(learn, meaning, spell) {
    if (!learn || learn.state === 'new')
      return 'new'
    if (learn.state === 'skipped')
      return 'skipped'
    if (learn.state !== 'done')
      return 'learning'
    if (meaning && spell && meaning.cross > 0 && spell.cross > 0)
      return 'retained'
    return 'passed'
  }

  return { DEFAULTS, PRESETS, MIN, HOUR, DAY, config, dayKey, dayStartAt, intervalMs, fmtInterval, newCard, graduate, review, relearned, extra, isReviewCard, isDue, dueList, dueByRisk, riskOf, forecast, personalCurve, projectLoad, wordStatus, BUCKETS }
})
