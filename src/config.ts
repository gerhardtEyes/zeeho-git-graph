import * as vscode from "vscode";

import { DateType } from "./backend/types";
import { EXTENSION_NAMESPACE } from "./extension/constant/const";
import { DateFormat, GraphStyle } from "./types";

type TabIconColourTheme = "colour" | "grey";

function getConfig<T>(key: string, defaultValue: T): T {
  return vscode.workspace.getConfiguration(EXTENSION_NAMESPACE).get(key, defaultValue);
}

export const config = {
  autoCenterCommitDetailsView: (): boolean => getConfig("autoCenterCommitDetailsView", true),
  dateFormat: (): DateFormat => getConfig("dateFormat", "Date & Time"),
  dateType: (): DateType => getConfig("dateType", "Author Date"),
  fetchAvatars: (): boolean => getConfig("fetchAvatars", false),
  graphColours: (): string[] =>
    getConfig("graphColours", [
      "#0085d9",
      "#d9008f",
      "#00d90a",
      "#d98500",
      "#a300d9",
      "#ff0000"
    ]).filter(
      (v: string) =>
        v.match(
          /^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/
        ) !== null
    ),
  graphStyle: (): GraphStyle => getConfig("graphStyle", "rounded"),
  initialLoadCommits: (): number => getConfig("initialLoadCommits", 300),
  inlineBlameEnabled: (): boolean => getConfig("inlineBlame.enabled", true),
  inlineBlameMaxLines: (): number => Math.max(1, getConfig("inlineBlame.maxLines", 3000)),
  loadMoreCommits: (): number => getConfig("loadMoreCommits", 75),
  maxDepthOfRepoSearch: (): number => getConfig("maxDepthOfRepoSearch", 0),
  showCurrentBranchByDefault: (): boolean => getConfig("showCurrentBranchByDefault", false),
  autoOpenDirtyFileDiff: (): boolean => getConfig("autoOpenDirtyFileDiff", false),
  showStatusBarItem: (): boolean => getConfig("showStatusBarItem", true),
  showUncommittedChanges: (): boolean => getConfig("showUncommittedChanges", true),
  tabIconColourTheme: (): TabIconColourTheme => getConfig("tabIconColourTheme", "colour"),
  gitPath: (): string => vscode.workspace.getConfiguration("git").get("path", null) ?? "git"
};

export type Config = typeof config;
