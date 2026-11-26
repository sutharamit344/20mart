'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X, ShoppingBag } from 'lucide-react';
import { Button } from './Button';

export interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'success',
  title,
  message,
  onClose,
  className,
}) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-success shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-danger shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    info: <Info className="w-5 h-5 text-info shrink-0" />,
  };

  const borders = {
    success: 'border-success-line bg-surface',
    error: 'border-danger-line bg-surface',
    warning: 'border-warning-line bg-surface',
    info: 'border-info-line bg-surface',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-xl border shadow-pop max-w-sm w-full animate-pop-in',
        borders[type],
        className
      )}
    >
      {icons[type]}
      <div className="flex-1 text-sm">
        {title && <h5 className="font-bold text-ink">{title}</h5>}
        <p className="text-ink-600 text-xs mt-0.5">{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-ink-400 hover:text-ink-700 -mr-1 -mt-1 p-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className,
}) => {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange mb-3">
        {icon || <ShoppingBag className="w-7 h-7" />}
      </div>
      <h4 className="text-base font-bold text-ink mb-1">{title}</h4>
      <p className="text-sm text-ink-500 max-w-xs mb-5">{description}</p>
      {actionText && onAction && (
        <Button onClick={onAction} size="sm">
          {actionText}
        </Button>
      )}
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return <div aria-hidden className={cn('animate-pulse rounded-xl bg-line-subtle', className)} />;
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'brand' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/40 animate-fade-in" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-pop z-10 animate-pop-in">
        <h4 className="text-base font-bold text-ink">{title}</h4>
        <p className="text-sm text-ink-500 mt-1.5 mb-5">{message}</p>
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : variant === 'brand' ? 'brand' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
