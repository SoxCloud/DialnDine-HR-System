"use client";

import type { ReactNode } from "react";

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Centered overlay dialog used by admin actions (add/edit/assign). */
export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h3 className="text-sm font-semibold text-gray-200">{title}</h3>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}