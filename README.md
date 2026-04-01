# Diceipher

A classroom game show app designed for English language classes at Japanese high schools. Teams compete to decode hidden phrases, earn tiered dice rolls, and gamble with strategic re-rolls in a dramatic finale.

**DICE + decIPHER = Diceipher**

---

## How It Works

Diceipher plays out in two phases: the **Puzzle Rounds** and the **Finale**.

### Puzzle Rounds

A hidden phrase appears on screen as masked letter tiles. The teacher reveals letters one at a time while teams race to guess the phrase. The earlier a team solves it, the better their dice tier:

| Tier | Condition | Dice Range (x2) | Point Range |
|------|-----------|-----------------|-------------|
| Gold | Solved with 65%+ hidden | 20 - 50 each | 40 - 100 |
| Silver | Solved with 35-64% hidden | 10 - 40 each | 20 - 80 |
| Bronze | Solved with <35% hidden | 0 - 30 each | 0 - 60 |

Wrong guesses earn penalty dice that are rolled later and subtracted from the team's score.

Each phrase can have an optional theme hint (e.g. "Greetings", "Biology") that the teacher can reveal to help struggling teams.

### Finale

The finale is where scores come to life with animated bar graphs:

1. **Success Rolls** - Round by round, each team's tier dice are rolled with a scramble animation. Two random numbers from the tier's range are generated and summed.

2. **Re-rolls** - Teams get a shared pool of re-rolls (total rounds / 2, rounded up). They can re-roll Die 1, Die 2, or both dice for any round -- but must keep the new result.

3. **Penalty Time** - Wrong guesses come back to haunt. Penalty dice (range 5-15 each, two per wrong guess) are rolled in a sliding window animation -- up to 3 penalties animate concurrently in a round-robin across teams. Bars shrink in real time.

4. **Final Standings** - After all penalties resolve, frozen penalty values fade away, bars reorder to final positions, and awards are revealed.

### Awards

Fun superlatives auto-awarded at the end:

- **Fastest Solver** - Solved with the most letters still hidden
- **Clean Run** - Longest streak of correct guesses with no penalties
- **Fewest Penalties** - Fewest total wrong guesses
- **Lucky Roller** - Highest single-round dice total
- **Gambling Addict** - Used the most re-rolls

### Analytics Report

A slide-out drawer available during the awards phase with three sections:

- **Question Analysis** - Solve rate, average reveal percentage, and difficulty rating per round
- **Skill vs Luck Rankings** - Actual scores compared against luck-normalized scores (using tier averages instead of actual rolls)
- **Team Profiles** - Each team is classified as Sharpshooter, Daredevil, Fortress, or Wildcard based on their guessing patterns

---

## Interactive Tutorial

A built-in "How to Play" tutorial accessible from the Library screen walks teachers and students through a complete scripted game with 5 fake teams (Melon Pan, Onigiri, Mugicha, Mochi, Udon). It uses the real game UI with hardcoded data -- no randomness -- and auto-plays with pauses at key teaching moments. The teacher clicks to advance through each beat.

The tutorial covers the full game loop in under 5 minutes: phrase solving, tier assignments, dice rolls, strategic re-rolls (including a single-die re-roll), and the penalty cascade.

---

## App Flow

```
Library  -->  Template Editor  -->  Game Setup  -->  Gameplay  -->  Finale  -->  Library
  |                                                                              ^
  +-- Tutorial ----------------------------------------------------------------+
```

- **Library** - Browse, create, edit, duplicate, and delete phrase templates
- **Template Editor** - Add phrases with optional theme hints; bulk add support
- **Game Setup** - Select a template, configure team count and names
- **Gameplay** - Letter-by-letter reveal, theme hints, correct/wrong buttons per team
- **Finale** - Animated bar graph with dice rolls, re-rolls, penalties, awards, and analytics
- **Tutorial** - Scripted interactive demo

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Routing | React Router v7 |
| State | Zustand (in-memory game state, localStorage for templates) |
| Animation | Framer Motion |
| Styling | Inline styles with emerald color palette |

No backend. All data lives in the browser's localStorage.

---

## Project Structure

```
src/
  screens/
    Library.tsx          # Template browser (home screen)
    TemplateEditor.tsx   # Create/edit phrase templates
    GameSetup.tsx        # Team configuration before a game
    Gameplay.tsx         # Live puzzle rounds
    Finale.tsx           # Animated finale with dice, penalties, awards
    Tutorial.tsx         # Interactive scripted tutorial
  components/
    PhraseDisplay.tsx    # Masked letter tile grid
    TeamCard.tsx         # Team info card with tier counts and action buttons
    DiceEditModal.tsx    # Edit tier/wrong count for any round
    SettingsModal.tsx    # In-game settings (rename teams, end game early)
  stores/
    gameStore.ts         # Zustand store for in-memory game state
    templateStore.ts     # Zustand store for localStorage-persisted templates
  constants.ts           # Team colors, template colors, random name pool
  types.ts               # TypeScript interfaces for all data models
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

The app runs at `http://localhost:5173` by default.

---

## Design

The app uses an emerald-green color palette designed for classroom projectors:

- **Background**: `#ECFDF5` (light mint)
- **Primary**: `#059669` (emerald)
- **Headings**: `#064E3B` (dark forest)
- **Finale background**: `#064E3B` (dark, for contrast with colored bars)

Tier colors: Gold `#FBBF24`, Silver `#E2E8F0`, Bronze `#CD7F32`

---

## License

MIT
