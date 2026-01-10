# iOS Text Selection in xterm.js Terminal - Problem Summary

## Goal
Enable native iOS text selection (long-press → select → copy) in an xterm.js terminal that renders to **canvas** (not DOM text), which is inherently non-selectable.

## Solution Approach
Overlay a transparent `<textarea>` containing the terminal's visible text, positioned exactly over the xterm.js canvas. When the user long-presses:
1. Show the textarea overlay
2. iOS native text selection handles appear
3. User can select and copy text
4. Overlay dismisses on copy or tap outside

## The Problem: Line Height Drift
The overlay text **aligns at the top** but **drifts progressively** toward the bottom of the terminal. By row 30-40, text is visibly misaligned with the canvas underneath.

## Root Cause Analysis
- **xterm.js** measures actual font metrics (`fontBoundingBoxAscent + fontBoundingBoxDescent`) for cell height, producing fractional values like `19.33px` for fontSize 10
- **CSS line-height** in a textarea stacks line boxes sequentially, potentially accumulating fractional pixel rounding errors differently than canvas positioning
- **Absolute positioning** (used for debug markers) at `row * 19.33px` aligns perfectly with xterm text
- **CSS line-height: 19.33px** in the textarea drifts, suggesting browsers round/accumulate fractional line-heights differently

## Key Files
- `src/client/components/TerminalTextOverlay.tsx` - The overlay component
- `src/client/components/Terminal.tsx` - Touch handling (long-press activation)
- `src/client/hooks/useTerminal.ts` - Terminal configuration

## What Works
- Touch interactions (long-press to activate, tap outside to dismiss)
- Red debug lines using absolute positioning align perfectly with xterm rows
- Horizontal alignment (letter-spacing adjustment)

## What Doesn't Work
- Vertical alignment drifts ~1px every few rows due to CSS line-height accumulation vs canvas fractional positioning

## Constraints
- Must use a single `<textarea>` for iOS selection to work (individual `<div>` per line breaks iOS selection)
- Can't use CSS transforms like scaleY (breaks iOS selection handles)
- xterm uses fractional cell heights based on actual font metrics, not simple `fontSize * lineHeight`

## Technical Details

### How xterm.js calculates cell height
xterm's CharSizeService measures the actual font:
```javascript
// From xterm.js source
const boundingBox = ctx.measureText('W')
cellHeight = boundingBox.fontBoundingBoxAscent + boundingBox.fontBoundingBoxDescent
```

This produces values like `19.33px` for fontSize 10, not `10 * 1.4 = 14px`.

### Current textarea positioning
```typescript
// From TerminalTextOverlay.tsx
style={{
  position: 'absolute',
  top: `${canvasPaddingTop}px`,  // 8px padding from .xterm CSS
  left: `${canvasPaddingLeft}px`,
  lineHeight: `${cellHeight}px`,  // Using exact fractional value like 19.33px
  fontSize: `${fontSize}px`,
  // ... other styles
}}
```

### Debug observation
Red marker lines positioned with absolute `top: ${padding + row * cellHeight}px` align perfectly with xterm canvas text. This proves the cellHeight value is correct. The issue is specifically how CSS line-height stacking behaves vs absolute positioning.

## Question for Oracle
How can we make a textarea's line-height stack identically to absolute positioning with fractional pixel values? Or is there an alternative approach to enable iOS native text selection over canvas-rendered text that avoids CSS line-height accumulation errors?
