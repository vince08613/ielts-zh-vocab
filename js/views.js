/* Word list, wrong book, statistics and settings. */
(function () {
  'use strict'
  const V = window.VocabApp
  const { core, store, esc, icon } = V

  const STATUS = {
    new: { icon: '', label: '未测' },
    learning: { icon: 'circle-dashed', label: '答对过' },
    review: { icon: 'x', label: '待复习' },
    mastered: { icon: 'check', label: '已掌握' },
  }
  const DIR_LABEL = { e2z: '英 → 中', z2e: '中 → 英' }
  const TYPE_LABEL = { choice: '选择', write: '默写', card: '闪卡' }
  const TRAIN_STATUS = { new: '', skipped: '已会', learning: '刚学过', passed: '本轮通过', retained: '跨天通过' }

  const el = {}
  let wrongDir = 'e2z'
  let searchTimer = 0

  function statusCell(dir, id) {
    const st = store.status(dir, id)
    const s = STATUS[st]
    return `<span class="st st-${st}" title="${DIR_LABEL[dir]}：${s.label}" aria-label="${DIR_LABEL[dir]}：${s.label}">${s.icon ? icon(s.icon) : ''}</span>`
  }

  /* ---------- word list ---------- */

  function listRows(words, mask, query) {
    const q = query.trim().toLowerCase()
    const out = []
    let lastChapter = -1
    let lastGroup = -1
    let open = false
    let shown = 0
    for (const w of words) {
      if (q && !w.words.some(v => v.toLowerCase().includes(q)) && !w.meaning.includes(q))
        continue
      shown++
      if (w.chapter !== lastChapter || w.group !== lastGroup) {
        if (open)
          out.push('</section>')
        if (w.chapter !== lastChapter && store.list.chapter === 'all')
          out.push(`<h3 class="chapter-title">${esc(V.chapterName(w.chapter))}</h3>`)
        out.push(`<section class="w-group" data-g="${w.group % 2}">`)
        open = true
        lastChapter = w.chapter
        lastGroup = w.group
      }
      const en = `<span lang="en">${esc(V.wordText(w))}</span>`
      const ts = V.trainer ? V.trainer.wordStatus(w.uid) : 'new'
      const chip = TRAIN_STATUS[ts] ? `<span class="tr-st tr-${ts}">${TRAIN_STATUS[ts]}</span>` : ''
      const zh = esc(w.meaning)
      out.push(`<div class="w-row">
        <button type="button" class="icon-btn sm" data-act="speak-id" data-id="${w.id}" title="发音" aria-label="发音">${icon('volume-2')}</button>
        <div class="w-en${mask === 'en' ? ' masked' : ''}"${mask === 'en' ? ' data-act="peek" role="button" tabindex="0"' : ''}>${en}${chip}</div>
        <div class="w-pos">${esc(w.pos)}</div>
        <div class="w-zh${mask === 'zh' ? ' masked' : ''}"${mask === 'zh' ? ' data-act="peek" role="button" tabindex="0"' : ''}>${zh}
          ${w.example && mask !== 'en' ? `<div class="w-ex" lang="en">${esc(w.example)}</div>` : ''}</div>
        <div class="w-st">${statusCell('e2z', w.id)}${statusCell('z2e', w.id)}
          <button type="button" class="icon-btn sm" data-act="train-from" data-uid="${esc(w.uid)}" title="从这个词开始训练" aria-label="从这个词开始训练">${icon('flag')}</button></div>
      </div>`)
    }
    if (open)
      out.push('</section>')
    return { html: out.join(''), shown }
  }

  function renderListBody() {
    const L = store.list
    const words = L.chapter === 'all' ? V.coreWords : V.chapterWords[L.chapter]
    const query = el.list.querySelector('#list-search').value
    const { html, shown } = listRows(words, L.mask, query)
    el.list.querySelector('.list-count').textContent = query.trim() ? `找到 ${shown} 个` : `${shown} 个词`
    el.list.querySelector('.w-body').innerHTML = shown
      ? html
      : `<div class="empty">${icon('search')}<p>没有匹配的单词</p></div>`
  }

  function renderList() {
    const L = store.list
    L.chapter = V.parseChapter(L.chapter)
    const prevQuery = el.list.querySelector('#list-search') ? el.list.querySelector('#list-search').value : ''
    el.list.innerHTML = `<div class="list${L.chapter === 'all' ? ' all' : ''}">
      <div class="toolbar">
        <select id="list-chapter" aria-label="章节">${V.chapterOptions(L.chapter, true)}</select>
        <label class="search">${icon('search')}<input id="list-search" type="search" placeholder="搜索英文或中文" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="${esc(prevQuery)}"></label>
        ${V.seg('mask', [
          { value: 'none', label: '全部显示', icon: 'eye' },
          { value: 'zh', label: '遮中文', icon: 'eye-off' },
          { value: 'en', label: '遮英文', icon: 'eye-off' },
        ], L.mask)}
        <span class="list-count"></span>
      </div>
      <div class="w-head"><span></span><span>单词</span><span class="w-pos">词性</span><span>释义</span>
        <span class="w-st"><span class="tag e2z">英→中</span><span class="tag z2e">中→英</span></span></div>
      <div class="w-body"></div>
    </div>`
    renderListBody()
  }

  function onListClick(e) {
    const segBtn = e.target.closest('.seg button')
    if (segBtn) {
      store.list.mask = segBtn.dataset.value
      store.saveList()
      renderList()
      return
    }
    const btn = e.target.closest('[data-act]')
    if (!btn)
      return
    if (btn.dataset.act === 'speak-id')
      V.speak(V.byId[btn.dataset.id])
    else if (btn.dataset.act === 'train-from') {
      V.trainer.setStart(btn.dataset.uid)
      V.toast(`训练起点：${V.byUid[btn.dataset.uid].words[0]}`)
      V.go('train')
    }
    else if (btn.dataset.act === 'peek')
      btn.classList.toggle('peeked')
  }

  /* ---------- wrong book ---------- */

  function renderWrong() {
    const ids = { e2z: store.reviewIds('e2z'), z2e: store.reviewIds('z2e') }
    const list = ids[wrongDir]
    const p = store.progress[wrongDir]
    const rows = list.map((id) => {
      const w = V.byId[id]
      const rec = p[id]
      return `<li class="wb-row">
        <button type="button" class="icon-btn sm" data-act="speak-id" data-id="${id}" title="发音" aria-label="发音">${icon('volume-2')}</button>
        <span class="m-word" lang="en">${esc(V.wordText(w))}${w.pos ? ` <em class="pos">${esc(w.pos)}</em>` : ''}</span>
        <span class="m-meaning">${esc(w.meaning)}</span>
        <span class="wb-meta">${rec[1] ? `错 ${rec[1]} 次` : '模糊'} · ${V.fmtDate(rec[3])}</span>
        <button type="button" class="icon-btn sm" data-act="dismiss" data-id="${id}" title="移出错词本" aria-label="移出错词本">${icon('check')}</button>
      </li>`
    }).join('')
    const o = V.trainer && V.trainer.overview()
    const trainWrong = o ? o.wrong.keys.length + o.wrong.words.length : 0
    const trainPanel = o
      ? `<div class="resume t-wrongpanel"><div class="resume-text"><strong>训练错词 ${trainWrong} · 顽固错词 ${o.stubborn.length}</strong>
          <span>来自高强度训练，按能力分别记录</span></div>
          <button type="button" class="btn primary" data-act="train-wrong"${trainWrong ? '' : ' disabled'}>${icon('play')}<span>只练错词</span></button></div>
        <h3 class="section-title">自测错词</h3>`
      : ''
    el.wrong.innerHTML = `<div class="wrongbook">${trainPanel}
      <div class="toolbar">
        ${V.seg('wdir', [
          { value: 'e2z', label: '英 → 中', sub: ids.e2z.length },
          { value: 'z2e', label: '中 → 英', sub: ids.z2e.length },
        ], wrongDir)}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-act="clear"${list.length ? '' : ' disabled'}>${icon('trash-2')}<span>全部移出</span></button>
        <button type="button" class="btn primary" data-act="review"${list.length ? '' : ' disabled'}>${icon('play')}<span>复习 ${list.length} 个</span></button>
      </div>
      ${list.length
        ? `<ul class="miss-list">${rows}</ul>`
        : `<div class="empty">${icon('book-x')}<p>${DIR_LABEL[wrongDir]} 没有待复习的单词</p></div>`}
    </div>`
  }

  function onWrongClick(e) {
    const segBtn = e.target.closest('.seg button')
    if (segBtn) {
      wrongDir = segBtn.dataset.value
      renderWrong()
      return
    }
    const btn = e.target.closest('[data-act]')
    if (!btn || btn.disabled)
      return
    const act = btn.dataset.act
    if (act === 'speak-id') {
      V.speak(V.byId[btn.dataset.id])
    }
    else if (act === 'train-wrong') {
      V.go('train')
      V.trainer.onHomeAct('h-wrong', btn)
    }
    else if (act === 'dismiss') {
      store.dismiss(wrongDir, [Number(btn.dataset.id)])
      renderWrong()
      V.refreshBadges()
    }
    else if (act === 'clear') {
      if (window.confirm(`把 ${DIR_LABEL[wrongDir]} 的错词全部移出错词本？答题记录会保留。`)) {
        store.dismiss(wrongDir, store.reviewIds(wrongDir))
        renderWrong()
        V.refreshBadges()
      }
    }
    else if (act === 'review') {
      V.practice.startFrom({ dir: wrongDir, type: store.config.type, chapter: 'all', source: 'wrong', count: 0, order: 'random' }, '错词本')
    }
  }

  /* ---------- statistics ---------- */

  function countStatus(dir, words) {
    const c = { new: 0, learning: 0, review: 0, mastered: 0 }
    const p = store.progress[dir]
    for (const w of words)
      c[core.statusOf(p[w.id])]++
    return c
  }

  function bar(c, total) {
    const pct = n => `${(n / total) * 100}%`
    return `<div class="sbar" role="img" aria-label="已掌握 ${c.mastered}，答对过 ${c.learning}，待复习 ${c.review}，未测 ${c.new}">
      <span class="b-mastered" style="width:${pct(c.mastered)}"></span><span class="b-learning" style="width:${pct(c.learning)}"></span><span class="b-review" style="width:${pct(c.review)}"></span></div>`
  }

  function kpi(dir) {
    const c = countStatus(dir, V.words)
    const total = V.words.length
    return `<div class="kpi">
      <div class="kpi-head"><span class="tag ${dir}">${DIR_LABEL[dir]}</span><span class="kpi-num">${c.mastered}<small> / ${total}</small></span></div>
      ${bar(c, total)}
      <div class="kpi-legend"><span class="lg-mastered">已掌握 ${c.mastered}</span><span class="lg-learning">答对过 ${c.learning}</span><span class="lg-review">待复习 ${c.review}</span><span>未测 ${c.new}</span></div>
    </div>`
  }

  function renderStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const since = today.getTime() / 1000
    const todays = store.history.filter(h => h.t >= since)
    const tTotal = todays.reduce((n, h) => n + h.total, 0)
    const tRight = todays.reduce((n, h) => n + h.right, 0)
    const rows = V.data.chapters.map((ch, i) => {
      const words = V.chapterWords[i]
      const a = countStatus('e2z', words)
      const b = countStatus('z2e', words)
      return `<tr data-act="chapter" data-ch="${i}" tabindex="0">
        <td class="c-name">${esc(V.chapterName(i))}</td><td class="num">${ch.count}</td>
        <td>${bar(a, ch.count)}<span class="c-pct">${Math.round((a.mastered / ch.count) * 100)}%</span></td>
        <td>${bar(b, ch.count)}<span class="c-pct">${Math.round((b.mastered / ch.count) * 100)}%</span></td>
        <td class="num">${a.review + b.review || ''}</td>
      </tr>`
    }).join('')
    const recent = store.history.slice(0, 12).map(h => `<li>
        <span class="h-time">${V.fmtDate(h.t)}</span><span class="tag ${h.dir}">${DIR_LABEL[h.dir]}</span><span>${TYPE_LABEL[h.type]}</span>
        <span class="h-title">${esc(h.title)}</span><span class="h-score">${h.right} / ${h.total}</span></li>`).join('')
    el.stats.innerHTML = `<div class="stats">
      <div class="kpis">${kpi('e2z')}${kpi('z2e')}
        <div class="kpi">
          <div class="kpi-head"><span class="tag">今天</span><span class="kpi-num">${tTotal}<small> 题</small></span></div>
          <div class="kpi-legend"><span>${todays.length} 次测试</span><span>正确率 ${tTotal ? Math.round((tRight / tTotal) * 100) : 0}%</span></div>
        </div>
      </div>
      <table class="chapter-table">
        <thead><tr><th>章节</th><th class="num">词数</th><th>英 → 中</th><th>中 → 英</th><th class="num">待复习</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3 class="section-title">最近测试</h3>
      ${recent ? `<ul class="history">${recent}</ul>` : `<div class="empty">${icon('history')}<p>还没有测试记录</p></div>`}
    </div>`
  }

  function onStatsClick(e) {
    const row = e.target.closest('[data-act="chapter"]')
    if (!row)
      return
    store.config.chapter = Number(row.dataset.ch)
    store.saveConfig()
    V.go('practice')
  }

  /* ---------- settings ---------- */

  function renderSettings() {
    const S = store.settings
    el.settingsBody.innerHTML = `
      <div class="field"><span class="label">发音</span>${V.seg('voice', [
        { value: 'dict', label: '词典录音' },
        { value: 'tts', label: '系统语音' },
      ], S.voice)}</div>
      <div class="field"><span class="label">口音</span>${V.seg('accent', [
        { value: 'en-GB', label: '英音' },
        { value: 'en-US', label: '美音' },
      ], S.accent)}</div>
      <label class="switch-row"><span>自动发音</span><input type="checkbox" class="switch" data-set="autoSpeak"${S.autoSpeak ? ' checked' : ''}></label>
      <label class="switch-row"><span>选择题答对后自动下一题</span><input type="checkbox" class="switch" data-set="autoNext"${S.autoNext ? ' checked' : ''}></label>
      <div class="field"><span class="label">学习记录</span>
        <div class="row-actions wrap">
          <button type="button" class="btn" data-act="export">${icon('download')}<span>导出</span></button>
          <button type="button" class="btn" data-act="import">${icon('upload')}<span>导入</span></button>
          <button type="button" class="btn danger" data-act="reset">${icon('trash-2')}<span>清除</span></button>
        </div>
      </div>
      <p class="credit">词库：<a href="https://github.com/hefengxian/my-ielts" target="_blank" rel="noopener">hefengxian/my-ielts</a>（雅思词汇真经 ${V.coreWords.length} 词，另有听力 179 与阅读 538 考点词书 ${V.words.length - V.coreWords.length} 词），仅供个人学习。</p>`
  }

  function openSettings() {
    renderSettings()
    el.modal.hidden = false
    el.modal.querySelector('[data-act="close"]').focus()
  }

  function closeSettings() {
    el.modal.hidden = true
    document.getElementById('open-settings').focus()
  }

  async function exportData() {
    await V.db.flush()
    const data = Object.assign(store.exportData(), { version: 2, srs: await V.db.exportAll() })
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ielts-vocab-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  function importFile(file) {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const obj = JSON.parse(String(reader.result))
        if (!window.confirm('用这个文件替换当前的学习记录？'))
          return
        store.importData(obj)
        if (obj.srs)
          await V.db.importAll(obj.srs)
        V.trainer.load()
        V.toast('学习记录已导入')
        closeSettings()
        V.rerender()
      }
      catch (err) {
        V.toast(`导入失败：${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  function onSettingsClick(e) {
    if (e.target === el.modal)
      return closeSettings()
    const segBtn = e.target.closest('.seg button')
    if (segBtn) {
      store.settings[segBtn.parentElement.dataset.name] = segBtn.dataset.value
      store.saveSettings()
      renderSettings()
      return
    }
    const btn = e.target.closest('[data-act]')
    if (!btn)
      return
    const act = btn.dataset.act
    if (act === 'close')
      closeSettings()
    else if (act === 'export')
      exportData()
    else if (act === 'import')
      el.file.click()
    else if (act === 'reset' && window.confirm('清除全部学习记录？此操作无法撤销，建议先导出备份。')) {
      store.resetAll()
      V.db.clearAll().then(() => {
        V.trainer.load()
        V.toast('学习记录已清除')
        closeSettings()
        V.rerender()
      })
    }
  }

  /* ---------- public ---------- */

  V.views = {
    mount() {
      el.list = document.getElementById('view-list')
      el.wrong = document.getElementById('view-wrong')
      el.stats = document.getElementById('view-stats')
      el.modal = document.getElementById('settings')
      el.settingsBody = el.modal.querySelector('.modal-body')
      el.file = document.getElementById('import-file')

      el.list.addEventListener('click', onListClick)
      el.list.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.act === 'peek') {
          e.preventDefault()
          e.target.classList.toggle('peeked')
        }
      })
      el.list.addEventListener('change', (e) => {
        if (e.target.id === 'list-chapter') {
          store.list.chapter = V.parseChapter(e.target.value)
          store.saveList()
          renderList()
          window.scrollTo(0, 0)
        }
      })
      el.list.addEventListener('input', (e) => {
        if (e.target.id !== 'list-search')
          return
        clearTimeout(searchTimer)
        searchTimer = setTimeout(renderListBody, 160)
      })
      el.wrong.addEventListener('click', onWrongClick)
      el.stats.addEventListener('click', onStatsClick)
      el.stats.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')
          onStatsClick(e)
      })
      el.modal.addEventListener('click', onSettingsClick)
      el.modal.addEventListener('change', (e) => {
        const key = e.target.dataset.set
        if (key) {
          store.settings[key] = e.target.checked
          store.saveSettings()
        }
      })
      el.file.addEventListener('change', () => {
        if (el.file.files[0])
          importFile(el.file.files[0])
        el.file.value = ''
      })
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !el.modal.hidden)
          closeSettings()
      })
      document.getElementById('open-settings').addEventListener('click', openSettings)
    },
    list: renderList,
    wrong: renderWrong,
    stats: renderStats,
  }
})()
