---
name: satildi
description: Mark one or more listings as sold by their mobile.de ID. TRIGGER whenever the user writes "satildi" (Turkish for "sold") together with one or more numeric mobile.de IDs, in any order and with or without a leading slash. Examples that MUST trigger this skill: "/satildi 441661357", "441661357 satildi", "satildi 441661357 451474145", "bunlar satildi: 441661357 451474145".
user_invocable: true
---

# Satildi (Mark as Sold)

When the user provides one or more mobile.de listing IDs alongside the word "satildi", run `npm run sell -- <mobileDeId>` for each ID to move the listing from the active JSON file to the SOLD archive. This applies whether the user invokes it as a slash command (`/satildi <id>`) or writes it in natural language (`<id> satildi`, `satildi <id> <id>`, etc.).

## Usage

The user will provide one or more IDs. Examples:
- `/satildi 441661357`
- `/satildi 441661357 451474145 451811120`
- `441661357 satildi`
- `satildi 441661357 451474145`

## Steps

For each provided ID:
1. Run `npm run sell -- <id>` using the Bash tool
2. Report the result to the user

If no IDs are provided, ask the user for the mobile.de ID(s).
