/** Prints the calibration table: `pnpm calibrate`. */
import { runCalibration } from '../src/scoring/calibration/calibrate';

const report = runCalibration();
for (const r of report.rows) {
  const mark = r.inRange ? ' ' : '✗';
  console.log(
    `${mark} ${String(r.score).padStart(3)}  ${r.label.padEnd(6)} ${r.platform.padEnd(6)} ${r.id.padEnd(12)} ${r.topFindings.join(', ')}`,
  );
}
console.log(
  `\naccuracy ${(report.accuracy * 100).toFixed(0)}%  spearman ${report.spearman.toFixed(3)}  ` +
    `means weak ${report.means.weak.toFixed(0)} / ok ${report.means.ok.toFixed(0)} / strong ${report.means.strong.toFixed(0)}`,
);
