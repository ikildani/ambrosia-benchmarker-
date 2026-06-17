'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings, Palette, Upload, MessageSquare, Save, Check, Lock, AlertCircle, Zap } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setError(null);

    try {
      const res = await fetch('/api/portfolio/teams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/portfolio/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to upload logo');
      }

      setSettings(prev => prev ? { ...prev, logo_url: json.logoUrl } : prev);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookResult(null);

    try {
      const res = await fetch('/api/portfolio/test-webhook', {
        method: 'POST',
      });
      const json = await res.json();

      if (!json.success) {
        setWebhookResult({ success: false, message: json.error || 'Test failed' });
      } else {
        setWebhookResult({ success: true, message: 'Test notification sent successfully' });
        setTimeout(() => setWebhookResult(null), 4000);
      }
    } catch {
      setWebhookResult({ success: false, message: 'Failed to send test notification' });
    } finally {
      setTestingWebhook(false);
    }
  };

  const isValidHex = (color: string) => /^#[0-9a-fA-F]{6}$/.test(color);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-400" />
          Team Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">Configure branding, integrations, and team preferences</p>
      </div>

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
              <img src={settings.logo_url} alt="Fund logo" className="h-12 bg-white rounded-lg p-1.5 border border-slate-700" />
            ) : (
              <div className="h-12 w-28 bg-slate-800 border border-dashed border-slate-600 rounded-lg flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-500">No logo uploaded</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </button>
          </div>
          {uploadError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {uploadError}
            </div>
          )}
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
            {!isValidHex(settings.primary_color) && (
              <p className="text-xs text-red-400 mt-1">Invalid hex color</p>
            )}
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
            {!isValidHex(settings.secondary_color) && (
              <p className="text-xs text-red-400 mt-1">Invalid hex color</p>
            )}
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

      <hr className="border-slate-800" />

      {/* Slack integration */}
      <div className={`bg-slate-900 border rounded-xl p-6 space-y-4 ${hasSlack ? 'border-slate-800' : 'border-slate-800/50 opacity-70'}`}>
        <div>
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            Slack / Teams Integration
            {!hasSlack && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">
                <Lock className="w-3 h-3" /> Scale+
              </span>
            )}
          </h2>
          {!hasSlack && (
            <p className="text-xs text-slate-500 mt-1">Requires Scale tier</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Platform</label>
          <select
            value={settings.slack_channel_type}
            onChange={(e) => setSettings({ ...settings, slack_channel_type: e.target.value })}
            disabled={!hasSlack}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:pointer-events-none"
          >
            <option value="slack">Slack</option>
            <option value="teams">Microsoft Teams</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Incoming Webhook URL</label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={settings.slack_webhook_url || ''}
              onChange={(e) => setSettings({ ...settings, slack_webhook_url: e.target.value })}
              disabled={!hasSlack}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:pointer-events-none"
            />
            {hasSlack && settings.slack_webhook_url && (
              <button
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5" />
                {testingWebhook ? 'Sending...' : 'Test'}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deal alerts and activity notifications will be sent to this webhook.
          </p>
          {webhookResult && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs ${webhookResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
              {webhookResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {webhookResult.message}
            </div>
          )}
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
      {error && (
        <div className="text-sm text-red-400 mt-2">{error}</div>
      )}
    </div>
  );
}
