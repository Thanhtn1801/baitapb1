from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
with ZipFile(root / 'flow-extension.zip', 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root / 'extension').iterdir()):
        if file.is_file():
            archive.write(file, 'flow-extension/' + file.name)
    archive.write(root / 'README.md', 'README.md')
    archive.write(root / 'ui-preview.png', 'ui-preview.png')
print('Created flow-extension.zip')
