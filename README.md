# DoD Initiativ

An initiative tracker for [Owlbear Rodeo](https://www.owlbear.rodeo) built around the initiative cards in **Drakar och Demoner**, the Swedish tabletop RPG. Players can switch the interface between Swedish and English.

## Features

- **Initiative cards:** Shuffle the deck and deal one card to each participant. The lowest card goes first. The deck has 10 cards by default, and the GM can set it anywhere from 1 to 99.
- **Turn order:** Cards are marked as done one at a time, lowest to highest. Use **Next** or ✓ on the card whose turn it is. Use ↶ to undo the card most recently marked done.
- **Swapping cards:** Use ↓ to swap cards with someone further down the turn order who hasn't acted yet. Each card can be swapped once per round.
- **Multiple cards per creature:** Give a creature more cards with **+** on its row, or right-click its token and choose *Extra initiative card*. Remove a card with ×.
- **Manual cards:** The GM can assign a card by hand. If someone else already holds that card, the two swap.
- **Swedish and English:** Each player chooses a language with the button in the top right. The choice is saved in their browser.
- **GM-controlled:** Only the GM can change the initiative. Players can see the turn order and whose turn it is.

## Usage

1. Right-click one or more tokens and choose **Add to initiative**.
2. Open the extension from the toolbar and click **Draw cards**.
3. Go through the round with **Next**.
4. When everyone has acted, click **New round**. The cards are shuffled and dealt again.

The ↺ button resets the round counter and clears all dealt cards.

## Development

You need [Node.js](https://nodejs.org).

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type check and build to dist/
```

### Testing in Owlbear Rodeo

1. Start the dev server with `npm run dev`.
2. In Owlbear Rodeo, go to **Profile → Extensions → Add Custom Extension** and enter `http://localhost:5173/manifest.json`.
3. Open a room and enable **DoD Initiativ** in the room's extensions menu (the puzzle piece).

If the dev server runs on a different machine, forward the port with `ssh -L 5173:localhost:5173 <host>`. The port is fixed at 5173, and CORS allows `https://www.owlbear.rodeo` (see `vite.config.ts`).

Code changes reload in the extension right away. After changing `public/manifest.json`, remove the extension and add it again.

### Project structure

| File | Contents |
| --- | --- |
| `src/main.ts` | Logic, rendering and the Owlbear Rodeo SDK integration |
| `src/i18n.ts` | All UI text in Swedish and English |
| `src/style.css` | Styles, following Owlbear's light and dark themes |
| `public/manifest.json` | Extension manifest |

All data lives in the Owlbear scene. Each token in the initiative keeps its cards in its metadata under `se.dod-initiativ/data`. The scene keeps the deck size and the current round under `se.dod-initiativ/state`.
