import { gainMoney, addChit, removeChit } from "@/utils/gameActions";

/**
 * Helper function to count all chips (tokens) in a specific mat area.
 * It sums up all numeric properties (fish, boat, hotel, factory).
 */
export function countChips(area) {
  if (!area || typeof area !== 'object') return 0;
  return Object.values(area).reduce((acc, val) => {
    return acc + (typeof val === 'number' ? val : 0);
  }, 0);
}

/**
 * Helper function to count the diversity of chips in a specific mat area.
 * It returns the number of different chip types that have a count greater than zero.
 */
export function countDiversity(area) {
  if (!area || typeof area !== 'object') return 0;
  return Object.values(area).filter(val => {
    return typeof val === 'number' && val > 0;
  }).length;
}

/**
 * Helper function to count the total number of a specific chip type across all areas.
 * @param {Object} mat - The player's mat object.
 * @param {string} chipType - The type of chip to count (e.g., 'fish', 'hotel').
 */
export function countTotalChipsOfType(mat, chipType) {
  if (!mat || typeof mat !== 'object') return 0;
  return Object.entries(mat).reduce((acc, [key, area]) => {
    if (typeof area !== 'object') return acc;
    return acc + (area[chipType] || 0);
  }, 0);
}

/**
 * Handles the execution logic for all Pacific cards.
 */
