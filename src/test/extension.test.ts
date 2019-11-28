import * as assert from "assert";
import * as vscode from "vscode";
import * as ext from "../extension";
import {Hunk} from "diff";
import * as path from "path";

/** Relative path to the source test folder. */
const testFolder = ["..", "..", "src", "test"];
const examplePaths: Readonly<Record<string, string[]>> = {
  /** The basic test file with no quirks. */
  basicPythonFile: [...testFolder, "example.py"],
  /** A test file where the path contains spaces. */
  pythonFileWithSpaces: [
    ...testFolder,
    "example with spaces in name.py"
  ],
  /** Sample workspace folder A. */
  workspaceFolderA: [
    ...testFolder,
    "test-folders",
    "test-folder-a"
  ],
  /** Sample workspace folder B. */
  workspaceFolderB: [...testFolder, "test-folders", "test-folder-b"]
};
/** Extension identifier. */
const identifier = "iansan5653.format-python-docstrings";
/** The name of the workspace folder containing the root test directory. */
const workspaceFolders = {
  test: "test",
  A: "FolderA",
  B: "FolderB"
};

describe("extension.ts", function(): void {
  context("prior to extension activation", function(): void {
    describe("extension", function(): void {
      it("should have installed succesfully", function(): void {
        assert.ok(vscode.extensions.getExtension(identifier));
      });

      it("should not be activated on startup", function(): void {
        const extension = vscode.extensions.getExtension(
          identifier
        ) as vscode.Extension<void>;
        assert.equal(extension.isActive, false);
      });
    });

    describe("#registration", function(): void {
      it("should be undefined until activated", function(): void {
        assert.strictEqual(ext.registration, undefined);
      });
    });
  });

  context("after extension activation", function(): void {
    const extension = vscode.extensions.getExtension(
      identifier
    ) as vscode.Extension<void>;
    const documents: Record<string, vscode.TextDocument | null> = {
      base: null,
      spacesInName: null
    };

    before("open test files", async function(): Promise<void> {
      // Open a text doc, then wait for the the extension to be active.
      const documentsList = await Promise.all([
        vscode.workspace.openTextDocument(
          path.resolve(__dirname, ...examplePaths.basicPythonFile)
        ),
        vscode.workspace.openTextDocument(
          path.resolve(__dirname, ...examplePaths.pythonFileWithSpaces)
        )
      ]);
      documents.base = documentsList[0];
      documents.spacesInName = documentsList[1];
    });

    describe("#activate()", function(): void {
      // Waits until the extension is active, but will eventually time out if
      // not
      it("should successfully activate the extension on file opening", function(): Promise<
        void
      > {
        return new Promise((res): void => {
          setInterval((): void => {
            if (extension.isActive) {
              res();
            }
          }, 50);
        });
      });
    });

    describe("#registration", function(): void {
      it("should contain the formatter disposable upon activation", function(): void {
        assert.ok(ext.registration);
      });
    });

    describe("#alertFormattingError()", function(): void {
      it("should not throw an error", function(): void {
        const exception: ext.FormatException = {message: "none"};
        ext.alertFormattingError(exception);
      });

      // TODO: Test that it installs Docformatter under the right error
      it(
        "should install docformatter if the error signifies it's not installed"
      );
    });

    describe("#installDocformatter()", function(): void {
      // Uninstall, then reinstall Docformatter
      before("uninstall docformatter if installed", function(): Promise<void> {
        this.timeout("15s");
        this.slow("3s");
        return new Promise((res): void => {
          // Resolve either way, as a rejection means it wasn't installed
          // anyway
          ext
            .promiseExec("pip uninstall docformatter -y")
            .then((): void => {
              res();
            })
            .catch((): void => {
              res();
            });
        });
      });

      it("should succesfully install Docformatter", function(): Promise<void> {
        this.timeout("15s");
        this.slow("6s");
        return assert.doesNotReject(ext.installDocformatter());
      });
    });

    describe("#formatFile()", function(): void {
      it("should succesfully resolve with format hunks", function(): Promise<
        void
      > {
        this.timeout("4s");
        this.slow("1s");
        return assert.doesNotReject(
          ext.formatFile((documents.base as vscode.TextDocument).fileName)
        );
      });

      it("should succesfully resolve if there are spaces in the file path", function(): Promise<
        void
      > {
        this.timeout("4s");
        this.slow("1s");
        return assert.doesNotReject(
          ext.formatFile(
            (documents.spacesInName as vscode.TextDocument).fileName
          )
        );
      });
    });

    describe("#hunksToEdits()", function(): void {
      it("should handle empty array by returning empty array", function(): void {
        assert.strictEqual(ext.hunksToEdits([]).length, 0);
      });

      it("should maintain hunk range", function(): void {
        const hunk: Hunk = {
          oldStart: 1,
          newStart: 2,
          oldLines: 3,
          newLines: 4,
          lines: ["one", "two", "three"],
          linedelimiters: ["\n", "\n", "\n"]
        };
        const vsEdit = ext.hunksToEdits([hunk])[0];

        assert.strictEqual(vsEdit.range.start.line, 1);
        assert.strictEqual(vsEdit.range.start.character, 0);
        assert.strictEqual(vsEdit.range.end.line, 3);
        assert.strictEqual(vsEdit.range.end.character, 4);
      });

      it("should properly format hunks into edits", function(): void {
        const hunk: Hunk = {
          oldStart: 1,
          newStart: 2,
          oldLines: 3,
          newLines: 4,
          lines: [
            "-remove",
            " old",
            "-remove",
            " old",
            "+new",
            "-remove",
            "+new"
          ],
          linedelimiters: ["\n", "\n", "\n", "\n", "\n", "\n", "\n"]
        };
        const vsEdit = ext.hunksToEdits([hunk])[0];
        assert.strictEqual(vsEdit.newText, "old\nold\nnew\nnew");
      });

      it("should handle multiple hunks", function(): void {
        const hunkA: Hunk = {
          oldStart: 1,
          newStart: 2,
          oldLines: 3,
          newLines: 4,
          lines: [
            "-remove",
            " old",
            "-remove",
            " old",
            "+new",
            "-remove",
            "+new"
          ],
          linedelimiters: ["\n", "\n", "\n", "\n", "\n", "\n", "\n"]
        };
        const hunkB: Hunk = {
          oldStart: 1,
          newStart: 2,
          oldLines: 3,
          newLines: 4,
          lines: [
            "-remove",
            " old",
            "-remove",
            " old",
            "+new",
            "-remove",
            "+new"
          ],
          linedelimiters: ["\n", "\n", "\n", "\n", "\n", "\n", "\n"]
        };
        const vsEdits = ext.hunksToEdits([hunkA, hunkB]);
        assert.strictEqual(vsEdits.length, 2);
      });
    });

    describe("#buildFormatCommand()", function(): void {
      it("should contain the passed path", async function(): Promise<void> {
        const path = "c:/example-path/document.py";
        const command = await ext.buildFormatCommand(path);
        assert(command.includes(path));
      });

      it("should implement the correct defaults", async function(): Promise<
        void
      > {
        const command = await ext.buildFormatCommand("path");
        const expectedCommandWithoutPy =
          'docformatter "path" --wrap-summaries 79 --wrap-descriptions 72';
        assert(command.endsWith(expectedCommandWithoutPy));
      });

      context("with modified settings in test folder", function(): void {
        const settings = vscode.workspace.getConfiguration(
          "docstringFormatter"
        );

        before("change the relevant settings", async function(): Promise<void> {
          await Promise.all([
            settings.update("wrapSummariesLength", 85, true),
            settings.update("wrapDescriptionsLength", 90, true),
            settings.update("preSummaryNewline", true, true),
            settings.update("makeSummaryMultiline", true, true),
            settings.update("forceWrap", true, true)
          ]);
        });

        it("should use the new settings", async function(): Promise<void> {
          const command = await ext.buildFormatCommand("path");
          const expectedCommandWithoutPy =
            'docformatter "path" --wrap-summaries 85 --wrap-descriptions 90 --blank --make-summary-multi-line --force-wrap';
          assert(command.endsWith(expectedCommandWithoutPy));
        });

        after("reset the settings back to defaults", async function(): Promise<
          void
        > {
          await Promise.all([
            settings.update("wrapSummariesLength", undefined, true),
            settings.update("wrapDescriptionsLength", undefined, true),
            settings.update("preSummaryNewline", undefined, true),
            settings.update("makeSummaryMultiline", undefined, true),
            settings.update("forceWrap", undefined, true)
          ]);
        });
      });

      context("with custom pythonPath", function(): void {
        it("should await custom pythonPath and use it", async function(): Promise<
          void
        > {
          const examplePython = "Example Python Path";
          const exampleFile = "Example File Path";
          const command = await ext.buildFormatCommand(
            exampleFile,
            new Promise((res) => res(examplePython))
          );
          assert.strictEqual(
            command,
            // This function quotes the file path, but expects the python path
            // to be quoted already.
            // eslint-disable-next-line max-len
            `${examplePython} -m docformatter "${exampleFile}" --wrap-summaries 79 --wrap-descriptions 72`
          );
        });
      });
    });

    describe("#getPython()", function(): void {
      it("should return a runnable Python path", async function(): Promise<
        void
      > {
        const python = await ext.getPython();
        assert.doesNotReject(ext.promiseExec(`${python} --version`));
      });

      it("should return 'python' or 'py' if no Python extension", async function(): Promise<
        void
      > {
        // Only works if we do not install the python extention in the test env
        const python = await ext.getPython();
        assert(["python", "py"].includes(python));
      });

      it("should return 'python' or 'py' if setPath undefined", async function(): Promise<
        void
      > {
        const python = await ext.getPython(undefined);
        assert(["python", "py"].includes(python));
      });

      context("with local Python environments", function() {
        const envName = "exampleEnv";

        before("create a local environment", async function(): Promise<void> {
          this.timeout("30s");
          this.slow("10s");
          const python = await ext.getPython();
          await ext.promiseExec(
            `${python} -m venv ${envName}`,
            undefined,
            workspaceFolders.test
          );
        });

        it("should run Python from the local environment when desired", async function(): Promise<
          void
        > {
          // On Unix devices, the Python executable in a virtual environment is
          // located in the `bin` folder. On Windows, it's `scripts/python.exe`.
          // process.platform is always "win32" on windows, even on win64.
          const subfolder = process.platform === "win32" ? "scripts" : "bin";
          const python = await ext.getPython(
            path.resolve(__dirname, ...testFolder, envName, subfolder, "python")
          );
          assert.doesNotReject(ext.promiseExec(`${python} --version`));
        });

        it.skip("handles workspaceFolder variable", async function(): Promise<
          void
        > {
          const python = await ext.getPython(
            path.resolve(
              `\${workspaceFolder:${workspaceFolders.test}}`,
              "scripts",
              "python"
            )
          );
          assert.doesNotReject(ext.promiseExec(`${python} --version`));
        });

        after("delete local environment", async function(): Promise<void> {
          // TODO: Uncomment when recursive option is not experimental
          // await rmdir(`./${envName}`, {recursive: true});
        });
      });
    });

    context("#replaceWorkspaceVariables", function(): void {
      it("handles {workspaceFolder} variable", async function(): Promise<void> {
        assert.strictEqual(
          ext.replaceWorkspaceVariables("text/${workspaceFolder}/text"),
          `text/${path.resolve(
            __dirname,
            ...examplePaths.workspaceFolderA
          )}/text`
        );
      });

      it("handles {workspaceFolderBasename} variable", async function(): Promise<
        void
      > {
        const path = examplePaths.workspaceFolderA;
        assert.strictEqual(
          ext.replaceWorkspaceVariables("text/${workspaceFolderBasename}/text"),
          `text/${path[path.length - 1]}/text`
        );
      });

      it("handles {workspaceFolder:name} variable", async function(): Promise<
        void
      > {
        assert.strictEqual(
          ext.replaceWorkspaceVariables(
            `text/\${workspaceFolder:${workspaceFolders.B}}/text`
          ),
          `text/${path.resolve(
            __dirname,
            ...examplePaths.workspaceFolderB
          )}/text`
        );
      });

      it("handles {workspaceFolderBasename:name} variable", async function(): Promise<
        void
      > {
        const path = examplePaths.workspaceFolderB;
        assert.strictEqual(
          ext.replaceWorkspaceVariables(
            `text/\${workspaceFolderBasename:${workspaceFolders.B}}/text`
          ),
          `text/${path[path.length - 1]}/text`
        );
      });
    });

    context("after extension deactivation", function(): void {
      before("deactivate the extension", function(): void {
        ext.deactivate();
      });

      describe("#deactivate()", function(): void {
        // Tested by the before hook
      });

      describe("#registration", function(): void {
        // TODO: determine how to check registration disposal
        it("should be disposed of upon deactivation");
      });
    });
  });
});
