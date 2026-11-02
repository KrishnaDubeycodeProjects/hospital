# Visual Abstract UI: The Non-AI Icon-Driven Design System for ASHA App

> **Reference Skill:** `.agents/skills/visual-abstract-ui/SKILL.md`  
> **Applicable To:** All screens and components in `asha-app/src/`

---

## 🎨 Core Design Principles

1. **Anti-AI-Slop Guarantee:**
   - No generic purple/indigo floating gradients.
   - No walls of text or conversational AI filler in data cards.
   - No muddy, oversized box shadows.
   - Crisp 1px borders (`#E2E8F0` / `#BFDBFE`), clean surface elevation (`elevation: 2`), and tactile cards.

2. **Icon-as-Primary-Language:**
   - Use `lucide-react-native` icons across every action, status indicator, and card.
   - Sizing tokens:
     - `12px – 14px`: Micro status badges (`<CheckCircle />`, `<Wifi />`, `<AlertTriangle />`)
     - `16px – 18px`: List items & action buttons (`<Users />`, `<HeartPulse />`, `<Phone />`)
     - `22px – 24px`: Primary navigation tabs & major CTAs (`<Plus />`, `<Home />`)
     - `32px – 40px`: Category headers, hero cards & profile emblem
   - Active state = tinted background pill (`#EFF6FF` / `#ECFDF5`) + filled/thick stroke.

3. **Minimalist Responsive Micro-Copy:**
   - **The 3-Word Ceiling:** No button label, card badge, or quick action may exceed 3 words.
   - Examples:
     - `+ नया परिवार` (Add Family)
     - `जांच शुरू करें` (Start Survey)
     - `सिंक सफल` (Synced)
     - `उच्च जोखिम` (High Risk)
   - 80% visual scannability / 20% concise text.

4. **Semantic Color Bindings:**
   - 🟢 **Emerald (`#047857` / `#10B981`)**: Normal, Safe, Completed, Cloud Synced.
   - 🟡 **Amber (`#D97706` / `#F59E0B`)**: Pending, Warning, Local Storage, Follow-up.
   - 🔴 **Crimson (`#DC2626` / `#EF4444`)**: High-Risk Pregnancy, Critical BP, Missed Visit.
   - 🔵 **Teal / Sky (`#0369A1` / `#0284C7`)**: Clinical Records, ABHA Identity, Household Info.
   - 🟣 **Violet (`#7C3AED`)**: Maternal Care, Immunization, ANM Approval.

5. **Devanagari (Hindi & Marathi) Typographic Rules:**
   - Add `lineHeight: fontSize * 1.35` on all Hindi and Marathi text to prevent diacritic clipping.
   - Use standard numerals (`1, 2, 3...`) for house numbers and metrics for split-second readability.
   - Always pair regional terms with an intuitive Lucide icon for immediate recognition.
