import type { SimpleGit } from "simple-git";

import type { DateType, GitCommitDetails, GitFileChangeType, QueryResult } from "@/backend/types";

const eolRegex = /\r\n|\r|\n/g;
const gitLogSeparator = "XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb";

type CommitDetailsInput = {
  commitHash: string;
  dateType: DateType;
};

function toPath(str: string) {
  return str.replace(/\\/g, "/");
}

async function fetchCommitInfo(
  git: SimpleGit,
  commitHash: string,
  dateType: DateType
): Promise<GitCommitDetails> {
  const dateField = dateType === "Author Date" ? "%at" : "%ct";
  const format = ["%H", "%P", "%an", "%ae", dateField, "%cn"].join(gitLogSeparator) + "%n%B";
  const stdout = await git.raw(["show", "--quiet", commitHash, `--format=${format}`]);
  const lines = stdout.split(eolRegex);
  let lastLine = lines.length - 1;
  while (lastLine >= 0 && lines[lastLine] === "") {
    lastLine--;
  }
  const commitInfo = lines[0].split(gitLogSeparator);
  return {
    hash: commitInfo[0],
    parents: commitInfo[1].split(" "),
    author: commitInfo[2],
    email: commitInfo[3],
    date: parseInt(commitInfo[4]),
    committer: commitInfo[5],
    body: lines.slice(1, lastLine + 1).join("\n"),
    fileChanges: []
  };
}

async function fetchNameStatus(git: SimpleGit, commitHash: string): Promise<string[]> {
  const stdout = await git.raw([
    "diff-tree",
    "--name-status",
    "-r",
    "-m",
    "--root",
    "--find-renames",
    "--diff-filter=AMDR",
    commitHash
  ]);
  return stdout.split(eolRegex);
}

async function fetchNumStat(git: SimpleGit, commitHash: string): Promise<string[]> {
  const stdout = await git.raw([
    "diff-tree",
    "--numstat",
    "-r",
    "-m",
    "--root",
    "--find-renames",
    "--diff-filter=AMDR",
    commitHash
  ]);
  return stdout.split(eolRegex);
}

/** Parse a NUL-delimited `git diff --name-status` result without mangling unusual paths. */
function parseWorkingTreeNameStatus(stdout: string): GitCommitDetails["fileChanges"] {
  const fields = stdout.split("\0");
  const fileChanges: GitCommitDetails["fileChanges"] = [];

  for (let i = 0; i < fields.length;) {
    const statusField = fields[i++];
    if (statusField === "") {
      continue;
    }

    const separator = statusField.indexOf("\t");
    const status = separator === -1 ? statusField : statusField.substring(0, separator);
    const firstPath = separator === -1 ? fields[i++] : statusField.substring(separator + 1);
    if (!firstPath) {
      break;
    }

    const type = status[0] as GitFileChangeType;
    const oldFilePath = toPath(firstPath);
    const newFilePath = type === "R" ? toPath(fields[i++] ?? firstPath) : oldFilePath;
    fileChanges.push({ oldFilePath, newFilePath, type, additions: null, deletions: null });
  }

  return fileChanges;
}

/** Apply a NUL-delimited `git diff --numstat` result to the matching file changes. */
function applyWorkingTreeNumStat(stdout: string, fileChanges: GitCommitDetails["fileChanges"]) {
  const lookup = new Map(fileChanges.map((file) => [file.newFilePath, file]));
  const fields = stdout.split("\0");

  for (let i = 0; i < fields.length;) {
    const stat = fields[i++];
    if (stat === "") {
      continue;
    }

    const columns = stat.split("\t");
    if (columns.length !== 3) {
      continue;
    }

    let newFilePath = columns[2];
    if (newFilePath === "") {
      i++; // The old path of a rename precedes its new path.
      newFilePath = fields[i++] ?? "";
    }

    const file = lookup.get(toPath(newFilePath));
    if (file === undefined) {
      continue;
    }

    file.additions = columns[0] === "-" ? null : parseInt(columns[0]);
    file.deletions = columns[1] === "-" ? null : parseInt(columns[1]);
  }
}

/** Git may report an unmerged path once as U and again as its working-tree M entry. */
function coalesceWorkingTreeChanges(fileChanges: GitCommitDetails["fileChanges"]) {
  const byPath = new Map<string, GitCommitDetails["fileChanges"][number]>();
  for (const file of fileChanges) {
    const existing = byPath.get(file.newFilePath);
    if (existing === undefined) {
      byPath.set(file.newFilePath, file);
      continue;
    }

    if (file.type === "U") {
      file.additions ??= existing.additions;
      file.deletions ??= existing.deletions;
      byPath.set(file.newFilePath, file);
    } else if (existing.type === "U") {
      existing.additions ??= file.additions;
      existing.deletions ??= file.deletions;
    }
  }
  return [...byPath.values()];
}

