/* 阅读: original practice passages in exam format (timer, split view, highlighting, marking
   with the evidence sentence and the paraphrase pair), the 538 replacement drill, an answer
   sheet for the learner's own papers, and question-type methods. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const A = V.answers
  const R = window.READING_DATA || { passages: [] }
  const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']
  const LETTERS = 'ABCDEFGHIJKL'

  const TABS = [
    { value: 'test', label: '原创模考', icon: 'book-open-text' },
    { value: '538', label: '538 同义替换', icon: 'repeat' },
    { value: 'sheet', label: '答题卡', icon: 'clipboard-list' },
    { value: 'tips', label: '题型与方法', icon: 'lightbulb' },
  ]
  const TYPE_NAME = { tfng: '判断：事实', ynng: '判断：观点', gap: '句子填空', mc: '单选', heading: '段落标题', para: '段落信息匹配', multi: '多选', box: '摘要选词' }
  const CHOICES = { tfng: ['TRUE', 'FALSE', 'NOT GIVEN'], ynng: ['YES', 'NO', 'NOT GIVEN'] }

  let root = null
  let body = null
  let tab = 'test'
  let view = 'home'
  let resultId = ''
  let wrongOnly = false
  let stopTick = null
  let savedRange = null
  let savedAt = 0

  const book = V.bookIndex('R538')
  const drill = V.synDrill({ key: 'r538', chapter: book, modes: ['word', 'reverse'], groupName: i => `第 ${i + 1} 类考点词`, daily: 'r538' })
  const sheet = K.sheet(['academic', 'general'])

  const byId = id => R.passages.find(p => p.id === id)
  const questionsOf = p => p.groups.flatMap(g => g.questions)
  const test = () => {
    const t = K.get('rtest', null)
    return t && t.ids.every(byId) ? t : null
  }
  const saveTest = t => K.set('rtest', t)
  const results = () => K.get('rresults', [])
  const setName = ids => (ids.length > 1 ? '整套三篇' : byId(ids[0]).title)

  /* ---------- passage text ---------- */

  // Saved highlights are our own escaped text plus <mark class="hl"> tags; anything else is ignored.
  const SAFE = /^(?:[^<]|<mark class="hl">|<\/mark>)*$/

  function paraText(p, letter, t) {
    const [, text] = p.paragraphs.find(x => x[0] === letter)
    const saved = t && t.marks && t.marks[p.id] && t.marks[p.id][letter]
    return saved && SAFE.test(saved) ? saved : esc(text)
  }

  /** Paragraph text with the evidence sentences of the given questions marked. */
  function evidenceText(text, list) {
    const spans = []
    for (const q of list) {
      const at = text.indexOf(q.evidence)
      if (at >= 0)
        spans.push({ s: at, e: at + q.evidence.length, ns: [q.n], bad: q.bad })
    }
    spans.sort((a, b) => a.s - b.s)
    const merged = []
    for (const sp of spans) {
      const prev = merged[merged.length - 1]
      if (prev && sp.s < prev.e) {
        prev.e = Math.max(prev.e, sp.e)
        prev.ns.push(...sp.ns)
        prev.bad = prev.bad || sp.bad
      }
      else {
        merged.push(Object.assign({}, sp, { ns: sp.ns.slice() }))
      }
    }
    let out = ''
    let i = 0
    for (const sp of merged) {
      out += esc(text.slice(i, sp.s))
      out += `<mark class="ev${sp.bad ? ' bad' : ''}" data-ns=" ${sp.ns.join(' ')} "><sup>${sp.ns.join(',')}</sup>${esc(text.slice(sp.s, sp.e))}</mark>`
      i = sp.e
    }
    return out + esc(text.slice(i))
  }

  function passageHtml(p, t, marks) {
    const qs = questionsOf(p)
    const paras = p.paragraphs.map(([letter, text]) => {
      const inner = marks
        ? evidenceText(text, qs.filter(q => q.para === letter).map(q => ({ n: q.n, evidence: q.evidence, bad: marks[q.n] === false })))
        : paraText(p, letter, t)
      return `<div class="rd-para"><span class="rd-letter">${letter}</span><p class="rd-p" data-l="${letter}" lang="en">${inner}</p></div>`
    }).join('')
    return `<article class="rd-article"><h3 lang="en">${esc(p.title)}</h3>${paras}</article>`
  }

  /* ---------- questions ---------- */

  const pressed = (a, n, v) => String(a[n] || '') === v

  function groupHtml(g, p, a) {
    const range = g.from === g.to ? `Question ${g.from}` : `Questions ${g.from}–${g.to}`
    let inner = ''
    if (CHOICES[g.type]) {
      inner = g.questions.map(q => `<div class="rd-q" data-q="${q.n}"><div class="rd-qtext"><b>${q.n}</b><span lang="en">${esc(q.text)}</span></div>
        <div class="rd-choices" role="group" aria-label="第 ${q.n} 题">${CHOICES[g.type].map(v => `<button type="button" class="rd-choice" data-act="rd-pick" data-n="${q.n}" data-v="${v}" aria-pressed="${pressed(a, q.n, v)}">${v}</button>`).join('')}</div></div>`).join('')
    }
    else if (g.type === 'mc') {
      inner = g.questions.map(q => `<div class="rd-q" data-q="${q.n}"><div class="rd-qtext"><b>${q.n}</b><span lang="en">${esc(q.text)}</span></div>
        <div class="rd-opts">${q.options.map((o, i) => `<button type="button" class="rd-opt" data-act="rd-pick" data-n="${q.n}" data-v="${LETTERS[i]}" aria-pressed="${pressed(a, q.n, LETTERS[i])}"><b>${LETTERS[i]}</b><span lang="en">${esc(o)}</span></button>`).join('')}</div></div>`).join('')
    }
    else if (g.type === 'heading') {
      const list = `<ol class="rd-list-box" lang="en">${g.options.map((o, i) => `<li><b>${ROMAN[i]}</b><span>${esc(o)}</span></li>`).join('')}</ol>`
      inner = list + g.questions.map(q => `<label class="rd-q rd-inline" data-q="${q.n}"><b>${q.n}</b><span lang="en">${esc(q.text)}</span>
        <select data-act="rd-sel" data-n="${q.n}" aria-label="第 ${q.n} 题"><option value=""></option>${g.options.map((_, i) => `<option value="${ROMAN[i]}"${pressed(a, q.n, ROMAN[i]) ? ' selected' : ''}>${ROMAN[i]}</option>`).join('')}</select></label>`).join('')
    }
    else if (g.type === 'para') {
      const letters = p.paragraphs.map(x => x[0])
      inner = g.questions.map(q => `<label class="rd-q rd-inline" data-q="${q.n}"><b>${q.n}</b><span lang="en">${esc(q.text)}</span>
        <select data-act="rd-sel" data-n="${q.n}" aria-label="第 ${q.n} 题"><option value=""></option>${letters.map(l => `<option value="${l}"${pressed(a, q.n, l) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')
    }
    else if (g.type === 'gap') {
      inner = g.questions.map((q) => {
        const [before, after = ''] = q.text.split(/_{3,}/)
        return `<div class="rd-q rd-gapq" data-q="${q.n}"><b>${q.n}</b><span lang="en">${esc(before)}<input class="rd-gap" type="text" data-act="rd-gap" data-n="${q.n}" value="${esc(a[q.n] || '')}" aria-label="第 ${q.n} 题" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="next">${esc(after)}</span></div>`
      }).join('')
    }
    else if (g.type === 'multi') {
      const chosen = g.questions.map(q => a[q.n]).filter(Boolean)
      inner = `<div class="rd-q" data-q="${g.from}"><div class="rd-opts">${g.options.map((o, i) => `<button type="button" class="rd-opt" data-act="rd-multi" data-from="${g.from}" data-v="${LETTERS[i]}" aria-pressed="${chosen.includes(LETTERS[i])}"><b>${LETTERS[i]}</b><span lang="en">${esc(o)}</span></button>`).join('')}</div>
        <div class="muted rd-pick">选 ${g.pick} 个 · 已选 <span data-multi-count="${g.from}">${chosen.length}</span></div></div>`
    }
    else if (g.type === 'box') {
      const sel = n => `<b>${n}</b> <select data-act="rd-sel" data-n="${n}" aria-label="第 ${n} 题"><option value=""></option>${g.options.map((_, i) => `<option value="${LETTERS[i]}"${pressed(a, n, LETTERS[i]) ? ' selected' : ''}>${LETTERS[i]}</option>`).join('')}</select>`
      const summary = esc(g.summary).replace(/(\d{1,2}) _{3,}/g, (_, n) => sel(n))
      inner = `<ol class="rd-list-box rd-words" lang="en">${g.options.map((o, i) => `<li><b>${LETTERS[i]}</b><span>${esc(o)}</span></li>`).join('')}</ol><p class="rd-summary" lang="en">${summary}</p>`
    }
    return `<section class="rd-group"><div class="rd-ghead"><b>${range}</b><span class="tag">${TYPE_NAME[g.type]}</span></div>
      <p class="rd-instr" lang="en">${esc(g.instruction)}</p>${inner}</section>`
  }

  /* ---------- home ---------- */

  function homeHtml() {
    const t = test()
    const res = results()
    const rows = R.passages.map((p, i) => {
      const mine = res.filter(r => r.ids.length === 1 && r.ids[0] === p.id)
      const best = mine.reduce((b, r) => (!b || r.score > b.score ? r : b), null)
      const n = questionsOf(p).length
      return `<li class="sh-row">
        <div class="sh-name"><b lang="en">Passage ${i + 1} · ${esc(p.title)}</b><span class="muted">${esc(p.topic)} · ${n} 题 · ${p.minutes} 分钟</span></div>
        <div class="sh-score">${best ? `<span>最好 <b>${best.score}/${best.total}</b></span><span class="muted">做过 ${mine.length} 次</span>` : '<span class="muted">还没做过</span>'}</div>
        <div class="row-actions"><button type="button" class="btn primary" data-act="rd-start" data-ids="${p.id}">${icon('play')}<span>开始</span></button></div></li>`
    }).join('')
    const total = R.passages.reduce((n, p) => n + questionsOf(p).length, 0)
    const minutes = R.passages.reduce((n, p) => n + p.minutes, 0)
    const recent = res.slice(-8).reverse().map(r => `<li class="sh-hist"><span class="muted">${K.date(r.at)}</span><span>${esc(setName(r.ids))}</span>
      <b>${r.score}/${r.total}</b>${r.band != null ? `<span class="tag">约 ${r.band}</span>` : ''}<span class="muted">${V.fmtDuration(r.secs * 1000)}</span>
      <button type="button" class="icon-btn sm" data-act="rd-view" data-id="${r.id}" title="查看" aria-label="查看">${icon('history')}</button></li>`).join('')
    return `<div class="rd-home">
      ${t ? `<div class="resume"><div class="resume-text"><strong>上次没做完</strong><span>${esc(setName(t.ids))} · 已答 ${Object.values(t.answers).filter(v => String(v).trim()).length} 题</span></div>
        <div class="row-actions"><button type="button" class="btn ghost" data-act="rd-drop">${icon('x')}<span>放弃</span></button><button type="button" class="btn primary" data-act="rd-resume">${icon('play')}<span>继续</span></button></div></div>` : ''}
      <div class="panel rd-full"><div><b>整套模考</b><div class="muted">3 篇 · ${total} 题 · ${minutes} 分钟 · 交卷后换算学术类分数</div></div>
        <button type="button" class="btn primary lg" data-act="rd-start" data-ids="${R.passages.map(p => p.id).join(',')}">${icon('timer')}<span>开始整套</span></button></div>
      <ul class="sh-list">${rows}</ul>
      ${recent ? `<h3 class="section-title">最近成绩</h3><ul class="sh-list">${recent}</ul>` : ''}
      <p class="sk-note">${icon('info')}<span>三篇文章和题目为本站原创，按雅思学术类题型编写，难度接近真题中等水平。</span></p></div>`
  }

  /* ---------- run ---------- */

  function answered(t) {
    const qs = t.ids.flatMap(id => questionsOf(byId(id)))
    return { done: qs.filter(q => String(t.answers[q.n] || '').trim()).length, total: qs.length }
  }

  function runHtml(t) {
    const p = byId(t.cur && t.ids.includes(t.cur) ? t.cur : t.ids[0])
    const limit = t.ids.reduce((n, id) => n + byId(id).minutes, 0) * 60
    const c = answered(t)
    const switcher = t.ids.length > 1 ? V.seg('rd-cur', t.ids.map((id, i) => ({ value: id, label: `Passage ${i + 1}` })), p.id) : ''
    return `<div class="rd-run${t.pane === 'q' ? ' show-q' : ''}">
      <div class="rd-bar">${switcher}
        <div class="rd-pane-seg">${V.seg('rd-pane', [{ value: 'text', label: '原文', icon: 'file-text' }, { value: 'q', label: '题目', icon: 'list-ordered' }], t.pane === 'q' ? 'q' : 'text')}</div>
        <span class="spacer"></span>
        <span class="muted rd-count">已答 <b id="rd-done">${c.done}</b> / ${c.total}</span>
        <span class="sh-timer" title="剩余时间">${icon('timer')}<span id="rd-clock" data-limit="${limit}"></span></span>
        <button type="button" class="btn ghost" data-act="rd-pause">${icon('pause')}<span>稍后继续</span></button>
        <button type="button" class="btn primary" data-act="rd-submit">${icon('check')}<span>交卷</span></button></div>
      <div class="rd-split">
        <div class="rd-text" data-pid="${p.id}">
          <div class="rd-tools"><button type="button" class="btn ghost" data-act="rd-hl">${icon('highlighter')}<span>划线</span></button>
            <button type="button" class="btn ghost" data-act="rd-hl-clear">${icon('x')}<span>清除划线</span></button></div>
          ${passageHtml(p, t)}</div>
        <div class="rd-qs">${p.groups.map(g => groupHtml(g, p, t.answers)).join('')}
          ${t.ids.length > 1 && t.ids.indexOf(p.id) < t.ids.length - 1 ? `<div class="sk-actions"><span class="spacer"></span><button type="button" class="btn" data-act="rd-next">${icon('arrow-right')}<span>下一篇</span></button></div>` : ''}</div>
      </div></div>`
  }

  function start(ids) {
    const cur = test()
    if (cur && cur.ids.join() !== ids.join() && !window.confirm('放弃没做完的那一套，开始新的？'))
      return
    if (!cur || cur.ids.join() !== ids.join())
      saveTest({ ids, started: Date.now(), answers: {}, marks: {}, cur: ids[0], pane: 'text' })
    view = 'run'
    renderBody()
    window.scrollTo(0, 0)
  }

  function setAnswer(n, v) {
    const t = test()
    if (!t)
      return
    t.answers[n] = v
    saveTest(t)
    const done = body.querySelector('#rd-done')
    if (done)
      done.textContent = answered(t).done
  }

  function submit() {
    const t = test()
    if (!t)
      return
    const c = answered(t)
    if (c.done < c.total && !window.confirm(`还有 ${c.total - c.done} 题没答，确定交卷？没把握也要猜一个，空着一定不得分。`))
      return
    const marks = {}
    let score = 0
    let total = 0
    for (const id of t.ids) {
      for (const m of A.markGroups(byId(id).groups, t.answers)) {
        marks[m.n] = m.ok
        total++
        if (m.ok)
          score++
      }
    }
    const r = { id: K.id(), ids: t.ids, at: Date.now(), secs: (Date.now() - t.started) / 1000, score, total, band: total >= 40 ? A.band('academic', score, total) : null, answers: t.answers, marks }
    K.set('rresults', results().concat(r).slice(-100))
    saveTest(null)
    if (V.daily)
      V.daily.mark('read', t.ids.length)
    resultId = r.id
    view = 'result'
    wrongOnly = false
    renderBody()
    window.scrollTo(0, 0)
  }

  /* ---------- result ---------- */

  function resultHtml(r) {
    const cur = r.cur && r.ids.includes(r.cur) ? r.cur : r.ids[0]
    const p = byId(cur)
    const per = r.ids.map((id) => {
      const qs = questionsOf(byId(id))
      return { id, ok: qs.filter(q => r.marks[q.n]).length, n: qs.length }
    })
    const types = {}
    for (const id of r.ids) {
      for (const g of byId(id).groups) {
        const t = types[g.type] || (types[g.type] = { ok: 0, n: 0 })
        for (const q of g.questions) {
          t.n++
          if (r.marks[q.n])
            t.ok++
        }
      }
    }
    const marked = A.markGroups(p.groups, r.answers)
    const reviews = p.groups.map((g) => {
      const rows = g.questions.filter(q => !wrongOnly || !r.marks[q.n]).map((q) => {
        const m = marked.find(x => x.n === q.n)
        const shown = g.type === 'mc' ? `${m.expected} ${esc(q.options[LETTERS.indexOf(m.expected)] || '')}` : esc(m.expected)
        return `<li class="rd-rev ${m.ok ? 'ok' : 'bad'}">
          <div class="rd-rev-head"><b>${q.n}</b>${m.ok ? `<span class="verdict v-right">${icon('circle-check')}</span>` : `<span class="verdict v-wrong">${icon('circle-x')}</span>`}
            <span class="rd-rev-ans">答案 <b lang="en">${shown}</b>${m.ok ? '' : ` · 你的 <s lang="en">${esc(m.answer || '（空）')}</s>`}</span><span class="spacer"></span>
            <button type="button" class="btn ghost" data-act="rd-loc" data-n="${q.n}">${icon('text-search')}<span>定位 ${q.para} 段</span></button></div>
          <div class="rd-rev-q" lang="en">${esc(q.text)}</div>
          ${q.pair ? `<div class="rd-pair"><span lang="en">${esc(q.pair[0])}</span>${icon('arrow-left-right')}<span lang="en">${esc(q.pair[1])}</span></div>` : ''}
          ${m.note ? `<div class="muted">${esc(m.note)}</div>` : ''}
          <div class="rd-explain">${esc(q.explain)}</div></li>`
      }).join('')
      return rows ? `<section class="rd-group"><div class="rd-ghead"><b>Questions ${g.from}–${g.to}</b><span class="tag">${TYPE_NAME[g.type]}</span></div><ul class="rd-revs">${rows}</ul></section>` : ''
    }).join('')
    return `<div class="rd-result">
      <div class="panel rd-score"><div class="sd-sum-score"><b>${r.score}</b><span>/ ${r.total}</span></div>
        <div class="rd-score-info"><b>${esc(setName(r.ids))}</b><span class="muted">${K.date(r.at)} · 用时 ${V.fmtDuration(r.secs * 1000)}${r.band != null ? ` · 学术类约 ${r.band} 分` : ''}</span>
          <div class="chips">${Object.entries(types).map(([k, v]) => `<span class="chip${v.ok < v.n ? ' c-miss' : ' c-ok'}">${TYPE_NAME[k]} ${v.ok}/${v.n}</span>`).join('')}</div></div>
        <div class="row-actions"><button type="button" class="btn ghost" data-act="rd-home">${icon('list')}<span>返回</span></button>
          <button type="button" class="btn" data-act="rd-start" data-ids="${r.ids.join(',')}">${icon('rotate-ccw')}<span>重做</span></button></div></div>
      <div class="rd-bar">${r.ids.length > 1 ? V.seg('rd-rcur', per.map((x, i) => ({ value: x.id, label: `Passage ${i + 1}`, sub: `${x.ok}/${x.n}` })), cur) : ''}
        <div class="rd-pane-seg">${V.seg('rd-pane', [{ value: 'text', label: '原文', icon: 'file-text' }, { value: 'q', label: '解析', icon: 'list-ordered' }], K.get('rd:rpane', 'q'))}</div>
        <span class="spacer"></span><label class="sh-check"><input type="checkbox" data-act="rd-wrongonly"${wrongOnly ? ' checked' : ''}><span>只看错题</span></label></div>
      <div class="rd-split rd-split-result${K.get('rd:rpane', 'q') === 'q' ? ' show-q' : ''}">
        <div class="rd-text">${passageHtml(p, null, r.marks)}</div>
        <div class="rd-qs">${reviews || `<div class="empty">${icon('circle-check')}<p>这一篇全对</p></div>`}</div></div></div>`
  }

  /* ---------- highlighting ---------- */

  function trackSelection() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || sel.isCollapsed || !body)
      return
    const r = sel.getRangeAt(0)
    const p = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer.closest('.rd-p') : r.commonAncestorContainer.parentElement.closest('.rd-p')
    if (p && body.contains(p) && !p.closest('.rd-split-result')) {
      savedRange = r.cloneRange()
      savedAt = Date.now()
    }
  }

  function saveMarks() {
    const t = test()
    const box = body.querySelector('.rd-text')
    if (!t || !box)
      return
    const pid = box.dataset.pid
    t.marks[pid] = {}
    box.querySelectorAll('.rd-p').forEach((p) => {
      if (p.querySelector('mark'))
        t.marks[pid][p.dataset.l] = p.innerHTML
    })
    saveTest(t)
  }

  function highlight() {
    // Tapping the button collapses the selection on iPad, so the last selection is kept briefly.
    const r = savedRange && Date.now() - savedAt < 30000 ? savedRange : null
    if (!r || r.collapsed) {
      V.toast('先在原文里选中一段文字')
      return
    }
    const p = (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement).closest('.rd-p')
    if (!p || !body.contains(p)) {
      savedRange = null
      V.toast(p ? '请重新选中要划线的文字' : '一次只能划同一段里的文字')
      return
    }
    const mark = document.createElement('mark')
    mark.className = 'hl'
    mark.appendChild(r.extractContents())
    r.insertNode(mark)
    // Flatten nested highlights so the saved HTML stays simple.
    mark.querySelectorAll('mark').forEach(m => m.replaceWith(...m.childNodes))
    p.normalize()
    window.getSelection().removeAllRanges()
    savedRange = null
    saveMarks()
  }

  function clearMarks() {
    body.querySelectorAll('.rd-text mark.hl').forEach(m => m.replaceWith(...m.childNodes))
    body.querySelectorAll('.rd-p').forEach(p => p.normalize())
    saveMarks()
  }

  /* ---------- notes ---------- */

  const METHODS = [
    ['TRUE / FALSE / NOT GIVEN', '判断“事实”。原文意思相同是 TRUE，明确相反是 FALSE，没有提到或无法判断是 NOT GIVEN。盯住绝对词（only、all、never）、比较级和时间先后，常见陷阱是原文只说了一半。'],
    ['YES / NO / NOT GIVEN', '方法同上，判断的是作者的观点和主张。原文只是描述事实、作者没有表态时，通常是 NOT GIVEN。'],
    ['段落标题', '先读段落首句和末句抓主旨，不要因为一个细节词相同就选。例子里用过的标题先划掉，两个都像时选能概括整段的。'],
    ['段落信息匹配', '题目顺序和原文顺序无关，留到最后做。先找具体的信息（数字、人名、例子），一个段落可能对应多题。'],
    ['句子 / 笔记填空', '先看字数限制和空格要的词性、单复数。答案照抄原文拼写，按原文顺序出现。'],
    ['单选与多选', '先用题干关键词定位，再把每个选项和原文逐一比对。正确选项通常是原文的同义改写，照搬原文单词的选项反而常是干扰。'],
    ['摘要选词', '先判断空格需要的词性和语法，排除明显不合语法的选项，再回原文核对意思。'],
  ]
  const GENERAL = [
    ['时间分配', '学术类 3 篇共 40 题、60 分钟，没有额外誊写时间。每篇约 20 分钟，第三篇最难，可以多留几分钟。'],
    ['不留空', '答错不扣分。实在不会也要填一个，空着一定不得分。'],
    ['同义替换是核心', '题干和原文之间几乎都是改写，538 考点词是阅读里最常被改写的词。做完模考看每题的“题干 ↔ 原文”对照。'],
    ['培训类阅读', '题型相同，文章多为通知、广告、工作场景说明，前两部分较易，分数换算要求比学术类高。'],
  ]

  function tipsHtml() {
    const ac = A.BANDS.academic.filter(([, b]) => b >= 4)
    const gt = A.BANDS.general.filter(([, b]) => b >= 4)
    const rows = list => list.map(([min, b], i) => `<div role="row"><span role="cell">${min}–${i ? list[i - 1][0] - 1 : 40}</span><b role="cell">${b}</b></div>`).join('')
    const groupNames = (V.data.chapters[book] || {}).groupNames || []
    return `<div class="tips">
      <h3 class="section-title">题型方法</h3>
      <dl class="tips-list">${METHODS.map(([t, d]) => `<div><dt lang="en">${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <h3 class="section-title">整体策略</h3>
      <dl class="tips-list">${GENERAL.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      ${groupNames.length ? `<h3 class="section-title">538 考点词分类（原书说明）</h3><ul class="tips-plain">${groupNames.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <h3 class="section-title">分数换算（约）</h3>
      <div class="band-cols"><div><span class="label">学术类</span><div class="band-table" role="table">${rows(ac)}</div></div>
        <div><span class="label">培训类</span><div class="band-table" role="table">${rows(gt)}</div></div></div>
      <p class="sk-note">${icon('info')}<span>官方给出的学术类平均线：答对 15、23、30、35 题约为 5、6、7、8 分。每套题的换算略有不同。</span></p>
      <div class="sk-actions"><button type="button" class="btn" data-act="go-res">${icon('library')}<span>官方免费练习</span></button></div></div>`
  }

  /* ---------- page ---------- */

  function renderBody() {
    if (!body)
      return
    if (stopTick) {
      stopTick()
      stopTick = null
    }
    if (tab === '538')
      return drill.render(body)
    if (tab === 'sheet')
      return sheet.render(body)
    if (tab === 'tips') {
      body.innerHTML = tipsHtml()
      return
    }
    const t = test()
    if (view === 'run' && !t)
      view = 'home'
    const r = results().find(x => x.id === resultId)
    if (view === 'result' && !r)
      view = 'home'
    if (view === 'run') {
      body.innerHTML = runHtml(t)
      const clock = body.querySelector('#rd-clock')
      stopTick = K.ticker(clock, t.started, Number(clock.dataset.limit))
    }
    else if (view === 'result') {
      body.innerHTML = resultHtml(r)
    }
    else {
      body.innerHTML = homeHtml()
    }
  }

  function render() {
    tab = K.get('tab:reading', 'test')
    if (!TABS.some(x => x.value === tab))
      tab = 'test'
    root.innerHTML = `<div class="skill">${K.head('阅读', '', K.tabs(TABS, tab))}<div class="sk-body"></div></div>`
    body = root.querySelector('.sk-body')
    renderBody()
  }

  function locate(n) {
    const split = body.querySelector('.rd-split')
    if (split && split.classList.contains('show-q') && getComputedStyle(body.querySelector('.rd-text')).display === 'none') {
      K.set('rd:rpane', 'text')
      split.classList.remove('show-q')
      body.querySelectorAll('[data-name="rd-pane"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === 'text')))
    }
    const m = body.querySelector(`mark.ev[data-ns*=" ${n} "]`)
    if (!m)
      return V.toast('这一题的证据句不在当前文章里')
    m.scrollIntoView({ block: 'center', behavior: 'smooth' })
    m.classList.remove('flash')
    void m.offsetWidth
    m.classList.add('flash')
  }

  function onAct(name, el) {
    if (name === 'sub') {
      drill.leave()
      K.set('tab:reading', el.dataset.value)
      return render()
    }
    if (name.startsWith('sd-'))
      return drill.act(name, el)
    switch (name) {
      case 'rd-start': return start(el.dataset.ids.split(','))
      case 'rd-resume':
        view = 'run'
        render()
        return window.scrollTo(0, 0)
      case 'rd-drop':
        if (window.confirm('放弃这次作答？'))
          saveTest(null)
        return renderBody()
      case 'rd-pause':
      case 'rd-home':
        view = 'home'
        return render()
      case 'rd-submit': return submit()
      case 'rd-view':
        resultId = el.dataset.id
        view = 'result'
        wrongOnly = false
        render()
        return window.scrollTo(0, 0)
      case 'rd-next': {
        const t = test()
        t.cur = t.ids[t.ids.indexOf(t.cur || t.ids[0]) + 1]
        saveTest(t)
        renderBody()
        return window.scrollTo(0, 0)
      }
      case 'rd-pick': {
        const n = el.dataset.n
        const t = test()
        const v = t && t.answers[n] === el.dataset.v ? '' : el.dataset.v
        setAnswer(n, v)
        el.parentElement.querySelectorAll('[data-act="rd-pick"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)))
        return
      }
      case 'rd-multi': {
        const from = Number(el.dataset.from)
        const p = byId(test().cur || test().ids[0])
        const g = p.groups.find(x => x.from === from)
        const t = test()
        let chosen = g.questions.map(q => t.answers[q.n]).filter(Boolean)
        if (chosen.includes(el.dataset.v))
          chosen = chosen.filter(x => x !== el.dataset.v)
        else if (chosen.length >= g.pick)
          return V.toast(`最多选 ${g.pick} 个，先取消一个`)
        else
          chosen.push(el.dataset.v)
        chosen.sort()
        g.questions.forEach((q, i) => setAnswer(q.n, chosen[i] || ''))
        el.parentElement.querySelectorAll('[data-act="rd-multi"]').forEach(b => b.setAttribute('aria-pressed', String(chosen.includes(b.dataset.v))))
        const count = body.querySelector(`[data-multi-count="${from}"]`)
        if (count)
          count.textContent = chosen.length
        return
      }
      case 'rd-hl': return highlight()
      case 'rd-hl-clear': return clearMarks()
      case 'rd-loc': return locate(el.dataset.n)
      case 'go-res': return V.go('resources')
    }
  }

  V.pages = V.pages || {}
  V.pages.reading = {
    mount(el) {
      root = el
      document.addEventListener('selectionchange', trackSelection)
      K.wire(el, {
        sheet: { act: (n, b, e) => tab === 'sheet' && sheet.act(n, b, e), onInput: e => tab === 'sheet' && sheet.onInput(e), onKeydown: e => tab === 'sheet' && sheet.onKeydown(e), onSeg: b => tab === 'sheet' && sheet.onSeg(b) },
        onAct,
        onSeg(name, value) {
          if (name.startsWith('sd-'))
            return drill.onSeg(name, value)
          if (name === 'rd-cur') {
            const t = test()
            t.cur = value
            saveTest(t)
            renderBody()
            return window.scrollTo(0, 0)
          }
          if (name === 'rd-rcur') {
            const all = results()
            const r = all.find(x => x.id === resultId)
            r.cur = value
            K.set('rresults', all)
            return renderBody()
          }
          if (name === 'rd-pane') {
            const split = body.querySelector('.rd-split')
            if (view === 'run') {
              const t = test()
              t.pane = value
              saveTest(t)
              body.querySelector('.rd-run').classList.toggle('show-q', value === 'q')
            }
            else {
              K.set('rd:rpane', value)
              split.classList.toggle('show-q', value === 'q')
            }
            body.querySelectorAll('[data-name="rd-pane"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.value === value)))
          }
        },
        onChange(e) {
          const el = e.target
          if (el.dataset.act === 'rd-sel')
            setAnswer(el.dataset.n, el.value)
          else if (el.dataset.act === 'rd-wrongonly') {
            wrongOnly = el.checked
            renderBody()
          }
        },
        onInput(e) {
          if (tab === '538')
            drill.onInput(e)
          if (e.target.dataset.act === 'rd-gap')
            setAnswer(e.target.dataset.n, e.target.value)
        },
        onKeydown(e) {
          if (tab === '538')
            return drill.onKeydown(e)
          if (e.key === 'Enter' && !e.isComposing && e.target.dataset.act === 'rd-gap') {
            e.preventDefault()
            const all = [...body.querySelectorAll('.rd-gap')]
            const next = all[all.indexOf(e.target) + 1]
            if (next)
              next.focus()
            else
              e.target.blur()
          }
        },
      })
    },
    render,
    leave() {
      drill.leave()
      if (view === 'result')
        view = 'home'
    },
    open(sub) {
      K.set('tab:reading', sub)
    },
  }
})()
