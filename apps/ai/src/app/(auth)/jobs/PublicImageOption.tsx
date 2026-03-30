"use client";

import { Typography } from "antd";
import { prefix, useI18nTranslateToString } from "src/i18n";

import { StyledPublicImageOption } from "./LaunchJobForm.styles";

interface PublicImageOptionProps {
  name: string;
  tag: string;
  ownerName?: string;
  ownerId?: string;
}

const p = prefix("app.jobs.publicImageOption.");

export const PublicImageOption = ({ name, tag, ownerName, ownerId }: PublicImageOptionProps) => {
  const t = useI18nTranslateToString();
  const ownerDisplay = ownerName ?? ownerId ?? "-";

  return (
    <StyledPublicImageOption>
      <span className="image-name">{`${name}: ${tag}`}</span>
      <Typography.Text className="image-owner">
        {t(p("sharedBy"), [ownerDisplay])}{ownerId ? t(p("ownerIdSuffix"), [ownerId]) : ""}
      </Typography.Text>
    </StyledPublicImageOption>
  );
};
