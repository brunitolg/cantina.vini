export class Voice {
  constructor(onResult, onError) {
    this.onResult = onResult; this.onError = onError; this.rec = null; this.active = false
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    this.rec = new SR(); this.rec.lang = 'it-IT'; this.rec.continuous = false; this.rec.interimResults = false
    this.rec.onresult = (e) => { this.active = false; this._parse(e.results[0][0].transcript.toLowerCase().trim()) }
    this.rec.onerror = (e) => { this.active = false; this.onError('Errore: ' + e.error) }
    this.rec.onend = () => { this.active = false }
  }
  start() { if (!this.rec) { this.onError('Microfono non disponibile'); return }; this.active = true; this.rec.start() }
  stop() { if (this.rec && this.active) { this.rec.stop(); this.active = false } }
  _parse(text) {
    const r = { raw: text, action: null, qty: 1, search: '' }
    const nm = text.match(/\b(\d+|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/)
    if (nm) { const w={uno:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10}; r.qty = w[nm[1]] || parseInt(nm[1]) }
    let c = text.replace(/\b(\d+|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\b/,'').trim()
    if (/togli|tolgo|preso|venduto|aperto|scarica|rimuovi/.test(text)) { r.action='sub'; c=c.replace(/togli|tolgo|preso|venduto|aperto|scarica|rimuovi|bottigli[ae]?\s*di|bottigli[ae]?/g,'').trim() }
    else if (/aggiungi|aggiungo|arrivat[oi]|metti|carica|ricevut[oi]/.test(text)) { r.action='add'; c=c.replace(/aggiungi|aggiungo|arrivat[oi]|metti|carica|ricevut[oi]|bottigli[ae]?\s*di|bottigli[ae]?/g,'').trim() }
    else if (/quant[eo]|cerca|mostra/.test(text)) { r.action='cerca'; c=c.replace(/quant[eo]|cerca|mostra|ho|rimast[eo]|bottigli[ae]?\s*di/g,'').trim() }
    r.search = c.replace(/\s+/g,' ').trim(); this.onResult(r)
  }
}
