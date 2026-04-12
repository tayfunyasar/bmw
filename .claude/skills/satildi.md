---
name: satildi
description: Mark one or more listings as sold by their mobile.de ID
user_invocable: true
---

# Satildi (Mark as Sold)

When the user provides one or more mobile.de listing IDs, run `npm run sell -- <mobileDeId>` for each ID to move the listing from the active JSON file to the SOLD archive.

## Usage

The user will provide one or more IDs as arguments. Examples:
- `/satildi 441661357`
- `/satildi 441661357 451474145 451811120`

## Steps

For each provided ID:
1. Run `npm run sell -- <id>` using the Bash tool
2. Report the result to the user

If no IDs are provided, ask the user for the mobile.de ID(s).
