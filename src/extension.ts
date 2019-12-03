import * as vscode from "vscode";
import * as util from "util";
import * as cp from "child_process";
import * as diff from "diff";
import {c} from "compress-tag";
import * as path from "path";

export const registrations: vscode.Disposable[] = [];

/**
 * Replaces the standard VSCode variables `${workspaceFolder}` and
 * `${workspaceFolderBasename}` with their correct values. Supports the
 * `${workspaceFolder:folderName}` as defined in the spec for multi-root
 * workspaces.
 * @param text The text to replace values in.
 * @returns The input string with the variables replaced.
 */
export function replaceWorkspaceVariables(text: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const result = text.replace(
    /\${workspaceFolder(Basename)?:?([^}]*)?}/g,
    (_, baseOnly?: string, dirName?: string): string => {
      const targetFolder = (dirName
        ? workspaceFolders?.find((folder): boolean => folder.name === dirName)
        : workspaceFolders?.[0]
      )?.uri.fsPath;
      return (
        (baseOnly ? path.basename(targetFolder ?? "") : targetFolder) ?? ""
      );
    }
  );
  return result;
}

/**
 * Promisified `exec` function, but with `cwd` bound to a workspace directory.
 * @param command The command to run.
 * @param opts Any other options to pass to `cp.exec`.
 * @param workspaceFolder The name of the workspace folder to bind the `cwd`
 * setting to. If not provided, will use the first folder in the workspace.
 * @returns Promise that resolves with the output of running the command.
 */
export function promiseExec(
  command: string,
  opts?: cp.ExecOptions,
  workspaceFolder?: string
): Promise<{stdout: string; stderr: string}> {
  const folderName = workspaceFolder ? `:${workspaceFolder}` : "";
  const workspaceDirectory = // undefined if replaceWorkspaceVariables yields ""
    replaceWorkspaceVariables(`\${workspaceFolder${folderName}}`) || undefined;
  return util.promisify(cp.exec)(command, {cwd: workspaceDirectory, ...opts});
}

/** Returns the set Python path from settings without replacing variables. */
export function getPythonPathSetting(): string | undefined {
  return vscode.workspace.getConfiguration("python").get<string>("pythonPath");
}

/**
 * Returns `true` if the command points to a valid executable for Python 3.
 * @param command The command to try, ie `python`.
 */
export async function pointsToPython3(command: string): Promise<boolean> {
  try {
    const result = await promiseExec(`${command} --version`);
    return !result.stderr && result.stdout.includes("Python 3");
  } catch {
    return false;
  }
}

/**
 * Get the path to the most locally set Python. If Python cannot be found, this
 * will reject. Otherwise, will resolve with the python command.
 * @param setPath The set Python path. Defaults to user setting. This allows for
 * testing.
 * @returns A command which can be called to invoke Python in the terminal.
 */
export async function getPython(
  setPath: string | undefined = getPythonPathSetting()
): Promise<string> {
  let errorMessage: string;

  if (setPath !== undefined) {
    const cookedPath = `"${replaceWorkspaceVariables(setPath)}"`;
    if (await pointsToPython3(cookedPath)) return cookedPath;
    errorMessage = c`
      The Python path set in the "python.pythonPath" setting is invalid or
      points to Python 2. Check the value or clear the setting to use the
      global Python installation. The extension is not compatible with Python
      2.
    `;
  } else {
    for (const command of ["python", "python3", "py"]) {
      if (await pointsToPython3(command)) return command;
    }
    errorMessage = c`
      Python 3 is either not installed or not properly configured. Check
      that the Python location is set in VSCode or provided in the system
      environment variables.
    `;
  }

  vscode.window.showErrorMessage(errorMessage);
  throw new Error(errorMessage);
}

/**
 * Build a text string that can be run as the Docformatter command with flags.
 *
 * Reads the current settings and implements them or falls back to defaults.
 * @param path Path to the file to be formatted.
 * @param pythonPromise Promise that resolves to the path to call Python with.
 * Allows for unit testing.
 * @returns Runnable terminal command that will format the specified file.
 */
export async function buildFormatCommand(
  path: string,
  pythonPromise: Promise<string> = getPython()
): Promise<string> {
  const python = await pythonPromise;
  const settings = vscode.workspace.getConfiguration("docstringFormatter");
  // Abbreviated to keep template string short
  const wsl = settings.get<number>("wrapSummariesLength") || 79;
  const wdl = settings.get<number>("wrapDescriptionsLength") || 72;
  const psn = settings.get<boolean>("preSummaryNewline") || false;
  const msn = settings.get<boolean>("makeSummaryMultiline") || false;
  const fw = settings.get<boolean>("forceWrap") || false;
  return c`
    ${python} -m
    docformatter "${path}" --wrap-summaries ${wsl} --wrap-descriptions ${wdl}
    ${psn ? "--blank" : ""}
    ${msn ? "--make-summary-multi-line" : ""}
    ${fw ? "--force-wrap" : ""}
  `
    .trim()
    .replace(/\s+/, " "); // Remove extra whitespace (helps with tests)
}

/**
 * Installs Docformatter on the current system, assuming pip is installed.
 * @returns Empty promise that resolves upon succesful installation.
 */
export async function installDocformatter(): Promise<void> {
  const python = await getPython();
  try {
    await promiseExec(`${python} -m pip install --upgrade docformatter`);
  } catch (err) {
    vscode.window.showErrorMessage(c`
      Could not install docformatter automatically. Make sure that pip
      is installed correctly and try manually installing with 'pip
      install --upgrade docformatter. \n\n Full error: ${err}'.
    `);
    throw err;
  }
}

