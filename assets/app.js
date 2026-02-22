/**
 * JVHub Frontend Application
 * 
 * Main application logic for the music player with ratings and comments.
 * Handles DOM manipulation, audio playback, user interactions, and API calls.
 */

// DOM Elements
const LISTINGS_EL = document.getElementById('listings');

// SVG Icons for play/pause buttons
const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
};

// Currently playing audio element
let currentAudio = null;

/**
 * Safely parse string to integer with fallback
 * @param {string} s - String to parse
 * @returns {number} Parsed integer or 0
 */
function safeInt(s) {
  const n = Number.parseInt(String(s || '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format seconds into human-readable time string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (HH:MM:SS or MM:SS)
 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Generate localStorage key for storing user vote
 * @param {string} songId - Song identifier
 * @returns {string} localStorage key
 */
function voteStorageKey(songId) {
  return `jvhub.vote.${songId}`;
}

/**
 * Retrieve stored vote for a song from localStorage
 * @param {string} songId - Song identifier
 * @returns {string|null} 'like', 'dislike', or null
 */
function getStoredVote(songId) {
  try {
    const v = localStorage.getItem(voteStorageKey(songId));
    return v === 'like' || v === 'dislike' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Store user vote for a song in localStorage
 * @param {string} songId - Song identifier
 * @param {string|null} vote - 'like', 'dislike', or null to clear
 */
function setStoredVote(songId, vote) {
  try {
    if (!vote) localStorage.removeItem(voteStorageKey(songId));
    else localStorage.setItem(voteStorageKey(songId), vote);
  } catch {
    // ignore storage errors
  }
}

/**
 * Generate human-readable time ago string
 * @param {string|Date} ts - Timestamp
 * @returns {string} Time ago string
 */
function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Escape HTML characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

/**
 * Render comments list in the DOM
 * @param {HTMLElement} listEl - Container element for comments
 * @param {Array} comments - Array of comment objects
 */
function renderComments(listEl, comments) {
  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div class="comment-empty">No comments yet. Be first!</div>';
    return;
  }

  listEl.innerHTML = comments
    .map(
      (c) => `
      <div class="comment-item">
        <div class="comment-author">${escapeHtml(c.author)}</div>
        <div class="comment-body">${escapeHtml(c.body)}</div>
        ${c.image_url ? `<div class="comment-image"><img src="${escapeHtml(c.image_url)}" alt="comment image" loading="lazy" /></div>` : ''}
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>
    `,
    )
    .join('');
}

/**
 * Fetch JSON data from API endpoint with error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails or response is invalid
 */
async function fetchJson(url, options) {
  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(options && options.headers ? options.headers : {}),
    },
    ...options,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore parsing errors
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || text || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

/**
 * Generate HTML for a song listing card
 * @param {Object} song - Song object with id, title, audioSrc, coverSrc
 * @returns {string} HTML string for the song card
 */
function songCardHtml(song) {
  const audioSrc = song.audioSrc || '';
  const coverSrc = song.coverSrc || '';
  const title = song.title || song.filename || 'Untitled';
  const songId = song.id || '';

  return `
    <div class="listing" data-song="${escapeHtml(songId)}" data-src="${escapeHtml(audioSrc)}">
      <h3>${escapeHtml(title)}</h3>
      <div class="media">
        <img src="${escapeHtml(coverSrc)}" alt="Album Cover" loading="lazy" />
        <div class="overlay">
          <button class="play-btn" aria-label="Play">${ICONS.play}</button>
        </div>
      </div>
      <audio src="${escapeHtml(audioSrc)}"></audio>
      <div class="player" aria-label="Player controls">
        <div class="player-times" aria-hidden="true">
          <span class="player-time player-time--current">0:00</span>
          <span class="player-time player-time--remaining">--:--</span>
        </div>
        <input
          class="player-progress"
          type="range"
          min="0"
          max="0"
          step="0.01"
          value="0"
          aria-label="Seek"
        />
      </div>
      <div class="rating">
        <button class="rating-btn like" data-type="like"><span>👍</span><span class="rating-count">—</span></button>
        <button class="rating-btn dislike" data-type="dislike"><span>👎</span><span class="rating-count">—</span></button>
      </div>
      <div class="comments-section">
        <div class="comments-title">COMMENTS</div>
        <div class="comment-form">
          <input type="text" placeholder="Your name" maxlength="30" />
          <textarea placeholder="Leave a comment..." maxlength="500"></textarea>
          <div class="comment-image-row">
            <label class="comment-image-label" title="Attach image or GIF">
              📎 IMAGE / GIF
              <input type="file" class="comment-file-input" accept="image/jpeg,image/png,image/gif,image/webp" />
            </label>
            <button class="comment-image-clear" style="display:none">✕ REMOVE</button>
          </div>
          <div class="comment-image-preview" style="display:none">
            <img class="comment-preview-img" src="" alt="preview" />
          </div>
          <button class="comment-submit">POST</button>
        </div>
        <div class="comments-list"><div class="loading-msg">Loading...</div></div>
      </div>
    </div>
  `;
}

/**
 * Update play button state and listing appearance
 * @param {HTMLElement} listing - Song listing element
 * @param {boolean} isPlaying - Whether audio is currently playing
 */
function setListingPlaying(listing, isPlaying) {
  const btn = listing.querySelector('.play-btn');
  if (!btn) return;
  listing.classList.toggle('playing', isPlaying);
  btn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
}

/**
 * Wire up progress bar and time display for audio element
 * @param {HTMLElement} listing - Song listing element
 * @param {HTMLAudioElement} audio - Audio element
 */
function wireProgress(listing, audio) {
  const progress = listing.querySelector('.player-progress');
  const currentEl = listing.querySelector('.player-time--current');
  const remainingEl = listing.querySelector('.player-time--remaining');
  if (!progress || !currentEl || !remainingEl) return;

  let isSeeking = false;

  const setTimes = (cur, dur) => {
    currentEl.textContent = formatTime(cur);
    if (Number.isFinite(dur) && dur > 0) {
      const left = Math.max(0, dur - cur);
      remainingEl.textContent = `-${formatTime(left)}`;
    } else {
      remainingEl.textContent = '--:--';
    }
  };

  const syncDuration = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      progress.max = String(audio.duration);
      if (!isSeeking) progress.value = String(audio.currentTime || 0);
      setTimes(audio.currentTime || 0, audio.duration);
    } else {
      progress.max = '0';
      if (!isSeeking) progress.value = '0';
      setTimes(audio.currentTime || 0, NaN);
    }
  };

  const syncTime = () => {
    if (isSeeking) return;
    const cur = audio.currentTime || 0;
    progress.value = String(cur);
    setTimes(cur, audio.duration);
  };

  // Initial paint
  syncDuration();
  syncTime();

  audio.addEventListener('loadedmetadata', syncDuration);
  audio.addEventListener('durationchange', syncDuration);
  audio.addEventListener('timeupdate', syncTime);

  const beginSeek = () => {
    isSeeking = true;
  };
  const endSeek = () => {
    isSeeking = false;
    syncTime();
  };

  progress.addEventListener('pointerdown', beginSeek);
  progress.addEventListener('pointerup', endSeek);
  progress.addEventListener('pointercancel', endSeek);

  progress.addEventListener('input', () => {
    const next = Number.parseFloat(progress.value);
    const dur = audio.duration;
    if (Number.isFinite(next)) {
      audio.currentTime = next;
      setTimes(next, dur);
    }
  });
}

/**
 * Wire up audio playback controls for a song listing
 * @param {HTMLElement} listing - Song listing element
 */
function wireAudio(listing) {
  const btn = listing.querySelector('.play-btn');
  const audio = listing.querySelector('audio');
  if (!btn || !audio) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    if (currentAudio && currentAudio !== audio) {
      const prevListing = currentAudio.closest('.listing');
      currentAudio.pause();
      if (prevListing) setListingPlaying(prevListing, false);
      currentAudio = null;
    }

    if (audio.paused) {
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration) {
        audio.currentTime = 0;
      }
      audio.play().catch(() => {});
      setListingPlaying(listing, true);
      currentAudio = audio;
    } else {
      audio.pause();
      setListingPlaying(listing, false);
      currentAudio = null;
    }
  });

  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    setListingPlaying(listing, false);
    if (currentAudio === audio) currentAudio = null;
  });

  wireProgress(listing, audio);
}

