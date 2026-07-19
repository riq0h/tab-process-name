#!/usr/bin/env node
// Tab Process Name: label each tab "<number> <foreground process>",
// mirroring tmux's automatic-rename. Runs as a herdr plugin event hook / action.
//
// TypeScript executed directly via Node's type stripping (Node 22.18+),
// so this source file is also the artifact — no build step.
//
// A tab's process name comes from its focused pane (or first pane)'s
// foreground process, via `pane process-info` (`foreground_processes[0].name`).
//
// Manual renames are respected: a tab is only relabeled when its label is
// still the herdr default (a bare number) or a label this plugin set earlier
// (tracked in HERDR_PLUGIN_STATE_DIR/labels.json). Set `overwrite_manual`
// to true in HERDR_PLUGIN_CONFIG_DIR/config.json to relabel every tab.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface WorkspaceInfo {
  workspace_id: string;
}

interface TabInfo {
  tab_id: string;
  label: string;
  number: number;
}

interface PaneInfo {
  pane_id: string;
  tab_id: string;
  focused: boolean;
}

interface ProcessInfoProcess {
  name: string;
}

interface ProcessInfo {
  foreground_processes: ProcessInfoProcess[];
}

interface Config {
  overwriteManual: boolean;
  maxLength: number;
}

// Labels this plugin set earlier, keyed by tab id.
type OwnedLabels = Record<string, string>;

const HERDR = process.env.HERDR_BIN_PATH || "herdr";
const DEFAULT_LABEL = /^[0-9]+$/;

function call<T>(args: string[]): T {
  const res = spawnSync(HERDR, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    const detail = (res.stderr || res.stdout || "").trim();
    throw new Error(`herdr ${args.join(" ")} exited ${res.status}: ${detail}`);
  }
  const parsed: unknown = JSON.parse(res.stdout);
  const envelope = parsed as { result?: T };
  return envelope && typeof envelope === "object" && "result" in envelope
    ? (envelope.result as T)
    : (parsed as T);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function loadConfig(): Config {
  const dir = process.env.HERDR_PLUGIN_CONFIG_DIR;
  const config = dir
    ? readJson<Record<string, unknown>>(path.join(dir, "config.json"), {})
    : {};
  return {
    overwriteManual: config.overwrite_manual === true,
    maxLength: Number.isInteger(config.max_length)
      ? (config.max_length as number)
      : 0,
  };
}

function paneForTab(tabId: string, panes: PaneInfo[]): PaneInfo | null {
  const tabPanes = panes.filter((pane) => pane.tab_id === tabId);
  if (tabPanes.length === 0) {
    return null;
  }
  return tabPanes.find((p) => p.focused) ?? tabPanes[0];
}

function processNameForPane(paneId: string): string | null {
  try {
    const info = call<{ process_info: ProcessInfo }>([
      "pane",
      "process-info",
      "--pane",
      paneId,
    ]).process_info;
    return info.foreground_processes[0]?.name ?? null;
  } catch {
    return null;
  }
}

function truncate(label: string, maxLength: number): string {
  if (maxLength > 0 && label.length > maxLength) {
    return `${label.slice(0, maxLength - 1)}…`;
  }
  return label;
}

function main(): void {
  const config = loadConfig();
  const stateDir = process.env.HERDR_PLUGIN_STATE_DIR;
  const stateFile = stateDir ? path.join(stateDir, "labels.json") : null;
  // A tab whose current label differs from this record was renamed by the
  // user and is skipped.
  const ownedLabels: OwnedLabels = stateFile
    ? readJson<OwnedLabels>(stateFile, {})
    : {};
  const nextOwnedLabels: OwnedLabels = {};

  const workspaces =
    call<{ workspaces?: WorkspaceInfo[] }>(["workspace", "list"]).workspaces ??
    [];
  for (const workspace of workspaces) {
    const wsArgs = ["--workspace", workspace.workspace_id];
    const tabs =
      call<{ tabs?: TabInfo[] }>(["tab", "list", ...wsArgs]).tabs ?? [];
    const panes =
      call<{ panes?: PaneInfo[] }>(["pane", "list", ...wsArgs]).panes ?? [];

    for (const tab of tabs) {
      const owned =
        DEFAULT_LABEL.test(tab.label) || ownedLabels[tab.tab_id] === tab.label;
      if (!owned && !config.overwriteManual) {
        continue;
      }
      const pane = paneForTab(tab.tab_id, panes);
      const processName = pane ? processNameForPane(pane.pane_id) : null;
      if (!processName) {
        // Keep ownership so the tab is picked up again once resolvable.
        if (ownedLabels[tab.tab_id] === tab.label) {
          nextOwnedLabels[tab.tab_id] = tab.label;
        }
        continue;
      }
      const label = truncate(`${tab.number} ${processName}`, config.maxLength);
      if (label !== tab.label) {
        call(["tab", "rename", tab.tab_id, label]);
      }
      nextOwnedLabels[tab.tab_id] = label;
    }
  }

  if (stateFile) {
    writeJsonAtomic(stateFile, nextOwnedLabels);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`tab-process-name: ${message}`);
  process.exit(1);
}
