<template>
  <div class="pacific-root w-screen h-screen flex flex-col relative overflow-hidden bg-[#0d3347]"
       :class="[internalStatus === 'waiting' ? 'lobby-root' : (internalStatus === 'in-progress' || internalStatus === 'finished' ? 'game-root' : '')]">
    <!-- 0. DECORATIVE BACKGROUND (Isolated from flex layout) -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <!-- Layered ocean background -->
      <div class="bg-layer bg-deep"></div>
      <div class="bg-layer bg-mid"></div>
      <div class="bg-layer bg-sky"></div>
      <div class="bg-layer bg-palms"></div>
      <div class="bg-layer bg-shimmer"></div>

      <!-- Floating particles -->
      <div class="particle p1"></div>
      <div class="particle p2"></div>
      <div class="particle p3"></div>
      <div class="particle p4"></div>
      <div class="particle p5"></div>
    </div>

    <!-- 1. WAITING ROOM UI -->
    <div v-if="lobbyData && lobbyData.status === 'waiting'" class="relative z-10 w-full max-w-2xl flex flex-col gap-8 lobby-room"
         key="waiting-room-ui">
          
          <div class="title-block text-center">
            <h1 class="game-title">PACIFIC</h1>
            <p class="designer-credit">Designed by <em>Donald X. Vaccarino</em></p>
          </div>

          <div class="tagline-container">
            <p class="tagline">2–5 Players · Simultaneous Play</p>
          </div>

          <div class="paper-box">
            <div class="flex justify-between items-center mb-6 lobby-header-row">
              <div class="flex items-baseline gap-2">
                <span class="field-label mb-0" style="color: black; display: inline;">Lobby Code: </span>
                <span class="lobby-code">{{ lobbyId }}</span>
              </div>
              <div class="flex gap-2">
                <button @click="handleReturnToHome" 
                        class="pacific-btn bg-slate-600 hover:bg-slate-500 text-white !py-2 !px-4 !text-[10px] !shadow-none uppercase font-black">
                  Leave
                </button>
                <button v-if="isHost" @click="handleStartGame" class="pacific-btn btn-start">
                  START GAME
                </button>
              </div>
            </div>

            <div class="space-y-4 player-list">
              <div
                v-for="player in players"
                :key="player.id"
                class="player-row"
              >
                <div class="flex items-center gap-4 player-info">
                  <div
                    class="color-dot"
                    :class="[player.id === myPlayerId ? 'dot-mine' : '']"
                    :style="{ backgroundColor: player.color || '#94a3b8' }"
                    @click="player.id === myPlayerId && cycleColor()"
                    :title="player.id === myPlayerId ? 'Click to change colour' : ''"
                  ></div>
                  
                  <span v-if="player.id !== myPlayerId" class="player-name" :style="{ color: player.color }">{{ player.name }}</span>
                  <input
                    v-else
                    :value="player.name"
                    @change="handleRename($event.target.value)"
                    class="player-name-input"
                    placeholder="Enter nickname..."
                    :style="{ color: player.color }"
                  />
                  <span v-if="player.id === lobbyData?.hostId" class="host-badge">Host</span>
                </div>

                <!-- Developer Hand Override -->
                <div v-if="isDev && isHost" class="ml-auto">
                  <select 
                    v-model="forcedStartingCards[player.id]"
                    class="bg-black/40 text-white text-[10px] font-black uppercase px-2 py-1 rounded border border-white/20 outline-none focus:border-amber-400"
                  >
                    <option :value="undefined">Random Hand</option>
                    <option v-for="card in cardsData" :key="card.name" :value="card.name">
                      {{ card.name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
    </div>

    <!-- 2. ACTUAL GAME UI -->
    <div v-else-if="lobbyData?.status === 'in-progress' || lobbyData?.status === 'finished'" 
     class="flex flex-1 w-full overflow-hidden relative z-10 min-h-0">
      <!-- MAIN COLUMN: Combined Left Sidebar, Board, and Hand -->
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <!-- TOP AREA: Sidebar + Board -->
        <div class="flex-1 flex min-h-0 overflow-hidden">
        <!-- LEFT: Unified Player List (Downsized from w-64) -->
        <aside class="w-48 border-r border-slate-800/10 bg-white/30 backdrop-blur-md p-3 flex flex-col gap-2 shadow-xl overflow-hidden min-h-0">
        <div class="flex-none flex flex-col gap-3 shrink-0">
          <!-- 1. YOUR CARD -->
          <div v-if="myPlayer && !myPlayer.isSpectator" 
              @click="selectPlayer(myPlayer.id)"
              class="cursor-pointer transition-all duration-200 border-2 rounded-xl p-3 shadow-md flex flex-col relative overflow-hidden"
              :class="isViewingSelf ? 'border-amber-400 scale-105 shadow-lg' : 'border-white/10 opacity-50 hover:opacity-100'"
              :style="{ backgroundColor: myPlayer.color }">
            <div v-if="isViewingSelf" class="absolute top-0 right-0 bg-amber-500 px-2 py-0.5 text-[8px] font-black text-white uppercase rounded-bl-lg">Viewing</div>
            <div class="absolute top-0 left-0 bg-black/20 px-2 py-0.5 text-[8px] font-black text-white uppercase rounded-br-lg">
              {{ myPlayer.isSpectator ? 'Spectator' : 'You' }}
            </div>
            <div class="flex justify-between items-center font-bold mt-2">
              <span style="color: black" class="drop-shadow-sm font-black">
                {{ myPlayer.name }}
              </span>
              <div class="flex items-center gap-1.5">
                <GameToken type="money" size="sm" class="!w-3 !h-3" />
                <span class="text-black text-base font-black">{{ myPlayer.money }}</span>
              </div>
            </div>
          </div>

          <!-- 2. OPPONENTS -->
          <div v-for="p in realOpponents" :key="p.id" 
              @click="selectPlayer(p.id)"
              class="cursor-pointer transition-all duration-200 border-2 rounded-xl p-3 shadow-sm flex flex-col relative"
              :class="selectedPlayerId === p.id ? 'border-cyan-400 scale-105 shadow-lg' : 'border-white/10 opacity-50 hover:opacity-100'"
              :style="{ backgroundColor: p.color }">
            <div v-if="selectedPlayerId === p.id" class="absolute top-0 right-0 bg-cyan-500 px-2 py-0.5 text-[8px] font-black text-white uppercase rounded-bl-lg">Viewing</div>
            <div class="flex justify-between items-center font-bold">
              <span style="color: black" class="drop-shadow-sm text-sm font-black">
                {{ p.name }}
              </span>
              <div class="flex items-center gap-1.5">
                <GameToken type="money" size="sm" class="!w-3 !h-3" />
                <span class="text-black text-sm font-black">{{ p.money }}</span>
              </div>
            </div>
            <div class="mt-1 flex gap-2">
              <span class="text-[9px] uppercase font-bold text-black/60">Cards: {{ p.hand?.length || 0 }}</span>
            </div>
          </div>

          <!-- 3. SPECTATORS CARD -->
          <div v-if="spectators.length > 0"
               class="transition-all duration-200 border-2 border-white/10 opacity-60 rounded-xl p-3 shadow-sm flex flex-col relative"
               style="background-color: rgba(30, 41, 59, 0.7)">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Spectators</span>
            </div>
            <div class="space-y-1">
              <div v-for="s in spectators" :key="s.id" class="text-xs font-bold text-slate-200 flex items-center gap-2">
                <div class="w-1 h-1 rounded-full bg-slate-500"></div>
                {{ s.name }}
                <span v-if="s.id === myUuid" class="text-[10px] opacity-50">(You)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Area (Grows as needed) & Personal Log Area (Fills remainder, scrollable) -->
        <div v-if="!myPlayer?.isSpectator && (myPlayer?.interaction || phaseActionRequired || myPlayer?.turnLogs?.length > 0)" 
             class="flex-1 min-h-0 flex flex-col mt-4 pt-4 border-t border-slate-800/10 overflow-hidden">
          
          <!-- Interaction Instructions Overlay -->
          <div v-if="myPlayer?.interaction || phaseActionRequired" 
               class="flex-none bg-amber-50 border-2 border-amber-400 rounded-xl p-3 shadow-lg ring-4 ring-amber-400/10 animate-in fade-in slide-in-from-left-4 duration-300 mb-4 shrink-0">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 bg-amber-500 rounded-full animate-ping"></div>
                <h4 class="text-[10px] font-black text-amber-800 uppercase tracking-widest">
                  {{ (myPlayer?.interaction || !phaseActionRequired?.isWaiting) ? 'Action Required' : 'Status' }}
                </h4>
            </div>
            <p class="text-sm font-bold text-slate-800 leading-snug mb-3">
              <template v-for="(part, pIdx) in parsedCurrentInstruction" :key="pIdx">
                <span v-if="part.type === 'text'" v-html="part.content"></span>
                <span v-else class="inline-block align-middle translate-y-[-1px] mx-0.5">
                  <GameToken :type="part.content" size="sm" class="!w-4 !h-4 !border-none shadow-none" :class="{ 'text-[#FFE187]': part.content === 'balloon' }" />
                </span>
              </template>
            </p>
            
            <!-- Dynamic Buttons Section -->
            <div class="flex flex-col gap-2">
              <template v-if="myPlayer?.interaction">
                <template v-if="myPlayer.interaction.type === 'choose-element'">
                  <button v-for="element in myPlayer.interaction.pendingElements" :key="element"
                          @click="resolveInteraction(element)"
                          class="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm transition-all active:scale-95">
                    Run {{ element }}
                  </button>
                </template>

                <button v-if="myPlayer.interaction.type === 'run-factory'"
                        @click="resolveInteraction('pass')"
                        class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm transition-all active:scale-95">
                  Finish Factory / Skip
                </button>
                <template v-if="myPlayer.interaction.type === 'mtr-choose-first'">
                  <button @click="resolveInteraction(myPlayer.interaction.card1.instanceId)"
                          class="w-full py-2 bg-blue-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                    {{ myPlayer.interaction.card1.name }} First
                  </button>
                  <button @click="resolveInteraction(myPlayer.interaction.card2.instanceId)"
                          class="w-full py-2 bg-blue-500 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">
                    {{ myPlayer.interaction.card2.name }} First
                  </button>
                </template>

                <button v-if="myPlayer.interaction.canPass"
                        @click="resolveInteraction('pass')"
                        class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm transition-all active:scale-95">
                  Pass / Finish Early
                </button>
                <button v-if="myPlayer.interaction.snapshot"
                        @click="resolveInteraction('cancel')"
                        class="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-black uppercase rounded-lg shadow-sm transition-all active:scale-95">
                  Cancel Action
                </button>
              </template>

              <template v-else-if="phaseActionRequired">
                  <template v-if="selectedCardId && !confirmedPlay && (lobbyData?.phase === 'hand-selection' || lobbyData?.phase === 'hand-selection-dsn')">
                    <button @click="handleConfirmPlay"
                            class="w-full py-2 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-green-700 transition-all active:scale-95">
                      Confirm Choice
                    </button>
                    <button @click="handleUndoSelection"
                            class="w-full py-2 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm hover:bg-rose-700 transition-all active:scale-95">
                      Undo
                    </button>
                  </template>
                <button v-if="phaseActionRequired.type === 'table-selection' && isTableSelectionConfirmable"
                        @click="handleConfirmPlayedCard"
                        class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded-lg shadow-sm transition-all active:scale-95">
                  Confirm Table Card
                </button>
              </template>
            </div>
          </div>

          <!-- Personal Interaction Log (Fills remainder, scrollable) -->
          <div v-if="myPlayer?.turnLogs?.length > 0" 
               class="flex-1 min-h-0 flex flex-col bg-blue-50 border-2 border-blue-400 rounded-xl p-2 shadow-lg ring-4 ring-blue-400/10 animate-in fade-in slide-in-from-left-4 duration-300 overflow-hidden">
            <h4 class="flex-none text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Your Current Actions:</h4>
            <div class="flex-1 overflow-y-auto pr-1 space-y-1 font-mono" ref="personalLogContainer">
              <p v-for="(log, idx) in myPlayer.turnLogs" :key="'personal-log-' + idx" class="text-sm text-slate-800 leading-snug flex items-center flex-wrap gap-x-1">
                ~ 
                <template v-for="(part, pIdx) in parseTokenLog(log)" :key="pIdx">
                  <span v-if="part.type === 'text'" v-html="part.content"></span>
                  <span v-else class="inline-block align-middle translate-y-[-1px]">
                      <GameToken :type="part.content" size="sm" class="!w-4 !h-4 !border-none shadow-none" :class="{ 'text-[#FFE187]': part.content === 'balloon' }" />
                  </span>
                </template>
              </p>
            </div>
          </div>
        </div>

      </aside>

          <!-- CENTER: Played Cards + Game Board -->
          <main class="flex-1 flex flex-col relative overflow-hidden bg-sky-400/5 min-h-0"
                @dragover.prevent="targetIndex = null">
  
            <!-- Top: Played Cards & Action Buttons (Shrink-0 ensures it stays its size) -->
            <section class="w-full p-3 flex justify-center shrink-0 relative z-20 bg-white/10 border-b border-white/20">
              <div class="flex gap-3 items-center">

                <!-- Played Card Slots -->
                <div v-for="n in 5" :key="n"
                    class="w-30 aspect-[5/7] shrink-0 rounded-xl flex items-center justify-center italic text-slate-800/40 bg-white/20 text-[10px] font-bold tracking-widest relative transition-all duration-300 played-card-slot"
                    :class="{
                      'hover:scale-110 hover:z-50 cursor-pointer': playedCards[n-1] && lobbyData?.phase === 'table-selection' && !confirmedPlayedCard,
                      'selected-table-card': playedCards[n-1] && (selectedPlayedCardId === playedCards[n-1].instanceId || secondPlayedCardId === playedCards[n-1].instanceId),
                      'is-selected': playedCards[n-1] && (selectedPlayedCardId === playedCards[n-1].instanceId || secondPlayedCardId === playedCards[n-1].instanceId) && !confirmedPlayedCard && lobbyData?.phase === 'table-selection',
                      'opacity-40': lobbyData?.phase === 'table-selection' && playedCards[n-1] && isTableCardDimmed(playedCards[n-1].instanceId)
                    }"
                    @dragover.prevent
                    @drop="onDropOnTable"
                    @click="playedCards[n-1] && handleSelectPlayedCard(playedCards[n-1])"
                    @contextmenu.prevent="handleInspectCard(playedCards[n-1])">

                  <!-- Slot Border Decoration -->
                  <div class="absolute inset-0 border-2 border-dashed rounded-xl pointer-events-none z-0 transition-colors duration-300"
                       :class="(lobbyData?.phase === 'hand-selection' || lobbyData?.phase === 'hand-selection-dsn') && (n-1) === mySlotIndex && !confirmedPlay
                               ? 'border-amber-400/50 bg-amber-400/5'
                               : 'border-slate-800/30'">
                  </div>

                  <template v-if="playedCards[n-1]">
                    <GameCard 
                      :card="playedCards[n-1]" 
                      :layout="useIllustratedView ? 'illustrated' : 'default'"
                      size="md" 
                      class="absolute inset-0 group-hover:border-white/30" 
                    />

                    <!-- Selection Markers (shown during execution) -->
                    <div v-if="lobbyData?.phase === 'execution'" class="absolute -bottom-3 left-0 right-0 flex flex-wrap justify-center gap-1 z-30 pointer-events-none">
                      <div v-for="p in getPlayersForCard(playedCards[n-1].instanceId)" 
                           :key="p.id"
                           class="px-2 py-0.5 rounded-full text-[9px] font-black text-black shadow-lg border border-white/20 whitespace-nowrap"
                           :style="{ backgroundColor: p.color }">
                        {{ p.name }}
                      </div>
                    </div>
                  </template>
                  <!-- Staged Selection for Hand Selection Phase -->
                  <template v-else-if="(lobbyData?.phase === 'hand-selection' || lobbyData?.phase === 'hand-selection-dsn') && (n-1) === mySlotIndex && stagedCard">
                    <div class="absolute inset-0 z-10 cursor-pointer"
                         :data-instance-id="stagedCard.instanceId"
                         @click="handleUndoSelection"
                         @contextmenu.prevent="handleInspectCard(stagedCard)">
                      <GameCard 
                        :card="stagedCard" 
                        :layout="useIllustratedView ? 'illustrated' : 'default'"
                        size="md" 
                        class="absolute inset-0 shadow-2xl" 
                      />
                    </div>
                  </template>
                  <template v-else>
                    Slot {{ n }}
                  </template>
                </div>
              </div>
            </section>

            <!-- Viewing Header Indicator (Positioned below the horizontal card row) -->
            <div class="absolute top-48 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div class="bg-white/90 backdrop-blur shadow-xl border-2 border-white px-6 py-2 rounded-full flex items-center gap-3">
                <div class="w-3 h-3 rounded-full animate-pulse" :style="{ backgroundColor: viewedPlayerData?.color }"></div>
                <span class="text-xs font-black uppercase tracking-widest text-slate-800">
                  {{ myPlayer?.isSpectator && isViewingSelf ? 'Spectating...' : (isViewingSelf ? 'Viewing Your Mat' : `Viewing ${viewedPlayerData?.name}'s Mat`) }}
                </span>
              </div>
            </div>

            <!-- Bottom: Game Mat (Wide and Squat) -->
            <section class="flex-1 relative flex items-center justify-center shadow-inner parchment-bg min-h-0 overflow-hidden"
            style="background-image: url('/images/map.png'); background-size: cover; background-position: top;">
      
              <div class="relative w-[900px] h-[262.5px] scale-90 lg:scale-100 origin-center z-10" :key="viewedPlayerData?.id">
                
              <!-- Next Turn Cards on Mat-->
              <template v-for="(slotPos, idx) in [{x: -17.5, y: 50}, {x: 957.5, y: 50}]" :key="idx">
                <div v-if="viewedPlayerData?.nextTurnCards?.[idx]"
                    class="absolute transform -translate-x-1/2 -translate-y-1/2 w-30 aspect-[5/7] cursor-pointer transition-all duration-300 z-20 hover:scale-125 hover:z-50 rounded-xl"
                    :style="{ left: slotPos.x + 'px', top: slotPos.y + 'px' }"
                    @contextmenu.prevent="handleInspectCard(viewedPlayerData.nextTurnCards[idx])">
                  <GameCard :card="viewedPlayerData.nextTurnCards[idx]" :layout="useIllustratedView ? 'illustrated' : 'default'" size="md" class="absolute inset-0" />
                </div>
              </template>
                
              <div v-for="(arrow, index) in arrows" :key="'arrow-' + index"
                  class="absolute w-18 h-18 rounded-full shadow-sm z-0 transition-all duration-300 bg-[#fdfcf0] border-2 border-slate-700/30 overflow-hidden"
                  :class="{
                    'cursor-pointer hover:bg-amber-100 ring-4 ring-amber-400 shadow-lg z-50 scale-110 !border-amber-500': myPlayer?.interaction?.type === 'select-arrow',
                  }"
                  :style="{ ...getArrowPosition(arrow), transform: `translate(-50%, -50%)` }"
                  @click="myPlayer?.interaction?.type === 'select-arrow' && resolveInteraction(index)">
                
                <svg viewBox="0 0 24 24" 
                     class="absolute top-1/2 left-1/2 w-8 h-8 text-slate-700/60 transition-all" 
                     :class="{ 'opacity-10': viewedPlayerData?.mat?.directFlight === index }" 
                     :style="{ transform: `translate(-50%, -50%) rotate(${arrow.rotation}deg)` }"
                     fill="none" stroke="currentColor" stroke-width="4">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                <GameToken v-if="viewedPlayerData?.mat?.directFlight === index" 
                           type="direct flight" 
                           size="md" 
                           class="absolute inset-0 !w-full !h-full !border-none !p-0 !m-0 shadow-2xl z-10 block text-white"
                           :style="{ transform: `rotate(${arrow.rotation}deg)` }" />
              </div>

              <!-- Area Group: Circle + Labels -->
              <div v-for="area in areas" :key="area.name" 
                  class="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  :style="getAreaPosition(area)"
                  @click="isAreaActive(area.name) && resolveInteraction(area.name)">
                
                 <!-- The Porthole Circle -->
            <div class="w-45 h-45 rounded-full shadow-2xl flex items-center justify-center border-4 z-10 relative overflow-hidden transition-colors duration-500"
                :style="{ 
                  borderColor: area.color,
                  backgroundColor: area.color
                }"
                :class="{ 'cursor-pointer hover:brightness-110 ring-4 ring-white animate-pulse': isAreaActive(area.name) }">

              <!-- Area Photo Background -->
              <img v-if="showAreaImages && areaPhotos[area.name]"
                  :src="areaPhotos[area.name]"
                      :alt="area.name"
                      class="absolute inset-0 w-full h-full object-cover opacity-80 z-0 pointer-events-none" />

                  <!-- Subtle Paper Aging Overlay -->
                  <div class="absolute inset-0 opacity-20 bg-[#d2b48c]/30"></div>

                  <!-- Token Grid Inside Circle -->
                  <TransitionGroup 
                    tag="div" 
                    name="token-pop"
                    class="relative z-20 grid grid-cols-2 gap-0.5 p-1"
                  >
                    <div v-for="[type, count] in getActiveTokens(area.name)" 
                        :key="type"
                        class="relative flex items-center gap-2 bg-white/60 rounded-full pr-3 pl-1 py-1 border shadow-sm transition-all duration-200"
                        :class="isTokenClickable(area.name, type) ? 'cursor-pointer border-red-500 ring-4 ring-red-500/20 z-30 scale-110 bg-red-50' : 'border-white/60'"
                        @click.stop="isTokenClickable(area.name, type) && resolveInteraction({ areaName: area.name, tokenType: type })">
                      <GameToken :type="type" size="md" :class="[type === 'balloon' ? 'text-[#FFE187]' : 'text-white', '!border-none']" />
                      <span class="text-sm font-black text-slate-800">{{ count }}</span>

                      <!-- Floating Number Animation -->
                      <TransitionGroup name="float-up">
                        <div v-for="num in floatingNumbers.filter(n => n.areaName === area.name && n.tokenType === type)"
                            :key="num.id"
                            class="absolute -top-6 left-1/2 -translate-x-1/2 text-emerald-600 font-black text-lg pointer-events-none drop-shadow-md z-30">
                          {{ num.delta }}
                        </div>
                      </TransitionGroup>
                    </div>
                  </TransitionGroup>
                </div>

                <!-- Labels under the circle -->
                <div class="mt-1 flex flex-col items-center pointer-events-none">
                  <span class="text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded shadow-sm text-black" 
                        :style="{ backgroundColor: area.color }">
                    {{ getAreaType(area.name) }}
                  </span>
                  <span class="text-xs font-bold text-slate-900 drop-shadow-sm uppercase">
                      {{ area.name === 'CoralSea' ? 'Coral Sea' : area.name }}
                  </span>
                </div>
              </div>
            </div>
          </section>
            </main>
        </div>

        <!-- Sort Buttons Bar -->
        <div v-if="!myPlayer?.isSpectator" class="bg-[#CF8841] px-6 py-1 flex justify-end gap-2 border-t border-slate-800/10 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)] z-30 shrink-0">
          <button @click="sortByType" class="bg-black/20 hover:bg-black/40 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full transition-colors border border-white/10">
            Sort by Type
          </button>
          <button @click="sortByName" class="bg-black/20 hover:bg-black/40 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full transition-colors border border-white/10">
            Sort by Name
          </button>
        </div>

        <!-- BOTTOM: Player Hand -->
        <section class="h-[180px] bg-[#CF8841] py-1 px-6 z-30 shrink-0 relative">
          <TransitionGroup 
            name="hand-list" 
            tag="div" 
            @dragover.stop.prevent
            class="flex justify-center gap-2 h-full items-end pb-2"
          >
            <div v-for="(card, index) in handVisibleInHand" :key="card.instanceId"
              :data-instance-id="card.instanceId"
              class="w-30 aspect-[5/7] shrink-0 cursor-pointer transition-all duration-300 group relative origin-bottom hand-card-item rounded-xl"
              :class="{
                'is-lifted': (lobbyData?.status !== 'finished') && (!selectedCardId || selectedCardId === card.instanceId) && !isDragging,
                'is-forced': card.instanceId === recentlyDroppedCardId || selectedCardId === card.instanceId,
                'is-selected selected-card': selectedCardId === card.instanceId,
                'opacity-50 pointer-events-none': (lobbyData?.status === 'finished') || (selectedCardId && selectedCardId !== card.instanceId), // Dim other cards if one is selected
                'opacity-0': (isDragging && card.instanceId === draggedCardId), // Hide the actual dragged card
              }"
                draggable="true"
                @dragstart="onDragStart($event, card)"
                @dragover.prevent="onDragOver($event, card)"
                @dragend="onDragEnd($event)"
                @click="lobbyData?.status !== 'finished' && handleSelectCard(card)"
                @contextmenu.prevent="handleInspectCard(card)">
              <GameCard :card="card" :layout="useIllustratedView ? 'illustrated' : 'default'" size="md" class="absolute inset-0" />
            </div>
          </TransitionGroup>
        </section>
        
      </div>

      <!-- RIGHT: Play Log (Frosted Sky) (Downsized from w-84) -->
      <aside class="w-64 border-l border-white/20 bg-black/50 backdrop-blur-md flex flex-col">
        <div class="flex-1 p-4 font-mono text-sm overflow-y-auto text-cyan-100 font-bold space-y-2" @contextmenu.prevent="handleLogContextMenu" ref="globalLogContainer">
          <p v-for="(log, idx) in logs" :key="idx" class="opacity-70 leading-relaxed">
            ~ 
            <template v-for="(part, pIdx) in parseTokenLog(log)" :key="pIdx">
              <span v-if="part.type === 'text'" v-html="part.content"></span>
              <span v-else class="inline-block align-middle translate-y-[-1px] mx-0.5">
                <GameToken :type="part.content" size="sm" class="!w-4 !h-4 !border-none shadow-none" :class="{ 'text-[#FFE187]': part.content === 'balloon' }" />
              </span>
            </template>
          </p>
        </div>
        <!-- Help / Rules Button -->
        <div class="p-4 border-t border-white/20 shrink-0">
          <button @click="showHelpModal = true; helpSubView = 'main'" class="w-full py-2 bg-cyan-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-cyan-600 transition-all active:scale-95 text-xs">
            Help / Rules
          </button>
          <button v-if="lobbyData?.status !== 'finished' && !myPlayer?.isSpectator" 
                  @click="handleResign" 
                  class="w-full mt-2 py-2 bg-rose-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-rose-600 transition-all active:scale-95 text-xs">
            Resign
          </button>
          <button v-else 
                  @click="handleReturnToHome" 
                  class="w-full mt-2 py-2 bg-rose-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-rose-600 transition-all active:scale-95 text-xs">
            Exit
          </button>
        </div>
      </aside>
    </div>

    <!-- 3. LOADING STATE -->
    <div v-else class="flex items-center justify-center h-screen relative z-50 text-white font-black uppercase tracking-widest">
      <div class="bg-black/20 backdrop-blur-md px-8 py-4 rounded-full">Connecting to lobby...</div>
    </div>

    <!-- Help Modal -->
    <Transition name="fade">
      <div v-if="showHelpModal" class="fixed inset-0 z-[1001] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click="showHelpModal = false">
        <div class="bg-white rounded-3xl w-full shadow-2xl overflow-hidden flex flex-col" :class="helpSubView === 'cards' ? 'max-w-6xl max-h-[90vh]' : 'max-w-md'" @click.stop>
          <!-- Header -->
          <header class="bg-slate-800 p-4 flex justify-between items-center shrink-0">
            <h3 class="text-white font-black uppercase tracking-widest">
              {{ helpSubView === 'main' ? 'Game Help' : helpSubView === 'cards' ? 'Card Gallery' : 'Quick Reference' }}
            </h3>
            <div class="flex gap-2">
               <button v-if="helpSubView !== 'main'" @click="helpSubView = 'main'" class="px-3 py-1 bg-slate-600 text-white text-[10px] font-black uppercase rounded hover:bg-slate-500">Back</button>
               <button @click="showHelpModal = false" class="px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded hover:bg-rose-500">Close</button>
            </div>
          </header>

          <!-- Content -->
          <div class="p-6 overflow-y-auto">
            <!-- Main Help View -->
            <div v-if="helpSubView === 'main'" class="space-y-4">
              <a href="https://www.riograndegames.com/wp-content/uploads/2025/06/Pacificrulesx.pdf" target="_blank" class="block w-full py-4 bg-blue-100 border-2 border-blue-400 rounded-xl text-blue-900 font-black text-center uppercase tracking-widest hover:bg-blue-200 transition-colors">
                Rulebook (External)
              </a>
              <button @click="helpSubView = 'cards'" class="w-full py-4 bg-emerald-100 border-2 border-emerald-400 rounded-xl text-emerald-900 font-black text-center uppercase tracking-widest hover:bg-emerald-200 transition-colors">
                Card Gallery
              </button>
          <div class="w-full py-4 px-6 bg-red-50 border-2 border-red-400 rounded-xl space-y-3">
            <div class="flex justify-between text-[10px] font-black uppercase tracking-widest text-red-800">
              <span :class="visualMode === 0 ? 'opacity-100' : 'opacity-40'">Minimal</span>
              <span :class="visualMode === 1 ? 'opacity-100' : 'opacity-40'">Standard</span>
              <span :class="visualMode === 2 ? 'opacity-100' : 'opacity-40'">Illustrated</span>
            </div>
            <input 
              type="range" 
              min="0" max="2" step="1" 
              v-model.number="visualMode" 
              class="w-full h-3 bg-red-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <p class="text-[9px] text-red-700 font-black uppercase text-center tracking-widest">Visual Style Preference</p>
          </div>
              <div class="p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-4 font-bold text-slate-800">
                <div v-for="(line, idx) in [
                  '(hotel): $1', 
                  '(boat): $1 per (fish)', 
                  '(fish): moves clockwise', 
                  '(factory): remove up to 3 (chit) for $2 each'
                ]" :key="idx" class="text-xl leading-relaxed">
                  <template v-for="(part, pIdx) in parseTokenLog(line)" :key="pIdx">
                    <span v-if="part.type === 'text'" v-html="part.content" class="inline"></span>
                    <span v-else class="inline-block align-middle mx-1">
                      <GameToken :type="part.content" size="md" class="!w-7 !h-7 !border-none shadow-none" />
                    </span>
                  </template>
                </div>
              </div>
              <p class="text-xs text-slate-400 italic text-center">Reference for base token effects during area runs.</p>
            </div>

            <!-- Card Gallery View -->
            <div v-else-if="helpSubView === 'cards'" class="space-y-6">
              <!-- Search Bar -->
              <div class="sticky top-0 z-10 bg-white pb-4">
                <div class="relative">
                  <input 
                    v-model="cardSearchQuery" 
                    type="text" 
                    placeholder="Search cards by name, type, or effect..." 
                    class="w-full py-4 pr-12 !pl-14 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 transition-colors font-bold shadow-sm"
                  />
                  <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <button v-if="cardSearchQuery" @click="cardSearchQuery = ''" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-black">✕</button>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <div v-for="card in filteredCards" :key="card.name" 
                      class="w-full aspect-[5/7] relative cursor-help hover:scale-105 transition-transform"
                      @contextmenu.prevent="handleInspectCard(card)"
                      @click="handleInspectCard(card)">
                  <GameCard :card="card" :layout="useIllustratedView ? 'illustrated' : 'default'" size="lg" class="absolute inset-0 border-2 border-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Resign Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showResignModal" class="fixed inset-0 z-[1002] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click="showResignModal = false">
        <div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6" @click.stop>
          <h3 class="text-slate-900 font-black uppercase tracking-widest text-lg mb-4 text-center">Resign Game?</h3>
          <p class="text-slate-600 font-bold text-sm text-center mb-6 leading-relaxed">
            Are you sure you want to resign? You will be removed from the game immediately.
          </p>
          <div class="flex gap-3">
            <button @click="showResignModal = false" class="flex-1 py-3 bg-slate-200 text-slate-700 font-black uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-all active:scale-95 text-xs">
              Cancel
            </button>
            <button @click="confirmResignation" class="flex-1 py-3 bg-rose-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all active:scale-95 text-xs">
              Confirm
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Zoom Overlay (Moved to end and z-index increased to stay above Gallery) -->
    <Transition name="fade">
      <div v-if="zoomedCard" 
           class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
           @click="zoomedCard = null">
        <div class="h-[85vh] aspect-[5/7] max-w-[90vw] relative cursor-default"
             @click.stop>
          <GameCard :card="zoomedCard" :layout="useIllustratedView ? 'illustrated' : 'default'" size="xl" class="absolute inset-0 border-4 border-white/20" />
        </div>
      </div>
    </Transition>

  </div>
  
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { nextTick } from 'vue'; // Import nextTick
import { useRouter } from 'vue-router';
import { useLobby } from '@/composables/useLobby';
import { db } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useCardPlay } from '@/composables/useCardPlay'; // New import
import cardsData from '@/cards.json';
import GameToken from '@/components/GameToken.vue';
import GameCard from '@/components/GameCard.vue';


