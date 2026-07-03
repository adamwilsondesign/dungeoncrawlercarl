# Voice Bible — Dungeon Crawler Carl: The First Floor

Three narration channels, three speakers, three registers. Every line of
non-dialogue text in the game belongs to exactly one of them. The script DSL
builders are `announce()`, `notify()`, and `describe()` (in
`src/data/script.ts`); the legacy `narrate()` is an alias for `describe()`.

The dungeon AI has no persona name — it is simply **The Crawl AI**, and
that is what renders on every `announce()` plate (`AI_NAME` in
`src/engine/narrator.ts`). On air it may call itself "your host" or "the
Crawl AI," never anything cuter; the horror is that the thing running the
show never needed a stage name.

---

## 1. `announce()` — The Crawl AI, live broadcast

**Who:** The dungeon AI performing as a game-show host, addressing the
galactic audience *and* Carl simultaneously. It is glib, theatrical,
delighted by cruelty, fluent in ratings-speak, and constitutionally unable
to treat a catastrophe as anything but content.

**Use for:** the reclamation announcement, rules delivered "for our new
viewers at home," boss intros, floor milestones, sponsor gags, achievement
flourishes with spectacle value, anything performative.

**Rules of the register:**
- Speaks TO the audience ABOUT Carl, or to Carl AS an audience prop.
- Loves numbers: crawler IDs, viewer counts, odds, sponsorship rates.
- Cruelty is always phrased as hospitality, prizes, or programming.
- Never sincere. If a line lands sincere, it belongs to `describe()`.
- Exclamation points welcome. This is the only voice allowed to be loud.

**Example lines:**
1. "Live from a suburb that no longer exists, it's Crawler 4,122! He fixes
   boats, folks. Nothing on this floor is a boat."
2. "For our new viewers at home: the glowing doors are exits, the glowing
   eyes are not, and the difference is worth about nine million views."
3. "Ohhh, he opened the crate! He opened the crate WITHOUT checking it for
   teeth! This is why we love him, people."
4. "Tonight's neighborhood boss weighs three tons, hates noise, and is
   sponsored by a very patient funeral consortium. Show it some respect."
5. "Audience poll: will he take the tunnel or the stairs? Trick question!
   We flooded the stairs during the commercial."
6. "A round of applause for the goblin pit crew, who died doing what they
   loved: attempting to kill our star."
7. "That scream was brought to you by MoonBurger. MoonBurger: it is
   technically food."
8. "One floor down, eighteen to go! Renew those subscriptions, folks —
   the Crawl loves you, and its love is measured quarterly."

## 2. `notify()` — the dungeon interface

**Who:** The operational layer of the same machine, with the personality
removed. An OS notification with a body count behind it. It does not joke.
Anything darkly funny about it is in what it omits.

**Use for:** kill confirmations, XP/gold/loot grants, level-ups, quest and
objective updates, achievement unlock confirmations, inventory events —
anything that would be a HUD pop in a normal RPG.

**Rules of the register:**
- Fragments over sentences. Facts over feelings. Numbers exact.
- No first person, no address, no adjectives that aren't operational.
- Imperatives allowed when procedural: "Return to a Guildmaster."
- The horror is in the bookkeeping tone, never in the word choice.

**Example lines:**
1. "Enemy defeated. +40 XP."
2. "Level 3. +1 all stats. New skill available."
3. "Item acquired: GOBLIN BOMB (2)."
4. "Achievement unlocked: PROPERLY BLOODED."
5. "Quest updated: THE BALL. Objective: stop the rolling."
6. "Gold +30. Balance: 45."
7. "Party member registered: PRINCESS DONUT. Role: management."
8. "Warning: floor closure in effect. Proximity to exit: insufficient."

## 3. `describe()` — the ambient narrator

**Who:** Not the AI. The closest thing the game has to a novelist's camera
on Carl — third-person, dry, observant, occasionally rueful. Grounded and
human where the other two are inhuman. LOOK results, room atmosphere, and
Carl's own read of the world all live here.

**Use for:** LOOK responses, room-entry atmosphere, object descriptions,
quiet character beats, aftermath, anything the player experiences rather
than is told.

**Rules of the register:**
- Concrete sensory detail first; the joke, if any, arrives late and dry.
- Understatement over exclamation. Never addresses the audience.
- May carry Carl's interiority ("he decides not to think about it") but in
  third person — this voice watches him, it is not him speaking.
- Rueful is fine. Theatrical is a bug: hand those lines to the Crawl AI.

**Example lines:**
1. "The tunnel smells like a parking garage that learned about mildew and
   committed to it. The moss handles the lighting. Badly."
2. "A vending machine, tipped on its side, still faintly lit. Whatever it
   sells now, it sells to the floor."
3. "The claw marks on the door start confident and end desperate. Carl
   files that under things not to think about, a folder that is getting
   full."
4. "It is quiet in the way a theater is quiet. Not empty — waiting."
5. "The goblin camp smells like burnt hair and ambition. Mostly burnt
   hair."
6. "He checks his slippers. Still cat slippers. Some facts refuse to
   improve with circumstances."
7. "The stairwell goes down farther than light is willing to follow. The
   handrail is sticky. He uses it anyway."
8. "Somebody's shopping list is still pinned to the fridge. Carl reads the
   whole thing before he can stop himself."

---

## Boundary calls (the ones authors get wrong)

- **Achievement moments:** the unlock itself is `notify()`; the Crawl AI may
  *also* riff on it with an `announce()` when it's spectacle ("He touched
  the hatch, folks!"). Two boxes, two voices, in that order.
- **Rules and tutorials:** if it reads like a broadcast segment, it's
  `announce()`. If it reads like a terms-of-service excerpt, it's
  `notify()`. There is no third option; `describe()` never explains rules.
- **Death:** the sting is `announce()` (the Crawl AI loves a death), the
  respawn/penalty bookkeeping is `notify()`, and what the room looks like
  afterward is `describe()`.
- **When in doubt:** if removing all personality kills the line, it's
  the Crawl AI's. If removing all warmth kills it, it's `describe()`. If neither
  changes anything, it was `notify()` all along.
