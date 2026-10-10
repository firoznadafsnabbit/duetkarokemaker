/**
 * Duet Karaoke Maker - Ultra-Lite Browser Studio
 * 100% Client-Side + Lite Server Integration
 * Refactored: DRY Principles, Encapsulated Modules, Modern ES6+ Syntax
 */

// ==========================================
// 1. CONSTANTS & APPLICATION STATE
// ==========================================
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const CANVAS_DIVIDERS = [216, 432, 648, 864];
const SLOT_Y_POSITIONS = [324, 540, 756]; // Vertical centers of sections 2, 3, 4

const state = {
  audioFile: null,
  audioDuration: 0,
  audioElement: new Audio(),
  isPlaying: false,
  currentTime: 0,
  playbackRate: 1.0,

  // Real-Time Vocal Remover DSP Configuration
  vocalCutEnabled: false,
  vocalCutIntensity: 100,
  bassPreserveEnabled: true,

  // Typography & Colors
  fontSize: 85,
  color1: '#00FFFF',
  color2: '#FF00FF',
  color3: '#FFFF00',

  // Lyrics & Anti-Overlap Segments
  lyricsRaw: '',
  segments: [],

  // Tap-to-Sync State
  tapSyncIndex: 0,
  tapSyncLines: [],

  // Server & Render State
  ffmpegAvailable: false,
  isRendering: false,
  mediaRecorder: null,
  recordedChunks: []
};

// ==========================================
// 2. DOM ELEMENT REGISTRY
// ==========================================
const $ = (id) => document.getElementById(id);

const dom = {
  engineStatus: $('engine-status'),
  systemChip: $('system-chip'),

  // Audio Dropzone & Metadata
  audioDropzone: $('audio-dropzone'),
  audioFileInput: $('audio-file-input'),
  dropzonePrompt: $('dropzone-prompt'),
  audioLoadedCard: $('audio-loaded-card'),
  audioFilename: $('audio-filename'),
  audioDuration: $('audio-duration'),
  btnRemoveAudio: $('btn-remove-audio'),

  // Playback Controls
  btnPlayPause: $('btn-play-pause'),
  playIcon: $('play-icon'),
  pauseIcon: $('pause-icon'),
  timeDisplay: $('time-display'),
  timeScrubber: $('time-scrubber'),
  playbackSpeed: $('playback-speed'),


  // YouTube & 1-Click Auto-Pilot Studio
  autopilotHeroCard: $('autopilot-hero-card'),
  detectedLangBadge: $('detected-lang-badge'),
  tabSrcFile: $('tab-src-file'),
  tabSrcYt: $('tab-src-yt'),
  paneSrcFile: $('pane-src-file'),
  paneSrcYt: $('pane-src-yt'),
  chkAutoRenderVideo: $('chk-auto-render-video'),
  btnRunAutopilot: $('btn-run-autopilot'),
  autopilotStepper: $('autopilot-stepper'),
  stepperStatusTitle: $('stepper-status-title'),
  stepperPctLabel: $('stepper-pct-label'),
  stepperBarFill: $('stepper-bar-fill'),
  stepItem1: $('step-item-1'),
  stepItem2: $('step-item-2'),
  stepItem3: $('step-item-3'),
  stepItem4: $('step-item-4'),
  stepItem5: $('step-item-5'),
  youtubeImporterCard: $('youtube-importer-card'),
  ytUrlInput: $('yt-url-input'),
  btnFetchYt: $('btn-fetch-yt'),
  btnToggleYtKey: $('btn-toggle-yt-key'),
  ytKeyDrawer: $('yt-key-drawer'),
  ytApiKey: $('yt-api-key'),
  ytStatusBox: $('yt-status-box'),
  ytStatusText: $('yt-status-text'),

  // Color & Font Inputs
  color1: $('color-1'),
  color1Hex: $('color-1-hex'),
  color2: $('color-2'),
  color2Hex: $('color-2-hex'),
  color3: $('color-3'),
  color3Hex: $('color-3-hex'),
  fontSizeSlider: $('font-size-slider'),
  fontSizeVal: $('font-size-val'),

  // Lyrics Editor & Tap Sync Tabs
  tabEditor: $('tab-editor'),
  tabTapSync: $('tab-tap-sync'),
  paneEditor: $('pane-editor'),
  paneTapSync: $('pane-tap-sync'),
  lyricsTextarea: $('lyrics-textarea'),
  parsedCountBadge: $('parsed-count-badge'),
  btnFormatCheck: $('btn-format-check'),
  btnTapSyncAction: $('btn-tap-sync-action'),
  btnTapSyncReset: $('btn-tap-sync-reset'),
  tapSyncLinesList: $('tap-sync-lines-list'),

  // Stage & Canvas
  canvas: $('karaoke-canvas'),
  canvasGuide: $('canvas-guide'),
  chkShowGuides: $('chk-show-guides'),
  slotIndicator: $('slot-indicator'),
  btnFullscreen: $('btn-fullscreen'),
  stageWrapper: $('stage-wrapper'),

  // Export & Progress Elements
  btnRenderLive: $('btn-render-live'),
  btnRenderUniversal: $('btn-render-universal'),
  btnRenderBrowser: $('btn-render-browser'),
  btnRenderFfmpeg: $('btn-render-ffmpeg'),
  btnExportAss: $('btn-export-ass'),
  cardFfmpegExport: $('card-ffmpeg-export'),
  ffmpegDesc: $('ffmpeg-desc'),
  renderProgressCard: $('render-progress-card'),
  renderStatusText: $('render-status-text'),
  renderPercentageText: $('render-percentage-text'),
  progressBarFill: $('progress-bar-fill'),
  renderEta: $('render-eta'),
  btnCancelRender: $('btn-cancel-render'),
  downloadBanner: $('download-banner'),
  btnDownloadVideo: $('btn-download-video'),
  downloadFilenameSub: $('download-filename-sub'),
  renderedVideoWrapper: $('rendered-video-wrapper'),
  renderedVideoPlayer: $('rendered-video-player'),

  // Modal
  syntaxModal: $('syntax-modal'),
  btnCloseSyntax: $('btn-close-syntax'),
  btnSyntaxOk: $('btn-syntax-ok')
};

const ctx = dom.canvas.getContext('2d');

// ==========================================
// 3. TIME & COLOR UTILITIES (DRY)
// ==========================================
const TimeUtil = {
  toSeconds(str) {
    if (!str) return 0;
    const parts = str.trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  },

  toDisplay(seconds) {
    if (!seconds || seconds < 0 || isNaN(seconds)) return '00:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  },

  toAss(seconds) {
    if (!seconds || seconds < 0 || isNaN(seconds)) return '0:00:00.00';
    const hrs = Math.floor(seconds / 3600);
    const remainder = seconds % 3600;
    const mins = Math.floor(remainder / 60);
    const secs = remainder % 60;
    const cs = Math.round((secs - Math.floor(secs)) * 100);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(Math.floor(secs)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  },

  toCentiseconds(seconds) {
    return Math.max(0, Math.round((seconds || 0) * 100));
  }
};

const hexToAssColor = (hex) => {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const [r, g, b] = [clean.substring(0, 2), clean.substring(2, 4), clean.substring(4, 6)];
    return `&H00${b}${g}${r}`;
  }
  return '&H0000FFFF';
};

const readBlobAsDataUrl = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const readFileAsBase64 = async (input) => {
  if (!input) return '';
  if (typeof input === 'string') {
    if (input.startsWith('data:')) return input;
    try {
      const res = await fetch(input);
      const blob = await res.blob();
      return readBlobAsDataUrl(blob);
    } catch (_) {
      return '';
    }
  }
  if (input instanceof Blob) {
    return readBlobAsDataUrl(input);
  }
  if (input.serverAudioUrl || input.url) {
    try {
      const res = await fetch(input.serverAudioUrl || input.url);
      const blob = await res.blob();
      return readBlobAsDataUrl(blob);
    } catch (_) {
      return '';
    }
  }
  if (state.audioElement?.src) {
    try {
      const res = await fetch(state.audioElement.src);
      const blob = await res.blob();
      return readBlobAsDataUrl(blob);
    } catch (_) {
      return '';
    }
  }
  return '';
};

const assignProportionalWordTimings = (text, startTime, endTime) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const totalChars = words.reduce((acc, w) => acc + w.length, 0);
  const totalDuration = endTime - startTime;
  let cur = startTime;

  return words.map(w => {
    const dur = (w.length / Math.max(totalChars, 1)) * totalDuration;
    const item = { word: w, start: cur, end: cur + dur };
    cur += dur;
    return item;
  });
};

