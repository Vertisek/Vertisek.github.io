// ==========================================================================
// Vertone Portfolio Javascript Engine (IndexedDB & Custom Media Controls)
// ==========================================================================

// --- Discord App Configuration ---
const DISCORD_CLIENT_ID = '1526394545158230039'; // Default template Client ID
const OWNER_DISCORD_IDS = ['490167888469295134', '111111111111111111']; // Vertis real ID & simulated ID

// --- App State ---
let appState = {
    isOwner: false, // Set dynamically on load based on user role
    activeTab: 'courses',
    activeCategory: 'bannery',
    tracks: [],
    graphics: [],
    reviews: [],
    currentPlayingId: null,
    globalVolume: 0.8,
    isMuted: false,
    user: null
};

// --- Global Audio Engine ---
const audio = new Audio();
audio.volume = appState.globalVolume;

// --- Database Engine (IndexedDB) ---
const DB_NAME = 'VertonePortfolioDB';
const DB_VERSION = 2;
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (e) => {
            console.error("IndexedDB load error:", e);
            reject(e);
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;

            // Create tracks store
            if (!dbInstance.objectStoreNames.contains('tracks')) {
                dbInstance.createObjectStore('tracks', { keyPath: 'id' });
            }

            // Create graphics store
            if (!dbInstance.objectStoreNames.contains('graphics')) {
                dbInstance.createObjectStore('graphics', { keyPath: 'id' });
            }

            // Create reviews store
            if (!dbInstance.objectStoreNames.contains('reviews')) {
                dbInstance.createObjectStore('reviews', { keyPath: 'id' });
            }
        };
    });
}

// Helper DB operations
function saveToDB(storeName, item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e);
    });
}

function getAllFromDB(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
}

function deleteFromDB(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e);
    });
}

// --- Pre-populate Data ---
const DEFAULT_TRACKS = [
    {
        id: 'track_def_1',
        title: 'Vertis - Cyber Beat v1 (Mix & Master)',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        votesUp: 0,
        votesDown: 0,
        feedbacks: [],
        isDefault: true
    },
    {
        id: 'track_def_2',
        title: 'Vertis - Space Melodies (Mastering)',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        votesUp: 0,
        votesDown: 0,
        feedbacks: [],
        isDefault: true
    }
];

const DEFAULT_GRAPHICS = [];


const DEFAULT_REVIEWS = [
    {
        id: 'rev_def_1',
        author: 'Michał',
        rating: 5,
        text: 'Kozak mix i master, wokal siedzi idealnie w bicie. Szybki kontakt i ekspresowa realizacja!',
        votesUp: 0,
        votesDown: 0,
        avatar: 'user1'
    },
    {
        id: 'rev_def_2',
        author: 'Karolina',
        rating: 5,
        text: 'Bannery i avatary wykonane z dbałością o każdy szczegół. Klimat techno oddany w stu procentach!',
        votesUp: 0,
        votesDown: 0,
        avatar: 'user2'
    },
    {
        id: 'rev_def_3',
        author: 'Adrian',
        rating: 5,
        text: 'Najlepszy mastering w tej cenie. Nielimitowane poprawki ratują życie, chociaż i tak pierwsza wersja była super.',
        votesUp: 0,
        votesDown: 0,
        avatar: 'user3'
    }
];

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('vertone_db_wiped_likes_v1') !== 'true') {
        localStorage.clear();
        indexedDB.deleteDatabase(DB_NAME);
        localStorage.setItem('vertone_db_wiped_likes_v1', 'true');
        window.location.reload();
        return;
    }

    // 1. Init Database
    await initDB();

    // Load user session
    loadUserSession();

    appState.globalVolume = parseFloat(localStorage.getItem('vertone_volume') || '0.8');
    appState.isMuted = localStorage.getItem('vertone_muted') === 'true';
    audio.volume = appState.isMuted ? 0 : appState.globalVolume;

    // Load data from DB and fallback to defaults
    await loadTracks();
    await loadGraphics();
    await loadReviews();

    // 2. Setup Listeners
    setupTabSwitching();
    setupPortfolioViews();
    setupGraphicsCategorySwitching();
    setupOwnerMode();
    setupModalEvents();
    setupAudioListeners();
    setupLightbox();

    // Setup Settings and Discord Login listeners
    setupSettingsModal();
    setupDiscordLogin();

    // Render initial views
    updateUserUI();
    renderTracks();
    renderGraphics();
    renderReviews();

    // Handle redirect hash login if coming from Discord OAuth
    handleDiscordHashLogin();
});

// --- LOAD DATA ---
async function loadTracks() {
    let dbTracks = await getAllFromDB('tracks');
    if (dbTracks.length === 0 && localStorage.getItem('vertone_tracks_initialized') !== 'true') {
        for (const track of DEFAULT_TRACKS) {
            await saveToDB('tracks', track);
        }
        localStorage.setItem('vertone_tracks_initialized', 'true');
        dbTracks = await getAllFromDB('tracks');
    }
    appState.tracks = dbTracks;
}

async function loadGraphics() {
    if (localStorage.getItem('vertone_graphics_cleared_v2') !== 'true') {
        try {
            const transaction = db.transaction(['graphics'], 'readwrite');
            const store = transaction.objectStore('graphics');
            await new Promise((resolve) => {
                const req = store.clear();
                req.onsuccess = resolve;
                req.onerror = resolve;
            });
            localStorage.setItem('vertone_graphics_cleared_v2', 'true');
        } catch (e) {
            console.error("Error clearing graphics store:", e);
        }
    }
    let dbGraphics = await getAllFromDB('graphics');
    if (dbGraphics.length === 0 && DEFAULT_GRAPHICS.length > 0) {
        for (const graph of DEFAULT_GRAPHICS) {
            await saveToDB('graphics', graph);
        }
        dbGraphics = await getAllFromDB('graphics');
    }
    appState.graphics = dbGraphics;
}

async function loadReviews() {
    let dbReviews = await getAllFromDB('reviews');
    if (dbReviews.length === 0 && localStorage.getItem('vertone_reviews_initialized') !== 'true') {
        for (const rev of DEFAULT_REVIEWS) {
            await saveToDB('reviews', rev);
        }
        localStorage.setItem('vertone_reviews_initialized', 'true');
        dbReviews = await getAllFromDB('reviews');
    }
    appState.reviews = dbReviews;
}

// --- TAB SWITCHING ---
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.sidebar-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');

            // Toggle buttons active class
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle content visibility
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === target) {
                    content.classList.add('active');
                }
            });

            appState.activeTab = target;

            // Stop audio when leaving portfolio if active
            if (target !== 'tab-portfolio' && appState.currentPlayingId) {
                pauseGlobalAudio();
            }

            // Reset portfolio view when entering
            if (target === 'tab-portfolio') {
                showPortfolioView('dashboard');
            }
        });
    });
}

// Portfolio detail view navigation
function setupPortfolioViews() {
    const btnEnterMusic = document.getElementById('btn-enter-music');
    const btnEnterGraphics = document.getElementById('btn-enter-graphics');
    const btnBackMusic = document.getElementById('btn-back-music-dashboard');
    const btnBackGraphics = document.getElementById('btn-back-graphics-dashboard');
    const btnBackGraphicsCats = document.getElementById('btn-back-graphics-categories');

    if (btnEnterMusic) {
        btnEnterMusic.addEventListener('click', () => {
            showPortfolioView('music');
        });
    }

    if (btnEnterGraphics) {
        btnEnterGraphics.addEventListener('click', () => {
            showPortfolioView('graphics-categories');
        });
    }

    if (btnBackMusic) {
        btnBackMusic.addEventListener('click', () => {
            showPortfolioView('dashboard');
        });
    }

    if (btnBackGraphics) {
        btnBackGraphics.addEventListener('click', () => {
            showPortfolioView('dashboard');
        });
    }

    if (btnBackGraphicsCats) {
        btnBackGraphicsCats.addEventListener('click', () => {
            showPortfolioView('graphics-categories');
        });
    }
}

function showPortfolioView(view) {
    const dashboard = document.getElementById('portfolio-dashboard');
    const musicView = document.getElementById('portfolio-music-view');
    const graphicsCatsView = document.getElementById('portfolio-graphics-categories-view');
    const graphicsListView = document.getElementById('portfolio-graphics-list-view');

    if (!dashboard || !musicView || !graphicsCatsView || !graphicsListView) return;

    dashboard.classList.add('hidden');
    musicView.classList.add('hidden');
    graphicsCatsView.classList.add('hidden');
    graphicsListView.classList.add('hidden');

    if (view === 'dashboard') {
        dashboard.classList.remove('hidden');
        if (appState.currentPlayingId) {
            pauseGlobalAudio();
        }
    } else if (view === 'music') {
        musicView.classList.remove('hidden');
    } else if (view === 'graphics-categories') {
        graphicsCatsView.classList.remove('hidden');
    } else if (view === 'graphics-list') {
        graphicsListView.classList.remove('hidden');
    }
}

function setupGraphicsCategorySwitching() {
    const catCards = document.querySelectorAll('.category-card-btn-tetris');
    catCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-category');
            appState.activeCategory = category;

            // Update Title
            const labels = {
                bannery: 'Bannery',
                avatory: 'Avatary',
                plakaty: 'Plakaty',
                panele: 'Panele',
                okladki: 'Okładki'
            };
            const titleEl = document.getElementById('graphics-list-category-title');
            if (titleEl) {
                titleEl.textContent = `Portfolio // Grafiki // ${labels[category] || category}`;
            }

            renderGraphics();
            showPortfolioView('graphics-list');
        });
    });
}

// --- RENDERING VIEWS ---

