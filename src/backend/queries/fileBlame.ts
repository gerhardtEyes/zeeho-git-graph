import { spawn } from "node:child_process";

const zeroCommit = "0000000000000000000000000000000000000000";
const defaultMaxOutputBytes = 1024 * 1024 * 6;

export type FileBlameInput = {
  repo: string;
  relativePath: string;
  contents: string;
  gitPath: string;
  signal?: AbortSignal;
  maxOutputBytes?: number;
};

export type FileBlameLine = {
  line: number;
  commit: string;
  author: string;
  authorTime: number;
  committerTime: number;
  summary: string;
  uncommitted: boolean;
  isUncommitted: boolean;
};

function stripTrailingCarriageReturn(value: string): string {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

function getLineCount(contents: string): number {
  if (contents.length === 0) {
    return 0;
  }
  const lines = contents.split(/\r\n|\r|\n/g);
  if (contents.endsWith("\n") || contents.endsWith("\r")) {
    return lines.length - 1;
  }
  return lines.length;
}

function getAbortedError() {
  return new DOMException("Operation was aborted", "AbortError");
}

function isPathMissingInHead(stderr: string): boolean {
  return /fatal: no such path .* in HEAD/.test(stderr);
}

function makeUncommittedLine(line: number, relativePath: string): FileBlameLine {
  const isUncommitted = true;
  return {
    line,
    commit: zeroCommit,
    author: "External file (--contents)",
    authorTime: 0,
    committerTime: 0,
    summary: `Version of ${relativePath} from standard input`,
    uncommitted: isUncommitted,
    isUncommitted
  };
}

function makeUncommittedLines(lineCount: number, relativePath: string): FileBlameLine[] {
  const lines: FileBlameLine[] = [];
  for (let i = 1; i <= lineCount; i++) {
    lines.push(makeUncommittedLine(i, relativePath));
  }
  return lines;
}

function parseLinePorcelain(output: string): FileBlameLine[] {
  const lines = output.split(/\r\n|\r|\n/g);
  const result: FileBlameLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = stripTrailingCarriageReturn(lines[i]);
    i++;
    if (header === "") {
      continue;
    }

    const headerParts = header.split(" ");
    const commit = headerParts[0];
    const resultLineText = headerParts[2];
    if (!commit || commit.length !== 40 || !/^[0-9a-f]{40}$/i.test(commit)) {
      continue;
    }
    const line = resultLineText ? parseInt(resultLineText, 10) : NaN;
    let author = "";
    let summary = "";
    let authorTime = 0;
    let committerTime = 0;

    while (i < lines.length) {
      const lineText = stripTrailingCarriageReturn(lines[i]);
      if (lineText.startsWith("\t")) {
        i++;
        break;
      }
      const spaceIndex = lineText.indexOf(" ");
      if (spaceIndex > -1) {
        const key = lineText.substring(0, spaceIndex);
        const value = stripTrailingCarriageReturn(lineText.substring(spaceIndex + 1));
        if (key === "author") {
          author = value;
        } else if (key === "summary") {
          summary = value;
        } else if (key === "author-time") {
          const parsed = parseInt(value, 10);
          if (Number.isFinite(parsed)) {
            authorTime = parsed;
          }
        } else if (key === "committer-time") {
          const parsed = parseInt(value, 10);
          if (Number.isFinite(parsed)) {
            committerTime = parsed;
          }
        }
      }
      i++;
    }

    const lineNumber = Number.isFinite(line) ? line : result.length + 1;
    result.push({
      line: lineNumber,
      commit,
      author,
      authorTime,
      committerTime,
      summary,
      uncommitted: commit === zeroCommit,
      isUncommitted: commit === zeroCommit
    });
  }
  return result;
}

export async function blameFile(input: FileBlameInput): Promise<FileBlameLine[]> {
  const {
    repo,
    relativePath,
    contents,
    gitPath,
    signal,
    maxOutputBytes = defaultMaxOutputBytes
  } = input;
  if (signal?.aborted) {
    throw getAbortedError();
  }

  const lineCount = getLineCount(contents);
  if (lineCount === 0) {
    return [];
  }

  return await new Promise<FileBlameLine[]>((resolve, reject) => {
    const args = ["blame", "--line-porcelain", "--contents", "-", "--", relativePath];
    const child = spawn(gitPath, args, {
      cwd: repo,
      stdio: ["pipe", "pipe", "pipe"],
      signal
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    const cleanup = () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      child.removeAllListeners();
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
      child.stdin?.removeAllListeners();
    };
    const resolveOnce = (value: FileBlameLine[]) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };
    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onError = (error: Error) => {
      rejectOnce(error);
    };

    const onAbort = () => {
      child.kill();
      rejectOnce(getAbortedError());
    };

    child.on("error", onError);
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdin.on("error", (error) => {
      rejectOnce(error as Error);
    });
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        rejectOnce(new Error("Git output exceeded maximum bytes"));
        return;
      }
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        child.kill();
        rejectOnce(new Error("Git output exceeded maximum bytes"));
        return;
      }
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }
      if (signal?.aborted) {
        rejectOnce(getAbortedError());
        return;
      }
      if (code !== 0) {
        if (isPathMissingInHead(stderr)) {
          resolveOnce(makeUncommittedLines(lineCount, relativePath));
          return;
        }
        const err = new Error(stderr || `git blame failed with code ${code}`);
        rejectOnce(err);
        return;
      }

      resolveOnce(parseLinePorcelain(stdout));
    });

    child.stdin.write(contents, (error) => {
      if (error) {
        child.kill();
        rejectOnce(error);
      } else {
        child.stdin.end();
      }
    });
  });
}
