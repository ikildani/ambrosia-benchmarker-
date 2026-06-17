'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Pause, Play, Mail, MessageSquare } from 'lucide-react';

interface AlertConfig {
  id: string;
  name: string;
  alert_type: string;
  filters: Record<string, unknown>;
  channels: string[];
  is_active: boolean;
  frequency: string;
  last_triggered_at: string | null;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [minValue, setMinValue] = useState('');
  const [emailChannel, setEmailChannel] = useState(true);
  const [slackChannel, setSlackChannel] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/portfolio/alerts');
      const json = await res.json();
      if (json.success) {
        setAlerts(json.alerts || []);
      }
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const filters: Record<string, unknown> = {
        therapeutic_area: therapeuticArea || undefined,
        min_value: minValue ? Number(minValue) : undefined,
      };
      const channels = [emailChannel && 'email', slackChannel && 'slack'].filter(Boolean);

      const res = await fetch('/api/portfolio/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, frequency, filters, channels }),
      });
      const json = await res.json();
      if (json.success) {
        setName('');
        setFrequency('daily');
        setTherapeuticArea('');
        setMinValue('');
        setEmailChannel(true);
        setSlackChannel(false);
        setShowCreate(false);
        fetchAlerts();
      }
    } catch {
      // silently handle errors
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(alertId: string, currentActive: boolean) {
    try {
      const res = await fetch('/api/portfolio/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, is_active: !currentActive }),
      });
      const json = await res.json();
      if (json.success) {
        fetchAlerts();
      }
    } catch {
      // silently handle errors
    }
  }

  async function handleDelete(alertId: string) {
    if (!window.confirm('Delete this alert?')) return;
    try {
      const res = await fetch(`/api/portfolio/alerts?id=${alertId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        fetchAlerts();
      }
    } catch {
      // silently handle errors
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-teal-400" />
          Deal Alerts
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Create Alert Rule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Alert Name</label>
              <input
                type="text"
                placeholder="e.g., Oncology deals > $100M"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="realtime">Real-time</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Therapeutic Area</label>
              <select
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Any</option>
                <option value="oncology">Oncology</option>
                <option value="neurology">Neurology</option>
                <option value="immunology">Immunology</option>
                <option value="metabolic">Metabolic</option>
                <option value="cardiovascular">Cardiovascular</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Min Deal Value</label>
              <input
                type="number"
                placeholder="e.g., 100"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Delivery</label>
              <div className="flex items-center gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailChannel}
                    onChange={(e) => setEmailChannel(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  <MessageSquare className="w-3.5 h-3.5" /> Slack
                </label>
              </div>
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
              disabled={creating}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Alert'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No alerts configured</h3>
          <p className="text-sm text-slate-400">
            Set up deal alert rules to get notified when new deals match your criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">{alert.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    alert.is_active ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {alert.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {alert.frequency} · {alert.channels.join(', ')}
                  {alert.last_triggered_at && ` · Last: ${new Date(alert.last_triggered_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(alert.id, alert.is_active)}
                  className="text-slate-500 hover:text-slate-300 p-1.5"
                >
                  {alert.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="text-slate-500 hover:text-red-400 p-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
