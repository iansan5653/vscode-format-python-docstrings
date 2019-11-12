import * as path from "path";
import {runTests} from "vscode-test";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./index");

    await runTests({
      version: "stable",
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions"]
    });
  } catch (err) {
    process.exit(1);
  }
}

main();