// ==========================================
// 4. REAL-TIME VOCAL REMOVER DSP ENGINE
// ==========================================
const VocalDspEngine = {
  ctx: null,
  sourceNode: null,
  mediaDest: null,
  dryGain: null,
  wetGain: null,
  bassGain: null,
  diffSummer: null,
  lowPass: null,
  highPass: null,
  splitter: null,
  invertGain: null,
  master: null,

  init(audioElement) {
    if (this.ctx && this.sourceNode) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.sourceNode = this.ctx.createMediaElementSource(audioElement);
      this.mediaDest = this.ctx.createMediaStreamDestination();

      // Dry Path (Clean unedited track)
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 1.0;
      this.sourceNode.connect(this.dryGain);

      // Wet Path (Vocal Elimination DSP)
      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0.0;

      // Bass Preservation: Low-pass filter below 175Hz keeps kick/bassline punchy
      this.lowPass = this.ctx.createBiquadFilter();
      this.lowPass.type = 'lowpass';
      this.lowPass.frequency.value = 175;
      this.lowPass.Q.value = 0.707;

      this.bassGain = this.ctx.createGain();
      this.bassGain.gain.value = 1.0;
      this.sourceNode.connect(this.lowPass);
      this.lowPass.connect(this.bassGain);
      this.bassGain.connect(this.wetGain);

      // Mid/High Vocal Inversion: High-pass crossover above 175Hz
      this.highPass = this.ctx.createBiquadFilter();
      this.highPass.type = 'highpass';
      this.highPass.frequency.value = 175;
      this.highPass.Q.value = 0.707;

      this.splitter = this.ctx.createChannelSplitter(2);
      this.invertGain = this.ctx.createGain();
      this.invertGain.gain.value = -1.0;

      this.diffSummer = this.ctx.createGain();
      this.diffSummer.gain.value = 0.75; // Stereo energy normalization

      this.sourceNode.connect(this.highPass);
      this.highPass.connect(this.splitter);

      // Left Channel -> diffSummer (+L)
      this.splitter.connect(this.diffSummer, 0);
      // Right Channel -> invertGain (-R) -> diffSummer
      this.splitter.connect(this.invertGain, 1);
      this.invertGain.connect(this.diffSummer);

      // Differential signal to wetGain
      this.diffSummer.connect(this.wetGain);

      // Master output
      this.master = this.ctx.createGain();
      this.master.gain.value = 1.0;
      this.dryGain.connect(this.master);
      this.wetGain.connect(this.master);

      // Route to physical speakers AND video recorder stream
      this.master.connect(this.ctx.destination);
      this.master.connect(this.mediaDest);

      this.update();
    } catch (e) {
      console.warn('[VocalDspEngine] Setup warning:', e);
    }
  },

  update() {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const now = this.ctx.currentTime;
    const isEnabled = state.vocalCutEnabled;
    const intensity = (state.vocalCutIntensity || 100) / 100;

    if (!isEnabled) {
      this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.wetGain.gain.setTargetAtTime(0.0, now, 0.02);
      if (dom.exportAudioModeTag) dom.exportAudioModeTag.textContent = 'Audio: Original Track';
    } else {
      const dryVal = Math.max(0, 1.0 - intensity);
      const wetVal = intensity * 1.35; // Boost perceived volume of differential track
      this.dryGain.gain.setTargetAtTime(dryVal, now, 0.02);
      this.wetGain.gain.setTargetAtTime(wetVal, now, 0.02);

      if (this.bassGain) {
        const bassVal = state.bassPreserveEnabled ? 1.15 : 0.0;
        this.bassGain.gain.setTargetAtTime(bassVal, now, 0.02);
      }
      if (dom.exportAudioModeTag) {
        dom.exportAudioModeTag.textContent = `Audio: Karaoke Filter (${state.vocalCutIntensity}%)`;
      }
    }
  },

  getAudioTracks() {
    return this.mediaDest ? this.mediaDest.stream.getAudioTracks() : [];
  }
};

// ==========================================
// 5. LYRIC PARSER & ANTI-OVERLAP SCHEDULER
// ==========================================
function parseManualTimestamps(text) {
  const PATTERN_BRACKET = /^\[\s*([\d:.]+)\s*-\s*([\d:.]+)\s*\](.*)$/;
  const PATTERN_COMMA = /^([\d:.]+)\s*,\s*([\d:.]+)(.*)$/;
  const PATTERN_TAG_PREFIX = /^(\[[123]\])\s*\[\s*([\d:.]+)\s*-\s*([\d:.]+)\s*\](.*)$/;

  const lines = text.split('\n');
  const rawSegments = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    let startStr = null;
    let endStr = null;
    let inlineLyric = null;

    const mb = line.match(PATTERN_BRACKET);
    const mc = line.match(PATTERN_COMMA);
    const mp = line.match(PATTERN_TAG_PREFIX);

    if (mp) {
      startStr = mp[2];
      endStr = mp[3];
      inlineLyric = `${mp[1]} ${mp[4]}`;
    } else if (mb) {
      startStr = mb[1];
      endStr = mb[2];
      inlineLyric = mb[3];
    } else if (mc) {
      startStr = mc[1];
      endStr = mc[2];
      inlineLyric = mc[3];
    }

    if (startStr && endStr) {
      const startSec = TimeUtil.toSeconds(startStr);
      const endSec = TimeUtil.toSeconds(endStr);
      let lyric = (inlineLyric || '').trim();

      // Check next line if lyrics are placed on adjacent line
      if (!lyric && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine.match(PATTERN_BRACKET) && !nextLine.match(PATTERN_COMMA)) {
          lyric = nextLine;
          i++;
        }
      }

      if (lyric) {
        let colorMode = 1;
        const colorMatch = lyric.match(/\[([123])\]/);
        if (colorMatch) {
          colorMode = parseInt(colorMatch[1], 10);
          lyric = lyric.replace(/\[[123]\]/, '').trim();
        }

        rawSegments.push({
          start: startSec,
          end: endSec,
          text: lyric,
          colorMode,
          words: assignProportionalWordTimings(lyric, startSec, endSec)
        });
      }
    }
    i++;
  }

  if (rawSegments.length === 0) return [];

  // --- ANTI-OVERLAP 5-SECTION 3-SLOT ASSIGNMENT ALGORITHM ---
  // 1. Initial visual visibility boundaries
  for (const seg of rawSegments) {
    seg.appear = Math.max(0.0, seg.start - 2.0);
    seg.disappear = Math.max(seg.end, seg.start + 2.0) + 1.5;
  }

  // 2. Strict collision resolution: lines sharing the same slot index never collide
  for (let idx = 3; idx < rawSegments.length; idx++) {
    const prevIdx = idx - 3;
    if (rawSegments[prevIdx].disappear > rawSegments[idx].appear) {
      const safeMid = (rawSegments[prevIdx].end + rawSegments[idx].start) / 2.0;
      rawSegments[prevIdx].disappear = safeMid;
      rawSegments[idx].appear = safeMid;
    }
  }

  // 3. Map slot indices and vertical positions (Sections 2, 3, 4 centers)
  rawSegments.forEach((seg, idx) => {
    seg.slot = idx % 3;
    seg.yPos = SLOT_Y_POSITIONS[idx % 3];
  });

  return rawSegments;
}

