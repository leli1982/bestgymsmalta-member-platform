"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type MotionPageProps = {
  children: ReactNode;
};

export default function MotionPage({ children }: MotionPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}