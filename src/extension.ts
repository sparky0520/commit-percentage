/*
 * Commit Percentage - VS Code Extension
 * Copyright (C) 2025 Darsh Jain
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as vscode from "vscode";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log("Commit Percentage extension activated!");

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  console.log("Status bar item created");
  statusBarItem.command = "commitPercentage.refresh";
  context.subscriptions.push(statusBarItem);

  // Update on git repository state changes
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  if (gitExtension) {
    const api = gitExtension.getAPI(1);
    api.repositories.forEach((repo: any) => {
      repo.state.onDidChange(() => updatePercentage(repo));
    });
  }

  // Manual refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand("commitPercentage.refresh", () => {
      if (gitExtension) {
        const api = gitExtension.getAPI(1);
        if (api.repositories.length > 0) {
          updatePercentage(api.repositories[0]);
        }
      }
    })
  );
}

function updatePercentage(repo: any) {
  console.log("updatePercentage called");
  try {
    const repoPath = repo.rootUri.fsPath;

    // Get total lines in repository
    const totalLines = getTotalLines(repoPath);

    // Get staged lines count
    const stagedLines = getStagedLines(repoPath);

    console.log(`Total: ${totalLines}, Staged: ${stagedLines}`);

    if (totalLines > 0 && stagedLines > 0) {
      const percentage = ((stagedLines / totalLines) * 100).toFixed(2);
      statusBarItem.text = `$(git-commit) ${percentage}% of codebase`;
      statusBarItem.tooltip = `${stagedLines} lines staged out of ${totalLines} total lines`;
      statusBarItem.show();
      console.log(`Status bar shown: ${percentage}%`);
    } else {
      statusBarItem.hide();
      console.log("Status bar hidden (no staged changes or total lines is 0)");
    }
  } catch (error) {
    console.error("Error calculating percentage:", error);
    statusBarItem.hide();
  }
}

function getTotalLines(repoPath: string): number {
  try {
    // Cross-platform approach
    const files = execSync("git ls-files", { cwd: repoPath, encoding: "utf-8" })
      .trim()
      .split("\n");

    let totalLines = 0;

    for (const file of files) {
      if (!file) continue; // Skip empty lines
      try {
        const filePath = path.join(repoPath, file);
        const content = fs.readFileSync(filePath, "utf-8");
        totalLines += content.split("\n").length;
      } catch (err) {
        // Skip files that can't be read (binary, deleted, etc.)
        console.log(`Skipping file: ${file}`);
      }
    }

    console.log(`Total lines: ${totalLines}`);
    return totalLines;
  } catch (error) {
    console.error("Error getting total lines:", error);
    return 0;
  }
}

function getStagedLines(repoPath: string): number {
  try {
    const output = execSync("git diff --cached --numstat", {
      cwd: repoPath,
      encoding: "utf-8",
    });

    let addedLines = 0;
    let deletedLines = 0;

    output.split("\n").forEach((line) => {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const added = parseInt(parts[0]);
        const deleted = parseInt(parts[1]);

        if (!isNaN(added)) addedLines += added;
        if (!isNaN(deleted)) deletedLines += deleted;
      }
    });

    // Total lines changed (additions + deletions)
    const totalChanged = addedLines + deletedLines;

    console.log(
      `Staged - Added: ${addedLines}, Deleted: ${deletedLines}, Total: ${totalChanged}`
    );
    return totalChanged;
  } catch (error) {
    console.error("Error getting staged lines:", error);
    return 0;
  }
}

export function deactivate() {}
