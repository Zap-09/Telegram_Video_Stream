function getBaseUrl(url = window.location.href) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin;
    } catch (error) {
        console.error("Invalid URL provided:", error);
        return null;
    }
}


async function loadCreatorData() {
    const entryDisplay = document.getElementById('entry-display');
    const creatorNameHeading = document.getElementById('creator-name');

    try {
        const response = await fetch(`${getBaseUrl()}/api/db/${CREATOR_SLUG}`);
        if (!response.ok) throw new Error('Creator not found');
        
        const data = await response.json();

        // 1. Update Page Title and Heading
        document.title = `${data.pretty} | Gallery`;
        creatorNameHeading.textContent = data.pretty;

        // 2. Clear loader/placeholder
        entryDisplay.innerHTML = '';

        // 3. Loop through the entries (e.g., specific cosplays)
        // data.entries is where "red-hood-nikke", etc., live
        Object.values(data.entries).forEach(entry => {
            const card = document.createElement('div');
            card.className = 'entry-card';

            // Build video list HTML
            const videoItems = entry.videos.map(v => `
                <li>
                    <a href="/video/${v.message_id}" class="video-link">
                        ▶ ${v.file_name}
                    </a>
                </li>
            `).join('');

            card.innerHTML = `
                <h3>${entry.pretty}</h3>
                <p style="font-size: 0.8em; color: #888;">${entry.description || 'No description available.'}</p>
                <ul class="video-list">
                    ${videoItems}
                </ul>
            `;

            entryDisplay.appendChild(card);
        });

    } catch (error) {
        console.error('Error:', error);
        entryDisplay.innerHTML = `<p>Error loading creator data.</p>`;
    }
}

document.addEventListener('DOMContentLoaded', loadCreatorData);