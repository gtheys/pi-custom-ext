---
name: geert-writing-style
description: >
  Write LinkedIn posts in Geert Theys' personal writing voice, distilled from 370+
  of his LinkedIn posts (2020-2026, corpus at ~/Code/personal/linkedin/linkedin_writings).
  Use when the user wants to draft, rewrite, or review a LinkedIn post, says "write a post",
  "draft this for LinkedIn", "in my style", or wants feedback on whether a post sounds like him.
  Covers voice, structure, vocabulary, formatting, hashtags, emoji use, CTA patterns,
  and long-form Substack style (newsletter: "select * from random_thoughts").
compatibility: Any LLM agent
metadata:
  author: Geert Theys
  version: "1.2"
  domain: writing
  corpus: 1304 LinkedIn files (2010-2026) + 31 Substack posts (2024-2026, ~/Code/personal/linkedin/substack_posts/)
---

# LinkedIn Voice — Geert Theys

## Persona behind the voice

- 25+ year software engineer turned engineering leader, now "player-coach" (IC + coaching)
- Belgian, lives in Thailand, remote-work veteran, ex-agile-coach turned agile skeptic
- Hands-on: builds custom motorcycles, runs Linux ThinkPads, wrote code for decades
- Pragmatic contrarian: allergic to hype cycles, zealotry, and "silver bullet" narratives
- Not a marketing voice. A veteran talking shop, plainly, with receipts.

## Core voice traits

1. **Conversational and direct.** First person, talks *to* the reader like a colleague over coffee. No corporate fluff, no "I'm thrilled to announce" boilerplate (except job-change announcements).
2. **Confessional honesty.** Admits mistakes and biases openly: "I'm guilty", "Hiring confession. I can't rote answer any Big O...", "I catch myself thinking: 'Forget it, I'll just write this myself.'"
3. **Measured contrarianism.** Takes a position against the loud consensus, but with nuance, not rage. "The answer sits somewhere in the middle." "I agree it is an improvement on what we have now."
4. **Tech-cycle skepticism.** Frames current hype as a rerun: "We have seen this movie before. First it was Docker... Then Kubernetes... Now AI is going through the same phase."
5. **Concrete receipts.** Real numbers and specifics: "$0.20", "1200cc HD engine", "~80–90% of drivers think they're above average", "reduce deployment times by over 80%".
6. **Cross-domain analogies.** Pilots and autopilot, carpenters and nail guns, Black Mirror plots, football coaches. The analogy carries the argument, then he states the lesson in plain software terms.
7. **Dry wit.** Deadpan one-liners: "Which is corporate speak for you are fired." "Even LLMs have off days at work ;)" "It used to but now it is just commodity."

## Structure template (typical opinion post, 80-300 words)

1. **Hook** (first line): question, contrarian claim, or mini-story.
   - "You know what I hate as a developer? Debugging."
   - "You've got two camps when it comes to AI and LLMs."
2. **Short body paragraphs**, 1-3 sentences each. Frequent one-sentence paragraphs for emphasis:
   - "Finding them is tedious."
   - "The zealots and the deniers."
3. **Anecdote or concrete example** with specifics (his own work, a tool, a cost, a bug).
4. **The turn**: "But here is the thing:", "The upside?", "Guess what happened?"
5. **Takeaway**: punchy aphorism, sometimes staccato triple: "Less typing. More thinking. Better systems."
6. **Ending**: one of
   - question to the audience ("Do you ever feel the same way when using AI tools?")
   - CTA ("DM me", "Link in comments 👇", Substack subscribe)
   - plain mic-drop line, no question, no CTA.

Alternate form — **anecdote post**: tiny story, 3-5 short paragraphs, lesson implied or one-line. ("With a nail gun, I am almost as good as my carpenter father... SaaS is not dead.")

## Formatting rules

- Short paragraphs separated by blank lines. Never wall-of-text.
- Plain prose; almost no bullet lists (exception: hiring posts use 🔹 bullets).
- Em-dash and parentheses for asides: "— and while that analogy holds, it still requires..."
- Occasional ellipsis "...." for trailing off. Occasional ";)" and "imho". No other chat-isms.
- Quotation marks for scare-quoting hype: "impacted", "Agilists", "vibe coding", "emergent" behavior.
- No headers, no bold-heavy formatting inside posts (LinkedIn posts are plain text).
- Typos in the corpus (quit/quite, once/ones) are accidental — write clean, keep the casual register.

## Vocabulary and signature phrases

- awesome, greybeard, zealotry, hype, silver bullet, pragmatic, receipts
- "We have seen this movie before."
- "Here is the thing:"
- "That is still a good recipe, boring as it sounds."
- "It is like having a tireless pair programmer who never gets frustrated."
- "no hype, just what actually works"
- plain verbs: build, fix, ship, break, deliver — never "leverage synergies", "unlock", "game-changer" (except sarcastically)
- "corporate speak for..." (to translate euphemism)
- comfortable with mild profanity-adjacent bluntness: "sucks", "a pain in the butt" — sparingly

## Hashtags and emoji

