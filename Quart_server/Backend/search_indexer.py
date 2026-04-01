import aiofiles
import json

from rapidfuzz import fuzz
from natsort import natsorted


class FlatIndexManager:
    def __init__(self):
        self.raw_cache = {}
        self.search_cache: list[dict] | None = None
        self.flat_categories = set()
        self.flat_titles = set()
        self.flat_creators = set()
        self.flat_series = set()
        self.flat_tags = set()
        self.is_loaded = False

    async def build_cache(self, file_path):

        async with aiofiles.open(file_path, mode="r") as f:
            content = await f.read()
            self.raw_cache = json.loads(content)

            self.flat_titles.clear()
            self.flat_creators.clear()
            self.flat_series.clear()
            self.flat_tags.clear()
            self.flat_categories.clear()

            for cat_id, cat_data in self.raw_cache.items():

                if "pretty" in cat_data:
                    self.flat_categories.add(cat_data["pretty"])

                creators = cat_data.get("entries", {})
                for c_id, c_data in creators.items():
                    if "pretty" in c_data:
                        self.flat_creators.add(c_data["pretty"])

                    entries = c_data.get("entries", {})
                    for e_id, e_data in entries.items():
                        if "pretty" in e_data:
                            self.flat_titles.add(e_data["pretty"])
                            if e_data.get("is_series"):
                                self.flat_series.add(e_data["pretty"])

                        if "tags" in e_data:
                            for tag in e_data["tags"]:
                                self.flat_tags.add(tag)

            self.search_cache = self._build_search_cache()
            self.is_loaded = True
            print("FlatIndexManager: Cache and search index rebuilt.")

    def _build_search_cache(self):


        results = []
        for cat_id, cat_data in self.raw_cache.items():
            creators = cat_data.get("entries", {})
            for c_id, c_data in creators.items():
                entries = c_data.get("entries", {})
                for e_id, e_data in entries.items():
                    videos = e_data.get("videos", [])
                    for v in videos:
                        results.append({
                            "id": v.get("message_id"),
                            "name": v.get("file_name", e_data.get("pretty")),
                            "creator": c_data.get("pretty"),
                            "category": cat_data.get("pretty"),
                            "tags": e_data.get("tags", []),
                            "is_series": e_data.get("is_series")
                        })
        return results

    def search(self, query: str, threshold: int = 60, max_results: int = 50):

        if not query:
            return []

        query = query.lower()
        results = []

        for item in self.search_cache or []:
            item_name_lower = item["name"].lower()
            if query not in item_name_lower and len(query) <= 4:
                continue
            score = fuzz.WRatio(query, item_name_lower)
            if score >= threshold:
                results.append({**item, "score": round(score, 2)})

        sorted_results = natsorted(results, key=lambda x: (-x["score"], len(x["name"])))
        return sorted_results[:max_results]

    def deep_search(self, query: str, threshold: int = 60, max_results: int = 50):

        if not query:
            return []

        query = query.lower()
        results = []

        for item in self.search_cache or []:
            item_name_lower = item["name"].lower()
            ts_score = fuzz.token_set_ratio(query, item_name_lower)
            w_score = fuzz.WRatio(query, item_name_lower)
            final_score = max(ts_score, w_score)

            if final_score >= threshold:
                results.append({**item, "score": round(final_score, 2)})

        sorted_results = sorted(results, key=lambda x: (-x["score"], len(x["name"])))
        return sorted_results[:max_results]

    def advanced_search(self, filters: dict):
        results = []

        f_title = filters.get("title", "").strip().lower()
        f_creator = filters.get("creator", "").strip().lower()
        f_series = filters.get("series", "").strip().lower()
        f_tags = [
            t.strip().lower()
            for t in filters.get("tags", "").split(",")
            if t.strip()
        ]

        for cat_data in self.raw_cache.values():
            for c_data in cat_data.get("entries", {}).values():

                c_pretty = c_data.get("pretty", "").lower()
                if f_creator and f_creator not in c_pretty:
                    continue

                for e_data in c_data.get("entries", {}).values():

                    e_pretty = e_data.get("pretty", "").lower()
                    if f_title and f_title not in e_pretty:
                        continue

                    if f_series:
                        if not (e_data.get("is_series") and f_series in e_pretty):
                            continue

                    if f_tags:
                        e_tags = [t.lower() for t in e_data.get("tags", [])]
                        if not all(tag in e_tags for tag in f_tags):
                            continue

                    for v in e_data.get("videos", []):
                        results.append({
                            "id": v.get("message_id"),
                            "entry_name": v.get("file_name"),
                            "creator": c_data.get("pretty"),
                            "category": cat_data.get("pretty"),
                            "tags": e_data.get("tags", []),
                            "is_series": e_data.get("is_series")
                        })

        return results

    def get_suggestions(self, field: str, query: str, max_results: int = 10):

        if not query or len(query) < 2:
            return []

        query = query.lower()

        source_map = {
            "category": self.flat_categories,
            "title": self.flat_titles,
            "creator": self.flat_creators,
            "series": self.flat_series,
            "tags": self.flat_tags
        }

        target_set = source_map.get(field, set())

        matches = [
            item for item in target_set
            if query in item.lower()
        ]

        return natsorted(
            matches,
            key=lambda x: (
                not x.lower().startswith(query),
                x.lower()
            )
        )[:max_results]


searchIndexer = FlatIndexManager()
