import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "inverted" | "onDark";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-deep-space-blue text-white hover:bg-yale-blue-2-500 active:scale-[0.98] shadow-sm",
  secondary: "bg-zinc-100 text-zinc-800 hover:bg-zinc-200",
  outline: "border border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50",
  ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  inverted: "bg-white text-deep-space-blue hover:bg-zinc-100 shadow-sm",
  onDark: "border border-white/40 bg-transparent text-white hover:border-white/60 hover:bg-white/10"
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-7 text-[15px] rounded-xl"
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-space-blue",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
