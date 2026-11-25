/* 资源: official free practice, a checked selection of the awesome-IELTS links, and where
   each part of this site comes from (and what was deliberately not copied). */
(function () {
  'use strict'
  const V = window.VocabApp
  const { esc, icon } = V
  const SK = window.SKILLS_DATA || { sentences: [] }
  const CHECKED = '2026-11-26'

  const OFFICIAL = [
    ['IELTS 官方样题', 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions', '听说读写各题型的官方样题，带音频和答案。'],
    ['British Council 免费练习与模考', 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests', '雅思主办方之一提供的免费练习题和计时模考。'],
    ['写作评分标准（PDF）', 'https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf', 'Task 1 和 Task 2 各分数段的官方描述。'],
    ['口语评分标准（PDF）', 'https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf', '流利度、词汇、语法、发音四项的官方描述。'],
    ['分数计算说明', 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail', '听力和阅读答对题数与分数的大致对应，总分的计算方法。'],
  ]

  const THIRD = [
    ['听力', [
      ['mini-ielts 听力', 'http://mini-ielts.com/listening'],
      ['IELTS UP 听力练习', 'https://ielts-up.com/listening/ielts-listening-practice.html'],
    ]],
    ['阅读', [
      ['mini-ielts 阅读', 'http://mini-ielts.com/reading'],
      ['IELTS UP 阅读练习（学术类 / 培训类）', 'https://ielts-up.com/reading/ielts-reading-practice.html'],
    ]],
    ['写作', [
      ['IELTSBuddy 范文与点评', 'https://www.ieltsbuddy.com/ielts-sample-essays.html'],
      ['IELTSBuddy 学术类小作文', 'https://www.ieltsbuddy.com/ielts-writing-task-1.html'],
      ['ielts-practice.org 范文', 'https://www.ielts-practice.org/', '原 Band 8 / Band 9 范文分类页已失效，现在打开是网站首页'],
      ['IELTS Liz 书信写作要点', 'https://ieltsliz.com/ielts-letter-writing-essential-tips/'],
      ['Writing9 大作文题目库', 'https://writing9.com/ielts-writing-task-2-topics'],
      ['IELTS UP 写作词汇', 'https://ielts-up.com/writing/ielts-vocabulary-writing.html'],
    ]],
    ['口语', [
      ['IELTS Liz Part 1 话题', 'https://ieltsliz.com/ielts-speaking-part-1-topics/'],
      ['IELTS Liz Part 2 话题', 'https://ieltsliz.com/ielts-speaking-part-2-topics/'],
      ['IELTS Liz Part 3 话题', 'https://ieltsliz.com/ielts-speaking-part-3-topics-2/'],
      ['IELTS UP 口语词汇', 'https://ielts-up.com/speaking/ielts-vocabulary-speaking.html'],
    ]],
    ['机考模拟', [
      ['IELTS Online Tests 题库', 'https://ieltsonlinetests.com/ielts-exam-library'],
    ]],
  ]

  const link = (title, url, note) => `<li class="res-row"><a href="${esc(url)}" target="_blank" rel="noopener"><span class="res-text"><b>${esc(title)}</b>${note ? `<span class="muted">${esc(note)}</span>` : ''}</span>${icon('external-link')}</a></li>`

  function render(root) {
    const fixed = SK.sentences.filter(s => s.orig).length
    const book = n => V.data.chapters[V.bookIndex(n)] || { count: 0 }
    const sources = [
      ['hefengxian/my-ielts', 'https://github.com/hefengxian/my-ielts', `采用：雅思词汇真经 ${V.coreWords.length} 词与发音、听力 179 考点词 ${book('L179').count} 个（含真人录音）、阅读 538 考点词 ${book('R538').count} 个、72 组英美拼写、100 句翻译。校对后更正了 ${fixed} 处参考译文和 3 处拼写表条目。`, 'https://hefengxian.github.io/my-ielts/'],
      ['shah0150/awesome-IELTS', 'https://github.com/shah0150/awesome-IELTS', '一份 2020 年整理的链接合集。上面的第三方链接从中挑选，并逐个检查过能否打开。'],
      ['sallowayma-git/IELTS-practice', 'https://github.com/sallowayma-git/IELTS-practice', '借鉴了套题练习、答题卡、成绩记录和错题分析的做法。没有复制它的题库和代码：作者要求题库只供个人使用、不要公开传播，代码是 GPL 许可。'],
      ['zeeklog/IELTS', 'https://github.com/zeeklog/IELTS', '剑桥真题的 PDF 和音频有版权，本站不转载。有正版书和音频时，可以在听力、阅读的答题卡里录入答案、选择本地音频来练，文件不会上传。', 'https://zeeklog.github.io/IELTS/'],
    ]
    root.innerHTML = `<div class="skill res">
      <div class="sk-head"><div class="sk-title"><h2>资源</h2></div></div>
      <h3 class="section-title">官方免费资源</h3><ul class="res-list">${OFFICIAL.map(([t, u, d]) => link(t, u, d)).join('')}</ul>
      <h3 class="section-title">第三方练习网站</h3>
      <div class="res-groups">${THIRD.map(([g, list]) => `<div><span class="label">${esc(g)}</span><ul class="res-list">${list.map(([t, u, n]) => link(t, u, n)).join('')}</ul></div>`).join('')}</div>
      <p class="sk-note">${icon('info')}<span>以上链接 ${CHECKED} 检查过都能打开，以后可能变化。没有收录：剑桥真题打包下载（盗版），以及提供剑桥真题 PDF 的 practicepteonline。第三方网站的内容和版权由各网站负责；范文用来学结构和论证，不要背下来套用。</span></p>
      <h3 class="section-title">本站内容来源</h3>
      <ul class="res-src">${sources.map(([name, url, what, site]) => `<li><div class="res-src-head"><a href="${url}" target="_blank" rel="noopener" lang="en">${esc(name)}</a>${site ? `<a class="muted" href="${site}" target="_blank" rel="noopener">在线站</a>` : ''}</div><p>${esc(what)}</p></li>`).join('')}
        <li><div class="res-src-head"><b>本站原创</b></div><p>阅读模考 3 篇 40 题、写作题目与图表数据、口语题目与发音练习、Section 1 信息听写题目生成、写作自动检查、间隔复习训练。</p></li></ul>
    </div>`
  }

  V.pages = V.pages || {}
  V.pages.resources = {
    mount() {},
    render: () => render(document.getElementById('view-resources')),
  }
})()