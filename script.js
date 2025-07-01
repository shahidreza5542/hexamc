// --- Reward Data ---
const REWARDS = {
  ranks: [
    { id: 'pro', label: 'PRO', emoji: '🟨', ads: 40, lock: 5 * 24 * 60 * 60 }, // 5 days
    { id: 'elite', label: 'ELITE', emoji: '🟦', ads: 70, lock: 5 * 24 * 60 * 60 },
    { id: 'eliteplus', label: 'ELITE+', emoji: '🟪', ads: 90, lock: 5 * 24 * 60 * 60 },
    { id: 'legend', label: 'LEGEND', emoji: '💎', ads: 100, lock: 5 * 24 * 60 * 60 },
    { id: 'god', label: 'GOD', emoji: '🔱', ads: 120, lock: 5 * 24 * 60 * 60 },
  ],
  crates: [
    { id: 'stone', label: 'Stone Crate', emoji: '🪨', ads: 2, lock: 10 }, // 24 hours
    { id: 'iron', label: 'Iron Crate', emoji: '⛓️', ads: 30, lock: 24 * 60 * 60 },
    { id: 'diamond', label: 'Diamond Crate', emoji: '💎', ads: 40, lock: 24 * 60 * 60 },
    { id: 'hexa', label: 'Hexa Crate', emoji: '🌌', ads: 50, lock: 24 * 60 * 60 },
    { id: 'godcrate', label: 'God Crate', emoji: '🔱', ads: 60, lock: 24 * 60 * 60 },
  ]
};

const STORAGE_KEY = 'hexamc_rewards_v2';
let state = { ranks: {}, crates: {} };

// --- Utility Functions ---
function generateCode() {
  // Clean, unique code: 8 random uppercase letters/numbers, no prefix
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = { ranks: {}, crates: {} };
    }
  }
}

function getRemaining(lockUntil) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, lockUntil - now);
}

function formatDuration(secs) {
  if (secs <= 0) return '0s';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  let out = [];
  if (d) out.push(`${d}d`);
  if (h || d) out.push(`${h}h`);
  if (m || h || d) out.push(`${m}m`);
  out.push(`${s}s`);
  return out.join(' ');
}

// --- Reward Claim Functionality ---
async function sendRewardEmail(code, reward) {
  const currentUser = JSON.parse(localStorage.getItem('hexamc_currentUser'));
  if (!currentUser) {
    console.error('User not logged in');
    return false;
  }

  const rewardType = reward.category === 'ranks' ? 'Rank' : 'Crate';
  const rewardName = reward.label;
  const timestamp = new Date().toISOString();

  // Prepare claim data for local storage first
  const claimId = `hexamc_claim_${Date.now()}`;
  const claimData = {
    id: claimId,
    email: currentUser.email,
    mcname: currentUser.mcname,
    code: code,
    reward_type: rewardType,
    reward_name: rewardName,
    timestamp: timestamp,
    status: 'claimed'
  };

  try {
    // First save to localStorage
    localStorage.setItem(claimId, JSON.stringify(claimData));
    
    // Then try to send to server
    try {
      const response = await fetch('reward.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          mcname: currentUser.mcname,
          code: code,
          reward_type: rewardType,
          reward_name: rewardName,
          timestamp: timestamp
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result || !result.success) {
        console.warn('Server response indicates failure, but claim was saved locally:', result?.message || 'Unknown server error');
        // We still return true because the claim was saved locally
      }
      
      return true;
      
    } catch (serverError) {
      console.warn('Failed to send claim to server, but saved locally:', serverError);
      // Even if server fails, we consider it a success because we saved locally
      return true;
    }
    
  } catch (error) {
    console.error('Error processing reward claim:', error);
    // Try to remove the claim from localStorage if something went wrong
    try {
      localStorage.removeItem(claimId);
    } catch (e) {
      console.error('Failed to clean up failed claim:', e);
    }
    return false;
  }
}

// --- Render Functions ---
let adModalTimeout = null;
let adCountdownInterval = null;
let adCountdownActive = null; // {category, id} if a countdown is running

