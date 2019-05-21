"""Example file for testing."""


def function_with_good_docstring(param: str) -> bool:
    """This is a well-formatted docstring.

    It has a longer description here as well.

    # Arguments
        param (str): A parameter that is passed to the function.

    # Returns
        bool: A boolean value.
    """
    return bool(param)


def function_with_bad_docstring(param: str) -> bool:
    '''
This is a badly-formatted docstring.
    It has a longer description here as well. But it's way too long to fit the line that it is in. It just keeps going on and on. And the author didn't put any line breaks in.

    It should not use single quotes or have trailing whitespace.

    # Arguments
        param (str): A parameter that is passed to the function.

    # Returns       
        bool: A boolean value. '''
    return bool(param)
