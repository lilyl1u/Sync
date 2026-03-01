import styles from "./LevelStrip.module.css";

function Chunk() {
  return (
    <>
      <span className={styles.spike} />
      <span className={styles.block} />
      <span className={styles.spike} />
      <span className={styles.block} />
      <span className={styles.block} />
      <span className={styles.spike} />
      <span className={styles.block} />
      <span className={styles.spike} />
      <span className={styles.block} />
    </>
  );
}

export function LevelStrip() {
  return (
    <div className={styles.strip} aria-hidden>
      <div className={styles.track}>
        <div className={styles.repeat}><Chunk /></div>
        <div className={styles.repeat}><Chunk /></div>

        <div className={styles.repeat}><Chunk /></div>

        <div className={styles.repeat}><Chunk /></div>

        <div className={styles.repeat}><Chunk /></div>
        <div className={styles.repeat}><Chunk /></div>
      </div>
    </div>
  );
}
