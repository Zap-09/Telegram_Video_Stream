const getBaseUrl = (url = window.location.href) => {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin;
    } catch (error) {
        console.error("Invalid URL provided:", error);
        return null;
    }
};

const BASE_URL = getBaseUrl();

document.addEventListener("DOMContentLoaded", () => {
    const entryId = window.location.pathname.split("/").pop();

    const form = document.getElementById("edit-form");
    const statusMsg = document.getElementById("status-msg");
    const existingContainer = document.getElementById("existing-videos");
    const isSeriesToggle = document.getElementById("is_series_toggle");
    const baseNameInput = document.getElementById("base_file_name");
    const jsonPreview = document.getElementById("json-preview");

    let currentVideos = []; 
    let removedVideoIds = new Set();

    // Helper function to create clean slugs
    const slugify = (text) => {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')     // Replace spaces with -
            .replace(/[^\w\-]+/g, '') // Remove all non-word chars
            .replace(/\-\-+/g, '-');  // Replace multiple - with single -
    };

    // -----------------------------
    // 1. JSON GENERATOR
    // -----------------------------
    function generateJsonData() {
        const isSeries = isSeriesToggle.checked;
        const baseName = baseNameInput.value.trim();
        const entryPretty = document.getElementById("entry_pretty").value;
        const creatorPretty = document.getElementById("creator_pretty").value;
        const categoryPretty = document.getElementById("category").value;

        const videoList = currentVideos
            .filter(v => !removedVideoIds.has(String(v.message_id)))
            .map((v, index) => {
                let finalName = v.file_name;
                if (baseName !== "") {
                    finalName = isSeries ? `${baseName} (${index + 1})` : baseName;
                }
                return {
                    file_name: finalName,
                    message_id: v.message_id
                };
            });

        return {
            category_name: categoryPretty,
            category_slug: slugify(categoryPretty),
            creator_name: creatorPretty,
            creator_slug: slugify(creatorPretty) || "unknown", // Now dynamically generated
            description: document.getElementById("description").value,
            entry_name: slugify(entryPretty),
            is_series: isSeries,
            pretty: entryPretty,
            slug: slugify(entryPretty),
            source: document.getElementById("source").value,
            tags: document.getElementById("tags").value.split(",")
                .map(t => t.trim())
                .filter(t => t !== ""),
            videos: videoList
        };
    }

    function updateJsonPreview() {
        if (!jsonPreview) return;
        jsonPreview.textContent = JSON.stringify(generateJsonData(), null, 2);
    }

    // -----------------------------
    // 2. DATA LOADING
    // -----------------------------
    async function loadData() {
        try {
            const res = await fetch(`${BASE_URL}/api/db/related/${entryId}`);
            const data = await res.json();

            document.getElementById("entry_pretty").value = data.pretty || data.entry_name || "";
            document.getElementById("creator_pretty").value = data.creator_name || "";
            document.getElementById("tags").value = (data.tags || []).join(", ");
            document.getElementById("source").value = data.source || "";
            document.getElementById("description").value = data.description || "";
            document.getElementById("category").value = data.category_name || "";
            
            isSeriesToggle.checked = data.is_series || false;
            
            // Default Base Name from the first video
            if (data.videos && data.videos.length > 0) {
                baseNameInput.value = data.videos[0].file_name.replace(/\s\(\d+\)$/, "");
            }

            currentVideos = data.videos || [];
            renderExistingVideos();
            updateJsonPreview();
        } catch (err) {
            statusMsg.innerText = "❌ Error loading entry data.";
        }
    }

    // -----------------------------
    // 3. RENDER VIDEOS
    // -----------------------------
    function renderExistingVideos() {
        existingContainer.innerHTML = "";
        const isSeries = isSeriesToggle.checked;
        const baseName = baseNameInput.value.trim();

        currentVideos.forEach((vid, index) => {
            if (removedVideoIds.has(String(vid.message_id))) return;

            let displayName = vid.file_name;
            if (baseName !== "") {
                displayName = isSeries ? `${baseName} (${index + 1})` : baseName;
            }

            const el = document.createElement("div");
            el.className = "file-item";
            el.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${displayName}</span>
                    <small style="color: #777;">[ID: ${vid.message_id}]</small>
                </div>
                <button type="button" class="remove-existing" data-msg-id="${vid.message_id}">Remove</button>
            `;
            existingContainer.appendChild(el);
        });
    }

    // -----------------------------
    // 4. EVENT LISTENERS
    // -----------------------------
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-existing")) {
            removedVideoIds.add(e.target.dataset.msgId);
            renderExistingVideos();
            updateJsonPreview();
        }
    });

    // Real-time updates for Naming & Toggle
    baseNameInput.addEventListener("input", () => {
        renderExistingVideos();
        updateJsonPreview();
    });

    isSeriesToggle.addEventListener("change", () => {
        renderExistingVideos();
        updateJsonPreview();
    });

    // Generic input listener for all other fields
    form.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', updateJsonPreview);
    });

    // Submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusMsg.innerText = "⏳ Saving...";

        try {
            const res = await fetch(`${BASE_URL}/api/edit-entry/${entryId}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(generateJsonData())
            });

            if (res.ok) {
                statusMsg.innerText = "✅ Saved successfully!";
                setTimeout(loadData, 1000);
            } else {
                throw new Error();
            }
        } catch (err) {
            statusMsg.innerText = "❌ Save failed.";
        }
    });

    loadData();
});