import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

// load global plugins

dayjs.extend(timezone);
dayjs.extend(utc);

export = dayjs;
