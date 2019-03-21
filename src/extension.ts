import * as vscode from 'vscode';
import util = require('util');
import cp = require('child_process');

const promiseExec = util.promisify(cp.exec);

export function activate(context: vscode.ExtensionContext) {
    console.log("activated extension!");

    let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World!');
    });
}

export function deactivate() {}

function alertError(err: cp.ExecException) {
    if (err.message.includes("is not recognized as an internal or external command")) {
        let alert = vscode.window.showErrorMessage("The Python module \"docformatter\" must be installed to use this extension. Would you like to install it?");
    } else {
        let alert = vscode.window.showErrorMessage("Unknown Error: Could not format docstrings!");
    }
}

export function formatFile(path: string) {
    promiseExec(`docformatter "${path}"`).then(
        () => console.log(`Formatted dosctrings in file: "${path}"`)
    ).catch(alertError);
}