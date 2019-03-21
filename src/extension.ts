import * as vscode from 'vscode';
import util = require('util');
import cp = require('child_process');
import diff = require('diff');

const promiseExec = util.promisify(cp.exec);

export function activate(context: vscode.ExtensionContext) {
    const selector: vscode.DocumentSelector = {
        scheme: 'file', language: 'python'
    };

    const provider: vscode.DocumentFormattingEditProvider = {
        provideDocumentFormattingEdits:
            (document: vscode.TextDocument) => formatFile(document.fileName).then(hunksToEdits)
    };

    vscode.languages.registerDocumentFormattingEditProvider(selector, provider);
}

export function deactivate() { }

function alertError(err: cp.ExecException) {
    if (err.message.includes("is not recognized as an internal or external command")) {
        vscode.window.showErrorMessage("The Python module \"docformatter\" must be installed to format docstrings. Would you like to install it?");
    } else {
        vscode.window.showErrorMessage("Unknown Error: Could not format docstrings!");
    }
}

export function formatFile(path: string): Promise<diff.Hunk[]> {
    const command: string = buildFormatCommand(path);

    return new Promise((resolve, reject) =>
        promiseExec(command).then(result => {
            console.log(`Formatted dosctrings in file: "${path}"`);
            const parsed: diff.ParsedDiff[] = diff.parsePatch(result.stdout);
            resolve(parsed[0].hunks);
        }).catch((err: cp.ExecException) => {
            alertError(err);
            reject(err);
        })
    );
}

export function hunksToEdits(hunks: diff.Hunk[]) {
    return hunks.map(hunk => {
        const startPos = new vscode.Position(hunk.newStart - 1, 0);
        const endPos = new vscode.Position(hunk.newStart - 1 + hunk.oldLines - 1,
            hunk.lines[hunk.lines.length - 1].length - 1);
        const editRange = new vscode.Range(startPos, endPos);

        let newTextLines = hunk.lines
            .filter(line => (line.charAt(0) === ' ' || line.charAt(0) === '+'))
            .map(line => line.substr(1));
        const lineEndChar: string = (hunk as any).linedelimiters[0];
        const newText = newTextLines.join(lineEndChar);

        return new vscode.TextEdit(editRange, newText);
    });
}

function buildFormatCommand(path: string): string {
    const settings = vscode.workspace.getConfiguration('docstringFormatter');
    // Abbreviated to keep template string short
    const wsl: number = settings.get('wrapSummariesLength') || 79;
    const wdl: number = settings.get('wrapDescriptionsLength') || 72;
    const psn: boolean = settings.get('preSummaryNewline') || false;
    const msn: boolean = settings.get('makeSummaryMultiline') || false;
    const fw: boolean = settings.get('forceWrap') || false;
    return `docformatter ${path} --wrap-summaries ${wsl} --wrap-descriptions ${wdl}${psn ? ' --blank' : ''}${msn ? ' --make-summary-multi-line' : ''}${fw ? ' --force-wrap' : ''}`
}