// 1. Render Tracks
function renderTracks() {
    console.log("DEBUG: renderTracks called. isOwner:", appState.isOwner);
    const container = document.getElementById('tracks-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (appState.tracks.length === 0) {
        container.innerHTML = '<p class="monospace" style="color:var(--color-text-dim); text-align:center;">Brak utworów w portfolio.</p>';
        return;
    }

    appState.tracks.forEach(track => {
        const hasVoted = getVoteStatus('track', track.id);
        const card = document.createElement('div');
        card.className = `track-player-card ${appState.currentPlayingId === track.id ? 'active-playing' : ''}`;
        card.setAttribute('data-id', track.id);

        let feedbackHTML = '';
        if (appState.isOwner) {
            const fbs = track.feedbacks || [];
            feedbackHTML = `
                <div class="graphic-reviews-report" style="background: rgba(58, 166, 255, 0.03); border-color: rgba(58, 166, 255, 0.08); margin-top: 10px;">
                    <span class="report-title-admin monospace" style="color: var(--color-blue-light)">Sugestie i opinie (${fbs.length}):</span>
                    ${fbs.length === 0 ? '<p style="font-size:11px; color:var(--color-text-dim)">Brak feedbacku od użytkowników.</p>' : ''}
                    <div style="max-height:100px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
                        ${fbs.map((fb, idx) => `
                            <div class="report-item" style="display:flex; justify-content:space-between; align-items:center;">
                                <span>• "${fb}"</span>
                                <button class="btn-delete-comment" data-id="${track.id}" data-index="${idx}" data-type="track" style="background:none; border:none; color:var(--color-danger); cursor:pointer; font-size:11px;">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="graphic-feedback-box" style="border-color: rgba(58, 166, 255, 0.04); margin-top: 10px;">
                    <span class="feedback-header-lbl">Zostaw feedback / opinię o tym utworze:</span>
                    <div class="feedback-input-row">
                        <textarea class="input-dark feedback-textarea" placeholder="Wpisz opinię..." data-id="${track.id}" style="border-radius: 6px;"></textarea>
                        <button class="btn btn-send-feedback btn-submit-track-feedback" data-id="${track.id}" style="background: rgba(58, 166, 255, 0.12); color: var(--color-blue-light); border-color: rgba(58, 166, 255, 0.25);">Wyślij</button>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="track-info">
                <span class="track-title monospace" title="${track.title}">${track.title}</span>
                ${appState.isOwner ? `<button class="btn-delete-track-absolute btn-delete-track" data-id="${track.id}" title="Usuń utwór">🗑️</button>` : ''}
            </div>
            <div class="track-controls-row">
                <button class="btn-play-pause btn-toggle-play" data-id="${track.id}">
                    ${appState.currentPlayingId === track.id && !audio.paused ? '⏸' : '▶'}
                </button>
                <div class="timeline-slider-wrapper">
                    <input type="range" class="range-slider seek-slider" data-id="${track.id}" min="0" max="100" value="0">
                    <span class="time-display time-label" data-id="${track.id}">0:00 / 0:00</span>
                </div>
                <div class="volume-control-wrapper">
                    <button class="btn-mute-toggle btn-mute" data-id="${track.id}">
                        ${appState.isMuted ? '🔇' : '🔊'}
                    </button>
                    <input type="range" class="range-slider volume-slider vol-bar" data-id="${track.id}" min="0" max="1" step="0.05" value="${appState.isMuted ? 0 : appState.globalVolume}">
                </div>
            </div>
            <div class="track-voting-row">
                <button class="btn-vote vote-up ${hasVoted === 'up' ? 'voted' : ''}" data-id="${track.id}">
                    👍 <span class="vote-count">${track.votesUp}</span>
                </button>
                <button class="btn-vote vote-down ${hasVoted === 'down' ? 'voted' : ''}" data-id="${track.id}">
                    👎 <span class="vote-count">${track.votesDown}</span>
                </button>
                <button class="btn-vote btn-feedback-toggle" data-id="${track.id}" data-type="track" title="${t('btn_feedback_tooltip') || 'Opinie i feedback'}">
                    💬 <span class="feedback-count">${(track.feedbacks || []).length}</span>
                </button>
                ${appState.isOwner ? `<button class="btn btn-secondary btn-small btn-reset-votes" data-id="${track.id}" data-type="track" title="${t('btn_reset_votes_tooltip') || 'Resetuj oceny'}" style="margin-left: auto; padding: 4px 8px; font-size:11px;">🔄 ${t('btn_reset') || 'Reset'}</button>` : ''}
            </div>
            <div class="feedback-toggle-container hidden" data-id="${track.id}">
                ${feedbackHTML}
            </div>
        `;

        container.appendChild(card);
    });

    // Add track delete listeners
    if (appState.isOwner) {
        document.querySelectorAll('.btn-delete-track').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                showCustomConfirm(t('confirm_delete_track') || "Czy na pewno chcesz usunąć ten utwór?", async () => {
                    if (appState.currentPlayingId === id) {
                        pauseGlobalAudio();
                    }
                    await deleteFromDB('tracks', id);
                    await loadTracks();
                    renderTracks();
                });
            });
        });
    }

    // Add play listeners
    document.querySelectorAll('.btn-toggle-play').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            handleTrackPlayToggle(id);
        });
    });

    // Add seek listeners
    document.querySelectorAll('.seek-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const id = slider.getAttribute('data-id');
            if (appState.currentPlayingId === id) {
                const pct = parseFloat(e.target.value);
                audio.currentTime = (pct / 100) * audio.duration;
            }
        });
    });

    // Add volume listeners
    document.querySelectorAll('.vol-bar').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            setVolume(vol);
        });
    });

    document.querySelectorAll('.btn-mute').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleMute();
        });
    });

    // Add voting listeners
    document.querySelectorAll('#tracks-list-container .vote-up').forEach(btn => {
        btn.addEventListener('click', () => handleVote('track', btn.getAttribute('data-id'), 'up'));
    });
    document.querySelectorAll('#tracks-list-container .vote-down').forEach(btn => {
        btn.addEventListener('click', () => handleVote('track', btn.getAttribute('data-id'), 'down'));
    });

    // Add track feedback submit
    document.querySelectorAll('.btn-submit-track-feedback').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const textarea = document.querySelector(`.feedback-textarea[data-id="${id}"]`);
            const val = textarea.value.trim();

            if (val.length < 3) {
                showCustomAlert(t('feedback_too_short') || "Wpisz przynajmniej 3 znaki feedbacku!");
                return;
            }

            const item = appState.tracks.find(t => t.id === id);
            if (item) {
                if (!item.feedbacks) item.feedbacks = [];
                item.feedbacks.push(val);
                await saveToDB('tracks', item);
                textarea.value = '';
                showCustomAlert(t('feedback_thanks') || "Dziękuję za Twój feedback! Został zapisany dla właściciela strony.");
                await loadTracks();
                renderTracks();
            }
        });
    });

    // Add comment delete click handlers
    document.querySelectorAll('.btn-delete-comment').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const index = parseInt(btn.getAttribute('data-index'));
            const type = btn.getAttribute('data-type');

            showCustomConfirm(t('confirm_delete_feedback') || "Czy na pewno chcesz usunąć ten feedback?", async () => {
                if (type === 'track') {
                    const item = appState.tracks.find(t => t.id === id);
                    if (item && item.feedbacks) {
                        item.feedbacks.splice(index, 1);
                        await saveToDB('tracks', item);
                        await loadTracks();
                        renderTracks();
                    }
                } else if (type === 'graphic') {
                    const item = appState.graphics.find(g => g.id === id);
                    if (item && item.feedbacks) {
                        item.feedbacks.splice(index, 1);
                        await saveToDB('graphics', item);
                        await loadGraphics();
                        renderGraphics();
                    }
                }
            });
        });
    });

    // Add reset votes click handlers
    document.querySelectorAll('.btn-reset-votes').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');

            showCustomConfirm(t('confirm_reset_votes') || "Czy na pewno chcesz wyczyścić głosy dla tego elementu?", async () => {
                if (type === 'track') {
                    const item = appState.tracks.find(t => t.id === id);
                    if (item) {
                        item.votesUp = 0;
                        item.votesDown = 0;
                        await saveToDB('tracks', item);
                        await loadTracks();
                        renderTracks();
                    }
                } else if (type === 'graphic') {
                    const item = appState.graphics.find(g => g.id === id);
                    if (item) {
                        item.votesUp = 0;
                        item.votesDown = 0;
                        await saveToDB('graphics', item);
                        await loadGraphics();
                        renderGraphics();
                    }
                }
            });
        });
    });

    // Add feedback toggle listeners
    document.querySelectorAll('#tracks-list-container .btn-feedback-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const container = document.querySelector(`.feedback-toggle-container[data-id="${id}"]`);
            if (container) {
                container.classList.toggle('hidden');
                btn.classList.toggle('active');
            }
        });
    });
}

// 2. Render Graphics
function renderGraphics() {
    const container = document.getElementById('graphics-items-list-container');
    if (!container) return;
    container.innerHTML = '';

    const filtered = appState.graphics.filter(g => g.category === appState.activeCategory);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="monospace" style="color:var(--color-text-dim); text-align:center; padding: 20px 0;">Brak prac w tej kategorii.</p>';
        return;
    }

    filtered.forEach(graph => {
        const hasVoted = getVoteStatus('graphic', graph.id);
        const card = document.createElement('div');
        card.className = `track-player-card ${appState.isOwner ? 'owner-card' : ''}`;
        card.setAttribute('data-id', graph.id);
        card.style.borderColor = 'rgba(168, 85, 247, 0.15)'; // purple border accent
        card.style.position = 'relative'; // relative positioning for absolute trash button

        let srcUrl = graph.url;
        if (graph.imageData) {
            const blob = new Blob([graph.imageData], { type: graph.fileType || 'image/png' });
            srcUrl = URL.createObjectURL(blob);
        } else if (graph.fileBlob) {
            srcUrl = URL.createObjectURL(graph.fileBlob);
        }

        let feedbackHTML = '';
        if (appState.isOwner) {
            const fbs = graph.feedbacks || [];
            feedbackHTML = `
                <div class="graphic-reviews-report" style="background: rgba(168, 85, 247, 0.03); border-color: rgba(168, 85, 247, 0.08); margin-top: 10px;">
                    <span class="report-title-admin monospace" style="color: var(--color-purple-light)">Sugestie i opinie (${fbs.length}):</span>
                    ${fbs.length === 0 ? '<p style="font-size:11px; color:var(--color-text-dim)">Brak feedbacku od użytkowników.</p>' : ''}
                    <div style="max-height:100px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
                        ${fbs.map((fb, idx) => `
                            <div class="report-item" style="display:flex; justify-content:space-between; align-items:center;">
                                <span>• "${fb}"</span>
                                <button class="btn-delete-comment" data-id="${graph.id}" data-index="${idx}" data-type="graphic" style="background:none; border:none; color:var(--color-danger); cursor:pointer; font-size:11px;">🗑️</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            feedbackHTML = `
                <div class="graphic-feedback-box" style="border-color: rgba(168, 85, 247, 0.04); margin-top: 10px;">
                    <span class="feedback-header-lbl">Zostaw feedback / opinię o tej pracy:</span>
                    <div class="feedback-input-row">
                        <textarea class="input-dark feedback-textarea" placeholder="Wpisz opinię..." data-id="${graph.id}" style="border-radius: 6px;"></textarea>
                        <button class="btn btn-send-feedback btn-submit-graphic-feedback" data-id="${graph.id}" style="background: rgba(168, 85, 247, 0.12); color: var(--color-purple-light); border-color: rgba(168, 85, 247, 0.25);">Wyślij</button>
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="track-info">
                <span class="track-title monospace" title="${graph.title}">${graph.title}</span>
                ${appState.isOwner ? `<button class="btn-delete-track-absolute btn-delete-graphic" data-id="${graph.id}" title="Usuń grafikę">🗑️</button>` : ''}
            </div>
            
            <div class="graphic-preview-box" data-url="${srcUrl}" data-title="${graph.title}" style="cursor: pointer; overflow: hidden; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); background: #000; display: flex; justify-content: center; align-items: center; margin: 10px 0;">
                <img src="${srcUrl}" alt="${graph.title}" style="max-height: 250px; width: 100%; object-fit: contain; transition: var(--transition);">
            </div>

            <div class="track-voting-row">
                <button class="btn-vote vote-up ${hasVoted === 'up' ? 'voted' : ''}" data-id="${graph.id}">
                    👍 <span class="vote-count">${graph.votesUp || 0}</span>
                </button>
                <button class="btn-vote vote-down ${hasVoted === 'down' ? 'voted' : ''}" data-id="${graph.id}">
                    👎 <span class="vote-count">${graph.votesDown || 0}</span>
                </button>
                <button class="btn-vote btn-feedback-toggle" data-id="${graph.id}" data-type="graphic" title="${t('btn_feedback_tooltip') || 'Opinie i feedback'}">
                    💬 <span class="feedback-count">${(graph.feedbacks || []).length}</span>
                </button>
                ${appState.isOwner ? `<button class="btn btn-secondary btn-small btn-reset-votes" data-id="${graph.id}" data-type="graphic" title="${t('btn_reset_votes_tooltip') || 'Resetuj oceny'}" style="margin-left: auto; padding: 4px 8px; font-size:11px;">🔄 ${t('btn_reset') || 'Reset'}</button>` : ''}
            </div>
            <div class="feedback-toggle-container hidden" data-id="${graph.id}">
                ${feedbackHTML}
            </div>
        `;

        container.appendChild(card);
    });

    // Lightbox triggers
    document.querySelectorAll('.graphic-preview-box').forEach(box => {
        box.addEventListener('click', () => {
            const url = box.getAttribute('data-url');
            const title = box.getAttribute('data-title');
            openLightbox(url, title);
        });
    });

    // Delete graphic listeners
    if (appState.isOwner) {
        document.querySelectorAll('.btn-delete-graphic').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                showCustomConfirm(t('confirm_delete_graphic') || "Czy na pewno chcesz usunąć tę grafikę?", async () => {
                    await deleteFromDB('graphics', id);
                    await loadGraphics();
                    renderGraphics();
                });
            });
        });

        // Reset votes listeners
        document.querySelectorAll('#graphics-items-list-container .btn-reset-votes').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                showCustomConfirm(t('confirm_reset_votes') || "Czy na pewno chcesz wyczyścić głosy dla tej grafiki?", async () => {
                    const item = appState.graphics.find(g => g.id === id);
                    if (item) {
                        item.votesUp = 0;
                        item.votesDown = 0;
                        await saveToDB('graphics', item);
                        await loadGraphics();
                        renderGraphics();
                    }
                });
            });
        });

        // Delete comment listeners
        document.querySelectorAll('#graphics-items-list-container .btn-delete-comment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const idx = parseInt(btn.getAttribute('data-index'));
                showCustomConfirm(t('confirm_delete_feedback') || "Czy na pewno chcesz usunąć ten feedback?", async () => {
                    const graph = appState.graphics.find(g => g.id === id);
                    if (graph && graph.feedbacks) {
                        graph.feedbacks.splice(idx, 1);
                        await saveToDB('graphics', graph);
                        await loadGraphics();
                        renderGraphics();
                    }
                });
            });
        });
    }

    // Feedback submit listeners
    document.querySelectorAll('.btn-submit-graphic-feedback').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const card = btn.closest('.track-player-card');
            const textarea = card.querySelector('.feedback-textarea');
            const val = textarea.value.trim();

            if (val.length < 3) {
                showCustomAlert(t('feedback_too_short') || "Wpisz przynajmniej 3 znaki feedbacku!");
                return;
            }

            const item = appState.graphics.find(g => g.id === id);
            if (item) {
                if (!item.feedbacks) item.feedbacks = [];
                item.feedbacks.push(val);
                await saveToDB('graphics', item);
                textarea.value = '';
                showCustomAlert(t('feedback_thanks') || "Dziękuję za Twój feedback! Został zapisany dla właściciela strony.");
                await loadGraphics();
                renderGraphics();
            }
        });
    });

    // Add feedback toggle listeners
    document.querySelectorAll('#graphics-items-list-container .btn-feedback-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const container = document.querySelector(`.feedback-toggle-container[data-id="${id}"]`);
            if (container) {
                container.classList.toggle('hidden');
                btn.classList.toggle('active');
            }
        });
    });

    // Voting listeners
    document.querySelectorAll('#graphics-items-list-container .vote-up').forEach(btn => {
        btn.addEventListener('click', () => handleVote('graphic', btn.getAttribute('data-id'), 'up'));
    });
    document.querySelectorAll('#graphics-items-list-container .vote-down').forEach(btn => {
        btn.addEventListener('click', () => handleVote('graphic', btn.getAttribute('data-id'), 'down'));
    });
}

// 3. Render Reviews
function renderReviews() {
    const container = document.getElementById('reviews-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (appState.reviews.length === 0) {
        container.innerHTML = '<p class="monospace" style="color:var(--color-text-dim); text-align:center;">Brak wystawionych opinii.</p>';
        return;
    }

    appState.reviews.forEach(rev => {
        const hasVoted = getVoteStatus('review', rev.id);
        const card = document.createElement('div');
        card.className = 'card glass review-card';

        const starsHTML = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);

        const avatarPresets = {
            user1: '👨‍💻',
            user2: '👩‍🎤',
            user3: '🎧',
            user4: '⚡'
        };
        const avatarEmoji = avatarPresets[rev.avatar] || '👤';

        // Check if there are before/after comparison files
        let audioHTML = '';
        if (rev.beforeAudioBlob || rev.afterAudioBlob) {
            audioHTML = `
                <div class="review-audio-comparison" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 8px;">
                    <span style="font-size: 11px; color: var(--color-text-muted); font-family: var(--font-mono);">Porównanie audio:</span>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${rev.beforeAudioBlob ? `
                            <button class="btn btn-secondary btn-small btn-play-review-audio" data-id="${rev.id}" data-type="before" style="font-size: 11px; padding: 6px 12px;">
                                ▶ Przed miksem
                            </button>
                        ` : ''}
                        ${rev.afterAudioBlob ? `
                            <button class="btn btn-primary btn-small btn-play-review-audio" data-id="${rev.id}" data-type="after" style="font-size: 11px; padding: 6px 12px; background: linear-gradient(135deg, var(--color-blue-dim) 0%, var(--color-blue-main) 100%);">
                                ▶ Po miksie
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        card.innerHTML = `
            ${appState.isOwner ? `<button class="btn-delete-review-absolute btn-delete-review" data-id="${rev.id}">🗑️</button>` : ''}
            <div class="review-header">
                <div class="review-avatar-circle">${avatarEmoji}</div>
                <div class="review-author-meta">
                    <h3>${rev.author}</h3>
                    <div class="review-rating-stars">${starsHTML}</div>
                </div>
            </div>
            <div class="review-text">"${rev.text}"</div>
            ${audioHTML}
            <div class="track-voting-row" style="border-top:none; padding-top:10px;">
                <button class="btn-vote vote-up ${hasVoted === 'up' ? 'voted' : ''}" data-id="${rev.id}">
                    👍 <span class="vote-count">${rev.votesUp || 0}</span>
                </button>
                <button class="btn-vote vote-down ${hasVoted === 'down' ? 'voted' : ''}" data-id="${rev.id}">
                    👎 <span class="vote-count">${rev.votesDown || 0}</span>
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Delete review listener
    if (appState.isOwner) {
        document.querySelectorAll('.btn-delete-review').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                showCustomConfirm(t('confirm_delete_review') || "Czy na pewno usunąć tę opinię?", async () => {
                    await deleteFromDB('reviews', id);
                    await loadReviews();
                    renderReviews();
                });
            });
        });
    }

    // Play review audio listeners
    document.querySelectorAll('.btn-play-review-audio').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const type = btn.getAttribute('data-type');
            handleReviewAudioPlayToggle(id, type);
        });
    });

    // Voting listeners
    document.querySelectorAll('#reviews-list-container .vote-up').forEach(btn => {
        btn.addEventListener('click', () => handleVote('review', btn.getAttribute('data-id'), 'up'));
    });
    document.querySelectorAll('#reviews-list-container .vote-down').forEach(btn => {
        btn.addEventListener('click', () => handleVote('review', btn.getAttribute('data-id'), 'down'));
    });
}