const props = defineProps(['id']); 
const router = useRouter();
const safePush = (path) => router ? router.push(path) : console.warn("Router missing, cannot navigate to", path);

// Destructure myPlayerId and myNickname from useLobby
const { lobbyData, players, joinLobby, myPlayerId, myNickname, lobbyId } = useLobby();

// STABILIZER: Create a "sticky" status to prevent UI unmounting during Firestore sync flickers
const internalStatus = ref('loading');
watch(() => lobbyData.value?.status, (newVal) => {
  if (newVal) {
    internalStatus.value = newVal;
  }
}, { immediate: true });

// myUuid now directly comes from useLobby's myPlayerId ref
const myUuid = myPlayerId;
const globalLogContainer = ref(null);
const personalLogContainer = ref(null);
const selectedPlayerId = ref(null);

// Diagnostics Logging
watch(lobbyData, (newVal) => {
  if (newVal) {
    console.log('[GameView] Lobby Data Update:', {
      status: newVal.status,
      phase: newVal.phase,
      hostId: newVal.hostId,
      playedCardsCount: newVal.playedCards?.length
    });
  } else {
    console.warn('[GameView] Lobby Data is NULL');
  }
}, { deep: true, immediate: true });

watch(() => lobbyData.value?.status, (now, prev) => {
  console.log(`[GameView] Status Transition: "${prev}" -> "${now}"`);
  if (now === 'in-progress') console.log('[GameView] Player Count in Firestore:', players.value?.length);
});

