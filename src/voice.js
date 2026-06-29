// Voice manager ottimizzato per iPhone Safari
// Usa tap-to-toggle invece di long press

export class Voice {
  constructor(onResult, onError, onStateChange) {
    this.onResult = onResult
    this.onError = onError
    this.onStateChange = onStateChange // callback: 'idle' | 'listening' | 'processing'
    this.rec = null
    this.listening = false
    this._init()
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      console.warn('SpeechRecognition non supportato')
      return
    }
    this._SR = SR
  }

  // Crea una nuova istanza ogni volta (iOS Safari richiede questo)
  _createRec() {
    const rec = new this._SR()
    rec.lang = 'it-IT'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3

    rec.onstart = () => {
      this.listening = true
      this.onStateChange('listening')
    }

    rec.onresult = (e) => {
      this.listening = false
      this.onStateChange('processing')
      // Prova tutte le alternative
      const transcript = e.results[0][0].transcript.toLowerCase().trim()
      this._parse(transcript)
    }

    rec.onnomatch = () => {
      this.listening = false
      this.onStateChange('idle')
      this.onError('Non ho capito, riprova')
    }

    rec.onerror = (e) => {
      this.listening = false
      this.onStateChange('idle')
      if (e.error === 'no-speech') {
        this.onError('Nessun suono rilevato — riprova')
      } else if (e.error === 'not-allowed') {
        this.onError('Microfono non autorizzato — controlla le impostazioni')
      } else {
        this.onError('Errore: ' + e.error)
      }
    }

    rec.onend = () => {
      // iOS Safari termina automaticamente — aggiorna stato
      if (this.listening) {
        this.listening = false
        this.onStateChange('idle')
      }
    }

    return rec
  }

  toggle() {
    if (!this._SR) {
      this.onError('Riconoscimento vocale non disponibile su questo browser')
      return
    }
    if (this.listening) {
      this.stop()
    } else {
      this.start()
    }
  }

  start() {
    if (this.listening) return
    try {
      this.rec = this._createRec()
      this.rec.start()
    } catch(e) {
      this.listening = false
      this.onStateChange('idle')
      this.onError('Impossibile avviare il microfono')
    }
  }

  stop() {
    if (this.rec) {
      try { this.rec.stop() } catch(e) {}
    }
    this.listening = false
    this.onStateChange('idle')
  }

  _parse(text) {
    const r = { raw: text, action: null, qty: 1, search: '' }

    // Estrai quantità
    const nm = text.match(/\b(\d+|un[oa]?|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici|venti|ventiquattro|trenta|quaranta|cinquanta|sessanta)\b/)
    if (nm) {
      const w = { uno:1, una:1, un:1, due:2, tre:3, quattro:4, cinque:5, sei:6, sette:7, otto:8, nove:9, dieci:10, dodici:12, venti:20, ventiquattro:24, trenta:30, quaranta:40, cinquanta:50, sessanta:60 }
      r.qty = w[nm[1]] || parseInt(nm[1]) || 1
    }

    let clean = text.replace(/\b(\d+|un[oa]?|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|dodici|venti|ventiquattro|trenta|quaranta|cinquanta|sessanta)\b/, '').trim()

    // Determina azione
    if (/\b(togli|tolgo|ho preso|ho venduto|venduto|preso|aperto|scarica|rimuovi|meno)\b/.test(text)) {
      r.action = 'sub'
      clean = clean.replace(/\b(togli|tolgo|ho preso|ho venduto|venduto|preso|aperto|scarica|rimuovi|meno|bottigli[ae]?\s*di|bottigli[ae]?)\b/g, '').trim()
    } else if (/\b(aggiungi|aggiungo|arrivat[oi]|arrivata|metti|carica|ricevut[oi]|più)\b/.test(text)) {
      r.action = 'add'
      clean = clean.replace(/\b(aggiungi|aggiungo|arrivat[oi]|arrivata|metti|carica|ricevut[oi]|più|bottigli[ae]?\s*di|bottigli[ae]?)\b/g, '').trim()
    } else if (/\b(quant[eo]|cerca|mostra|trova|ho)\b/.test(text)) {
      r.action = 'cerca'
      clean = clean.replace(/\b(quant[eo]|cerca|mostra|trova|ho|rimast[eo]|bottigli[ae]?\s*di)\b/g, '').trim()
    }

    r.search = clean.replace(/\s+/g, ' ').trim()
    this.onResult(r)
  }
}
