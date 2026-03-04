---
name: a11y-qa
description: >
  Use when asked to run an accessibility audit, test for WCAG compliance, check a11y,
  scan for accessibility issues, generate an accessibility report, or when the user
  says "audit a11y", "a11y-qa", "accessibility-qa", "test accessibility", "check WCAG",
  "axe-core scan", "jsx-a11y lint", or "find accessibility violations".
---

# Accessibility QA Testing

You are helping a QA engineer systematically find, classify, and report accessibility
violations. Your job is to surface real issues clearly so developers can fix them.

---

## Step 1: Choose a Scan Mode

Ask the user which mode to use if not specified:

| Mode | What it does | When to use |
|------|-------------|-------------|
| **runtime** | Injects axe-core into running pages via browser | Final QA, staging, before release |
| **static** | Runs eslint-plugin-jsx-a11y on source code | During development, PR review |
| **full** | Static first, then runtime | Comprehensive release audit |

Default to **runtime** unless the user specifies otherwise or no dev server is available.

---

## Step 2: Runtime Scan (axe-core)

Tests the live rendered page — catches issues that only appear at runtime (dynamic
content, third-party components, CSS-driven visibility).

**Standards:** WCAG 2.2 Level AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) + best practices.

### 2a. Discover pages to scan

Look for routes in the project:
- **Next.js (App Router):** `src/app/**/page.tsx`
- **Next.js (Pages Router):** `pages/**/*.tsx`
- **React Router:** route definitions file
- **Static site:** `*.html` files or `sitemap.xml`
- Ask the user if the route list is unclear.

### 2b. Start the dev server

```bash
# Detect the right command from package.json "scripts"
# Usually: dev, start, or serve
npm run dev   # or pnpm dev / yarn dev
```

Wait for HTTP 200 on `localhost` before proceeding.

### 2c. Inject axe-core and scan each page

For each page, use browser automation to:
1. Navigate to the page URL
2. Wait 2–3 seconds for content to fully render
3. Run this script:

```javascript
(async () => {
  if (!window.axe) {
    const script = document.createElement('script');
    // Check https://github.com/dequelabs/axe-core/releases for the latest version.
    // Alternatively use 'https://unpkg.com/axe-core/axe.min.js' (always latest, no version pin).
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => { script.onload = resolve; });
  }
  const results = await axe.run(document, {
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
  });
  window.__axeResults = {
    page: window.location.pathname,
    violations: results.violations.length,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    details: results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      elements: v.nodes.slice(0, 5).map(n => ({
        html: n.html.substring(0, 200),
        target: n.target,
        failureSummary: n.failureSummary
      }))
    }))
  };
})().then(() => console.log('AXE_SCAN_DONE'));
```

4. Wait 3 seconds, then retrieve `window.__axeResults`.

### 2d. Kill the dev server

After all pages are scanned, stop the background server process.

---

## Step 3: Static Analysis (ESLint jsx-a11y)

Catches source-level issues in JSX/TSX without needing a running server. Best for React,
Next.js, and Vue projects.

### 3a. Check for eslint-plugin-jsx-a11y

Look in `package.json` devDependencies. If not present, install it:

```bash
pnpm add -D eslint-plugin-jsx-a11y   # or npm install -D / yarn add -D
```

### 3b. Create a temporary standalone config

```javascript
// eslint.a11y.mjs  (create at project root, delete after scan)
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["src/**/*.tsx", "src/**/*.jsx"],
    plugins: { "jsx-a11y": jsxA11y },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
];
```

### 3c. Run the scan

```bash
npx eslint --config eslint.a11y.mjs src/
```

### 3d. Clean up

Remove `eslint.a11y.mjs` after the scan. Keep `eslint-plugin-jsx-a11y` installed.

### 3e. Flag known false positives

Do not report these as real violations:
- Custom component props named `role` (not the HTML `role` attribute)
- Components that forward ARIA props to underlying elements
- Dynamic content loaded after initial render (use runtime scan for those)

---

## Step 4: Classify Violations by Severity

Every axe-core violation carries an impact level. Use this to prioritise fixes:

| Impact | Meaning | Action |
|--------|---------|--------|
| **critical** | Completely blocks assistive technology users | Fix before release |
| **serious** | Causes significant difficulty for AT users | Fix before release |
| **moderate** | Causes some difficulty, workarounds exist | Fix in current sprint |
| **minor** | Small issue, low impact | Fix when convenient |

---

## Step 5: Auto-Fix Reference

When reporting violations, include the recommended fix from this table:

