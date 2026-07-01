"use client";

import { motion } from "framer-motion";

type ProgressRingProps = {
  value: number;
  label?: string;
  size?: number;
  stroke?: number;
};

export default function ProgressRing({
  value,
  label = "Fitness Score",
  size = 132,
  stroke = 12,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-black/60 shadow-[0_0_35px_rgba(249,115,22,0.18)]"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.16),transparent_58%)]" />

      <motion.div
        className="absolute inset-0 rounded-full border border-primary/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      <svg width={size} height={size} className="relative z-10 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
          fill="transparent"
        />

        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F97316"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            filter: "drop-shadow(0 0 14px rgba(249,115,22,.85))",
          }}
        />

        <circle
          cx={size / 2}
          cy={stroke / 2}
          r={stroke / 3}
          fill="#FB923C"
          className="drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]"
        />
      </svg>

      <div className="absolute z-20 text-center">
        <motion.p
          className="text-4xl font-black leading-none"
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          {value}
        </motion.p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">
          {label}
        </p>
      </div>
    </div>
  );
}