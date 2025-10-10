/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { inferRouterOutputs } from "@trpc/server";
import { prefix } from "src/i18n";
import { AppRouter } from "src/server/trpc/router";

import { TextsTransType } from "./Algorithm";

export type ImageInterface = inferRouterOutputs<AppRouter>["image"]["list"]["items"][0];

export enum Source {
  INTERNAL = "INTERNAL",
  EXTERNAL = "EXTERNAL",
};

export enum Status {
  CREATING = "CREATING",
  CREATED = "CREATED",
  FAILURE = "FAILURE",
}
export enum ImageType {
  APP = "APP",
  TRAIN = "TRAIN",
  INFER = "INFER",
  DEV_HOST = "DEV_HOST",
}

const p = prefix("app.image.model.");

export const getImageTypeText = (t: TextsTransType) => ({
  APP: getImageTexts(t).APP,
  TRAIN: getImageTexts(t).TRAIN,
  INFER: getImageTexts(t).INFER,
  DEV_HOST: getImageTexts(t).DEV_HOST,
});

export const getImageTexts = (t: TextsTransType) => {

  return {
    INTERNAL:t(p("internal")),
    EXTERNAL:t(p("external")),
    APP:t(p("app")),
    TRAIN : t(p("training")),
    INFER : t(p("inferring")),
    DEV_HOST: t(p("devHost")),
  };

};
