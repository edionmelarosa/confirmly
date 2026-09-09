import type { ButtonHTMLAttributes } from "react";

export function PatientButton({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const base = "rounded-lg px-4 py-3 font-medium disabled:opacity-50";
  const variantClass =
    variant === "primary"
      ? "bg-brand-700 text-white active:bg-brand-800"
      : "border border-neutral-300 text-neutral-900 active:bg-neutral-100";

  return <button className={`${base} ${variantClass} ${className}`.trim()} {...props} />;
}
