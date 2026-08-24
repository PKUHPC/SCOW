import { Button, DatePicker, Space, TimePicker } from "antd";
import dayjs from "dayjs";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import styled, { createGlobalStyle } from "styled-components";

import { getDefaultPresets } from "../utils/datetime";

export type DateTimeRange = [dayjs.Dayjs, dayjs.Dayjs];

export interface DateTimeRangePickerProps {
  value?: DateTimeRange;
  showTime?: boolean;
  languageId: string;
  onChange?: (timeRange: DateTimeRange) => void;
  onDraftChange?: (timeRange: DateTimeRange) => void;
  pickerWidth?: number;
}

const PopupStyle = createGlobalStyle`
  .scow-time-range-picker-time-popup .ant-picker-time-panel-column {
    padding-block: 98px;
  }

  /* 保留日期时间输入解析能力，时分秒通过上方独立的时间选择框编辑。 */
  .scow-time-range-picker-date-popup .ant-picker-datetime-panel > .ant-picker-time-panel {
    display: none;
  }
`;

const PanelContainer = styled.div`
  display: flex;
`;

const DatePanelContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const DateTimeFields = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px;
  border-block-end: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
`;

const PresetList = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 100px;
  padding: 8px;
  border-inline-end: 1px solid ${({ theme }) => theme.token.colorBorderSecondary};
`;

const PresetButton = styled(Button)`
  justify-content: flex-start;
`;

// 快捷选项中的“本周”统一以周一为起点，不受 dayjs locale 的 weekStart 配置影响。
const startOfMonday = (date: dayjs.Dayjs) => date.startOf("day").subtract((date.day() + 6) % 7, "day");
const disabledFutureDate = (date: dayjs.Dayjs) => date.isAfter(dayjs(), "day");

const mergeDateAndTime = (date: dayjs.Dayjs, time: dayjs.Dayjs) =>
  date.hour(time.hour()).minute(time.minute()).second(time.second()).millisecond(0);

// 纯日期模式按完整自然日查询；日期时间模式保留完整时间，包括快捷区间的日末毫秒边界。
const normalizeDate = (date: dayjs.Dayjs, boundary: "start" | "end", showTime: boolean) => {
  if (showTime) return date;
  return boundary === "start" ? date.startOf("day") : date.endOf("day");
};

// 用户将一端调整到另一端之外时，自动收敛另一端，始终保证 start <= end。
const normalizeTimeRange = (
  timeRange: DateTimeRange,
  changedTime: "start" | "end",
  showTime: boolean,
): DateTimeRange => {
  const [startTime, endTime] = timeRange;
  if (!startTime.isAfter(endTime)) return timeRange;

  if (showTime) {
    return changedTime === "start"
      ? [startTime, startTime.endOf("day").millisecond(0)]
      : [endTime.startOf("day"), endTime];
  }

  const changedDate = changedTime === "start" ? startTime : endTime;
  return [changedDate.startOf("day"), changedDate.endOf("day")];
};

const isSameTimeRange = (left: DateTimeRange, right: DateTimeRange) =>
  left[0].valueOf() === right[0].valueOf() && left[1].valueOf() === right[1].valueOf();

export const getDefaultDateTimeRange = (): DateTimeRange => [startOfMonday(dayjs()), dayjs().endOf("day")];