export function executeCard(card, areaData, playerData) { // Changed cardName to card
  console.log(`Executing logic for: ${card.name}`);
  const areaNames = Object.keys(playerData.mat).filter(k => 
    ['Japan', 'California', 'Peru', 'Polynesia', 'CoralSea'].includes(k)
  );
  const logs = [];
  
switch (card.name) { // Use card.name
  case 'Disperse':
    // Logic for Disperse
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Disperse',
      card: card,
      snapshot: { 
        mat: JSON.parse(JSON.stringify(playerData.mat)), 
        money: playerData.money
      },
      instruction: 'Disperse: Select an area to place a (boat)'
    };
    break;
  case 'Direct Flight':
    playerData.interaction = {
      type: 'select-arrow',
      cardName: 'Direct Flight',
      card: card,
      snapshot: { 
        mat: JSON.parse(JSON.stringify(playerData.mat)), 
        money: playerData.money
      },
      instruction: 'Direct Flight: Select an arrow to place the token'
    };
    break;
  case 'Glass-Bottom Boats':
    // Logic for Glass-Bottom Boats
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (area.fish > 0) {
        logs.push(addChit(playerData, areaName, 'boat', card.name));
      }
    });
    break;
  case 'Head West':
  logs.push(addChit(playerData, "CoralSea", "boat", card.name));
  // Only start interaction if there are eligible chits in other areas
  if (areaNames.some(a => a !== 'CoralSea' && countChips(playerData.mat[a]) > 0)) {
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Head West',
      card: card,
      excludeArea: 'CoralSea',
      canPass: true,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      selectedChits: [], // [{areaName, tokenType}] — one per area
      instruction: 'Head West: Select up to one (chit) from each area to move to Coral Sea, then Pass'
    };
  }
  break;
  case 'Migration':
  playerData.interaction = {
    type: 'select-area',
    cardName: 'Migration',
    card: card,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    instruction: 'Migration: Select an area to place a (boat) and move all (fish) from'
  };
  break;
  case 'Port':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Port',
      card: card,
      snapshot: { 
        mat: JSON.parse(JSON.stringify(playerData.mat)), 
        money: playerData.money
      },
      instruction: 'Port: Select an area to place a (boat) and a (port)'
    };
    break;
  case 'Relocate':
    const relocateSnapshot = { 
      mat: JSON.parse(JSON.stringify(playerData.mat)), 
      money: playerData.money 
    };
    logs.push(addChit(playerData, "Peru", "boat", card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Relocate',
      card: card,
      count: 3,
      canPass: true,
      snapshot: relocateSnapshot,
      instruction: 'Move up to 3 (chit) from any one area to another'
    };
    break;
  case 'Reorganize':
    logs.push(addChit(playerData, "California", "boat", card.name));
  playerData.interaction = {
    type: 'select-chit',
    cardName: 'Reorganize',
    excludeArea: 'California',
    count: 4,
    canPass: true,
    card: card,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    instruction: 'Reorganize: Select up to 4 (chit) to move to California'
  };
  break;

case 'Yachts':
  logs.push(addChit(playerData, 'Polynesia', 'boat', card.name));
  playerData.interaction = {
    type: 'select-chit',
    cardName: 'Yachts',
    card: card,
    excludeArea: 'Polynesia',
    canPass: true,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    movedTypes: [], // track which chip types have already been moved
    instruction: 'Yachts: Move up to one (chit) of each type to Polynesia'
  };
  break;

case 'Archaeology':
  const chitsToMove = areaNames.filter(a => a !== 'Peru').reduce((acc, a) => acc + countChips(playerData.mat[a]), 0);
  if (chitsToMove > 0) {
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Archaeology',
      excludeArea: 'Peru',
      count: 4,
      canPass: true,
      card: card,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Archaeology: Select up to 4 (chit) to move to Peru'
    };
  } else {
    logs.push(gainMoney(playerData, countChips(playerData.mat['Peru']), card.name));
  }
  break;
  case 'Documentary':
  case 'Grand Opening':
  case 'Upgrade':
  case 'Make the Rounds':
    if (!playerData.setAside) playerData.setAside = [];
    playerData.setAside.push(card);
    break;
  case 'Fishing':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Fishing',
      card: card,
      snapshot: { 
        mat: JSON.parse(JSON.stringify(playerData.mat)), 
        money: playerData.money 
      },
      instruction: 'Select an area to place a (boat)'
    };
    break;
  case 'Casinos':
    if (!playerData.setAside) playerData.setAside = [];
    playerData.setAside.push(card);
    const areasWithHotelsCasinos = areaNames.filter(a => playerData.mat[a].hotel > 0);
    if (areasWithHotelsCasinos.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Casinos',
        card: card,
        validAreas: areasWithHotelsCasinos,
        snapshot: { 
          mat: JSON.parse(JSON.stringify(playerData.mat)), 
          money: playerData.money
        },
        instruction: 'Casinos: Select an area to place a (hotel) per (hotel) there'
      };
    }
    break;
  case 'Albatrosses':
  logs.push(addChit(playerData, 'Japan', ['boat', 'fish'], card.name));
  const chitsForJapan = areaNames.filter(a => a !== 'Japan').reduce((acc, a) => acc + countChips(playerData.mat[a]), 0);
  if (chitsForJapan > 0) {
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Albatrosses',
      excludeArea: 'Japan',
      count: 3,
      canPass: true,
      card: card,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Albatrosses: Move up to 3 (chit) to Japan'
    };
  }
  break;
  case 'Dolphin Spy Network':
    if (!playerData.setAside) playerData.setAside = [];
    playerData.setAside.push(card);
    logs.push(addChit(playerData, "Japan", ["fish", "fish"], card.name));
    break;
case 'Giant Squid':
  playerData.interaction = {
    type: 'select-area',
    cardName: 'Giant Squid',
    card: card,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    instruction: 'Giant Squid: Select an area to place a (boat)'
  };
  break;

case 'Jellyfish':
  logs.push(addChit(playerData, 'Peru', ['boat', 'fish'], card.name));
  playerData.interaction = {
    type: 'select-chit',
    cardName: 'Jellyfish',
    count: 3,
    canPass: true,
    card: card,
    filter: 'Peru', // only from Peru
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    instruction: 'Jellyfish: Select up to 3 (chit) from Peru to move to another area'
  };
  break;

case 'Killer Whales':
  logs.push(addChit(playerData, "Japan", ["boat", "fish", "fish"], card.name));
  break;
  
