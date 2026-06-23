import { createClient } from '@supabase/supabase-js'
const URL = 'https://gnnkpopqoxvgwuuiqdro.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdubmtwb3Bxb3h2Z3d1dWlxZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTk4NTcsImV4cCI6MjA5NzY3NTg1N30.SwPIkXBGPTTHRfWqi_lX_zc2JXv0FjYtcJOMil0JBQs'
export const supabase = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 10 } } })
