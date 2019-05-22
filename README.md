# Python Docstring Formatter Extension

Simple extension that implements
[`docformatter`](https://pypi.org/project/docformatter/) as a native VSCode
formatter. The formatter uses
[PEP 257](https://www.python.org/dev/peps/pep-0257/) as a guide.

[![Build Status](https://dev.azure.com/iansan5653/vscode-format-python-docstrings/_apis/build/status/iansan5653.vscode-format-python-docstrings?branchName=master)](https://dev.azure.com/iansan5653/vscode-format-python-docstrings/_build/latest?definitionId=1&branchName=master)

## Features

See https://pypi.org/project/docformatter/ for the full feature list. This
extension uses that project as a backend with few modifications.

All relevant flags are implemented as [extension settings](#extension-settings).

## How to Use

If you already have a Python formatting extension installed, you will need to
pick this one when you want to format a file. In a Python file in VSCode,
<kbd>ctrl</kbd>+<kbd>shift</kbd>+<kbd>p</kbd> to open the command pallette,
run the command *Format Document With...* and select
*Python Docstring Formatter*.

To set the default formatter that is run when you run the *Format Document*,
on Python files, add the following to your **settings.json**:

```json
"[python]": {
    "editor.defaultFormatter": "iansan5653.format-python-docstrings"
}
```

*Note*: The *Python Docstring Formatter* option will only appear for files
that have been saved on disk (ie, not **Untitled-#** tabs).

## Requirements

This extension requires `pip` and/or the `docformatter` module to be installed.
Upon activating, the extension will automatically give the option to run
`pip install --upgrade docformatter` if necessary. If you prefer to install the
formatter program in another way, you may do so. Just make sure that the
`docformatter` command is recognized by your terminal (ie, added to your PATH).

## Extension Settings

All relevant flags from the original `docformatter` program are implemented as
settings:

* `docstringFormatter.wrapSummariesLength` (`number`, default `79`): Wrap long 
    summary lines at this length; set to `0` to disable wrapping.
* `docstringFormatter.wrapDescriptionsLength` (`number`, default `72`): Wrap 
    descriptions at this length; set to `0` to disable wrapping.
* `docstringFormatter.preSummaryNewline` (`boolean`, default `false`): Add a 
    newline before the summary of a multi-line docstring.
* `docstringFormatter.makeSummaryMultiline` (`boolean`, default `false`): Add a 
    newline before and after the summary of a one-line docstring.
* `docstringFormatter.forceWrap` (`boolean`, default `false`): Force 
    descriptions to be wrapped even if it may result in a mess.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Contributing

Before contributing, you will need to install
[Node.js (with NPM)](https://nodejs.org/en/) (and Visual Studio Code, of course).
Clone the repository and install the required dependencies by running
`npm install` in a terminal in the new directory. All extension logic is in
`src/extension.ts`. Whenever modifying extension behavior, be sure to update and
add unit tests in `src/test/extension.test.ts`. To run/test the extension,
simply use the debugger in VSCode after opening the extension folder.