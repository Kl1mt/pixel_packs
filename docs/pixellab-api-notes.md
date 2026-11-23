# PixelLab API — condensed notes

Written in T04 (2026-11-23) from `https://api.pixellab.ai/v2/llms.txt`, selected parts of `/v2/openapi.json` (never commit the full spec) and the MCP tool guide (`https://api.pixellab.ai/mcp/docs`). **Measured** costs come from real calls logged in `tools/artgen/manifest.json`; the rest is **documented** and still needs checking against a receipt.

## Access
- Base URL `https://api.pixellab.ai/v2`. Auth: `Authorization: Bearer <token>`.
- In cloud sessions the proxy injects the token. Node's built-in `fetch` only uses the proxy with `NODE_USE_ENV_PROXY=1`, so the `artgen` start script sets it. Locally, set `PIXELLAB_API_KEY` and `artgen` sends it. Never write the key into files.
- `GET /balance` → `{ credits: { type, usd }, subscription: { type: "generations", status, plan, generations, total } }`. `subscription.generations` is what's left. Our plan is Tier 1 "Pixel Apprentice" (2 000 total).
- Errors: `401` no/invalid token · `402` out of generations · `422` bad body · `429` too many concurrent jobs or requests. `artgen` retries `429`/`5xx` and network errors with exponential backoff (2 s, 4 s, 8 s, 16 s) and never retries `4xx`.

## Background jobs
- The Pro image endpoints answer `202 { background_job_id, status: "processing", usage: null }`.
- Poll `GET /background-jobs/{id}` every 5–10 s (we use 8 s). The response is `{ id, status: processing|completed|failed, created_at, usage, last_response }`.
- `usage` is `{ type: "generations", generations: <n> }` once the job is charged.
- While a job waits, `last_response.queue_position` and `last_response.estimated_wait_seconds` are set. Waiting is normal, so don't cancel it.
- When the job is done, `last_response` holds:
  - `images: [{ type: "base64", base64, width, height }]` — `width` and `height` come as **strings**, and `base64` is a raw PNG without a `data:` prefix;
  - `seed`, `usage_cost_usd`, `billing_charged`;
  - `quantized_image_n_colors`, `style_reference`.
- `DELETE /background-jobs/{id}` cancels a job. A job still queued is not charged. Failed jobs are not charged.
- A 64×64 job took about 100 s.

## Endpoints we use

### `POST /generate-image-v2` — Pro text-to-image (style anchors)
- Body:
  - `description` (required);
  - `image_size {width, height}` (required, min 16);
  - `seed`;
  - `no_background` (default `true`);
  - `target_palette`;
  - optional `reference_images` (≤ 4, subject guidance: `{image: Base64Image, size: {width, height}, usage_description?}`);
  - optional `style_image` + `style_options {color_palette, outline, detail, shading}`. With a `target_palette`, set `style_options.color_palette: false`.
- Output count by the longest side: ≤ 32 → 64 · 33–35 → 49 · 36–41 → 36 · 42–50 → 25 · **51–64 → 16** · 65–84 → 9 · 85 → 16 · 86–170 → 4 · > 170 → 1. The images are **candidates of the same description**, not different subjects.
- **Cost: 10 generations per call at 64×64 (measured, 4 calls).** That is about $0.08 of compute per call. It is charged per call, not per candidate. The documented price ladder is 10 / 15 / 25 by canvas band, e.g. 16–32 → 10, 33–42 → 15, 43–64 → 10, 65–85 → 15.
- At 64×64 the critter usually fills 30–60 px of the height and sits on the bottom rows (y = 2…62). Wide subjects (moths with long wings) often touch the canvas edge, so check `touchesEdge` in the stats.

### `POST /generate-with-style-v2` — Pro, style-matched (all card art from T05 on)
- Body:
  - `style_images` (required, 1–4 × `{image: {type: "base64", base64, format: "png"}, width, height}`, ≤ 512 px);
  - `description` (required);
  - `style_description` (≤ 500 chars);
  - `seed`;
  - `no_background` (default `true`);
  - `target_palette`.
- `image_size` has been **removed**: the output is square, sized to the largest style image (64×64 anchors → 64×64 output, 16 candidates).
- **Cost: 10 generations per call** at 16–256 px. This is documented for the MCP twin `create_image_pro_from_style` ("64px 10 for 16 candidates"); T05 must confirm it from the first receipt.

### `target_palette` (beta, on both)
- `{ colors: ["#rrggbb", …] (2–256), name?, max_colors? (2–64), smart? }`.
- With `colors` set, every pixel is snapped to the palette. The first anchor came back with 5–13 colours out of the 16-colour realm palette.
- `name` "helps the look". `smart` (single images only) maps whole objects instead of nearest colour.