// ==========================================
// 6. ASS SUBTITLE GENERATOR
// ==========================================
function generateAssSubtitle() {
  const fontName = 'Noto Sans, Arial, sans-serif';
  const fontSize = parseInt(state.fontSize, 10);
  const [c1, c2, c3] = [hexToAssColor(state.color1), hexToAssColor(state.color2), hexToAssColor(state.color3)];

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke1,${fontName},${fontSize},${c1},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,3,5,0,0,0,1
Style: Karaoke2,${fontName},${fontSize},${c2},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,3,5,0,0,0,1
Style: Karaoke3,${fontName},${fontSize},${c3},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,3,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  state.segments.forEach((seg, i) => {
    const startStr = TimeUtil.toAss(seg.appear);
    const endStr = TimeUtil.toAss(seg.disappear);
    const yPos = 324 + ((i % 3) * 216);
    const posTag = `{\\pos(960,${yPos})}`;

    const leadInCs = TimeUtil.toCentiseconds(seg.start - seg.appear);
    let textToDisplay = leadInCs > 0 ? `{\\k${leadInCs}}` : '';

    let curTime = seg.start;
    for (const w of seg.words) {
      const wStart = w.start;
      const wEnd = w.end || (curTime + 0.1);
      const wText = (w.word || '').trim();
      if (!wText) continue;

      const gapCs = TimeUtil.toCentiseconds(wStart - curTime);
      if (gapCs > 0) textToDisplay += `{\\k${gapCs}}`;

      const durationCs = TimeUtil.toCentiseconds(wEnd - wStart);
      textToDisplay += `{\\kf${durationCs}}${wText} `;
      curTime = wEnd;
    }

    const styleName = `Karaoke${seg.colorMode || 1}`;
    ass += `Dialogue: 0,${startStr},${endStr},${styleName},,0,0,0,,${posTag}${textToDisplay}\n`;
  });

  return ass;
}

// ==========================================
// 7. REAL-TIME CANVAS KARAOKE RENDER ENGINE
// ==========================================
function renderCanvasFrame(t) {
  // Clear canvas to black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (state.segments.length === 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 44px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('1080p Duet Karaoke Canvas Ready', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 25);
    ctx.font = '400 28px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('Upload an audio file or paste a YouTube song to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
    ctx.restore();
    if (dom.slotIndicator) dom.slotIndicator.textContent = 'Active slots: None';
    return;
  }

  // Filter and slot active segments
  const activeSegments = state.segments.filter(seg => t >= seg.appear && t <= seg.disappear);
  const slotActive = [null, null, null];
  for (const seg of activeSegments) {
    slotActive[seg.slot] = seg;
  }

  // Render each active slot line
  for (let slot = 0; slot < 3; slot++) {
    const seg = slotActive[slot];
    if (!seg) continue;

    const singerColor = seg.colorMode === 1 ? state.color1 :
                        seg.colorMode === 2 ? state.color2 : state.color3;

    renderKaraokeLine(seg, t, seg.yPos, singerColor);
  }

  // Update slot monitor text
  dom.slotIndicator.textContent = slotActive
    .map((s, idx) => `Slot ${idx}: ${s ? 'Active' : 'Idle'}`)
    .join(' | ');
}

