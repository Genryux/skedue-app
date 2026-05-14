# Skedue Design System

This document is the visual source of truth for Skedue.

Use it when designing screens, generating UI prompts, styling React Native components, or making theme decisions. The goal is consistency across hand-built UI and AI-generated mockups.

## 1. Design Summary

Skedue uses an academic-modern visual language:

- warm and organized rather than flashy
- premium but approachable
- minimal, tactile, and student-friendly
- strong hierarchy without heavy shadows
- soft surfaces, subtle borders, and rounded shapes

The UI should feel like high-quality academic stationery translated into a modern mobile app.

## 2. Core Principles

- Prefer calm surfaces over loud gradients.
- Use warm neutrals in light mode to reduce glare.
- Use tinted dark surfaces in dark mode instead of flat black.
- Use the primary brand color sparingly so calls to action stay meaningful.
- Prefer elevation through surface steps and contrast, not heavy shadows.
- Keep cards and panels rounded, soft, and easy to scan.
- Avoid generic startup UI or default system-looking tab bars.
- Preserve the custom dock-style navigation as a signature element.
- Use `Manrope` as the default typeface for the product.

## 3. Theme Systems

Skedue has two approved theme systems:

- `Academic Modern` for light mode
- `Academic Modern Dark` for dark mode

The light palette is the primary brand system.
The dark palette should feel native to the same product, not like a separate visual identity.

## 4. Academic Modern Light

### Backgrounds and Surfaces

- `surface.main`: `#F9F9F6`
- `surface.containerLow`: `#F4F4F1`
- `surface.containerLowest`: `#FFFFFF`

Usage:

- use `surface.main` for app backgrounds
- use `surface.containerLow` for grouped sections and secondary surfaces
- use `surface.containerLowest` for high-elevation cards and sheets

### Primary Branding and CTA

- `brand.primary`: `#1A2F2B`
- `brand.onPrimary`: `#FFFFFF`

Usage:

- use for primary buttons, active pills, and key brand anchors
- use white text and icons on primary actions

### Secondary and Utility

- `secondary.container`: `#E2E9E7`
- `outline.default`: `#DADAD7`

Usage:

- use the secondary container for calm highlighted sections, chips, and soft emphasis
- use outline colors for separation instead of strong borders

### Status and Feedback

- `status.error`: `#BA1A1A`
- `status.errorContainer`: `#FFDAD6`

### Typography Guidance

- `font.family.primary`: `Manrope`
- prefer dark neutral text over pure black
- use strong hierarchy through size and weight, not excess decoration
- use Manrope across headings, labels, buttons, and body copy for consistency

## 5. Academic Modern Dark

### Backgrounds and Surfaces

- `surface.main`: `#0D1513`
- `surface.dim`: `#0D1513`
- `surface.bright`: `#333B38`
- `surface.containerLow`: `#151D1B`
- `surface.containerLowest`: `#08100E`

Usage:

- use `surface.containerLowest` for deepest base layers
- use `surface.containerLow` for cards and grouped surfaces
- use `surface.bright` for subtle emphasis and elevation moments

### Primary Branding and CTA

- `brand.primary`: `#6EDBC1`
- `brand.onPrimary`: `#00382E`

Usage:

- use the mint accent for the most important actions on dark backgrounds
- keep it as the most vibrant visual element on screen

### Secondary and Utility

- `secondary.container`: `#334B45`
- `outline.default`: `#89938F`

### Status and Feedback

- `status.error`: `#FFB4AB`
- `status.onError`: `#690005`

### Typography Guidance

- `font.family.primary`: `Manrope`
- `text.primary`: `#E0E3E1`

Usage:

- prefer off-white text instead of pure white
- preserve readability without harsh contrast fatigue
- keep Manrope as the default typeface in dark mode as well

## 6. Academic Tactile Accent System

This is a supporting accent system for specific screens such as dashboard and schedule views.

### Accent Tokens

- `accent.surfaceWarm`: `#FBF9F8`
- `accent.primary`: `#1A2F2B`
- `accent.softMint`: `#D3E8E1`
- `accent.surfaceDim`: `#DBD9D9`

Usage:

- use selectively for dashboard warmth and category emphasis
- do not let these accents replace the main light/dark systems

## 7. Component Guidance

### Buttons

- primary buttons should use the active brand color
- avoid multiple equally strong CTAs on the same screen
- keep button shapes rounded and substantial

### Cards and Panels

- prefer rounded cards with soft borders
- use subtle surface stepping instead of dramatic shadows
- content should be easy to scan in 2 to 4 seconds
- when shadows are needed, use soft iOS-style shadows with low opacity and a larger blur, plus light Android elevation

### Navigation

- use a floating dock-style bottom navigation instead of a traditional tab bar
- keep the dock soft, rounded, compact, and product-branded
- active state should appear as an inner highlighted pill
- the action button should feel integrated with the dock, not randomly floating

### Empty States

- empty states should feel guided and encouraging
- include one clear next action
- avoid dead or sterile screens

## 8. AI Agent Guidance

When an AI agent designs or codes UI for Skedue, it should:

- default to `Academic Modern` light mode unless the task explicitly calls for dark mode
- use `Academic Modern Dark` for dark-mode explorations
- preserve the custom dock-style navigation pattern
- avoid purple-heavy palettes, neon accents, or generic SaaS dashboard visuals
- favor warm paper-like backgrounds in light mode
- favor teal-tinted charcoal surfaces in dark mode
- use borders and surface contrast before adding shadows
- keep the interface mobile-first and React Native-friendly
- use `Manrope` as the default font family unless a specific exception is defined later

## 9. Suggested Theme Tokens for Implementation

These names are recommended for app code:

- `background`
- `surface`
- `surfaceLow`
- `surfaceLowest`
- `surfaceBright`
- `primary`
- `onPrimary`
- `secondaryContainer`
- `outline`
- `textPrimary`
- `textSecondary`
- `error`
- `errorContainer`
- `fontFamilyPrimary`

This naming keeps the design system easy to map into a theme object later.
