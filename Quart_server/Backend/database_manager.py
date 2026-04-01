import json
from typing import Any

from Quart_server.Backend.helper_fns import slugify
from Telethon_backend.backend import database_location, client, channel


class VideoDB:
    def __init__(self):
        self.db_path = database_location
        self.data: dict[str, Any] = self.load()
        self.video_index: dict[int, Any] = self.build_video_index()

    async def build_db(self):
        """
        Scan Telegram channel and merge messages into the DB.
        Updates self.data and self.video_index.
        """
        db = self.data

        async for message in client.iter_messages(channel):

            if message.id in self.video_index:
                continue

            if not message.text or not message.document:
                continue

            try:
                data = json.loads(message.text.strip())

                category = data.get("category", "Uncategorized")
                creator = data.get("creator", "Unknown")
                entry_name = data.get("entry_name", "Untitled")

                cat_slug = slugify(category)
                creator_slug = slugify(creator)
                entry_slug = data.get("entry_slug") or slugify(entry_name)

                # Ensure category exists
                db.setdefault(cat_slug, {"slug": cat_slug, "pretty": category, "entries": {}})

                # Ensure creator exists
                db[cat_slug]["entries"].setdefault(
                    creator_slug,
                    {"slug": creator_slug, "pretty": creator, "entries": {}}
                )

                creator_ref = db[cat_slug]["entries"][creator_slug]

                # Ensure entry exists
                creator_ref["entries"].setdefault(
                    entry_slug,
                    {
                        "slug": entry_slug,
                        "pretty": entry_name,
                        "is_series": data.get("is_series", False),
                        "tags": data.get("tags", []),
                        "description": data.get("description", ""),
                        "source": data.get("source", ""),
                        "videos": []
                    },
                )

                entry_ref = creator_ref["entries"][entry_slug]

                # Update missing metadata only
                for key in ["tags", "description", "source", "is_series"]:
                    if not entry_ref.get(key) and data.get(key):
                        entry_ref[key] = data[key]

                # Merge videos
                existing_files = {v["file_name"]: v for v in entry_ref["videos"]}

                for vid in data.get("videos", []):
                    file_name = vid.get("file_name")
                    existing_vid: Any = existing_files.get(file_name)

                    if not existing_vid:
                        entry_ref["videos"].append({
                            "file_name": file_name,
                            "message_id": message.id
                        })
                    elif existing_vid.get("message_id") == "SET_BY_BACKEND":
                        existing_vid["message_id"] = message.id

            except Exception as e:
                print(f"Error processing message {message.id}: {e}")
                continue

        # Sort videos by message_id
        for cat in db.values():
            for creator in cat["entries"].values():
                for entry in creator["entries"].values():
                    entry["videos"].sort(
                        key=lambda v: v["message_id"] if isinstance(v["message_id"], int) else 10 ** 12
                    )

        # Save to file
        with self.db_path.open("w", encoding="utf-8") as f:
            json.dump(db, f, indent=4, ensure_ascii=False)

        # Update instance variables
        self.data = db
        self.video_index = self.build_video_index()

        print("Scan complete. Database updated.")

    def load(self) -> dict[str, Any]:
        if self.db_path.is_file():
            with self.db_path.open("r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def save(self):
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=4, ensure_ascii=False)
        self.video_index = self.build_video_index()

    def find_entry(self, category_slug, creator_slug, entry_slug):
        try:
            return self.data[category_slug]["entries"][creator_slug]["entries"][entry_slug]
        except KeyError:
            return None

    def build_video_index(self):
        index = {}
        for category_slug, category in self.data.items():
            category_pretty = category.get("pretty", category_slug)  # grab the human-readable name
            for creator_slug, creator in category["entries"].items():
                for entry_slug, entry in creator["entries"].items():
                    for video in entry.get("videos", []):
                        index[video["message_id"]] = {
                            "category_slug": category_slug,
                            "category_name": category_pretty,  # <-- add pretty name here
                            "creator_slug": creator_slug,
                            "entry_slug": entry_slug,
                            "entry": entry,
                            "video": video
                        }

        return index

    def find_entry_by_video_id_fast(self, message_id):
        return self.video_index.get(message_id)

    def get_entry_info_by_video_id(self, message_id):
        entry_info: Any = self.find_entry_by_video_id_fast(message_id)
        if not entry_info:
            return None

        entry = entry_info["entry"]

        category_slug = entry_info["category_slug"]
        category_name = entry_info.get("category_name", category_slug)

        return {
            "category_name": category_name,
            "category_slug": category_slug,
            "creator_name": entry_info.get("creator_pretty", entry_info["creator_slug"]),
            "creator_slug": entry_info["creator_slug"],
            "entry_name": entry_info["entry_slug"],
            "is_series": entry.get("is_series", False),
            "pretty": entry.get("pretty", entry_info["entry_slug"]),
            "slug": entry_info["entry_slug"],
            "tags": entry.get("tags", []),
            "description": entry.get("description", ""),
            "source": entry.get("source", ""),
            "videos": entry.get("videos", [])
        }

    def get_entries_by_creator(self, creator_slug):
        for category in self.data.values():
            creators = category.get("entries", {})
            if creator_slug in creators:
                creator_data = creators[creator_slug]
                entries_list = []

                for entry_slug, entry in creator_data.get("entries", {}).items():
                    videos = entry.get("videos", [])
                    first_video_id = videos[0]["message_id"] if videos else None

                    entries_list.append({
                        "slug": entry_slug,
                        "pretty": entry.get("pretty"),
                        "is_series": entry.get("is_series", False),
                        "video_count": len(videos),
                        "first_video_id": first_video_id
                    })

                return entries_list

        return []

    def edit_entry_by_video_id(self, video_id: int, payload: dict):
        """
        Edit or replace an entry using a video ID from that entry.
        Payload is the JSON sent from the frontend.
        Performs ghost-replacement or merge.
        """
        # 1. Find the entry using the video ID
        entry_info: Any = self.find_entry_by_video_id_fast(video_id)
        if not entry_info:
            raise KeyError(f"No entry found containing video ID {video_id}")

        old_entry = entry_info["entry"]
        videos_snapshot = old_entry.get("videos", []).copy()

        # 2. Delete old entry
        category_slug = entry_info["category_slug"]
        creator_slug = entry_info["creator_slug"]
        entry_slug = entry_info["entry_slug"]

        del self.data[category_slug]["entries"][creator_slug]["entries"][entry_slug]

        # 3. Build new entry from payload
        category_name = payload.get("category_name", entry_info.get("category_name", category_slug))
        creator_name = payload.get("creator_name", entry_info.get("creator_name", creator_slug))
        entry_name = payload.get("entry_name", old_entry.get("pretty", entry_slug))
        new_entry_slug = payload.get("slug", entry_slug)

        cat_slug = slugify(category_name)
        creator_slug = slugify(creator_name)

        # 4. Ensure category + creator exist
        self.data.setdefault(cat_slug, {"slug": cat_slug, "pretty": category_name, "entries": {}})
        self.data[cat_slug]["entries"].setdefault(
            creator_slug, {"slug": creator_slug, "pretty": creator_name, "entries": {}}
        )

        # 5. Merge videos: keep old + add any new from payload
        incoming_videos = payload.get("videos", [])
        # dedupe first by message_id, then file_name for those lacking a message_id
        existing = {}

        for vid in videos_snapshot:
            msg_id = vid.get("message_id")
            if isinstance(msg_id, int):
                existing[f"id-{msg_id}"] = vid
            else:
                existing[f"name-{vid['file_name']}"] = vid

        # Merge incoming videos
        for vid in incoming_videos:
            msg_id = vid.get("message_id")
            if isinstance(msg_id, int):
                key = f"id-{msg_id}"
            else:
                key = f"name-{vid['file_name']}"

            existing[key] = vid

        # Final list
        merged_videos = list(existing.values())

        # 6. Build final entry
        new_entry = {
            "slug": new_entry_slug,
            "pretty": payload.get("pretty", entry_name),
            "is_series": payload.get("is_series", old_entry.get("is_series", False)),
            "tags": payload.get("tags", old_entry.get("tags", [])),
            "description": payload.get("description", old_entry.get("description", "")),
            "source": payload.get("source", old_entry.get("source", "")),
            "videos": merged_videos,
        }

        # 7. Insert back
        self.data[cat_slug]["entries"][creator_slug]["entries"][new_entry_slug] = new_entry

        # 8. Save + rebuild index
        self.save()

        return new_entry

    def clean_empty_containers(self):
        """
        Remove empty creators and empty categories from self.data.
        Returns a report of what was removed.
        """

        removed = {
            "creators": [],  # list of creator slugs removed
            "categories": []  # list of category slugs removed
        }

        # 1. Clean empty creators
        for category_slug, category in list(self.data.items()):
            creators = category.get("entries", {})

            for creator_slug, creator_data in list(creators.items()):
                entries = creator_data.get("entries", {})

                # if creator has no actual entries
                if not entries:
                    # remove this creator
                    del self.data[category_slug]["entries"][creator_slug]
                    removed["creators"].append((category_slug, creator_slug))

            # after cleaning creators, if no creators remain:
            if not self.data[category_slug].get("entries"):
                # mark category empty too (will be removed later)
                continue

        # 2. Clean empty categories
        for category_slug, category in list(self.data.items()):
            creators = category.get("entries", {})

            if not creators:
                del self.data[category_slug]
                removed["categories"].append(category_slug)

        # 3. Save back to disk if anything was removed
        if removed["creators"] or removed["categories"]:
            self.save()

        return removed


videoDB = VideoDB()
