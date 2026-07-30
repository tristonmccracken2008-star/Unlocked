"use client";

import type { CSSProperties } from "react";
import type { MilestoneCelebrationLevel } from "@/data/milestone-celebrations";
import styles from "./milestone-celebration-effect.module.css";

const particles = [
  [-44, -18, -8, "#c89a4c"], [-34, -36, 9, "#1f6b4b"], [-25, -12, -14, "#dfb968"],
  [-18, -44, 18, "#8eb8a0"], [-9, -26, 4, "#c89a4c"], [0, -48, -8, "#1f6b4b"],
  [10, -24, 14, "#dfb968"], [18, -43, -12, "#8eb8a0"], [27, -18, 8, "#c89a4c"],
  [36, -35, -16, "#1f6b4b"], [45, -14, 12, "#dfb968"], [-39, -4, 16, "#8eb8a0"],
  [-29, -50, -4, "#c89a4c"], [-14, -8, 10, "#1f6b4b"], [15, -9, -10, "#dfb968"],
  [30, -52, 5, "#8eb8a0"], [41, -29, -6, "#c89a4c"], [5, -57, 15, "#1f6b4b"],
] as const;

type ParticleStyle = CSSProperties & {
  "--x": string;
  "--y": string;
  "--r": string;
  "--particle": string;
  "--particle-index": number;
};

export default function MilestoneCelebrationEffect({ level }: { level: MilestoneCelebrationLevel }) {
  if (level === "meaningful") return null;
  const count = level === "signature" ? particles.length : 13;
  return <div className={styles.effect} data-milestone-celebration="" data-level={level} aria-hidden="true">
    {particles.slice(0, count).map(([x, y, rotation, color], index) => <i
      key={`${x}:${y}`}
      style={{
        "--x": `${x}vw`,
        "--y": `${y}vh`,
        "--r": `${rotation * 12}deg`,
        "--particle": color,
        "--particle-index": index,
      } as ParticleStyle}
      data-particle={index}
    />)}
  </div>;
}
