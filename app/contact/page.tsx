import { Metadata } from 'next';
import ContactForm from '@/components/ContactForm';
import { PORTFOLIO_DEMO_URL } from '@/lib/config/constants';

export const metadata: Metadata = {
  title: 'Contact Ambrosia Ventures | Biopharma Deal Intelligence',
  description:
    'Get in touch with Ambrosia Ventures. Questions about pricing, enterprise plans, partnership opportunities, or technical support for the biopharma deal calculator.',
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/contact',
  },
  openGraph: {
    title: 'Contact Ambrosia Ventures | Biopharma Deal Intelligence',
    description:
      'Questions about pricing, enterprise plans, or partnership opportunities? Reach out to the Ambrosia Ventures team.',
    url: 'https://solidus.ambrosiaventures.co/contact',
    type: 'website',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact Ambrosia Ventures',
    description:
      'Reach out about pricing, enterprise plans, or partnership opportunities.',
    images: ['/api/og'],
  },
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0a0e1a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* Back navigation */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-teal-400 transition-colors mb-10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Ambrosia
        </a>

        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <p className="text-xs font-bold text-teal-400 tracking-[0.15em] uppercase mb-3">
            Ambrosia Ventures
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Questions about pricing, enterprise plans, or partnership
            opportunities? We&apos;d love to hear from you.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14">
          {/* Form column */}
          <section className="lg:col-span-3" aria-label="Contact form">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
              <ContactForm />
            </div>
          </section>

          {/* Sidebar */}
          <aside className="lg:col-span-2 space-y-8" aria-label="Contact information">
            {/* Direct email */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
                  <svg className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">Email Us</h2>
              </div>
              <a
                href="mailto:info@ambrosiaventures.co"
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors break-all"
              >
                info@ambrosiaventures.co
              </a>
            </div>

            {/* Schedule a demo */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
                  <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">Schedule a Demo</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Interested in the Portfolio License for your fund or BD team? Request a walkthrough.
              </p>
              <a
                href={PORTFOLIO_DEMO_URL}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Request demo
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>

            {/* Response time */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                  <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white">Response Time</h2>
              </div>
              <p className="text-sm text-slate-400">
                We typically respond within 24 hours.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
