'use client';

import { useEffect, useMemo, useState } from 'react';
import ModalBase from '@/components/ui/ModalBase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { emailDomain, isAcademicDomain, isFreeMailDomain } from '@/lib/enrichment/free-mail-domains';
import { guessCompanyNameFromDomain } from '@/lib/enrichment/profile-enrichment';

export const JOB_FUNCTIONS: Array<{ value: string; label: string }> = [
  { value: 'bd_licensing', label: 'BD / licensing' },
  { value: 'investor', label: 'Investor' },
  { value: 'founder_exec', label: 'Founder / executive' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'corporate_dev', label: 'Corporate development' },
  { value: 'other', label: 'Other' },
];

export const COMPANY_TYPES: Array<{ value: string; label: string }> = [
  { value: 'biotech', label: 'Biotech' },
  { value: 'pharma_mid', label: 'Mid-size pharma' },
  { value: 'pharma_large', label: 'Large pharma' },
  { value: 'investor_vc', label: 'Venture capital' },
  { value: 'investor_pe', label: 'Private equity' },
  { value: 'advisor', label: 'Advisory / services' },
  { value: 'other', label: 'Other' },
];

export interface ProfileSeed {
  email: string;
  full_name?: string | null;
  company_name?: string | null;
  job_function?: string | null;
  company_type?: string | null;
}

interface Props {
  isOpen: boolean;
  seed: ProfileSeed;
  /** Fired after a successful save. */
  onCompleted: (values: { full_name: string; company_name: string; job_function: string; company_type: string }) => void;
  /** Fired when the user chooses "Not now". Reappears next session until completed. */
  onDismiss: () => void;
}

function PillSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One-step identity capture shown on first sign-in when the profile is
 * missing a name or company, and before a free-tier user's first
 * calculation. Dismissible ("Not now"), returns next session until saved.
 */
export default function ProfileCompletionModal({ isOpen, seed, onCompleted, onDismiss }: Props) {
  const domain = emailDomain(seed.email) || '';
  const corporate = domain && !isFreeMailDomain(domain) && !isAcademicDomain(domain);
  const prefillCompany = useMemo(
    () => seed.company_name?.trim() || (corporate ? guessCompanyNameFromDomain(domain) : ''),
    [seed.company_name, corporate, domain],
  );

  const [fullName, setFullName] = useState(seed.full_name?.trim() || '');
  const [company, setCompany] = useState(prefillCompany);
  const [jobFunction, setJobFunction] = useState(seed.job_function || '');
  const [companyType, setCompanyType] = useState(seed.company_type || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(seed.full_name?.trim() || '');
    setCompany(prefillCompany);
    setJobFunction(seed.job_function || '');
    setCompanyType(seed.company_type || '');
    setError(null);
  }, [isOpen, seed.full_name, seed.job_function, seed.company_type, prefillCompany]);

  const canSave = fullName.trim().length >= 2 && company.trim().length >= 2 && !!jobFunction && !!companyType;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        full_name: fullName.trim(),
        company_name: company.trim(),
        job_function: jobFunction,
        company_type: companyType,
        ...(corporate ? { company_domain: domain } : {}),
        profile_completed_at: new Date().toISOString(),
        profile_enrichment_source: 'user' as const,
      };
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not save your details');
      }
      onCompleted({ full_name: body.full_name, company_name: body.company_name, job_function: jobFunction, company_type: companyType });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details');
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async () => {
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_prompt_dismissed_at: new Date().toISOString() }),
      });
    } catch { /* dismissal is best effort */ }
    onDismiss();
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={dismiss}
      title="Tell us about yourself"
      titleId="profile-completion-title"
      subtitle="Thirty seconds. It makes every benchmark, comp set and partner match specific to you."
      headerVariant="simple"
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            Not now
          </button>
          <Button type="button" onClick={save} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save and continue'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={e => { e.preventDefault(); void save(); }}
      >
        <Input
          label="Full name"
          name="full_name"
          autoComplete="name"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Your name"
          required
        />
        <Input
          label="Company"
          name="company_name"
          autoComplete="organization"
          value={company}
          onChange={e => setCompany(e.target.value)}
          placeholder={corporate ? guessCompanyNameFromDomain(domain) : 'Company or institution'}
          required
        />
        <PillSelect label="Your role" value={jobFunction} options={JOB_FUNCTIONS} onChange={setJobFunction} />
        <PillSelect label="Company type" value={companyType} options={COMPANY_TYPES} onChange={setCompanyType} />
        {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Used only to tailor the platform and our emails to your work. Never shared.
        </p>
        <button type="submit" className="sr-only">Save</button>
      </form>
    </ModalBase>
  );
}
