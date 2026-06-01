import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { addChit, removeChit, gainMoney } from '../utils/gameActions';
import { countTotalChipsOfType, countChips, executeCard } from './cardExecution';

const typeToArea = {
  'Transit': 'Japan',
  'Business': 'California',
  'Industry': 'Peru',
  'Tourism': 'Polynesia',
  'Nature': 'CoralSea'
};

const areaOrder = ['Japan', 'California', 'Peru', 'Polynesia', 'CoralSea'];

const arrowConnections = [
  { types: ['Transit', 'Business'] }, // Arrow 0: Japan - California
  { types: ['Business', 'Industry'] }, // Arrow 1: California - Peru
  { types: ['Industry', 'Tourism'] },  // Arrow 2: Peru - Polynesia
  { types: ['Tourism', 'Nature'] },   // Arrow 3: Polynesia - Coral Sea
  { types: ['Nature', 'Transit'] }    // Arrow 4: Coral Sea - Japan
];

// Helper for moving chits (missing from previous context imports)
export function moveChit(player, fromArea, toArea, type, source) {
  if (player.mat[fromArea][type] > 0) {
    player.mat[fromArea][type]--;
    player.mat[toArea][type] = (player.mat[toArea][type] || 0) + 1;

    let logSuffix = '';
    if (type === 'balloon' && toArea === 'California') {
      logSuffix = ` and ${gainMoney(player, 15, source)}`;
    }

    if (player.nextTurnCards?.some(c => c.name === 'Documentary')) {
      if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
      player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + 1;
    }

    return `${source}: moved (${type}) from ${fromArea} to ${toArea}${logSuffix}`;
  }
  return `${source}: could not move (${type}) from ${fromArea}`;
}

/**
 * Performs a global fish movement step for all areas at once.
 */
const performGlobalFishMove = (player) => {
  const movements = [];
  const snapshot = areaOrder.map(area => ({ area, count: player.mat[area]?.fish || 0 }));

  snapshot.forEach(({ area, count }) => {
    if (count > 0) {
      const nextArea = nextAreaMap[area];
      player.mat[area].fish -= count;
      player.mat[nextArea].fish = (player.mat[nextArea].fish || 0) + count;
      movements.push(`${count} (fish) from ${area} to ${nextArea}`);

      if (player.nextTurnCards?.some(c => c.name === 'Documentary')) {
        if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
        player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + count;
      }
    }
  });

  if (movements.length > 0) {
    player.turnLogs.push(`Global Trade Winds Movement: moved ${movements.join(', ')}`);
  }
};

const finishAreaRunSequence = (player, cardName) => {
  if (cardName === 'Trade Winds') {
    performGlobalFishMove(player);
    player.skipFishMovement = null;
  }
  player.interaction = null;
};

const nextAreaMap = {
  'Japan': 'California',
  'California': 'Peru',
  'Peru': 'Polynesia',
  'Polynesia': 'CoralSea',
  'CoralSea': 'Japan'
};

/**
 * Helper to check if an area has any tokens that can be removed by a factory.
 * A factory cannot remove itself if it's the last one in the area.
 */
const hasRemovableTokens = (matArea) => {
  if (!matArea) return false;
  // Check for any token type that can be removed
  if (matArea.fish > 0) return true;
  if (matArea.boat > 0) return true;
  if (matArea.hotel > 0) return true;
  if (matArea.balloon > 0) return true;
  if (matArea.hatchery > 0) return true;
  if (matArea.port > 0) return true;
  if (matArea.factory > 1) return true; // Can remove a factory if there's more than one
  return false;
};

const calculateRunnableElements = (player, area, cardName) => {
  const elements = [];
  const matArea = player.mat[area];
  if (matArea.hotel > 0) elements.push('Hotels');
  if (matArea.balloon > 0) elements.push('Balloons');
  if (matArea.boat > 0 && matArea.fish > 0) elements.push('Boats');
  // Trade Winds runs the area without moving fish; they move at the very end of the sequence instead.
  if (matArea.fish > 0 && player.skipFishMovement !== true && cardName !== 'Trade Winds') elements.push('Fish');
  if (matArea.factory > 0 && hasRemovableTokens(matArea)) elements.push('Factories');
  return elements;
};

const executeElement = (player, area, element, cardName) => {
  player.turnLogs.push(`running ${element}`);
  if (element === 'Hotels') {
    player.turnLogs.push(gainMoney(player, player.mat[area].hotel, cardName));
  } else if (element === 'Boats') {
    player.turnLogs.push(gainMoney(player, player.mat[area].boat * player.mat[area].fish, cardName));
  } else if (element === 'Fish') {
    player.turnLogs.push(handleFishMovement(player, area));
  } else if (element === 'Balloons') {
    player.turnLogs.push(handleBalloonMovement(player, area));
  }
};

