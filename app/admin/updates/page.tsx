'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Send, X } from 'lucide-react';
import { captureClientError } from '@/lib/sentry-client';

interface PlatformUpdate {
  id: string;
  title: string;
  body: string;
  category: string;
  cta_url?: string | null;
  cta_label?: string | null;
  created_at: string;
  sent_at: string | null;
  created_by: string;
}

const CATEGORIES = [
  { value: 'feature', label: 'New Feature', color: 'bg-teal-100 text-teal-700' },
  { value: 'improvement', label: 'Improvement', color: 'bg-blue-100 text-blue-700' },
  { value: 'data', label: 'Data Update', color: 'bg-purple-100 text-purple-700' },
  { value: 'fix', label: 'Bug Fix', color: 'bg-amber-100 text-amber-700' },
  { value: 'announcement', label: 'Announcement', color: 'bg-green-100 text-green-700' },
] as const;

function getCategoryStyle(category: string) {
  return CATEGORIES.find((c) => c.value === category) || { label: category, color: 'bg-slate-100 text-slate-700' };
}

const emptyForm = { title: '', body: '', category: 'feature' as string, cta_url: '', cta_label: '' };

export default function PlatformUpdatesPage() {
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/platform-updates');
      if (res.ok) {
        const data = await res.json();
        setUpdates(data.updates || []);
      }
    } catch (error) {
      captureClientError(error, 'PlatformUpdatesPage', { context: 'Failed to fetch updates' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        cta_url: form.cta_url || null,
        cta_label: form.cta_label || null,
      };

      const url = editingId
        ? `/api/admin/platform-updates/${editingId}`
        : '/api/admin/platform-updates';

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        await fetchUpdates();
      }
    } catch (error) {
      captureClientError(error, 'PlatformUpdatesPage', { context: 'Failed to save update' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (update: PlatformUpdate) => {
    setEditingId(update.id);
    setForm({
      title: update.title,
      body: update.body,
      category: update.category,
      cta_url: update.cta_url || '',
      cta_label: update.cta_label || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this update?')) return;
    try {
      const res = await fetch(`/api/admin/platform-updates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUpdates(updates.filter((u) => u.id !== id));
      }
    } catch (error) {
      captureClientError(error, 'PlatformUpdatesPage', { context: 'Failed to delete update' });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const unsentCount = updates.filter((u) => !u.sent_at).length;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Updates</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unsentCount > 0
              ? `${unsentCount} unsent update${unsentCount !== 1 ? 's' : ''} queued for next email`
              : 'No unsent updates queued'}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            New Update
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit Update' : 'New Update'}
            </h2>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={200}
                placeholder="e.g., New Competitive Dynamics Engine"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Body <span className="text-slate-400 font-normal">({form.body.length}/5000)</span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                maxLength={5000}
                rows={4}
                placeholder="Describe the update..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CTA URL <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={form.cta_url}
                  onChange={(e) => setForm({ ...form, cta_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CTA Label <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  maxLength={100}
                  placeholder="Learn More"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.body.trim()}
                className="px-5 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : updates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No platform updates yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Update</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {updates.map((update) => {
                const cat = getCategoryStyle(update.category);
                const isSent = !!update.sent_at;
                return (
                  <tr key={update.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">{update.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${cat.color}`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <Send className="w-3 h-3" />
                          Sent {new Date(update.sent_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSent && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(update)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(update.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
