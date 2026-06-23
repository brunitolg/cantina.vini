import { loadVini, aggiornaQty, syncOffline, loadOrdini, creaOrdineAuto, creaOrdineManuele, eliminaOrdine, confermaOrdine, realtimeSub, aggiungiVino, aggiornaVino, eliminaVino } from './db.js'
import { Voice } from './voice.js'
import { offline } from './offline.js'

let vini = [], ordini = [], isOffline = !navigator.onLine, query = ''

// ── Utility ───────────────────────────────────────────────────────
function toast(msg, ms=2800) {
  const el = document.getElementById('toast')
  el.textContent = msg; el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), ms)
}
function setStatus(type, txt) {
  const el = document.getElementById('status')
  el.className = 'status ' + type
  el.textContent = (type==='online'?'● ':type==='sync'?'↻ ':'⚠ ') + txt
}
function getCantine() { return [...new Set(vini.map(v => v.cantina))].sort() }

// ── CANTINA ───────────────────────────────────────────────────────
function render() {
  const list = vini.filter(v => !query || v.vino.toLowerCase().includes(query) || v.cantina.toLowerCase().includes(query))
  document.getElementById('sTot').textContent = vini.reduce((s,v) => s+(v.quantita||0), 0)
  document.getElementById('sOrd').textContent = vini.reduce((s,v) => s+(v.in_ordine||0), 0)
  const grouped = {}
  list.forEach(v => { if(!grouped[v.cantina]) grouped[v.cantina]=[]; grouped[v.cantina].push(v) })
  const cantine = Object.keys(grouped).sort()
  const container = document.getElementById('cardList')
  const open = new Set([...container.querySelectorAll('.card.open')].map(el => el.dataset.c))
  if (!cantine.length) { container.innerHTML = '<div class="empty">Nessun risultato</div>'; return }
  container.innerHTML = cantine.map(c => {
    const vs = grouped[c]
    const totC = vs.reduce((s,v) => s+(v.quantita||0), 0)
    const ordC = vs.reduce((s,v) => s+(v.in_ordine||0), 0)
    const badge = ordC > 0 ? `<span class="badge ord">ord. ${ordC}</span>` : `<span class="badge neu">—</span>`
    const isOpen = open.has(c) || !!query
    const rows = vs.map(v => {
      const qc = v.quantita===0?'z':v.quantita<=3?'l':'ok'
      const pa = v.prezzo_acquisto ? `acq. €${Number(v.prezzo_acquisto).toFixed(2)}` : ''
      const pv = v.prezzo_vendita ? `vend. €${Number(v.prezzo_vendita).toFixed(2)}` : ''
      const pr = [pa,pv].filter(Boolean).join(' · ')
      return `<div class="vrow"><div class="vinfo"><div class="vname">${v.vino}</div>${pr?`<div class="vprice">${pr}</div>`:''}</div>
        <div class="qctrl">
          <button class="qbtn" data-id="${v.id}" data-d="-1">−</button>
          <span class="qnum ${qc}" id="q${v.id}">${v.quantita}</span>
          <button class="qbtn" data-id="${v.id}" data-d="1">+</button>
        </div></div>`
    }).join('')
    return `<div class="card${isOpen?' open':''}" data-c="${c}">
      <div class="card-hdr">
        <div><div class="card-name">${c}</div><div class="card-sub">${vs.length} vini · ${totC} bott.</div></div>
        <div class="card-right">${badge}<span class="chev">⌄</span></div>
      </div>
      <div class="vini">${rows}</div></div>`
  }).join('')
  container.querySelectorAll('.card-hdr').forEach(h => h.addEventListener('click', () => h.closest('.card').classList.toggle('open')))
  container.querySelectorAll('.qbtn').forEach(btn => btn.addEventListener('click', async e => {
    e.stopPropagation(); await changeQty(parseInt(btn.dataset.id), parseInt(btn.dataset.d))
  }))
}

async function changeQty(id, delta) {
  const v = vini.find(v => v.id===id); if (!v) return
  v.quantita = Math.max(0, (v.quantita||0)+delta)
  const el = document.getElementById('q'+id)
  if (el) { el.textContent = v.quantita; el.className = 'qnum '+(v.quantita===0?'z':v.quantita<=3?'l':'ok') }
  document.getElementById('sTot').textContent = vini.reduce((s,v) => s+(v.quantita||0), 0)
  const res = await aggiornaQty(id, delta)
  if (res.queued) { setStatus('offline', `Offline — ${offline.queue().length} in coda`); toast('💾 Salvato in locale') }
}

