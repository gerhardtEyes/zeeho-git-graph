export const EXTENSION_NAME = "Zeeho Git Graph";
export const EXTENSION_NAMESPACE = "zeeho-git-graph";
export const GIT_GRAPH_VIEW_ID = `${EXTENSION_NAMESPACE}.view`;

export const COMMANDS = {
  view: `${EXTENSION_NAMESPACE}.view`,
  clearAvatarCache: `${EXTENSION_NAMESPACE}.clearAvatarCache`,
  toggleInlineBlame: `${EXTENSION_NAMESPACE}.toggleInlineBlame`,
  toggleAutoOpenDirtyFileDiff: `${EXTENSION_NAMESPACE}.toggleAutoOpenDirtyFileDiff`
} as const;
