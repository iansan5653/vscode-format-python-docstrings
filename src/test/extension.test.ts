import * as assert from 'assert';
import * as vscode from 'vscode';
import * as ext from '../extension';

// Tests that don't need VSCode to run. Utility functions and small blocks.
describe('extension.ts', function () {
    describe('#registration', function () {
        it('should be undefined until a Python file is opened.', _ => {
            assert(ext.registration === undefined);
        });
    });

    describe('#activate', function () {

    });

    describe('#deactivate', function () {

    });

    describe('#alertFormattingError', function () {

    });

    describe('#formatFile', function () {

    });

    describe('#hunksToEdits', function () {

    });

    describe('#buildFormatCommand', function () {

    });

    describe('#installDocformatter', function () {

    });
});