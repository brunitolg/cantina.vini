import { supabase } from './supabase.js'
import { offline } from './offline.js'

// ── Vini ─────────────────────────────────────────────────────────
export async function loadVini() {
  try {
    const { data, error } = await supabase.from('vini').select('*').order('cantina').order('vino')
    if (error) throw error
    offline.save(data); return { data, isOffline: false }
  } catch(e) {
    const cache = offline.load()
    if (cache) return { data: cache.data, isOffline: true }
    throw e
  }
}

export async function aggiornaQty(id, delta) {
  if (!navigator.onLine) { offline.enqueue({ type: 'qty', id, delta }); return { queued: true } }
  const { data: curr } = await supabase.from('vini').select('quantita').eq('id', id).single()
  const nuova = Math.max(0, (curr?.quantita || 0) + delta)
  const { error } = await supabase.from('vini').update({ quantita: nuova, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { offline.enqueue({ type: 'qty', id, delta }); return { queued: true } }
  return { queued: false, nuova }
}

export async function syncOffline() {
  const queue = offline.queue(); if (!queue.length) return 0
  let n = 0
  for (const op of queue) {
    if (op.type === 'qty') {
      const { data: curr } = await supabase.from('vini').select('quantita').eq('id', op.id).single()
      const nuova = Math.max(0, (curr?.quantita || 0) + op.delta)
      await supabase.from('vini').update({ quantita: nuova, updated_at: new Date().toISOString() }).eq('id', op.id)
      n++
    }
  }
  offline.clearQueue(); return n
}

export async function aggiungiVino(dati) {
  const { data, error } = await supabase.from('vini').insert(dati).select().single()
  if (error) throw error; return data
}

export async function aggiornaVino(id, dati) {
  const { error } = await supabase.from('vini').update({ ...dati, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function eliminaVino(id) {
  const { error } = await supabase.from('vini').delete().eq('id', id)
  if (error) throw error
}

// ── Ordini ────────────────────────────────────────────────────────
export async function loadOrdini() {
  const { data, error } = await supabase.from('ordini').select('*').order('created_at', { ascending: false })
  if (error) return []; return data
}

export async function creaOrdineAuto() {
  const { data: vini } = await supabase.from('vini').select('*').gt('in_ordine', 0)
  if (!vini?.length) return 0
  const byCantina = vini.reduce((acc, v) => { if (!acc[v.cantina]) acc[v.cantina]=[]; acc[v.cantina].push(v); return acc }, {})
  let n = 0
  for (const [cantina, lista] of Object.entries(byCantina)) {
    const tot_bott = lista.reduce((s,v) => s+v.in_ordine, 0)
    const tot_spesa = lista.reduce((s,v) => s+(v.prezzo_acquisto ? v.prezzo_acquisto*v.in_ordine : 0), 0)
    await supabase.from('ordini').insert({ cantina, totale_bottiglie: tot_bott, totale_spesa: Math.round(tot_spesa*100)/100, data_ordine: new Date().toISOString().split('T')[0], stato: 'in_attesa' })
    n++
  }
  return n
}

export async function creaOrdineManuele(dati) {
  const { data, error } = await supabase.from('ordini').insert(dati).select().single()
  if (error) throw error; return data
}

export async function aggiornaOrdine(id, dati) {
  const { error } = await supabase.from('ordini').update(dati).eq('id', id)
  if (error) throw error
}

export async function eliminaOrdine(id) {
  const { error } = await supabase.from('ordini').delete().eq('id', id)
  if (error) throw error
}

export async function confermaOrdine(ordineId, cantina) {
  // 1. Prendi tutti i vini in ordine per questa cantina
  const { data: viniInOrdine } = await supabase
    .from('vini').select('*')
    .eq('cantina', cantina)
    .gt('in_ordine', 0)

  // 2. Per ogni vino: aggiungi bottiglie ordinate alla quantità e azzera in_ordine
  for (const v of (viniInOrdine || [])) {
    await supabase.from('vini').update({
      quantita: (v.quantita || 0) + (v.in_ordine || 0),
      in_ordine: 0,
      updated_at: new Date().toISOString()
    }).eq('id', v.id)
  }

  // 3. Segna ordine come consegnato
  await supabase.from('ordini').update({ stato: 'consegnato' }).eq('id', ordineId)
  return viniInOrdine?.length || 0
}

export function realtimeSub(cb) {
  return supabase.channel('vini').on('postgres_changes', { event: '*', schema: 'public', table: 'vini' }, cb).subscribe()
}
