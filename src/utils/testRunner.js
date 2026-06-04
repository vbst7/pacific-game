import { db } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import cardsData from '../cards.json';
import { executeCard } from '../logic/cardExecution';
import { initiateRunAreas, finalizeTurnLog, resolvePlayerInteraction, processTurnEnd } from '../logic/turnOrchestration';

const areas = ['Japan', 'California', 'CoralSea', 'Polynesia', 'Peru'];

export const gameTests = [
  {
    name: "Head West - Move chits to Coral Sea",
    initialState: { mat: { Japan: { fish: 1 }, California: { fish: 1 } }, money: 0 },
    hand: ["Head West"],
    script: { playedCard: "Head West", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "California", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { CoralSea: { boat: 1, fish: 2 }, Japan: { fish: 0 }, California: { fish: 0 } }, money: 0 }
  },
  {
    name: "Migration - Move all fish to new boat area",
    initialState: { mat: { CoralSea: { fish: 3 } }, money: 0 },
    hand: ["Migration"],
    script: { playedCard: "Migration", actions: ["California", "CoralSea"], areaRun: [] },
    expected: { mat: { California: { boat: 1, fish: 3 }, CoralSea: { fish: 0 } } }
  },
  {
    name: "Relocate - Move 3 chits from Japan to Peru",
    initialState: { mat: { Japan: { fish: 3 } }, money: 0 },
    hand: ["Relocate"],
    script: { playedCard: "Relocate", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, "California"], areaRun: [] },
    expected: { mat: { Peru: { boat: 1 }, Japan: { fish: 0 }, California: { fish: 3 } } }
  },
  {
    name: "Reorganize - Move 4 chits to California",
    initialState: { mat: { Japan: { fish: 2 }, Peru: { fish: 2 } }, money: 0 },
    hand: ["Reorganize"],
    script: { playedCard: "Reorganize", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { California: { boat: 1, fish: 4 }, Japan: { fish: 0 }, Peru: { fish: 0 } } }
  },
  {
    name: "Yachts - Move types to Polynesia",
    initialState: { mat: { Japan: { fish: 1 }, California: { factory: 1 }, Peru: { hotel: 1 } }, money: 0 },
    hand: ["Yachts"],
    script: { playedCard: "Yachts", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "California", tokenType: "factory" }, { areaName: "Peru", tokenType: "hotel" }, "pass"], areaRun: [] },
    expected: { mat: { Polynesia: { boat: 1, fish: 1, factory: 1, hotel: 1 } } }
  },
  {
    name: "Archaeology - Move to Peru and gain money",
    initialState: { mat: { Japan: { fish: 4 } }, money: 0 },
    hand: ["Archaeology"],
    script: { playedCard: "Archaeology", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { Peru: { fish: 4 } }, money: 4 }
  },
  {
    name: "Albatrosses - Placement and Move to Japan",
    initialState: { mat: { California: { fish: 3 } }, money: 0 },
    hand: ["Albatrosses"],
    script: { playedCard: "Albatrosses", actions: [{ areaName: "California", tokenType: "fish" }, { areaName: "California", tokenType: "fish" }, { areaName: "California", tokenType: "fish" }], areaRun: ["Boats"] },
    expected: { mat: { Japan: { boat: 1, fish: 0 }, California: { fish: 4 } }, money: 4  }
  },
  {
    name: "Giant Squid - 2 Fish somewhere else",
    initialState: { mat: {}, money: 0 },
    hand: ["Giant Squid"],
    script: { playedCard: "Giant Squid", actions: ["Japan", "California"], areaRun: [] },
    expected: { mat: { Japan: { boat: 1 }, California: { fish: 2 }, Peru: { fish: 0 }, Polynesia: { fish: 0 }, CoralSea: { fish: 0 } } }
  },
  {
    name: "Jellyfish - Move from Peru to California",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Jellyfish"],
    script: { playedCard: "Jellyfish", actions: [{ areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, "California"], areaRun: [] },
    expected: { mat: { Peru: { boat: 1, fish: 1 }, California: { fish: 3 } } }
  },
  {
    name: "Seagulls - Move any number of fish to California",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Seagulls"],
    script: { playedCard: "Seagulls", actions: [{ areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, "pass"], areaRun: [] },
    expected: { mat: { California: { boat: 1, fish: 4 }, Peru: { fish: 0 } } }
  },
  {
    name: "Glass-Bottom Boats - Boat per fish",
    initialState: { mat: { Japan: { fish: 1 }, Peru: { fish: 1 } }, money: 0 },
    hand: ["Glass-Bottom Boats"],
    script: { playedCard: "Glass-Bottom Boats", actions: [], areaRun: ["Boats"] },
    expected: { mat: { Japan: { boat: 1 }, Peru: { boat: 1 } } }
  },
  {
    name: "Killer Whales - Japan setup",
    initialState: { mat: {}, money: 0 },
    hand: ["Killer Whales"],
    script: { playedCard: "Killer Whales", actions: [], areaRun: ["Boats"] },
    expected: { mat: { Japan: { boat: 1, fish: 0 }, California: { fish: 2 } }, money: 2 }
  },
  {
    name: "Air Conditioning - $1 per hotel",
    initialState: { mat: { Japan: { hotel: 3 } }, money: 0 },
    hand: ["Air Conditioning"],
    script: { playedCard: "Air Conditioning", actions: [], areaRun: [] },
    expected: { money: 3 }
  },
  {
    name: "Brochures - $2 per hotel if in 3 areas",
    initialState: { mat: { Japan: { hotel: 1 }, CoralSea: { hotel: 1 }, Peru: { hotel: 1 } }, money: 0 },
    hand: ["Brochures"],
    script: { playedCard: "Brochures", actions: [], areaRun: [] },
    expected: { money: 6 }
  },
  {
    name: "Diversify - $5 per min of fish/factory",
    initialState: { mat: { Japan: { fish: 2, factory: 3 } }, money: 0 },
    hand: ["Diversify"],
    script: { playedCard: "Diversify", actions: [], areaRun: [] },
    expected: { money: 10 }
  },
  {
    name: "Omnipresence - $15 per chit in fewest area",
    initialState: { mat: { Japan: { fish: 3 }, California: { factory: 1 }, Peru: { fish: 3 }, Polynesia: { fish: 3 }, CoralSea: { factory: 1 } }, money: 0 },
    hand: ["Omnipresence"],
    script: { playedCard: "Omnipresence", actions: [], areaRun: [] },
    expected: { money: 15 }
  },
  {
    name: "Omnipresence - no money",
    initialState: { mat: { Japan: { fish: 0 }, California: { fish: 2 }, Peru: { boat: 3 }, Polynesia: { factory: 4 }, CoralSea: { fish: 5 } }, money: 0 },
    hand: ["Omnipresence"],
    script: { playedCard: "Omnipresence", actions: [], areaRun: [] },
    expected: { money: 0 }
  },
  {
    name: "Package Tours - $9 per diverse area",
    initialState: { mat: { Japan: { fish: 1, boat: 1, hotel: 1 } }, money: 0 },
    hand: ["Package Tours"],
    script: { playedCard: "Package Tours", actions: [], areaRun: [] },
    expected: { money: 9 }
  },
  {
    name: "Tour Guides - $2 per isolated fish",
    initialState: { mat: { Japan: { fish: 3 }, California: { fish: 1, boat: 1 } }, money: 0 },
    hand: ["Tour Guides"],
    script: { playedCard: "Tour Guides", actions: [], areaRun: ["Boats"] },
    expected: { money: 7 }
  },
  {
    name: "Tourist Season - $6 per area with 3+ chits",
    initialState: { mat: { Japan: { fish: 3 }, California: { fish: 2 } }, money: 0 },
    hand: ["Tourist Season"],
    script: { playedCard: "Tourist Season", actions: [], areaRun: [] },
    expected: { money: 6 }
  },
  {
    name: "Whale Watching - $1 per fish",
    initialState: { mat: { Japan: { fish: 5 } }, money: 0 },
    hand: ["Whale Watching"],
    script: { playedCard: "Whale Watching", actions: [], areaRun: [] },
    expected: { money: 5 }
  },
  {
    name: "Refinery - Peru factory and diverse bonus",
    initialState: { mat: { Peru: { fish: 1, boat: 1 } }, money: 0 },
    hand: ["Refinery"],
    script: { playedCard: "Refinery", actions: [], areaRun: ["Factories", "pass", "Boats"] },
    expected: { mat: { Peru: { factory: 1 } }, money: 10 }
  },
  {
    name: "Proliferation - Fish and money per area",
    initialState: { mat: { Japan: { boat: 1 }, Polynesia: { hotel: 1 } }, money: 0 },
    hand: ["Proliferation"],
    script: { playedCard: "Proliferation", actions: [], areaRun: [] },
    expected: { mat: { Japan: { fish: 1 }, Polynesia: { fish: 1 } }, money: 4 }
  },
  {
    name: "Sea Lions - Peru fish and diversity",
    initialState: { mat: { Peru: { factory: 1 } }, money: 0 },
    hand: ["Sea Lions"],
    script: { playedCard: "Sea Lions", actions: [], areaRun: [] },
    expected: { mat: { Peru: { fish: 2 } }, money: 6 }
  },
  {
    name: "Dairy Farms - Two factories",
    initialState: { mat: {}, money: 0 },
    hand: ["Dairy Farms"],
    script: { playedCard: "Dairy Farms", actions: [], areaRun: [] },
    expected: { mat: { California: { factory: 1 }, Polynesia: { factory: 1 } } }
  },
  {
    name: "Deepwater Drilling - Two factories",
    initialState: { mat: {}, money: 0 },
    hand: ["Deepwater Drilling"],
    script: { playedCard: "Deepwater Drilling", actions: [], areaRun: [] },
    expected: { mat: { CoralSea: { factory: 1 }, Japan: { factory: 1 } } }
  },
  {
    name: "Expand - Factory per hotel",
    initialState: { mat: { Japan: { hotel: 1 } }, money: 0 },
    hand: ["Expand"],
    script: { playedCard: "Expand", actions: [], areaRun: [] },
    expected: { mat: { Japan: { factory: 1 } } }
  },
  {
    name: "Textile Factories - Two factories",
    initialState: { mat: {}, money: 0 },
    hand: ["Textile Factories"],
    script: { playedCard: "Textile Factories", actions: [], areaRun: [] },
    expected: { mat: { Polynesia: { factory: 1 }, Peru: { factory: 1 } } }
  },
  {
    name: "Holiday in Peru - Replace all with Hotels",
    initialState: { mat: { Peru: { fish: 1, boat: 1, factory: 1 } }, money: 0 },
    hand: ["Holiday in Peru"],
    script: { playedCard: "Holiday in Peru", actions: [], areaRun: [] },
    expected: { mat: { Peru: { hotel: 4, fish: 0, boat: 0, factory: 0 } } }
  },
  {
    name: "Octopus - Japan setup",
    initialState: { mat: {}, money: 0 },
    hand: ["Octopus"],
    script: { playedCard: "Octopus", actions: [], areaRun: [] },
    expected: { mat: { Japan: { factory: 1, fish: 2 } } }
  },
  {
    name: "Aquarium - Hotels on Polynesia",
    initialState: { mat: { Japan: { fish: 2 } }, money: 0 },
    hand: ["Aquarium"],
    script: { playedCard: "Aquarium", actions: [], areaRun: [] },
    expected: { mat: { Polynesia: { hotel: 3 } } }
  },
  {
    name: "Capsule Hotels - Hotels on Japan",
    initialState: { mat: { Peru: { factory: 2 } }, money: 0 },
    hand: ["Capsule Hotels"],
    script: { playedCard: "Capsule Hotels", actions: [], areaRun: [] },
    expected: { mat: { Japan: { hotel: 3 } } }
  },
  {
    name: "Cruise Ships - Hotels per boat",
    initialState: { mat: { Japan: { boat: 1 } }, money: 0 },
    hand: ["Cruise Ships"],
    script: { playedCard: "Cruise Ships", actions: [], areaRun: [] },
    expected: { mat: { Japan: { hotel: 2 } } }
  },
  {
    name: "Hotel California - Hotels if rich",
    initialState: { mat: {}, money: 5 },
    hand: ["Hotel California"],
    script: { playedCard: "Hotel California", actions: [], areaRun: [] },
    expected: { mat: { California: { hotel: 3 } } }
  },
  {
    name: "Machu Picchu - Hotels on Peru",
    initialState: { mat: { Peru: { fish: 2 } }, money: 0 },
    hand: ["Machu Picchu"],
    script: { playedCard: "Machu Picchu", actions: [], areaRun: [] },
    expected: { mat: { Peru: { hotel: 3, fish: 2 } } }
  },
  {
    name: "Spas - Hotels on Peru if rich",
    initialState: { mat: {}, money: 5 },
    hand: ["Spas"],
    script: { playedCard: "Spas", actions: [], areaRun: [] },
    expected: { mat: { Peru: { hotel: 3 } } }
  },
  {
    name: "Theme Park - Hotels on California",
    initialState: { mat: { Japan: { fish: 2 } }, money: 0 },
    hand: ["Theme Park"],
    script: { playedCard: "Theme Park", actions: [], areaRun: [] },
    expected: { mat: { California: { hotel: 3 } } }
  },
  {
    name: "Dugongs - Coral Sea fish",
    initialState: { mat: {}, money: 0 },
    hand: ["Dugongs"],
    script: { playedCard: "Dugongs", actions: [], areaRun: [] },
    expected: { mat: { Japan: { fish: 3 } } }
  },
  {
    name: "Robot Fish - Fish per factory",
    initialState: { mat: { Japan: { factory: 2 } }, money: 0 },
    hand: ["Robot Fish"],
    script: { playedCard: "Robot Fish", actions: [], areaRun: [] },
    expected: { mat: { Japan: { fish: 2 } } }
  },
  {
    name: "Sea Otters - California fish",
    initialState: { mat: {}, money: 0 },
    hand: ["Sea Otters"],
    script: { playedCard: "Sea Otters", actions: [], areaRun: [] },
    expected: { mat: { California: { fish: 3 } } }
  },
  {
    name: "Sea Turtles - Peru fish",
    initialState: { mat: {}, money: 0 },
    hand: ["Sea Turtles"],
    script: { playedCard: "Sea Turtles", actions: [], areaRun: [] },
    expected: { mat: { Peru: { fish: 3 } } }
  },
  {
    name: "Fishing - Boat placement and income",
    initialState: { mat: { Japan: { boat: 1 } }, money: 0 },
    hand: ["Fishing"],
    script: { playedCard: "Fishing", actions: ["California"], areaRun: [] },
    expected: { mat: { California: { boat: 1 }, Japan: { boat: 1 } }, money: 8 }
  },
  {
    name: "Sharks - Placement and fish removal",
    initialState: { mat: { Japan: { fish: 3 } }, money: 0 },
    hand: ["Sharks"],
    script: { playedCard: "Sharks", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { California: { fish: 3 }, Polynesia: { fish: 3 }, Japan: { fish: 0 } } }
  },
  {
    name: "Computer Chip Factory - Factory and money",
    initialState: { mat: {}, money: 0 },
    hand: ["Computer Chip Factory"],
    script: { playedCard: "Computer Chip Factory", actions: [], areaRun: [] },
    expected: { mat: { California: { factory: 1 } }, money: 5 }
  },
  {
    name: "Liquidate - Removal for money",
    initialState: { mat: { Japan: { fish: 1 }, California: { boat: 1 } }, money: 0 },
    hand: ["Liquidate"],
    script: { playedCard: "Liquidate", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "California", tokenType: "boat" }, "pass"], areaRun: [] },
    expected: { mat: { Japan: { fish: 0 }, California: { boat: 0 } }, money: 6 }
  },
  {
    name: "Pet Rocks - Factory bonus and loss",
    initialState: { mat: { Japan: { factory: 2, fish: 1 } }, money: 0 },
    hand: ["Pet Rocks"],
    script: { playedCard: "Pet Rocks", actions: [{ areaName: "Japan", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { Japan: { fish: 0, factory: 2 } }, money: 6 }
  },
  {
    name: "Direct Flight - Placement",
    initialState: { mat: {}, money: 0 },
    hand: ["Direct Flight"],
    script: { playedCard: "Direct Flight", actions: [1], areaRun: [] },
    expected: { mat: { directFlight: 1 } }
  },
  {
    name: "Direct Flight - Connection Effect (Business -> Industry)",
    initialState: { mat: { directFlight: 1, Peru: { hotel: 1 }, California: { hotel: 1 } }, money: 0 },
    hand: ["Air Conditioning"],
    script: { playedCard: "Air Conditioning"},
    expected: { money: 4 }
  },
  {
    name: "Bottling Factory - Skip Peru Run",
    initialState: { mat: { Peru: { hotel: 1 } }, money: 0 },
    hand: ["Bottling Factory"],
    script: { playedCard: "Bottling Factory", actions: [], areaRun: [] },
    expected: { mat: { Peru: { factory: 2, hotel: 1 } }, money: 0 }
  },
  {
    name: "Island Resort - Skip Polynesia Run",
    initialState: { mat: { Polynesia: { hotel: 1 } }, money: 0 },
    hand: ["Island Resort"],
    script: { playedCard: "Island Resort", actions: [], areaRun: [] },
    expected: { mat: { Polynesia: { hotel: 4 } }, money: 0 }
  },
  {
    name: "Bottling Factory + DF - Run California Only",
    initialState: { mat: { directFlight: 1, California: { hotel: 1 }, Peru: { hotel: 1 } }, money: 0 },
    hand: ["Bottling Factory"],
    script: { playedCard: "Bottling Factory", actions: [], areaRun: [] },
    expected: { mat: { Peru: { factory: 2 } }, money: 1 }
  },
  {
    name: "Port - Placement",
    initialState: { mat: {}, money: 0 },
    hand: ["Port"],
    script: { playedCard: "Port", actions: ["Japan"], areaRun: [] },
    expected: { mat: { Japan: { boat: 1, port: 1 } } }
  },
  {
    name: "Port - Multiple Ports in one area",
    initialState: { mat: { Japan: { port: 2, hotel: 1 }, California: { hotel: 2 } }, money: 0 },
    hand: ["Glass-Bottom Boats"], 
    script: { playedCard: "Glass-Bottom Boats", actions: [], areaRun: [{ areaName: "California", tokenType: "hotel" }, { areaName: "California", tokenType: "hotel" }] },
    expected: { mat: { Japan: { port: 2, hotel: 3 }, California: { hotel: 0 } } }
  },
  {
    name: "Port - Move chit during run",
    initialState: { mat: { Japan: { port: 1 }, California: { hotel: 1 } }, money: 0 },
    hand: ["Disperse"], // Transit triggers Japan run
    script: { playedCard: "Disperse", actions: ["Japan", { areaName: "Japan", tokenType: "boat" }, "California"], areaRun: [{ areaName: "California", tokenType: "hotel" }] },
    expected: { mat: { Japan: { port: 1, hotel: 1 }, California: { boat: 1, hotel: 0 } } }
  },
  {
    name: "Balloon Trip - Placement and initial move",
    initialState: { mat: {}, money: 0 },
    hand: ["Balloon Trip"],
    script: { playedCard: "Balloon Trip", areaRun: [] },
    expected: { mat: { Peru: { balloon: 1 }, California: { balloon: 0 } } }
  },
  {
    name: "Balloon Trip - Move to California and gain $15",
    initialState: { mat: { Japan: { balloon: 1 } }, money: 0 },
    hand: ["Disperse"], // Transit triggers Japan run
    script: { playedCard: "Disperse", actions: ["Japan", { areaName: "Japan", tokenType: "boat" }, "CoralSea"], areaRun: [] },
    expected: { mat: { California: { balloon: 1 }, Japan: { balloon: 0 } }, money: 15 }
  },
  {
    name: "Disperse - Placement and Move",
    initialState: { mat: {}, money: 0 },
    hand: ["Disperse"],
    script: { playedCard: "Disperse", actions: ["Japan", { areaName: "Japan", tokenType: "boat" }, "California"], areaRun: [] },
    expected: { mat: { Japan: { boat: 0 }, California: { boat: 1 } } }
  },
  {
    name: "Widget Factory - Factory and money bonus",
    initialState: { mat: { Japan: { factory: 1 } }, money: 0 },
    hand: ["Widget Factory"],
    script: { playedCard: "Widget Factory", actions: ["Japan"], areaRun: [] },
    expected: { mat: { Japan: { factory: 2 } }, money: 2 }
  },
  {
    name: "Car Factory - Placement and Loss",
    initialState: { mat: { Japan: { fish: 1 } }, money: 0 },
    hand: ["Car Factory"],
    script: { playedCard: "Car Factory", actions: [{ areaName: "Japan", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { Japan: { factory: 2, fish: 0 } } }
  },
  {
    name: "Industrial Hotels - Batch Replacement",
    initialState: { mat: { Japan: { factory: 2 } }, money: 0 },
    hand: ["Industrial Hotels"],
    script: { playedCard: "Industrial Hotels", actions: [{ areaName: "Japan", tokenType: "factory" }, { areaName: "Japan", tokenType: "factory" }], areaRun: [] },
    expected: { mat: { Japan: { factory: 0, hotel: 4 } } }
  },
  {
    name: "Seafood Chain - Selective Replacement",
    initialState: { mat: { Japan: { fish: 2 } }, money: 0 },
    hand: ["Seafood Chain"],
    script: { playedCard: "Seafood Chain", actions: [{ areaName: "Japan", tokenType: "fish" }, "pass"], areaRun: [] },
    expected: { mat: { Japan: { fish: 1, hotel: 1 } } }
  },
  {
    name: "Underwater Hotel - Hotels and specific loss",
    initialState: { mat: { CoralSea: { fish: 1 } }, money: 0 },
    hand: ["Underwater Hotel"],
    script: { playedCard: "Underwater Hotel", actions: [{ areaName: "CoralSea", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { CoralSea: { hotel: 3, fish: 0 } } }
  },
  {
    name: "Tokyo Branch - Copy Hotels from another area",
    initialState: { mat: { California: { hotel: 2 } }, money: 0 },
    hand: ["Tokyo Branch"],
    script: { playedCard: "Tokyo Branch", actions: ["California"], areaRun: [] },
    expected: { mat: { Japan: { hotel: 2 } } }
  },
  {
    name: "Blue Whales - Hotels and empty area fish",
    initialState: { mat: { Japan: {} } },
    hand: ["Blue Whales"],
    script: { playedCard: "Blue Whales", actions: ["Japan"], areaRun: [] },
    expected: { mat: { California: { hotel: 2 }, Japan: { fish: 2 } } }
  },
  {
    name: "Breeding Program - Global fish growth and static movement",
    initialState: { mat: { Japan: { fish: 1 } }, money: 0 },
    hand: ["Breeding Program"],
    script: { playedCard: "Breeding Program", areaRun: [] },
    expected: { mat: { Japan: { fish: 2 }, California: { fish: 1 }, Peru: { fish: 1 }, Polynesia: { fish: 1 }, CoralSea: { fish: 1 } } }
  },
  {
    name: "Cloning Program - Fish per other area",
    initialState: { mat: { Japan: { fish: 3 } }, money: 0 },
    hand: ["Cloning Program"],
    script: { playedCard: "Cloning Program", actions: ["Japan"], areaRun: [] },
    expected: { mat: { California: { fish: 3 } } }
  },
  {
    name: "Hatchery - Automatic generation during run",
    initialState: { mat: { CoralSea: { hatchery: 1 }}, money: 0 },
    hand: ["Dugongs"],
    script: { playedCard: "Dugongs", actions: [], areaRun: [] },
    expected: { mat: { CoralSea: { hatchery: 1, fish: 0 }, Japan: { fish: 5 } } }
  },
  {
    name: "Hatchery - First run after creation",
    initialState: { mat: {}, money: 0 },
    hand: ["Hatchery"],
    script: { playedCard: "Hatchery", actions: ["CoralSea"], areaRun: [] },
    expected: { mat: { CoralSea: { hatchery: 1, fish: 0 }, Japan: { fish: 2 } } }
  },
  {
    name: "Floating Hotel - Unique bonus",
    initialState: { mat: {}, money: 0 },
    hand: ["Floating Hotel"],
    script: { playedCard: "Floating Hotel", actions: [] },
    expected: { mat: { CoralSea: { hotel: 2 } }, money: 5 }
  },
  {
    name: "Plastics Factories - Placement and Loss",
    initialState: { mat: { Japan: { fish: 2 } }, money: 0 },
    hand: ["Plastics Factories"],
    script: { playedCard: "Plastics Factories", actions: [], areaRun: [] },
    expected: { mat: { California: { factory: 2 }, Japan: { fish: 0 } } }
  },
  {
    name: "Beach Hotels - Placement and Loss",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Beach Hotels"],
    script: { playedCard: "Beach Hotels", actions: [{ areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { Japan: { hotel: 3 }, CoralSea: { fish: 1 } } }
  },
  {
    name: "Plastics Factories - No fish",
    initialState: { mat: { Japan: { fish: 0 } }, money: 0 },
    hand: ["Plastics Factories"],
    script: { playedCard: "Plastics Factories", actions: [], areaRun: [] },
    expected: { mat: { California: { factory: 2 }, Japan: { fish: 0 } } }
  },
  {
    name: "Beach Hotels - No fish",
    initialState: { mat: { Peru: { fish: 0 } }, money: 0 },
    hand: ["Beach Hotels"],
    script: { playedCard: "Beach Hotels", actions: [], areaRun: [] },
    expected: { mat: { Japan: { hotel: 3 }, Peru: { fish: 0 } } }
  },
  {
    name: "Beach Hotels - One fish",
    initialState: { mat: { Peru: { fish: 1 } }, money: 0 },
    hand: ["Beach Hotels"],
    script: { playedCard: "Beach Hotels", actions: [], areaRun: [] },
    expected: { mat: { Japan: { hotel: 3 }, Peru: { fish: 0 } } }
  },
  {
    name: "Plastics Factories - One fish",
    initialState: { mat: { Japan: { fish: 1 } }, money: 0 },
    hand: ["Plastics Factories"],
    script: { playedCard: "Plastics Factories", actions: [], areaRun: [] },
    expected: { mat: { California: { factory: 2 }, Japan: { fish: 0 } } }
  },
  {
    name: "Humboldt Penguins - Peru fish and hotel copy",
    initialState: { mat: { California: { hotel: 1 } }, money: 0 },
    hand: ["Humboldt Penguins"],
    script: { playedCard: "Humboldt Penguins", actions: ["California"], areaRun: [] },
    expected: { mat: { Peru: { fish: 2 }, California: { hotel: 3 } } }
  },
  {
    name: "Manta Rays - Coral Sea hotel and fish copy",
    initialState: { mat: { Japan: { fish: 1 } }, money: 0 },
    hand: ["Manta Rays"],
    script: { playedCard: "Manta Rays", actions: ["Japan"], areaRun: [] },
    expected: { mat: { CoralSea: { hotel: 2 }, Japan: { fish: 3 } } }
  },
  {
    name: "Moray Eels - Polynesia fish and empty area hotels",
    initialState: { mat: { Japan: {} }, money: 0 },
    hand: ["Moray Eels"],
    script: { playedCard: "Moray Eels", actions: ["Japan"], areaRun: [] },
    expected: { mat: { Japan: { fish: 2, hotel: 2 } } } //Polynesia fish move to Japan
  },
  {
    name: "Oversee - Run 2 areas manually out of order",
    initialState: { mat: { Peru: { hotel: 1 }, Japan: { hotel: 1 } }, money: 0 },
    hand: ["Oversee"],
    script: { playedCard: "Oversee", actions: ["Peru", "Japan"], areaRun: [] },
    expected: { money: 2 }
  },
  {
    name: "Dolphin Spy Network - Setup verification",
    initialState: { mat: {}, money: 0 },
    hand: ["Dolphin Spy Network"],
    script: { playedCard: "Dolphin Spy Network", actions: [], areaRun: [] },
    expected: { mat: { California: { fish: 2 } } } //fish move to Cali. This is failing and I don't know why.
  },
  {
    name: "Upgrade - Verify hotel placement synergy",
    initialState: { mat: { Peru: {} }, money: 0, nextTurnCards: [{ name: "Upgrade" }] },
    hand: ["Sea Turtles"],
    script: { playedCard: "Sea Turtles", actions: [], areaRun: [] },
    expected: { mat: { Peru: { fish: 3, hotel: 3 } } }
  },
  {
    name: "Headquarters - Verify doubling of first chit of each type",
    initialState: { mat: { CoralSea: { hq: 1 } }, money: 0 },
    hand: ["Dugongs"],
    script: { playedCard: "Dugongs", actions: [], areaRun: [] },
    expected: { mat: { CoralSea: { hq: 1, fish: 0 }, Japan: { fish: 4 } } }
  },
  {
    name: "More of the Same - Add one of each token and verify run sequence",
    initialState: { mat: { Japan: { fish: 2, hotel: 1, hatchery: 1 } }, money: 0 },
    hand: ["More of the Same"],
    script: { playedCard: "More of the Same", actions: ["Japan"]},
    expected: { mat: { Japan: { hotel: 2, hatchery: 2, fish: 3 }, California: { fish: 0 } }, money: 0 }
  },
  {
    name: "Overtime - Run only areas with factories",
    initialState: { mat: { Japan: { factory: 1, hotel: 1 }, Peru: { hotel: 1 } }, money: 0 },
    hand: ["Overtime"],
    script: { playedCard: "Overtime", actions: ["Factories", "pass"], areaRun: [] },
    expected: { money: 1 }
  },
  {
    name: "Trade Winds - Skip move during run, then global move",
    initialState: { mat: { Japan: { fish: 2 }, California: { fish: 1 } }, money: 0 },
    hand: ["Trade Winds"],
    script: { playedCard: "Trade Winds", actions: [], areaRun: [] },
    expected: { mat: { Japan: { fish: 0 }, California: { fish: 2 }, Peru: { fish: 1 } } }
  },
  {
    name: "Grand Opening - $2 bonus per chit placed",
    initialState: { nextTurnCards: [{ name: "Grand Opening" }], mat: { Peru: {} }, money: 0 },
    hand: ["Sea Turtles"],
    script: { playedCard: "Sea Turtles", actions: [], areaRun: [] },
    expected: { mat: { Peru: { fish: 3 } }, money: 6 }
  },
  {
    name: "Documentary - $2 bonus per chit moved",
    initialState: { nextTurnCards: [{ name: "Documentary" }], mat: { Japan: { fish: 3 }, Peru: {} }, money: 0 },
    hand: ["Relocate"],
    script: { playedCard: "Relocate", actions: [{ areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, { areaName: "Japan", tokenType: "fish" }, "Peru"], areaRun: [] },
    expected: { mat: { Peru: { boat: 1, fish: 3 }, Japan: { fish: 0 } }, money: 6 }
  },
  {
    name: "Overtime - Port moves factory, skipping target area run",
    initialState: { mat: { Japan: { port: 1, factory: 1 }, California: { factory: 1, fish: 1 } }, money: 0 },
    hand: ["Overtime"],
    script: { playedCard: "Overtime", actions: [{ areaName: "California", tokenType: "factory" }], areaRun: ["Factories", "pass"] },
    expected: { mat: { Japan: { port: 1, factory: 2 }, California: { factory: 0, fish: 1 } }, money: 0 }
  },
  {
    name: "Trade Winds - Port moves fish, skipping target area run",
    initialState: { mat: { Japan: { port: 1, fish: 2 }, California: { hotel: 1, fish: 1 } }, money: 0 },
    hand: ["Trade Winds"],
    script: { playedCard: "Trade Winds", actions: [{ areaName: "California", tokenType: "fish" }], areaRun: [] },
    expected: { mat: { Japan: { port: 1 }, California: { fish: 3 } }, money: 0 }
  },
  {
    name: "Make the Rounds - Run only areas with 1-3",
    initialState: { mat: { Japan: { hotel: 3 }, California: { hotel: 2 }, Polynesia: {hotel: 4} }, money: 0 },
    hand: ["Make the Rounds"],
    script: { playedCard: "Make the Rounds", actions: [], areaRun: [] },
    expected: { money: 5 }
  },
  {
    name: "Make the Rounds - California and peru become eligible",
    initialState: { mat: { Japan: { hotel: 1, fish: 2 }, California: { hotel: 0, fish: 0 }, Polynesia: {hotel: 4} }, money: 0 },
    hand: ["Make the Rounds"],
    script: { playedCard: "Make the Rounds", actions: [], areaRun: ["Hotels"] },
    expected: { mat: { Japan: { hotel: 1 }, California: { hotel: 0, fish: 0 }, Polynesia: { fish: 2 } }, money: 1 }
  },
  {
    name: "Grand Opening - Multi-turn Verification",
    initialState: { mat: { Peru: {} }, money: 0 },
    hand: ["Grand Opening", "Sea Turtles"],
    script: { actions: [], areaRun: [] },
    expected: { money: 6, mat: { Peru: { fish: 3 } }, nextTurnCards: 0 }
  },
  {
    name: "Documentary - Relocate",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Documentary", "Relocate"],
    script: { 
      actions: [{ areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, "California"],
      areaRun: []
    },
    expected: { 
      money: 6, 
      mat: { Peru: { boat: 1, fish: 0 }, California: { fish: 3 } },
      nextTurnCards: 0 
    }
  },
  {
    name: "Upgrade - Multi-turn Verification",
    initialState: { mat: { Peru: {} }, money: 0 },
    hand: ["Upgrade", "Sea Turtles"],
    script: { actions: [], areaRun: [] },
    expected: { mat: { Peru: { fish: 3, hotel: 3 } }, nextTurnCards: 0 }
  },
  {
    name: "Documentary + Factory Removal",
    initialState: { mat: { Peru: { factory: 1, fish: 3 } }, money: 0 },
    hand: ["Documentary", "Overtime"],
    script: { 
      actions: [], // Overtime has no card-body interaction
      areaRun: ["Factories", { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }] 
    },
    expected: { 
      money: 12, // $6 from factories + $6 from Documentary
      mat: { Peru: { factory: 1, fish: 0 } },
      nextTurnCards: 0 
    }
  },
  {
    name: "Documentary + Fish Movement (Normal Run)",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Documentary", "Oversee"], 
    script: { 
      actions: ["Peru", "Japan"], 
      areaRun: [] // Oversee runs Peru. Only Fish present -> auto-runs.
    },
    expected: { 
      money: 6, // 3 fish * $2
      mat: { Peru: { fish: 0 }, Polynesia: { fish: 3 } },
      nextTurnCards: 0 
    }
  },
  {
    name: "Documentary + Trade Winds (Global Move)",
    initialState: { mat: { Peru: { fish: 2 }, Polynesia: { fish: 1 } }, money: 0 },
    hand: ["Documentary", "Trade Winds"],
    script: { actions: [], areaRun: [] },
    expected: { 
      money: 6, // 3 fish * $2
      mat: { Peru: { fish: 0 }, Polynesia: { fish: 2 }, CoralSea: { fish: 1 } },
      nextTurnCards: 0
    }
  },
  {
    name: "Documentary + Pet Rocks (Remove)",
    initialState: { mat: { Peru: { factory: 1, fish: 1 } }, money: 0 },
    hand: ["Documentary", "Pet Rocks"],
    script: { 
      actions: [{ areaName: "Peru", tokenType: "fish" }], 
      areaRun: [] // Pet Rocks is Industry, runs Peru. No runnable elements after fish removal.
    },
    expected: { 
      money: 5, // $3 from factory bonus + $2 from Documentary
      mat: { Peru: { factory: 1, fish: 0 } },
      nextTurnCards: 0
    }
  },
  {
    name: "Documentary + Seagulls (Move Fish)",
    initialState: { mat: { Peru: { fish: 3 } }, money: 0 },
    hand: ["Documentary", "Seagulls"],
    script: { 
      actions: [{ areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, { areaName: "Peru", tokenType: "fish" }, "pass"], 
      areaRun: [] // Seagulls is Nature, runs Coral Sea (empty) and Japan (empty).
    },
    expected: { 
      money: 6, // 3 fish * $2
      mat: { California: { boat: 1, fish: 4 }, Peru: { fish: 0 } },
      nextTurnCards: 0
    }
  },
  {
    name: "Documentary + Port (Move during Run)",
    initialState: { mat: { Japan: { port: 1 }, Peru: { fish: 1 } }, money: 0 },
    hand: ["Documentary", "Glass-Bottom Boats"], 
    script: { 
      actions: [], 
      areaRun: ["pass",{ areaName: "Peru", tokenType: "boat" }] // Choice for the Port on Japan
    },
    expected: { 
      money: 2, 
      mat: { Japan: { port: 1, boat: 1}, Peru: {fish: 1} },
      nextTurnCards: 0
    }
  },
  {
    name: "Make the Rounds - Multi-turn extra card",
    initialState: { mat: { Japan: { hotel: 1 } }, money: 0 },
    hand: ["Make the Rounds", "Air Conditioning"],
    secondCards: [null, "Balloon Trip"],
    script: { actions: [], areaRun: [] },
    expected: { 
      mat: { Japan: { hotel: 1 }, California: { balloon: 0 }, Peru: { balloon: 1 } },
      nextTurnCards: 0,
      money: 2
    }
  },
  {
    name: "Make the Rounds - Migration + GBB",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Japan: { fish: 2, hotel: 1 }, Polynesia: { boat: 1 } } 
    },
    hand: ["Migration"],
    secondCards: ["Glass-Bottom Boats"],
    script: { actions: ["Migration", "Polynesia", "Japan"], areaRun: [] }, 
    expected: { mat: { Japan: { fish: 0, hotel: 1 }, Polynesia: { boat: 3, fish: 2 } }, money: 1 }
  },
  {
    name: "Make the Rounds - Documentary + Grand Opening -> Sharks",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: {} 
    },
    hand: ["Documentary", "Sharks"],
    secondCards: ["Grand Opening"],
    script: { 
      actions: ["Documentary", { areaName: "California", tokenType: "fish" }, { areaName: "California", tokenType: "fish" }, { areaName: "California", tokenType: "fish" }], // Documentary first, then Grand Opening, then Sharks' removals
      areaRun: [] 
    },
    expected: { money: 18, mat: { California: { fish: 0 }, Polynesia: { fish: 3 } }, nextTurnCards: 0 }
  },
  {
    name: "Make the Rounds - Bottling Factory + Dairy Farms",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { } 
    },
    hand: ["Bottling Factory"], 
    secondCards: ["Dairy Farms"], 
    script: { actions: ["Bottling Factory"], areaRun: [] }, 
    expected: { mat: { Peru: { factory: 2}, California: { factory: 1 } }, money: 0, nextTurnCards: 0 }
  },
  {
    name: "Make the Rounds - Bottling Factory + Crunch Time (Persist Skip)",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Peru: { factory: 1, hotel: 1 } } 
    },
    hand: ["Bottling Factory"], 
    secondCards: ["Crunch Time"], 
    script: { actions: ["Bottling Factory", "Peru"], areaRun: [] },
    expected: { mat: { Peru: { factory: 6, hotel: 1 } }, money: 0, nextTurnCards: 0 }
  },
  {
    name: "Make the Rounds - Documentary + Industrial Hotels",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Japan: { fish: 1 }, California: { hotel: 1 }, Peru: { hotel: 1, factory: 1 }, Polynesia: { hotel: 1 } } 
    },
    hand: ["Documentary"], // Play Documentary first
    secondCards: ["Industrial Hotels"], 
    script: { actions: ["Documentary", { areaName: "Peru", tokenType: "factory" }], areaRun: ["Fish", "Fish", "Fish"] }, 
    expected: { 
      mat: { Japan: { fish: 0 }, California: { hotel: 1, fish: 0 }, Peru: { hotel: 3, factory: 0, fish: 0 }, Polynesia: { hotel: 1 }, CoralSea: { fish: 1 } },
      money: 5,
      nextTurnCards: 1
    }
  },
  {
    name: "Make the Rounds - Breeding Program + Documentary",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Japan: { fish: 1 } } 
    },
    hand: ["Breeding Program"], // Play Breeding Program first
    secondCards: ["Documentary"], // Documentary is the second card for Turn 1
    script: { actions: ["Breeding Program"], areaRun: [] },
    expected: { mat: { Japan: { fish: 2 }, California: { fish: 1 }, Peru: { fish: 1 }, Polynesia: { fish: 1 }, CoralSea: { fish: 1 } } }
  },
  {
    name: "Make the Rounds - Interactive Sequence (Relocate + Fishing)",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Japan: { fish: 3 }, California: {} } 
    },
    hand: ["Relocate"],
    secondCards: ["Fishing"],
    script: { 
      actions: [
        "Relocate",
        { areaName: "Japan", tokenType: "fish" }, 
        { areaName: "Japan", tokenType: "fish" }, 
        { areaName: "Japan", tokenType: "fish" }, 
        "California", 
        "Peru"
      ], 
      areaRun: [] 
    },
    expected: { 
      mat: { Japan: { fish: 0 }, California: { }, Peru: { boat: 2, fish: 3  } }, 
      money: 8,
      nextTurnCards: 0
    }
  },
  {
    name: "Grand Opening Clearance - Skipped Run via Bottling Factory",
    initialState: { 
      nextTurnCards: [{ name: "Grand Opening" }], 
      mat: { Peru: { hotel: 1 } },
      money: 0
    },
    hand: ["Bottling Factory"],
    script: { 
      actions: [
      ], 
      areaRun: [] 
    },
    expected: { 
      mat: { Peru: { factory: 2, hotel: 1 } }, 
      money: 4, // $4 from Grand Opening (2 factories placed)
      nextTurnCards: 0
    }
  },
  {
    name: "MtR: Oversee + Air Conditioning",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { California: { hotel: 1 }, Polynesia: { fish: 1 }, CoralSea: {hotel: 1} },
      money: 0 
    },
    hand: ["Oversee"],
    secondCards: ["Air Conditioning"],
    script: { 
      actions: ["Oversee","Polynesia", "California"], 
      areaRun: [] 
    },
    expected: { 
      mat: { Polynesia: { fish: 0 }, CoralSea: { fish: 1 } },
      money: 3 // $1 (Oversee: Cali) + $2 (AC Execution)
    }
  },
  {
    name: "MtR: Trade Winds + Overtime",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { 
        Japan: { fish: 2, factory: 1, boat: 1 },
        California: { fish: 2, factory: 1, boat: 1 },
        Peru: { fish: 2, factory: 1, boat: 1 },
        Polynesia: { fish: 2, factory: 1, boat: 1 },
        CoralSea: { fish: 2, factory: 1, boat: 1 }
      },
      money: 0 
    },
    hand: ["Trade Winds"],
    secondCards: ["Overtime"],
    script: { 
      actions: ["Trade Winds"],
      areaRun: ["Factories", "pass", "Factories", "pass", "Factories", "pass", "Factories", "pass", "Factories", "pass"]
    },
    expected: { 
      money: 10, // 5 deduplicated areas * $2 per run
      mat: { Japan: { fish: 2 }, California: { fish: 2 }, Peru: { fish: 2 }, Polynesia: { fish: 2 }, CoralSea: { fish: 2 } } 
    }
  },
  {
    name: "MtR: Oversee + Trade Winds",
    initialState: { 
      nextTurnCards: [{ name: "Make the Rounds" }], 
      mat: { Japan: { fish: 2 } },
      money: 0 
    },
    hand: ["Oversee"],
    secondCards: ["Trade Winds"],
    script: { 
      actions: ["Oversee", "Japan", "California"],
      areaRun: [] 
    },
    expected: { 
      mat: { Peru: { fish: 0 }, Polynesia: { fish: 2 } } // J->C->P (Oversee), then P->Poly (TW)
    }
  }
];

