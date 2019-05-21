import * as vscode from 'vscode';
import * as util from 'util';
import * as cp from 'child_process';
import * as diff from 'diff';

export const promiseExec = util.promisify(cp.exec);
export let registration: vscode.Disposable | undefined;

export function activate() {
    // Register formatter
    const selector: vscode.DocumentSelector = {
        scheme: 'file', language: 'python'
    };

    const provider: vscode.DocumentFormattingEditProvider = {
        provideDocumentFormattingEdits:
            (document: vscode.TextDocument) => formatFile(document.fileName).then(hunksToEdits)
    };

    registration = vscode.languages.registerDocumentFormattingEditProvider(selector, provider);
}

export function deactivate() {
    if (registration) { registration.dispose(); }
}

export function alertFormattingError(err: cp.ExecException) {
    if (err.message.includes("is not recognized as an internal or external command")) {
        vscode.window.showErrorMessage("The Python module \"docformatter\" must be installed to format docstrings.", "Install Module")
            .then(value => {
                if (value === "Install Module") {
                    installDocformatter();
                }
            });
    } else {
        vscode.window.showErrorMessage("Unknown Error: Could not format docstrings.");
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
            alertFormattingError(err);
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
        const lineEndChar: string = hunk.linedelimiters[0];
        const newText = newTextLines.join(lineEndChar);

        return new vscode.TextEdit(editRange, newText);
    });
}

export function buildFormatCommand(path: string): string {
    const settings = vscode.workspace.getConfiguration('docstringFormatter');
    // Abbreviated to keep template string short
    const wsl: number = settings.get('wrapSummariesLength') || 79;
    const wdl: number = settings.get('wrapDescriptionsLength') || 72;
    const psn: boolean = settings.get('preSummaryNewline') || false;
    const msn: boolean = settings.get('makeSummaryMultiline') || false;
    const fw: boolean = settings.get('forceWrap') || false;
    return `docformatter ${path} --wrap-summaries ${wsl} --wrap-descriptions ${wdl}${psn ? ' --blank' : ''}${msn ? ' --make-summary-multi-line' : ''}${fw ? ' --force-wrap' : ''}`;
}

export function installDocformatter(): Promise<void> {
    return new Promise((res, rej) => {
        promiseExec("pip install --upgrade docformatter").then(() => {
            vscode.window.showInformationMessage("Docformatter installed succesfully.");
            res();
        }).catch(err => {
            vscode.window.showErrorMessage("Could not install docformatter automatically. Make sure that pip is installed correctly and try manually installing with `pip install --upgrade docformatter`.");
            rej(err);
        });
    });
}