# Future Features Backlog

## Core Product Flows

- [ ] Revisit Prayer Notes as multi-note CRUD (create, list, edit, delete) in Prayers tab.
- [ ] Evaluate whether Prayer Notes should also appear in Notebook timeline.
- [ ] If Prayer Notes appear in Notebook, define tap behavior (edit in place vs open Prayers tab).

## Access and Account Model

- [ ] Validate simplified business rules from real Android usage and identify gaps.
- [ ] Confirm entitlement/paywall behavior remains fully separated from auth-based data access.
- [ ] Refine sign-in prompts for save/delete flows based on user confusion points.

## Data Reliability and UX

- [ ] Improve long-load recovery patterns in cloud-backed screens where needed.
- [ ] Add clearer user-facing messaging for retry, timeout, and recoverable failures.
- [ ] Review cross-tab refresh behavior after entitlement or auth state changes.

## Release Planning

- [ ] Use Android production feedback to prioritize v2.6 scope.
- [ ] Decide iOS rollout timing and scope based on Android results.
- [ ] Ship v2.6 with only validated, high-confidence changes from Android learnings.