// ── ORDINI ────────────────────────────────────────────────────────
function renderOrdini() {
  const el = document.getElementById('ordList')
  if (!ordini.length) { el.innerHTML = '<div class="empty">Nessun ordine registrato</div>'; return }
  el.innerHTML = ordini.map(o => `
    <div class="ord-card">
      <div class="ord-top">
        <div>
          <div class="ord-name">${o.cantina}</div>
          <div class="ord-meta">${o.data_ordine}${o.note ? ' · ' + o.note : ''}</div>
          <span class="ord-stato ${o.stato==='consegnato'?'d':'w'}">${o.stato==='consegnato'?'✓ Consegnato':'⏳ In attesa'}</span>
        </div>
        <div class="ord-r">
          <div class="ord-bott">${o.totale_bottiglie} bott.</div>
          <div class="ord-imp">€ ${o.totale_spesa ? Number(o.totale_spesa).toFixed(2) : '—'}</div>
        </div>
      </div>
      <div class="ord-actions">
        ${o.stato==='in_attesa'?`<button class="ord-btn conf" data-id="${o.id}" data-c="${o.cantina}">✓ Conferma arrivo</button>`:''}
        <button class="ord-btn del" data-id="${o.id}">🗑 Elimina</button>
      </div>
    </div>`).join('')
  el.querySelectorAll('.ord-btn.conf').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Confermare l\'arrivo? Le quantità verranno aggiornate in automatico.')) return
    const n = await confermaOrdine(parseInt(btn.dataset.id), btn.dataset.c)
    const { data } = await loadVini(); vini = data; render()
    ordini = await loadOrdini(); renderOrdini()
    toast(`✓ ${n} vini aggiornati!`)
  }))
  el.querySelectorAll('.ord-btn.del').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Eliminare questo ordine?')) return
    await eliminaOrdine(parseInt(btn.dataset.id))
    ordini = ordini.filter(o => o.id !== parseInt(btn.dataset.id))
    renderOrdini(); toast('🗑 Ordine eliminato')
  }))
}

// Ordine automatico
document.getElementById('btnOrdAuto').addEventListener('click', async () => {
  setStatus('sync', 'Creazione ordini...')
  const n = await creaOrdineAuto()
  ordini = await loadOrdini(); renderOrdini()
  setStatus('online', 'Sincronizzato')
  toast(n > 0 ? `✓ ${n} ordine/i creato/i` : '⚠ Nessun vino ha quantità "in ordine"')
})

// Ordine manuale — apri modal
document.getElementById('btnOrdManuale').addEventListener('click', () => {
  const sel = document.getElementById('oCantinaSelect')
  sel.innerHTML = getCantine().map(c => `<option value="${c}">${c}</option>`).join('')
  document.getElementById('oData').value = new Date().toISOString().split('T')[0]
  document.getElementById('oTotBott').value = ''
  document.getElementById('oTotSpesa').value = ''
  document.getElementById('oNote').value = ''
  document.getElementById('modalOrdine').classList.add('open')
})
document.getElementById('modalOrdineClose').addEventListener('click', () => document.getElementById('modalOrdine').classList.remove('open'))
document.getElementById('formOrdine').addEventListener('submit', async e => {
  e.preventDefault()
  const cantina = document.getElementById('oCantinaSelect').value
  const tot_bott = parseInt(document.getElementById('oTotBott').value)
  if (!cantina || !tot_bott) { toast('⚠ Cantina e totale bottiglie obbligatori'); return }
  const dati = {
    cantina, totale_bottiglie: tot_bott,
    totale_spesa: parseFloat(document.getElementById('oTotSpesa').value) || 0,
    data_ordine: document.getElementById('oData').value || new Date().toISOString().split('T')[0],
    nota: document.getElementById('oNote').value || null,
    stato: 'in_attesa'
  }
  const nuovo = await creaOrdineManuele(dati)
  ordini.unshift(nuovo); renderOrdini()
  document.getElementById('modalOrdine').classList.remove('open')
  toast('✓ Ordine creato!')
})

