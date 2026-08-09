"""PyInstaller hook for the maintained webrtcvad-wheels package.

The upstream contrib hook imports a package name that does not exist in the
Windows wheel.  Runtime only needs the public shim and its compiled extension.
"""

hiddenimports = ["_webrtcvad"]