const proceedWithAreaRun = (player, area, pendingElements, remainingAreas, cardName) => {
  let elements = pendingElements;

  // Auto-run loop: if only one non-factory element remains, run it automatically.
  while (elements.length === 1 && elements[0] !== 'Factories') {
    const element = elements[0];
    executeElement(player, area, element, cardName);
    
    // After running an element, check which of the *other* elements are still runnable
    const matArea = player.mat[area];
    elements = elements.filter(e => {
      if (e === element) return false;
      if (e === 'Hotels') return matArea.hotel > 0;
      if (e === 'Balloons') return matArea.balloon > 0;
      if (e === 'Fish') return matArea.fish > 0 && cardName !== 'Trade Winds';
      if (e === 'Boats') return matArea.boat > 0 && matArea.fish > 0;
      if (e === 'Factories') return matArea.factory > 0 && hasRemovableTokens(matArea);
      return true;
    });
  }

  if (elements.length === 0) {
    if (!player.runAreas) player.runAreas = [];
    if (!player.runAreas.includes(area)) player.runAreas.push(area);
    if (remainingAreas.length > 0) {
      startAreaRun(player, remainingAreas[0], remainingAreas.slice(1), cardName);
    } else {
      finishAreaRunSequence(player, cardName);
    }
    return;
  }

  player.interaction = {
    type: 'choose-element',
    area,
    pendingElements: elements,
    remainingAreas,
    cardName,
    isAreaRun: true,
    instruction: `Running ${area}: Choose which element to run next.`
  };
};

export const initiateRunAreas = (player, cards) => {
  if (!cards) return;
  const isMtrConsequence = Array.isArray(cards);
  const cardList = isMtrConsequence ? cards : [cards];
  let combinedAreas = [];

  cardList.forEach(card => {
    let areas = [];
    if (card.name === 'Overtime') {
      areas = [...areaOrder];
  } else if (card.name === 'Trade Winds') {
      areas = areaOrder.filter(area => (player.mat[area]?.fish || 0) >= 2);
  } else if (card.name === 'Make the Rounds' && !isMtrConsequence) {
      areas = [...areaOrder];
  } else {
    const cardTypes = new Set(card.types);
    if (player.mat.directFlight !== undefined && player.mat.directFlight !== null) {
      const connection = arrowConnections[player.mat.directFlight];
      const [typeA, typeB] = connection.types;
      if (cardTypes.has(typeA)) cardTypes.add(typeB);
      else if (cardTypes.has(typeB)) cardTypes.add(typeA);
    }

      areas = Array.from(cardTypes)
      .map(t => typeToArea[t])
      .filter(Boolean)
      .sort((a, b) => areaOrder.indexOf(a) - areaOrder.indexOf(b));
  }
    combinedAreas.push(...areas);
  });

  // Deduplicate and filter out areas already run this turn (e.g. by Oversee)
  let areasToRun = [...new Set(combinedAreas)].filter(area => !(player.runAreas || []).includes(area));

  if (player.skipAreaRun) {
    areasToRun = areasToRun.filter(area => area !== player.skipAreaRun);
    player.skipAreaRun = null;
  }

  if (areasToRun.length > 0) {
    // Priority for runSource to ensure special run logic (TW global move, Overtime factory skip)
    const specialSource = cardList.find(c => ['Trade Winds', 'Overtime', 'Make the Rounds'].includes(c.name))?.name;
    startAreaRun(player, areasToRun[0], areasToRun.slice(1), specialSource || cardList[0].name);
  }
};

export const startAreaRun = (player, area, remainingAreas, cardName) => {
  // Dynamic skip conditions (re-checked before each area is started)
  const isOvertimeSkip = cardName === 'Overtime' && (player.mat[area]?.factory || 0) === 0;
  
  const mtrCount = cardName === 'Make the Rounds' ? countChips(player.mat[area]) : null;
  const isMtrSkip = cardName === 'Make the Rounds' && (mtrCount < 1 || mtrCount > 3);

  if (isOvertimeSkip || isMtrSkip) {
    if (remainingAreas.length > 0) {
      return startAreaRun(player, remainingAreas[0], remainingAreas.slice(1), cardName);
    } else {
      finishAreaRunSequence(player, cardName);
      return;
    }
  }

  // Handle Hatchery (Automatic, runs first)
  if (player.mat[area].hatchery > 0) {
    const fishToAdd = Array(player.mat[area].hatchery * 2).fill('fish');
    player.turnLogs.push(addChit(player, area, fishToAdd, 'Hatchery'));
  }

  if (player.mat[area].port > 0) {
    player.interaction = {
      type: 'select-chit',
      cardName: 'Port',
      area,
      excludeArea: area,
      pendingElements: [], // Elements recalculated after Port
      remainingAreas,
      runSource: cardName,
      isAreaRun: true,
      canPass: true,
      filter: ['fish', 'hotel', 'factory', 'boat'],
      instruction: `Port in ${area}: Select a (chit) from any area to move here, or Pass.`
    };
    return;
  }

  const elements = calculateRunnableElements(player, area, cardName);

  proceedWithAreaRun(player, area, elements, remainingAreas, cardName);
};

