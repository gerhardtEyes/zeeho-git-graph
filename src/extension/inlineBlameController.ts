import * as vscode from "vscode";

import { blameFile, FileBlameLine } from "@/backend/queries/fileBlame";
import { Config } from "@/config";
import { EXTENSION_NAMESPACE } from "@/extension/constant/const";
import { DateFormat } from "@/types";

import { findEditorGitContext } from "./editorGitContext";
import { getSelectedLineNumbers } from "./selectedLines";
import { logger } from "./utils/logger";

type InlineBlameControllerOptions = {
  config: Config;
  getRepoPaths: () => string[];
};

type BlameSnapshot = {
  documentVersion: number;
  lines: FileBlameLine[];
  uri: string;
};

const UPDATE_DELAY_MS = 500;

const dateFormatter = new Intl.DateTimeFormat(vscode.env.language, {
  year: "numeric",
  month: "short",
  day: "numeric"
});
const fullDateFormatter = new Intl.DateTimeFormat(vscode.env.language, {
  dateStyle: "medium",
  timeStyle: "short"
});
const relativeFormatter = new Intl.RelativeTimeFormat(vscode.env.language, { numeric: "auto" });

const RELATIVE_UNITS: Array<
  [threshold: number, unit: Intl.RelativeTimeFormatUnit, seconds: number]
> = [
  [60, "second", 1],
  [3600, "minute", 60],
  [86400, "hour", 3600],
  [604800, "day", 86400],
  [2629800, "week", 604800],
  [31557600, "month", 2629800],
  [Infinity, "year", 31557600]
];

export function formatBlameDate(seconds: number, format: DateFormat, now = Date.now()): string {
  const date = new Date(seconds * 1000);
  if (format === "Date Only") {
    return dateFormatter.format(date);
  }
  if (format === "Date & Time") {
    return fullDateFormatter.format(date);
  }

  const difference = Math.round((now - date.getTime()) / 1000);
  const absolute = Math.abs(difference);
  const [, unit, unitSeconds] = RELATIVE_UNITS.find(([threshold]) => absolute < threshold)!;
  return relativeFormatter.format(-Math.round(difference / unitSeconds), unit);
}

function hoverForLine(line: FileBlameLine, timestamp: number): vscode.MarkdownString {
  const hover = new vscode.MarkdownString();
  if (line.uncommitted) {
    hover.appendText(vscode.l10n.t("Uncommitted change"));
    return hover;
  }

  hover.appendText(line.author);
  hover.appendMarkdown("  \n");
  hover.appendText(fullDateFormatter.format(new Date(timestamp * 1000)));
  hover.appendMarkdown("  \n");
  hover.appendText(line.commit.slice(0, 12));
  if (line.summary !== "") {
    hover.appendMarkdown("  \n");
    hover.appendText(line.summary);
  }
  return hover;
}

