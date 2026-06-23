const QK = 'cantina_queue', CK = 'cantina_cache'
export const offline = {
  save(d) { try { localStorage.setItem(CK, JSON.stringify({ ts: Date.now(), data: d })) } catch(e) {} },
  load() { try { const r = localStorage.getItem(CK); return r ? JSON.parse(r) : null } catch(e) { return null } },
  enqueue(op) { const q = this.queue(); q.push({ ...op, ts: Date.now() }); localStorage.setItem(QK, JSON.stringify(q)) },
  queue() { try { return JSON.parse(localStorage.getItem(QK) || '[]') } catch(e) { return [] } },
  clearQueue() { localStorage.removeItem(QK) },
  hasPending() { return this.queue().length > 0 }
}
