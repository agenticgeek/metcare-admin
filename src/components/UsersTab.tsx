'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, RotateCcw, ShieldOff, Users, Loader2, TrashIcon, UserCheck } from 'lucide-react';
import { Modal, AlertDialog } from './Modal';
import { useToast } from './Toast';
import { formatDate } from '@/lib/utils';

interface User {
  id: string;
  full_name: string;
  email: string;
  status: 'pending' | 'active' | 'disabled';
  created_at: string;
}

export function UsersTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [disableTarget, setDisableTarget] = useState<User | null>(null);
  const [activateTarget, setActivateTarget] = useState<User | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [activating, setActivating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formErrors, setFormErrors] = useState<{ full_name?: string; email?: string }>({});
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    const errors: { full_name?: string; email?: string } = {};

    if (!formName.trim()) {
      errors.full_name = t('modal.error.required');
    } else if (formName.trim().length < 2) {
      errors.full_name = t('modal.error.name.min');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formEmail.trim()) {
      errors.email = t('modal.error.required');
    } else if (!emailRegex.test(formEmail.trim())) {
      errors.email = t('modal.error.email.invalid');
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setCreating(true);
    setFormErrors({});

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: formName.trim(), email: formEmail.trim() }),
      });

      if (res.status === 409) {
        setFormErrors({ email: t('modal.error.duplicate') });
        setCreating(false);
        return;
      }

      if (!res.ok) {
        showToast(t('toast.error.generic'), 'error');
        setCreating(false);
        return;
      }

      const data = await res.json();
      
      // Update state in an order that avoids hydration/unmount issues
      setCreating(false); 
      setUsers((prev) => [data.user, ...prev]);
      setIsCreateModalOpen(false);
      setFormName('');
      setFormEmail('');
      showToast(t('toast.user.created'), 'success');
      return; // Exit early to avoid the finally block setting creating to false again
    } catch {
      showToast(t('toast.error.generic'), 'error');
      setCreating(false);
    }
  };

  const handleResend = async (userId: string) => {
    setResendingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/resend`, { method: 'POST' });
      if (res.ok) {
        showToast(t('toast.email.resent'), 'success');
      } else {
        showToast(t('toast.error.generic'), 'error');
      }
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setResendingId(null);
    }
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      const res = await fetch(`/api/admin/users/${disableTarget.id}/disable`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === disableTarget.id ? { ...u, status: 'disabled' as const } : u))
        );
        showToast(t('toast.user.disabled'), 'success');
      } else {
        showToast(t('toast.error.generic'), 'error');
      }
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setDisabling(false);
      setDisableTarget(null);
    }
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/users/${activateTarget.id}/activate`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === activateTarget.id ? { ...u, status: 'active' as const } : u))
        );
        showToast(t('toast.user.activated'), 'success');
      } else {
        showToast(t('toast.error.generic'), 'error');
      }
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setActivating(false);
      setActivateTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      
      setUsers(users.filter(u => u.id !== deleteConfirmUser.id));
      showToast(t('toast.user.deleted'), 'success');
      setDeleteConfirmUser(null);
    } catch (err: any) {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { label: t('users.status.active'), bg: 'bg-status-active-bg', text: 'text-status-active', dot: 'bg-status-active' },
      pending: { label: t('users.status.pending'), bg: 'bg-status-pending-bg', text: 'text-status-pending', dot: 'bg-status-pending' },
      disabled: { label: t('users.status.disabled'), bg: 'bg-status-disabled-bg', text: 'text-status-disabled', dot: 'bg-status-disabled' },
    };
    const s = config[status as keyof typeof config] || config.disabled;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-silver-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-silver-blue/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-silver-blue" />
          </div>
          <h1 className="text-2xl font-bold text-cherry-brown" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {t('users.title')}
          </h1>
        </div>
        <button
          id="btn-create-user"
          onClick={() => {
            setFormName('');
            setFormEmail('');
            setFormErrors({});
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-silver-blue text-white rounded-xl text-sm font-semibold hover:bg-silver-blue-hover transition-all duration-200 shadow-md hover:shadow-lg"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          <UserPlus className="w-4 h-4" />
          {t('users.create')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" id="users-table">
            <thead>
              <tr className="border-b border-beige-skin bg-snow-white/50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('users.col.name')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('users.col.email')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('users.col.status')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('users.col.created')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-fg uppercase tracking-wider" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('users.col.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-skin/50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-fg text-sm">
                    {t('users.title')} — No users yet
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr
                    key={user.id}
                    className="hover:bg-snow-white/50 transition-colors"
                    style={{ 
                      animationDelay: `${index * 50}ms`, 
                      animationName: 'fadeIn',
                      animationDuration: '0.3s',
                      animationTimingFunction: 'ease-out',
                      animationFillMode: 'forwards'
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-cherry-brown">
                      {user.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-fg">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-fg">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'pending' && (
                          <button
                            id={`btn-resend-${user.id}`}
                            onClick={() => handleResend(user.id)}
                            disabled={resendingId === user.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-silver-blue bg-silver-blue/10 rounded-lg hover:bg-silver-blue/20 transition-colors disabled:opacity-50"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            {resendingId === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            {t('users.action.resend')}
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            id={`btn-disable-${user.id}`}
                            onClick={() => setDisableTarget(user)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive bg-destructive-bg rounded-lg hover:bg-red-100 transition-colors"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            {t('users.action.disable')}
                          </button>
                        )}
                        {user.status === 'disabled' && (
                          <button
                            id={`btn-activate-${user.id}`}
                            onClick={() => setActivateTarget(user)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-status-active bg-status-active-bg rounded-lg hover:bg-green-100 transition-colors"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {t('users.action.activate')}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          {t('users.action.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('modal.create.title')}
      >
        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label
              htmlFor="input-fullname"
              className="block text-sm font-medium text-cherry-brown mb-1.5"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              {t('modal.field.fullname')}
            </label>
            <input
              id="input-fullname"
              type="text"
              value={formName}
              onChange={(e) => { setFormName(e.target.value); setFormErrors((p) => ({ ...p, full_name: undefined })); }}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                formErrors.full_name ? 'border-destructive' : 'border-input-border'
              }`}
              style={{ fontFamily: 'Raleway, sans-serif' }}
              placeholder="Marie Dupont"
            />
            {formErrors.full_name && (
              <p className="mt-1 text-xs text-destructive">{formErrors.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="input-email"
              className="block text-sm font-medium text-cherry-brown mb-1.5"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              {t('modal.field.email')}
            </label>
            <input
              id="input-email"
              type="email"
              value={formEmail}
              onChange={(e) => { setFormEmail(e.target.value); setFormErrors((p) => ({ ...p, email: undefined })); }}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                formErrors.email ? 'border-destructive' : 'border-input-border'
              }`}
              style={{ fontFamily: 'Raleway, sans-serif' }}
              placeholder="marie@example.com"
            />
            {formErrors.email && (
              <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-input-border text-cherry-brown hover:bg-snow-white transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {t('modal.cancel')}
            </button>
            <button
              id="btn-submit-create"
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-silver-blue text-white hover:bg-silver-blue-hover transition-colors disabled:opacity-50"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <span className="flex items-center gap-2">
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('modal.submit')}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Disable Confirmation Dialog */}
      <AlertDialog
        isOpen={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        onConfirm={handleDisable}
        title={t('users.confirm.disable')}
        description={t('users.confirm.disable.desc')}
        confirmText={t('users.action.disable')}
        cancelText={t('modal.cancel')}
        isDestructive
        isLoading={disabling}
      />

      {/* Activate Confirmation Dialog */}
      <AlertDialog
        isOpen={!!activateTarget}
        onClose={() => setActivateTarget(null)}
        onConfirm={handleActivate}
        title={t('users.confirm.activate')}
        description={t('users.confirm.activate.desc')}
        confirmText={t('users.action.activate')}
        cancelText={t('modal.cancel')}
        isLoading={activating}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
        onConfirm={handleDelete}
        title={t('users.confirm.delete')}
        description={t('users.confirm.delete.desc')}
        confirmText={t('users.action.delete')}
        cancelText={t('modal.cancel')}
        isDestructive
        isLoading={isDeleting}
      />
    </div>
  );
}
