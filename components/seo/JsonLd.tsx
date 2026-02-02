import {
  generateOrganizationSchema,
  generateSoftwareApplicationSchema,
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo/structured-data';

type SchemaType = 'Organization' | 'SoftwareApplication' | 'Article' | 'FAQ' | 'Breadcrumb';

interface JsonLdProps {
  type: SchemaType;
  data?: {
    // Article props
    title?: string;
    description?: string;
    slug?: string;
    publishedAt?: string;
    updatedAt?: string;
    image?: string;
    // FAQ props
    faqs?: Array<{ question: string; answer: string }>;
    // Breadcrumb props
    breadcrumbs?: Array<{ name: string; url?: string }>;
  };
}

export function JsonLd({ type, data }: JsonLdProps) {
  let schema: object;

  switch (type) {
    case 'Organization':
      schema = generateOrganizationSchema();
      break;
    case 'SoftwareApplication':
      schema = generateSoftwareApplicationSchema();
      break;
    case 'Article':
      if (!data?.title || !data?.description || !data?.slug || !data?.publishedAt) {
        console.warn('JsonLd: Article requires title, description, slug, and publishedAt');
        return null;
      }
      schema = generateArticleSchema({
        title: data.title,
        description: data.description,
        slug: data.slug,
        publishedAt: data.publishedAt,
        updatedAt: data.updatedAt,
        image: data.image,
      });
      break;
    case 'FAQ':
      if (!data?.faqs || data.faqs.length === 0) {
        return null;
      }
      schema = generateFAQSchema(data.faqs);
      break;
    case 'Breadcrumb':
      if (!data?.breadcrumbs || data.breadcrumbs.length === 0) {
        return null;
      }
      schema = generateBreadcrumbSchema(data.breadcrumbs);
      break;
    default:
      return null;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Pre-built components for common use cases
export function OrganizationJsonLd() {
  return <JsonLd type="Organization" />;
}

export function SoftwareApplicationJsonLd() {
  return <JsonLd type="SoftwareApplication" />;
}
