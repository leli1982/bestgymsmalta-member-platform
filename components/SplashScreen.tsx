"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./SplashScreen.module.css";

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("bgmSplashShown");

    if (alreadyShown === "true") {
      setVisible(false);
      return;
    }

    setVisible(true);
    sessionStorage.setItem("bgmSplashShown", "true");

    const fadeTimer = setTimeout(() => {
      setLeaving(true);
    }, 1700);

    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`${styles.splash} ${leaving ? styles.hide : ""}`}>
      <div className={styles.logoArea}>
        <div className={styles.orangeGlow} />

        <svg className={styles.animatedCircle} viewBox="0 0 300 300">
          <circle className={styles.circleTrack} cx="150" cy="150" r="132" />
          <circle className={styles.circleLine} cx="150" cy="150" r="132" />
        </svg>

        <div className={styles.orbitDot} />

        <Image
          src="/bgm-logo.png"
          alt="BestGymsMalta"
          width={260}
          height={260}
          priority
          className={styles.logo}
        />
      </div>

      <div className={styles.tagline}>
        Be the <span>best</span>.... Beat the <span>rest</span>
      </div>

      <div className={styles.loadingLine}>
        <div />
      </div>
    </div>
  );
}