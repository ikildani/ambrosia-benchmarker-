interface AuthorSchemaProps {
  articleTitle: string;
  articleDescription: string;
  articleUrl: string;
  publishedTime: string;
  modifiedTime?: string;
  category?: string;
  imageUrl?: string;
}

export function AuthorSchema({
  articleTitle,
  articleDescription,
  articleUrl,
  publishedTime,
  modifiedTime,
  category,
  imageUrl,
}: AuthorSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: articleTitle,
    description: articleDescription,
    url: articleUrl,
    datePublished: publishedTime,
    dateModified: modifiedTime || publishedTime,
    ...(imageUrl ? { image: { '@type': 'ImageObject', url: imageUrl } } : {}),
    author: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: 'https://ambrosiaventures.co',
      logo: {
        '@type': 'ImageObject',
        url: 'https://calculator.ambrosiaventures.co/logo.png',
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      url: 'https://ambrosiaventures.co',
      logo: {
        '@type': 'ImageObject',
        url: 'https://calculator.ambrosiaventures.co/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    articleSection: category || 'Biotech Insights',
    isAccessibleForFree: true,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.article-content p:first-of-type'],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function ExpertCredentials() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ambrosia Ventures',
    description: 'Life sciences investment and advisory firm specializing in biotech licensing deals, valuations, and strategic partnerships.',
    url: 'https://ambrosiaventures.co',
    areaServed: 'Global',
    knowsAbout: [
      'Biotech licensing deals',
      'Pharmaceutical partnerships',
      'Drug development valuations',
      'Oncology therapeutics',
      'ADC licensing',
      'CAR-T cell therapy',
      'Gene therapy deals',
      'Milestone payments',
      'Royalty structures',
    ],
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'Industry Expert',
      recognizedBy: {
        '@type': 'Organization',
        name: 'Life Sciences Industry',
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
