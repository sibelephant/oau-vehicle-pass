# Product Requirements Document
## OAU Vehicle Pass Authentication System — Mobile Implementation

**Related study:** *Development of a Vehicle Pass Authentication System* (OAU main campus gate case study)
**Document type:** PRD for the mobile realization of the study's proposed model
**Status:** Draft v1.0

---

## 1. Background

The study identifies the main OAU campus gate as a high-traffic entry point still relying on manual sticker checks and paper logbooks — a process the study characterizes as slow, forgery-prone, and unable to provide real-time alerts on blacklisted vehicles. The proposed model addresses this by combining **Automatic Number Plate Recognition (ANPR/ALPD)** and **QR code verification** into one dual-channel authentication system, so that each method compensates for the other's weaknesses (e.g., QR still works when plate recognition is degraded by poor lighting or rain).

This PRD translates that proposed model — originally scoped around a registration **website** — into a **mobile-first implementation**, without changing the study's aim, objectives, or evaluation criteria.

## 2. Aim

> *The aim of the study is to develop a vehicle pass authentication system for OAU campus Gate.*

The mobile implementation carries this aim forward unchanged: the product is still one authentication system, now delivered through a driver-facing mobile app, a gate-officer mobile app, and a shared backend, instead of a browser-only registration site.

## 3. Objectives and How the Mobile Product Meets Them

| # | Study objective (verbatim) | How the mobile implementation satisfies it |
|---|---|---|
| i | Design an automatic vehicle pass authentication model with a secure digital vehicle registration form | The Driver App's registration flow replaces the web registration form; the backend model design (API + ANPR engine + database) is unchanged in principle, only re-hosted for mobile clients |
| ii | Implement the automatic vehicle pass authentication model in (i) | Implemented as: Driver App + Gate App + backend API + ANPR engine + database, using ALPD plus QR code exactly as the methodology specifies |
| iii | Evaluate the performance of the model in (ii) | Evaluation plan (Section 10) tests response time, accuracy, and usability on the mobile apps, mirroring the study's methodology (iii) |

## 4. Goals & Success Metrics

| Goal | Metric | Target (prototype) |
|---|---|---|
| Fast verification | End-to-end gate decision time (scan → grant/deny) | < 3 seconds |
| Accurate plate reads | ANPR match accuracy on registered plates | ≥ 90% under normal daylight conditions |
| Reliable fallback | Successful entries via QR when ANPR fails | 100% (QR must never depend on ANPR) |
| Usable by non-technical staff | Gate officer task success rate in usability testing | ≥ 95% without assistance |
| Adoption | Registered vehicles using the Driver App vs. paper stickers | Majority of test-gate traffic within pilot period |

These map directly to the study's stated evaluation methods: **response time, accuracy, and usability**.

## 5. Scope

### 5.1 In scope (prototype, main gate only)
Matches the study's five listed system components, each re-expressed as a mobile-reachable module:

1. **Vehicle registration module** — Driver App: register staff, student, visitor, and commercial ("along bus") vehicles into the digital database.
2. **Authentication module** — Gate App: real-time verification via ANPR plate match and/or QR code scan.
3. **Database management** — secure storage of vehicle details, registration status, and entry/exit history.
4. **Monitoring interface** — web dashboard for security personnel to oversee verification activity and pull historical records.
5. **Reporting system** — access-pattern, peak-hour, and unauthorized-attempt reports for security planning.

### 5.2 Out of scope
Directly carried over from the study's scope boundaries:

- Secondary gates or satellite campuses.
- Full-scale, all-gate deployment (prototype only, one gate).
- Fully automated handling of one-time visitor entries (these remain manually verified).
- Guarantees of performance under poor camera quality, unstable network, or non-weatherproofed hardware — these are noted risks, not solved problems, per the study's own limitations.

## 6. Users / Personas

| Persona | Role | Primary app |
|---|---|---|
| Vehicle owner (staff/student/visitor/along-bus operator) | Registers vehicle, carries digital pass | Driver App |
| Security/gate officer | Verifies vehicles at the barrier, manual override | Gate App |
| Security supervisor/admin | Monitors activity, pulls reports, manages blacklist | Web dashboard |

