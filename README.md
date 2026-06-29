# 🍷 Cantina Vini

App PWA per la gestione dell'inventario vini del ristorante.

## Stack
- **Frontend**: Vite + Vanilla JS (PWA installabile su iPhone e Mac)
- **Database**: Supabase (sync real-time + offline)
- **Hosting**: Vercel
- **Sync**: Google Sheets ↔ Supabase (bidirezionale)

---

## Struttura file

```
cantina-v4/
├── index.html              → App principale
├── package.json            → Dipendenze
├── vite.config.js          → Configurazione build + PWA
├── SETUP_SUPABASE.sql      → SQL per creare le tabelle (eseguire una volta)
├── GOOGLE_SHEETS_SYNC.js   → Script da incollare in Apps Script
└── src/
    ├── main.js             → Logica principale dell'app
    ├── db.js               → Operazioni database (Supabase)
    ├── supabase.js         → Connessione Supabase
    ├── voice.js            → Riconoscimento vocale (italiano, iOS Safari)
    └── offline.js          → Gestione modalità offline
```

---

## Setup iniziale

### 1. Supabase
1. Vai su https://supabase.com/dashboard/project/gnnkpopqoxvgwuuiqdro/sql/new
2. Incolla tutto il contenuto di `SETUP_SUPABASE.sql`
3. Clicca **Run**

### 2. GitHub
1. Carica tutti i file nel repository `brunitolg/cantina.vini`
2. Ricorda di caricare i file dentro `src/` nella cartella `src/` del repository

### 3. Vercel
- Il deploy avviene automaticamente ad ogni push su GitHub
- Nessuna variabile d'ambiente necessaria (credenziali già nel codice)

### 4. Google Sheets sync
1. Apri il Google Sheet → **Estensioni → Apps Script**
2. Incolla il contenuto di `GOOGLE_SHEETS_SYNC.js`
3. Salva, seleziona `installaTrigger` nel menu e clicca **Esegui**
4. Da quel momento il foglio si aggiorna ogni 5 minuti dall'app

### 5. Installa su iPhone
1. Apri l'URL dell'app in **Safari**
2. Tocca **Condividi → Aggiungi a schermata Home**
3. L'app funziona anche offline in cantina!

---

## Comandi vocali (italiano)
| Comando | Effetto |
|---------|---------|
| "Togli 2 Sassella Rainoldi" | Rimuove 2 bottiglie |
| "Aggiungi 6 Barolo Fontanafredda" | Aggiunge 6 bottiglie |
| "Arrivate 12 Prosecco" | Aggiunge 12 bottiglie |
| "Cerca Nino Negri" | Filtra per cantina |
| "Quante bottiglie di Mazer" | Mostra quantità |

---

## Credenziali Supabase
- **URL**: https://gnnkpopqoxvgwuuiqdro.supabase.co
- **Anon key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

---

## Funzionalità
- ✅ Inventario vini per cantina
- ✅ Aggiornamento quantità con +/− o comando vocale
- ✅ Modalità offline (sync automatica al ritorno)
- ✅ Sync real-time tra dispositivi (iPhone + Mac)
- ✅ Gestione vini (aggiungi, modifica, elimina)
- ✅ Ordini automatici e manuali
- ✅ Conferma arrivo ordini con aggiornamento automatico quantità
- ✅ Sync bidirezionale con Google Sheets (ogni 5 minuti)
