# DoD Initiativ

Initiativ-tracker med initiativkort för **Drakar och Demoner**, som tillägg till [Owlbear Rodeo](https://www.owlbear.rodeo).

*An initiative tracker using initiative cards for the Swedish RPG Drakar och Demoner, as an Owlbear Rodeo extension. The interface is available in Swedish and English – see [English](#english) below.*

## Funktioner

- **Initiativkort:** Blanda leken och dela ut ett kort till varje deltagare. Lägst kort börjar. Antalet kort i leken är 10 som standard och kan ändras (1–99).
- **Turordning:** Korten markeras klara ett i taget, från lägst till högst. Använd **Nästa** eller ✓ på den som står på tur. Med ↶ ångrar du det senast markerade kortet.
- **Byta kort:** Med ↓ byter en deltagare kort med någon längre ner i turordningen som inte har agerat än. Varje kort kan bytas en gång per runda.
- **Flera kort per varelse:** Ge en varelse fler kort med **+** på raden, eller högerklicka på dess token och välj *Extra initiativkort*. Med × tar du bort ett kort.
- **Manuella kort:** Spelledaren kan sätta ett kort för hand. Har någon annan redan kortet byter de kort med varandra.
- **Svenska och engelska:** Varje spelare väljer språk med knappen uppe till höger. Valet sparas i webbläsaren.
- **Spelledarstyrt:** Bara spelledaren (GM) kan ändra initiativet. Spelarna ser turordningen och vem som står på tur.

## Användning

1. Högerklicka på en eller flera tokens och välj **Lägg till i initiativ**.
2. Öppna tillägget i verktygsfältet och klicka **Dra kort**.
3. Stega igenom rundan med **Nästa**.
4. Klicka **Ny runda** när alla har agerat. Korten blandas och delas ut på nytt.

Knappen ↺ nollställer rundräknaren och tar bort alla utdelade kort.

## Utveckling

Kräver [Node.js](https://nodejs.org).

```bash
npm install
npm run dev      # dev-server på http://localhost:5173
npm run build    # typkontroll och bygge till dist/
```

### Testa i Owlbear Rodeo

1. Starta dev-servern med `npm run dev`.
2. I Owlbear Rodeo går du till **Profil → Extensions → Add Custom Extension** och anger `http://localhost:5173/manifest.json`.
3. Öppna ett rum och aktivera **DoD Initiativ** under rummets tillägg (pusselbiten).

Körs dev-servern på en annan dator kan du tunnla porten med `ssh -L 5173:localhost:5173 <värd>`. Porten är låst till 5173 och CORS tillåter `https://www.owlbear.rodeo` (se `vite.config.ts`).

Ändringar i koden laddas om direkt i tillägget. Ändringar i `public/manifest.json` kräver att du tar bort tillägget och lägger till det igen.

### Struktur

| Fil | Innehåll |
| --- | --- |
| `src/main.ts` | Logik, rendering och koppling till Owlbear Rodeo-SDK:n |
| `src/i18n.ts` | Alla texter på svenska och engelska |
| `src/style.css` | Utseende, följer Owlbears ljusa och mörka tema |
| `public/manifest.json` | Tilläggets manifest |

Data sparas i Owlbear-scenen. Varje token som är med i initiativet har sina kort i metadata under `se.dod-initiativ/data`. Scenen sparar antal kort i leken och aktuell runda under `se.dod-initiativ/state`.

## English

An initiative tracker for Owlbear Rodeo that uses the initiative card mechanic from Drakar och Demoner. Switch the interface to English with the **EN** button in the top right.

- Right-click tokens and choose **Add to initiative**. Then click **Draw cards** to shuffle and deal. The lowest card goes first.
- Mark cards as done one at a time with **Next** or ✓, and undo with ↶.
- Use ↓ to swap cards with someone further down who hasn't acted yet. Each card can be swapped once per round.
- Give a creature extra cards with **+** or the *Extra initiative card* context menu item.
- Only the GM can change the initiative. Players see the turn order.

To develop it, run `npm install` and then `npm run dev`. Next, add `http://localhost:5173/manifest.json` as a custom extension in Owlbear Rodeo.
