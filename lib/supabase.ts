import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://rowmmeqmskryjychlwtt.supabase.co"
const supabaseKey = "sb_publishable_uKPueXBOZd7PopRqRySbNg_yIHzus_D"

export const supabase = createClient(supabaseUrl, supabaseKey)