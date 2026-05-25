'use client';

import { useState, useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const JOB_FUNCTIONS = [
  'Business Development',
  'Corporate Development / M&A',
  'Executive Leadership (C-Suite)',
  'Finance / FP&A',
  'Investment / Portfolio Management',
  'Legal / IP',
  'Research & Development',
  'Strategy / Consulting',
  'Other',
];

const COMPANY_TYPES = [
  'Biotech (Pre-Revenue)',
  'Biotech (Commercial Stage)',
  'Pharma (Large Cap)',
  'Pharma (Mid Cap)',
  'Investment Bank / Advisory',
  'Venture Capital / PE',
  'Law Firm',
  'Consulting',
  'Academic / Research',
  'Other',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileCompletionModal({ open, onClose }: Props) {
  const { user, updateUser } = useAuth();
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobFunction, setJobFunction] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [saving, setSaving] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    supabase
      .from('user_profiles')
      .select('company_name, job_title, job_function, company_type')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data && !data.company_name && !data.job_title) {
          setShouldShow(true);
        }
        if (data?.company_name) setCompany(data.company_name);
        if (data?.job_title) setJobTitle(data.job_title);
        if (data?.job_function) setJobFunction(data.job_function);
        if (data?.company_type) setCompanyType(data.company_type);
      });
  }, [user?.id]);

  if (!open && !shouldShow) return null;
  if (!shouldShow) return null;

  const canSubmit = company.trim() && jobTitle.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !isSupabaseConfigured()) return;
    setSaving(true);

    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('user_profiles')
        .update({
          company_name: company.trim(),
          job_title: jobTitle.trim(),
          job_function: jobFunction || null,
          company_type: companyType || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    updateUser({ company: company.trim(), title: jobTitle.trim() });
    setShouldShow(false);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-1">Complete your profile</h2>
        <p className="text-sm text-slate-400 mb-6">
          Help us tailor your experience. Takes 30 seconds.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Company <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Vertex Pharmaceuticals"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Job title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. VP Business Development"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Function</label>
            <select
              value={jobFunction}
              onChange={(e) => setJobFunction(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select...</option>
              {JOB_FUNCTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company type</label>
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select...</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { setShouldShow(false); onClose(); }}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="flex-1 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
