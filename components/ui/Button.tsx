import Link from "next/link";
import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export default function Button({
  children,
  href,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-button px-5 py-4 text-sm font-black uppercase tracking-wide transition active:scale-95";

  const styles = {
    primary:
      "bg-primary text-black shadow-glow hover:bg-primary-light",
    secondary:
      "border border-primary text-white hover:bg-primary/10",
    ghost:
      "border border-border bg-white/[0.04] text-white hover:bg-white/[0.08]",
  };

  const classes = `${base} ${styles[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <button className={classes}>{children}</button>;
}