### `POST /create-image-pro-flash` — one native pixel-art image (T06 frames, card back)
- Body: `description`, `image_size` (native 16–128 sizes, custom 16–256 beta), `seed`, `no_background`, `target_palette`, optional `style_image {image, size, usage_description}` + `style_options {color_palette, outline, detail, shading}` (set `color_palette: false` when a palette is sent).
- Background job; the result has `images` (one) and an `image_url`.
- **Cost (measured, T06): 6 at 96×128.** `GET /pro-flash/cost?operation=create&width=&height=` quotes 5 up to 96×96 (incl. 64×96, 32×32) and 6 at 96×128.
- A frame prompt is only loosely followed: the 96×128 frame came back with a 68×49 window and 4 sockets instead of an exact 64×64 window and 6, so frames are hand-tuned in code (`tools/artgen/src/compose/frames.ts`).

### `POST /create-image-pixflux` — cheap single image (T06 icons)
- **Synchronous**: the response is `{ usage, image: Base64Image }`, no background job.
- Body: `description`, `image_size` (area 32×32 to 400×400), `seed`, `no_background`, `color_image` (forced palette: an image containing the allowed colours; artgen sends a 1-px strip of the palette), `outline` (`single color black outline` · `single color outline` · `selective outline` · `lineless`), `shading` (`flat` … `highly detailed shading`), `detail` (`low` · `medium` · `highly detailed`), `view`, `init_image`.
- **Cost (measured): 1 per image at 32×32.**

### `POST /create-ui-asset` + `/ui-assets/{id}/split` + `/ui-assets/states` (T06 panels and button)
- `create-ui-asset` body: `description`, `image_size` (192–688 per side), `pieces` (shape template in editor coords, longer side 0–512: `rounded_rect {id,kind,label,x,y,w,h,radius}`, `circle`, `polygon`), or `elements` (named scaffolds: button, panel, window…), `target_palette`, `style_image`, `seed`, `name`. Answers `{ background_job_id, ui_asset_id }`; after the job, `GET /ui-assets/{id}` has `image_url` (a public CDN PNG), `elements`, `states`, `split_preview`.
- **Cost (measured): 10 at 256×256** (documented: 10 ≤ 256, 15 ≤ 341, 25 above).
- Without `pieces`, `elements: ["panel","window","button"]` produced one composite window (with stray pixel lettering), not three pieces. **Use `pieces`**: three rects gave clean parchment, wood and button pieces. Output is native 1 px art (a 160×48 editor rect → ≈86×30 px).
- `POST /ui-assets/{id}/split` (body `{}` for the default boxes, or `{boxes}`): **free**; one element per piece, each with its own `image_url`. A template splits once.
- `POST /ui-assets/states` `{ element_ids, states: [{name, description}], target_palette }`: all states of all elements in one grid. **Cost (measured): 10** for one 81×25 button × 3 states. `last_response.created_state_ids` lists the new assets; fetch each with `GET /ui-assets/{id}`. States come back cropped to the element's content.
- `artgen ui-split <entry>` splits and downloads elements into the entry's `elements/` folder and records their ids in the manifest (`extra.elements`).

### `POST /generate-font-pro` — heading font (T06)
- Body: `description`, `weight` (`Bold` · `Regular`), `glyph_px` (8 · 12 · 16 · 24 · 32 · 64), `seed`, `font_name`.
- Background job; `last_response.images[0]` is the 80-glyph atlas and `last_response.ttf_base64` the TrueType file.
- **Cost (measured): 15.**

### `POST /generate-with-style-v2` receipt (T06)
- **Measured: 10 per call** at 64×64 (2 pack calls). This confirms the documented price.

## Other endpoints (for later tasks — documented costs, unverified)
| Endpoint | Use | Cost (generations) |
|---|---|---|
| `POST /create-character-v3` | character from a 64×64 `reference_image` (T17) | ceil(w·h·8/65536), so 64×64 → 1; from text: 2 at 16–90 px |
| `POST /characters/animations` (v3) | battle animations per direction (T17) | ceil(w·h·frames/65536) per direction, so 64 px × 8 frames ≈ 1 |
| `POST /create-character-pro` | Pro character redraw | 10 / 15 / 25 by art size |
| `/vfx` | battle VFX | look up before use |

## Budget implications (found in T04)
- The GDD §19 budget assumed about 1 generation per image. The Pro image endpoints cost **10 per call** (16 candidates of one subject). So:
  - **card art costs about 10 per card**: T05's 22 remaining cards ≈ 220 generations, not 70;
  - each retry of a card costs another 10.
- See GDD §27 for the open budget question.
