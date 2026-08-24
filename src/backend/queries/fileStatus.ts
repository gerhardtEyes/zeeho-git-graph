import { spawn } from "node:child_process";

type FileStatusInput = {
  gitPath: string;
  relativePath: string;
  repo: string;
  signal?: AbortSignal;
};

const MAX_OUTPUT_BYTES = 1024 * 1024;

function abortError() {
  const error = new Error("The Git status request was cancelled.");
  error.name = "AbortError";
  return error;
}

export function fileHasChanges(input: FileStatusInput): Promise<boolean> {
  const { gitPath, relativePath, repo, signal } = input;
  if (signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise<boolean>((resolve, reject) => {
    const child = spawn(
      gitPath,
      ["-C", repo, "status", "--porcelain=v1", "--untracked-files=all", "--", relativePath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = () => {
      child.kill();
      finish(() => reject(abortError()));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const collect = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(() => reject(new Error("Git status output exceeded the safety limit.")));
        return;
      }
      target.push(chunk);
    };

    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || "Git status failed."));
          return;
        }
        resolve(Buffer.concat(stdout).length > 0);
      });
    });
  });
}
