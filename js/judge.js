/* Answer judging for the trainer. Chinese meaning answers are matched against
   core senses, maintained synonyms and answers the learner has accepted;
   English spellings against all listed variants with a letter-level diff. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).judge = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/
  const IPA = /\/[^/\u3400-\u9FFF]*[ˈˌːəɪʊʌæɜɒɔθðʃʒŋɑɛ][^/\u3400-\u9FFF]*\//g
  const BRACKET_CONTENT = /[（(\[【〔][^）)\]】〕]*[）)\]】〕]/g
  const BRACKET_CHARS = /[（）()[\]【】〔〕]/g
  const PREP_ELLIPSIS = /[对给与和使把为被将向从同](?:\.{2,}|…+)/g
  const ANSWER_SPLIT = /[；;，,/、。\s|]+/

  // Maintained equivalents. Each group lists expressions accepted for one another.
  const SYNONYM_GROUPS = [
    ['灾难', '灾害', '灾祸', '大灾难', '祸患'],
    ['氛围', '气氛'],
    ['环境', '周围环境', '周边环境'],
    ['危及', '危害', '威胁', '使遭受危险'],
    ['困境', '窘境', '两难', '进退两难'],
    ['方法', '方式', '办法'],
    ['重要', '重大'],
    ['显著', '明显'],
    ['提高', '改善', '改进'],
    ['减少', '降低', '减小'],
    ['增加', '增长', '增多'],
    ['巨大', '庞大'],
    ['普遍', '广泛'],
    ['获得', '得到', '取得'],
    ['保护', '保卫'],
    ['破坏', '毁坏', '损坏'],
    ['检查', '检验', '检测'],
    ['允许', '准许', '许可'],
    ['禁止', '不准'],
    ['支持', '支撑'],
    ['照顾', '照料', '护理'],
    ['居民', '住户'],
    ['居住', '住'],
    ['儿童', '孩子', '小孩'],
    ['老师', '教师'],
    ['学生', '学员'],
    ['同时', '与此同时'],
    ['最初', '起初', '开始时'],
    ['永久', '永恒', '永远'],
    ['即将', '快要', '将要'],
    ['准时', '守时', '按时'],
    ['连续', '连续不断'],
    ['中间', '中部', '当中'],
    ['先前', '以前', '之前', '在先', '在前'],
    ['偶然', '偶然地', '碰巧'],
    ['定期', '周期性', '定时'],
    ['气体', '气'],
    ['液体', '流体'],
    ['风景', '景色', '景观'],
    ['海拔', '高度'],
    ['国家', '国'],
    ['政府', '政权'],
    ['经济', '经济的'],
    ['商品', '货物'],
    ['价格', '价钱'],
    ['工资', '薪水', '薪酬'],
    ['职业', '工作'],
    ['法律', '法规'],
    ['证据', '证明'],
    ['战争', '战事'],
    ['士兵', '军人'],
    ['健康', '健康的'],
    ['疾病', '病'],
    ['医生', '大夫'],
    ['症状', '病症'],
    ['食物', '食品'],
    ['营养', '养分'],
    ['旅行', '旅游'],
    ['交通', '运输'],
    ['建筑', '建筑物'],
  ]
  const SYN = new Map()
  for (const group of SYNONYM_GROUPS) {
    for (const w of group)
      SYN.set(w, new Set([...(SYN.get(w) || []), ...group]))
  }

  function stripPhonetics(s) {
    return String(s || '').replace(IPA, ' ').replace(/\b(?:UK|US)\b/g, ' ')
  }

  function normalizeZh(s) {
    return String(s || '').toLowerCase().replace(/[^\u3400-\u9FFF\uF900-\uFAFFa-z0-9]/g, '')
  }

  // Function words that do not change a core meaning: 灾难性的 == 灾难性, 定期地 == 定期.
  function core(n, pos) {
    let out = n.replace(/^(?:一种|一个|某种)/, '').replace(/的$/, '')
    if (/adv/i.test(pos || ''))
      out = out.replace(/地$/, '')
    // 使遭受危险 == 遭受危险, but keep words such as 使用 / 使命.
    if (out.length >= 3 && !/^使[用命者馆得劲]/.test(out))
      out = out.replace(/^使/, '')
    return out || n
  }

  const senseCache = new Map()
  /** Core senses of a dictionary meaning, e.g. "大气层；氛围" -> ["大气层", "氛围"]. */
  function senses(meaning, pos) {
    const key = `${pos}\u0001${meaning}`
    if (senseCache.has(key))
      return senseCache.get(key)
    const base = stripPhonetics(meaning).replace(PREP_ELLIPSIS, '')
    const out = []
    const add = (raw) => {
      const n = normalizeZh(raw)
      if (!CJK.test(n))
        return
      for (const form of [n, n.replace(/[a-z0-9]+/g, '')]) {
        const f = core(form, pos)
        if (f && CJK.test(f) && !out.includes(f))
          out.push(f)
      }
    }
    base.replace(BRACKET_CONTENT, '').split(/[；;，,/。、\s]+/).forEach(add)
    base.replace(BRACKET_CHARS, '').split(/[；;/。]+/).forEach(add)
    if (!out.length && normalizeZh(base))
      out.push(normalizeZh(base))
    senseCache.set(key, out)
    return out
  }

  /** Senses shown to the learner after answering (bracket notes kept, phonetics removed). */
  function displaySenses(meaning) {
    return stripPhonetics(meaning).split(/[；;/。]+/).map(s => s.trim()).filter(s => CJK.test(s))
  }

  function expand(term) {
    const set = new Set([term])
    for (const s of SYN.get(term) || [])
      set.add(s)
    return set
  }

  function matchOne(a, s) {
    if (a === s)
      return 'right'
    for (const x of expand(a)) {
      if (expand(s).has(x))
        return 'right'
    }
    if (a.length >= 2 && s.length >= 2) {
      // Partial overlap of a contiguous phrase: right only when nearly the whole sense is present.
      if (s.includes(a))
        return a.length / s.length >= 0.75 ? 'right' : 'unsure'
      if (a.includes(s))
        return s.length / a.length >= 0.6 ? 'right' : 'unsure'
      let common = 0
      for (let i = 0; i < a.length - 1; i++) {
        if (s.includes(a.slice(i, i + 2)))
          common++
      }
      if (common >= 1 && common >= Math.min(a.length, s.length) / 2)
        return 'unsure'
    }
    if (a.length === 1 && s.length <= 2 && s.includes(a))
      return 'unsure'
    return 'wrong'
  }

  const RANK = { right: 2, unsure: 1, wrong: 0 }

  /**
   * Judge a Chinese meaning answer.
   * extra: answers the learner previously accepted for this word.
   * Returns { verdict: 'right'|'unsure'|'wrong', matched, empty }.
   */
  function judgeMeaning(answer, meaning, pos, extra) {
    const list = senses(meaning, pos).concat((extra || []).map(e => core(normalizeZh(e), pos)).filter(Boolean))
    const parts = String(answer || '').replace(PREP_ELLIPSIS, '').split(ANSWER_SPLIT)
      .map(p => core(normalizeZh(p), pos)).filter(Boolean)
    if (!parts.length)
      return { verdict: 'wrong', matched: '', empty: true }
    let best = 'wrong'
    let matched = ''
    for (const a of parts) {
      for (const s of list) {
        const v = matchOne(a, s)
        if (RANK[v] > RANK[best]) {
          best = v
          matched = s
        }
      }
    }
    return { verdict: best, matched }
  }

  function normalizeEn(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      .replace(/[’‘`]/g, '\'')
      .replace(/[-‐‑–—_]/g, ' ')
      .replace(/[.。]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /** Letter alignment between an answer and a target. ops: same | sub | miss | extra. */
  function diff(answer, target) {
    const a = [...answer]
    const b = [...target]
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
    for (let j = 1; j <= b.length; j++)
      d[0][j] = j
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const same = a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same ? 0 : 1))
      }
    }
    const ops = []
    let i = a.length
    let j = b.length
    while (i > 0 || j > 0) {
      const same = i > 0 && j > 0 && a[i - 1].toLowerCase() === b[j - 1].toLowerCase()
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (same ? 0 : 1)) {
        ops.push(same ? { op: 'same', ch: b[j - 1] } : { op: 'sub', ch: b[j - 1], got: a[i - 1] })
        i--
        j--
      }
      else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
        ops.push({ op: 'miss', ch: b[j - 1] })
        j--
      }
      else {
        ops.push({ op: 'extra', got: a[i - 1] })
        i--
      }
    }
    ops.reverse()
    const count = { sub: 0, miss: 0, extra: 0 }
    for (const o of ops) {
      if (o.op !== 'same')
        count[o.op]++
    }
    return { ops, count, distance: d[a.length][b.length] }
  }

  /** "漏了 1 个字母，多了 1 个字母" style summary of a diff. */
  function describeDiff(count) {
    const out = []
    if (count.miss)
      out.push(`漏了 ${count.miss} 个字母`)
    if (count.sub)
      out.push(`错了 ${count.sub} 个字母`)
    if (count.extra)
      out.push(`多了 ${count.extra} 个字母`)
    return out.join('，')
  }

  /**
   * Judge an English spelling. Any listed variant (British/American spellings) is accepted;
   * case, surrounding spaces, hyphens and accents are ignored.
   * Returns { verdict: 'right'|'typo'|'wrong', target, diff, empty }.
   */
  function judgeSpelling(answer, variants) {
    const a = normalizeEn(answer)
    if (!a)
      return { verdict: 'wrong', target: variants[0], diff: null, empty: true }
    let best = null
    for (const v of variants) {
      const n = normalizeEn(v)
      if (a === n)
        return { verdict: 'right', target: v, diff: null }
      const dd = diff(a, n)
      if (!best || dd.distance < best.diff.distance)
        best = { target: v, diff: dd, len: n.length }
    }
    const tolerance = best.len >= 9 ? 2 : best.len >= 4 ? 1 : 0
    return { verdict: best.diff.distance <= tolerance ? 'typo' : 'wrong', target: best.target, diff: best.diff }
  }

  return { senses, displaySenses, judgeMeaning, judgeSpelling, diff, describeDiff, normalizeZh, normalizeEn, stripPhonetics, SYNONYM_GROUPS }
})
