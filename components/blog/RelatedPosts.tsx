import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface RelatedPost {
  slug: string;
  title: string;
  excerpt?: string;
  category?: string;
}

interface RelatedPostsProps {
  posts: RelatedPost[];
  currentSlug: string;
}

export function RelatedPosts({ posts, currentSlug }: RelatedPostsProps) {
  const filteredPosts = posts
    .filter((post) => post.slug !== currentSlug)
    .slice(0, 3);

  if (filteredPosts.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-8">Related Articles</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {filteredPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block p-6 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {post.category && (
              <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">
                {post.category.replace('-', ' ')}
              </span>
            )}
            <h3 className="mt-2 text-lg font-semibold text-slate-900 group-hover:text-teal-600 transition-colors line-clamp-2">
              {post.title}
            </h3>
            {post.excerpt && (
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                {post.excerpt}
              </p>
            )}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600">
              Read more <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
