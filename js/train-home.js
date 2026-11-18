/* Trainer dashboard: today's plan, due and overdue counts, forecast, weak abilities,
   stubborn words and trainer settings. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const S = V.scheduler
  const T = V.trainer
  const db = V.db
  const DAY = S.DAY
  const SKILL = { meaning: '英译中', spell: '中译英', listen: '听写' }
  const ERR = { meaning: '意思', spell: '拼写', listen: '听写' }

  let root = null

  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0)
  const pct = (ok, n) => (n ? `${Math.round((ok / n) * 100)}%` : '—')

  function learningRecs() {
    const out = []
    for (const r of db.records()) {
      if (r.k.startsWith('W:') && r.state === 'learning' && V.byUid[r.uid])
        out.push(r)
    }
    return out.sort((a, b) => a.intro - b.intro)
  }

  function seededShuffle(list, seedText) {
    let seed = 0
    for (const ch of seedText)
      seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) >>> 0
    const a = list.slice()
    for (let i = a.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const j = seed % (i + 1)
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /** Words never introduced, in the chosen scope and order (random order is stable within a day). */
  function newPool(c) {
    const ch = chapterOf(c)
    const scope = ch === 'all' ? V.words : V.chapterWords[ch]
    const pool = scope.slice(startIndex(c, scope)).filter(w => isFresh(w.uid)).map(w => w.uid)
    return c.newOrder === 'random' ? seededShuffle(pool, T.today()) : pool
  }

  /** Never introduced and not marked as known. */
  function isFresh(uid) {
    const r = db.get(`W:${uid}`)
    return !r || r.state === 'new'
  }
  const isSkipped = uid => (db.get(`W:${uid}`) || {}).state === 'skipped'

  /** Position of the chosen start word in the scope; 0 when unset or not in the scope. */
  function startIndex(c, scope) {
    const i = c.newStart ? scope.findIndex(w => w.uid === c.newStart) : 0
    return i < 0 ? 0 : i
  }

  /** Selected chapter index, or 'all'. */
  function chapterOf(c) {
    const n = Number(c.newScope)
    return c.newScope === 'all' || c.newScope == null || c.newScope === '' || !V.chapterWords[n] ? 'all' : n
  }

  /** Reviews, wrong words and unfinished words limited to the chapter when 只限本章 is on. */
  function reviewFilter(c) {
    const ch = chapterOf(c)
    if (ch === 'all' || c.reviewScope !== 'chapter')
      return { prefix: '', has: () => true }
    const prefix = `${String(ch + 1).padStart(2, '0')}:`
    return { prefix, has: uid => String(uid).startsWith(prefix) }
  }

  function wrongSet(c, t, learning, has) {
    const cutoff = t - 14 * DAY
    const keys = db.cards()
      .filter(x => has(x.uid) && (x.skill !== 'listen' || c.scheduleListen) && (x.stubborn || x.phase === 'relearn' || x.hist.some(h => (h[1] === 'w' || h[1] === 'X') && h[0] >= cutoff)))
      .map(x => x.k)
    const words = learning.filter(w => sum(w.fails) > 0).map(w => w.uid)
    return { keys, words }
  }

  /** Per-chapter word status counts for the chapter picker. */
  function chapterStats() {
    return V.chapterWords.map((list) => {
      const st = { new: 0, skipped: 0, learning: 0, passed: 0, retained: 0 }
      for (const w of list)
        st[T.wordStatus(w.uid)]++
      return st
    })
  }

  function overview() {
    const c = T.cfg()
    const t = T.now()
    const day = T.today()
    const rf = reviewFilter(c)
    const cards = db.cards().filter(x => (x.skill !== 'listen' || c.scheduleListen) && rf.has(x.uid))
    const due = S.dueList(cards, t)
    const start = S.dayStartAt(t, c.dayStart)
    const overdue = due.filter(x => x.due < start)
    const oldest = overdue.length ? Math.ceil((start - Math.min(...overdue.map(x => x.due))) / DAY) : 0
    const learning = learningRecs().filter(w => rf.has(w.uid))
    const days = db.getKV('days', {})
    const d = Object.assign(T.blankDay(), days[day] || {})
    const pool = newPool(c)
    const newPlanned = Math.min(Math.max(0, c.newPerDay - d.intro), pool.length)
    const wrong = wrongSet(c, t, learning, rf.has)
    const scopeList = chapterOf(c) === 'all' ? V.words : V.chapterWords[chapterOf(c)]
    const from = startIndex(c, scopeList)
    const before = scopeList.slice(0, from).filter(w => isFresh(w.uid)).map(w => w.uid)
    const skipped = scopeList.filter(w => isSkipped(w.uid)).map(w => w.uid)

    const status = { new: 0, skipped: 0, learning: 0, passed: 0, retained: 0 }
    for (const w of V.words)
      status[T.wordStatus(w.uid)]++

    const since = S.dayKey(t - 6 * DAY, c.dayStart)
    const acc = { meaning: [0, 0], spell: [0, 0], listen: [0, 0] }
    for (const [k, v] of Object.entries(days)) {
      if (k < since || !v.first)
        continue
      for (const sk of Object.keys(acc)) {
        acc[sk][0] += v.first[sk][0]
        acc[sk][1] += v.first[sk][1]
      }
    }
    const firstAll = Object.values(acc).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0])
    const firstToday = Object.values(d.first).reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0])
    const rated = Object.entries(acc).filter(([, v]) => v[0] >= 5)
    const weakest = rated.length ? rated.sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0])[0][0] : ''

    const stub = new Map()
    for (const x of db.cards()) {
      if (x.stubborn) {
        const e = stub.get(x.uid) || { uid: x.uid, err: { meaning: 0, spell: 0, listen: 0 }, total: 0 }
        e.err[x.skill] += x.fails
        e.total += x.fails
        stub.set(x.uid, e)
      }
    }
    for (const w of learning) {
      if (sum(w.fails) >= c.stubbornFails && !stub.has(w.uid))
        stub.set(w.uid, { uid: w.uid, err: Object.assign({ meaning: 0, spell: 0, listen: 0 }, w.fails), total: sum(w.fails) })
    }
    const stubborn = [...stub.values()].sort((a, b) => b.total - a.total)

    // Question estimates: each word needs its remaining correct answers plus about 15% retries.
    const group = groupPlan(c, learning, pool, newPlanned)
    const wordQ = w => { const l = V.session.left(w, c); return (l.meaning + l.spell) * 1.15 }
    const freshQ = (c.meaningTarget + c.spellTarget) * 1.15 + 1
    const carryQ = list => list.reduce((n, w) => n + wordQ(w), 0)
    const estimate = Math.round(carryQ(group.carry) + group.fresh.length * freshQ)
    const dayTotal = Math.round(carryQ(learning) + newPlanned * freshQ + due.length)
    const groups = Math.ceil((learning.length + newPlanned) / c.groupSize)
    return { c, t, d, due, overdue, oldest, learning, pool, newPlanned, wrong, status, acc, firstAll, firstToday, weakest, stubborn, estimate, dayTotal, groups, group, relearn: due.filter(x => x.phase === 'relearn').length, forecast: S.forecast(cards, t, c.dayStart), chapter: chapterOf(c), prefix: rf.prefix, scopeList, from, before, skipped }
  }
  T.overview = overview

  /**
   * One daily group of groupSize words: new words from the chosen start come first, so a new
   * start word is what you see first. Unfinished words of earlier groups fill the rest
   * (at most half of the group while there are new words left).
   */
  function groupPlan(c, learning, pool, newPlanned) {
    const avail = Math.min(newPlanned, pool.length)
    const freshN = Math.min(avail, Math.max(c.groupSize - learning.length, Math.ceil(c.groupSize / 2)))
    const fresh = pool.slice(0, freshN)
    const carry = learning.slice(0, c.groupSize - freshN)
    return { carry, fresh }
  }

  const shortMeaning = w => (V.judge.displaySenses(w.meaning)[0] || '').replace(/[（(\[【][^）)\]】]*[）)\]】]/g, '').trim().slice(0, 10)
  const MARK = { new: '', skipped: '（已会）', learning: '（学习中）', passed: '（已学）', retained: '（已学）' }
  const STATE_NAME = { skipped: '标为已会', learning: '正在学（在待完成里）', passed: '已学过', retained: '已学过' }

  function startOptions(o) {
    const cur = o.c.newStart || ''
    if (o.chapter !== 'all') {
      return [`<option value=""${cur ? '' : ' selected'}>从本章第 1 个词开始</option>`]
        .concat(V.chapterWords[o.chapter].map((w, i) => `<option value="${esc(w.uid)}"${w.uid === cur ? ' selected' : ''}>${i + 1}. ${esc(w.words[0])} ${esc(shortMeaning(w))}${MARK[T.wordStatus(w.uid)]}</option>`))
        .join('')
    }
    const opts = [`<option value=""${cur ? '' : ' selected'}>从第 1 章开头开始</option>`]
    const firsts = V.chapterWords.map(list => list[0].uid)
    if (cur && !firsts.includes(cur) && V.byUid[cur]) {
      const w = V.byUid[cur]
      opts.push(`<option value="${esc(cur)}" selected>从 ${esc(w.words[0])}（${esc(V.chapterName(w.chapter))}）开始</option>`)
    }
    V.chapterWords.forEach((list, i) => {
      if (i)
        opts.push(`<option value="${esc(list[0].uid)}"${list[0].uid === cur ? ' selected' : ''}>从 ${esc(V.chapterName(i))} 开始</option>`)
    })
    return opts.join('')
  }

  function scopeHtml(o) {
    const c = o.c
    const ch = o.chapter
    const stats = chapterStats()
    const total = stats.reduce((n, st) => n + st.new, 0)
    const opts = [`<option value="all"${ch === 'all' ? ' selected' : ''}>全部章节 · 剩 ${total} 新词</option>`]
      .concat(V.data.chapters.map((x, i) => `<option value="${i}"${ch === i ? ' selected' : ''}>${esc(V.chapterName(i))} · ${stats[i].new ? `剩 ${stats[i].new} 新词` : '新词已学完'}</option>`))
    const st = ch === 'all' ? null : stats[ch]
    const note = st
      ? `<div class="field-note">本章 ${V.data.chapters[ch].count} 词：未学 ${st.new} · 刚学过 ${st.learning} · 本轮通过 ${st.passed} · 跨天通过 ${st.retained}${st.skipped ? ` · 已会 ${st.skipped}` : ''}</div>`
      : ''
    const review = ch === 'all'
      ? ''
      : V.seg('reviewScope', [{ value: 'all', label: '复习全部章节' }, { value: 'chapter', label: '复习只限本章' }], c.reviewScope === 'chapter' ? 'chapter' : 'all')
    // The banner shows where the next group really starts: the first word not learned yet.
    const nextW = o.pool.length ? V.byUid[o.pool[0]] : null
    const startW = nextW || o.scopeList[o.from]
    const posInChapter = V.chapterWords[startW.chapter].indexOf(startW) + 1
    const chosen = o.scopeList[o.from]
    const skippedNote = o.c.newStart && chosen && chosen !== startW
      ? `<span class="t-start-skip">起点 <span lang="en">${esc(chosen.words[0])}</span> ${STATE_NAME[T.wordStatus(chosen.uid)] || '已学过'}，从后面第一个没学的词开始</span>`
      : ''
    const startNote = `从这里往后 ${o.pool.length} 个新词`
    const startBtns = (o.before.length ? `<button type="button" class="btn" data-act="h-skip-before">${icon('check-check')}<span>前面 ${o.before.length} 个未学词标为已会</span></button>` : '')
      + (o.skipped.length ? `<button type="button" class="btn ghost" data-act="h-unskip">${icon('rotate-ccw')}<span>恢复已会的 ${o.skipped.length} 个词</span></button>` : '')
    return `<div class="t-scope">
      <div class="t-start-now">${icon('flag')}<span>${nextW ? (o.c.newOrder === 'random' ? '下一组从这里往后随机抽' : '下一组从这里开始') : '这里往后的新词已学完'}</span><b>${esc(V.chapterName(startW.chapter))} · 第 ${posInChapter} 个 · <span lang="en">${esc(startW.words[0])}</span></b><span class="muted">${esc(shortMeaning(startW))}</span>${skippedNote}</div>
      <div class="field"><span class="label">找单词</span><div class="field-stack">
        <label class="search t-find">${icon('search')}<input id="t-find" type="search" placeholder="输入英文或中文，点结果设为起点" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="search"></label>
        <div class="t-find-results" aria-live="polite"></div></div></div>
      <div class="field"><span class="label">训练章节</span><div class="field-stack">
        <div class="t-scope-row"><select data-cfg-select="newScope" aria-label="训练章节">${opts.join('')}</select>${review}</div>${note}</div></div>
      <div class="field"><span class="label">起点</span><div class="field-stack">
        <div class="t-scope-row"><select data-cfg-select="newStart" class="t-start" aria-label="从哪个词开始">${startOptions(o)}</select>${startBtns}</div>
        <div class="field-note">${startNote}</div></div></div>
    </div>`
  }

  /** Words matching a query in every chapter: exact or prefix English matches first, then meanings. */
  function findWords(q) {
    const s = q.trim().toLowerCase()
    if (!s)
      return []
    const zh = /[\u3400-\u9FFF]/.test(s)
    const scored = []
    for (const w of V.words) {
      let score = -1
      if (zh) {
        if (w.meaning.includes(s))
          score = V.judge.displaySenses(w.meaning).some(x => x.replace(/[（(\[【][^）)\]】]*[）)\]】]/g, '').trim() === s) ? 0 : 2
      }
      else {
        const v = w.words.map(x => x.toLowerCase())
        if (v.includes(s))
          score = 0
        else if (v.some(x => x.startsWith(s)))
          score = 1
        else if (s.length >= 3 && v.some(x => x.includes(s)))
          score = 2
      }
      if (score >= 0)
        scored.push([score, w])
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id).slice(0, 12).map(x => x[1])
  }

  function renderFind(box, q) {
    const hits = findWords(q)
    if (!q.trim()) {
      box.innerHTML = ''
      return
    }
    box.innerHTML = hits.length
      ? hits.map((w) => {
        const pos = V.chapterWords[w.chapter].indexOf(w) + 1
        const mark = MARK[T.wordStatus(w.uid)]
        return `<button type="button" class="t-hit" data-act="h-pick" data-uid="${esc(w.uid)}">
          <span class="t-hit-where">${esc(V.chapterName(w.chapter))} · 第 ${pos} 个</span>
          <span class="t-hit-word" lang="en">${esc(V.wordText(w))}</span><span class="t-hit-zh">${esc(shortMeaning(w))}${mark}</span></button>`
      }).join('')
      : '<p class="muted">没有找到这个词</p>'
  }

  function kpi(label, value, sub, cls) {
    return `<div class="kpi${cls ? ` ${cls}` : ''}"><div class="kpi-label">${label}</div><div class="kpi-num">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`
  }

  function rows(list, max) {
    return list.map(r => `<div class="t-row"><span>${r.label}</span><span class="t-rbar"><span style="width:${max ? (r.count / max) * 100 : 0}%"${r.cls ? ` class="${r.cls}"` : ''}></span></span><b>${r.value != null ? r.value : r.count}</b></div>`).join('')
  }

  function stepper(name, value, min, max, step) {
    return `<div class="stepper" data-name="${name}" data-min="${min}" data-max="${max}" data-step="${step}">
      <button type="button" class="icon-btn" data-act="h-step" data-d="-1" title="减少" aria-label="减少"${value <= min ? ' disabled' : ''}>${icon('minus')}</button>
      <output>${value}</output>
      <button type="button" class="icon-btn" data-act="h-step" data-d="1" title="增加" aria-label="增加"${value >= max ? ' disabled' : ''}>${icon('plus')}</button></div>`
  }

  function toggle(key, on, label) {
    return `<label class="switch-row"><span>${label}</span><input type="checkbox" class="switch" data-cfg="${key}"${on ? ' checked' : ''}></label>`
  }

  function settingsHtml(c) {
    const hours = [0, 1, 2, 3, 4, 5, 6].map(h => `<option value="${h}"${c.dayStart === h ? ' selected' : ''}>${h}:00</option>`).join('')
    const times = [2, 3, 4, 5, 6].map(n => ({ value: n, label: `${n} 次` }))
    return `<section class="panel t-settings"><h3>训练设置</h3>
      <div class="field"><span class="label">中文答对</span>${V.seg('meaningTarget', times, c.meaningTarget)}</div>
      <div class="field"><span class="label">英文答对</span>${V.seg('spellTarget', times, c.spellTarget)}</div>
      <div class="field"><span class="label">答错后</span>${V.seg('wrongPenalty', [{ value: 'none', label: '不计数' }, { value: 'one', label: '扣 1 次' }, { value: 'reset', label: '清零' }], c.wrongPenalty)}</div>
      ${toggle('dictation', c.dictation, '英文题包含听写')}
      ${toggle('autoNext', c.autoNext, '答对后直接下一题')}
      ${toggle('scheduleListen', c.scheduleListen, '听写也按间隔长期复习')}
      ${toggle('timed', c.timed, '限时挑战（只记录，不判错）')}
      <div class="field"><span class="label">限时</span>${V.seg('timeLimit', [10, 20, 30].map(n => ({ value: n, label: `${n} 秒` })), c.timeLimit)}</div>
      <div class="field"><span class="label">新词顺序</span>${V.seg('newOrder', [{ value: 'book', label: '原书顺序' }, { value: 'random', label: '随机' }], c.newOrder || 'book')}</div>
      <div class="field"><span class="label">复习间隔</span><div class="field-stack">
        <input class="t-ladder" data-cfg-ladder type="text" inputmode="numeric" value="${c.ladder.join(', ')}" aria-label="复习间隔（分钟）">
        <div class="chips">${c.ladder.map(m => `<span class="chip">${S.fmtInterval(m * S.MIN)}</span>`).join('')}</div></div></div>
      <div class="field"><span class="label">每天开始</span><select data-cfg-select="dayStart" aria-label="每天开始时间">${hours}</select></div>
    </section>`
  }

  T.renderHome = (el) => {
    root = el
    const o = overview()
    const c = o.c
    const s = T.session()
    const wrongCount = o.wrong.keys.length + o.wrong.words.length
    const backlog = o.due.length > 200
    const fmax = Math.max(1, ...o.forecast.map(b => b.count))
    const accRows = Object.keys(SKILL).map(k => ({ label: SKILL[k], count: o.acc[k][0] ? o.acc[k][1] / o.acc[k][0] : 0, value: `${pct(o.acc[k][1], o.acc[k][0])}<small> ${o.acc[k][0]}</small>`, cls: k === o.weakest ? 'weak' : '' }))
    const st = o.status
    const smax = Math.max(1, st.new, st.learning, st.passed, st.retained)
    root.innerHTML = `<div class="trainer">
      ${s ? `<div class="resume"><div class="resume-text"><strong>上次训练未完成</strong><span>${T.MODE[s.mode]}${s.label ? ` · ${esc(s.label)}` : ''} · 已答 ${s.stats.answered} 题${s.round.length ? ` · 完成 ${s.stats.graduated.length}/${s.round.length} 词` : ''} · 剩约 ${V.session.remaining(s, c, T.state)} 题</span></div>
        <div class="row-actions"><button type="button" class="btn ghost" data-act="h-end">${icon('x')}<span>结束本轮</span></button>
        <button type="button" class="btn primary" data-act="h-resume">${icon('play')}<span>继续上次训练</span></button></div></div>` : ''}
      <div class="t-kpis">
        ${kpi('今日新学', `${o.d.intro}<small> / ${c.newPerDay}</small>`, `本轮通过 ${o.d.grad} · 已练 ${o.d.groups || 0} 组`)}
        ${kpi('到期复习', o.due.length, o.overdue.length ? `逾期 ${o.overdue.length}，最早 ${o.oldest} 天前` : '没有逾期', o.overdue.length ? 'warn' : '')}
        ${kpi('本轮通过', st.passed + st.retained, `跨天复习通过 ${st.retained}`)}
        ${kpi('无提示首答正确率', pct(o.firstToday[1], o.firstToday[0]), `近 7 天 ${pct(o.firstAll[1], o.firstAll[0])}`)}
        ${kpi('刚学过（待完成）', st.learning, `未学 ${st.new}`)}
        ${kpi('顽固错词', o.stubborn.length, o.weakest ? `薄弱：${SKILL[o.weakest]}` : '暂无薄弱题型', o.stubborn.length ? 'warn' : '')}
      </div>
      <div class="panel t-plan">
        ${scopeHtml(o)}
        <div class="t-tasks">
          <div><span class="label">今天还剩新词</span><b>${o.newPlanned}</b><small>${o.pool.length ? `每组 ${c.groupSize} 个 · 共 ${o.groups} 组` : o.chapter === 'all' ? '已学完' : '本章已学完'}</small></div>
          <div><span class="label">到期复习</span><b>${o.due.length}</b><small>含重学 ${o.relearn}</small></div>
          <div><span class="label">错词强化</span><b>${wrongCount}</b><small>顽固 ${o.stubborn.length}</small></div>
          <div><span class="label">待完成</span><b>${o.learning.length}</b><small>没练完，排在组的后半</small></div>
        </div>
        ${backlog ? `<div class="t-backlog">${icon('triangle-alert')}<span>复习积压：到期 ${o.due.length} 个，按当前新词目标今天全部做完约 ${o.dayTotal} 题</span>
          <button type="button" class="btn" data-act="h-light">${icon('minus')}<span>今日新词降到 20</span></button></div>` : ''}
        <div class="t-controls">
          <div class="field"><span class="label">每天新词</span>${stepper('newPerDay', c.newPerDay, 0, 300, 10)}</div>
          <div class="field"><span class="label">每组</span>${V.seg('groupSize', [10, 20, 30].map(n => ({ value: n, label: `${n} 个` })), c.groupSize)}</div>
        </div>
        <div class="t-actions">
          <button type="button" class="btn${s ? '' : ' primary'} lg" data-act="h-daily">${icon('play')}<span>学新词 · 第 ${(o.d.groups || 0) + 1} 组</span><small>${groupNote(o)}</small></button>
          <button type="button" class="btn lg" data-act="h-due"${o.due.length ? '' : ' disabled'}>${icon('calendar-clock')}<span>到期复习</span><small>${o.due.length}</small></button>
          <button type="button" class="btn lg" data-act="h-wrong"${wrongCount ? '' : ' disabled'}>${icon('book-x')}<span>只练错词</span><small>${wrongCount}</small></button>
        </div>
      </div>
      <div class="t-grid">
        <section class="panel t-sec"><h3>接下来的复习</h3>${rows(o.forecast, fmax)}</section>
        <section class="panel t-sec"><h3>题型正确率 <small>近 7 天首答 · 题数</small></h3>${rows(accRows, 1)}</section>
        <section class="panel t-sec"><h3>词汇状态</h3>${rows([
          { label: '跨天复习通过', count: st.retained, cls: 'ok' }, { label: '本轮通过', count: st.passed }, { label: '刚学过', count: st.learning, cls: 'mid' }, { label: '未学', count: st.new, cls: 'off' },
        ].concat(st.skipped ? [{ label: '已会（跳过）', count: st.skipped, cls: 'off' }] : []), smax)}</section>
      </div>
      ${o.stubborn.length ? `<h3 class="section-title">顽固错词</h3><ul class="miss-list">${o.stubborn.slice(0, 30).map((e) => {
        const w = V.byUid[e.uid]
        const tags = Object.keys(ERR).filter(k => e.err[k]).map(k => `<span class="tag k-${k}">${ERR[k]}错 ${e.err[k]}</span>`).join('')
        return `<li class="wb-row"><button type="button" class="icon-btn sm" data-act="h-speak" data-uid="${esc(e.uid)}" title="发音" aria-label="发音">${icon('volume-2')}</button>
          <span class="m-word" lang="en">${esc(V.wordText(w))}</span><span class="m-meaning">${esc(w.meaning)}</span><span class="wb-meta">${tags}</span><span></span></li>`
      }).join('')}</ul>` : ''}
      ${settingsHtml(c)}
    </div>`
  }

  function confirmReplace() {
    return !T.session() || window.confirm('有未完成的训练。结束它并开始新的？没有通过的词会保留为待完成。')
  }

  function groupNote(o) {
    const { fresh, carry } = o.group
    if (!fresh.length && !carry.length)
      return o.pool.length ? '今天的新词已学完' : '没有新词了'
    return `新词 ${fresh.length}${carry.length ? ` + 待完成 ${carry.length}` : ''} · 约 ${o.estimate} 题`
  }
  T.groupNote = groupNote

  function startDaily() {
    const o = overview()
    const { carry, fresh } = o.group
    T.start('daily', { queue: fresh.concat(carry.map(w => w.uid)), newCount: fresh.length, scope: o.prefix, label: scopeLabel(o) })
  }
  T.startDaily = startDaily

  function scopeLabel(o) {
    return o.chapter === 'all' ? '' : V.chapterName(o.chapter)
  }

  /** Mark words as already known (excluded from training) or bring them back as new. */
  function setSkipped(uids, on) {
    const t = T.now()
    for (const uid of uids)
      db.put({ k: `W:${uid}`, uid, state: on ? 'skipped' : 'new', at: t })
  }

  /** Used by the word list: start new words from this word. */
  T.setStart = (uid) => {
    const w = V.byUid[uid]
    if (w)
      T.setCfg({ newScope: w.chapter, newStart: uid })
  }

  T.onHomeAct = (act, btn) => {
    if (act === 'h-resume')
      return T.resume()
    if (act === 'h-end')
      return T.end()
    if (act === 'h-speak')
      return V.speak(V.byUid[btn.dataset.uid])
    if (act === 'h-light') {
      T.setCfg({ newPerDay: 20 })
      return T.renderHome(root)
    }
    if (act === 'h-pick') {
      const w = V.byUid[btn.dataset.uid]
      T.setStart(w.uid)
      const st = T.wordStatus(w.uid)
      V.toast(st === 'new' ? `起点：${V.chapterName(w.chapter)} · ${w.words[0]}` : `${w.words[0]} ${STATE_NAME[st]}，下一组从后面第一个没学的词开始`)
      T.renderHome(root)
      const now = root.querySelector('.t-start-now')
      if (now)
        now.scrollIntoView({ block: 'nearest' })
      return
    }
    if (act === 'h-skip-before' || act === 'h-unskip') {
      const o = overview()
      const list = act === 'h-skip-before' ? o.before : o.skipped
      const msg = act === 'h-skip-before'
        ? `把起点前面 ${list.length} 个未学的词标为已会？这些词不会出现在训练里，也不计入本轮通过，之后可以恢复。`
        : `恢复 ${list.length} 个已会的词？它们会重新作为新词出现。`
      if (list.length && window.confirm(msg)) {
        setSkipped(list, act === 'h-skip-before')
        V.toast(act === 'h-skip-before' ? `已标记 ${list.length} 个词为已会` : `已恢复 ${list.length} 个词`)
      }
      return T.renderHome(root)
    }
    if (act === 'h-step') {
      const box = btn.closest('.stepper')
      const c = T.cfg()
      const v = Math.max(Number(box.dataset.min), Math.min(Number(box.dataset.max), c[box.dataset.name] + Number(btn.dataset.d) * Number(box.dataset.step)))
      T.setCfg({ [box.dataset.name]: v })
      return T.renderHome(root)
    }
    if (!['h-daily', 'h-due', 'h-wrong'].includes(act) || !confirmReplace())
      return
    if (act === 'h-daily')
      return startDaily()
    const o = overview()
    if (act === 'h-due')
      return T.start('due', { scope: o.prefix, label: o.prefix ? scopeLabel(o) : '' })
    T.start('wrong', { wrongKeys: o.wrong.keys, queue: o.wrong.words, label: o.prefix ? scopeLabel(o) : '' })
  }

  function onSeg(e) {
    const b = e.target.closest('.trainer .seg button')
    if (!b || b.disabled)
      return
    const name = b.parentElement.dataset.name
    const raw = b.dataset.value
    T.setCfg({ [name]: ['newOrder', 'reviewScope', 'wrongPenalty'].includes(name) ? raw : Number(raw) })
    T.renderHome(root)
  }

  function onChange(e) {
    const el = e.target
    if (el.dataset.cfg) {
      T.setCfg({ [el.dataset.cfg]: el.checked })
    }
    else if (el.dataset.cfgSelect) {
      const v = el.value
      const name = el.dataset.cfgSelect
      if (name === 'newScope')
        T.setCfg({ newScope: v === 'all' ? 'all' : Number(v), newStart: '' })
      else if (name === 'newStart')
        T.setCfg({ newStart: v })
      else
        T.setCfg({ [name]: Number(v) })
    }
    else if (el.hasAttribute('data-cfg-ladder')) {
      const list = el.value.split(/[\s,，、]+/).filter(Boolean).map(Number)
      const ok = list.length >= 2 && list.every((m, i) => m > 0 && Number.isFinite(m) && (i === 0 || m > list[i - 1]))
      if (!ok) {
        V.toast('复习间隔需要是递增的分钟数，例如 5, 30, 240, 1440')
        el.value = T.cfg().ladder.join(', ')
        return
      }
      T.setCfg({ ladder: list })
    }
    else {
      return
    }
    T.renderHome(root)
  }

  T.mountHome = (el) => {
    el.addEventListener('click', onSeg)
    el.addEventListener('change', onChange)
    let composing = false
    let timer = 0
    const update = (input) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const box = el.querySelector('.t-find-results')
        if (box)
          renderFind(box, input.value)
      }, 120)
    }
    el.addEventListener('compositionstart', () => { composing = true })
    el.addEventListener('compositionend', (e) => {
      composing = false
      if (e.target.id === 't-find')
        update(e.target)
    })
    el.addEventListener('input', (e) => {
      if (e.target.id === 't-find' && !composing)
        update(e.target)
    })
    el.addEventListener('keydown', (e) => {
      // Enter picks the first match (not while choosing a Chinese IME candidate).
      if (e.target.id !== 't-find' || e.key !== 'Enter' || e.isComposing || e.keyCode === 229)
        return
      e.preventDefault()
      const first = findWords(e.target.value)[0]
      if (first)
        T.onHomeAct('h-pick', { dataset: { uid: first.uid } })
    })
  }
})()
