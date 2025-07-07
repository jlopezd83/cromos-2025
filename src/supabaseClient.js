// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://esnxdnecppajfydwznmt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzbnhkbmVjcHBhamZ5ZHd6bm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4ODA0MjUsImV4cCI6MjA2NzQ1NjQyNX0.8-Z9brVNnDJV1rk94YSin82oSmU0P1CIH1x2UfdurrI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);