watch(() => lobbyData.value?.status, (now, prev) => {
  console.log(`[GameView] Status changed from "${prev}" to "${now}"`);
});

watch(players, (newVal) => {
  console.log('[GameView] Players list updated. Count:', newVal?.length);
  if (newVal?.length > 0) {
    const me = newVal.find(p => p.id === myUuid.value);
    console.log('[GameView] Self in players list:', me ? 'Found' : 'NOT FOUND', 'ID:', myUuid.value);
    if (!me) {
      console.log('[GameView] Available player IDs:', newVal.map(p => p.id));
    }
  }
}, { deep: true });

let lastRenderTime = 0;

const draggedCardId = ref(null);
const diagnosticLogRender = () => {
  const now = Date.now();
  if (now - lastRenderTime > 100) { // Only log once every 100ms
    console.log('[GameView] UI Render Cycle:', {
      viewedPlayerData: !!viewedPlayerData.value,
      myPlayer: !!myPlayer.value,
      status: lobbyData.value?.status
    });
    lastRenderTime = now;
  }
  return '';
};

const zoomedCard = ref(null);

const handleInspectCard = (card) => {
  if (!card) return;
  zoomedCard.value = card;
};

const playerBuffer = ref(null);
const forcedStartingCards = ref({});

const targetIndex = ref(null);
const isDragging = ref(false);
const isRecentlyDropped = ref(false);
const recentlyDroppedCardId = ref(null);

