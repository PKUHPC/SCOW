import type { ReactNode } from "react";

import { Space } from "antd";
import { useEffect, useState } from "react";
import { styled } from "styled-components";

import { RoundedButton } from "./Button";
import { RoundedInputNumber } from "./Input";
import { Tooltip } from "./Tooltip";

const DEFAULT_PRESET_NUMBER_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128];

const Wrapper = styled.div`
  display: inline-flex;
`;

const SegmentItem = styled(RoundedButton)<{ $first?: boolean; $last?: boolean; $padding?: string }>`
  padding: ${({ $padding }) => $padding ?? "0 16px"};
  border-radius: 0 !important;
  margin-left: -1px;

  ${({ $first }) =>
    $first &&
    `
    margin-left: 0;
    border-radius: 4px 0 0 4px !important;
  `}

  ${({ $last }) =>
    $last &&
    `
    border-radius: 0 4px 4px 0 !important;
  `}

  &:not(:disabled):hover {
    position: relative;
    z-index: 1;
  }

  ${({ $selected }) =>
    $selected &&
    `
    position: relative;
    z-index: 2;
  `}

  &:disabled {
    color: ${({ theme }) => theme.palette.gray[4]} !important;
    opacity: 1;
  }
`;

export interface SegmentedButtonOption<T extends string | number> {
  label: ReactNode;
  value: T;
}

export interface SegmentedButtonsProps<T extends string | number> {
  options: SegmentedButtonOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  disabledFrom?: number;
  disabledTooltip?: ReactNode;
  itemPadding?: string;
}

export const SegmentedButtons = <T extends string | number>({
  options,
  value,
  onChange,
  disabledFrom,
  disabledTooltip,
  itemPadding,
}: SegmentedButtonsProps<T>) => (
  <Wrapper>
    {options.map((opt, i) => {
      const disabled = disabledFrom !== undefined && i >= disabledFrom;
      const selected = opt.value === value;
      const button = (
        <SegmentItem
          key={opt.value}
          $selected={selected}
          $first={i === 0}
          $last={i === options.length - 1}
          $padding={itemPadding}
          disabled={disabled}
          onClick={() => !disabled && onChange?.(opt.value)}
        >
          {opt.label}
        </SegmentItem>
      );

      if (!disabled || !disabledTooltip) {
        return button;
      }

      return (
        <Tooltip key={opt.value} title={disabledTooltip} arrow={false} align={{ offset: [0, -12] }}>
          <span>{button}</span>
        </Tooltip>
      );
    })}
  </Wrapper>
);

export interface SegmentedInputSelectorRenderInputArgs<T extends string | number> {
  selectedPreset?: T;
  clearSelectedPreset: () => void;
}

export interface SegmentedInputSelectorProps<T extends string | number> {
  options: SegmentedButtonOption<T>[];
  value?: T;
  onPresetChange?: (value: T) => void;
  disabledFrom?: number;
  disabledTooltip?: ReactNode;
  buttonItemPadding?: string;
  renderInput: (args: SegmentedInputSelectorRenderInputArgs<T>) => ReactNode;
}

export const SegmentedInputSelector = <T extends string | number>({
  options,
  value,
  onPresetChange,
  disabledFrom,
  disabledTooltip,
  buttonItemPadding,
  renderInput,
}: SegmentedInputSelectorProps<T>) => {
  const valueInOptions = options.some((option) => option.value === value);
  const [customInputActive, setCustomInputActive] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<T | undefined>(valueInOptions ? value : undefined);

  useEffect(() => {
    if (customInputActive) {
      if (selectedPreset !== undefined) {
        setSelectedPreset(undefined);
      }
      return;
    }

    if (valueInOptions && value !== selectedPreset) {
      setSelectedPreset(value);
    } else if (!valueInOptions && selectedPreset !== undefined) {
      setSelectedPreset(undefined);
    }
  }, [customInputActive, selectedPreset, value, valueInOptions]);

  const clearSelectedPreset = () => {
    setCustomInputActive(true);
    setSelectedPreset(undefined);
  };

  return (
    <Space size={15} wrap>
      <SegmentedButtons
        options={options}
        value={selectedPreset}
        disabledFrom={disabledFrom}
        disabledTooltip={disabledTooltip}
        itemPadding={buttonItemPadding}
        onChange={(nextValue) => {
          setCustomInputActive(false);
          setSelectedPreset(nextValue);
          onPresetChange?.(nextValue);
        }}
      />
      {renderInput({ selectedPreset, clearSelectedPreset })}
    </Space>
  );
};

export interface PresetNumberSelectorProps {
  value?: number;
  onChange?: (value?: number) => void;
  disabled?: boolean;
  max?: number;
  placeholder: string;
  disabledTooltip: string;
  presetOptions?: number[];
}

export const PresetNumberSelector = ({
  value,
  onChange,
  disabled,
  max,
  placeholder,
  disabledTooltip,
  presetOptions = DEFAULT_PRESET_NUMBER_OPTIONS,
}: PresetNumberSelectorProps) => {
  const disabledFrom = disabled ? 0 : max === undefined ? undefined : presetOptions.findIndex((option) => option > max);
  const normalizedDisabledFrom = disabledFrom === -1 ? undefined : disabledFrom;

  return (
    <SegmentedInputSelector
      options={presetOptions.map((option) => ({ label: option, value: option }))}
      value={value}
      disabledFrom={normalizedDisabledFrom}
      disabledTooltip={disabledTooltip}
      onPresetChange={(nextPreset) => onChange?.(nextPreset)}
      renderInput={({ selectedPreset, clearSelectedPreset }) => (
        <RoundedInputNumber
          min={1}
          step={1}
          precision={0}
          style={{ width: 120 }}
          disabled={disabled}
          max={max}
          placeholder={placeholder}
          value={selectedPreset !== undefined ? undefined : value}
          onChange={(nextValue) => {
            clearSelectedPreset();
            onChange?.(typeof nextValue === "number" ? nextValue : undefined);
          }}
        />
      )}
    />
  );
};
