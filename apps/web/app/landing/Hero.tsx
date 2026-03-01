import Link from "next/link";
import { LevelStrip } from "./LevelStrip";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.dotGrid} />
      <LevelStrip />
      <div className={styles.content}>
        <p className={styles.impact}>Jump · Land · Survive</p>
        <div className={styles.titleWrap} tabIndex={0}>
          <h1 className={styles.title}>Sync</h1>
        </div>
        <p className={styles.subtitle}>
          A fast-paced dash through spikes and blocks, synced to the beat. One
          tap to jump, one mistake to restart.
        </p>
        <div className={styles.buttons}>
          <div className={styles.billboard}>
            <Link href="/game" className={styles.playBtn}>
              PLAY NOW
            </Link>
            <Link href="/duels" className={styles.duelsBtn}>
              Duels 1v1
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
