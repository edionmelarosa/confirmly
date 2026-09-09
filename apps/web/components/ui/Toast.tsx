import type { ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastData {
  id: string;
  variant: ToastVariant;
  message: string;
}

const variantConfig: Record<ToastVariant, { className: string; icon: ReactNode }> = {
  success: {
    className: "border-status-confirmed/30 bg-status-confirmed-bg text-status-confirmed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    className: "border-status-cancelled/30 bg-status-cancelled-bg text-status-cancelled",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  info: {
    className: "border-neutral-200 bg-white text-neutral-800",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM9 9a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1Zm0 3a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2H9Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const { icon, className } = variantConfig[toast.variant];

  return (
    <div
      role="status"
      className={`flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-md ${className}`}
    >
      <span className="mt-0.5 h-5 w-5 shrink-0">{icon}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
