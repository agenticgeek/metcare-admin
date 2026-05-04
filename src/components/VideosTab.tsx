'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Video, UploadCloud, Trash2, Loader2, PlayCircle, CheckCircle, ImageIcon, Pencil } from 'lucide-react';
import { AlertDialog, Modal } from './Modal';
import { useToast } from './Toast';
import { formatDuration } from '@/lib/utils';
import * as tus from 'tus-js-client';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;

interface Module {
  id: string;
  order_index: number;
  title: string;
  duration_seconds: number | null;
  video_id: string;
  thumbnail_url?: string | null;
}

export function VideosTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Form State (after upload)
  const [showForm, setShowForm] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [uploadedDuration, setUploadedDuration] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formOrder, setFormOrder] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ title?: string; order?: string }>({});
  const [savingModule, setSavingModule] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Module | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [thumbnailUploadingId, setThumbnailUploadingId] = useState<string | null>(null);
  const rowThumbnailInputRef = useRef<HTMLInputElement>(null);
  const rowThumbnailModuleIdRef = useRef<string | null>(null);

  const [editModule, setEditModule] = useState<Module | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOrder, setEditOrder] = useState('');
  const [editErrors, setEditErrors] = useState<{ title?: string; order?: string }>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview);
    };
  }, [thumbnailPreview]);

  const resetFormThumbnail = () => {
    if (thumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const handleThumbnailSelected = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      showToast(t('videos.thumbnail.error.format'), 'error');
      return;
    }
    if (file.size > THUMBNAIL_MAX_BYTES) {
      showToast(t('videos.thumbnail.error.size'), 'error');
      return;
    }
    setThumbnailFile(file);
    if (thumbnailPreview?.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setUploadProgress(0);

    // Validate size (4 GB = 4 * 1024 * 1024 * 1024 bytes)
    if (file.size > 4 * 1024 * 1024 * 1024) {
      setUploadError(t('videos.upload.error.size'));
      return;
    }

    // Validate type (MP4/MOV)
    if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
      setUploadError(t('videos.upload.error.format'));
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Get upload URL and unique ID from our API
      const urlRes = await fetch('/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadLength: file.size }),
      });
      
      if (!urlRes.ok) {
        const errorData = await urlRes.json();
        console.error('UPLOAD URL ERROR:', errorData);
        throw new Error(errorData.error || 'Failed to get upload URL');
      }
      
      const { uploadURL, uid } = await urlRes.json();

      // Step 2: Manual Chunked TUS Upload (Bypasses library HEAD checks)
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks (Safe for Vercel 4.5MB limit)
      let offset = 0;

      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          // We call our own proxy instead of Cloudflare directly
          xhr.open('PATCH', '/api/admin/tus-proxy');
          
          xhr.setRequestHeader('Tus-Resumable', '1.0.0');
          xhr.setRequestHeader('Upload-Offset', offset.toString());
          xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');
          // We pass the Cloudflare URL in a custom header
          xhr.setRequestHeader('x-upload-url', uploadURL);
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              offset += chunk.size;
              const percent = Math.round((offset / file.size) * 100);
              setUploadProgress(percent);
              resolve();
            } else {
              reject(new Error(`Chunk upload failed with status ${xhr.status}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error during chunk upload'));
          xhr.send(chunk);
        });
      }
      console.log('Manual Chunked TUS Success!');

      setUploadedVideoId(uid);
      showToast(t('videos.upload.success'), 'success');

      // Step 3: Fetch duration (polling since Cloudflare needs time to process)
      let durationFetched = false;
      let attempts = 0;
      const maxAttempts = 40; // Wait up to 2 minutes (40 * 3s)

      const pollDuration = async () => {
        if (durationFetched || attempts >= maxAttempts) return;
        attempts++;
        try {
          const infoRes = await fetch(`/api/admin/video-info/${uid}`);
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            if (infoData.duration) {
              setUploadedDuration(infoData.duration);
              durationFetched = true;
            }
          }
        } catch (e) {
          console.error('Polling duration failed:', e);
        }
        if (!durationFetched && attempts < maxAttempts) {
          setTimeout(pollDuration, 3000); // Poll every 3 seconds
        }
      };

      pollDuration();

      // Step 4: Show form
      setFormTitle(file.name.replace(/\.[^/.]+$/, '')); // default title
      setFormOrder((modules.length > 0 ? Math.max(...modules.map(m => m.order_index)) + 1 : 1).toString());
      resetFormThumbnail();
      setShowForm(true);
    } catch (err) {
      console.error(err);
      setUploadError(t('videos.upload.error.failed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) dropZoneRef.current.classList.add('border-silver-blue', 'bg-silver-blue/5');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) dropZoneRef.current.classList.remove('border-silver-blue', 'bg-silver-blue/5');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) dropZoneRef.current.classList.remove('border-silver-blue', 'bg-silver-blue/5');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSaveModule = async () => {
    const errors: { title?: string; order?: string } = {};
    if (!formTitle.trim()) errors.title = t('modal.error.required');
    if (!formOrder || isNaN(Number(formOrder))) errors.order = t('modal.error.required');

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSavingModule(true);
    setFormErrors({});

    try {
      const res = await fetch('/api/admin/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          order_index: parseInt(formOrder, 10),
          video_id: uploadedVideoId,
          duration_seconds: uploadedDuration,
        }),
      });

      if (res.status === 409) {
        setFormErrors({ order: t('videos.form.order.duplicate') });
        return;
      }

      if (!res.ok) throw new Error('Failed to save module');

      const data = await res.json();
      let saved = data.module as Module;

      if (thumbnailFile && saved?.id) {
        const fd = new FormData();
        fd.append('file', thumbnailFile);
        const tr = await fetch(`/api/admin/modules/${saved.id}/thumbnail`, { method: 'POST', body: fd });
        if (!tr.ok) {
          showToast(t('toast.error.generic'), 'error');
        } else {
          const td = await tr.json();
          saved = td.module as Module;
        }
      }

      setModules((prev) => [...prev.filter((m) => m.id !== saved.id), saved].sort((a, b) => a.order_index - b.order_index));
      setShowForm(false);
      setUploadedVideoId(null);
      resetFormThumbnail();
      showToast(t('toast.module.created'), 'success');
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setSavingModule(false);
    }
  };

  const handleRowThumbnailInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const moduleId = rowThumbnailModuleIdRef.current;
    e.target.value = '';
    rowThumbnailModuleIdRef.current = null;
    if (!file || !moduleId) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      showToast(t('videos.thumbnail.error.format'), 'error');
      return;
    }
    if (file.size > THUMBNAIL_MAX_BYTES) {
      showToast(t('videos.thumbnail.error.size'), 'error');
      return;
    }

    setThumbnailUploadingId(moduleId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const tr = await fetch(`/api/admin/modules/${moduleId}/thumbnail`, { method: 'POST', body: fd });
      if (!tr.ok) throw new Error('thumbnail failed');
      const td = await tr.json();
      const updated = td.module as Module;
      setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, ...updated } : m)));
      showToast(t('toast.thumbnail.updated'), 'success');
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setThumbnailUploadingId(null);
    }
  };

  const openRowThumbnailPicker = (moduleId: string) => {
    rowThumbnailModuleIdRef.current = moduleId;
    rowThumbnailInputRef.current?.click();
  };

  const openEditModule = (m: Module) => {
    setEditModule(m);
    setEditTitle(m.title);
    setEditOrder(String(m.order_index));
    setEditErrors({});
  };

  const closeEditModule = () => {
    setEditModule(null);
    setEditTitle('');
    setEditOrder('');
    setEditErrors({});
    setSavingEdit(false);
  };

  const handleSaveEditModule = async () => {
    if (!editModule) return;

    const errors: { title?: string; order?: string } = {};
    if (!editTitle.trim()) errors.title = t('modal.error.required');
    const orderTrimmed = editOrder.trim();
    if (!orderTrimmed || !/^-?\d+$/.test(orderTrimmed)) errors.order = t('modal.error.required');

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    const orderNum = parseInt(orderTrimmed, 10);

    setSavingEdit(true);
    setEditErrors({});

    try {
      const res = await fetch(`/api/admin/modules/${editModule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          order_index: orderNum,
        }),
      });

      if (res.status === 409) {
        setEditErrors({ order: t('videos.form.order.duplicate') });
        return;
      }

      if (!res.ok) throw new Error('update failed');

      const data = await res.json();
      const updated = data.module as Module;
      setModules((prev) =>
        [...prev.filter((m) => m.id !== updated.id), updated].sort((a, b) => a.order_index - b.order_index)
      );
      closeEditModule();
      showToast(t('toast.module.updated'), 'success');
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/modules/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      setModules((prev) => prev.filter(m => m.id !== deleteTarget.id));
      showToast(t('toast.module.deleted'), 'success');
    } catch {
      showToast(t('toast.error.generic'), 'error');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-silver-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-silver-blue/10 rounded-xl flex items-center justify-center">
          <Video className="w-5 h-5 text-silver-blue" />
        </div>
        <h1 className="text-2xl font-bold text-cherry-brown" style={{ fontFamily: 'Poppins, sans-serif' }}>
          {t('videos.title')}
        </h1>
      </div>

      <input
        ref={rowThumbnailInputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={handleRowThumbnailInputChange}
      />

      {/* Upload Zone */}
      {!showForm ? (
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-2xl p-8 text-center transition-colors
            ${isUploading ? 'border-silver-blue bg-silver-blue/5' : 'border-card-border bg-white'}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-silver-blue animate-spin" />
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-sm font-medium mb-2 text-cherry-brown">
                  <span>{t('videos.upload.progress')}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-beige-skin/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-silver-blue transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-snow-white rounded-full flex items-center justify-center">
                <UploadCloud className="w-8 h-8 text-muted-fg" />
              </div>
              <div>
                <p className="text-sm font-medium text-cherry-brown mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.upload.label')}
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                accept="video/mp4,video/quicktime"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-silver-blue text-white rounded-xl text-sm font-semibold hover:bg-silver-blue-hover transition-colors shadow-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {t('videos.upload.browse')}
              </button>
              {uploadError && <p className="text-sm text-destructive mt-2">{uploadError}</p>}
            </div>
          )}
        </div>
      ) : (
        /* Form after upload */
        <div className="bg-white rounded-2xl border border-card-border p-6 shadow-sm animate-scale-in">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle className="w-5 h-5 text-status-active" />
            <h3 className="text-lg font-bold text-cherry-brown" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {t('videos.upload.success')}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
                {t('videos.form.title')}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => { setFormTitle(e.target.value); setFormErrors((p) => ({ ...p, title: undefined })); }}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${formErrors.title ? 'border-destructive' : 'border-input-border'}`}
                style={{ fontFamily: 'Raleway, sans-serif' }}
              />
              {formErrors.title && <p className="mt-1 text-xs text-destructive">{formErrors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
                {t('videos.form.order')}
              </label>
              <input
                type="number"
                value={formOrder}
                onChange={(e) => { setFormOrder(e.target.value); setFormErrors((p) => ({ ...p, order: undefined })); }}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${formErrors.order ? 'border-destructive' : 'border-input-border'}`}
                style={{ fontFamily: 'Raleway, sans-serif' }}
              />
              {formErrors.order && <p className="mt-1 text-xs text-destructive">{formErrors.order}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
                {t('videos.col.duration')}
              </label>
              <div className="px-4 py-2.5 bg-snow-white border border-input-border rounded-xl text-sm text-cherry-brown flex items-center gap-2">
                {!uploadedDuration ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-silver-blue" />
                    <span className="text-muted-fg italic">Processing...</span>
                  </>
                ) : (
                  <span>{formatDuration(uploadedDuration)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-beige-skin/50">
            <label className="block text-sm font-medium text-cherry-brown mb-2" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {t('videos.thumbnail.optional')}
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => handleThumbnailSelected(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => thumbnailInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-input-border text-sm font-semibold text-cherry-brown hover:bg-snow-white transition-colors"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                <ImageIcon className="w-4 h-4 text-silver-blue" />
                {t('videos.thumbnail.browse')}
              </button>
              {thumbnailPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailPreview} alt="" className="h-16 w-28 object-cover rounded-lg border border-input-border" />
              )}
              {thumbnailFile && (
                <button
                  type="button"
                  onClick={resetFormThumbnail}
                  className="text-xs font-semibold text-muted-fg hover:text-destructive"
                >
                  {t('videos.thumbnail.remove')}
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6 gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setUploadedVideoId(null); resetFormThumbnail(); }}
              className="px-6 py-2.5 text-sm font-semibold rounded-lg border border-input-border text-cherry-brown hover:bg-snow-white transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {t('modal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveModule}
              disabled={savingModule}
              className="flex items-center gap-2 px-6 py-2.5 bg-silver-blue text-white rounded-xl text-sm font-semibold hover:bg-silver-blue-hover transition-colors shadow-sm disabled:opacity-50"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {savingModule && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('videos.form.submit')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-card-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-beige-skin bg-snow-white/50">
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider w-16 min-w-[80px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.col.order')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider w-28 min-w-[140px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.col.thumbnail')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider min-w-[250px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.col.title')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-fg uppercase tracking-wider w-24 min-w-[120px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.col.duration')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-fg uppercase tracking-wider w-40 min-w-[180px]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {t('videos.col.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-skin/50">
              {modules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-fg text-sm">
                    {t('videos.title')} — No modules yet
                  </td>
                </tr>
              ) : (
                modules.map((module, index) => (
                  <tr
                    key={module.id}
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
                      {module.order_index}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {module.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={module.thumbnail_url}
                            alt=""
                            className="h-12 w-20 object-cover rounded-md border border-input-border bg-snow-white shadow-sm"
                          />
                        ) : (
                          <div className="h-12 w-20 rounded-md border border-dashed border-input-border bg-snow-white flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-fg/50" />
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={thumbnailUploadingId === module.id}
                          onClick={() => openRowThumbnailPicker(module.id)}
                          className="px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-silver-blue bg-silver-blue/5 rounded hover:bg-silver-blue/10 transition-colors disabled:opacity-50 whitespace-nowrap"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          {thumbnailUploadingId === module.id ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : module.thumbnail_url ? (
                            t('videos.thumbnail.replace')
                          ) : (
                            t('videos.thumbnail.upload')
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-cherry-brown">
                      <div className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 text-silver-blue shrink-0" />
                        {module.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-fg">
                      {formatDuration(module.duration_seconds)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditModule(module)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-silver-blue bg-silver-blue/10 rounded-lg hover:bg-silver-blue/15 transition-colors"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {t('videos.action.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(module)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive bg-destructive-bg rounded-lg hover:bg-red-100 transition-colors"
                          style={{ fontFamily: 'Poppins, sans-serif' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('videos.action.delete')}
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

      <Modal
        isOpen={!!editModule}
        onClose={closeEditModule}
        title={t('videos.edit.title')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {t('videos.form.title')}
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                setEditErrors((p) => ({ ...p, title: undefined }));
              }}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${editErrors.title ? 'border-destructive' : 'border-input-border'}`}
              style={{ fontFamily: 'Raleway, sans-serif' }}
            />
            {editErrors.title && <p className="mt-1 text-xs text-destructive">{editErrors.title}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-cherry-brown mb-1.5" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {t('videos.form.order')}
            </label>
            <input
              type="number"
              value={editOrder}
              onChange={(e) => {
                setEditOrder(e.target.value);
                setEditErrors((p) => ({ ...p, order: undefined }));
              }}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${editErrors.order ? 'border-destructive' : 'border-input-border'}`}
              style={{ fontFamily: 'Raleway, sans-serif' }}
            />
            {editErrors.order && <p className="mt-1 text-xs text-destructive">{editErrors.order}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeEditModule}
              disabled={savingEdit}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-input-border text-cherry-brown hover:bg-snow-white transition-colors disabled:opacity-50"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {t('modal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveEditModule}
              disabled={savingEdit}
              className="inline-flex items-center gap-2 px-4 py-2 bg-silver-blue text-white rounded-xl text-sm font-semibold hover:bg-silver-blue-hover transition-colors disabled:opacity-50"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('videos.edit.save')}
            </button>
          </div>
        </div>
      </Modal>

      <AlertDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('videos.confirm.delete')}
        description={t('videos.confirm.delete.desc')}
        confirmText={t('videos.action.delete')}
        cancelText={t('modal.cancel')}
        isDestructive
        isLoading={deleting}
      />
    </div>
  );
}
