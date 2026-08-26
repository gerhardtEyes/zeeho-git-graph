import type { ResponseOpenFile } from "@/types";
import { openErrorDialog } from "@/webview/lib/actions";

export function handleOpenFile(msg: ResponseOpenFile) {
  if (msg.success) {
    return;
  }

  openErrorDialog(window.l10n.unableToOpenFile);
}
