# Python Docstring Formatter Extension

Simple extension that implements [`docformatter`](https://pypi.org/project/docformatter/)
as a native VSCode formatter. The formatter uses PEP 257 as a guide.

## Features

See https://pypi.org/project/docformatter/ for the full feature list. This extension
uses that project as a backend with few modifications. To run the formatter after 
installing, simply open a Python file and run the `Format Document` command. All
other Python formatters installed will run as well.

All relevant flags are implemented as [extension settings](#extension-settings).

## Requirements

This extension requires `pip` and/or the `docformatter` module to be installed.
Upon activating, the extension will automatically give the option to run
`pip install --upgrade docformatter` if necessary. If you prefer to install the
formatter program in another way, you may do so. Just make sure that the
`docformatter` command is recognized by your terminal.

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