// Review Audio Players handler
function handleReviewAudioPlayToggle(id, type) {
    const review = appState.reviews.find(r => r.id === id);
    if (!review) return;

    const playId = `${id}_${type}`;
    const data = type === 'before' ? review.beforeAudioData : review.afterAudioData;
    const mimeType = type === 'before' ? review.beforeFileType : review.afterFileType;
    const legacyBlob = type === 'before' ? review.beforeAudioBlob : review.afterAudioBlob;

    if (appState.currentPlayingId === playId) {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
        updateReviewAudioUI();
    } else {
        pauseGlobalAudio();
        appState.currentPlayingId = playId;

        if (data) {
            const blob = new Blob([data], { type: mimeType || 'audio/mpeg' });
            audio.src = URL.createObjectURL(blob);
        } else if (legacyBlob) {
            audio.src = URL.createObjectURL(legacyBlob);
        } else {
            return;
        }

        audio.load();
        audio.play().catch(e => console.error("Playback failed:", e));
        updateReviewAudioUI();
    }
}

function updateReviewAudioUI() {
    document.querySelectorAll('.btn-play-review-audio').forEach(btn => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        const playId = `${id}_${type}`;

        if (appState.currentPlayingId === playId && !audio.paused) {
            btn.textContent = `⏸ ${type === 'before' ? 'Przed' : 'Po'} miksie`;
        } else {
            btn.textContent = `▶ ${type === 'before' ? 'Przed' : 'Po'} miksie`;
        }
    });
}

// --- CUSTOM AUDIO PLAYER LOGIC ---
function handleTrackPlayToggle(id) {
    const track = appState.tracks.find(t => t.id === id);
    if (!track) return;

    if (appState.currentPlayingId === id) {
        // Toggle play/pause
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
        updatePlayerUI();
    } else {
        // Play different track
        pauseGlobalAudio();

        appState.currentPlayingId = id;

        if (track.audioData) {
            // Load file arraybuffer as blob
            const blob = new Blob([track.audioData], { type: track.fileType || 'audio/mpeg' });
            audio.src = URL.createObjectURL(blob);
        } else if (track.fileBlob) {
            // Load file blob (legacy)
            audio.src = URL.createObjectURL(track.fileBlob);
        } else if (track.url) {
            // Load preset URL
            audio.src = track.url;
        }

        audio.load();
        audio.play().catch(e => console.error("Audio playback blocked or failed:", e));

        // Reset all seek bars, update active player
        updatePlayerUI();
    }
}

function pauseGlobalAudio() {
    audio.pause();
    appState.currentPlayingId = null;
    updatePlayerUI();
}

function updatePlayerUI() {
    document.querySelectorAll('.track-player-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const playBtn = card.querySelector('.btn-toggle-play');
        const slider = card.querySelector('.seek-slider');
        const timeLbl = card.querySelector('.time-label');

        if (id === appState.currentPlayingId) {
            card.classList.add('active-playing');
            if (playBtn) playBtn.textContent = audio.paused ? '▶' : '⏸';
        } else {
            card.classList.remove('active-playing');
            if (playBtn) playBtn.textContent = '▶';
            if (slider) slider.value = 0;
            if (timeLbl) timeLbl.textContent = '0:00 / 0:00';
        }
    });

    // Also sync review audio buttons
    updateReviewAudioUI();
}

