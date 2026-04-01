from quart import Blueprint, request, render_template, redirect, url_for

routes_bp = Blueprint("routes", __name__)


@routes_bp.route("/")
async def index():
    return await render_template("index.html")


@routes_bp.route("/video/<int:message_id>")
async def video(message_id):
    return await render_template("video.html", message_id=message_id)


@routes_bp.route("/all_entries")
async def all_entries():
    return await render_template("all_entries.html")


@routes_bp.route("/favorites")
async def favorites():
    return await render_template("favorites.html")


@routes_bp.route("/creator/<string:creator_slug>")
async def creator_page(creator_slug):
    return await render_template("creator_page.html", creator_slug=creator_slug)


@routes_bp.route("/search")
async def search():
    query = request.args.get("q")
    if query is None or query.strip() == "":
        return redirect(url_for("routes.index"))
    return await render_template("search.html", q=query)


@routes_bp.route("/advanced-search")
async def advanced_search():
    return await render_template("advanced_search.html")


@routes_bp.route("/upload")
async def upload_entry():
    return await render_template("upload_entry.html")


@routes_bp.route("/edit/<int:message_id>")
async def edit(message_id):
    return await render_template("edit.html", message_id=message_id)
