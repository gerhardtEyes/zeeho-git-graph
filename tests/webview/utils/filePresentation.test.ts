import { describe, expect, it } from "vitest";

import { isCSharpFile, splitFilePath } from "@/webview/utils/filePresentation";

describe("splitFilePath", () => {
  it("keeps a nested directory separate from the file name", () => {
    expect(splitFilePath("Assets/Scripts/Player.cs")).toEqual({
      directory: "Assets/Scripts/",
      fileName: "Player.cs"
    });
  });

  it("supports a file at the repository root", () => {
    expect(splitFilePath("README.md")).toEqual({ directory: "", fileName: "README.md" });
  });

  it("preserves a Windows-style separator", () => {
    expect(splitFilePath("Assets\\Scripts\\Player.cs")).toEqual({
      directory: "Assets\\Scripts\\",
      fileName: "Player.cs"
    });
  });
});

describe("isCSharpFile", () => {
  it("recognises C# source files case-insensitively", () => {
    expect(isCSharpFile("Assets/Scripts/Player.cs")).toBe(true);
    expect(isCSharpFile("Assets/Scripts/Player.CS")).toBe(true);
  });

  it("does not treat a C# metadata file as source code", () => {
    expect(isCSharpFile("Assets/Scripts/Player.cs.meta")).toBe(false);
  });
});
