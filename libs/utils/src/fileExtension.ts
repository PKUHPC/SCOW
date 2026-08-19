const asciiUppercasePattern = /[A-Z]/g;

export function normalizeAsciiCase(value: string): string {
  return value.replace(asciiUppercasePattern, (character) => character.toLowerCase());
}

export function isValidFileExtension(extension: string): boolean {
  return (
    extension.startsWith(".") &&
    !/\s/.test(extension) &&
    !extension.includes("/") &&
    !extension.includes("\\") &&
    /[^.]/.test(extension)
  );
}

export function areFileExtensionsValid(extensions: readonly string[]): boolean {
  const normalizedExtensions = new Set<string>();

  for (const extension of extensions) {
    if (!isValidFileExtension(extension)) {
      return false;
    }

    const normalizedExtension = normalizeAsciiCase(extension);
    if (normalizedExtensions.has(normalizedExtension)) {
      return false;
    }
    normalizedExtensions.add(normalizedExtension);
  }

  return true;
}

export function matchesFileExtension(filePath: string, extensions: readonly string[]): boolean {
  if (extensions.length === 0) {
    return true;
  }

  const fileName = filePath.slice(filePath.lastIndexOf("/") + 1);
  const normalizedName = normalizeAsciiCase(fileName);

  return extensions.some((extension) => {
    const normalizedExtension = normalizeAsciiCase(extension);
    return normalizedName.length > normalizedExtension.length && normalizedName.endsWith(normalizedExtension);
  });
}
