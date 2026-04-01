import json
import os
import re
import shutil
from pathlib import Path
from typing import Any

from tqdm import tqdm
from natsort import natsorted
from aiofasttelethonhelper import fast_upload
from telethon.tl.types import DocumentAttributeVideo

from Telethon_backend.backend import client, channel, temp_video_folder


def list_folders(path):
    p = Path(path)
    return [f.name for f in p.iterdir() if f.is_dir()]


def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


async def upload_big_file(file_path, caption_text=None):
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)

    with tqdm(total=file_size, unit="B",
              unit_scale=True,
              unit_divisor=1024,
              desc=f"Uploading {file_name}",
              leave=False) as pbar:
        def progress_callback(done, total, **_kwargs):
            _total = total
            pbar.n = done
            pbar.refresh()

        uploaded_file = await fast_upload(
            client,
            file_path,
            progress_callback=progress_callback
        )

    attributes = [
        DocumentAttributeVideo(
            0, 0, 0,
            supports_streaming=True
        )
    ]

    await client.send_file(
        channel,
        uploaded_file,
        caption=caption_text,
        force_document=True,
        attributes=attributes,
        file_name=file_name,
        parse_mode='html'
    )


def process_session_captions(session_id):
    base_path = temp_video_folder / session_id
    json_path = base_path / "info.json"

    if not json_path.exists():
        print(f"Error: info.json not found in {base_path}")
        return None

    with json_path.open("r") as f:
        master_data = json.load(f)

    video_extensions = {".avi", ".mp4", ".mkv", ".mov"}
    video_files = [
        f for f in base_path.iterdir()
        if f.is_file() and f.suffix.lower() in video_extensions
    ]

    # 3️⃣ Sort files naturally (Episode 1, Episode 2...)
    video_files = natsorted(video_files, key=lambda p: p.name)

    results = []

    # 4️⃣ Loop through files and build the specific caption for each
    for index, video_path in enumerate(video_files):
        part_num = str(index + 1)

        # Match JSON metadata by index
        if index < len(master_data.get("videos", [])):
            video_metadata = master_data["videos"][index]
        else:
            video_metadata = {
                "file_name": video_path.name,
                "message_id": "SET_BY_BACKEND"
            }

        caption_dict = {
            "category": master_data.get("category", ""),
            "creator": master_data.get("creator", ""),
            "entry_name": master_data.get("entry_name", ""),
            "series_slug": master_data.get("series_slug", ""),
            "entry_slug": master_data.get("entry_slug", ""),
            "is_series": master_data.get("is_series", True),
            "tags": master_data.get("tags", []),
            "source": master_data.get("source", ""),
            "description": master_data.get("description", ""),
            "part": part_num,
            "total_parts": master_data.get("total_parts", str(len(video_files))),
            "videos": [
                {
                    "file_name": video_metadata.get("file_name", video_path.name),
                    "message_id": "SET_BY_BACKEND"
                }
            ]
        }

        results.append({
            "full_path": str(video_path),  # full path as string
            "caption": json.dumps(caption_dict, indent=4)
        })

    return results


async def upload_to_telegram_channel(session_id):
    captions_and_filepath: Any = process_session_captions(session_id)
    for items in captions_and_filepath:
        await upload_big_file(items["full_path"], caption_text=items["caption"])
    session_folder = temp_video_folder / session_id
    shutil.rmtree(session_folder)
