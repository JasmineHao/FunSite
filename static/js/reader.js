let speech = window.speechSynthesis;
let isPlaying = false;
let isPaused = false;
let paragraphs = [];
let currentP = 0;
let selectedVoice = null;
let fontSize = 18;
let isDark = false;

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  paragraphs = Array.from(document.querySelectorAll('.chapter-body p'));
  loadSettings();
  applyFontSize();
  applyTheme();
  updateProgress();
  setupTapZone();
  populateVoices();
  setupScrollProgress();
});

// ===== Settings (persisted) =====
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('reader_settings') || '{}');
    fontSize = s.fontSize || 18;
    isDark = s.isDark || false;
    if (s.voiceName) {
      const voices = speech.getVoices();
      selectedVoice = voices.find(v => v.name === s.voiceName);
    }
  } catch(e) {}
}

function saveSettings() {
  localStorage.setItem('reader_settings', JSON.stringify({
    fontSize, isDark,
    voiceName: selectedVoice?.name
  }));
}

// ===== Tap to toggle menu =====
function setupTapZone() {
  const zone = document.querySelector('.tap-zone');
  if (!zone) return;
  zone.addEventListener('click', (e) => {
    // Don't toggle if clicking on a link or interactive element
    if (e.target.closest('a') || e.target.closest('button')) return;
    toggleMenu();
  });
}

function toggleMenu() {
  const menu = document.getElementById('reader-menu');
  const topbar = document.querySelector('.reader-topbar');
  const bottombar = document.querySelector('.reader-bottombar');
  
  if (menu.classList.contains('open')) {
    menu.classList.remove('open');
    topbar.classList.add('hidden');
    bottombar.classList.add('hidden');
  } else {
    menu.classList.add('open');
    topbar.classList.remove('hidden');
    bottombar.classList.remove('hidden');
  }
}

function closeMenu() {
  document.getElementById('reader-menu').classList.remove('open');
  document.querySelector('.reader-topbar').classList.add('hidden');
  document.querySelector('.reader-bottombar').classList.add('hidden');
}

// ===== Scroll Progress =====
function setupScrollProgress() {
  window.addEventListener('scroll', updateProgress, { passive: true });
}

function updateProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  
  const fill = document.querySelector('.progress-fill');
  if (fill) fill.style.width = pct + '%';
  
  const text = document.querySelector('.progress-text');
  if (text) text.textContent = `${Math.round(pct)}%`;
}

// ===== Font Size =====
function changeFontSize(delta) {
  fontSize = Math.max(14, Math.min(26, fontSize + delta));
  applyFontSize();
  saveSettings();
}

function applyFontSize() {
  const body = document.querySelector('.chapter-body');
  if (body) body.style.fontSize = fontSize + 'px';
}

// ===== Theme =====
function toggleTheme() {
  isDark = !isDark;
  applyTheme();
  saveSettings();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

// ===== Voice Selection =====
function populateVoices() {
  const container = document.getElementById('voice-list');
  if (!container) return;
  
  const voices = speech.getVoices().filter(v => v.lang.startsWith('zh'));
  container.innerHTML = '';
  
  voices.forEach(v => {
    const btn = document.createElement('button');
    btn.className = 'voice-chip' + (selectedVoice?.name === v.name ? ' active' : '');
    btn.textContent = v.name.replace('Microsoft ', '').replace('Neural', '');
    btn.onclick = () => selectVoice(v, btn);
    container.appendChild(btn);
  });
  
  if (!voices.length) {
    container.innerHTML = '<span class="voice-chip">加载中...</span>';
  }
}

function selectVoice(voice, btnEl) {
  selectedVoice = voice;
  document.querySelectorAll('.voice-chip').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  saveSettings();
}

function getVoice() {
  if (selectedVoice) return selectedVoice;
  const voices = speech.getVoices();
  return voices.find(v => v.lang === 'zh-CN' && v.name.includes('Xiaoxiao'))
    || voices.find(v => v.lang === 'zh-CN')
    || voices.find(v => v.lang.startsWith('zh'))
    || voices[0];
}

// ===== TTS Playback =====
function togglePlay() {
  const btn = document.getElementById('menu-play-btn');
  
  if (isPlaying) {
    pauseTTS();
    if (btn) { btn.innerHTML = '<span class="icon">▶</span>朗读'; btn.classList.remove('active'); }
  } else {
    playTTS();
    if (btn) { btn.innerHTML = '<span class="icon">⏸</span>暂停'; btn.classList.add('active'); }
  }
}

function playTTS() {
  if (!paragraphs.length) return;
  
  if (isPaused) {
    speech.resume();
    isPaused = false;
    isPlaying = true;
    return;
  }
  
  isPlaying = true;
  isPaused = false;
  if (currentP >= paragraphs.length) currentP = 0;
  speakParagraph(currentP);
}

function pauseTTS() {
  speech.pause();
  isPaused = true;
  isPlaying = false;
}

function stopTTS() {
  speech.cancel();
  isPlaying = false;
  isPaused = false;
  currentP = 0;
  paragraphs.forEach(p => { p.classList.remove('reading'); p.style.background = ''; });
  const btn = document.getElementById('menu-play-btn');
  if (btn) { btn.innerHTML = '<span class="icon">▶</span>朗读'; btn.classList.remove('active'); }
}

function speakParagraph(i) {
  if (i >= paragraphs.length) {
    stopTTS();
    return;
  }
  currentP = i;
  
  paragraphs.forEach((p, idx) => {
    p.classList.toggle('reading', idx === i);
  });
  paragraphs[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  const text = paragraphs[i].textContent;
  const utt = new SpeechSynthesisUtterance(text);
  utt.voice = getVoice();
  utt.lang = 'zh-CN';
  utt.rate = 0.95;
  utt.pitch = 1;
  utt.volume = 1;
  utt.onend = () => speakParagraph(i + 1);
  utt.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.error('TTS error:', e);
    }
  };
  speech.speak(utt);
}

// Voice loading
if (speech.onvoiceschanged !== undefined) {
  speech.onvoiceschanged = populateVoices;
}
