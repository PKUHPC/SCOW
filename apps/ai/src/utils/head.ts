import { useEffect } from "react";
import { useUiConfig } from "src/app/uiContext";

export function useDocumentTitle(title: string) {
  const { uiConfig } = useUiConfig();
  useEffect(() => {
    document.title = `${title} ${uiConfig.config?.titleTag || "- SCOW"}`;
  }, [title]);
}