export async function runTest(test, onStatus) {
  const lobbyId = `TEST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const nick = "TestAI";
  onStatus(`Creating lobby ${lobbyId}...`);

  // Deep clone the script to ensure it's fresh for each test run
  const scriptCopy = JSON.parse(JSON.stringify(test.script));

  const fullMat = { ...(test.initialState.mat || {}) };
  areas.forEach(a => fullMat[a] = { fish: 0, boat: 0, hotel: 0, factory: 0, ...(test.initialState.mat?.[a] || {}) });

  let filteredCards = cardsData.filter(c => !test.hand.includes(c.name));

  if (test.secondCards) {
    test.secondCards.forEach((name, turnIdx) => {
      if (!name) return;
      const cardIdx = filteredCards.findIndex(c => c.name === name);
      if (cardIdx !== -1) {
        const [card] = filteredCards.splice(cardIdx, 1);
        const targetPos = turnIdx * 2;
        filteredCards.splice(targetPos, 0, card);
      }
    });
  }

  const deck = filteredCards.map((c, i) => ({ ...c, instanceId: `deck-${i}-${lobbyId}` }));

  await setDoc(doc(db, "lobbies", lobbyId), {
    status: 'in-progress', phase: 'hand-selection', turn: 1, hostId: nick, playedCards: [], logs: ["Test Started"],
    deck
  });

  const hand = test.hand.map(name => ({ ...cardsData.find(c => c.name === name), instanceId: `id-${name}` }));
  await setDoc(doc(db, `lobbies/${lobbyId}/players`, nick), {
    name: nick,
    color: 'red',
    money: test.initialState.money || 0,
    hand,
    mat: fullMat,
    interaction: null,
    confirmedPlay: false,
    nextTurnCards: test.initialState.nextTurnCards || [],
    bonusCounter: test.initialState.bonusCounter || {},
        setAside: test.initialState.setAside || []
  });

  // Track logical steps already performed to prevent re-entrancy from duplicate snapshots
  const processedSteps = new Set();
  let isProcessing = false;
  let needsCheck = true;
  let stopTest = false;
  let interactionCounter = 0;

  return new Promise((resolve) => {
    let unsub = null;

    // Watchdog timer to prevent infinite hangs
    const timeout = setTimeout(async () => {
      if (unsub) unsub();
      stopTest = true;
      const playerSnap = await getDoc(doc(db, `lobbies/${lobbyId}/players`, nick));
      const player = playerSnap.data();
      onStatus(`[${lobbyId}] Test "${test.name}" timed out. Logs: ${player?.turnLogs?.join(' | ')}`);
      resolve({ name: `[${lobbyId}] ${test.name}`, pass: false, error: "Timeout", lobbyId, logs: player?.turnLogs });
    }, 30000);

    const runLoop = async () => {
      if (isProcessing || stopTest) return;
      isProcessing = true;

      try {
        while (needsCheck && !stopTest) {
          needsCheck = false;

          const lobbySnap = await getDoc(doc(db, "lobbies", lobbyId));
          const lobby = lobbySnap.data();
          if (!lobby) break;

          const playerSnap = await getDoc(doc(db, `lobbies/${lobbyId}/players`, nick));
          const player = playerSnap.data();
          player.id = nick;

          const stepHandSelection = `hand-selection-${lobby.turn}`;
          const stepTableSelection = `table-selection-${lobby.turn}`;
          const stepRotation = `rotation-${lobby.turn}`;

          const scriptExhausted = (!scriptCopy.actions || scriptCopy.actions.length === 0) && (!scriptCopy.areaRun || scriptCopy.areaRun.length === 0);

          // If we have completed all turns in the script and performed the final rotation, verify results.
          if (lobby.turn > test.hand.length && scriptExhausted) {
            onStatus(`[${lobbyId}] All turns complete. Verifying final results...`);
            clearTimeout(timeout); if (unsub) unsub(); stopTest = true;
            const result = verify(player, test.expected);
            onStatus(`[${lobbyId}] ${result.pass ? "PASSED" : "FAILED"}: ${test.name}`);
            resolve({ name: `[${lobbyId}] ${test.name}`, pass: result.pass, error: result.error, lobbyId, actual: { mat: player.mat, money: player.money } });
            return;
          }

          if (lobby.phase === 'hand-selection' && !player.confirmedPlay && !processedSteps.has(stepHandSelection) && player.hand?.length > 0) {
            processedSteps.add(stepHandSelection);
            onStatus(`[${lobbyId}] Selecting card from hand...`);
            const card = player.hand[0];
            const newPlayedCards = [card];
            let currentDeck = [...(lobby.deck || [])];
            if (currentDeck.length >= 2) {
              newPlayedCards.push(...currentDeck.slice(0, 2));
              currentDeck = currentDeck.slice(2);
            }

            await updateDoc(doc(db, `lobbies/${lobbyId}/players`, nick), {
              selectedCardId: card.instanceId, confirmedPlay: true,
              hand: arrayRemove(card)
            });

            await updateDoc(doc(db, "lobbies", lobbyId), { 
              phase: 'table-selection', 
              playedCards: newPlayedCards, 
              deck: currentDeck, 
              logs: arrayUnion(`${nick} played ${card.name}`) 
            });
            needsCheck = true;
          } 
          
          else if (lobby.phase === 'table-selection' && !player.confirmedPlayedCard && !processedSteps.has(stepTableSelection)) {
            processedSteps.add(stepTableSelection);
            onStatus(`[${lobbyId}] AI: Selecting card from table...`);
            
            const hasMTR = player.nextTurnCards?.some(c => c.name === 'Make the Rounds');
            const card1 = lobby.playedCards.find(c => c.name === test.hand[lobby.turn - 1]);

            if (!card1) {
              onStatus(`[${lobbyId}] FAILED: AI played card "${test.hand[lobby.turn - 1]}" not found on table`);
              if (unsub) unsub();
              stopTest = true;
              resolve({ name: test.name, pass: false, error: `AI played card "${test.hand[lobby.turn - 1]}" not found`, lobbyId });
              return;
            }

            const update = { selectedPlayedCardId: card1.instanceId };
            let card2 = null;

            if (hasMTR) {
              // Find a second card on the table
              const targetName = test.secondCards?.[lobby.turn - 1];
              if (targetName) {
                card2 = lobby.playedCards.find(c => c.name === targetName && c.instanceId !== card1.instanceId);
              }
              // Fallback to finding any card that isn't the primary choice or MtR
              if (!card2) card2 = lobby.playedCards.find(c => c.instanceId !== card1.instanceId && c.name !== 'Make the Rounds');
              if (card2) update.secondPlayedCardId = card2.instanceId;
            }

            update.confirmedPlayedCard = true;
            await updateDoc(doc(db, `lobbies/${lobbyId}/players`, nick), update);

            if (card1 && card2) {
              player.interaction = {
                type: 'mtr-choose-first',
                card1, card2,
                instruction: `Make the Rounds: Choose which card to resolve first.`
              };
            } else if (card1) {
              player.turnLogs = executeCard(card1, { isUnique: true }, player);
              if (!player.interaction) initiateRunAreas(player, card1);
            }

            if (!player.interaction) await finalizeTurnLog(lobbyId, player);
            
            const finalPlayerState = {
              mat: player.mat,
              money: player.money,
              interaction: player.interaction || null,
              turnLogs: player.turnLogs || [],
              setAside: player.setAside || [],
              nextTurnCards: player.nextTurnCards || [],
              bonusCounter: player.bonusCounter || {}
            };

            await updateDoc(doc(db, `lobbies/${lobbyId}/players`, nick), finalPlayerState);
            await updateDoc(doc(db, "lobbies", lobbyId), { phase: 'execution', lastInteractionAt: Date.now() });
            needsCheck = true;
          } 
          
          else if (lobby.phase === 'execution') {
            const interactionKey = player.interaction ? `${lobby.turn}-${player.interaction.type}-${interactionCounter}-${JSON.stringify(player.interaction)}` : null;
            const scriptExhausted = (!scriptCopy.actions || scriptCopy.actions.length === 0) && (!scriptCopy.areaRun || scriptCopy.areaRun.length === 0);

            if (player.interaction && !processedSteps.has(interactionKey)) {


              let choice;
              if (scriptCopy.actions && scriptCopy.actions.length > 0) {
                choice = scriptCopy.actions.shift();
              } else if (scriptCopy.areaRun && scriptCopy.areaRun.length > 0) {
                choice = scriptCopy.areaRun.shift();
              } else if (player.interaction.type === 'mtr-choose-first') {
                choice = player.interaction.card1.instanceId; // Default to first card if script is empty
              } else if (player.interaction.canPass) {
                choice = "pass";
              } else {
                onStatus(`[${lobbyId}] FAILED: Missing script for ${player.interaction.type}`);
                if (unsub) unsub(); stopTest = true;
                resolve({ name: `[${lobbyId}] ${test.name}`, pass: false, error: `Missing script for ${player.interaction.type}`, lobbyId });
                return;
              }

              // Map card name to instance ID for execution order interactions
              if (player.interaction.type === 'mtr-choose-first' && typeof choice === 'string') {
                if (choice === player.interaction.card1.name) choice = player.interaction.card1.instanceId;
                else if (choice === player.interaction.card2.name) choice = player.interaction.card2.instanceId;
              }

              processedSteps.add(interactionKey);
              interactionCounter++;
              onStatus(`[${lobbyId}] Resolving interaction with: ${JSON.stringify(choice)}`);
              await resolvePlayerInteraction(lobbyId, player, choice);
              needsCheck = true;
            }
            else if (!player.interaction && !processedSteps.has(stepRotation)) {
              // Card execution finished. Advance the turn (even if hand is empty) to trigger cleanup/rotation.
              processedSteps.add(stepRotation);
              onStatus(`[${lobbyId}] Turn ${lobby.turn} complete. Advancing to Turn ${lobby.turn + 1}...`);
              const freshSnap = await getDoc(doc(db, `lobbies/${lobbyId}/players`, nick));
              const freshPlayer = { id: nick, ...freshSnap.data() };
              await processTurnEnd(lobbyId, lobby.turn, [freshPlayer]);
              needsCheck = true;
            }
            else if (!player.interaction && processedSteps.has(stepRotation) && !scriptExhausted) {
                onStatus(`[${lobbyId}] FAILED: Execution finished but script actions remain.`);
                clearTimeout(timeout); if (unsub) unsub(); stopTest = true;
                resolve({ name: `[${lobbyId}] ${test.name}`, pass: false, error: "Script not exhausted", lobbyId });
            }
          }
        }
      } catch (err) {
        console.error(`[${lobbyId}] Test Runner Error:`, err);
      } finally {
        isProcessing = false;
      }
    };

    unsub = onSnapshot(doc(db, "lobbies", lobbyId), () => {
      needsCheck = true;
      runLoop();
    });

    // Initial kick-off
    runLoop();
  });
}

function verify(player, expected) {
  const mismatches = [];

  if (expected.money !== undefined && player.money !== expected.money) {
    mismatches.push(`Money: expected ${expected.money}, got ${player.money}`);
  }

  if (expected.nextTurnCards !== undefined) {
    const actualCount = player.nextTurnCards?.length || 0;
    if (actualCount !== expected.nextTurnCards) {
      mismatches.push(`nextTurnCards: expected ${expected.nextTurnCards}, got ${actualCount}`);
    }
  }

  if (expected.mat) {
    for (const [key, val] of Object.entries(expected.mat)) {
      if (typeof val === 'object' && val !== null) {
        for (const [type, count] of Object.entries(val)) {
          const actualCount = player.mat[key]?.[type] || 0;
          if (actualCount !== count) {
            mismatches.push(`${key} ${type}: expected ${count}, got ${actualCount}`);
          }
        }
      } else {
        if (player.mat[key] !== val) {
          mismatches.push(`${key}: expected ${val}, got ${player.mat[key]}`);
        }
      }
    }
  }

  return {
    pass: mismatches.length === 0,
    error: mismatches.length > 0 ? mismatches.join(' | ') : null
  };
}
