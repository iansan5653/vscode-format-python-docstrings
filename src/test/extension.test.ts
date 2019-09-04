import * as assert from "assert";
import * as vscode from "vscode";
import * as ext from "../extension";
import {Hunk} from "diff";

const testPythonFiles: Readonly<Record<string, string>> = {
  /** The basic test file with no quirks. */
  base: "/../../src/test/example.py",
  /** A test file where the path contains spaces. */
  spacesInName: "/../../src/test/example with spaces in name.py"
};
/** Extension identifier. */
const identifier = "iansan5653.format-python-docstrings";

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
        vscode.workspace.openTextDocument(__dirname + testPythonFiles.base),
        vscode.workspace.openTextDocument(
          __dirname + testPythonFiles.spacesInName
        )
      ]);
      documents.base = documentsList[0];
      documents.spacesInName = documentsList[1];
    });

    describe("#activate()", function(): void {
      // Waits until the extension is active, but will eventually time out if
      // not
      it("should successfully activate the extension on file opening", function(): Promise<void> {
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
      it("should contain the passed path", function(): void {
        const path = "c:/example-path/document.py";
        assert.notStrictEqual(ext.buildFormatCommand(path).indexOf(path), -1);
      });

      it("should implement the correct defaults", function(): void {
        assert.strictEqual(
          ext.buildFormatCommand("path"),
          "docformatter path --wrap-summaries 79 --wrap-descriptions 72"
        );
      });

      context.skip("with modified settings in test folder", function(): void {
        let settings: vscode.WorkspaceConfiguration;

        before("change the relevant settings", function(): Thenable<void> {
          // TODO: Why is VSCode not updating the settings in the test
          // environment?

          settings = vscode.workspace.getConfiguration("docstringFormatter");

          return settings
            .update("wrapSummariesLength", 85, true)
            .then((): void => {
              settings.update("wrapDescriptionsLength", 90, true);
            })
            .then((): void => {
              settings.update("preSummaryNewline", true, true);
            })
            .then((): void => {
              settings.update("makeSummaryMultiline", true, true);
            })
            .then((): void => {
              settings.update("forceWrap", true, true);
            });
        });

        it("should use the new settings", function(): void {
          console.log(settings.get("wrapSummariesLength"));
          assert.strictEqual(
            ext.buildFormatCommand("path"),
            "docformatter path --wrap-summaries 85 --wrap-descriptions 90 --blank --make-summary-multi-line --force-wrap"
          );
        });

        after("reset the settings back to defaults", function(): Thenable<
          void
        > {
          return settings
            .update("wrapSummariesLength", undefined, true)
            .then((): void => {
              settings.update("wrapDescriptionsLength", undefined, true);
            })
            .then((): void => {
              settings.update("preSummaryNewline", undefined, true);
            })
            .then((): void => {
              settings.update("makeSummaryMultiline", undefined, true);
            })
            .then((): void => {
              settings.update("forceWrap", undefined, true);
            });
        });
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
