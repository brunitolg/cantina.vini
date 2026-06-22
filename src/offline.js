const QUEUE_KEY = 'cantina_queue'
const CACHE_KEY = 'cantina_cache'

export const offline = {
  save(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch(e) {}
  },
  load() {
    try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null } catch(e) { return null }
  },
  enqueue(op) {
    const q = this.queue(); q.push({ ...op, ts: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  },
  queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch(e) { return [] }
  },
  clearQueue() { localStorage.removeItem(QUEUE_KEY) },
  hasPending() { return this.queue().length > 0 }
}
