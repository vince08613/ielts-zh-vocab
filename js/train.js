/* Trainer UI: running a round (questions, feedback, spacing waits, summary).
   Dashboard and settings are in train-home.js. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const S = V.scheduler
  const Q = V.session
  const J = V.judge
  const db = V.db
  const T = V.trainer = {}
  const state = { get: k => db.get(k), put: r => db.put(r), cards: () => db.cards() }

  const KIND = { intro: '初学', meaning: '英译中', spell: '中译英', listen: '听写' }
  const PURPOSE = { intro: '', learn: '', retry: '再考', review: '到期复习', check1: '重学', check2: '重学检查', final: '本轮复测', recheck: '再考', extra: '加练', xcheck: '加练' }
  T.MODE = { daily: '今日训练', due: '到期复习', wrong: '只练错词' }

  let root = null
  let view = 'home'
  let session = null
  let summary = null
  let tick = 0
  let lastCompositionEnd = 0
  let shown = '' // session:task whose answer box is on screen
  let curveCache = null // personal forgetting curve, recomputed after each on-time review
  let checkpoint = null // the review checkpoint shown before a new group

  /** Measured recall per review point (scheduler.personalCurve) for the current settings. */
  T.curve = () => {
    if (!curveCache)
      curveCache = S.personalCurve(db.cards(), S.config(db.getKV('settings', {})))
    return curveCache
  }
  T.cfg = () => {
    const c = S.config(db.getKV('settings', {}))
    if (c.adaptive)
      c.levelFactor = T.curve().map(r => r.factor)
    return c
  }
  T.setCfg = (patch) => {
    curveCache = null
    db.setKV('settings', Object.assign({}, db.getKV('settings', {}), patch))
  }
  T.now = () => Date.now()
  T.today = () => S.dayKey(Date.now(), T.cfg().dayStart)
  T.state = state
  T.session = () => session
  T.wordStatus = uid => S.wordStatus(db.get(`W:${uid}`), db.get(`${uid}|meaning`), db.get(`${uid}|spell`))
  const word = uid => V.byUid[uid]
  const save = () => db.setKV('session', session && !session.done ? session : undefined)
  const coarse = () => window.matchMedia('(pointer: coarse)').matches
  const autoSpeak = () => V.store.settings.autoSpeak

  /* ---------- daily statistics and the answer log ---------- */

  const blankDay = () => ({ intro: 0, grad: 0, groups: 0, ans: 0, ms: 0, right: 0, hinted: 0, wrong: 0, manual: 0, first: { meaning: [0, 0], spell: [0, 0], listen: [0, 0] }, err: { meaning: 0, spell: 0, listen: 0 }, seen: [] })
  T.blankDay = blankDay

  function record(log) {
    if (log.purpose === 'review')
      curveCache = null
    const day = S.dayKey(log.t, T.cfg().dayStart)
    const days = Object.assign({}, db.getKV('days', {}))
    const d = days[day] = Object.assign(blankDay(), JSON.parse(JSON.stringify(days[day] || {})))
    d.seen = d.seen || []
    if (log.purpose === 'intro') {
      d.intro++
    }
    else {
      const clean = log.res === 'right' && !log.hinted
      d.ans++
      d.ms = (d.ms || 0) + Math.min(60000, log.ms || 0) // for time estimates
      if (clean)
        d.right++
      else if (log.res === 'right')
        d.hinted++
      else {
        d.wrong++
        d.err[log.skill]++
      }
      if (log.kind === 'manual')
        d.manual++
      // 无提示首次答题: the first attempt at each word ability on this day.
      const key = `${log.uid}|${log.skill}`
      if (!d.seen.includes(key)) {
        d.seen.push(key)
        d.first[log.skill][0]++
        if (clean)
          d.first[log.skill][1]++
      }
    }
    if (log.grad)
      d.grad++
    for (const k of Object.keys(days)) {
      if (k !== day && days[k].seen) {
        days[k] = Object.assign({}, days[k])
        delete days[k].seen
      }
    }
    db.setKV('days', days)
    db.log(log)
  }

  const accepted = uid => db.getKV('accepted', {})[uid] || []
  function accept(uid, answer) {
    const all = Object.assign({}, db.getKV('accepted', {}))
    const list = (all[uid] || []).slice()
    if (!list.includes(answer))
      list.push(answer)
    all[uid] = list
    db.setKV('accepted', all)
  }

  /** Self-test answers count as early practice for words already in training. */
  T.extraFromTest = (w, dir, result) => {
    const skill = dir === 'e2z' ? 'meaning' : 'spell'
    const c = db.get(`${w.uid}|${skill}`)
    if (!S.isReviewCard(c))
      return
    const t = Date.now()
    const ok = result === 'right'
    db.put(S.extra(c, ok, t, T.cfg()))
    db.log({ t, sid: 'selftest', mode: 'selftest', uid: w.uid, skill, purpose: 'extra', res: ok ? 'right' : 'wrong', kind: 'selftest' })
  }

  /* ---------- judging ---------- */

  let spellIndex = null
  function otherWordWithSameMeaning(target, answer) {
    if (!spellIndex) {
      spellIndex = new Map()
      for (const w of V.words) {
        for (const v of w.words) {
          const n = J.normalizeEn(v)
          spellIndex.set(n, (spellIndex.get(n) || []).concat(w))
        }
      }
    }
    const hits = spellIndex.get(J.normalizeEn(answer)) || []
    return hits.find(o => o.uid !== target.uid && V.core.meaningsOverlap(o, target))
  }

  let senseOwners = null
  /** True when another word shares one of this word's senses, so 中译英 needs context. */
  function ambiguous(w) {
    // Counted by headword: the wordbooks repeat some 真经 words, which are not a different word.
    if (!senseOwners) {
      senseOwners = new Map()
      for (const x of V.words) {
        const head = x.words[0].toLowerCase()
        for (const s of new Set(J.senses(x.meaning, x.pos))) {
          if (!senseOwners.has(s))
            senseOwners.set(s, new Set())
          senseOwners.get(s).add(head)
        }
      }
    }
    return J.senses(w.meaning, w.pos).some(s => senseOwners.get(s).size > 1)
  }

  function judgeTask(t, answer) {
    const w = word(t.uid)
    if (t.skill === 'meaning') {
      const r = J.judgeMeaning(answer, w.meaning, w.pos, accepted(t.uid))
      return { verdict: r.verdict, empty: !!r.empty }
    }
    const r = J.judgeSpelling(answer, w.words)
    return { verdict: r.verdict === 'right' ? 'right' : 'wrong', typo: r.verdict === 'typo', empty: !!r.empty, target: r.target, ops: r.diff && r.diff.ops, count: r.diff && r.diff.count }
  }

  function outcomeOf(p) {
    const result = p.choice || (p.verdict === 'right' ? 'right' : 'wrong')
    return { result, hinted: !!p.hinted, hard: !!p.hard && result === 'right', kind: p.unknown ? 'unknown' : p.choice ? 'manual' : 'answer', answer: p.answer, ms: p.ms, slow: p.slow }
  }

  /* ---------- flow ---------- */

  function clearTimers() {
    clearInterval(tick)
    tick = 0
  }

  function advance() {
    clearTimers()
    if (!session)
      return T.render()
    const r = Q.next(session, state, T.cfg(), T.now())
    save()
    if (r.task) {
      view = 'run'
      renderRun()
    }
    else if (r.wait) {
      view = 'run'
      renderWait(r.wait)
    }
    else {
      finishRound()
    }
  }

  /** Start a round. mode: daily | due | wrong. plan comes from train-home.js. */
  T.start = (mode, plan) => {
    const c = T.cfg()
    const t = T.now()
    checkpoint = null
    session = Q.create({ mode, now: t, cfg: c, queue: plan.queue || [], newCount: plan.newCount || 0, wrongKeys: plan.wrongKeys || [], state, audio: V.canPlayAudio(), seed: t, scope: plan.scope || '', cap: plan.cap || 0 })
    session.label = plan.label || ''
    session.checkpoint = !!plan.checkpoint
    const first = Q.next(session, state, c, t)
    if (first.done) {
      session = null
      save()
      V.toast(mode === 'wrong' ? '没有需要强化的错词' : mode === 'due' ? '现在没有到期的复习' : '今天的新词已学完')
      return T.render()
    }
    save()
    advance()
    window.scrollTo(0, 0)
  }

  T.load = () => {
    const saved = db.getKV('session', null)
    const ok = saved && saved.v === 3 && Array.isArray(saved.tasks) && Array.isArray(saved.pending) && Array.isArray(saved.active)
    session = ok && saved.tasks.every(x => word(x.uid)) && saved.pending.concat(saved.active).every(word) ? saved : null
  }

  T.resume = () => {
    if (!session)
      return
    // A round left over from an earlier day keeps its words in progress but not yesterday's new words.
    const today = T.today()
    if (session.day !== today) {
      const keep = uid => !!Q.learnOf(state, uid)
      session.round = session.round.filter(keep)
      session.pending = session.pending.filter(keep)
      session.active = session.active.filter(keep)
      session.tasks = session.tasks.filter(x => x.track !== 'learn' || keep(x.uid))
      if (session.current && !session.tasks.includes(session.current.task) && !session.tasks.some(x => x.id === session.current.task.id))
        session.current = null
      session.day = today
    }
    advance()
    window.scrollTo(0, 0)
  }

  T.end = () => {
    if (session && window.confirm('结束本轮？没有通过的词会保留为待完成，下次继续。'))
      finishRound()
  }

  function pause() {
    clearTimers()
    view = 'home'
    save()
    db.flush()
    T.render()
    window.scrollTo(0, 0)
  }

  function finishRound() {
    clearTimers()
    const s = session
    const touched = Object.keys(s.last)
    const groups = s.mode === 'daily' && s.stats.answered ? countGroup() : 0
    summary = {
      mode: s.mode,
      checkpoint: !!s.checkpoint,
      label: s.label || '',
      stats: s.stats,
      size: s.round.length,
      groups,
      unfinished: touched.filter(uid => (db.get(`W:${uid}`) || {}).state === 'learning'),
      relearning: db.cards().filter(c => c.phase === 'relearn' && touched.includes(c.uid)).length,
    }
    session = null
    save()
    db.flush()
    view = 'summary'
    renderSummary()
    window.scrollTo(0, 0)
  }

  /** One more daily group finished today; returns today's count. */
  function countGroup() {
    const day = T.today()
    const days = Object.assign({}, db.getKV('days', {}))
    days[day] = Object.assign(blankDay(), days[day] || {})
    days[day].groups = (days[day].groups || 0) + 1
    db.setKV('days', days)
    return days[day].groups
  }

  function submit(unknown) {
    const cur = session && session.current
    if (!cur || cur.pending || cur.task.purpose === 'intro')
      return
    const t = cur.task
    const input = root.querySelector('#t-answer')
    const value = unknown ? '' : input.value.trim()
    if (!unknown && !value) {
      focusInput()
      return
    }
    const w = word(t.uid)
    if (!unknown && t.skill !== 'meaning' && J.judgeSpelling(value, w.words).verdict !== 'right') {
      const other = otherWordWithSameMeaning(w, value)
      if (other) {
        cur.msg = `${other.words[0]} 也有这个意思，这里考的是另一个词`
        renderRun(value)
        return
      }
    }
    const c = T.cfg()
    const ms = T.now() - cur.startedAt
    cur.msg = ''
    session.flash = null
    cur.pending = Object.assign(unknown ? { verdict: 'wrong' } : judgeTask(t, value), {
      answer: value, unknown: !!unknown, hinted: !!cur.hinted, ms, slow: !!c.timed && ms > c.timeLimit * 1000, choice: null, hard: false,
    })
    if (c.autoNext && !unknown && cur.pending.verdict === 'right')
      return autoCommit(cur, w)
    save()
    renderRun()
    if (t.skill !== 'meaning' && autoSpeak())
      V.speak(w)
  }

  /** Judged right: record it and go straight to the next question; the result stays in a strip on top. */
  function autoCommit(cur, w) {
    const t = cur.task
    const p = cur.pending
    const now = T.now()
    // A clean review can still be marked 困难 afterwards: keep the card as it was.
    const canHard = t.track === 'card' && t.purpose === 'review' && !p.hinted
    const before = canHard ? JSON.parse(JSON.stringify(db.get(t.k))) : null
    const r = Q.commit(session, state, T.cfg(), now, outcomeOf(p))
    if (r)
      record(r.log)
    // For a new word: its counts after this answer, to show the dot that was just filled.
    const learn = t.track === 'learn' ? Q.counts(Q.learnOf(state, t.uid)) : null
    session.flash = {
      uid: t.uid, skill: t.skill, hinted: !!p.hinted, note: r ? r.note : '', k: t.k || '', at: now, before, canHard, hard: false,
      cnt: learn, added: learn && !p.hinted ? (t.skill === 'meaning' ? 'meaning' : 'spell') : '', grad: !!(r && r.graduated),
    }
    save()
    // The next question's own audio (听写, auto-speak) replaces this one.
    if (t.skill !== 'meaning' && autoSpeak())
      V.speak(w)
    advance()
  }

  function flashHard() {
    const f = session && session.flash
    if (!f || !f.canHard || f.hard)
      return
    const now = db.get(f.k)
    if (!now || now.last !== f.at)
      return
    const h = S.review(f.before, 'hard', f.at, T.cfg(), true)
    db.put(h)
    curveCache = null
    db.log({ t: T.now(), sid: session.id, mode: session.mode, uid: f.uid, skill: f.skill, purpose: 'review', res: 'right', hard: true, kind: 'hard-after' })
    f.hard = true
    f.note = `困难，保持当前级别 · 下次 ${S.fmtInterval(h.due - h.last)}后`
    save()
    if (session.current)
      renderRun()
    else
      advance()
  }

  function commitAndNext() {
    const cur = session && session.current
    if (!cur)
      return advance()
    const intro = cur.task.purpose === 'intro'
    if (!intro && (!cur.pending || (cur.pending.verdict === 'unsure' && !cur.pending.choice)))
      return
    session.flash = null
    const out = intro ? { result: 'seen' } : outcomeOf(cur.pending)
    if (!intro && out.kind === 'manual' && out.result === 'right' && cur.task.skill === 'meaning' && cur.pending.answer)
      accept(cur.task.uid, cur.pending.answer)
    const r = Q.commit(session, state, T.cfg(), T.now(), out)
    if (r)
      record(r.log)
    save()
    advance()
  }

  function judgeOverride(choice) {
    const p = session.current && session.current.pending
    if (!p)
      return
    const auto = p.verdict === 'right' ? 'right' : p.verdict === 'wrong' ? 'wrong' : null
    p.choice = choice === auto ? null : choice
    if (p.verdict === 'unsure') {
      p.choice = choice
      save()
      return commitAndNext()
    }
    save()
    renderRun()
  }

  function play() {
    const cur = session && session.current
    if (!cur)
      return
    const t = cur.task
    // Before answering, 中译英 must not hear the word.
    if (t.skill === 'spell' && !cur.pending)
      return
    V.speak(word(t.uid)).then((src) => {
      if (src === 'none' && t.skill === 'listen' && session && session.current === cur && !cur.pending) {
        cur.noAudio = true
        renderRun(root.querySelector('#t-answer') && root.querySelector('#t-answer').value)
      }
    })
  }

  function focusInput() {
    const input = root.querySelector('#t-answer')
    if (!input)
      return
    try {
      input.focus({ preventScroll: true })
    }
    catch (e) {
      input.focus()
    }
  }

  /* ---------- rendering ---------- */

  function highlight(sentence, variants, blank) {
    return V.core.markWord(sentence, variants).map(seg => (!seg.hit ? esc(seg.text) : blank ? '<span class="blank" aria-label="空格"></span>' : `<mark>${esc(seg.text)}</mark>`)).join('')
  }

  function headHtml(t) {
    const st = session.stats
    const c = T.cfg()
    const done = st.answered + st.intro
    const left = Q.remaining(session, c, state)
    const size = session.round.length
    const kind = t ? `<span class="tag k-${t.skill || 'intro'}">${KIND[t.skill || 'intro']}</span>${PURPOSE[t.purpose] ? `<span class="quiz-type">${PURPOSE[t.purpose]}</span>` : ''}` : ''
    return `<div class="quiz-head">
      <button type="button" class="icon-btn" data-act="t-pause" title="暂停" aria-label="暂停">${icon('pause')}</button>
      <div class="quiz-title">${kind}<span class="quiz-scope">${T.MODE[session.mode]}${session.label ? ` · ${esc(session.label)}` : ''}</span></div>
      <div class="quiz-tally">${size ? `<span class="t-done" title="本组完成的词">${icon('check-check')}${st.graduated.length}/${size}</span>` : ''}
        <span class="t-right" title="无提示正确">${icon('check')}${st.right}</span>
        <span class="t-wrong" title="错误">${icon('x')}${st.wrong}</span><span class="t-pos" title="剩余题数（估计）">剩 ${left}</span></div>
    </div>
    <div class="bar"><span style="width:${(done / Math.max(1, done + left)) * 100}%"></span></div>`
  }

  /** Dots for one word: unaided correct answers so far against the targets. */
  function progHtml(t) {
    if (t.track !== 'learn' || t.purpose === 'intro')
      return ''
    const c = T.cfg()
    const n = Q.counts(Q.learnOf(state, t.uid))
    const dots = (k, max) => Array.from({ length: max }, (_, i) => `<i${i < k ? ' class="on"' : ''}></i>`).join('')
    return `<div class="w-prog" title="这个词无提示答对的次数，中文和英文都满了就完成">
      <span class="w-prog-t">这个词</span><span class="w-prog-g${n.meaning >= c.meaningTarget ? ' full' : ''}"><span>中文</span><span class="dots">${dots(n.meaning, c.meaningTarget)}</span></span>
      <span class="w-prog-g${n.spell >= c.spellTarget ? ' full' : ''}"><span>英文</span><span class="dots">${dots(n.spell, c.spellTarget)}</span></span></div>`
  }

  function speakBtn() {
    return `<button type="button" class="icon-btn" data-act="t-play" title="发音 (Tab)" aria-label="发音">${icon('volume-2')}</button>`
  }

  /** Result of the previous answer when it went straight on. Space is always reserved, so nothing jumps. */
  function flashHtml(t) {
    const f = session.flash
    if (!f)
      return '<div class="t-flash off" aria-hidden="true"></div>'
    const w = word(f.uid)
    // Asking the same word again (end of a group): show only the result, not the word.
    const what = t && t.uid === f.uid
      ? ''
      : `<b lang="en">${esc(w.words[0])}</b><span class="t-flash-zh">${esc(J.stripPhonetics(w.meaning).trim())}</span>`
    const hard = f.canHard
      ? `<button type="button" class="btn${f.hard ? ' is-on' : ''}" data-act="t-flash-hard" aria-pressed="${f.hard}" title="答对但费力：保持当前级别">${icon('flame')}<span>困难</span></button>`
      : ''
    // New words: the answered word's dots, with the one just earned marked.
    let tail = `<span class="t-flash-note">${esc(f.note)}</span>`
    let plus = ''
    if (f.cnt) {
      const c = T.cfg()
      const dots = (g, max) => Array.from({ length: max }, (_, i) => `<i class="${i < f.cnt[g] ? 'on' : ''}${f.added === g && i === f.cnt[g] - 1 ? ' new' : ''}"></i>`).join('')
      plus = f.added ? `<span class="t-flash-plus">${f.added === 'meaning' ? '中文' : '英文'} +1</span>` : '<span class="t-flash-plus">不计数</span>'
      tail = f.grad
        ? `<span class="t-flash-done">${icon('check-check')}<span>这个词完成 · ${esc(S.fmtInterval(S.intervalMs(null, 0, c)))}后复习</span></span>`
        : `<span class="t-flash-prog" aria-label="中文 ${f.cnt.meaning}/${c.meaningTarget}，英文 ${f.cnt.spell}/${c.spellTarget}"><span>中文</span><span class="dots">${dots('meaning', c.meaningTarget)}</span><span>英文</span><span class="dots">${dots('spell', c.spellTarget)}</span></span>`
    }
    return `<div class="t-flash${f.hinted ? ' hinted' : ''}${f.cnt ? ' learn' : ''}" aria-live="polite" title="${esc(f.note)}">${icon('circle-check')}<span class="t-flash-label">${f.hinted ? '对（用了提示）' : '正确'}</span>
      ${plus}${what}${tail}${hard}</div>`
  }

  /** Replace the run view. A focused answer box is kept, not re-created, so the iPad keyboard stays up. */
  function mount(html) {
    const old = root.querySelector('#t-answer')
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    const fresh = tpl.content.querySelector('#t-answer')
    if (!old || !fresh || document.activeElement !== old) {
      root.innerHTML = html
      return
    }
    graft(root, tpl.content, old, fresh)
  }

  function syncAttrs(el, src) {
    for (const a of [...el.attributes]) {
      if (!src.hasAttribute(a.name))
        el.removeAttribute(a.name)
    }
    for (const a of src.attributes) {
      if (el.getAttribute(a.name) !== a.value)
        el.setAttribute(a.name, a.value)
    }
  }

  /** Make oldParent match freshParent while `keep` and its ancestors stay in the document. */
  function graft(oldParent, freshParent, keep, freshKeep) {
    const oldChild = [...oldParent.childNodes].find(n => n.contains(keep))
    const freshChild = [...freshParent.childNodes].find(n => n.contains(freshKeep))
    for (const n of [...oldParent.childNodes]) {
      if (n !== oldChild)
        n.remove()
    }
    let before = true
    for (const n of [...freshParent.childNodes]) {
      if (n === freshChild)
        before = false
      else if (before)
        oldParent.insertBefore(n, oldChild)
      else
        oldParent.appendChild(n)
    }
    syncAttrs(oldChild, freshChild)
    if (oldChild !== keep)
      graft(oldChild, freshChild, keep, freshKeep)
  }

  function hintHtml(t, w) {
    if (t.skill === 'meaning') {
      if (w.example)
        return `<p class="hint" lang="en">${highlight(w.example, w.words)}</p>`
      const first = J.displaySenses(w.meaning)[0] || ''
      return `<p class="hint"><span class="hint-letters">首字「${esc(first.replace(/[（(].*?[）)]/g, '')[0] || '')}」</span></p>`
    }
    if (t.skill === 'spell') {
      const first = w.words[0]
      return `<p class="hint"><span class="hint-letters">首字母 <b lang="en">${esc(first[0])}</b> · ${first.replace(/[^A-Za-zÀ-ÿ]/g, '').length} 个字母</span>${w.example ? `<span class="hint-sentence" lang="en">${highlight(w.example, w.words, true)}</span>` : ''}</p>`
    }
    return `<p class="hint">${esc(V.core.maskMeaning(w.meaning, w.words))} <span class="pos">${esc(w.pos)}</span></p>`
  }

  function promptHtml(t, w, cur) {
    const pos = w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''
    const answered = !!cur.pending
    const hintBtn = answered ? '' : `<button type="button" class="icon-btn" data-act="t-hint" title="提示（不计为独立答对）" aria-label="提示" aria-pressed="${!!cur.hinted}">${icon('lightbulb')}</button>`
    const hint = cur.hinted && !answered ? hintHtml(t, w) : ''
    if (t.purpose === 'intro') {
      return `<div class="prompt-main en" lang="en">${esc(V.wordText(w))}</div>
        <div class="prompt-sub">${pos}${speakBtn()}</div>
        <div class="intro-meaning">${esc(w.meaning)}</div>
        ${w.example ? `<p class="ans-example" lang="en">${highlight(w.example, w.words)}</p>` : ''}
        ${w.extra ? `<p class="ans-extra">${esc(w.extra)}</p>` : ''}`
    }
    if (t.skill === 'meaning') {
      return `<div class="prompt-main en" lang="en">${esc(V.wordText(w))}</div><div class="prompt-sub">${pos}${speakBtn()}${hintBtn}</div>${hint}`
    }
    if (t.skill === 'spell') {
      const context = !answered && !cur.hinted && w.example && ambiguous(w) ? `<p class="context" lang="en">${highlight(w.example, w.words, true)}</p>` : ''
      return `<div class="prompt-main zh">${esc(V.core.maskMeaning(w.meaning, w.words))}</div><div class="prompt-sub">${pos}${hintBtn}</div>${context}${hint}`
    }
    const noAudio = cur.noAudio
      ? `<div class="t-noaudio">${icon('triangle-alert')}<span>音频不可用</span><button type="button" class="btn" data-act="t-skip-audio">${icon('skip-forward')}<span>跳过听写</span></button></div>`
      : ''
    return `<div class="t-listen"><button type="button" class="t-play" data-act="t-play" title="重播 (Tab)" aria-label="播放">${icon('headphones')}</button></div>
      <div class="prompt-sub">${hintBtn}</div>${noAudio}${hint}`
  }

  function areaHtml(t, cur) {
    if (t.purpose === 'intro')
      return `<div class="card-actions"><button type="button" class="btn primary lg" data-act="t-next"><span>下一个</span>${icon('arrow-right')}</button></div>`
    const zh = t.skill === 'meaning'
    const w = word(t.uid)
    const multi = zh && J.displaySenses(w.meaning).length > 1
    const attrs = zh ? `lang="zh-CN" placeholder="${multi ? '写出一个中文意思' : '中文意思'}"` : 'lang="en" placeholder="英文单词"'
    return `<div class="write">
      <input id="t-answer" class="answer-input" type="text" ${attrs} autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-label="答案"${cur.pending ? ' readonly' : ''}>
      <div class="write-actions"${cur.pending ? ' hidden' : ''}>
        <button type="button" class="btn ghost" data-act="t-unknown">${icon('eye')}<span>不认识</span></button>
        <button type="button" class="btn primary" data-act="t-submit">${icon('check')}<span>提交</span></button>
      </div>
    </div>${cur.msg ? `<p class="t-msg">${icon('circle-dashed')}<span>${esc(cur.msg)}</span></p>` : ''}`
  }

  function diffHtml(p) {
    const yours = []
    const right = []
    for (const o of p.ops) {
      if (o.op === 'same') {
        yours.push(esc(o.ch))
        right.push(esc(o.ch))
      }
      else if (o.op === 'sub') {
        yours.push(`<span class="d-bad">${esc(o.got)}</span>`)
        right.push(`<span class="d-fix">${esc(o.ch)}</span>`)
      }
      else if (o.op === 'miss') {
        yours.push('<span class="d-gap">_</span>')
        right.push(`<span class="d-fix">${esc(o.ch)}</span>`)
      }
      else {
        yours.push(`<span class="d-extra">${esc(o.got)}</span>`)
      }
    }
    return `<div class="diff" lang="en"><div><small>你的拼写</small><span class="d-word">${yours.join('')}</span></div>
      <div><small>正确拼写</small><span class="d-word">${right.join('')}</span></div></div>`
  }

  function feedbackHtml(t, w, cur) {
    const p = cur.pending
    const c = T.cfg()
    const unsure = p.verdict === 'unsure' && !p.choice
    const result = p.choice || (p.verdict === 'right' ? 'right' : p.verdict === 'wrong' ? 'wrong' : 'unsure')
    let label
    let reason = ''
    if (unsure) {
      label = '待确认'
      reason = '无法可靠判断，请对照参考答案选择'
    }
    else if (result === 'right') {
      label = p.hinted ? '答对了（用了提示）' : '正确'
    }
    else {
      label = p.unknown ? '不认识' : p.empty ? '未作答' : p.typo ? '拼写有误' : '错误'
      if (!p.unknown && p.count)
        reason = J.describeDiff(p.count)
      else if (!p.unknown && t.skill === 'meaning')
        reason = '意思不对'
    }
    if (p.choice)
      reason = '已人工修正判定'
    const cls = unsure ? 'close' : result
    const mine = p.answer
      ? (t.skill !== 'meaning' && p.ops && result !== 'right' ? diffHtml(p) : `<span class="your">你的答案 <b${t.skill === 'meaning' ? '' : ' lang="en"'}>${esc(p.answer)}</b></span>`)
      : ''
    const note = unsure ? '' : Q.preview(session, state, c, T.now(), outcomeOf(p))
    const actions = []
    if (unsure) {
      actions.push(`<button type="button" class="btn" data-act="t-judge" data-r="wrong">${icon('x')}<span>我答错了</span></button>`)
      actions.push(`<button type="button" class="btn primary" data-act="t-judge" data-r="right">${icon('check')}<span>我答对了</span></button>`)
    }
    else {
      if (!p.unknown && !p.empty) {
        actions.push(result === 'right'
          ? `<button type="button" class="btn ghost" data-act="t-judge" data-r="wrong">${icon('x')}<span>判为错误</span></button>`
          : `<button type="button" class="btn ghost" data-act="t-judge" data-r="right">${icon('check')}<span>算我对</span></button>`)
      }
      if (t.purpose === 'review' && result === 'right' && !p.hinted)
        actions.push(`<button type="button" class="btn${p.hard ? ' is-on' : ''}" data-act="t-hard" aria-pressed="${!!p.hard}">${icon('flame')}<span>困难</span></button>`)
      actions.push(`<button type="button" class="btn primary" data-act="t-next"><span>下一题</span>${icon('arrow-right')}</button>`)
    }
    const secs = (p.ms / 1000).toFixed(1)
    return `<div class="verdict v-${cls}">${icon(cls === 'right' ? 'circle-check' : cls === 'wrong' ? 'circle-x' : 'circle-dashed')}<strong>${label}</strong>
        ${reason ? `<span class="reason">${esc(reason)}</span>` : ''}</div>
      ${mine ? `<div class="mine">${mine}</div>` : ''}
      <div class="answer-card">
        <div class="ans-head"><span class="ans-word" lang="en">${esc(V.wordText(w))}</span>${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''}${speakBtn()}</div>
        <div class="ans-meaning">${esc(J.stripPhonetics(w.meaning).trim())}</div>
        ${w.example ? `<p class="ans-example" lang="en">${highlight(w.example, w.words)}</p>` : ''}
      </div>
      <div class="t-meta">${note ? `<span class="t-note">${icon('calendar-clock')}<span>${esc(note)}</span></span>` : ''}
        <span class="t-time${p.slow ? ' slow' : ''}">${icon('timer')}<span>${secs} 秒${p.slow ? ' · 超出限时' : ''}</span></span></div>
      <div class="fb-actions">${actions.join('')}</div>`
  }

  function renderRun(keepValue) {
    clearTimers()
    const cur = session.current
    const t = cur.task
    const w = word(t.uid)
    const c = T.cfg()
    // Typed text survives a re-render of the same question only; a new question starts empty.
    const key = `${session.id}:${t.id}`
    const box = root.querySelector('#t-answer')
    const value = keepValue !== undefined ? keepValue : cur.pending ? cur.pending.answer : box && shown === key ? box.value : ''
    const timer = c.timed && t.purpose !== 'intro' && !cur.pending
      ? `<div class="t-timer"><span style="animation-duration:${c.timeLimit}s;animation-delay:-${Math.min(c.timeLimit, (T.now() - cur.startedAt) / 1000)}s"></span></div>`
      : ''
    mount(`<div class="quiz t-run" data-skill="${t.skill || 'intro'}">${headHtml(t)}${timer}${flashHtml(t)}
      <div class="prompt">${progHtml(t)}${promptHtml(t, w, cur)}</div>
      <div class="answer-area">${areaHtml(t, cur)}</div>
      <div class="feedback" aria-live="polite">${cur.pending ? feedbackHtml(t, w, cur) : ''}</div></div>`)
    shown = key
    const input = root.querySelector('#t-answer')
    if (input) {
      input.value = value
      if (cur.pending)
        input.classList.add(`is-${cur.pending.choice || (cur.pending.verdict === 'unsure' ? 'close' : cur.pending.verdict)}`)
      if (!cur.pending || !coarse())
        focusInput()
      else
        input.blur() // iPad: hide the keyboard so the correct answer is visible
    }
    if (cur.pending) {
      const btn = root.querySelector('.fb-actions .primary')
      const r = btn && btn.getBoundingClientRect()
      const bottom = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 12
      if (r && r.bottom > bottom)
        window.scrollBy({ top: r.bottom - bottom, behavior: 'smooth' })
    }
    else if (!cur.played && (t.skill === 'listen' || ((t.purpose === 'intro' || t.skill === 'meaning') && autoSpeak()))) {
      cur.played = true
      play()
    }
  }

  function renderWait(ms) {
    const until = T.now() + ms
    // Few words left in the group: they can move to the next group, where other words space them out.
    const carry = session.mode === 'daily' && session.tasks.some(x => x.track === 'learn' && x.purpose !== 'intro')
    root.innerHTML = `<div class="quiz t-run">${headHtml(null)}${flashHtml(null)}
      <div class="t-wait">${icon('timer')}<strong>下一题 <span id="t-count"></span> 后出现</strong><span class="muted">同一个词需要和上次间隔开</span>
        <div class="row-actions">${carry ? `<button type="button" class="btn primary" data-act="t-carry">${icon('skip-forward')}<span>留到下一组</span></button>` : ''}
        <button type="button" class="btn" data-act="t-pause">${icon('pause')}<span>暂停</span></button>
        <button type="button" class="btn ghost" data-act="t-end">${icon('x')}<span>结束本轮</span></button></div></div></div>`
    const count = root.querySelector('#t-count')
    const update = () => {
      const left = Math.max(0, Math.ceil((until - T.now()) / 1000))
      count.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
      if (left <= 0)
        advance()
    }
    update()
    tick = setInterval(update, 1000)
  }

  function renderSummary() {
    const { stats: st, mode, unfinished, relearning, groups, checkpoint: cp } = summary
    const chips = list => list.map(uid => `<span class="chip" lang="en">${esc(word(uid).words[0])}</span>`).join('')
    const fc = S.forecast(db.cards(), T.now(), T.cfg().dayStart).filter(b => b.count).slice(0, 3)
    // What is left today: more new words, and reviews that reached their review point meanwhile.
    const all = T.overview ? T.overview() : null
    const o = (mode === 'daily' || cp) && all ? all : null
    const more = o && (o.newPlanned + o.learning.length) > 0
    const due = all ? all.due.length : 0
    const reviewFirst = T.cfg().reviewFirst
    const today = o && !cp
      ? `<p class="t-groups">${icon('layers')}<span>${groups ? `今天第 ${groups} 组完成` : '本组结束'}${more ? ` · 还剩新词 ${o.newPlanned} 个${o.learning.length ? ` · 待完成 ${o.learning.length} 个` : ''}` : ' · 今天的新词学完了'}</span></p>`
      : ''
    let actions
    if (cp) {
      actions = (more ? `<button type="button" class="btn primary" data-act="t-new-group">${icon('play')}<span>继续学新词 · 第 ${(o.d.groups || 0) + 1} 组</span><small>${esc(T.groupNote(o))}</small></button>` : '')
        + (due ? `<button type="button" class="btn${more ? '' : ' primary'}" data-act="t-cp-more">${icon('calendar-clock')}<span>继续复习</span><small>${due}</small></button>` : '')
    }
    else {
      const nextNote = due && reviewFirst ? `先复习 ${due} 个到期词，再学新词` : more ? T.groupNote(o) : ''
      actions = (more ? `<button type="button" class="btn primary" data-act="t-next-group">${icon('play')}<span>下一组</span><small>${esc(nextNote)}</small></button>` : '')
        + (due && (!more || !reviewFirst) ? `<button type="button" class="btn${more ? '' : ' primary'}" data-act="t-cp-more">${icon('calendar-clock')}<span>到期复习</span><small>${due}</small></button>` : '')
    }
    actions += `<button type="button" class="btn${actions ? ' ghost' : ' primary'}" data-act="t-home">${icon('house')}<span>返回</span></button>`
    const title = cp ? '复习检查点' : T.MODE[mode]
    root.innerHTML = `<div class="summary">
      <div class="sum-head"><div class="sum-score">${st.answered ? Math.round((st.right / st.answered) * 100) : 0}<small>%</small></div>
        <div class="sum-info"><div class="sum-title"><span>${title}</span><span class="muted">无提示正确率</span></div>
          <div class="sum-tally"><span class="t-right">${icon('check')}正确 ${st.right}</span><span class="t-close">${icon('lightbulb')}用提示 ${st.hinted}</span>
            <span class="t-wrong">${icon('x')}错误 ${st.wrong}</span><span class="muted">复习 ${st.reviews} · 重学通过 ${st.relearned} · 加练 ${st.extra}</span></div></div></div>
      ${cp ? `<p class="t-groups">${icon('calendar-clock')}<span>复习了 ${st.reviews} 项${st.wrong ? `，${st.wrong} 次答错的已重学` : ''}${due ? ` · 还有 ${due} 项到了复习时间` : ' · 到期复习已清零'}</span></p>` : ''}
      ${st.graduated.length ? `<h3 class="section-title">本轮通过 ${st.graduated.length}</h3><div class="chips">${chips(st.graduated)}</div>` : ''}
      ${unfinished.length ? `<h3 class="section-title">待完成 ${unfinished.length}</h3><div class="chips">${chips(unfinished)}</div>` : ''}
      ${relearning ? `<p class="muted">${relearning} 个能力仍在重学，下次训练优先出现。</p>` : ''}
      ${fc.length ? `<p class="muted">接下来：${fc.map(b => `${b.label} ${b.count} 个`).join('，')}</p>` : ''}
      ${today}
      <div class="sum-actions">${actions}</div>
    </div>`
  }

  T.render = () => {
    if (!root)
      return
    if (view === 'run' && session && session.current)
      return renderRun()
    if (view === 'run' && session)
      return advance()
    if (view === 'summary' && summary)
      return renderSummary()
    if (view === 'cp' && checkpoint)
      return renderCheckpoint()
    view = 'home'
    T.renderHome(root)
  }

  /**
   * Review checkpoint before a new group: what has reached its review point, so the review
   * is not mistaken for the last group starting again. info comes from train-home.js.
   */
  T.showCheckpoint = (info) => {
    clearTimers()
    checkpoint = info
    summary = null
    view = 'cp'
    renderCheckpoint()
    window.scrollTo(0, 0)
  }

  function renderCheckpoint() {
    const k = checkpoint
    const list = k.parts.map(p => `<li><span>${esc(p.label)}</span><b>${p.count}</b></li>`).join('')
    root.innerHTML = `<div class="summary t-cp">
      <div class="t-cp-head">${icon('calendar-clock')}<div><h2>复习检查点</h2>
        <p>有 ${k.take} 项到了复习时间（${k.words} 个词）。先复习，再学${k.next ? `第 ${k.next} 组` : ''}新词。每项考一次：答对排到下一个复习点，答错马上重学。</p></div></div>
      <ul class="t-cp-list">${list}</ul>
      ${k.more ? `<p class="muted">另外 ${k.more} 项留到下一个检查点，先做最容易忘的。</p>` : ''}
      <div class="sum-actions">
        <button type="button" class="btn primary" data-act="t-cp-start">${icon('play')}<span>开始复习</span><small>约 ${k.take} 题 · ${k.minutes} 分钟</small></button>
        ${k.canSkip ? `<button type="button" class="btn ghost" data-act="t-cp-skip">${icon('skip-forward')}<span>先学新词</span></button>` : ''}
        <button type="button" class="btn ghost" data-act="t-home">${icon('house')}<span>返回</span></button></div>
    </div>`
  }

  /** App reopened or brought back: recompute what is due. */
  T.onResume = () => {
    if (!root || !V.isView('train'))
      return
    if (view === 'home')
      T.renderHome(root)
    else if (view === 'run' && session && !session.current)
      advance()
  }

  /* ---------- events ---------- */

  function onClick(e) {
    const btn = e.target.closest('[data-act]')
    if (!btn || btn.disabled)
      return
    const act = btn.dataset.act
    if (!act.startsWith('t-'))
      return T.onHomeAct && T.onHomeAct(act, btn)
    const cur = session && session.current
    switch (act) {
      case 't-submit': return submit(false)
      case 't-unknown': return submit(true)
      case 't-next': return commitAndNext()
      case 't-judge': return judgeOverride(btn.dataset.r)
      case 't-play': return play()
      case 't-pause': return pause()
      case 't-end': return T.end()
      case 't-carry': return session ? finishRound() : T.render()
      case 't-home':
        summary = null
        checkpoint = null
        view = 'home'
        return T.render()
      case 't-cp-start':
        return T.start('due', checkpoint.plan)
      case 't-cp-skip':
        checkpoint = null
        view = 'home'
        return T.startNew()
      case 't-new-group':
        summary = null
        view = 'home'
        return T.startNew()
      case 't-cp-more':
        summary = null
        view = 'home'
        return T.onHomeAct('h-cp')
      case 't-next-group':
        summary = null
        view = 'home'
        return T.startDaily ? T.startDaily() : T.render()
      case 't-due':
        summary = null
        view = 'home'
        return T.onHomeAct('h-due')
      case 't-flash-hard':
        return flashHard()
      case 't-hard':
        if (cur && cur.pending) {
          cur.pending.hard = !cur.pending.hard
          save()
          renderRun()
        }
        return
      case 't-hint':
        if (cur && !cur.pending && !cur.hinted) {
          cur.hinted = true
          save()
          renderRun()
        }
        return
      case 't-skip-audio':
        Q.disableAudio(session)
        save()
        return advance()
    }
  }

  function onKeydown(e) {
    if (view !== 'run' || !session || !session.current)
      return
    if (e.key === 'Tab' && e.target.id === 't-answer') {
      e.preventDefault()
      return play()
    }
    if (e.key !== 'Enter')
      return
    // Enter that confirms a Chinese IME candidate must not submit.
    if (e.isComposing || e.keyCode === 229 || Date.now() - lastCompositionEnd < 80)
      return
    if (e.target.closest && e.target.closest('button') && e.target.id !== 't-answer')
      return
    e.preventDefault()
    const cur = session.current
    if (cur.task.purpose === 'intro' || cur.pending)
      commitAndNext()
    else
      submit(false)
  }

  T.mount = (el) => {
    root = el
    root.addEventListener('click', onClick)
    root.addEventListener('compositionend', () => { lastCompositionEnd = Date.now() })
    document.addEventListener('keydown', (e) => {
      if (!V.isView('train') || V.modalOpen())
        return
      if (e.key === 'Escape' && view === 'run')
        return pause()
      if (e.target.matches && e.target.matches('input:not(#t-answer), select, textarea'))
        return
      onKeydown(e)
    })
    T.load()
  }
})()
