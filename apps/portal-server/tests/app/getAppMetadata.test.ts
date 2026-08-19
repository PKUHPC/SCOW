import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { AttributeType, FileSelectionType } from "@scow/config/build/app";
import { I18nStringType } from "@scow/config/build/i18n";
import { getClientFn } from "@scow/lib-server";
import {
  appCustomAttribute_AttributeTypeToJSON,
  AppServiceClient,
  FileInputConfig_SelectionType,
} from "@scow/protos/build/portal/app";
import { createServer } from "src/app";
import { commonConfig } from "src/config/common";
import * as appUtils from "src/utils/app";
import { getI18nTypeFormat } from "tests/file/utils";

jest.mock("src/utils/clusters", () => ({
  ...jest.requireActual("src/utils/clusters"),
  checkActivatedClusters: jest.fn().mockResolvedValue(undefined),
}));

export interface SelectOption {
  value: string;
  label: I18nStringType;
}

interface AppCustomAttribute {
  type: "NUMBER" | "SELECT" | "TEXT";
  label: I18nStringType;
  name: string;
  required: boolean;
  placeholder?: I18nStringType | undefined;
  default?: string | number | undefined;
  select: SelectOption[];
}

let server: Server;
let client: AppServiceClient;

beforeEach(async () => {
  server = await createServer();

  await server.start();

  client = getClientFn(server.serverAddress, commonConfig.scowApi.auth.token)(AppServiceClient);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await server.close();
});

it("get app metadata", async () => {
  const appId = "vscode";
  const cluster = "hpc01";

  const reply = await asyncUnaryCall(client, "getAppMetadata", { appId, cluster });

  const attributes: AppCustomAttribute[] = reply.attributes.map((item) => ({
    type: appCustomAttribute_AttributeTypeToJSON(item.type) as AppCustomAttribute["type"],
    label: getI18nTypeFormat(item.label),
    name: item.name,
    select: item.options?.map((option) => {
      return {
        value: option.value,
        label: getI18nTypeFormat(option.label),
        requireGpu: option.requireGpu,
      };
    }),
    required: item.required,
    default: item.defaultInput
      ? item.defaultInput?.$case === "text"
        ? item.defaultInput.text
        : item.defaultInput.number
      : undefined,
    placeholder: getI18nTypeFormat(item.placeholder),
  }));

  expect(attributes).toEqual([
    {
      type: "TEXT",
      label: "版本",
      name: "version",
      select: [],
      required: false,
      default: "a version",
      placeholder: "aaa",
    },
    {
      type: "TEXT",
      label: "版本",
      name: "version2",
      select: [],
      required: false,
      default: 123,
      placeholder: "",
    },
    {
      type: "NUMBER",
      label: "版本",
      name: "version3",
      select: [],
      required: false,
      default: 456,
      placeholder: "",
    },
    {
      type: "NUMBER",
      label: "版本",
      name: "version4",
      select: [],
      required: false,
      default: undefined,
      placeholder: "",
    },
    {
      type: "SELECT",
      label: "版本",
      name: "version5",
      select: [
        {
          label: "version 4.8.0",
          value: "code-server/4.8.0",
        },
        {
          label: "version 4.9.0",
          value: "code-server/4.9.0",
        },
      ],
      required: true,
      default: undefined,
      placeholder: "",
    },
  ]);
});

it("returns file input constraints", async () => {
  const apps = appUtils.getClusterAppConfigs("hpc01");
  jest.spyOn(appUtils, "getClusterAppConfigs").mockReturnValue({
    ...apps,
    vscode: {
      ...apps.vscode,
      attributes: [
        ...(apps.vscode.attributes ?? []),
        {
          type: AttributeType.file,
          name: "scriptPath",
          label: "Script",
          required: true,
          file: {
            selectionType: FileSelectionType.file,
            extensions: [".sh", ".tar.gz"],
          },
        },
      ],
    },
  });

  const reply = await asyncUnaryCall(client, "getAppMetadata", { appId: "vscode", cluster: "hpc01" });

  expect(reply.attributes.at(-1)?.file).toEqual({
    selectionType: FileInputConfig_SelectionType.FILE,
    extensions: [".sh", ".tar.gz"],
  });
});
