import OBR, { Item, Theme, isImage } from "@owlbear-rodeo/sdk";
import { lang, setLang, t } from "./i18n";

const ID = "se.dod-initiativ";
const ITEM_KEY = `${ID}/data`;
const SCENE_KEY = `${ID}/state`;
const DEFAULT_CARDS = 10;

/** Sökväg till en fil i public/, oavsett om tillägget körs från / (dev) eller /dod-initiativ/ (GitHub Pages) */
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`;
const MAX_CARDS = 99;

/** Ett initiativkort som en deltagare har */
interface Slot {
  card: number | null;
  acted: boolean;
  /** Har bytt kort (flyttat ner) den här rundan */
  swapped?: boolean;
}

/** Sparas på varje token som är med i initiativet. En varelse kan ha flera kort. */
interface Combatant {
  slots: Slot[];
}

/** En rad i turordningen: ett av en deltagares kort */
interface Row {
  item: Item;
  index: number;
  slot: Slot;
}

/** Sparas på scenen */
interface TrackerState {
  cardCount: number;
  round: number;
}

const DEFAULT_STATE: TrackerState = { cardCount: DEFAULT_CARDS, round: 0 };
const EMPTY_SLOT: Slot = { card: null, acted: false, swapped: false };

const app = document.querySelector<HTMLDivElement>("#app")!;

let combatants: Item[] = [];
let state: TrackerState = DEFAULT_STATE;
let isGM = false;
let sceneReady = false;
/** Raden där GM håller på att ange antal handlingar (bara lokalt i den här webbläsaren) */
let editing: { id: string; index: number } | null = null;

// ---------- Hjälpfunktioner ----------

/** Läser deltagardata. Äldre data med ett enda kort (`{ card, acted }`) görs om till en lista. */
function data(item: Item): Combatant {
  const raw = item.metadata[ITEM_KEY] as Partial<Combatant> & Partial<Slot>;
  if (Array.isArray(raw?.slots) && raw.slots.length > 0) return { slots: raw.slots };
  return { slots: [{ card: raw?.card ?? null, acted: raw?.acted ?? false, swapped: raw?.swapped ?? false }] };
}

function displayName(item: Item): string {
  if (isImage(item) && item.text.plainText.trim()) return item.text.plainText.trim();
  return item.name || t.unnamed;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function sameRow(a: Row | undefined, b: Row | undefined): boolean {
  return !!a && !!b && a.item.id === b.item.id && a.index === b.index;
}

function totalSlots(): number {
  return combatants.reduce((sum, item) => sum + data(item).slots.length, 0);
}

/** Alla kort i turordning: lägst kort först, kort utan nummer sist */
function sortedRows(): Row[] {
  const rows = combatants.flatMap((item) => data(item).slots.map((slot, index) => ({ item, index, slot })));
  return rows.sort(
    (a, b) =>
      (a.slot.card ?? Infinity) - (b.slot.card ?? Infinity) ||
      displayName(a.item).localeCompare(displayName(b.item), "sv") ||
      a.index - b.index,
  );
}

/** Kort som ännu inte agerat, i turordning */
function waitingRows(): Row[] {
  return sortedRows().filter((row) => row.slot.card !== null && !row.slot.acted);
}

/** Det kort som står på tur: lägsta kortet som inte agerat */
function activeRow(): Row | undefined {
  return waitingRows()[0];
}

/** Det kort som senast markerades klart: högsta kortet bland de som agerat */
function lastActedRow(): Row | undefined {
  return sortedRows()
    .filter((row) => row.slot.card !== null && row.slot.acted)
    .at(-1);
}

function findRow(id: string, index: number): Row | undefined {
  return sortedRows().find((row) => row.item.id === id && row.index === index);
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function saveState(patch: Partial<TrackerState>) {
  state = { ...state, ...patch };
  render();
  await OBR.scene.setMetadata({ [SCENE_KEY]: state });
}

/**
 * Uppdaterar deltagare. `changes` mappar token-id till en funktion som får en kopia av
 * tokenens kort och returnerar de nya korten (eller null för att ta bort tokenen ur initiativet).
 */
async function updateCombatants(changes: Map<string, (slots: Slot[]) => Slot[] | null>) {
  await OBR.scene.items.updateItems(
    (item) => changes.has(item.id),
    (items) => {
      for (const item of items) {
        const slots = changes.get(item.id)!(data(item).slots.map((slot) => ({ ...slot })));
        if (slots === null || slots.length === 0) delete item.metadata[ITEM_KEY];
        else item.metadata[ITEM_KEY] = { slots } satisfies Combatant;
      }
    },
  );
}

/** Ändrar enskilda kort, angivna som [token-id, kortindex, ändring] */
async function patchSlots(patches: [string, number, Partial<Slot>][]) {
  const changes = new Map<string, (slots: Slot[]) => Slot[]>();
  for (const [id, index, patch] of patches) {
    const previous = changes.get(id) ?? ((slots: Slot[]) => slots);
    changes.set(id, (slots) => {
      const result = previous(slots);
      if (result[index]) result[index] = { ...result[index], ...patch };
      return result;
    });
  }
  await updateCombatants(changes);
}

// ---------- Åtgärder ----------

/** Ny runda: blanda korten och dela ut så många kort som varje deltagare ska ha */
async function dealCards() {
  if (combatants.length === 0 || totalSlots() > state.cardCount) return;
  const deck = shuffle(Array.from({ length: state.cardCount }, (_, i) => i + 1));
  let next = 0;
  const changes = new Map<string, (slots: Slot[]) => Slot[]>();
  for (const item of combatants) {
    const cards = data(item).slots.map(() => deck[next++]);
    changes.set(item.id, () => cards.map((card) => ({ card, acted: false, swapped: false })));
  }
  await updateCombatants(changes);
  await saveState({ round: state.round + 1 });
}

/** Markera kortet som står på tur (lägsta kortet) som klart. Turen går då vidare till nästa kort. */
async function nextTurn() {
  const active = activeRow();
  if (active) await patchSlots([[active.item.id, active.index, { acted: true }]]);
}

/** Ångra senaste "klar", så att det kortet åter står på tur */
async function undoLast() {
  const last = lastActedRow();
  if (last) await patchSlots([[last.item.id, last.index, { acted: false }]]);
}

/**
 * Kort längre ner i turordningen som ett kort kan bytas mot: högre kort som inte agerat och
 * som tillhör någon annan. Varje kort får bara bytas en gång per runda.
 */
function swapTargets(row: Row): Row[] {
  const { card, acted, swapped } = row.slot;
  if (card === null || acted || swapped) return [];
  return waitingRows().filter((other) => other.item.id !== row.item.id && other.slot.card! > card);
}

/** Byt kort med en annan deltagare längre ner i turordningen */
async function moveDown(id: string, index: number, targetKey: string) {
  const row = findRow(id, index);
  const target = row && swapTargets(row).find((t) => `${t.item.id}:${t.index}` === targetKey);
  if (!row || !target) return;
  await patchSlots([
    [row.item.id, row.index, { card: target.slot.card, swapped: true }],
    [target.item.id, target.index, { card: row.slot.card }],
  ]);
}

/** Sätt ett kort manuellt. Har något annat kort redan numret byter de nummer med varandra. */
async function setCard(id: string, index: number, card: number | null) {
  const row = findRow(id, index);
  if (!row) return;
  const patches: [string, number, Partial<Slot>][] = [[id, index, { card }]];
  const holder = card === null ? undefined : sortedRows().find((r) => !sameRow(r, row) && r.slot.card === card);
  if (holder) patches.push([holder.item.id, holder.index, { card: row.slot.card }]);
  await patchSlots(patches);
}

/**
 * Sätt hur många handlingar (initiativkort) en varelse har. Nya kort saknar nummer tills nästa
 * utdelning, eller tills GM väljer ett manuellt. Vid färre kort tas först kort utan nummer bort,
 * sedan de högsta korten som inte agerat och sist de högsta som redan agerat.
 */
async function setSlotCount(id: string, count: number) {
  count = Math.max(1, Math.min(state.cardCount, count));
  await updateCombatants(
    new Map([
      [
        id,
        (slots) => {
          if (count >= slots.length) return [...slots, ...Array.from({ length: count - slots.length }, () => ({ ...EMPTY_SLOT }))];
          const removalOrder = slots
            .map((slot, index) => ({ slot, index }))
            .sort(
              (a, b) =>
                Number(b.slot.card === null) - Number(a.slot.card === null) ||
                Number(a.slot.acted) - Number(b.slot.acted) ||
                (b.slot.card ?? 0) - (a.slot.card ?? 0),
            );
          const removed = new Set(removalOrder.slice(0, slots.length - count).map((r) => r.index));
          return slots.filter((_, index) => !removed.has(index));
        },
      ],
    ]),
  );
}

function toggleEditing(id: string, index: number) {
  editing = editing?.id === id && editing.index === index ? null : { id, index };
  render();
}

/** Ta bort ett av en deltagares kort. Är det det sista kortet tas deltagaren bort ur initiativet. */
async function removeSlot(id: string, index: number) {
  await updateCombatants(new Map([[id, (slots) => slots.filter((_, i) => i !== index)]]));
}

async function resetTracker() {
  await updateCombatants(new Map(combatants.map((c) => [c.id, (slots) => slots.map(() => ({ ...EMPTY_SLOT }))])));
  await saveState({ round: 0 });
}

async function changeCardCount(delta: number) {
  const cardCount = Math.min(MAX_CARDS, Math.max(1, state.cardCount + delta));
  if (cardCount !== state.cardCount) await saveState({ cardCount });
}

// ---------- Rendering ----------

function render() {
  if (!sceneReady) {
    app.innerHTML = `<p class="muted center">${t.noScene}</p>`;
    return;
  }

  const slotCount = totalSlots();
  const tooFewCards = slotCount > state.cardCount;
  const active = activeRow();
  const last = lastActedRow();
  const allDone = state.round > 0 && combatants.length > 0 && !active;

  const header = `
    <header>
      <h1>${t.title}</h1>
      <span class="round">${state.round > 0 ? t.round(state.round) : t.notStarted}</span>
      <button class="ghost small lang" data-action="lang" title="${t.switchLanguage}">${lang === "sv" ? "EN" : "SV"}</button>
    </header>`;

  const controls = isGM
    ? `
    <section class="controls">
      <div class="counter" title="${t.deckTitle}">
        <span>${t.cards}</span>
        <button data-action="cards-minus" ${state.cardCount <= 1 ? "disabled" : ""} aria-label="${t.fewerCards}">−</button>
        <output>${state.cardCount}</output>
        <button data-action="cards-plus" ${state.cardCount >= MAX_CARDS ? "disabled" : ""} aria-label="${t.moreCards}">+</button>
      </div>
      <div class="buttons">
        <button class="primary" data-action="deal" ${combatants.length === 0 || tooFewCards ? "disabled" : ""}>
          ${state.round > 0 ? t.newRound : t.deal}
        </button>
        <button data-action="next" ${!active ? "disabled" : ""}>${t.next}</button>
        <button data-action="reset" class="ghost" title="${t.reset}">↺</button>
      </div>
      ${tooFewCards ? `<p class="warning">${t.tooFewCards(slotCount, state.cardCount)}</p>` : ""}
    </section>`
    : "";

  const cardOptions = (current: number | null) =>
    [`<option value="" ${current === null ? "selected" : ""}>–</option>`]
      .concat(
        Array.from({ length: Math.max(state.cardCount, current ?? 0) }, (_, i) => i + 1).map(
          (n) => `<option value="${n}" ${n === current ? "selected" : ""}>${n}</option>`,
        ),
      )
      .join("");

  const hidden = (label: string) => `<button class="ghost small hidden" tabindex="-1" aria-hidden="true">${label}</button>`;

  // Numrera varje deltagares kort i turordning (1/2, 2/2 …) när den har fler än ett
  const seen = new Map<string, number>();

  // Visa redigeraren under raden som klickades, eller under varelsens första rad om den raden försvunnit
  const allRows = sortedRows();
  const editItem = isGM && editing ? combatants.find((c) => c.id === editing!.id) : undefined;
  if (!editItem) editing = null;
  const editAfter = editing
    ? (allRows.find((r) => r.item.id === editing!.id && r.index === editing!.index) ?? allRows.find((r) => r.item.id === editing!.id))
    : undefined;
  const editor = (item: Item) => {
    const count = data(item).slots.length;
    return `
        <li class="editor">
          <span class="editor-label">${t.actionsFor(escapeHtml(displayName(item)))}</span>
          <button data-action="actions-minus" data-id="${item.id}" ${count <= 1 ? "disabled" : ""} aria-label="${t.fewerActions}">−</button>
          <output>${count}</output>
          <button data-action="actions-plus" data-id="${item.id}" ${count >= state.cardCount ? "disabled" : ""} aria-label="${t.moreActions}">+</button>
          <button class="ghost small" data-action="close-editor" title="${t.close}">✓</button>
        </li>`;
  };

  const rows = allRows
    .map((row) => {
      const { item, index, slot } = row;
      const { card, acted } = slot;
      const ref = `data-id="${item.id}" data-index="${index}"`;
      const count = data(item).slots.length;
      const ordinal = (seen.get(item.id) ?? 0) + 1;
      seen.set(item.id, ordinal);
      const isActive = sameRow(row, active);

      const targets = swapTargets(row);
      const moveSelect = targets.length
        ? `<select class="move" data-action="down" ${ref} title="${t.swapTitle}" aria-label="${t.swapLabel}">
             <option value="" selected disabled hidden>↓</option>
             ${targets
               .map((t) => `<option value="${t.item.id}:${t.index}">${t.slot.card} – ${escapeHtml(displayName(t.item))}</option>`)
               .join("")}
           </select>`
        : hidden("↓");
      const doneButton = isActive
        ? `<button class="ghost small" data-action="next" title="${t.markDone}">✓</button>`
        : sameRow(row, last)
          ? `<button class="ghost small" data-action="undo" title="${t.undoDone}">↶</button>`
          : hidden("✓");
      const cardCell = isGM
        ? `<select data-action="card" ${ref} aria-label="${t.cardLabel}">${cardOptions(card)}</select>`
        : `<span class="card">${card ?? "–"}</span>`;
      const gmButtons = isGM
        ? `${moveSelect}
           ${doneButton}
           <button class="ghost small" data-action="remove" ${ref} title="${count > 1 ? t.removeSlot : t.removeCombatant}">×</button>`
        : "";
      return `
        <li class="${isActive ? "active" : ""} ${acted ? "acted" : ""}">
          ${cardCell}
          <span class="name" ${isGM ? `data-action="edit-actions" ${ref} title="${t.editActions}"` : ""}>${escapeHtml(displayName(item))}${count > 1 ? ` <span class="slot-count">${ordinal}/${count}</span>` : ""}</span>
          ${gmButtons}
        </li>${sameRow(row, editAfter) ? editor(item) : ""}`;
    })
    .join("");

  const list =
    combatants.length > 0
      ? `<ul class="list">${rows}</ul>${allDone ? `<p class="muted center">${t.allDone}</p>` : ""}`
      : `<p class="muted center">${
          isGM ? t.emptyGM : t.emptyPlayer
        }</p>`;

  app.innerHTML = header + controls + list;
}

app.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target || target.tagName === "SELECT") return;
  const id = target.dataset.id!;
  const index = Number(target.dataset.index);
  switch (target.dataset.action) {
    case "cards-minus": return changeCardCount(-1);
    case "cards-plus": return changeCardCount(1);
    case "deal": return dealCards();
    case "next": return nextTurn();
    case "reset": return resetTracker();
    case "undo": return undoLast();
    case "edit-actions": return toggleEditing(id, index);
    case "close-editor": editing = null; return render();
    case "actions-minus": return setSlotCount(id, data(combatants.find((c) => c.id === id)!).slots.length - 1);
    case "actions-plus": return setSlotCount(id, data(combatants.find((c) => c.id === id)!).slots.length + 1);
    case "lang": return switchLanguage();
    case "remove": return removeSlot(id, index);
  }
});

app.addEventListener("change", (event) => {
  const target = event.target as HTMLSelectElement;
  const id = target.dataset.id!;
  const index = Number(target.dataset.index);
  if (target.dataset.action === "card") setCard(id, index, target.value ? Number(target.value) : null);
  else if (target.dataset.action === "down" && target.value) moveDown(id, index, target.value);
});

// ---------- Owlbear-koppling ----------

function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  root.setProperty("--primary", theme.primary.main);
  root.setProperty("--primary-contrast", theme.primary.contrastText);
  root.setProperty("--text", theme.text.primary);
  root.setProperty("--text-muted", theme.text.secondary);
  document.documentElement.dataset.theme = theme.mode.toLowerCase();
}

function setupContextMenu() {
  const tokenLayers = [
    { key: "layer", value: "CHARACTER", coordinator: "||" },
    { key: "layer", value: "MOUNT" },
  ] as const;

  OBR.contextMenu.create({
    id: `${ID}/context-menu`,
    icons: [
      {
        icon: asset("add.svg"),
        label: t.menuAdd,
        filter: {
          roles: ["GM"],
          every: [...tokenLayers, { key: ["metadata", ITEM_KEY], value: undefined }],
        },
      },
      {
        icon: asset("remove.svg"),
        label: t.menuRemove,
        filter: { roles: ["GM"], every: [...tokenLayers] },
      },
    ],
    onClick(context) {
      const add = context.items.every((item) => item.metadata[ITEM_KEY] === undefined);
      OBR.scene.items.updateItems(context.items, (items) => {
        for (const item of items) {
          if (add) item.metadata[ITEM_KEY] = { slots: [{ ...EMPTY_SLOT }] } satisfies Combatant;
          else delete item.metadata[ITEM_KEY];
        }
      });
    },
  });

  OBR.contextMenu.create({
    id: `${ID}/context-menu-extra-card`,
    icons: [
      {
        icon: asset("add.svg"),
        label: t.menuExtraCard,
        filter: {
          roles: ["GM"],
          every: [...tokenLayers, { key: ["metadata", ITEM_KEY], value: undefined, operator: "!=" }],
        },
      },
    ],
    onClick(context) {
      updateCombatants(new Map(context.items.map((item) => [item.id, (slots: Slot[]) => [...slots, { ...EMPTY_SLOT }]])));
    },
  });
}

/** Byter mellan svenska och engelska för den här spelaren */
function switchLanguage() {
  setLang(lang === "sv" ? "en" : "sv");
  render();
  // Högerklicksmenyns texter sätts när menyn skapas, så skapa om den
  setupContextMenu();
}

function onItemsChange(items: Item[]) {
  combatants = items.filter((item) => item.metadata[ITEM_KEY] !== undefined);
  render();
}

function onSceneMetadataChange(metadata: Record<string, unknown>) {
  state = { ...DEFAULT_STATE, ...(metadata[SCENE_KEY] as Partial<TrackerState> | undefined) };
  render();
}

async function loadScene() {
  sceneReady = await OBR.scene.isReady();
  if (sceneReady) {
    onItemsChange(await OBR.scene.items.getItems());
    onSceneMetadataChange(await OBR.scene.getMetadata());
  }
  render();
}

OBR.onReady(async () => {
  setupContextMenu();

  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => {
    isGM = (await OBR.player.getRole()) === "GM";
    render();
  });

  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);

  OBR.scene.items.onChange(onItemsChange);
  OBR.scene.onMetadataChange(onSceneMetadataChange);
  OBR.scene.onReadyChange(loadScene);
  await loadScene();
});
