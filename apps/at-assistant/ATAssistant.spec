# -*- mode: python ; coding: utf-8 -*-
import os
from pathlib import Path

import piper as piper_pkg
import pywintypes
import pythoncom
from PyInstaller.building.splash import Splash
from PyInstaller.utils.hooks import collect_all

datas = [
    ('configs', 'configs'),
    ('data\\nlu', 'data\\nlu'),
    ('models\\nlu', 'models\\nlu'),
    ('assests\\ATAssistant.ico', 'assests'),
    ('assests\\icon_64.png', 'assests'),
    ('assests\\moon.png', 'assests'),
    ('assests\\sun.png', 'assests'),
]
if os.path.exists('.env'):
    datas.append(('.env', '.'))
for credentials_file in ('credentials.json', 'credentials_gmail.json', 'credentials_drive.json'):
    credentials_path = f'app_settings\\{credentials_file}'
    if os.path.exists(credentials_path):
        datas.append((credentials_path, 'app_settings'))
binaries = []
hiddenimports = []
binaries += [
    (pywintypes.__file__, '.'),
    (pythoncom.__file__, '.'),
]
tmp_ret = collect_all('customtkinter')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('sherpa_onnx')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('_sounddevice_data')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('keyring')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
piper_dir = Path(piper_pkg.__file__).resolve().parent
for piper_data_dir in ('espeak-ng-data', 'tashkeel'):
    data_path = piper_dir / piper_data_dir
    if data_path.exists():
        datas.append((str(data_path), f'piper/{piper_data_dir}'))
espeak_bridge = piper_dir / 'espeakbridge.pyd'
if espeak_bridge.exists():
    binaries.append((str(espeak_bridge), 'piper'))
hiddenimports += [
    'piper',
    'piper.config',
    'piper.const',
    'piper.espeakbridge',
    'piper.phoneme_ids',
    'piper.phonemize_espeak',
    'piper.tashkeel',
    'piper.voice',
    'sounddevice',
    'pythoncom',
    'pywintypes',
    'win32api',
    'win32com',
    'win32com.client',
    'win32com.shell',
    'win32con',
    'win32gui',
    'win32process',
]


a = Analysis(
    ['src\\gui\\main_gui.py'],
    pathex=['.'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'av',
        'cv2',
        'llvmlite',
        'matplotlib',
        'numba',
        'pandas',
        'piper.train',
        'pyarrow',
        'pytest',
        'sympy',
        'tensorflow',
        'torch',
        'torchaudio',
        'torchvision',
        'transformers',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
splash = Splash(
    'assests\\startup_splash.png',
    binaries=a.binaries,
    datas=a.datas,
    text_pos=None,
    minify_script=True,
    always_on_top=True,
)

exe = EXE(
    pyz,
    a.scripts,
    splash,
    a.binaries,
    a.zipfiles,
    a.datas,
    splash.binaries,
    [],
    exclude_binaries=False,
    name='ATAssistant',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon='assests\\ATAssistant.ico',
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
