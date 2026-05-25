---
name: kazali
description: Mark one or more listings as crashed/accident-damaged (kazalı) by their mobile.de ID or local listingId. TRIGGER whenever the user writes "kazali" or "kazalı" together with one or more IDs (numeric mobile.de ID like 452097976 or local listingId like C133), in any order and with or without a leading slash. Examples that MUST trigger this skill: "/kazali 452097976", "C133 kazali", "kazali C133 C231", "bunlar kazali: 452097976 451474145". An optional reason phrase after the ID is forwarded to the script as the audit reason.
---

# Kazali (Mark as Crashed)

When the user provides one or more IDs alongside the word "kazali" (or "kazalı"), run `npm run move:kazali -- <id> [neden]` for each ID to move the listing to the KAZALI archive (`COUPE_GAS_WITH_SUNROOF_KAZALI.json` for coupes, `GRAN_COUPE_KAZALI.json` for Gran Coupé). The script accepts both `mobileDeId` (numeric) and local `listingId` (e.g. `C133`). This applies whether invoked as a slash command (`/kazali <id>`) or in natural language (`<id> kazali`, `kazali <id> <id>`, etc.).

## Usage

The user will provide one or more IDs, optionally followed by a free-text reason. Examples:
- `/kazali 452097976`
- `/kazali C133`
- `C133 kazali`
- `kazali C133 C231`
- `kazali 452097976 ön çamurluk hasarı` → reason "ön çamurluk hasarı" passed to that ID
- `bunlar kazali: 452097976 451474145`

## Steps

For each provided ID:
1. Run `npm run move:kazali -- <id> [neden]` using the Bash tool. Pass the reason only if the user supplied one for that ID; otherwise omit it (script defaults to "Manuel işaretlendi").
2. Report the result to the user (script prints `💥 <listingId> (<mobileDeId>) kazalı olarak taşındı — <source> → <archive> (<reason>)`).

If no IDs are provided, ask the user for the ID(s).

## Notlar

- Birden fazla ID verilirse her biri ayrı `npm run move:kazali` çağrısı olur.
- Eğer kullanıcı tek bir reason yazmışsa, bunu hangi ID'ye iliştireceği net değilse kullanıcıya sor.