export const DateTimeRangePicker = ({
  value,
  showTime = true,
  languageId,
  onChange,
  onDraftChange,
  pickerWidth = 200,
}: DateTimeRangePickerProps) => {
  const fallbackTimeRange = useMemo(getDefaultDateTimeRange, []);
  const timeRange = value ?? fallbackTimeRange;
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [draftTimeRange, setDraftTimeRange] = useState(timeRange);
  // state 用于渲染，ref 用于同一轮连续事件中读取最新草稿和弹窗状态，避免闭包取到旧值。
  const draftTimeRangeRef = useRef(timeRange);
  const startPickerOpenRef = useRef(false);
  const endPickerOpenRef = useRef(false);
  const activePickerRef = useRef<"start" | "end" | null>(null);
  // 编辑期间收到的外部 value 延迟到弹窗关闭后应用，避免覆盖用户正在操作的草稿。
  const pendingTimeRangeRef = useRef<DateTimeRange | null>(null);
  // 记录本组件刚发出的值，用于识别受控组件回传，避免将其误判为外部更新。
  const emittedTimeRangeRef = useRef<DateTimeRange | null>(null);

  useEffect(() => {
    if (activePickerRef.current) {
      if (emittedTimeRangeRef.current && isSameTimeRange(emittedTimeRangeRef.current, timeRange)) {
        emittedTimeRangeRef.current = null;
        return;
      }

      pendingTimeRangeRef.current = timeRange;
      return;
    }

    emittedTimeRangeRef.current = null;
    pendingTimeRangeRef.current = null;
    draftTimeRangeRef.current = timeRange;
    setDraftTimeRange(timeRange);
  }, [timeRange]);

  // 保留 getDefaultPresets 的完整快捷项集合，仅在此统一时间边界语义。
  const presets = getDefaultPresets(languageId)?.flatMap((preset, index) => {
    const presetRange = typeof preset.value === "function" ? preset.value() : preset.value;
    const [startTime, endTime] = presetRange;
    if (!startTime || !endTime) return [];

    const normalizedStartTime = index === 1 ? startOfMonday(dayjs()) : startTime;
    return [
      {
        label: preset.label,
        timeRange: [
          normalizeDate(normalizedStartTime, "start", showTime),
          normalizeDate(endTime, "end", showTime),
        ] as DateTimeRange,
      },
    ];
  });

  const emitTimeRangeChange = (nextTimeRange: DateTimeRange) => {
    emittedTimeRangeRef.current = nextTimeRange;
    onChange?.(nextTimeRange);
  };

  const updateDraftTimeRange = (nextTimeRange: DateTimeRange) => {
    // 用户在外部值更新后继续编辑时，以本次编辑为准，避免关闭弹窗后被旧的 pending 值覆盖。
    pendingTimeRangeRef.current = null;
    draftTimeRangeRef.current = nextTimeRange;
    setDraftTimeRange(nextTimeRange);
    onDraftChange?.(nextTimeRange);
    // 受控值随草稿同步，避免关闭弹窗并立即搜索时读取到旧区间。
    emitTimeRangeChange(nextTimeRange);
  };

  const updateDraftTime = (changedTime: "start" | "end", time: dayjs.Dayjs) => {
    if (disabledFutureDate(time)) return;

    const currentTimeRange = draftTimeRangeRef.current;
    const normalizedTime = normalizeDate(time, changedTime, showTime);
    const nextTimeRange = normalizeTimeRange(
      changedTime === "start" ? [normalizedTime, currentTimeRange[1]] : [currentTimeRange[0], normalizedTime],
      changedTime,
      showTime,
    );
    updateDraftTimeRange(nextTimeRange);
  };

  // 起止选择器互斥打开；关闭当前选择器时再应用编辑期间暂存的外部值。
  const handlePickerOpenChange = (picker: "start" | "end", open: boolean) => {
    if (open) {
      activePickerRef.current = picker;
      startPickerOpenRef.current = picker === "start";
      endPickerOpenRef.current = picker === "end";
      setStartPickerOpen(picker === "start");
      setEndPickerOpen(picker === "end");
      return;
    }

    if (picker === "start") {
      startPickerOpenRef.current = false;
      setStartPickerOpen(false);
    } else {
      endPickerOpenRef.current = false;
      setEndPickerOpen(false);
    }

    if (activePickerRef.current === picker) {
      activePickerRef.current = null;

      const pendingTimeRange = pendingTimeRangeRef.current;
      if (pendingTimeRange) {
        pendingTimeRangeRef.current = null;
        draftTimeRangeRef.current = pendingTimeRange;
        setDraftTimeRange(pendingTimeRange);
      }
    }
  };

  const handlePresetSelect = (presetTimeRange: DateTimeRange) => {
    // 快捷区间作为整体写入，确保起、止时间同时更新。
    pendingTimeRangeRef.current = null;
    draftTimeRangeRef.current = presetTimeRange;
    setDraftTimeRange(presetTimeRange);
    activePickerRef.current = null;
    startPickerOpenRef.current = false;
    endPickerOpenRef.current = false;
    onDraftChange?.(presetTimeRange);
    emitTimeRangeChange(presetTimeRange);
    setStartPickerOpen(false);
    setEndPickerOpen(false);
  };

  // 在 Ant Design 日期面板外侧组合快捷选项，以及独立的日期、时间输入框。
  const renderPanel = (panel: ReactNode, boundary: "start" | "end", draftTime: dayjs.Dayjs) => (
    <PanelContainer>
      <PresetList>
        {presets?.map((preset) => (
          <PresetButton
            key={String(preset.label)}
            type="text"
            htmlType="button"
            onPointerDown={(event) => {
              // 在弹窗可能关闭前先写入区间，避免按钮在 click 阶段前被卸载。
              event.preventDefault();
              event.stopPropagation();
              handlePresetSelect(preset.timeRange);
            }}
            onClick={(event) => {
              event.stopPropagation();
              // 键盘触发按钮时没有 pointerdown，保留无障碍操作能力。
              if (event.detail === 0) {
                handlePresetSelect(preset.timeRange);
              }
            }}
          >
            {preset.label}
          </PresetButton>
        ))}
      </PresetList>
      <DatePanelContainer>
        <DateTimeFields>
          <DatePicker
            value={draftTime}
            format="YYYY-MM-DD"
            allowClear={false}
            inputReadOnly={false}
            open={false}
            suffixIcon={null}
            disabledDate={disabledFutureDate}
            onCalendarChange={(date) => {
              if (!Array.isArray(date) && date) {
                updateDraftTime(boundary, showTime ? mergeDateAndTime(date, draftTime) : date);
              }
            }}
            onChange={(date) => {
              if (date) updateDraftTime(boundary, showTime ? mergeDateAndTime(date, draftTime) : date);
            }}
            style={{ width: 120 }}
          />
          {showTime ? (
            <TimePicker
              value={draftTime}
              format="HH:mm:ss"
              showNow={false}
              allowClear={false}
              changeOnScroll
              inputReadOnly={false}
              needConfirm
              onCalendarChange={(time) => {
                if (!Array.isArray(time) && time) {
                  updateDraftTime(boundary, mergeDateAndTime(draftTime, time));
                }
              }}
              onChange={(time) => {
                if (time) updateDraftTime(boundary, mergeDateAndTime(draftTime, time));
              }}
              onOk={(time) => {
                if (!Array.isArray(time) && time) {
                  updateDraftTime(boundary, mergeDateAndTime(draftTime, time));
                }
              }}
              getPopupContainer={(triggerNode) => triggerNode.parentElement ?? triggerNode}
              popupClassName="scow-time-range-picker-time-popup"
              style={{ width: 110 }}
            />
          ) : null}
        </DateTimeFields>
        {panel}
      </DatePanelContainer>
    </PanelContainer>
  );

  const commonDatePickerProps = {
    needConfirm: true,
    showNow: false,
    inputReadOnly: false,
    allowClear: false,
    disabledDate: disabledFutureDate,
    popupClassName: "scow-time-range-picker-date-popup",
  } as const;

  return (
    <>
      <PopupStyle />
      <Space size={8}>
        <DatePicker
          {...commonDatePickerProps}
          value={draftTimeRange[0]}
          open={startPickerOpen}
          onOpenChange={(open) => handlePickerOpenChange("start", open)}
          showTime={showTime ? { format: "HH:mm:ss" } : false}
          format={showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD"}
          onCalendarChange={(startTime) => {
            if (startPickerOpenRef.current && !Array.isArray(startTime) && startTime) {
              updateDraftTime("start", startTime);
            }
          }}
          onChange={(startTime) => {
            if (startPickerOpenRef.current && startTime) {
              updateDraftTime("start", startTime);
            }
          }}
          panelRender={(panel) => renderPanel(panel, "start", draftTimeRange[0])}
          style={{ width: showTime ? pickerWidth : 140 }}
        />
        <span>—</span>
        <DatePicker
          {...commonDatePickerProps}
          value={draftTimeRange[1]}
          open={endPickerOpen}
          onOpenChange={(open) => handlePickerOpenChange("end", open)}
          showTime={showTime ? { format: "HH:mm:ss" } : false}
          format={showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD"}
          onCalendarChange={(endTime) => {
            if (endPickerOpenRef.current && !Array.isArray(endTime) && endTime) {
              updateDraftTime("end", endTime);
            }
          }}
          onChange={(endTime) => {
            if (endPickerOpenRef.current && endTime) {
              updateDraftTime("end", endTime);
            }
          }}
          panelRender={(panel) => renderPanel(panel, "end", draftTimeRange[1])}
          style={{ width: showTime ? pickerWidth : 140 }}
        />
      </Space>
    </>
  );
};
