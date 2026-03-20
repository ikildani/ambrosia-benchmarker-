import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import CompanyPageClient from './CompanyPageClient';

// ISR: regenerate company pages every hour
export const revalidate = 3600;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = await params;

  if (!UUID_REGEX.test(companyId)) {
    return {
      title: 'Company Not Found | Ambrosia Ventures',
    };
  }

  try {
    const supabase = createServiceClient();
    const { data: company } = await supabase
      .from('companies')
      .select('name, company_type, modalities_active, hq_country')
      .eq('id', companyId)
      .single();

    if (!company) {
      return {
        title: 'Company Not Found | Ambrosia Ventures',
      };
    }

    const typeLabel = ({
      large_pharma: 'Large Pharma',
      mid_pharma: 'Mid-Size Pharma',
      large_biotech: 'Large Biotech',
      mid_biotech: 'Biotech',
    } as Record<string, string>)[company.company_type] || 'Life Sciences';

    const modalities = company.modalities_active?.slice(0, 3).map((m: string) =>
      m.replace(/_/g, ' ')
    ).join(', ') || '';

    const description = `${company.name} company profile — deal history, clinical pipeline, competitive landscape, and benchmark comparisons. ${typeLabel}${company.hq_country ? ` (${company.hq_country})` : ''}${modalities ? `. Active in: ${modalities}` : ''}.`;

    return {
      title: `${company.name} | Company Profile | Ambrosia Ventures`,
      description,
      openGraph: {
        title: `${company.name} — ${typeLabel} Profile`,
        description,
        url: `https://calculator.ambrosiaventures.co/companies/${companyId}`,
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title: `${company.name} — ${typeLabel} Profile`,
        description,
      },
      alternates: {
        canonical: `https://calculator.ambrosiaventures.co/companies/${companyId}`,
      },
    };
  } catch {
    return {
      title: 'Company Profile | Ambrosia Ventures',
    };
  }
}

export default async function CompanyPage({ params }: Props) {
  const { companyId } = await params;
  let companyName = 'Company';
  let companySchema: Record<string, unknown> | null = null;

  if (UUID_REGEX.test(companyId)) {
    try {
      const supabase = createServiceClient();
      const { data: company } = await supabase
        .from('companies')
        .select('name, company_type, deals_last_12mo')
        .eq('id', companyId)
        .single();
      if (company?.name) {
        companyName = company.name;
        companySchema = {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: company.name,
          url: `https://calculator.ambrosiaventures.co/companies/${companyId}`,
          description: `${company.name} deal history, pipeline analysis, and licensing benchmarks. ${company.company_type || 'Life sciences'} company with ${company.deals_last_12mo || 0} recent deals.`,
          industry: company.company_type || 'Biotechnology',
        };
      }
    } catch {}
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://calculator.ambrosiaventures.co" },
          { "@type": "ListItem", "position": 2, "name": "Companies", "item": "https://calculator.ambrosiaventures.co/companies" },
          { "@type": "ListItem", "position": 3, "name": companyName }
        ]
      })}} />
      {companySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(companySchema) }} />
      )}
      <CompanyPageClient companyId={companyId} />
    </>
  );
}
