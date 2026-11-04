# Interface decisions and verification

The active product has three related experiences: quiet reading, an author writing workspace, and operational administration. Shared DaisyUI/Tailwind tokens provide cards, fields and buttons without wrapping every element in a custom component. Standard reader/account pages share navigation; chapter reading and block authoring keep focused controls. Administration has its own persistent navigation. Unknown routes offer a recovery page.

Authentication shares an accessible layout, password controls, verification-code input and resend behavior. The ineffective Remember me checkbox and template branding were removed. Files remain local until an explicit save; chapter autosave, the mature block editor and navigation protection retain their earlier behavior. Author book management now uses real bounded search/status filters and deterministic pagination, visible failure/retry states and chapter expansion. Older author posts paginate rather than silently stopping at 100.

The shared access hook scopes permission snapshots to identity and retry attempt. Hydrating the same saved identity no longer remounts an editor, while logout or switching identity removes its contents immediately. A restoration barrier prevents parallel requests from using a newly issued token before profile verification finishes. Recoverable profile outages clear that incomplete token but preserve the non-secret saved ID for retry. These fixes have component and browser regression coverage. Backend authorization remains authoritative.

## Accessibility and visual checks

- Semantic headings, labeled fields/actions, native spoiler details, visible keyboard focus and focusable skip-link targets.
- Named password visibility controls and consistent loading/error/empty/retry states; drag-and-drop retains keyboard/move-button alternatives.
- Reviewed light/dark primary colors. The original dark accent measured 3.59:1 for small text; it was replaced with a higher-contrast color. Toast text no longer fades through low-contrast intermediate states.
- Reduced-motion support, wrapping long titles/links, contained wide admin tables and viewport-bounded dialogs.
- Headed axe-core checks at 33 rendered states across auth, public reading/discovery, library/account, author management and administration. The suite checks WCAG A/AA tags through 2.2; this is automated evidence, not a conformance certification or a screen-reader audit.
- Actual desktop (1280), tablet (768) and mobile (390) screenshots, dark mobile author management, mobile admin pricing and built mobile reading were inspected. Five metric cards were compacted into a two-column mobile grid so writing controls appear sooner. Physical touch devices, all browsers, maximum-size chapter memory and every transient state were not exhaustively tested.

Screenshots/traces are ignored under `frontend/test-results/` and `frontend/compose-results/`; focused runs replace earlier artifacts. See [exact commands/results](../mvp/TEST_REPORT.md).

## Performance and maintenance

Routes load on demand; readers do not load admin/chat/studio pages up front. The production main JavaScript artifact dropped from roughly 761 kB / 234 kB gzip to 409 kB / 133 kB gzip. The optional writing engine remains approximately 998 kB / 308 kB gzip and is loaded on demand. These are bundle measurements, not a latency benchmark. The existing non-failing large author-engine and DaisyUI CSS warnings remain documented.

The old unreferenced catalog store/service were retired after import searches confirmed the active pages use the typed resource/publishing modules. This removes duplicate request paths and raw-response console logging. Significant domain architecture remains in [the architecture index](README.md); this pass does not replace the framework or introduce a UI framework abstraction.