case 'Seagulls':
  logs.push(addChit(playerData, 'California', ['boat', 'fish'], card.name));
  playerData.interaction = {
    type: 'select-chit',
    cardName: 'Seagulls',
      excludeArea: 'California',
    canPass: true,
    filter: 'fish',
    count: 0,
    card: card,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    instruction: 'Seagulls: Move any number of (fish) to California'
  };
  break;
  case 'Air Conditioning':
    // Logic for Air Conditioning
    logs.push(gainMoney(playerData, countTotalChipsOfType(playerData.mat,"hotel"), card.name));
    break;
  case 'Balloon Trip':
    logs.push(addChit(playerData, "California", "balloon", card.name));
    break;
  case 'Brochures':
    // Logic for Brochures
    let hotelCount = 0
    let hotelDiversity = 0
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (area.hotel > 0) hotelDiversity += 1
      hotelCount += area.hotel
    });
    if (hotelDiversity >= 3) {
      logs.push(gainMoney(playerData, 2 * hotelCount, card.name));
    }
    break;
  case 'Diversify':
    // Logic for Diversify
    logs.push(gainMoney(playerData, 5 * Math.min(countTotalChipsOfType(playerData.mat,"fish"), countTotalChipsOfType(playerData.mat,"factory")), card.name));
    break;
  case 'Omnipresence':
    // Logic for Omnipresence
    let minChipCount = Infinity
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      const chipCount = countChips(area)
      if (chipCount < minChipCount) minChipCount = chipCount
    });
    logs.push(gainMoney(playerData, 15 * minChipCount, card.name));
    break;
  case 'Package Tours':
    // Logic for Package Tours
    let diverseAreaCount = 0
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (countDiversity(area) >= 3) diverseAreaCount += 1
    });
    logs.push(gainMoney(playerData, 9 * diverseAreaCount, card.name));
    break;
  case 'Tour Guides':
    // Logic for Tour Guides
    let fishOnlyCount = 0
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (countDiversity(area) === 1){
        fishOnlyCount += area.fish
      }
    });
    logs.push(gainMoney(playerData, 2 * fishOnlyCount, card.name));
    break;
  case 'Tourist Season':
    // Logic for Tourist Season
    let touristAreaCount = 0
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (countChips(area) >= 3) touristAreaCount += 1
    });
    logs.push(gainMoney(playerData, 6 * touristAreaCount, card.name));
    break;
  case 'Whale Watching':
    // Logic for Whale Watching
    logs.push(gainMoney(playerData, countTotalChipsOfType(playerData.mat,"fish"), card.name));
    break;
  case 'Computer Chip Factory':
    // Logic for Computer Chip Factory
    logs.push(addChit(playerData, 'California', 'factory', card.name));
    logs.push(gainMoney(playerData, 5, card.name));
    playerData.needsDraw = (playerData.needsDraw || 0) + 1;
    break;
  case 'Liquidate':
    // Logic for Liquidate
  playerData.interaction = {
    type: 'select-chit',
    cardName: 'Liquidate',
    card: card,
    canPass: true,
    snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
    selectedChits: [], // [{areaName, tokenType}] — one per area
    instruction: 'Liquidate: Remove up to one (chit) from each area, for +$3 each.'
  };
    break;
  case 'Pet Rocks':
    // Logic for Pet Rocks
    const petRocksSnapshot = { 
      mat: JSON.parse(JSON.stringify(playerData.mat)), 
      money: playerData.money 
    };
    logs.push(gainMoney(playerData, 3 * countTotalChipsOfType(playerData.mat,"factory"), card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Pet Rocks',
      card: card,
      count: 1,
      snapshot: petRocksSnapshot,
      instruction: 'Remove 1 (chit) from anywhere'
    };
    break;
  case 'Refinery':
    // Logic for Refinery
    logs.push(addChit(playerData,"Peru","factory",card.name));
    logs.push(gainMoney(playerData,3 * countDiversity(playerData.mat["Peru"]), card.name));
    break;
  case 'Widget Factory':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Widget Factory',
      card: card,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Widget Factory: Select an area to place a (factory) and gain $1 per (factory) there'
    };
    break;
  case 'Floating Hotel':
    logs.push(addChit(playerData, "CoralSea", ["hotel", "hotel"], card.name));
    // if the card execution context provides uniqueness (e.g. from the orchestrator)
    if (areaData?.isUnique) {
      logs.push(gainMoney(playerData, 5, card.name));
    }
    break;
  case 'Proliferation':
    // Logic for Proliferation
    let proliferation = 0
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      const chipCount = countChips(area)
      if (chipCount > 0){
        logs.push(addChit(playerData,areaName,"fish",card.name));
        proliferation += 1
      }
    });
    logs.push(gainMoney(playerData, 2 * proliferation, card.name));
    break;
  case 'Sea Lions':
    logs.push(addChit(playerData, "Peru", ["fish", "fish"], card.name));
    logs.push(gainMoney(playerData, 3 * countDiversity(playerData.mat["Peru"]), card.name));
    break;
  case 'Bottling Factory':
    logs.push(addChit(playerData, "Peru", ["factory", "factory"], card.name));
    playerData.skipAreaRun = 'Peru';
    break;
  case 'Car Factory':
    logs.push(addChit(playerData, "Japan", ["factory", "factory"], card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Car Factory',
      card: card,
      count: 1,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Car Factory: Remove 1 (chit) from anywhere'
    };
    break;
  case 'Crunch Time':
    const factoryAreasCT = areaNames.filter(a => playerData.mat[a].factory > 0);
    if (factoryAreasCT.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Crunch Time',
        card: card,
        validAreas: factoryAreasCT,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Crunch Time: Select an area to place a (factory) per (factory) you have there'
      };
    }
    break;
  case 'Dairy Farms':
    // Logic for Dairy Farms
    logs.push(addChit(playerData,"California","factory",card.name));
    logs.push(addChit(playerData,"Polynesia","factory",card.name));
    break;
  case 'Deepwater Drilling':
    // Logic for Deepwater Drilling
    logs.push(addChit(playerData,"CoralSea","factory",card.name));
    logs.push(addChit(playerData,"Japan","factory",card.name));
    break;
  case 'Expand':
    // Logic for Expand
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (area.hotel > 0) logs.push(addChit(playerData,areaName,"factory",card.name));
    });
    break;
  case 'Plastics Factories':
    logs.push(addChit(playerData, "California", ["factory", "factory"], card.name));
    const totalFishPF = countTotalChipsOfType(playerData.mat, 'fish');
    if (totalFishPF > 0 && totalFishPF <= 2) {
      areaNames.forEach(a => {
        while (playerData.mat[a].fish > 0) {
          logs.push(removeChit(playerData, a, 'fish', card.name));
        }
      });
    } else if (totalFishPF > 2) {
      playerData.interaction = {
        type: 'select-chit',
        cardName: 'Plastics Factories',
        card: card,
        count: 2,
        filter: 'fish',
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Plastics Factories: Remove 2 (fish) from anywhere'
      };
    }
    break;
  case 'Saw Mill':
    logs.push(addChit(playerData, "Polynesia", ["factory", "factory"], card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Saw Mill',
      card: card,
      count: 1,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Saw Mill: Remove 1 (chit) from anywhere'
    };
    break;
  case 'Textile Factories':
    // Logic for Textile Factories
    logs.push(addChit(playerData,"Polynesia","factory",card.name));
    logs.push(addChit(playerData,"Peru","factory",card.name));
    break;
  case 'Beach Hotels':
    logs.push(addChit(playerData, "Japan", ["hotel", "hotel", "hotel"], card.name));
    const totalFishBH = countTotalChipsOfType(playerData.mat, "fish");
    if (totalFishBH > 0 && totalFishBH <= 2) {
      areaNames.forEach(a => {
        while (playerData.mat[a].fish > 0) {
          logs.push(removeChit(playerData, a, 'fish', card.name));
        }
      });
    } else if (totalFishBH > 2) {
      playerData.interaction = {
        type: 'select-chit',
        cardName: 'Beach Hotels',
        card: card,
        count: 2,
        filter: 'fish',
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Beach Hotels: Remove 2 (fish) from anywhere'
      };
    }
    break;
  case 'Holiday in Peru':
    // Logic for Holiday in Peru
    const peru = playerData.mat["Peru"];
    const toReplace = (peru.fish || 0) + (peru.boat || 0) + (peru.factory || 0);
    peru.fish = 0;
    peru.boat = 0;
    peru.factory = 0;
    logs.push(addChit(playerData, "Peru", Array(toReplace + 1).fill("hotel"), card.name));
    break;
  case 'Industrial Hotels':
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Industrial Hotels',
      card: card,
      filter: 'factory',
      canPass: true,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Industrial Hotels: Select (factory) to replace with 2 (hotel) each, then Pass'
    };
    break;
  case 'Seafood Chain':
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Seafood Chain',
      card: card,
      filter: 'fish',
      canPass: true,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Seafood Chain: Select (fish) to replace with (hotel) each, then Pass'
    };
    break;
  case 'Underwater Hotel':
    logs.push(addChit(playerData, "CoralSea", ["hotel", "hotel", "hotel"], card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Underwater Hotel',
      card: card,
      count: 1,
      filter: 'CoralSea', // Logic in resolveInteraction must handle area filtering
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Underwater Hotel: Remove 1 (chit) from Coral Sea'
    };
    break;
  case 'Octopus':
    logs.push(addChit(playerData, "Japan", ["factory", "fish", "fish"], card.name));
    break;
  case 'Sharks':
    const sharkSnapshot = { 
      mat: JSON.parse(JSON.stringify(playerData.mat)), 
      money: playerData.money 
    };
    logs.push(addChit(playerData, "California", ["fish", "fish", "fish"], card.name));
    logs.push(addChit(playerData, "Polynesia", ["fish", "fish", "fish"], card.name));
    playerData.interaction = {
      type: 'select-chit',
      cardName: 'Sharks',
      card: card,
      count: 3,
      filter: 'fish',
      snapshot: sharkSnapshot,
      instruction: 'Remove 3 (fish) from anywhere'
    };
    break;
  case 'Aquarium':
    // Logic for Aquarium
    if (countTotalChipsOfType(playerData.mat, "fish") >= 2){
      logs.push(addChit(playerData, "Polynesia", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Capsule Hotels':
    // Logic for Capsule Hotels
    if (countTotalChipsOfType(playerData.mat, "factory") >= 2){
      logs.push(addChit(playerData, "Japan", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Cruise Ships':
    // Logic for Cruise Ships
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      if (area.boat > 0) {
        logs.push(addChit(playerData, areaName, ['hotel','hotel'], card.name));
      }
    });
    break;
  case 'Hotel California':
    // Logic for Hotel California
    if (playerData.money >= 5){
      logs.push(addChit(playerData, "California", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Island Resort':
    // Logic for Island Resort
    logs.push(addChit(playerData, "Polynesia", ["hotel", "hotel", "hotel"], card.name));
    playerData.skipAreaRun = 'Polynesia';
    break;
  case 'Machu Picchu':
    // Logic for Machu Picchu
    if (countChips(playerData.mat["Peru"]) >= 2){
      logs.push(addChit(playerData, "Peru", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Spas':
    // Logic for Spas
    if (playerData.money >= 5){
      logs.push(addChit(playerData, "Peru", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Theme Park':
    // Logic for Theme Park
    if (countTotalChipsOfType(playerData.mat, "fish") >= 2){
      logs.push(addChit(playerData, "California", ["hotel","hotel","hotel"], card.name));
    }
    break;
  case 'Tokyo Branch':
    const areasWithHotelsTB = areaNames.filter(a => a !== 'Japan' && playerData.mat[a].hotel > 0);
    if (areasWithHotelsTB.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Tokyo Branch',
        card: card,
        validAreas: areasWithHotelsTB,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Tokyo Branch: Select an area to gain a (hotel) in Japan per (hotel) there'
      };
    }
    break;
  case 'Blue Whales':
    logs.push(addChit(playerData, "California", ["hotel", "hotel"], card.name));
    const emptyAreasBW = areaNames.filter(name => countChips(playerData.mat[name]) === 0);
    if (emptyAreasBW.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Blue Whales',
        card: card,
        validAreas: emptyAreasBW,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Blue Whales: Select an empty area to place 2 (fish)'
      };
    }
    break;
  case 'Humboldt Penguins':
    logs.push(addChit(playerData, "Peru", ["fish", "fish"], card.name));
    const hotelAreasHP = areaNames.filter(name => playerData.mat[name].hotel > 0);
    if (hotelAreasHP.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Humboldt Penguins',
        card: card,
        validAreas: hotelAreasHP,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Humboldt Penguins: Select an area where you have a (hotel) to place 2 (hotel)'
      };
    }
    break;
  case 'Manta Rays':
    logs.push(addChit(playerData, "CoralSea", ["hotel", "hotel"], card.name));
    const fishAreasMR = areaNames.filter(name => playerData.mat[name].fish > 0);
    if (fishAreasMR.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Manta Rays',
        card: card,
        validAreas: fishAreasMR,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Manta Rays: Select an area where you have a (fish) to place 2 (fish)'
      };
    }
    break;
  case 'Moray Eels':
    logs.push(addChit(playerData, "Polynesia", ["fish", "fish"], card.name));
    const emptyAreasME = areaNames.filter(name => countChips(playerData.mat[name]) === 0);
    if (emptyAreasME.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Moray Eels',
        card: card,
        validAreas: emptyAreasME,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Moray Eels: Select an empty area to place 2 (hotel)'
      };
    }
    break;
  case 'Breeding Program':
    areaNames.forEach(areaName => {
      logs.push(addChit(playerData, areaName, "fish", card.name));
    });
    playerData.skipFishMovement = true;
    break;
  case 'Cloning Program':
    const areasWithFishCP = areaNames.filter(a => a !== 'California' && playerData.mat[a].fish > 0);
    if (areasWithFishCP.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'Cloning Program',
        card: card,
        validAreas: areasWithFishCP,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'Cloning Program: Select an area to gain a (fish) in California per (fish) there'
      };
    }
    break;
  case 'Dugongs':
    // Logic for Dugongs
    logs.push(addChit(playerData, "CoralSea", ["fish", "fish", "fish"], card.name));
    break;
  case 'Hatchery':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Hatchery',
      card: card,
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Hatchery: Select an area to place a (hatchery)'
    };
    break;
  case 'Robot Fish':
    // Logic for Robot Fish
    areaNames.forEach(areaName => {
      const area = playerData.mat[areaName];
      logs.push(addChit(playerData, areaName, Array(area.factory).fill("fish"), card.name));
    });
    break;
  case 'Sea Otters':
    logs.push(addChit(playerData, "California", ["fish", "fish", "fish"], card.name));
    break;
  case 'Sea Turtles':
    // Logic for Sea Turtles
    logs.push(addChit(playerData, "Peru", ["fish", "fish", "fish"], card.name));
    break;
  case 'Headquarters':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Headquarters',
      card: card,
      snapshot: { 
        mat: JSON.parse(JSON.stringify(playerData.mat)), 
        money: playerData.money
      },
      instruction: 'Headquarters: Select an area to place a (hq)'
    };
    break;
  case 'Make the Rounds':
    if (!playerData.setAside) playerData.setAside = [];
    playerData.setAside.push(card);
    break;
  case 'More of the Same':
    const areasWithChitsMOTS = areaNames.filter(a => countChips(playerData.mat[a]) > 0);
    if (areasWithChitsMOTS.length > 0) {
      playerData.interaction = {
        type: 'select-area',
        cardName: 'More of the Same',
        card: card,
        validAreas: areasWithChitsMOTS,
        snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
        instruction: 'More of the Same: Select an area to double each type of (chit) there'
      };
    }
    break;
  case 'Oversee':
    playerData.interaction = {
      type: 'select-area',
      cardName: 'Oversee',
      card: card,
      selectedAreas: [],
      snapshot: { mat: JSON.parse(JSON.stringify(playerData.mat)), money: playerData.money },
      instruction: 'Oversee: Select the first area to run'
    };
    break;
  case 'Overtime':
    // Overtime logic is handled entirely by name in initiateRunAreas
    break;
  case 'Trade Winds':
    playerData.skipFishMovement = true;
    break;
  default:
    // Handle unknown card
    console.warn(`Card logic for "${card.name}" not yet implemented.`);
  }

  return logs;

}