export const handleBalloonMovement = (player, area, cardName) => {
  const count = player.mat[area].balloon;
  const nextArea = nextAreaMap[area];
  player.mat[area].balloon = 0;
  player.mat[nextArea].balloon = (player.mat[nextArea].balloon || 0) + count;

  if (player.nextTurnCards?.some(c => c.name === 'Documentary')) {
    if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
    player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + count;
  }

  let log = `moved ${count} (balloon) from ${area} to ${nextArea}`;
  if (nextArea === 'California') log += ` and ${gainMoney(player, 15 * count, cardName)}`;
  return log;
};

export const handleFishMovement = (player, area) => {
  const count = player.mat[area].fish;
  const nextArea = nextAreaMap[area];
  player.mat[area].fish = 0;
  player.mat[nextArea].fish = (player.mat[nextArea].fish || 0) + count;

  if (player.nextTurnCards?.some(c => c.name === 'Documentary')) {
    if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
    player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + count;
  }

  return `moved ${count} (fish) from ${area} to ${nextArea}`;
};

export const finalizeTurnLog = async (lobbyId, player) => {
  if (player.bonusCounter && typeof player.bonusCounter === 'object') {
    Object.entries(player.bonusCounter).forEach(([cardName, count]) => {
      if (count > 0) {
        player.turnLogs.push(`${cardName}: ${gainMoney(player, count * 2, cardName)}`);
      }
    });
    player.bonusCounter = {};
  }

  if (!player.turnLogs || player.turnLogs.length === 0) return;

  const playerHeader = `<span style="color: ${player.color}">${player.name}'s actions:</span>`;
  const finalLogBlock = [playerHeader, ...player.turnLogs].join('<br>');

  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, { logs: arrayUnion(finalLogBlock) });
  player.turnLogs = [];
};

export const processTurnEnd = async (lobbyId, currentTurn, players) => {
  const nextTurn = (currentTurn || 1) + 1;
  const isGameOver = nextTurn > 10;
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbySnap = await getDoc(lobbyRef);
  const lobbyData = lobbySnap.data();
  let currentDeck = [...(lobbyData.deck || [])];
  
  const playerUpdates = players.map(p => {
    const pRef = doc(db, `lobbies/${lobbyId}/players`, p.id);

    // Fulfill draws from Computer Chip Factory
    const drawn = [];
    let drawsNeeded = p.needsDraw || 0;
    while (drawsNeeded > 0 && currentDeck.length > 0) {
      drawn.push(currentDeck.shift());
      drawsNeeded--;
    }

    // Rotate cards: setAside (pending) becomes nextTurnCards (active for next turn)
    const rotatedCards = Array.isArray(p.setAside) ? [...p.setAside] : [];
    const newHand = [...(p.hand || []), ...drawn];
    const nextMat = Object.fromEntries(
      Object.entries(p.mat || {}).map(([key, data]) => {
        if (areaOrder.includes(key)) {
          const { hqUsed, ...rest } = data;
          return [key, rest];
        }
        return [key, data];
      })
    );

    // Mutate local object to prevent stale data re-injection in the next turn
    p.nextTurnCards = rotatedCards;
    p.setAside = [];
    p.hand = newHand;
    p.needsDraw = 0;
    p.bonusCounter = {};
    p.runAreas = [];
    p.mat = nextMat;
    p.skipAreaRun = null;
    p.skipFishMovement = null;

    return updateDoc(pRef, {
      confirmedPlay: false,
      confirmedPlayedCard: false,
      selectedCardId: null,
      selectedPlayedCardId: null,
      secondPlayedCardId: null,
      interaction: null,
      turnLogs: [],
      nextTurnCards: rotatedCards,
      setAside: [],
      hand: newHand,
      needsDraw: 0,
      bonusCounter: {},
      runAreas: [],
      mat: nextMat,
      skipAreaRun: null,
      skipFishMovement: null
    });
  });

  await Promise.all([
    ...playerUpdates,
    updateDoc(lobbyRef, {
      phase: isGameOver ? 'finished' : 'hand-selection',
      turn: isGameOver ? currentTurn : nextTurn,
      playedCards: [],
      deck: currentDeck,
      logs: arrayUnion(isGameOver 
        ? `<b>Game Over! Final Rankings:</b><br>${[...players].sort((a, b) => (b.money || 0) - (a.money || 0)).map((p, i) => `${i + 1}. <span style="color: ${p.color}">${p.name}</span>: $${p.money || 0}`).join('<br>')}`
        : `<b>Starting Turn ${nextTurn}</b>`)
    })
  ]);
};

const nextFactoryOrEnd = (player, interaction, forceEnd = false) => {
  if (!forceEnd) {
    interaction.factoryIndex++;
  }

  const matArea = player.mat[interaction.area];
  const numFactories = matArea.factory || 0;

  // Move to next factory if exists AND there are still tokens to remove
  if (!forceEnd && interaction.factoryIndex < numFactories && hasRemovableTokens(matArea)) {
    interaction.tokensRemaining = 3;
    interaction.removedTokens = []; // Reset batch for the next factory
    interaction.moneyGained = 0;    // Reset batch for the next factory
    interaction.instruction = `Factory ${interaction.factoryIndex + 1} in ${interaction.area}: Remove up to 3 tokens for $2 each.`;
  } else {
    // Factory run finished for this area. 
    // Update pending elements based on current area state (some tokens might be gone)
    interaction.pendingElements = interaction.pendingElements.filter(e => {
      if (e === 'Hotels') return matArea.hotel > 0;
      if (e === 'Fish') return matArea.fish > 0;
      if (e === 'Boats') return matArea.boat > 0 && matArea.fish > 0;
      if (e === 'Balloons') return matArea.balloon > 0;
      return true;
    });
    proceedWithAreaRun(player, interaction.area, interaction.pendingElements, interaction.remainingAreas, interaction.cardName);
  }
};

