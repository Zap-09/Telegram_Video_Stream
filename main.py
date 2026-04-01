import os
import dotenv
import logging

from Quart_server.Backend.search_indexer import searchIndexer

dotenv.load_dotenv()

from quart import Quart

from Telethon_backend.backend import client, database_location

from Quart_server.Routes.apis import api_bp
from Quart_server.Routes.routes import routes_bp

_base_folder = os.getenv("OTHER_FILES_FOLDER")

app = Quart(
    __name__,
    root_path=_base_folder,
    template_folder="templates",
    static_folder="static",
)
app.register_blueprint(api_bp, url_prefix="/api")
app.register_blueprint(routes_bp)

app.config["MAX_CONTENT_LENGTH"] = (1024 * 1024 * 1024) * 10
app.config["BODY_TIMEOUT"] = 1800 * 2


@app.before_serving
async def startup():
    await client.connect()
    await searchIndexer.build_cache(database_location)


@app.after_serving
async def shutdown():
    await client.disconnect()


class TrafficSplitter(logging.Filter):
    def filter(self, record):
        stuff_to_file = {"GET /", "POST /", "OPTIONS /", "/api/"}

        msg = record.getMessage()
        if any(target in msg for target in stuff_to_file):
            return False

        return True


access_logger = logging.getLogger("hypercorn.access")
access_logger.disabled = False
access_logger.propagate = False

access_logger.addFilter(TrafficSplitter())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)), debug=False)
