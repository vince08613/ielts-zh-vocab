/* 写作: Task 1 (charts drawn from the prompt data, letters), Task 2, the 100 translation
   sentences, and reference material. Drafts save as you type; the timer survives leaving
   the page. After submitting, an offline check points at things to revise and the four
   marking criteria are used as a self-check. No band score is estimated. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const W = window.WRITING_DATA || { task1: [], task2: [], types: {}, task1Tips: [], phrases: [], linkers: [], errors: [], criteria: [] }
  const SK = window.SKILLS_DATA || { sentences: [], spelling: [] }
  const CHECK = V.writingCheck

  const TABS = [
    { value: 'task1', label: '小作文', icon: 'chart-line' },
    { value: 'task2', label: '大作文', icon: 'notebook-pen' },
    { value: 'sent', label: '100 句翻译', icon: 'languages' },
    { value: 'kit', label: '素材与评分', icon: 'book-open' },
  ]
  const SENT_RUN = 5
  const LETTER_TASK = { 'gt-complaint': 'letter-formal', 'gt-friend': 'letter-informal' }

  let root = null
  let body = null
  let tab = 'task1'
  let view = 'list' // list | edit | review
  let current = '' // prompt id while editing
  let reviewId = ''
  let stopTick = null
  let saveTimer = 0
  let showPlan = false

  const prompts = () => [...W.task1.map(p => Object.assign({ task: 1 }, p)), ...W.task2.map(p => Object.assign({ task: 2 }, p))]
  const promptById = id => prompts().find(p => p.id === id)
  const taskOf = p => (p.task === 2 ? 't2' : LETTER_TASK[p.id] || (p.kind === 'letter' ? 'letter-formal' : 't1'))
  const limitOf = p => (p.task === 2 ? 40 : 20) * 60
  const minOf = p => (p.task === 2 ? 250 : 150)
  const essays = () => K.get('wessays', [])
  const draft = id => K.get(`wdraft:${id}`, null)
  const firstSentence = s => (s.match(/^.*?[.?](?=\s|$)/) || [s])[0]

  /* ---------- charts ---------- */

  function niceScale(max) {
    const raw = max / 5 || 1
    const mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
    return { step, top: Math.ceil(max / step) * step }
  }

  function legend(series, y, width) {
    const each = width / series.length
    return series.map((s, i) => {
      const x = 40 + i * each
      return `<g class="ch-s${i}"><rect x="${x}" y="${y - 9}" width="14" height="10" rx="2"/><text x="${x + 20}" y="${y}" class="ch-leg">${esc(s.name)}</text></g>`
    }).join('')
  }

  function axisChart(p) {
    const W0 = 56
    const W1 = 604
    const H0 = 24
    const H1 = 268
    const max = Math.max(...p.series.flatMap(s => s.data))
    const { step, top } = niceScale(max)
    const y = v => H1 - (v / top) * (H1 - H0)
    const grid = []
    for (let v = 0; v <= top + 1e-9; v += step)
      grid.push(`<line x1="${W0}" x2="${W1}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${W0 - 8}" y="${y(v) + 4}" class="ch-tick" text-anchor="end">${Math.round(v * 100) / 100}</text>`)
    let marks = ''
    let labels = ''
    if (p.kind === 'line') {
      const x = i => W0 + 20 + (i / (p.x.length - 1)) * (W1 - W0 - 40)
      labels = p.x.map((l, i) => `<text x="${x(i)}" y="${H1 + 20}" class="ch-tick" text-anchor="middle">${esc(l)}</text>`).join('')
      marks = p.series.map((s, si) => `<g class="ch-s${si}"><polyline points="${s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" class="ch-line"/>${s.data.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4"/>`).join('')}</g>`).join('')
    }
    else {
      const gw = (W1 - W0) / p.x.length
      const bw = (gw * 0.72) / p.series.length
      labels = p.x.map((l, i) => `<text x="${W0 + gw * (i + 0.5)}" y="${H1 + 20}" class="ch-tick" text-anchor="middle">${esc(l)}</text>`).join('')
      marks = p.series.map((s, si) => `<g class="ch-s${si}">${s.data.map((v, i) => `<rect x="${W0 + gw * i + gw * 0.14 + bw * si}" y="${y(v)}" width="${bw - 2}" height="${H1 - y(v)}" rx="2"/>`).join('')}</g>`).join('')
    }
    return `<svg class="chart" viewBox="0 0 640 330" role="img" aria-label="${esc(p.title)}">
      <text x="${W0}" y="14" class="ch-unit">${esc(p.unit)}</text>${grid.join('')}<line x1="${W0}" x2="${W1}" y1="${H1}" y2="${H1}" class="ch-axis"/>${marks}${labels}${legend(p.series, 318, 560)}</svg>`
  }

  function pieChart(p) {
    const r = 104
    const pies = p.series.map((s, si) => {
      const cx = 170 + si * 300
      const cy = 134
      const total = s.data.reduce((a, b) => a + b, 0)
      let a0 = -Math.PI / 2
      const slices = s.data.map((v, i) => {
        const a1 = a0 + (v / total) * Math.PI * 2
        const large = a1 - a0 > Math.PI ? 1 : 0
        const pt = a => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
        const mid = (a0 + a1) / 2
        const label = `<text x="${cx + r * 0.64 * Math.cos(mid)}" y="${cy + r * 0.64 * Math.sin(mid) + 5}" class="ch-pct" text-anchor="middle">${v}%</text>`
        const path = `<path class="ch-slice" d="M${cx},${cy} L${pt(a0)} A${r},${r} 0 ${large} 1 ${pt(a1)} Z"/>`
        a0 = a1
        return `<g class="ch-s${i}">${path}${label}</g>`
      }).join('')
      return `${slices}<text x="${cx}" y="${cy + r + 26}" class="ch-title" text-anchor="middle">${esc(s.name)}</text>`
    }).join('')
    const series = p.x.map(name => ({ name }))
    return `<svg class="chart" viewBox="0 0 640 330" role="img" aria-label="${esc(p.title)}">${pies}${legend(series, 318, 580)}</svg>`
  }

  function tableChart(p) {
    return `<div class="ch-table-wrap"><table class="sk-table ch-table" lang="en"><caption>${esc(p.unit)}</caption>
      <thead><tr><th></th>${p.x.map(x => `<th class="num">${esc(x)}</th>`).join('')}</tr></thead>
      <tbody>${p.series.map(s => `<tr><th>${esc(s.name)}</th>${s.data.map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  }

  function chartHtml(p) {
    if (p.kind === 'line' || p.kind === 'bar')
      return axisChart(p)
    if (p.kind === 'pie')
      return pieChart(p)
    if (p.kind === 'table')
      return tableChart(p)
    return ''
  }

  /* ---------- lists ---------- */

  function promptRow(p) {
    const mine = essays().filter(e => e.pid === p.id)
    const d = draft(p.id)
    const typeName = p.task === 2 ? (W.types[p.type] || {}).name : p.title.split(' · ')[0]
    const title = p.task === 2 ? firstSentence(p.prompt) : p.title.split(' · ').slice(1).join(' · ')
    return `<li class="sh-row">
      <div class="sh-name"><b${p.task === 2 ? ' lang="en"' : ''}>${esc(title)}</b><span class="muted"><span class="tag">${esc(typeName || '')}</span> ${mine.length ? `写过 ${mine.length} 次` : ''}${d && d.text.trim() ? ` · 草稿 ${CHECK.countWords(d.text)} 词` : ''}</span></div>
      <div class="row-actions">${mine.length ? `<button type="button" class="icon-btn sm" data-act="w-review" data-id="${mine[mine.length - 1].id}" title="查看上次" aria-label="查看上次">${icon('history')}</button>` : ''}
        <button type="button" class="btn${d ? '' : ' primary'}" data-act="w-open" data-id="${p.id}">${icon(d ? 'pencil-line' : 'play')}<span>${d ? '继续写' : '开始写'}</span></button></div></li>`
  }

  function listHtml(task) {
    const list = task === 1 ? W.task1.map(p => Object.assign({ task: 1 }, p)) : W.task2.map(p => Object.assign({ task: 2 }, p))
    const history = essays().filter(e => (task === 1 ? e.task !== 't2' : e.task === 't2')).slice(-10).reverse()
    const hist = history.map(e => `<li class="sh-hist"><span class="muted">${K.date(e.at)}</span><span>${esc((promptById(e.pid) || {}).title || e.pid)}</span><b>${e.words} 词</b><span class="muted">${V.fmtDuration(e.secs * 1000)}</span>
      <button type="button" class="icon-btn sm" data-act="w-review" data-id="${e.id}" title="查看" aria-label="查看">${icon('history')}</button></li>`).join('')
    return `<div class="w-list">
      <p class="sk-note">${icon('info')}<span>${task === 1 ? '学术类图表 4 题，培训类书信 2 题。建议 20 分钟、至少 150 词。图表数据为练习用的虚构数据。' : '五种常见题型各 2 题。建议 40 分钟、至少 250 词。'}</span></p>
      <ul class="sh-list">${list.map(promptRow).join('')}</ul>
      ${hist ? `<h3 class="section-title">最近写的</h3><ul class="sh-list">${hist}</ul>` : ''}</div>`
  }

  /* ---------- editor ---------- */

  function clockStart(d) {
    return (d.since || Date.now()) - d.acc * 1000
  }

  function open(id) {
    const p = promptById(id)
    if (!p)
      return
    const d = draft(id) || { text: '', acc: 0, since: null }
    if (!d.since)
      d.since = Date.now()
    K.set(`wdraft:${id}`, d)
    K.set('wopen', id)
    current = id
    view = 'edit'
    showPlan = false
    renderBody()
    const ta = body.querySelector('#w-text')
    if (ta)
      ta.focus({ preventScroll: true })
  }

  function pause() {
    const d = current && draft(current)
    if (d && d.since) {
      const ta = body && body.querySelector('#w-text')
      if (ta)
        d.text = ta.value
      d.acc += (Date.now() - d.since) / 1000
      d.since = null
      K.set(`wdraft:${current}`, d)
    }
  }

  function planHtml(p) {
    if (p.task === 2) {
      const t = W.types[p.type]
      return t ? `<ol class="w-plan">${t.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''
    }
    if (p.kind === 'letter')
      return `<ol class="w-plan"><li>称呼：${p.id === 'gt-friend' ? 'Dear + 名字' : 'Dear Sir or Madam'}</li><li>第一段说明写信目的</li><li>三个要点各写一段</li><li>结尾：${p.id === 'gt-friend' ? 'Best wishes / All the best' : 'Yours faithfully'} + 姓名</li></ol>`
    return `<ul class="w-plan">${W.task1Tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
  }

  function editHtml(p) {
    const d = draft(p.id)
    const words = CHECK.countWords(d.text)
    return `<div class="w-edit">
      <div class="rd-bar"><button type="button" class="btn ghost" data-act="w-back">${icon('chevron-left')}<span>返回</span></button>
        <span class="tag">${p.task === 2 ? 'Task 2' : p.kind === 'letter' ? 'Task 1 · 书信' : 'Task 1'}</span><span class="spacer"></span>
        <span class="muted"><b id="w-count">${words}</b> / ${minOf(p)} 词</span>
        <span class="sh-timer" title="剩余时间">${icon('timer')}<span id="w-clock"></span></span></div>
      <div class="w-prompt panel"><p lang="en">${esc(p.prompt)}</p>${p.task === 1 ? chartHtml(p) : ''}
        <div class="sk-actions"><button type="button" class="btn ghost" data-act="w-plan" aria-pressed="${showPlan}">${icon('list-ordered')}<span>${showPlan ? '收起结构' : '写作结构'}</span></button></div>
        ${showPlan ? planHtml(p) : ''}</div>
      <textarea id="w-text" class="text-area w-text" lang="en" spellcheck="false" autocorrect="off" autocapitalize="sentences" placeholder="${p.kind === 'letter' ? 'Dear ...' : 'Start writing here'}">${esc(d.text)}</textarea>
      <div class="sk-actions"><span class="muted" id="w-saved">草稿自动保存</span><span class="spacer"></span>
        <button type="button" class="btn primary lg" data-act="w-submit">${icon('send')}<span>提交检查</span></button></div></div>`
  }

  function saveDraft() {
    const ta = body && body.querySelector('#w-text')
    if (!ta || !current)
      return
    const d = draft(current)
    if (!d)
      return
    d.text = ta.value
    K.set(`wdraft:${current}`, d)
  }

  function submit() {
    const p = promptById(current)
    const ta = body.querySelector('#w-text')
    const text = ta.value
    const words = CHECK.countWords(text)
    if (words < 20)
      return V.toast('写满 20 词以上再提交')
    if (words < minOf(p) && !window.confirm(`现在 ${words} 词，少于 ${minOf(p)} 词。确定提交？`))
      return
    const d = draft(current)
    const secs = d.acc + (d.since ? (Date.now() - d.since) / 1000 : 0)
    const e = { id: K.id(), pid: p.id, task: taskOf(p), at: Date.now(), secs, words, text, self: {} }
    K.set('wessays', essays().concat(e).slice(-60))
    K.set(`wdraft:${p.id}`, null)
    K.set('wopen', '')
    if (V.daily)
      V.daily.mark('write', 1)
    reviewId = e.id
    view = 'review'
    renderBody()
    window.scrollTo(0, 0)
  }

  /* ---------- review ---------- */

  const KIND_NAME = { grammar: '语法', style: '套话', register: '语体', task: '任务' }

  function criteriaFor(task) {
    return W.criteria.map(c => (c.key === 'TR' && task !== 't2' ? Object.assign({}, c, { name: '任务完成 Task Achievement' }) : c))
  }

  function reviewHtml(e) {
    const p = promptById(e.pid)
    const r = CHECK.analyze(e.text, { task: e.task, prompt: p ? p.prompt : '', min: p ? minOf(p) : 0, synonyms: K.synIndex().byKey, spelling: SK.spelling })
    const checks = r.checks.map(c => `<li class="${c.ok ? 'ok' : 'warn'}">${icon(c.ok ? 'circle-check' : 'triangle-alert')}<div><b>${esc(c.label)}</b>${!c.ok && c.detail ? `<span class="muted">${esc(c.detail)}</span>` : ''}</div></li>`).join('')
    const patterns = r.patterns.map(x => `<li><span class="tag ${x.kind === 'grammar' ? 'bad' : 'warn'}">${KIND_NAME[x.kind] || x.kind}</span><div><span class="chips">${x.hits.map(h => `<span class="chip" lang="en">${esc(h)}</span>`).join('')}</span><span>${esc(x.why)}</span><span class="muted">${esc(x.fix)}</span></div></li>`).join('')
    const repeats = r.repeats.slice(0, 8).map(x => `<li><b lang="en">${esc(x.word)}</b><span class="muted">×${x.count}${x.topic ? '（题目里的词）' : ''}</span>${x.suggest.length || x.book.length ? `<span class="chips">${[...new Set([...x.book, ...x.suggest])].slice(0, 6).map(s => `<span class="chip" lang="en">${esc(s)}</span>`).join('')}</span>` : ''}</li>`).join('')
    const linkers = r.linkers.slice(0, 12).map(l => `<span class="chip" lang="en">${esc(l.word)} ×${l.count}</span>`).join('')
    const crit = criteriaFor(e.task).map(c => `<fieldset class="w-crit"><legend>${esc(c.name)}</legend>${c.checks.map((x, i) => `<label class="sh-check"><input type="checkbox" data-act="w-self" data-k="${c.key}" data-i="${i}"${(e.self[c.key] || [])[i] ? ' checked' : ''}><span>${esc(x)}</span></label>`).join('')}</fieldset>`).join('')
    const hint = p ? (Array.isArray(p.hint) ? `<ul class="w-plan">${p.hint.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : `<p>${esc(p.hint)}</p>`) : ''
    const paras = e.text.split(/\n\s*\n|\n/).filter(x => x.trim()).map(x => `<p>${esc(x)}</p>`).join('')
    return `<div class="w-review">
      <div class="rd-bar"><button type="button" class="btn ghost" data-act="w-back">${icon('chevron-left')}<span>返回</span></button>
        <span class="muted">${K.date(e.at)} · ${e.words} 词 · 用时 ${V.fmtDuration(e.secs * 1000)}</span><span class="spacer"></span>
        ${p ? `<button type="button" class="btn" data-act="w-rewrite" data-id="${e.id}">${icon('pencil-line')}<span>改写一版</span></button>` : ''}</div>
      ${p ? `<div class="w-prompt panel"><p lang="en">${esc(p.prompt)}</p>${p.task === 1 ? chartHtml(p) : ''}</div>` : ''}
      <div class="w-cols">
        <div class="panel w-essay" lang="en">${paras}</div>
        <div class="w-side">
          <h3 class="section-title">自动检查</h3><ul class="w-checks">${checks}</ul>
          <div class="w-stats"><span>段落 <b>${r.paragraphs}</b></span><span>句子 <b>${r.sentences}</b></span><span>平均句长 <b>${r.avgLen}</b></span><span>最长 <b>${r.longest}</b> 词</span></div>
          ${patterns ? `<h3 class="section-title">需要检查的写法</h3><ul class="w-pats">${patterns}</ul>` : ''}
          ${repeats ? `<h3 class="section-title">重复较多的词</h3><ul class="w-reps">${repeats}</ul>` : ''}
          ${linkers ? `<h3 class="section-title">用到的连接词</h3><div class="chips">${linkers}</div>` : ''}
        </div></div>
      <h3 class="section-title">按评分标准自查</h3><div class="w-crits">${crit}</div>
      ${hint ? `<h3 class="section-title">思路参考</h3><div class="panel w-hint">${hint}</div>` : ''}
      <p class="sk-note">${icon('info')}<span>自动检查只能发现字数、结构和常见错误，不能代替考官评分，也不估分。</span></p></div>`
  }

  /* ---------- 100 sentences ---------- */

  let sRun = null
  let sShown = false
  const sStats = () => K.get('sentstats', {})
  const sections = [...new Set(SK.sentences.map(s => s.section))]

  function sStart(kind, value) {
    const st = sStats()
    let list = []
    if (kind === 'section')
      list = SK.sentences.filter(s => s.section === sections[Number(value)])
    else if (kind === 'wrong')
      list = SK.sentences.filter(s => st[s.no] && !st[s.no].lastOk)
    else
      list = K.shuffle(SK.sentences.filter(s => !st[s.no] || !st[s.no].lastOk)).slice(0, SENT_RUN)
    if (!list.length)
      return V.toast('没有可练的句子')
    sRun = { nos: list.map(s => s.no), pos: 0, ok: 0, typed: '' }
    sShown = false
    renderBody()
    const ta = body.querySelector('#s-answer')
    if (ta)
      ta.focus({ preventScroll: true })
  }

  function sReveal() {
    const ta = body.querySelector('#s-answer')
    sRun.typed = ta ? ta.value : ''
    if (!sRun.typed.trim())
      return ta && ta.focus()
    sShown = true
    renderBody()
  }

  function sGrade(ok) {
    const no = sRun.nos[sRun.pos]
    const st = sStats()
    const s = st[no] || { n: 0, ok: 0, lastOk: false, at: 0 }
    s.n++
    if (ok)
      s.ok++
    s.lastOk = ok
    s.at = Date.now()
    st[no] = s
    K.set('sentstats', st)
    if (ok)
      sRun.ok++
    if (V.daily)
      V.daily.mark('sent', 1)
    sRun.pos++
    sRun.typed = ''
    sShown = false
    renderBody()
    const ta = body.querySelector('#s-answer')
    if (ta)
      ta.focus({ preventScroll: true })
  }

  function sentHtml() {
    const st = sStats()
    if (sRun && sRun.pos < sRun.nos.length) {
      const s = SK.sentences.find(x => x.no === sRun.nos[sRun.pos])
      const flags = sShown ? CHECK.analyze(sRun.typed, { task: 't2', min: 1 }).patterns : []
      return `<div class="sd-run">
        <div class="sd-top"><span class="tag">${esc(s.section)}</span><span class="muted sd-count">${sRun.pos + 1} / ${sRun.nos.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="s-quit">${icon('x')}<span>结束</span></button></div>
        <div class="sd-q panel"><div class="s-zh"><b>${s.no}</b><span>${esc(s.zh)}</span></div>
          <textarea id="s-answer" class="text-area s-answer" rows="3" lang="en" spellcheck="false" autocorrect="off" autocapitalize="sentences" placeholder="English translation"${sShown ? ' readonly' : ''}>${esc(sRun.typed)}</textarea>
          ${sShown ? `<div class="s-ref">
            ${flags.length ? `<ul class="w-pats">${flags.map(x => `<li><span class="tag bad">${KIND_NAME[x.kind] || x.kind}</span><div><span>${esc(x.why)}</span></div></li>`).join('')}</ul>` : ''}
            <div class="sd-fb-row"><span class="label">参考</span><b lang="en">${esc(s.book)}</b></div>
            ${s.orig ? `<div class="sd-fb-row"><span class="label">原书</span><span><s lang="en">${esc(s.orig)}</s><span class="muted"> 已更正：${esc(s.why)}</span></span></div>` : ''}
            ${s.alt ? `<div class="sd-fb-row"><span class="label">也可以</span><span lang="en">${esc(s.alt)}</span></div>` : ''}
            ${s.note ? `<div class="sd-fb-row"><span class="label">注释</span><span>${esc(s.note)}</span></div>` : ''}</div>
            <div class="sk-actions"><span class="muted">对照参考，语法和用词都对才算写对</span><span class="spacer"></span>
              <button type="button" class="btn" data-act="s-grade" data-ok="0">${icon('x')}<span>有错误</span></button>
              <button type="button" class="btn primary" data-act="s-grade" data-ok="1">${icon('check')}<span>写对了</span></button></div>`
            : `<div class="sk-actions"><span class="spacer"></span><button type="button" class="btn primary" data-act="s-reveal">${icon('eye')}<span>对照参考</span></button></div>`}</div></div>`
    }
    const wrongN = SK.sentences.filter(s => st[s.no] && !st[s.no].lastOk).length
    const doneN = SK.sentences.filter(s => st[s.no] && st[s.no].lastOk).length
    const rows = sections.map((name, i) => {
      const list = SK.sentences.filter(s => s.section === name)
      const ok = list.filter(s => st[s.no] && st[s.no].lastOk).length
      return `<li class="sd-group"><div class="sd-gname"><b>${esc(name)}</b><span class="muted">${list.length} 句${ok ? ` · 写对 ${ok}` : ''}</span></div>
        <div class="sbar" role="img" aria-label="写对 ${ok} / ${list.length}"><span class="b-mastered" style="width:${(ok / list.length) * 100}%"></span></div>
        <button type="button" class="btn" data-act="s-start" data-kind="section" data-value="${i}">${icon('play')}<span>练习</span></button></li>`
    }).join('')
    const fixed = SK.sentences.filter(s => s.orig).length
    return `<div class="s-home">
      ${sRun ? `<div class="panel sd-sum-box"><div class="sd-sum-score"><b>${sRun.ok}</b><span>/ ${sRun.nos.length}</span></div><div><b>本次练完</b><div class="muted">写对 ${sRun.ok} 句</div></div></div>` : ''}
      <div class="sk-actions sd-quick"><button type="button" class="btn primary" data-act="s-start" data-kind="mixed">${icon('shuffle')}<span>随机 ${SENT_RUN} 句</span></button>
        <button type="button" class="btn" data-act="s-start" data-kind="wrong"${wrongN ? '' : ' disabled'}>${icon('book-x')}<span>写错的 ${wrongN}</span></button><span class="spacer"></span>
        <span class="muted">写对 ${doneN} / ${SK.sentences.length}</span></div>
      <ul class="sd-groups">${rows}</ul>
      <p class="sk-note">${icon('info')}<span>句子按语法结构分组，来自 my-ielts 整理的《雅思写作 100 句》。原书 ${fixed} 处参考译文有语法或用词错误，已更正并在答案里标出；“也可以”一栏的备选译文已逐句校对。</span></p></div>`
  }

  /* ---------- reference ---------- */

  function kitHtml() {
    const types = Object.values(W.types).map(t => `<div class="kit-card"><b>${esc(t.name)}</b><span class="muted" lang="en">${esc(t.ask)}</span><ol>${t.plan.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')
    const phrases = W.phrases.map(g => `<div class="kit-card"><b>${esc(g.group)}</b><ul lang="en">${g.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')
    const linkers = W.linkers.map(g => `<div class="kit-card"><b>${esc(g.fn)}</b><div class="chips">${g.items.map(x => `<span class="chip" lang="en">${esc(x)}</span>`).join('')}</div><span class="muted">${esc(g.note)}</span></div>`).join('')
    const errors = W.errors.map(x => `<li><s lang="en">${esc(x.wrong)}</s><b lang="en">${esc(x.right)}</b><span class="muted">${esc(x.why)}</span></li>`).join('')
    const crit = W.criteria.map(c => `<div class="kit-card"><b>${esc(c.name)}</b><ul>${c.checks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')
    return `<div class="kit">
      <h3 class="section-title">大作文五种题型的结构</h3><div class="kit-grid">${types}</div>
      <h3 class="section-title">小作文要点</h3><ul class="tips-plain">${W.task1Tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3 class="section-title">描述数据</h3><div class="kit-grid">${phrases}</div>
      <h3 class="section-title">连接词</h3><div class="kit-grid">${linkers}</div>
      <h3 class="section-title">常见错句</h3><ul class="kit-errors">${errors}</ul>
      <h3 class="section-title">四项评分标准</h3><div class="kit-grid">${crit}</div>
      <p class="sk-note">${icon('info')}<span>小作文的第一项是“任务完成 Task Achievement”，其余三项与大作文相同。各项分数的完整描述见官方评分标准。</span></p>
      <div class="sk-actions"><a class="btn" href="https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf" target="_blank" rel="noopener">${icon('external-link')}<span>官方写作评分标准（PDF）</span></a></div></div>`
  }

  /* ---------- page ---------- */

  function renderBody() {
    if (!body)
      return
    if (stopTick) {
      stopTick()
      stopTick = null
    }
    if (tab === 'sent') {
      body.innerHTML = sentHtml()
      return
    }
    if (tab === 'kit') {
      body.innerHTML = kitHtml()
      return
    }
    const task = tab === 'task1' ? 1 : 2
    const p = view === 'edit' && promptById(current)
    const e = view === 'review' && essays().find(x => x.id === reviewId)
    if (p && draft(p.id)) {
      body.innerHTML = editHtml(p)
      const d = draft(p.id)
      stopTick = K.ticker(body.querySelector('#w-clock'), clockStart(d), limitOf(p))
      return
    }
    if (e) {
      body.innerHTML = reviewHtml(e)
      return
    }
    view = 'list'
    body.innerHTML = listHtml(task)
  }

  function render() {
    tab = K.get('tab:writing', 'task1')
    if (!TABS.some(x => x.value === tab))
      tab = 'task1'
    // Reopen the essay that was being written when the app was closed.
    if (!current && K.get('wopen', '') && draft(K.get('wopen', ''))) {
      const p = promptById(K.get('wopen', ''))
      if (p) {
        current = p.id
        view = 'edit'
        tab = p.task === 2 ? 'task2' : 'task1'
        K.set('tab:writing', tab)
      }
    }
    root.innerHTML = `<div class="skill">${K.head('写作', '', K.tabs(TABS, tab))}<div class="sk-body"></div></div>`
    body = root.querySelector('.sk-body')
    if (view === 'edit' && current && draft(current) && !draft(current).since) {
      const d = draft(current)
      d.since = Date.now()
      K.set(`wdraft:${current}`, d)
    }
    renderBody()
  }

  function leave() {
    saveDraft()
    pause()
  }

  function onAct(name, el) {
    switch (name) {
      case 'sub':
        leave()
        K.set('wopen', '')
        view = 'list'
        sRun = null
        K.set('tab:writing', el.dataset.value)
        return render()
      case 'w-open': return open(el.dataset.id)
      case 'w-back':
        if (view === 'edit') {
          saveDraft()
          pause()
        }
        K.set('wopen', '')
        view = 'list'
        return renderBody()
      case 'w-plan': {
        saveDraft()
        showPlan = !showPlan
        const ta = body.querySelector('#w-text')
        const pos = ta ? ta.selectionStart : 0
        renderBody()
        const again = body.querySelector('#w-text')
        if (again)
          again.setSelectionRange(pos, pos)
        return
      }
      case 'w-submit': return submit()
      case 'w-review': {
        const e = essays().find(x => x.id === el.dataset.id)
        if (!e)
          return
        if (view === 'edit')
          leave()
        reviewId = e.id
        view = 'review'
        renderBody()
        return window.scrollTo(0, 0)
      }
      case 'w-rewrite': {
        const e = essays().find(x => x.id === el.dataset.id)
        const d = draft(e.pid)
        if (d && d.text.trim() && !window.confirm('这道题已有一份草稿，用这篇的内容替换它？'))
          return
        K.set(`wdraft:${e.pid}`, { text: e.text, acc: 0, since: null })
        return open(e.pid)
      }
      case 's-start': return sStart(el.dataset.kind, el.dataset.value)
      case 's-reveal': return sReveal()
      case 's-grade': return sGrade(el.dataset.ok === '1')
      case 's-quit':
        sRun = null
        return renderBody()
    }
  }

  V.pages = V.pages || {}
  V.pages.writing = {
    mount(el) {
      root = el
      // Backgrounding the app pauses the essay clock; coming back resumes it.
      document.addEventListener('visibilitychange', () => {
        if (view !== 'edit' || !current || !V.isView('writing'))
          return
        if (document.visibilityState === 'hidden') {
          saveDraft()
          pause()
          return
        }
        const d = draft(current)
        const clock = body && body.querySelector('#w-clock')
        if (!d || d.since || !clock)
          return
        d.since = Date.now()
        K.set(`wdraft:${current}`, d)
        if (stopTick)
          stopTick()
        stopTick = K.ticker(clock, clockStart(d), limitOf(promptById(current)))
      })
      K.wire(el, {
        onAct,
        onChange(e) {
          const el = e.target
          if (el.dataset.act === 'w-self') {
            const all = essays()
            const es = all.find(x => x.id === reviewId)
            if (!es)
              return
            const list = es.self[el.dataset.k] || []
            list[Number(el.dataset.i)] = el.checked
            es.self[el.dataset.k] = list
            K.set('wessays', all)
          }
        },
        onInput(e) {
          if (e.target.id === 'w-text') {
            const c = body.querySelector('#w-count')
            if (c)
              c.textContent = CHECK.countWords(e.target.value)
            clearTimeout(saveTimer)
            saveTimer = setTimeout(saveDraft, 400)
          }
        },
        onKeydown(e) {
          if (e.target.id === 's-answer' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !sShown) {
            e.preventDefault()
            sReveal()
          }
        },
      })
    },
    render,
    leave,
    open(sub) {
      K.set('tab:writing', sub)
      view = 'list'
    },
  }
})()
