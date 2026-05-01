'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal content */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-beige-skin">
          <h2 className="text-lg font-bold text-cherry-brown" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-snow-white transition-colors"
          >
            <X className="w-5 h-5 text-muted-fg" />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  isDestructive = false,
  isLoading = false,
}: AlertDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 animate-scale-in border border-card-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <h3 className="text-lg font-bold text-cherry-brown mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {title}
          </h3>
          <p className="text-sm text-muted-fg" style={{ fontFamily: 'Raleway, sans-serif' }}>
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-beige-skin">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-input-border text-cherry-brown hover:bg-snow-white transition-colors disabled:opacity-50"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              px-4 py-2 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50
              ${isDestructive
                ? 'bg-destructive hover:bg-destructive-hover'
                : 'bg-silver-blue hover:bg-silver-blue-hover'
              }
            `}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
