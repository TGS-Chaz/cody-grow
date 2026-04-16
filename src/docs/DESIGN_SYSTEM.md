# Cody Grow Design System

## Design Philosophy
Cody Grow is the cannabis industry's Linear/Stripe — dense-when-needed, spacious-when-appropriate, dark-mode-first, AI-native. Every screen should feel intentional, not generic SaaS.

Reference points we look like:
- Linear (command bar, keyboard shortcuts, instant transitions)
- Stripe Dashboard (data density, card hierarchy, polish)
- Notion (content breathing room, progressive disclosure)

Reference points we do NOT look like:
- Cultivera Pro (dense enterprise 1999)
- SAP-style ERPs (rigid, form-heavy)
- Salesforce (feature bloat, unclear hierarchy)

## Color System (already in Tailwind config)

### Brand
- Primary Teal: `#00D4AA` / `#00B894` (CTAs, active states, success)
- Dark BG: `#0A0E17` (body background dark mode)
- Card BG Dark: `#111827`
- Light BG: `#F9FAFB`
- CTA Orange: `#F97316` (urgent CTAs only)

### Phase Colors (used EVERYWHERE — badges, card borders, icons, status dots)
- Immature/Seed/Clone: Blue `#3B82F6`
- Vegetative: Green `#10B981`
- Flowering: Purple `#A855F7`
- Ready for Harvest: Amber `#F59E0B`
- Drying: Orange `#F97316`
- Curing: Deep Orange `#EA580C`
- Cured/Available: Teal `#00D4AA`
- Destroyed/Failed: Red `#EF4444`
- Sold/Transferred: Gray `#6B7280`

### Severity Colors
- Info: Blue `#3B82F6`
- Warning: Amber `#F59E0B`
- Critical: Red `#EF4444`
- Success: Green `#10B981`

## Typography
- Headings: Satoshi (font-bold, font-semibold)
- Body: General Sans
- Data/Numbers: JetBrains Mono with `tabular-nums`
- Never use default system sans serif

Hierarchy:
- Page title: text-3xl font-bold
- Section heading: text-xl font-semibold
- Card title: text-base font-medium
- Body: text-sm
- Secondary: text-xs text-muted-foreground
- Data/metrics: font-mono tabular-nums

## Page Template

Every page follows this structure:

```tsx
<PageContainer>
  <PageHeader 
    title="..." 
    description="..." 
    breadcrumbs={[...]} 
    actions={<PrimaryAction />} 
  />
  
  {/* Optional: Stat row */}
  <StatCardsRow>
    <StatCard ... />
  </StatCardsRow>
  
  {/* Optional: Filters bar */}
  <FiltersBar>
    <SearchInput />
    <FilterChips />
    <SavedViews />
    <ColumnsCustomizer />
  </FiltersBar>
  
  {/* Main content */}
  <ContentArea>
    {isEmpty ? <EmptyState /> : <DataView />}
  </ContentArea>
  
  {/* Page-scoped Cody context registration */}
  {/* useCodyContext({ context_type, context_id, page_data }) */}
</PageContainer>
```

## The 3 View Modes Every Entity Supports

### 1. Overview Mode (dashboard-style, default for some pages)
- 4-6 stat cards at top
- Charts/graphs below
- Recent activity feed
- Ask Cody prompt inline: "Ask Cody about your plants..."

### 2. Work Mode (list/table view)
- Dense data table
- Row hover reveals actions
- Column sort/filter/hide
- Bulk select with action toolbar
- Saved views dropdown
- Inline row editing (where safe)
- Export menu

### 3. Focus Mode (single entity detail)
- Breadcrumb nav
- Hero section with primary info
- Action buttons in header
- Tabbed sections for related data
- Side panel for metadata/activity
- Cody insights panel

## Component Standards

### Stat Card
- Icon in colored tinted bg (6-7% opacity of phase color)
- Label (text-xs text-muted-foreground uppercase)
- Number (text-2xl font-mono tabular-nums)
- Delta/change indicator with arrow + color
- Optional: sparkline chart
- Click → drills into filtered list view

### Data Table
- Sticky header
- Zebra-striped rows (subtle in dark, more visible in light)
- Hover: row background highlight + actions menu appears right-aligned
- Selected: teal left border + slight bg tint
- Sort: click header, arrow indicator
- Bulk select: checkbox column, toolbar animates in from top

### Badge / Status Pill
- 20px tall, rounded-full, px-2.5
- Icon + text
- Phase color bg at 15% opacity, text at 100%
- For counts: solid bg, white text

### Empty State
- Large illustration or icon (phase color tinted)
- Title (text-lg font-semibold)
- Description (text-sm text-muted-foreground, max 2 lines)
- Primary action button
- Optional: secondary "Learn more" link

### Modal / Dialog
- Backdrop: bg-black/40 with blur
- Max width: 480px (default), 640px (forms), 900px (wide content)
- Rounded-xl
- Header with title + close button
- Footer with Cancel + Primary action
- Form modals: group fields with small section headers, progressive disclosure for advanced fields

### Form Fields
- Label above (text-sm font-medium)
- Input full-width, 40px tall, rounded-md
- Helper text below (text-xs text-muted-foreground)
- Error state: red border + red text below
- Required: red asterisk after label
- Placeholder: shows example value, not instruction

### Loading States
- Skeleton loaders for initial page load (shimmer animation)
- Spinner for button-level actions
- Progress bar for long operations (CSV generation, CCRS upload)
- Never show "Loading..." text

