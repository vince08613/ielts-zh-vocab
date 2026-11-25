/* Practice view: setup, quiz (choice / write / card, both directions) and summary. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { core, store, esc, icon } = V

  const DIR_LABEL = { e2z: '英 → 中', z2e: '中 → 英' }
  const TYPE_LABEL = { choice: '选择', write: '默写', card: '闪卡' }
  const RESULT_LABEL = { right: '正确', close: '接近', wrong: '错误' }
  const CARD_LABEL = { right: '认识', close: '模糊', wrong: '不认识' }
  const RESULT_ICON = { right: 'circle-check', close: 'circle-dashed', wrong: 'circle-x' }
  const IDLE_CAP_MS = 120000

  let root = null
  let stage = 'setup'
  let lastSummary = null
  let revealed = false
  let hintShown = false
  let autoTimer = 0
  let renderedIndex = -1
  let lastCompositionEnd = 0
  let lastTick = Date.now()

  const coarse = () => window.matchMedia('(pointer: coarse)').matches
  const current = () => (store.session ? V.byId[store.session.queue[store.session.index]] : null)

  function tally(list) {
    const t = { right: 0, close: 0, wrong: 0 }
    for (const a of list) {
      if (a)
        t[a.result]++
    }
    return t
  }

  function highlight(sentence, variants, mode) {
    return core.markWord(sentence, variants).map((seg) => {
      if (!seg.hit)
        return esc(seg.text)
      return mode === 'blank' ? '<span class="blank" aria-label="空格"></span>' : `<mark>${esc(seg.text)}</mark>`
    }).join('')
  }

  /* ---------- setup ---------- */

  /** Words a session may draw from. 全部章节 = the 22 真经 chapters; the wrong book keeps every word. */
  function scopeOf(chapter, source) {
    if (chapter !== 'all')
      return V.chapterWords[chapter]
    return source === 'wrong' ? V.words : V.coreWords
  }

  function sourceCounts(cfg) {
    const scope = scopeOf(cfg.chapter, '')
    const p = store.progress[cfg.dir]
    const c = { all: scope.length, new: 0, weak: 0, wrong: 0, mastered: 0 }
    for (const w of scope) {
      const st = core.statusOf(p[w.id])
      if (st === 'new')
        c.new++
      if (st === 'mastered')
        c.mastered++
      else
        c.weak++
    }
    for (const w of scopeOf(cfg.chapter, 'wrong')) {
      if (core.statusOf(p[w.id]) === 'review')
        c.wrong++
    }
    return c
  }

  function renderSetup() {
    const cfg = store.config
    const counts = sourceCounts(cfg)
    const avail = counts[cfg.source]
    const total = cfg.count > 0 ? Math.min(cfg.count, avail) : avail
    const s = store.session
    const resume = s
      ? `<div class="resume">
          <div class="resume-text"><strong>未完成的测试</strong>
            <span>${DIR_LABEL[s.cfg.dir]} · ${TYPE_LABEL[s.cfg.type]} · ${esc(s.title)} · 第 ${s.index + 1} / ${s.queue.length} 题</span></div>
          <div class="row-actions">
            <button type="button" class="btn ghost" data-act="discard">${icon('x')}<span>放弃</span></button>
            <button type="button" class="btn primary" data-act="resume">${icon('play')}<span>继续</span></button>
          </div>
        </div>`
      : ''
    const other = cfg.dir === 'e2z' ? 'z2e' : 'e2z'
    const otherCounts = sourceCounts(Object.assign({}, cfg, { dir: other }))

    root.innerHTML = `<div class="setup">
      ${resume}
      <div class="panel form">
        <div class="field"><span class="label">方向</span>${V.seg('dir', [
          { value: 'e2z', label: '英 → 中' },
          { value: 'z2e', label: '中 → 英' },
        ], cfg.dir)}</div>
        <div class="field"><span class="label">作答</span>${V.seg('type', [
          { value: 'choice', label: '选择', icon: 'list-checks' },
          { value: 'write', label: '默写', icon: 'pencil-line' },
          { value: 'card', label: '闪卡', icon: 'layers' },
        ], cfg.type)}</div>
        <div class="field"><span class="label">章节</span>
          <div class="field-stack">
            <select id="cfg-chapter" aria-label="章节">${V.chapterOptions(cfg.chapter, true)}</select>
            <div class="field-note">
              <span class="tag e2z">英 → 中</span> 掌握 ${cfg.dir === 'e2z' ? counts.mastered : otherCounts.mastered} / ${counts.all}
              <span class="tag z2e">中 → 英</span> 掌握 ${cfg.dir === 'z2e' ? counts.mastered : otherCounts.mastered} / ${counts.all}
            </div>
          </div>
        </div>
        <div class="field"><span class="label">范围</span>${V.seg('source', [
          { value: 'new', label: '未测', sub: counts.new, disabled: !counts.new },
          { value: 'weak', label: '未掌握', sub: counts.weak, disabled: !counts.weak },
          { value: 'wrong', label: '错词', sub: counts.wrong, disabled: !counts.wrong },
          { value: 'all', label: '全部', sub: counts.all },
        ], cfg.source)}</div>
        <div class="field"><span class="label">题数</span>${V.seg('count', [
          { value: 10, label: '10' },
          { value: 20, label: '20' },
          { value: 50, label: '50' },
          { value: 0, label: '全部' },
        ], cfg.count)}</div>
        <div class="field"><span class="label">顺序</span>${V.seg('order', [
          { value: 'book', label: '原书顺序', icon: 'book-open' },
          { value: 'random', label: '随机', icon: 'shuffle' },
        ], cfg.order)}</div>
      </div>
      <div class="setup-foot">
        <span class="avail">${total ? `共 ${total} 题` : '当前范围没有单词'}</span>
        <button type="button" class="btn primary lg" data-act="start"${total ? '' : ' disabled'}>${icon('play')}<span>开始测试</span></button>
      </div>
    </div>`
  }

  function setConfig(name, raw) {
    const cfg = store.config
    if (name === 'count')
      cfg.count = Number(raw)
    else if (name === 'chapter')
      cfg.chapter = V.parseChapter(raw)
    else
      cfg[name] = raw
    // Keep the source valid for the new scope.
    const counts = sourceCounts(cfg)
    if (!counts[cfg.source])
      cfg.source = counts.new ? 'new' : 'all'
    store.saveConfig()
    renderSetup()
  }

  /* ---------- session lifecycle ---------- */

  function startSession(cfg, ids, title) {
    const queue = ids || core.buildQueue(scopeOf(cfg.chapter, cfg.source), cfg, store.progress[cfg.dir])
    if (!queue.length) {
      V.toast('当前范围没有可测的单词')
      return false
    }
    store.session = {
      id: Date.now().toString(36),
      cfg: Object.assign({}, cfg),
      title: title || V.chapterName(cfg.chapter),
      queue,
      index: 0,
      answers: [],
      options: {},
      elapsed: 0,
    }
    store.saveSession()
    stage = 'quiz'
    renderedIndex = -1
    lastTick = Date.now()
    renderQuiz()
    speakIfNeeded()
    return true
  }

  function tick(s) {
    const t = Date.now()
    s.elapsed += Math.min(t - lastTick, IDLE_CAP_MS)
    lastTick = t
  }

  function speakIfNeeded() {
    const s = store.session
    if (s && s.cfg.dir === 'e2z' && store.settings.autoSpeak && !s.answers[s.index])
      V.speak(current())
  }

  function finish() {
    clearTimeout(autoTimer)
    const s = store.session
    if (!s)
      return
    const answered = s.answers.filter(Boolean)
    if (answered.length) {
      const t = tally(answered)
      const entry = {
        t: Math.floor(Date.now() / 1000),
        dir: s.cfg.dir,
        type: s.cfg.type,
        title: s.title,
        total: answered.length,
        right: t.right,
        close: t.close,
        wrong: t.wrong,
        ms: s.elapsed,
      }
      store.addHistory(entry)
      lastSummary = { entry, cfg: s.cfg, answers: answered.map(a => ({ id: a.id, result: a.result, answer: a.answer, choice: a.choice })) }
      stage = 'summary'
    }
    else {
      stage = 'setup'
    }
    store.session = null
    store.saveSession()
    V.refreshBadges()
    P.render()
    window.scrollTo(0, 0)
  }

  function exitQuiz() {
    const s = store.session
    if (!s)
      return
    if (s.answers.some(Boolean)) {
      if (window.confirm('结束本次测试并查看结果？'))
        finish()
      return
    }
    store.session = null
    store.saveSession()
    stage = 'setup'
    renderSetup()
  }

  /* ---------- quiz rendering ---------- */

  function optionsFor(s, w) {
    if (!s.options[s.index]) {
      const wrong = core.pickDistractors(w, V.words, 3)
      s.options[s.index] = core.shuffle([w.id].concat(wrong.map(x => x.id)))
      store.saveSession()
    }
    return s.options[s.index].map(id => V.byId[id])
  }

  const optionMeaning = o => core.maskMeaning(o.meaning, o.words)

  function headHtml(s) {
    const t = tally(s.answers)
    return `<button type="button" class="icon-btn" data-act="exit" title="结束测试" aria-label="结束测试">${icon('x')}</button>
      <div class="quiz-title"><span class="tag ${s.cfg.dir}">${DIR_LABEL[s.cfg.dir]}</span>
        <span class="quiz-type">${TYPE_LABEL[s.cfg.type]}</span><span class="quiz-scope">${esc(s.title)}</span></div>
      <div class="quiz-tally">
        <span class="t-right" title="正确">${icon('check')}${t.right}</span>
        <span class="t-wrong" title="错误或接近">${icon('x')}${t.close + t.wrong}</span>
        <span class="t-pos">${s.index + 1} / ${s.queue.length}</span>
      </div>`
  }

  function zhHint(w) {
    const first = w.words[0]
    const letters = first.replace(/[^A-Za-zÀ-ÿ]/g, '').length
    const sentence = w.example ? `<span class="hint-sentence" lang="en">${highlight(w.example, w.words, 'blank')}</span>` : ''
    return `<span class="hint-letters">首字母 <b lang="en">${esc(first[0])}</b> · ${letters} 个字母</span>${sentence}`
  }

  function promptHtml(s, w, ans) {
    const done = !!ans || revealed
    const pos = w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''
    const canHint = !done && (s.cfg.dir === 'z2e' || w.example)
    const hintBtn = canHint ? `<button type="button" class="icon-btn" data-act="hint" title="提示" aria-label="提示" aria-pressed="${hintShown}">${icon('lightbulb')}</button>` : ''
    if (s.cfg.dir === 'e2z') {
      return `<div class="prompt-main en" lang="en">${esc(V.wordText(w))}</div>
        <div class="prompt-sub">${pos}<button type="button" class="icon-btn" data-act="speak" title="发音" aria-label="发音">${icon('volume-2')}</button>${hintBtn}</div>
        ${hintShown && canHint ? `<p class="hint" lang="en">${highlight(w.example, w.words, 'mark')}</p>` : ''}`
    }
    return `<div class="prompt-main zh">${esc(core.maskMeaning(w.meaning, w.words))}</div>
      <div class="prompt-sub">${pos}${hintBtn}</div>
      ${hintShown && canHint ? `<p class="hint">${zhHint(w)}</p>` : ''}`
  }

  function choiceHtml(s, w, ans) {
    const en = s.cfg.dir === 'z2e'
    const buttons = optionsFor(s, w).map((o, i) => {
      let cls = 'opt'
      if (ans)
        cls += o.id === w.id ? ' is-right' : o.id === ans.choice ? ' is-wrong' : ' is-dim'
      const text = en ? esc(V.wordText(o)) : esc(optionMeaning(o))
      return `<button type="button" class="${cls}" data-act="choose" data-id="${o.id}"${en ? ' lang="en"' : ''}${ans ? ' disabled' : ''}>`
        + `<span class="key">${i + 1}</span><span class="opt-text">${text}</span></button>`
    })
    return `<div class="options">${buttons.join('')}</div>`
  }

  function writeAreaHtml(dir) {
    const attrs = dir === 'e2z'
      ? 'lang="zh-CN" placeholder="中文释义"'
      : 'lang="en" placeholder="英文单词"'
    return `<div class="write">
      <input id="answer" class="answer-input" type="text" ${attrs} autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-label="答案">
      <div class="write-actions">
        <button type="button" class="btn ghost" data-act="giveup">${icon('skip-forward')}<span>不会</span></button>
        <button type="button" class="btn primary" data-act="submit">${icon('check')}<span>提交</span></button>
      </div>
    </div>`
  }

  function answerCard(w) {
    return `<div class="answer-card">
      <div class="ans-head"><span class="ans-word" lang="en">${esc(V.wordText(w))}</span>${w.pos ? `<span class="pos">${esc(w.pos)}</span>` : ''}
        <button type="button" class="icon-btn" data-act="speak" title="发音" aria-label="发音">${icon('volume-2')}</button></div>
      <div class="ans-meaning">${esc(w.meaning)}</div>
      ${w.example ? `<p class="ans-example" lang="en">${highlight(w.example, w.words, 'mark')}</p>` : ''}
      ${w.extra ? `<p class="ans-extra">${esc(w.extra)}</p>` : ''}
    </div>`
  }

  function cardHtml(w) {
    if (!revealed)
      return `<div class="card-actions"><button type="button" class="btn primary lg" data-act="reveal">${icon('eye')}<span>显示答案</span></button></div>`
    return `${answerCard(w)}
      <div class="grade">
        <button type="button" class="btn grade-wrong" data-act="grade" data-r="wrong">${icon('x')}<span>不认识</span></button>
        <button type="button" class="btn grade-close" data-act="grade" data-r="close">${icon('circle-dashed')}<span>模糊</span></button>
        <button type="button" class="btn grade-right" data-act="grade" data-r="right">${icon('check')}<span>认识</span></button>
      </div>`
  }

  function yourAnswerHtml(s, w, ans) {
    if (s.cfg.type === 'write')
      return ans.empty ? '<span class="your">未作答</span>' : `<span class="your">你的答案 <b>${esc(ans.answer)}</b></span>`
    if (s.cfg.type === 'choice' && ans.choice !== w.id) {
      const o = V.byId[ans.choice]
      return s.cfg.dir === 'e2z'
        ? `<span class="your">你选的 <b>${esc(optionMeaning(o))}</b> 是 <b lang="en">${esc(o.words[0])}</b></span>`
        : `<span class="your">你选的 <b lang="en">${esc(o.words[0])}</b> 是「${esc(o.meaning)}」</span>`
    }
    return ''
  }

  function feedbackHtml(s, w, ans) {
    let override = ''
    if (s.cfg.type === 'write' && !ans.empty) {
      override = ans.result === 'right'
        ? `<button type="button" class="btn ghost" data-act="override" data-r="wrong">${icon('x')}<span>判为错误</span></button>`
        : `<button type="button" class="btn ghost" data-act="override" data-r="right">${icon('check')}<span>算我对</span></button>`
    }
    const last = s.index >= s.queue.length - 1
    return `<div class="verdict v-${ans.result}">${icon(RESULT_ICON[ans.result])}<strong>${RESULT_LABEL[ans.result]}</strong>
        ${ans.overridden ? '<small>已改判</small>' : ''}${yourAnswerHtml(s, w, ans)}</div>
      ${answerCard(w)}
      <div class="fb-actions">${override}
        <button type="button" class="btn primary" data-act="next"><span>${last ? '查看结果' : '下一题'}</span>${icon('arrow-right')}</button></div>`
  }

  function focusAnswer(input) {
    try {
      input.focus({ preventScroll: true })
    }
    catch (e) {
      input.focus()
    }
  }

  function renderQuiz() {
    const s = store.session
    if (!s) {
      stage = 'setup'
      return renderSetup()
    }
    const w = current()
    const ans = s.answers[s.index]
    let quiz = root.querySelector('.quiz')
    if (!quiz || quiz.dataset.sid !== s.id) {
      root.innerHTML = `<div class="quiz" data-sid="${s.id}" data-dir="${s.cfg.dir}" data-type="${s.cfg.type}">
        <div class="quiz-head"></div><div class="bar"><span></span></div>
        <div class="prompt"></div><div class="answer-area"></div><div class="feedback" aria-live="polite"></div></div>`
      quiz = root.querySelector('.quiz')
      if (s.cfg.type === 'write')
        quiz.querySelector('.answer-area').innerHTML = writeAreaHtml(s.cfg.dir)
      renderedIndex = -1
    }
    const fresh = renderedIndex !== s.index
    if (fresh) {
      hintShown = false
      revealed = false
      renderedIndex = s.index
    }
    quiz.querySelector('.quiz-head').innerHTML = headHtml(s)
    const done = s.answers.filter(Boolean).length
    quiz.querySelector('.bar span').style.width = `${(done / s.queue.length) * 100}%`
    quiz.querySelector('.prompt').innerHTML = promptHtml(s, w, ans)

    const area = quiz.querySelector('.answer-area')
    if (s.cfg.type === 'choice') {
      area.innerHTML = choiceHtml(s, w, ans)
    }
    else if (s.cfg.type === 'card') {
      area.innerHTML = cardHtml(w)
    }
    else {
      const input = area.querySelector('#answer')
      if (fresh)
        input.value = ans ? (ans.answer || '') : ''
      input.readOnly = !!ans
      input.classList.remove('is-right', 'is-close', 'is-wrong')
      if (ans)
        input.classList.add(`is-${ans.result}`)
      area.querySelector('.write-actions').hidden = !!ans
      if (!ans && fresh)
        focusAnswer(input)
    }
    const fb = quiz.querySelector('.feedback')
    fb.innerHTML = ans && s.cfg.type !== 'card' ? feedbackHtml(s, w, ans) : ''
  }

  /* ---------- answering ---------- */

  function answer(result, extra) {
    const s = store.session
    const w = current()
    if (!s || s.answers[s.index])
      return
    clearTimeout(autoTimer)
    tick(s)
    const prev = store.record(s.cfg.dir, w.id, result)
    if (V.trainer)
      V.trainer.extraFromTest(w, s.cfg.dir, result)
    s.answers[s.index] = Object.assign({ id: w.id, result, prev, hint: hintShown }, extra)
    store.saveSession()
    if (s.cfg.type === 'card')
      return next()
    renderQuiz()
    if (s.cfg.dir === 'z2e' && store.settings.autoSpeak)
      V.speak(w)
    revealNext()
    if (result === 'right' && s.cfg.type === 'choice' && store.settings.autoNext)
      autoTimer = setTimeout(next, 900)
  }

  // On short or narrow screens bring the feedback and the next button into view.
  function revealNext() {
    const btn = root.querySelector('[data-act="next"]')
    if (!btn)
      return
    const r = btn.getBoundingClientRect()
    const bottom = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - 12
    if (r.bottom > bottom)
      window.scrollBy({ top: r.bottom - bottom, behavior: 'smooth' })
  }

  function submit(giveUp) {
    const s = store.session
    if (!s)
      return
    if (s.answers[s.index])
      return next()
    const w = current()
    const input = root.querySelector('#answer')
    const value = giveUp ? '' : input.value.trim()
    if (!giveUp && !value) {
      focusAnswer(input)
      return
    }
    const judged = s.cfg.dir === 'e2z' ? core.judgeZh(value, w.meaning, w.pos) : core.judgeEn(value, w.words)
    answer(giveUp ? 'wrong' : judged.verdict, { answer: value, empty: !!giveUp })
    if (coarse())
      input.blur()
  }

  function override(result) {
    const s = store.session
    const a = s && s.answers[s.index]
    if (!a || a.result === result)
      return
    store.restore(s.cfg.dir, a.id, a.prev)
    store.record(s.cfg.dir, a.id, result)
    a.result = result
    a.overridden = true
    store.saveSession()
    renderQuiz()
  }

  function next() {
    clearTimeout(autoTimer)
    const s = store.session
    if (!s || !s.answers[s.index])
      return
    if (s.index >= s.queue.length - 1)
      return finish()
    s.index++
    store.saveSession()
    renderQuiz()
    if (root.getBoundingClientRect().top < 0)
      window.scrollTo(0, 0)
    speakIfNeeded()
  }

  function reveal() {
    if (revealed)
      return
    revealed = true
    renderQuiz()
    if (store.session.cfg.dir === 'z2e' && store.settings.autoSpeak)
      V.speak(current())
  }

  /* ---------- summary ---------- */

  function missHtml(a, dir, type) {
    const w = V.byId[a.id]
    let your = ''
    if (type === 'write')
      your = a.answer ? esc(a.answer) : '未作答'
    else if (type === 'choice' && a.choice)
      your = dir === 'e2z' ? esc(optionMeaning(V.byId[a.choice])) : `<span lang="en">${esc(V.wordText(V.byId[a.choice]))}</span>`
    else
      your = CARD_LABEL[a.result]
    return `<li class="miss r-${a.result}">
      <button type="button" class="icon-btn" data-act="speak-id" data-id="${w.id}" title="发音" aria-label="发音">${icon('volume-2')}</button>
      <span class="m-word" lang="en">${esc(V.wordText(w))}${w.pos ? ` <em class="pos">${esc(w.pos)}</em>` : ''}</span>
      <span class="m-meaning">${esc(w.meaning)}</span>
      <span class="m-your">${icon(RESULT_ICON[a.result])}<span>${your}</span></span>
    </li>`
  }

  function renderSummary() {
    const { entry, answers } = lastSummary
    const pct = Math.round((entry.right / entry.total) * 100)
    const misses = answers.filter(a => a.result !== 'right')
    root.innerHTML = `<div class="summary">
      <div class="sum-head">
        <div class="sum-score">${pct}<small>%</small></div>
        <div class="sum-info">
          <div class="sum-title"><span class="tag ${entry.dir}">${DIR_LABEL[entry.dir]}</span><span>${TYPE_LABEL[entry.type]}</span><span class="muted">${esc(entry.title)}</span></div>
          <div class="sum-tally">
            <span class="t-right">${icon('check')}正确 ${entry.right}</span>
            <span class="t-close">${icon('circle-dashed')}接近 ${entry.close}</span>
            <span class="t-wrong">${icon('x')}错误 ${entry.wrong}</span>
            <span class="muted">${icon('history')}${V.fmtDuration(entry.ms)}</span>
          </div>
        </div>
      </div>
      <div class="sum-actions">
        ${misses.length ? `<button type="button" class="btn primary" data-act="retry">${icon('rotate-ccw')}<span>重测错题 ${misses.length}</span></button>` : ''}
        <button type="button" class="btn${misses.length ? '' : ' primary'}" data-act="again">${icon('play')}<span>再来一组</span></button>
        <button type="button" class="btn ghost" data-act="home">${icon('house')}<span>返回</span></button>
      </div>
      ${misses.length ? `<h3 class="section-title">需要复习</h3><ul class="miss-list">${misses.map(a => missHtml(a, entry.dir, entry.type)).join('')}</ul>` : ''}
    </div>`
  }

  /* ---------- events ---------- */

  function onClick(e) {
    const segBtn = e.target.closest('.seg button')
    if (segBtn && stage === 'setup') {
      if (!segBtn.disabled)
        setConfig(segBtn.parentElement.dataset.name, segBtn.dataset.value)
      return
    }
    const btn = e.target.closest('[data-act]')
    if (!btn || btn.disabled)
      return
    const s = store.session
    switch (btn.dataset.act) {
      case 'start':
        startSession(store.config)
        break
      case 'resume':
        stage = 'quiz'
        lastTick = Date.now()
        renderQuiz()
        speakIfNeeded()
        break
      case 'discard':
        if (window.confirm('放弃这次未完成的测试？已作答单词的记录会保留。')) {
          store.session = null
          store.saveSession()
          renderSetup()
        }
        break
      case 'choose':
        answer(Number(btn.dataset.id) === current().id ? 'right' : 'wrong', { choice: Number(btn.dataset.id) })
        break
      case 'submit':
        submit(false)
        break
      case 'giveup':
        submit(true)
        break
      case 'reveal':
        reveal()
        break
      case 'grade':
        if (revealed)
          answer(btn.dataset.r, {})
        break
      case 'override':
        override(btn.dataset.r)
        break
      case 'next':
        next()
        break
      case 'hint':
        hintShown = !hintShown
        renderQuiz()
        if (s && s.cfg.type === 'write' && !s.answers[s.index])
          focusAnswer(root.querySelector('#answer'))
        break
      case 'speak':
        V.speak(current())
        break
      case 'speak-id':
        V.speak(V.byId[btn.dataset.id])
        break
      case 'exit':
        exitQuiz()
        break
      case 'retry':
        startSession(lastSummary.cfg, core.shuffle(lastSummary.answers.filter(a => a.result !== 'right').map(a => a.id)), '重测错题')
        break
      case 'again':
        if (!startSession(lastSummary.cfg)) {
          stage = 'setup'
          renderSetup()
        }
        break
      case 'home':
        stage = 'setup'
        renderSetup()
        window.scrollTo(0, 0)
        break
    }
  }

  function onChange(e) {
    if (e.target.id === 'cfg-chapter')
      setConfig('chapter', e.target.value)
  }

  function onInputKey(e) {
    if (e.target.id !== 'answer' || e.key !== 'Enter')
      return
    // Enter that confirms a Chinese IME candidate must not submit.
    if (e.isComposing || e.keyCode === 229 || Date.now() - lastCompositionEnd < 80)
      return
    e.preventDefault()
    const s = store.session
    if (s && s.answers[s.index])
      next()
    else
      submit(false)
  }

  function onKey(e) {
    if (!V.isView('practice') || stage !== 'quiz' || !store.session)
      return
    if (e.metaKey || e.ctrlKey || e.altKey || V.modalOpen())
      return
    const t = e.target
    if (t && t.matches && t.matches('input, textarea, select'))
      return
    const s = store.session
    const ans = s.answers[s.index]
    const type = s.cfg.type
    if (e.key === 'Escape') {
      exitQuiz()
    }
    else if (e.key === 'Enter' || e.key === 'ArrowRight') {
      if (ans) {
        e.preventDefault()
        next()
      }
      else if (type === 'card' && !revealed) {
        e.preventDefault()
        reveal()
      }
    }
    else if (type === 'choice' && !ans && /^[1-4]$/.test(e.key)) {
      const opt = root.querySelectorAll('.opt')[Number(e.key) - 1]
      if (opt)
        opt.click()
    }
    else if (type === 'card' && e.key === ' ' && !revealed) {
      e.preventDefault()
      reveal()
    }
    else if (type === 'card' && revealed && !ans && /^[1-3]$/.test(e.key)) {
      answer(['wrong', 'close', 'right'][Number(e.key) - 1], {})
    }
  }

  /* ---------- public ---------- */

  const P = V.practice = {}

  P.mount = (el) => {
    root = el
    root.addEventListener('click', onClick)
    root.addEventListener('change', onChange)
    root.addEventListener('keydown', onInputKey)
    root.addEventListener('compositionend', () => { lastCompositionEnd = Date.now() })
    document.addEventListener('keydown', onKey)
  }

  P.render = () => {
    if (stage === 'quiz' && store.session)
      renderQuiz()
    else if (stage === 'summary' && lastSummary)
      renderSummary()
    else {
      stage = 'setup'
      renderSetup()
    }
  }

  /** Start a session from another view (wrong book, stats). */
  P.startFrom = (cfg, title) => {
    if (store.session && !window.confirm('有一个未完成的测试，放弃它并开始新的测试？'))
      return
    if (startSession(cfg, null, title))
      V.go('practice')
  }

  P.current = current
})()
