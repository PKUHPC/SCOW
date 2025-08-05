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


export enum JobType {
  APP = "app",
  TRAIN = "train",
  INFER = "infer",
}

export enum ImageSource {
  DEFAULT = "default",
  LOCAL = "local",
  REMOTE = "remote",
}

export const statusColors: Record<string, string> = {
  RUNNING: "#46B600",
  PENDING: "#B0B600",
  COMPLETED: "#3584D9",
  FAILED: "#D93566",
  CANCELED: "#A1A1A1",
  TIMEOUT: "#5FBDEC",
  ENDED: "#6A6A6A",
};
