'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, UserPlus, Settings, X, Check } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getIcon(type: string) {
  switch (type) {
    case 'alert':
      return Bell;
    case 'member_invited':
    case 'member_removed':
      return UserPlus;
    case 'team_settings_updated':
      return Settings;
    default:
      return Bell;
  }
}

function getIconColor(type: string): string {
  switch (type) {
    case 'alert':
      return 'text-teal-400';
    case 'member_invited':
      return 'text-blue-400';
    case 'member_removed':
      return 'text-red-400';
    case 'team_settings_updated':
      return 'text-amber-400';
    default:
      return 'text-slate-400';
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const lastReadAt = localStorage.getItem('portfolio-notifications-lastReadAt');
      const res = await fetch(`/api/portfolio/notifications?lastReadAt=${lastReadAt || ''}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    localStorage.setItem('portfolio-notifications-lastReadAt', now);
    setUnreadCount(0);
    try {
      await fetch('/api/portfolio/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastReadAt: now }),
      });
    } catch {
      // silently ignore
    }
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-slate-400 hover:text-white transition-colors p-1"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No recent notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const lastReadAt = typeof window !== 'undefined' ? localStorage.getItem('portfolio-notifications-lastReadAt') : null;
                const isUnread = !lastReadAt || new Date(notification.timestamp) > new Date(lastReadAt);
                const IconComponent = getIcon(notification.type);
                const iconColor = getIconColor(notification.type);

                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${isUnread ? 'bg-slate-800/30' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <IconComponent className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 leading-snug">{notification.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatRelativeTime(notification.timestamp)}</p>
                      </div>
                      {isUnread && (
                        <div className="w-2 h-2 bg-teal-400 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
