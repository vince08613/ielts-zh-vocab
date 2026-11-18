/* Pure vocabulary logic shared by the app and the node tests:
   answer judging, meaning masking, distractor picking and queue building. */
(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports)
    module.exports = api
  else
    (root.VocabApp = root.VocabApp || {}).core = api
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict'

  const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/
  // IPA transcriptions such as /ˈdez.ət/ (must contain at least one IPA-only letter).
  const IPA = /\/[^/\u3400-\u9FFF]*[ˈˌːəɪʊʌæɜɒɔθðʃʒŋɑɛ][^/\u3400-\u9FFF]*\//g
  const BRACKET_CONTENT = /[（(\[【〔][^）)\]】〕]*[）)\]】〕]/g
  const BRACKET_CHARS = /[（）()[\]【】〔〕]/g
  // "对...进行" style placeholders: drop the preposition together with the ellipsis.
  const PREP_ELLIPSIS = /[对给与和使把为被将向从同](?:\.{2,}|…+)/g
  const ANSWER_SPLIT = /[；;，,/、。\s]+/

  const RIGHT_AT = 0.795
  const CLOSE_AT = 0.45

  function stripPhonetics(s) {
    return String(s || '').replace(IPA, ' ').replace(/\b(?:UK|US)\b/g, ' ')
  }

  function normalizeZh(s) {
    return String(s || '').toLowerCase().replace(/[^\u3400-\u9FFF\uF900-\uFAFFa-z0-9]/g, '')
  }

  function isAdverb(pos) {
    return /adv/i.test(pos || '')
  }

  // Drop the adjective marker 的 (and 地 for adverbs) so 灾难性的 == 灾难性.
  function trimTail(n, pos) {
    let out = n.replace(/的$/, '')
    if (isAdverb(pos))
      out = out.replace(/地$/, '')
    return out || n
  }

  const senseCache = new Map()
  function senseCandidates(meaning, pos) {
    const key = `${pos}\u0001${meaning}`
    if (senseCache.has(key))
      return senseCache.get(key)
    const base = stripPhonetics(meaning).replace(PREP_ELLIPSIS, '')
    const out = []
    const add = (raw) => {
      const n = normalizeZh(raw)
      if (!CJK.test(n))
        return
      // Keep the sense as written ("x射线") and without inline English notes ("大剪刀").
      for (const form of [n, n.replace(/[a-z0-9]+/g, '')]) {
        const f = trimTail(form, pos)
        if (f && CJK.test(f) && !out.includes(f))
          out.push(f)
      }
    }
    // Core senses: bracketed notes removed, split on every separator.
    base.replace(BRACKET_CONTENT, '').split(/[；;，,/。、\s]+/).forEach(add)
    // Full senses: bracket text kept, split on major separators only.
    base.replace(BRACKET_CHARS, '').split(/[；;/。]+/).forEach(add)
    if (!out.length) {
      const n = normalizeZh(base)
      if (n)
        out.push(n)
    }
    senseCache.set(key, out)
    return out
  }

  function grams(s) {
    if (s.length < 2)
      return [s]
    const g = []
    for (let i = 0; i < s.length - 1; i++)
      g.push(s.slice(i, i + 2))
    return g
  }

  function dice(x, y) {
    const pool = y.slice()
    let hit = 0
    for (const g of x) {
      const k = pool.indexOf(g)
      if (k >= 0) {
        hit++
        pool.splice(k, 1)
      }
    }
    return (2 * hit) / (x.length + y.length)
  }

  function scorePair(a, s) {
    if (a === s)
      return 1
    if (s.includes(a))
      return a.length >= 2 ? 0.4 + 0.6 * (a.length / s.length) : 0.25
    if (a.includes(s))
      return s.length >= 2 ? 0.45 + 0.5 * (s.length / a.length) : 0.2
    return Math.max(dice(grams(a), grams(s)) * 0.9, dice([...a], [...s]) * 0.6)
  }

  function verdictFor(score) {
    return score >= RIGHT_AT ? 'right' : score >= CLOSE_AT ? 'close' : 'wrong'
  }

  /** Judge a Chinese answer against a Chinese meaning string. */
  function judgeZh(answer, meaning, pos) {
    const senses = senseCandidates(meaning, pos)
    const parts = String(answer || '').replace(PREP_ELLIPSIS, '').split(ANSWER_SPLIT)
      .map(p => normalizeZh(p))
      .filter(Boolean)
      .map(p => trimTail(p, pos))
    if (!parts.length)
      return { verdict: 'wrong', score: 0, matched: '', empty: true }
    let best = 0
    let matched = ''
    for (const a of parts) {
      for (const s of senses) {
        const sc = scorePair(a, s)
        if (sc > best) {
          best = sc
          matched = s
        }
      }
    }
    return { verdict: verdictFor(best), score: best, matched }
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

  function levenshtein(a, b) {
    if (a === b)
      return 0
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]
      for (let j = 1; j <= b.length; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
    return prev[b.length]
  }

  /** Judge an English spelling against the accepted variants. Small typos count as close. */
  function judgeEn(answer, variants) {
    const a = normalizeEn(answer)
    if (!a)
      return { verdict: 'wrong', score: 0, matched: variants[0] || '', empty: true }
    let best = { verdict: 'wrong', score: 0, matched: variants[0] || '' }
    for (const v of variants) {
      const n = normalizeEn(v)
      if (a === n)
        return { verdict: 'right', score: 1, matched: v }
      const d = levenshtein(a, n)
      const tolerance = n.length >= 9 ? 2 : n.length >= 4 ? 1 : 0
      const score = 1 - d / Math.max(n.length, a.length)
      if (d <= tolerance && score > best.score)
        best = { verdict: 'close', score, matched: v }
    }
    return best
  }

  function stemParts(variants) {
    const parts = []
    for (const v of variants) {
      for (const p of normalizeEn(v).split(' ')) {
        if (p && !parts.includes(p))
          parts.push(p)
      }
    }
    return parts
  }

  function tokenHits(token, parts) {
    const t = normalizeEn(token)
    return parts.some((p) => {
      if (p.length < 4)
        return t === p
      // Abbreviations such as "memo" for "memorandum".
      if (t.length >= 4 && p.startsWith(t))
        return true
      const k = Math.max(4, Math.min(p.length - 2, 6))
      return t.slice(0, k) === p.slice(0, k)
    })
  }

  /** Hide English words in a Chinese meaning that would give away the answer (中→英 prompts). */
  function maskMeaning(meaning, variants) {
    const parts = stemParts(variants)
    return stripPhonetics(meaning)
      .replace(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g, tok => (tokenHits(tok, parts) ? '～' : tok))
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  /** Split an example sentence into text / answer-word segments for masking or highlighting. */
  function markWord(sentence, variants) {
    const parts = stemParts(variants)
    const out = []
    const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g
    let last = 0
    let m
    const text = String(sentence || '')
    while ((m = re.exec(text))) {
      if (tokenHits(m[0], parts)) {
        if (m.index > last)
          out.push({ text: text.slice(last, m.index), hit: false })
        out.push({ text: m[0], hit: true })
        last = m.index + m[0].length
      }
    }
    if (last < text.length)
      out.push({ text: text.slice(last), hit: false })
    return out
  }

  function meaningsOverlap(a, b) {
    const x = senseCandidates(a.meaning, a.pos)
    const y = senseCandidates(b.meaning, b.pos)
    return x.some(p => y.some((q) => {
      if (p === q)
        return true
      const [short, long] = p.length <= q.length ? [p, q] : [q, p]
      return short.length >= 2 && long.includes(short)
    }))
  }

  function sameSpelling(a, b) {
    const x = a.words.map(normalizeEn)
    return b.words.some(v => x.includes(normalizeEn(v)))
  }

  function firstPos(pos) {
    return String(pos || '').split(/[./]/)[0]
  }

  function shuffle(list, rng = Math.random) {
    const a = list.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /**
   * Pick n wrong options. Same chapter and part of speech first; never the same
   * synonym group, the same spelling, or a meaning that overlaps (no second right answer).
   */
  function pickDistractors(target, pool, n = 3, rng = Math.random) {
    const tPos = firstPos(target.pos)
    const tiers = [
      w => w.chapter === target.chapter && firstPos(w.pos) === tPos,
      w => w.chapter === target.chapter,
      w => firstPos(w.pos) === tPos,
      () => true,
    ]
    const chosen = []
    const tried = new Set([target.id])
    for (const tier of tiers) {
      if (chosen.length >= n)
        break
      const candidates = shuffle(pool.filter(w => !tried.has(w.id) && tier(w)), rng)
      for (const w of candidates) {
        if (chosen.length >= n)
          break
        tried.add(w.id)
        if (w.chapter === target.chapter && w.group === target.group)
          continue
        if (sameSpelling(target, w) || meaningsOverlap(target, w))
          continue
        if (chosen.some(c => sameSpelling(c, w) || meaningsOverlap(c, w)))
          continue
        chosen.push(w)
      }
    }
    return chosen
  }

  // Progress record per word and direction: [right, wrong, streak, unixSeconds, last('r'|'c'|'w')]
  function statusOf(rec) {
    if (!rec)
      return 'new'
    if (rec[2] >= 2)
      return 'mastered'
    if (rec[1] > 0 || rec[4] === 'c' || rec[4] === 'w')
      return 'review'
    return 'learning'
  }

  function matchesSource(rec, source) {
    const st = statusOf(rec)
    if (source === 'new')
      return st === 'new'
    if (source === 'weak')
      return st !== 'mastered'
    if (source === 'wrong')
      return st === 'review'
    return true
  }

  function applyResult(rec, result, now) {
    const r = rec ? rec.slice() : [0, 0, 0, 0, '']
    if (result === 'right') {
      r[0]++
      r[2]++
    }
    else {
      if (result === 'wrong')
        r[1]++
      r[2] = 0
    }
    r[3] = now
    r[4] = result === 'right' ? 'r' : result === 'close' ? 'c' : 'w'
    return r
  }

  /** Build the ordered list of word ids for a session. */
  function buildQueue(words, cfg, progressDir, rng = Math.random) {
    const scope = cfg.chapter === 'all' ? words : words.filter(w => w.chapter === cfg.chapter)
    let list = scope.filter(w => matchesSource(progressDir[w.id], cfg.source))
    if (cfg.order === 'random')
      list = shuffle(list, rng)
    if (cfg.count > 0)
      list = list.slice(0, cfg.count)
    return list.map(w => w.id)
  }

  return {
    stripPhonetics,
    normalizeZh,
    normalizeEn,
    senseCandidates,
    judgeZh,
    judgeEn,
    levenshtein,
    maskMeaning,
    markWord,
    meaningsOverlap,
    pickDistractors,
    shuffle,
    statusOf,
    matchesSource,
    applyResult,
    buildQueue,
  }
})
