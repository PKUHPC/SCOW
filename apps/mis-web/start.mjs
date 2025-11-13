import { execSync } from "child_process";
import { cpSync, existsSync, rmdirSync } from "fs";
import { replaceInFileSync } from "replace-in-file";

const BACKUP_DIR = ".next.backup";
const BASE_PATH = process.env.BASE_PATH || "";

// Check if backup directory exists
if (existsSync(BACKUP_DIR)) {
  // If backup directory exists, delete .next directory and copy new .next from backup
  rmdirSync(".next", { recursive: true });
  cpSync(BACKUP_DIR, ".next", { recursive: true });
} else {
  // If backup directory does not exist, copy new backup from .next
  cpSync(".next", BACKUP_DIR, { recursive: true });
}

// If BASE_PATH == "/", change it to ""
const basePath = BASE_PATH === "/" ? "" : BASE_PATH;

// Replace @BASE_PATH@ in .next files
const options = {
  files: ".next/**/*.*",
  from: /\/@BASE_PATH@/g,
  to: basePath,
};

replaceInFileSync(options);

// Run serve:next
execSync("npm run serve:next", { stdio: "inherit", env: {
  ...process.env,
} });
