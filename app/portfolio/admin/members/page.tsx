'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, Shield, Eye, PenLine, Trash2, Mail, Crown } from 'lucide-react';
import type { TeamRole } from '@/types/tier';

interface Member {
  id: string;
  user_id: string;
  role: TeamRole;
  status: string;
  accepted_at: string | null;
  email: string;
  companyName: string | null;
}

const roleIcons: Record<TeamRole, typeof Shield> = {
  admin: Crown,
  analyst: PenLine,
  viewer: Eye,
};

const roleBadgeColors: Record<TeamRole, string> = {
  admin: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  analyst: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewer: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('viewer');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{ memberId: string; role: TeamRole } | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const res = await fetch('/api/portfolio/members');
    const data = await res.json();
    if (data.success) setMembers(data.members || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    if (!isValidEmail(inviteEmail)) {
      setEmailError('Please enter a valid email');
      return;
    }
    setEmailError(null);
    setInviting(true);
    setMessage(null);

    const res = await fetch('/api/portfolio/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const data = await res.json();

    if (data.success) {
      const sentTo = inviteEmail;
      setInviteEmail('');
      setInviteFeedback(sentTo);
      setTimeout(() => setInviteFeedback(null), 3000);
      fetchMembers();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to send invite' });
    }
    setInviting(false);
  };

  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    const res = await fetch('/api/portfolio/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    const data = await res.json();
    if (data.success) fetchMembers();
    else setMessage({ type: 'error', text: data.error || 'Failed to update role' });
  };

  const handleRemove = async (memberId: string, email: string) => {
    if (confirmRemove !== memberId) {
      setConfirmRemove(memberId);
      setTimeout(() => setConfirmRemove((prev) => prev === memberId ? null : prev), 3000);
      return;
    }

    setConfirmRemove(null);
    const res = await fetch(`/api/portfolio/members?memberId=${memberId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      setMessage({ type: 'success', text: `${email} removed from team` });
      fetchMembers();
    } else {
      setMessage({ type: 'error', text: data.error || 'Failed to remove member' });
    }
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending' || m.status === 'invited');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-teal-400" />
          Members & Seats
          <span className="text-base font-normal text-slate-400">
            ({members.filter(m => m.status === 'active').length}/{members.length} active)
          </span>
        </h1>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Invite form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-teal-400" />
          Invite Team Member
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="email"
              placeholder="colleague@fund.com"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setEmailError(null); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            {emailError && <p className="text-xs text-red-400 mt-1">{emailError}</p>}
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as TeamRole)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="viewer">Viewer</option>
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {inviting ? 'Sending...' : 'Invite'}
          </button>
        </div>
        {inviteFeedback && (
          <p className="text-xs text-teal-400 mt-2">Invite sent to {inviteFeedback}</p>
        )}
      </div>

      {/* Members list */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
          </div>
        ) : activeMembers.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No team members yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Member</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Joined</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {activeMembers.map((member) => {
                const RoleIcon = roleIcons[member.role] || Eye;
                return (
                  <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm text-white font-medium">{member.email}</p>
                        {member.companyName && (
                          <p className="text-xs text-slate-500">{member.companyName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleBadgeColors[member.role]}`}>
                        <RoleIcon className="w-3 h-3" />
                        {member.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${member.status === 'active' ? 'text-teal-400' : 'text-slate-500'}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {member.accepted_at ? new Date(member.accepted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={pendingRole?.memberId === member.id ? pendingRole.role : member.role}
                          onChange={(e) => setPendingRole({ memberId: member.id, role: e.target.value as TeamRole })}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="analyst">Analyst</option>
                          <option value="admin">Admin</option>
                        </select>
                        {pendingRole?.memberId === member.id && (
                          <>
                            <button
                              onClick={() => { handleRoleChange(pendingRole.memberId, pendingRole.role); setPendingRole(null); }}
                              className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setPendingRole(null)}
                              className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleRemove(member.id, member.email)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          title="Remove member"
                        >
                          {confirmRemove === member.id ? (
                            <span className="text-xs text-red-400 font-medium">Confirm?</span>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invites */}
      {pendingMembers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              Pending Invites
              <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
                {pendingMembers.length}
              </span>
            </h3>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-slate-800/50">
              {pendingMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm text-white">{member.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {member.role}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(member.id, member.email)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1 text-xs"
                      title="Revoke invite"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
