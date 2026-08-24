import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { findEditorGitContext } from "@/extension/editorGitContext";

describe("findEditorGitContext", () => {
  it("uses the innermost repository", () => {
    const root = path.resolve("/workspace");
    const nested = path.join(root, "packages", "nested");
    const file = path.join(nested, "src", "file.ts");

    expect(findEditorGitContext(file, [root, nested])).toEqual({
      repo: nested,
      relativePath: "src/file.ts"
    });
  });

  it("rejects a sibling with a shared prefix", () => {
    const repo = path.resolve("/workspace/repo");
    const file = path.resolve("/workspace/repository/file.ts");

    expect(findEditorGitContext(file, [repo])).toBeNull();
  });

  it("returns null outside known repositories", () => {
    expect(
      findEditorGitContext(path.resolve("/other/file.ts"), [path.resolve("/workspace")])
    ).toBeNull();
  });
});
