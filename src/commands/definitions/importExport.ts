import { exportBackupWithToast, importBackupWithToast } from "../../importExport/operations";
import type { Command } from "../types";

const exportBackupCommand: Command = {
  id: "notes-export-backup",
  label: "Notes: Export Backup",
  description: "Export notes and attachments as a versioned ZIP backup",
  category: "notes",
  execute: exportBackupWithToast,
};

const importBackupCommand: Command = {
  id: "notes-import-backup",
  label: "Notes: Import Backup",
  description: "Import an eyemono.md ZIP backup into local OPFS storage",
  category: "notes",
  execute: importBackupWithToast,
};

export const importExportCommands: Command[] = [exportBackupCommand, importBackupCommand];
