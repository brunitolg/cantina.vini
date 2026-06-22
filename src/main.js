import { loadVini, aggiornaQty, syncOffline, loadOrdini, creaOrdini, confermaOrdine, realtimeSub } from './db.js'
import { Voice } from './voice.js'
import { offline } from './offline.js'

let vini = [], ordini = [], isOffline = !navigator.onLine, query = ''

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, ms = 2800) {
  const el = document.getElementById('toast')
  el.textContent = msg; el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), ms)
}

// ── Status bar ────────────────────────────────────────────────────
function setStatus(type, txt) {
  const el = document.getElementById('status')
  el.className = 'status ' + type
  el.textContent = (type === 'online' ? '● ' : type === 'sync' ? '↻ ' : '⚠ ') + txt
}

// ── Render cantina ────────────────────────────────────────────────
function render() {
  const list = vini.filter(v =>
    !query || v.vino.toLowerCase().includes(query) || v.cantina.toLowerCase().includes(query))

  const tot = vini.reduce((s,v) => s + (v.quantita||0), 0)
  const ord = vini.reduce((s,v) => s + (v.in_ordine||0), 0)
  document.getElementById('sTot').textContent = tot
  document.getElementById('sOrd').textContent = ord

  const grouped = {}
  list.forEach(v => { if (!grouped[v.cantina]) grouped[v.cantina] = []; grouped[v.cantina].push(v) })
  const cantine = Object.keys(grouped).sort()

  const container = document.getElementById('cardList')
  // Tieni aperte le cantina già aperte
  const open = new Set([...container.querySelectorAll('.card.open')].map(el => el.dataset.c))

  if (!cantine.length) { container.innerHTML = '<div class="empty">Nessun risultato</div>'; return }

  container.innerHTML = cantine.map(c => {
    const vs = grouped[c]
    const totC = vs.reduce((s,v) => s + (v.quantita||0), 0)
    const ordC = vs.reduce((s,v) => s + (v.in_ordine||0), 0)
    const badge = ordC > 0 ? `<span class="badge ord">ord. ${ordC}</span>` : `<span class="badge neu">—</span>`
    const isOpen = open.has(c) || query
    const rows = vs.map(v => {
      const qc = v.quantita === 0 ? 'z' : v.quantita <= 3 ? 'l' : 'ok'
      const pa = v.prezzo_acquisto ? `acq. €${Number(v.prezzo_acquisto).toFixed(2)}` : ''
      const pv = v.prezzo_vendita ? `vend. €${Number(v.prezzo_vendita).toFixed(2)}` : ''
      const pr = [pa,pv].filter(Boolean).join(' · ')
      return `<div class="vrow" data-id="${v.id}">
        <div class="vinfo"><div class="vname">${v.vino}</div>${pr ? `<div class="vprice">${pr}</div>` : ''}</div>
        <div class="qctrl">
          <button class="qbtn" data-id="${v.id}" data-d="-1">−</button>
          <span class="qnum ${qc}" id="q${v.id}">${v.quantita}</span>
          <button class="qbtn" data-id="${v.id}" data-d="1">+</button>
        </div>
      </div>`
    }).join('')
    return `<div class="card${isOpen?' open':''}" data-c="${c}">
      <div class="card-hdr">
        <div><div class="card-name">${c}</div><div class="card-sub">${vs.length} vini · ${totC} bott.</div></div>
        <div class="card-right">${badge}<span class="chev">⌄</span></div>
      </div>
      <div class="vini">${rows}</div>
    </div>`
  }).join('')

  // Toggle
  container.querySelectorAll('.card-hdr').forEach(h => {
    h.addEventListener('click', () => h.closest('.card').classList.toggle('open'))
  })
  // Qty buttons
  container.querySelectorAll('.qbtn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      await changeQty(parseInt(btn.dataset.id), parseInt(btn.dataset.d))
    })
  })
}

async function changeQty(id, delta) {
  const v = vini.find(v => v.id === id)
  if (!v) return
  v.quantita = Math.max(0, (v.quantita||0) + delta)
  // Aggiorna solo il numero senza re-render completo
  const el = document.getElementById('q' + id)
  if (el) {
    el.textContent = v.quantita
    el.className = 'qnum ' + (v.quantita === 0 ? 'z' : v.quantita <= 3 ? 'l' : 'ok')
  }
  // Aggiorna stats
  document.getElementById('sTot').textContent = vini.reduce((s,v) => s + (v.quantita||0), 0)

  const res = await aggiornaQty(id, delta)
  if (res.queued) {
    setStatus('offline', `Offline — ${offline.queue().length} in coda`)
    toast('💾 Salvato in locale')
  }
}

