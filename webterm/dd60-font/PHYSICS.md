# CRT Physics Emulation

Implementation of the "ROM + Physics" rendering mode that simulates authentic DD60 CRT visual characteristics.

---

## Overview

The DD60 vector display exhibits distinctive visual artifacts due to analog electronics:

- **Corner rounding** - Deflection amplifier bandwidth limits smooth sharp direction changes
- **Brightness variation** - Beam velocity affects phosphor excitation (slower = brighter)
- **Overshoot/settling** - Analog amplifiers exhibit characteristic step response

**Goal:** Bake these effects into the font atlas at generation time using a unified physics model that naturally produces all visual effects from a single simulation.

---

## Core Approach

Rather than simulate each effect separately, we emulate the actual CRT operation:

1. **Subsample** - Replicate each ROM timing row multiple times
2. **Filter** - Apply IIR low-pass filters to X, Y, and beam intensity
3. **Render** - Draw Gaussian spots additively at each filtered position

This unified model naturally produces all visual effects:

| Effect | Mechanism |
|--------|-----------|
| Corner rounding | Filter smooths step changes in X/Y into rounded arcs |
| Brighter corners | Beam decelerates → spots bunch up → higher intensity |
| Dimmer mid-stroke | Fast beam motion → spots spread apart → lower intensity |
| Soft stroke endpoints | Beam intensity filter creates gradual on/off transitions |
| Overshoot | Filter Q factor produces realistic ringing at direction changes |

**Physical accuracy:** Each Gaussian spot represents phosphor excitation at the beam position. Additive accumulation models photon summation. Filter coefficients can match measured deflection amplifier response.

---

## Hardware Signal Path

Understanding the actual DD60 hardware is critical for accurate simulation:

```
ROM (diode matrix) → Delta decode → Bit shift (charScale) → Accumulator → 9-bit DAC → Analog amplifier → CRT
```

**Key insight:** Character scaling is applied as a bit shift to the delta values BEFORE the DAC. This means the analog amplifier sees larger voltage steps at larger character scales:

| Character Scale | Delta Step at DAC | Filter Effect |
|-----------------|-------------------|---------------|
| 1× | 1 LSB | Baseline rounding |
| 2× | 2 LSB | 2× voltage step, more rounding |
| 4× | 4 LSB | 4× voltage step, pronounced rounding/overshoot |

The simulation must apply character scale BEFORE filtering to match this behavior. Filtering after scaling would incorrectly produce identical rounding regardless of character size.

---

## Algorithm

**Input:** Raw vector data (X, Y, beam state) at ROM timing rate (~23 rows per character)

**Output:** High-resolution intensity buffer in Format C (alpha = intensity)

### Step 1: Scale

Apply character scale multiplier to CDC coordinates (0-6 → 0-6/12/24 depending on scale). This matches the hardware bit-shift that occurs before the DAC.

### Step 2: Subsample

Each ROM timing row is replicated N times (e.g., 64× or 128×). No interpolation is performed - values are simply repeated. This matches the physical hardware where the ROM outputs discrete step changes that the analog system then filters.

### Step 3: Filter

Three IIR filter instances process the subsampled data:

- **X filter** - Horizontal deflection amplifier response (2nd-order biquad)
- **Y filter** - Vertical deflection amplifier response (2nd-order biquad)
- **Z filter** - Beam blanking amplifier response (1st-order IIR)

X and Y filters share common coefficients (same amplifier design) but maintain independent state. The Z filter has separate coefficients as the blanking amplifier typically has different bandwidth. All filter states reset at the start of each character.

### Step 4: Render

At each filtered position where beam intensity is non-zero, draw a Gaussian spot to an accumulation buffer. Spot intensity is scaled by the filtered beam value (0.0 to 1.0). Spots are added to the buffer, not replacing existing values.

### Step 5: Output

Convert the floating-point accumulation buffer to 8-bit alpha using a fixed multiplier. Values exceeding 255 are clipped, simulating phosphor saturation.

