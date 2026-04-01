import json

from Quart_server.Backend.database_manager import videoDB

from Telethon_backend.backend import favorites_list_location


class FavoritesDB:
    def __init__(self):
        self.db_path = favorites_list_location  # favorites db
        self.main_db = videoDB  # main db
        self.data = self.load()

    def load(self):
        if not self.db_path.exists() or self.db_path.stat().st_size == 0:
            default_data = {"favorites": {}}
            self.save(default_data)
            return default_data

        with self.db_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def save(self, data=None):
        """Save favorites to disk"""
        if data is None:
            data = self.data
        with self.db_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        self.data = data

    def get_all_ids(self):
        return [int(k) for k in self.data.get("favorites", {}).keys()]

    def add_favorite(self, message_id):
        msg_id_str = str(message_id)
        if msg_id_str in self.data.get("favorites", {}):
            return

        entry_info = self.main_db.get_entry_info_by_video_id(message_id)
        if not entry_info:
            raise ValueError("Video not found in main DB")

        self.data["favorites"][msg_id_str] = {
            "category_slug": entry_info["category_slug"],
            "creator_slug": entry_info["creator_slug"],
            "entry_slug": entry_info["slug"]
        }
        self.save()

    def remove_favorite(self, message_id):
        msg_id_str = str(message_id)
        if msg_id_str in self.data.get("favorites", {}):
            del self.data["favorites"][msg_id_str]
            self.save()

    def get_favorite_details(self):
        structured_results = {}
        for msg_id_str, meta in self.data.get("favorites", {}).items():
            msg_id = int(msg_id_str)
            cat_slug = meta.get("category_slug")
            creator_slug = meta.get("creator_slug")
            entry_slug = meta.get("entry_slug")

            entry_info = self.main_db.data.get(cat_slug, {}).get("entries", {}).get(creator_slug, {}).get("entries",
                                                                                                          {}).get(
                entry_slug)
            if not entry_info:
                continue

            structured_results.setdefault(cat_slug, {
                "slug": cat_slug,
                "pretty": self.main_db.data.get(cat_slug, {}).get("pretty", cat_slug),
                "entries": {}
            })
            cat_obj = structured_results[cat_slug]

            cat_obj["entries"].setdefault(creator_slug, {
                "slug": creator_slug,
                "pretty": self.main_db.data[cat_slug]["entries"][creator_slug].get("pretty", creator_slug),
                "entries": {}
            })
            creator_obj = cat_obj["entries"][creator_slug]

            creator_obj["entries"].setdefault(entry_slug, {
                "slug": entry_slug,
                "pretty": entry_info.get("pretty", entry_slug),
                "videos": []
            })
            entry_obj = creator_obj["entries"][entry_slug]

            video = next((v for v in entry_info.get("videos", []) if v["message_id"] == msg_id), None)
            if video:
                entry_obj["videos"].append(video)

        return structured_results


favoritesDB = FavoritesDB()