// ── Render ordini ─────────────────────────────────────────────────
function renderOrdini() {
  const el = document.getElementById('ordList')
  if (!ordini.length) { el.innerHTML = '<div class="empty">Nessun ordine registrato</div>'; return }
  el.innerHTML = ordini.map(o => `
    <div class="ord-card">
      <div>
        <div class="ord-name">${o.cantina}</div>
        <div class="ord-meta">${o.data_ordine}</div>
        <span class="ord-stato ${o.stato==='consegnato'?'d':'w'}">${o.stato==='consegnato'?'✓ Consegnato':'⏳ In attesa'}</span>
        ${o.stato==='in_attesa'?`<button class="conf-btn" onclick="window._conf(${o.id},'${o.cantina.replace(/'/g,"\\'")}')">Conferma arrivo →</button>`:''}
      </div>
      <div class="ord-r">
        <div class="ord-bott">${o.totale_bottiglie} bott.</div>
        <div class="ord-imp">€ ${o.totale_spesa ? Number(o.totale_spesa).toFixed(2) : '—'}</div>
      </div>
    </div>`).join('')
}

// Conferma ordine globale
window._conf = async (id, cantina) => {
  const n = await confermaOrdine(id, cantina)
  const { data } = await loadVini()
  vini = data; render()
  ordini = await loadOrdini(); renderOrdini()
  toast(`✓ Ordine confermato! ${n} vini aggiornati`)
}

// ── Voce ──────────────────────────────────────────────────────────
const voice = new Voice(
  async (r) => {
    document.getElementById('vRes').textContent = `"${r.raw}"`
    document.getElementById('voiceBtn').classList.remove('on')
    document.getElementById('vHint').textContent = 'Tieni premuto • parla in italiano'

    if (r.action === 'cerca') {
      query = r.search
      document.getElementById('searchEl').value = r.search
      render(); return
    }
    if (!r.action || !r.search) { toast('Non ho capito, riprova 🎤'); return }

    const q = r.search.toLowerCase()
    const match = vini.find(v => v.vino.toLowerCase().includes(q)) ||
      vini.find(v => q.split(' ').some(w => w.length > 3 && v.vino.toLowerCase().includes(w))) ||
      vini.find(v => v.cantina.toLowerCase().includes(q))

    if (!match) { toast(`❌ Vino non trovato: "${r.search}"`); return }

    const delta = r.action === 'sub' ? -r.qty : r.qty
    toast(`${delta > 0 ? '+' : ''}${delta} ${match.vino}`)
    await changeQty(match.id, delta)
  },
  err => {
    toast(err)
    document.getElementById('voiceBtn').classList.remove('on')
  }
)

let vTimer
const vBtn = document.getElementById('voiceBtn')
const startVoice = () => {
  vTimer = setTimeout(() => {
    vBtn.classList.add('on')
    document.getElementById('vHint').textContent = 'Sto ascoltando...'
    document.getElementById('vRes').textContent = ''
    voice.start()
  }, 150)
}
const stopVoice = () => { clearTimeout(vTimer); voice.stop() }
vBtn.addEventListener('touchstart', e => { e.preventDefault(); startVoice() })
vBtn.addEventListener('touchend', stopVoice)
vBtn.addEventListener('mousedown', startVoice)
vBtn.addEventListener('mouseup', stopVoice)

// ── Search ────────────────────────────────────────────────────────
document.getElementById('searchEl').addEventListener('input', e => {
  query = e.target.value.toLowerCase().trim(); render()
})

// ── Nav ───────────────────────────────────────────────────────────
document.querySelectorAll('.nitem').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nitem').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(btn.dataset.p).classList.add('active')
    if (btn.dataset.p === 'pOrdini') renderOrdini()
  })
})

// ── Sync ──────────────────────────────────────────────────────────
document.getElementById('syncBtn').addEventListener('click', async () => {
  if (!navigator.onLine) { toast('⚠ Sei offline'); return }
  setStatus('sync', 'Sincronizzazione...')
  const n = await syncOffline()
  const { data } = await loadVini(); vini = data; render()
  ordini = await loadOrdini()
  setStatus('online', 'Sincronizzato')
  if (n > 0) toast(`✓ ${n} modifica/he sincronizzata/e`)
})

// ── Ordini ────────────────────────────────────────────────────────
document.getElementById('newOrdBtn').addEventListener('click', async () => {
  setStatus('sync', 'Creazione ordini...')
  const n = await creaOrdini()
  ordini = await loadOrdini(); renderOrdini()
  setStatus('online', 'Sincronizzato')
  toast(n > 0 ? `✓ ${n} ordine/i creato/i` : '⚠ Nessun vino in ordine')
})

// ── Online/Offline ────────────────────────────────────────────────
window.addEventListener('online', async () => {
  isOffline = false; setStatus('sync', 'Di nuovo online...')
  const n = await syncOffline()
  const { data } = await loadVini(); vini = data; render()
  setStatus('online', 'Sincronizzato')
  if (n > 0) toast(`✓ ${n} modifica/he sincronizzata/e`)
  else toast('✓ Sei di nuovo online!')
})
window.addEventListener('offline', () => {
  isOffline = true
  setStatus('offline', 'Offline — continua pure, salvo tutto')
  toast('⚠ Sei offline — le modifiche vengono salvate')
})

// ── Realtime ──────────────────────────────────────────────────────
realtimeSub(async () => {
  if (navigator.onLine) {
    const { data } = await loadVini(); vini = data; render()
  }
})

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  try {
    const { data, isOffline: off } = await loadVini()
    vini = data; isOffline = off
    setStatus(off ? 'offline' : 'online', off ? 'Offline — dati dalla cache' : 'Online')
    render()
    ordini = await loadOrdini()
  } catch(e) {
    setStatus('offline', 'Errore di connessione')
    document.getElementById('cardList').innerHTML = '<div class="empty">❌ Impossibile caricare i dati</div>'
  }
}
init()