---

## Filter System

### Simple 1st-Order Filter

For initial testing, a single-parameter filter with adjustable retention (0.0 to 0.99):

- Retention = 0 produces no filtering (output equals input)
- Retention = 0.9 produces smooth, heavy filtering
- Retention = 0.95 produces very smooth, slow response

Easy to understand and adjust. Cannot produce overshoot.

### 2nd-Order Biquad Filter

For full fidelity, a standard biquad low-pass filter controlled by two parameters:

**Cutoff frequency** (as fraction of sample rate, typically 0.1-0.2):
- Controls amount of corner rounding
- Lower cutoff produces more rounding and slower response

**Q factor** (resonance/damping):

| Q Value | Behavior | Visual Effect |
|---------|----------|---------------|
| 0.5 | Overdamped | No overshoot, sluggish corners |
| 0.707 | Butterworth | Maximally flat, crisp without overshoot |
| 0.8-0.9 | Slight underdamp | Small overshoot, snappy response |
| 1.0+ | Resonant | Visible overshoot at corners |

Real deflection amplifiers typically exhibited slight underdamping (Q ≈ 0.7-0.9).

### Beam Intensity Filter (Z-axis)

The beam blanking amplifier has bandwidth limits - beam on/off is not instantaneous. This filter converts binary beam state to a continuous intensity multiplier:

- Beam turn-on: intensity ramps up over several samples
- Beam turn-off: intensity fades over several samples
- Creates soft stroke endpoints rather than abrupt starts/stops

Simple 1st-order filtering is sufficient. Typically faster response than deflection filters (lower retention value).

### Subsample Factor Adjustments

When subsample factor changes, filter parameters must be adjusted to maintain consistent character appearance.

For 1st-order filters, retention can be directly transformed to maintain the same time constant. For biquad filters, store the specification as physical parameters (cutoff fraction and Q factor) and recalculate coefficients at the new sample rate.

---

## Gaussian Spot Rendering

Each spot represents the phosphor excitation pattern from the electron beam at a single position.

**Spot shape:** Circular Gaussian distribution, or elliptical when astigmatism is applied. Radius of 3σ provides 99.7% energy coverage.

**Accumulation:** Spots are added to a Float32 buffer, not an 8-bit canvas. This provides unlimited dynamic range during accumulation, preventing faint spots from rounding to zero. With ~1,500-3,000 samples per character, adequate precision is essential.

**Intensity:** Fixed base intensity per spot. Brightness variations emerge naturally from spot overlap density - closely spaced spots (slow beam) accumulate higher intensity than widely spaced spots (fast beam).

---

## Analog Display Controls

Three physical CRT controls are emulated:

### Brightness (Beam Current)

Adjusts peak intensity of each Gaussian spot. Higher brightness produces more photons per spot and brighter traces. Does not change spot size.

### Focus (Beam Width)

Adjusts sigma (width) of Gaussian spots. Wider spots spread the same energy over a larger area, so intensity decreases as spot widens (energy conservation). A minimum sigma is enforced - the CRT beam is never infinitely small.

### Astigmatism (Spot Shape)

Makes Gaussian spots elliptical rather than circular by applying different sigma values to X and Y axes. Value of 1.0 produces circular spots. Values above 1.0 produce horizontal elongation; below 1.0 produces vertical elongation. Common artifact on poorly adjusted CRTs.

**Combined effects:** High brightness with tight focus produces sharp, bright traces. Low brightness with defocus produces soft, dim traces.

---

## Output Conversion

### Fixed Multiplier

Conversion from float buffer to canvas uses a fixed multiplier rather than auto-normalization. This allows brightness and focus controls to visibly affect output. The multiplier is calibrated so nominal settings produce approximately 200-220 peak alpha.

### Phosphor Saturation

Clipping at 255 is intentional and simulates real phosphor saturation. High brightness settings will cause clipping at corners and stroke endpoints where intensity naturally peaks. This matches physical CRT behavior where phosphor has a maximum light output regardless of beam current.

