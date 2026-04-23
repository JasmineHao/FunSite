let speech = window.speechSynthesis;
let audioCtx = null;
let currentAudio = null;
let isPlaying = false;
let isPaused = false;
let paragraphs = [];
let currentP = 0;
let useBrowserTTS = true;
let pregenAudio = null;

// ===== DOM refs =====
const playBtn = document.getElementById('audio-play');
const stopBtn = document.getElementById('audio-stop');
const statusLabel = document.getElementById('audio-label');
const statusTitle = document.getElementById('audio-title');
const progressBar = document.getElementById('audio-progress');
const progressFill = document.getElementById('audio-progress-fill');
const curTimeEl = document.getElementById('audio-cur');
const totTimeEl = document.getElementById('audio-tot');
const voicePanel = document.getElementById('audio-voices');

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  paragraphs = Array.from(document.querySelectorAll('.chapter-body p'));
  detectAudioMode();
  populateVoiceList();
  updateStatus('点击播放开始朗读');
});

function detectAudioMode() {
  // Check if pre-generated audio exists
  const audioPath = document.body.dataset.audioPath;
  if (audioPath) {
    pregenAudio = new Audio(audioPath);
    pregenAudio.addEventListener('timeupdate', updateAudioProgress);
    pregenAudio.addEventListener('ended', onAudioEnded);
    pregenAudio.addEventListener('loadedmetadata', () => {
      totTimeEl.textContent = fmtTime(pregenAudio.duration);
    });
    useBrowserTTS = false;
    statusLabel.textContent = '高品质音频';
    return;
  }
  statusLabel.textContent = '浏览器朗读';
}

// ===== Browser TTS =====
function populateVoiceList() {
  const panel = document.getElementById('audio-voices');
  if (!panel) return;
  const voices = speech.getVoices().filter(v => v.lang.startsWith('zh'));
  panel.innerHTML = '';
  voices.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.textContent = v.name;
    btn.dataset.idx = i;
    btn.onclick = () => selectVoice(v, btn);
    panel.appendChild(btn);
  });
  if (!voices.length) {
    panel.innerHTML = '<button disabled>没有中文语音</button>';
  }
}

let selectedVoice = null;
function selectVoice(voice, btnEl) {
  selectedVoice = voice;
  document.querySelectorAll('.audio-voices button').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  document.getElementById('audio-voices').classList.remove('open');
}

function getVoice() {
  if (selectedVoice) return selectedVoice;
  const voices = speech.getVoices();
  return voices.find(v => v.lang === 'zh-CN' && v.name.includes('Tingting'))
    || voices.find(v => v.lang === 'zh-CN')
    || voices.find(v => v.lang.startsWith('zh'))
    || voices[0];
}

// ===== Playback =====
function togglePlay() {
  if (useBrowserTTS) {
    toggleBrowserTTS();
  } else {
    togglePreAudio();
  }
}

// Pre-generated audio
function togglePreAudio() {
  if (!pregenAudio) return;
  if (isPlaying) {
    pregenAudio.pause();
    isPlaying = false;
    isPaused = true;
    updatePlayBtn(false);
    statusLabel.textContent = '已暂停';
  } else {
    pregenAudio.play().catch(e => console.error(e));
    isPlaying = true;
    isPaused = false;
    updatePlayBtn(true);
    statusLabel.textContent = '播放中';
  }
}

function updateAudioProgress() {
  if (!pregenAudio) return;
  const pct = (pregenAudio.currentTime / pregenAudio.duration) * 100;
  progressFill.style.width = pct + '%';
  curTimeEl.textContent = fmtTime(pregenAudio.currentTime);
}

function onAudioEnded() {
  isPlaying = false;
  updatePlayBtn(false);
  progressFill.style.width = '100%';
  statusLabel.textContent = '播放完毕';
}

// Browser TTS
function toggleBrowserTTS() {
  if (isPlaying) {
    pauseBrowserTTS();
  } else {
    playBrowserTTS();
  }
}

function playBrowserTTS() {
  if (!paragraphs.length) return;
  if (isPaused) {
    speech.resume();
    isPaused = false;
    isPlaying = true;
    updatePlayBtn(true);
    return;
  }
  isPlaying = true;
  isPaused = false;
  updatePlayBtn(true);
  if (currentP >= paragraphs.length) currentP = 0;
  speakParagraph(currentP);
}

function pauseBrowserTTS() {
  speech.pause();
  isPaused = true;
  isPlaying = false;
  updatePlayBtn(false);
  updateStatus('已暂停');
}

function stopAll() {
  if (pregenAudio) {
    pregenAudio.pause();
    pregenAudio.currentTime = 0;
  }
  speech.cancel();
  isPlaying = false;
  isPaused = false;
  currentP = 0;
  updatePlayBtn(false);
  progressFill.style.width = '0%';
  curTimeEl.textContent = '0:00';
  paragraphs.forEach(p => p.style.background = 'transparent');
  updateStatus('已停止');
}

function speakParagraph(i) {
  if (i >= paragraphs.length) {
    stopAll();
    updateStatus('本章朗读完毕');
    return;
  }
  currentP = i;
  const text = paragraphs[i].textContent;
  updateStatus(`朗读中: ${text.slice(0, 28)}...`);
  updateTTSProgress();

  paragraphs.forEach((p, idx) => {
    p.style.transition = 'background 0.3s';
    p.style.background = idx === i ? 'rgba(245,158,11,0.06)' : 'transparent';
    p.style.borderRadius = '4px';
  });
  paragraphs[i].scrollIntoView({ behavior: 'smooth', block: 'center' });

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

function updateTTSProgress() {
  const pct = paragraphs.length ? (currentP / paragraphs.length) * 100 : 0;
  progressFill.style.width = pct + '%';
  // Simulate time for TTS
  const totalEst = paragraphs.length * 15; // ~15s per paragraph estimate
  const curEst = currentP * 15;
  curTimeEl.textContent = fmtTime(curEst);
  totTimeEl.textContent = fmtTime(totalEst);
}

// ===== Helpers =====
function updateStatus(msg) {
  if (statusTitle) statusTitle.textContent = msg;
}

function updatePlayBtn(playing) {
  if (playBtn) playBtn.innerHTML = playing ? '⏸' : '▶';
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function toggleVoices() {
  voicePanel.classList.toggle('open');
}

// Seek on progress bar click
if (progressBar) {
  progressBar.addEventListener('click', (e) => {
    if (pregenAudio && pregenAudio.duration) {
      const rect = progressBar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      pregenAudio.currentTime = pct * pregenAudio.duration;
    }
  });
}

// Voice loading
if (speech.onvoiceschanged !== undefined) {
  speech.onvoiceschanged = populateVoiceList;
}

// Close voice panel on outside click
document.addEventListener('click', (e) => {
  if (voicePanel && !voicePanel.contains(e.target) && !e.target.closest('#audio-settings-btn')) {
    voicePanel.classList.remove('open');
  }
});
