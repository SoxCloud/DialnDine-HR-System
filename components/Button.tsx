import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  success: "bg-green-600 hover:bg-green-700 text-white",
};

const BASE =
  "inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-md shadow-black/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
}