import re
from pathlib import Path

def slugify(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def replace_spaces_in_videos(folder_path):
    ext = {".mp4", ".avi", ".mkv", ".webm", ".mov"}

    folder = Path(folder_path)
    for file_path in folder.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in ext:
            if " " in file_path.name:
                new_name = file_path.name.replace(" ", "_")
                new_path = file_path.with_name(new_name)
                file_path.rename(new_path)
