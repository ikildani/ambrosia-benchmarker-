'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function PrivacyPage() {
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
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-4">
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-medium text-teal-700">Privacy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-navy-800 mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-500">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Privacy Content */}
        <div className="prose prose-slate max-w-none prose-headings:text-navy-800 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-700 prose-a:text-teal-600 hover:prose-a:text-teal-700">

          {/* Privacy Summary */}
          <div className="not-prose mb-8 p-4 sm:p-6 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-teal-800 mb-2 text-sm sm:text-base">Our Commitment to Your Privacy</h3>
                <p className="text-xs sm:text-sm text-teal-700">
                  Ambrosia Ventures is committed to protecting your privacy. This policy explains how we collect,
                  use, and safeguard your information when you use our Deal Calculator service.
                </p>
              </div>
            </div>
          </div>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">1. Information We Collect</h2>

            <h3 className="text-base sm:text-lg font-semibold mb-3 text-slate-700">1.1 Information You Provide</h3>
            <p className="text-sm sm:text-base mb-4">When you use our Service, you may provide:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2 mb-4">
              <li><strong>Account Information:</strong> Name, email address, company name, job title when you create an account</li>
              <li><strong>Calculation Inputs:</strong> Asset details such as development phase, modality, indication, and other parameters you enter</li>
              <li><strong>Payment Information:</strong> Billing details processed securely through our payment provider (Stripe)</li>
              <li><strong>Communications:</strong> Information you provide when contacting us for support</li>
            </ul>

            <h3 className="text-base sm:text-lg font-semibold mb-3 text-slate-700">1.2 Information Collected Automatically</h3>
            <p className="text-sm sm:text-base mb-4">We automatically collect certain information when you use the Service:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Pages visited, features used, calculation parameters, and interaction patterns</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type, and screen resolution</li>
              <li><strong>Log Data:</strong> IP address, access times, referring URLs, and error logs</li>
              <li><strong>Cookies and Similar Technologies:</strong> Session identifiers and preferences (see Section 5)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">2. How We Use Your Information</h2>
            <p className="text-sm sm:text-base mb-4">We use the information we collect to:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li><strong>Provide the Service:</strong> Process your calculations, generate reports, and deliver features</li>
              <li><strong>Improve the Service:</strong> Analyze usage patterns to enhance functionality and user experience</li>
              <li><strong>Personalize Experience:</strong> Remember your preferences and calculation history</li>
              <li><strong>Process Payments:</strong> Handle subscription billing through our secure payment processor</li>
              <li><strong>Communicate:</strong> Send service updates, security alerts, and (with consent) marketing communications</li>
              <li><strong>Ensure Security:</strong> Detect, prevent, and address fraud or technical issues</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">3. Information Sharing and Disclosure</h2>
            <p className="text-sm sm:text-base mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <div className="not-prose space-y-4 mb-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">Service Providers</h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  We share data with trusted third parties who assist in operating our Service, including:
                  cloud hosting (Vercel), payment processing (Stripe), analytics (anonymized), and customer support tools.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">Legal Requirements</h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  We may disclose information if required by law, court order, or government regulation,
                  or if we believe disclosure is necessary to protect our rights or the safety of users.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">Business Transfers</h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred
                  as part of that transaction. We will notify you of any such change.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">Aggregated Data</h4>
                <p className="text-xs sm:text-sm text-slate-600">
                  We may share aggregated, anonymized data that cannot identify you individually for
                  research, analysis, or business purposes.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">4. Data Security</h2>
            <p className="text-sm sm:text-base mb-4">
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication and access controls</li>
              <li>Regular security assessments and monitoring</li>
              <li>Limited employee access on a need-to-know basis</li>
              <li>Secure payment processing through PCI-compliant providers</li>
            </ul>
            <p className="text-sm sm:text-base mt-4">
              While we strive to protect your information, no method of transmission over the Internet or electronic
              storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">5. Cookies and Tracking Technologies</h2>
            <p className="text-sm sm:text-base mb-4">We use cookies and similar technologies to:</p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2 mb-4">
              <li><strong>Essential Cookies:</strong> Enable core functionality like authentication and session management</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              <li><strong>Analytics Cookies:</strong> Understand how users interact with the Service</li>
            </ul>
            <p className="text-sm sm:text-base">
              You can control cookies through your browser settings. Disabling certain cookies may affect Service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">6. Your Rights and Choices</h2>
            <p className="text-sm sm:text-base mb-4">Depending on your location, you may have the following rights:</p>

            <div className="not-prose grid sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Access</h4>
                <p className="text-xs text-slate-600">Request a copy of your personal data</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Correction</h4>
                <p className="text-xs text-slate-600">Update or correct inaccurate data</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Deletion</h4>
                <p className="text-xs text-slate-600">Request deletion of your data</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Portability</h4>
                <p className="text-xs text-slate-600">Export your data in a machine-readable format</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Opt-Out</h4>
                <p className="text-xs text-slate-600">Unsubscribe from marketing communications</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2 text-sm">Restriction</h4>
                <p className="text-xs text-slate-600">Limit how we process your data</p>
              </div>
            </div>

            <p className="text-sm sm:text-base mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:privacy@ambrosiaventures.co" className="text-teal-600 hover:underline">
                privacy@ambrosiaventures.co
              </a>. We will respond within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">7. Data Retention</h2>
            <p className="text-sm sm:text-base mb-4">
              We retain your personal information for as long as necessary to:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Provide the Service and maintain your account</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
            </ul>
            <p className="text-sm sm:text-base mt-4">
              Calculation history is retained for the duration of your account. Upon account deletion,
              we will delete or anonymize your personal data within 30 days, except where retention
              is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">8. International Data Transfers</h2>
            <p className="text-sm sm:text-base">
              Your information may be transferred to and processed in countries other than your country of residence.
              These countries may have different data protection laws. We ensure appropriate safeguards are in place
              to protect your information in compliance with applicable laws, including standard contractual clauses
              where required.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-sm sm:text-base">
              The Service is not intended for individuals under 18 years of age. We do not knowingly collect
              personal information from children. If we learn that we have collected personal information from
              a child under 18, we will take steps to delete that information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">10. California Privacy Rights (CCPA)</h2>
            <p className="text-sm sm:text-base mb-4">
              California residents have additional rights under the California Consumer Privacy Act:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information (with certain exceptions)</li>
              <li>Right to opt-out of the sale of personal information (we do not sell personal information)</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">11. European Privacy Rights (GDPR)</h2>
            <p className="text-sm sm:text-base mb-4">
              If you are in the European Economic Area (EEA), you have rights under the General Data Protection Regulation:
            </p>
            <ul className="text-sm sm:text-base list-disc pl-6 space-y-2">
              <li>Right to access, rectify, or erase your personal data</li>
              <li>Right to restrict or object to processing</li>
              <li>Right to data portability</li>
              <li>Right to withdraw consent at any time</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
            <p className="text-sm sm:text-base mt-4">
              Our legal basis for processing includes: contract performance, legitimate interests, consent, and legal compliance.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">12. Changes to This Policy</h2>
            <p className="text-sm sm:text-base">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting
              the new policy on this page and updating the &quot;Last Updated&quot; date. We encourage you to review this
              policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg sm:text-xl font-bold mb-4">13. Contact Us</h2>
            <p className="text-sm sm:text-base mb-4">
              If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="not-prose p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-800 mb-2">Ambrosia Ventures LLC</p>
              <p className="text-sm text-slate-600 mb-1">
                Privacy Inquiries: <a href="mailto:privacy@ambrosiaventures.co" className="text-teal-600 hover:underline">privacy@ambrosiaventures.co</a>
              </p>
              <p className="text-sm text-slate-600 mb-1">
                General Contact: <a href="mailto:info@ambrosiaventures.co" className="text-teal-600 hover:underline">info@ambrosiaventures.co</a>
              </p>
              <p className="text-sm text-slate-600">
                Website: <a href="https://www.ambrosiaventures.co" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">www.ambrosiaventures.co</a>
              </p>
            </div>
          </section>

        </div>

        {/* Back to Top / Navigation */}
        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link
            href="/terms"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            Read our Terms and Conditions &rarr;
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
