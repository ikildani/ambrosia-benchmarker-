'use client';

import { useState, type FormEvent, type JSX } from 'react';

const SUBJECTS = [
  'General Inquiry',
  'Pro Pricing',
  'Portfolio License',
  'Partnership',
  'Technical Support',
  'Other',
] as const;

interface FormData {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
}

export default function ContactForm(): JSX.Element {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setForm({ name: '', email: '', company: '', subject: SUBJECTS[0], message: '' });
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-8 text-center" role="status">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
          <svg className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Message sent</h3>
        <p className="text-sm text-slate-400">
          Thanks for reaching out. We typically respond within 24 hours.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-6 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Send another message
        </button>
      </div>
    );
  }

  const inputClassName =
    'w-full px-4 py-3 text-sm rounded-xl border border-slate-600 bg-slate-800/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Name */}
      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-slate-300 mb-1.5">
          Name <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          required
          autoComplete="name"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          className={inputClassName}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-slate-300 mb-1.5">
          Email <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className={inputClassName}
        />
      </div>

      {/* Company */}
      <div>
        <label htmlFor="contact-company" className="block text-sm font-medium text-slate-300 mb-1.5">
          Company <span className="text-slate-500 text-xs">(optional)</span>
        </label>
        <input
          id="contact-company"
          type="text"
          autoComplete="organization"
          placeholder="Your company"
          value={form.company}
          onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
          className={inputClassName}
        />
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-300 mb-1.5">
          Subject <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <select
          id="contact-subject"
          required
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          className={inputClassName}
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-300 mb-1.5">
          Message <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          placeholder="How can we help?"
          value={form.message}
          onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
          className={`${inputClassName} resize-y min-h-[120px]`}
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400" role="alert">
          {errorMessage}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-3 text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