const dragOffset = { x: 0, y: 0, lastX: 0, lastY: 0 };

const visualHand = computed(() => {
  if (!isDragging.value || !draggedCardId.value) {
    return hand.value;
  }
  const sourceHand = [...hand.value];
  const currentIndex = sourceHand.findIndex(c => c.instanceId === draggedCardId.value);
  if (currentIndex === -1) return sourceHand;

  const [movedCard] = sourceHand.splice(currentIndex, 1);
  if (targetIndex.value !== null) {
    sourceHand.splice(targetIndex.value, 0, movedCard);
  } else {
    sourceHand.splice(currentIndex, 0, movedCard);
  }
  return sourceHand;
});

const handVisibleInHand = computed(() => {
  const phase = lobbyData.value?.phase;
  const isHandSelection = phase === 'hand-selection' || phase === 'hand-selection-dsn';
  
  // During drag or animation, show the full list so indices stay stable
  if (isDragging.value) return visualHand.value;

  // Otherwise, hide the selected card if we're in the selection phase
  if (isHandSelection && selectedCardId.value) {
    return visualHand.value.filter(c => c.instanceId !== selectedCardId.value);
  }
  return visualHand.value;
});

const mySlotIndex = computed(() => {
  return players.value.findIndex(p => p.id === myUuid.value);
});

