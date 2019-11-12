import * as path from "path";
import * as Mocha from "mocha";
import * as glob from "glob";

export function run(
  _: unknown,
  cb: (error: null | Error, failures?: number) => void
): void {
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
  glob("**/**.test.js", {cwd: testsRoot}, (err, files): void => {
    if (err) {
      return cb(err);
    }

    // Add files to the test suite
    files.forEach((f): Mocha => mocha.addFile(path.resolve(testsRoot, f)));

    try {
      // Run the mocha test
      mocha.run((failures): void => {
        console.log("##vso[task.setvariable variable=testsRan]true");
        console.log(`${failures} test(s) failed.`);
        cb(null, failures);
      });
    } catch (err) {
      console.log("##vso[task.setvariable variable=testsRan]false");
      console.log("Failed to run tests");
      cb(err);
    }
  });
}
