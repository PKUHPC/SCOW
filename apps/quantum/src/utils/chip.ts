import { BaseDeviceErr, DeviceStateString, DisplayedDeviceState } from "src/models/device";

export function getGateFidelities(Err: BaseDeviceErr) {
  const sqFidelity = Err.SQ ? `${((1 - Err.SQ) * 100).toFixed(2)}%` : "-";
  const czFidelity = Err.CZ ? `${((1 - Err.CZ) * 100).toFixed(2)}%` : "-";

  return [sqFidelity, czFidelity];
}

export function getReadoutFidelity(Err: BaseDeviceErr) {
  if (!Err.Readout) return undefined;

  const { F0, F1 } = Err.Readout;

  const F0String = `${((1 - F0) * 100).toFixed(2)}%`;
  const F1String = `${((1 - F1) * 100).toFixed(2)}%`;

  return [F0String, F1String];
}

export const mapDeviceStateToDisplayState = (deviceState: DeviceStateString | undefined):
  DisplayedDeviceState | undefined => {
  switch (deviceState) {
    case "on":
      return DisplayedDeviceState.DISPLAYED_ONLINE;
    case "off":
      return DisplayedDeviceState.DISPLAYED_OFFLINE;
    case "maintenance":
      return DisplayedDeviceState.DISPLAYED_MAINTENANCE;
    default:
      return undefined;
  }
};