function renderKaraokeLine(seg, t, yPos, singerColor) {
  const words = seg.words || [];
  if (words.length === 0) return;

  const fontSize = parseInt(state.fontSize, 10);
  ctx.font = `bold ${fontSize}px "Outfit", "Noto Sans", Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  const spaceWidth = ctx.measureText(' ').width;
  const wordMetrics = words.map(w => ({
    text: w.word,
    width: ctx.measureText(w.word).width,
    start: w.start,
    end: w.end
  }));

  const totalLineWidth = wordMetrics.reduce((acc, m) => acc + m.width, 0) + (wordMetrics.length - 1) * spaceWidth;
  let currentX = (CANVAS_WIDTH - totalLineWidth) / 2;

  // Render words with outline stroke and karaoke sweep
  for (const wm of wordMetrics) {
    drawWord(wm, currentX, yPos, fontSize, singerColor, t);
    currentX += wm.width + spaceWidth;
  }
}

function drawWord(wm, x, y, fontSize, singerColor, t) {
  // 1. Text shadow & outline stroke
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(4, fontSize * 0.08);
  ctx.lineJoin = 'round';
  ctx.strokeText(wm.text, x, y);
  ctx.restore();

  // 2. Karaoke fill: White -> Progressive Gradient Sweep -> Singer Color
  if (t < wm.start) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(wm.text, x, y);
  } else if (t >= wm.end) {
    ctx.fillStyle = singerColor;
    ctx.fillText(wm.text, x, y);
  } else {
    const ratio = Math.max(0, Math.min(1, (t - wm.start) / Math.max(0.001, wm.end - wm.start)));
    const gradient = ctx.createLinearGradient(x, 0, x + wm.width, 0);
    gradient.addColorStop(0, singerColor);
    gradient.addColorStop(ratio, singerColor);
    gradient.addColorStop(Math.min(1, ratio + 0.001), '#FFFFFF');
    gradient.addColorStop(1, '#FFFFFF');

    ctx.fillStyle = gradient;
    ctx.fillText(wm.text, x, y);
  }
}

function animationLoop() {
  if (state.isPlaying && state.audioElement) {
    state.currentTime = state.audioElement.currentTime;
    dom.timeScrubber.value = state.currentTime;
    updateTimeDisplay();
  }
  renderCanvasFrame(state.currentTime);
  requestAnimationFrame(animationLoop);
}

function updateTimeDisplay() {
  dom.timeDisplay.textContent = `${TimeUtil.toDisplay(state.currentTime)} / ${TimeUtil.toDisplay(state.audioDuration)}`;
}

// ==========================================
// 8. AUDIO ENGINE & PLAYBACK CONTROLS
// ==========================================
function loadAudioFile(file) {
  state.audioFile = file;
  state.audioElement.src = URL.createObjectURL(file);
  dom.audioFilename.textContent = file.name;
  dom.dropzonePrompt.style.display = 'none';
  dom.audioLoadedCard.style.display = 'flex';

  state.audioElement.onloadedmetadata = () => {
    state.audioDuration = state.audioElement.duration || 0;
    dom.audioDuration.textContent = TimeUtil.toDisplay(state.audioDuration);
    dom.timeScrubber.max = state.audioDuration;
    updateTimeDisplay();
    renderCanvasFrame(0);
  };
}

function togglePlay() {
  if (!state.audioElement.src) {
    alert('Please upload an audio track or import from YouTube first.');
    return;
  }

  VocalDspEngine.init(state.audioElement);

  if (state.isPlaying) {
    state.audioElement.pause();
    state.isPlaying = false;
    dom.playIcon.style.display = 'block';
    dom.pauseIcon.style.display = 'none';
  } else {
    if (VocalDspEngine.ctx?.state === 'suspended') {
      VocalDspEngine.ctx.resume();
    }
    state.audioElement.play();
    state.isPlaying = true;
    dom.playIcon.style.display = 'none';
    dom.pauseIcon.style.display = 'block';
  }
}

// ==========================================
// 9. 1-CLICK AUTO-PILOT DUET STUDIO (ZERO-UPLOAD CLIENT ENGINE)
// ==========================================
function setAutopilotStep(step, message) {
  if (!dom.autopilotStepper) return;
  dom.autopilotStepper.style.display = 'flex';

  const percentages = { 0: 0, 1: 20, 2: 45, 3: 70, 4: 90, 5: 100 };
  const pct = percentages[step] ?? 0;

  if (dom.stepperBarFill) dom.stepperBarFill.style.width = `${pct}%`;
  if (dom.stepperPctLabel) dom.stepperPctLabel.textContent = `${pct}%`;
  if (dom.stepperStatusTitle) dom.stepperStatusTitle.textContent = message;

  for (let i = 1; i <= 5; i++) {
    const item = dom[`stepItem${i}`];
    if (item) {
      if (step === 0) {
        item.className = 'stepper-item';
      } else if (i < step) {
        item.className = 'stepper-item done';
      } else if (i === step) {
        item.className = 'stepper-item active';
      } else {
        item.className = 'stepper-item';
      }
    }
  }
}

function detectLanguageFromText(text) {
  if (!text) return 'English / International';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi (हिंदी)';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'Korean (한국어)';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'Japanese (日本語)';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'Chinese (中文)';
  if (/[\u0600-\u06FF]/.test(text)) return 'Arabic / Urdu';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'Tamil (தமிழ்)';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'Telugu (తెలుగు)';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'Kannada (ಕನ್ನಡ)';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'Malayalam (മലയാളം)';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'Gujarati (ગુજરાતી)';
  if (/[\u0980-\u09FF]/.test(text)) return 'Bengali (বাংলা)';
  if (/[\u0400-\u04FF]/.test(text)) return 'Russian (Русский)';
  if (/\b(?:que|para|por|con|como|este|esta|todo|amor|corazón|vida|noche|tú|yo)\b/i.test(text)) return 'Spanish (Español)';
  if (/\b(?:oui|mon|ton|son|avec|dans|pour|tout|chanson|amour|nous|vous)\b/i.test(text)) return 'French (Français)';
  if (/\b(?:und|der|die|das|nicht|ein|eine|mit|auch|liebe)\b/i.test(text)) return 'German (Deutsch)';
  if (/\b(?:tum|hum|dil|pyaar|ishq|meri|mera|tera|tere|teri|zindagi|saath|sanam|hai|ho|koi)\b/i.test(text)) return 'Hindi / Bollywood (Romanized)';
  return 'English / International';
}

function convertLrcToDuetKaraoke(lrcText, totalDuration) {
  const lines = lrcText.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];

  for (const line of lines) {
    const match = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/.exec(line);
    if (!match) continue;
    const mins = parseInt(match[1], 10);
    const secs = parseFloat(match[2]);
    const startSec = mins * 60 + secs;
    const text = match[3].trim();
    if (!text || /^(?:by:|ar:|ti:|al:|length:|re:)/i.test(text)) continue;
    parsed.push({ startSec, text });
  }

  if (parsed.length === 0) return '';

  const duetLines = [];
  for (let i = 0; i < parsed.length; i++) {
    const cur = parsed[i];
    const next = parsed[i + 1];
    let endSec = next ? next.startSec : Math.min(cur.startSec + 5.0, totalDuration || cur.startSec + 5.0);
    if (endSec <= cur.startSec) endSec = cur.startSec + 3.0;

    let text = cur.text;
    let tag = null;
    if (/\b(?:male|part 1|singer 1|he|him)\b/i.test(text)) {
      tag = '[1]';
      text = text.replace(/\[?(?:male|part 1|singer 1)\]?:?/gi, '').trim();
    } else if (/\b(?:female|part 2|singer 2|she|her)\b/i.test(text)) {
      tag = '[2]';
      text = text.replace(/\[?(?:female|part 2|singer 2)\]?:?/gi, '').trim();
    } else if (/\b(?:both|together|duet|chorus|all)\b/i.test(text)) {
      tag = '[3]';
      text = text.replace(/\[?(?:both|together|duet|chorus|all)\]?:?/gi, '').trim();
    }

    if (!tag) {
      const group = Math.floor(i / 2) % 3;
      tag = group === 0 ? '[1]' : (group === 1 ? '[2]' : '[3]');
    }

    const fmt = s => {
      const m = Math.floor(s / 60);
      const sec = (s % 60).toFixed(2);
      return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
    };

    duetLines.push(`${tag} [${fmt(cur.startSec)} - ${fmt(endSec)}] ${text}`);
  }

  return duetLines.join('\n');
}

function convertPlainLyricsToDuet(plainText, totalDuration) {
  const lines = plainText.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('[') && !l.startsWith('('));

  if (lines.length === 0) return '';

  const dur = Math.max(totalDuration || 180, 60);
  const startOffset = Math.min(8.0, dur * 0.05);
  const endOffset = Math.max(dur - 6.0, startOffset + 20.0);
  const lineDuration = Math.min(6.5, Math.max(3.0, (endOffset - startOffset) / lines.length));

  const fmt = s => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
  };

  const duetLines = [];
  for (let i = 0; i < lines.length; i++) {
    const startSec = startOffset + i * lineDuration;
    const endSec = Math.min(startSec + lineDuration - 0.3, dur - 1.0);
    const group = Math.floor(i / 2) % 3;
    const tag = group === 0 ? '[1]' : (group === 1 ? '[2]' : '[3]');
    duetLines.push(`${tag} [${fmt(startSec)} - ${fmt(endSec)}] ${lines[i]}`);
  }

  return duetLines.join('\n');
}

function generateMelodicDuetCues(title, totalDuration) {
  const dur = Math.max(totalDuration || 180, 60);
  const cueInterval = 10.0;
  const numCues = Math.floor((dur - 15.0) / cueInterval);

  const fmt = s => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
  };

  const cues = [];
  for (let i = 0; i < numCues; i++) {
    const startSec = 8.0 + i * cueInterval;
    const endSec = startSec + 8.5;
    const group = i % 3;
    const tag = group === 0 ? '[1]' : (group === 1 ? '[2]' : '[3]');
    const role = group === 0 ? 'Male Voice Melody' : (group === 1 ? 'Female Voice Melody' : 'Both Singing in Harmony');
    cues.push(`${tag} [${fmt(startSec)} - ${fmt(endSec)}] ${title} - ${role} (${i + 1})`);
  }

  return cues.join('\n');
}

async function askGeminiForDuet({ title, duration, existingLyrics, apiKey }) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are an expert audio & vocal arranger for Duet Karaoke songs.
Song Title: "${title}"
Approximate Duration: ${Math.round(duration)} seconds.
${existingLyrics ? `Reference Lyrics:\n${existingLyrics.slice(0, 3000)}\n` : ''}

Task:
1. Detect the primary singing language of this song.
2. Structure the song into a duet with 3 distinct singer assignments:
   - Part [1] for Male singer (or first lead)
   - Part [2] for Female singer (or second lead)
   - Part [3] for Both / Together (choruses, duets, climaxes, harmony)
3. Provide synchronized timestamps in format:
   [TAG] [MM:SS.SS - MM:SS.SS] Lyric Line text
   Example:
   [1] [00:15.00 - 00:20.50] Male line
   [2] [00:21.00 - 00:26.00] Female line
   [3] [00:27.00 - 00:34.00] Both singing together

Format strictly:
Line 1: LANGUAGE: <Language Name>
Remaining lines: only the timestamped duet karaoke lines.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2500 }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let language = '';
  const lyricLines = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.toUpperCase().startsWith('LANGUAGE:')) {
      language = trimmed.split(':', 2)[1].trim();
      continue;
    }
    if (/\[[123]\]\s*\[\d{2}:\d{2}/.test(trimmed)) {
      lyricLines.push(trimmed);
    }
  }

  return { language, lyrics: lyricLines.join('\n') };
}

async function runOneClickAutoDuet() {
  // STRICT AUTH GUARD: Must be signed in to generate songs
  if (window.KaraokeAuth && !window.KaraokeAuth.getCurrentUser()) {
    window.KaraokeAuth.openAuthModal('signin', 'Sign In Required: You must be signed in to generate karaoke songs!');
    return;
  }

  const isFileMode = dom.tabSrcFile?.classList.contains('active');
  const apiKey = (dom.ytApiKey?.value || localStorage.getItem('duet_gemini_api_key') || '').trim();
  if (apiKey) {
    try { localStorage.setItem('duet_gemini_api_key', apiKey); } catch (_) {}
  }

  let title = 'Duet Song';
  let duration = 180;
  let lyrics = '';
  let language = 'Duet Song';

  setAutopilotStep(1, '[1/4] Ingesting audio track & preparing analysis...');
  if (dom.btnRunAutopilot) {
    dom.btnRunAutopilot.disabled = true;
    dom.btnRunAutopilot.innerHTML = '<span>Processing Duet Karaoke Video...</span>';
  }

  try {
    if (isFileMode) {
      const file = state.audioFile;
      if (!file) {
        alert('Please upload a song file (MP3, WAV, etc.) or drag & drop one into the box first.');
        dom.audioFileInput?.click();
        return;
      }

      title = file.name.replace(/\.[^/.]+$/, '').replace(/[\-_]+/g, ' ').trim();

      // Ensure local audio is loaded into state.audioElement
      if (!state.audioElement.src || !state.audioElement.src.startsWith('blob:')) {
        state.audioElement.src = URL.createObjectURL(file);
      }

      // Read duration from file
      duration = await new Promise(resolve => {
        if (state.audioDuration > 0) return resolve(state.audioDuration);
        if (state.audioElement.duration && !isNaN(state.audioElement.duration)) {
          return resolve(state.audioElement.duration);
        }
        state.audioElement.onloadedmetadata = () => resolve(state.audioElement.duration || 180);
        setTimeout(() => resolve(state.audioElement.duration || 180), 2000);
      });
      state.audioDuration = duration;
      dom.audioFilename.textContent = file.name;
      dom.audioDuration.textContent = TimeUtil.toDisplay(duration);
      dom.timeScrubber.max = duration;
      dom.dropzonePrompt.style.display = 'none';
      dom.audioLoadedCard.style.display = 'flex';

      // Step 2: On-device client AI / LRCLIB lyrics search (Zero 4.5MB upload limit!)
      setAutopilotStep(2, apiKey
        ? '[2/4] Detecting singing language & separating Male [1] / Female [2] / Duet [3]...'
        : '[2/4] Searching synchronized lyrics database & assigning Male [1] / Female [2]...'
      );

      const cleanSearchTitle = title
        .replace(/[\(\[\{].*?[\)\]\}]/g, '')
        .replace(/\b(?:feat|ft|official|video|audio|lyrics|remix|hd|4k)\b/gi, '')
        .trim();

      let lrclibData = null;
      try {
        const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanSearchTitle || title)}`);
        if (searchRes.ok) {
          const items = await searchRes.json();
          if (Array.isArray(items) && items.length > 0) {
            lrclibData = items.find(it => it.syncedLyrics) || items[0];
          }
        }
      } catch (err) {
        console.warn('LRCLIB lookup warning:', err);
      }

      if (apiKey) {
        try {
          const geminiResult = await askGeminiForDuet({
            title: cleanSearchTitle || title,
            duration,
            existingLyrics: lrclibData?.syncedLyrics || lrclibData?.plainLyrics || '',
            apiKey
          });
          if (geminiResult.lyrics) {
            lyrics = geminiResult.lyrics;
            language = geminiResult.language || language;
          }
        } catch (gErr) {
          console.warn('Gemini API warning, using LRCLIB:', gErr);
        }
      }

      if (!lyrics && lrclibData) {
        if (lrclibData.syncedLyrics) {
          lyrics = convertLrcToDuetKaraoke(lrclibData.syncedLyrics, duration);
          language = detectLanguageFromText(`${cleanSearchTitle} ${lrclibData.trackName || ''} ${lyrics}`);
        } else if (lrclibData.plainLyrics) {
          lyrics = convertPlainLyricsToDuet(lrclibData.plainLyrics, duration);
          language = detectLanguageFromText(`${cleanSearchTitle} ${lrclibData.trackName || ''} ${lyrics}`);
        }
      }

      if (!lyrics) {
        lyrics = generateMelodicDuetCues(cleanSearchTitle || title, duration);
        language = detectLanguageFromText(cleanSearchTitle || title);
      }

    } else {
      // YouTube Mode
      const url = (dom.ytUrlInput?.value || '').trim();
      if (!url) {
        alert('Please paste a YouTube song link first (e.g. https://youtu.be/...)');
        dom.ytUrlInput?.focus();
        return;
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (isLocalHost) {
        setAutopilotStep(2, '[2/4] Ingesting YouTube audio stream & analyzing voices locally...');
        const res = await fetch('/api/auto-duet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, apiKey })
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`Server returned ${res.status}: ${text.slice(0, 100)}`);
        }
        if (!res.ok || data.status === 'error') {
          throw new Error(data.message || 'Failed to auto-generate duet.');
        }

        title = data.title;
        language = data.language || 'Duet Song';
        duration = data.duration || 180;
        lyrics = data.lyrics || '';

        state.audioFile = { name: `${title}.mp3`, serverAudioUrl: data.audioUrl };
        state.audioElement.src = data.audioUrl;
        dom.audioFilename.textContent = `${title} [${language}]`;
        dom.dropzonePrompt.style.display = 'none';
        dom.audioLoadedCard.style.display = 'flex';
      } else {
        // Vercel / Cloud Mode: Use oEmbed and direct lyrics search
        setAutopilotStep(2, '[2/4] Fetching YouTube metadata and synchronized lyrics...');
        let ytTitle = 'YouTube Duet';
        try {
          const oeRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          if (oeRes.ok) {
            const oeData = await oeRes.json();
            ytTitle = oeData.title || ytTitle;
          }
        } catch (_) {}

        title = ytTitle.replace(/[\(\[\{].*?[\)\]\}]/g, '').replace(/[\-_]+/g, ' ').trim();
        const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
        let lrclibData = null;
        if (searchRes.ok) {
          const items = await searchRes.json();
          if (Array.isArray(items) && items.length > 0) {
            lrclibData = items.find(it => it.syncedLyrics) || items[0];
          }
        }

        duration = lrclibData?.duration || 210;
        if (apiKey) {
          try {
            const gResult = await askGeminiForDuet({
              title,
              duration,
              existingLyrics: lrclibData?.syncedLyrics || lrclibData?.plainLyrics || '',
              apiKey
            });
            if (gResult.lyrics) {
              lyrics = gResult.lyrics;
              language = gResult.language || language;
            }
          } catch (_) {}
        }

        if (!lyrics && lrclibData) {
          if (lrclibData.syncedLyrics) {
            lyrics = convertLrcToDuetKaraoke(lrclibData.syncedLyrics, duration);
          } else if (lrclibData.plainLyrics) {
            lyrics = convertPlainLyricsToDuet(lrclibData.plainLyrics, duration);
          }
        }

        if (!lyrics) {
          lyrics = generateMelodicDuetCues(title, duration);
        }
        language = detectLanguageFromText(`${title} ${lyrics}`);

        dom.audioFilename.textContent = `${title} [${language}]`;
      }
    }

    // Step 3: Populate studio state
    setAutopilotStep(3, `[3/4] Detected "${language}": Arranging 5-section karaoke layout...`);

    if (lyrics) {
      dom.lyricsTextarea.value = lyrics;
      parseAndUpdateLyrics();
    }

    if (dom.detectedLangBadge) {
      dom.detectedLangBadge.textContent = `${language} (Male [1] & Female [2] Assigned)`;
      dom.detectedLangBadge.style.display = 'inline-flex';
    }

    renderCanvasFrame(0);

    const shouldAutoRender = dom.chkAutoRenderVideo ? dom.chkAutoRenderVideo.checked : true;

    if (shouldAutoRender && state.audioElement.src) {
      setAutopilotStep(4, '[4/4] Auto-Rendering 1080p MP4 Video...');
      await new Promise(r => setTimeout(r, 600));

      if (state.ffmpegAvailable) {
        await renderVideoWithFfmpeg();
      } else {
        await renderVideoLive();
      }

      setAutopilotStep(5, 'Complete: Your 1080p Duet Karaoke Video is ready for download.');
    } else {
      setAutopilotStep(5, `Complete: Lyrics, Male/Female separation, and timestamps generated for "${title}".`);
    }

  } catch (err) {
    console.error('[Auto Duet Error]', err);
    alert(`Auto Duet: ${err.message}`);
    setAutopilotStep(0, err.message);
  } finally {
    if (dom.btnRunAutopilot) {
      dom.btnRunAutopilot.disabled = false;
      dom.btnRunAutopilot.innerHTML = '<span>Generate Duet Karaoke Video</span>';
    }
  }
}

