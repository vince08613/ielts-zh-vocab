/* Synonym-replacement drill shared by the 听力 179 and 阅读 538 wordbooks.
   Answers stay hidden until submitted. A missed word comes back a few items later in the same
   run, but only the first answer of a run counts toward "掌握", so copying a just-seen answer
   never marks a word as known. The next item appears straight after submitting, with the
   previous result shown above it. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const K = V.kit
  const A = V.answers

  const MODES = {
    listen: { label: '听音写词和替换', icon: 'headphones' },
    word: { label: '看词写替换', icon: 'arrow-right' },
    reverse: { label: '看替换写词', icon: 'arrow-left' },
  }
  const BATCH = 20
  const RETRY_GAP = 4
  const RETRY_MAX = 2

  /** Replacements that must be written to pass: all of 1-2, two of 3-4, three of 5 or more. */
  const need = n => (n <= 2 ? n : n <= 4 ? 2 : 3)

  V.synDrill = (o) => {
    // o: { key, chapter, modes, groupName(i), daily }
    const words = V.chapterWords[o.chapter]
    const groups = []
    for (const w of words)
      (groups[w.group] = groups[w.group] || []).push(w)
    let view = 'drill'
    let root = null
    let query = ''
    let last = null
    let summary = null

    const sk = `syn:${o.key}`
    const stats = () => K.get(sk, {})
    const cfg = () => {
      const c = Object.assign({ mode: o.modes[0] }, K.get(`syncfg:${o.key}`, {}))
      if (!o.modes.includes(c.mode))
        c.mode = o.modes[0]
      return c
    }
    const run = () => K.get(`synrun:${o.key}`, null)
    const saveRun = r => K.set(`synrun:${o.key}`, r)
    const mastered = (st, w) => !!(st[w.uid] && st[w.uid].lastOk)

    function rerender() {
      if (root && root.isConnected)
        render(root)
    }

    /* ---------- choosing words ---------- */

    function pickFrom(list, n) {
      const st = stats()
      const todo = list.filter(w => !mastered(st, w))
      const done = list.filter(w => mastered(st, w)).sort((a, b) => st[a.uid].last - st[b.uid].last)
      return todo.concat(done).slice(0, n)
    }

    function start(kind, value) {
      const st = stats()
      let list = []
      let label = ''
      if (kind === 'group') {
        const g = Number(value)
        list = groups[g].length > BATCH ? pickFrom(groups[g], BATCH) : groups[g].slice()
        label = o.groupName(g)
      }
      else if (kind === 'wrong') {
        list = words.filter(w => st[w.uid] && !st[w.uid].lastOk).sort((a, b) => st[b.uid].wrong - st[a.uid].wrong).slice(0, BATCH)
        label = '错题'
      }
      else if (kind === 'uids') {
        list = value.map(u => V.byUid[u]).filter(Boolean)
        label = '再练错的'
      }
      else {
        list = K.shuffle(pickFrom(K.shuffle(words), BATCH))
        label = `随机 ${BATCH} 个`
      }
      if (!list.length)
        return V.toast('没有可练的词')
      const c = cfg()
      saveRun({ active: true, mode: c.mode, label, kind, group: kind === 'group' ? Number(value) : null, queue: list.map(w => w.uid), pos: 0, first: {}, retry: {}, started: Date.now() })
      last = null
      summary = null
      rerender()
      afterRender(true)
    }

    /* ---------- judging ---------- */

    function judge(w, mode, wordTyped, synTyped) {
      const r = { wordOk: true, hit: [], miss: [], extra: [], need: 0, also: '' }
      if (mode !== 'word') {
        const t = A.norm(wordTyped)
        r.word = wordTyped
        r.wordOk = !!t && w.words.some(x => A.match(t, x))
        if (!r.wordOk && t && mode === 'reverse') {
          // Another keyword tested with the same replacements is also a right answer.
          const want = w.syn.map(K.normSyn)
          const other = words.find(x => x !== w && x.words.some(y => A.match(t, y)) && want.every(s => x.syn.map(K.normSyn).includes(s)))
          if (other) {
            r.wordOk = true
            r.also = other.words[0]
          }
        }
      }
      if (mode !== 'reverse') {
        const want = w.syn.map(K.normSyn)
        const m = K.matchSyn(synTyped, w.syn)
        r.hit = w.syn.filter((_, i) => m.hit.includes(want[i]))
        r.miss = w.syn.filter((_, i) => !m.hit.includes(want[i]))
        r.extra = m.extra
        r.need = need(w.syn.length)
      }
      r.ok = r.wordOk && (mode === 'reverse' || r.hit.length >= r.need)
      return r
    }

    function submit(giveUp) {
      const r = run()
      if (!r || r.pos >= r.queue.length)
        return
      const uid = r.queue[r.pos]
      const w = V.byUid[uid]
      const wordEl = root.querySelector('#sd-word')
      const synEl = root.querySelector('#sd-syn')
      const wordTyped = wordEl ? wordEl.value : ''
      const synTyped = synEl ? synEl.value : ''
      if (!giveUp && !wordTyped.trim() && !synTyped.trim()) {
        const el = wordEl || synEl
        if (el)
          el.focus()
        return
      }
      const res = giveUp ? { ok: false, wordOk: r.mode === 'word', hit: [], miss: w.syn.slice(), extra: [], need: need(w.syn.length), gaveUp: true } : judge(w, r.mode, wordTyped, synTyped)
      const firstTry = !(uid in r.first)
      if (firstTry) {
        r.first[uid] = res.ok
        const all = stats()
        const s = all[uid] || { n: 0, ok: 0, wrong: 0, last: 0, lastOk: false }
        s.n++
        s.last = Date.now()
        s.lastOk = res.ok
        if (res.ok)
          s.ok++
        else
          s.wrong++
        all[uid] = s
        K.set(sk, all)
        if (o.daily && V.daily)
          V.daily.mark(o.daily, 1)
      }
      // Only bring a missed word back when other words can come in between; otherwise it waits
      // in 错题 for the next run instead of being copied straight from the feedback.
      const othersLeft = r.queue.slice(r.pos + 1).filter(u => u !== uid).length
      if (!res.ok && (r.retry[uid] || 0) < RETRY_MAX && othersLeft >= 2) {
        r.retry[uid] = (r.retry[uid] || 0) + 1
        r.queue.splice(Math.min(r.pos + 1 + RETRY_GAP, r.queue.length), 0, uid)
        res.again = true
      }
      r.pos++
      last = { uid, mode: r.mode, res, firstTry, typedWord: wordTyped, typedSyn: synTyped }
      if (r.pos >= r.queue.length)
        finish(r)
      else
        saveRun(r)
      rerender()
      afterRender(true, 700)
    }

    function finish(r) {
      const uids = Object.keys(r.first)
      const wrong = uids.filter(u => !r.first[u])
      summary = { label: r.label, kind: r.kind, group: r.group, total: uids.length, ok: uids.length - wrong.length, wrong, secs: (Date.now() - r.started) / 1000 }
      saveRun(null)
    }

    /* ---------- rendering ---------- */

    function synChips(list, cls) {
      return list.map(s => `<span class="chip${cls ? ` ${cls}` : ''}" lang="en">${esc(s)}</span>`).join('')
    }

    function feedbackHtml() {
      if (!last)
        return ''
      const w = V.byUid[last.uid]
      const r = last.res
      const verdict = r.ok ? `<span class="verdict v-right">${icon('circle-check')}<span>${last.firstTry ? '答对' : '这次对了（本轮第一次答错，不算掌握）'}</span></span>`
        : `<span class="verdict v-wrong">${icon('circle-x')}<span>${r.gaveUp ? '不会' : '没通过'}${r.again ? '，隔几题再考' : '，记进错题'}</span></span>`
      const wordLine = last.mode !== 'word'
        ? `<div class="sd-fb-row"><span class="label">考点词</span><span><b lang="en">${esc(V.wordText(w))}</b>${!r.gaveUp && !r.wordOk ? ` <span class="sd-yours">你写的 <s lang="en">${esc(last.typedWord || '（空）')}</s></span>` : ''}${r.also ? ` <span class="muted">（${esc(r.also)} 也考这组替换，算对）</span>` : ''}</span></div>`
        : ''
      const synLine = last.mode !== 'reverse'
        ? `<div class="sd-fb-row"><span class="label">替换</span><span class="chips">${synChips(r.hit, 'c-ok')}${synChips(r.miss, 'c-miss')}</span></div>
          ${r.extra.length ? `<div class="sd-fb-row"><span class="label">表外</span><span class="chips">${synChips(r.extra, 'c-extra')}</span></div>` : ''}
          ${!r.gaveUp ? `<div class="sd-fb-row"><span class="label"></span><span class="muted">写对 ${r.hit.length} 个，需要 ${r.need} 个</span></div>` : ''}`
        : `<div class="sd-fb-row"><span class="label">替换</span><span class="chips">${synChips(w.syn)}</span></div>`
      return `<div class="sd-fb ${r.ok ? 'is-right' : 'is-wrong'}" aria-live="polite">
        <div class="sd-fb-head"><span class="muted">上一题</span>${verdict}<span class="spacer"></span>
          <button type="button" class="icon-btn sm" data-act="sd-speak" data-uid="${esc(w.uid)}" title="发音" aria-label="发音">${icon('volume-2')}</button></div>
        ${wordLine}${synLine}
        <div class="sd-fb-row"><span class="label">释义</span><span>${w.pos ? `<em class="pos">${esc(w.pos)}</em> ` : ''}${esc(w.meaning)}</span></div>
      </div>`
    }

    function questionHtml(r) {
      const w = V.byUid[r.queue[r.pos]]
      const n = need(w.syn.length)
      let card = ''
      let inputs = ''
      const field = (id, ph, hint) => `<input id="${id}" class="text-input sd-input" type="text" lang="en" placeholder="${esc(ph)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="${hint}">`
      if (r.mode === 'listen') {
        card = `<div class="sd-prompt"><button type="button" class="sd-play" data-act="sd-play" title="播放" aria-label="播放">${icon('volume-2')}</button>
          <div class="sd-meta">${w.pos ? `<em class="pos">${esc(w.pos)}</em>` : ''}<span class="muted">写出单词，再写 ${n} 个替换${w.syn.length > n ? `（共 ${w.syn.length} 个）` : ''}</span></div></div>`
        inputs = `${field('sd-word', '听到的单词', 'next')}${field('sd-syn', '同义替换，用逗号分开', 'done')}`
      }
      else if (r.mode === 'word') {
        card = `<div class="sd-prompt"><div class="sd-word" lang="en">${esc(V.wordText(w))}</div>
          <div class="sd-meta">${w.pos ? `<em class="pos">${esc(w.pos)}</em>` : ''}<span>${esc(w.meaning)}</span><span class="muted">写出 ${n} 个替换${w.syn.length > n ? `（共 ${w.syn.length} 个）` : ''}</span></div></div>`
        inputs = field('sd-syn', '同义替换，用逗号分开', 'done')
      }
      else {
        card = `<div class="sd-prompt"><div class="chips sd-syns">${synChips(w.syn)}</div>
          <div class="sd-meta">${w.pos ? `<em class="pos">${esc(w.pos)}</em>` : ''}<span>${esc(w.meaning)}</span><span class="muted">写出考点词</span></div></div>`
        inputs = field('sd-word', '考点词', 'done')
      }
      return `<div class="sd-run">
        <div class="sd-top"><span class="tag">${esc(r.label)}</span><span class="tag">${MODES[r.mode].label}</span>
          <span class="muted sd-count">${r.pos + 1} / ${r.queue.length}</span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="sd-quit">${icon('pause')}<span>暂停</span></button></div>
        <div class="sd-q panel">${card}
          <div class="sd-inputs">${inputs}</div>
          <div class="sk-actions"><button type="button" class="btn ghost" data-act="sd-skip">${icon('eye')}<span>不会</span></button><span class="spacer"></span>
            <button type="button" class="btn primary" data-act="sd-submit">${icon('check')}<span>提交</span></button></div></div>
        ${feedbackHtml()}
      </div>`
    }

    function summaryHtml() {
      const s = summary
      const hasNext = s.kind === 'group' && groups[s.group + 1]
      const wrongRows = s.wrong.map((u) => {
        const w = V.byUid[u]
        return `<li class="sd-row"><button type="button" class="icon-btn sm" data-act="sd-speak" data-uid="${esc(u)}" title="发音" aria-label="发音">${icon('volume-2')}</button>
          <b lang="en">${esc(V.wordText(w))}</b><span class="chips">${synChips(w.syn)}</span><span class="muted">${esc(w.meaning)}</span></li>`
      }).join('')
      return `<div class="sd-sum">
        ${feedbackHtml()}
        <div class="panel sd-sum-box"><div class="sd-sum-score"><b>${s.ok}</b><span>/ ${s.total}</span></div>
          <div><b>${esc(s.label)}</b> 练完<div class="muted">第一次就答对 ${s.ok} 个 · 用时 ${V.fmtDuration(s.secs * 1000)}</div></div></div>
        ${s.wrong.length ? `<h3 class="section-title">第一次没答对</h3><ul class="sd-list">${wrongRows}</ul>` : ''}
        <div class="sk-actions">
          <button type="button" class="btn ghost" data-act="sd-home">${icon('list')}<span>返回</span></button><span class="spacer"></span>
          ${s.wrong.length ? `<button type="button" class="btn" data-act="sd-again">${icon('rotate-ccw')}<span>再练错的 ${s.wrong.length} 个</span></button>` : ''}
          ${hasNext ? `<button type="button" class="btn primary" data-act="sd-start" data-kind="group" data-value="${s.group + 1}">${icon('arrow-right')}<span>下一组</span></button>` : ''}
        </div></div>`
    }

    function homeHtml() {
      const st = stats()
      const c = cfg()
      const r = run()
      const wrongN = words.filter(w => st[w.uid] && !st[w.uid].lastOk).length
      const done = words.filter(w => mastered(st, w)).length
      const rows = groups.map((list, i) => {
        const m = list.filter(w => mastered(st, w)).length
        const tried = list.filter(w => st[w.uid]).length
        return `<li class="sd-group">
          <div class="sd-gname"><b>${esc(o.groupName(i))}</b><span class="muted">${list.length} 词${tried ? ` · 掌握 ${m}` : ''}</span></div>
          <div class="sbar" role="img" aria-label="掌握 ${m} / ${list.length}"><span class="b-mastered" style="width:${(m / list.length) * 100}%"></span></div>
          <button type="button" class="btn${tried && m === list.length ? '' : ' primary'}" data-act="sd-start" data-kind="group" data-value="${i}">${icon('play')}<span>${list.length > BATCH ? `练 ${BATCH} 个` : '练习'}</span></button></li>`
      }).join('')
      return `<div class="sd-home">
        ${r ? `<div class="resume"><div class="resume-text"><strong>上次没练完</strong><span>${esc(r.label)} · ${MODES[r.mode].label} · 第 ${r.pos + 1} / ${r.queue.length} 题</span></div>
          <div class="row-actions"><button type="button" class="btn ghost" data-act="sd-drop">${icon('x')}<span>放弃</span></button><button type="button" class="btn primary" data-act="sd-resume">${icon('play')}<span>继续</span></button></div></div>` : ''}
        <div class="sd-bar">
          ${o.modes.length > 1 ? V.seg('sd-mode', o.modes.map(m => ({ value: m, label: MODES[m].label, icon: MODES[m].icon })), c.mode) : ''}
          <span class="spacer"></span>
          <span class="muted">掌握 ${done} / ${words.length}</span>
        </div>
        <div class="sk-actions sd-quick">
          <button type="button" class="btn" data-act="sd-start" data-kind="mixed">${icon('shuffle')}<span>随机 ${BATCH} 个</span></button>
          <button type="button" class="btn" data-act="sd-start" data-kind="wrong"${wrongN ? '' : ' disabled'}>${icon('book-x')}<span>错题 ${wrongN}</span></button>
          <span class="spacer"></span>
          <button type="button" class="btn ghost" data-act="sd-train" title="词义和拼写按间隔复习安排">${icon('brain')}<span>加入背词训练</span></button>
        </div>
        <ul class="sd-groups">${rows}</ul></div>`
    }

    function listHtml() {
      const q = query.trim().toLowerCase()
      const st = stats()
      let shown = 0
      const body = groups.map((list, i) => {
        const rows = list.filter(w => !q || w.words.some(x => x.toLowerCase().includes(q)) || w.meaning.includes(q) || w.syn.some(s => s.toLowerCase().includes(q))).map((w) => {
          shown++
          const s = st[w.uid]
          return `<li class="sd-row"><button type="button" class="icon-btn sm" data-act="sd-speak" data-uid="${esc(w.uid)}" title="发音" aria-label="发音">${icon('volume-2')}</button>
            <b lang="en">${esc(V.wordText(w))}</b><span class="chips">${synChips(w.syn)}</span>
            <span class="muted">${w.pos ? `<em class="pos">${esc(w.pos)}</em> ` : ''}${esc(w.meaning)}</span>
            <span class="sd-st">${s ? (s.lastOk ? `<span class="tag ok">${icon('check')}</span>` : `<span class="tag bad">错 ${s.wrong}</span>`) : ''}</span></li>`
        }).join('')
        return rows ? `<h3 class="section-title">${esc(o.groupName(i))}</h3><ul class="sd-list">${rows}</ul>` : ''
      }).join('')
      return `<div class="sd-table">
        <div class="toolbar"><label class="search">${icon('search')}<input id="sd-search" type="search" placeholder="搜索单词、中文或替换词" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="${esc(query)}"></label><span class="list-count">${q ? `找到 ${shown} 个` : `${shown} 个词`}</span></div>
        ${body || `<div class="empty">${icon('search')}<p>没有匹配的词</p></div>`}</div>`
    }

    function render(el) {
      root = el
      const r = run()
      const head = `<div class="sd-view">${V.seg('sd-view', [{ value: 'drill', label: '练习', icon: 'pencil-line' }, { value: 'list', label: '词表', icon: 'list' }], view)}</div>`
      if (view === 'list') {
        el.innerHTML = head + listHtml()
        return
      }
      if (summary)
        el.innerHTML = summaryHtml()
      else if (r && r.active)
        el.innerHTML = questionHtml(r)
      else
        el.innerHTML = head + homeHtml()
    }

    /** Focus the first answer box and play the word in listening mode. */
    function afterRender(autoplay, delay) {
      const r = run()
      if (!root || !r || !r.active || summary)
        return
      const input = root.querySelector('#sd-word, #sd-syn')
      if (input)
        input.focus({ preventScroll: true })
      if (!autoplay || r.mode !== 'listen')
        return
      const uid = r.queue[r.pos]
      const pos = r.pos
      if (!delay)
        return V.speak(V.byUid[uid])
      setTimeout(() => {
        const cur = run()
        if (cur && cur.active && cur.pos === pos && root.isConnected && root.querySelector('#sd-word, #sd-syn'))
          V.speak(V.byUid[uid]).then((how) => {
            if (how === 'blocked')
              V.toast('点播放按钮听发音')
          })
      }, delay)
    }

    function act(name, el) {
      switch (name) {
        case 'sd-start':
          if (run() && !window.confirm('放弃没练完的那一组？'))
            return
          return start(el.dataset.kind, el.dataset.value)
        case 'sd-resume': {
          const r = run()
          r.active = true
          saveRun(r)
          last = null
          rerender()
          return afterRender(true)
        }
        case 'sd-quit': {
          const r = run()
          if (r) {
            r.active = false
            saveRun(r)
          }
          last = null
          V.stopSpeech()
          return rerender()
        }
        case 'sd-drop':
          saveRun(null)
          return rerender()
        case 'sd-home':
          summary = null
          last = null
          return rerender()
        case 'sd-again': {
          const wrong = summary.wrong
          summary = null
          return start('uids', wrong)
        }
        case 'sd-submit':
          return submit(false)
        case 'sd-skip':
          return submit(true)
        case 'sd-play': {
          const r = run()
          if (r)
            V.speak(V.byUid[r.queue[r.pos]])
          const input = root.querySelector('#sd-word, #sd-syn')
          if (input)
            input.focus({ preventScroll: true })
          return
        }
        case 'sd-speak':
          return V.speak(V.byUid[el.dataset.uid])
        case 'sd-train':
          V.trainer.setCfg({ newScope: o.chapter, newStart: '' })
          V.toast(`训练范围已切到 ${V.chapterName(o.chapter)}`)
          return V.go('train')
      }
    }

    return {
      render,
      act,
      onSeg(name, value) {
        if (name === 'sd-view') {
          view = value
          return rerender()
        }
        if (name === 'sd-mode') {
          K.set(`syncfg:${o.key}`, Object.assign(K.get(`syncfg:${o.key}`, {}), { mode: value }))
          return rerender()
        }
      },
      onInput(e) {
        if (e.target.id === 'sd-search') {
          query = e.target.value
          const pos = e.target.selectionStart
          rerender()
          const box = root.querySelector('#sd-search')
          box.focus()
          box.setSelectionRange(pos, pos)
        }
      },
      onKeydown(e) {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229)
          return
        const id = e.target.id
        if (id !== 'sd-word' && id !== 'sd-syn')
          return
        e.preventDefault()
        const syn = root.querySelector('#sd-syn')
        if (id === 'sd-word' && syn)
          return syn.focus()
        submit(false)
      },
      busy: () => !!(run() && run().active),
      /** Make the run resumable from the page home after leaving the page. */
      leave() {
        const r = run()
        if (r && r.active) {
          r.active = false
          saveRun(r)
        }
        last = null
      },
    }
  }
})()
