const base = require("../../eslint.config");
const react = require("@ddadaal/eslint-config/react");

module.exports = [
  ...base,
  ...react,
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/only-throw-error": "off",
    }
  }
];
