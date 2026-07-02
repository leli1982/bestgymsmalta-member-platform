import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-card p-5 shadow-card ${className}`}
    >
      {children}
    </div>
  );
}