const handleYouTubeDuet = runOneClickAutoDuet;

// ==========================================
// 10. TAP-TO-SYNC WORKFLOW
// ==========================================
function setupTapSync() {
  const text = dom.lyricsTextarea.value.trim();
  const rawLines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('[Script') && !l.startsWith('Style:'));

  state.tapSyncLines = rawLines.map(line => {
    let clean = line
      .replace(/^\[\s*[\d:.]+\s*-\s*[\d:.]+\s*\]/, '')
      .replace(/^[\d:.]+\s*,\s*[\d:.]+/, '')
      .trim();
    return clean ? { text: clean, start: null, end: null } : null;
  }).filter(Boolean);

  state.tapSyncIndex = 0;
  renderTapSyncList();
}

function renderTapSyncList() {
  if (state.tapSyncLines.length === 0) {
    dom.tapSyncLinesList.innerHTML = '<p class="placeholder-text">Enter raw lyrics in the Text Editor first, then switch here to tap-sync them.</p>';
    return;
  }

  dom.tapSyncLinesList.innerHTML = '';
  state.tapSyncLines.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `tap-line-item ${idx === state.tapSyncIndex ? 'active' : ''} ${item.start !== null ? 'synced' : ''}`;
    const spanText = document.createElement('span');
    spanText.textContent = item.text || '';
    const spanTime = document.createElement('span');
    spanTime.style.fontFamily = 'var(--font-mono)';
    spanTime.style.color = '#00ffff';
    spanTime.textContent = timeStr;
    div.appendChild(spanText);
    div.appendChild(spanTime);
    dom.tapSyncLinesList.appendChild(div);
  });
}

