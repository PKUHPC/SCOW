function pad(num: number) {
  return num >= 10 ? num : "0" + num;
}

// calculate number of milliseconds to format [{days}-][{Hours}:]{MM}:{SS}
export function formatTime(milliseconds: number) {
  if (milliseconds === 0) {
    return "00:00";
  }

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
