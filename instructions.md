# PinBoard Junior — Development Instructions

> A living document guiding the design and build of a website that is both a **personal repository for ideas** (visual and verbal) and a **place to share those ideas with others**. This is the source of truth for what we're building and why. Update it as decisions change.

_Last updated: 2026-06-26 · Status: concept / pre-build · **Security-first** — see §2 and §5A_

---

## 1. The concept in one paragraph

PinBoard Junior is a place to capture an idea the moment you have it — an image, a sketch, a quote, a paragraph, a link, a voice memo — and keep it. Every idea lives first in your private space. From there you choose what to do with it: keep it to yourself, share a specific idea or board with named people, drop it into a topic-based circle, or publish it to the open world. The same object can move outward in stages. The product succeeds if capturing is frictionless, organizing is optional but rewarding, and sharing never feels like a separate, scary act of "posting."

**Two jobs, one object.** A repository and a social space usually pull in opposite directions — one wants privacy and structure, the other wants reach and serendipity. The design bet here is that they're the same object at different visibility levels, not two different products bolted together.

---

## 2. The two pillars (and the tension between them)

Every decision in this product is judged against two pillars that must hold simultaneously:

1. **User control & ease of use** — the user is always in command of their ideas and who sees them, and exercising that control is effortless. Capture is instant; sharing is one gesture; visibility is always legible.
2. **Security** — this is a **security-first** product. The system is hardened against attack, user data is protected by default, and the boundary between private and shared is enforced by the server, never assumed. A breach of someone's private vault, or content leaking above its visibility tier, is the worst thing that can happen here.

**The hard requirement: security without friction.** These pillars are usually treated as a trade-off — more security means more passwords, prompts, and confirmations. We reject that. Security must be *structural and invisible*: enforced in the data layer and architecture rather than pushed onto the user as hoops to jump through. When a security measure would add friction, the answer is to move the protection deeper into the system (default-deny authorization, server-side visibility resolution, sensible secure defaults) rather than to ask the user to do more work. If a feature can't be both safe and effortless, it isn't done yet.

### Core principles (decide arguments with these)

1. **Secure and private by default.** Nothing is visible to anyone else until the user takes an explicit action. Every access is denied unless explicitly granted. Visibility is a property of each idea and each board, never an account-wide setting.
2. **The server is the source of truth for who can see what.** The client never decides visibility; it only reflects what the server already enforced. Never trust the client to filter.
3. **Capture beats organize.** The cost of saving an idea must be near zero. Tagging, foldering, and curating are rewards, not gates.
4. **One object, many homes.** An idea is created once and can appear in many boards/circles without duplication. Sharing changes who can see it, not what it is.
5. **Sharing is a spectrum, not a switch.** Private → specific people → circle/community → public. Moving along it is one gesture and is always reversible.
6. **Visual and verbal are equal citizens.** The model must treat a paragraph of text as a first-class idea, not an afterthought attached to an image.
7. **Scale-ready, not scale-first.** Build clean seams (storage, search, feed, moderation) so we can swap in heavier infrastructure later without rewrites — but ship an MVP that real people use.

When these principles conflict, **security and user control are not negotiable** — we find a way to satisfy them without adding friction rather than relaxing them.

---

## 3. The four-tier sharing model (the heart of the product)

Every idea and every board carries a **visibility** value:

| Tier | Who can see it | Primary use |
|------|----------------|-------------|
| `private` | Only the owner | The default vault — capture, drafts, half-formed thoughts |
| `shared` | Specific named users or groups the owner invites | Collaboration, feedback, small-circle sharing |
| `circle` | Members of a topic-based community/group | Themed discovery without going fully public |
| `public` | Anyone, discoverable in feed & search | Publishing, building an audience, open contribution |

Design rules:

- **Boards and ideas each have their own visibility.** A `public` board can contain a mix, but an idea is never shown above its own tier — visibility resolves to the **more restrictive** of the idea and the board it's viewed through.
- **Promotion and demotion are symmetric.** Making something more visible and pulling it back are the same control, and demotion immediately revokes access (with a clear note that already-saved copies by others may persist — see Reactions/Re-pins below).
- **Sharing targets:** individual users (by handle/email invite), ad-hoc groups, and standing circles. Permissions per target are `view`, `comment`, or `edit`.
- **Circles** are the middle ground between private sharing and the public feed: invite-only or request-to-join, topic-scoped, with their own membership and (optionally) moderators.