function markTapSyncLine() {
  if (state.tapSyncIndex >= state.tapSyncLines.length) {
    alert('All lines have been synchronized! Exporting to Text Editor.');
    applyTapSyncToEditor();
    return;
  }

  const curT = state.currentTime;
  const item = state.tapSyncLines[state.tapSyncIndex];

  if (item.start === null) {
    item.start = curT;
    dom.btnTapSyncAction.innerHTML = '<span>⏱️ Mark End of Line</span>';
    renderTapSyncList();
  } else {
    item.end = curT;
    state.tapSyncIndex++;
    dom.btnTapSyncAction.innerHTML = '<span>⏱️ Mark Start of Line</span>';
    renderTapSyncList();

    if (state.tapSyncIndex >= state.tapSyncLines.length) {
      applyTapSyncToEditor();
    }
  }
}

function applyTapSyncToEditor() {
  const output = state.tapSyncLines.map((item, idx) => {
    const s = TimeUtil.toDisplay(item.start || idx * 4);
    const e = TimeUtil.toDisplay(item.end || (item.start || idx * 4) + 3.5);
    const tag = (item.text.includes('[2]') || item.text.includes('[3]')) ? '' : '[1] ';
    return `${tag}[${s} - ${e}] ${item.text}`;
  }).join('\n');

  dom.lyricsTextarea.value = output;
  parseAndUpdateLyrics();
  dom.tabEditor.click();
}

