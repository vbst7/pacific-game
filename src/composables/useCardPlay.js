import { ref, watch, computed } from 'vue'; 
import { db } from '@/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { addChit, removeChit, gainMoney, moveChit } from '../utils/gameActions';
import { countTotalChipsOfType, countChips, executeCard } from '../logic/cardExecution';
import { 
  initiateRunAreas, 
  finalizeTurnLog, 
  resolvePlayerInteraction,
  processTurnEnd
} from '../logic/turnOrchestration';

const typeColors = {
  'Transit':  '#2dd4bf',
  'Business': '#fbbf24',
  'Industry': '#fb923c',
  'Tourism':  '#38bdf8',
  'Nature':   '#e2e8f0',
  'Special':  '#fda420'
};

export function useCardPlay(lobbyIdRef, myPlayerRef, playersRef, lobbyDataRef, myUuidRef, isHostRef) {
  const selectedCardId = ref(null);
  const confirmedPlay = ref(false); // Tracks if *this* player has confirmed their card
  const selectedPlayedCardId = ref(null);
  const secondPlayedCardId = ref(null);
  const confirmedPlayedCard = ref(false);

  // Sync local confirmedPlay and selectedCardId with Firestore state
  watch(myPlayerRef, (newPlayer) => {
    if (newPlayer) {
      confirmedPlay.value = newPlayer.confirmedPlay || false;
      selectedCardId.value = newPlayer.selectedCardId || null;
      confirmedPlayedCard.value = newPlayer.confirmedPlayedCard || false;
      selectedPlayedCardId.value = newPlayer.selectedPlayedCardId || null;
      secondPlayedCardId.value = newPlayer.secondPlayedCardId || null;
    }
  }, { immediate: true });

  const handleSelectCard = async (card) => {
    // Only allow selection during hand-selection phase
    if (confirmedPlay.value || (lobbyDataRef.value?.phase !== 'hand-selection' && lobbyDataRef.value?.phase !== 'hand-selection-dsn')) return;

    const newSelectedCardId = selectedCardId.value === card.instanceId ? null : card.instanceId;

    // Optimistically update local state
    selectedCardId.value = newSelectedCardId;

    // Update player's selected card in Firestore
    const playerRef = doc(db, `lobbies/${lobbyIdRef.value}/players`, myUuidRef.value);
    await updateDoc(playerRef, {
      selectedCardId: newSelectedCardId
    });
  };

  const handleConfirmPlay = async () => {
    if (!selectedCardId.value || confirmedPlay.value) return;

    // Optimistically update local state
    confirmedPlay.value = true;

    // Update player's confirmed status in Firestore
    const playerRef = doc(db, `lobbies/${lobbyIdRef.value}/players`, myUuidRef.value);
    await updateDoc(playerRef, {
      confirmedPlay: true
    });
  };

  const handleSelectPlayedCard = async (card) => {
    // Only allow selection during table-selection phase
    if (confirmedPlayedCard.value || lobbyDataRef.value?.phase !== 'table-selection') return;
    
    const hasMTR = myPlayerRef.value?.nextTurnCards?.some(c => c.name === 'Make the Rounds');
    let update = {};

    if (hasMTR) {
      // Toggle logic for two slots
      if (selectedPlayedCardId.value === card.instanceId) {
        update = { selectedPlayedCardId: null };
      } else if (secondPlayedCardId.value === card.instanceId) {
        update = { secondPlayedCardId: null };
      } else if (!selectedPlayedCardId.value) {
        update = { selectedPlayedCardId: card.instanceId };
      } else if (!secondPlayedCardId.value) {
        update = { secondPlayedCardId: card.instanceId };
      } else {
        // Both full, replace the first one
        update = { selectedPlayedCardId: card.instanceId };
      }
    } else {
      const newSelectedId = selectedPlayedCardId.value === card.instanceId ? null : card.instanceId;
      update = { selectedPlayedCardId: newSelectedId };
    }

    const playerRef = doc(db, `lobbies/${lobbyIdRef.value}/players`, myUuidRef.value);
    await updateDoc(playerRef, update);
  };

  const handleConfirmPlayedCard = async () => {
    const hasMTR = myPlayerRef.value?.nextTurnCards?.some(c => c.name === 'Make the Rounds');
    const isComplete = hasMTR 
      ? (selectedPlayedCardId.value && secondPlayedCardId.value)
      : !!selectedPlayedCardId.value;

    if (!isComplete || confirmedPlayedCard.value) return;

    confirmedPlayedCard.value = true;

    const playerRef = doc(db, `lobbies/${lobbyIdRef.value}/players`, myUuidRef.value);
    await updateDoc(playerRef, {
      confirmedPlayedCard: true
    });
  };

  // Host-only logic to process the turn
  const allPlayersConfirmed = computed(() => {
    // Ensure playersRef.value is an array before calling .every()
    if (!playersRef.value || playersRef.value.length === 0) return false;
    const phase = lobbyDataRef.value?.phase;

    if (phase === 'hand-selection') {
      // Only check players WITHOUT DSN
      const targets = playersRef.value.filter(p => !p.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network'));
      return targets.every(p => p.confirmedPlay);
    }
    if (phase === 'hand-selection-dsn') {
      // Only check players WITH DSN
      const targets = playersRef.value.filter(p => p.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network'));
      return targets.every(p => p.confirmedPlay);
    }
    return false;
  });

  watch(allPlayersConfirmed, async (isAllConfirmed) => {
    if (isAllConfirmed && isHostRef.value) {
      const phase = lobbyDataRef.value.phase;
      if (phase === 'hand-selection') {
        const hasDSN = playersRef.value.some(p => p.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network'));
        if (hasDSN) {
          const targets = playersRef.value.filter(p => !p.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network'));
          await processTurn(targets, 'hand-selection-dsn');
        } else {
          await processTurn();
        }
      } else if (phase === 'hand-selection-dsn') {
        const targets = playersRef.value.filter(p => p.nextTurnCards?.some(c => c.name === 'Dolphin Spy Network'));
        await processTurn(targets, 'table-selection');
      }
    }
  });


  // Host-only logic for table selection confirmation
  const allTableConfirmed = computed(() => {
    if (!playersRef.value || playersRef.value.length === 0) return false;
    if (lobbyDataRef.value?.phase !== 'table-selection') return false;
    return playersRef.value.every(p => p.confirmedPlayedCard);
  });

  watch(allTableConfirmed, async (isAllConfirmed) => {
    if (isAllConfirmed && isHostRef.value) {
      console.log("Host detected all players confirmed table choice. Starting execution...");
      await startExecution();
    }
  });

  // Simplified: Logic now only returns the string. 
  // Token rendering is handled by parseTokenLog in GameView.vue for robustness.
  const formatChitIconsInLog = (logString) => {
    return logString;
  };

  const allSetupFinished = computed(() => {
    if (!lobbyDataRef.value || lobbyDataRef.value.phase !== 'setup') return false;
    if (!playersRef.value || playersRef.value.length === 0) return false;
    return playersRef.value.every(p => !p.interaction);
  });

  watch(allSetupFinished, async (isFinished) => {
    if (isFinished && isHostRef.value) {
      console.log("Setup finished. Starting Turn 1.");
      const lobbyRef = doc(db, 'lobbies', lobbyIdRef.value);
      await updateDoc(lobbyRef, { 
        phase: 'hand-selection',
        logs: arrayUnion("<b>Starting Turn 1</b>")
      });
    }
  });

  const processTurn = async (targetPlayers = null, nextPhase = 'table-selection') => {
    const lobbyRef = doc(db, 'lobbies', lobbyIdRef.value);
    const newPlayedCards = [];
    const playerUpdates = [];
    const newLogs = [];
    let currentDeck = lobbyDataRef.value.deck || [];

    const playersToProcess = targetPlayers || playersRef.value;

    // 1. Collect selected cards from all players and prepare to remove from hands
    for (const player of playersToProcess) {
      if (player.selectedCardId) {
        const cardToPlay = player.hand.find(c => c.instanceId === player.selectedCardId);
        if (cardToPlay) {
          newPlayedCards.push(cardToPlay);
          
          // Generate log: "[player] offered [played card]" with colors and link data
          const cardColor = typeColors[cardToPlay.types?.[0]] || '#1e293b';
          const logMsg = `<span style="color: ${player.color}">${player.name}</span> offered <span class="card-link" data-instance-id="${cardToPlay.instanceId}" data-card-name="${cardToPlay.name}" style="color: ${cardColor}; cursor: help;">${cardToPlay.name}</span>`;
          newLogs.push(logMsg);

          // Prepare update to remove card from hand and reset player state
          const hasCasinos = player.nextTurnCards?.some(c => c.name === 'Casinos');
          const update = {
            hand: arrayRemove(cardToPlay),
            selectedCardId: null,
            confirmedPlay: false
          };

          // Casinos: Automatically select the card you just played
          if (hasCasinos) {
            update.selectedPlayedCardId = cardToPlay.instanceId;
            update.confirmedPlayedCard = true;
          }

          playerUpdates.push(updateDoc(doc(db, `lobbies/${lobbyIdRef.value}/players`, player.id), update));
        }
      }
    }

    // 2. If fewer than 3 players, add 2 cards from the deck
    // Only do this if it's the first set of cards being revealed
    const currentPlayedCount = lobbyDataRef.value.playedCards?.length || 0;
    if (currentPlayedCount === 0 && playersRef.value.length < 3) {
      const cardsFromDeck = currentDeck.slice(0, 2);
      newPlayedCards.push(...cardsFromDeck);
      currentDeck = currentDeck.slice(2); // Update deck for lobby update
    }

    // 3. Update lobby with new deck and played cards
    const lobbyUpdate = {
      deck: currentDeck,
      phase: nextPhase
    };
    if (newPlayedCards.length > 0) lobbyUpdate.playedCards = arrayUnion(...newPlayedCards);
    if (newLogs.length > 0) lobbyUpdate.logs = arrayUnion(...newLogs);
    
    await updateDoc(lobbyRef, lobbyUpdate);

    // 4. Execute all player updates
    await Promise.all(playerUpdates);

    console.log("Turn processed successfully.");
  };      

  const allExecutionFinished = computed(() => {
    if (!lobbyDataRef.value || lobbyDataRef.value.phase !== 'execution') return false;
    if (!playersRef.value || playersRef.value.length === 0) return false;
    return playersRef.value.every(p => !p.interaction);
  });

  watch(allExecutionFinished, async (isFinished) => {
    if (isFinished && isHostRef.value) {
      // The watcher remains as a fallback, but the primary turn rotation
      // now happens inside startExecution and resolvePlayerInteraction 
      // to avoid stale data issues.
      await processTurnEnd(lobbyIdRef.value, lobbyDataRef.value.turn, playersRef.value);
    }
  });

  const startExecution = async () => {
    const lobbyRef = doc(db, 'lobbies', lobbyIdRef.value);

    // Calculate uniqueness of card names chosen across all players
    const nameCounts = {};
    playersRef.value.forEach(p => {
      [p.selectedPlayedCardId, p.secondPlayedCardId].forEach(id => {
        if (!id) return;
        const card = lobbyDataRef.value.playedCards.find(c => c.instanceId === id);
        if (card) {
          nameCounts[card.name] = (nameCounts[card.name] || 0) + 1;
        }
      });
    });

    // For each player, run the logic of their selected played card
    const playerLogicPromises = playersRef.value.map(async (player) => {
      // Note: mutating reactive player objects ensures changes are available to processTurnEnd immediately
      const card1 = lobbyDataRef.value.playedCards.find(c => c.instanceId === player.selectedPlayedCardId);
      const card2 = lobbyDataRef.value.playedCards.find(c => c.instanceId === player.secondPlayedCardId);
      
      if (card1 && card2) {
        const mtrCard = player.nextTurnCards?.find(c => c.name === 'Make the Rounds');
        // Make the Rounds: Prompt for order
        if (mtrCard) {
          player.nextTurnCards = player.nextTurnCards.filter(c => 
            mtrCard.instanceId ? c.instanceId !== mtrCard.instanceId : c.name !== 'Make the Rounds'
          );
        }

        player.interaction = {
          type: 'mtr-choose-first',
          card1,
          card2,
          isUnique1: nameCounts[card1.name] === 1,
          isUnique2: nameCounts[card2.name] === 1,
          mtrCard: mtrCard || null,
          instruction: `Make the Rounds: Choose which card to resolve first.`
        };
      } else if (card1) {
        const cardColor = typeColors[card1.types?.[0]] || '#1e293b';
        const execMsg = `<span style="color: ${player.color}">${player.name}</span> is executing <span class="card-link" data-instance-id="${card1.instanceId}" data-card-name="${card1.name}" style="color: ${cardColor}; cursor: help;">${card1.name}</span>`;
        await updateDoc(lobbyRef, { logs: arrayUnion(execMsg) });

        player.turnLogs = executeCard(card1, { isUnique: nameCounts[card1.name] === 1 }, player);
        if (!player.interaction) initiateRunAreas(player, card1);
      } 

      // Persist state changes (mat, money, setAside, nextTurnCards, interactions)
      if (card1 || card2) {
        if (!player.interaction) await finalizeTurnLog(lobbyIdRef.value, player);
        
        const playerRef = doc(db, `lobbies/${lobbyIdRef.value}/players`, player.id);
        return updateDoc(playerRef, {
          mat: player.mat,
          money: player.money,
          interaction: player.interaction || null,
          turnLogs: player.turnLogs || [],
          setAside: player.setAside || [],
          bonusCounter: player.bonusCounter || {},
          needsDraw: player.needsDraw || 0,
          nextTurnCards: player.nextTurnCards || []
        });
      }
      return Promise.resolve();
    });

    await Promise.all(playerLogicPromises);

    // Check if anyone actually has interactions to resolve
    const hasInteractions = playersRef.value.some(p => p.interaction);
    if (!hasInteractions && playersRef.value.length > 0) {
      // Fast-path: Rotate turn immediately. Use playersRef.value which now contains local mutations.
      // Passing the full list ensures all players have their nextTurnCards rotated or cleared correctly.
      await processTurnEnd(lobbyIdRef.value, lobbyDataRef.value.turn, playersRef.value);
    } else {
      await updateDoc(lobbyRef, { phase: 'execution' });
    }
  };

  const resolveInteraction = async (choice) => {
    if (!myPlayerRef.value) return;
    await resolvePlayerInteraction(lobbyIdRef.value, myPlayerRef.value, choice);
  };

  return {
    selectedCardId,
    confirmedPlay,
    selectedPlayedCardId,
    secondPlayedCardId,
    confirmedPlayedCard,
    handleSelectCard,
    handleConfirmPlay,
    handleSelectPlayedCard,
    handleConfirmPlayedCard,
    resolveInteraction
  };
}