/**
 * Handle an error raised by `promiseExec`, which passes an exception object.
 *
 * If the error signifies that Docformatter is not installed, will attempt
 * to automatically install the tool if the user desires.
 *
 * @param err The error raised by `promiseExec`, which would have been run to
 * execute the format command.
 */
export async function alertFormattingError(
  err: FormatException
): Promise<void> {
  if (err.message.includes("No module named docformatter")) {
    const installButton = "Install Module";
    const response = await vscode.window.showErrorMessage(
      c`The Python module 'docformatter' must be installed to format
          docstrings.`,
      installButton
    );
    if (response === installButton) {
      installDocformatter();
    }
  } else {
    const bugReportButton = "Submit Bug Report";
    const response = await vscode.window.showErrorMessage(
      c`Unknown Error: Could not format docstrings. Full error:\n\n
        ${err.message}`,
      bugReportButton
    );
    if (response === bugReportButton) {
      vscode.commands.executeCommand(
        "vscode.open",
        vscode.Uri.parse(
          "https://github.com/iansan5653/vscode-format-python-docstrings/issues/new"
        )
      );
    }
  }
}

/**
 * Format a file using Docformatter and return the edit hunks without
 * modifying the file.
 * @param path Full path to a file to format. Defaults to the currently open
 * file, if there is one. If not given and no currently open file is present,
 * will raise an error.
 * @returns A promise that resolves to the edit hunks, which can then be
 * converted to edits and applied to the file. If the promise rejects, will
 * automatically show an error message to the user.
 */
export async function formatFile(
  path: string | undefined = vscode.window.activeTextEditor?.document.fileName
): Promise<diff.Hunk[]> {
  if (!path) {
    throw new Error(
      "Could not format docstrings because no file path was given."
    );
  }

  try {
    const command = await buildFormatCommand(path);
    const result = await promiseExec(command);
    const parsed = diff.parsePatch(result.stdout);
    return parsed[0].hunks;
  } catch (err) {
    alertFormattingError(err);
    throw err;
  }
}

/**
 * Convert any number of hunks to a matching array of native VSCode edits.
 * @param hunks Array of hunks to convert to edits.
 * @returns Array of VSCode text edits, which map directly to the input hunks.
 */
export function hunksToEdits(hunks: diff.Hunk[]): vscode.TextEdit[] {
  return hunks.map((hunk) => {
    const startPos = new vscode.Position(hunk.newStart - 1, 0);
    const endPos = new vscode.Position(
      hunk.newStart - 1 + hunk.oldLines - 1,
      hunk.lines[hunk.lines.length - 1].length - 1
    );
    const editRange = new vscode.Range(startPos, endPos);

    const newTextLines = hunk.lines
      .filter(
        (line): boolean => line.charAt(0) === " " || line.charAt(0) === "+"
      )
      .map((line): string => line.substr(1));
    const lineEndChar: string = hunk.linedelimiters[0];
    const newText = newTextLines.join(lineEndChar);

    return new vscode.TextEdit(editRange, newText);
  });
}

/**
 * Apply a set of edits to the active text editor. There should be an active
 * text editor and it should not be readonly.
 * @param edits The edits to apply.
 * @returns Promise resolving to a boolean indicating `true` if the edits
 * applied successfully.
 */
export async function applyEditsToCurrentEditor(
  edits: vscode.TextEdit[]
): Promise<boolean> {
  return (
    vscode.window.activeTextEditor?.edit((editBuilder): void => {
      edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
    }) ?? false
  );
}

/**
 * Activate the extension. Run automatically by VSCode based on
 * the `activationEvents` property in package.json.
 */
export function activate(): void {
  const command = "docstringFormatter.formatDocstrings";

  const selector: vscode.DocumentSelector = {
    scheme: "file",
    language: "python"
  };

  const formatProvider: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits: (document) =>
      formatFile(document.fileName).then(hunksToEdits)
  };

  const actionProvider: vscode.CodeActionProvider = {
    provideCodeActions: (document) => [
      {
        title: "Format Docstrings",
        command,
        tooltip: "Format all docstrings in the current document.",
        arguments: [document.fileName]
      }
    ]
  };

  const actionMetadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.Source]
  };

  registrations.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      selector,
      formatProvider
    ),
    vscode.languages.registerCodeActionsProvider(
      selector,
      actionProvider,
      actionMetadata
    ),
    vscode.commands.registerCommand(command, (filePath?: string) =>
      formatFile(filePath)
        .then(hunksToEdits)
        .then(applyEditsToCurrentEditor)
    )
  );
}

/**
 * Unregister all registrations stored in the global `registrations` array.
 */
export function unregisterAll(): void {
  while (registrations.length) {
    registrations.pop()?.dispose();
  }
}

/**
 * Deactivate the extension. Runs automatically upon deactivation or uninstall.
 */
export function deactivate(): void {
  unregisterAll();
}

/**
 * Exception thrown when formatting fails.
 */
export interface FormatException {
  message: string;
}

/**
 * Sleep for the provided time and then resolve the empty promise.
 * @param duration Number of milliseconds to sleep.
 */
export function sleep(duration: number): Promise<void> {
  return new Promise((res): NodeJS.Timeout => setTimeout(res, duration));
}