// ==========================================
// 11. UNIFIED VIDEO PRESENTATION & EXPORT (DRY)
// ==========================================
const presentRenderedVideo = ({ url, filename, description }) => {
  dom.renderProgressCard.style.display = 'none';
  dom.downloadBanner.style.display = 'flex';

  if (dom.downloadFilenameSub) {
    dom.downloadFilenameSub.textContent = description || `Rendering complete for "${filename}"! Click below to download.`;
  }

  dom.btnDownloadVideo.href = url;
  dom.btnDownloadVideo.download = filename;
  dom.btnDownloadVideo.style.display = 'inline-flex';

  if (dom.renderedVideoPlayer && dom.renderedVideoWrapper) {
    dom.renderedVideoPlayer.src = url;
    dom.renderedVideoWrapper.style.display = 'block';
    dom.renderedVideoPlayer.load();
  }

  dom.downloadBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

async function renderVideoLive() {
  // STRICT AUTH GUARD: Must be signed in to render video
  if (window.KaraokeAuth && !window.KaraokeAuth.getCurrentUser()) {
    window.KaraokeAuth.openAuthModal('signin', 'Sign In Required: You must be signed in to render karaoke songs!');
    return;
  }

  if (!state.audioElement.src) {
    alert('Please upload or import an audio file first.');
    return;
  }
  if (state.segments.length === 0) {
    alert('Please add lyrics with timestamps before rendering.');
    return;
  }

  state.isRendering = true;
  if (dom.btnRenderLive) dom.btnRenderLive.disabled = true;
  if (dom.btnRenderUniversal) dom.btnRenderUniversal.disabled = true;
  if (dom.downloadBanner) dom.downloadBanner.style.display = 'none';

  dom.renderProgressCard.style.display = 'flex';
  dom.renderStatusText.textContent = 'Rendering video live while playing...';
  dom.renderPercentageText.textContent = '0%';
  dom.progressBarFill.style.width = '0%';
  dom.renderEta.textContent = 'Playing canvas sweeps live. Download button will appear on completion.';

  dom.stageWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });

  VocalDspEngine.init(state.audioElement);
  if (VocalDspEngine.ctx?.state === 'suspended') {
    try { await VocalDspEngine.ctx.resume(); } catch (_) {}
  }

  let recorderStream = null;
  try {
    const canvasStream = dom.canvas.captureStream(30);
    const audioTracks = VocalDspEngine.getAudioTracks();
    recorderStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  } catch (e) {
    console.warn('[Stream Capture Warning]', e);
  }

  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
  if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';

  state.recordedChunks = [];
  if (recorderStream && window.MediaRecorder) {
    try {
      state.mediaRecorder = new MediaRecorder(recorderStream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });
      state.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
      };
      state.mediaRecorder.start(250);
    } catch (e) {
      console.warn('[MediaRecorder Warning]', e);
    }
  }

  state.audioElement.currentTime = 0;
  state.audioElement.playbackRate = 1.0;
  try {
    await state.audioElement.play();
  } catch (e) {
    console.warn('[Audio Play Warning]', e);
  }

  state.isPlaying = true;
  dom.playIcon.style.display = 'none';
  dom.pauseIcon.style.display = 'block';

  const duration = state.audioDuration || state.audioElement.duration || 30;
  let isFinalized = false;

  const finalizeRender = async () => {
    if (isFinalized) return;
    isFinalized = true;
    clearInterval(progressInterval);

    state.audioElement.pause();
    state.isPlaying = false;
    dom.playIcon.style.display = 'block';
    dom.pauseIcon.style.display = 'none';

    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
      await new Promise(resolve => {
        state.mediaRecorder.onstop = () => resolve();
        try { state.mediaRecorder.stop(); } catch (_) { resolve(); }
      });
    }

    dom.renderPercentageText.textContent = '100%';
    dom.progressBarFill.style.width = '100%';
    dom.renderStatusText.textContent = 'Finalizing canvas video output...';

    const recordedBlob = new Blob(state.recordedChunks, { type: mimeType });
    let finalVideoUrl = null;
    let isUniversalMp4 = false;

    // Convert via server FFmpeg to Universal MP4 if available
    if (state.ffmpegAvailable && recordedBlob.size > 0) {
      try {
        dom.renderStatusText.textContent = 'Generating Universal MP4 video...';
        const videoBase64 = await readFileAsBase64(recordedBlob);
        const resp = await fetch('/api/convert-recording', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoBase64, mimeType })
        });
        const res = await resp.json();
        if (res.success && res.downloadUrl) {
          finalVideoUrl = res.downloadUrl;
          isUniversalMp4 = true;
        }
      } catch (err) {
        console.warn('Canvas conversion to MP4 error, using recorded blob:', err);
      }
    }

    if (!finalVideoUrl) {
      finalVideoUrl = URL.createObjectURL(recordedBlob);
      isUniversalMp4 = mimeType.includes('mp4');
    }

    const baseName = state.audioFile ? state.audioFile.name.replace(/\.[^/.]+$/, '') : 'duet_song';
    const ext = isUniversalMp4 ? 'mp4' : 'webm';
    const filename = `${baseName}_duet_karaoke_1080p.${ext}`;

    presentRenderedVideo({
      url: finalVideoUrl,
      filename,
      description: `Rendering complete for "${filename}"! Exactly as seen in the Live Canvas Preview. Click below to download.`
    });

    if (dom.btnRenderLive) dom.btnRenderLive.disabled = false;
    if (dom.btnRenderUniversal) dom.btnRenderUniversal.disabled = false;
    state.isRendering = false;
  };

  const progressInterval = setInterval(() => {
    const cur = state.audioElement.currentTime;
    const pct = Math.min(99, Math.round((cur / Math.max(duration, 1)) * 100));
    dom.renderPercentageText.textContent = `${pct}%`;
    dom.progressBarFill.style.width = `${pct}%`;
    dom.renderEta.textContent = `Playing & Rendering: ${TimeUtil.toDisplay(cur)} of ${TimeUtil.toDisplay(duration)} (Download button will appear on finish)`;

    if (state.audioElement.ended || cur >= duration - 0.15) {
      finalizeRender();
    }
  }, 200);

  if (dom.btnCancelRender) {
    dom.btnCancelRender.onclick = () => finalizeRender();
  }
}

async function renderVideoWithFfmpeg() {
  // STRICT AUTH GUARD: Must be signed in to render video
  if (window.KaraokeAuth && !window.KaraokeAuth.getCurrentUser()) {
    window.KaraokeAuth.openAuthModal('signin', 'Sign In Required: You must be signed in to render karaoke songs!');
    return;
  }

  if (!state.ffmpegAvailable) {
    alert('FFmpeg was not detected on the server. Please install FFmpeg (via install_ffmpeg.bat) or use "Render & Watch Live Video".');
    return;
  }
  if (!state.audioFile) {
    alert('Please upload an audio file first.');
    return;
  }
  if (state.segments.length === 0) {
    alert('Please add lyrics with timestamps before rendering.');
    return;
  }

  dom.renderProgressCard.style.display = 'flex';
  dom.renderStatusText.textContent = 'Generating Universal MP4 video...';
  dom.renderPercentageText.textContent = 'Encoding H.264 High 4.1 + Faststart...';
  dom.progressBarFill.style.width = '65%';
  dom.renderEta.textContent = 'Rendering directly via server FFmpeg... Download button will be provided on completion.';

  try {
    let serverAudioFile = null;
    let base64Audio = '';
    const audioSrc = state.audioElement?.src || '';

    if (state.audioFile?.serverAudioUrl) {
      serverAudioFile = state.audioFile.serverAudioUrl;
    } else if (audioSrc.includes('/api/download/')) {
      serverAudioFile = audioSrc;
    }

    if (!serverAudioFile) {
      base64Audio = await readFileAsBase64(state.audioFile);
      if (!base64Audio) {
        throw new Error('Could not read audio data. Please select or upload an audio file.');
      }
    }

    const assText = generateAssSubtitle();
    const ext = (state.audioFile?.name ? state.audioFile.name.split('.').pop() : '') || 'mp3';

    const resp = await fetch('/api/render-ffmpeg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64Audio,
        audioExt: ext,
        assContent: assText,
        serverAudioFile
      })
    });

    const res = await resp.json();
    dom.renderProgressCard.style.display = 'none';

    if (res.success && res.downloadUrl) {
      const baseName = state.audioFile ? state.audioFile.name.replace(/\.[^/.]+$/, '') : 'duet_song';
      const filename = `${baseName}_universal_1080p.mp4`;

      presentRenderedVideo({
        url: res.downloadUrl,
        filename,
        description: `Ready: ${filename} (100% playable on Mobile, Laptop, Tab, TV & WhatsApp). Click below to download.`
      });
    } else {
      alert(`FFmpeg render error: ${res.error || 'Unknown error'}`);
    }
  } catch (err) {
    dom.renderProgressCard.style.display = 'none';
    alert(`Server communication error: ${err.message}`);
  }
}

// ==========================================
// 13. UI EVENT BINDINGS (DRY)
// ==========================================
function parseAndUpdateLyrics() {
  state.lyricsRaw = dom.lyricsTextarea.value;
  state.segments = parseManualTimestamps(state.lyricsRaw);
  dom.parsedCountBadge.textContent = `${state.segments.length} lines parsed`;
  renderCanvasFrame(state.currentTime);
}

// DRY Color Binding Helper: Replaces 40+ lines of duplicate color listeners
function bindColorSync(pickerEl, hexEl, stateProp) {
  if (!pickerEl || !hexEl) return;
  pickerEl.addEventListener('input', e => {
    state[stateProp] = e.target.value;
    hexEl.value = e.target.value;
    renderCanvasFrame(state.currentTime);
  });
  hexEl.addEventListener('input', e => {
    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
      state[stateProp] = e.target.value;
      pickerEl.value = e.target.value;
      renderCanvasFrame(state.currentTime);
    }
  });
}