const stagedCard = computed(() => {
  if (!selectedCardId.value) return null;
  return hand.value.find(c => c.instanceId === selectedCardId.value);
});

const onDragStart = (event, card) => {
  const indexInHand = hand.value.findIndex(c => c.instanceId === card.instanceId);
  if (indexInHand === -1) return;

  const rect = event.currentTarget.getBoundingClientRect();
  dragOffset.x = event.clientX - rect.left;
  dragOffset.y = event.clientY - rect.top;

  draggedCardId.value = card.instanceId;
  targetIndex.value = indexInHand;
  event.dataTransfer.effectAllowed = 'move';

  // Hide source element after drag image capture
  setTimeout(() => {
    isDragging.value = true;
  }, 0);
};

const onDragOver = (event, card) => {
  dragOffset.lastX = event.clientX;
  dragOffset.lastY = event.clientY;

  if (!draggedCardId.value) return;

  // Find the target's stable index in the underlying hand array
  const indexInHand = hand.value.findIndex(c => c.instanceId === card.instanceId);
  if (indexInHand === -1 || targetIndex.value === indexInHand) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;

  // Thresholding: Only swap once the cursor actually crosses the midpoint of the target card
  if (targetIndex.value < indexInHand && event.clientX < midpoint) return;
  if (targetIndex.value > indexInHand && event.clientX > midpoint) return;

  targetIndex.value = indexInHand;
};

const onDropOnTable = () => {
  const phase = lobbyData.value?.phase;
  const isHandSelection = phase === 'hand-selection' || phase === 'hand-selection-dsn';
  
  if (isHandSelection && !confirmedPlay.value && draggedCardId.value) {
    const card = hand.value.find(c => c.instanceId === draggedCardId.value);
    if (card && selectedCardId.value !== card.instanceId) {
      handleSelectCard(card);
    }
  }
};

const onDragEnd = (event) => {
  const droppedCard = hand.value.find(c => c.instanceId === draggedCardId.value);
  if (!droppedCard) {
    isDragging.value = false;
    draggedCardId.value = null;
    targetIndex.value = null;
    return;
  }

  const oldIndex = hand.value.findIndex(c => c.instanceId === draggedCardId.value);
  const droppedId = droppedCard.instanceId;

  // Capture the visual order before we reset the dragging states
  const newOrder = [...visualHand.value];

  if (draggedCardId.value && targetIndex.value !== null && oldIndex !== targetIndex.value) {
    const me = players.value.find(p => p.id === myUuid.value);
    if (me) {
      // Optimistically update hand order
      me.hand = newOrder;
    }

    const playerRef = doc(db, `lobbies/${props.id}/players`, myUuid.value);
    updateDoc(playerRef, { hand: newOrder }); // Perform the update in the background
  }

  // Reappear immediately at hover size for reordering
  // (If dropped in top slot, card is removed from hand via handVisibleInHand filter)
  isDragging.value = false;
  recentlyDroppedCardId.value = droppedId;
  // Remove the forced hover state after a tiny delay to trigger the shrink animation
  setTimeout(() => {
    recentlyDroppedCardId.value = null;
  }, 50);

  draggedCardId.value = null;
  targetIndex.value = null;

  // Disable hover effects briefly after drop to prevent "ghost" hover triggers 
  // when the layout shifts during the final transition.
  isRecentlyDropped.value = true;
  setTimeout(() => {
    isRecentlyDropped.value = false;
  }, 500);
};

const sortByType = async () => {
  if (!hand.value.length) return;
  const sortedHand = [...hand.value].sort((a, b) => {
    const typeA = a.types?.[0] || 'Special';
    const typeB = b.types?.[0] || 'Special';
    const idxA = typeOrder.indexOf(typeA);
    const idxB = typeOrder.indexOf(typeB);
    if (idxA !== idxB) return idxA - idxB;
    return a.name.localeCompare(b.name);
  });
  const playerRef = doc(db, `lobbies/${props.id}/players`, myUuid.value);
  await updateDoc(playerRef, { hand: sortedHand });
};

const sortByName = async () => {
  if (!hand.value.length) return;
  const sortedHand = [...hand.value].sort((a, b) => a.name.localeCompare(b.name));
  const playerRef = doc(db, `lobbies/${props.id}/players`, myUuid.value);
  await updateDoc(playerRef, { hand: sortedHand });
};
const isDev = import.meta.env.DEV;

// Help Modal state
const showHelpModal = ref(false);
const helpSubView = ref('main');
const showResignModal = ref(false);
const cardSearchQuery = ref('');

const savedVisualMode = localStorage.getItem('visualMode');
const visualMode = ref(savedVisualMode !== null ? parseInt(savedVisualMode, 10) : 1);

watch(visualMode, (newVal) => {
  localStorage.setItem('visualMode', newVal.toString());
});

const useIllustratedView = computed(() => visualMode.value === 2);
const showAreaImages = computed(() => visualMode.value >= 1);

const filteredCards = computed(() => {
  const query = cardSearchQuery.value.toLowerCase().trim();
  if (!query) return cardsData;
  return cardsData.filter(card => {
    const nameMatch = card.name.toLowerCase().includes(query);
    const textMatch = card.text.toLowerCase().includes(query);
    const typeMatch = card.types.some(t => t.toLowerCase().includes(query));
    return nameMatch || textMatch || typeMatch;
  });
});

watch(showHelpModal, (newVal) => { if (!newVal) cardSearchQuery.value = ''; });

const areaPhotos = {
  Peru: '/images/areas/peru.jpg',
  Japan: '/images/areas/japan.jpg',
  California: '/images/areas/california.jpg',
  Polynesia: '/images/areas/polynesia.jpg',
  CoralSea: '/images/areas/coralsea.jpg',
}

const logs = computed(() => {
  if (lobbyData.value?.logs?.length > 0) {
    return lobbyData.value.logs;
  }
  return ["Game started!", "Waiting for players..."];
});

// Define myPlayer, opponents, hand, and isHost *before* useCardPlay
const myPlayer = computed(() => players.value.find(p => p.id === myUuid.value));
const opponents = computed(() => players.value.filter(p => p.id !== myUuid.value));
const hand = computed(() => {
  const p = isViewingSelf.value ? viewedPlayerData.value : myPlayer.value;
  return p?.hand || [];
});
const isHost = computed(() => lobbyData.value?.hostId === myUuid.value);
const realOpponents = computed(() => opponents.value.filter(p => !p.isSpectator));
const spectators = computed(() => players.value.filter(p => p.isSpectator));

// Auto-view first real player if spectator
watch([myPlayer, players], ([me, all]) => {
  if (me?.isSpectator && !selectedPlayerId.value && all.length > 0) {
    const firstReal = all.find(p => !p.isSpectator);
    if (firstReal) {
      selectedPlayerId.value = firstReal.id;
    }
  }
}, { immediate: true });

// Watch for our own removal from the players list (resignation or lobby deletion)
watch(myPlayer, (me, oldMe) => {
  if (oldMe && !me && lobbyData.value?.status !== 'loading') {
    router.push('/');
  }
  if (me) {
    console.log('[GameView] My Player State:', {
      name: me.name,
      interaction: me.interaction?.type,
      handSize: me.hand?.length,
      hasMat: !!me.mat
    });
  }
}, { deep: true });

watch(() => myPlayer.value, (newVal) => {
  if (newVal) {
    // Initialize buffer if it doesn't exist
    if (!playerBuffer.value) {
      playerBuffer.value = JSON.parse(JSON.stringify(newVal));
      return;
    }

    // Sync the entire state into the buffer whenever the Firestore data changes.
    // This ensures that server-side changes (like card execution effects) 
    // are reflected in the local "view" immediately.
    playerBuffer.value = JSON.parse(JSON.stringify(newVal));
  }
}, { immediate: true, deep: true });

// Helper to update the buffer
const updateLocalPlayer = (callback) => {
  if (!playerBuffer.value) return;
  callback(playerBuffer.value);
};

// This is the source of truth for the game mat display
const viewedPlayer = computed(() => {
  if (!selectedPlayerId.value) return myPlayer.value;
  return players.value.find(p => p.id === selectedPlayerId.value) || myPlayer.value;
});