---

## Subsample Factor Selection

For continuous traces, Gaussian spots must overlap (spacing ≤ 1σ).

**Analysis:**
- CDC coordinate range is 0-6 (maximum 6 units movement per timing row)
- Maximum beam movement per row = 6 × pixelScale pixels
- IIR filter spreads movement over approximately 5-10 samples
- Target spot spacing: 1-2 pixels (at or below sigma)

**Recommended factors:**

| Pixel Scale | Subsample Factor | Samples per Character |
|-------------|------------------|----------------------|
| 16× | 64× | ~1,500 |
| 32× | 128× | ~3,000 |

**Rule of thumb:** Subsample factor should be approximately 4× the pixel scale.

Higher factors improve smoothness but increase computation. Lower factors may produce visible gaps in traces.

---

## Technical Requirements

**Resolution:**
- Minimum 8× pixel scale for acceptable results
- Recommended 16× pixel scale for full fidelity

**Output format:**
- Format C: White RGB with alpha encoding intensity
- Enables runtime phosphor color selection via CSS/compositing

**Reference values from DD60 hardware:**
- Deflection bandwidth: 600-800 kHz
- Corner brightness increase: 1.5-2× compared to mid-stroke
- Corner rounding: 10-12% of stroke length

---

## Implementation Status

### Completed

- [x] **Phase 1: Basic Simulation**
  - Subsampling (64× row replication)
  - 2nd-order biquad low-pass filter for X and Y deflection
  - Simple dot rendering at filtered positions
  - Corner rounding verified

- [x] **Phase 1.5: Hardware-Accurate Signal Path**
  - Character scale applied BEFORE filtering (matches hardware bit-shift before DAC)
  - Larger characters show more pronounced filter effects (correct behavior)
  - Signal path: ROM → charScale → filter → pixels

- [x] **Phase 1.6: Interactive Filter Controls**
  - X/Y Cutoff: logarithmic slider (0.0001 to 0.5), default 0.02
  - X/Y Q Factor: linear slider (0.3 to 2.0), default 0.707 (Butterworth)
  - Z Retention: linear slider (0 to 0.99), default 0 (no filtering)
  - Dot brightness modulated by filtered beam intensity

- [x] **Phase 1.7: Spot Rendering Controls**
  - Brightness control: intensity multiplier (0 to 3.0), default 1.0
  - Beam width control: spot radius in pixels (0 to 10), default 1.5
  - Blend mode: Normal (source-over) vs Additive (lighter)
  - Additive mode produces white at high intensity (phosphor saturation)

### In Progress

- [ ] **Phase 2: Gaussian Spots**
  - Replace circular dots with Gaussian spot rendering
  - Implement Float32 additive accumulation buffer
  - Natural brightness variation from spot overlap density

### Planned

- [ ] **Phase 3: Advanced Analog Controls**
  - Astigmatism control (elliptical spots)
  - Fixed-multiplier output conversion with saturation clipping

- [ ] **Phase 4: Parameter Tuning**
  - Tune filter coefficients against reference photographs
  - Document final parameter set matching original hardware

---

## Future Considerations

### Overdrive Bloom

When a real CRT is overdriven, bloom effects occur beyond simple additive accumulation:

- **Electron scattering** - High-energy electrons scatter in the phosphor layer, exciting adjacent particles
- **Optical halation** - Light reflects off the back of the glass faceplate, passing back through the phosphor
- **Glass scattering** - Light scatters within the faceplate glass, creating a halo

Could be modeled as post-process Gaussian convolution applied after accumulation, with kernel size and intensity proportional to local brightness, significant only above the saturation threshold.

---

## Validation

1. Generate test atlas with physics rendering enabled
2. Compare character shapes to reference photographs of actual DD60 display
3. Iterate on filter coefficients and spot parameters
4. Document final parameter set that best matches original hardware

---
