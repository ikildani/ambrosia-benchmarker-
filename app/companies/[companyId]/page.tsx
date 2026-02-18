import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import CompanyPageClient from './CompanyPageClient';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: { companyId: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = params;

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

export default function CompanyPage({ params }: Props) {
  return <CompanyPageClient companyId={params.companyId} />;
}