const isViewingSelf = computed(() => {
  if (!viewedPlayer.value || !myUuid.value) return true;
  return viewedPlayer.value.id === myUuid.value;
});

const viewedPlayerData = computed(() => {
  const p = (isViewingSelf.value && playerBuffer.value) ? playerBuffer.value : viewedPlayer.value;

  // If we have real player data, return it immediately.
  if (p && p.mat && typeof p.mat === 'object' && Object.keys(p.mat).length > 0) return p;

  // Fallback structure to prevent template crashes during initial sync
  return { 
    mat: Object.fromEntries(areas.map(a => [a.name, { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 }])),
    name: 'Syncing...', 
    color: '#ccc', 
    hand: [], 
    money: 0, 
    turnLogs: [], 
    nextTurnCards: [],
    setAside: []
  };
});

const handleLogContextMenu = (e) => {
  const target = e.target.closest('.card-link');
  if (target) {
    const { instanceId, cardName } = target.dataset;
    // Search current played cards on table first
    let card = lobbyData.value?.playedCards?.find(c => c.instanceId === instanceId);
    // Fallback to master card definitions if card is no longer on table
    if (!card && cardName) {
      card = cardsData.find(c => c.name === cardName);
    }
    handleInspectCard(card);
  }
};

// Auto-scroll global log to bottom
watch(logs, () => {
  if (globalLogContainer.value) {
    nextTick(() => {
      globalLogContainer.value.scrollTop = globalLogContainer.value.scrollHeight;
    });
  }
}, { deep: true });

// Auto-scroll personal log to bottom
watch(() => myPlayer.value?.turnLogs, () => {
  if (personalLogContainer.value) {
    nextTick(() => {
      personalLogContainer.value.scrollTop = personalLogContainer.value.scrollHeight;
    });
  }
}, { deep: true });

/**
 * Parses a log string that may contain HTML and (token) patterns.
 * Splits it into parts to be rendered either as HTML or as GameToken components.
 */
const parseTokenLog = (text) => {
  if (!text) return [];
  const regex = /\((fish|hotel|boat|factory|chit|balloon|port|hatchery|direct flight|hq)\)/gi;
  let parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add the text/HTML before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    // Add the token
    parts.push({ type: 'token', content: match[1] });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }
  // Handle HTML entities like &nbsp;
  parts = parts.map(p => ({
      ...p, content: p.type === 'text' ? p.content.replace(/&nbsp;/g, ' ').replace(/CoralSea/g, 'Coral Sea') : p.content
  }));
  return parts;
};

const { 
  selectedCardId, confirmedPlay, handleSelectCard, handleConfirmPlay,
  selectedPlayedCardId, secondPlayedCardId, confirmedPlayedCard, handleSelectPlayedCard, handleConfirmPlayedCard, resolveInteraction
} = useCardPlay(
  computed(() => props.id), // lobbyId
  myPlayer, // myPlayer computed ref
  players,  // players ref
  lobbyData, // lobbyData ref
  myUuid, // myUuid ref (passed as a ref)
  isHost, // isHost computed ref
);

// Computed property to parse the current instruction text
const parsedCurrentInstruction = computed(() => {
  let instructionText = '';
  if (myPlayer.value?.interaction) {
    instructionText = myPlayer.value.interaction.instruction;
  } else if (phaseActionRequired.value) {
    instructionText = phaseActionRequired.value.instruction;
  }
  return parseTokenLog(instructionText);
});

const handleUndoSelection = () => {
  // Calling handleSelectCard with the currently selected card will deselect it.
  if (stagedCard.value) {
    const cardId = stagedCard.value.instanceId;
    handleSelectCard(stagedCard.value);

    // Smooth the transition back into the hand by forcing the hover state briefly
    recentlyDroppedCardId.value = cardId;
    setTimeout(() => {
      recentlyDroppedCardId.value = null;
    }, 300); // Match transition duration
  }
};

const phaseActionRequired = computed(() => {
  const phase = lobbyData.value?.phase;
  const player = myPlayer.value;
  if (player?.isSpectator) return null;
  if (!player || player.interaction) return null;

  const hasDSN = player.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network');

  if (phase === 'hand-selection' || phase === 'hand-selection-dsn') {
    // DSN Spy waiting in Phase 1
    if (phase === 'hand-selection' && hasDSN) {
      return { instruction: "Waiting for other players to offer cards...", type: "waiting", isWaiting: true };
    }
    // Non-DSN player waiting in Phase 2
    if (phase === 'hand-selection-dsn' && !hasDSN) {
      return { instruction: "Waiting for Dolphin Spy Network players...", type: "waiting", isWaiting: true };
    }

    if (!confirmedPlay.value) {
      // Special check to hide selection prompt for restricted players
      if (phase === 'hand-selection' && hasDSN) return null;
      if (phase === 'hand-selection-dsn' && !hasDSN) return null;

      return {
        instruction: selectedCardId.value
          ? "Confirm or Undo your selection." 
          : "Choose a card from your hand to offer.",
        type: "hand-selection"
      };
    }

    // Player has confirmed but phase hasn't shifted (waiting for peers)
    return { instruction: "Waiting for other players...", type: "waiting", isWaiting: true };
  }

  if (phase === 'table-selection') {
    if (!confirmedPlayedCard.value) {
      const hasMTR = player.nextTurnCards?.some(c => c.name === 'Make the Rounds');
      let instruction = "";
      
      if (hasMTR) {
        if (!selectedPlayedCardId.value && !secondPlayedCardId.value) {
          instruction = "Choose 2 cards from the table to execute.";
        } else if (!selectedPlayedCardId.value || !secondPlayedCardId.value) {
          instruction = "Choose one more card from the table.";
        } else {
          instruction = "Confirm your choices or change them.";
        }
      } else {
        instruction = selectedPlayedCardId.value 
          ? "Confirm your choice or pick another card." 
          : "Choose a card from the table to execute.";
      }

      return { instruction, type: "table-selection" };
    }
    return { instruction: "Waiting for other players...", type: "waiting", isWaiting: true };
  }

  return null;
});

const handleReturnToHome = async () => {
  const playerRef = doc(db, `lobbies/${props.id}/players`, myUuid.value); // Use UUID
  const lobbyRef = doc(db, 'lobbies', props.id);

  const pCount = players.value.length;

  if (pCount <= 1) {
    await Promise.all([deleteDoc(playerRef), deleteDoc(lobbyRef)]);
  } else {
    if (isHost.value) {
      const nextHost = players.value.find(p => p.id !== myUuid.value);
      if (nextHost) {
        await updateDoc(lobbyRef, { hostId: nextHost.id });
      }
    }
    await deleteDoc(playerRef);
  }
  safePush('/');
};

const handleResign = () => {
  showResignModal.value = true;
};

const confirmResignation = async () => {
  showResignModal.value = false;
  const playerRef = doc(db, `lobbies/${props.id}/players`, myUuid.value);
  const lobbyRef = doc(db, 'lobbies', props.id);

  if (players.value.length <= 1) {
    await Promise.all([deleteDoc(playerRef), deleteDoc(lobbyRef)]);
  } else {
    if (isHost.value) {
      const nextHost = players.value.find(p => p.id !== myUuid.value);
      if (nextHost) {
        await updateDoc(lobbyRef, { hostId: nextHost.id });
      }
    }
    await deleteDoc(playerRef);
  }

  // Redirecting home stops listeners via useLobby's onUnmounted hook
  safePush('/');
};

const availableColors = [
  '#afc792',
  '#dcdc90',
  '#92b0b9', 
  '#b69a74',
  '#b1aea5',
  '#f1f5f1'
];

async function cycleColor() {
  const playerId = myUuid.value; 
  const lobbyId = props.id;

  const me = players.value.find(p => p.id === playerId);
  if (!me) return;

  const usedColors = players.value
    .filter(p => p.id !== playerId)
    .map(p => p.color);

  const currentColor = me.color || '#f1f5f1';
  const currentIndex = availableColors.indexOf(currentColor);

  for (let i = 1; i <= availableColors.length; i++) {
    const nextIndex = (currentIndex + i) % availableColors.length;
    const nextColor = availableColors[nextIndex];
    if (nextColor === '#f1f5f1' || !usedColors.includes(nextColor)) {

      const playerRef = doc(db, `lobbies/${lobbyId}/players`, playerId);
      await updateDoc(playerRef, { color: nextColor });
      localStorage.setItem('playerColor', nextColor);
      break;
    }
  }
}

async function handleRename(newName) {
  const playerId = myUuid.value; 
  const lobbyId = props.id;

  if (!playerId || newName === myPlayer.value?.name) return;
  const trimmed = (newName || '').trim();

  try {
    const playerRef = doc(db, `lobbies/${lobbyId}/players`, playerId);
    if (trimmed) {
      await updateDoc(playerRef, { name: trimmed });
      localStorage.setItem('nickname', trimmed);
    } else {
      localStorage.removeItem('nickname');
    }
  } catch (e) {
    console.error("Failed to rename player:", e);
  }
}

const selectPlayer = (id) => {
  selectedPlayerId.value = id;
};

