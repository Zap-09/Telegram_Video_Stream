/* ==========================================
   1. CONFIGURATION & UTILITIES
   ========================================== */
function getBaseUrl(url = window.location.href) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin;
    } catch (error) {
        console.error("Invalid URL provided:", error);
        return null;
    }
}

const BASE_URL = getBaseUrl();

/* ==========================================
   2. GLOBAL ACTION HELPERS (FAVORITES & DOWNLOADS)
   ========================================== */
async function handleFavorite(mode, id) {
    let method = mode === "add" ? "POST" : mode === "delete" ? "DELETE" : "GET";
    let body = mode === "list" ? null : JSON.stringify({ id: id });
    try {
        const response = await fetch(`${BASE_URL}/api/db/favorites`, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: body,
        });
        const data = await response.json();
        return mode === "list" ? data.favorites : data.is_favorite;
    } catch (error) {
        console.error(`Error during ${mode}:`, error);
        return null;
    }
}

async function isVideoFavorite(id) {
    const favBtn = document.querySelector(".fav-btn");
    const favorites = await handleFavorite("list", id);
    if (favorites && favorites.includes(parseInt(id))) {
        favBtn.classList.add("is-active");
    }
}

async function toggleFav(id) {
    const favBtn = document.querySelector(".fav-btn");
    const mode = favBtn.classList.contains("is-active") ? "delete" : "add";
    await handleFavorite(mode, parseInt(id));
    favBtn.classList.toggle("is-active");
}

let isDownloading = false;
async function downloadVideo(id) {
    if (isDownloading) return;
    isDownloading = true;
    const url = `${BASE_URL}/api/download/${id}`;
    let dlTriggerBtn = document.getElementById("dlTrigger") || document.createElement("a");
    if (!dlTriggerBtn.id) {
        dlTriggerBtn.id = "dlTrigger";
        dlTriggerBtn.style.display = "none";
        document.body.appendChild(dlTriggerBtn);
    }
    dlTriggerBtn.href = url;
    dlTriggerBtn.setAttribute("download", "");
    dlTriggerBtn.click();
    setTimeout(() => { isDownloading = false; }, 5000);
}

