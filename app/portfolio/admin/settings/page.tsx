'use client';

import { useEffect, useState } from 'react';
import { Settings, Palette, Upload, MessageSquare, Save, Check, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isScalePlus } from '@/lib/portfolio/feature-gates';

interface TeamSettings {
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  disclaimer_text: string | null;
  slack_webhook_url: string | null;
  slack_channel_type: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const { portfolioSubTier } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasSlack = isScalePlus(portfolioSubTier);

  useEffect(() => {
    fetch('/api/portfolio/teams')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.team) {
          setSettings({
            name: json.team.name,
            logo_url: json.team.logo_url,
            primary_color: json.team.primary_color || '#0f172a',
            secondary_color: json.team.secondary_color || '#14b8a6',
            disclaimer_text: json.team.disclaimer_text,
            slack_webhook_url: json.team.slack_webhook_url,
            slack_channel_type: json.team.slack_channel_type || 'slack',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);

    // TODO: implement PATCH /api/portfolio/teams to update team settings
    // For now, simulate save
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Settings className="w-6 h-6 text-teal-400" />
        Team Settings
      </h1>

      {/* Branding */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-medium text-white flex items-center gap-2">
          <Palette className="w-4 h-4 text-teal-400" />
          White-Label Branding
        </h2>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Fund Logo</label>
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 bg-white rounded p-1" />
            ) : (
              <div className="h-10 w-24 bg-slate-800 border border-dashed border-slate-600 rounded flex items-center justify-center">
                <span className="text-xs text-slate-500">No logo</span>
              </div>
            )}
            <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors">
              <Upload className="w-4 h-4" />
              Upload Logo
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="h-9 w-12 rounded border border-slate-700 cursor-pointer"
              />
              <input
                type="text"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Secondary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="h-9 w-12 rounded border border-slate-700 cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Report Disclaimer Text</label>
          <textarea
            value={settings.disclaimer_text || ''}
            onChange={(e) => setSettings({ ...settings, disclaimer_text: e.target.value })}
            placeholder="Custom disclaimer to appear on white-label reports..."
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
          />
        </div>
      </div>

      {/* Slack integration */}
      <div className={`bg-slate-900 border rounded-xl p-6 space-y-4 ${hasSlack ? 'border-slate-800' : 'border-slate-800/50 opacity-60'}`}>
        <h2 className="text-sm font-medium text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-400" />
          Slack / Teams Integration
          {!hasSlack && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">
              <Lock className="w-3 h-3" /> Scale+
            </span>
          )}
        </h2>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Platform</label>
          <select
            value={settings.slack_channel_type}
            onChange={(e) => setSettings({ ...settings, slack_channel_type: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="slack">Slack</option>
            <option value="teams">Microsoft Teams</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Incoming Webhook URL</label>
          <input
            type="url"
            value={settings.slack_webhook_url || ''}
            onChange={(e) => setSettings({ ...settings, slack_webhook_url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Deal alerts and activity notifications will be sent to this webhook.
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}
