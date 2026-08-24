import type { ReactNode } from "react";

import { Select } from "antd";

import { AddonAfterSelect, RoundedInputNumberWithAddonAfter } from "../styledAntdCom/Input";
import { SegmentedInputSelector } from "../styledAntdCom/SegmentedButtons";

export type MaxTimePresetKey = "30m" | "1h" | "12h" | "1d" | "2d";

export interface MaxTimeUnits<TUnit extends string | number> {
  minutes: TUnit;
  hours: TUnit;
  days: TUnit;
}

export interface MaxTimePreset<TUnit extends string | number> {
  key: MaxTimePresetKey;
  maxTime: number;
  maxTimeUnit: TUnit;
}

export const createMaxTimePresets = <TUnit extends string | number>(
  units: MaxTimeUnits<TUnit>,
): MaxTimePreset<TUnit>[] => [
  { key: "30m", maxTime: 30, maxTimeUnit: units.minutes },
  { key: "1h", maxTime: 1, maxTimeUnit: units.hours },
  { key: "12h", maxTime: 12, maxTimeUnit: units.hours },
  { key: "1d", maxTime: 1, maxTimeUnit: units.days },
  { key: "2d", maxTime: 2, maxTimeUnit: units.days },
];

export interface MaxTimeSelectorProps<TUnit extends string | number> {
  value?: number;
  onChange?: (value?: number) => void;
  disabled?: boolean;
  maxRunningTimeHours?: number;
  disabledTooltip?: string;
  maxTimeUnit: TUnit;
  onMaxTimeUnitChange: (unit: TUnit) => void;
  selectedPresetUnit?: TUnit;
  onSelectedPresetUnitChange: (unit: TUnit | undefined) => void;
  labels: {
    minutes: string;
    hours: string;
    days: string;
    otherValue: string;
  };
  units: MaxTimeUnits<TUnit>;
  presets: MaxTimePreset<TUnit>[];
  lastPresetReplacement?: {
    key: string;
    label: ReactNode;
    selected: boolean;
    onSelect: () => void;
  };
}

export const MaxTimeSelector = <TUnit extends string | number>({
  value,
  onChange,
  disabled,
  maxRunningTimeHours,
  disabledTooltip,
  maxTimeUnit,
  onMaxTimeUnitChange,
  selectedPresetUnit,
  onSelectedPresetUnitChange,
  labels,
  units,
  presets,
  lastPresetReplacement,
}: MaxTimeSelectorProps<TUnit>) => {
  const visiblePresets = lastPresetReplacement ? presets.slice(0, -1) : presets;
  const currentPreset = visiblePresets.find(
    (preset) => preset.maxTime === value && preset.maxTimeUnit === selectedPresetUnit,
  )?.key;
  const selectedOption = lastPresetReplacement?.selected ? lastPresetReplacement.key : currentPreset;

  const getUnitLabel = (unit: TUnit) => {
    if (unit === units.minutes) return labels.minutes;
    if (unit === units.hours) return labels.hours;
    return labels.days;
  };
  const maxTimePresetToHours = (preset: MaxTimePreset<TUnit>) => {
    if (preset.maxTimeUnit === units.minutes) return preset.maxTime / 60;
    if (preset.maxTimeUnit === units.days) return preset.maxTime * 24;
    return preset.maxTime;
  };
  const disabledFrom = disabled
    ? 0
    : maxRunningTimeHours === undefined
      ? undefined
      : visiblePresets.findIndex((preset) => maxTimePresetToHours(preset) > maxRunningTimeHours);
  const normalizedDisabledFrom = disabledFrom === -1 ? undefined : disabledFrom;

  return (
    <SegmentedInputSelector
      options={[
        ...visiblePresets.map((preset) => ({
          label: `${preset.maxTime}${getUnitLabel(preset.maxTimeUnit)}`,
          value: preset.key,
        })),
        ...(lastPresetReplacement
          ? [{ label: lastPresetReplacement.label, value: lastPresetReplacement.key }]
          : []),
      ]}
      value={selectedOption}
      disabledFrom={normalizedDisabledFrom}
      disabledTooltip={disabledTooltip}
      // 为了让最大运行时间和单节点核心数的一排按钮的总宽度一致
      buttonItemPadding="0 19.7px"
      onPresetChange={(presetKey) => {
        if (presetKey === lastPresetReplacement?.key) {
          lastPresetReplacement.onSelect();
          return;
        }
        const preset = visiblePresets.find((item) => item.key === presetKey);
        if (!preset) return;
        onChange?.(preset.maxTime);
        onSelectedPresetUnitChange(preset.maxTimeUnit);
      }}
      renderInput={({ selectedPreset, clearSelectedPreset }) => (
        <RoundedInputNumberWithAddonAfter
          min={1}
          step={1}
          precision={0}
          style={{ width: 120 }}
          disabled={disabled}
          placeholder={labels.otherValue}
          value={selectedPreset !== undefined ? undefined : value}
          onChange={(nextValue) => {
            clearSelectedPreset();
            onSelectedPresetUnitChange(undefined);
            onChange?.(typeof nextValue === "number" ? nextValue : undefined);
          }}
          addonAfter={
            <AddonAfterSelect
              style={{ minWidth: "72px" }}
              value={maxTimeUnit}
              onChange={(nextUnit) => onMaxTimeUnitChange(nextUnit as TUnit)}
            >
              <Select.Option value={units.minutes}>{labels.minutes}</Select.Option>
              <Select.Option value={units.hours}>{labels.hours}</Select.Option>
              <Select.Option value={units.days}>{labels.days}</Select.Option>
            </AddonAfterSelect>
          }
        />
      )}
    />
  );
};