function initEventListeners() {
  // Audio upload & Drag-and-Drop
  dom.audioDropzone.addEventListener('click', () => dom.audioFileInput.click());
  dom.audioFileInput.addEventListener('change', e => {
    if (e.target.files?.[0]) loadAudioFile(e.target.files[0]);
  });

  ['dragenter', 'dragover'].forEach(ev => {
    dom.audioDropzone.addEventListener(ev, e => {
      e.preventDefault();
      dom.audioDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    dom.audioDropzone.addEventListener(ev, e => {
      e.preventDefault();
      dom.audioDropzone.classList.remove('dragover');
      if (ev === 'drop' && e.dataTransfer?.files?.[0]) {
        loadAudioFile(e.dataTransfer.files[0]);
      }
    });
  });

  dom.btnRemoveAudio.addEventListener('click', e => {
    e.stopPropagation();
    state.audioElement.pause();
    state.isPlaying = false;
    state.audioFile = null;
    state.audioElement.src = '';
    dom.audioLoadedCard.style.display = 'none';
    dom.dropzonePrompt.style.display = 'flex';
    dom.playIcon.style.display = 'block';
    dom.pauseIcon.style.display = 'none';
    state.currentTime = 0;
    updateTimeDisplay();
  });

  // YouTube Duet Importer
  if (dom.btnToggleYtKey) {
    try {
      const savedKey = localStorage.getItem('duet_gemini_api_key');
      if (savedKey && dom.ytApiKey) dom.ytApiKey.value = savedKey;
    } catch (_) {}

    dom.btnToggleYtKey.addEventListener('click', () => {
      if (dom.ytKeyDrawer) {
        const isHidden = dom.ytKeyDrawer.style.display === 'none';
        dom.ytKeyDrawer.style.display = isHidden ? 'block' : 'none';
        if (isHidden) dom.ytApiKey?.focus();
      }
    });
  }

  // 1-Click Auto-Pilot Studio Source Tabs
  dom.tabSrcFile?.addEventListener('click', () => {
    dom.tabSrcFile.classList.add('active');
    dom.tabSrcYt.classList.remove('active');
    dom.paneSrcFile.classList.add('active');
    dom.paneSrcYt.classList.remove('active');
  });

  dom.tabSrcYt?.addEventListener('click', () => {
    dom.tabSrcYt.classList.add('active');
    dom.tabSrcFile.classList.remove('active');
    dom.paneSrcYt.classList.add('active');
    dom.paneSrcFile.classList.remove('active');
  });

  const executeGuarded = (fn) => {
    if (!window.KaraokeAuth) {
      alert('Authentication service is initializing. Please wait a moment...');
      return false;
    }
    const user = window.KaraokeAuth.getCurrentUser();
    if (!user) {
      window.KaraokeAuth.openAuthModal('signin', 'Sign In Required: You must be signed in to render karaoke songs!');
      return false;
    }
    return window.KaraokeAuth.guardCreditAction(fn);
  };

  dom.btnRunAutopilot?.addEventListener('click', () => executeGuarded(runOneClickAutoDuet));
  dom.btnFetchYt?.addEventListener('click', () => executeGuarded(runOneClickAutoDuet));
  dom.ytUrlInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeGuarded(runOneClickAutoDuet);
    }
  });

  // Player controls
  dom.btnPlayPause.addEventListener('click', togglePlay);
  dom.timeScrubber.addEventListener('input', e => {
    state.currentTime = parseFloat(e.target.value);
    state.audioElement.currentTime = state.currentTime;
    updateTimeDisplay();
    renderCanvasFrame(state.currentTime);
  });

  dom.playbackSpeed.addEventListener('change', e => {
    state.playbackRate = parseFloat(e.target.value);
    state.audioElement.playbackRate = state.playbackRate;
  });

  // Color Pickers & Hex Sync (DRY)
  bindColorSync(dom.color1, dom.color1Hex, 'color1');
  bindColorSync(dom.color2, dom.color2Hex, 'color2');
  bindColorSync(dom.color3, dom.color3Hex, 'color3');

  // Font Size Slider
  dom.fontSizeSlider.addEventListener('input', e => {
    state.fontSize = parseInt(e.target.value, 10);
    dom.fontSizeVal.textContent = `${state.fontSize}px`;
    renderCanvasFrame(state.currentTime);
  });

  // Lyrics Input
  dom.lyricsTextarea.addEventListener('input', parseAndUpdateLyrics);
  dom.btnFormatCheck.addEventListener('click', parseAndUpdateLyrics);

  // Tag Quick Inserts
  document.querySelectorAll('.tag-insert-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      const { selectionStart: start, selectionEnd: end, value: val } = dom.lyricsTextarea;
      dom.lyricsTextarea.value = `${val.substring(0, start)}${tag} ${val.substring(end)}`;
      dom.lyricsTextarea.focus();
      dom.lyricsTextarea.setSelectionRange(start + tag.length + 1, start + tag.length + 1);
      parseAndUpdateLyrics();
    });
  });

  // Tabs: Editor vs Tap-to-Sync
  dom.tabEditor.addEventListener('click', () => {
    dom.tabEditor.classList.add('active');
    dom.tabTapSync.classList.remove('active');
    dom.paneEditor.classList.add('active');
    dom.paneTapSync.classList.remove('active');
  });

  dom.tabTapSync.addEventListener('click', () => {
    dom.tabTapSync.classList.add('active');
    dom.tabEditor.classList.remove('active');
    dom.paneTapSync.classList.add('active');
    dom.paneEditor.classList.remove('active');
    setupTapSync();
  });

  dom.btnTapSyncAction.addEventListener('click', markTapSyncLine);
  dom.btnTapSyncReset.addEventListener('click', setupTapSync);

  // Guide Toggle & Fullscreen
  dom.chkShowGuides.addEventListener('change', e => {
    dom.canvasGuide.style.display = e.target.checked ? 'block' : 'none';
  });

  dom.btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      dom.stageWrapper.requestFullscreen().catch(err => alert(err.message));
    } else {
      document.exitFullscreen();
    }
  });

  // Export Buttons (Guarded)
  dom.btnExportAss?.addEventListener('click', () => {
    executeGuarded(() => {
      const assContent = generateAssSubtitle();
      const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'duet_karaoke.ass';
      a.click();
    });
  });

  dom.btnRenderLive?.addEventListener('click', () => executeGuarded(renderVideoLive));
  dom.btnRenderUniversal?.addEventListener('click', () => executeGuarded(renderVideoWithFfmpeg));
  dom.btnRenderBrowser?.addEventListener('click', () => executeGuarded(renderVideoLive));
  dom.btnRenderFfmpeg?.addEventListener('click', () => executeGuarded(renderVideoWithFfmpeg));

  // Syntax Modal (DRY)
  const toggleSyntaxModal = (show) => { dom.syntaxModal.style.display = show ? 'flex' : 'none'; };
  document.querySelector('.syntax-info')?.addEventListener('click', () => toggleSyntaxModal(true));
  dom.btnCloseSyntax.addEventListener('click', () => toggleSyntaxModal(false));
  dom.btnSyntaxOk.addEventListener('click', () => toggleSyntaxModal(false));

  // Global Spacebar shortcut
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (dom.paneTapSync.classList.contains('active')) {
        markTapSyncLine();
      } else {
        togglePlay();
      }
    }
  });
}

// ==========================================
// 14. BOOTSTRAP & STATUS
// ==========================================
async function checkServerStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.status === 'ok') {
      state.ffmpegAvailable = data.ffmpegAvailable;
      dom.engineStatus.textContent = data.ffmpegAvailable
        ? 'Universal MP4 Engine Ready (All Devices)'
        : 'Browser Engine Ready (Lite)';

      if (dom.ffmpegDesc) {
        dom.ffmpegDesc.textContent = data.ffmpegAvailable
          ? 'Hardware H.264 High 4.1 + AAC + Faststart. 100% playable on mobile, laptop, tab, TV & WhatsApp.'
          : 'FFmpeg not detected. Use in-browser 1080p render or run install_ffmpeg.bat.';
      }
    }
  } catch (_) {
    dom.engineStatus.textContent = 'Standalone Browser Engine Ready';
    if (dom.ffmpegDesc) {
      dom.ffmpegDesc.textContent = 'Running standalone. Use In-Browser 1080p Video render.';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkServerStatus();
  renderCanvasFrame(0);
  animationLoop();
});
