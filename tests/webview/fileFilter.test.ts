import { describe, expect, it } from "vitest";

import type { GitFileChange } from "@/backend/types";
import {
  ALL_FILE_TYPES,
  fileExtension,
  fileTypeOptions,
  filterFilesByType
} from "@/webview/utils/fileFilter";

function changed(path: string): GitFileChange {
  return {
    oldFilePath: path,
    newFilePath: path,
    type: "M",
    additions: 1,
    deletions: 0
  };
}

describe("fileFilter", () => {
  const files = [changed("src/Game.cs"), changed("web/main.TS"), changed("LICENSE")];

  it("normalizes extensions and keeps extensionless files distinct", () => {
    expect(fileExtension("src/Game.CS")).toBe(".cs");
    expect(fileExtension(".gitignore")).toBe("");
    expect(fileExtension("LICENSE")).toBe("");
  });

  it("prioritizes C# in the detected type options", () => {
    expect(fileTypeOptions(files)).toEqual([".cs", ".ts", ""]);
  });

  it("filters by normalized file type without mutating the source", () => {
    expect(filterFilesByType(files, ".cs").map((file) => file.newFilePath)).toEqual([
      "src/Game.cs"
    ]);
    expect(filterFilesByType(files, ALL_FILE_TYPES)).toEqual(files);
    expect(files).toHaveLength(3);
  });
});