// 1. Data Definitions
const typeOrder = ['Transit', 'Business', 'Industry', 'Tourism', 'Nature', 'Special'];

const areas = [
  { name: 'Japan',     color: '#74C7A2', x: 285,   y: 60, border: 'border-teal-400' },
  { name: 'California',color: '#FFE187', x: 615,   y: 60, border: 'border-amber-400' },
  { name: 'CoralSea',  color: '#e2e8f0', x: 120,   y: 202.5, border: 'border-slate-200' },
  { name: 'Polynesia', color: '#298fb4', x: 450,   y: 202.5, border: 'border-sky-400' },
  { name: 'Peru',      color: '#EF6A3E', x: 780,   y: 202.5, border: 'border-orange-400' },
];

const arrows = [
  { rotation: 0,   x: 450,   y: 30 },  // Japan → California
  { rotation: 45,  x: 765,   y: 45 },  // California → Peru
  { rotation: 180,  x: 615,   y: 217.5 },  // Peru → Polynesia
  { rotation: 180,  x: 285,   y: 217.5 },  // Polynesia → CoralSea
  { rotation: -45, x: 135,   y: 45 },  // CoralSea → Japan
];

const getAreaType = (areaName) => {
  const mapping = {
    'Japan': 'Transit',
    'California': 'Business',
    'Peru': 'Industry',
    'Polynesia': 'Tourism',
    'CoralSea': 'Nature'
  };
  return mapping[areaName] || '';
};

// 2. Helpers

const getArrowPosition = (arrow) => ({
  left: `${arrow.x}px`,
  top: `${arrow.y}px`
});

const getAreaPosition = (area) => ({
  left: `${area.x}px`,
  top: `${area.y}px`
});

const isAreaActive = (areaName) => {
  const interaction = myPlayer.value?.interaction;
  if (!interaction) return false;

  const type = interaction.type;
  if (interaction.validAreas) return interaction.validAreas.includes(areaName);
  if (type === 'select-area' || type === 'setup-hotel') return true;
  if (type === 'select-destination') return areaName !== (interaction.fromArea || interaction.srcArea);
  if (type === 'select-source-area') return areaName !== interaction.destArea;
  if (type === 'select-other-area') return areaName !== interaction.firstArea;
  if (type === 'setup-factory') return areaName !== interaction.excludeArea;

  return false;
};

const isTokenClickable = (areaName, type) => {
  const interaction = myPlayer.value?.interaction;
  if (!interaction) return false;

  if (interaction.type === 'select-chit') {
    // Spatial/Logic Restrictions
    if (interaction.fromArea && areaName !== interaction.fromArea) return false;
    if (interaction.srcArea && areaName !== interaction.srcArea) return false;
    if (interaction.excludeArea && areaName === interaction.excludeArea) return false;
    
    // Quantity/Type Restrictions
    if (interaction.selectedChits?.some(c => c.areaName === areaName)) return false;
    if (interaction.movedTypes?.includes(type)) return false;

    // If a specific filter is set (like 'fish'), only that is clickable. Otherwise, any chit works.
    if (!interaction.filter) return true;
    if (Array.isArray(interaction.filter)) return interaction.filter.includes(type);
    if (areas.some(a => a.name === interaction.filter)) return areaName === interaction.filter;
    return interaction.filter === type;
  }

  if (interaction.type === 'run-factory') {
    if (areaName !== interaction.area) return false;
    if (type === 'factory') {
      const playerMat = myPlayer.value?.mat;
      if (!playerMat || !playerMat[areaName]) return false;
      return (playerMat[areaName].factory || 0) > 1;
    }
    return true;
  }
  return false;
};
const getActiveTokens = (areaName) => {
  const player = viewedPlayerData.value;
  const areaMat = player?.mat?.[areaName];
  if (!areaMat || typeof areaMat !== 'object') return [];
  // Filter for positive counts and ensure we are looking at valid token types
  return Object.entries(areaMat).filter(([type, count]) => typeof count === 'number' && count > 0);
};

const getPlayersForCard = (instanceId) => {
  if (!instanceId) return [];
  return players.value.filter(p => p.selectedPlayedCardId === instanceId);
};

const isTableSelectionConfirmable = computed(() => {
  const hasMTR = myPlayer.value?.nextTurnCards?.some(c => c.name === 'Make the Rounds');
  if (hasMTR) {
    return !!selectedPlayedCardId.value && !!secondPlayedCardId.value;
  }
  return !!selectedPlayedCardId.value;
});

const isTableCardDimmed = (instanceId) => {
  if (confirmedPlayedCard.value) return false;
  const hasMTR = myPlayer.value?.nextTurnCards?.some(c => c.name === 'Make the Rounds');
  if (hasMTR) {
    // Only dim if selection is complete and this isn't one of them
    const isComplete = !!selectedPlayedCardId.value && !!secondPlayedCardId.value;
    return isComplete && selectedPlayedCardId.value !== instanceId && secondPlayedCardId.value !== instanceId;
  }
  return !!selectedPlayedCardId.value && selectedPlayedCardId.value !== instanceId;
};

const playedCards = computed(() => lobbyData.value?.playedCards || []); // New computed property

// --- Floating Numbers Logic ---
const floatingNumbers = ref([]);
let lastKnownMat = null; // Used to track changes between snapshots

watch(() => myPlayer.value?.mat, (newMat) => {
  if (!newMat) return;
  
  // Initialize on first load without animating
  if (lastKnownMat === null) {
    lastKnownMat = JSON.parse(JSON.stringify(newMat));
    return;
  }

  Object.entries(newMat).forEach(([areaName, tokens]) => {
    if (areaName === 'cards') return;
    Object.entries(tokens).forEach(([tokenType, count]) => {
      const oldCount = lastKnownMat[areaName]?.[tokenType] || 0;
      if (count > oldCount) {
        const id = Math.random().toString(36).substring(7);
        floatingNumbers.value.push({ id, areaName, tokenType, delta: `+${count - oldCount}` });
        
        // Remove from DOM after animation completes
        setTimeout(() => {
          floatingNumbers.value = floatingNumbers.value.filter(n => n.id !== id);
        }, 1500);
      }
    });
  });

  lastKnownMat = JSON.parse(JSON.stringify(newMat));
}, { deep: true });

// 4. Combined Lifecycle Hook
import { onErrorCaptured } from 'vue';

onErrorCaptured((err, instance, info) => {
  console.error('[GameView] FATAL RENDER ERROR:', err);
  console.error('[GameView] Error Info:', info);
  return false; // Prevent the entire app from crashing
});

onMounted(async () => {
  if (props.id) {
    const existingUuid = localStorage.getItem('UUID');
    const existingName = localStorage.getItem('nickname');
    const existingColor = localStorage.getItem('playerColor');
    
    const result = await joinLobby(props.id, existingName, existingColor, existingUuid);
    
    // Only write UUID to localStorage if we didn't already have one.
    // joinLobby may assign a new ID if uuid param is null/undefined; preserve existing IDs.
    if (!existingUuid) {
      localStorage.setItem('UUID', result.playerId);
    }
  }
});

// 5. Game Actions
const handleStartGame = async () => {
  console.log('[GameView] handleStartGame: Starting initialization...');
  // 1. Prepare the Deck
  const deck = [...cardsData].map((card, i) => ({
    ...card,
    instanceId: `${card.name}-${i}-${Math.random().toString(36).substring(2, 7)}`
  }));

  // 2. Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // DEV ONLY: Force specific cards into players' hands
  if (isDev) {
    players.value.forEach((p, pIdx) => {
      const forcedName = forcedStartingCards.value[p.id];
      if (forcedName) {
        const targetSlotIdx = pIdx * 10; // Swapping to the first card of their dealt hand
        const foundIdx = deck.findIndex(c => c.name === forcedName);
        if (foundIdx !== -1) {
          [deck[targetSlotIdx], deck[foundIdx]] = [deck[foundIdx], deck[targetSlotIdx]];
        }
      }
    });
  }

  // 3. Create the initial Mat structure
  // We want: { Japan: { fish: 0, boat: 0... }, California: { ... } }
  const initialMat = {
  };
  areas.forEach(area => {
    initialMat[area.name] = {
      fish: 0,
      hotel: 0,
      boat: 0,
      factory: 0,
      balloon: 0
    };
  });

  const playerUpdates = [];
  let cardIndex = 0;

  // Color pool for random assignment (resolving White selections)
  const colorsAlreadyUsed = players.value
    .map(p => p.color)
  let colorPool = availableColors.filter(c => !colorsAlreadyUsed.includes(c) && c !== '#f1f5f1');
  colorPool.sort(() => Math.random() - 0.5);

  // 4. Update each player with their Hand and empty Mat
  for (const player of players.value) {
    const hand = deck.slice(cardIndex, cardIndex + 10).sort((a, b) => {
      const typeA = a.types?.[0] || 'Special';
      const typeB = b.types?.[0] || 'Special';
      const idxA = typeOrder.indexOf(typeA);
      const idxB = typeOrder.indexOf(typeB);
      if (idxA !== idxB) return idxA - idxB;
      return a.name.localeCompare(b.name);
    });
    cardIndex += 10;


    console.log(colorPool)
    // Assign final color
    let finalColor = player.color;
    console.log(finalColor)
    if (!finalColor || finalColor === '#f1f5f1') {
      finalColor = colorPool.pop(); // Assign a color from the pool
    }
    console.log(finalColor)

    const playerRef = doc(db, `lobbies/${props.id}/players`, player.id);
    const playerUpdate = {
      hand,
      mat: initialMat,
      money: 0,
      selectedCardId: null,
      confirmedPlay: false,
      color: finalColor,
      bonusCounter: {}
    };

    if (players.value.length <= 2) {
      playerUpdate.interaction = {
        type: 'setup-hotel',
        instruction: 'Setup: Place your starting Hotel'
      };
    }
    
    playerUpdates.push(updateDoc(playerRef, playerUpdate));
  }

  const lobbyRef = doc(db, 'lobbies', props.id);
  const isSetup = players.value.length <= 2;
  
  await Promise.all([
    ...playerUpdates,
    updateDoc(lobbyRef, { 
      status: 'in-progress',
      phase: isSetup ? 'setup' : 'hand-selection',
      deck: deck.slice(cardIndex),
      playedCards: [],
      logs: [isSetup ? "<b>Starting Setup Phase</b>" : "<b>Starting Turn 1</b>"]
    })
  ]);
  console.log('[GameView] handleStartGame: Done.');
};
</script>

