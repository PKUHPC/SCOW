import { visit } from "unist-util-visit";

const ORGANIZATION_NAME = "PKUHPC";
const PROJECT_NAME = "private-scow";
// gitee or github
const GIT_PLATFORM = process.env.GIT_PLATFORM || "github";
const CR_URL = process.env.CR_URL || "ccrepo.pku.edu.cn/scow/scow";
const REPO_URL = `https://${GIT_PLATFORM}.com/${ORGANIZATION_NAME}/${PROJECT_NAME}`;
const REPO_FILE_URL = `${REPO_URL}/blob/master`;
const DOCS_URL = `https://${ORGANIZATION_NAME}.${GIT_PLATFORM}.io`;
const BASE_PATH = process.env.BASE_PATH || `/${PROJECT_NAME}/`;

export const variables = {
  BASE_PATH,
  ORGANIZATION_NAME,
  PROJECT_NAME,
  GIT_PLATFORM,
  REPO_URL,
  CR_URL,
  REPO_FILE_URL,
  DOCS_URL,
};

/**
 * Replace %key% to variables[key]
 * @param {string} template template string
 * @returns replaced string
 */
const replace = (template: string) => {
  return template.replace(/%([a-zA-Z0-9_]+)%/g, (_, p1) => variables[p1] ?? "");
};

const types = [
  { type: "link", property: "url" },
  { type: "code", property: "value" },
  { type: "inlineCode", property: "value" },
];

export const plugin = () => {
  const transformer = async (ast) => {
    visit(
      ast,
      types.map((x) => x.type),
      (node) => {
        const selected = types.find((x) => x.type === node.type);
        if (selected) {
          node[selected.property] = replace(node[selected.property]);
        }
      },
    );
  };
  return transformer;
};
