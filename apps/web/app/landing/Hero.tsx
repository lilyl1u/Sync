import Link from "next/link";
import { LevelStrip } from "./LevelStrip";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.dotGrid} />
      <span className={`${styles.cloud} ${styles.cloudA}`} aria-hidden />
      <span className={`${styles.cloud} ${styles.cloudB}`} aria-hidden />
      <span className="px-star" style={{ top: "22%", left: "42%" }} aria-hidden />
      <span className="px-star" style={{ top: "34%", right: "28%" }} aria-hidden />
      <LevelStrip />
      <div className={styles.content}>
        <p className="px-kicker">Jump · Land · Survive</p>
        <div className={styles.titleWrap} tabIndex={0}>
          <h1 className={styles.title}>SYNC</h1>
        </div>
        <p className={styles.subtitle}>
          A dash through spikes and blocks, locked to the beat. One jump. One
          mistake. Start over.
        </p>
        <div className={styles.buttons}>
          <div className={styles.billboard}>
            <Link href="/game" className="px-btn px-btn-start px-blink">
              Press Start
            </Link>
            <Link href="/duels" className="px-btn px-btn-sea">
              Duels 1v1
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
