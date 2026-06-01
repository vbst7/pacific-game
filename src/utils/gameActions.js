/**
 * addChit(playerObj, area, tokenTypes)
 * Mutates the local buffer object directly.
 */
export const addChit = (player, area, tokenType, cardName) => {
  // Ensure the area exists to prevent 'undefined' errors
  if (!player.mat[area]) player.mat[area] = {};

  const tokens = Array.isArray(tokenType) ? tokenType : [tokenType];
  let hqBonusLogs = [];

  tokens.forEach(t => {
    player.mat[area][t] = (player.mat[area][t] || 0) + 1;

    // Headquarters Doubling Logic
    if (player.mat[area].hq > 0 && t !== 'hq' && cardName !== 'hq Bonus') {
      if (!player.mat[area].hqUsed) player.mat[area].hqUsed = {};
      if (!player.mat[area].hqUsed[t]) {
        player.mat[area].hqUsed[t] = true;
        hqBonusLogs.push(addChit(player, area, t, 'hq Bonus'));
      }
    }
  });

  // Grand Opening: Each time you add a chit, $2 (accrued at end of turn)
  const hasGrandOpening = player.nextTurnCards?.some(c => c.name === 'Grand Opening');
  if (hasGrandOpening) {
    if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
    player.bonusCounter['Grand Opening'] = (player.bonusCounter['Grand Opening'] || 0) + tokens.length;
  }

  let log = `added ${tokens.map(t => `(${t})`).join(' ')} to ${area}`;

  if (hqBonusLogs.length > 0) {
    log += ` (hq doubled: ${hqBonusLogs.join(', ')})`;
  }

  // Upgrade: Each time you add a chit, add a (hotel)
  const hasUpgrade = player.nextTurnCards?.some(c => c.name === 'Upgrade');
  if (hasUpgrade && cardName !== 'Upgrade') {
    const upgradeLog = addChit(player, area, Array(tokens.length).fill('hotel'), 'Upgrade');
    log += ` (and ${upgradeLog})`;
  }

  return log;
};

/**
 * removeChit(playerObj, area, tokenType)
 * Decrements the count, ensuring it never goes below zero.
 */
export const removeChit = (player, area, tokenType, cardName) => {
  if (player.mat[area] && player.mat[area][tokenType] > 0) {
    player.mat[area][tokenType]--;

    // Documentary: Each time you move or remove a chit, $2
    const hasDocumentary = player.nextTurnCards?.some(c => c.name === 'Documentary');
    if (hasDocumentary) {
      const count = Array.isArray(tokenType) ? tokenType.length : 1;
      if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
      player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + count;
    }

    return `removed (${tokenType}) from ${area}`;
  }
  return '';
};

/**
 * moveChit(playerObj, fromArea, toArea, tokenType)
 * Atomic local move between two map areas.
 */
export const moveChit = (player, fromArea, toArea, tokenType, cardName) => {
  if (player.mat[fromArea] && player.mat[fromArea][tokenType] > 0) {
    player.mat[fromArea][tokenType]--;
    
    if (!player.mat[toArea]) player.mat[toArea] = {};
    player.mat[toArea][tokenType] = (player.mat[toArea][tokenType] || 0) + 1;

    let logSuffix = '';
    if (tokenType === 'balloon' && toArea === 'California') {
      logSuffix = ` and ${gainMoney(player, 15, cardName)}`;
    }

    // Documentary: Each time you move or remove a chit, $2
    const hasDocumentary = player.nextTurnCards?.some(c => c.name === 'Documentary');
    if (hasDocumentary) {
      const count = Array.isArray(tokenType) ? tokenType.length : 1;
      if (!player.bonusCounter || typeof player.bonusCounter !== 'object') player.bonusCounter = {};
      player.bonusCounter['Documentary'] = (player.bonusCounter['Documentary'] || 0) + count;
    }

    return `moved (${tokenType}) from ${fromArea} to ${toArea}${logSuffix}`;
  }
  return '';
};

/**
 * gainMoney(playerObj, amount)
 * Updates the top-level money attribute.
 */
export const gainMoney = (player, amount, cardName) => {
  player.money = (player.money || 0) + amount;
  return `gained $${amount}`;
};

/**
 * The "Final Step": Pushes the buffer to Firestore
 */
export const syncPlayerToServer = async (lobbyId, playerId, playerObj) => {
  const playerRef = doc(db, `lobbies/${lobbyId}/players`, playerId);
  try {
    await updateDoc(playerRef, {
      mat: playerObj.mat,
      money: playerObj.money,
      hand: playerObj.hand // If cards were spent/gained
    });
    console.log("State synced to server.");
  } catch (e) {
    console.error("Sync failed:", e);
  }
};