'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, X, Calendar, XCircle } from 'lucide-react';

interface Slot {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  scheduled_date: string;
  duration_minutes: number;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  topic: string | null;
  notes: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-500/10 text-emerald-400',
  booked: 'bg-blue-500/10 text-blue-400',
  completed: 'bg-slate-500/10 text-slate-400',
  cancelled: 'bg-red-500/10 text-red-400',
};

function groupByMonth(slots: Slot[]): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const d = new Date(slot.scheduled_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(slot);
  }
  return groups;
}

export default function OfficeHoursPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [topic, setTopic] = useState('');

  async function fetchSlots() {
    try {
      const res = await fetch('/api/portfolio/office-hours');
      const json = await res.json();
      if (json.success) {
        setSlots(json.slots || []);
      }
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSlots();
  }, []);

  async function handleCreate() {
    if (!companyName || !scheduledDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/portfolio/office-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          contact_name: contactName || undefined,
          contact_email: contactEmail || undefined,
          scheduled_date: new Date(scheduledDate).toISOString(),
          topic: topic || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCompanyName('');
        setContactName('');
        setContactEmail('');
        setScheduledDate('');
        setTopic('');
        setShowCreate(false);
        fetchSlots();
      }
    } catch {
      // silently handle errors
    } finally {
      setCreating(false);
    }
  }

  function handleCancelClick(slotId: string) {
    if (confirmCancelId === slotId) {
      // Already confirming — execute cancel
      performCancel(slotId);
    } else {
      setConfirmCancelId(slotId);
      setTimeout(() => setConfirmCancelId((prev) => (prev === slotId ? null : prev)), 3000);
    }
  }

  async function performCancel(slotId: string) {
    setConfirmCancelId(null);
    try {
      const res = await fetch('/api/portfolio/office-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slotId, status: 'cancelled' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchSlots();
      }
    } catch {
      // silently handle errors
    }
  }

  async function handleComplete(slotId: string) {
    try {
      const res = await fetch('/api/portfolio/office-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slotId, status: 'completed' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchSlots();
      }
    } catch {
      // silently handle errors
    }
  }

  const monthGroups = groupByMonth(slots);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Clock className="w-6 h-6 text-teal-400" />
          Office Hours
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Close' : 'Book Office Hours'}
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Schedule quarterly BD consultations for your portfolio companies
      </p>

      {showCreate && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Book Office Hours</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Company Name</label>
              <input
                type="text"
                placeholder="e.g., Acme Therapeutics"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Contact Name</label>
              <input
                type="text"
                placeholder="e.g., Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Contact Email</label>
              <input
                type="email"
                placeholder="jane@acme.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Preferred Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Topic</label>
              <input
                type="text"
                placeholder="e.g., BD strategy review"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !companyName || !scheduledDate}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Booking...' : 'Book Slot'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No office hours scheduled yet</h3>
          <p className="text-sm text-slate-400">
            Book quarterly 30-minute consultations with Ambrosia BD advisors for your portfolio companies.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(monthGroups).map(([month, monthSlots]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {month}
              </h2>
              <div className="space-y-3">
                {monthSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-white truncate">
                          {slot.company_name}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[slot.status] || STATUS_STYLES.available
                          }`}
                        >
                          {slot.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(slot.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {slot.duration_minutes && ` · ${slot.duration_minutes} min`}
                        {slot.contact_name && ` · ${slot.contact_name}`}
                        {slot.contact_email && ` (${slot.contact_email})`}
                      </p>
                      {slot.topic && (
                        <p className="text-xs text-slate-400 mt-1">
                          Topic: {slot.topic}
                        </p>
                      )}
                      {slot.notes && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          {slot.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {slot.status === 'booked' && (
                        <>
                          <button
                            onClick={() => handleComplete(slot.id)}
                            className="text-xs text-teal-400 hover:text-teal-300 px-2 py-1 rounded border border-teal-500/30 hover:border-teal-500/50 transition-colors"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleCancelClick(slot.id)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${
                              confirmCancelId === slot.id
                                ? 'text-red-400 border-red-500/50 hover:border-red-500'
                                : 'text-slate-500 hover:text-red-400 border-transparent'
                            }`}
                            title="Cancel"
                          >
                            {confirmCancelId === slot.id ? (
                              'Confirm Cancel?'
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
