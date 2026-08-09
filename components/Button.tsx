import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "success";
type ButtonSize = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-green-600 hover:bg-green-700 text-white",
};

const SIZES: Record<ButtonSize, string> = {
  md: "rounded-lg px-5 py-2.5 text-sm shadow-md shadow-black/30",
  lg: "rounded-2xl px-6 py-5 text-lg shadow-lg",
};

const BASE =
  "inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}