// ── GESTIONE VINI ─────────────────────────────────────────────────
function renderGestione() {
  const filtro = document.getElementById('gFiltro').value
  const lista = filtro ? vini.filter(v => v.cantina===filtro) : [...vini]
  lista.sort((a,b) => a.cantina.localeCompare(b.cantina) || a.vino.localeCompare(b.vino))
  // Aggiorna filtro select
  const sel = document.getElementById('gFiltro')
  const curr = sel.value
  sel.innerHTML = `<option value="">Tutte le cantine</option>` + getCantine().map(c => `<option value="${c}"${c===curr?' selected':''}>${c}</option>`).join('')
  const grouped = {}
  lista.forEach(v => { if(!grouped[v.cantina]) grouped[v.cantina]=[]; grouped[v.cantina].push(v) })
  const container = document.getElementById('gList')
  if (!lista.length) { container.innerHTML = '<div class="empty">Nessun vino</div>'; return }
  container.innerHTML = Object.entries(grouped).map(([c,vs]) => `
    <div class="g-section">
      <div class="g-cantina-label">${c}</div>
      ${vs.map(v => `<div class="g-row">
        <div class="g-vname">${v.vino}</div>
        <div class="g-meta">qty: <strong>${v.quantita}</strong>${v.prezzo_vendita ? ` · vend. €${Number(v.prezzo_vendita).toFixed(0)}` : ''}${v.in_ordine ? ` · ord. ${v.in_ordine}` : ''}</div>
        <div class="g-btns">
          <button class="g-btn edit" data-id="${v.id}">✏️ Modifica</button>
          <button class="g-btn del" data-id="${v.id}">🗑 Elimina</button>
        </div></div>`).join('')}
    </div>`).join('')
  container.querySelectorAll('.g-btn.edit').forEach(btn => btn.addEventListener('click', () => apriModificaVino(parseInt(btn.dataset.id))))
  container.querySelectorAll('.g-btn.del').forEach(btn => btn.addEventListener('click', () => eliminaVinoUI(parseInt(btn.dataset.id))))
}

function apriModificaVino(id) {
  const v = vini.find(v => v.id===id); if (!v) return
  document.getElementById('modalVinoTitolo').textContent = 'Modifica vino'
  document.getElementById('mId').value = v.id
  aggiornaSelectCantina(v.cantina)
  document.getElementById('mVino').value = v.vino
  document.getElementById('mQty').value = v.quantita
  document.getElementById('mPa').value = v.prezzo_acquisto || ''
  document.getElementById('mPv').value = v.prezzo_vendita || ''
  document.getElementById('mOrd').value = v.in_ordine || 0
  document.getElementById('modalVino').classList.add('open')
}

async function eliminaVinoUI(id) {
  const v = vini.find(v => v.id===id); if (!v) return
  if (!confirm(`Eliminare "${v.vino}" da ${v.cantina}?`)) return
  await eliminaVino(id)
  vini = vini.filter(v => v.id!==id)
  render(); renderGestione(); toast('🗑 Vino eliminato')
}

function aggiornaSelectCantina(selected='') {
  const sel = document.getElementById('mCantinaSelect')
  sel.innerHTML = getCantine().map(c => `<option value="${c}"${c===selected?' selected':''}>${c}</option>`).join('') +
    `<option value="__nuova__">+ Nuova cantina...</option>`
}

// Nuovo vino
document.getElementById('btnNuovoVino').addEventListener('click', () => {
  document.getElementById('modalVinoTitolo').textContent = 'Nuovo vino'
  document.getElementById('mId').value = ''
  aggiornaSelectCantina()
  document.getElementById('mVino').value = ''
  document.getElementById('mQty').value = '0'
  document.getElementById('mPa').value = ''
  document.getElementById('mPv').value = ''
  document.getElementById('mOrd').value = '0'
  document.getElementById('nuovaCantinaWrap').style.display = 'none'
  document.getElementById('modalVino').classList.add('open')
})
document.getElementById('mCantinaSelect').addEventListener('change', e => {
  document.getElementById('nuovaCantinaWrap').style.display = e.target.value==='__nuova__' ? 'block' : 'none'
})
document.getElementById('modalVinoClose').addEventListener('click', () => document.getElementById('modalVino').classList.remove('open'))

document.getElementById('formVino').addEventListener('submit', async e => {
  e.preventDefault()
  const id = document.getElementById('mId').value
  const selVal = document.getElementById('mCantinaSelect').value
  const cantina = selVal==='__nuova__'
    ? document.getElementById('mNuovaCantina').value.trim().toUpperCase()
    : selVal
  const dati = {
    cantina,
    vino: document.getElementById('mVino').value.trim(),
    quantita: parseInt(document.getElementById('mQty').value) || 0,
    prezzo_acquisto: parseFloat(document.getElementById('mPa').value) || null,
    prezzo_vendita: parseFloat(document.getElementById('mPv').value) || null,
    in_ordine: parseInt(document.getElementById('mOrd').value) || 0
  }
  if (!dati.cantina || !dati.vino) { toast('⚠ Cantina e nome vino obbligatori'); return }
  try {
    if (id) {
      await aggiornaVino(parseInt(id), dati)
      const idx = vini.findIndex(v => v.id===parseInt(id))
      if (idx>=0) vini[idx] = { ...vini[idx], ...dati }
      toast('✓ Vino aggiornato')
    } else {
      const nuovo = await aggiungiVino(dati)
      vini.push(nuovo)
      toast('✓ Vino aggiunto!')
    }
    document.getElementById('modalVino').classList.remove('open')
    render(); renderGestione()
  } catch(err) { toast('❌ Errore: ' + err.message) }
})
document.getElementById('gFiltro').addEventListener('change', renderGestione)

