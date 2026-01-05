# DD60 Vector Display Emulation

Experimental work for realistic vector-based graphic text emulation reflecting the operation of the original DD60 terminal as part of the CDC 6600.

> **Note:** This project is standalone and can be run independently, but is designed for future integration with the [DtCyber](https://github.com/kej715/DtCyber) repository. References to files outside this directory (e.g., `webterm/www/...`) refer to paths within the DtCyber repo.

## Background

The DD60 is a vector CRT display where characters exhibit real-world artifacts due to:
- **Beam velocity** variations over the CRT phosphor
- **Analog characteristics** of the X/Y deflection system

## Goals

Faithfully reproduce the visual characteristics of the DD60 vector display in browser-based console emulators.

## Scope

- **Primary focus:** Web-based console screens (Canvas/Babylon.js)
- **Future consideration:** X11 native console

---

## Existing Implementation Reference

Current console implementations in the DtCyber repo use raster fonts with no vector or phosphor simulation.

| Implementation | Key Files (DtCyber repo) | Method | Font |
|----------------|--------------------------|--------|------|
| Web Canvas (2D) | `webterm/www/js/console.js` | `fillText()` | Lucida Typewriter |
| Web Babylon (3D) | `webterm/www/js/console.js` | Inherits 2D as `DynamicTexture` | Lucida Typewriter |
| X11 Native | `window_x11.c` | `XDrawString()` | X11 bitmap fonts |

**Key observation:** No vector stroke data or beam simulation exists in current DtCyber code.

---

## Approach: Pre-rendered Font Atlas

### Concept

Generate a bitmap texture (font atlas) containing all 64 CDC characters at multiple resolutions. Beam width and brightness effects are pre-computed and baked into the texture, enabling:

- Fast runtime rendering via texture lookups
- Pre-baked beam effects (width variations, brightness gradients)
- Compatibility with both Canvas 2D and WebGL/Babylon.js
- Sub-pixel detail for analog "softness" and phosphor glow

### Implementation

All character generation code written in **JavaScript** using Canvas APIs, ensuring consistent rendering between generation tool and runtime console.

### Coding Standards

**Static Type Checking:** JSDoc annotations with TypeScript checking

- All `.js` files include `// @ts-check` directive at top
- Functions documented with JSDoc type annotations
- TypeScript compiler validates types without transpilation
- No build step required - runs directly in browser
- `tsconfig.json` in project directory for IDE integration

**Benefits:**
- Full IDE type checking and autocomplete
- No compilation step - same code runs in browser
- Gradual adoption - add types incrementally
- Works for both Phase 1 (offline) and Phase 2 (online)

### Development Phases

**Phase 1: Offline Font Atlas Generation (Current Focus)**
- Web page (`generator.html`) with visual preview
- Static PNG atlas files generated via browser download
- Iterative refinement of beam/phosphor effects
- Output placed in `webterm/www/generated/` (DtCyber repo)

**Phase 2: Interactive Online Generation (Long-term Goal)**
- Same generation code with enhanced UI
- Interactive adjustment of beam characteristics
- Real-time preview of parameter changes
- Export of customized atlas files

### Why Web-Based Generation

- **Single codebase** - No separate Node.js implementation
- **Visual development** - Immediate feedback while adjusting parameters
- **Native Canvas API** - Same rendering as runtime console
- **Zero dependencies** - No native modules required
- **Path to Phase 2** - Already structured for interactive use

Note: "Offline" refers to *when* the atlas is used (pre-generated assets), not *how* it is generated.

### Generation Workflow

1. Open `generator.html` in browser
2. Adjust rendering parameters with live preview
3. Click "Download PNG" to save atlas file
4. For DtCyber integration: place files in `webterm/www/generated/` (DtCyber repo)

### Atlas Structure

- **Layout:** 8x8 grid = 64 characters
- **Files:** Separate PNG per font size (small, medium, large)
- **Metrics:** JSON file with glyph positions and dimensions

### Stroke Source Data

Options for defining vector paths:
1. Original CDC documentation/ROMs
2. Photograph tracing
3. Specification recreation

### Simulatable Effects

- **Beam velocity** - Variable brightness based on stroke speed
- **X/Y deflection** - Analog positioning artifacts
- **Phosphor saturation** - Intensity limiting and bloom
- **Stroke width variation** - Beam focus changes

### Brightness Encoding

| Method | Description |
|--------|-------------|
| Grayscale | Brighter pixels where beam moves slower |
| Alpha channel | Glow falloff for compositing |
| RGB + Alpha | Color core with alpha halo |

### Phosphor Glow Options

1. **Baked into atlas** - Glyph bounds include falloff (simple, fixed)
2. **Post-process shader** - Runtime bloom (flexible, requires WebGL)

### Future Runtime Enhancements

- Phosphor decay via frame layering
- Refresh flicker simulation
- Edge focus variation
- WebGL glow shaders

---

## Reference Materials

### DD60 Technical Specifications

See **[DD60.md](DD60.md)** for comprehensive DD60 display research including:

- **Hardware specifications**: CRT model (K2263-P31), P31 phosphor characteristics, electrostatic deflection system, 3CX100A5 deflection amplifiers
- **Vector character generator**: 8×8 base grid, 100ns stroke segments, CDC 6602 ROM encoding format with decoding algorithm
- **Analog signal chain**: 600-800 kHz bandwidth, 2nd order low-pass filter response, rise/fall times
- **Visual characteristics**: Corner rounding (10-12%), brightness variations (1.5-2× at corners), beam velocity effects
- **Phosphor physics**: P31 decay curves, bloom radius, halation patterns
- **Timing specifications**: 100ns per stroke segment, beam settling time analysis, empty row timing delays
- **Modern emulation research**: Analysis of BlurBusters, vector display simulation projects, shader techniques
- **Primary sources**: CDC 6600 circuit diagrams, J.E. Thornton design documents, video references

Reference this document for hardware-accurate implementation parameters and validation metrics.

---

## Implementation Details

### Coordinate Systems

**CDC Coordinates:**
- Character coordinates: 0-6 (bottom-left origin, Y up)
- Screen coordinates: 0-511 (bottom-left origin, Y up)
- Hardware authentic 7×7 character ROM on 8×8 display grid

**Canvas Coordinates:**
- Origin: Top-left (0,0)
- Y Direction: Increases downward (inverted from CDC)
- Range: Depends on pixel scale (512 to 2048 pixels for full DD60 display)

### Scaling Terminology

**Character Scale**: Multiplier applied to the base 8×8 character grid.
- UI values: 1× Normal, 2× Double, 4× Quad
- Code variable: `CONFIG.characterScale` (values: 1, 2, or 4)

**Cell Size**: The resulting size of each character cell in display units.
- Computed as: `BASE_CELL_SIZE × characterScale` = 8, 16, or 32
- Matches DD60 hardware scaling options

**Pixel Scale**: Output pixels per display unit for high-resolution rendering.
- UI values: 1× to 16×
- Code variable: `CONFIG.pixelScale` (values: 1 to 16, including fractional)
- Affects output resolution without changing character proportions

**Cell Pixel Size**: The rendered size of each character cell in screen pixels.
- Computed as: `cellSize × pixelScale`
- Example: Cell Size 8 at Pixel Scale 1.5× = 12×12 pixels

**Beam Width Behavior**:
- Beam width is defined in display units (e.g., 0.5 units)
- **Character Scale ↑**: Beam pixels unchanged, appears thinner relative to character
- **Pixel Scale ↑**: Beam pixels increase proportionally, same apparent thickness

| Character Scale | Cell Size | Pixel Scale | Cell Pixel Size | Atlas Canvas   |
|-----------------|-----------|-------------|-----------------|----------------|
| 1× Normal       | 8         | 1×          | 8×8 px          | 64×64 px       |
| 1× Normal       | 8         | 2×          | 16×16 px        | 128×128 px     |
| 1× Normal       | 8         | 8×          | 64×64 px        | 512×512 px     |
| 2× Double       | 16        | 1×          | 16×16 px        | 128×128 px     |
| 4× Quad         | 32        | 1×          | 32×32 px        | 256×256 px     |
| 4× Quad         | 32        | 4×          | 128×128 px      | 1024×1024 px   |

### Code Variable Naming

| Variable | Value | Description |
|----------|-------|-------------|
| `BASE_CELL_SIZE` | 8 (constant) | Base cell size in display units |
| `GRID_CELLS` | 8 (constant) | Grid dimensions (8×8 = 64 character cells) |
| `CONFIG.characterScale` | 1, 2, or 4 | Character scale multiplier |
| `CONFIG.pixelScale` | 1 to 16 | Pixel scale multiplier (can be fractional) |
| `cellSize` | 8, 16, or 32 | Computed: `BASE_CELL_SIZE × characterScale` (display units) |
| `cellPixelSize` | varies | Computed: `cellSize × pixelScale` (pixels) |
| `atlasSize` | 64, 128, or 256 | Computed: `GRID_CELLS × cellSize` (display units) |
| `canvasSize` | varies | Computed: `atlasSize × pixelScale` (atlas in pixels) |

### Origin Offset

Character origin (0,0) is offset 1 base unit up and right from cell bottom-left to allow margin for beam effects (overshoot, bloom):

| Cell Size | Origin Offset | Position from cell bottom-left |
|-----------|---------------|--------------------------------|
| 8         | (1,1)         | 1 unit margin                  |
| 16        | (2,2)         | 2 unit margin                  |
| 32        | (4,4)         | 4 unit margin                  |

This ensures beam artifacts extending below/left of character strokes are not clipped.

### Vector Triplet Interpretation

**Critical:** The triplet format `[x, y, intensity]` must be interpreted correctly to avoid rendering bugs.

**Correct interpretation:**
- `intensity=1`: Draw visible line **FROM previous position TO (x,y)**
- `intensity=0`: Move invisibly to (x,y), no line drawn
- Always start at origin (0,0) before processing first triplet
- Always update previous position after each triplet

**Common bug (caused 'E' to render like 'F' with disconnected bottom):**

```javascript
// WRONG - tracking beam state separately
let beamOn = false;
for (const [x, y, intensity] of triplets) {
    if (intensity === 1 && !beamOn) {
        beamOn = true;  // Just turned on, start new path
    } else if (intensity === 1 && beamOn) {
        drawLineTo(x, y);  // Continue drawing
    }
    // This misinterprets the data!
}
```

**Correct implementation:**

```javascript
// CORRECT - intensity means "draw FROM prev TO current"
let prevX = 0, prevY = 0;  // Start at origin

for (const [x, y, intensity] of triplets) {
    if (intensity === 1) {
        // Draw line FROM previous TO current
        drawLine(prevX, prevY, x, y);
    }
    // intensity=0: move invisibly (no drawing)

    // Always update previous position
    prevX = x;
    prevY = y;
}
```

**Key insight:** The `intensity` value describes the **segment just drawn**, not a toggle state. When `intensity=1`, a visible stroke was made from wherever the beam was to the new position.

---

## Implementation Progress

### Completed

- [x] Project structure and documentation (README.md, DD60.md)
- [x] CDC 6602 ROM character data (`rom/binary.js`, `rom/decoder.js`)
- [x] Modular renderer architecture (`renderers/` directory)
- [x] Generator UI (`generator.html`) with:
  - Font Atlas panel (8×8 grid, 64 character cells)
  - Character Detail panel with ROM matrix, vector output, and simplified tables
  - Renderer selection dropdown (Font, Character ROM, ROM + Physics)
  - Character Scale control (1×, 2×, 4×)
  - Pixel Scale control (1× to 16×)
  - Physics filter controls (X/Y Cutoff, X/Y Q Factor, Z Retention)
  - Spot rendering controls (Brightness, Beam Width, Blend Mode)
  - Checkerboard overlay showing display pixel boundaries
  - Origin marker overlay (shows sub-pixel position at fractional scales)
  - PNG download
  - JSDoc type annotations with TypeScript checking
- [x] ROM + Physics mode basic implementation:
  - Biquad filter for X/Y deflection with interactive cutoff and Q controls
  - IIR filter for Z beam intensity with retention control
  - Hardware-accurate signal path (charScale before filtering)
  - Dot brightness modulation based on beam intensity
  - Brightness and beam width controls for spot rendering
  - Blend mode selection (Normal/Additive) for phosphor saturation

### Character Rendering Modes

| Mode | Description | Status |
|------|-------------|--------|
| **Font** | System font via `fillText()` | Complete |
| **Character ROM** | Fixed-width strokes from ROM data, no CRT effects | Complete |
| **ROM + Physics** | Beam physics, velocity brightness, phosphor glow | In Progress |

**Character ROM Mode Features:**
- Draws line segments from CDC ROM vector data
- Fixed 1-pixel stroke width (authentic CDC behavior)
- Proper CDC coordinate (0-6) to canvas coordinate conversion
- Character scaling at 1×, 2×, 4× with correct stroke positioning
- CRISP_LINE_OFFSET for sharp 1px lines at pixel boundaries
- Conditional line caps (butt for thin lines, round for ≥3px)

**ROM + Physics Mode (In Progress):**
- Hardware-accurate signal path: ROM → charScale → filter → pixels
- 2nd-order biquad low-pass filter for X/Y deflection
- 1st-order IIR filter for Z beam intensity
- Character scale applied BEFORE filtering (larger chars = more distortion)
- Interactive controls with real-time preview:
  - X/Y Cutoff: logarithmic (0.0001-0.5), controls corner rounding
  - X/Y Q Factor: (0.3-2.0), controls overshoot/damping
  - Z Retention: (0-0.99), controls beam on/off softness
  - Brightness: (0-3.0), spot intensity multiplier
  - Beam Width: (0-10), spot radius in pixels
  - Blend Mode: Normal (source-over) or Additive (lighter)
- Dot brightness modulated by filtered beam intensity
- Additive blend mode simulates phosphor saturation (white at high intensity)
- See **[PHYSICS.md](PHYSICS.md)** for detailed design

### Reference Files

- **DD60.md** - Hardware specs, ROM encoding, visual characteristics
- **PHYSICS.md** - CRT physics emulation design (ROM + Physics mode)
- **INTEGRATION.md** - Atlas integration guide for DtCyber implementations
- **generator.html** - Font atlas generator with preview UI
- `webterm/www/js/console.js` - Runtime console for integration (DtCyber repo)
