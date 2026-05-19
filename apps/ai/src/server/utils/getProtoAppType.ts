import { AppType } from "@scow/scheduler-adapter-protos/build/app";
import { AppName } from "src/models/App";

export function getProtoAppType(appName: AppName | undefined) {
  switch (appName) {
    case AppName.VSCODE:
      return AppType.APP_TYPE_VSCODE;
    case AppName.JUPYTER_LAB:
      return AppType.APP_TYPE_JUPYTER_LAB;
    default:
      return AppType.APP_TYPE_UNSPECIFIED;
  }
}