/**
 * Load and display rating counts for a song
 * @param {string} songId - Song identifier
 * @param {HTMLElement} likeCountEl - Element to display like count
 * @param {HTMLElement} dislikeCountEl - Element to display dislike count
 */
async function loadRatings(songId, likeCountEl, dislikeCountEl) {
  const data = await fetchJson(`/api/ratings?song_id=${encodeURIComponent(songId)}`);
  likeCountEl.textContent = data.likes ?? 0;
  dislikeCountEl.textContent = data.dislikes ?? 0;
}

/**
 * Apply a vote change to a song's ratings
 * @param {string} songId - Song identifier
 * @param {number} likeDelta - Change in like count (-1, 0, or 1)
 * @param {number} dislikeDelta - Change in dislike count (-1, 0, or 1)
 * @returns {Promise<Object>} Updated rating counts
 */
async function applyVote(songId, likeDelta, dislikeDelta) {
  return await fetchJson('/api/ratings', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId, likeDelta, dislikeDelta }),
  });
}

/**
 * Load and render comments for a song
 * @param {string} songId - Song identifier
 * @param {HTMLElement} listEl - Container element for comments
 */
async function loadComments(songId, listEl) {
  const data = await fetchJson(`/api/comments?song_id=${encodeURIComponent(songId)}`);
  renderComments(listEl, data.comments || []);
}

