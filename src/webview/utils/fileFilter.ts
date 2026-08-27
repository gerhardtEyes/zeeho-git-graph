import type { GitFileChange } from "@/backend/types";

export const ALL_FILE_TYPES = "*";
export const NO_FILE_EXTENSION = "";

/** Lower-case extension including the leading dot, or an empty string when absent. */
export function fileExtension(filePath: string): string {
  const fileName = filePath.split(/[\\/]/).at(-1) ?? filePath;
  const dot = fileName.lastIndexOf(".");
  return dot > 0 && dot < fileName.length - 1
    ? fileName.slice(dot).toLowerCase()
    : NO_FILE_EXTENSION;
}

export function fileTypeOptions(files: ReadonlyArray<GitFileChange>): Array<string> {
  const extensions = new Set(files.map((file) => fileExtension(file.newFilePath)));
  return [...extensions].toSorted((a, b) => {
    if (a === ".cs") {
      return -1;
    }
    if (b === ".cs") {
      return 1;
    }
    if (a === NO_FILE_EXTENSION) {
      return 1;
    }
    if (b === NO_FILE_EXTENSION) {
      return -1;
    }
    return a.localeCompare(b);
  });
}

export function filterFilesByType(
  files: ReadonlyArray<GitFileChange>,
  extension: string
): Array<GitFileChange> {
  return extension === ALL_FILE_TYPES
    ? [...files]
    : files.filter((file) => fileExtension(file.newFilePath) === extension);
}
