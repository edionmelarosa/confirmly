# Confirmly — Business Plan

*Working name — subject to change before public launch. No technical dependency on the name.*

Last updated: 2026-09-04

---

## 1. Problem

Small clinics (starting with dental, expanding to other appointment-based small medical/service practices) in the Philippines run their booking and reminder process entirely by hand:

- The clinic (usually one secretary/front-desk staff) manually tracks appointments, often on paper or in a simple digital calendar not built for this purpose.
- Reminders are sent manually via one-way SMS, days before the appointment, with no built-in confirm/reschedule mechanism.
- To book or reschedule, the patient must message the clinic directly (SMS or Messenger) and wait for a human reply — there is no self-service booking.
- No-shows are a severe, documented problem in Philippine clinics (40-50% DNA — "did not attend" — rate cited in industry reporting), and there is no waitlist mechanism to fill a cancelled slot on short notice.

This is validated firsthand: the founder's own dentist visit confirmed this exact manual workflow (SMS reminder sent by secretary, patient replies via SMS/Messenger to book).

**The core cost to the clinic:** staff time spent on manual scheduling conversations, and lost revenue from no-shows and empty slots that go unfilled because there's no fast way to offer them to someone else.

## 2. Solution

A scheduling tool sold to clinics (and later, other appointment-based small businesses) that automates the parts of this workflow currently done by hand, without requiring the clinic or patient to change the channel they already use (SMS).

**Core mechanics (v1 scope):**

1. **Clinic-side tool** — a dashboard (web or native, TBD in technical planning) where staff manage a real-time calendar of available slots, replacing manual/paper tracking.
2. **Automated SMS reminders** — sent automatically N days before an appointment, based on the clinic's calendar, removing the manual send step.
3. **One-tap confirm / reschedule / cancel** — patient responds via SMS reply keyword or a short link to a lightweight mobile web page (no app install required). Removes the back-and-forth conversation currently required to reschedule.
4. **Waitlist auto-fill** — when a slot is cancelled or not confirmed, it is automatically offered to a waitlist of patients wanting an earlier slot, recovering revenue that is currently lost.

**Explicitly out of scope for v1** (see Section 8, Risks & Non-Goals):
- A patient-facing native app (adds install friction with no proven need yet — see Section 5).
- Multi-clinic "find a doctor" directory/marketplace functionality.
- AI-based symptom triage or doctor recommendation (carries real medical-liability risk; deferred until there is a clinical review process and real usage data to justify it).
- Any dependency on Meta/Messenger for proactive reminders (Meta's 2026 policy changes restrict the exact mechanism this would require — see Section 8).

## 3. Target Customer

**Primary (payer):** small independent clinics — starting with dental, the founder's validated entry point — expanding later to other appointment-based small medical practices (optometry, vet, etc.) and eventually non-medical appointment businesses (salons, tutoring centers) once the core product is proven.

**End user (patient):** does not pay directly in v1. Experience must require zero install and match their current behavior (receiving an SMS, replying to it) as closely as possible, to avoid adding adoption friction on the clinic's behalf.

**Why start narrow:** the wedge is a single, provable financial pain (no-shows / manual scheduling labor) at one clinic type the founder already has a direct relationship with, not a general two-sided marketplace requiring simultaneous clinic and patient adoption.

## 4. Business Model

- **Primary revenue:** monthly subscription per clinic (flat fee), priced against the value of staff time saved and no-show revenue recovered, not per-booking or per-patient (avoids penalizing the clinic for growth and keeps pricing simple to explain).
- Indicative starting price point to validate: ₱500–1,500/month per clinic, to be tested directly with the first few customers rather than assumed.
- **Future, not v1:** possible add-ons (e.g. waitlist-fill priority features, multi-branch support, SMS volume tiers) once there is a base of paying clinics to learn pricing sensitivity from.

## 5. Why Now / Why This Wedge

- The founder has a **direct, existing relationship** with a real prospective customer (own dentist's clinic) — this removes the hardest part of early sales: getting a first meeting.
- No-show rates in Philippine clinics are a documented, severe, recurring pain — not a hypothetical problem.
- SMS remains the clinic's working channel today; the product does not require the clinic or patient to adopt a new communication habit, only to automate what they already do.
- Avoiding the mistake of the founder's original, broader idea (a full booking marketplace with clinic finder + patient app, directly copying an existing incumbent, NowServing) in favor of a narrower wedge that can be sold and validated with a single customer within weeks, not months.

## 6. Go-to-Market (Phase 1)

1. Validate directly with the founder's dentist's clinic: confirm actual no-show/reschedule volume and staff time spent, and pilot the tool there first — this is both the first customer and the primary source of product feedback.
2. Use that engagement as a reference case (quantified: e.g. "reduced no-shows by X%, saved Y hours/week") to approach 5–10 additional independent clinics directly (warm intros where possible, cold outreach otherwise).
3. Expand only after repeat validation across multiple clinics — resist expanding scope (patient app, directory, other verticals) until pulled there by demonstrated demand from paying customers, not assumption.

## 7. Competitive Landscape

- **NowServing** (Philippines) — the incumbent the founder's wife currently uses. Strong on booking + clinic discovery, has a native app and existing clinic relationships. Not focused on no-show economics or manual-workflow automation for small independent clinics — this is the gap Confirmly targets instead of competing head-on for the same clinics/use case.
- **International scheduling SaaS** (Timely/Gettimely, Acuity, SimplyBook.me, Zoho Bookings, Setmore, etc.) — mature, feature-rich, but generic (not Philippines-specific), typically not built around local payment methods, local SMS behavior, or the specific manual-SMS workflow observed here. Pricing and UX are not tailored to a solo Philippine clinic's actual habits.
- **Direct differentiation:** Confirmly is not competing to be a better booking directory or a better generic scheduler — it is positioned narrowly as the tool that removes manual SMS-based scheduling labor and recovers no-show revenue for a specific, underserved customer (small independent PH clinics), using the channel they already trust.

## 8. Risks & Non-Goals

| Risk | Notes |
|---|---|
| Clinic has no digital calendar today (paper/memory only) | Adoption lift is then "replace a habit," not "augment a tool" — must be confirmed during validation, changes onboarding difficulty significantly. |
| Secretary's role is broader than scheduling (triage, cash handling, patient reassurance) | Tool may reduce but not eliminate staff time — pitch must be "saves time / recovers revenue," not "replaces staff." |
| Patient behavior: older/less tech-forward patients may resist even simple SMS-reply flows | Fallback to human reply must always exist; tool should never fully remove the clinic's ability to respond manually. |
| Messenger/Meta platform dependency | Deliberately avoided in this plan. Meta's 2026 policy changes restrict proactive appointment-reminder messaging (`CONFIRMED_EVENT_UPDATE` tag retiring April 2026; Recurring Notifications already ended Feb 2026 outside a few exempted regions, not including the Philippines). SMS is the primary channel specifically to avoid this dependency. |
| Scope creep back toward a full marketplace (patient app, clinic finder, AI triage) | These were the original, broader idea and were deliberately deferred — see Section 2. Revisit only once multiple paying clinics are validated and specifically request it. |
| Medical liability if AI/triage features are added later | Any future AI-based doctor recommendation or triage feature requires clinical review before launch; not part of this plan's scope. |

## 9. Immediate Next Step

Talk to the dentist's clinic directly: confirm actual no-show/reschedule frequency and staff time spent on manual scheduling. This is the cheapest possible validation step and will confirm or kill the core assumption before any further planning or build work.

---

*Technical architecture and implementation plan: to be documented separately once business plan is validated.*