This four-tier model touches every part of the system below; treat it as a cross-cutting concern, not a feature.

---

## 4. The idea — data model

The atomic unit is an **Idea** (internally we may call it a `card` or `pin`). An idea is a typed container so that visual and verbal content are equal.

**Idea**
- `id`, `owner_id`, `created_at`, `updated_at`
- `type`: `image` | `text` | `link` | `sketch` | `audio` | `file` | `mixed`
- `title` (optional), `body` (rich text / markdown), `media[]` (references to stored assets)
- `source_url` (for links/clips), `metadata` (extracted: dimensions, dominant color, link preview, transcription)
- `visibility`: `private` | `shared` | `circle` | `public`
- `tags[]`, `color`/`palette` (for visual sorting)
- `origin_id` (if re-pinned/forked from another idea — preserves attribution)

**Board** — a curated collection of ideas (the "pinboard")
- `id`, `owner_id`, `title`, `description`, `cover`, `visibility`, `layout` (grid / freeform / column), `collaborators[]`
- Ordering and, for freeform layout, per-idea position/size

**BoardItem** — join between Board and Idea (an idea can live in many boards)
- `board_id`, `idea_id`, `position`, `note` (a board-specific annotation)

**User** — `id`, `handle`, `display_name`, `avatar`, `bio`, settings

**Circle** — `id`, `name`, `topic`, `visibility` (open / invite / request), `members[]`, `moderators[]`

**Share / ACL** — `subject` (idea or board), `grantee` (user / group / circle), `permission` (view / comment / edit), `granted_by`, `granted_at`, `expires_at`, `revoked_at`, `accepted_at`

**Social objects** — `Comment`, `Reaction`, `Follow` (user→user, user→board, user→circle), `Repin` (origin_id linkage)

Two model decisions worth flagging now:
- **Board membership references ideas; cross-user re-pins fork them.** Within a user's own boards, the same idea can appear in many places without duplication via `BoardItem`. When another user re-pins an idea, that creates a new idea row with `origin_id` set so we keep attribution and can show "saved from."
- **Rich text vs. blocks.** Start with markdown/rich-text for `body`. If we later want Notion-style mixed-media documents, migrate `body` to a block model — keep the door open by storing body in a structured field, not raw HTML.

---

## 5. Backend requirements

### 5.1 Recommended stack

For a public, scale-ready product where you'd like a recommendation:

- **Language/runtime:** TypeScript end-to-end (shared types between client and server) on Node.
- **Framework:** **Next.js (App Router)** as the full-stack base — server components for fast first paint, route handlers / a dedicated API layer for the backend. If the API grows complex, split it into a standalone **NestJS** or **Fastify** service behind the same domain.
- **Database:** **PostgreSQL** (managed — Supabase, Neon, or RDS). Relational fits the join-heavy ACL/board/idea model far better than a document store. Use **Prisma** or **Drizzle** as the ORM.
- **Media storage:** object storage — **Cloudflare R2** or **AWS S3** — never the database. Serve through a CDN.
- **Search:** start with **Postgres full-text search**; graduate to **Typesense** or **OpenSearch** when discovery needs ranking, typo tolerance, and faceting at volume.
- **Cache / queues:** **Redis** for sessions, rate limiting, hot feeds; a job queue (BullMQ) for async work (thumbnailing, transcription, link previews, feed fan-out).
- **Auth:** a managed provider (**Clerk**, **Auth.js/NextAuth**, or Supabase Auth) — email + OAuth (Google/Apple). Do not roll your own.
- **Hosting:** **Vercel** for the Next.js app, or containers on Fly.io/Render/AWS if you want the API separate. CDN in front (Cloudflare).

Why this shape: it lets one person ship an MVP quickly, keeps types consistent across the stack, and isolates the three things that get expensive at scale — media, search, and feed generation — behind swappable seams.

