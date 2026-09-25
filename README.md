# Kio — Softly Drawn

The portfolio of **Kio**, a digital artist making semi-realistic character art, custom designs and original characters. Every piece is hand-drawn. No AI.

The site is built like a small gallery. A WebGL hero, scroll-driven reveals, page transitions that morph artwork between routes, and a contact form that reads like a letter on cream paper.

- Threads: [@softlydrawn_](https://www.threads.com/@softlydrawn_)
- Fiverr: [ethereallogo](https://www.fiverr.com/ethereallogo)

## Stack

- **Vite** + **React 19** + **TypeScript**
- **react-router** for routing (`/`, `/work`, `/work/:slug`, `/contact`)
- **GSAP** (ScrollTrigger, SplitText, Flip) for animation, **Lenis** for smooth scrolling
- **three.js** for the hero scene and shaders (desktop only, code-split)
- **Fraunces** (display) and **Manrope** (body) variable fonts, self-hosted through Fontsource
- **ImageMagick** to build the responsive artwork images

## Getting started

Requirements: Node 20+, pnpm, and ImageMagick 7 (`magick`) if you need to rebuild the images.

```bash
pnpm install        # install dependencies
pnpm dev            # dev server on http://localhost:5173
pnpm dev --host     # also serve on your LAN, so you can open it on your phone
pnpm build          # type-check, production build to dist/, copy index.html to 404.html
pnpm preview        # serve the production build locally
pnpm images         # regenerate artwork images from images/*.png
```

## Project layout

```
images/                  source PNGs (full resolution, not served)
public/art/              generated WebP sizes, GPU textures (built by `pnpm images`)
public/                  favicon, touch icon, og.jpg, manifest, robots.txt, _redirects
scripts/build-images.sh  image pipeline
src/data/                all content: site.ts, artworks.ts, reviews.ts, art-manifest.json
src/pages/               route components
src/components/          UI, grouped by page (home/, work/, contact/, shared/)
src/gl/                  three.js scenes and GLSL helpers
src/lib/                 env detection, smooth scroll, page transitions, theme, hooks
src/styles/global.css    design tokens, type scale, utilities
```

## Editing content

All content is in `src/data/`. You never need to touch components to update the text.

- **Links, bio, status, email.** Edit `src/data/site.ts`. `status` drives the "Open for commissions" chip. Once `email` is set, it appears on the contact page and in the footer, and the form can fall back to it (see below).
- **Reviews.** Edit `src/data/reviews.ts`. These are copied word for word from Fiverr, so keep them that way. The `art` field links a review to an artwork slug.
- **Artworks.** Edit `src/data/artworks.ts`. The order of the list is the order used everywhere on the site.

### Adding a new artwork

1. Put the full-resolution PNG in `images/`.
2. Add a `"slug|images/File Name.png"` line to `PAIRS` in `scripts/build-images.sh`.
3. Run `pnpm images`. This writes the WebP sizes, a WebGL texture and a blur placeholder to `public/art/`, and updates `src/data/art-manifest.json`.
4. Add the artwork's metadata to the `meta` list in `src/data/artworks.ts`: `slug` (must match step 2), `title`, `kind`, `categories`, optional `year`, `blurb`, `palette` and `details` (focal points, as percentages of the image).

## Contact form

The form on `/contact` picks how to deliver messages from what's configured, in this order:

1. **Form endpoint.** If `VITE_FORM_ENDPOINT` is set, the form sends a JSON `POST` there with `Accept: application/json`. Any Formspree-compatible service works (Formspree, Getform, Web3Forms and similar). Copy `.env.example` to `.env` and set it:
   ```bash
   VITE_FORM_ENDPOINT=https://formspree.io/f/your-id
   ```
   On Vercel or Netlify, add the same variable in the project's environment settings. It's read at build time.
2. **Email.** If there's no endpoint but `email` is set in `src/data/site.ts`, submitting opens the visitor's email app with the subject and body already filled in.
3. **Neither.** The form still works: it turns the message into a note and copies it to the clipboard, so the visitor can paste it into a Threads or Fiverr message. The page points them to both.

The form also accepts prefilled links: `/contact?type=character-art&ref=witch-knight`. Valid `type` values are `character-art`, `custom-design`, `original-character`, `couple-scene` and `other`. `ref` must be the slug of an artwork. A hidden honeypot field (`_gotcha`) filters out simple spam bots.

## Deploying

The build output is a static single-page app in `dist/`.

- **Vercel (recommended).** Import the repo. The framework preset is Vite, the build command is `pnpm build` and the output directory is `dist`. `vercel.json` already rewrites client routes to `index.html`.
- **Netlify.** Use the same build command and output directory. `public/_redirects` handles SPA routing.
- **GitHub Pages.** The build copies `index.html` to `404.html`, so deep links work there too. For a *project* page (`username.github.io/repo/`), set `base: '/repo/'` in `vite.config.ts`. The site currently uses absolute paths such as `/art/...`, so those need the base prefix too. A custom domain or a user page (`username.github.io`) works without changes.

After the first deploy, set the real domain for the absolute URLs social platforms expect (`og:image`, `og:url`) in `index.html`.

## Performance and accessibility

- **WebGL is opt-in.** The three.js scenes only run on wide screens with a fine pointer and WebGL2, when data saver is off and the device reports enough memory (`canRunHeavyGL()` in `src/lib/env.ts`). Phones and tablets get lighter CSS/SVG versions of the same moments, using only transform, opacity and clip-path animation.
- **three.js is code-split.** It's loaded with a dynamic import, so it never lands in the main bundle or on devices that won't use it.
- **Images are responsive.** Each artwork ships in several WebP widths with `srcset`/`sizes`, an inline blur placeholder and its average colour, so layouts never jump.
- **Reduced motion is respected.** With `prefers-reduced-motion`, smooth scrolling, the WebGL scenes and entrance animations are turned off, and CSS animations finish instantly.
- **Smooth scrolling is desktop-only.** Lenis runs on desktop. Touch devices keep native momentum scrolling.
- The site uses semantic HTML, visible keyboard focus, 44px touch targets and real alt text. Form errors are announced inline (`aria-invalid`, `aria-describedby`), and focus moves to the first field that needs attention.

## Brand assets

`public/favicon.svg` is the brush-stroke "K" mark in candle gold on ink. `apple-touch-icon.png`, `icon-512.png` and `og.jpg` (1200×630, a gallery wall of four pieces) are rendered from the same design with ImageMagick.

## Copyright

All artwork on this site is © Kio (Softly Drawn). Every piece is hand-drawn, with no AI. The artwork is **not** licensed for reuse, redistribution or AI training. The code in this repository is separate from the artwork, and using the code gives you no rights to the images.
