import { ref, reactive, onUnmounted } from 'vue';
import { db } from '@/firebase';
import { doc, setDoc, updateDoc, onSnapshot, collection, getDoc, getDocs, arrayRemove } from 'firebase/firestore';

export function useLobby() {
  const lobbyData = ref(null);
  const lobbyId = ref(null);
  const players = ref([]);
  let unsubscribeLobby = null;
  let unsubscribePlayers = null;
  
  // New: myPlayerId and myNickname to store the current player's info
  const myPlayerId = ref(null); // This will store the UUID
  const myNickname = ref(null); // This will store the nickname

  const createLobby = async (nickname, color, uuid = null) => {
    const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const hostUuid = uuid || crypto.randomUUID(); // Use provided UUID or generate for the host

    const initialData = {
      status: 'waiting',
      turn: 1,
      hostId: hostUuid, // Use UUID as hostId
      createdAt: Date.now()
    };

    await setDoc(doc(db, "lobbies", newId), initialData);
    const result = await joinLobby(newId, nickname, color, hostUuid); // Pass the generated UUID
    return { id: newId, playerId: result.playerId, nickname: result.nickname, color: result.color };
  };

  // Modified: Added uuid parameter with a default generator
  const joinLobby = async (id, nickname, color, uuid = crypto.randomUUID()) => {
    if (!uuid) {
    uuid = crypto.randomUUID();
    }

    if (!nickname || nickname.trim() === "") {
      const natureNames = [
        "Albatross", "Dolphin Spy", "Giant Squid", "Jellyfish",
        "Killer Whale", "Seagull", "Sea Lion", "Octopus",
        "Shark", "Blue Whale", "Humboldt Penguin", "Manta Ray", "Moray Eel",
        "Clone", "Dugong", "Robot Fish", "Sea Otter", "Sea Turtle",
        "Tourist", "Tour Guide", "Archaeologist", "Documentarian", "Fisherman",
        "Whale Watcher", "Pet Rock", "Dairy Farmer", 
      ];
      nickname = "Anonymous " + natureNames[Math.floor(Math.random() * natureNames.length)];
    }

    lobbyId.value = id;
    myPlayerId.value = uuid; // Store the UUID for the current player
    myNickname.value = nickname; // Store the nickname for the current player

    const playerRef = doc(db, `lobbies/${id}/players`, uuid); // Use UUID as document ID
    
    // Ensure unique colors: check existing players in this lobby
    const playersSnap = await getDocs(collection(db, `lobbies/${id}/players`));
    const usedColors = playersSnap.docs
      .filter(d => d.id !== uuid)
      .map(d => d.data().color)
      .filter(c => c && c !== '#f1f5f1'); // White is always allowed as a fallback

    let resolvedColor = color;
    if (usedColors.includes(resolvedColor) && resolvedColor !== '#f1f5f1') {
      resolvedColor = '#f1f5f1'; // Default to white if requested color is taken
    }

    // Check if player already exists (e.g., rejoining)
    const playerDoc = await getDoc(playerRef);
    if (playerDoc.exists()) {
      // Player exists, update their details if necessary
      await updateDoc(playerRef, {
        name: nickname,
        color: resolvedColor,
        // Do not reset hand, mat, money if rejoining
      });
    } else {
      // Check if the game is already in progress
      const lobbySnap = await getDoc(doc(db, "lobbies", id));
      const isSpectator = lobbySnap.exists() && lobbySnap.data().status !== 'waiting';

      if (isSpectator) {
        await setDoc(playerRef, {
          name: nickname,
          color: resolvedColor,
          isSpectator: true
        });
      } else {
        // New player, set initial state
        await setDoc(playerRef, {
          name: nickname,
          color: resolvedColor,
          money: 0, // Initial money should be 0, as per GameView.vue's handleStartGame
          mat: { 
            Japan: { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 }, 
            California: { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 }, 
            Peru: { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 }, 
            Polynesia: { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 }, 
            CoralSea: { fish: 0, hotel: 0, boat: 0, factory: 0, balloon: 0 } 
          },
          hand: [],
          isReady: false,
          selectedCardId: null, // Add these for consistency
          confirmedPlay: false,
          selectedPlayedCardId: null,
          secondPlayedCardId: null,
          confirmedPlayedCard: false,
          interaction: null,
          turnLogs: [],
          nextTurnCards: [], // Initialize nextTurnCards
          setAside: [],      // Initialize setAside
          needsDraw: 0,
          bonusCounter: {}
        });
      }
    }

    // Cancel any previous listeners before creating new ones
    if (unsubscribeLobby) unsubscribeLobby();
    if (unsubscribePlayers) unsubscribePlayers();

    // Start Listening to the lobby document
    unsubscribeLobby = onSnapshot(doc(db, "lobbies", id), (doc) => {
      lobbyData.value = doc.data();
    });

    // Start Listening to all players in the lobby
    unsubscribePlayers = onSnapshot(collection(db, `lobbies/${id}/players`), (snapshot) => {
      players.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    });
    
    return {
      playerId: uuid,
      nickname: nickname,
      color: color
    };
  };

  onUnmounted(() => {
    if (unsubscribeLobby) unsubscribeLobby();
    if (unsubscribePlayers) unsubscribePlayers();
  });

  // Add myPlayerId and myNickname to the returned object
  return { lobbyData, lobbyId, players, createLobby, joinLobby, myPlayerId, myNickname, myId: myPlayerId };
}