import aiohttp
import secrets

import aiofiles
from natsort import natsorted
from quart import Blueprint, request, abort, jsonify, Response, stream_with_context, url_for, make_response
import json

from Quart_server.Backend.token_manager import activeUploads
from Quart_server.Backend.helper_fns import replace_spaces_in_videos
from Quart_server.Backend.database_manager import videoDB
from Quart_server.Backend.favorites_manager import favoritesDB
from Quart_server.Backend.search_indexer import searchIndexer

from Telethon_backend.upload_to_channel import upload_to_telegram_channel

from Telethon_backend.backend import (client,
                                      channel,
                                      database_location,
                                      temp_video_folder,
                                      steam_chuck_size,
                                      upload_chuck_size)

api_bp = Blueprint("api", __name__)
creator_cache: list | None = None


@api_bp.route("/video/<int:message_id>")
async def stream_video(message_id: int):
    message = await client.get_messages(channel, ids=message_id)
    if not message or not message.document:
        abort(404)

    file_size = message.document.size
    range_header = request.headers.get("Range")

    start, end = 0, file_size - 1
    if range_header:
        requested_range = range_header.replace("bytes=", "").split("-")
        start = int(requested_range[0])
        if requested_range[1]:
            end = int(requested_range[1])

    async def generate():
        async for chunk in client.iter_download(
                message.document,
                offset=start,
                limit=end - start + 1,
                request_size=1024 * 1024 * steam_chuck_size
        ):
            if not chunk:
                break
            yield chunk

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Content-Length": str(end - start + 1),
        "Content-Type": message.document.mime_type,
    }

    return Response(generate(), status=206 if range_header else 200, headers=headers)


@api_bp.route("/db/all")
async def db_all():
    return jsonify(videoDB.data)


@api_bp.route("/db/update")
async def update_db():
    try:
        await videoDB.build_db()
        await searchIndexer.build_cache(database_location)
        return jsonify({
            "status": "Update completed"
        }), 200
    except Exception as e:
        print("[ERROR] DB update failed:", e)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@api_bp.route("/db/related/<int:message_id>")
async def find_related_videos(message_id):
    result = videoDB.get_entry_info_by_video_id(message_id)
    videoDB.clean_empty_containers()

    if not result:
        return jsonify({"error": "Video not found"}), 404
    return jsonify(result)


@api_bp.route("/db/more-from/<string:creator_slug>")
async def get_more_from_creator(creator_slug):
    entries = videoDB.get_entries_by_creator(creator_slug)
    return jsonify({"entries": entries})


@api_bp.route("/db/<string:creator_slug>")
async def get_creator(creator_slug):
    async with aiofiles.open(database_location, "r") as json_file:
        content = await json_file.read()
        data = json.loads(content)

    for category in data.values():
        creators = category.get("entries", {})

        if creator_slug in creators:
            return jsonify(creators[creator_slug])

    abort(404, description="Creator not found")


@api_bp.route("/db/favorites", methods=["GET"])
async def get_favorites():
    return jsonify({"favorites": favoritesDB.get_all_ids()})


@api_bp.route("/db/favorites", methods=["POST"])
async def add_favorite():
    body = await request.get_json()
    msg_id = body.get("id")
    if not msg_id:
        return jsonify({"error": "No ID provided"}), 400

    try:
        favoritesDB.add_favorite(msg_id)
    except ValueError:
        return jsonify({"error": "Video not found"}), 404

    return jsonify({"id": int(msg_id), "is_favorite": True})


# DELETE: remove favorite
@api_bp.route("/db/favorites", methods=["DELETE"])
async def delete_favorite():
    body = await request.get_json()
    msg_id = body.get("id")
    if not msg_id:
        return jsonify({"error": "No ID provided"}), 400

    favoritesDB.remove_favorite(msg_id)
    return jsonify({"id": int(msg_id), "is_favorite": False})


@api_bp.route("/db/favorites/details", methods=["GET"])
async def favorites_details():
    details = favoritesDB.get_favorite_details()
    return jsonify(details)


@api_bp.route("/download/<int:message_id>")
async def download(message_id):
    message = await client.get_messages(channel, ids=message_id)
    if not message or not message.media:
        return "<h1>File not found</h1>", 404

    entry_info = videoDB.get_entry_info_by_video_id(message_id)
    if not entry_info:
        return "<h1>Video not found</h1>", 404

    # Determine file name
    file_name = "file"
    for item in entry_info.get("videos", []):
        if item["message_id"] == message_id:
            file_name = item["file_name"]

    mime_type = "application/octet-stream"
    total_size = message.file.size

    @stream_with_context
    async def gen():
        async for chunk in client.iter_download(
                message.media,
                request_size=1024 * 1024 * steam_chuck_size
        ):
            yield chunk

    response = await make_response(gen())

    response.mimetype = mime_type
    response.headers["Content-Disposition"] = f'attachment; filename="{file_name}.mp4"'
    response.headers["Content-Length"] = str(total_size)

    response.timeout = None
    return response


