# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

- Only push when explicitly asked
- Before pushing, ask if interactive rebase is desired to squash commits

## Project Overview

DD60 Font Atlas Generator - a browser-based tool for generating bitmap font atlases that emulate the visual characteristics of the CDC 6600's DD60 vector CRT display. The project simulates analog CRT effects including beam physics, deflection filter response, and phosphor characteristics.

## Development

**Running the generator:** Open `webterm/dd60-font/generator.html` directly in Chrome (no build step required).

**Type checking:** Uses JSDoc annotations with TypeScript checking. All `.js` files include `// @ts-check`. Run `npx tsc --noEmit` from `webterm/dd60-font/` to validate types.

## Architecture

### Core Files (in `webterm/dd60-font/`)

- `generator.html` - Main entry point with embedded module script
- `config.js` - Constants, defaults, and CDC character set mapping
- `controlBinder.js` - UI control binding logic
- `tableUpdater.js` - ROM data table rendering

### Renderer System (`renderers/`)

Four rendering modes implemented as separate modules conforming to `types.js` interface:

| Mode | File | Description |
|------|------|-------------|
| Font | `fontMode.js` | System font via `fillText()` |
| Character ROM | `vectorMode.js` | Fixed-width strokes from CDC ROM vectors |
| ROM + Physics | `crtMode.js` | Beam physics simulation with solid spot rendering |
| ROM + Gaussian | `gaussianMode.js` | Physics simulation with Gaussian spot and float accumulation |

Shared physics code in `physics.js`. Each renderer exports `renderAtlas()`, `renderCharacter()`, and `supportedControls`.

### ROM Data (`rom/`)

- `binary.js` - CDC 6602 character ROM in authentic binary format (V1, V2, H1, H2, U encoding)
- `decoder.js` - Converts ROM binary to vector triplets `[x, y, intensity]`

### Key Coordinate Systems

**CDC coordinates:** 0-6 range, bottom-left origin, Y-up
**Canvas coordinates:** Top-left origin, Y-down (requires inversion)

**Scaling terminology:**
- `characterScale` (1/2/4) - Multiplies base 8×8 grid, applied BEFORE physics filtering
- `pixelScale` (1-16) - Output resolution multiplier

### Vector Triplet Format

Triplets `[x, y, intensity]` where `intensity=1` means draw line FROM previous position TO (x,y), `intensity=0` means move invisibly. Always track previous position starting at origin (0,0).

## Physics Simulation (ROM + Physics mode)

Signal path matches hardware: ROM → characterScale → biquad filter → pixels

Key parameters in `crtMode.js`:
- X/Y biquad filter (cutoff, Q factor) - simulates deflection amplifier bandwidth
- Z IIR filter (retention) - simulates beam intensity settling
- Subsample factor - replicates ROM rows for filter resolution

## Integration Context

This project generates atlas PNGs for *potential* use in [DtCyber](https://github.com/kej715/DtCyber) console emulators.

## Documentation (in `webterm/dd60-font/`)

- [README.md](webterm/dd60-font/README.md) - Project overview, approach, and implementation progress
- [DD60.md](webterm/dd60-font/DD60.md) - Hardware specifications, ROM encoding, CRT physics research
- [PHYSICS.md](webterm/dd60-font/PHYSICS.md) - CRT physics emulation design and algorithm details
- [INTEGRATION.md](webterm/dd60-font/INTEGRATION.md) - Atlas format options and client code examples
