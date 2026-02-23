---
name: frontend-design
description: Create high-performance, analytical frontend interfaces for financial data, backtesting, and portfolio simulation. Use this skill when the user asks to build dashboards, interactive charts, financial metric cards, or data-dense trading interfaces. Ensures a "Terminal-grade" or "Modern Fintech" aesthetic that prioritizes clarity, precision, and professional trust.
---

This skill guides the creation of production-grade financial interfaces that avoid "generic dashboard" aesthetics. It prioritizes data density, mathematical legibility, and interactive visualization.

## Design Thinking for Finance

Before coding, establish a functional hierarchy for the analytical data:
- **The Lead Metric**: What is the "North Star" number? (e.g., CAGR or Total Return).
- **The Comparison Context**: How do we visually separate strategy results from the benchmark?
- **Tone**: Choose a professional direction:
    - **Bloomberg-Terminal**: Dark mode, high density, monospaced fonts, tactical borders (High Trust).
    - **Modern Neo-Bank**: High contrast, generous whitespace, soft shadows, rounded geometry (Friendly/Accessible).
    - **Quantitative Lab**: Minimalist, sub-grid patterns, hairline strokes, "Swiss" style typography (Scientific/Rigorous).

## Frontend Aesthetics for Data Density

### 1. Typography & Numerics
- **Tabular Figures**: Always use fonts with `tnum` (tabular numeric) properties or monospaced fonts (e.g., JetBrains Mono, Roboto Mono, IBM Plex Mono) for data tables and price lists so numbers align vertically.
- **Hierarchy**: Use a clean, neutral Sans-Serif (e.g., Geist, Inter, or Montserrat) for labels, paired with a monospaced font for the actual data values.

### 2. Semantic Color Theory
- **Intentionality**: Use colors strictly for meaning. 
    - **Success/Long**: Emerald/Forest Green (not neon).
    - **Danger/Short/Loss**: Crimson/Coral Red.
    - **Neutral/Indicators**: Slate, Indigo, or Gold for Moving Averages.
- **Accessibility**: Ensure red/green indicators remain distinguishable via value (lightness) or secondary icons for color-blind users.

### 3. Financial Component Patterns
- **Metric Cards**: Include "Sparklines" (mini charts) inside cards to show the trend alongside the number.
- **Interactive Charts**: Use Plotly, Recharts, or Lightweight Charts. Implement crosshairs, tooltips that follow the mouse, and "zoom-to-range" functionality.
- **Data Tables**: Implement "sticky" headers and striped rows for high-density historical price lists.

### 4. Motion & Feedback
- **Simulation States**: Use skeleton loaders or progressive "drawing" animations for the equity curve to indicate the backtest is calculating.
- **Micro-interactions**: Subtle hover states on chart data points and smooth transitions when switching between "Logarithmic" and "Linear" scales.

## Spatial Composition
- **The Dashboard Grid**: Use a 12-column grid. Prioritize the main Equity Curve (70% width) while keeping Strategy Parameters and Metrics in sidebars or top-rows.
- **Density over Fluff**: Financial users prefer seeing more data at once over scrolling. Reduce padding in data-heavy views while maintaining a clear visual "grouping" of related stats.

## Technical Guardrails
- **Performance**: Virtualize long lists of trade history (only render visible rows).
- **Responsive Logic**: On mobile, collapse sidebars into drawers but keep the primary Chart interactive.
- **Anti-Patterns**: NEVER use "fun" illustrative icons or playful gradients that undermine the seriousness of financial loss/gain. Avoid generic "Admin Dashboard" templates.

**IMPORTANT**: When generating code, ensure all charts have properly labeled axes, units (%, $), and a legend. A chart without context is a failure in financial design.