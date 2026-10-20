# Damage engine: supported scope and evidence

The engine is a versioned training calculation, not a live combat/game-process reader. Source action IDs and complete original effect lines remain available for audit.

Supported strategies: immediate direct neutral/earth/fire/water/air damage (actions 96–100), immediate elemental life steal (91–95), direct fire-based healing (108), and audited ordinary weapon damage lines. Characteristic identities are numeric, not inferred from translated text. Critical bases come from the selected rank's own critical lines; weapon critical bonuses come from weapon metadata.

For each integer base roll, characteristic and Power scale the base. Flat general/elemental damage and critical damage are added after scaling. Spell/weapon and melee/distance multipliers are applied separately with flooring. Fixed resistance (including critical resistance on critical hits) is deducted before percentage resistance. Player percentage resistance is capped at 50%; damage never becomes negative. Neutral uses Strength for offence but has its own resistance key. Healing excludes Power/general damage and never enters the aggregate damage total. Life steal is potential recovery before overheal limits.

Means enumerate every integer roll instead of assuming the midpoint remains exact after flooring. Critical expectations combine the separate normal and critical means. Multi-line totals are withheld if an unsupported line could affect the result. Spell rank, level, AP, range and unverified state criteria remain explicit. Equipment caps use permanent values, not temporary combat buffs.

## Independent reference cases

- [Dofus Builds' own calculator explanation](https://dofusbuilds.com/guides/dofus-3-damage-formula): its published 11–13 fire example with Intelligence 300, Power 50, flat fire 25, spell 15% and melee 10% produces **93–104**. The test uses those independently published inputs and outputs.
- [Dofus pour les Noobs' original mechanics guide](https://www.dofuspourlesnoobs.com/les-dommages.html): its critical fire example yields **245**; the fixed-then-percentage resistance example for a 259 hit yields **264** against fixed 12 and −7%. Other inconsistent numeric examples on that page are not treated as fixtures.

These are community reference checks, not measurements in the current game client. No controlled client measurements were supplied. Complex class-specific interactions are not certified by these cases.

## Explicit limits

Conditional damage, HP-dependent lines, portals, bombs/combo, summons, glyphs, poison, delayed triggers, random groups, target movement, multi-turn rotations, zone falloff, damage redirection and complex states have no universal substitute formula. They remain marked unsupported. Original casting restrictions and targeting masks are inspectable. Buffs derived from real spell IDs are still manual assumptions; selecting one does not prove its targeting/state/stack conditions.

Target HP and pushback resistance are stored but do not establish a validated HP-dependent/pushback strategy. Negative offensive characteristics and unusually large random ranges are not silently extrapolated. The optimizer discards combinations with unknown gear conditions/effects; a bounded search failure is never a proof of global impossibility.