### 5.2 Core services / responsibilities

- **Ideas & boards API** — CRUD, visibility resolution, reference-counted board membership.
- **Media pipeline** — direct-to-storage uploads via presigned URLs; async generation of thumbnails, blur-hash placeholders, palette extraction, and audio transcription. Link unfurling only ships once the hardened SSRF-safe fetcher in §5A exists.
- **Access control (the most important component in the system)** — a single, centralized, exhaustively-tested authorization layer that resolves "can user X do action Y on object Z" using the idea/board visibility plus the Share/ACL table. Every read and write in the entire system passes through it. It is **default-deny**: access is refused unless a rule explicitly grants it. It is never duplicated, never bypassed, and never short-circuited "for performance." Treat this as the part of the codebase that gets the most review, the most tests (including adversarial ones — see §5A.3), and the highest bar for any change. If this layer is wrong, nothing else about the product matters.
- **Feed & discovery** — personalized feed for followed users/boards/circles plus public discovery. Start with on-read query assembly; move to **fan-out-on-write** with a precomputed timeline (Redis) only when read latency demands it.
- **Social graph** — follows, circle membership, notifications.
- **Search indexing** — keep the index in sync with idea visibility changes (a demoted idea must drop out of public search immediately).
- **Moderation & trust/safety** — report flow, moderator tooling for circles and platform admins, automated checks on public content (CSAM hashing via a vendor, spam/abuse heuristics). Basic reporting and circle moderation are required before circles launch; the heavier public-content controls are required before any public tier launches.
- **Notifications** — in-app + email/push for comments, shares, follows, circle activity.

### 5.3 Cross-cutting backend concerns

- **AuthZ everywhere:** every read and write passes through the access-control layer. Public endpoints, background jobs, media URL generation, search/feed indexers, caches, and admin tools still resolve visibility — never trust the client or a downstream system to filter.
- **Rate limiting & abuse protection** on uploads, writes, and auth.
- **Observability:** structured logging, error tracking (Sentry), and metrics from day one.
- **Privacy & data rights:** export and delete-my-data flows; clear data retention; GDPR/CCPA posture since this is public.
- **Idempotency & soft deletes:** deletions are reversible for a window; re-pins survive an origin's deletion only as permitted by the demotion rules.
- **API style:** REST or tRPC for the app's own client; consider a documented public API later for power users/integrations.

---

## 5A. Security & hardening (first-class, not a phase)

Security is a pillar (§2), so it gets its own section and is built in from Phase 0 — not retrofitted. The guiding idea is **defense in depth with zero added user friction**: protection lives in the architecture and defaults, where the user never has to think about it.

### 5A.1 What we're protecting against (threat model)

- **Broken access control** — the #1 risk. Content leaking above its visibility tier; one user reading or editing another's private vault; IDOR (guessing/iterating object IDs to reach data you shouldn't). Mitigation: the default-deny authorization layer (§5.2), non-sequential IDs (UUID/ULID), and server-side visibility resolution on every endpoint.
- **Account takeover** — credential stuffing, phishing, session hijacking. Mitigation: managed auth provider, OAuth + optional passkeys/2FA, secure session handling, breach-password checks.
- **Injection & untrusted input** — SQLi, XSS (especially via user-authored rich text and link previews), SSRF (via link-unfurling fetching internal URLs). Mitigation: parameterized queries/ORM, strict output sanitization of rich text, a hardened/sandboxed fetcher for unfurling with an allowlist and blocked internal ranges.
- **Malicious uploads** — disguised executables, malware, image-parser exploits, oversized files. Mitigation: validate type/size server-side, process in isolation, strip metadata, serve user media from a separate origin/domain.
- **Abuse & automated attacks** — scraping, spam, brute force, enumeration, DoS. Mitigation: rate limiting, bot detection, CAPTCHas only where necessary (kept off the happy path), WAF/CDN protection.
- **Data exposure at rest / in transit** — Mitigation: TLS everywhere, encryption at rest, secrets in a vault (never in code), least-privilege access to infrastructure.
- **Harmful content** (public tier) — see moderation & trust/safety in §5.2 and the Phase 4 gate in §7.

