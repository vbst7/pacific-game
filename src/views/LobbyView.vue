<script setup>
import { ref, onMounted, watch } from 'vue';
import { useLobby } from '@/composables/useLobby';
import { useRouter } from 'vue-router';
import { db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { gameTests, runTest } from '@/utils/testRunner';
import GameToken from '@/components/GameToken.vue';

const router = useRouter();
const { createLobby, joinLobby, lobbyId, players, isHost, myId } = useLobby();

const nickname = ref(localStorage.getItem('nickname') || '');
const lobbyCodeInput = ref('');
const playerColor = ref(localStorage.getItem('playerColor') || '#f1f5f1');

const isDev = import.meta.env.DEV;
const testResults = ref([]);
const testStatus = ref('');
const selectedTestNames = ref([]);

onMounted(() => {
  const saved = localStorage.getItem('pacific_selected_tests');
  if (saved) {
    try {
      selectedTestNames.value = JSON.parse(saved);
    } catch (e) {
      selectedTestNames.value = gameTests.map(t => t.name);
    }
  } else {
    selectedTestNames.value = gameTests.map(t => t.name);
  }
});

watch(selectedTestNames, (newVal) => {
  localStorage.setItem('pacific_selected_tests', JSON.stringify(newVal));
}, { deep: true });

function toggleAllTests() {
  if (selectedTestNames.value.length === gameTests.length) {
    selectedTestNames.value = [];
  } else {
    selectedTestNames.value = gameTests.map(t => t.name);
  }
}

async function handleRunTests() {
  testResults.value = [];
  const testsToRun = gameTests.filter(t => selectedTestNames.value.includes(t.name));
  
  if (testsToRun.length === 0) {
    testStatus.value = 'No tests selected.';
    return;
  }

  for (const test of testsToRun) {
    const result = await runTest(test, (status) => {
      testStatus.value = status;
    });
    testResults.value.push(result);
  }
  testStatus.value = 'Selected tests completed.';
}

async function handleCreate() {
  try {
    const existingUuid = localStorage.getItem('UUID');
    const typedNickname = nickname.value.trim();
    const result = await createLobby(typedNickname, playerColor.value, existingUuid);
    localStorage.setItem('UUID', result.playerId);
    if (typedNickname) {
      localStorage.setItem('nickname', typedNickname);
    } else {
      localStorage.removeItem('nickname');
    }
    localStorage.setItem('playerColor', result.color);
    router.push(`/game/${result.id}`);
  } catch (e) {
    console.error("Lobby creation failed:", e);
  }
}

async function handleJoin() {
  if (!lobbyCodeInput.value) return alert("Please input a lobby code");
  
  try {
    const existingUuid = localStorage.getItem('UUID');
    const typedNickname = nickname.value.trim();
    const result = await joinLobby(lobbyCodeInput.value.toUpperCase(), typedNickname, playerColor.value, existingUuid);
    localStorage.setItem('UUID', result.playerId);
    if (typedNickname) {
      localStorage.setItem('nickname', typedNickname);
    } else {
      localStorage.removeItem('nickname');
    }
    localStorage.setItem('playerColor', result.color);
    router.push(`/game/${lobbyCodeInput.value.toUpperCase()}`);
  } catch (e) {
    console.error("Joining failed:", e);
  }
}

const availableColors = [
  '#afc792',
  '#dcdc90',
  '#92b0b9', 
  '#b69a74',
  '#b1aea5',
  '#f1f5f1'
];

async function cycleColor() {
  const me = players.value.find(p => p.id === myId.value);
  if (!me) return;

  const usedColors = players.value
    .filter(p => p.id !== myId.value)
    .map(p => p.color);

  const currentColor = me.color || '#f1f5f1';
  const currentIndex = availableColors.indexOf(currentColor);

  for (let i = 1; i <= availableColors.length; i++) {
    const nextIndex = (currentIndex + i) % availableColors.length;
    const nextColor = availableColors[nextIndex];
    if (nextColor === '#f1f5f1' || !usedColors.includes(nextColor)) {
      const playerRef = doc(db, `lobbies/${lobbyId.value}/players`, myId.value);
      await updateDoc(playerRef, { color: nextColor });
      localStorage.setItem('playerColor', nextColor);
      break;
    }
  }
}

async function handleRename(newName) {
  if (!myId.value) return;
  const trimmed = newName.trim();

  const playerRef = doc(db, `lobbies/${lobbyId.value}/players`, myId.value);
  if (trimmed) {
    await updateDoc(playerRef, { name: trimmed });
    localStorage.setItem('nickname', trimmed);
  } else {
    localStorage.removeItem('nickname');
  }
}
</script>

<template>
  <div class="pacific-root min-h-screen flex flex-col items-center p-6 relative overflow-x-hidden overflow-y-auto">
    
    <!-- Layered ocean background -->
    <div class="bg-layer bg-deep"></div>
    <div class="bg-layer bg-mid"></div>
    <div class="bg-layer bg-sky"></div>
    <div class="bg-layer bg-palms"></div>
    <div class="bg-layer bg-shimmer"></div>

    <div class="particle p1"></div>
    <div class="particle p2"></div>
    <div class="particle p3"></div>
    <div class="particle p4"></div>
    <div class="particle p5"></div>

    <div class="main-app-container w-full max-w-2xl flex flex-col justify-between">
      
      <div class="entry-screen flex flex-col justify-between h-full w-full gap-12">

        <div class="title-block text-center">
          <h1 class="game-title">PACIFIC</h1>
          <p class="designer-credit">Designed by <em>Donald X. Vaccarino</em></p>
        </div>

        <div class="tagline-container">
          <p class="tagline">2–5 players · Simultaneous play</p>
        </div>

        <div class="entry-form">
          <div class="input-grid">
            <div class="field-container">
              <label class="field-label">Your Name</label>
              <input
                v-model="nickname"
                placeholder="Enter nickname…"
                class="pacific-input"
              />
            </div>

            <div class="field-container">
              <label class="field-label">Lobby Code</label>
              <input
                v-model="lobbyCodeInput"
                placeholder="Enter code…"
                class="pacific-input input-code tracking-widest"
              />
            </div>
          </div>

          <div class="action-columns">
            <button @click="handleCreate" class="pacific-btn btn-create">
              <GameToken type="factory" size="md" class="btn-token" /> Create Lobby
            </button>

            <button @click="handleJoin" class="pacific-btn btn-join">
              <GameToken type="fish" size="md" class="btn-token" /> Join Lobby
            </button>
          </div>
        </div>

        <footer class="credits text-center">
          <div class="credits-block">
            <div class="credits-links">
              <a href="https://www.riograndegames.com/games/pacific/" target="_blank" rel="noopener" class="credit-link">
                Rio Grande Games
              </a>
              <span class="credits-sep">·</span>
              <a href="https://github.com/vbst7/pacific-game" target="_blank" rel="noopener" class="credit-link">
                GitHub
              </a>
            </div>
            <p class="credits-note">Fan implementation — not for commercial use</p>
          </div>
        </footer>
      </div>

    </div>

    <div v-if="isDev" class="relative z-10 mt-16 w-full max-w-2xl p-6 rounded-xl border border-dashed border-white/20 bg-black/30 backdrop-blur-md dev-panel flex-shrink-0">
      <div class="flex justify-between items-center mb-4 dev-panel-header">
        <h3 class="text-[11px] font-black uppercase tracking-widest text-white/40">Developer Test Suite</h3>
        <div class="flex gap-2 dev-panel-actions">
          <button @click="toggleAllTests" class="text-[11px] bg-white/10 text-white/60 px-3 py-1 rounded hover:bg-white/20 font-bold uppercase transition-colors">Toggle All</button>
          <button @click="handleRunTests" class="text-[11px] bg-indigo-600/80 text-white px-3 py-1 rounded hover:bg-indigo-500 font-bold transition-colors">RUN SELECTED</button>
        </div>
      </div>
      <div class="mb-4 max-h-48 overflow-y-auto border border-white/10 rounded p-2 bg-black/20 space-y-1 test-list">
        <div v-for="test in gameTests" :key="test.name" class="flex items-center gap-2 test-item">
          <input
            type="checkbox"
            :id="'test-' + test.name"
            :value="test.name"
            v-model="selectedTestNames"
            class="w-3 h-3 rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
          >
          <label :for="'test-' + test.name" class="text-[11px] text-white/50 cursor-pointer hover:text-white/80 truncate transition-colors">
            {{ test.name }}
          </label>
        </div>
      </div>
      <p class="text-[11px] text-indigo-300 italic mb-2">{{ testStatus }}</p>
      <div class="space-y-1 test-results">
        <div
          v-for="res in testResults"
          :key="res.name"
          class="flex flex-col text-xs p-2 bg-black/20 rounded cursor-help border border-transparent hover:border-white/10 transition-colors result-row"
          :title="res.actual ? 'MAT STATE:\n' + JSON.stringify(res.actual.mat, null, 2) + '\n\nMONEY: ' + res.actual.money : ''"
        >
          <div class="flex justify-between w-full">
            <span class="font-bold text-white/70">{{ res.name }}</span>
            <span :class="res.pass ? 'text-emerald-400' : 'text-rose-400'" class="font-black">
              {{ res.pass ? 'PASSED' : 'FAILED' }}
            </span>
          </div>
          <div v-if="!res.pass && res.error" class="mt-1 text-[11px] text-rose-300 italic border-t border-white/10 pt-1">
            {{ res.error }}
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Lora:ital,wght@0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');

/* ── Fallback Utilities for Dev Isolation ── */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-grow { flex-grow: 1; }
.flex-shrink-0 { flex-shrink: 0; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-start { justify-content: flex-start; }
.text-center { text-align: center; }
.uppercase { text-transform: uppercase; }
.relative { position: relative; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.max-w-lg { max-width: 32rem; }
.max-w-2xl { max-width: 42rem; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
.gap-8 { gap: 2rem; }
.gap-12 { gap: 3rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-5 { margin-bottom: 1.25rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mt-10 { margin-top: 2.5rem; }
.mt-16 { margin-top: 4rem; }
.p-2 { padding: 0.5rem; }
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }

/* ── Root Container ── */
.pacific-root {
  font-family: 'Lora', Georgia, serif;
  background: #0a2a3a;
  color: #f0ebe0;
  min-height: 100vh;
  box-sizing: border-box;
}

.pacific-root * {
  box-sizing: border-box;
}

/* ── Main Full Screen Scaled Wrapper ── */
.main-app-container {
  height: calc(100vh - 3rem); /* Locks view exactly within window dimensions minus padding */
  min-height: 580px;
  flex-shrink: 0;
  z-index: 10;
}

/* Layered painterly ocean bg */
.bg-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bg-deep {
  background: linear-gradient(180deg, #0d3347 0%, #0a4a5e 40%, #0e6b72 70%, #147a6a 100%);
}

.bg-mid {
  background: radial-gradient(ellipse 120% 60% at 50% 80%, rgba(20,122,106,0.5) 0%, transparent 70%);
}

.bg-sky {
  background: radial-gradient(ellipse 80% 50% at 50% 5%, rgba(100,200,230,0.25) 0%, transparent 60%),
              radial-gradient(ellipse 40% 30% at 70% 10%, rgba(255,230,150,0.15) 0%, transparent 50%);
}

.bg-shimmer {
  background:
    radial-gradient(ellipse 60% 20% at 20% 60%, rgba(20,180,160,0.12) 0%, transparent 70%),
    radial-gradient(ellipse 50% 15% at 80% 75%, rgba(41,143,180,0.1) 0%, transparent 70%),
    radial-gradient(ellipse 70% 25% at 50% 90%, rgba(14,107,114,0.15) 0%, transparent 60%);
  animation: caustic-drift 12s ease-in-out infinite alternate;
}

@keyframes caustic-drift {
  from { opacity: 0.7; transform: scale(1) translateY(0); }
  to   { opacity: 1;   transform: scale(1.04) translateY(-8px); }
}


.bg-palms {
  position: fixed;
  left: 0;            /* Keeps them justified to the left */
  right: -5%;             /* Allows the container to span across if needed */
  
  /* 1. Control the Vertical Position */
  top: 0vh;            /* Starts the trees 30% down from the top of the screen */
  bottom: -20vh;        /* Extends them 20% past the bottom of the screen */
  
  /* 2. Image Handling */
  background-image: url('/images/palm_trees.png');
  background-repeat: no-repeat;
  
  /* 3. The Move/Resize Secret: */
  /* This makes the image 120% of the screen height so it overflows the bottom */
  background-size: auto 120%; 
  
  /* This aligns the image to the bottom-left of your 30vh-offset container */
  background-position: bottom right; 

  /* Subtle parallax/drift to match your ocean animation */
  animation: palm-sway 20s ease-in-out infinite alternate;
  
  filter: contrast(0.9) saturate(0.5) brightness(0.2)  blur(3px);
  opacity: 1; 
  pointer-events: none;
  z-index: 0;
}

@keyframes palm-sway {
  from { transform: scale(1.05) translateX(-10px) rotate(-1deg); }
  to   { transform: scale(1.05) translateX(10px) rotate(1deg); }
}

/* ── Floating particles ── */
.particle {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  background: rgba(255,255,255,0.06);
  animation: float-particle linear infinite;
  z-index: 0;
}
.p1 { width: 6px; height: 6px; left: 12%; animation-duration: 18s; animation-delay: 0s; }
.p2 { width: 4px; height: 4px; left: 35%; animation-duration: 22s; animation-delay: -5s; }
.p3 { width: 8px; height: 8px; left: 58%; animation-duration: 15s; animation-delay: -9s; }
.p4 { width: 5px; height: 5px; left: 78%; animation-duration: 25s; animation-delay: -3s; }
.p5 { width: 3px; height: 3px; left: 90%; animation-duration: 19s; animation-delay: -12s; }

@keyframes float-particle {
  0%   { transform: translateY(110vh) scale(1);   opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 0.5; }
  100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
}

/* ── Viewport Containers ── */
.entry-screen {
  position: relative;
  width: 100%;
}

/* ── Title ── */
.game-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 7.5rem;
  line-height: 0.9;
  letter-spacing: 0.04em;
  color: #EF6A3E;
  margin: 0;
  text-shadow:
    5px 5px 0 #1a3d4f,
    -1px -1px 0 #1a3d4f,
    1px -1px 0 #1a3d4f,
    -1px 1px 0 #1a3d4f;
  animation: title-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes title-in {
  from { opacity: 0; transform: translateY(-20px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.title-block {
  animation: fade-up 0.6s ease both;
  text-align: center;
  margin-top: 1rem;
}

.designer-credit {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.2rem;
  color: rgba(240,235,224,0.7);
  margin: 0.75rem 0 0 0;
}

.designer-credit em {
  font-style: italic;
  color: rgba(240,235,224,0.9);
}

.tagline-container {
  background: rgba(207, 181, 144, 1);
  padding: 1.25rem 2.5rem;
  border-radius: 0.35rem;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  width: fit-content;
  margin: 0 auto;
  text-align: center;
}

.tagline {
  font-family: 'Space Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #3e3327;
  margin: 0;
}

/* ── Form Blocks ── */
.entry-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  width: 100%;
}

.field-container {
  background: rgba(207, 181, 144, 1);
  border-radius: 0.35rem;
  padding: 1.5rem 1.75rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

/* ── Form Fields & Labels ── */
.field-label {
  display: block;
  font-family: 'Space Mono', monospace;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #3e3327;
  margin-bottom: 0.75rem;
}

.pacific-input {
  width: 100%;
  background: #eddcc4;
  border: none;
  border-radius: 0.3rem;
  padding: 1rem 1.25rem;
  color: #3e3327;
  font-family: 'Lora', Georgia, serif;
  font-size: 1.25rem;
  outline: none;
}

.pacific-input::placeholder {
  color: rgba(62, 51, 39, 0.5);
}

.tracking-widest {
  letter-spacing: 0.15em;
}

/* ── Action Grid Buttons ── */
.action-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  width: 100%;
}

@media (max-width: 500px) {
  .action-columns {
    grid-template-columns: 1fr;
  }
}

.pacific-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1.2rem 2rem;
  border-radius: 0.45rem;
  font-family: 'Space Mono', monospace;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  color: #ffffff;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  transition: transform 0.1s, filter 0.15s;
}

.pacific-btn:hover {
  filter: brightness(1.08);
}

.pacific-btn:active {
  transform: scale(0.99);
}

.btn-create {
  background: #df5328;
}

.btn-join {
  background: #e1ebec;
  color: #3e3327;
}

.btn-token {
  transform: scale(1.1);
}

/* ── Glass Panel (Lobby Room Setup) ── */
.glass-panel {
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 1.25rem;
  box-shadow:
    0 8px 32px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(255,255,255,0.1);
  animation: fade-up 0.5s 0.15s ease both;
}

.lobby-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-start {
  background: #EF6A3E;
  font-size: 1rem;
  padding: 0.8rem 1.8rem;
  width: auto;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Lobby code ── */
.lobby-code {
  font-family: 'Space Mono', monospace;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #EF6A3E;
  margin: 0;
  text-shadow: 0 2px 8px rgba(239,106,62,0.3);
}

/* ── Player rows ── */
.player-list {
  display: flex;
  flex-direction: column;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.75rem;
}

.player-info {
  display: flex;
  align-items: center;
}

.color-dot {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 0.35rem;
  border: 2px solid transparent;
  flex-shrink: 0;
}

.dot-mine {
  border-color: rgba(255,255,255,0.5);
  cursor: pointer;
}

.player-name {
  font-family: 'Lora', Georgia, serif;
  font-size: 1.1rem;
  color: #f0ebe0;
}

.player-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  color: #f0ebe0;
  font-family: 'Lora', Georgia, serif;
  font-size: 1.1rem;
  outline: none;
}

.host-badge {
  font-family: 'Space Mono', monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #298fb4;
  border: 1px solid rgba(41,143,180,0.4);
  background: rgba(41,143,180,0.1);
  padding: 0.25rem 0.65rem;
  border-radius: 0.3rem;
}

/* ── Credits / Footer Panel ── */
.credits {
  margin-bottom: 1rem;
  width: 100%;
}

.credits-block {
  background: rgba(207, 181, 144, 1);
  padding: 1.25rem;
  border-radius: 0.35rem;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

.credits-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
}

.credit-link {
  font-family: 'Space Mono', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: #3e3327;
  text-decoration: underline;
  text-transform: uppercase;
  transition: color 0.2s ease;
}

.credit-link:hover {
  color: #EF6A3E;
}

.credits-sep {
  color: #3e3327;
  font-weight: 700;
}

.credits-note {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.7rem;
  font-style: italic;
  color: rgba(62, 51, 39, 0.7);
  margin: 0.35rem 0 0 0;
}

/* ── Developer Panel Safety Rules ── */
.dev-panel {
  box-sizing: border-box;
}
.dev-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dev-panel-actions {
  display: flex;
  gap: 0.5rem;
}
.test-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.test-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.test-results {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.result-row {
  display: flex;
  flex-direction: column;
}
</style>