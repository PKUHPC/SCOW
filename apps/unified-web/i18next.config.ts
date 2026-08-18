import { defineConfig } from "i18next-cli";

export default defineConfig({
  locales: ["zh_cn", "en"],
  extract: {
    input: ["src/**/*.{ts,tsx}"],
    output: "src/i18n/locales/{{language}}/{{namespace}}.json",
    primaryLanguage: "zh_cn",
    defaultNS: "common",
    functions: ["t", "*.t", "i18n.t", "translate"],
    useTranslationNames: ["useTranslation"],
    preservePatterns: ["portal:*", "ai:*", "quantum:*"],
    extractFromComments: false,
    sort: true,
    warnOnConflicts: "error",
  },
  lint: {
    ignoredAttributes: ["data-testid"],
    ignoredTags: ["code", "pre"],
    checkInterpolationParams: true,
  },
});
