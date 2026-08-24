export type FilePathParts = {
  directory: string;
  fileName: string;
};

/** Split a changed file path without losing the separator shown to the user. */
export function splitFilePath(filePath: string): FilePathParts {
  const separatorIndex = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));

  if (separatorIndex < 0) {
    return { directory: "", fileName: filePath };
  }

  return {
    directory: filePath.slice(0, separatorIndex + 1),
    fileName: filePath.slice(separatorIndex + 1)
  };
}

/** Git paths are case-sensitive, but the C# extension itself is not. */
export function isCSharpFile(filePath: string): boolean {
  return /\.cs$/i.test(filePath);
}