/**
 * Post a new comment for a song
 * @param {string} songId - Song identifier
 * @param {string} author - Comment author name
 * @param {string} body - Comment text
 * @param {string|null} imageUrl - Optional image URL
 * @returns {Promise<Object>} Created comment data
 */
async function postComment(songId, author, body, imageUrl) {
  return await fetchJson('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId, author, body, image_url: imageUrl || null }),
  });
}

/**
 * Upload an image to Supabase storage
 * @param {string} dataUrl - Base64 data URL of image
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Upload result with public URL
 */
async function uploadImage(dataUrl, filename) {
  return await fetchJson('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, filename }),
  });
}

/**
 * Wire up all interactive functionality for a song listing
 * @param {HTMLElement} listing - Song listing element
 */
function wireListingData(listing) {
  const songId = listing.dataset.song;
  const likeBtn = listing.querySelector('.rating-btn.like');
  const dislikeBtn = listing.querySelector('.rating-btn.dislike');
  const likeCount = likeBtn.querySelector('.rating-count');
  const dislikeCount = dislikeBtn.querySelector('.rating-count');
  const commentsList = listing.querySelector('.comments-list');
  const nameInput = listing.querySelector('.comment-form input[type="text"]');
  const bodyInput = listing.querySelector('.comment-form textarea');
  const submitBtn = listing.querySelector('.comment-submit');
  const fileInput = listing.querySelector('.comment-file-input');
  const clearBtn = listing.querySelector('.comment-image-clear');
  const previewWrap = listing.querySelector('.comment-image-preview');
  const previewImg = listing.querySelector('.comment-preview-img');

  let pendingFile = null; // File object waiting to be uploaded on submit

  // Handle image file selection and preview
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB');
      fileInput.value = '';
      return;
    }

    pendingFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewWrap.style.display = 'block';
      clearBtn.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  // Handle image preview clearing
  clearBtn.addEventListener('click', () => {
    pendingFile = null;
    fileInput.value = '';
    previewImg.src = '';
    previewWrap.style.display = 'none';
    clearBtn.style.display = 'none';
  });

  // Initialize user's stored vote state
  let myVote = getStoredVote(songId);

  if (myVote === 'like') likeBtn.classList.add('active');
  if (myVote === 'dislike') dislikeBtn.classList.add('active');

  // Setup refresh functions for ratings and comments
  const refreshRatings = () => loadRatings(songId, likeCount, dislikeCount).catch(() => {});
  const refreshComments = () => loadComments(songId, commentsList).catch(() => {});

  refreshRatings();
  refreshComments();

  // Poll for rating updates from other users every 7 seconds
  // (Realtime is possible too, but polling is the simplest + most reliable setup.)
  const ratingsPollMs = 7000;
  setInterval(() => {
    // Avoid pointless background churn.
    if (document.hidden) return;
    refreshRatings();
  }, ratingsPollMs);

  // Setup rating buttons click handlers
  [likeBtn, dislikeBtn].forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      let likeDelta = 0;
      let dislikeDelta = 0;

      // Handle vote state changes
      if (myVote === type) {
        // Remove vote
        if (type === 'like') likeDelta = -1;
        if (type === 'dislike') dislikeDelta = -1;
        btn.classList.remove('active');
        myVote = null;
        setStoredVote(songId, null);
      } else {
        // Change or add vote
        if (myVote === 'like') {
          likeDelta = -1;
          likeBtn.classList.remove('active');
        }
        if (myVote === 'dislike') {
          dislikeDelta = -1;
          dislikeBtn.classList.remove('active');
        }
        if (type === 'like') likeDelta += 1;
        if (type === 'dislike') dislikeDelta += 1;
        btn.classList.add('active');
        myVote = type;
        setStoredVote(songId, type);
      }

      // Optimistic UI update
      likeCount.textContent = Math.max(0, safeInt(likeCount.textContent) + likeDelta);
      dislikeCount.textContent = Math.max(0, safeInt(dislikeCount.textContent) + dislikeDelta);

      try {
        const updated = await applyVote(songId, likeDelta, dislikeDelta);
        likeCount.textContent = updated.likes ?? likeCount.textContent;
        dislikeCount.textContent = updated.dislikes ?? dislikeCount.textContent;
      } catch {
        // Revert by reloading from server
        refreshRatings();
      }
    });
  });

  // Setup comment submission handler
  submitBtn.addEventListener('click', async () => {
    const author = nameInput.value.trim();
    const body = bodyInput.value.trim();
    if (!author || !body) return;

    submitBtn.disabled = true;

    let imageUrl = null;

    // Handle image upload if file is selected
    if (pendingFile) {
      submitBtn.textContent = 'UPLOADING...';
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(pendingFile);
        });
        const result = await uploadImage(dataUrl, pendingFile.name);
        imageUrl = result.url || null;
      } catch {
        // If image upload fails, post without image rather than blocking the comment
        imageUrl = null;
      }
    }

    submitBtn.textContent = 'POSTING...';

    try {
      await postComment(songId, author, body, imageUrl);
      nameInput.value = '';
      bodyInput.value = '';
      // Clear image state
      pendingFile = null;
      fileInput.value = '';
      previewImg.src = '';
      previewWrap.style.display = 'none';
      clearBtn.style.display = 'none';
      await refreshComments();
    } catch {
      // ignore errors
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'POST';
    }
  });

  wireAudio(listing);
}

/**
 * Initialize the application by loading songs and setting up the UI
 */
async function init() {
  try {
    const data = await fetchJson('/api/songs');
    const songs = (data && data.songs) || [];
    if (!Array.isArray(songs) || songs.length === 0) {
      LISTINGS_EL.innerHTML = '<div class="error-msg">No songs found.</div>';
      return;
    }

    LISTINGS_EL.innerHTML = songs.map(songCardHtml).join('');
    LISTINGS_EL.querySelectorAll('.listing').forEach(wireListingData);
  } catch (err) {
    LISTINGS_EL.innerHTML = `<div class="error-msg">${escapeHtml(
      err?.message || 'Failed to load.',
    )}</div>`;
  }
}

init();