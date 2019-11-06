import * as vscode from "vscode";
import * as util from "util";
import * as cp from "child_process";
import * as diff from "diff";
import {c} from "compress-tag";

export const promiseExec = util.promisify(cp.exec);
export let registration: vscode.Disposable | undefined;

/**
 * Build a text string that can be run as the Docformatter command with flags.
 *
 * Reads the current settings and implements them or falls back to defaults.
 * @param path Path to the file to be formatted.
 * @returns Runnable terminal command that will format the specified file.
 */
export function buildFormatCommand(path: string): string {
  const settings = vscode.workspace.getConfiguration("docstringFormatter");
  // Abbreviated to keep template string short
  const wsl = settings.get<number>("wrapSummariesLength") || 79;
  const wdl = settings.get<number>("wrapDescriptionsLength") || 72;
  const psn = settings.get<boolean>("preSummaryNewline") || false;
  const msn = settings.get<boolean>("makeSummaryMultiline") || false;
  const fw = settings.get<boolean>("forceWrap") || false;
  return c`
    docformatter "${path}" --wrap-summaries ${wsl} --wrap-descriptions ${wdl}
    ${psn ? "--blank" : ""}
    ${msn ? "--make-summary-multi-line" : ""}
    ${fw ? "--force-wrap" : ""}
  `.trim().replace(/\s+/, " "); // Remove extra whitespace (helps with tests)
}

/**
 * Installs Docformatter on the current system, assuming pip is installed.
 * @returns Empty promise that resolves upon succesful installation.
 */
export function installDocformatter(): Promise<void> {
  return new Promise(
    (res, rej): void => {
      promiseExec("pip install --upgrade docformatter")
        .then(
          (): void => {
            vscode.window.showInformationMessage(
              "Docformatter installed succesfully."
            );
            res();
          }
        )
        .catch(
          (err): void => {
            vscode.window.showErrorMessage(c`
              Could not install docformatter automatically. Make sure that pip
              is installed correctly and try manually installing with \`pip
              install --upgrade docformatter\`.
            `);
            rej(err);
          }
        );
    }
  );
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
export function alertFormattingError(err: FormatException): void {
  if (
    err.message.includes("is not recognized as an internal or external command")
  ) {
    vscode.window
      .showErrorMessage(
        c`The Python module 'docformatter' must be installed to format
          docstrings.`,
        "Install Module"
      )
      .then(
        (value): void => {
          if (value === "Install Module") {
            installDocformatter();
          }
        }
      );
  } else {
    const bugReportButton = "Submit Bug Report";
    vscode.window
      .showErrorMessage(
        "Unknown Error: Could not format docstrings.",
        bugReportButton
      )
      .then(
        (value): void => {
          if (value === bugReportButton) {
            vscode.commands.executeCommand(
              "vscode.open",
              vscode.Uri.parse(
                "https://github.com/iansan5653/vscode-format-python-docstrings/issues/new"
              )
            );
          }
        }
      );
  }
}

/**
 * Format a file using Docformatter and return the edit hunks without
 * modifying the file.
 * @param path Full path to a file to format.
 * @returns A promise that resolves to the edit hunks, which can then be
 * converted to edits and applied to the file. If the promise rejects, will
 * automatically show an error message to the user.
 */
export function formatFile(path: string): Promise<diff.Hunk[]> {
  const command: string = buildFormatCommand(path);
  return new Promise(
    (resolve, reject): Promise<void> =>
      promiseExec(command)
        .then(
          (result): void => {
            const parsed: diff.ParsedDiff[] = diff.parsePatch(result.stdout);
            resolve(parsed[0].hunks);
          }
        )
        .catch(
          (err: cp.ExecException): void => {
            alertFormattingError(err);
            reject(err);
          }
        )
  );
}

/**
 * Convert any number of hunks to a matching array of native VSCode edits.
 * @param hunks Array of hunks to convert to edits.
 * @returns Array of VSCode text edits, which map directly to the input hunks.
 */
export function hunksToEdits(hunks: diff.Hunk[]): vscode.TextEdit[] {
  return hunks.map(
    (hunk): vscode.TextEdit => {
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
    }
  );
}

/**
 * Activate the extension. Run automatically by VSCode based on
 * the `activationEvents` property in package.json.
 */
export function activate(): void {
  // Register formatter
  const selector: vscode.DocumentSelector = {
    scheme: "file",
    language: "python"
  };

  const provider: vscode.DocumentFormattingEditProvider = {
    provideDocumentFormattingEdits: (
      document: vscode.TextDocument
    ): Promise<vscode.TextEdit[]> => {
      return formatFile(document.fileName).then(hunksToEdits);
    }
  };

  registration = vscode.languages.registerDocumentFormattingEditProvider(
    selector,
    provider
  );
}

/**
 * Deactivate the extension. Runs automatically upon deactivation or uninstall.
 */
export function deactivate(): void {
  if (registration) {
    registration.dispose();
  }
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
