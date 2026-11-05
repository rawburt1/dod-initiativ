/** Texter på svenska och engelska. Svenska är standard. */

export type Lang = "sv" | "en";

const sv = {
  title: "Initiativ",
  loading: "Laddar…",
  noScene: "Öppna en scen för att använda initiativ-trackern.",
  round: (n: number) => `Runda ${n}`,
  notStarted: "Ej startad",
  deckTitle: "Antal initiativkort i leken",
  cards: "Kort",
  fewerCards: "Färre kort",
  moreCards: "Fler kort",
  newRound: "Ny runda",
  deal: "Dra kort",
  next: "Nästa",
  reset: "Nollställ runda och kort",
  tooFewCards: (needed: number, deck: number) =>
    `Deltagarna behöver ${needed} kort men leken har ${deck} – öka antalet kort.`,
  swapTitle: "Byt kort med någon längre ner (en gång per kort och runda)",
  swapLabel: "Byt kort med",
  markDone: "Markera som klar",
  undoDone: "Ångra klar",
  cardLabel: "Initiativkort",
  addSlot: (name: string) => `Ge ${name} ett kort till`,
  removeSlot: "Ta bort det här kortet",
  removeCombatant: "Ta bort ur initiativet",
  allDone: "Alla har agerat. Dra kort för nästa runda.",
  emptyGM: "Högerklicka på en token och välj <b>Lägg till i initiativ</b>.",
  emptyPlayer: "Inga deltagare ännu.",
  unnamed: "Namnlös",
  menuAdd: "Lägg till i initiativ",
  menuRemove: "Ta bort från initiativ",
  menuExtraCard: "Extra initiativkort",
  switchLanguage: "Byt språk till engelska",
};

const en: typeof sv = {
  title: "Initiative",
  loading: "Loading…",
  noScene: "Open a scene to use the initiative tracker.",
  round: (n) => `Round ${n}`,
  notStarted: "Not started",
  deckTitle: "Number of initiative cards in the deck",
  cards: "Cards",
  fewerCards: "Fewer cards",
  moreCards: "More cards",
  newRound: "New round",
  deal: "Draw cards",
  next: "Next",
  reset: "Reset round and cards",
  tooFewCards: (needed, deck) =>
    `The participants need ${needed} cards but the deck has ${deck} – add more cards.`,
  swapTitle: "Swap cards with someone further down (once per card and round)",
  swapLabel: "Swap cards with",
  markDone: "Mark as done",
  undoDone: "Undo done",
  cardLabel: "Initiative card",
  addSlot: (name) => `Give ${name} another card`,
  removeSlot: "Remove this card",
  removeCombatant: "Remove from initiative",
  allDone: "Everyone has acted. Draw cards for the next round.",
  emptyGM: "Right-click a token and choose <b>Add to initiative</b>.",
  emptyPlayer: "No participants yet.",
  unnamed: "Unnamed",
  menuAdd: "Add to initiative",
  menuRemove: "Remove from initiative",
  menuExtraCard: "Extra initiative card",
  switchLanguage: "Switch language to Swedish",
};

const STORAGE_KEY = "se.dod-initiativ/lang";

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "sv" || saved === "en") return saved;
  } catch {
    // Lagring kan vara blockerad – då gäller standardspråket
  }
  return "sv";
}

export let lang: Lang = loadLang();
export let t = lang === "en" ? en : sv;

/** Byter språk för den här spelaren. Valet sparas i webbläsaren. */
export function setLang(next: Lang) {
  lang = next;
  t = next === "en" ? en : sv;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignorera – språket gäller ändå tills sidan laddas om
  }
}

document.documentElement.lang = lang;
