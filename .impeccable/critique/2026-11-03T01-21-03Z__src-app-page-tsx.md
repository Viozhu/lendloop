---
target: src/app/page.tsx
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/jorgeignaciogaray/development/lendloop/src/app/page.tsx"
target_fingerprint: "sha256:af394b00aaf669956a6b64644b13bb8b265235782dc23e6a532f99b63325b3d2"
target_path: /Users/jorgeignaciogaray/development/lendloop/src/app/page.tsx
timestamp: 2026-11-03T01-21-03Z
slug: src-app-page-tsx
closed: true
---
# Critique: LendLoop landing (src/app/page.tsx)
Method: dual-agent (A: design review · B: detector + overlay)

## Design Health Score — 20/32 (Acceptable, 63%); n/a: 7, 10
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | CTA skeleton width ≠ button (layout shift); no "60 of N" |
| 2 | Match System / Real World | 3 | Domain language clear |
| 3 | User Control and Freedom | 2 | No header/nav; CTA only exit |
| 4 | Consistency and Standards | 2 | Cards look clickable, do nothing |
| 5 | Error Prevention | 3 | Only dead-click trap |
| 6 | Recognition Rather Than Recall | 3 | Truncated names lack title |
| 7 | Flexibility and Efficiency | n/a | Single-CTA Persuade surface |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; large empty areas |
| 9 | Error Recovery | 1 | No error state in PublicToolGrid |
| 10 | Help and Documentation | n/a | Landing page |

## Design Specificity
Category-interchangeable: stock shadcn neutral; only copy is LendLoop-specific. Detector: 0 findings (exit 0); overlay: "No anti-patterns found".

## Priority Issues
- [P1] Brandless template visual language — colorize, bolder (accent hue, wordmark lockup in header, board treatment for grid)
- [P1] Public cards look clickable but aren't — clarify (link to sign-in/tool, or flatten)
- [P1] PublicToolGrid: no error state, no cap boundary, no title on truncation — harden
- [P2] Focus ring ~1.5:1 (WCAG 1.4.11) + CTA skeleton layout shift — polish
- [P2] No "how the loop works" / privacy reassurance — onboard

## Persona Red Flags
- Jordan: dead card clicks; unclear what lending involves; Clerk modal without context
- Riley: truncated names unreadable; 60 flat items; infinite skeleton on outage
- Casey: long monotone scroll; 36px CTA; no sticky CTA
- Reviewer: default shadcn first impression; no pointer to differentiators/docs

## Minor
No header/footer landmarks; order unstated; hero leaves right third empty; secondary badge low boundary contrast.

## Questions
Cover the name — would anyone guess neighbors lending tools? Under-the-hood strip for reviewers? Shelves by category as the board metaphor?
