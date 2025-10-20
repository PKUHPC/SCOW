/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { parseTime } from "@scow/lib-web/build/utils/datetime";
import { TimeRangePickerProps } from "antd";
import dayjs,{ Dayjs } from "dayjs";


export function formatDateTime(str: string): string {
  return dayjs(str)
    .format("YYYY-MM-DD HH:mm:ss");
}

export const defaultPresets: TimeRangePickerProps["presets"] = (() => {
  const now = dayjs();
  const end = now.endOf("day");

  return [
    { label: "今天", value: [now.startOf("day"), end]},
    { label: "本周", value: [now.startOf("week"), end]},
    { label: "本月", value: [now.startOf("month"), end]},
    { label: "今年", value: [now.startOf("year"), end]},
    { label: "3个月", value: [now.subtract(3, "month").startOf("day"), end]},
    { label: "6个月", value: [now.subtract(6, "month").startOf("day"), end]},
    { label: "一年", value: [now.subtract(1, "year").startOf("day"), end]},
  ];
})();

export function compareDateTime(a: string, b: string): number {
  const aMoment = dayjs(a);
  const bMoment = dayjs(b);

  if (aMoment.isSame(bMoment)) { return 0; }
  if (aMoment.isBefore(bMoment)) { return -1; }
  return 1;

}

export function getYesterdayTimestamp(): string {
  return dayjs().subtract(1, "day").toISOString();
}


function pad(num: number) {
  return num >= 10 ? num : "0" + num;
}

// calculate number of milliseconds to format [{days}-][{Hours}:]{MM}:{SS}
export function formatTime(milliseconds: number) {
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  let text = "";
  text += days >= 1 ? Math.floor(days) + "-" : "";
  const hoursModulo = Math.floor(hours % 24);
  text += hours >= 1 ? pad(hoursModulo) + ":" : "";
  const minModulo = Math.floor(minutes % 60);
  text += pad(minModulo);
  text += ":";
  const secModulo = Math.floor(seconds % 60);
  text += pad(secModulo);

  return text;
}

export function calculateAppRemainingTime(runningTime: string, timeLimit: string) {
  if (runningTime.split(/[:-]/).length < 2 || timeLimit.split(/[:-]/).length < 2) {
    // if timeLimit or runningTime is INVALID or UNLIMITED, return timeLimit
    return timeLimit;
  }
  const diffMs = parseTime(timeLimit) - parseTime(runningTime);
  return diffMs < 0 ? "00:00" : formatTime(diffMs);
}



type TimeLike = number | string | Dayjs | null | undefined;

interface ToGrafanaRelativeOpts {
  /** 认为“就是现在”的容忍度，默认 2 分钟 */
  nowToleranceMs?: number;
  /** 将区间宽度四舍五入到的粒度，默认 1 分钟 */
  roundGranularityMs?: number;
}

/**
 * 把 [start, end] 转成 Grafana 识别的相对时间：{ from: 'now-10m', to: 'now' }
 * - 若 end ≈ now（在容忍度内），则输出相对；否则保留绝对时间戳（毫秒）
 * - 传入已是字符串（比如 'now-10m'）会原样返回
 */
export function toGrafanaRelative(
  start: TimeLike,
  end: TimeLike,
  opts: ToGrafanaRelativeOpts = {},
): { from: string; to: string } {
  const { nowToleranceMs = 2 * 60 * 1000, roundGranularityMs = 60 * 1000 } = opts;

  // 1) 字符串直接透传（如果把预设做成 'now-...'，这里也兼容）
  if (typeof start === "string" && typeof end === "string") {
    return { from: start, to: end };
  }

  // 2) 统一转成毫秒
  const toMs = (v: TimeLike): number | null => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") return null; // 上面已处理
    return (v).valueOf?.() ?? null;
  };

  const startMs = toMs(start);
  const endMs = toMs(end);

  // 兜底：如果不是“可相对化”的情况，返回绝对毫秒（Grafana 也支持）
  if (startMs == null || endMs == null) {
    return { from: String(start ?? ""), to: String(end ?? "") };
  }

  const now = Date.now();

  // 3) 如果 end 靠近现在（在容忍度内），把 end 设为 'now'，start 换成 'now-Δ'
  if (Math.abs(endMs - now) <= nowToleranceMs) {
    const rawDelta = Math.max(0, now - startMs);

    // 3.1 把区间长度按粒度四舍五入，避免出现奇怪的 now-59997ms
    const delta = Math.round(rawDelta / roundGranularityMs) * roundGranularityMs;

    // 3.2 选择合适单位（Grafana 支持 s/m/h/d/w/M/y）
    const s = 1000;
    const m = 60 * s;
    const h = 60 * m;
    const d = 24 * h;
    const w = 7 * d;

    // 这里用简单规则：优先用 w/d/h/m/s 中能表达的最大整单位
    const pick = (ms: number): { n: number; u: "w" | "d" | "h" | "m" | "s" } => {
      if (ms % w === 0) return { n: ms / w, u: "w" };
      if (ms % d === 0) return { n: ms / d, u: "d" };
      if (ms % h === 0) return { n: ms / h, u: "h" };
      if (ms % m === 0) return { n: ms / m, u: "m" };
      return { n: Math.max(1, Math.round(ms / s)), u: "s" };
    };

    const { n, u } = pick(delta || m); // 最少给 1m，避免 0s
    return { from: `now-${n}${u}`, to: "now" };
  }

  // 4) 否则：不是“以 now 结尾”的滚动窗口，保持绝对值（也可按需改成相对+绝对混合）
  return { from: String(startMs), to: String(endMs) };
}
