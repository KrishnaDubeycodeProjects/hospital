---
name: visual-abstract-ui
description: Master design system for craft-driven, non-AI abstracted interfaces. Focuses on visual-first affordance, crisp Lucide/Material iconography, tactile cards, and minimal responsive micro-copy for high-speed mobile and frontline workflows.
---

# Visual Abstract UI: The Non-AI Icon-Driven Design System

> **Target:** Frontline mobile apps, field tools, dashboards, and tactile consumer experiences.  
> **Aesthetic:** Human-crafted, minimal, visual-first, ultra-responsive.  
> **Anti-Goal:** AI-slop (generic purple gradients, endless chat bubbles, walls of text, decorative glassmorphism).

---

## 0. THE ANTI-AI-SLOP MANIFESTO

Most LLM-generated UIs look templated because models default to:
1. **Generic Purple/Indigo mesh gradients** on dark backgrounds.
2. **Text bloat**: Explaining every button with a paragraph instead of trusting the user's intuition.
3. **Card spam**: Three identical rounded boxes with vague buzzwords and low-contrast grey text.
4. **Fuzzy shadows**: Large diffuse box-shadows that look unpolished on mobile screens.

### The Replacement: Abstracted Visual Architecture
- **80% Visual / 20% Text**: Humans process icons, colors, and spatial positions 60,000× faster than reading prose.
- **Micro-Copy Cap**: Maximum 1 to 3 words per label. If a button needs 6 words to explain what it does, the icon or layout is broken.
- **Physicality & Tactility**: Crisp 1px borders (`#E2E8F0` or `#CBD5E1`), subtle 2px surface elevation, distinct active pill containers.
- **Semantic Color Anchors**: Every color must carry an immediate, unshakeable clinical or operational meaning.

---

## 1. ICON-AS-LANGUAGE SYSTEM

Icons are not decorative stickers; **they are the primary navigation and comprehension language**.

### 1.A Token Hierarchy & Sizing
| Token Size | Measurement | Use Case | Example (Lucide) |
| :--- | :--- | :--- | :--- |
| **Micro** | `12px – 14px` | In-line status badges, pills, metric labels | `<CheckCircle size={13} />`, `<Wifi size={12} />` |
| **Standard Action**| `16px – 18px` | Secondary buttons, list item accessories | `<ChevronRight size={16} />`, `<Phone size={16} />` |
| **Touch Primary** | `22px – 24px` | Main nav tabs, floating actions, primary CTAs | `<Plus size={22} />`, `<Users size={22} />` |
| **Hero / Emblem** | `32px – 40px` | Category cards, modal headers, empty state graphics | `<HeartPulse size={36} />`, `<Shield size={36} />` |

### 1.B Active vs. Passive State Grammar
- **Passive / Unselected:** Neutral slate (`#64748B`), outlined stroke (`strokeWidth={1.8}`), transparent background.
- **Active / Selected:** Primary semantic tint, filled icon or thicker stroke (`strokeWidth={2.4}`), encased in a high-contrast pill container (`#EFF6FF` or `#ECFDF5`).

### 1.C Semantic Color Palettes
```typescript
export const VisualTokens = {
  // Emerald: Health, Safe, Synced, Verified
  success: { base: '#047857', bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
  
  // Amber: Pending, Warning, Local Only, Follow-up
  warning: { base: '#D97706', bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  
  // Crimson: High Risk, Emergency, Missed, Soft-deleted
  danger:  { base: '#DC2626', bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
  
  // Teal / Sky: Primary Actions, Clinical Data, Identity (ABHA)
  primary: { base: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD', text: '#075985' },
  
  // Violet: Maternal, Institutional Delivery, ANM Verification
  care:    { base: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' },
};
```

---

## 2. MINIMALISTIC RESPONSIVE MICRO-COPY

Every text element must pass the **Glance Test**: A user walking, riding in a vehicle, or in bright sunlight must understand the screen in **under 300 milliseconds**.

