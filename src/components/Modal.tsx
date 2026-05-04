'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      
      {/* Centering Wrapper */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal Box */}
        <div 
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-card-border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-beige-skin bg-white sticky top-0 z-20">
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
          <div className="px-6 py-6 bg-white overflow-y-auto max-h-[75vh] custom-scrollbar">
            {children}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #DECDBB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6A88A4;
        }
      `}</style>
    </div>,
    document.body
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in border border-card-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-6">
            <h3 className="text-lg font-bold text-cherry-brown mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {title}
            </h3>
            <p className="text-sm text-muted-fg" style={{ fontFamily: 'Raleway, sans-serif' }}>
              {description}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-beige-skin bg-white">
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
              {isLoading ? '...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
