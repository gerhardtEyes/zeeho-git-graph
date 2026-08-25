<div align="center">
  <img src="./resources/icon.png" height="128" alt="Zeeho Git Graph icon" />
  <h1>Zeeho Git Graph for Visual Studio Code</h1>
  <p>An independent MIT-licensed Git history, commit details, and inline blame extension.</p>
</div>

[![License](https://img.shields.io/github/license/gerhardtEyes/zeeho-git-graph)](LICENSE)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/Tamzeeho.zeeho-git-graph?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=Tamzeeho.zeeho-git-graph)

<p align="center">
  <img src="./resources/demo.gif" width="100%" alt="Zeeho Git Graph side-bar workflow: compact graph, commit details, changed files, diffs, and selected-line blame" />
</p>

## Why this fork

The upstream graph is excellent for exploring repository history, but its editor-tab layout competes
with the code you are actively reading. Moving that same table into a narrow side bar without
redesigning it would only trade one problem for clipped columns, horizontal scrolling, and crowded
details.

Zeeho Git Graph has a different product goal: **keep the code as the primary surface while Git
history remains visible beside it**. It also connects historical commits to the work in progress, so
you can move from a commit, to its changed files, to a diff, or from selected source lines to their
last author without leaving the current coding context.

## What changed

| Original limitation                    | Zeeho Git Graph change                                                                                      | Result                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| The graph occupies an editor tab       | Replaced the `WebviewPanel` flow with a `WebviewViewProvider` registered in the Activity Bar                | Code and repository history stay visible at the same time                   |
| A side bar has very little width       | Rebuilt the graph and details as a compact vertical layout with responsive 720, 520, and 420 px breakpoints | Commits, refs, and changed files remain usable in narrow views              |
| Changed files are hard to scan         | Added neutral paths, status-coloured file names, C# badges, independent scrolling, and direct diff opening  | Added, modified, deleted, and renamed files are immediately distinguishable |
| Full-file blame creates visual noise   | Shows author and date only for selected lines, including multi-line and multi-cursor selections             | Blame appears on demand without covering the editor                         |
| Working-tree changes feel disconnected | Added an expandable uncommitted-changes row, direct file diffs, and an optional automatic dirty-file diff   | Commit history and current work form one continuous workflow                |
| A derivative needs a clear identity    | Renamed the extension and namespace, added independent release metadata, and preserved upstream MIT notices | The fork can be maintained and released independently and transparently     |

## Project origin

Zeeho Git Graph is an independent derivative of
[`asispts/neo-git-graph`](https://github.com/asispts/neo-git-graph), distributed under the MIT
License. That project derives from the last MIT-licensed commit,
[`4af8583`](https://github.com/mhutchie/vscode-git-graph/commit/4af8583a42082b2c230d2c0187d4eaff4b69c665),
of [`mhutchie/vscode-git-graph`](https://github.com/mhutchie/vscode-git-graph).

The original copyright notices and MIT permission notice are preserved in [LICENSE](LICENSE).
Zeeho Git Graph is not affiliated with or endorsed by either upstream project.

## Features

- **Activity Bar view:** Keep the graph in the VS Code side bar instead of an editor tab.
- **Compact commit graph:** Responsive layout designed for narrow side bars.
- **Commit details pane:** Select a commit to inspect its metadata and changed files below the graph.
- **Changed-file presentation:** Status colours, full paths, C# badges, and direct diff opening.
- **Selected-line blame:** Show the last author and date only for selected lines, including multiple cursors.
- **Uncommitted changes:** Select the working-tree node to inspect changed files and open HEAD-to-working-tree diffs.
- **Optional dirty-file diff:** Automatically open a HEAD-to-working-tree comparison for changed files.
- **Branch, tag, and commit actions:** Common Git operations are available from the graph.
- **Multi-repository support:** Discover and switch between repositories in one workspace.
- **Localization:** English, Simplified Chinese, and Traditional Chinese.

## Installation

Install [Zeeho Git Graph from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Tamzeeho.zeeho-git-graph),
or build and install a VSIX locally:

```sh
pnpm install --frozen-lockfile
pnpm run package
pnpm dlx @vscode/vsce package --no-dependencies --out zeeho-git-graph-dev.vsix
code --install-extension zeeho-git-graph-dev.vsix --force
```

## Configuration

All settings use the `zeeho-git-graph` prefix.

| Setting                                      | Default         | Description                                    |
| -------------------------------------------- | --------------- | ---------------------------------------------- |
| `zeeho-git-graph.dateFormat`                 | `"Date & Time"` | Date format used by the graph and inline blame |
| `zeeho-git-graph.dateType`                   | `"Author Date"` | Author or commit date                          |
| `zeeho-git-graph.fetchAvatars`               | `false`         | Fetch commit avatars from external services    |
| `zeeho-git-graph.graphColours`               | 12 colours      | Colours used by graph lanes                    |
| `zeeho-git-graph.graphStyle`                 | `"rounded"`     | Rounded or angular graph lines                 |
| `zeeho-git-graph.initialLoadCommits`         | `300`           | Initial commit count                           |
| `zeeho-git-graph.inlineBlame.enabled`        | `true`          | Show blame for selected editor lines           |
| `zeeho-git-graph.inlineBlame.maxLines`       | `3000`          | Maximum file size for inline blame             |
| `zeeho-git-graph.autoOpenDirtyFileDiff`      | `false`         | Open a diff when a changed file becomes active |
| `zeeho-git-graph.maxDepthOfRepoSearch`       | `0`             | Repository discovery depth                     |
| `zeeho-git-graph.showCurrentBranchByDefault` | `false`         | Show only the current branch by default        |
| `zeeho-git-graph.showStatusBarItem`          | `true`          | Show the status bar entry                      |
| `zeeho-git-graph.showUncommittedChanges`     | `true`          | Include working-tree changes                   |

## Development

```sh
pnpm run format
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:ext
```

See [RELEASING.md](RELEASING.md) for the repository and release checklist.

## Contributing and support

Use [`gerhardtEyes/zeeho-git-graph`](https://github.com/gerhardtEyes/zeeho-git-graph) for issues and
pull requests.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