function setupAudioListeners() {
    // Time update events
    audio.addEventListener('timeupdate', () => {
        if (!appState.currentPlayingId) return;
        const cur = audio.currentTime;
        const dur = audio.duration || 0;
        const activeSlider = document.querySelector(`.seek-slider[data-id="${appState.currentPlayingId}"]`);
        const activeTimeLbl = document.querySelector(`.time-label[data-id="${appState.currentPlayingId}"]`);

        if (activeSlider && dur > 0) {
            activeSlider.value = (cur / dur) * 100;
        }

        if (activeTimeLbl) {
            activeTimeLbl.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        }
    });

    // Duration change events
    audio.addEventListener('durationchange', () => {
        if (!appState.currentPlayingId) return;
        const dur = audio.duration || 0;
        const activeTimeLbl = document.querySelector(`.time-label[data-id="${appState.currentPlayingId}"]`);
        if (activeTimeLbl) {
            activeTimeLbl.textContent = `0:00 / ${formatTime(dur)}`;
        }
    });

    // Track ended
    audio.addEventListener('ended', () => {
        pauseGlobalAudio();
    });
}

function formatTime(secs) {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function setVolume(vol) {
    appState.globalVolume = vol;
    audio.volume = appState.isMuted ? 0 : vol;
    localStorage.setItem('vertone_volume', vol.toString());

    // Sync all volume inputs
    document.querySelectorAll('.vol-bar').forEach(bar => {
        bar.value = vol;
    });
}

function toggleMute() {
    appState.isMuted = !appState.isMuted;
    audio.volume = appState.isMuted ? 0 : appState.globalVolume;
    localStorage.setItem('vertone_muted', appState.isMuted.toString());

    document.querySelectorAll('.btn-mute').forEach(btn => {
        btn.textContent = appState.isMuted ? '🔇' : '🔊';
    });

    document.querySelectorAll('.vol-bar').forEach(bar => {
        bar.value = appState.isMuted ? 0 : appState.globalVolume;
    });
}

// --- VOTING SYSTEM (LocalStorage protection) ---
function getVoteStatus(type, id) {
    const key = `vertone_voted_${type}_${id}`;
    return localStorage.getItem(key); // returns 'up', 'down' or null
}

async function handleVote(type, id, voteType) {
    const storageKey = `vertone_voted_${type}_${id}`;
    const previousVote = localStorage.getItem(storageKey);

    let deltaUp = 0;
    let deltaDown = 0;

    if (previousVote === voteType) {
        // Toggle off the same vote
        localStorage.removeItem(storageKey);
        if (voteType === 'up') deltaUp = -1;
        else deltaDown = -1;
    } else {
        // Remove previous vote if any
        if (previousVote === 'up') deltaUp = -1;
        if (previousVote === 'down') deltaDown = -1;

        // Add new vote
        localStorage.setItem(storageKey, voteType);
        if (voteType === 'up') deltaUp = 1;
        else deltaDown = 1;
    }

    // Apply changes locally & save to storage
    if (type === 'track') {
        const item = appState.tracks.find(t => t.id === id);
        if (item) {
            item.votesUp = Math.max(0, (item.votesUp || 0) + deltaUp);
            item.votesDown = Math.max(0, (item.votesDown || 0) + deltaDown);
            await saveToDB('tracks', item);
            renderTracks();
        }
    } else if (type === 'graphic') {
        const item = appState.graphics.find(g => g.id === id);
        if (item) {
            item.votesUp = Math.max(0, (item.votesUp || 0) + deltaUp);
            item.votesDown = Math.max(0, (item.votesDown || 0) + deltaDown);
            await saveToDB('graphics', item);
            renderGraphics();
        }
    } else if (type === 'review') {
        const item = appState.reviews.find(r => r.id === id);
        if (item) {
            item.votesUp = Math.max(0, (item.votesUp || 0) + deltaUp);
            item.votesDown = Math.max(0, (item.votesDown || 0) + deltaDown);
            localStorage.setItem('vertone_reviews', JSON.stringify(appState.reviews));
            renderReviews();
        }
    }
}

// --- OWNER MODE AUTH & DISCORD SESSION ENGINE ---
function setupOwnerMode() {
    // Owner mode setup integrated with Discord Login
}

function loadUserSession() {
    const savedUser = localStorage.getItem('vertone_session_user');
    if (savedUser) {
        try {
            appState.user = JSON.parse(savedUser);
            appState.isOwner = checkUserIsOwner(appState.user);
        } catch (e) {
            localStorage.removeItem('vertone_session_user');
        }
    } else {
        appState.user = null;
        appState.isOwner = false;
    }
}

function checkUserIsOwner(user) {
    if (!user) return false;
    const uName = user.username ? user.username.toLowerCase() : '';
    return uName === 'the_vertis' || uName === 'vertis' || OWNER_DISCORD_IDS.includes(user.id);
}

function updateUserUI() {
    console.log("DEBUG: updateUserUI called. isOwner:", appState.isOwner, "user:", appState.user);
    const btnLogin = document.getElementById('btn-discord-login');
    const menuProfile = document.getElementById('user-profile-menu');
    const imgAvatar = document.getElementById('user-avatar-img');
    const emojiAvatar = document.getElementById('user-avatar-emoji');
    const txtUsername = document.getElementById('user-name');

    const musicAdminActions = document.getElementById('music-admin-actions');
    const graphicsAdminActions = document.getElementById('graphics-admin-actions');

    if (appState.user && appState.isOwner) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (menuProfile) {
            menuProfile.style.display = 'flex';
            menuProfile.classList.remove('hidden');
        }

        if (appState.user.avatar) {
            if (imgAvatar) {
                imgAvatar.src = appState.user.avatar;
                imgAvatar.style.display = 'block';
                imgAvatar.onerror = () => {
                    imgAvatar.style.display = 'none';
                    if (emojiAvatar) emojiAvatar.style.display = 'block';
                };
            }
            if (emojiAvatar) emojiAvatar.style.display = 'none';
        } else {
            if (imgAvatar) imgAvatar.style.display = 'none';
            if (emojiAvatar) emojiAvatar.style.display = 'block';
        }

        if (txtUsername) txtUsername.textContent = appState.user.username;
    } else {
        if (btnLogin) btnLogin.style.display = 'flex';
        if (menuProfile) {
            menuProfile.style.display = 'none';
            menuProfile.classList.add('hidden');
        }
    }

    const graphicsCatAdminActions = document.getElementById('graphics-categories-admin-actions');

    // Toggle owner-mode specific elements
    if (appState.isOwner) {
        if (musicAdminActions) musicAdminActions.classList.remove('hidden');
        if (graphicsAdminActions) graphicsAdminActions.classList.remove('hidden');
        if (graphicsCatAdminActions) graphicsCatAdminActions.classList.remove('hidden');
    } else {
        if (musicAdminActions) musicAdminActions.classList.add('hidden');
        if (graphicsAdminActions) graphicsAdminActions.classList.add('hidden');
        if (graphicsCatAdminActions) graphicsCatAdminActions.classList.add('hidden');
    }

    // Re-render views so owner features update dynamically
    renderTracks();
    renderGraphics();
    renderReviews();
}

// Settings Modal Setup
function setupSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsLangSelect = document.getElementById('settings-lang-select');
    const settingsThemeSelect = document.getElementById('settings-theme-select');

    if (btnOpenSettings && settingsModal) {
        btnOpenSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsModal.classList.add('active');
        });
    }

    if (btnCloseSettings && settingsModal) {
        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        });
    }

    // Tabs switching
    const tabBtns = settingsModal.querySelectorAll('.settings-tab-btn');
    const tabPanes = settingsModal.querySelectorAll('.settings-tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-settings-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `settings-pane-${targetTab}`) {
                    pane.classList.add('active');
                }
            });
        });
    });

    if (settingsLangSelect) {
        // Load initial language selection
        const savedLang = localStorage.getItem('vertone_lang') || 'pl';
        settingsLangSelect.value = savedLang;
        applyLanguage(savedLang);

        settingsLangSelect.addEventListener('change', (e) => {
            const lang = e.target.value;
            localStorage.setItem('vertone_lang', lang);
            applyLanguage(lang);
        });
    }

    if (settingsThemeSelect) {
        // Load initial theme selection
        const savedTheme = localStorage.getItem('vertone_theme') || 'dark';
        settingsThemeSelect.value = savedTheme;
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        settingsThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('vertone_theme', theme);
            if (theme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        });
    }
}

