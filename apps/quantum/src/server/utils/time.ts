import { SubmittedTask } from "src/models/task";

export function calculateDuration(ts: SubmittedTask["ts"]): number {
  if (!ts) return 0;

  const { scheduled, completed, failed } = ts;

  const endTime = completed || failed;

  if (!scheduled || !endTime) return 0;

  const startDate = new Date(scheduled);
  const endDate = new Date(endTime);

  // 计算时间差（毫秒）并转换为秒
  return (endDate.getTime() - startDate.getTime()) / 1000;
}
