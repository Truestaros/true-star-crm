/**
 * seed_catalog.mjs — One-time seeder for Southwest Nursery price list
 *
 * Run after the catalog migration SQL has been applied:
 *   node supabase/seed_catalog.mjs
 *
 * Requires REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load env
const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const supabaseUrl  = env['REACT_APP_SUPABASE_URL'];
const supabaseKey  = env['REACT_APP_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load compact catalog
const catalog = JSON.parse(readFileSync(new URL('../src/data/swNurseryCatalog.json', import.meta.url), 'utf8'));
const TRADE_CODE_MAP = { p: 'planting', i: 'irrigation', h: 'hardscape', t: 'turf_care', g: 'general' };
const TS = '2026-04-07T00:00:00.000Z';

const rows = catalog.items.map(([itemNumber, name, price, tradeCode]) => ({
  id:                   `sw-nursery-${itemNumber}`,
  item_number:          itemNumber,
  source:               'Southwest Nursery',
  trade:                TRADE_CODE_MAP[tradeCode] || 'planting',
  type:                 'materials',
  name,
  description:          '',
  unit:                 'ea',
  default_qty:          1,
  default_unit_cost:    price,
  default_hours:        0,
  labor_category:       null,
  default_gm_pct:       0,
  default_overhead_pct: 0,
  default_frequency:    1,
  is_optional:          false,
  created_at:           TS,
  updated_at:           TS,
}));

console.log(`Seeding ${rows.length} Southwest Nursery items…`);

// Batch upsert in chunks of 500
const CHUNK = 500;
let inserted = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await supabase.from('catalog_items').upsert(chunk, { onConflict: 'id' });
  if (error) {
    console.error(`Error on chunk ${i}–${i + CHUNK - 1}:`, error.message);
    process.exit(1);
  }
  inserted += chunk.length;
  console.log(`  ${inserted}/${rows.length} inserted`);
}

console.log('Done.');
