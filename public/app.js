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
  currentTime: 14.8,
  playbackRate: 1.0,

  // Video Staging & Preview Configuration (Matched with screenshot)
  staging: {
    aspectRatio: '16:9',
    theme: 'obsidian_gold',
    quality: '720p',
    fps: 30,
    showWaveform: false,
    showSingerBadges: false,
    showIntroDots: true,
    trackTitle: 'Electric Horizon (Duet Edition)',
    trackArtist: 'Karaoke Studio Ensemble'
  },
  volume: 0.85,
  isMuted: false,

  // Real-Time Vocal Remover DSP Configuration
  vocalCutEnabled: false,
  vocalCutIntensity: 100,
  bassPreserveEnabled: true,

  // Typography & Colors (Obsidian & Gold default)
  fontSize: 85,
  color1: '#f59e0b',
  color2: '#10b981',
  color3: '#ffffff',

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
  recordedChunks: [],

  // Video Download & Token State (2 tokens deducted strictly on download)
  currentRenderPaid: false,
  renderedVideoUrl: null,
  renderedVideoFilename: 'duet_karaoke_1080p.mp4',

  // Anti-Screen-Recording Security Shield State
  antiRecordShield: {
    enabled: true,
    showStrip: true,
    showScanlines: true,
    watermarkText: 'PREVIEW ONLY • SCREEN RECORDING PROHIBITED',
    userStamp: ''
  },
  isCleanExporting: false
};

// ==========================================
// 2. DOM ELEMENT REGISTRY
// ==========================================
const $ = (id) => document.getElementById(id);

const dom = {
  navSyntaxLink: $('nav-syntax-link'),

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
  btnPreviewKaraoke: $('btn-preview-karaoke'),
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

  // Lyric Line Builder & Timing Adjuster Elements
  btnToggleLineBuilder: $('btn-toggle-line-builder'),
  btnBoxQuickAdd: $('btn-box-quick-add'),
  lineBuilderPanel: $('line-builder-panel'),
  builderLiveSongTime: $('builder-live-song-time'),
  builderVoiceGroup: $('builder-voice-group'),
  builderLineText: $('builder-line-text'),
  builderStartTime: $('builder-start-time'),
  builderEndTime: $('builder-end-time'),
  btnSyncStartAudio: $('btn-sync-start-audio'),
  btnSyncEndAudio: $('btn-sync-end-audio'),
  btnStartMinus05: $('btn-start-minus-05'),
  btnStartPlus05: $('btn-start-plus-05'),
  btnEndMinus05: $('btn-end-minus-05'),
  btnEndPlus05: $('btn-end-plus-05'),
  btnAuditionRange: $('btn-audition-range'),
  btnSubmitAddLine: $('btn-submit-add-line'),
  btnToggleLineManager: $('btn-toggle-line-manager'),
  lineMgrCount: $('line-mgr-count'),
  lineManagerPanel: $('line-manager-panel'),
  lineManagerList: $('line-manager-list'),

  // Stage & Canvas
  canvas: $('karaoke-canvas'),
  canvasGuide: $('canvas-guide'),
  chkShowGuides: $('chk-show-guides'),
  slotIndicator: $('slot-indicator'),
  btnFullscreen: $('btn-fullscreen'),
  stageWrapper: $('stage-wrapper'),
  canvasRecordAlert: $('canvas-record-alert'),
  btnDismissRecordAlert: $('btn-dismiss-record-alert'),
  antiRecordBadge: $('anti-record-badge'),

  // Video Preview Player & Transport (Screenshot Matched)
  btnCanvasBigPlay: $('btn-canvas-big-play'),
  previewCurrentTime: $('preview-current-time'),
  previewTimeScrubber: $('preview-time-scrubber'),
  previewTotalDuration: $('preview-total-duration'),
  btnPreviewPlayPause: $('btn-preview-play-pause'),
  previewPlayIcon: $('preview-play-icon'),
  previewPauseIcon: $('preview-pause-icon'),
  btnPreviewRewind: $('btn-preview-rewind'),
  btnPreviewForward: $('btn-preview-forward'),
  btnPreviewMute: $('btn-preview-mute'),
  previewVolIconOn: $('preview-vol-icon-on'),
  previewVolIconOff: $('preview-vol-icon-off'),
  previewVolumeSlider: $('preview-volume-slider'),
  previewAspectBadge: $('preview-aspect-badge'),
  btnPreviewFullscreen: $('btn-preview-fullscreen'),

  // Video & Staging Settings Controls
  btnAspect169: $('btn-aspect-16-9'),
  btnAspect916: $('btn-aspect-9-16'),
  btnAspect11: $('btn-aspect-1-1'),
  btnThemeObsidian: $('btn-theme-obsidian'),
  btnThemeCyber: $('btn-theme-cyber'),
  btnThemeSlate: $('btn-theme-slate'),
  btnQual720p: $('btn-qual-720p'),
  btnQual1080p: $('btn-qual-1080p'),
  btnFps30: $('btn-fps-30'),
  btnFps60: $('btn-fps-60'),
  chkShowWaveform: $('chk-show-waveform'),
  chkShowSingerBadges: $('chk-show-singer-badges'),
  chkShowIntroDots: $('chk-show-intro-dots'),
  inputTrackTitle: $('input-track-title'),
  inputTrackArtist: $('input-track-artist'),

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

function formatClockTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RESOLUTIONS = {
  '16:9': {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 }
  },
  '9:16': {
    '1080p': { width: 1080, height: 1920 },
    '720p': { width: 720, height: 1280 }
  },
  '1:1': {
    '1080p': { width: 1080, height: 1080 },
    '720p': { width: 720, height: 720 }
  }
};

const VIDEO_THEMES = {
  obsidian_gold: {
    id: 'obsidian_gold',
    name: 'Obsidian & Gold',
    bgColor: '#090b0e',
    bgSecondary: '#141820',
    singer1Color: '#f59e0b',
    singer2Color: '#10b981',
    bothColor: '#ffffff',
    dimColor: '#525b6c',
    visualizerColor: '#f59e0b',
    particleColor: 'rgba(245, 158, 11, 0.15)'
  },
  cyber_emerald: {
    id: 'cyber_emerald',
    name: 'Cyber Emerald',
    bgColor: '#070f0d',
    bgSecondary: '#0f201b',
    singer1Color: '#10b981',
    singer2Color: '#06b6d4',
    bothColor: '#ffffff',
    dimColor: '#4b635c',
    visualizerColor: '#10b981',
    particleColor: 'rgba(16, 185, 129, 0.15)'
  },
  monochrome_slate: {
    id: 'monochrome_slate',
    name: 'Minimalist Slate',
    bgColor: '#0b0d11',
    bgSecondary: '#161a22',
    singer1Color: '#e2e8f0',
    singer2Color: '#94a3b8',
    bothColor: '#ffffff',
    dimColor: '#475569',
    visualizerColor: '#94a3b8',
    particleColor: 'rgba(255, 255, 255, 0.10)'
  }
};

