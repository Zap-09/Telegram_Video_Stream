document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('results-container');
    const countText = document.getElementById('result-count');

    if (!SEARCH_QUERY) return;

    fetch(`/api/deep-search?q=${encodeURIComponent(SEARCH_QUERY)}`)
        .then(res => res.json())
        .then(data => {
            const results = data.results || [];
            renderResults(results);
        })
        .catch(err => {
            console.error("Deep Search Error:", err);
            container.innerHTML = `<p class="error">Error loading results. Please try again.</p>`;
        });

    function renderResults(results) {
        container.innerHTML = ''; // Clear spinner
        
        if (results.length === 0) {
            countText.innerText = "No matches found.";
            container.innerHTML = `
                <div class="empty-state">
                    <p>We couldn't find anything matching "${SEARCH_QUERY}".</p>
                    <a href="/" class="back-btn">Return Home</a>
                </div>`;
            return;
        }

        countText.innerText = `Found ${results.length} matching videos`;

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'result-card';
            
            // Format the title: replace hyphens and title case
            const displayTitle = item.entry_name.replace(/-/g, ' ');

            card.innerHTML = `
                <a href="/video/${item.id}" class="result-link">
                    <div class="result-info">
                        <span class="result-creator">${item.creator}</span>
                        <h3 class="result-title">${displayTitle}</h3>
                        <div class="result-meta">
                            <span class="match-score">${Math.round(item.score)}% Match</span>
                        </div>
                    </div>
                    <div class="play-hint">VIEW VIDEO</div>
                </a>
            `;
            container.appendChild(card);
        });
    }
});