'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function TermsPage() {
  const lastUpdated = 'February 1, 2025';

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-lg border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            <Link href="/" className="flex items-center touch-feedback">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={180}
                height={48}
                className="h-9 sm:h-10 w-auto object-contain"
                priority
              />
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors touch-feedback px-3 py-2 rounded-lg"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-4 py-1.5 mb-4">
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Legal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-navy-800 mb-3">
            Terms and Conditions
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Terms Content */}
        <div className="prose prose-slate max-w-none prose-headings:text-navy-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700 prose-a:text-teal-600 hover:prose-a:text-teal-700">

          {/* Important Notice */}
          <div className="not-prose mb-8 p-4 sm:p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 mb-1 text-sm sm:text-base">Important Notice</h3>
                <p className="text-xs sm:text-sm text-amber-700">
                  Please read these Terms and Conditions carefully before using the Ambrosia Ventures Deal Calculator.
                  By accessing or using this service, you agree to be bound by these terms.
                </p>
              </div>
            </div>
          </div>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">1. Agreement to Terms</h2>
            <p className="text-sm sm:text-base mb-4">
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;)
              and Ambrosia Ventures LLC (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the
              Deal Calculator tool available at calculator.ambrosiaventures.co (the &quot;Service&quot;).
            </p>
            <p className="text-sm sm:text-base">
              By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms.
              If you do not agree to these Terms, you must not access or use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">2. Description of Service</h2>
            <p className="text-sm sm:text-base mb-4">
              The Ambrosia Ventures Deal Calculator is an informational tool that provides estimated deal term benchmarks
              for oncology and life sciences licensing and M&amp;A transactions. The Service generates estimates based on
              publicly available deal data, industry benchmarks, and algorithmic analysis of user-provided inputs.
            </p>
            <p className="text-sm sm:text-base font-semibold mb-2">The Service includes:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-1">
              <li>Deal term estimation calculator</li>
              <li>Historical calculation storage</li>
              <li>PDF report generation (Pro tier)</li>
              <li>Partner matching suggestions (Pro tier)</li>
            </ul>
          </section>

          {/* Critical Disclaimer Section */}
          <section className="mb-8">
            <div className="not-prose p-4 sm:p-6 bg-red-50 border-2 border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-red-800 mb-2 text-base sm:text-lg">3. Critical Disclaimer - No Professional Advice</h3>
                  <div className="text-xs sm:text-sm text-red-700 space-y-3">
                    <p className="font-semibold">
                      THE SERVICE IS PROVIDED FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY.
                    </p>
                    <p>
                      <strong>Not Financial Advice:</strong> The estimates, calculations, and information provided by this Service
                      do not constitute financial advice. You should not rely on this information to make financial decisions
                      without consulting qualified financial advisors.
                    </p>
                    <p>
                      <strong>Not Legal Advice:</strong> Nothing in this Service constitutes legal advice. Contract negotiations,
                      licensing agreements, and M&amp;A transactions require review by qualified legal counsel familiar with
                      your specific circumstances.
                    </p>
                    <p>
                      <strong>Not Investment Advice:</strong> The Service does not provide investment recommendations.
                      Any decisions regarding investments, valuations, or deal structures should be made in consultation
                      with licensed investment professionals.
                    </p>
                    <p>
                      <strong>Estimates Only:</strong> All outputs from this Service are estimates based on publicly available
                      data and algorithmic models. Actual deal terms can vary significantly (often by 50% or more) based on
                      asset-specific factors, market conditions, competitive dynamics, negotiation leverage, and countless
                      other variables not captured by this tool.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">4. Limitation of Liability</h2>
            <p className="text-sm sm:text-base mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2 mb-4">
              <li>
                <strong>No Warranty:</strong> The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind,
                either express or implied, including but not limited to implied warranties of merchantability, fitness for a
                particular purpose, accuracy, or non-infringement.
              </li>
              <li>
                <strong>No Liability for Decisions:</strong> We are not responsible for any business, investment, or strategic
                decisions you make based on information from the Service. You assume all risk associated with using the Service outputs.
              </li>
              <li>
                <strong>Limitation of Damages:</strong> In no event shall Ambrosia Ventures, its directors, employees, partners,
                agents, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages,
                including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </li>
              <li>
                <strong>Maximum Liability:</strong> Our total liability to you for any claims arising from your use of the Service
                shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is greater.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">5. User Responsibilities</h2>
            <p className="text-sm sm:text-base mb-4">By using the Service, you agree to:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Provide accurate information when using the calculator</li>
              <li>Use the Service only for lawful purposes</li>
              <li>Not attempt to reverse engineer, decompile, or extract the underlying algorithms</li>
              <li>Not use the Service to create competing products or services</li>
              <li>Keep your account credentials confidential</li>
              <li>Comply with all applicable laws and regulations in your jurisdiction</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">6. Intellectual Property</h2>
            <p className="text-sm sm:text-base mb-4">
              All content, features, functionality, and technology of the Service, including but not limited to algorithms,
              software, text, graphics, logos, and user interface designs, are owned by Ambrosia Ventures and are protected
              by intellectual property laws.
            </p>
            <p className="text-sm sm:text-base">
              You are granted a limited, non-exclusive, non-transferable license to access and use the Service for its
              intended purpose. This license does not include the right to copy, modify, distribute, or create derivative
              works from the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">7. Subscription and Payments</h2>
            <p className="text-sm sm:text-base mb-4">
              <strong>Free Tier:</strong> Limited functionality is available at no cost, subject to usage restrictions.
            </p>
            <p className="text-sm sm:text-base mb-4">
              <strong>Pro Tier:</strong> Enhanced functionality is available through a paid subscription. By subscribing, you agree to:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Pay all applicable fees when due</li>
              <li>Provide accurate billing information</li>
              <li>Accept automatic renewal unless cancelled before the renewal date</li>
              <li>Understand that subscription fees are generally non-refundable except as required by law</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">8. Data and Privacy</h2>
            <p className="text-sm sm:text-base">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-teal-600 hover:text-teal-700 underline">Privacy Policy</Link>,
              which describes how we collect, use, and protect your personal information. By using the Service, you consent
              to our data practices as described in the Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">9. Modifications to Service and Terms</h2>
            <p className="text-sm sm:text-base mb-4">
              We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) at any time without notice.
              We may also update these Terms from time to time. Continued use of the Service after changes constitutes acceptance
              of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">10. Governing Law and Dispute Resolution</h2>
            <p className="text-sm sm:text-base mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
              without regard to its conflict of law provisions.
            </p>
            <p className="text-sm sm:text-base">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration
              in accordance with the rules of the American Arbitration Association, except that either party may seek
              injunctive relief in any court of competent jurisdiction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">11. Severability</h2>
            <p className="text-sm sm:text-base">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or
              eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">12. Contact Information</h2>
            <p className="text-sm sm:text-base mb-4">
              For questions about these Terms, please contact us at:
            </p>
            <div className="not-prose p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-800 mb-1">Ambrosia Ventures LLC</p>
              <p className="text-sm text-slate-600">Email: <a href="mailto:legal@ambrosiaventures.co" className="text-teal-600 hover:underline">legal@ambrosiaventures.co</a></p>
              <p className="text-sm text-slate-600">Website: <a href="https://www.ambrosiaventures.co" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">www.ambrosiaventures.co</a></p>
            </div>
          </section>

        </div>

        {/* Back to Top / Navigation */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link
            href="/privacy"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            Read our Privacy Policy &rarr;
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 touch-feedback"
          >
            Back to Calculator
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-navy-900 text-neutral-400 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs sm:text-sm">
            &copy; {new Date().getFullYear()} Ambrosia Ventures LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
