import { supabase } from './supabase.js'
import { offline } from './offline.js'

export async function loadVini() {
  try {
    const { data, error } = await supabase.from('vini').select('*').order('cantina').order('vino')
    if (error) throw error
    offline.save(data)
    return { data, isOffline: false }
  } catch(e) {
    const cache = offline.load()
    if (cache) return { data: cache.data, isOffline: true }
    throw e
  }
}

export async function aggiornaQty(id, delta) {
  if (!navigator.onLine) {
    offline.enqueue({ type: 'qty', id, delta })
    return { queued: true }
  }
  const { data: curr } = await supabase.from('vini').select('quantita').eq('id', id).single()
  const nuova = Math.max(0, (curr?.quantita || 0) + delta)
  const { error } = await supabase.from('vini').update({ quantita: nuova, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) { offline.enqueue({ type: 'qty', id, delta }); return { queued: true } }
  return { queued: false, nuova }
}

export async function syncOffline() {
  const queue = offline.queue()
  if (!queue.length) return 0
  let n = 0
  for (const op of queue) {
    if (op.type === 'qty') {
      const { data: curr } = await supabase.from('vini').select('quantita').eq('id', op.id).single()
      const nuova = Math.max(0, (curr?.quantita || 0) + op.delta)
      await supabase.from('vini').update({ quantita: nuova, updated_at: new Date().toISOString() }).eq('id', op.id)
      n++
    }
  }
  offline.clearQueue()
  return n
}

export async function loadOrdini() {
  const { data, error } = await supabase.from('ordini').select('*').order('created_at', { ascending: false })
  if (error) return []
  return data
}

export async function creaOrdini() {
  const { data: vini } = await supabase.from('vini').select('*').gt('in_ordine', 0)
  if (!vini?.length) return 0
  const byCantina = vini.reduce((acc, v) => {
    if (!acc[v.cantina]) acc[v.cantina] = []
    acc[v.cantina].push(v)
    return acc
  }, {})
  let created = 0
  for (const [cantina, lista] of Object.entries(byCantina)) {
    const tot_bott = lista.reduce((s, v) => s + v.in_ordine, 0)
    const tot_spesa = lista.reduce((s, v) => s + (v.prezzo_acquisto ? v.prezzo_acquisto * v.in_ordine : 0), 0)
    await supabase.from('ordini').insert({
      cantina, totale_bottiglie: tot_bott,
      totale_spesa: Math.round(tot_spesa * 100) / 100,
      data_ordine: new Date().toISOString().split('T')[0],
      stato: 'in_attesa'
    })
    created++
  }
  return created
}

export async function confermaOrdine(ordineId, cantina) {
  const { data: vini } = await supabase.from('vini').select('*').eq('cantina', cantina).gt('in_ordine', 0)
  for (const v of (vini || [])) {
    await supabase.from('vini').update({ quantita: v.quantita + v.in_ordine, updated_at: new Date().toISOString() }).eq('id', v.id)
  }
  await supabase.from('ordini').update({ stato: 'consegnato' }).eq('id', ordineId)
  return vini?.length || 0
}

export function realtimeSub(cb) {
  return supabase.channel('vini').on('postgres_changes', { event: '*', schema: 'public', table: 'vini' }, cb).subscribe()
}
