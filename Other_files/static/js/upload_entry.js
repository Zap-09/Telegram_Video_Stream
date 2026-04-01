/**
 * upload_entry.js
 * Enhanced uploader with:
 * - Two-stage upload: Staging (/api/upload) -> Finalizing (/api/upload-tele/ID)
 * - Natural sorting before numbering
 * - File size protection (2GB)
 * - XHR-based upload progress
 */

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

const naturalSorter = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("upload-form");
    const videoInput = document.getElementById("video_input");
    const dropZone = document.getElementById("drop-zone");
    const fileListDisplay = document.getElementById("file-list-display");
    const jsonPreviewBox = document.getElementById("json-preview-box");
    const togglePreviewBtn = document.getElementById("toggle-json-preview");
    const isSeriesToggle = document.getElementById("is_series_toggle");
    const seriesNamingControls = document.getElementById("series-naming-controls");
    const statusMsg = document.getElementById("upload-status");
    const progressContainer = document.getElementById("progress-container");
    const progressBar = document.getElementById("progress-bar");
    const submitBtn = document.getElementById("submit-btn");

    let uploadedFiles = [];

    // ---------- SERIES TOGGLE ----------
    isSeriesToggle.addEventListener("change", (e) => {
        const isSeries = e.target.checked;
        seriesNamingControls.style.display = isSeries ? "block" : "none";

        if (isSeries) videoInput.setAttribute("multiple", "");
        else videoInput.removeAttribute("multiple");

        document.querySelector(".drop-zone__prompt").innerText = isSeries
            ? "Drag & Drop Videos for Series"
            : "Drag & Drop a Single Video";

        uploadedFiles = [];
        videoInput.value = "";
        renderFileList();
        updateJsonPreview();
    });

    // ---------- DROPZONE ----------
    dropZone.addEventListener("click", () => videoInput.click());

    ["dragover", "dragleave", "drop"].forEach((type) => {
        dropZone.addEventListener(type, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.toggle("drop-zone--over", type === "dragover");
        });
    });

    dropZone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (![...files].every((f) => f.type.startsWith("video/"))) {
            showStatus("Only video files allowed.", "#ff5252");
            return;
        }
        handleFiles(files);
    });

    videoInput.addEventListener("change", () => {
        if (videoInput.files.length > 0) handleFiles(videoInput.files);
    });

    // ---------- FILE HANDLING ----------
    function handleFiles(files) {
        const isSeries = isSeriesToggle.checked;
        let newFiles = Array.from(files).filter((f) => f.type.startsWith("video/"));

        newFiles = newFiles.filter((f) => {
            if (f.size > MAX_FILE_SIZE) {
                alert(`${f.name} exceeds 2GB limit.`);
                return false;
            }
            return true;
        });

        newFiles = newFiles.filter(
            (f) => !uploadedFiles.some((x) => x.name === f.name && x.size === f.size)
        );

        uploadedFiles = isSeries
            ? [...uploadedFiles, ...newFiles]
            : newFiles.length ? [newFiles[0]] : uploadedFiles;

        renderFileList();
        updateJsonPreview();
    }

    function renderFileList() {
        if (!uploadedFiles.length) {
            fileListDisplay.innerHTML = `<p style="color:#555;font-size:.8rem;text-align:center;padding:10px;">No files selected</p>`;
            return;
        }

        fileListDisplay.innerHTML = `
            <div style="margin-bottom:10px;color:#bb86fc;font-weight:bold;font-size:.9rem;">
                Selected Files (${uploadedFiles.length})
            </div>
            ${uploadedFiles.map((f, i) => `
                <div class="file-item">
                    <div class="file-info">
                        <span class="file-name">📄 ${f.name}</span>
                        <span class="file-size">${((f.size) / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                    <button type="button" onclick="removeFile(${i})">✖</button>
                </div>`).join("")}
        `;
    }

    window.removeFile = (i) => {
        uploadedFiles.splice(i, 1);
        renderFileList();
        updateJsonPreview();
    };

    // ---------- JSON GENERATION ----------
    function updateJsonPreview() {
        const formData = new FormData(form);
        const filesSorted = [...uploadedFiles].sort((a, b) => naturalSorter.compare(a.name, b.name));

        const payload = {
            category: formData.get("category") || "Category",
            creator: formData.get("creator_pretty") || "Creator",
            entry_name: formData.get("entry_pretty") || "Entry Title",
            series_slug: generateSlug(`${formData.get("category")}-${formData.get("creator_pretty")}-${formData.get("entry_pretty")}`),
            entry_slug: generateSlug(formData.get("entry_pretty")),
            is_series: isSeriesToggle.checked,
            tags: formData.get("tags") ? formData.get("tags").split(",").map(t => t.trim()).filter(Boolean) : [],
            source: formData.get("source") || "",
            description: formData.get("description") || "",
            part: String(filesSorted.length),
            total_parts: String(filesSorted.length),
            videos: filesSorted.map((file, i) => ({
                file_name: isSeriesToggle.checked && document.getElementById("base_file_name").value
                    ? `${document.getElementById("base_file_name").value} (${i + 1})`
                    : file.name.replace(/\.[^/.]+$/, ""),
                original_name: file.name,
                message_id: "SET_BY_THE_BACK_END",
            })),
        };

        jsonPreviewBox.textContent = JSON.stringify(payload, null, 4);
    }

    // ---------- FORM SUBMISSION (TWO-STAGE) ----------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (uploadedFiles.length === 0) {
            showStatus("Please select at least one video file.", "#ff5252");
            return;
        }

        // Lock UI
        submitBtn.disabled = true;
        submitBtn.innerText = "Uploading...";
        progressContainer.style.display = "block";
        progressBar.style.width = "0%";
        showStatus("Staging files on server...", "#bb86fc");

        const formData = new FormData();
        const filesSorted = [...uploadedFiles].sort((a, b) => naturalSorter.compare(a.name, b.name));
        filesSorted.forEach((file, index) => {
            formData.append(`file_${index}`, file);
        });

        updateJsonPreview();
        formData.append("metadata", jsonPreviewBox.textContent);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload", true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                progressBar.style.width = percent + "%";
                statusMsg.innerText = `Uploading: ${Math.round(percent)}%`;
            }
        };

        xhr.onload = async function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                const res = JSON.parse(xhr.responseText);
                const sessionId = res.session_id;

                // STAGE 2: Finalize to Telegram
                showStatus("Finalizing & Uploading to Telegram...", "#bb86fc");
                progressBar.classList.add("progress-infinite"); // Optional: add CSS for pulse effect

                try {
                    const finalRes = await fetch(`/api/upload-tele/${sessionId}`, { method: 'POST' });
                    const finalData = await finalRes.json();

                    if (finalData.status === "success") {
                        showStatus(`✓ Success: ${finalData.message}`, "#03dac6");
                        submitBtn.innerText = "Database Updated";
                        progressBar.style.width = "100%";
                    } else {
                        handleUploadError(finalData.message || "Telegram sync failed.");
                    }
                } catch (err) {
                    handleUploadError("Failed to reach the finalization endpoint.");
                }

            } else {
                let errorMsg = "Upload failed server-side.";
                try { errorMsg = JSON.parse(xhr.responseText).message; } catch(e){}
                handleUploadError(errorMsg);
            }
        };

        xhr.onerror = () => handleUploadError("Network connection lost.");
        xhr.send(formData);
    });

    function handleUploadError(msg) {
        showStatus(`Error: ${msg}`, "#ff5252");
        submitBtn.disabled = false;
        submitBtn.innerText = "Retry Process";
        progressBar.style.background = "#ff5252";
    }

    function showStatus(text, color) {
        statusMsg.innerText = text;
        statusMsg.style.color = color;
    }

    // ---------- UI HELPERS & SUGGESTIONS ----------
    form.addEventListener("input", updateJsonPreview);
    togglePreviewBtn.addEventListener("click", () => {
        const isHidden = jsonPreviewBox.style.display === "none";
        jsonPreviewBox.style.display = isHidden ? "block" : "none";
        togglePreviewBtn.textContent = isHidden ? "Hide JSON Preview" : "Show JSON Preview";
    });

    const suggestionFields = [
        { id: "category", field: "category" },
        { id: "creator_pretty", field: "creator" },
        { id: "entry_pretty", field: "title" },
        { id: "tags", field: "tags" },
    ];

    suggestionFields.forEach(({ id, field }) => {
        const input = document.getElementById(id);
        const box = document.getElementById(`suggest-${id}`);
        let debounce;
        let selectedIndex = -1;

        input.addEventListener("input", () => {
            clearTimeout(debounce);
            let val = input.value;
            if (field === "tags") {
                const parts = val.split(",");
                val = parts[parts.length - 1].trim();
            } else { val = val.trim(); }

            if (val.length < 2) { box.classList.remove("active"); return; }

            debounce = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/search-suggestions?field=${field}&q=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    renderSuggestions(data.suggestions || []);
                } catch { box.classList.remove("active"); }
            }, 200);
        });

        input.addEventListener("keydown", (e) => {
            const items = box.querySelectorAll(".suggest-item");
            if (!items.length) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelection(items);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelection(items);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (selectedIndex >= 0) selectItem(items[selectedIndex]);
            }
        });

        function renderSuggestions(list) {
            if (!list.length) { box.classList.remove("active"); return; }
            box.innerHTML = list.map(i => `<div class="suggest-item">${i}</div>`).join("");
            box.classList.add("active");
            box.querySelectorAll(".suggest-item").forEach(item => {
                item.addEventListener("click", () => selectItem(item));
            });
            selectedIndex = -1;
        }

        function updateSelection(items) {
            items.forEach((item, idx) => item.classList.toggle("selected", idx === selectedIndex));
        }

        function selectItem(item) {
            if (field === "tags") {
                const parts = input.value.split(",");
                parts[parts.length - 1] = " " + item.innerText;
                input.value = parts.join(",").replace(/^,/, "").trimStart() + ", ";
            } else { input.value = item.innerText; }
            box.classList.remove("active");
            input.focus();
            updateJsonPreview();
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".suggest-wrapper")) {
            document.querySelectorAll(".suggestion-box").forEach(b => b.classList.remove("active"));
        }
    });

    updateJsonPreview();
});