## Micro-Interactions (Framer Motion)
- Page transitions: fade + slight y-translate (200ms)
- Card hover: subtle shadow + 1px lift
- Button press: scale 0.98 (100ms)
- Modal open: fade backdrop + slide up content
- Row selection: smooth bg color transition
- Drag-drop: scale + rotate slightly while dragging
- Status change: animate color transition

## Data Display Rules

### Dates/Times
- Within 1 minute: "Just now"
- Within 1 hour: "45 minutes ago"
- Within 24 hours: "Today at 2:30 PM"
- Within 7 days: "Monday at 2:30 PM"
- Older: "Apr 12, 2026"
- Always tooltip with exact timestamp on hover

### Numbers
- Always use JetBrains Mono with tabular-nums
- Large numbers: use K/M suffixes with 1 decimal (1.2K, 3.4M)
- Weights: always in grams by default, show oz in tooltip
- Percentages: 1 decimal (18.5%)
- Currency: format with commas and 2 decimals ($1,234.56)

### IDs / Codes
- Monospaced
- Subtle background (bg-muted/30)
- Rounded-sm, px-1.5
- Copy-to-clipboard icon on hover

## Keyboard Shortcuts (mandatory on all pages)
- `⌘K` / `Ctrl+K`: Command bar (global)
- `/`: Focus search input
- `N`: New item (on list views)
- `E`: Edit (on detail views or selected row)
- `Delete`: Delete selected (with confirm)
- `Esc`: Close modal / deselect
- `?`: Show shortcuts cheat sheet
- Arrow keys: Navigate rows in tables
- `Space`: Select row
- `Cmd+A`: Select all visible

## Command Bar (⌘K)
Opens centered modal with search input. Shows:
- Recent pages
- Quick actions ("New Plant", "Generate CCRS Upload", "Create Manifest")
- Search across entities (plants, batches, orders, accounts)
- AI mode toggle: "Ask Cody" — sends query to AI instead of searching

## AI Integration Patterns

### Every list view has:
- "Ask Cody about this data" chip above table
- Cody suggests filters ("Show only plants > 60 days in flower")
- Cody explains anomalies automatically

### Every detail page has:
- Cody Insights card in the right sidebar or below hero
- Generated insights with severity indicators
- "Explain this to me" button for complex data

### Every form has:
- Cody can pre-fill based on context ("This looks like a Blue Dream clone — I've set common fields")
- Smart validation ("This license number format is unusual — double-check?")

## Mobile / Responsive
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px
- Below md: sidebar becomes bottom nav, tables become card stacks
- Below sm: full-screen modals, simplified headers
- Dedicated kiosk mode (PWA): /kiosk route with big-button UI for floor ops

## Print / Export Polish
- Manifest PDFs: branded header, clear data hierarchy, QR code for verification
- Labels: ZPL format for Zebra printers, PDF fallback, exact compliance measurements
- Report exports: XLSX with styled headers, conditional formatting on key metrics
- CSV exports: clean headers, proper quoting, UTF-8 BOM for Excel

## Accessibility
- WCAG 2.1 AA minimum
- All interactive elements have focus states (teal ring)
- Keyboard navigable everywhere
- Screen reader labels on icons
- Color never the only indicator (status = color + icon + text)
- Reduced motion support (respect prefers-reduced-motion)

## DON'Ts

- Never build a page that's just a form with 45 fields
- Never use default Tailwind colors without checking against design tokens
- Never use system default fonts
- Never skip the empty state
- Never skip loading states
- Never mix icon libraries (Lucide only)
- Never use emoji in UI as icons (use Lucide)
- Never auto-submit forms
- Never use alerts() or confirm() — always proper modals
- Never break keyboard navigation
- Never forget to register Cody context on the page

## Component Inventory (already built or to build)

Already built (verify before creating new):
- Button, Card, Badge, Input, Select, Table, Dialog, Tooltip, Tabs, DropdownMenu, Skeleton, Sonner/Toast
- AppLayout with Sidebar, TopNav, BottomDock
- NavLink, EmptyState, StatCard, PageHeader
- UserAvatar, OrgHeader
- AskCody, CodyInsightsPanel

To build as we go (create in src/components/shared/ or src/components/ui/ as needed):
- CommandBar
- DataTable (with sort, filter, pagination, selection, export)
- FiltersBar with chip-based filters
- SavedViewsDropdown
- ColumnsCustomizer
- PhaseColorBadge (takes phase name, returns styled badge)
- StatusPill
- DateTime (human-readable with tooltip)
- CopyableId
- FormSection (with title + optional description)
- DisclosureToggle (for progressive disclosure)
- BulkActionToolbar
- ExportMenu
- ShortcutHint (small keyboard key display)

## Page Checklist (every new page must have)

- [ ] PageHeader with title, description, breadcrumbs, primary action
- [ ] Loading skeleton
- [ ] Empty state
- [ ] Error state (with retry)
- [ ] Dark mode verified
- [ ] Mobile responsive verified
- [ ] useCodyContext() registered
- [ ] Keyboard shortcuts (at minimum: N for new, / for search)
- [ ] Accessible (keyboard nav, focus states, aria labels)
- [ ] Toast notifications for mutations (success + error)
- [ ] Optimistic UI where appropriate
- [ ] Analytics events fired (track what users do)