// Translation Engine Dictionary & Function
const translations = {
    pl: {
        settings_general: "Ogólne",
        settings_audio: "Audio (Wkrótce)",
        settings_title: "Ustawienia ogólne",
        settings_select_lang: "Wybierz język strony",
        settings_theme: "Wybierz motyw strony",
        settings_theme_dark: "Ciemny",
        settings_theme_light: "Jasny",
        confirm_title: "Potwierdzenie",
        alert_title: "Powiadomienie",
        btn_cancel: "Anuluj",
        btn_yes: "Tak",
        btn_login: "Zaloguj",
        btn_logout: "Wyloguj się",
        btn_check: "Sprawdź",
        btn_back: "Wróć",
        btn_reset: "Reset",
        btn_add_track: "➕ Dodaj Nowy Utwór",
        btn_add_work: "➕ Dodaj Nową Pracę",
        btn_write_review: "✍️ Wystaw opinię",
        btn_feedback_tooltip: "Opinie i feedback",
        btn_reset_votes_tooltip: "Resetuj oceny",
        confirm_delete_track: "Czy na pewno chcesz usunąć ten utwór?",
        confirm_delete_graphic: "Czy na pewno chcesz usunąć tę grafikę?",
        confirm_delete_review: "Czy na pewno usunąć tę opinię?",
        confirm_delete_feedback: "Czy na pewno chcesz usunąć ten feedback?",
        confirm_reset_votes: "Czy na pewno chcesz wyczyścić głosy dla tego elementu?",
        feedback_too_short: "Wpisz przynajmniej 3 znaki feedbacku!",
        feedback_thanks: "Dziękuję za Twój feedback! Został zapisany dla właściciela strony.",
        review_fields_required: "Wypełnij wszystkie pola!",
        review_author_required: "Wpisz swoje imię!",
        review_text_required: "Wpisz treść opinii!",
        tab_courses: "Kursy",
        tab_portfolio: "Portfolio",
        tab_reviews: "Opinie",
        tab_services: "Usługi",
        tab_socials: "Sociale",
        tab_faq: "FAQ",
        tab_privacy: "Polityka prywatności<br>i regulamin",
        courses_title: "Kursy i E-booki",
        courses_subtitle: "Dowiedz się wielu nowych rzeczy w muzyce i nie tylko dzięki naszym e-bookom!",
        course_1_title: "Pełny kurs Mixu i masteru",
        course_1_learn: "Z tego kursu dowiesz się:",
        course_2_title: "Pełny kurs akustyki",
        course_2_learn: "Z tego kursu dowiesz się:",
        soon: "Wkrótce",
        port_music_title: "Muzyka",
        port_music_desc: "Możesz przesłuchać zmixowanych przeze mnie utworów i ocenić numer za pomocą łapki w górę lub w dół",
        port_graphics_title: "Grafiki",
        port_graphics_desc: "Sprawdź stworzone przeze mnie bannery, avatary, okładki, plakaty, panele itp.",
        port_music_crumb: "Portfolio // Muzyka",
        cat_banners: "Bannery",
        cat_banners_desc: "Unikalne, klimatyczne bannery na Twoje sociale",
        cat_avatars: "Avatary",
        cat_avatars_desc: "Modernistyczne avatary dopasowane do Twojego wizerunku",
        cat_posters: "Plakaty",
        cat_posters_desc: "Kreatywne i przejrzyste projekty plakatów",
        cat_panels: "Panele",
        cat_panels_desc: "Schludne panele na Twój kanał streamingowy",
        cat_covers: "Okładki",
        cat_covers_desc: "Profesjonalne okładki na single, playlisty lub albumy",
        rev_title: "Opinie Klientów",
        rev_subtitle: "Przeczytaj opinie ludzi, z którymi miałem przyjemność współpracować.",
        serv_title: "Moje Usługi",
        serv_subtitle: "Zamów profesjonalną usługę muzyczną lub graficzną dopasowaną do Twoich potrzeb.",
        serv_mix_pitch: "Szukasz unikatowego, dobrze brzmiącego mixu i głośnego masteru? Zamów go już teraz!",
        serv_price_lbl: "Podstawowa cena usługi:",
        serv_offer_lbl: "Co oferuję:",
        serv_info_lbl: "Dodatkowe info:",
        serv_req_lbl: "Czego wymagam:",
        serv_attention_title: "Uwaga!",
        serv_attention_desc: "W przypadku słabej jakości nagrania mam prawo odmówić ci usługi. Zależy mi na twoim zadowoleniu, a sam mix nie uratuje słabego nagrania.",
        serv_mix_footer: "Jeśli chcesz przesłuchać zmixowane przeze mnie utwory, wejdź w zakładkę portfolio. Jeżeli zaś zdecydowałeś/aś się na zakup usługi to kliknij w przycisk poniżej.",
        btn_order_mix: "Zamów mix & master",
        serv_graph_pitch: "Szukasz ładnej, przejrzystej, kreatywnej oraz unikalnej grafiki? Zrobię!",
        serv_prices_lbl: "Ceny:",
        btn_order_graph: "Zamów grafikę",
        faq_title: "Odpowiedzi na twoje pytania",
        faq_subtitle: "Wszystko co musisz wiedzieć o aplikacji Vertone oraz o nas.",
        faq_q1: "Czym jest Vertone?",
        faq_a1: "Vertone to strona internetowa założona przez osobę o nicku Vertis, która pasjonuje się tworzeniem muzyki od ponad 3 lat. Strona to tak naprawdę sklep połączony z portfolio. Nazwa Vertone wzięła się z połączenia nicku \"Vertis\" i muzycznego \"Tone\".",
        faq_q2: "Kiedy powstała ta strona?",
        faq_a2: "Oficjalne prace nad aplikacją zaczęły się dokładnie 11.07.2026 roku.",
        faq_q3: "Co ma na celu?",
        faq_a3: "Vertis tworząc tę stronę miał na celu wesprzeć i pomóc osobom, które dopiero zaczynają z muzyką. Tak naprawdę pół za darmo, a pół za pieniądze. Gdy kupisz mix to zrobię streama na youtube z tego jak mixuje, a ty możesz na nim nauczyć się wielu nowych rzeczy, ponieważ tłumaczę wszystko co robię i dlaczego. Lub możesz kupić kurs mixu i samemu nauczyć się podstaw, aby później podziałać w praktyce z tym czego się nauczyłeś.",
        faq_social_lbl: "Social Media Właściciela",
        faq_social_sub: "Sprawdź moje oficjalne profile i bądźmy w kontakcie.",
        priv_title: "Polityka prywatności i regulamin",
        priv_subtitle: "Zasady korzystania z serwisu oraz ochrona praw autorskich.",
        priv_sec_title: "Prawa autorskie",
        priv_copyright_info: "© [Vertone ze współpracą z zespołem ReTrap music / Oscar \"Vertis\" Legutko] [12.07.2026]. Wszelkie prawa zastrzeżone.",
        priv_body1: "Witryna internetowa oraz aplikacja internetowa, w tym ich kod źródłowy, projekt graficzny, interfejs użytkownika, funkcjonalności, treści, bazy danych i pozostałe elementy, stanowią przedmiot ochrony prawnej na podstawie przepisów o prawie autorskim.",
        priv_body2: "Kopiowanie, modyfikowanie, rozpowszechnianie, dekompilacja lub wykorzystywanie całości bądź części serwisu i aplikacji bez uprzedniej pisemnej zgody właściciela praw jest zabronione.",
        c1_b1: "Czym tak naprawdę jest Mix/mastering i z czego sie składa",
        c1_b2: "Jakie są rodzaje wtyczek",
        c1_b3: "Jakie są rodzaje kompresorów",
        c1_b4: "Jak działają wtyczki m.in:",
        c1_b5: "EQ",
        c1_b6: "Kompresory",
        c1_b7: "Saturatory/Distortion",
        c1_b8: "Pogłosy",
        c1_b9: "Delay'e",
        c1_b10: "De-essery",
        c1_b11: "Limitery/Bramki szumów",
        c1_b12: "Jaki DAW najlepiej wybrać pod twoje preferencje",
        c1_b13: "Jak dobrze nagrać wokal w domowych warunkach",
        c1_b14: "Czym jest gain staging i jak go zrobić oraz jak zrobić leveling",
        c1_b15: "Jak używać autotune i jak nastroić wokal",
        c1_b16: "Routing & Side chainy - co to i jak zrobić",
        c1_b17: "Zakresy częstotliwości, tonacje",
        c1_b18: "Jak działają pokrętła na wtyczkach oraz opcje + filmy z tym związane",
        c2_b1: "Czym jest akustyka w pomieszczeniu",
        c2_b2: "Jak dobrać akustykę do swojego pomieszczenia",
        c2_b3: "Jak rozmieścić panele, bass-trapy itp. w swoim studio",
        c2_b4: "DIY budżetowa akustyka",
        c2_b5: "Czego unikać i na co uważać podczas planowania i tworzenia studia"
    },
    en: {
        settings_general: "General",
        settings_audio: "Audio (Soon)",
        settings_title: "General Settings",
        settings_select_lang: "Choose page language",
        settings_theme: "Choose page theme",
        settings_theme_dark: "Dark",
        settings_theme_light: "Light",
        confirm_title: "Confirmation",
        alert_title: "Notification",
        btn_cancel: "Cancel",
        btn_yes: "Yes",
        btn_login: "Login",
        btn_logout: "Logout",
        btn_check: "Check",
        btn_back: "Back",
        btn_reset: "Reset",
        btn_add_track: "➕ Add New Track",
        btn_add_work: "➕ Add New Work",
        btn_write_review: "✍️ Write a Review",
        btn_feedback_tooltip: "Reviews & feedback",
        btn_reset_votes_tooltip: "Reset votes",
        confirm_delete_track: "Are you sure you want to delete this track?",
        confirm_delete_graphic: "Are you sure you want to delete this graphic?",
        confirm_delete_review: "Are you sure you want to delete this review?",
        confirm_delete_feedback: "Are you sure you want to delete this feedback?",
        confirm_reset_votes: "Are you sure you want to reset votes for this item?",
        feedback_too_short: "Enter at least 3 characters of feedback!",
        feedback_thanks: "Thank you for your feedback! It has been saved for the page owner.",
        review_fields_required: "Please fill in all fields!",
        review_author_required: "Please enter your name!",
        review_text_required: "Please enter review content!",
        tab_courses: "Courses",
        tab_portfolio: "Portfolio",
        tab_reviews: "Reviews",
        tab_services: "Services",
        tab_socials: "Socials",
        tab_faq: "FAQ",
        tab_privacy: "Privacy Policy<br>& Terms",
        courses_title: "Courses & E-books",
        courses_subtitle: "Learn many new things in music and more thanks to our e-books!",
        course_1_title: "Full Mix & Master Course",
        course_1_learn: "From this course you will learn:",
        course_2_title: "Full Acoustics Course",
        course_2_learn: "From this course you will learn:",
        soon: "Soon",
        port_music_title: "Music",
        port_music_desc: "You can listen to my mixed tracks and rate them using thumbs up or down",
        port_graphics_title: "Graphics",
        port_graphics_desc: "Check out my banners, avatars, covers, posters, panels, etc.",
        port_music_crumb: "Portfolio // Music",
        cat_banners: "Banners",
        cat_banners_desc: "Unique, atmospheric banners for your socials",
        cat_avatars: "Avatars",
        cat_avatars_desc: "Modernist avatars tailored to your image",
        cat_posters: "Posters",
        cat_posters_desc: "Creative and clean poster designs",
        cat_panels: "Panels",
        cat_panels_desc: "Neat panels for your streaming channel",
        cat_covers: "Covers",
        cat_covers_desc: "Professional covers for singles, playlists or albums",
        rev_title: "Client Reviews",
        rev_subtitle: "Read reviews from people I have had the pleasure of working with.",
        serv_title: "My Services",
        serv_subtitle: "Order a professional music or graphic service tailored to your needs.",
        serv_mix_pitch: "Looking for a unique, great-sounding mix and loud master? Order it now!",
        serv_price_lbl: "Base price of the service:",
        serv_offer_lbl: "What I offer:",
        serv_info_lbl: "Additional info:",
        serv_req_lbl: "What I require:",
        serv_attention_title: "Attention!",
        serv_attention_desc: "In case of poor recording quality, I reserve the right to refuse service. I care about your satisfaction, and the mix alone won't save a bad recording.",
        serv_mix_footer: "If you want to listen to my mixed tracks, go to the portfolio tab. If you have decided to purchase the service, click the button below.",
        btn_order_mix: "Order mix & master",
        serv_graph_pitch: "Looking for a clean, transparent, creative and unique graphic? I will make it!",
        serv_prices_lbl: "Prices:",
        btn_order_graph: "Order graphics",
        faq_title: "Answers to your questions",
        faq_subtitle: "Everything you need to know about the Vertone app and us.",
        faq_q1: "What is Vertone?",
        faq_a1: "Vertone is a website founded by a person nicknamed Vertis, who has been passionate about music creation for over 3 years. The site is actually a shop combined with a portfolio. The name Vertone comes from the combination of the nickname \"Vertis\" and the musical \"Tone\".",
        faq_q2: "When was this site created?",
        faq_a2: "Official work on the application started on 11.07.2026.",
        faq_q3: "What is its purpose?",
        faq_a3: "Vertis created this site with the aim to support and help people who are just starting out with music. Basically half for free and half for money. When you buy a mix I will do a YouTube stream of me mixing, and you can learn many new things on it because I explain everything I do and why. Or you can buy a mix course and learn the basics yourself, to later practice what you have learned.",
        faq_social_lbl: "Owner's Social Media",
        faq_social_sub: "Check out my official profiles and let's stay in touch.",
        priv_title: "Privacy Policy and Terms",
        priv_subtitle: "Terms of service and copyright protection.",
        priv_sec_title: "Copyright",
        priv_copyright_info: "© [Vertone in cooperation with the ReTrap music team / Oscar \"Vertis\" Legutko] [12.07.2026]. All rights reserved.",
        priv_body1: "The website and the web application, including their source code, graphic design, user interface, functionalities, content, databases and other elements, are subject to legal protection under copyright law.",
        priv_body2: "Copying, modifying, distributing, decompiling or using all or part of the service and application without the prior written consent of the copyright owner is prohibited.",
        c1_b1: "What Mix/mastering actually is and what it consists of",
        c1_b2: "What types of plugins exist",
        c1_b3: "What types of compressors exist",
        c1_b4: "How plugins work, including:",
        c1_b5: "EQ",
        c1_b6: "Compressors",
        c1_b7: "Saturators/Distortion",
        c1_b8: "Reverbs",
        c1_b9: "Delays",
        c1_b10: "De-essers",
        c1_b11: "Limiters/Noise Gates",
        c1_b12: "Which DAW is best to choose for your preferences",
        c1_b13: "How to record vocals well at home",
        c1_b14: "What is gain staging, how to do it and how to level",
        c1_b15: "How to use autotune and tune vocals",
        c1_b16: "Routing & Side chains - what it is and how to do it",
        c1_b17: "Frequency ranges, keys",
        c1_b18: "How the knobs and options on plugins work + related videos",
        c2_b1: "What room acoustics is",
        c2_b2: "How to choose acoustics for your room",
        c2_b3: "How to place panels, bass traps, etc. in your studio",
        c2_b4: "DIY budget acoustics",
        c2_b5: "What to avoid and watch out for when planning and creating a studio"
    },
    fr: {
        settings_general: "Général",
        settings_audio: "Audio (Bientôt)",
        settings_title: "Paramètres Généraux",
        settings_select_lang: "Choisir la langue de la page",
        settings_theme: "Choisir le thème de la page",
        settings_theme_dark: "Sombre",
        settings_theme_light: "Clair",
        confirm_title: "Confirmation",
        alert_title: "Notification",
        btn_cancel: "Annuler",
        btn_yes: "Oui",
        btn_login: "Se connecter",
        btn_logout: "Se déconnecter",
        btn_check: "Découvrir",
        btn_back: "Retour",
        btn_reset: "Réinitialiser",
        btn_add_track: "➕ Ajouter un morceau",
        btn_add_work: "➕ Ajouter un travail",
        btn_write_review: "✍️ Laisser un avis",
        btn_feedback_tooltip: "Avis et retours",
        btn_reset_votes_tooltip: "Réinitialiser les votes",
        confirm_delete_track: "Êtes-vous sûr de vouloir supprimer ce morceau ?",
        confirm_delete_graphic: "Êtes-vous sûr de vouloir supprimer ce graphique ?",
        confirm_delete_review: "Êtes-vous sûr de vouloir supprimer cet avis ?",
        confirm_delete_feedback: "Êtes-vous sûr de vouloir supprimer ce retour ?",
        confirm_reset_votes: "Êtes-vous sûr de vouloir réinitialiser les votes pour cet élément ?",
        feedback_too_short: "Saisissez au moins 3 caractères de retour !",
        feedback_thanks: "Merci pour votre retour ! Il a été enregistré pour le propriétaire du site.",
        review_fields_required: "Veuillez remplir tous les champs !",
        review_author_required: "Veuillez saisir votre nom !",
        review_text_required: "Veuillez saisir le contenu de l'avis !",
        tab_courses: "Cours",
        tab_portfolio: "Portfolio",
        tab_reviews: "Avis",
        tab_services: "Services",
        tab_socials: "Réseaux",
        tab_faq: "FAQ",
        tab_privacy: "Charte de confidentialité<br>& CGU",
        courses_title: "Cours & E-books",
        courses_subtitle: "Apprenez beaucoup de nouvelles choses en musique et plus encore grâce à nos e-books !",
        course_1_title: "Cours complet de Mixage & Mastering",
        course_1_learn: "Dans ce cours, vous profiterez de :",
        course_2_title: "Cours complet d'acoustique",
        course_2_learn: "Dans ce cours, vous apprendrez :",
        soon: "Bientôt",
        port_music_title: "Musique",
        port_music_desc: "Vous pouvez écouter mes morceaux mixés et les évaluer à l'aide de pouces vers le haut ou vers le bas",
        port_graphics_title: "Graphiques",
        port_graphics_desc: "Découvrez mes bannières, avatars, couvertures, affiches, panels, etc.",
        port_music_crumb: "Portfolio // Musique",
        cat_banners: "Bannières",
        cat_banners_desc: "Bannières uniques et atmosphériques pour vos réseaux sociaux",
        cat_avatars: "Avatars",
        cat_avatars_desc: "Avatars modernistes adaptés à votre image",
        cat_posters: "Affiches",
        cat_posters_desc: "Designs d'affiches créatifs et épurés",
        cat_panels: "Panels",
        cat_panels_desc: "Panels soignés pour votre chaîne de streaming",
        cat_covers: "Couvertures",
        cat_covers_desc: "Couvertures professionnelles pour singles, playlists ou albums",
        rev_title: "Avis des clients",
        rev_subtitle: "Lisez les avis des personnes avec qui j'ai eu le plaisir de travailler.",
        serv_title: "Mes Services",
        serv_subtitle: "Commandez un service musical ou graphique professionnel adapté à vos besoins.",
        serv_mix_pitch: "Vous recherchez un mix unique avec un bon son et un master puissant ? Commandez-le maintenant !",
        serv_price_lbl: "Prix de base du service :",
        serv_offer_lbl: "Ce que je propose :",
        serv_info_lbl: "Infos supplémentaires :",
        serv_req_lbl: "Ce que j'exige :",
        serv_attention_title: "Attention !",
        serv_attention_desc: "En cas de mauvaise qualité d'enregistrement, je me réserve le droit de refuser le service. Votre satisfaction m'importe, et le mix seul ne sauvera pas un mauvais enregistrement.",
        serv_mix_footer: "Si vous souhaitez écouter mes morceaux mixés, allez dans l'onglet portfolio. Si vous avez décidé d'acheter le service, cliquez sur le bouton ci-dessous.",
        btn_order_mix: "Commander mix & master",
        serv_graph_pitch: "Vous cherchez un graphique propre, transparent, créatif et unique ? Je le ferai !",
        serv_prices_lbl: "Prix :",
        btn_order_graph: "Commander un graphique",
        faq_title: "Réponses à vos questions",
        faq_subtitle: "Tout ce que vous devez savoir sur l'application Vertone et sur nous.",
        faq_q1: "Qu'est-ce que Vertone ?",
        faq_a1: "Vertone est un site web fondé par une personne surnommée Vertis, passionnée par la création musicale depuis plus de 3 ans. Le site est en fait une boutique combinée avec un portfolio. Le nom Vertone vient de l'alliance du pseudo \"Vertis\" et du terme musical \"Tone\".",
        faq_q2: "Quand ce site a-t-il été créé ?",
        faq_a2: "Les travaux officiels sur l'application ont débuté le 11/07/2026.",
        faq_q3: "Quel est son but ?",
        faq_a3: "Vertis a créé ce site dans le but de soutenir et d'aider les personnes qui débutent dans la musique. En gros, à moitié gratuit et à moitié payant. Lorsque vous achetez un mix, je ferai un stream YouTube de mon mixage, et vous pourrez y apprendre beaucoup de nouvelles choses car j'explique tout ce que je fais et pourquoi. Ou vous pouvez acheter un cours de mixage et apprendre les bases vous-même, pour pratiquer plus tard ce que vous avez appris.",
        faq_social_lbl: "Réseaux sociaux du propriétaire",
        faq_social_sub: "Découvrez mes profils officiels et restons en contact.",
        priv_title: "Charte de confidentialité et conditions",
        priv_subtitle: "Conditions d'utilisation et protection des droits d'auteur.",
        priv_sec_title: "Droits d'auteur",
        priv_copyright_info: "© [Vertone en coopération avec l'équipe ReTrap music / Oscar \"Vertis\" Legutko] [12.07.2026]. Tous droits réservés.",
        priv_body1: "Le site web et l'application web, y compris leur code source, leur conception graphique, leur interface utilisateur, leurs fonctionnalités, leur contenu, leurs bases de données et autres éléments, sont soumis à une protection juridique en vertu du droit d'auteur.",
        priv_body2: "La copie, la modification, la distribution, la décompilation ou l'utilisation de tout ou partie du service et de l'application sans le consentement écrit préalable du titulaire des droits d'auteur est interdite.",
        c1_b1: "Ce qu'est réellement le Mixage/Mastering et de quoi il se compose",
        c1_b2: "Quels types de plug-ins existent",
        c1_b3: "Quels types de compresseurs existent",
        c1_b4: "Comment fonctionnent les plug-ins, notamment :",
        c1_b5: "EQ (Égaliseurs)",
        c1_b6: "Compresseurs",
        c1_b7: "Saturateurs/Distorsion",
        c1_b8: "Réverbérations",
        c1_b9: "Delays",
        c1_b10: "De-essers",
        c1_b11: "Limiteurs/Portes de bruit",
        c1_b12: "Quel DAW choisir au mieux selon vos préférences",
        c1_b13: "Comment bien enregistrer les voix à la maison",
        c1_b14: "Qu'est-ce que le gain staging, comment le faire et comment faire le leveling",
        c1_b15: "Comment utiliser l'autotune et accorder la voix",
        c1_b16: "Routage & Side chains - qu'est-ce que c'est et comment faire",
        c1_b17: "Plages de fréquences, tonalités",
        c1_b18: "Comment fonctionnent les boutons et options sur les plug-ins + vidéos associées",
        c2_b1: "Ce qu'est l'acoustique d'une pièce",
        c2_b2: "Comment choisir l'acoustique pour votre pièce",
        c2_b3: "Comment disposer panneaux, bass traps, etc. dans votre studio",
        c2_b4: "Acoustique économique en DIY",
        c2_b5: "Ce qu'il faut éviter et surveiller lors de la planification et de la création d'un studio"
    },
    ru: {
        settings_general: "Общие",
        settings_audio: "Аудио (Скоро)",
        settings_title: "Общие настройки",
        settings_select_lang: "Выберите язык страницы",
        settings_theme: "Выберите тему страницы",
        settings_theme_dark: "Темная",
        settings_theme_light: "Светлая",
        confirm_title: "Подтверждение",
        alert_title: "Уведомление",
        btn_cancel: "Отмена",
        btn_yes: "Да",
        btn_login: "Войти",
        btn_logout: "Выйти",
        btn_check: "Проверить",
        btn_back: "Назад",
        btn_reset: "Сбросить",
        btn_add_track: "➕ Добавить новый трек",
        btn_add_work: "➕ Добавить новую работу",
        btn_write_review: "✍️ Оставить отзыв",
        btn_feedback_tooltip: "Отзывы и обратная связь",
        btn_reset_votes_tooltip: "Сбросить голоса",
        confirm_delete_track: "Вы уверены, что хотите удалить этот трек?",
        confirm_delete_graphic: "Вы уверены, что хотите удалить эту графику?",
        confirm_delete_review: "Вы уверены, что хотите удалить этот отзыв?",
        confirm_delete_feedback: "Вы уверены, что хотите удалить этот отзыв?",
        confirm_reset_votes: "Вы уверены, что хотите сбросить голоса для этого элемента?",
        feedback_too_short: "Введите не менее 3 символов отзыва!",
        feedback_thanks: "Спасибо за ваш отзыв! Он сохранен для владельца страницы.",
        review_fields_required: "Пожалуйста, заполните все поля!",
        review_author_required: "Пожалуйста, введите ваше имя!",
        review_text_required: "Пожалуйста, введите текст отзыва!",
        tab_courses: "Курсы",
        tab_portfolio: "Портфолио",
        tab_reviews: "Отзывы",
        tab_services: "Услуги",
        tab_socials: "Соцсети",
        tab_faq: "FAQ",
        tab_privacy: "Политика конфиденциальности<br>и условия",
        courses_title: "Курсы и E-book",
        courses_subtitle: "Узнайте много нового о музыке и не только благодаря нашим электронным книгам!",
        course_1_title: "Полный курс сведения и мастеринга",
        course_1_learn: "Из этого курса вы узнаете:",
        course_2_title: "Полный курс акустики",
        course_2_learn: "Из этого курса вы узнаете:",
        soon: "Скоро",
        port_music_title: "Музыка",
        port_music_desc: "Вы можете прослушать сведенные мной треки и оценить их лайком или дизлайком",
        port_graphics_title: "Графика",
        port_graphics_desc: "Посмотрите мои баннеры, аватары, обложки, плакаты, панели и т. д.",
        port_music_crumb: "Портфолио // Музыка",
        cat_banners: "Баннеры",
        cat_banners_desc: "Уникальные, атмосферные баннеры для ваших соцсетей",
        cat_avatars: "Аватары",
        cat_avatars_desc: "Модернистские аватары, соответствующие вашему образу",
        cat_posters: "Плакаты",
        cat_posters_desc: "Креативные и чистые дизайны плакатов",
        cat_panels: "Панели",
        cat_panels_desc: "Аккуратные панели для вашего стрим-канала",
        cat_covers: "Обложки",
        cat_covers_desc: "Профессиональные обложки для синглов, плейлистов или альбомов",
        rev_title: "Отзывы клиентов",
        rev_subtitle: "Прочитайте отзывы людей, с которыми мне довелось сотрудничать.",
        serv_title: "Мои услуги",
        serv_subtitle: "Закажите профессиональные услуги сведения или графики, адаптированные под ваши нужды.",
        serv_mix_pitch: "Ищете уникальный, отлично звучащий микс и громкий мастеринг? Закажите его прямо сейчас!",
        serv_price_lbl: "Базовая цена услуги:",
        serv_offer_lbl: "Что я предлагаю:",
        serv_info_lbl: "Дополнительная информация:",
        serv_req_lbl: "Что требуется от вас:",
        serv_attention_title: "Внимание!",
        serv_attention_desc: "В случае плохого качества записи я оставляю за собой право отказать в услуге. Я забочусь о вашем удовлетворении, а само сведение не спасет плохую запись.",
        serv_mix_footer: "Если вы хотите прослушать сведенные мной треки, перейдите во вкладку портфолио. Если вы решили приобрести услугу, нажмите кнопку ниже.",
        btn_order_mix: "Заказать сведение и мастеринг",
        serv_graph_pitch: "Ищете красивую, понятную, креативную и уникальную графику? Я сделаю!",
        serv_prices_lbl: "Цены:",
        btn_order_graph: "Заказать графику",
        faq_title: "Ответы на ваши вопросы",
        faq_subtitle: "Все, что вам нужно знать о приложении Vertone и о нас.",
        faq_q1: "Что такое Vertone?",
        faq_a1: "Vertone — это веб-сайт, основанный человеком под ником Vertis, который увлекается созданием музыки уже более 3 лет. Сайт представляет собой магазин, объединенный с портфолио. Название Vertone произошло от слияния никнейма \"Vertis\" и музыкального \"Tone\".",
        faq_q2: "Когда был создан этот сайт?",
        faq_a2: "Официальные работы над приложением начались именно 11.07.2026.",
        faq_q3: "С какой целью?",
        faq_a3: "Vertis создал этот сайт с целью поддержать и помочь людям, которые только начинают заниматься музыкой. По сути, наполовину бесплатно, наполовину за деньги. Когда вы покупаете сведение, я проведу трансляцию на YouTube о том, как я свожу, и вы сможете узнать много нового, так как я объясняю все, что делаю и почему. Или вы можете купить курс сведения и самостоятельно изучить основы, чтобы позже применить полученные знания на практике.",
        faq_social_lbl: "Соцсети владельца",
        faq_social_sub: "Посмотрите мои официальные профили и оставайтесь на связи.",
        priv_title: "Политика конфиденциальности и правила",
        priv_subtitle: "Правила использования сервиса и защита авторских прав.",
        priv_sec_title: "Авторские права",
        priv_copyright_info: "© [Vertone в сотрудничестве с командой ReTrap music / Оскар \"Vertis\" Легутко] [12.07.2026]. Все права защищены.",
        priv_body1: "Веб-сайт и веб-приложение, включая их исходный код, графическое оформление, пользовательский интерфейс, функциональные возможности, контент, базы данных и другие элементы, защищены законом об авторском праве.",
        priv_body2: "Копирование, изменение, распространение, декомпиляция или использование всего или части сервиса и приложения без предварительного письменного согласия владельца прав запрещено."
    }
};

