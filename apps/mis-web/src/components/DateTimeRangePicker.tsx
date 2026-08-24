import {
  DateTimeRange,
  DateTimeRangePicker as LibDateTimeRangePicker,
  DateTimeRangePickerProps,
} from "@scow/lib-web/build/components/DateTimeRangePicker";
import { useI18n } from "src/i18n";

export type { DateTimeRange };

type Props = Omit<DateTimeRangePickerProps, "languageId">;

export const DateTimeRangePicker = (props: Props) => {
  const languageId = useI18n().currentLanguage.id;

  return <LibDateTimeRangePicker {...props} languageId={languageId} />;
};
