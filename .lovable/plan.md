
# Multi-Product Platform Refactor

This is a large architectural change. I'll deliver it in phased milestones so you can review and test each stage before the next. Below is the plan for **Phase 1 (Foundation)** with a roadmap for later phases.

---

## Phase 1 — Foundation (this milestone)

Goal: introduce the Product concept end-to-end, ship the Product Selector, and wire the dashboard to switch by product. No business-logic rewrites yet.

### 1. Product registry (config-driven)

Create `src/config/products.ts` — single source of truth for all products. Adding a product later = adding an entry here, nothing else.

```ts
type ProductId = 'all' | 'nurses' | 'ausbildung' | 'pre_bachelor' | 'pre_masters' | 'mba';
interface ProductConfig {
  id: ProductId;
  name: string;
  icon: string;           // emoji or lucide name
  allowedRoles: UserRole[];
  dashboard: DashboardConfig;   // widgets, charts, quick actions
  workflow?: WorkflowConfig;    // stubbed for Phase 2
  candidateFields?: FieldConfig[]; // stubbed for Phase 2
}
```

Seed: All Products, Professional Nurses, Ausbildung, Pre-Bachelor, Pre-Masters, MBA. Each declares its widgets/quick-actions per your spec.

### 2. Global product state

`src/store/productStore.ts` (Zustand, persisted to `localStorage`):
- `selectedProductId`
- `setProduct(id)`
- Restores last selection on load
- `All Products` restricted to `super_admin`; auto-fallback to first permitted product otherwise

### 3. Product Selector UI

New `src/components/layout/ProductSelector.tsx` — dropdown in `Navbar` beside search:
- Shows current product with icon
- Lists only products user has permission for
- Instant switch, no route change, no reload
- Triggers a re-render of dashboard + any product-aware page via the store subscription

### 4. Dynamic Dashboard

Refactor `src/pages/Dashboard.tsx` into:
- `Dashboard.tsx` — thin shell that reads `selectedProduct` and renders the right dashboard component
- `src/pages/dashboards/AllProductsDashboard.tsx` (executive)
- `src/pages/dashboards/NursesDashboard.tsx`
- `src/pages/dashboards/AusbildungDashboard.tsx`
- `src/pages/dashboards/PreBachelorDashboard.tsx`
- `src/pages/dashboards/PreMastersDashboard.tsx`
- `src/pages/dashboards/MBADashboard.tsx`

Each dashboard renders widgets + quick actions from its `ProductConfig`. Widgets use mock data now (matching the existing `useReports` pattern) — real data wiring is Phase 3.

Shared building blocks in `src/components/dashboard/`:
- `KpiCard`, `WidgetGrid`, `QuickActionsBar`, `ChartCard`

### 5. Sidebar refactor

Update `src/components/layout/Sidebar.tsx` to the new IA:
Dashboard · Candidates · Recruiter Hub · Employer Hub · **Speaking Assessment** · **STI Assessment** · **Interview Hub** · Visa Management · Document Center · Reports · Analytics · Settings · User Management.

Split the current combined "STI" into three independent nav entries and route stubs:
- `/speaking-assessment` (new stub page)
- `/sti` (existing, kept independent)
- `/interviews` (new stub page)

Stubs render a placeholder with the module's feature list so navigation works while Phase 2 builds them out.

### 6. Candidate model — product tag

Add `product_id: ProductId` to the `Candidate` type and mock data seed. No UI filtering yet beyond a badge in the candidate list — full per-product filtering lands in Phase 2.

---

## Roadmap (later phases, not built now)

- **Phase 2 — Independent Modules:** Full Speaking Assessment, STI Assessment, and Interview Hub modules (queues, calendars, scoring, reports). Product-scoped candidate list & detail. Workflow config per product.
- **Phase 3 — Configurable Workflows:** Per-product required documents, candidate fields, scoring, email templates, notification rules; admin UI to edit them.
- **Phase 4 — Shared Services Consolidation:** Unify Document Center, Email Center, Notifications, Calendar, Tasks, Reports, Analytics behind product-aware filters.
- **Phase 5 — Backend Integration:** Move product registry + workflows to Lovable Cloud tables; RLS by product permission; wire real metrics.
- **Phase 6 — Enterprise:** Multi-tenancy, white-label theming, regional/country workflows, API-first surface.

---

## Files touched in Phase 1

New:
- `src/config/products.ts`
- `src/store/productStore.ts`
- `src/components/layout/ProductSelector.tsx`
- `src/components/dashboard/{KpiCard,WidgetGrid,QuickActionsBar,ChartCard}.tsx`
- `src/pages/dashboards/{AllProducts,Nurses,Ausbildung,PreBachelor,PreMasters,MBA}Dashboard.tsx`
- `src/pages/SpeakingAssessment.tsx` (stub)
- `src/pages/InterviewHub.tsx` (stub)

Edited:
- `src/pages/Dashboard.tsx` — becomes router shell
- `src/components/layout/Navbar.tsx` — mount ProductSelector
- `src/components/layout/Sidebar.tsx` — new IA
- `src/legacy-app.tsx` (router) — add new routes
- `src/types/candidate.ts` — add `product_id`
- `src/lib/mockData.ts` — seed product tags

Approve to proceed with Phase 1, or tell me to adjust scope (e.g. include module stubs with more depth, or start with backend schema first).