function t(key) {
    const lang = localStorage.getItem('vertone_lang') || 'pl';
    return (translations[lang] && translations[lang][key]) || (translations['pl'][key] || key);
}

function applyLanguage(lang) {
    if (!translations[lang]) return;
    const dict = translations[lang];

    // Remove RTL styling since Arabic is removed
    document.documentElement.removeAttribute('dir');
    document.documentElement.classList.remove('rtl');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerHTML = dict[key];
        }
    });

    // Translate dynamic elements categories
    const categoriesLabels = {
        pl: {
            bannery: 'Bannery',
            avatory: 'Avatary',
            plakaty: 'Plakaty',
            panele: 'Panele',
            okladki: 'Okładki'
        },
        en: {
            bannery: 'Banners',
            avatory: 'Avatars',
            plakaty: 'Posters',
            panele: 'Panels',
            okladki: 'Covers'
        },
        fr: {
            bannery: 'Bannières',
            avatory: 'Avatars',
            plakaty: 'Affiches',
            panele: 'Panels',
            okladki: 'Couvertures'
        },
        ru: {
            bannery: 'Баннеры',
            avatory: 'Аватары',
            plakaty: 'Плакаты',
            panele: 'Панели',
            okladki: 'Обложки'
        }
    };

    // Update breadcrumb category title
    const currentCategory = appState.activeCategory;
    const titleEl = document.getElementById('graphics-list-category-title');
    if (titleEl && categoriesLabels[lang] && categoriesLabels[lang][currentCategory]) {
        titleEl.textContent = `${dict['port_graphics_title'] || 'Portfolio // Grafiki'} // ${categoriesLabels[lang][currentCategory]}`;
    }

    // Re-render dynamic list templates using new dictionary
    renderTracks();
    renderGraphics();
    renderReviews();
}

