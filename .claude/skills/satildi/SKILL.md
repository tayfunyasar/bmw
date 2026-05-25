---
name: satildi
description: Mark one or more listings as sold by their mobile.de ID or local listingId. TRIGGER whenever the user writes "satildi" (Turkish for "sold") together with one or more IDs (numeric mobile.de ID like 441661357 or local listingId like C133), in any order and with or without a leading slash. Examples that MUST trigger this skill: "/satildi 441661357", "441661357 satildi", "satildi C133 451474145", "bunlar satildi: C231 451474145".
---

# Satildi (Mark as Sold)

When the user provides one or more IDs alongside the word "satildi", run `npm run move:sell -- <id>` for each ID to move the listing from the active JSON file to the SOLD archive. The script accepts both `mobileDeId` (numeric, e.g. `441661357`) and local `listingId` (e.g. `C133`). This applies whether the user invokes it as a slash command (`/satildi <id>`) or writes it in natural language (`<id> satildi`, `satildi <id> <id>`, etc.).

## Usage

The user will provide one or more IDs. Examples:
- `/satildi 441661357`
- `/satildi C133 451474145 451811120`
- `441661357 satildi`
- `satildi C231 451474145`

## Steps

For each provided ID:
1. Run `npm run move:sell -- <id>` using the Bash tool.
2. Report the result to the user (script prints `✅ <listingId> (<mobileDeId>) satıldı — <source> → COUPE_GAS_WITH_SUNROOF_SOLD.json`).

If no IDs are provided, ask the user for the ID(s).
