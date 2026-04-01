document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('entries-container');
    const countBadge = document.getElementById('fav-count');
    const searchInput = document.getElementById('search');

    // Utility for formatting
    const formatTitle = (str) => {
        if (!str) return "";
        return str.split('-')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
    };

    // Load favorites
    fetch('/api/db/favorites/details')
        .then(response => response.json())
        .then(data => {
            if (Object.keys(data).length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <p>No favorites yet. Start hearting some videos!</p>
                </div>`;
                return;
            }
            
            renderFavorites(data);

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    filterEntries(e.target.value.toLowerCase());
                });
            }
        })
        .catch(err => console.error("Error loading favorites:", err));

    function renderFavorites(data) {
        container.innerHTML = ''; 
        let totalVideos = 0;

        // Categories
        Object.values(data).sort((a, b) => a.pretty.localeCompare(b.pretty)).forEach(category => {
            const categorySection = document.createElement('section');
            categorySection.className = 'category-group';
            categorySection.innerHTML = `<h2>${category.pretty.toUpperCase()}</h2>`;

            // Creators
            Object.values(category.entries).sort((a, b) => a.pretty.localeCompare(b.pretty)).forEach(creator => {
                const creatorDiv = document.createElement('div');
                creatorDiv.className = 'creator-block';
                creatorDiv.innerHTML = `<h3>${creator.pretty}</h3>`;

                const entryGrid = document.createElement('div');
                entryGrid.className = 'entry-grid';

                // Entries/Series
                Object.values(creator.entries).sort((a, b) => a.pretty.localeCompare(b.pretty)).forEach(entry => {
                    const entryCard = document.createElement('div');
                    entryCard.className = 'entry-card';
                    
                    totalVideos += entry.videos.length;

                    entryCard.innerHTML = `
                        <h4>${entry.pretty}</h4>
                        <ul class="video-list">
                            ${entry.videos.map(v => `
                                <li>
                                    <a href="/video/${v.message_id}" class="video-link">
                                        <span class="play-icon">▶</span> ${v.file_name}
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    `;
                    entryGrid.appendChild(entryCard);
                });

                creatorDiv.appendChild(entryGrid);
                categorySection.appendChild(creatorDiv);
            });

            container.appendChild(categorySection);
        });
        
        countBadge.innerText = totalVideos;
    }

    function filterEntries(term) {
        // Hide/Show creator blocks based on content
        document.querySelectorAll('.creator-block').forEach(block => {
            const hasMatch = block.innerText.toLowerCase().includes(term);
            block.style.display = hasMatch ? 'block' : 'none';
        });

        // Hide/Show category groups if they become empty
        document.querySelectorAll('.category-group').forEach(group => {
            const visibleBlocks = group.querySelectorAll('.creator-block[style="display: block;"]');
            group.style.display = visibleBlocks.length > 0 ? 'block' : 'none';
        });
    }
});