async function fetchWorkingTreeDiff(git: SimpleGit, revisions: string[]) {
  const [nameStatus, numStat] = await Promise.all([
    git.raw([
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      "--diff-filter=AMDRU",
      ...revisions,
      "--"
    ]),
    git.raw([
      "diff",
      "--numstat",
      "-z",
      "--find-renames",
      "--diff-filter=AMDRU",
      ...revisions,
      "--"
    ])
  ]);
  const fileChanges = parseWorkingTreeNameStatus(nameStatus);
  applyWorkingTreeNumStat(numStat, fileChanges);
  return coalesceWorkingTreeChanges(fileChanges);
}

function addUntrackedFiles(fileChanges: GitCommitDetails["fileChanges"], stdout: string) {
  const trackedPaths = new Set(fileChanges.map((file) => file.newFilePath));
  for (const path of stdout.split("\0")) {
    const filePath = toPath(path);
    if (filePath === "" || trackedPaths.has(filePath)) {
      continue;
    }
    fileChanges.push({
      oldFilePath: filePath,
      newFilePath: filePath,
      type: "A",
      // Added/deleted counts are hidden for added files. Non-null values keep
      // text files clickable so their empty-to-working-tree diff can open.
      additions: 0,
      deletions: 0
    });
  }
}

function sortFileChanges(fileChanges: GitCommitDetails["fileChanges"]) {
  fileChanges.sort((a, b) => a.newFilePath.localeCompare(b.newFilePath));
}

async function fetchWorkingTreeDetails(git: SimpleGit): Promise<GitCommitDetails> {
  const [head, fileChanges, stagedFileChanges, unstagedFileChanges, untracked] = await Promise.all([
    git.raw(["rev-parse", "HEAD"]),
    fetchWorkingTreeDiff(git, ["HEAD"]),
    fetchWorkingTreeDiff(git, ["--cached", "HEAD"]),
    fetchWorkingTreeDiff(git, []),
    git.raw(["ls-files", "--others", "--exclude-standard", "-z"])
  ]);

  addUntrackedFiles(fileChanges, untracked);
  addUntrackedFiles(unstagedFileChanges, untracked);
  sortFileChanges(fileChanges);
  sortFileChanges(stagedFileChanges);
  sortFileChanges(unstagedFileChanges);
  return {
    hash: "*",
    parents: [head.trim()],
    author: "",
    email: "",
    date: Math.round(Date.now() / 1000),
    committer: "",
    body: "",
    fileChanges,
    stagedFileChanges,
    unstagedFileChanges
  };
}

export async function commitDetails(
  git: SimpleGit,
  input: CommitDetailsInput
): Promise<QueryResult<"commitDetails">> {
  try {
    if (input.commitHash === "*") {
      return { commitDetails: await fetchWorkingTreeDetails(git) };
    }

    const [details, nameStatusLines, numStatLines] = await Promise.all([
      fetchCommitInfo(git, input.commitHash, input.dateType),
      fetchNameStatus(git, input.commitHash),
      fetchNumStat(git, input.commitHash)
    ]);

    const fileLookup: { [file: string]: number } = {};
    for (let i = 1; i < nameStatusLines.length - 1; i++) {
      const line = nameStatusLines[i].split("\t");
      if (line.length < 2) {
        break;
      }
      const oldFilePath = toPath(line[1]);
      const newFilePath = toPath(line[line.length - 1]);
      fileLookup[newFilePath] = details.fileChanges.length;
      details.fileChanges.push({
        oldFilePath,
        newFilePath,
        type: line[0][0] as GitFileChangeType,
        additions: null,
        deletions: null
      });
    }

    for (let i = 1; i < numStatLines.length - 1; i++) {
      const line = numStatLines[i].split("\t");
      if (line.length !== 3) {
        break;
      }
      const fileName = line[2].replace(/(.*){.* => (.*)}/, "$1$2").replace(/.* => (.*)/, "$1");
      if (typeof fileLookup[fileName] === "number") {
        details.fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
        details.fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
      }
    }

    return { commitDetails: details };
  } catch {
    return { commitDetails: null };
  }
}
