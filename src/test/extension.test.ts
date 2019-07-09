import * as assert from "assert";
import * as vscode from "vscode";
import * as ext from "../extension";
import {ExecException} from "child_process";
import {Hunk} from "diff";

const testPythonFile = "/../../src/test/example.py";
const identifier = "iansan5653.format-python-docstrings";

/**
 * Sleep for the provided time and then resolve the empty promise.
 * @param duration Number of milliseconds to sleep.
 */
function sleep(duration: number): Promise<void> {
  return new Promise((res) => setTimeout(res, duration));
}

describe("extension.ts", function() {
  context("prior to extension activation", function() {
    describe("extension", function() {
      it("should have installed succesfully", function() {
        assert.ok(vscode.extensions.getExtension(identifier));
      });

      it("should not be activated on startup", function() {
        let extension = vscode.extensions.getExtension(
          identifier
        ) as vscode.Extension<any>;
        assert.equal(extension.isActive, false);
      });
    });

    describe("#registration", function() {
      it("should be undefined until activated", function() {
        assert.strictEqual(ext.registration, undefined);
      });
    });
  });

  context("after extension activation", function() {
    const extension = vscode.extensions.getExtension(
      identifier
    ) as vscode.Extension<any>;
    let document: vscode.TextDocument;

    before("activate extension by opening Python file", function() {
      this.timeout("3s");
      // Open a text doc, then wait for the the extension to be active.
      return vscode.workspace
        .openTextDocument(__dirname + testPythonFile)
        .then((doc) => {
          document = doc;
          return new Promise((res) => {
            setInterval((_) => {
              if (extension.isActive) {
                res();
              }
            }, 50);
          });
        });
    });

    describe("#activate()", function() {
      // tested by the before hook
      return;
    });

    describe("#registration", function() {
      it("should contain the formatter disposable upon activation", function() {
        assert.ok(ext.registration);
      });
    });

    describe("#alertFormattingError()", function() {
      it("should not throw an error", function() {
        ext.alertFormattingError({message: "none"} as ExecException);
      });

      // TODO: Test that it installs Docformatter under the right error
      it(
        "should install docformatter if the error signifies it's not installed"
      );
    });

    describe("#installDocformatter()", function() {
      // Uninstall, then reinstall Docformatter
      before("uninstall docformatter if installed", function() {
        this.timeout("15s");
        this.slow("3s");
        return new Promise((res) => {
          // Resolve either way, as a rejection means it wasn't installed anyway
          ext
            .promiseExec("pip uninstall docformatter -y")
            .then((_) => {
              res();
            })
            .catch((_) => {
              res();
            });
        });
      });

      it("should succesfully install Docformatter", function() {
        this.timeout("15s");
        this.slow("6s");
        return assert.doesNotReject(ext.installDocformatter());
      });
    });

    describe("#formatFile()", function() {
      it("should succesfully resolve with format hunks", function() {
        this.slow("1s");
        return assert.doesNotReject(
          ext.formatFile((document as vscode.TextDocument).fileName)
        );
      });
    });

    describe("#hunksToEdits()", function() {
      it("should handle empty array by returning empty array", function() {
        assert.strictEqual(ext.hunksToEdits([]).length, 0);
      });

      it("should maintain hunk range", function() {
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

      it("should properly format hunks into edits", function() {
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

      it("should handle multiple hunks", function() {
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

    describe("#buildFormatCommand()", function() {
      it("should contain the passed path", function() {
        const path = "c:/example-path/document.py";
        assert.notStrictEqual(ext.buildFormatCommand(path).indexOf(path), -1);
      });

      it("should implement the correct defaults", function() {
        assert.strictEqual(
          ext.buildFormatCommand("path"),
          "docformatter path --wrap-summaries 79 --wrap-descriptions 72"
        );
      });

      context.skip("with modified settings in test folder", function() {
        let settings: vscode.WorkspaceConfiguration;

        before("change the relevant settings", function() {
          // TODO: Why is VSCode not updating the settings in the test
          // environment?

          settings = vscode.workspace.getConfiguration("docstringFormatter");

          return settings
            .update("wrapSummariesLength", 85, true)
            .then((_) => {
              settings.update("wrapDescriptionsLength", 90, true);
            })
            .then((_) => {
              settings.update("preSummaryNewline", true, true);
            })
            .then((_) => {
              settings.update("makeSummaryMultiline", true, true);
            })
            .then((_) => {
              settings.update("forceWrap", true, true);
            });
        });

        it("should use the new settings", function() {
          console.log(settings.get("wrapSummariesLength"));
          assert.strictEqual(
            ext.buildFormatCommand("path"),
            "docformatter path --wrap-summaries 85 --wrap-descriptions 90 --blank --make-summary-multi-line --force-wrap"
          );
        });

        after("reset the settings back to defaults", function() {
          return settings
            .update("wrapSummariesLength", undefined, true)
            .then((_) => {
              settings.update("wrapDescriptionsLength", undefined, true);
            })
            .then((_) => {
              settings.update("preSummaryNewline", undefined, true);
            })
            .then((_) => {
              settings.update("makeSummaryMultiline", undefined, true);
            })
            .then((_) => {
              settings.update("forceWrap", undefined, true);
            });
        });
      });
    });

    context("after extension deactivation", function() {
      before("deactivate the extension", function() {
        ext.deactivate();
      });

      describe("#deactivate()", function() {
        // Tested by the before hook
      });

      describe("#registration", function() {
        // TODO: determine how to check registration disposal
        it("should be disposed of upon deactivation");
      });
    });
  });
});