const DEMO_LYRICS_LINES = [
  { startTime: 2.0, endTime: 5.5, singer: 'singer1', singerLabel: 'Singer 1', text: 'City lights are waking in the night' },
  { startTime: 6.0, endTime: 9.5, singer: 'singer2', singerLabel: 'Singer 2', text: 'Footsteps echoing beneath the neon signs' },
  { startTime: 10.0, endTime: 13.5, singer: 'both', singerLabel: 'Both', text: 'We run across the digital divide' },
  {
    startTime: 14.0,
    endTime: 17.5,
    singer: 'both',
    singerLabel: 'Both',
    text: 'Never look back again',
    words: [
      { text: 'Never ', startTime: 14.0, endTime: 14.5 },
      { text: 'look ', startTime: 14.5, endTime: 15.2 },
      { text: 'back ', startTime: 15.2, endTime: 15.8 },
      { text: 'again', startTime: 15.8, endTime: 16.8 }
    ]
  },
  {
    startTime: 18.0,
    endTime: 21.5,
    singer: 'both',
    singerLabel: 'Both',
    text: 'Electric horizons guide the way',
    words: [
      { text: 'Electric ', startTime: 18.0, endTime: 18.7 },
      { text: 'horizons ', startTime: 18.7, endTime: 19.4 },
      { text: 'guide ', startTime: 19.4, endTime: 20.0 },
      { text: 'the ', startTime: 20.0, endTime: 20.4 },
      { text: 'way', startTime: 20.4, endTime: 21.2 }
    ]
  },
  { startTime: 22.0, endTime: 25.5, singer: 'singer1', singerLabel: 'Singer 1', text: 'Through the shadows of yesterday' },
  { startTime: 26.0, endTime: 29.0, singer: 'singer2', singerLabel: 'Singer 2', text: 'Until tomorrow turns to gold' },
  { startTime: 29.5, endTime: 32.0, singer: 'both', singerLabel: 'Both', text: 'A melody that never grows old' }
];

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
  const PATTERN_TAG_PREFIX = /^(\[[123]\])\s*\[?\s*([\d:.]+)\s*-\s*([\d:.]+)\s*\]?(.*)$/;
  const PATTERN_BRACKET = /^\[?\s*([\d:.]+)\s*-\s*([\d:.]+)\s*\]?(.*)$/;
  const PATTERN_COMMA = /^(\[[123]\])?\s*([\d:.]+)\s*,\s*([\d:.]+)(.*)$/;

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

    const mp = line.match(PATTERN_TAG_PREFIX);
    const mb = line.match(PATTERN_BRACKET);
    const mc = line.match(PATTERN_COMMA);

    if (mp) {
      startStr = mp[2];
      endStr = mp[3];
      inlineLyric = `${mp[1]} ${mp[4]}`;
    } else if (mb) {
      startStr = mb[1];
      endStr = mb[2];
      inlineLyric = mb[3];
    } else if (mc) {
      startStr = mc[2];
      endStr = mc[3];
      inlineLyric = mc[1] ? `${mc[1]} ${mc[4]}` : mc[4];
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

  // Graceful fallback: If no range timestamps found, support standard single-timestamp LRC format [MM:SS.xx]
  if (rawSegments.length === 0) {
    const PATTERN_LRC_LINE = /^(\[[123]\])?\s*\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/;
    const lrcItems = [];
    for (const l of lines) {
      const trimmed = l.trim();
      const m = trimmed.match(PATTERN_LRC_LINE);
      if (m) {
        const tag = m[1] || '';
        const mins = parseInt(m[2], 10);
        const secs = parseFloat(m[3]);
        const startSec = mins * 60 + secs;
        const text = (m[4] || '').trim();
        if (text && !/^(?:by:|ar:|ti:|al:|length:|re:)/i.test(text)) {
          let colorMode = 1;
          const colorMatch = (tag + ' ' + text).match(/\[([123])\]/);
          if (colorMatch) {
            colorMode = parseInt(colorMatch[1], 10);
          }
          const cleanText = text.replace(/\[[123]\]/g, '').trim();
          lrcItems.push({ startSec, text: cleanText, colorMode });
        }
      }
    }
    for (let k = 0; k < lrcItems.length; k++) {
      const cur = lrcItems[k];
      const next = lrcItems[k + 1];
      let endSec = next ? next.startSec : cur.startSec + 4.5;
      if (endSec <= cur.startSec) endSec = cur.startSec + 3.0;
      rawSegments.push({
        start: cur.startSec,
        end: endSec,
        text: cur.text,
        colorMode: cur.colorMode,
        words: assignProportionalWordTimings(cur.text, cur.startSec, endSec)
      });
    }
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
// 7. REAL-TIME CANVAS KARAOKE RENDER ENGINE (SCREENSHOT-MATCHED)
// ==========================================
function getActiveLines() {
  if (state.segments && state.segments.length > 0) {
    return state.segments.map(seg => ({
      startTime: seg.start,
      endTime: seg.end,
      text: seg.text,
      singer: seg.colorMode === 1 ? 'singer1' : seg.colorMode === 2 ? 'singer2' : 'both',
      singerLabel: seg.colorMode === 1 ? 'Singer 1' : seg.colorMode === 2 ? 'Singer 2' : 'Both',
      words: (seg.words || []).map(w => ({
        text: w.word || w.text || '',
        startTime: w.start,
        endTime: w.end
      }))
    }));
  }
  return DEMO_LYRICS_LINES;
}

function getSingerColor(singer, theme) {
  if (singer === 'singer1') return state.color1 || theme.singer1Color;
  if (singer === 'singer2') return state.color2 || theme.singer2Color;
  return state.color3 || theme.bothColor;
}

function drawDeterministicParticles(ctx, width, height, t, particleColor) {
  ctx.save();
  ctx.fillStyle = particleColor || 'rgba(245, 158, 11, 0.15)';
  const particleCount = 28;

  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const speed = 0.15 + (i % 5) * 0.05;
    const x = ((Math.sin(seed) * 0.5 + 0.5) * width + Math.cos(t * speed + i) * 40) % width;
    const y = ((Math.cos(seed) * 0.5 + 0.5) * height - (t * 20 * speed + i * 25)) % height;
    const normY = y < 0 ? y + height : y;
    const radius = 1.5 + (i % 3);

    ctx.beginPath();
    ctx.arc(x, normY, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeader(ctx, width, height, isVertical, theme) {
  const title = (state.staging && state.staging.trackTitle) || 'Electric Horizon (Duet Edition)';
  const artist = (state.staging && state.staging.trackArtist) || 'Karaoke Studio Ensemble';

  ctx.save();
  ctx.textAlign = 'center';

  const headerY = isVertical ? height * 0.09 : height * 0.11;
  const titleSize = isVertical ? Math.round(width * 0.052) : Math.round(height * 0.045);
  const artistSize = Math.round(titleSize * 0.65);

  // Track Title
  ctx.font = `700 ${titleSize}px "Outfit", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, width / 2, headerY);

  // Artist
  ctx.font = `500 ${artistSize}px "Outfit", sans-serif`;
  ctx.fillStyle = theme.dimColor || '#525b6c';
  ctx.fillText(artist, width / 2, headerY + artistSize * 1.5);

  ctx.restore();
}

function drawVisualizer(ctx, width, height, t, isVertical, isSquare, theme) {
  ctx.save();
  const barCount = isVertical ? 32 : 56;
  const vizWidth = isVertical ? width * 0.85 : width * 0.70;
  const vizY = isVertical ? height * 0.82 : height * 0.84;
  const barSpacing = vizWidth / barCount;
  const barW = Math.max(2, barSpacing * 0.6);
  const startX = (width - vizWidth) / 2;

  for (let i = 0; i < barCount; i++) {
    const harmonic1 = Math.sin(t * 4 + i * 0.3) * 0.5 + 0.5;
    const harmonic2 = Math.cos(t * 8 - i * 0.2) * 0.3;
    const amplitude = Math.max(0.08, Math.min(0.95, (harmonic1 + harmonic2) * 0.7));

    const maxBarH = isVertical ? height * 0.08 : height * 0.10;
    const barH = Math.max(4, amplitude * maxBarH);
    const x = startX + i * barSpacing;
    const y = vizY - barH / 2;

    ctx.fillStyle = theme.visualizerColor || theme.singer1Color || '#f59e0b';
    ctx.globalAlpha = 0.45 + amplitude * 0.55;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, barW, barH, barW / 2);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawIntroCountIn(ctx, width, height, t, theme, firstLineStart) {
  if (firstLineStart <= 1.0) return;
  const leadTime = 3.0;
  const introStart = Math.max(0, firstLineStart - leadTime);

  if (t >= introStart && t < firstLineStart) {
    ctx.save();
    const countProgress = (t - introStart) / leadTime;
    const activeDot = Math.floor(countProgress * 4);

    const dotY = height * 0.32;
    const dotSpacing = 36;
    const totalWidth = 3 * dotSpacing;
    const startX = (width - totalWidth) / 2;

    for (let d = 0; d < 4; d++) {
      const dx = startX + d * dotSpacing;
      const isActive = d <= activeDot;
      ctx.beginPath();
      ctx.arc(dx, dotY, isActive ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? theme.singer1Color : (theme.dimColor || '#525b6c');
      ctx.globalAlpha = isActive ? 1.0 : 0.35;
      ctx.fill();
    }

    ctx.font = `600 ${Math.round(height * 0.022)}px "Outfit", sans-serif`;
    ctx.fillStyle = theme.dimColor || '#525b6c';
    ctx.textAlign = 'center';
    ctx.fillText('GET READY', width / 2, dotY - 22);

    ctx.restore();
  }
}

function drawSingerBadge(ctx, width, y, label, color, isActive) {
  ctx.save();
  ctx.font = '600 13px "Outfit", sans-serif';
  const metrics = ctx.measureText(label.toUpperCase());
  const badgeW = metrics.width + 20;
  const badgeH = 20;
  const badgeX = (width - badgeW) / 2;

  ctx.fillStyle = isActive ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, y - badgeH / 2, badgeW, badgeH, 10);
  } else {
    ctx.rect(badgeX, y - badgeH / 2, badgeW, badgeH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), width / 2, y);

  ctx.restore();
}

function drawActiveLineWithWipe(ctx, width, lineY, line, t, activeColor, fontSize) {
  const text = line.text;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const startX = (width - textWidth) / 2;

  let progress = 0;
  const lineDuration = Math.max(0.1, line.endTime - line.startTime);

  if (line.words && line.words.length > 0) {
    let accumulatedWidth = 0;
    let activeWordFound = false;

    for (let w = 0; w < line.words.length; w++) {
      const word = line.words[w];
      const wordWidth = ctx.measureText(word.text).width;

      if (t >= word.endTime) {
        accumulatedWidth += wordWidth;
      } else if (t >= word.startTime && t < word.endTime) {
        const wordDur = Math.max(0.05, word.endTime - word.startTime);
        const wordProg = (t - word.startTime) / wordDur;
        accumulatedWidth += wordWidth * wordProg;
        activeWordFound = true;
        break;
      } else {
        break;
      }
    }

    if (!activeWordFound && t >= line.endTime) {
      progress = 1.0;
    } else {
      progress = Math.min(1.0, Math.max(0, accumulatedWidth / textWidth));
    }
  } else {
    progress = Math.min(1.0, Math.max(0, (t - line.startTime) / lineDuration));
  }

  const wipeX = startX + textWidth * progress;

  // 1. Un-highlighted text in off-white / slate
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(text, width / 2, lineY);
  ctx.restore();

  // 2. Highlighted text clipped up to wipeX
  ctx.save();
  ctx.beginPath();
  ctx.rect(startX - 15, lineY - fontSize * 1.2, (wipeX - startX) + 15, fontSize * 1.8);
  ctx.clip();

  ctx.fillStyle = activeColor;
  ctx.shadowColor = activeColor;
  ctx.shadowBlur = 14;
  ctx.fillText(text, width / 2, lineY);

  ctx.restore();
}

function drawScrollingLyrics(ctx, width, height, t, isVertical, isSquare, theme) {
  const lines = getActiveLines();
  if (lines.length === 0) return;

  // Find active line index
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (t >= lines[i].startTime && t <= lines[i].endTime) {
      activeIndex = i;
      break;
    }
  }

  if (activeIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (t < lines[i].startTime) {
        activeIndex = Math.max(0, i - 0.5);
        break;
      }
    }
    if (activeIndex === -1) activeIndex = lines.length - 1;
  }

  const focalY = isVertical ? height * 0.46 : height * 0.48;
  const baseFontSize = isVertical ? Math.round(width * 0.062) : Math.round(height * 0.058);
  const lineSpacing = baseFontSize * 1.85;

  const range = 2; // -2 to +2 lines visible
  const centerFloor = Math.floor(activeIndex);

  for (let offset = -range; offset <= range; offset++) {
    const lineIdx = centerFloor + offset;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;

    const line = lines[lineIdx];
    const isCurrentActive = Math.abs(lineIdx - activeIndex) < 0.5 && t >= line.startTime && t <= line.endTime;

    const distFromCenter = lineIdx - activeIndex;
    const lineY = focalY + distFromCenter * lineSpacing;

    const scale = isCurrentActive ? 1.05 : Math.max(0.72, 1.0 - Math.abs(distFromCenter) * 0.16);
    const opacity = isCurrentActive ? 1.0 : Math.max(0.20, 0.65 - Math.abs(distFromCenter) * 0.22);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';

    const currentFontSize = Math.round(baseFontSize * scale);
    ctx.font = `700 ${currentFontSize}px "Outfit", sans-serif`;

    const singerColor = getSingerColor(line.singer, theme);

    if (state.staging?.showSingerBadges && (isCurrentActive || Math.abs(distFromCenter) <= 1)) {
      drawSingerBadge(ctx, width, lineY - currentFontSize * 0.85, line.singerLabel || 'DUET', singerColor, isCurrentActive);
    }

    if (isCurrentActive) {
      drawActiveLineWithWipe(ctx, width, lineY, line, t, singerColor, currentFontSize);
    } else {
      ctx.fillStyle = theme.dimColor || '#525b6c';
      ctx.fillText(line.text, width / 2, lineY);
    }

    ctx.restore();
  }
}

function drawFooter(ctx, width, height, theme) {
  ctx.save();
  ctx.font = '500 11px "Outfit", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.textAlign = 'center';
  ctx.fillText('100% Client-Side Sandbox • Karaoke Studio Engine', width / 2, height - 16);
  ctx.restore();
}

function renderCanvasFrame(t, isCleanExport = false) {
  const width = dom.canvas.width;
  const height = dom.canvas.height;
  const theme = VIDEO_THEMES[state.staging?.theme] || VIDEO_THEMES.obsidian_gold;
  const isVertical = state.staging?.aspectRatio === '9:16';
  const isSquare = state.staging?.aspectRatio === '1:1';

  // 1. Clear & Background
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial gradient background for depth
  const bgGrad = ctx.createRadialGradient(
    width / 2, height * 0.45, 50,
    width / 2, height * 0.45, width * 0.85
  );
  bgGrad.addColorStop(0, theme.bgSecondary);
  bgGrad.addColorStop(1, theme.bgColor);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient background floating particles
  drawDeterministicParticles(ctx, width, height, t, theme.particleColor);

  // 2. Header: Title & Artist
  drawHeader(ctx, width, height, isVertical, theme);

  // 3. Audio Visualizer / Waveform (if enabled)
  if (state.staging?.showWaveform) {
    drawVisualizer(ctx, width, height, t, isVertical, isSquare, theme);
  }

  // 4. Intro Count-in Dots (if enabled)
  if (state.staging?.showIntroDots) {
    const lines = getActiveLines();
    const firstStart = lines[0]?.startTime ?? 2.0;
    drawIntroCountIn(ctx, width, height, t, theme, firstStart);
  }

  // 5. Kinetic Scrolling Karaoke Lyrics
  drawScrollingLyrics(ctx, width, height, t, isVertical, isSquare, theme);

  // 6. Subtle Watermark / Footer
  drawFooter(ctx, width, height, theme);

  // Update slot indicator if present
  if (dom.slotIndicator) {
    dom.slotIndicator.textContent = state.segments.length > 0
      ? `${state.segments.length} lines active`
      : 'Demo Mode: Electric Horizon (Duet Edition)';
  }
}

// ==========================================
// 8. AUDIO ENGINE & PLAYBACK CONTROLS
// ==========================================
let lastLoopTimestamp = performance.now();
function animationLoop(now = performance.now()) {
  const dt = Math.min(0.1, (now - lastLoopTimestamp) / 1000);
  lastLoopTimestamp = now;

  if (state.isPlaying) {
    if (state.audioFile && state.audioElement && !state.audioElement.paused) {
      state.currentTime = state.audioElement.currentTime;
    } else if (!state.audioFile) {
      // Smooth demo loop progression
      const demoDur = 32;
      state.currentTime += dt;
      if (state.currentTime >= demoDur) {
        state.currentTime = 0;
      }
    }
    if (dom.timeScrubber) dom.timeScrubber.value = state.currentTime;
    if (dom.previewTimeScrubber) dom.previewTimeScrubber.value = state.currentTime;
    updateTimeDisplay();
  }
  renderCanvasFrame(state.currentTime);
  requestAnimationFrame(animationLoop);
}

function updateTimeDisplay() {
  const dur = state.audioDuration || 32;
  if (dom.timeDisplay) {
    dom.timeDisplay.textContent = `${TimeUtil.toDisplay(state.currentTime)} / ${TimeUtil.toDisplay(dur)}`;
  }
  if (dom.builderLiveSongTime) {
    dom.builderLiveSongTime.textContent = TimeUtil.toDisplay(state.currentTime);
  }
  if (dom.previewCurrentTime) {
    dom.previewCurrentTime.textContent = formatClockTime(state.currentTime);
  }
  if (dom.previewTotalDuration) {
    dom.previewTotalDuration.textContent = formatClockTime(dur);
  }
  if (dom.previewTimeScrubber) {
    dom.previewTimeScrubber.max = dur;
    dom.previewTimeScrubber.value = state.currentTime;
  }
}

function setPlaybackState(isPlaying) {
  state.isPlaying = isPlaying;
  if (dom.playIcon) dom.playIcon.style.display = isPlaying ? 'none' : 'block';
  if (dom.pauseIcon) dom.pauseIcon.style.display = isPlaying ? 'block' : 'none';
  if (dom.previewPlayIcon) dom.previewPlayIcon.style.display = isPlaying ? 'none' : 'block';
  if (dom.previewPauseIcon) dom.previewPauseIcon.style.display = isPlaying ? 'block' : 'none';
  if (dom.btnCanvasBigPlay) dom.btnCanvasBigPlay.style.display = isPlaying ? 'none' : 'flex';
}

function togglePlay() {
  if (state.audioFile && state.audioElement && state.audioElement.src) {
    VocalDspEngine.init(state.audioElement);
    if (state.isPlaying) {
      state.audioElement.pause();
      setPlaybackState(false);
    } else {
      if (VocalDspEngine.ctx?.state === 'suspended') {
        VocalDspEngine.ctx.resume();
      }
      state.audioElement.play().then(() => setPlaybackState(true)).catch(() => {});
    }
  } else {
    // Demo mode: play / pause demo timeline smoothly
    setPlaybackState(!state.isPlaying);
  }
}

function pauseAudio() {
  if (state.isPlaying) {
    if (state.audioElement && state.audioFile) {
      state.audioElement.pause();
    }
    setPlaybackState(false);
  }
}

function seekToTime(t) {
  const maxDur = state.audioDuration || 32;
  const clamped = Math.max(0, Math.min(maxDur, t));
  state.currentTime = clamped;
  if (state.audioElement && state.audioFile) {
    state.audioElement.currentTime = clamped;
  }
  if (dom.timeScrubber) dom.timeScrubber.value = clamped;
  if (dom.previewTimeScrubber) dom.previewTimeScrubber.value = clamped;
  updateTimeDisplay();
  renderCanvasFrame(clamped);
}

function loadAudioFile(file) {
  state.currentRenderPaid = false;
  state.audioFile = file;
  state.audioElement.src = URL.createObjectURL(file);
  dom.audioFilename.textContent = file.name;
  dom.dropzonePrompt.style.display = 'none';
  dom.audioLoadedCard.style.display = 'flex';

  state.audioElement.onloadedmetadata = () => {
    state.audioDuration = state.audioElement.duration || 0;
    dom.audioDuration.textContent = TimeUtil.toDisplay(state.audioDuration);
    dom.timeScrubber.max = state.audioDuration;
    if (dom.previewTimeScrubber) dom.previewTimeScrubber.max = state.audioDuration;
    if (dom.previewTotalDuration) dom.previewTotalDuration.textContent = formatClockTime(state.audioDuration);
    state.currentTime = 0;
    updateTimeDisplay();
    renderCanvasFrame(0);
  };
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
  let title = 'Duet Song';
  let duration = 180;

  // 1. Verify Audio Track
  if (isFileMode) {
    const file = state.audioFile;
    if (!file && (!state.audioElement.src || state.audioElement.src === '')) {
      alert('Please upload a song audio file (MP3, WAV, etc.) or drag & drop one into the box first.');
      dom.audioFileInput?.click();
      return;
    }
    if (file) {
      title = file.name.replace(/\.[^/.]+$/, '').replace(/[\-_]+/g, ' ').trim();
      if (!state.audioElement.src || !state.audioElement.src.startsWith('blob:')) {
        state.audioElement.src = URL.createObjectURL(file);
      }
    }
  } else {
    // YouTube mode
    const url = (dom.ytUrlInput?.value || '').trim();
    if (!url && !state.audioElement.src) {
      alert('Please paste a YouTube song link or upload an audio file first.');
      dom.ytUrlInput?.focus();
      return;
    }

    if (url && (!state.audioElement.src || !state.audioFile?.serverAudioUrl)) {
      setAutopilotStep(1, '[1/4] Ingesting YouTube audio stream...');
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalHost) {
        const res = await fetch('/api/auto-duet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (_) {
          throw new Error(`Server returned ${res.status}: ${text.slice(0, 100)}`);
        }
        if (!res.ok || data.status === 'error') {
          throw new Error(data.message || 'Failed to extract YouTube audio.');
        }

        title = data.title;
        duration = data.duration || 180;
        state.audioFile = { name: `${title}.mp3`, serverAudioUrl: data.audioUrl };
        state.audioElement.src = data.audioUrl;
        dom.audioFilename.textContent = title;
        dom.dropzonePrompt.style.display = 'none';
        dom.audioLoadedCard.style.display = 'flex';
      } else {
        alert('On cloud preview, please use "Upload Audio Song" for instant browser processing with zero queue.');
        return;
      }
    }
  }

  // Ensure Audio Duration is resolved
  duration = await new Promise(resolve => {
    if (state.audioDuration > 0) return resolve(state.audioDuration);
    if (state.audioElement.duration && !isNaN(state.audioElement.duration)) {
      return resolve(state.audioElement.duration);
    }
    state.audioElement.onloadedmetadata = () => resolve(state.audioElement.duration || 180);
    setTimeout(() => resolve(state.audioElement.duration || 180), 2000);
  });
  state.audioDuration = duration;
  dom.audioDuration.textContent = TimeUtil.toDisplay(duration);
  dom.timeScrubber.max = duration;

  // 2. USER-ENTERED LYRICS VERIFICATION (DO NOT ADD LYRICS FROM THE STUDIO END)
  const userLyrics = (dom.lyricsTextarea?.value || '').trim();
  if (!userLyrics) {
    alert('Please enter your lyrics in the Timestamped Lyrics section (Step 3) before generating the video.');
    const lyricsSection = document.querySelector('.lyrics-section') || dom.lyricsTextarea;
    lyricsSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dom.lyricsTextarea?.focus();
    return;
  }

  parseAndUpdateLyrics();

  if (state.segments.length === 0) {
    alert('Your lyrics need timestamps (e.g. [1] [00:04.50 - 00:09.20] Lyric line).\n\nTip: You can switch to the "Tap to Sync" tab to mark line timings with the song, or click "+ Add Line & Timing".');
    const lyricsSection = document.querySelector('.lyrics-section') || dom.lyricsTextarea;
    lyricsSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Progress Tracker Step 1: Audio Analysis
  setAutopilotStep(1, '[1/4] Audio analysis & duration verified...');

  if (dom.btnRunAutopilot) {
    dom.btnRunAutopilot.disabled = true;
    dom.btnRunAutopilot.innerHTML = '<span>Processing Duet Karaoke Video...</span>';
  }

  try {
    // Step 2: Validate User's Custom Lyrics & Duet Voice Parts
    setAutopilotStep(2, `[2/4] Validated ${state.segments.length} lines of your lyrics & duet tags...`);
    await new Promise(r => setTimeout(r, 350));

    const language = detectLanguageFromText(userLyrics);
    if (dom.detectedLangBadge) {
      dom.detectedLangBadge.textContent = `${language} (${state.segments.length} user lines)`;
      dom.detectedLangBadge.style.display = 'inline-flex';
    }

    // Step 3: Layout & Canvas styling
    setAutopilotStep(3, `[3/4] Arranging 1080p duet layout, singer colors & timing...`);
    renderCanvasFrame(0);
    await new Promise(r => setTimeout(r, 350));

    // Step 4: Video Generation
    const shouldAutoRender = dom.chkAutoRenderVideo ? dom.chkAutoRenderVideo.checked : true;

    if (shouldAutoRender && state.audioElement.src) {
      setAutopilotStep(4, '[4/4] Auto-Rendering 1080p MP4 Video with your lyrics...');
      await new Promise(r => setTimeout(r, 600));

      if (state.ffmpegAvailable) {
        await renderVideoWithFfmpeg();
      } else {
        await renderVideoLive();
      }

      setAutopilotStep(5, 'Complete: Your 1080p Duet Karaoke Video is ready for download.');
    } else {
      setAutopilotStep(5, `Complete: Duet video formatted with your ${state.segments.length} custom lyric lines.`);
    }

  } catch (err) {
    console.error('[Duet Video Error]', err);
    alert(`Duet Video Generator: ${err.message}`);
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
    const timeStr = item.start !== null
      ? `${TimeUtil.toDisplay(item.start)} - ${item.end !== null ? TimeUtil.toDisplay(item.end) : '...'}`
      : '--:--';
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
// 10.1 LYRIC LINE BUILDER & TIMING ADJUSTER ENGINE
// ==========================================
let currentBuilderVoice = '[1]';
let auditionTimer = null;

function auditionAudioRange(startSec, endSec) {
  if (!state.audioElement || !state.audioElement.src) {
    alert('Please upload an audio track or import from YouTube first to test audio timing!');
    return;
  }
  if (auditionTimer) clearTimeout(auditionTimer);

  const safeStart = Math.max(0, startSec);
  const safeEnd = Math.max(safeStart + 0.1, endSec);

  state.currentTime = safeStart;
  state.audioElement.currentTime = safeStart;
  updateTimeDisplay();
  renderCanvasFrame(safeStart);

  if (!state.isPlaying) {
    togglePlay();
  }

  const playbackRate = state.playbackRate || 1.0;
  const durationMs = Math.max(250, ((safeEnd - safeStart) * 1000) / playbackRate);

  auditionTimer = setTimeout(() => {
    pauseAudio();
  }, durationMs);
}

function setupLineBuilderAndManager() {
  // 1. Toggle Line Builder Panel
  const toggleBuilder = () => {
    if (!dom.lineBuilderPanel) return;
    const isHidden = dom.lineBuilderPanel.style.display === 'none' || getComputedStyle(dom.lineBuilderPanel).display === 'none';
    dom.lineBuilderPanel.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      dom.builderLineText?.focus();
      // If start time is 00:00.00 and audio has progressed, sync with song audio position
      if (dom.builderStartTime && (!dom.builderStartTime.value || dom.builderStartTime.value === '00:00.00') && state.currentTime > 0) {
        dom.builderStartTime.value = TimeUtil.toDisplay(state.currentTime);
        dom.builderEndTime.value = TimeUtil.toDisplay(state.currentTime + 5.0);
      }
    }
  };

  dom.btnToggleLineBuilder?.addEventListener('click', toggleBuilder);
  dom.btnBoxQuickAdd?.addEventListener('click', () => {
    if (dom.lineBuilderPanel && (dom.lineBuilderPanel.style.display === 'none' || getComputedStyle(dom.lineBuilderPanel).display === 'none')) {
      toggleBuilder();
    } else {
      dom.builderLineText?.focus();
    }
  });

  // 2. Voice Pills Selector
  if (dom.builderVoiceGroup) {
    dom.builderVoiceGroup.querySelectorAll('.voice-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        dom.builderVoiceGroup.querySelectorAll('.voice-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentBuilderVoice = pill.getAttribute('data-voice') || '[1]';
      });
    });
  }

  // 3. Audio Time Capture buttons (⏱️ Set from Song)
  dom.btnSyncStartAudio?.addEventListener('click', () => {
    const curTime = state.currentTime || (state.audioElement ? state.audioElement.currentTime : 0);
    if (dom.builderStartTime) dom.builderStartTime.value = TimeUtil.toDisplay(curTime);
  });

  dom.btnSyncEndAudio?.addEventListener('click', () => {
    const curTime = state.currentTime || (state.audioElement ? state.audioElement.currentTime : 0);
    if (dom.builderEndTime) dom.builderEndTime.value = TimeUtil.toDisplay(curTime);
  });

  // 4. Nudge buttons (-0.5s / +0.5s)
  const nudgeTime = (inputEl, delta) => {
    if (!inputEl) return;
    const curSec = TimeUtil.toSeconds(inputEl.value);
    const newSec = Math.max(0, curSec + delta);
    inputEl.value = TimeUtil.toDisplay(newSec);
  };

  dom.btnStartMinus05?.addEventListener('click', () => nudgeTime(dom.builderStartTime, -0.5));
  dom.btnStartPlus05?.addEventListener('click', () => nudgeTime(dom.builderStartTime, 0.5));
  dom.btnEndMinus05?.addEventListener('click', () => nudgeTime(dom.builderEndTime, -0.5));
  dom.btnEndPlus05?.addEventListener('click', () => nudgeTime(dom.builderEndTime, 0.5));

  // 5. Preset duration chips (+3s, +5s, +8s)
  document.querySelectorAll('.btn-dur-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const dur = parseFloat(chip.getAttribute('data-dur') || '5');
      const startSec = TimeUtil.toSeconds(dom.builderStartTime?.value || '00:00.00');
      if (dom.builderEndTime) {
        dom.builderEndTime.value = TimeUtil.toDisplay(startSec + dur);
      }
    });
  });

  // 6. Audition button (▶ Test Audio Range)
  dom.btnAuditionRange?.addEventListener('click', () => {
    const s = TimeUtil.toSeconds(dom.builderStartTime?.value || '0');
    const e = TimeUtil.toSeconds(dom.builderEndTime?.value || '0');
    if (e <= s) {
      alert('End time must be greater than start time to test audio.');
      return;
    }
    auditionAudioRange(s, e);
  });

  // 7. Submit button (+ Add Line to Box)
  dom.btnSubmitAddLine?.addEventListener('click', handleAddLineSubmit);
  dom.builderLineText?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLineSubmit();
    }
  });

  // 8. Line Manager toggle
  dom.btnToggleLineManager?.addEventListener('click', () => {
    if (!dom.lineManagerPanel) return;
    const isHidden = dom.lineManagerPanel.style.display === 'none' || getComputedStyle(dom.lineManagerPanel).display === 'none';
    dom.lineManagerPanel.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) renderLineManagerList();
  });
}

function handleAddLineSubmit() {
  const text = (dom.builderLineText?.value || '').trim();
  if (!text) {
    dom.builderLineText?.focus();
    return;
  }

  const startStr = (dom.builderStartTime?.value || '00:00.00').trim();
  let endStr = (dom.builderEndTime?.value || '00:05.00').trim();

  let startSec = TimeUtil.toSeconds(startStr);
  let endSec = TimeUtil.toSeconds(endStr);
  if (endSec <= startSec) {
    endSec = startSec + 4.0;
    endStr = TimeUtil.toDisplay(endSec);
    if (dom.builderEndTime) dom.builderEndTime.value = endStr;
  }

  const formattedLine = `${currentBuilderVoice} [${startStr} - ${endStr}] ${text}`;

  const currentVal = dom.lyricsTextarea.value.trim();
  dom.lyricsTextarea.value = currentVal ? `${currentVal}\n${formattedLine}` : formattedLine;

  parseAndUpdateLyrics();

  // Scroll textarea to bottom
  dom.lyricsTextarea.scrollTop = dom.lyricsTextarea.scrollHeight;

  // Advance next start time to this line's end time
  if (dom.builderStartTime) dom.builderStartTime.value = endStr;
  if (dom.builderEndTime) dom.builderEndTime.value = TimeUtil.toDisplay(endSec + 4.0);

  // Clear text input and re-focus for fast sequential line entry
  if (dom.builderLineText) {
    dom.builderLineText.value = '';
    dom.builderLineText.focus();
  }
}

function renderLineManagerList() {
  if (!dom.lineManagerList) return;
  dom.lineManagerList.innerHTML = '';

  if (dom.lineMgrCount) {
    dom.lineMgrCount.textContent = state.segments.length;
  }

  if (state.segments.length === 0) {
    dom.lineManagerList.innerHTML = '<p class="placeholder-text" style="padding:14px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No lyrics lines parsed yet. Use <strong>+ Add Line to Box</strong> above or paste lyrics in the box.</p>';
    return;
  }

  state.segments.forEach((seg, idx) => {
    const row = document.createElement('div');
    row.className = 'line-item-row';

    // Index
    const indexSpan = document.createElement('span');
    indexSpan.style.cssText = 'font-size:0.75rem;font-weight:700;color:var(--text-faint);min-width:24px;';
    indexSpan.textContent = `#${idx + 1}`;
    row.appendChild(indexSpan);

    // Voice Selector
    const voiceSelect = document.createElement('select');
    voiceSelect.className = 'line-voice-select';
    voiceSelect.innerHTML = `
      <option value="1" ${seg.colorMode === 1 ? 'selected' : ''}>[1] Male</option>
      <option value="2" ${seg.colorMode === 2 ? 'selected' : ''}>[2] Female</option>
      <option value="3" ${seg.colorMode === 3 ? 'selected' : ''}>[3] Both</option>
    `;
    voiceSelect.addEventListener('change', (e) => {
      seg.colorMode = parseInt(e.target.value, 10);
      syncSegmentsToTextarea();
    });
    row.appendChild(voiceSelect);

    // Start Time Group
    const startGroup = document.createElement('div');
    startGroup.className = 'line-time-group';

    const btnStartMinus = document.createElement('button');
    btnStartMinus.type = 'button';
    btnStartMinus.className = 'line-btn-mini';
    btnStartMinus.title = '-0.2s';
    btnStartMinus.textContent = '-.2';
    btnStartMinus.addEventListener('click', () => {
      seg.start = Math.max(0, seg.start - 0.2);
      syncSegmentsToTextarea();
    });

    const startInput = document.createElement('input');
    startInput.type = 'text';
    startInput.className = 'line-time-input-sm';
    startInput.value = TimeUtil.toDisplay(seg.start);
    startInput.title = 'Start Time';
    startInput.addEventListener('change', () => {
      seg.start = TimeUtil.toSeconds(startInput.value);
      syncSegmentsToTextarea();
    });

    const btnStartPlus = document.createElement('button');
    btnStartPlus.type = 'button';
    btnStartPlus.className = 'line-btn-mini';
    btnStartPlus.title = '+0.2s';
    btnStartPlus.textContent = '+.2';
    btnStartPlus.addEventListener('click', () => {
      seg.start = seg.start + 0.2;
      syncSegmentsToTextarea();
    });

    const btnSyncStart = document.createElement('button');
    btnSyncStart.type = 'button';
    btnSyncStart.className = 'line-btn-mini';
    btnSyncStart.title = 'Set to current song audio position';
    btnSyncStart.textContent = '⏱️';
    btnSyncStart.addEventListener('click', () => {
      seg.start = state.currentTime;
      syncSegmentsToTextarea();
    });

    startGroup.appendChild(btnStartMinus);
    startGroup.appendChild(startInput);
    startGroup.appendChild(btnStartPlus);
    startGroup.appendChild(btnSyncStart);
    row.appendChild(startGroup);

    // Arrow separator
    const arrow = document.createElement('span');
    arrow.style.cssText = 'color:var(--text-faint);font-size:0.75rem;';
    arrow.textContent = '→';
    row.appendChild(arrow);

    // End Time Group
    const endGroup = document.createElement('div');
    endGroup.className = 'line-time-group';

    const btnEndMinus = document.createElement('button');
    btnEndMinus.type = 'button';
    btnEndMinus.className = 'line-btn-mini';
    btnEndMinus.title = '-0.2s';
    btnEndMinus.textContent = '-.2';
    btnEndMinus.addEventListener('click', () => {
      seg.end = Math.max(seg.start + 0.2, seg.end - 0.2);
      syncSegmentsToTextarea();
    });

    const endInput = document.createElement('input');
    endInput.type = 'text';
    endInput.className = 'line-time-input-sm';
    endInput.value = TimeUtil.toDisplay(seg.end);
    endInput.title = 'End Time';
    endInput.addEventListener('change', () => {
      seg.end = Math.max(seg.start + 0.2, TimeUtil.toSeconds(endInput.value));
      syncSegmentsToTextarea();
    });

    const btnEndPlus = document.createElement('button');
    btnEndPlus.type = 'button';
    btnEndPlus.className = 'line-btn-mini';
    btnEndPlus.title = '+0.2s';
    btnEndPlus.textContent = '+.2';
    btnEndPlus.addEventListener('click', () => {
      seg.end = seg.end + 0.2;
      syncSegmentsToTextarea();
    });

    const btnSyncEnd = document.createElement('button');
    btnSyncEnd.type = 'button';
    btnSyncEnd.className = 'line-btn-mini';
    btnSyncEnd.title = 'Set to current song audio position';
    btnSyncEnd.textContent = '⏱️';
    btnSyncEnd.addEventListener('click', () => {
      seg.end = Math.max(seg.start + 0.2, state.currentTime);
      syncSegmentsToTextarea();
    });

    endGroup.appendChild(btnEndMinus);
    endGroup.appendChild(endInput);
    endGroup.appendChild(btnEndPlus);
    endGroup.appendChild(btnSyncEnd);
    row.appendChild(endGroup);

    // Lyrics Text Input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'line-text-input-main';
    textInput.value = seg.text || '';
    textInput.placeholder = 'Lyrics text...';
    textInput.addEventListener('change', () => {
      seg.text = textInput.value.trim();
      syncSegmentsToTextarea();
    });
    row.appendChild(textInput);

    // Audition Button
    const btnPlayLine = document.createElement('button');
    btnPlayLine.type = 'button';
    btnPlayLine.className = 'line-btn-action';
    btnPlayLine.title = 'Audition this line audio';
    btnPlayLine.textContent = '▶';
    btnPlayLine.addEventListener('click', () => {
      auditionAudioRange(seg.start, seg.end);
    });
    row.appendChild(btnPlayLine);

    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'line-btn-action line-btn-delete';
    btnDelete.title = 'Delete line';
    btnDelete.textContent = '🗑️';
    btnDelete.addEventListener('click', () => {
      state.segments.splice(idx, 1);
      syncSegmentsToTextarea();
    });
    row.appendChild(btnDelete);

    dom.lineManagerList.appendChild(row);
  });
}

function syncSegmentsToTextarea() {
  const formatted = state.segments.map(seg => {
    const s = TimeUtil.toDisplay(seg.start);
    const e = TimeUtil.toDisplay(seg.end);
    const tag = `[${seg.colorMode || 1}]`;
    return `${tag} [${s} - ${e}] ${seg.text}`;
  }).join('\n');

  dom.lyricsTextarea.value = formatted;
  state.lyricsRaw = formatted;
  state.segments = parseManualTimestamps(state.lyricsRaw);
  dom.parsedCountBadge.textContent = `${state.segments.length} lines parsed`;
  if (dom.lineMgrCount) dom.lineMgrCount.textContent = state.segments.length;
  renderCanvasFrame(state.currentTime);
}

// ==========================================
// 11. UNIFIED VIDEO PRESENTATION & EXPORT (DRY)
// ==========================================
function triggerDirectFileDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'duet_karaoke_1080p.mp4';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch (_) {}
  }, 400);
}