function renderRewards() {
  ['ranks', 'crates'].forEach(category => {
    const grid = document.getElementById(category + '-grid');
    grid.innerHTML = '';
    REWARDS[category].forEach(reward => {
      // Initialize state for this reward if it doesn't exist
      if (!state[category][reward.id]) {
        state[category][reward.id] = { adsWatched: 0 };
      }
      const s = state[category][reward.id];
      
      // Reset ads watched and clear code when cooldown ends
      if (s.lockUntil && getRemaining(s.lockUntil) === 0) {
        s.adsWatched = 0;  // Reset ads watched to 0
        s.code = undefined; // Clear any existing code
        s.lockUntil = undefined; // Clear the lock
        saveState();
      }
      const adsWatched = s.adsWatched || 0;
      const locked = s.lockUntil && getRemaining(s.lockUntil) > 0;
      // Only show claim button if not locked, has enough ads watched, and hasn't been claimed before
      const canClaim = !locked && adsWatched >= reward.ads && !s.code;
      const code = s.code || '';
      const remaining = locked ? getRemaining(s.lockUntil) : 0;
      // Card
      const card = document.createElement('div');
      card.className = 'reward-card' + (locked ? ' locked' : '');
      card.setAttribute('data-category', category);
      card.setAttribute('data-id', reward.id);
      // Emoji
      const emoji = document.createElement('div');
      emoji.className = 'reward-emoji';
      emoji.textContent = reward.emoji;
      card.appendChild(emoji);
      // Title
      const title = document.createElement('div');
      title.className = 'reward-title';
      title.textContent = reward.label;
      card.appendChild(title);
      // Desc
      const desc = document.createElement('div');
      desc.className = 'reward-desc';
      desc.textContent = `${reward.ads} ads required`;
      card.appendChild(desc);
      // Progress
      const progressLabel = document.createElement('div');
      progressLabel.className = 'ads-progress-label';
      progressLabel.textContent = `Ads watched: ${adsWatched} / ${reward.ads}`;
      card.appendChild(progressLabel);
      const progress = document.createElement('div');
      progress.className = 'ads-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'ads-progress-bar';
      progressBar.style.width = Math.min(100, Math.round(100 * adsWatched / reward.ads)) + '%';
      progress.appendChild(progressBar);
      card.appendChild(progress);
      // Actions
      const actions = document.createElement('div');
      actions.className = 'reward-actions';
      // Watch Ad
      const watchBtn = document.createElement('button');
      watchBtn.className = 'watch-ad-btn';
      watchBtn.textContent = 'Watch Ad';
      watchBtn.disabled = locked || adsWatched >= reward.ads || (adCountdownActive && adCountdownActive.category === category && adCountdownActive.id === reward.id);
      watchBtn.onclick = () => openAdModal(category, reward.id);
      actions.appendChild(watchBtn);
      // Claim
      const claimBtn = document.createElement('button');
      claimBtn.className = 'claim-btn';
      claimBtn.textContent = 'Claim';
      // Disable claim if locked, not enough ads, or ad countdown is running for this reward
      claimBtn.disabled = locked || adsWatched < reward.ads || (adCountdownActive && adCountdownActive.category === category && adCountdownActive.id === reward.id);
      claimBtn.onclick = () => claimReward(category, reward.id);
      actions.appendChild(claimBtn);
      card.appendChild(actions);
      // Countdown
      const countdown = document.createElement('div');
      countdown.className = 'countdown';
      if (locked) {
        countdown.textContent = `Locked: ${formatDuration(remaining)}`;
      } else if (code) {
        countdown.textContent = `Claimed!`;
      } else {
        countdown.textContent = '';
      }
      card.appendChild(countdown);
      grid.appendChild(card);
    });
  });
}

