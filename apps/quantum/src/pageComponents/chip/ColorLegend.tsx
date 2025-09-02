import { scaleLinear } from "d3-scale";
import React from "react";

interface Props {
  id: string;
  height: number;
  color: (t: number) => string;
  domain: [number, number]; // original data domain [min, max]
  format: (n: number) => string;
}

// 生成“nice”步长：形式为 base * 10^exp，base ∈ {1,2,5}，即保证小数点最后一位为0或5。 如 minStep = 0.004，则nice步长为0.005
export function nextNiceStep(minStep: number): number {
  if (!isFinite(minStep) || minStep <= 0) return 1;
  const bases = [1, 2, 5];
  const exp = Math.floor(Math.log10(minStep)); // 确定候选步长的数量级
  let best = Infinity;
  // 尝试 exp-1 .. exp+2 以保证能找到 >= minStep 的候选
  for (let e = exp - 1; e <= exp + 2; e++) {
    const p = Math.pow(10, e);
    for (const b of bases) {
      const s = b * p;
      if (s >= minStep && s < best) best = s;
    }
  }
  // 若没找到（极端情况），退一步直接使用 10^(exp+1)
  if (!isFinite(best)) {
    best = Math.pow(10, exp + 1);
  }
  return best;
}

// 根据 step 计算小数位数，便于格式化去浮点误差。例如传入step=0.005返回3。
export function decimalsForStep(step: number): number {
  if (!isFinite(step) || step <= 0) return 0;
  const e = Math.floor(Math.log10(step));
  return Math.max(0, -e);
}

// 由 step 构造从 niceMin 到 niceMax 的 ticks（包含两端）的等差数列
export function ticksFromStep(minVal: number, maxVal: number, step: number) {
  // 防止除以零 / 精度问题
  if (!isFinite(step) || step <= 0) {
    return { ticks: [minVal, maxVal], niceMin: minVal, niceMax: maxVal, step: 0 };
  }

  const eps = 1e-12;
  const startIdx = Math.floor((minVal + eps) / step); // 第一个 tick 的整数索引
  const endIdx = Math.ceil((maxVal - eps) / step); // 最后一个 tick 的整数索引

  const niceMin = Number((startIdx * step).toPrecision(15));
  const niceMax = Number((endIdx * step).toPrecision(15));
  const decimals = decimalsForStep(step);

  const ticks: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    // 用 toFixed 保证末尾 0/5 的显示不会因为浮点误差被破坏
    const v = Number((i * step).toFixed(decimals + 6)); // 多保留几位避免连锁误差
    ticks.push(Number(v.toFixed(decimals))); // 最终按需要小数位截断
  }

  return { ticks, niceMin, niceMax, step };
}

/**
 * 生成 nice ticks
 * - 默认 tickCount 在 [minTicks, maxTicks]（优先更多）
 * - 保证步长属于 {1,2,5} * 10^n
 * - 返回 ticks（从大到小），以及 niceMin/niceMax/step
 */
export function getNiceTicks(
  minVal: number,
  maxVal: number,
  minTicks = 2,
  maxTicks = 6,
) {
  if (!isFinite(minVal) || !isFinite(maxVal)) {
    return { ticks: [minVal, maxVal], niceMin: minVal, niceMax: maxVal, step: 0 };
  }

  if (minVal === maxVal) {
    // 特殊处理：给出对称的小范围
    const step = nextNiceStep(Math.abs(minVal) || 1);
    const halfCount = Math.floor((maxTicks - 1) / 2);
    const niceMin = minVal - step * halfCount;
    const niceMax = minVal + step * (maxTicks - 1 - halfCount);
    const { ticks } = ticksFromStep(niceMin, niceMax, step);
    return { ticks: ticks.reverse(), niceMin, niceMax, step };
  }

  const span = Math.abs(maxVal - minVal);

  // 尝试从 maxTicks 到 minTicks，优先选更多的 tick
  for (let desired = maxTicks; desired >= minTicks; desired--) {
    // 当 desired === 1 时避免除 0（此处 desired >=2）
    const roughStep = span / (desired - 1);
    const step = nextNiceStep(roughStep);

    const { ticks, niceMin, niceMax } = ticksFromStep(minVal, maxVal, step);
    const count = ticks.length;

    if (count >= minTicks && count <= maxTicks) {
      // 返回从大到小
      return { ticks: ticks.slice().reverse(), niceMin, niceMax, step };
    }
    // 否则继续尝试较小 desired（会产生更粗的 roughStep）
  }

  // 如果没有找到完美的（极少发生），使用以 maxTicks 为基准的 niceStep（最接近的 fallback）
  const fallbackStep = nextNiceStep(span / (maxTicks - 1));
  const fallback = ticksFromStep(minVal, maxVal, fallbackStep);
  return { ticks: fallback.ticks.slice().reverse(),
    niceMin: fallback.niceMin, niceMax: fallback.niceMax, step: fallback.step };
}

export const ColorLegend: React.FC<Props> = ({ id, height, color, domain, format }) => {
  const [minVal, maxVal] = domain;
  const { ticks, niceMin, niceMax } = getNiceTicks(minVal, maxVal, 2, 6);

  const domainMin = niceMin;
  const domainMax = niceMax === niceMin ? niceMin + 0.1 : niceMax;
  const rangeSpan = domainMax - domainMin;

  const verticalScale = scaleLinear().domain([domainMin, domainMax]).range([height, 0]);

  return (
    <g transform="translate(0,16)">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          {ticks.map((t) => {
            const offsetPct = rangeSpan === 0 ? 0 : ((t - domainMin) / rangeSpan) * 100;
            const gradOffset = `${100 - offsetPct}%`;
            return <stop key={String(t)} offset={gradOffset} stopColor={color(t)} />;
          })}
        </linearGradient>
      </defs>

      <rect width="20" height={height} fill={`url(#${id})`} />

      {ticks.map((tick) => {
        const y = verticalScale(tick);
        return (
          <g key={`tick-${tick}`}>
            <line x1="20" y1={y} x2="24" y2={y} stroke="#374151" strokeWidth={1} />
            <text x="26" y={y} fontSize={12} dominantBaseline="middle" fill="#374151">
              {format(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
};
