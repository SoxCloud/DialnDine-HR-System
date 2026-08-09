import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Rounded, dark, shadowed card used across dashboards and forms. */
export default function Card({ title, className = "", action, children }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg shadow-black/40 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-sm text-gray-400">{title}</h2>}
          {action && <div className="text-sm">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}