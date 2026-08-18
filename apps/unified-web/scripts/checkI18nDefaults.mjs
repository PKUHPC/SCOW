import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const sourceRoot = join(process.cwd(), "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const errors = [];

const getSourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });

const isTranslationCall = (expression) =>
  (ts.isIdentifier(expression) && ["t", "translate"].includes(expression.text)) ||
  (ts.isPropertyAccessExpression(expression) && expression.name.text === "t");

const hasStringDefaultValue = (argument) =>
  argument !== undefined && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument));

for (const file of getSourceFiles(sourceRoot)) {
  const sourceFile = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      isTranslationCall(node.expression) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      !hasStringDefaultValue(node.arguments[1])
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      errors.push(`${relative(process.cwd(), file)}:${line + 1}:${character + 1}`);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (errors.length > 0) {
  console.error("Translation calls must include a string default value:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("All translation calls include default values.");