<style>
.mb-4 { margin-bottom: 1rem; }
.mb-5 { margin-bottom: 1.25rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-10 { margin-bottom: 2.5rem; }
.mt-10 { margin-top: 2.5rem; }
.p-2 { padding: 0.5rem; }
.p-4 { padding: 1rem; }


/* Helper for specific token colors when currentColor is used */
.text-\[\#FFE187\] {
  color: #FFE187 !important;
}

/* Unified Card Hover & Selection Logic */
.hand-card-item {
  transform: translateY(0) scale(1);
  /* Fixes sub-pixel rendering artifacts and square "shadow leak" during scaling */
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.hand-card-item.is-lifted:hover,
.hand-card-item.is-forced {
  transform: translateY(-72px) scale(1.25) !important;
  z-index: 100 !important;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}

/* Prevents "hover jitter" by filling the gap created when the card moves up.
   This invisible bridge ensures the mouse stays "over" the card even after it translates. */
.hand-card-item.is-lifted:hover::after,
.hand-card-item.is-forced::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 100px; /* Covers the 72px translation plus some buffer */
  background: transparent !important;
}
.selected-table-card.is-selected {
  transform: translateY(72px) scale(1.25) !important;
  z-index: 100 !important;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 3px #38bdf8 !important;
}

/* Persistent identity for selected table cards (normal size) */
.selected-table-card {
  z-index: 50;
  box-shadow: 0 0 0 3px #38bdf8 !important;
}

.hand-card-item.is-selected {
  box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 3px #38bdf8 !important;
}

/* Table slots also need the unified shadow logic */
.played-card-slot:hover {
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}

.hand-list-move {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.hand-list-enter-active,
.hand-list-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.hand-list-enter-from,
.hand-list-leave-to {
  opacity: 0;
  transform: translateY(40px);
}

/* Essential for the "move together" animation: 
   Removing the item from the flow allows others to calculate their new positions immediately. */
.hand-list-leave-active {
  position: absolute;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}


</style>
<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Lora:ital,wght@0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');

/* ── Global Input Style ── */
input {
  font-family: 'Lora', Georgia, serif;
}

/* Aesthetic Root Overrides */
.pacific-root {
  width: 100vw;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.lobby-root {
  min-height: 100vh;
  overflow-y: auto;
  align-items: center;
}

.game-root {
  overflow: hidden;
  align-items: stretch;
}

.lobby-room {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.tagline-container {
  background: rgba(207, 181, 144, 1);
  padding: 1.25rem 2.5rem;
  border-radius: 0.35rem;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  width: fit-content;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 1;
}

.text-center {
  text-align: center;
}

/* Glass panel wrapper enclosing lobby details */
.glass-panel {
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.lobby-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lobby-code {
  font-family: 'Space Mono', monospace;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #EF6A3E;
  margin: 0;
}

.field-label {
  display: block;
  font-family: 'Space Mono', monospace;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(240, 235, 224, 0.6);
  margin-bottom: 0.15rem;
}

/* ── Player List & Hidden Input UI ── */
.player-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.player-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.player-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* The color box element button */
.color-dot {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
  transition: transform 0.15s, border-color 0.2s;
}

.dot-mine {
  border-color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
}

.dot-mine:hover {
  transform: scale(1.1);
}

.player-name {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.9rem;
}

/* Stealth style for nickname input field */
.player-name-input {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.5) !important;
  font-family: 'Lora', Georgia, serif;
  font-size: 0.9rem;
  outline: none;
  padding: 0 0 2px 0;
  width: 200px;
  transition: border-bottom-color 0.2s;
}

.player-name-input:focus {
  border-bottom: 1px solid #EF6A3E !important;
}

.host-badge {
  font-family: 'Space Mono', monospace;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #298fb4;
  border: 1px solid rgba(41, 143, 180, 0.4);
  background: rgba(41, 143, 180, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 0.3rem;
}

/* ── Active Start Game Button ── */
.pacific-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  border-radius: 0.4rem;
  transition: transform 0.15s, filter 0.15s;
}

.pacific-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.btn-start {
  background: #EF6A3E !important;
  color: #ffffff !important;
  font-size: 0.75rem;
  padding: 0.65rem 1.4rem;
  box-shadow: 0 4px 16px rgba(239, 106, 62, 0.4);
  letter-spacing: 0.05em;
}

.btn-start:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

/* Reused background layers from Lobby */

.bg-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
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

/* ── Typographical Titles ── */
.game-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 5rem;
  line-height: 1;
  letter-spacing: 0.05em;
  color: #EF6A3E;
  margin: 0;
  text-shadow:
    4px 4px 0 #1a3d4f,
    -2px -2px 0 #1a3d4f,
    2px -2px 0 #1a3d4f,
    -2px 2px 0 #1a3d4f,
    0 6px 20px rgba(0,0,0,0.5);
}

.title-small {
  font-size: 6rem;
}

@keyframes title-in {
  from { opacity: 0; transform: translateY(-20px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

.title-block {
  animation: fade-up 0.6s ease both;
  position: relative;
  z-index: 1;
}

.designer-credit {
  font-family: 'Lora', Georgia, serif;
  font-size: 0.85rem;
  color: rgba(240, 235, 224, 0.7);
  margin: 0.35rem 0 0 0;
  letter-spacing: 0.01em;
}

.designer-credit em {
  font-style: italic;
  color: rgba(240, 235, 224, 0.9);
}

.title-divider {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #EF6A3E, transparent);
  margin: 0.8rem auto;
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

/* ── Paper Box ── */
.paper-box {
  background-color: #d2b48c;
  border-radius: 0.25rem;
  padding: 1.5rem 2.5rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.2);
  width: 100%;
}

.paper-box::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

.paper-box > * {
  position: relative;
  z-index: 1;
}

/* Scoped overrides for readability inside the paper boxes */
.paper-box .tagline,
.paper-box .field-label,
.paper-box .credit-link,
.paper-box .credits-note {
  color: #1a2a3a;
  font-weight: 700;
}

.paper-box .tagline {
  margin: 0;
}

.paper-box .credit-link:hover {
  color: #EF6A3E;
}

.paper-box .credits-sep {
  color: rgba(26, 42, 58, 0.3);
}

.paper-box .pacific-input {
  background: rgba(255, 255, 255, 0.35);
  border-color: rgba(0, 0, 0, 0.1);
  color: #1a2a3a;
  font-weight: 700;
}

.paper-box .pacific-input::placeholder {
  color: rgba(26, 42, 58, 0.4);
}

.paper-box .player-row {
  background: rgba(0, 0, 0, 0.55);
  border-color: rgba(0, 0, 0, 0.1);
}

.paper-box .player-name-input {
  border-bottom-color: rgba(0, 0, 0, 0.25);
}

.paper-box .host-badge {
  color: rgb(50, 173, 250);
  border-color: rgba(50, 173, 250, 0.4);
  background: rgba(50, 173, 250, 0.1);
}

.pacific-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.2rem 2.2rem;
  border-radius: 1rem;
  font-family: 'Space Mono', monospace;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
}

.pacific-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.pacific-btn:active {
  transform: translateY(0) scale(0.97);
}

.btn-create {
  background: linear-gradient(135deg, #EF6A3E, #d4532a);
  color: #fff;
  box-shadow: 0 4px 16px rgba(239,106,62,0.35);
}

.btn-join {
  background: linear-gradient(135deg, #f1f5f1, #d1d5d1);
  color: black;
  box-shadow: 0 4px 16px rgba(41,143,180,0.35);
}

.btn-start {
  background: #EF6A3E;
  color: #fff;
  box-shadow: 0 4px 16px rgba(239,106,62,0.35);
  font-size: 1rem;
  padding: 0.8rem 1.8rem;
  width: auto;
}

.btn-icon {
  font-size: 1rem;
}

@keyframes caustic-drift {
  from { opacity: 0.7; transform: scale(1); }
  to   { opacity: 1; transform: scale(1.04); }
}
</style>