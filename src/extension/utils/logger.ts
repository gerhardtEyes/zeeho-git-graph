import * as vscode from "vscode";

import { EXTENSION_NAME } from "@/extension/constant/const";

let _channel: vscode.OutputChannel | undefined;

export const logger = {
  init: (ctx: vscode.ExtensionContext) => {
    _channel = vscode.window.createOutputChannel(EXTENSION_NAME);
    ctx.subscriptions.push(_channel);
  },

  log: (msg: string) => {
    if (!_channel) {
      // eslint-disable-next-line no-console
      console.warn(`[${EXTENSION_NAME}] log() called before initLogger()`);
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString().replace("T", " ").replace("Z", "");
    _channel.appendLine(`[${timestamp}] ${msg}`);
  }
};
