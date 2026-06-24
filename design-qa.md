# Design QA

- Source visual truth: `design/source-concept.png`
- Implementation screenshot: `design/implementation-mobile.png`
- Combined comparison: `design/comparison.png`
- Viewport: 390 × 844 CSS pixels
- State: active Café Amazon project, existing editable order, one uploaded menu image
- Capture method: Codex in-app Browser at the native mobile viewport

## Full-view comparison evidence

The combined image compares the source on the left and the implementation on the right at the same 390 × 844 size.

| Surface | Source | Implementation | Result |
| --- | --- | --- | --- |
| Copy and hierarchy | Title → three project facts → name → order → menu → save | Same order and labels | Matched |
| Typography | Bold Thai heading and labels, restrained supporting text | Noto Sans Thai with matching weights and scale | Matched |
| Palette | True white surface, deep green actions, pale green icon circles | Same token family and contrast | Matched |
| Spacing | Open single-column layout with divider-led project facts | Same container model and viewport fit | Matched |
| Controls | Square fields, large textarea, outlined menu action, solid save action | Same anatomy, radii, and full-width treatment | Matched |
| Icons | Consistent green outline icons | Phosphor outline icons with matching size and weight | Matched |
| Responsive fit | Complete form visible in the mobile frame | Complete form fits exactly within 390 × 844 without overflow | Matched |

## Focused region comparison evidence

No separate crop was needed: at 390 × 844 the combined comparison keeps the Thai labels, icons, field borders, counters, buttons, and spacing readable at full size.

## Findings

No actionable P0, P1, or P2 mismatches remain. Live name and order text intentionally differ from the concept's sample content because the fields render persisted user data.

## Patches made

- Reduced project-row height and form gaps so the complete primary flow fits the native viewport.
- Removed the extra admin icon from the user header to preserve the source composition.
- Kept the primary action copy as “บันทึกออเดอร์” for both create and edit states.
- Corrected the tablet admin logout button contrast.

## Core interaction verification

- Opened and closed the menu-image modal.
- Created and updated an order through the rendered form.
- Logged into the admin view and confirmed the active project and order list.
- Verified project creation, open/close API, R2 menu upload, D1 persistence, copy summary, CSV control, and order deletion route.

## Follow-up polish

None required for handoff.

final result: passed