### 5A.2 Security baked into the architecture (the "no friction" half)

These are invisible to the user but do the heavy lifting:

- **Default-deny authorization** resolved server-side on every request — the structural guarantee that private stays private.
- **Visibility resolves to the most restrictive** of idea and board, always on the server. Search and feed indexes update the instant visibility changes, so demoted content disappears immediately.
- **Unguessable identifiers** so URLs can't be iterated to find others' content.
- **Secure-by-default settings** — new ideas are `private`, new shares are minimum permission, nothing is public without an explicit, clear action.
- **Signed, expiring URLs** for media access so storage isn't publicly browsable.
- **Short-lived sessions with silent refresh**, secure/HttpOnly/SameSite cookies, CSRF protection — security the user never sees.
- **Sensitive personal data** (see privacy in §5.3) minimized, encrypted, and never logged.

### 5A.3 Security baked into the process

- **Authorization tests are mandatory.** Every endpoint ships with tests proving that an unauthorized user is denied — including adversarial cases (wrong user, demoted content, cross-tenant IDs, expired shares). A feature without these tests is not mergeable.
- **Dependency & secret scanning** in CI; automated SAST; regular dependency updates.
- **Least privilege** for every service, token, and database role.
- **Audit logging** of security-relevant events (logins, permission changes, shares, deletions, admin actions).
- **Incident readiness** — monitoring/alerting on anomalies, a documented response plan, and (before/around public launch) external penetration testing and a vulnerability-disclosure path.
- **Privacy by design** — data export and hard-delete flows, clear retention, GDPR/CCPA posture.

> **Rule of thumb:** if a proposed security control would add a step for the user, first try to satisfy it deeper in the stack (a default, a server-side check, an architectural boundary). Only surface friction to the user when there is genuinely no structural alternative — and then make it as light as possible (e.g., passkeys over passwords, step-up auth only for high-risk actions).

---

## 6. Frontend design

### 6.1 Design philosophy

The interface should feel like a calm, spacious **canvas**, not a busy social feed. Three surfaces, in priority order:

1. **Capture** — the fastest path from "I have an idea" to "it's saved." A persistent quick-add (paste an image, drop a file, type a thought, save a link via bookmarklet/extension/share-sheet). This is the feature people stay for.
2. **Organize** — your boards and vault. Visual, grid- or masonry-based, drag-and-drop, with a freeform canvas option for spatial thinkers.
3. **Discover** — feed, circles, search, and profiles. Visually rich, attribution-forward, low on engagement-bait.

### 6.2 Key screens

- **Quick capture / composer** — modal or omnipresent bar; type-aware (detects image vs. link vs. text); sets visibility inline with `private` preselected.
- **Vault / Home** — the owner's private space; recent captures, unsorted "inbox," and boards.
- **Board view** — masonry grid by default; optional freeform spatial canvas (zoom/pan, arrange, group) for moodboard-style work. Collaboration presence if shared with `edit`.
- **Idea detail** — full view of one idea: media, body, source, tags, comments, "saved from" attribution, and the visibility/share control.
- **Share sheet** — one control surfacing the whole spectrum: a slider/segmented control from private → people → circle → public, plus per-person permissions.
- **Discover feed** — ideas and boards from follows and circles; clean, image-led cards with clear attribution.
- **Circle page** — topic stream, members, about, join/request.
- **Profile** — public boards and published ideas, follower counts, bio.
- **Search** — across the user's own vault and the public corpus, with filters (type, tag, color, circle).

### 6.3 Interaction & visual language