// Admin Login Handlers
function setupDiscordLogin() {
    const loginModal = document.getElementById('discord-login-modal');
    const btnOpenLogin = document.getElementById('btn-discord-login');
    const btnCloseLogin = document.getElementById('btn-close-discord-login');
    const menuProfile = document.getElementById('user-profile-menu');
    const dropdown = document.getElementById('user-profile-dropdown');
    const btnLogout = document.getElementById('btn-discord-logout');
    
    const adminForm = document.getElementById('admin-login-form');
    const userInput = document.getElementById('admin-username-input');
    const passInput = document.getElementById('admin-password-input');
    const btnSubmit = document.getElementById('btn-submit-admin-login');
    const errorDiv = document.getElementById('admin-login-error');

    function openAdminModal() {
        if (userInput) userInput.value = '';
        if (passInput) passInput.value = '';
        if (errorDiv) errorDiv.classList.add('hidden');
        if (loginModal) loginModal.classList.add('show');
        if (userInput) setTimeout(() => userInput.focus(), 100);
    }

    function doAdminLogin() {
        if (!userInput || !passInput) return;
        const username = userInput.value ? userInput.value.trim() : '';
        const password = passInput.value ? passInput.value.trim() : '';

        const isUserValid = (username.toLowerCase() === 'the_vertis' || username.toLowerCase() === 'vertis');
        const isPassValid = (password === 'Vertisvertone123!@#' || password.toLowerCase() === 'vertisvertone123!@#');

        if (isUserValid && isPassValid) {
            const adminUser = { id: 'admin_vertis', username: 'The_vertis' };
            localStorage.setItem('vertone_session_user', JSON.stringify(adminUser));
            appState.user = adminUser;
            appState.isOwner = true;
            if (errorDiv) errorDiv.classList.add('hidden');
            if (loginModal) {
                loginModal.classList.remove('show');
            }
            updateUserUI();
            showCustomAlert("Zalogowano pomyślnie jako administrator!");
        } else {
            if (errorDiv) errorDiv.classList.remove('hidden');
        }
    }

    if (btnOpenLogin) {
        btnOpenLogin.addEventListener('click', openAdminModal);
    }

    if (btnCloseLogin && loginModal) {
        btnCloseLogin.addEventListener('click', () => {
            loginModal.classList.remove('show');
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            doAdminLogin();
        });
    }

    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            doAdminLogin();
        });
    }

    // Secret Admin Trigger 1: Keyboard shortcut (Ctrl + Shift + A  OR  Ctrl + Alt + L)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) ||
            (e.ctrlKey && e.altKey && (e.key === 'L' || e.key === 'l'))) {
            e.preventDefault();
            openAdminModal();
        }
    });

    // Secret Admin Trigger 2: Triple click logo (top left logo)
    let logoClicks = 0;
    let logoClickTimer = null;
    document.querySelectorAll('.logo, .logo-title, .top-header-left').forEach(logoEl => {
        logoEl.addEventListener('click', () => {
            logoClicks++;
            if (logoClicks >= 3) {
                logoClicks = 0;
                clearTimeout(logoClickTimer);
                openAdminModal();
            } else {
                clearTimeout(logoClickTimer);
                logoClickTimer = setTimeout(() => { logoClicks = 0; }, 1500);
            }
        });
    });

    // Profile Dropdown Toggle
    if (menuProfile && dropdown) {
        menuProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem('vertone_session_user');
            appState.user = null;
            appState.isOwner = false;
            updateUserUI();
            showCustomAlert("Wylogowano pomyślnie.");
        });
    }
}

    function handleDiscordHashLogin() {
        // Legacy OAuth hash redirect handler disabled
    }

    // --- MODALS ENGINE ---
    function showModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('show');
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
            // Clear errors if login modal
            if (id === 'login-modal') {
                document.getElementById('login-error-msg').classList.add('hidden');
                document.getElementById('admin-password').value = '';
            }
        }
    }

    function showCustomConfirm(message, onAccept, title = null) {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;

        const msgEl = document.getElementById('confirm-modal-message');
        const titleEl = document.getElementById('confirm-modal-title');
        const acceptBtn = document.getElementById('btn-confirm-accept');
        const cancelBtn = document.getElementById('btn-confirm-cancel');

        titleEl.textContent = title || (typeof t === 'function' ? t('confirm_title') : "Potwierdzenie");
        msgEl.textContent = message;

        modal.classList.add('show');

        // Clear old event listeners by cloning
        const newAccept = acceptBtn.cloneNode(true);
        acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);

        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newAccept.addEventListener('click', () => {
            modal.classList.remove('show');
            if (onAccept) onAccept();
        });

        newCancel.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    function showCustomAlert(message, title = null) {
        const modal = document.getElementById('alert-modal');
        if (!modal) return;

        const msgEl = document.getElementById('alert-modal-message');
        const titleEl = document.getElementById('alert-modal-title');
        const closeBtn = document.getElementById('btn-alert-close');

        titleEl.textContent = title || (typeof t === 'function' ? t('alert_title') : "Powiadomienie");
        msgEl.textContent = message;

        modal.classList.add('show');

        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);

        newClose.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    function setupModalEvents() {
        // Close triggers
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal-overlay');
                closeModal(modal.id);
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(modal.id);
                }
            });
        });

        // Add cancel buttons triggers
        const cancelTrack = document.getElementById('btn-cancel-track');
        if (cancelTrack) cancelTrack.addEventListener('click', () => closeModal('add-track-modal'));

        const cancelGraphic = document.getElementById('btn-cancel-graphic');
        if (cancelGraphic) cancelGraphic.addEventListener('click', () => closeModal('add-graphic-modal'));

        const cancelReview = document.getElementById('btn-cancel-review');
        if (cancelReview) cancelReview.addEventListener('click', () => closeModal('write-review-modal'));

        // Modal triggers opening
        const addTrackBtn = document.getElementById('btn-add-track-modal');
        if (addTrackBtn) {
            addTrackBtn.addEventListener('click', () => {
                const titleInput = document.getElementById('track-title-input');
                const fileInput = document.getElementById('track-file-input');
                const fileStatus = document.getElementById('track-file-status');
                if (titleInput) titleInput.value = '';
                if (fileInput) fileInput.value = '';
                if (fileStatus) fileStatus.classList.add('hidden');
                showModal('add-track-modal');
            });
        }

        document.querySelectorAll('.btn-add-graphic-modal, #btn-add-graphic-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const titleInput = document.getElementById('graphic-title-input');
                const fileInput = document.getElementById('graphic-file-input');
                const fileStatus = document.getElementById('graphic-file-status');
                const catSelect = document.getElementById('graphic-category-select');
                if (titleInput) titleInput.value = '';
                if (fileInput) fileInput.value = '';
                if (fileStatus) fileStatus.classList.add('hidden');
                if (catSelect) catSelect.value = appState.activeCategory || 'bannery';
                showModal('add-graphic-modal');
            });
        });

        const writeReviewBtn = document.getElementById('btn-write-review-modal');
        if (writeReviewBtn) {
            writeReviewBtn.addEventListener('click', () => {
                const authorInput = document.getElementById('review-author-input');
                const contentInput = document.getElementById('review-content-input');
                const beforeInput = document.getElementById('review-before-input');
                const afterInput = document.getElementById('review-after-input');
                const beforeStatus = document.getElementById('review-before-status');
                const afterStatus = document.getElementById('review-after-status');
                if (authorInput) authorInput.value = '';
                if (contentInput) contentInput.value = '';
                if (beforeInput) beforeInput.value = '';
                if (afterInput) afterInput.value = '';
                if (beforeStatus) beforeStatus.classList.add('hidden');
                if (afterStatus) afterStatus.classList.add('hidden');
                appReviewRating = 5;
                syncStars(5);
                showModal('write-review-modal');
            });
        }

        // File Drag & Drop events
        setupFileDropzone('track-file-dropzone', 'track-file-input', 'track-file-status', 'track-file-name');
        setupFileDropzone('graphic-file-dropzone', 'graphic-file-input', 'graphic-file-status', 'graphic-file-name');
        setupFileDropzone('review-before-dropzone', 'review-before-input', 'review-before-status', 'review-before-name');
        setupFileDropzone('review-after-dropzone', 'review-after-input', 'review-after-status', 'review-after-name');

        // Add track submit
        const submitTrack = document.getElementById('btn-submit-track');
        if (submitTrack) submitTrack.addEventListener('click', submitNewTrack);

        // Add graphic submit
        const submitGraphic = document.getElementById('btn-submit-graphic');
        if (submitGraphic) submitGraphic.addEventListener('click', submitNewGraphic);

        // Stars review setup
        setupStarsRating();
        const submitReview = document.getElementById('btn-submit-review');
        if (submitReview) submitReview.addEventListener('click', submitNewReview);
    }

    // File dropzone utilities
    function setupFileDropzone(zoneId, inputId, statusId, nameId) {
        const zone = document.getElementById(zoneId);
        const input = document.getElementById(inputId);
        const status = document.getElementById(statusId);
        if (!zone || !input) return;

        function updateDropzoneUI(file) {
            if (!file) return;
            const isAudio = file.type.startsWith('audio') || zoneId.includes('track') || zoneId.includes('review');
            const icon = isAudio ? '🎵' : '🖼️';
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            zone.innerHTML = `
            <span class="upload-icon">${icon}</span>
            <span class="upload-text" style="color: var(--color-blue-light); font-weight: 700; word-break: break-all; max-width: 90%; font-size: 13px;">${file.name}</span>
            <span class="upload-sub" style="color: var(--color-success); font-weight: 600;">Wybrano plik (${sizeMB} MB) • Kliknij, aby zmienić</span>
        `;
            if (status) status.classList.add('hidden');
        }

        zone.addEventListener('click', () => input.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                input.files = e.dataTransfer.files;
                updateDropzoneUI(input.files[0]);
            }
        });

        input.addEventListener('change', () => {
            if (input.files.length > 0) {
                updateDropzoneUI(input.files[0]);
            }
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }

    async function submitNewTrack() {
        const titleInput = document.getElementById('track-title-input');
        const fileInput = document.getElementById('track-file-input');

        const title = titleInput.value.trim();
        if (!title) {
            showCustomAlert(t('review_fields_required') || "Podaj tytuł utworu!");
            return;
        }

        if (fileInput.files.length === 0) {
            showCustomAlert(t('review_fields_required') || "Wybierz plik audio z dysku!");
            return;
        }

        const file = fileInput.files[0];

        try {
            const arrayBuffer = await readFileAsArrayBuffer(file);

            // Save to IndexedDB
            const newTrack = {
                id: 'track_' + Date.now(),
                title: title,
                votesUp: 0,
                votesDown: 0,
                audioData: arrayBuffer,
                fileType: file.type,
                feedbacks: []
            };

            await saveToDB('tracks', newTrack);
            closeModal('add-track-modal');
            await loadTracks();
            renderTracks();
        } catch (e) {
            console.error("Failed to save track in IndexedDB:", e);
            showCustomAlert("Błąd podczas zapisywania pliku!");
        }
    }

    async function submitNewGraphic() {
        const titleInput = document.getElementById('graphic-title-input');
        const fileInput = document.getElementById('graphic-file-input');
        const catSelect = document.getElementById('graphic-category-select');

        const title = titleInput.value.trim();
        if (!title) {
            showCustomAlert(t('review_fields_required') || "Podaj tytuł pracy!");
            return;
        }

        if (fileInput.files.length === 0) {
            showCustomAlert("Wybierz plik graficzny z dysku!");
            return;
        }

        const file = fileInput.files[0];
        const category = catSelect ? catSelect.value : appState.activeCategory;

        try {
            const arrayBuffer = await readFileAsArrayBuffer(file);

            const newGraphic = {
                id: 'graphic_' + Date.now(),
                category: category,
                title: title,
                votesUp: 0,
                votesDown: 0,
                imageData: arrayBuffer,
                fileType: file.type,
                feedbacks: []
            };

            await saveToDB('graphics', newGraphic);
            closeModal('add-graphic-modal');
            appState.activeCategory = category;

            // Update Title if currently in list view
            const labels = {
                bannery: 'Bannery',
                avatory: 'Avatary',
                plakaty: 'Plakaty',
                panele: 'Panele',
                okladki: 'Okładki'
            };
            const titleEl = document.getElementById('graphics-list-category-title');
            if (titleEl) {
                titleEl.textContent = `Portfolio // Grafiki // ${labels[category] || category}`;
            }

            await loadGraphics();
            renderGraphics();
            showPortfolioView('graphics-list');
        } catch (e) {
            console.error("Failed to save graphic in DB:", e);
            showCustomAlert("Błąd zapisu grafiki w bazie danych!");
        }
    }

    // Stars Rating Selector
    let appReviewRating = 5;
    function setupStarsRating() {
        const stars = document.querySelectorAll('#rating-selector .star');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.getAttribute('data-rating'));
                appReviewRating = rating;
                syncStars(rating);
            });
        });
    }

    function syncStars(rating) {
        const stars = document.querySelectorAll('#rating-selector .star');
        stars.forEach(star => {
            const itemRating = parseInt(star.getAttribute('data-rating'));
            if (itemRating <= rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }

    async function submitNewReview() {
        const author = document.getElementById('review-author-input').value.trim();
        const text = document.getElementById('review-content-input').value.trim();

        if (!author) {
            showCustomAlert(t('review_author_required') || "Wpisz swoje imię!");
            return;
        }
        if (!text) {
            showCustomAlert(t('review_text_required') || "Wpisz treść opinii!");
            return;
        }

        // Find active avatar preset
        const activeAvatarItem = document.querySelector('.avatar-presets-grid .avatar-preset-item.active');
        const avatar = activeAvatarItem ? activeAvatarItem.getAttribute('data-avatar') : 'user1';

        const beforeInput = document.getElementById('review-before-input');
        const afterInput = document.getElementById('review-after-input');

        const beforeFile = beforeInput.files.length > 0 ? beforeInput.files[0] : null;
        const afterFile = afterInput.files.length > 0 ? afterInput.files[0] : null;

        try {
            const beforeData = await readFileAsArrayBuffer(beforeFile);
            const afterData = await readFileAsArrayBuffer(afterFile);

            const newReview = {
                id: 'rev_' + Date.now(),
                author: author,
                rating: appReviewRating,
                text: text,
                votesUp: 0,
                votesDown: 0,
                avatar: avatar,
                beforeAudioData: beforeData,
                beforeFileType: beforeFile ? beforeFile.type : null,
                afterAudioData: afterData,
                afterFileType: afterFile ? afterFile.type : null
            };

            await saveToDB('reviews', newReview);
            closeModal('write-review-modal');
            await loadReviews();
            renderReviews();
        } catch (e) {
            console.error("Failed to save review:", e);
            showCustomAlert("Błąd podczas zapisywania opinii!");
        }
    }


    // --- LIGHTBOX GALLERY SYSTEM ---
    function setupLightbox() {
        const lightbox = document.getElementById('lightbox');
        const closeBtn = document.getElementById('btn-close-lightbox');

        closeBtn.addEventListener('click', () => closeLightbox());
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }

    function openLightbox(url, title) {
        const lightbox = document.getElementById('lightbox');
        const image = document.getElementById('lightbox-image');
        const caption = document.getElementById('lightbox-title-text');

        image.src = url;
        caption.textContent = title;
        lightbox.classList.add('show');
    }

    function closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        lightbox.classList.remove('show');
    }

    // Preset avatars click listeners logic for write-review modal
    document.querySelectorAll('.avatar-preset-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.avatar-preset-item').forEach(a => a.classList.remove('active'));
            item.classList.add('active');
        });
    });
