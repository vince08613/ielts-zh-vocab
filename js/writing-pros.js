/* 写作 · 利弊类: the 3S pros-and-cons handout. Paragraph templates, five model essays with
   paragraph roles, key phrases, corrections and a recall mode that blanks the key phrases,
   the handout notes, and a drill on the templates and sentence patterns. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const P = window.PROS_CONS
  if (!P)
    return
  const CHECK = V.writingCheck
  const SUBS = [
    { value: 'structure', label: '结构模板' }, { value: 'essays', label: '范文 5 篇' },
    { value: 'notes', label: '讲义笔记' }, { value: 'drill', label: '句型练习' },
  ]

  let essayId = ''
  let recall = false
  let shown = new Set()
  let run = null // { list, pos, res, typed, ok, retried }

  const sub = () => K.get('pc:sub', 'structure')
  const norm = s => String(s || '').toLowerCase().replace(/[‘’]/g, '\'').replace(/n't\b/g, ' not').replace(/\bcan not\b/g, 'cannot').replace(/[.,!?;:"]/g, ' ').replace(/\s+/g, ' ').trim()
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  function planHtml() {
    return `<ol class="w-plan">${P.structure.map(s => `<li><b>${esc(s.name)}</b>（约 ${s.words} 词）：${esc(s.role)}<br><span class="muted" lang="en">${esc(s.groups.flatMap(g => g.items).slice(0, 2).join('  ·  '))}</span></li>`).join('')}</ol>`
  }

  function structureHtml() {
    const cards = P.structure.map(s => `<section class="pc-card"><div class="pc-card-head"><b>${esc(s.name)}</b><span class="tag">约 ${s.words} 词</span></div><p class="muted">${esc(s.role)}</p>
      ${s.groups.map(g => `<div class="pc-group"><span class="label">${esc(g.label)}</span><ul lang="en">${g.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</section>`).join('')
    const prompts = P.essays.map(e => `<li class="sh-row"><div class="sh-name"><b>${esc(e.title)}</b><span class="muted" lang="en">${esc(e.prompt)}</span></div>
      <div class="row-actions"><button type="button" class="btn" data-act="p-essay" data-id="${e.id}">${icon('book-open')}<span>范文</span></button>
      <button type="button" class="btn primary" data-act="p-write" data-id="${e.id}">${icon('pen-line')}<span>按模板写</span></button></div></li>`).join('')
    return `<div class="pc-grid">${cards}</div>
      <h3 class="section-title">用这个结构写一篇</h3><ul class="sh-list">${prompts}</ul>
      <p class="sk-note">${icon('info')}<span>“按模板写”打开大作文编辑器，计时 40 分钟，结构提示默认展开；提交后有自动检查。这 5 道题也在“大作文”题库里。</span></p>`
  }

  function markEssay(text, fixes, pi) {
    // Mark corrections first (by position), then key phrases in the remaining text.
    const spans = []
    for (const [wrong] of fixes) {
      const at = text.indexOf(wrong)
      if (at >= 0)
        spans.push({ s: at, e: at + wrong.length, fix: wrong })
    }
    for (const h of P.highlight) {
      const re = new RegExp(`\\b${escRe(h)}\\b`, 'g')
      let m
      while ((m = re.exec(text))) {
        const s = m.index
        const e = s + m[0].length
        if (!spans.some(x => s < x.e && e > x.s))
          spans.push({ s, e, hl: true })
      }
    }
    spans.sort((a, b) => a.s - b.s)
    let out = ''
    let i = 0
    let n = 0
    for (const sp of spans) {
      out += esc(text.slice(i, sp.s))
      const seg = text.slice(sp.s, sp.e)
      if (sp.fix) {
        const f = fixes.find(x => x[0] === sp.fix)
        out += `<span class="pc-fix" title="${esc(`${f[1]}：${f[2]}`)}">${esc(seg)}</span>`
      }
      else if (recall) {
        const key = `${essayId}:${pi}:${sp.s}`
        n++
        out += shown.has(key) ? `<mark class="pc-hl">${esc(seg)}</mark>` : `<button type="button" class="pc-blank" data-act="p-reveal" data-k="${key}" title="点一下看答案">${'_'.repeat(Math.min(14, Math.max(4, seg.length)))}</button>`
      }
      else {
        out += `<mark class="pc-hl">${esc(seg)}</mark>`
      }
      i = sp.e
    }
    return out + esc(text.slice(i))
  }

  function essayHtml(e) {
    const words = CHECK.countWords(e.paras.map(p => p[1]).join('\n'))
    return `<div class="pc-essay">
      <div class="rd-bar"><button type="button" class="btn ghost" data-act="p-back">${icon('chevron-left')}<span>返回</span></button><span class="tag">${esc(e.title)}</span><span class="muted">${words} 词</span><span class="spacer"></span>
        <button type="button" class="btn ghost" data-act="p-recall" aria-pressed="${recall}" title="把高亮的句型挖空，先自己说出来再点开">${icon(recall ? 'eye' : 'eye-off')}<span>${recall ? '显示全文' : '挖空复述'}</span></button>
        <button type="button" class="btn primary" data-act="p-write" data-id="${e.id}">${icon('pen-line')}<span>写这道题</span></button></div>
      <div class="panel w-prompt"><p lang="en">${esc(e.prompt)}</p></div>
      <div class="pc-paras">${e.paras.map(([role, text], pi) => `<div class="pc-para"><span class="pc-role r-${role}">${esc(P.roles[role])}</span><p lang="en">${markEssay(text, e.fixes, pi)}</p><span class="muted pc-wc">${CHECK.countWords(text)} 词</span></div>`).join('')}</div>
      ${e.fixes.length ? `<h3 class="section-title">范文里需要改的地方</h3><ul class="kit-errors">${e.fixes.map(f => `<li><s lang="en">${esc(f[0])}</s><b lang="en">${esc(f[1])}</b><span class="muted">${esc(f[2])}</span></li>`).join('')}</ul>` : ''}
      <h3 class="section-title">要点</h3><ul class="tips-plain">${e.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      <p class="sk-note">${icon('info')}<span>高亮的是可以直接借用的结构词和句型；虚线标出的是范文的错误，悬停或看下方列表。范文用来学结构和逻辑，不要整篇背诵。</span></p></div>`
  }

  function essaysHtml() {
    if (essayId) {
      const e = P.essays.find(x => x.id === essayId)
      if (e)
        return essayHtml(e)
    }
    return `<ul class="sh-list">${P.essays.map(e => `<li class="sh-row"><div class="sh-name"><b>${esc(e.title)}</b><span class="muted">${e.paras.map(p => P.roles[p[0]]).join(' → ')} · ${CHECK.countWords(e.paras.map(p => p[1]).join(' '))} 词 · ${e.fixes.length} 处更正</span></div>
      <div class="row-actions"><button type="button" class="btn primary" data-act="p-essay" data-id="${e.id}">${icon('book-open')}<span>阅读</span></button></div></li>`).join('')}</ul>`
  }

  function notesHtml() {
    return `<div class="kit-grid">${P.notes.map(n => `<div class="kit-card"><b>${esc(n.title)}</b><ul lang="en">${n.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="sk-note">${icon('info')}<span>讲义里 remeber 应为 remember；“I still remember the day when he robbed my backpack”中 rob 的宾语是人或地方（rob sb / rob a bank），抢东西用 take / steal，已在笔记里改正。</span></p>`
  }

  /* ---------- drill ---------- */

  function startDrill(cat) {
    const list = K.shuffle(P.drills.filter(d => !cat || d.cat === cat))
    run = { list, pos: 0, res: null, typed: '', ok: 0, retried: new Set() }
  }

  function check(body) {
    const inp = body.querySelector('#p-answer')
    const val = inp ? inp.value.trim() : ''
    if (!val)
      return inp && inp.focus()
    const d = run.list[run.pos]
    const ok = d.a.some(a => norm(a) === norm(val))
    run.typed = val
    run.res = { ok }
    const st = K.get('pcstats', {})
    const x = st[d.cat] || { n: 0, ok: 0 }
    x.n++
    if (ok)
      x.ok++
    st[d.cat] = x
    K.set('pcstats', st)
    if (ok && !d.retry)
      run.ok++
    if (!ok && !run.retried.has(d)) {
      run.retried.add(d)
      run.list.splice(Math.min(run.list.length, run.pos + 4), 0, Object.assign({}, d, { retry: true }))
    }
    render(body)
  }

  function drillHtml() {
    if (run && run.pos < run.list.length) {
      const d = run.list[run.pos]
      const res = run.res
      return `<div class="sd-run pc-drill">
        <div class="sd-top"><span class="tag">${esc(P.drillCats[d.cat])}</span>${d.retry ? '<span class="tag warn">再做一次</span>' : ''}<span class="muted sd-count">${run.pos + 1} / ${run.list.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="p-quit">${icon('x')}<span>结束</span></button></div>
        <div class="sd-q panel"><p class="gd-prompt" lang="en">${esc(d.q)}</p>
          <input id="p-answer" class="text-input gd-input wide" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="${d.cat === 'tpl' || d.cat === 'syn' ? 'off' : 'sentences'}" spellcheck="false" value="${esc(run.typed)}"${res ? ' readonly' : ''} placeholder="${d.cat === 'tpl' ? '填空格里的词' : '写出答案'}">
        ${res ? `<div class="sd-fb ${res.ok ? 'is-right' : 'is-wrong'}"><div class="sd-fb-row"><b>${res.ok ? '正确' : '不对'}</b></div>
            <div class="sd-fb-row"><span class="label">${res.ok && d.a.length > 1 ? '也可以' : '答案'}</span><span lang="en">${esc(d.a.slice(0, 4).join(' / '))}</span></div></div>` : ''}
          <div class="sk-actions"><span class="spacer"></span>${res ? `<button type="button" class="btn primary" data-act="p-next">${icon('arrow-right')}<span>下一题</span></button>` : `<button type="button" class="btn primary" data-act="p-check">${icon('send')}<span>提交</span></button>`}</div></div></div>`
    }
    const st = K.get('pcstats', {})
    const done = run && run.pos >= run.list.length ? `<div class="panel sd-sum-box"><div class="sd-sum-score"><b>${run.ok}</b><span>/ ${run.list.filter(d => !d.retry).length}</span></div><div><b>本组完成</b><div class="muted">第一次就答对 ${run.ok} 题</div></div></div>` : ''
    const cats = Object.entries(P.drillCats).map(([k, name]) => {
      const n = P.drills.filter(d => d.cat === k).length
      const s = st[k]
      return `<li class="sd-group"><div class="sd-gname"><b>${esc(name)}</b><span class="muted">${n} 题${s ? ` · 正确率 ${K.pct(s.ok, s.n)}` : ''}</span></div><span></span>
        <button type="button" class="btn" data-act="p-drill" data-cat="${k}">${icon('play')}<span>练习</span></button></li>`
    }).join('')
    return `<div class="s-home">${done}<div class="sk-actions sd-quick"><button type="button" class="btn primary" data-act="p-drill" data-cat="">${icon('shuffle')}<span>全部 ${P.drills.length} 题</span></button></div><ul class="sd-groups">${cats}</ul></div>`
  }

  function render(body) {
    const s = sub()
    const seg = V.seg('p-sub', SUBS, s)
    let inner = ''
    if (s === 'structure')
      inner = structureHtml()
    else if (s === 'essays')
      inner = essaysHtml()
    else if (s === 'notes')
      inner = notesHtml()
    else
      inner = drillHtml()
    body.innerHTML = `<div class="pc"><div class="pc-subs">${seg}</div>${inner}</div>`
    const inp = body.querySelector('#p-answer')
    if (inp && run && !run.res)
      inp.focus({ preventScroll: true })
    else if (run && run.res) {
      const nx = body.querySelector('[data-act="p-next"]')
      if (nx)
        nx.focus({ preventScroll: true })
    }
  }

  function act(name, el, body) {
    switch (name) {
      case 'p-essay':
        K.set('pc:sub', 'essays')
        essayId = el.dataset.id
        shown = new Set()
        render(body)
        return window.scrollTo(0, 0)
      case 'p-back':
        essayId = ''
        return render(body)
      case 'p-recall':
        recall = !recall
        shown = new Set()
        return render(body)
      case 'p-reveal':
        shown.add(el.dataset.k)
        return render(body)
      case 'p-write':
        return { write: el.dataset.id }
      case 'p-drill':
        startDrill(el.dataset.cat)
        return render(body)
      case 'p-check':
        return check(body)
      case 'p-next':
        run.pos++
        run.res = null
        run.typed = ''
        return render(body)
      case 'p-quit':
        run = null
        return render(body)
    }
  }

  function onSeg(value, body) {
    K.set('pc:sub', value)
    essayId = ''
    render(body)
  }

  function onKeydown(e, body) {
    if (e.target.id !== 'p-answer' || e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || !run)
      return
    e.preventDefault()
    act(run.res ? 'p-next' : 'p-check', e.target, body)
  }

  V.prosCons = { render, act, onSeg, onKeydown, planHtml, current: () => (run && run.pos < run.list.length ? run.list[run.pos] : null) }
})()
