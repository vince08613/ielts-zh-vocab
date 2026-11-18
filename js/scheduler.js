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

  const DEFAULTS = {
    ladder: [5, 30, 240, 1440, 2880, 5760, 10080, 21600, 43200], // minutes
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
    let ms = cfg.ladder[l] * MIN
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

  function push(card, now, code) {
    card.hist.push([now, code])
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
   */
  function review(card, outcome, now, cfg) {
    const c = Object.assign({}, card, { hist: card.hist.slice() })
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
      push(c, now, outcome === 'good' ? 'g' : 'h')
    }
    else if (outcome === 'hinted') {
      c.hints++
      push(c, now, 'i')
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
      push(c, now, 'w')
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

  return { DEFAULTS, MIN, HOUR, DAY, config, dayKey, dayStartAt, intervalMs, fmtInterval, newCard, graduate, review, relearned, extra, isReviewCard, isDue, dueList, forecast, wordStatus, BUCKETS }
})
