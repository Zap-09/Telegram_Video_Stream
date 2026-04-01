const video = document.getElementById("main-player");
const pausePlay = document.getElementById("pausePlay");
const fullScreenBtn = document.getElementById("fullScreenBtn");
const progress = document.getElementById("progress");
const progressPlayed = document.getElementById("progress-played");
const progressBuffer = document.getElementById("progress-buffer");
const currentTimeEl = document.querySelector(".current-time");
const totalTimeEl = document.querySelector(".total-time");
const playerContainer = document.querySelector(".player-container");
const floatingPlayBtn = document.querySelector(".floatingPlayBtn");
const backwardFloat = document.querySelector(".backward");
const forwardFloat = document.querySelector(".forward");

const RESET_DELAY = 1000
const SEEK_AMOUNT = 5;
const forwardSpan = document.getElementById("f");
const backwardSpan = document.getElementById("b");

function changeIconPlay() {
    pausePlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M320-200v-560l440 280-440 280Z"/></svg>`;
    floatingPlayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M320-200v-560l440 280-440 280Z"/></svg>`;
}

function changeIconPause() {
    pausePlay.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/></svg>`;
    floatingPlayBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z"/></svg>`;
}

function handleVideoState() {
    if (video.paused) {
        changeIconPlay();
    } else {
        changeIconPause();
    }
}

function playVideo() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

pausePlay.addEventListener("click", playVideo);
floatingPlayBtn.addEventListener("click", playVideo);
video.addEventListener("play", handleVideoState);
video.addEventListener("pause", handleVideoState);
document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;

    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();
        playVideo();
    } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
    }
});

async function toggleFullscreen() {
    if (!document.fullscreenElement) {
        try {
            await playerContainer.requestFullscreen();

            // If it's a mobile device, lock to landscape
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock("landscape").catch((err) => {
                    console.log(
                        "Orientation lock ignored (likely on Desktop).",
                    );
                });
            }
        } catch (err) {
            console.error("Fullscreen failed", err);
        }
    } else {
        document.exitFullscreen();
        // Unlock orientation when exiting
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }
}
fullScreenBtn.addEventListener("click", toggleFullscreen);

video.addEventListener("timeupdate", () => {
    const percent = (video.currentTime / video.duration) * 100;
    progressPlayed.style.width = percent + "%";
});

progress.addEventListener("click", (e) => {
    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
});

video.addEventListener("progress", () => {
    const buffered = video.buffered;
    if (buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const percent = (end / video.duration) * 100;
        progressBuffer.style.width = percent + "%";
    }
});

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

video.addEventListener("loadedmetadata", () => {
    totalTimeEl.textContent = formatTime(video.duration);
});

video.addEventListener("timeupdate", () => {
    currentTimeEl.textContent = formatTime(video.currentTime);
});

const volumeBtn = document.getElementById("volumeBtn");
const volumeBox = document.querySelector(".volumeBox");

// Toggle the expand class
volumeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevents immediate closing
    volumeBox.classList.toggle("volume-active");
});

// Close the bar if user clicks anywhere else on the screen
document.addEventListener("click", (e) => {
    if (!volumeBox.contains(e.target)) {
        volumeBox.classList.remove("volume-active");
    }
});

const volumeBar = document.querySelector(".volumeBar");
const volumeBarValue = document.querySelector(".volumeBarValue");
let isDragging = false;

// Function to update the volume based on mouse position
function updateVolume(e) {
    const rect = volumeBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const totalWidth = rect.width;

    let percentage = (offsetX / totalWidth) * 100;
    percentage = Math.max(0, Math.min(100, percentage));

    // 1. Update the UI
    volumeBarValue.style.width = percentage + "%";

    // 2. Update the actual volume (0 to 1 scale)
    const volumeValue = percentage / 100;
    if (video) video.volume = volumeValue;

    // 3. SAVE TO LOCAL STORAGE
    updateSettings({
        volume: volumeValue,
    });
}

// Start dragging...
volumeBar.addEventListener("mousedown", (e) => {
    isDragging = true;
    updateVolume(e);
});

// While dragging (Update UI and Video only)
document.addEventListener("mousemove", (e) => {
    if (isDragging) {
        updateVolume(e); // Let's assume updateVolume ONLY updates UI/Video now
    }
});

// When they LET GO (Save to LocalStorage once)
document.addEventListener("mouseup", () => {
    if (isDragging) {
        const currentVol = video.volume;
        updateSound(currentVol); // Save now!
        isDragging = false;
    }
});

function setVolume(val) {
    // Update the actual audio (clamped between 0 and 1)
    if (video) video.volume = val;

    // Update the red bar width
    volumeBarValue.style.width = val * 100 + "%";
}
setVolume(loadSettings().volume);

function updateSound(value) {
    let settings = {
        volume: value,
    };
    localStorage.setItem("settings", JSON.stringify(settings));
}
function updateSettings(newSettings) {
    // 1. Get current settings first
    let currentSettings = loadSettings();

    // 2. Merge current settings with new changes
    let updated = { ...currentSettings, ...newSettings };

    // 3. Save back to localStorage
    localStorage.setItem("settings", JSON.stringify(updated));
}

function loadSettings() {
    let saved = localStorage.getItem("settings");
    if (saved) {
        return JSON.parse(saved); // Convert string back to object
    }
    // Return a default if nothing is saved yet
    return { volume: 0.5 };
}

function initPlayer() {
    const settings = loadSettings();

    // Apply saved volume
    setVolume(settings.volume);

    // Check if autoplay is enabled in settings
    if (settings.autoplay) {
        // We mute it by default because browsers block autoplay with sound
        video.muted = false;

        video.play().catch((err) => {
            console.log(
                "Autoplay blocked by browser even though setting is ON",
            );
        });
    }
}
document.addEventListener("DOMContentLoaded", initPlayer);


let forwardClicks = 0;
let backwardClicks = 0;

// Reset timers
let forwardTimer;
let backwardTimer;
let brightnessTimer;
// Forward handler


function flashVideo() {
    video.style.transition = "filter 0.5s ease";
    video.style.filter = "brightness(0.5)";

    clearTimeout(brightnessTimer);
    brightnessTimer = setTimeout(() => {
        video.style.filter = "brightness(1)";
    }, 500); // fade back to normal
}

// Forward double-click
forwardFloat.addEventListener("dblclick", () => {
    forwardClicks++;
    const seekTime = SEEK_AMOUNT * forwardClicks;
    video.currentTime = Math.min(video.duration, video.currentTime + seekTime);

    forwardSpan.textContent = `+${seekTime}s`;
    flashVideo();

    clearTimeout(forwardTimer);
    forwardTimer = setTimeout(() => {
        forwardClicks = 0;
        forwardSpan.textContent = "";
    }, RESET_DELAY);
});

// Backward double-click
backwardFloat.addEventListener("dblclick", () => {
    backwardClicks++;
    const seekTime = SEEK_AMOUNT * backwardClicks;
    video.currentTime = Math.max(0, video.currentTime - seekTime);

    backwardSpan.textContent = `-${seekTime}s`;
    flashVideo();

    clearTimeout(backwardTimer);
    backwardTimer = setTimeout(() => {
        backwardClicks = 0;
        backwardSpan.textContent = "";
    }, RESET_DELAY);
});