- **Masonry/grid as the spine.** Pinterest-style responsive columns for visual density; text ideas render as legible "note cards" so verbal content holds its own beside images.
- **Drag-and-drop and paste** are primary input methods. Pasting an image or URL anywhere should just work.
- **Freeform canvas** for boards that want it — infinite pan/zoom, snapping, grouping. This differentiates from pure-grid competitors and suits visual thinkers.
- **Visibility is always legible.** A small, consistent indicator on every idea/board shows its tier (e.g., lock / people / circle / globe). Never let a user be unsure who can see something.
- **Calm aesthetic.** Generous whitespace, restrained color (let the content's color carry the page), strong typography for verbal ideas, fast transitions. Avoid notification noise and infinite-scroll dark patterns.
- **Accessibility:** keyboard navigation, alt text prompts on image upload, sufficient contrast, reduced-motion support. Bake in from the start.
- **Responsive & mobile:** capture especially must be excellent on mobile (share-sheet target). Plan a PWA early; native apps later if warranted.

### 6.4 Frontend tech

- **Next.js + React + TypeScript** (matches the backend choice).
- **Styling:** Tailwind CSS with a small design-token system; a headless component lib (Radix) for accessible primitives.
- **State/data:** React Query (TanStack) or tRPC for server state; minimal global client state.
- **Canvas/masonry:** a masonry layout lib for the grid; for the freeform canvas evaluate `tldraw`, `react-flow`, or a custom canvas/Konva approach.
- **Media:** next/image or an image CDN with blur-hash placeholders for fast, graceful loading.

---

## 7. Phased roadmap

**Phase 0 — Foundations (security foundations land here)**
Repo, CI (with dependency + secret scanning and SAST), environments, schema for User/Idea/Board/BoardItem with unguessable IDs, managed auth, object storage with presigned/expiring URLs, and the **default-deny access-control layer with its mandatory authorization tests (§5.2, §5A)**. Secure defaults, TLS, encryption at rest, and audit logging are set up now — not later. No sharing yet — just private capture and boards. The security architecture established here is what makes every later phase safe.

**Phase 1 — The private repository (MVP)**
Quick capture (image/text/link), vault/inbox, boards with masonry grid, drag-and-drop, idea detail, search over your own content. Link capture stores the URL and user-entered notes only; server-side link unfurling waits until the hardened SSRF-safe fetcher exists. Goal: a tool good enough that you'd use it daily even if no one else ever saw it.

**Phase 2 — Selective sharing**
The `shared` tier: invite specific people to ideas/boards with view/comment/edit, comments, notifications, basic collaboration presence. Visibility indicators and the share sheet land here.

**Phase 3 — Circles**
Topic communities: create/join, circle feeds, membership, basic reporting, and moderator tooling. The `circle` visibility tier does not ship until circle-level moderation and abuse handling are in place.

**Phase 4 — Public & discovery (hard security gate)**
The `public` tier, profiles, follows, discovery feed, public search indexing, re-pin/attribution. Opening content to the open internet dramatically widens the attack surface, so this phase **does not ship until all of the following are in place and verified:** moderation and trust-&-safety tooling, abuse/rate-limiting and bot protection, CSAM hashing/scanning, hardened link-unfurling (SSRF protection), WAF/CDN protection, and an **external penetration test plus a vulnerability-disclosure path**. These are prerequisites, not follow-ups — no exceptions.

**Phase 5 — Scale & polish**
Freeform canvas, audio/transcription, higher-quality link unfurling, fan-out feeds, search upgrade (Typesense/OpenSearch), PWA/mobile, public API, analytics.

Build the seams early (storage, search, feed, authz) so later phases swap implementations without rewrites.

---

## 8. Open questions to revisit

- **Monetization** — free + premium storage/features? Pro for power users? Decide before public launch as it shapes limits and the data model.
- **AI features** — auto-tagging, semantic search, "ideas related to this," summarization of long verbal ideas. Likely valuable; scope after MVP.
- **Re-pin semantics on demotion/deletion** — exactly what persists for others when an owner pulls something back. Needs a clear, user-legible rule.
- **Real-time collaboration depth** — presence only, or full concurrent editing (CRDTs)? Affects board architecture.
- **Naming** — "PinBoard Junior" is the working title; revisit before public launch.

---

## 9. How to use this document

This is a living spec. When a decision is made or changed, update the relevant section and the "Last updated" date. When the principles in §2 conflict with a proposed feature, the principles win unless we deliberately change them here. Keep the phased roadmap honest — move items between phases as reality dictates, but protect the Phase 4 gating requirements.
