import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';

const breadcrumbSchema = generateBreadcrumbSchema([
  { name: 'Home', url: 'https://solidus.ambrosiaventures.co' },
  { name: 'Company Profiles' },
]);

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