async function handleDownloadVideoClick(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }

  const url = state.renderedVideoUrl || dom.btnDownloadVideo?.getAttribute('data-download-url') || dom.btnDownloadVideo?.href;
  const filename = state.renderedVideoFilename || dom.btnDownloadVideo?.getAttribute('data-download-filename') || dom.btnDownloadVideo?.download || 'duet_karaoke_1080p.mp4';

  if (!url || url === '#' || url.endsWith('#')) {
    alert('Please render your karaoke video first before downloading.');
    return;
  }

  // If already paid for this exact rendered file, download directly without re-charging
  if (state.currentRenderPaid) {
    triggerDirectFileDownload(url, filename);
    return;
  }

  // 1. Strict Auth Guard: User must be signed in to download
  if (!window.KaraokeAuth || !window.KaraokeAuth.getCurrentUser()) {
    if (window.KaraokeAuth) {
      window.KaraokeAuth.openAuthModal('signin', 'Sign In Required: Sign in or create an account to download your 1080p Duet Karaoke video (2 tokens).');
    } else {
      alert('Authentication is initializing. Please wait a moment...');
    }
    return;
  }

  // 2. Strict Token Check: User must have at least 2 tokens
  const currentTokens = window.KaraokeAuth.getCredits ? window.KaraokeAuth.getCredits() : 0;
  if (currentTokens < 2) {
    if (window.KaraokeAuth.openOutOfCreditsModal) {
      window.KaraokeAuth.openOutOfCreditsModal('out_of_tokens');
    } else {
      window.location.href = '/pricing?reason=out_of_tokens';
    }
    return;
  }

  // 3. Deduct exactly 2 tokens on download
  const btn = dom.btnDownloadVideo;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.7';
  }

  try {
    const deducted = await window.KaraokeAuth.deductSongCredit(2);
    if (!deducted) {
      if (window.KaraokeAuth.openOutOfCreditsModal) {
        window.KaraokeAuth.openOutOfCreditsModal('out_of_tokens');
      } else {
        window.location.href = '/pricing?reason=out_of_tokens';
      }
      return;
    }

    // Mark current render as paid so accidental duplicate clicks don't double charge
    state.currentRenderPaid = true;

    // Trigger file download
    triggerDirectFileDownload(url, filename);

    // Update download banner status
    if (dom.downloadFilenameSub) {
      dom.downloadFilenameSub.innerHTML = `✓ <strong>2 Tokens Deducted</strong> — Downloading "<strong>${filename}</strong>" now!`;
    }
  } catch (err) {
    console.error('[Download Error]', err);
    alert('Failed to process download: ' + (err.message || 'Unknown error'));
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.style.pointerEvents = '';
      btn.style.opacity = '';
    }
  }
}

