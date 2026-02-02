// Verify patent cliff data
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verify() {
  const { data, error } = await supabase
    .from('companies')
    .select('name, patent_cliffs, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027')
    .not('patent_cliffs', 'eq', '[]')
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\nCompanies with patent cliff data: ${data?.length}\n`);
  console.log('=' .repeat(80));

  data?.forEach(c => {
    const r2025 = c.revenue_at_risk_2025 ? `$${(c.revenue_at_risk_2025/1e9).toFixed(1)}B` : '-';
    const r2026 = c.revenue_at_risk_2026 ? `$${(c.revenue_at_risk_2026/1e9).toFixed(1)}B` : '-';
    const r2027 = c.revenue_at_risk_2027 ? `$${(c.revenue_at_risk_2027/1e9).toFixed(1)}B` : '-';

    console.log(`\n${c.name}`);
    console.log(`  Revenue at Risk: 2025: ${r2025} | 2026: ${r2026} | 2027: ${r2027}`);

    if (c.patent_cliffs && c.patent_cliffs.length > 0) {
      console.log('  Key Drugs:');
      c.patent_cliffs.forEach((cliff: any) => {
        const rev = `$${(cliff.revenue_usd/1e9).toFixed(1)}B`;
        console.log(`    - ${cliff.drug_name} (${cliff.indication}): ${rev}/yr, LOE ${cliff.expiry_year}`);
      });
    }
  });

  console.log('\n' + '=' .repeat(80));
}

verify();
