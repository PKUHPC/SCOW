import { prefix } from "src/i18n";

import { TextsTransType } from "./Algorithm";

export enum DatasetType {
  IMAGE = "IMAGE",
  TEXT = "TEXT",
  VIDEO = "VIDEO",
  AUDIO = "AUDIO",
  OTHER = "OTHER",
}

export enum SceneType {
  CWS = "CWS",
  DA = "DA",
  IC = "IC",
  OD = "OD",
  OTHER = "OTHER",
}

export const DatasetTypeText: Record<string, string> = {
  IMAGE: "图像",
  TEXT: "文本",
  VIDEO: "视频",
  AUDIO: "音频",
  OTHER: "其他",
};

export const SceneTypeText = {
  CWS: "中文分词",
  DA: "数据增强",
  IC: "图像分类",
  OD: "目标检测",
  OTHER: "其他",
};

const p = prefix("app.dataset.model.");

export const getDatasetTexts = (t: TextsTransType) => {
  return {
    all: t(p("all")),
    image: t(p("image")),
    text: t(p("text")),
    video: t(p("video")),
    audio: t(p("audio")),
    other: t(p("other")),
    ces: t(p("ces")),
    da: t(p("da")),
    ic: t(p("ic")),
    od: t(p("od")),
  };
};
