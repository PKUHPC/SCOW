import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { useState } from "react";
import { LoginNode } from "src/utils/cluster";
export function LoginNodeStore(initLoginNodes: Record<string, LoginNode[]>, initLanguageId: string) {
  const [languageId, setLanguageId] = useState<string>(initLanguageId);
  const [loginNodes] = useState<Record<string, LoginNode[]>>(initLoginNodes);

  const getI18LoginNode = (loginNodes: Record<string, LoginNode[]>, languageId: string) => {
    const newLoginNodes: Record<string, LoginNode[]> = {};

    Object.keys(loginNodes).forEach((clusterId) => {
      const curLoginNodes = loginNodes[clusterId];
      newLoginNodes[clusterId] = curLoginNodes.map((loginNode) => ({
        name: getI18nConfigCurrentText(loginNode.name, languageId),
        address: loginNode.address,
      }));
    });
    return newLoginNodes;
  };

  return { loginNodes: getI18LoginNode(loginNodes, languageId), setLanguageId };
}
