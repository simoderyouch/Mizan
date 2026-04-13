# Design System Documentation: A Study in Tonal Serenity

## 1. Creative North Star: The Digital Sanctuary
This design system is built upon the concept of **"The Mindful Workspace."** Rather than treating a dashboard as a utility-heavy interface, we view it as a curated editorial environment. The goal is to reduce cognitive load through expansive whitespace, intentional asymmetry, and a rejection of traditional UI "containers."

We move away from the rigid, boxed-in nature of legacy software. Instead, we embrace **Atmospheric Depth**—where elements don't sit *on* a screen, but exist within a layered, luminous space. This system prioritizes the student’s mental state, ensuring that every interaction feels like a deep breath.

---

## 2. Color & Surface Philosophy
The palette is rooted in a "Soft Surface" foundation, using light-refractive blues to establish trust and calm.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for defining sections. Structure must be achieved through:
*   **Tonal Shifts:** Moving from `surface` (#fcf9f8) to `surface-container-low` (#f6f3f2).
*   **Negative Space:** Using generous margins to imply boundaries.
*   **Luminous Depth:** Using light rather than lines to separate content.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper and frosted glass. 
*   **Base Layer:** `surface` (#fcf9f8) - The infinite canvas.
*   **Secondary Content:** `surface-container` (#f0edec) - For sidebar or secondary grouping.
*   **Floating Elements:** `surface-container-lowest` (#ffffff) - Reserved for high-priority cards that need to "pop" via elevation.

### The "Glass & Gradient" Rule
To elevate the experience from "web app" to "premium sanctuary," use **Backdrop Blurs** (20px–40px) on floating navigation docks and modals. 
*   **Signature Gradient:** For primary actions, use a linear transition from `primary` (#004584) to `primary-container` (#005cae) at a 135-degree angle. This adds a "soulful" vibrance that flat hex codes lack.

---

## 3. Typography: Editorial Clarity
We use **Manrope** exclusively. Its geometric yet warm proportions bridge the gap between high-end fashion typography and functional tech.

*   **Display (Large/Med):** 3.5rem / 2.75rem. Use for "Welcome" moments or high-level wellbeing scores. Tighten letter-spacing (-0.02em) for an authoritative, editorial feel.
*   **Headlines:** 2rem to 1.5rem. These are your anchors. Ensure they have significant "breathing room" (top margin) to let the user’s eyes rest.
*   **Body (Large/Med):** 1rem / 0.875rem. Use `on-surface-variant` (#424751) for long-form reading to reduce contrast-induced eye strain.
*   **Labels:** 0.75rem. Always Uppercase with +0.05em tracking when used for metadata or category headers.

---

## 4. Elevation & Depth
In this design system, shadows are not "darkness"—they are **ambient occlusion.**

*   **Tonal Layering:** To separate a card from the background, prefer a color shift (e.g., `surface-container-low` on a `surface` background) over a shadow.
*   **Ambient Shadows:** For interactive cards, use an extra-diffused shadow: `y: 8px, blur: 24px, color: rgba(28, 27, 27, 0.04)`. Note the extremely low opacity; it should feel felt, not seen.
*   **The Ghost Border Fallback:** If a container lacks sufficient contrast (e.g., a white card on a light grey section), apply a 1px border using `outline-variant` (#c2c6d3) at **15% opacity**.
*   **Corner Radii:** Use a "Generous Scale." 
    *   `xl` (2rem/32px): Main dashboard cards.
    *   `lg` (1.5rem/24px): Inner nested elements.
    *   `full` (9999px): Buttons and status chips.

---

## 5. Components

### Buttons & Interaction
*   **Primary:** Rounded (full). Use the Signature Gradient. High-contrast white text (`on-primary`).
*   **Secondary:** No background. Use a "Ghost Border" (15% opacity `outline-variant`) and `primary` text.
*   **Tertiary:** Text-only. Use `primary` color with a subtle `surface-container` background on hover.

### The Wellbeing Card
*   **No Dividers:** Separate header from content using vertical padding (minimum 24px).
*   **Background:** Use `surface-container-lowest` (#ffffff).
*   **Corner Radius:** 32px (`xl`).

### Navigation Dock (Floating)
*   **Style:** Glassmorphic. `background: rgba(255, 255, 255, 0.7)`, `backdrop-filter: blur(20px)`.
*   **Border:** Ghost border (15% opacity) to catch the light.
*   **Shadow:** Large, diffused ambient shadow.

### Input Fields
*   **Structure:** Soft-fill backgrounds (`surface-container-highest`) rather than outlined boxes.
*   **Focus State:** Shift background to `primary-fixed` (#d5e3ff) with a 2px soft glow, rather than a hard stroke.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Asymmetry:** Let a progress chart be larger than a secondary stat card to create visual rhythm.
*   **Use Tonal Transitions:** Use `surface-dim` to transition between major content blocks.
*   **Prioritize Manrope’s Medium Weight:** Use for body text to maintain the premium, "bold" look without the bulk of a heavy font.

### Don't:
*   **Never use 100% Black:** Always use `on-background` (#1b1c1b) for text to keep the interface "soft."
*   **Avoid Grid Rigidity:** Don't feel forced to fill every column. Whitespace is a functional component of a "Sanctuary."
*   **No Hard Edges:** Avoid `0px` or `4px` radii. Everything should feel organic and touchable.
*   **No High-Contrast Dividers:** If you need a horizontal break, use a 4px height `surface-variant` bar with rounded ends, rather than a 1px black line.