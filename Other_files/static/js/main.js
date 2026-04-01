/**
 * 1. UTILS
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 2. SIDEBAR LOGIC
 */
let isSidebarActive = false;

function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const close_overlay = document.querySelector(".close_overlay");
    
    if (!sidebar || !close_overlay) return;

    if (isSidebarActive) {
        sidebar.style.left = "-100%";
        close_overlay.style.display = "none";
    } else {
        sidebar.style.left = "0";
        close_overlay.style.display = "block";
    }
    isSidebarActive = !isSidebarActive;
}

/**
 * 3. SETTINGS BAR LOGIC
 */
let settingsBarActive = false;

function toggleSettingsBar(e) {
    if (e) e.stopPropagation(); 
    
    const settingsBar = document.querySelector(".settings_bar");
    if (!settingsBar) return;

    settingsBarActive = !settingsBarActive;
    
    if (settingsBarActive) {
        settingsBar.style.display = "block";
        setTimeout(() => {
            settingsBar.style.opacity = "1";
            settingsBar.setAttribute("tabindex", "0");
        }, 10);
    } else {
        settingsBar.style.opacity = "0";
        settingsBar.setAttribute("tabindex", "-1");
        setTimeout(() => { 
            if(!settingsBarActive) settingsBar.style.display = "none"; 
        }, 300);
    }
}

/**
 * 4. SEARCH & DROPDOWN RENDERING
 */
function formatTitle(name) {
    let clean = name.replace(/-/g, ' ');
    if (clean.toLowerCase().includes('series') && !clean.toLowerCase().includes('series video')) {
        clean = clean.replace(/(series)\s?(\d+)/gi, '$1 video $2');
    }
    return clean;
}

function updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function renderDropdown(dropdown, results, setIndexCallback) {
    if (!results || results.length === 0) {
        dropdown.classList.remove('active');
        return;
    }

    setIndexCallback(-1); // Reset keyboard index
    
    dropdown.innerHTML = results.map(item => `
        <a href="/video/${item.id}" class="dropdown-item">
            <div class="item-info">
                <span class="item-name">${formatTitle(item.entry_name)}</span>
                <span class="item-creator">${item.creator}</span>
            </div>
        </a>
    `).join('');
    
    dropdown.classList.add('active');
}

/**
 * 5. INITIALIZATION (DOM Ready)
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Sidebar Setup ---
    const closeBtns = document.querySelectorAll(".sidebar_event");
    closeBtns.forEach(btn => btn.addEventListener("click", toggleSidebar));

    // --- Settings Setup ---
    const settingsBtn = document.querySelector(".settings_btn");
    const settingsBar = document.querySelector(".settings_bar");
    if (settingsBtn) settingsBtn.addEventListener("click", toggleSettingsBar);
    if (settingsBar) settingsBar.addEventListener("click", (e) => e.stopPropagation());

    // --- Search Setup ---
    const searchInput = document.getElementById('search');
    const dropdown = document.getElementById('search-dropdown');
    const searchBtn = document.querySelector('.search_container button');
    
    let debounceTimer;
    let selectedIndex = -1;

    if (searchInput && dropdown) {
        // Global Search Function (Redirect to full results page)
        const triggerGlobalSearch = () => {
            const query = searchInput.value.trim();
            if (query.length > 0) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        };

        // Click on Magnifying Glass
        if (searchBtn) {
            searchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                triggerGlobalSearch();
            });
        }

        // Dropdown Typing (Live Search)
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = searchInput.value.trim();

            if (query.length < 2) {
                dropdown.classList.remove('active');
                return;
            }

            debounceTimer = setTimeout(() => {
                fetch(`/api/search?q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(data => {
                        renderDropdown(dropdown, data.results, (val) => selectedIndex = val);
                    });
            }, 300);
        });

        // Keyboard Controls
        searchInput.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.dropdown-item');
            
            if (e.key === 'ArrowDown' && items.length) {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelection(items, selectedIndex);
            } 
            else if (e.key === 'ArrowUp' && items.length) {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelection(items, selectedIndex);
            } 
            else if (e.key === 'Enter') {
                e.preventDefault();
                // Priority 1: Use highlighted dropdown item
                if (selectedIndex > -1 && items[selectedIndex]) {
                    window.location.href = items[selectedIndex].getAttribute('href');
                } 
                // Priority 2: Perform full page search
                else {
                    triggerGlobalSearch();
                }
            } 
            else if (e.key === 'Escape') {
                dropdown.classList.remove('active');
                searchInput.blur();
            }
        });
    }

    // --- Global Click-to-Close ---
    document.addEventListener('click', (e) => {
        // Close search if clicking outside
        if (searchInput && !searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
        // Close settings if clicking outside
        if (settingsBarActive && settingsBtn && !settingsBtn.contains(e.target)) {
            toggleSettingsBar(); 
        }
    });
});