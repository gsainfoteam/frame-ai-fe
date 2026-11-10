# Guide screenshots

Captured from the actual Frame development UI on 2026-11-10 using Playwright, in an isolated browser profile with the example project `가이드 · 카페 캠페인`.

No real API key, personal data, generation request, or generated output is included. The model list used the public OpenRouter `/api/v1/videos/models` response retrieved on the capture date. Prices and available models may change.

- `workspace.png`: 1440 × 1100, create screen before API connection.
- `models.png`: 660 × 520, model picker with provider logos.
- `references.png`: 652 × 358, expanded reference editor before selecting a file.
- `backup.png`: 936 × 388, history backup and import controls.

When updating these images, use an isolated profile, dismiss transient toasts, and disable screenshot animations. Capture to `output/playwright/`, visually inspect the results, then copy approved images here. Update `src/features/help/guideImages.ts` if dimensions change; the dimensions reserve image space for reliable section links.

The single content source for the in-app guide is `docs/user-guide.md`. Its relative `../public/guide/` image links also work in repository Markdown viewers; the help renderer maps them to `/guide/` for the website.