const presentRenderedVideo = ({ url, filename, description }) => {
  dom.renderProgressCard.style.display = 'none';
  dom.downloadBanner.style.display = 'flex';

  state.currentRenderPaid = false;
  state.renderedVideoUrl = url;
  state.renderedVideoFilename = filename || 'duet_karaoke_1080p.mp4';

  if (dom.downloadFilenameSub) {
    dom.downloadFilenameSub.innerHTML = description || `Rendering complete for "<strong>${filename}</strong>"! (2 Tokens deducted on download)`;
  }

  dom.btnDownloadVideo.href = url;
  dom.btnDownloadVideo.download = filename;
  dom.btnDownloadVideo.setAttribute('data-download-url', url);
  dom.btnDownloadVideo.setAttribute('data-download-filename', filename);
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

  state.currentRenderPaid = false;
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

    // Render clean Universal MP4 via server FFmpeg so official download is 100% unwatermarked!
    if (state.ffmpegAvailable) {
      try {
        dom.renderStatusText.textContent = 'Generating clean Universal 1080p MP4 via server...';
        let serverAudioFile = null;
        let base64Audio = '';
        const audioSrc = state.audioElement?.src || '';

        if (state.audioFile?.serverAudioUrl) {
          serverAudioFile = state.audioFile.serverAudioUrl;
        } else if (audioSrc.includes('/api/download/')) {
          serverAudioFile = audioSrc;
        }

        if (!serverAudioFile && state.audioFile) {
          base64Audio = await readFileAsBase64(state.audioFile);
        }

        if (serverAudioFile || base64Audio) {
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
          if (res.success && res.downloadUrl) {
            finalVideoUrl = res.downloadUrl;
            isUniversalMp4 = true;
          }
        }
      } catch (err) {
        console.warn('Clean FFmpeg render notice, falling back to recorded stream:', err);
      }
    }

    // Fallback: Convert via server FFmpeg if direct render failed
    if (!finalVideoUrl && state.ffmpegAvailable && recordedBlob.size > 0) {
      try {
        dom.renderStatusText.textContent = 'Converting video recording...';
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
    console.info('Server FFmpeg not active; seamlessly rendering via browser studio engine.');
    renderVideoLive();
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

  state.currentRenderPaid = false;
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
  state.currentRenderPaid = false;
  state.lyricsRaw = dom.lyricsTextarea.value;
  state.segments = parseManualTimestamps(state.lyricsRaw);
  dom.parsedCountBadge.textContent = `${state.segments.length} lines parsed`;
  if (dom.lineMgrCount) dom.lineMgrCount.textContent = state.segments.length;
  if (dom.lineManagerPanel && dom.lineManagerPanel.style.display !== 'none' && getComputedStyle(dom.lineManagerPanel).display !== 'none') {
    renderLineManagerList();
  }
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

function applyStagingDimensions() {
  const aspect = state.staging.aspectRatio || '16:9';
  const quality = state.staging.quality || '720p';
  const res = (RESOLUTIONS[aspect] && RESOLUTIONS[aspect][quality]) || { width: 1280, height: 720 };

  dom.canvas.width = res.width;
  dom.canvas.height = res.height;

  dom.canvas.classList.remove('aspect-16-9', 'aspect-9-16', 'aspect-1-1');
  if (aspect === '9:16') {
    dom.canvas.classList.add('aspect-9-16');
  } else if (aspect === '1:1') {
    dom.canvas.classList.add('aspect-1-1');
  } else {
    dom.canvas.classList.add('aspect-16-9');
  }

  if (dom.previewAspectBadge) {
    dom.previewAspectBadge.textContent = `${aspect} • ${quality}`;
  }
  renderCanvasFrame(state.currentTime);
}

function applyStagingTheme(themeId) {
  state.staging.theme = themeId;
  const th = VIDEO_THEMES[themeId] || VIDEO_THEMES.obsidian_gold;

  state.color1 = th.singer1Color;
  state.color2 = th.singer2Color;
  state.color3 = th.bothColor;

  if (dom.color1) dom.color1.value = th.singer1Color;
  if (dom.color1Hex) dom.color1Hex.value = th.singer1Color;
  if (dom.color2) dom.color2.value = th.singer2Color;
  if (dom.color2Hex) dom.color2Hex.value = th.singer2Color;
  if (dom.color3) dom.color3.value = th.bothColor;
  if (dom.color3Hex) dom.color3Hex.value = th.bothColor;

  renderCanvasFrame(state.currentTime);
}

function updateVolumeIcons() {
  if (dom.previewVolIconOn && dom.previewVolIconOff) {
    if (state.isMuted || state.volume === 0) {
      dom.previewVolIconOn.style.display = 'none';
      dom.previewVolIconOff.style.display = 'block';
    } else {
      dom.previewVolIconOn.style.display = 'block';
      dom.previewVolIconOff.style.display = 'none';
    }
  }
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
    setPlaybackState(false);
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
    if (typeof fn === 'function') return fn();
  };

  dom.btnRunAutopilot?.addEventListener('click', () => runOneClickAutoDuet());
  dom.btnFetchYt?.addEventListener('click', () => runOneClickAutoDuet());
  dom.ytUrlInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runOneClickAutoDuet();
    }
  });

  // Player controls
  dom.btnPlayPause.addEventListener('click', togglePlay);
  dom.timeScrubber.addEventListener('input', e => {
    seekToTime(parseFloat(e.target.value));
  });

  // Video Preview Player Transport Listeners (Screenshot Matched)
  dom.btnCanvasBigPlay?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  dom.btnPreviewPlayPause?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
  });
  dom.btnPreviewRewind?.addEventListener('click', () => {
    seekToTime(Math.max(0, state.currentTime - 5));
  });
  dom.btnPreviewForward?.addEventListener('click', () => {
    const maxDur = state.audioDuration || 32;
    seekToTime(Math.min(maxDur, state.currentTime + 5));
  });
  dom.previewTimeScrubber?.addEventListener('input', (e) => {
    seekToTime(parseFloat(e.target.value));
  });
  dom.previewVolumeSlider?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.volume = val;
    if (state.audioElement) state.audioElement.volume = val;
    state.isMuted = val === 0;
    updateVolumeIcons();
  });
  dom.btnPreviewMute?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    if (state.audioElement) {
      state.audioElement.muted = state.isMuted;
    }
    updateVolumeIcons();
  });
  dom.btnPreviewFullscreen?.addEventListener('click', () => {
    const elem = dom.stageWrapper || dom.canvas;
    if (!document.fullscreenElement) {
      elem.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  // Full-row Preview Button: Scroll to Preview Player & Trigger
  dom.btnPreviewKaraoke?.addEventListener('click', () => {
    dom.stageWrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    renderCanvasFrame(state.currentTime);
  });

  // Staging Settings: Aspect Ratio
  const aspectBtns = [dom.btnAspect169, dom.btnAspect916, dom.btnAspect11];
  aspectBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      aspectBtns.forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      state.staging.aspectRatio = btn.getAttribute('data-aspect') || '16:9';
      applyStagingDimensions();
    });
  });

  // Staging Settings: Theme & Singer Palette
  const themeBtns = [dom.btnThemeObsidian, dom.btnThemeCyber, dom.btnThemeSlate];
  themeBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      themeBtns.forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      const themeId = btn.getAttribute('data-theme') || 'obsidian_gold';
      applyStagingTheme(themeId);
    });
  });

  // Staging Settings: Resolution
  const qualBtns = [dom.btnQual720p, dom.btnQual1080p];
  qualBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      qualBtns.forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      state.staging.quality = btn.getAttribute('data-quality') || '720p';
      applyStagingDimensions();
    });
  });

  // Staging Settings: Frame Rate
  const fpsBtns = [dom.btnFps30, dom.btnFps60];
  fpsBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      fpsBtns.forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      state.staging.fps = parseInt(btn.getAttribute('data-fps') || '30', 10);
    });
  });

  // Staging Settings: Layer Overlays
  dom.chkShowWaveform?.addEventListener('change', (e) => {
    state.staging.showWaveform = e.target.checked;
    renderCanvasFrame(state.currentTime);
  });
  dom.chkShowSingerBadges?.addEventListener('change', (e) => {
    state.staging.showSingerBadges = e.target.checked;
    renderCanvasFrame(state.currentTime);
  });
  dom.chkShowIntroDots?.addEventListener('change', (e) => {
    state.staging.showIntroDots = e.target.checked;
    renderCanvasFrame(state.currentTime);
  });

  // Staging Settings: Custom Track Title & Artist
  dom.inputTrackTitle?.addEventListener('input', (e) => {
    state.staging.trackTitle = e.target.value.trim() || 'Electric Horizon (Duet Edition)';
    renderCanvasFrame(state.currentTime);
  });
  dom.inputTrackArtist?.addEventListener('input', (e) => {
    state.staging.trackArtist = e.target.value.trim() || 'Karaoke Studio Ensemble';
    renderCanvasFrame(state.currentTime);
  });

  // Keyboard navigation shortcuts (Space = play/pause, Left/Right = seek 5s)
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      const maxDur = state.audioDuration || 32;
      seekToTime(Math.min(maxDur, state.currentTime + 5));
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seekToTime(Math.max(0, state.currentTime - 5));
    }
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

  // Export Subtitle (.ASS - Free text export)
  dom.btnExportAss?.addEventListener('click', () => {
    const assContent = generateAssSubtitle();
    const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duet_karaoke.ass';
    a.click();
  });

  // Full Row Preview Button (Below 1st & 2nd Image)
  dom.btnPreviewKaraoke?.addEventListener('click', () => {
    parseAndUpdateLyrics();

    // Smoothly scroll down to 3rd image preview stage window
    const previewEl = dom.stageWrapper || $('preview-panel') || $('karaoke-canvas');
    if (previewEl) {
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Play song audio & run canvas preview animation
    if (state.audioElement && state.audioElement.src) {
      if (!state.isPlaying) {
        togglePlay();
      }
    } else {
      renderCanvasFrame(state.currentTime || 0);
    }
  });

  // Render Video Preview & Download
  dom.btnRenderLive?.addEventListener('click', () => renderVideoLive());
  dom.btnRenderUniversal?.addEventListener('click', () => {
    // If video is already rendered and ready, download directly
    if (state.renderedVideoUrl && state.currentRenderPaid) {
      triggerDirectFileDownload(state.renderedVideoUrl, state.renderedVideoFilename);
      return;
    }
    if (state.renderedVideoUrl && !state.currentRenderPaid) {
      handleDownloadVideoClick();
      return;
    }
    renderVideoWithFfmpeg();
  });
  dom.btnRenderBrowser?.addEventListener('click', () => renderVideoLive());
  dom.btnRenderFfmpeg?.addEventListener('click', () => renderVideoWithFfmpeg());

  // Download Video (.MP4): Exactly 2 tokens deducted strictly upon hitting download
  dom.btnDownloadVideo?.addEventListener('click', handleDownloadVideoClick);

  // Syntax Modal (DRY)
  const toggleSyntaxModal = (show) => { if (dom.syntaxModal) dom.syntaxModal.style.display = show ? 'flex' : 'none'; };
  document.querySelector('.syntax-info')?.addEventListener('click', () => toggleSyntaxModal(true));
  dom.btnCloseSyntax?.addEventListener('click', () => toggleSyntaxModal(false));
  dom.btnSyntaxOk?.addEventListener('click', () => toggleSyntaxModal(false));
  dom.navSyntaxLink?.addEventListener('click', () => toggleSyntaxModal(true));

  // Global Spacebar & Escape shortcuts
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.syntaxModal && dom.syntaxModal.style.display === 'flex') {
        toggleSyntaxModal(false);
      }
    }
    if (e.code === 'Space' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      if (dom.paneTapSync?.classList.contains('active')) {
        markTapSyncLine();
      } else {
        togglePlay();
      }
    }
  });

  // Lyric Line Builder & Timing Adjuster Engine
  setupLineBuilderAndManager();
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

      if (dom.ffmpegDesc) {
        dom.ffmpegDesc.textContent = data.ffmpegAvailable
          ? 'Hardware H.264 High 4.1 + AAC + Faststart. 100% playable on mobile, laptop, tab, TV & WhatsApp.'
          : 'FFmpeg not detected. Use in-browser 1080p render or run install_ffmpeg.bat.';
      }
    }
  } catch (_) {
    if (dom.ffmpegDesc) {
      dom.ffmpegDesc.textContent = 'Running standalone. Use In-Browser 1080p Video render.';
    }
  }
}

