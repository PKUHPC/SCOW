import { parseTime } from "@scow/lib-web/build/utils/datetime";
function pad(num: number) {
  return num >= 10 ? num : "0" + num;
}

export function compareState(a: string, b: string): -1 | 0 | 1 {
  const endState = "ENDED";
  if (a === b || (a !== endState && b !== endState)) { return 0; }
  if (a === endState) { return -1; }
  return 1;
}

export function calculateAppRemainingTime(runningTime: string, timeLimit: string) {
  if (runningTime.split(/[:-]/).length < 2 || timeLimit.split(/[:-]/).length < 2) {
    // if timeLimit or runningTime is INVALID or UNLIMITED, return timeLimit
    return timeLimit;
  }
  const diffMs = parseTime(timeLimit) - parseTime(runningTime);
  return diffMs < 0 ? "00:00" : formatTime(diffMs);
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



