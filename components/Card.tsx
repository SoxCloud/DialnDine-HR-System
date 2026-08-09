import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Rounded, dark, shadowed card used across dashboards and forms. */
export default function Card({ title, className = "", children }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-lg shadow-black/40 ${className}`}
    >
      {title && <h2 className="mb-4 text-sm text-gray-400">{title}</h2>}
      {children}
    </section>
  );
}