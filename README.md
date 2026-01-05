# DD60 Font Atlas Generator

Browser-based font atlas generator emulating the vector CRT display of the CDC 6600's DD60 console.

## Quick Start

**Online:** [Run the generator](https://philclaridge.github.io/dd60-font/webterm/dd60-font/generator.html) via GitHub Pages (Chrome recommended)

**Local:** Clone the repository and open [`webterm/dd60-font/generator.html`](webterm/dd60-font/generator.html) in Chrome

## Rendering Modes

| Mode | Description |
|------|-------------|
| **ROM + Gaussian Spot** | Physics simulation with Gaussian spot (highest fidelity) |
| **ROM + Vector Strokes** | Authentic CDC 6602 ROM data (best for smallest fonts) |
| **ROM + Solid Spot** | Physics simulation with solid spot (stroke path debugging) |
| **System Font** | Lucida Typewriter via fillText (layout framework debugging) |

## Usage

The generator can be used to create offline font atlas textures (PNG files) for use in emulators or games. Since the rendering code is JavaScript, it could also be integrated directly into a display application to regenerate textures in real-time, allowing users to adjust brightness, focus, and other CRT parameters dynamically.

## Documentation

- [README.md](webterm/dd60-font/README.md) - Detailed project documentation
- [DD60.md](webterm/dd60-font/DD60.md) - Hardware specifications and research
- [PHYSICS.md](webterm/dd60-font/PHYSICS.md) - CRT physics emulation design
- [INTEGRATION.md](webterm/dd60-font/INTEGRATION.md) - Atlas integration guide

---
© 2025 Phil Claridge, with contributions from Claude Code (Opus 4.5)