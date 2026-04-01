document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("advanced-search-form");
    const errorMsg = document.getElementById("form-error");
    const resultsGrid = document.getElementById("advanced-results-grid");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const searchParams = Object.fromEntries(formData.entries());

        // Validation: At least one field
        const hasValue = Object.values(searchParams).some(
            (val) => val.trim().length > 0,
        );
        if (!hasValue) {
            errorMsg.innerText = "Please fill in at least one field.";
            return;
        }

        errorMsg.innerText = "";
        resultsGrid.innerHTML =
            '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            const response = await fetch("/api/search/advanced", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(searchParams),
            });
            const data = await response.json();

            renderAdvancedResults(data.results);
        } catch (err) {
            resultsGrid.innerHTML = `<p class="error">Server error. Please try again later.</p>`;
        }
    });

    function renderAdvancedResults(results) {
        const info = document.getElementById("advanced-results-info");
        resultsGrid.innerHTML = "";

        if (results.length === 0) {
            info.innerHTML = `<p>No results found matching those filters.</p>`;
            return;
        }

        info.innerHTML = `<h3>Found ${results.length} results</h3>`;

        results.forEach((item) => {
            // If item.id is an array, loop through each message_id; otherwise, just wrap in an array
            const ids = Array.isArray(item.id) ? item.id : [item.id];

            ids.forEach((videoId) => {
                const card = document.createElement("div");
                card.className = "result-card";
                card.innerHTML = `
                <a href="/video/${videoId}" class="result-link">
                    <div class="result-info">
                        <span class="result-creator">${item.creator}</span>
                        <h3 class="result-title">${item.entry_name}</h3>
                        <div class="result-tags">
                            ${item.tags.map((t) => `<span class="tag-pill">${t}</span>`).join("")}
                        </div>
                    </div>
                </a>
            `;
                resultsGrid.appendChild(card);
            });
        });
    }
});
document.addEventListener("DOMContentLoaded", () => {
    const fields = ["title", "creator", "series", "tags"];
    const form = document.getElementById("advanced-search-form");

    // --- 1. CLEAR BUTTON LOGIC ---
    document.getElementById("clear-filters").addEventListener("click", () => {
        form.reset();
        document
            .querySelectorAll(".suggestion-box")
            .forEach((b) => b.classList.remove("active"));
        document.getElementById("advanced-results-grid").innerHTML =
            '<div class="initial-message"><p>Filters cleared.</p></div>';
    });

    // --- 2. SUGGESTION LOGIC WITH KEYBOARD ---
    fields.forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        const suggestBox = document.getElementById(`suggest-${fieldId}`);
        let debounceTimer;
        let selectedIndex = -1;

        input.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            const query = input.value.trim();
            if (query.length < 2) {
                suggestBox.classList.remove("active");
                return;
            }

            debounceTimer = setTimeout(async () => {
                const res = await fetch(
                    `/api/search-suggestions?field=${fieldId}&q=${encodeURIComponent(query)}`,
                );
                const data = await res.json();
                renderSuggestions(data.suggestions, input, suggestBox);
                selectedIndex = -1; // Reset selection on new data
            }, 200);
        });

        input.addEventListener("keydown", (e) => {
            const items = suggestBox.querySelectorAll(".suggest-item");
            if (!suggestBox.classList.contains("active") || items.length === 0)
                return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                highlightItem(items);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                selectedIndex =
                    (selectedIndex - 1 + items.length) % items.length;
                highlightItem(items);
            } else if (e.key === "Enter" && selectedIndex > -1) {
                e.preventDefault();
                selectItem(items[selectedIndex], input, suggestBox);
            }
        });

        function highlightItem(items) {
            items.forEach((item, idx) => {
                item.classList.toggle("selected", idx === selectedIndex);
                if (idx === selectedIndex)
                    item.scrollIntoView({ block: "nearest" });
            });
        }
    });

    function selectItem(item, input, box) {
        input.value = item.innerText;
        box.classList.remove("active");
        input.focus();
    }

    function renderSuggestions(list, input, box) {
        if (!list || list.length === 0) {
            box.classList.remove("active");
            return;
        }
        box.innerHTML = list
            .map((item) => `<div class="suggest-item">${item}</div>`)
            .join("");
        box.classList.add("active");

        box.querySelectorAll(".suggest-item").forEach((item) => {
            item.addEventListener("click", () => selectItem(item, input, box));
        });
    }
});
