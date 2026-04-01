document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("entries-container");
    const searchInput = document.getElementById("search");

    fetch("/api/db/all")
        .then((response) => response.json())
        .then((data) => {
            renderData(data);

            searchInput.addEventListener("input", (e) => {
                const term = e.target.value.toLowerCase();
                filterEntries(term);
            });
        })
        .catch((err) => console.error("Error loading database:", err));

    function renderData(data) {
        container.innerHTML = "";

        // 1. Sort and Loop Top-Level Categories (e.g., PH Videos, Cosplays)
        const sortedCategoryKeys = Object.keys(data).sort();

        sortedCategoryKeys.forEach((catKey) => {
            const category = data[catKey];
            const categorySection = document.createElement("section");
            categorySection.className = "category-group";

            // Use category.pretty for the main header
            categorySection.innerHTML = `<h2>${category.pretty.toUpperCase()}</h2>`;

            // 2. Sort and Loop Creators (e.g., Candy Love, Tiny Asa)
            const sortedCreatorKeys = Object.keys(category.entries).sort();

            sortedCreatorKeys.forEach((creatorKey) => {
                const creator = category.entries[creatorKey];
                const creatorDiv = document.createElement("div");
                creatorDiv.className = "creator-block";

                // Use creator.pretty for the sub-header
                creatorDiv.innerHTML = `<h3><a href="/creator/${creatorKey}" class="creator-link">${creator.pretty} →</a></h3>`;

                const entryGrid = document.createElement("div");
                entryGrid.className = "entry-grid";

                // 3. Sort and Loop Specific Entries (Series or Single Videos)
                const sortedEntryKeys = Object.keys(creator.entries).sort();

                sortedEntryKeys.forEach((entryKey) => {
                    const entry = creator.entries[entryKey];
                    const entryCard = document.createElement("div");
                    entryCard.className = "entry-card";

                    // Use entry.pretty for the card title
                    const displayTitle = entry.pretty;

                    // 4. Sort Videos by file_name inside the entry
                    const sortedVideos = entry.videos.sort((a, b) =>
                        a.file_name.localeCompare(b.file_name),
                    );

                    entryCard.innerHTML = `
                        <h4>${displayTitle}</h4>
                        <ul class="video-list">
                            ${sortedVideos
                                .map(
                                    (v) => `
                                <li>
                                    <a href="/video/${v.message_id}" class="video-link">
                                        <span class="play-icon">▶</span> ${v.file_name}
                                    </a>
                                </li>
                            `,
                                )
                                .join("")}
                        </ul>
                    `;
                    entryGrid.appendChild(entryCard);
                });

                creatorDiv.appendChild(entryGrid);
                categorySection.appendChild(creatorDiv);
            });

            container.appendChild(categorySection);
        });
    }

    function filterEntries(term) {
        const cards = document.querySelectorAll(".entry-card");
        const groups = document.querySelectorAll(".category-group");

        cards.forEach((card) => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(term) ? "block" : "none";
        });

        // Optional: Hide category headers if all children cards are hidden
        groups.forEach((group) => {
            const hasVisibleCards = Array.from(
                group.querySelectorAll(".entry-card"),
            ).some((card) => card.style.display !== "none");
            group.style.display = hasVisibleCards ? "block" : "none";
        });
    }
});
