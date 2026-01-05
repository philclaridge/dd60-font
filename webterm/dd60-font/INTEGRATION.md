# Font Atlas Integration Guide

This document details how to integrate the DD60 font atlas into existing console implementations in the DtCyber repository.

> **Note:** File paths like `webterm/www/...` and `window_x11.c` refer to locations within the [DtCyber](https://github.com/kej715/DtCyber) repository.

---

## Atlas Resolution Strategy

### Recommended Atlas Configurations

| Integration | Character Scale | Pixel Scale | Atlas Size | Use Case |
|-------------|-----------------|-------------|------------|----------|
| Web Canvas (fixed size) | 1× | 1× | 64×64 px | Pixel-perfect, smallest file |
| Web Canvas (zoomable) | 1× | 8× | 512×512 px | Smooth zoom to 8× |
| Web Canvas (ROM + Physics) | 1× | 16× | 1024×1024 px | High detail for glow/bloom |
| Babylon.js (3D scene) | 1× | 8-16× | 512-1024 px | Texture filtering, camera zoom |
| X11 Native | 1× | 1× | 64×64 px | Bitmap fonts, no scaling |
| High-DPI displays | 1× | 2× | 128×128 px | Retina/4K screens |

### Low-Resolution Atlas (1× Pixel Scale)

**Characteristics:**
- Each character cell is exactly 8×8 pixels (at character scale 1×)
- Total atlas: 64×64 pixels for 8×8 grid
- File size: ~2-5 KB PNG

**Best for:**
- Fixed-size console displays with no zoom
- Authentic pixel-perfect DD60 appearance
- X11 bitmap font replacement
- Memory-constrained environments

**Limitations:**
- Pixelates when scaled up (browser zoom, CSS transform)
- Cannot represent sub-pixel CRT effects (glow, bloom)
- Sharp edges instead of analog softness

**Canvas usage:**
```javascript
// Pixel-perfect rendering - disable smoothing
ctx.imageSmoothingEnabled = false;
ctx.drawImage(atlas, srcX, srcY, 8, 8, destX, destY, 8, 8);
```

### High-Resolution Atlas (8× to 16× Pixel Scale)

**Characteristics:**
- Each character cell is 64×64 pixels (8× scale) or 128×128 pixels (16× scale)
- Total atlas: 512×512 px (8×) or 1024×1024 px (16×)
- File size: ~50-200 KB PNG

**Best for:**
- Zoomable console interfaces
- CRT physics emulation (beam glow, phosphor bloom, analog softness)
- 3D rendering (Babylon.js) where camera can approach display
- High-DPI/Retina displays
- Future-proofing for enhanced visual effects

**Advantages:**
- Smooth appearance at any zoom level
- Sub-pixel detail for CRT effects baked into atlas
- Anti-aliased edges possible
- Phosphor glow can extend beyond character cell boundary

**Canvas usage:**
```javascript
// High-res atlas scaled down for display
// Enable smoothing for quality downscaling
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// Draw 64×64 source to 8×8 destination (8× atlas)
ctx.drawImage(atlas, srcX, srcY, 64, 64, destX, destY, 8, 8);

// Or for zoomed view (4× zoom = 32×32 destination)
ctx.drawImage(atlas, srcX, srcY, 64, 64, destX, destY, 32, 32);
```

### ROM + Physics Atlas Considerations

Future ROM + Physics mode will bake these effects into the atlas:
- **Beam velocity brightness**: Corners brighter where beam slows
- **Phosphor bloom**: Glow extending beyond stroke edges
- **Analog softness**: Rounded corners from deflection bandwidth limits

**Resolution requirements for CRT effects:**

| Effect | Minimum Pixel Scale | Reason |
|--------|---------------------|--------|
| Sharp vector strokes | 1× | Single pixel lines |
| Anti-aliased strokes | 2× | Sub-pixel edge smoothing |
| Basic glow | 4× | 2-pixel glow radius |
| Full phosphor bloom | 8-16× | 4-8 pixel glow radius with falloff |

**Cell boundary consideration:**
At low resolution, glow is clipped at cell boundary. High-resolution atlas with origin offset (1 unit margin) provides space for effects to extend beyond the character strokes.

### PNG Format Options

Three format options, each suited to different integration needs:

#### Option A: Opaque Black Background + Colored Foreground (Current)

```
Background: RGB(0,0,0) Alpha=255 (opaque black)
Foreground: RGB(144,238,144) Alpha=255 (opaque green #90EE90)
```

**Pros:**
- Simplest to generate and use
- Direct `drawImage()` works without compositing
- Smallest file size (no alpha channel needed if saved as RGB PNG)

**Cons:**
- Cannot composite over non-black backgrounds
- Phosphor color baked in, cannot change at runtime
- No glow/bloom falloff possible

**Best for:** Fixed black-background console displays

---

#### Option B: Transparent Background + Colored Foreground (Recommended)

```
Background: RGBA(0,0,0,0) - fully transparent
Foreground: RGBA(144,238,144,255) - opaque green
```

**Pros:**
- Can composite over any background
- Direct color appearance (no tinting needed)
- Supports basic glow with semi-transparent pixels

**Cons:**
- Phosphor color still baked in
- Requires RGBA PNG (slightly larger)

**Best for:** Most web integrations, overlays on backgrounds

**Canvas usage:**
```javascript
// Composites correctly over any background
ctx.drawImage(atlas, srcX, srcY, cellSize, cellSize, destX, destY, cellSize, cellSize);
```

---

#### Option C: Transparent Background + White/Gray + Alpha Intensity (ROM + Physics)

```
Background: RGBA(0,0,0,0) - fully transparent
Foreground: RGBA(255,255,255,A) where A encodes brightness
  - Stroke center: A=255 (full intensity)
  - Glow falloff: A=128→64→32→0 (decreasing intensity)
```

**Pros:**
- Maximum flexibility for runtime colorization
- Brightness variations preserved in alpha
- Can tint to any phosphor color (green, amber, white)
- Ideal for ROM + Physics mode with bloom/glow

**Cons:**
- Requires compositing with color tint at runtime
- More complex integration code

**Best for:** ROM + Physics mode with phosphor effects

**Canvas usage:**
```javascript
// Method 1: globalCompositeOperation
ctx.globalCompositeOperation = 'source-over';
ctx.drawImage(atlas, srcX, srcY, cellSize, cellSize, destX, destY, cellSize, cellSize);
ctx.globalCompositeOperation = 'source-atop';
ctx.fillStyle = '#90EE90';  // Phosphor green
ctx.fillRect(destX, destY, cellSize, cellSize);

// Method 2: Offscreen canvas with multiply blend
// Draw atlas to offscreen, then blend with color
```

**WebGL/Babylon.js usage:**
```javascript
// Shader multiplies atlas alpha by phosphor color
gl_FragColor = vec4(phosphorColor.rgb, texture2D(atlas, uv).a);
```

---

#### Brightness Encoding Summary

| Format | RGB Channels | Alpha Channel | Color Flexibility |
|--------|--------------|---------------|-------------------|
| A: Opaque | Phosphor color | Unused (255) | None |
| B: Transparent colored | Phosphor color | On/Off (0 or 255) | None |
| C: Alpha intensity | White (255,255,255) | Brightness (0-255) | Full runtime tint |

**Recommendation:**
- Use **Option B** (transparent + colored) for current Character ROM mode
- Implement **Option C** (alpha intensity) for future ROM + Physics mode

### Client Code Compatibility

**Key insight:** On black backgrounds (standard DD60), Formats A and B are interchangeable with identical client code.

| Client Background | Format A | Format B | Format C |
|-------------------|----------|----------|----------|
| Black (DD60 standard) | Works | Works | White chars (needs tint) |
| Non-black | Black squares | Works | White chars (needs tint) |

**Unified client code for Formats A & B:**
```javascript
// This code works identically with Format A or B atlas
// As long as background is black, results are identical
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(atlas, srcX, srcY, cellSize, cellSize, destX, destY, cellSize, cellSize);
```

**Format C requires additional colorization:**
```javascript
// Format C needs tinting - cannot use same code as A/B
function drawCharFormatC(ctx, atlas, srcX, srcY, destX, destY, cellSize, phosphorColor) {
    // Draw to temp canvas, then tint
    tempCtx.clearRect(0, 0, cellSize, cellSize);
    tempCtx.drawImage(atlas, srcX, srcY, cellSize, cellSize, 0, 0, cellSize, cellSize);
    tempCtx.globalCompositeOperation = 'source-in';
    tempCtx.fillStyle = phosphorColor;
    tempCtx.fillRect(0, 0, cellSize, cellSize);
    ctx.drawImage(tempCanvas, destX, destY);
}
```

**Platform-specific Format C support:**

| Platform | Format C Support |
|----------|------------------|
| Web Canvas 2D | Requires compositing (see above) |
| Babylon.js | Shader-based tint (easy) |
| X11 Native | Requires XRender or manual blending (complex) |

**Practical recommendation:**
- Generate **Format B** as the standard atlas (works everywhere on black bg)
- Generate **Format C** only when ROM + Physics mode is implemented
- Client code can use same `drawImage()` for A/B, add colorization path for C

### Multiple Atlas Strategy

For optimal flexibility, generate and deploy multiple atlases:

```
generated/
├── dd60-atlas-c1-p1.png    # 64×64 - pixel-perfect fallback
├── dd60-atlas-c1-p8.png    # 512×512 - standard zoomable
├── dd60-atlas-c1-p16.png   # 1024×1024 - ROM + Physics mode
├── dd60-atlas-c2-p1.png    # 128×128 - double size characters
└── dd60-atlas-c4-p1.png    # 256×256 - quad size characters
```

**Runtime selection:**
```javascript
function selectAtlas(config) {
    if (config.crtEffects) {
        return 'dd60-atlas-c1-p16.png';  // Need high res for glow
    } else if (config.allowZoom) {
        return 'dd60-atlas-c1-p8.png';   // Smooth zoom support
    } else {
        return 'dd60-atlas-c1-p1.png';   // Pixel-perfect, fast
    }
}
```

---

## Target Implementations (DtCyber repo)

| Implementation | File (DtCyber repo) | Current Method | Integration Approach |
|----------------|---------------------|----------------|---------------------|
| Web Canvas (2D) | `webterm/www/js/console.js` | `fillText()` | Replace with atlas texture lookup |
| Web Babylon (3D) | `webterm/www/js/console.js` | `DynamicTexture` | Use atlas as texture source |
| X11 Native | `window_x11.c` | `XDrawString()` | Load atlas bitmap, use XPutImage |

## Atlas File Format

### Generated Files
- **PNG**: 8×8 grid containing 64 CDC characters
- **Naming**: `dd60-atlas-c{charScale}-p{pixelScale}.png`

### Character Layout
```
Position in 8×8 grid (row-major order):
00: (space)  01: A  02: B  03: C  04: D  05: E  06: F  07: G
08: H        09: I  10: J  11: K  12: L  13: M  14: N  15: O
16: P        17: Q  18: R  19: S  20: T  21: U  22: V  23: W
24: X        25: Y  26: Z  27: 0  28: 1  29: 2  30: 3  31: 4
32: 5        33: 6  34: 7  35: 8  36: 9  37: +  38: -  39: *
40: /        41: (  42: )  43: =  44: ,  45: .  46-63: (unused)
```

### Character Lookup
```javascript
// CDC character set mapping
const CDC_CHARACTERS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-*/()=,.';

function getCharIndex(char) {
    const index = CDC_CHARACTERS.indexOf(char);
    return index >= 0 ? index : 0; // Default to space
}

function getAtlasCoords(charIndex, cellSize) {
    const col = charIndex % 8;
    const row = Math.floor(charIndex / 8);
    return {
        x: col * cellSize,
        y: row * cellSize,
        width: cellSize,
        height: cellSize
    };
}
```

---

## Web Canvas 2D Integration

### Current Code Pattern
```javascript
// Current approach in console.js
ctx.font = '14px "Lucida Typewriter"';
ctx.fillText(char, x, y);
```

### Atlas Integration
```javascript
// Load atlas once
const atlasImage = new Image();
atlasImage.src = 'generated/dd60-atlas-c1-p1.png';

// Draw character from atlas
function drawChar(ctx, char, destX, destY, cellSize) {
    const index = getCharIndex(char);
    const src = getAtlasCoords(index, cellSize);

    ctx.drawImage(
        atlasImage,
        src.x, src.y, src.width, src.height,  // Source rect
        destX, destY, cellSize, cellSize       // Dest rect
    );
}
```

### Scaling Considerations
- Use atlas with matching `characterScale` for DD60 hardware sizes
- Use `pixelScale` atlas variants for high-DPI displays
- Canvas `imageSmoothingEnabled = false` for crisp pixels

---

## Web Babylon.js Integration

### Current Code Pattern
```javascript
// DynamicTexture inherits from 2D canvas
const texture = new BABYLON.DynamicTexture('consoleTexture', ...);
const ctx = texture.getContext();
ctx.fillText(char, x, y);
texture.update();
```

### Atlas Integration Options

**Option 1: DynamicTexture with Atlas**
```javascript
// Load atlas as standard texture
const atlasTexture = new BABYLON.Texture('generated/dd60-atlas.png', scene);
atlasTexture.hasAlpha = true;

// Use drawImage on DynamicTexture context
ctx.drawImage(atlasImage, srcX, srcY, cellSize, cellSize, destX, destY, cellSize, cellSize);
texture.update();
```

**Option 2: SpriteManager (for many characters)**
```javascript
// Create sprite manager from atlas
const spriteManager = new BABYLON.SpriteManager(
    'charSprites',
    'generated/dd60-atlas.png',
    maxChars,
    { width: cellSize, height: cellSize },
    scene
);

// Create sprite for each character position
const charSprite = new BABYLON.Sprite('char', spriteManager);
charSprite.cellIndex = getCharIndex(char);
charSprite.position = new BABYLON.Vector3(x, y, 0);
```

---

## X11 Native Integration

### Current Code Pattern
```c
// Current approach in window_x11.c
XDrawString(display, window, gc, x, y, &char, 1);
```

### Atlas Integration
```c
// Load atlas as XImage (pseudocode)
XImage *atlasImage = loadPNG("generated/dd60-atlas.png");
int cellSize = 8;  // or 16, 32 for larger scales

void drawCharFromAtlas(Display *dpy, Drawable d, GC gc,
                       char c, int destX, int destY) {
    int index = getCharIndex(c);
    int srcX = (index % 8) * cellSize;
    int srcY = (index / 8) * cellSize;

    XPutImage(dpy, d, gc, atlasImage,
              srcX, srcY,           // Source position
              destX, destY,         // Dest position
              cellSize, cellSize);  // Width, height
}
```

### X11 Considerations
- Convert PNG to XImage format at load time
- Consider XShmPutImage for performance
- May need color depth conversion (RGBA → X11 visual)

---

## Integration Checklist

### Preparation
- [ ] Generate atlas at required scale(s) using generator.html
- [ ] Place atlas file(s) in deployment location
- [ ] Verify atlas dimensions match expected cell size

### Code Changes
- [ ] Add atlas loading code
- [ ] Implement character-to-atlas-position mapping
- [ ] Replace text rendering calls with atlas blits
- [ ] Handle characters not in CDC set (fallback to space)

### Testing
- [ ] Verify all 46 CDC characters render correctly
- [ ] Test at different console sizes/scales
- [ ] Compare visual appearance with original implementation
- [ ] Performance benchmark (atlas should be faster than fillText)

---

## File Locations (DtCyber repo)

When integrated into DtCyber, the file structure is:

```
DtCyber/                           # DtCyber repository
├── webterm/
│   ├── dd60-font/                 # This project (standalone or submodule)
│   │   ├── generator.html         # Atlas generator
│   │   └── INTEGRATION.md         # This file
│   └── www/
│       ├── js/
│       │   └── console.js         # Web console implementation
│       └── generated/             # Output location for atlas files
│           └── dd60-atlas-*.png
└── window_x11.c                   # X11 native console
```