// ── VOCE ──────────────────────────────────────────────────────────
const voice = new Voice(
  async (r) => {
    document.getElementById('vRes').textContent = `"${r.raw}"`
    document.getElementById('voiceBtn').classList.remove('on')
    document.getElementById('vHint').textContent = 'Tieni premuto • parla in italiano'
    if (r.action==='cerca') { query=r.search; document.getElementById('searchEl').value=r.search; render(); return }
    if (!r.action||!r.search) { toast('Non ho capito, riprova 🎤'); return }
    const q = r.search.toLowerCase()
    const match = vini.find(v => v.vino.toLowerCase().includes(q)) ||
      vini.find(v => q.split(' ').some(w => w.length>3 && v.vino.toLowerCase().includes(w))) ||
      vini.find(v => v.cantina.toLowerCase().includes(q))
    if (!match) { toast(`❌ Non trovato: "${r.search}"`); return }
    const delta = r.action==='sub' ? -r.qty : r.qty
    toast(`${delta>0?'+':''}${delta} ${match.vino}`)
    await changeQty(match.id, delta)
  },
  err => { toast(err); document.getElementById('voiceBtn').classList.remove('on') }
)
let vTimer
const vBtn = document.getElementById('voiceBtn')
const startV = () => { vTimer = setTimeout(() => { vBtn.classList.add('on'); document.getElementById('vHint').textContent='Sto ascoltando...'; document.getElementById('vRes').textContent=''; voice.start() }, 150) }
const stopV = () => { clearTimeout(vTimer); voice.stop() }
vBtn.addEventListener('touchstart', e => { e.preventDefault(); startV() })
vBtn.addEventListener('touchend', stopV)
vBtn.addEventListener('mousedown', startV)
vBtn.addEventListener('mouseup', stopV)

// ── SEARCH ────────────────────────────────────────────────────────
document.getElementById('searchEl').addEventListener('input', e => { query=e.target.value.toLowerCase().trim(); render() })

// ── NAV ───────────────────────────────────────────────────────────
document.querySelectorAll('.nitem').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nitem').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(btn.dataset.p).classList.add('active')
    if (btn.dataset.p==='pOrdini') renderOrdini()
    if (btn.dataset.p==='pGestione') renderGestione()
  })
})

// ── SYNC ─────────────────────────────────────────────────────────
document.getElementById('syncBtn').addEventListener('click', async () => {
  if (!navigator.onLine) { toast('⚠ Sei offline'); return }
  setStatus('sync', 'Sincronizzazione...')
  const n = await syncOffline()
  const { data } = await loadVini(); vini=data; render()
  ordini = await loadOrdini()
  setStatus('online', 'Sincronizzato')
  toast(n>0 ? `✓ ${n} modifica/he sincronizzata/e` : '✓ Tutto aggiornato')
})

// ── ONLINE/OFFLINE ────────────────────────────────────────────────
window.addEventListener('online', async () => {
  isOffline=false; setStatus('sync','Di nuovo online...')
  const n = await syncOffline()
  const { data } = await loadVini(); vini=data; render()
  setStatus('online','Sincronizzato')
  toast(n>0 ? `✓ ${n} modifica/he sincronizzate` : '✓ Sei di nuovo online!')
})
window.addEventListener('offline', () => {
  isOffline=true; setStatus('offline','Offline — continua pure')
  toast('⚠ Offline — salvo tutto in locale')
})

// ── REALTIME ─────────────────────────────────────────────────────
realtimeSub(async () => { if (navigator.onLine) { const { data }=await loadVini(); vini=data; render() } })

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
  try {
    const { data, isOffline: off } = await loadVini()
    vini=data; isOffline=off
    setStatus(off?'offline':'online', off?'Offline — cache locale':'Online')
    render(); ordini=await loadOrdini()
  } catch(e) {
    setStatus('offline','Errore connessione')
    document.getElementById('cardList').innerHTML='<div class="empty">❌ Errore caricamento dati</div>'
  }
}
init()
