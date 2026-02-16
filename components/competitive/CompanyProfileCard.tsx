'use client';

interface CompanyProfileCardProps {
  company: {
    name: string;
    company_type: string | null;
    hq_country: string | null;
    acquisition_appetite: string | null;
    modalities_active: string[];
    deals_last_12mo: number;
    active_trials_count: number;
  };
  isPro: boolean;
}

const typeLabels: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Mid Biotech',
  specialty: 'Specialty',
};

const appetiteConfig: Record<string, { label: string; color: string; bg: string }> = {
  aggressive: { label: 'Aggressive', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/20' },
  moderate: { label: 'Moderate', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/20' },
  selective: { label: 'Selective', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/20' },
  inactive: { label: 'Inactive', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700' },
};

function formatModality(m: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', bispecific_antibody: 'Bispecific', small_molecule: 'SM',
    gene_therapy: 'Gene Tx', radiopharmaceutical: 'Radiopharm', monoclonal_antibody: 'mAb',
    mrna: 'mRNA', rnai: 'RNAi',
  };
  return names[m] || m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CompanyProfileCard({ company, isPro }: CompanyProfileCardProps) {
  const appetite = company.acquisition_appetite ? appetiteConfig[company.acquisition_appetite] : null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{company.name}</h1>
            {company.company_type && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {typeLabels[company.company_type] || company.company_type}
              </span>
            )}
          </div>
          {company.hq_country && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{company.hq_country}</p>
          )}
        </div>

        {isPro && appetite && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${appetite.bg} ${appetite.color}`}>
            Acquisition: {appetite.label}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        <div className="bg-slate-50 dark:bg-slate-750 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{company.deals_last_12mo || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Deals (12mo)</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-750 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{company.active_trials_count || 0}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Active Trials</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-750 rounded-xl p-4 text-center col-span-2">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {(company.modalities_active || []).slice(0, 5).map((m) => (
              <span key={m} className="px-2 py-0.5 text-xs font-medium rounded bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                {formatModality(m)}
              </span>
            ))}
            {(company.modalities_active || []).length > 5 && (
              <span className="px-2 py-0.5 text-xs font-medium text-slate-400">
                +{company.modalities_active.length - 5} more
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Active Modalities</div>
        </div>
      </div>
    </div>
  );
}
