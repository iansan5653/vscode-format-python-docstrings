import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "bdd",
    reporter: "mocha-junit-reporter",
    reporterOptions: {
      mochaFile: path.resolve(__dirname, "./results.xml"),
      includePending: true
    }
  });

  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((c, e): void => {
    glob("**/**.test.js", {cwd: testsRoot}, (err, files): void => {
      if (err) {
        return e(err);
      }

      // Add files to the test suite
      files.forEach((f): Mocha => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha test
        mocha.run((failures): void => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        e(err);
      }
    });
  });
}
