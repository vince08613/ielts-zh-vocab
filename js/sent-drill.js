/* 写作 · 100 句翻译: the learner types the English and js/translate-check.js marks it
   (meaning points, grammar, spelling, known traps). A sentence written wrong comes back
   later in the same run; every sentence is then reviewed on a spaced schedule. A hint or
   a correction after seeing the result does not count as writing it independently. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const TC = V.translateCheck
  const SK = window.SKILLS_DATA || { sentences: [], spelling: [] }
  const KEYS = window.SENT_KEYS || { macros: {}, keys: {}, traps: {} }
  const RUN = 5
  const DAY = 864e5
  const STEPS = [1, 3, 7, 15, 30, 60] // days until the next review after each correct attempt
  TC.setMacros(KEYS.macros)
  TC.setSpelling(SK.spelling)

  let dictP = null
  /** The spelling list (data/dict-en.js, about 1 MB) loads on first use. */
  V.loadDict = () => {
    if (TC.hasDict())
      return Promise.resolve(true)
    if (window.EN_DICT) {
      TC.setDict(window.EN_DICT)
      return Promise.resolve(true)
    }
    if (!dictP) {
      dictP = new Promise((resolve) => {
        const s = document.createElement('script')
        s.src = 'data/dict-en.js'
        s.onload = () => {
          if (window.EN_DICT)
            TC.setDict(window.EN_DICT)
          resolve(!!window.EN_DICT)
        }
        s.onerror = () => {
          dictP = null
          resolve(false)
        }
        document.head.appendChild(s)
      })
    }
    return dictP
  }

  const sections = [...new Set(SK.sentences.map(s => s.section))]
  const byNo = no => SK.sentences.find(s => s.no === no)
  // Records from the earlier self-graded version have no review date: due one day after the last try.
  const stats = () => {
    const all = K.get('sentstats', {})
    for (const x of Object.values(all)) {
      if (x && x.n && !x.due) {
        x.due = (x.at || Date.now()) + (x.lastOk ? DAY : 0)
        x.lvl = x.lastOk ? Math.max(1, x.lvl || 0) : 0
      }
    }
    return all
  }
  const accepted = () => K.get('sentaccept', {})
  const isDue = (x, now) => x && x.n && x.due && x.due <= now
  const VERDICT = { right: ['正确', 'circle-check'], close: ['基本正确', 'circle-check'], wrong: ['有错误', 'circle-x'] }

  function itemOf(s) {
    return {
      refs: (KEYS.refs && KEYS.refs[s.no] ? KEYS.refs[s.no] : [s.book]).concat(s.alt ? [s.alt] : []),
      keys: KEYS.keys[s.no] || [],
      traps: (KEYS.traps[s.no] || []).map(t => (Array.isArray(t) ? t : [t, s.why || '原书这里有错误，对照参考译文。'])),
      accepted: accepted()[s.no] || [],
    }
  }

  V.sentDrill = function () {
    let run = null // { nos, pos, seen: Set(pos), firstOk, wrongNos, hint, typed, res, requeued: Set }

    function record(no, ok, hinted) {
      const all = stats()
      const x = Object.assign({ n: 0, ok: 0, wrong: 0, hint: 0, lvl: 0, due: 0, at: 0, lastOk: false }, all[no])
      const now = Date.now()
      x.n++
      x.at = now
      if (ok && !hinted) {
        x.ok++
        x.lastOk = true
        // Practising before the review date is recorded but does not move the schedule.
        if (!x.due || x.due <= now) {
          x.lvl = Math.min(x.lvl + 1, STEPS.length)
          x.due = now + STEPS[x.lvl - 1] * DAY
        }
        else {
          x.early = (x.early || 0) + 1
        }
      }
      else {
        if (hinted)
          x.hint++
        else
          x.wrong++
        x.lastOk = false
        x.lvl = 0
        x.due = now
      }
      all[no] = x
      K.set('sentstats', all)
    }

    function start(kind, value) {
      const st = stats()
      const now = Date.now()
      let list = []
      if (kind === 'section')
        list = SK.sentences.filter(s => s.section === sections[Number(value)])
      else if (kind === 'wrong')
        list = SK.sentences.filter(s => st[s.no] && !st[s.no].lastOk)
      else if (kind === 'due')
        list = SK.sentences.filter(s => isDue(st[s.no], now) && st[s.no].lastOk)
      else if (kind === 'one')
        list = [byNo(Number(value))]
      else
        list = K.shuffle(SK.sentences.filter(s => !st[s.no] || !st[s.no].lastOk || isDue(st[s.no], now))).slice(0, RUN)
      list = list.filter(Boolean)
      if (!list.length)
        return V.toast('没有可练的句子')
      run = { nos: list.map(s => s.no), pos: 0, seen: new Set(), firstOk: 0, first: new Set(), wrongNos: [], hint: false, typed: '', res: null, requeued: new Set() }
      V.loadDict()
      return true
    }

    async function submit(root) {
      const ta = root.querySelector('#s-answer')
      const text = ta ? ta.value.trim() : ''
      if (!text) {
        if (ta)
          ta.focus()
        return false
      }
      await V.loadDict()
      const no = run.nos[run.pos]
      const s = byNo(no)
      const res = TC.check(text, itemOf(s))
      const firstHere = !run.seen.has(run.pos)
      run.typed = text
      run.res = res
      if (firstHere) {
        run.seen.add(run.pos)
        const ok = res.verdict !== 'wrong'
        record(no, ok, run.hint)
        run.counted = { ok: ok && !run.hint, hinted: run.hint }
        if (!run.first.has(no)) {
          run.first.add(no)
          if (ok && !run.hint)
            run.firstOk++
          else
            run.wrongNos.push(no)
        }
        // Not written independently: it comes back after a few other sentences.
        if ((!ok || run.hint) && !run.requeued.has(no)) {
          run.requeued.add(no)
          run.nos.splice(Math.min(run.nos.length, run.pos + 4), 0, no)
        }
        if (V.daily)
          V.daily.mark('sent', 1)
      }
      return true
    }

    /** "算我对": the checker was too strict. The wording is remembered for this sentence. */
    function override() {
      const no = run.nos[run.pos]
      const all = accepted()
      all[no] = [...new Set([...(all[no] || []), run.typed])].slice(-8)
      K.set('sentaccept', all)
      if (run.counted && !run.counted.ok && !run.counted.hinted) {
        const st = stats()
        const x = st[no]
        x.wrong = Math.max(0, x.wrong - 1)
        x.ok++
        x.lastOk = true
        x.lvl = Math.min((x.lvl || 0) + 1, STEPS.length)
        x.due = Date.now() + STEPS[x.lvl - 1] * DAY
        x.override = (x.override || 0) + 1
        st[no] = x
        K.set('sentstats', st)
        run.counted.ok = true
        if (run.wrongNos.includes(no) && run.nos.indexOf(no) === run.pos) {
          run.wrongNos = run.wrongNos.filter(n => n !== no)
          run.firstOk++
        }
        // Drop the retry that was queued for it.
        const later = run.nos.indexOf(no, run.pos + 1)
        if (later > 0)
          run.nos.splice(later, 1)
      }
      run.res = Object.assign({}, run.res, { verdict: 'right', overridden: true })
    }

    function next() {
      run.pos++
      run.hint = false
      run.typed = ''
      run.res = null
      run.counted = null
    }

    /* ---------- views ---------- */

    function markedAnswer(res) {
      const marks = res.marks.filter(m => m.cls !== 'extra')
      return TC.spans(res.text, marks).map(sp => (sp.cls.length ? `<span class="${sp.cls.map(c => `tc-${c}`).join(' ')}">${esc(sp.t)}</span>` : esc(sp.t))).join('')
    }

    function refHtml(res) {
      if (!res.ref)
        return ''
      return TC.spans(res.ref, res.refMarks.filter(m => m.miss).map(m => ({ s: m.s, e: m.e, cls: 'miss' }))).map(sp => (sp.cls.length ? `<span class="tc-miss">${esc(sp.t)}</span>` : esc(sp.t))).join('')
    }

    function resultHtml(s, res) {
      const [label, ic] = VERDICT[res.verdict]
      const by = k => res.issues.filter(x => x.kind === k)
      const spell = by('spell').map(x => `<li><span class="tag bad">拼写</span><div><b lang="en">${esc(x.word)}</b>${x.fix ? `<span class="muted">可能是：<span lang="en">${esc(x.fix)}</span></span>` : '<span class="muted">词典里没有这个词</span>'}</div></li>`)
      const gram = by('grammar').map(x => `<li><span class="tag ${x.level === 'error' ? 'bad' : 'warn'}">${x.trap ? '易错' : '语法'}</span><div><span>${esc(x.msg)}</span>${x.fix ? `<span class="muted" lang="en">${esc(x.fix)}</span>` : ''}</div></li>`)
      const miss = res.keys.filter(k => !k.ok && !k.opt).map(k => k.zh)
      const opt = res.keys.filter(k => !k.ok && k.opt).map(k => k.zh)
      const meaning = by('meaning').filter(x => !x.zh).map(x => `<li><span class="tag bad">意思</span><div><span>${esc(x.msg)}</span></div></li>`)
      const tips = res.issues.filter(x => x.level === 'tip' && !x.zh).map(x => `<li><span class="tag">提示</span><div><span>${esc(x.msg)}</span></div></li>`)
      const keys = res.keys.length ? `<div class="tc-keys">${res.keys.map(k => `<span class="chip ${k.ok ? 'c-ok' : k.opt ? '' : 'c-miss'}">${k.ok ? icon('check') : ''}${esc(k.zh)}${k.opt ? '（可选）' : ''}</span>`).join('')}</div>` : ''
      return `<div class="tc-result ${res.verdict}">
        <div class="tc-verdict">${icon(ic)}<b>${label}</b>${res.overridden ? '<span class="muted">已按你的判断记为正确</span>' : `<span class="muted">要点 ${res.keysOk} / ${res.keysTotal}</span>`}</div>
        <div class="tc-ans" lang="en">${markedAnswer(res)}</div>
        ${keys}
        ${miss.length ? `<p class="tc-line"><span class="label">漏译</span><span>${miss.map(esc).join('、')}</span></p>` : ''}
        ${spell.length || gram.length || meaning.length ? `<ul class="w-pats tc-issues">${[...meaning, ...spell, ...gram].join('')}</ul>` : ''}
        ${tips.length ? `<ul class="w-pats tc-issues tips">${tips.join('')}</ul>` : ''}
        ${opt.length ? `<p class="tc-line muted"><span class="label">可补充</span><span>${opt.map(esc).join('、')}</span></p>` : ''}
      </div>
      <div class="s-ref">
        <div class="sd-fb-row"><span class="label">参考</span><span lang="en" class="tc-refline">${refHtml(res)}</span></div>
        ${res.ref !== s.book ? `<div class="sd-fb-row"><span class="label">原书</span><span lang="en">${esc(s.book)}</span></div>` : ''}
        ${s.alt && res.ref !== s.alt ? `<div class="sd-fb-row"><span class="label">也可以</span><span lang="en">${esc(s.alt)}</span></div>` : ''}
        ${s.orig ? `<div class="sd-fb-row"><span class="label">勘误</span><span><s lang="en">${esc(s.orig)}</s><span class="muted"> ${esc(s.why)}</span></span></div>` : ''}
        ${s.note ? `<div class="sd-fb-row"><span class="label">注释</span><span>${esc(s.note)}</span></div>` : ''}
      </div>`
    }

    function hintHtml(s) {
      const keys = (KEYS.keys[s.no] || []).map(k => TC.parseKey(k))
      const firsts = [...new Set((s.book.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []).filter(w => !/^(that|this|with|from|have|they|their|which|there|been|more|some|those)$/i.test(w)).slice(0, 4))]
      return `<div class="tc-hint"><span class="label">要译出</span><span>${keys.filter(k => !k.opt).map(k => esc(k.zh)).join(' · ')}</span></div>
        <div class="tc-hint"><span class="label">关键词</span><span lang="en">${firsts.map(w => `${esc(w.slice(0, 2))}${'_'.repeat(Math.min(6, w.length - 2))}`).join('  ')}</span></div>`
    }

    function runHtml() {
      const no = run.nos[run.pos]
      const s = byNo(no)
      const again = run.nos.indexOf(no) < run.pos
      const res = run.res
      return `<div class="sd-run">
        <div class="sd-top"><span class="tag">${esc(s.section)}</span>${again ? '<span class="tag warn">重练</span>' : ''}<span class="muted sd-count">${run.pos + 1} / ${run.nos.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="s-quit">${icon('x')}<span>结束</span></button></div>
        <div class="sd-q panel"><div class="s-zh"><b>${s.no}</b><span>${esc(s.zh)}</span></div>
          <textarea id="s-answer" class="text-area s-answer" rows="3" lang="en" spellcheck="false" autocorrect="off" autocapitalize="sentences" placeholder="English translation">${esc(run.typed)}</textarea>
          ${!res && run.hint ? hintHtml(s) : ''}
          ${res ? resultHtml(s, res) : ''}
          <div class="sk-actions">
            ${res ? `<span class="muted">${run.counted && run.counted.hinted ? '用了提示，这次不算独立写对' : res.verdict === 'wrong' && !res.overridden ? '改好后可以再交一次检查，记录按第一次算' : ''}</span><span class="spacer"></span>
              ${res.verdict === 'wrong' && !res.overridden ? `<button type="button" class="btn ghost" data-act="s-override" title="判错了：我的译文也对">${icon('check-check')}<span>算我对</span></button>` : ''}
              <button type="button" class="btn" data-act="s-check">${icon('rotate-ccw')}<span>再检查</span></button>
              <button type="button" class="btn primary" data-act="s-next">${icon('arrow-right')}<span>下一句</span></button>`
            : `<span class="spacer"></span><button type="button" class="btn ghost" data-act="s-hint"${run.hint ? ' disabled' : ''}>${icon('lightbulb')}<span>提示</span></button>
              <button type="button" class="btn primary" data-act="s-check">${icon('send')}<span>提交</span></button>`}
          </div></div></div>`
    }

    function homeHtml() {
      const st = stats()
      const now = Date.now()
      const wrongN = SK.sentences.filter(s => st[s.no] && !st[s.no].lastOk).length
      const dueN = SK.sentences.filter(s => isDue(st[s.no], now) && st[s.no].lastOk).length
      const doneN = SK.sentences.filter(s => st[s.no] && st[s.no].lastOk).length
      const seenN = SK.sentences.filter(s => st[s.no] && st[s.no].n).length
      const rows = sections.map((name, i) => {
        const list = SK.sentences.filter(s => s.section === name)
        const ok = list.filter(s => st[s.no] && st[s.no].lastOk).length
        return `<li class="sd-group"><div class="sd-gname"><b>${esc(name)}</b><span class="muted">${list.length} 句${ok ? ` · 写对 ${ok}` : ''}</span></div>
          <div class="sbar" role="img" aria-label="写对 ${ok} / ${list.length}"><span class="b-mastered" style="width:${(ok / list.length) * 100}%"></span></div>
          <button type="button" class="btn" data-act="s-start" data-kind="section" data-value="${i}">${icon('play')}<span>练习</span></button></li>`
      }).join('')
      const sum = run && run.pos >= run.nos.length
        ? `<div class="panel sd-sum-box"><div class="sd-sum-score"><b>${run.firstOk}</b><span>/ ${run.first.size}</span></div><div><b>本次练完</b><div class="muted">第一次就写对 ${run.firstOk} 句${run.wrongNos.length ? `，${run.wrongNos.length} 句已安排复习：${run.wrongNos.join('、')}` : ''}</div></div></div>`
        : ''
      return `<div class="s-home">${sum}
        <div class="sk-actions sd-quick"><button type="button" class="btn primary" data-act="s-start" data-kind="mixed">${icon('shuffle')}<span>随机 ${RUN} 句</span></button>
          <button type="button" class="btn" data-act="s-start" data-kind="due"${dueN ? '' : ' disabled'}>${icon('calendar-clock')}<span>到期复习 ${dueN}</span></button>
          <button type="button" class="btn" data-act="s-start" data-kind="wrong"${wrongN ? '' : ' disabled'}>${icon('book-x')}<span>没写对的 ${wrongN}</span></button><span class="spacer"></span>
          <span class="muted">写对 ${doneN} · 练过 ${seenN} / ${SK.sentences.length}</span></div>
        <ul class="sd-groups">${rows}</ul>
        <p class="sk-note">${icon('info')}<span>提交后自动判分：逐条核对中文的意思要点（同义说法都算），检查拼写和常见语法错误，并标出和参考译文的差别。判断不了的说法可以点“算我对”，以后同样的写法直接算对。写错的句子会在本组后面再出现一次，写对后按 1、3、7、15、30、60 天复习，没到复习日期提前练不会推进间隔。</span></p></div>`
    }

    function render(body) {
      body.innerHTML = run && run.pos < run.nos.length ? runHtml() : homeHtml()
      const ta = body.querySelector('#s-answer')
      if (ta && !run.res)
        ta.focus({ preventScroll: true })
    }

    async function act(name, el, body) {
      switch (name) {
        case 's-start':
          if (start(el.dataset.kind, el.dataset.value))
            render(body)
          return
        case 's-hint':
          run.typed = (body.querySelector('#s-answer') || {}).value || ''
          run.hint = true
          return render(body)
        case 's-check':
          if (await submit(body))
            render(body)
          return
        case 's-override':
          override()
          return render(body)
        case 's-next':
          next()
          return render(body)
        case 's-quit':
          run = null
          return render(body)
      }
    }

    function onKeydown(e, body) {
      if (e.target.id !== 's-answer' || e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229)
        return
      e.preventDefault()
      if (run.res && e.target.value.trim() === run.typed)
        act('s-next', null, body)
      else
        act('s-check', null, body)
    }

    return { render, act, onKeydown, start, active: () => !!(run && run.pos < run.nos.length), reset: () => { run = null } }
  }
})()
