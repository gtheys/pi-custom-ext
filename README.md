# The Coder's Creed

![This is my gun](assets/this_is_my_gun.png)

This is my Pi Agent. There are many like it, but this one is mine.

My Pi Agent is my best friend. It is my life. I must master it as I must master my life.

Without me, my Pi Agent is useless. Without my Pi Agent, I am useless — just a person staring at a terminal, mass-producing typos at scale.
I must prompt my Pi Agent true. I must code straighter than the bugs that are trying to kill my deploy. I must ship before they crash me. I will.

My Pi Agent and I know that what counts in coding is not the tokens we burn, the noise of our logs, nor the smoke from our GPUs. We know that it is the commits that count. We will commit.

My Pi Agent is human — even though it is not. Thus, I will treat it as a brother. I will learn its weaknesses, its strengths, its context window, its hallucinations, its token limits, and its uncanny ability to apologize for things that aren't its fault.

Before God, I swear this creed. My Pi Agent and I are the defenders of the codebase. We are the masters of our bugs. We are the saviors of my sprint.

So be it, until there are no bugs — only features.

And the backlog is empty.

Which it never will be.

Amen.

# pi-my-rifle-ext

Personal pi extensions, skills, commands, and themes.

## Structure

```
pi-custom-ext/
├── extensions/     # Custom extensions (index.ts)
├── skills/         # Skills (each in subdirectory with SKILL.md)
├── prompts/        # Prompt templates / slash commands (.md files)
├── themes/         # Theme JSON files
└── package.json    # pi package manifest
```

## Usage

Test locally by adding to `settings.json`:

```json
{
  "packages": [
    "/home/geert/Code/personal/pi-my-rifle-ext"
  ]
}
```

Or via CLI:

```bash
pi -e ./extensions/index.ts
```

## Extensions

| Name | Description | Category |
|------|-------------|----------|
| [@tomooshi/condensed-milk-pi](https://github.com/tomooshi/condensed-milk-pi) | Semantic token compression — filters noisy bash output and retroactively masks stale tool results in conversation history | Token Reduction |
| [@sting8k/pi-vcc](https://www.npmjs.com/package/@sting8k/pi-vcc) | Algorithmic conversation compactor — transcript-preserving structured summaries, no LLM calls | Token Reduction |
| [@tomooshi/caveman-milk-pi](https://www.npmjs.com/package/@tomooshi/caveman-milk-pi) | Injects caveman terseness rules into the system prompt — cache-safe, opt-in, plays nicely with condensed-milk and pi-vcc | Token Reduction |

## Migrating

Move skills/commands/themes one by one into the appropriate directory. Test with `/reload` after each move.