// --- Ad Modal Logic ---
function openAdModal(category, id) {
  const modal = document.getElementById('ad-modal');
  const closeBtn = document.getElementById('ad-modal-close');
  const timerDiv = document.getElementById('ad-modal-timer');
  const adContainer = document.getElementById('ad-container');
  // Clean up
  adContainer.innerHTML = '';
  closeBtn.classList.remove('enabled');
  closeBtn.setAttribute('disabled', '');
  // Ad script
  const script1 = document.createElement('script');
  script1.type = 'text/javascript';
  script1.innerHTML = `atOptions = { 'key': '0991e9e82fd2d65403bbe9399247fa92', 'format': 'iframe', 'height': 250, 'width': 300, 'params': {} };`;
  const script2 = document.createElement('script');
  script2.type = 'text/javascript';
  script2.src = '//www.highperformanceformat.com/0991e9e82fd2d65403bbe9399247fa92/invoke.js';
  adContainer.appendChild(script1);
  adContainer.appendChild(script2);
  // Show modal
  modal.classList.add('show');
  // 10s countdown before claim is enabled
  let seconds = 10;
  timerDiv.textContent = `⏳ Please watch the ad... ${seconds}s remaining`;
  // Mark which reward is in countdown
  adCountdownActive = {category, id};
  // Disable claim button for this reward
  renderRewards();
  adCountdownInterval && clearInterval(adCountdownInterval);
  adCountdownInterval = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      timerDiv.textContent = `⏳ Please watch the ad... ${seconds}s remaining`;
    } else {
      timerDiv.textContent = '✅ You can now claim your reward!';
      closeBtn.classList.add('enabled');
      closeBtn.removeAttribute('disabled');
      clearInterval(adCountdownInterval);
      adCountdownInterval = null;
      // Mark countdown as finished for this reward
      adCountdownActive = null;
      renderRewards();
    }
  }, 1000);
  // Close logic
  function closeModal() {
    modal.classList.remove('show');
    closeBtn.removeEventListener('click', closeModal);
    // Increment ads watched
    if (!state[category][id]) state[category][id] = {};
    state[category][id].adsWatched = (state[category][id].adsWatched || 0) + 1;
    saveState();
    renderRewards();
  }
  closeBtn.onclick = closeModal;
  // Prevent closing before timer
  modal.onclick = e => {
    if (e.target === modal && closeBtn.classList.contains('enabled')) {
      closeModal();
    }
  };
}

// --- Claim Logic ---
async function claimReward(category, id) {
  const currentUser = JSON.parse(localStorage.getItem('hexamc_currentUser'));
  if (!currentUser) {
    alert('Please log in to claim rewards');
    window.location.href = 'login.html';
    return;
  }

  const reward = REWARDS[category].find(r => r.id === id);
  if (!reward) return;

  const code = generateCode();
  
  // Save the code and set lock
  if (!state[category][id]) state[category][id] = {};
  state[category][id].code = code;
  state[category][id].lockUntil = Math.floor(Date.now() / 1000) + reward.lock;
  
  // Save state
  saveState();
  
  try {
    // Show loading state
    const claimBtn = document.querySelector(`[data-category="${category}"][data-id="${id}"] .claim-btn`);
    if (claimBtn) {
      const originalText = claimBtn.textContent;
      claimBtn.disabled = true;
      claimBtn.textContent = 'Processing...';
      
      // Send the reward claim
      const success = await sendRewardEmail(code, { ...reward, category });
      
      if (success) {
        // Show code modal on success
        showCodeModal(code, { ...reward, category });
      } else {
        alert('Failed to process your reward. Please try again.');
        // Reset the claim state if it fails
        state[category][id].code = undefined;
        state[category][id].lockUntil = undefined;
        saveState();
      }
      
      // Re-render to update UI
      renderRewards();
    }
  } catch (error) {
    console.error('Error claiming reward:', error);
    alert('An error occurred while processing your reward. Please try again.');
    
    // Reset the claim state on error
    state[category][id].code = undefined;
    state[category][id].lockUntil = undefined;
    saveState();
    renderRewards();
  }
}

// --- Code Modal Logic ---
let codeModalTimeout = null;
function showCodeModal(code, reward) {
  const modal = document.getElementById('code-modal');
  const codeDiv = document.getElementById('reward-code');
  const closeBtn = document.getElementById('code-modal-close');
  const copyBtn = document.getElementById('copy-code-btn');
  const timerDiv = document.getElementById('code-modal-timer');
  codeDiv.textContent = code;
  modal.classList.add('show');
  closeBtn.classList.add('enabled');
  closeBtn.removeAttribute('disabled');
  timerDiv.textContent = '';
  // Copy code
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(code).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 1200);
    });
  };
  // Close modal
  function closeModal() {
    modal.classList.remove('show');
    closeBtn.removeEventListener('click', closeModal);
  }
  closeBtn.onclick = closeModal;
  modal.onclick = e => {
    if (e.target === modal && closeBtn.classList.contains('enabled')) {
      closeModal();
    }
  };
}

// --- Navbar Hamburger ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderRewards();
  setInterval(renderRewards, 1000); // For countdowns
  // Hamburger menu
  const toggle = document.getElementById('navbar-toggle');
  const menu = document.getElementById('navbar-menu');
  if (toggle && menu) {
    toggle.onclick = () => {
      menu.classList.toggle('active');
    };
    document.body.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== toggle) {
        menu.classList.remove('active');
      }
    });
  }
}); 