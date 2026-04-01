import os
from pathlib import Path

from telethon import TelegramClient
from telethon.crypto import AES
import tgcrypto


# Some tomfoolery to get Telethon to use tgcrypto without having cryptg
class TgCryptoIGE:
    @staticmethod
    def decrypt(data, key, iv):
        return tgcrypto.ige256_decrypt(data, key, iv)

    @staticmethod
    def encrypt(data, key, iv):
        return tgcrypto.ige256_encrypt(data, key, iv)


AES.decrypt_ige = TgCryptoIGE.decrypt
AES.encrypt_ige = TgCryptoIGE.encrypt

api_id = int(os.environ["API_ID"])
api_hash = os.environ["API_HASH"]
channel = int(os.environ["CHANNEL_ID"])

steam_chuck_size = int(os.getenv("STREAM_CHUNK_MB", 2))
upload_chuck_size = int(os.getenv("UPLOAD_CHUNK_MB", 2))

temp_folder = Path(os.getenv("TEMP_FOLDER", "TEMP"))
temp_video_folder = temp_folder / "videos"
_base_folder = Path(os.getenv("OTHER_FILES_FOLDER", "Other_files"))
_db_path = Path(os.getenv("DATABASE_PATH", "Database"))

database_location = _base_folder / _db_path / "database.json"

favorites_list_location = _base_folder / _db_path / "favorites.json"

database_location.parent.mkdir(parents=True, exist_ok=True)

client = TelegramClient("session", api_id, api_hash)
