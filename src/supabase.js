import { createClient } from '@supabase/supabase-js'

// Credenziali Supabase
const SUPABASE_URL = 'https://gnnkpopqoxvgwuuiqdro.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdubmtwb3Bxb3h2Z3d1dWlxZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTk4NTcsImV4cCI6MjA5NzY3NTg1N30.SwPIkXBGPTTHRfWqi_lX_zc2JXv0FjYtcJOMil0JBQs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})