@api_bp.route("/refresh/db")
async def refresh_cache():
    await searchIndexer.build_cache(database_location)
    return "", 202


@api_bp.route("/search")
async def search_api():
    query = request.args.get("q", "").strip()
    results = searchIndexer.search(query)
    return jsonify({"results": results or None})


@api_bp.route("/deep-search")
async def deep_search_api():
    query = request.args.get("q", "").strip()
    results = searchIndexer.deep_search(query)
    return jsonify({"results": results or None})


@api_bp.route("/search-suggestions")
async def search_suggestions():
    field = request.args.get("field")
    query = request.args.get("q", "").strip().lower()

    suggestions = searchIndexer.get_suggestions(field, query)
    return jsonify({"suggestions": suggestions})


@api_bp.route("/search/advanced", methods=["POST"])
async def api_advanced_search():
    data = await request.get_json()

    if not data:
        return jsonify({"error": "No search criteria provided"}), 400

    # Perform the search
    results = searchIndexer.advanced_search(data)

    return jsonify({
        "status": "success",
        "count": len(results),
        "results": results
    })


@api_bp.route("/upload", methods=["POST"])
async def upload_entry_api():
    try:
        form = await request.form
        files = await request.files

        metadata_str: str | None = form.get("metadata")
        if not metadata_str:
            return jsonify({"status": "error", "message": "Missing metadata"}), 400

        session_id = secrets.token_hex(4)
        session_folder = temp_video_folder / session_id
        session_folder.mkdir(parents=True, exist_ok=True)

        file_keys = natsorted([k for k in files.keys() if k.startswith("file_")])
        saved_count = 0

        for key in file_keys:
            file_storage = files[key]
            if file_storage and file_storage.filename:
                safe_name = file_storage.filename
                target_path = session_folder / safe_name

                session_folder.mkdir(parents=True, exist_ok=True)

                async with aiofiles.open(target_path, mode="wb") as f:

                    chunk_size = 1024 * 1024 * upload_chuck_size
                    while True:
                        chunk = file_storage.read(chunk_size)
                        if not chunk:
                            break
                        await f.write(chunk)
                saved_count += 1

        try:
            metadata_json = json.loads(metadata_str)

            metadata_json["_internal_session_id"] = session_id

            info_file_path = session_folder / "info.json"
            async with aiofiles.open(info_file_path, mode="w") as f:
                await f.write(json.dumps(metadata_json, indent=4))

            replace_spaces_in_videos(session_folder)

        except json.JSONDecodeError:
            return jsonify({"status": "error", "message": "Invalid JSON metadata"}), 400

        return jsonify({
            "status": "success",
            "message": f"Stored {saved_count} files in temporary session.",
            "session_id": session_id,
            "path": str(session_folder)
        }), 200

    except Exception as e:
        print("--- DATABASE UPLOAD ERROR ---")
        print(str(e))
        print("-----------------------------")
        return jsonify({"status": "error", "message": str(e)}), 500


@api_bp.route("/upload-tele/<string:session_id>", methods=["GET", "POST"])
async def upload_to_telegram(session_id: str):
    if not session_id:
        return jsonify({"status": "error", "message": "Missing session_id"}), 400

    session_path = temp_video_folder / session_id

    if not session_path.exists() or not any(session_path.iterdir()):
        return jsonify({"status": "error", "message": "Session does not exist"}), 400

    if session_id in activeUploads:
        return jsonify({
            "status": "busy",
            "message": "This session is already uploading"
        }), 409

    activeUploads.add(session_id)

    try:
        await upload_to_telegram_channel(session_id)

        async with aiohttp.ClientSession() as session:
            async with session.get(url_for("api.update_db", _external=True)) as _resp:
                pass
        return jsonify({"status": "success"})
    finally:
        activeUploads.discard(session_id)


@api_bp.route("/edit-entry/<int:video_id>", methods=["POST"])
async def edit_entry_api(video_id):
    data = await request.get_json() or {}
    try:
        updated_entry = videoDB.edit_entry_by_video_id(video_id, data)
        return jsonify({"status": "success", "entry": updated_entry})
    except KeyError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": f"Unexpected error: {e}"}), 500