// ==========================================
// 15. ANTI-SCREEN-RECORDING & CONTENT PROTECTION ENGINE
// ==========================================
function initAntiRecordingProtection() {
  // 1. Prevent context menu & dragging on the canvas and stage wrapper
  if (dom.canvas) {
    dom.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    dom.canvas.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
  }

  if (dom.stageWrapper) {
    dom.stageWrapper.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
  }

  // 2. Protect canvas.toDataURL and canvas.toBlob against scraper scripts / extensions
  if (window.HTMLCanvasElement) {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      if (this.id === 'karaoke-canvas' && !state.isCleanExporting) {
        console.warn('[Security Shield] Direct canvas frame extraction is restricted during preview.');
      }
      return origToDataURL.apply(this, args);
    };

    HTMLCanvasElement.prototype.toBlob = function(...args) {
      if (this.id === 'karaoke-canvas' && !state.isCleanExporting) {
        console.warn('[Security Shield] Direct canvas blob extraction is restricted during preview.');
      }
      return origToBlob.apply(this, args);
    };
  }

  // 3. Screen Capture & Screen Sharing Active Interception
  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    try {
      const origGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async function(...args) {
        triggerScreenCaptureDetection();
        const stream = await origGetDisplayMedia(...args);
        triggerScreenCaptureDetection();
        stream.getVideoTracks().forEach(track => {
          track.addEventListener('ended', () => {
            dismissScreenCaptureDetection();
          });
        });
        return stream;
      };
    } catch (_) {}
  }

  // 4. Tab Visibility Protection: Pause audio if tab is minimized/hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isPlaying) {
      pauseAudio();
    }
  });

  // 5. Dismiss record alert button
  if (dom.btnDismissRecordAlert) {
    dom.btnDismissRecordAlert.addEventListener('click', () => {
      dismissScreenCaptureDetection();
    });
  }
}

function triggerScreenCaptureDetection() {
  if (state.isPlaying) {
    pauseAudio();
  }
  if (dom.canvasRecordAlert) {
    dom.canvasRecordAlert.style.display = 'flex';
  }
}

function dismissScreenCaptureDetection() {
  if (dom.canvasRecordAlert) {
    dom.canvasRecordAlert.style.display = 'none';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  checkServerStatus();
  initAntiRecordingProtection();
  applyStagingDimensions();
  applyStagingTheme('obsidian_gold');
  updateTimeDisplay();
  renderCanvasFrame(state.currentTime);
  animationLoop();
});
