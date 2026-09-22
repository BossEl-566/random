from PyInstaller.utils.hooks import (
    collect_all,
    collect_submodules,
)


# ---------------------------------------------------------
# Dynamic imports
# ---------------------------------------------------------

hiddenimports = []

hiddenimports += collect_submodules(
    "app"
)

hiddenimports += collect_submodules(
    "uvicorn"
)


# ---------------------------------------------------------
# Alembic package resources
# ---------------------------------------------------------

(
    alembic_datas,
    alembic_binaries,
    alembic_hiddenimports,
) = collect_all(
    "alembic"
)

hiddenimports += (
    alembic_hiddenimports
)


# ---------------------------------------------------------
# Application resources
# ---------------------------------------------------------

datas = [
    (
        "alembic.ini",
        ".",
    ),
    (
        "migrations",
        "migrations",
    ),
]

datas += alembic_datas

binaries = []

binaries += alembic_binaries


# ---------------------------------------------------------
# Analysis
# ---------------------------------------------------------

a = Analysis(
    [
        "backend_launcher.py",
    ],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)


pyz = PYZ(
    a.pure,
)


# ---------------------------------------------------------
# Executable
# ---------------------------------------------------------

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="financial-statement-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
)


# ---------------------------------------------------------
# Distribution directory
# ---------------------------------------------------------

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="financial-statement-backend",
)