import { inferRouterOutputs } from "@trpc/server";
import { Lang } from "react-typed-i18n";
import { prefix } from "src/i18n";
import en from "src/i18n/en";
import { AppRouter } from "src/server/trpc/router";

export type AlgorithmInterface = inferRouterOutputs<AppRouter>["algorithm"]["getAlgorithms"]["items"][0];
export type AlgorithmVersionInterface = inferRouterOutputs<AppRouter>["algorithm"]["getAlgorithmVersions"]["items"][0];

export enum Framework {
  TENSORFLOW = "TENSORFLOW",
  PYTORCH = "PYTORCH",
  KERAS = "KERAS",
  MINDSPORE = "MINDSPORE",
  OTHER = "OTHER",
}

export const AlgorithmTypeText = {
  [Framework.TENSORFLOW]: "TensorFlow",
  [Framework.PYTORCH]: "PyTorch",
  [Framework.KERAS]: "Keras",
  [Framework.MINDSPORE]: "MindSpore",
  [Framework.OTHER]: "其他",
} as const;

export type TextsTransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;
const p = prefix("app.algorithm.model.");

export const getAlgorithmTexts = (t: TextsTransType) => {
  return {
    all: t(p("all")),
    other: t(p("other")),
  };
};
