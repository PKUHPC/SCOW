import { executableScriptExtensions } from "src/utils/executableExtensions";
import { languageMap } from "src/utils/languageMap";
import { nonEditableExtensions } from "src/utils/nonEditableExtensions";

export function basename(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

export function getExtension(filename: string) {
  const parts = filename.split(".");
  const extension = parts.pop();
  return extension ? extension.toLowerCase() : "";
}

export function isImage(filename: string): boolean {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "svg", "webp"];
  const extension = getExtension(filename);
  return imageExtensions.includes(extension);
}

export function getLanguage(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return languageMap[ext] || "plaintext";
}

export function isNonEditableFilename(filename: string, nonEditableFilenamePostfixes?: string[]): boolean {
  // 优先检查用户配置的后缀
  if (nonEditableFilenamePostfixes && nonEditableFilenamePostfixes.length > 0) {
    return nonEditableFilenamePostfixes.some((suffix) => {
      // 处理空后缀字符串
      if (suffix.length === 0) {
        return false;
      }
      // 检查结尾是否匹配
      return filename.toLowerCase().endsWith(suffix);
    });
  } else {
    // 检查文件名是否以Set中的任何一个后缀结尾
    for (const ext of nonEditableExtensions) {
      // 检查结尾是否匹配
      if (filename.toLowerCase().endsWith(ext)) {
        return true;
      }
    }
    return false;
  }
}

export function isExecutableScriptFilename(filename: string, executableFilenamePostfixes?: string[]): boolean {
  // 优先使用用户配置的后缀白名单
  if (executableFilenamePostfixes && executableFilenamePostfixes.length > 0) {
    return executableFilenamePostfixes.some((suffix) => {
      if (!suffix || suffix.length === 0) {
        return false;
      }
      return filename.toLowerCase().endsWith(suffix);
    });
  }

  // 否则使用默认的常见Linux可运行脚本后缀
  for (const ext of executableScriptExtensions) {
    if (filename.toLowerCase().endsWith(ext)) {
      return true;
    }
  }
  return false;
}
