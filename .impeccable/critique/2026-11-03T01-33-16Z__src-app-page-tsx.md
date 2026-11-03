---
target: src/app/page.tsx
total_score: 22
max_score: 28
na_heuristics: 3,5,7
p0_count: 0
p1_count: 2
target_identity: "file:/Users/jorgeignaciogaray/development/lendloop/src/app/page.tsx"
target_fingerprint: "sha256:175662219229c0e655e074dab8ee65cecfea29ede7880cf4dc22b1cbe200e083"
target_path: /Users/jorgeignaciogaray/development/lendloop/src/app/page.tsx
timestamp: 2026-11-03T01-33-16Z
slug: src-app-page-tsx
closed: true
---
# Critique #2: LendLoop landing (src/app/page.tsx)
Method: dual-agent (A: design review · B: detector + overlay)

## Design Health Score — 22/28 (Good, 79%); n/a: 3, 5, 7
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | CTA skeleton is an unlabeled block |
| 2 | Match System / Real World | 4 | Pegboard/hang-tag metaphor fits |
| 3 | User Control and Freedom | n/a | Read-only surface |
| 4 | Consistency and Standards | 3 | Tags still read as buttons/inputs |
| 5 | Error Prevention | n/a | No inputs |
| 6 | Recognition Rather Than Recall | 3 | No Sign in in header |
| 7 | Flexibility and Efficiency | n/a | Single-purpose page |
| 8 | Aesthetic and Minimalist Design | 3 | "Newest first, grouped by category" contradicts itself |
| 9 | Error Recovery | 4 | Specific copy + local retry |
| 10 | Help and Documentation | 2 | Nothing points reviewers to README/architecture |

## Design Specificity
Mostly authored (pegboard, hang tags, loop mark, Fraunces + terracotta); hero composition still generic SaaS. CLI detect: 0 findings. Overlay: overused-font (Geist 79%, partly real), cream-palette (false positive: chosen warm tone).

## Priority Issues
- [P1] Reviewer story missing: add "Under the hood" band (authz, outbox, HMAC, health panel) linking ARCHITECTURE + quickstart — clarify
- [P1] Board below the fold: compress steps, let board rise into hero — layout
- [P2] Tags read as interactive: ~36px, hang-tag shape, lighter shadow — polish
- [P2] Many tools on mobile: per-category cap "+N more", earlier 2 cols, title on clamp — harden
- [P3] CTA loading state anonymous; no header Sign in; signup not explained — onboard

## Persona Red Flags
- Jordan: "Sign in" implies existing account
- Riley: 60-tag mobile scroll; clamped names; blank CTA if Clerk slow
- Casey: long scroll to the board
- Reviewer: no engineering story, no quickstart link

## Minor
Order claim contradiction; no total count; step 3 title wordy; .dark tokens untouched.