## 7. Functional Requirements

| ID | Requirement | Module | Traces to objective |
|---|---|---|---|
| FR-1 | Driver can submit vehicle registration (owner details, plate number, category) with supporting documents | Registration | (i) |
| FR-2 | System issues a time-limited, encrypted QR pass once registration is approved | Registration / Authentication | (i), (ii) |
| FR-3 | Gate App can scan a QR code and validate it against the backend in real time | Authentication | (ii) |
| FR-4 | Gate App/gate camera can capture a plate image and run ANPR matching against registered vehicles | Authentication | (ii) |
| FR-5 | System grants or denies access and logs the decision, channel used (QR/ANPR/manual), and timestamp | Database | (ii) |
| FR-6 | Gate officer can manually override a decision, with reason logged | Authentication | (ii) |
| FR-7 | Dashboard shows live entry/exit activity and flags blacklisted or unmatched vehicles | Monitoring | (ii) |
| FR-8 | Dashboard/reporting can generate access-pattern and peak-hour reports over a selected date range | Reporting | (iii, evaluation input) |
| FR-9 | Driver App sends push notifications for pass expiry and gate activity on the owner's vehicle | Registration | (i) |

## 8. Non-Functional Requirements

- **Performance:** gate decision within ~3 seconds under normal conditions (measured in evaluation, objective iii).
- **Security:** QR passes are signed/encrypted and time-limited to prevent screenshot reuse; role-based access for gate officers vs. admins; all traffic over HTTPS.
- **Reliability/offline tolerance:** Gate App caches the current-day whitelist/blacklist locally so QR verification keeps working through brief network drops — directly addressing the study's flagged risk around network connectivity.
- **Usability:** Gate officer workflow must be a one-glance grant/deny screen, testable with non-technical staff (per the study's usability evaluation method).
- **Data integrity:** every access event is immutably logged for later audit/reporting.

## 9. System Architecture (summary)

Three cooperating surfaces share one backend:

- **Driver App** — registration and QR pass.
- **Gate App** — QR scanning and/or plate capture, grant/deny screen, manual override.
- **Backend** — API & auth service, ANPR engine, and the vehicle/pass database — feeding a **web dashboard** for monitoring and reporting.

*(Full architecture and entry-flow diagrams already shared earlier in this conversation.)*

## 10. Evaluation Plan (maps to objective iii)

| Test | Method | Metric |
|---|---|---|
| Response time | Timed trials of QR-only, ANPR-only, and combined verification at the test gate | Seconds per decision |
| Accuracy | Controlled trials across lighting/weather conditions with known plates | % correct match / false accept / false reject |
| Usability | Task-based testing with actual gate officers, unfamiliar with the system beforehand | Task completion rate, time-on-task, error rate |

## 11. Assumptions & Constraints

- Prototype is limited to the OAU main campus gate, within project time and resource constraints.
- Camera quality, network connectivity, and weatherproofing of gate hardware may affect real-world ANPR performance — the QR channel exists specifically to absorb this risk.
- Visitor and one-time entries continue to rely on manual verification for this phase.

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ANPR accuracy drops in rain/low light | QR remains a fully independent fallback channel (per the study's contribution to knowledge) |
| Gate-side network outage | Local cache of today's valid passes on the Gate App |
| Officer resistance to new workflow | Usability testing and manual-override option built in from day one |
| QR screenshot sharing/misuse | Time-limited, signed QR tokens tied to a specific vehicle record |

## 13. Implementation Roadmap

Phased to mirror the study's own methodology (design → implement → evaluate):

1. **Phase 1 — Design:** finalize data model, API contracts, and QR/ANPR interaction flow (objective i).
2. **Phase 2 — Implement:** build Driver App, Gate App, backend, ANPR integration, and dashboard (objective ii).
3. **Phase 3 — Evaluate:** run response-time, accuracy, and usability testing at the main gate; document results (objective iii).

---
*This PRD intentionally does not introduce new goals beyond the study's aim and three objectives — it only re-targets the delivery mechanism from a website to a mobile app pair, per the request to convert the implementation.*