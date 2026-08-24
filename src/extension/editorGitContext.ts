import * as path from "node:path";

export type EditorGitContext = {
  relativePath: string;
  repo: string;
};

/** Find the innermost known repository that contains `filePath`. */
export function findEditorGitContext(
  filePath: string,
  repoPaths: ReadonlyArray<string>
): EditorGitContext | null {
  const absoluteFile = path.resolve(filePath);
  let result: EditorGitContext | null = null;

  for (const candidate of repoPaths) {
    const repo = path.resolve(candidate);
    const relativePath = path.relative(repo, absoluteFile);
    if (
      relativePath === "" ||
      relativePath === ".." ||
      relativePath.startsWith(".." + path.sep) ||
      path.isAbsolute(relativePath)
    ) {
      continue;
    }

    if (result === null || repo.length > result.repo.length) {
      result = { repo, relativePath: relativePath.replaceAll(path.sep, "/") };
    }
  }

  return result;
}
