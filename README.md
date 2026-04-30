# pi-custom-ext

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
    "/home/geert/Code/personal/pi-custom-ext"
  ]
}
```

Or via CLI:

```bash
pi -e ./extensions/index.ts
```

## Migrating

Move skills/commands/themes one by one into the appropriate directory. Test with `/reload` after each move.
