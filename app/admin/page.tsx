'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Sparkles, TrendingUp, Eye } from 'lucide-react';

interface ContentStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<ContentStats>({
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    totalViews: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch all posts to calculate stats
        const response = await fetch('/api/content?limit=1000');
        if (response.ok) {
          const data = await response.json();
          const posts = data.posts || [];

          setStats({
            totalPosts: posts.length,
            publishedPosts: posts.filter((p: { status: string }) => p.status === 'published').length,
            draftPosts: posts.filter((p: { status: string }) => p.status === 'draft').length,
            totalViews: posts.reduce((sum: number, p: { view_count?: number }) => sum + (p.view_count || 0), 0),
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Total Posts',
      value: stats.totalPosts,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      label: 'Published',
      value: stats.publishedPosts,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      label: 'Drafts',
      value: stats.draftPosts,
      icon: FileText,
      color: 'bg-amber-500',
    },
    {
      label: 'Total Views',
      value: stats.totalViews,
      icon: Eye,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">
          Manage your SEO content and AI agents
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? '...' : stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/admin/generate"
          className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-6 text-white hover:from-teal-600 hover:to-cyan-600 transition-all"
        >
          <Sparkles className="w-8 h-8 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generate Content</h3>
          <p className="text-teal-100 text-sm">
            Use AI to create SEO-optimized blog posts and landing pages
          </p>
        </Link>

        <Link
          href="/admin/content"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:border-teal-300 hover:shadow-md transition-all"
        >
          <FileText className="w-8 h-8 mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Manage Content
          </h3>
          <p className="text-slate-600 text-sm">
            Edit, review, and publish blog posts and landing pages
          </p>
        </Link>

        <Link
          href="/blog"
          target="_blank"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:border-teal-300 hover:shadow-md transition-all"
        >
          <Eye className="w-8 h-8 mb-4 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            View Blog
          </h3>
          <p className="text-slate-600 text-sm">
            See your published content on the live site
          </p>
        </Link>
      </div>

      {/* Getting Started */}
      {stats.totalPosts === 0 && !loading && (
        <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-teal-500" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Get Started with AI Content
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Generate your first SEO-optimized blog post about biotech licensing deals to start driving organic traffic.
          </p>
          <Link
            href="/admin/generate"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Generate First Post
          </Link>
        </div>
      )}
    </div>
  );
}