export const resolvePlayerInteraction = async (lobbyId, player, choice) => {
  if (!player.turnLogs) player.turnLogs = [];
  const interaction = player.interaction;
  if (!interaction) return;

  // Generic Actions
  if (choice === 'pass' && interaction.type !== 'run-factory' && interaction.type !== 'choose-element') {
    if ((interaction.cardName === 'Relocate' || interaction.cardName === 'Jellyfish') && interaction.type === 'select-chit' && interaction.stagedChits?.length > 0) {
      player.interaction = {
        type: 'select-destination', cardName: interaction.cardName, stagedChits: interaction.stagedChits,
        card: interaction.card,
        srcArea: interaction.srcArea, snapshot: interaction.snapshot, instruction: `${interaction.cardName}: Select destination`
      };
    } else if (interaction.cardName === 'Port' && interaction.type === 'select-chit') {
      const elements = calculateRunnableElements(player, interaction.area, interaction.runSource || 'Port');
      proceedWithAreaRun(player, interaction.area, elements, interaction.remainingAreas, interaction.runSource || 'Port');
    } else if (interaction.canPass) {
      player.interaction = null;
    }
  } else if (choice === 'cancel') {
    if (interaction.snapshot) {
      player.mat = interaction.snapshot.mat;
      player.money = interaction.snapshot.money;
    }
    player.interaction = null;
  } 

  // Setup
  else if (interaction.type === 'setup-hotel') {
    if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
    player.turnLogs.push(addChit(player, choice, 'hotel', 'Setup'));
    player.interaction = { 
      type: 'setup-factory', excludeArea: choice, instruction: 'Setup: Place Factory',
      pendingCard: interaction.pendingCard || null, 
      mtrCards: interaction.mtrCards || null, 
      mtrCard: interaction.mtrCard || null
    };
  } else if (interaction.type === 'setup-factory') {
    if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
    if (choice !== interaction.excludeArea) {
      player.turnLogs.push(addChit(player, choice, 'factory', 'Setup'));
      player.interaction = null;
    }
  }

  // Setup
  else if (interaction.type === 'select-arrow') {
    if (typeof choice !== 'number') return;
    player.mat.directFlight = choice; // Choice is the index of the arrow
    player.turnLogs.push(`placed Direct Flight on arrow`);
    player.interaction = null;
  }
  else if (interaction.cardName === 'Headquarters' && interaction.type === 'select-area') {
    if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
    player.turnLogs.push(addChit(player, choice, 'hq', 'Headquarters'));
    player.interaction = null;
  }

  // Run Area Logic
  else if (interaction.type === 'choose-element') {
    const area = interaction.area;
    // Robustness: Only allow choices that are actually runnable in this area and ignore garbage input
    if (typeof choice !== 'string' || !interaction.pendingElements.includes(choice)) return;

    if (choice === 'Factories') {
      player.interaction = {
        type: 'run-factory', area, factoryIndex: 0, tokensRemaining: 3,
        removedTokens: [], // New: Accumulate removed token types for logging
        moneyGained: 0,
        pendingElements: interaction.pendingElements.filter(e => e !== 'Factories'),
        remainingAreas: interaction.remainingAreas, cardName: interaction.cardName, 
        isAreaRun: true,
        pendingCard: interaction.pendingCard || null, 
        mtrCards: interaction.mtrCards || null, 
        mtrCard: interaction.mtrCard || null,
        instruction: `Factory 1 in ${area}: Remove up to 3 tokens for $2 each.`
      };
      // If the area has no removable tokens for this first factory, auto-pass it
      if (!hasRemovableTokens(player.mat[area])) {
        nextFactoryOrEnd(player, player.interaction, true); // Force end this factory
      }
    } else {
      executeElement(player, area, choice, interaction.cardName);

      const matArea = player.mat[area];
      const next = interaction.pendingElements.filter(e => {
        if (e === choice) return false;
        if (e === 'Hotels') return matArea.hotel > 0;
        if (e === 'Balloons') return matArea.balloon > 0;
        if (e === 'Fish') return matArea.fish > 0 && interaction.cardName !== 'Trade Winds';
        if (e === 'Boats') return matArea.boat > 0 && matArea.fish > 0;
        if (e === 'Factories') return matArea.factory > 0 && hasRemovableTokens(matArea);
        return true;
      });
      proceedWithAreaRun(player, area, next, interaction.remainingAreas, interaction.cardName);
    }
  }
  else if (interaction.type === 'run-factory') {
    if (choice === 'pass') {
      // Log accumulated actions before moving to the next factory or ending
      if (interaction.removedTokens.length > 0) {
        gainMoney(player, interaction.moneyGained, interaction.cardName);
        player.turnLogs.push(`removed ${interaction.removedTokens.map(t => `(${t})`).join(' ')} from ${interaction.area} for $${interaction.moneyGained}`);
      }
      nextFactoryOrEnd(player, interaction, true);
    } else {
      const { areaName, tokenType } = choice;
      if (areaName === interaction.area && player.mat[areaName][tokenType] > 0) {
        if (tokenType === 'factory' && player.mat[areaName].factory <= 1) return;
        
        // Perform removal and accumulate for batch logging
        player.mat[areaName][tokenType]--;

        if (player.nextTurnCards?.some(c => c.name === 'Documentary')) {
          if (!player.bonusCounter || typeof player.bonusCounter !== 'object') {
            player.bonusCounter = {};
          }
          player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + 1;
        }

        interaction.removedTokens.push(tokenType);
        interaction.moneyGained += 2;
        interaction.tokensRemaining--;

        // If no more tokens can be removed by this factory, or max tokens removed
        if (interaction.tokensRemaining <= 0 || !hasRemovableTokens(player.mat[areaName])) {
          // Log accumulated actions before moving to the next factory or ending
          if (interaction.removedTokens.length > 0) {
            gainMoney(player, interaction.moneyGained, interaction.cardName);
            player.turnLogs.push(`removed ${interaction.removedTokens.map(t => `(${t})`).join(' ')} from ${interaction.area} for $${interaction.moneyGained}`);
          }
          nextFactoryOrEnd(player, interaction);
        }
      }
    }
  }

  // Card Interactions
  else if (interaction.cardName === 'Port') {
    if (interaction.type === 'select-area') {
      if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
      player.turnLogs.push(addChit(player, choice, 'boat', 'Port'));
      player.turnLogs.push(addChit(player, choice, 'port', 'Port'));
      player.interaction = null;
    } else if (interaction.type === 'select-chit') {
      if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
      // This handles the Run phase movement
      if (!['fish', 'hotel', 'factory', 'boat'].includes(choice.tokenType)) {
        return; // Prevent special chits from being moved by Port
      }

      player.turnLogs.push(moveChit(player, choice.areaName, interaction.area, choice.tokenType, 'Port'));
      const elements = calculateRunnableElements(player, interaction.area, interaction.runSource || 'Port');
      proceedWithAreaRun(player, interaction.area, elements, interaction.remainingAreas, interaction.runSource || 'Port');
    }
  }
  else if (interaction.cardName === 'Fishing' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, 'boat', 'Fishing'));
    player.turnLogs.push(gainMoney(player, 4 * countTotalChipsOfType(player.mat, 'boat'), 'Fishing'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Casinos' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    const hotelCount = player.mat[choice]?.hotel || 0;
    player.turnLogs.push(addChit(player, choice, Array(hotelCount).fill('hotel'), 'Casinos'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Disperse') {
    if (interaction.type === 'select-area') {
      if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
      player.turnLogs.push(addChit(player, choice, 'boat', 'Disperse'));
      player.interaction = { 
        type: 'select-chit', cardName: 'Disperse', fromArea: choice, 
        card: interaction.card, instruction: `Disperse: Move chit from ${choice}`,
        pendingCard: interaction.pendingCard || null, 
        mtrCards: interaction.mtrCards || null, 
        mtrCard: interaction.mtrCard || null
      };
    } else if (interaction.type === 'select-chit' && typeof choice === 'object' && choice !== null && choice.areaName === interaction.fromArea) {
      player.interaction = { 
        type: 'select-destination', cardName: 'Disperse', fromArea: choice.areaName, 
        tokenType: choice.tokenType, card: interaction.card, instruction: 'Disperse: Select destination',
        pendingCard: interaction.pendingCard || null, 
        mtrCards: interaction.mtrCards || null, 
        mtrCard: interaction.mtrCard || null
      };
    } else if (interaction.type === 'select-destination' && typeof choice === 'string' && areaOrder.includes(choice) && choice !== interaction.fromArea) {
      player.turnLogs.push(moveChit(player, interaction.fromArea, choice, interaction.tokenType, 'Disperse'));
      player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Relocate') {
    if (interaction.type === 'select-chit') {
      if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
      if (!interaction.stagedChits) interaction.stagedChits = [];
      if (!interaction.srcArea) interaction.srcArea = choice.areaName;
      if (choice.areaName === interaction.srcArea) {
        removeChit(player, choice.areaName, choice.tokenType, 'Relocate');
        interaction.stagedChits.push(choice.tokenType);
        interaction.count--;
        if (interaction.count <= 0) {
          player.interaction = { 
            type: 'select-destination', cardName: 'Relocate', stagedChits: interaction.stagedChits, srcArea: interaction.srcArea, card: interaction.card, 
            instruction: 'Relocate: Select destination',
            pendingCard: interaction.pendingCard || null, 
            mtrCards: interaction.mtrCards || null, 
            mtrCard: interaction.mtrCard || null
          };
        }
      }
    } else if (interaction.type === 'select-destination' && typeof choice === 'string' && areaOrder.includes(choice) && choice !== interaction.srcArea) {
      interaction.stagedChits.forEach(t => {
        player.mat[choice][t] = (player.mat[choice][t] || 0) + 1;
        player.turnLogs.push(`Relocate: moved (${t}) to ${choice}`);
      });
      player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Migration') {
    if (interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
      player.turnLogs.push(addChit(player, choice, 'boat', 'Migration'));
      player.interaction = { 
        type: 'select-other-area', cardName: 'Migration', firstArea: choice, 
        card: interaction.card, instruction: 'Migration: Select source for fish',
        pendingCard: interaction.pendingCard || null, 
        mtrCards: interaction.mtrCards || null, 
        mtrCard: interaction.mtrCard || null
      };
    } else if (interaction.type === 'select-other-area' && typeof choice === 'string' && areaOrder.includes(choice) && choice !== interaction.firstArea) {
      const count = player.mat[choice].fish;
      player.mat[choice].fish = 0;
      player.mat[interaction.firstArea].fish = (player.mat[interaction.firstArea].fish || 0) + count;
      player.turnLogs.push(`Migration: moved ${count} (fish) from ${choice} to ${interaction.firstArea}`);
      player.interaction = null;
    }
  }
  else if ((interaction.cardName === 'Pet Rocks' || interaction.cardName === 'Car Factory' || interaction.cardName === 'Saw Mill') && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    player.turnLogs.push(removeChit(player, choice.areaName, choice.tokenType, interaction.cardName));
    interaction.count--;player.interaction = null;
  }
  else if (interaction.cardName === 'Liquidate' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (!interaction.selectedChits.some(c => c.areaName === choice.areaName)) {
      player.turnLogs.push(removeChit(player, choice.areaName, choice.tokenType, 'Liquidate'));
      player.turnLogs.push(gainMoney(player, 3, interaction.cardName))
      interaction.selectedChits.push({ areaName: choice.areaName });
    }
  }
  else if (interaction.cardName === 'Widget Factory' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, 'factory', 'Widget Factory'));
    const factoryCount = player.mat[choice]?.factory || 0;
    player.turnLogs.push(gainMoney(player, factoryCount, interaction.cardName));
    player.interaction = null;
  }
  else if ((interaction.cardName === 'Beach Hotels' || interaction.cardName === 'Plastics Factories' || interaction.cardName === 'Sharks' ) && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.tokenType === 'fish') {
      player.turnLogs.push(removeChit(player, choice.areaName, 'fish', interaction.cardName));
      interaction.count--;
      if (interaction.count <= 0) player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Head West' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.areaName !== 'CoralSea' && !interaction.selectedChits.some(c => c.areaName === choice.areaName)) {
      player.turnLogs.push(moveChit(player, choice.areaName, 'CoralSea', choice.tokenType, 'Head West'));
      interaction.selectedChits.push({ areaName: choice.areaName });
        
        // Check if any other areas still have eligible chits to move
        const stillEligible = areaOrder.some(a => 
          a !== 'CoralSea' && 
          !interaction.selectedChits.some(sel => sel.areaName === a) && 
          countChips(player.mat[a]) > 0
        );
        if (!stillEligible) player.interaction = null;
    }
  }
  else if ((interaction.cardName === 'Reorganize' || interaction.cardName === 'Archaeology') && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    const dest = interaction.cardName === 'Reorganize' ? 'California' : 'Peru';
    if (choice.areaName !== dest) {
      player.turnLogs.push(moveChit(player, choice.areaName, dest, choice.tokenType, interaction.cardName));
      interaction.count--;
      if (interaction.count <= 0) {
        if (interaction.cardName === 'Archaeology') player.turnLogs.push(gainMoney(player, countChips(player.mat['Peru']), 'Archaeology'));
        player.interaction = null;
      }
    }
  }
  else if (interaction.cardName === 'Yachts' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.areaName !== 'Polynesia' && !interaction.movedTypes.includes(choice.tokenType)) {
      player.turnLogs.push(moveChit(player, choice.areaName, 'Polynesia', choice.tokenType, 'Yachts'));
      interaction.movedTypes.push(choice.tokenType);
    }
  }
  else if (interaction.cardName === 'Albatrosses' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.areaName !== 'Japan') {
      player.turnLogs.push(moveChit(player, choice.areaName, 'Japan', choice.tokenType, 'Albatrosses'));
      interaction.count--;
      if (interaction.count <= 0) player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Giant Squid') {
    if (interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
      player.turnLogs.push(addChit(player, choice, 'boat', 'Giant Squid'));
      player.interaction = {
          type: 'select-other-area',
          cardName: 'Giant Squid',
          firstArea: choice,
          card: interaction.card,
          snapshot: interaction.snapshot, 
          pendingCard: interaction.pendingCard || null, 
          mtrCards: interaction.mtrCards || null, 
          mtrCard: interaction.mtrCard || null,
          instruction: 'Giant Squid: Select an area to place 2 (fish)'
      };
    } else if (interaction.type === 'select-other-area' && typeof choice === 'string' && areaOrder.includes(choice) && choice !== interaction.firstArea) {
      player.turnLogs.push(addChit(player, choice, ['fish','fish'], 'Giant Squid'));
      player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Jellyfish') {
    if (interaction.type === 'select-chit' && typeof choice === 'object' && choice !== null && choice.areaName === 'Peru') {
      if (!interaction.stagedChits) interaction.stagedChits = [];
      removeChit(player, 'Peru', choice.tokenType, 'Jellyfish');
      interaction.stagedChits.push(choice.tokenType);
      interaction.count--;
      if (interaction.count <= 0) {
        player.interaction = { 
          type: 'select-destination', cardName: 'Jellyfish', stagedChits: interaction.stagedChits, card: interaction.card, instruction: 'Jellyfish: Select destination',
          pendingCard: interaction.pendingCard || null, 
          mtrCards: interaction.mtrCards || null, 
          mtrCard: interaction.mtrCard || null
        };
      }
    } else if (interaction.type === 'select-destination' && typeof choice === 'string' && areaOrder.includes(choice) && choice !== 'Peru') {
      interaction.stagedChits.forEach(t => {
        player.mat[choice][t] = (player.mat[choice][t] || 0) + 1;
        player.turnLogs.push(`Jellyfish: moved (${t}) to ${choice}`);
      });
      player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Seagulls' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.tokenType === 'fish' && choice.areaName !== 'California') {
      player.turnLogs.push(moveChit(player, choice.areaName, 'California', 'fish', 'Seagulls'));
      interaction.count++;
    }
  }
  else if (interaction.cardName === 'Blue Whales' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, ['fish', 'fish'], 'Blue Whales'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Humboldt Penguins' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, ['hotel', 'hotel'], 'Humboldt Penguins'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Manta Rays' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, ['fish', 'fish'], 'Manta Rays'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Moray Eels' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    player.turnLogs.push(addChit(player, choice, ['hotel', 'hotel'], 'Moray Eels'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Tokyo Branch' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    const hotelCount = player.mat[choice].hotel || 0;
    player.turnLogs.push(addChit(player, 'Japan', Array(hotelCount).fill('hotel'), 'Tokyo Branch'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Cloning Program' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    const fishCount = player.mat[choice].fish || 0;
    player.turnLogs.push(addChit(player, 'California', Array(fishCount).fill('fish'), 'Cloning Program'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Crunch Time' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    const factoryCount = player.mat[choice].factory || 0;
    player.turnLogs.push(addChit(player, choice, Array(factoryCount).fill('factory'), 'Crunch Time'));
    player.interaction = null;
  }
  else if (interaction.cardName === 'Industrial Hotels' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.tokenType === 'factory') {
      player.turnLogs.push(removeChit(player, choice.areaName, 'factory', interaction.cardName));
      player.turnLogs.push(addChit(player, choice.areaName, ['hotel', 'hotel'], interaction.cardName));
      if (countTotalChipsOfType(player.mat, 'factory') === 0) player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Seafood Chain' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.tokenType === 'fish') {
      player.turnLogs.push(removeChit(player, choice.areaName, 'fish', interaction.cardName));
      player.turnLogs.push(addChit(player, choice.areaName, 'hotel', interaction.cardName));
    }
  }
  else if (interaction.cardName === 'Underwater Hotel' && interaction.type === 'select-chit') {
    if (typeof choice !== 'object' || choice === null || !choice.areaName || !choice.tokenType) return;
    if (choice.areaName === 'CoralSea') {
      player.turnLogs.push(removeChit(player, choice.areaName, choice.tokenType, interaction.cardName));
      player.interaction = null;
    }
  }
  else if (interaction.cardName === 'Hatchery' && interaction.type === 'select-area') {
    if (typeof choice !== 'string' || !areaOrder.includes(choice)) return;
    player.turnLogs.push(addChit(player, choice, 'hatchery', 'Hatchery'));
    player.interaction = null;

  }
  else if (interaction.cardName === 'More of the Same' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    const matArea = player.mat[choice] || {};
    const tokensToAdd = [];

    for (const [type, count] of Object.entries(matArea)) {
      if (typeof count === 'number' && count > 0 && type !== 'hqUsed' && type !== 'directFlight') {
        tokensToAdd.push(type);
      }
    }
    if (tokensToAdd.length > 0) {
      player.turnLogs.push(addChit(player, choice, tokensToAdd, 'More of the Same'));
    }
    player.interaction = null;
  }
  else if (interaction.cardName === 'Oversee' && interaction.type === 'select-area' && typeof choice === 'string' && areaOrder.includes(choice)) {
    if (!interaction.selectedAreas) interaction.selectedAreas = [];
    interaction.selectedAreas.push(choice);
    if (interaction.selectedAreas.length < 2) {
      interaction.instruction = 'Oversee: Select the second area to run';
      interaction.validAreas = ['Japan', 'California', 'Peru', 'Polynesia', 'CoralSea'].filter(a => a !== choice);
    } else {
      const [area1, area2] = interaction.selectedAreas;
      player.interaction = null;
      startAreaRun(player, area1, [area2], 'Oversee');
    }
  }

  else if (interaction.type === 'mtr-choose-first') {
    const lobbyRef = doc(db, 'lobbies', lobbyId);
    const first = (choice === interaction.card1.instanceId || choice === interaction.card1.name) ? interaction.card1 : interaction.card2;
    const second = (choice === interaction.card1.instanceId || choice === interaction.card1.name) ? interaction.card2 : interaction.card1;
    const mtrCards = [first, second];
    const mtrCardContext = interaction.mtrCard || { name: 'Make the Rounds' };

    const mtrFirstLogs = executeCard(first, {}, player);
    player.turnLogs.push(...mtrFirstLogs);

    const firstMsg = `<span style="color: ${player.color}">${player.name}</span> executes <span class="card-link" data-card-name="${first.name}">${first.name}</span> then <span class="card-link" data-card-name="${second.name}">${second.name}</span>`;

    if (player.interaction && player.interaction.type !== 'mtr-choose-first') {
      player.interaction.pendingCard = second || null;
      player.interaction.mtrCards = mtrCards || null;
      player.interaction.mtrCard = mtrCardContext || null;
      await updateDoc(lobbyRef, { logs: arrayUnion(firstMsg) });
    } else {
      const secondMsg = `<span style="color: ${player.color}">${player.name}</span> continues sequence with <span class="card-link" data-card-name="${second.name}">${second.name}</span>`;
      const mtrSecondLogs = executeCard(second, {}, player);
      player.turnLogs.push(...mtrSecondLogs);

      await updateDoc(lobbyRef, { logs: arrayUnion(firstMsg, secondMsg) });

      if (player.interaction && player.interaction.type !== 'mtr-choose-first') {
        player.interaction.mtrCards = mtrCards || null;
        player.interaction.mtrCard = mtrCardContext || null;
      } else {
        player.interaction = null;
        initiateRunAreas(player, mtrCards);
      }
    }
  }
  // Persistence
  const playerRef = doc(db, `lobbies/${lobbyId}/players`, player.id);
  
  if (player.interaction === null) {
    if (!player.setAside) player.setAside = [];
    if (!player.nextTurnCards) player.nextTurnCards = [];
    if (!player.turnLogs) player.turnLogs = [];

    if (interaction?.pendingCard) {
      const lobbyRef = doc(db, 'lobbies', lobbyId);
      const second = interaction.pendingCard;
      const mtrCards = interaction.mtrCards || [second];
      const mtrCardContext = interaction.mtrCard || { name: 'Make the Rounds' };

      const logMsg = `<span style="color: ${player.color}">${player.name}</span> continues sequence with <span class="card-link" data-card-name="${second.name}">${second.name}</span>`;
      await updateDoc(lobbyRef, { logs: arrayUnion(logMsg) });

      player.interaction = null;
      const secondLogs = executeCard(second, {}, player);
      player.turnLogs.push(...secondLogs);

      if (player.interaction) {
        player.interaction.mtrCards = mtrCards || null;
        player.interaction.mtrCard = mtrCardContext || null;
      } else {
        initiateRunAreas(player, mtrCards);
      }
    } else {
      const runCards = interaction?.mtrCards || interaction?.card;
      if (runCards && !interaction.isAreaRun && interaction.type !== 'mtr-choose-first') {
        const cardList = Array.isArray(runCards) ? runCards : [runCards];
        const isSpecialRun = cardList.some(c => ['Make the Rounds', 'Trade Winds', 'Overtime'].includes(c.name));
        if (isSpecialRun || cardList.some(c => c.types && c.types.length > 0)) {
          initiateRunAreas(player, runCards);
        }
      }
    }
  }

  if (player.interaction === null) {
    await finalizeTurnLog(lobbyId, player);
    await updateDoc(playerRef, { 
      mat: player.mat, 
      money: player.money, 
      interaction: null, 
      nextTurnCards: player.nextTurnCards,
      turnLogs: [],
      setAside: player.setAside || [],
      skipFishMovement: player.skipFishMovement || null,
        bonusCounter: player.bonusCounter || {},
        needsDraw: player.needsDraw || 0,
      skipAreaRun: player.skipAreaRun || null
    }, { merge: true }); // Use merge to avoid overwriting other fields
  } else {
    await updateDoc(playerRef, { 
      mat: player.mat, 
      money: player.money, 
      setAside: player.setAside || [],
      bonusCounter: player.bonusCounter || {},
      interaction: player.interaction,
      hand: player.hand || [],
      skipFishMovement: player.skipFishMovement || null, // Persist skipFishMovement if interaction is pending
      turnLogs: player.turnLogs,
      needsDraw: player.needsDraw || 0,
      nextTurnCards: player.nextTurnCards || [],
      skipAreaRun: player.skipAreaRun || null
    }, { merge: true }); // Use merge to avoid overwriting other fields
  }
}
