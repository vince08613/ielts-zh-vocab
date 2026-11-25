/* Pronunciation: dictionary recordings from the my-ielts site, system speech as fallback. */
(function () {
  'use strict'
  const V = window.VocabApp
  const AUDIO_BASE = 'https://hefengxian.github.io/my-ielts/vocabulary/audio/'
  const failed = new Set()
  let audio = null

  function pickVoice(lang) {
    const voices = window.speechSynthesis.getVoices()
    const norm = v => v.lang.replace('_', '-')
    return voices.find(v => norm(v) === lang && v.localService)
      || voices.find(v => norm(v) === lang)
      || voices.find(v => norm(v).startsWith('en'))
  }

  function tts(text) {
    if (!('speechSynthesis' in window)) {
      V.toast('此设备不支持语音播放')
      return 'none'
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = V.store.settings.accent
    u.rate = 0.9
    const voice = pickVoice(u.lang)
    if (voice)
      u.voice = voice
    synth.speak(u)
    return 'tts'
  }

  V.canPlayAudio = () => ('speechSynthesis' in window) || navigator.onLine !== false

  /**
   * Read any English text with the system voice (examiner questions, Section 1 dictation).
   * Resolves 'end' when finished, 'none' without speech support. opts: { rate, lang }.
   */
  V.say = (text, opts = {}) => new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      V.toast('此设备不支持语音播放')
      return resolve('none')
    }
    const synth = window.speechSynthesis
    synth.cancel()
    if (audio)
      audio.pause()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = opts.lang || V.store.settings.accent
    u.rate = opts.rate || 0.92
    const voice = pickVoice(u.lang)
    if (voice)
      u.voice = voice
    let done = false
    const finish = (how) => {
      if (!done) {
        done = true
        resolve(how)
      }
    }
    u.onend = () => finish('end')
    u.onerror = () => finish('end')
    synth.speak(u)
    // Some engines never fire onend: stop waiting after a generous estimate.
    setTimeout(() => finish('end'), 2000 + text.length * 120 / u.rate)
  })

  V.stopSpeech = () => {
    if ('speechSynthesis' in window)
      window.speechSynthesis.cancel()
    if (audio)
      audio.pause()
  }

  /** Play a word. Resolves to 'dict' | 'tts' | 'none' | 'blocked' (autoplay needs a tap). */
  V.speak = word => new Promise((resolve) => {
    if (!word)
      return resolve('none')
    const text = word.words[0]
    if (V.store.settings.voice !== 'dict' || navigator.onLine === false)
      return resolve(tts(text))
    const chapter = V.data.chapters[word.chapter].key
    const tpl = V.data.chapters[word.chapter].audio
    const url = tpl ? tpl.replace('{w}', encodeURIComponent(text)) : `${AUDIO_BASE}${encodeURIComponent(chapter)}/${encodeURIComponent(text)}.mp3`
    if (failed.has(url))
      return resolve(tts(text))
    if ('speechSynthesis' in window)
      window.speechSynthesis.cancel()
    if (!audio) {
      audio = new Audio()
      audio.preload = 'auto'
    }
    audio.pause()
    let settled = false
    const fallback = () => {
      if (settled)
        return
      settled = true
      failed.add(url)
      resolve(tts(text))
    }
    audio.onerror = fallback
    audio.onplaying = () => {
      settled = true
      resolve('dict')
    }
    audio.src = url
    const p = audio.play()
    if (p && p.catch) {
      p.catch((err) => {
        // Autoplay blocked: wait for the next tap instead of switching sources.
        if (err && err.name === 'NotAllowedError') {
          settled = true
          resolve('blocked')
        }
        else if (err && err.name !== 'AbortError')
          fallback()
      })
    }
  })

  // Some browsers load voices asynchronously.
  if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined)
    window.speechSynthesis.onvoiceschanged = () => {}
})()