### 2.A The 3-Word Ceiling Rule
| ❌ Verbose AI Default | ✅ Abstracted Minimalist Replacement |
| :--- | :--- |
| "Click here to add a new family member to this household" | **+ सदस्य जोड़ें (Add Member)** |
| "Your data has been successfully synchronized with the cloud" | **सिंक सफल (Synced)** with 🟢 `<CheckCircle />` |
| "This individual is currently categorized as high risk" | **उच्च जोखिम (High Risk)** with 🔴 `<AlertTriangle />` |
| "Initiate antenatal care screening assessment now" | **जांच शुरू (Start ANC)** with 🟣 `<HeartPulse />` |

### 2.B Typography Hierarchy (Material 3 Expressive Scale)
- **Primary Metric / House Number:** `22px – 26px`, Weight `800` (Ultra-bold numbers for instant scanning).
- **Section / Person Name:** `16px – 17px`, Weight `700`, Dark Slate (`#0F172A`).
- **Cadre Badge / Category:** `12px – 13px`, Weight `600`, Uppercase Letter Spacing (`0.04em`).
- **Status Subtitle / Date:** `11px – 12px`, Weight `500`, Slate (`#64748B`).

---

## 3. TACTILE COMPONENT PATTERNS

### 3.A Bento Surface Card (Zero AI-Slop Shadowing)
Clean, tactile container with crisp borders rather than muddy multi-layered shadows:

```tsx
<View style={styles.tactileCard}>
  {/* Header: Visual Icon Badge + Minimal Header */}
  <View style={styles.cardHeader}>
    <View style={[styles.iconBadge, { backgroundColor: VisualTokens.primary.bg }]}>
      <Users size={18} color={VisualTokens.primary.base} />
    </View>
    <View style={styles.titleCol}>
      <Text style={styles.headline}>घर #42 • वर्मा परिवार</Text>
      <Text style={styles.subtext}>4 सदस्य • 1 गर्भवती</Text>
    </View>
    <StatusBadge status="PENDING" label="जांच शेष" />
  </View>
</View>
```

```css
tactileCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  padding: 16,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  marginBottom: 12,
  // Crisp, tactile physical shadow
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
}
```

### 3.B Abstract Heat Grid Visualization (`DotGrid`)
Replace endless tables with spatial abstractions:
- Each household is a dot or compact pill in a grid.
- **Green dot:** Normal / Routine.
- **Yellow dot:** Follow-up / Vaccination pending.
- **Red dot:** High-Risk Pregnancy / Critical Blood Pressure.
- Tap opens the tactile bottom sheet; no full-page loading transitions needed.

### 3.C Rapid Action Stepper & Offline Modals
- Big touch targets (minimum **48dp × 48dp** touch target area).
- Big affirmative button in high-contrast emerald or teal.
- Micro-haptics / animated spring press effect (`activeOpacity: 0.7` or animated scale `0.98`).

---

## 4. MULTI-LANGUAGE ACCESSIBILITY (HINDI & MARATHI)

1. **Devanagari Font Alignment:**
   - Devanagari text has higher baseline ascenders and descenders. Increase `lineHeight` by 1.25× to prevent diacritic clipping (मात्राएं).
2. **Icon Pairing:**
   - Always pair regional text with a universally recognizable Lucide icon. Even semi-literate users navigate instantly via the icon + color pair.
3. **Number Standardization:**
   - Keep numbers in standard Arabic numerals (`1, 2, 3...`) for rapid household numbering, dates, and vital signs, paired with Devanagari labels.

---

## 5. AUDIT CHECKLIST: PRE-FLIGHT DESIGN TEST

Before committing any UI component or screen, verify:
- [ ] **Zero AI Slop:** No gratuitous neon purple gradients or fuzzy 20px shadows.
- [ ] **3-Word Limit:** Are button labels and badges 3 words or fewer?
- [ ] **Icon Present:** Does every primary action card have a meaningful Lucide icon?
- [ ] **Touch Target:** Is every interactive element at least 44×44dp?
- [ ] **Semantic Color:** Does every badge color match its health/operational state?
- [ ] **Offline Readiness:** Does this view update instantly without waiting on a loading spinner?