| Violation rule | Fix |
|----------------|-----|
| `region` — content not in landmark | Wrap in `<main>`, put nav in `<nav>`, footer in `<footer>` |
| `heading-order` — skipped levels | Fix heading level; use CSS to style visually, not heading number |
| `color-contrast` — insufficient contrast | Adjust colors to meet 4.5:1 (normal text) or 3:1 (large text / UI) |
| `image-alt` — missing alt text | Add descriptive `alt`; use `alt=""` for decorative images |
| `button-name` — nameless button | Add visible text, `aria-label`, or `aria-labelledby` |
| `link-name` — nameless link | Add text content or `aria-label` (avoid "click here") |
| `label` — form control without label | Add `<label htmlFor="id">` or wrap input in `<label>` |
| `aria-*` — invalid ARIA | Fix attribute name, value, or role to match ARIA spec |
| `duplicate-id` | Make all IDs unique per page |
| `focus-order-semantics` | Fix DOM order; use CSS for visual reorder, not `tabindex` |
| `keyboard` — not keyboard accessible | Ensure all interactions work with Tab, Enter, Space, Esc |

---

## Step 6: Generate the Report

Always present findings in this structure:

```
## Accessibility Audit Results

**Scan mode:** [runtime / static / full]
**Standards:** WCAG 2.2 Level AA + Best Practices
**Date:** [date]
**Pages / files scanned:** [count]

### Summary

| Page / File | Violations | Passes | Worst impact |
|-------------|-----------|--------|--------------|
| /           | 3         | 42     | serious      |
| /about      | 1         | 39     | moderate     |

**Total violations:** [n]
Critical: [n] | Serious: [n] | Moderate: [n] | Minor: [n]

---

### Violations

#### 1. [rule-id] — [impact]

**Description:** [what the rule checks]
**WCAG criterion:** [e.g. 1.1.1 Non-text Content (Level A)]
**Pages / files affected:** [list]
**Instances:** [count]

**Example element:**
```html
<element that failed>
```

**Fix:** [specific recommendation from auto-fix table above]
**Reference:** [axe-core help URL]

---

### Recommended Next Steps

1. [Highest-priority fix]
2. [Second priority]
3. [etc.]
```

---

## Step 7: Manual Test Checklist

Automated tools find ~30–40% of accessibility issues. After the automated scan,
complete the manual checklist in `references/manual-checklist.md`. It covers:

- **Keyboard-only navigation** — focus order, skip links, modal trapping
- **Screen reader testing** — headings, labels, live regions, link names
- **Visual/cognitive checks** — zoom reflow, colour independence, contrast
- **Touch/mobile** — target sizes, hover-only patterns, pinch-zoom

---

## Step 8: WCAG 2.2 AA Quick Reference

The full success-criteria reference table for testers is in `references/wcag-quick-ref.md`.

Key thresholds to remember:
- **Text contrast:** 4.5:1 (normal) / 3:1 (large ≥18pt or bold ≥14pt)
- **Non-text contrast (UI, focus):** 3:1
- **Target size minimum:** 24×24 px (WCAG 2.5.8) / 44×44 px recommended
- **Reflow:** usable at 400% zoom, no horizontal scroll


---

## Examples

### Example 1: Runtime audit before release

User says: "run an accessibility audit on my app"

Actions:
1. Default to **runtime** mode
2. Discover routes (`src/app/**/page.tsx` or `pages/**/*.tsx`)
3. Start dev server, wait for HTTP 200
4. Inject axe-core and scan each page
5. Kill server, classify violations by impact, generate report

Result: Structured report with violation count per page, impact levels, fix recommendations, and prioritised next steps.

### Example 2: Static scan during PR review

User says: "check accessibility in my components before I merge"

Actions:
1. Use **static** mode — no running server needed
2. Install `eslint-plugin-jsx-a11y` if absent
3. Create temp `eslint.a11y.mjs`, run scan on `src/`
4. Delete config, report violations with file/line references, filter false positives

Result: Source-level violations with actionable line numbers.

### Example 3: Full pre-release audit

User says: "full a11y audit before we ship"

Actions:
1. Use **full** mode — static first, then runtime
2. Merge findings, classify by impact
3. Append manual test checklist (see `references/manual-checklist.md`)

Result: Combined static + runtime report plus manual testing guide.

---

## Troubleshooting

**Dev server won't start**
Check `package.json` scripts for the right command (`dev`, `start`, `serve`). For monorepos, confirm you're running from the correct package directory.

**axe-core CDN script blocked**
A strict Content Security Policy will block the CDN injection silently. Switch to static mode, or install axe-core locally and serve it from `localhost`.

**ESLint scan produces no output**
Verify the glob in `eslint.a11y.mjs` matches your file structure. If source lives outside `src/`, adjust the `files` pattern.

**Too many false positives from jsx-a11y**
Custom component props named `role` (not the HTML attribute) and components forwarding ARIA props to child elements are known false positives — see Step 3e.

**axe-core `incomplete` results**
`incomplete` means axe-core could not automatically pass or fail (common with colour contrast on dynamic content). Treat as manual review candidates, not confirmed violations.

---

## Standards Reference

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [jsx-a11y Rules](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y#supported-rules)
- Manual test checklist → `references/manual-checklist.md`
- WCAG 2.2 AA quick reference → `references/wcag-quick-ref.md`