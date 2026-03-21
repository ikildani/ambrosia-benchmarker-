import { generateOrganizationSchema, generateSoftwareApplicationSchema, generateDatasetSchema, generateWebSiteSchema, generateHowToSchema, generatePricingSchema, generateWebPageSchema } from '@/lib/seo/structured-data';

export function GlobalJsonLd() {
  const organizationSchema = generateOrganizationSchema();
  const webSiteSchema = generateWebSiteSchema();
  const softwareSchema = generateSoftwareApplicationSchema();
  const datasetSchema = generateDatasetSchema();
  const howToSchema = generateHowToSchema();
  const pricingSchema = generatePricingSchema();

  const calculatorPageSchema = generateWebPageSchema({
    name: 'Life Sciences Deal Calculator',
    description: 'Estimate upfront payments, milestones, and royalties for biopharma licensing deals across 12 therapeutic areas with data-driven benchmarks from 3,000+ real transactions.',
    url: 'https://calculator.ambrosiaventures.co/calculator',
  });

  const benchmarksPageSchema = generateWebPageSchema({
    name: 'Biopharma Deal Benchmarks 2026',
    description: 'Comprehensive licensing deal benchmarks across oncology, neurology, ADCs, CAR-T, bispecifics, and more. Data-driven deal term analysis for biopharma professionals.',
    url: 'https://calculator.ambrosiaventures.co/benchmarks',
  });

  const companiesPageSchema = generateWebPageSchema({
    name: 'Biopharma Company Profiles & Deal Activity',
    description: 'Explore 850+ biopharma company profiles with deal history, pipeline activity, and licensing track records across 12 therapeutic areas.',
    url: 'https://calculator.ambrosiaventures.co/companies',
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(benchmarksPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(companiesPageSchema) }}
      />
    </>
  );
}
