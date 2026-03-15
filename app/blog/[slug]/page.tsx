import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  // Blog pages now redirect to homepage — blog content is external only
  void (await params);
  redirect('/');
}
