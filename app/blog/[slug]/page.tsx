import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import BlogPostComponent from '@/components/blog/BlogPost';
import { BlogPost } from '@/types/content';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      return null;
    }

    // Increment view count (fire and forget)
    supabase
      .from('blog_posts')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id)
      .then(() => {});

    return data;
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found | Ambrosia Ventures',
    };
  }

  return {
    title: `${post.title} | Ambrosia Ventures`,
    description: post.meta_description || post.excerpt || undefined,
    keywords: post.meta_keywords || undefined,
    openGraph: {
      title: post.og_title || post.title,
      description: post.og_description || post.meta_description || post.excerpt || undefined,
      type: 'article',
      url: `https://calculator.ambrosiaventures.co/blog/${post.slug}`,
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at || undefined,
      images: post.featured_image_url ? [{ url: post.featured_image_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.og_title || post.title,
      description: post.og_description || post.meta_description || post.excerpt || undefined,
      images: post.featured_image_url ? [post.featured_image_url] : undefined,
    },
  };
}

export async function generateStaticParams() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('status', 'published');

    return data?.map((post) => ({ slug: post.slug })) || [];
  } catch {
    return [];
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All Posts
          </Link>
          <Link href="/" className="font-semibold text-slate-900">
            Ambrosia Ventures
          </Link>
        </div>
      </header>

      {/* Content */}
      <article className="pt-12 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <BlogPostComponent post={post} />
        </div>
      </article>
    </main>
  );
}
