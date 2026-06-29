// Notifica Google Sheets di ogni modifica tramite Apps Script Web App
// L'URL viene configurato dopo il deploy dello script

const SHEETS_WEBHOOK_URL = '' // <-- verrà aggiunto dopo setup (vedi README)

export async function notifySheets(tipo, payload) {
  if (!SHEETS_WEBHOOK_URL) return // Non configurato ancora
  try {
    await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', // necessario per Apps Script
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ tipo, payload, ts: Date.now() })
    })
  } catch(e) {
    console.warn('Sheets notify failed:', e)
    // Non bloccante — l'app continua a funzionare
  }
}