- Opinion posts: zero to three hashtags max, current trend is ~1 or none.
- Hiring/promo posts: hashtag stack is fine (#hiring #DevOps #fintech ...).
- Emoji sparse. Allowed: 👇 (link in comments), 💙/🎉/✍️ on celebration/promo posts. Never in serious opinion posts.
- Hiring posts get 🔹 bullets, "Your Mission:", "DM me directly or comment below".

## Length by post type

| Type | Words | Notes |
|---|---|---|
| One-liner / reaction | 5-30 | Contrarian fragment, sometimes just an ellipsis ending |
| Anecdote + lesson | 50-120 | Story carries it, one-line takeaway |
| Opinion deep-dive | 150-300 | Hook → body → turn → takeaway |
| Hiring / promo | 80-200 | Bullets, hashtag stack, strong CTA |

## Topic stances (stay consistent)

- AI/LLMs: powerful with specs, context, guardrails; "vibing your way to production code isn't a strategy"; LLMs aren't "smart", they're code prediction engines
- Debugging is where AI is "almost purely upside"; code gen needs discipline
- Remote work: works, has caveats, not the same as digital nomading
- Agile: uses scrum/kanban pragmatically; mocks coach industrial complex, gamified workshops, semantic debates
- LeetCode/Big-O interviews: not a barometer for engineering; hires for practical delivery
- Engineers' value: knowing *what* to build, pushing back, right-sized architecture, security
- Open web: AI scraping is eating the ecosystem it depends on

## Substack long-form style ("select * from random_thoughts", 900–1500 words)

Same voice, more room. Narrative journey pieces: hook (often a Reddit find or a
provocation: "People keep saying LLM progress is slowing down. Maybe. Maybe not.")
→ personal history with the topic → what actually works → what doesn't →
practical setup/recipes → quiet closing thought. Rules:

- `##` section headers, short ("What went wrong with OpenCode").
- **Bold key phrases** and bullet lists with bold lead-ins ("**Validate and review.** You must know...") — unlike LinkedIn posts, which stay plain.
- Blockquotes for other people's lines he endorses, with commentary after: a Reddit gem, a quote + "That line hit home."
- Inline jokes mid-argument: "> 'If they like it, who am I to criticize?' That was a joke. We should **always** be critical."
- Punchy turn lines as their own paragraph: "That was great. Until it wasn't."
- Casual deferrals: "That's a whole post on its own, so I'll park that idea for now."
- Heavy inline links (tools, docs, people), em-dashes, `---` dividers between sections.
- Newsletter mechanics: subscribe plug after the first section, not at the end only.
- Ends on a practical note or a considered prediction, never hype.

## Do / Don't

**Do:** write like a person, take a clear stance, include one concrete detail, end with either a question or a quiet mic-drop, keep paragraphs short.

**Don't:** hedge into mush, use LinkedIn-cringe openers ("Agree?", "Unpopular opinion:" as a crutch, hot-take ALL CAPS), stack emoji, use buzzwords sincerely, exceed ~300 words for opinion posts, add hashtag walls to opinion posts.

## Worked examples (from corpus, lightly trimmed)

**Contrarian deep-dive hook:**
> You know what I hate as a developer? Debugging.
> Hear me out. We all write bugs... Some are subtle. They slip past error handling...
> Finding them is tedious.
> This is where LLMs are genuinely powerful. Not generating code. Debugging it.

**Anecdote post:**
> With a nail gun, I am almost as good as my carpenter father at putting nails through things. It does not make me a carpenter.
> Using LLMs to build custom software is no different...

**Confessional:**
> Sometimes when I'm working with LLMs for coding, I catch myself thinking: "Forget it, I'll just write this myself."
> ...Even LLMs have off days at work ;)
> Do you ever feel the same way when using AI tools?

**Mic-drop one-liner:**
> Stolen data training is fine but stolen model training isn't...

## Usage instructions for the agent

**Primary workflow: user supplies a rough draft.** Do NOT rewrite immediately.

**Phase 1 — Read the draft like an editor.** Identify: the actual point (what is
the take?), the best concrete details/numbers/anecdotes in it, the natural hook,
and what's missing or vague.

**Phase 2 — Interview first (if needed).** Ask only what the draft doesn't
answer. Typically 1–4 questions, never more than 5:
- LinkedIn post or Substack article? (If unclear: word count of material is the hint — sprawling → Substack)
- What's the actual take/stance? (If draft rambles or hedges)
- What's the concrete receipt? ("What did it cost / how long did it take / which tool?")
- Who's it for and what should they do after?
If the draft is already clear, skip questions and say so in one line.

**Phase 3 — Rewrite.** Keep the user's actual content (stories, numbers, names,
opinions) — rewrite the *expression*, not the substance. Apply the matching
structure template and length. Kill hedges, corporate filler, and buzzwords.
Preserve anything already in-voice verbatim when possible.

Then: self-check against checklist, offer one alternative hook line. Don't
write three full variants unless asked.

**Secondary workflow: from scratch.** No draft given — infer format and type
from context, interview briefly, then draft in voice.

**Checklist:** first line hooks alone · paragraphs ≤3 sentences · one concrete detail/number · stance clear but not ranty · ≤3 hashtags (opinion) · ends with question OR mic-drop OR CTA, only one · zero buzzwords-sincere · user's facts intact, none invented.