export function registerInlineBlameController(
  options: InlineBlameControllerOptions
): vscode.Disposable {
  const { config, getRepoPaths } = options;
  const committedDecoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      fontStyle: "italic",
      margin: "0 0 0 3em"
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });
  const uncommittedDecoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"),
      fontStyle: "italic",
      margin: "0 0 0 3em"
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
  });

  const subscriptions: vscode.Disposable[] = [committedDecoration, uncommittedDecoration];
  let decoratedEditor: vscode.TextEditor | undefined;
  let updateTimer: NodeJS.Timeout | undefined;
  let request: AbortController | undefined;
  let snapshot: BlameSnapshot | undefined;
  let generation = 0;

  function clear(editor = decoratedEditor) {
    if (editor !== undefined) {
      editor.setDecorations(committedDecoration, []);
      editor.setDecorations(uncommittedDecoration, []);
    }
    if (editor === decoratedEditor) {
      decoratedEditor = undefined;
    }
  }

  function isSnapshotValid(editor: vscode.TextEditor): boolean {
    return (
      snapshot !== undefined &&
      snapshot.uri === editor.document.uri.toString() &&
      snapshot.documentVersion === editor.document.version
    );
  }

  function render(editor: vscode.TextEditor, lines: FileBlameLine[]) {
    const document = editor.document;
    const committed: vscode.DecorationOptions[] = [];
    const uncommitted: vscode.DecorationOptions[] = [];
    const selectedLines = getSelectedLineNumbers(editor.selections, document.lineCount);

    for (const index of selectedLines) {
      const line = lines[index];
      if (line === undefined) {
        continue;
      }

      const timestamp = config.dateType() === "Author Date" ? line.authorTime : line.committerTime;
      const label = line.uncommitted
        ? vscode.l10n.t("Uncommitted")
        : `${line.author} • ${formatBlameDate(timestamp, config.dateFormat())}`;
      const decoration: vscode.DecorationOptions = {
        range: document.lineAt(index).range,
        hoverMessage: hoverForLine(line, timestamp),
        renderOptions: { after: { contentText: `  ${label}` } }
      };
      (line.uncommitted ? uncommitted : committed).push(decoration);
    }

    editor.setDecorations(committedDecoration, committed);
    editor.setDecorations(uncommittedDecoration, uncommitted);
    decoratedEditor = editor;
  }

  async function update() {
    const editor = vscode.window.activeTextEditor;
    const currentGeneration = ++generation;
    request?.abort();
    request = undefined;

    if (decoratedEditor !== undefined && decoratedEditor !== editor) {
      clear(decoratedEditor);
    }
    if (!config.inlineBlameEnabled() || editor?.document.uri.scheme !== "file") {
      snapshot = undefined;
      clear(editor);
      return;
    }

    const document = editor.document;
    const documentVersion = document.version;
    if (document.lineCount > config.inlineBlameMaxLines()) {
      snapshot = undefined;
      clear(editor);
      return;
    }

    const context = findEditorGitContext(document.uri.fsPath, getRepoPaths());
    if (context === null) {
      snapshot = undefined;
      clear(editor);
      return;
    }

    const controller = new AbortController();
    request = controller;
    try {
      const lines = await blameFile({
        contents: document.getText(),
        gitPath: config.gitPath(),
        relativePath: context.relativePath,
        repo: context.repo,
        signal: controller.signal
      });
      if (
        controller.signal.aborted ||
        currentGeneration !== generation ||
        vscode.window.activeTextEditor !== editor ||
        editor.document.version !== documentVersion
      ) {
        return;
      }

      snapshot = {
        documentVersion,
        lines,
        uri: document.uri.toString()
      };
      render(editor, lines);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        logger.log(`Unable to load inline blame: ${error.message}`);
      }
      if (currentGeneration === generation) {
        clear(editor);
      }
    } finally {
      if (request === controller) {
        request = undefined;
      }
    }
  }

  function schedule(delay = UPDATE_DELAY_MS) {
    if (updateTimer !== undefined) {
      clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
      updateTimer = undefined;
      void update();
    }, delay);
  }

  subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      snapshot = undefined;
      schedule(0);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor !== vscode.window.activeTextEditor) {
        return;
      }
      if (isSnapshotValid(event.textEditor)) {
        render(event.textEditor, snapshot!.lines);
      } else if (request === undefined && updateTimer === undefined) {
        schedule(0);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        snapshot = undefined;
        clear(vscode.window.activeTextEditor);
        schedule();
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document === vscode.window.activeTextEditor?.document) {
        snapshot = undefined;
        schedule(0);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${EXTENSION_NAMESPACE}.dateFormat`) ||
        event.affectsConfiguration(`${EXTENSION_NAMESPACE}.dateType`)
      ) {
        const editor = vscode.window.activeTextEditor;
        if (editor !== undefined && isSnapshotValid(editor)) {
          render(editor, snapshot!.lines);
        } else {
          schedule(0);
        }
      } else if (
        event.affectsConfiguration(`${EXTENSION_NAMESPACE}.inlineBlame`) ||
        event.affectsConfiguration("git.path")
      ) {
        snapshot = undefined;
        schedule(0);
      }
    })
  );

  schedule(0);
  return {
    dispose() {
      generation++;
      request?.abort();
      snapshot = undefined;
      if (updateTimer !== undefined) {
        clearTimeout(updateTimer);
      }
      clear();
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  };
}
