import { createMaxTimePresets, type MaxTimeUnits } from "@scow/lib-web/build/components/job/MaxTimeSelector";

import type { MaxTimeUnit } from "./LaunchJobForm.types";

export const MAX_TIME_UNITS: MaxTimeUnits<MaxTimeUnit> = {
  minutes: "min",
  hours: "hour",
  days: "day",
};

export const MAX_TIME_PRESETS = createMaxTimePresets(MAX_TIME_UNITS);
