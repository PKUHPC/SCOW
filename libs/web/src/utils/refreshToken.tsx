import React, { useCallback, useState } from "react";
import { ClickableA } from "src/components/ClickableA";

import { getCurrentLangLibWebText } from "./libWebI18n/libI18n";

export function useRefreshToken() {
  const [refreshToken, setRefreshToken] = useState(false);

  const updateRefreshToken = useCallback(() => setRefreshToken((original) => !original), []);

  return [refreshToken, updateRefreshToken] as const;
}

export interface Refreshable {
  refreshToken: boolean;
}

interface RefreshLinkProps {
  refresh: () => void;
  languageId: string;
}

export const RefreshLink: React.FC<RefreshLinkProps> = ({ refresh, languageId }) => (
  <ClickableA onClick={refresh}>{getCurrentLangLibWebText(languageId, "refreshButton")}</ClickableA>
);