/* ==========================================
   3. MAIN UI LOGIC (ENTRY POINT)
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
    
    // --- Selectors ---
    const relatedList = document.getElementById("related-list");
    const videoTitle = document.getElementById("video-title");
    const creatorSpan = document.getElementById("creator-name");
    const entrySpan = document.getElementById("entry-name");
    const videoPage = document.getElementById("video-page");
    const creatorLabel = document.getElementById("creator-label");
    const creatorEntriesList = document.getElementById("creator-entries-list");
    const favBtn = document.querySelector(".fav-btn");
    const dlBtn = document.getElementById("download");

    const descSection = document.querySelector(".video-description-section");
    const descEl = document.getElementById("video-description");
    const tagsBox = document.getElementById("tags-box");
    const descToggle = document.getElementById("desc-toggle");
    const descContainer = document.getElementById("description-container");

    if (!videoPage) return;
    const CURRENT_MESSAGE_ID = videoPage.dataset.messageId;

    // --- Data Fetching & Rendering ---
    fetch(`${BASE_URL}/api/db/related/${CURRENT_MESSAGE_ID}`)
        .then((res) => res.json())
        .then((data) => {
            if (creatorSpan) creatorSpan.innerText = data.creator_name;
            if (creatorLabel) creatorLabel.innerText = data.creator_name;
            if (entrySpan) entrySpan.innerText = data.entry_name.replace(/-/g, " ");

            const currentVideo = data.videos.find((v) => v.message_id == CURRENT_MESSAGE_ID);
            if (currentVideo && videoTitle) videoTitle.innerText = currentVideo.file_name;

            const seriesVideos = data.videos.filter((v) => v.message_id != CURRENT_MESSAGE_ID);
            if (seriesVideos.length === 0) {
                if (relatedList) relatedList.innerHTML = `<div class="no-related">No other videos in this series</div>`;
            } else {
                renderRelated(seriesVideos, data.creator_name);
            }

            if (data.creator_slug) {
                fetchMoreFromCreator(data.creator_slug, data.entry_name);
            }

            if (descSection) descSection.style.display = "block";

            const descriptionText = data.description && data.description.trim() !== "" ? data.description : "No description available.";
            const sourceText = data.source && data.source.trim() !== "" ? data.source : "No source available.";

            let sourceDisplay = sourceText;
            if (sourceText.startsWith("http")) {
                sourceDisplay = `<a href="${sourceText}" target="_blank" style="color: #bb86fc; text-decoration: none; word-break: break-all;">${sourceText}</a>`;
            }

            if (descEl) {
                descEl.innerHTML = `<div class="desc-content">${descriptionText}</div><div class="source-content"><strong>Source:</strong> <span>${sourceDisplay}</span></div>`;
            }

            setTimeout(() => {
                if (descContainer && !descContainer.querySelector(".description-gradient")) {
                    const grad = document.createElement("div");
                    grad.className = "description-gradient";
                    descContainer.appendChild(grad);
                }

                if (descEl && descEl.scrollHeight <= 55) {
                    if (descToggle) descToggle.style.display = "none";
                    if (descContainer) descContainer.classList.remove("collapsed");
                } else if (descToggle) {
                    descToggle.style.display = "block";
                }
            }, 50);

            if (tagsBox) {
                if (data.tags && data.tags.length > 0) {
                    tagsBox.style.display = "flex";
                    tagsBox.innerHTML = data.tags
                        .map((tag) => `<a href="/search?q=${encodeURIComponent(tag)}" class="tag-pill">#${tag}</a>`)
                        .join("");
                } else {
                    tagsBox.style.display = "flex";
                    tagsBox.innerHTML = `<span style="font-size: 0.8rem; color: #666; font-style: italic;">No tags available</span>`;
                }
            }
        })
        .catch((err) => console.error("Error loading related data:", err));

    // --- Description Toggle Listener ---
    if (descToggle && descContainer) {
        descToggle.addEventListener("click", () => {
            const isCollapsed = descContainer.classList.toggle("collapsed");
            descToggle.innerText = isCollapsed ? "Show More" : "Show Less";
            descContainer.style.maxHeight = !isCollapsed ? descContainer.scrollHeight + "px" : "4.2em";
        });
    }

    // --- Button Event Listeners ---
    if (favBtn) {
        isVideoFavorite(CURRENT_MESSAGE_ID);
        favBtn.addEventListener("click", () => toggleFav(CURRENT_MESSAGE_ID));
    }

    if (dlBtn) {
        dlBtn.addEventListener("click", () => downloadVideo(CURRENT_MESSAGE_ID));
    }

    // --- Local Scoped Helpers ---
    function fetchMoreFromCreator(slug, currentEntrySlug) {
        fetch(`${BASE_URL}/api/db/more-from/${slug}`)
            .then((res) => res.json())
            .then((data) => {
                const moreContainer = document.querySelector(".more-from-container");
                const filtered = data.entries.filter((e) => e.slug !== currentEntrySlug);
                if (filtered.length > 0) {
                    renderMoreFromCreator(filtered);
                    if (moreContainer) moreContainer.style.display = "block";
                } else if (moreContainer) {
                    moreContainer.style.display = "none";
                }
            });
    }

    function renderMoreFromCreator(entries) {
        if (!creatorEntriesList) return;
        creatorEntriesList.innerHTML = "";
        const listWrapper = document.createElement("div");
        listWrapper.className = "entries-wrapper collapsed";
        entries.forEach((entry) => {
            if (!entry.first_video_id) return;
            const item = document.createElement("a");
            item.href = `/video/${entry.first_video_id}`;
            item.className = "creator-entry-list-item";
            item.innerHTML = `
                <div class="entry-info-main">
                    <span class="entry-type-badge">${entry.is_series ? "Series" : "Single"}</span>
                    <span class="entry-title-text">${entry.pretty}</span>
                </div>
                <div class="entry-count-pill">${entry.video_count} Videos</div>`;
            listWrapper.appendChild(item);
        });
        creatorEntriesList.appendChild(listWrapper);
        if (entries.length > 1) {
            const btn = document.createElement("button");
            btn.className = "show-more-btn mobile-only";
            btn.innerText = "Show All Entries";
            btn.onclick = () => {
                const isCollapsed = listWrapper.classList.toggle("collapsed");
                btn.innerText = isCollapsed ? "Show All Entries" : "Show Less";
            };
            creatorEntriesList.appendChild(btn);
        }
    }

    function renderRelated(videos, creator) {
        if (!relatedList) return;
        relatedList.innerHTML = "";
        videos.forEach((v) => {
            const card = document.createElement("a");
            card.href = `/video/${v.message_id}`;
            card.className = "related-item";
            card.innerHTML = `
                <div class="thumb-placeholder"><span style="font-size: 20px;">▶</span></div>
                <div class="related-info">
                    <h4>${v.file_name}</h4>
                    <p>${creator}</p>
                </div>`;
            relatedList.appendChild(card);
        });
    }
});