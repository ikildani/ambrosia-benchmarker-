// JSON-LD Structured Data Generators
import { DEAL_STATS } from '@/lib/config/constants';

export interface OrganizationSchema {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  description: string;
  sameAs?: string[];
}

export interface SoftwareApplicationSchema {
  '@context': 'https://schema.org';
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
}

export interface ArticleSchema {
  '@context': 'https://schema.org';
  '@type': 'Article';
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  publisher: {
    '@type': 'Organization';
    name: string;
    logo: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  mainEntityOfPage: {
    '@type': 'WebPage';
    '@id': string;
  };
}

export interface FAQSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

export interface BreadcrumbSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export function generateOrganizationSchema(): OrganizationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ambrosia Ventures',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: `Biopharma deal intelligence platform providing licensing benchmarks, rNPV analysis, Monte Carlo simulation, and comparable transaction data from ${DEAL_STATS.TOTAL_DEALS} verified deals across 12 therapeutic areas.`,
    sameAs: [
      'https://www.linkedin.com/company/ambrosia-ventures',
      'https://www.ambrosiaventures.co',
    ],
  };
}

export function generateWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ambrosia Ventures Deal Calculator',
    alternateName: 'Life Sciences Deal Calculator',
    url: BASE_URL,
    description: 'Data-driven deal benchmarking, rNPV analysis, Monte Carlo simulation, and AI market intelligence for biopharma licensing deals.',
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/companies?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateSoftwareApplicationSchema(): SoftwareApplicationSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Life Sciences Deal Calculator',
    description: `Estimate upfront payments, milestones, and royalties for biopharma licensing deals across 12 therapeutic areas with data-driven benchmarks from ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
    url: `${BASE_URL}/calculator`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };
}

export function generateArticleSchema(article: {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  image?: string;
}): ArticleSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image || `${BASE_URL}/api/og`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    author: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${article.slug}`,
    },
  };
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): FAQSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generatePricingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Life Sciences Deal Calculator',
    description: 'Data-driven deal benchmarking and valuation tool for biotech licensing transactions.',
    url: `${BASE_URL}/calculator`,
    brand: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: 'Core calculator with benchmarks across 12 therapeutic areas',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Deal Report',
        price: '499',
        priceCurrency: 'USD',
        description: 'Comprehensive PDF report with rNPV valuation, sensitivity analysis, comparable deals, partner matches, and negotiation playbook',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'AggregateOffer',
        name: 'Pro Monthly',
        price: '299',
        priceCurrency: 'USD',
        description: 'Unlimited reports, rNPV modeling, deal valuation, AI deal memos, Pharma Intent Score, negotiation playbooks, and market intelligence — billed monthly',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '299',
          priceCurrency: 'USD',
          billingDuration: 'P1M',
          unitText: 'month',
        },
      },
      {
        '@type': 'AggregateOffer',
        name: 'Pro Annual',
        price: '2388',
        priceCurrency: 'USD',
        description: 'Everything in Pro — billed annually at $199/month (save $1,200/year)',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '2388',
          priceCurrency: 'USD',
          billingDuration: 'P1Y',
          unitText: 'year',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: '12',
            unitText: 'month',
          },
        },
      },
      {
        '@type': 'Offer',
        name: 'Deal Intelligence Brief',
        price: '2500',
        priceCurrency: 'USD',
        description: 'The complete deal landscape for any indication — 52 deal calculations across 13 modalities and 4 deal structures, AI strategic narrative and negotiation playbook, comparable transactions, partner matching with intent scoring, white-label branding, and complimentary walkthrough. Delivered within 24 hours.',
        url: `${BASE_URL}/benchmark`,
        availability: 'https://schema.org/InStock',
      },
    ],
  };
}

export function generateHowToSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Benchmark a Biopharma Licensing Deal',
    description: `Use the Ambrosia Ventures Deal Calculator to get instant benchmarks for upfront payments, milestones, and royalties based on ${DEAL_STATS.TOTAL_DEALS} real biopharma transactions.`,
    totalTime: 'PT2M',
    tool: [
      { '@type': 'HowToTool', name: 'Ambrosia Ventures Deal Calculator' },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Select your asset parameters',
        text: 'Choose the development phase (Preclinical through Approved), modality (small molecule, mAb, ADC, CAR-T, gene therapy, etc.), and therapeutic area.',
        url: `${BASE_URL}/calculator`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Specify deal details',
        text: 'Select indication, territory scope, deal type, and optional modifiers like regulatory designations (Breakthrough, Fast Track, Orphan).',
        url: `${BASE_URL}/calculator`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Get instant benchmarks',
        text: `View data-driven ranges for upfront payments, milestone structures, royalty rates, total deal value, and risk-adjusted metrics — all powered by ${DEAL_STATS.TOTAL_DEALS} real transactions.`,
        url: `${BASE_URL}/calculator`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Run advanced analysis (Pro)',
        text: 'Access rNPV modeling, Monte Carlo simulation (10,000 iterations), scenario planning, comparable deals, and data-driven negotiation playbooks.',
        url: `${BASE_URL}/calculator`,
      },
    ],
  };
}

export function generateWebPageSchema(page: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.name,
    description: page.description,
    url: page.url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Ambrosia Ventures Deal Calculator',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
  };
}

export function generateAboutPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Ambrosia Ventures',
    description: 'Life sciences M&A advisory and deal intelligence platform. Learn about our team, methodology, and mission to bring data-driven transparency to biopharma deal-making.',
    url: `${BASE_URL}/about`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Ambrosia Ventures Deal Calculator',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
  };
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url?: string }>
): BreadcrumbSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  };
}

export interface DatasetSchema {
  '@context': 'https://schema.org';
  '@type': 'Dataset';
  name: string;
  description: string;
  url: string;
  keywords: string[];
  creator: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  temporalCoverage: string;
  variableMeasured: string[];
}

export function generateDatasetSchema(): DatasetSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Biotech & Pharma Licensing Deal Database',
    description: `Comprehensive database of ${DEAL_STATS.TOTAL_DEALS} biotech and pharmaceutical licensing transactions including upfront payments, milestone structures, royalty rates, and deal terms across oncology, neurology, immunology, and other therapeutic areas.`,
    url: `${BASE_URL}/pulse`,
    keywords: [
      'biotech deals',
      'pharma licensing',
      'drug licensing',
      'upfront payments',
      'milestone payments',
      'royalty rates',
      'oncology deals',
      'biopharma transactions',
      'neurology CNS deals',
      'immunology autoimmune licensing',
      'metabolic obesity GLP-1 deals',
      'cardiovascular deal terms',
      'infectious disease licensing',
      'ophthalmology deal benchmarks',
      'women health biopharma deals',
      'ADC antibody drug conjugate deals',
      'CAR-T cell therapy licensing',
      'gene therapy deal terms',
      'bispecific antibody deals',
      'radiopharmaceutical licensing',
    ],
    creator: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: BASE_URL,
    },
    temporalCoverage: '2018/..',
    variableMeasured: [
      'Upfront Payment (USD)',
      'Total Deal Value (USD)',
      'Milestone Payments',
      'Royalty Rates',
      'Development Phase',
      'Therapeutic Area',
      'Modality',
      'Territory',
    ],
  };
}
