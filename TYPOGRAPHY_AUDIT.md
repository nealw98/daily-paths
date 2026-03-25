# Typography Audit: Daily Paths (Synced)

This document is a current implementation snapshot synced to code.

## Typography System

Primary sources:
- `constants/theme.ts`
- `hooks/useTypography.ts`
- `hooks/useSettings.ts`

Rules:
- **Static tokens**: `h1`, `h2`
- **Dynamic tokens**: `h3`, `bodyLarge`, `quoteBox`, `body`, `bodySmall`, `label`, `caption`
- **Legacy compatibility aliases remain**: `displayLarge`, `displayMedium`, `headlineMedium`, `titleLarge`, `titleMedium`, `bodyMedium`, `labelMedium`

## Semantic Scale (Current)

| Name | Base Size (Medium) | Base Line Height | Scaling | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `h1` | 34 | 40 | Static | Global headline token |
| `h2` | 28 | 34 | Static | Section headline token |
| `h3` | 20 | 26 | Dynamic | Subhead token |
| `bodyLarge` | 19 | 32 | Dynamic | Long-form large body |
| `quoteBox` | 19 | 26 | Dynamic | Dense quote-block variant |
| `body` | 17 | 28 | Dynamic | Standard body token |
| `bodySmall` | 15 | 24 | Dynamic | Secondary body |
| `label` | 13 | 20 | Dynamic | Labels/chips/eyebrows |
| `caption` | 12 | 16 | Dynamic | Small helper/meta text |

## Scaling Matrix (In-App Settings)

| Setting | H3 | BodyLarge | Body | BodySmall | Label | Caption |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Extra Small** | 16 | 15 | 13 | 12 | 11 | 10 |
| **Small** | 18 | 17 | 15 | 13 | 12 | 11 |
| **Medium** | 20 | 19 | 18 | 15 | 13 | 12 |
| **Large** | 24 | 24 | 22 | 18 | 16 | 14 |
| **Extra Large** | 28 | 28 | 26 | 22 | 18 | 16 |

Note: Android applies a global `+2` bump inside `getTextSizeMetrics`.

## Page Status (Current)

| Area | Status | Notes |
| :--- | :--- | :--- |
| Today (`components/ReadingScreen.tsx`) | **Updated with intentional overrides** | Uses semantic tokens plus special editorial title + quote/practice tweaks |
| Select Date (`app/select-date.tsx`) | **Updated** | Uses semantic tokens; Step reference moved into selected-reading preview block |
| Notebook flow (`components/journal/*`) | **Mostly updated** | Core screens migrated; some legacy compatibility metrics still used for dynamic sizing in spots |
| Prayers (`components/prayers/PrayersScreen.tsx`) | **Partially updated** | Now on `useTypography`; still uses compatibility metrics (`bodyFontSize`) |
| Speakers (`components/speakers/*`) | **Partially updated** | Largely legacy-token based; quote now uses `quoteBox` |
| More/Settings (`app/(tabs)/more.tsx`) | **Legacy-heavy** | Still uses legacy token names in places (`titleMedium`, `bodyMedium`) |

## Today Page Mapping (Current)

| Element | Current Typography |
| :--- | :--- |
| Page title | Custom editorial style (Manrope light, 36/44, LS -0.9), static |
| Page date | `staticTypography.body` (currently static token usage) |
| Quote text | `typography.quoteBox` |
| Quote reference spacing | `applicationQuoteText.marginBottom = 10` |
| Main reading body | `staticTypography.bodyLarge` (currently static token usage) |
| Practice label (`PRACTICE`) | `typography.label` + uppercase/spacing |
| Practice body | `fontSize: typography.body.fontSize` + `lineHeight: typography.quoteBox.lineHeight` |
| Thought label (`Thought for the Day`) | Label styling with explicit `fontSize: 13` |
| Thought content | `typography.h3` |

## Select Date Notes (Current)

- Top title uses `h3`
- Month title uses `h2` with editorial family override
- Weekday labels use `caption`
- Day numbers use `body`
- Selected reading preview:
  - Date uses `label`
  - Step reference uses `caption`
  - Date + Step are grouped as one block
  - `Favorited` pill aligned to that block

## Next Sync Candidates

- Normalize remaining Notebook compatibility-metric usages to pure semantic style objects where practical
- Complete full semantic migration for Speakers and More
- Decide whether Today body/date should stay static or move to dynamic semantic usage
