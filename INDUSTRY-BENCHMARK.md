# Governance OS - Industry Benchmark & Feature Backlog

Comparable platforms across the four capability areas this app spans, and the features worth pulling in. Use this to prioritise the next build phases.

## 1. Policy & GRC (governance, risk, compliance)

Platforms: NAVEX One (PolicyTech), MetricStream, LogicGate Risk Cloud, Diligent One, AuditBoard, Workiva, ServiceNow GRC, OneTrust, Archer, Hyperproof, VComply, PowerDMS, DocTract, Ncontracts.

Features to extract:
- Read-and-acknowledge / attestation campaigns with per-employee tracking and reminders (NAVEX, PowerDMS). We have acknowledge; add campaigns + completion %.
- Automated review/expiry scheduling with escalations (all). We have review dates; add auto-reminders and overdue escalation.
- Multi-stage approval workflows with delegation of authority (all). Done (Draft to Released to HOD to Executive to Active).
- Policy-to-risk-to-control linkage and a control library (MetricStream, LogicGate, Archer). Partly done (link to depts/employees); add risk & control registers.
- Immutable audit trail and evidence export for auditors (all). Done (audit trail); add export packs.
- No-code workflow/form builder (LogicGate). Partial (forms are fixed); add a form builder.
- Regulatory change mapping / requirement libraries (MetricStream, OneTrust). Future.
- Training library tie-in (NAVEX). Future.
- Cross-program reporting dashboards + AI insights (MetricStream, NAVEX). Done (dashboard + AI insights).

## 2. Business process management / process mapping

Platforms: Nintex Process Manager (Promapp), SAP Signavio, Bizagi, Gluu, Software AG ARIS, Lucidchart, Pipefy, Creately.

Features to extract:
- Process maps that auto-generate RACI from assigned roles (Nintex Promapp) - exactly the methodology we implemented: performers = Responsible, process owner = Accountable, experts/stakeholders = Consulted, all = Informed.
- Swimlane / role-lane views of a process (Nintex, Bizagi, Signavio). Future: add swimlane layout by role or department.
- Process ownership, version history and scheduled process reviews (Nintex). Partly done via document lifecycle.
- Linked procedures, forms, systems and risks on each step (Nintex, Gluu). Partial (role/employee/department per step); add links to forms/systems/risks.
- BPMN 2.0 modelling and simulation (Bizagi, Signavio). Future (advanced).
- AI process capture / auto-documentation (Nintex). Future.
- Feedback and improvement suggestions on each process (Nintex, Gluu). Ties to our Opportunities module.

## 3. Org chart & workforce design

Platforms: ChartHop, Pingboard (Workleap), Orgvue, Functionly, The Org, Creately, Lucidchart, Deel/HR org charts.

Features to extract:
- Interactive, auto-synced org chart from the people master (Pingboard, ChartHop). Done (entity + departmental charts); add drag-to-reorganise and manager links.
- Employee cards with headcount-vs-budget, vacancies, and role context (ChartHop). Partly done (vacancies + job profiles); add budgeted-vs-filled headcount.
- Scenario / what-if org planning (ChartHop, Orgvue, Functionly). Future.
- Rich employee directory with search, filters, profiles (Pingboard). Done.
- HRIS sync (BambooHR, Workday, Azure AD) (Pingboard, ChartHop). Future (connect to your HR/SAP).
- Span-of-control and workforce analytics (Orgvue). Future.

## 4. Job descriptions & competency

Platforms: BambooHR, HRSG (CompetencyCore), JDXpert, SAP SuccessFactors, Workday.

Features to extract:
- Structured JD templates: purpose, reporting line, responsibilities, qualifications, KPIs (JDXpert, HRSG). Done (JD viewer + edit).
- Competency frameworks mapped to roles (HRSG). Future.
- Job families / grades / bands (JDXpert, Workday). Future: add grade to job profiles.
- Vacant vs filled position management (Workday, ChartHop). Done (vacancies).
- JD approval and version control (JDXpert). Future: apply the same lifecycle to JDs.

## Program sprints delivered on the approved plan

- Sprint 1 (foundation): config-driven document types, eight-workspace navigation, breadcrumbs, quick-create, My Governance Work inbox, and the section-25 honesty fixes.
- Sprint 2 (controlled documents + workflow): immutable version snapshots, side-by-side redline compare, rollback, controlled-copy watermark, effective/expiry dates, and a configurable multi-stage workflow engine (submit / approve / return / request-changes / reject / cancel / withdraw) with server-enforced stage roles and self-approval prevention.

- Sprint 3 (process & accountability): process hierarchy L0-L5 with rich process records, a drag-and-drop graphical process designer (nodes, connectors, zoom/pan, SVG export), RACI generation from processes, and a structured Delegation of Authority module (register, authority matrix, lookup tool, thresholds, joint authority).

- Sprint 4 (organization & job architecture): Positions as a first-class concept separate from employees (28 seeded), position-based org chart with vacant/acting seats, workforce analytics (span-of-control, org layers, budgeted-vs-filled headcount by grade, critical roles and succession readiness), plus job architecture on profiles/JDs (job family, grade band, decision rights, career path) and employee JD acknowledgement.

- Sprint 5 (compliance & assurance): a Requirements library (16 seeded - SFDA, ISO 22000/9001/27001, HACCP, ZATCA, PDPL, Nitaqat, SASO, etc.) mapped to policies/risks/controls; control testing (design and operating effectiveness, test results, sampling) added to the control library; and an Audit & CAPA module (findings, root cause, corrective/preventive actions, ageing and overdue tracking). Evidence-request campaigns are the one item held for a short follow-up.

- Sprint 6 (work management): a central Notifications & Tasks inbox that aggregates everything needing attention (approvals awaiting your role, overdue reviews, acknowledgements, overdue/owned CAPA, control tests due, DOA expiries, compliance gaps), each item deep-linking to the record, with a live count on the bell. Also fixed the Approvals queue to be document-workflow driven so each item opens the document for review and decision.

- Sprint 7 (intelligence & reporting): cross-entity global search (documents, processes, people, positions, risks, controls, requirements, DOA, findings) wired to the top-bar search; a functional Relationship Explorer that replaces the decorative graph (pick any record, see upstream/downstream connections and answer impact questions like "which controls support this policy?"); and calculated Dashboards (document lifecycle, compliance coverage, risk & control effectiveness, audit/CAPA ageing, workforce) with drill-down and CSV/print export.

- Sprint 8 (roadmap completion): evidence-request campaigns (request/submit/accept tied to requirements & controls), regulatory-change register mapped to requirements/policies, JD approval + version-control lifecycle (Draft/Submitted/Approved with version snapshots), org what-if scenario planning (add/remove/move seats with headcount & cost delta), Integrations & SSO framework (SAP/HRIS/Entra connector config + working employee sync + sync log), BPMN-style process palette (events, tasks, exclusive/parallel gateways) with flow validation and path simulation, and a compliance training & awareness library (courses, assignments, completion tracking) linked to policies.

Remaining by explicit exclusion: real AI model/endpoint (item 1) and the security/privacy hardening phase (item 8). Live SAP/HRIS/Entra data exchange is framed but requires IT-provisioned credentials; regulatory feeds are manual (no live auto-feed); BPMN simulation is a lightweight token/path trace, not a full execution engine. Merged the Document Management and Process & Operating Model workspaces and added a Create Artifact tile page along the way.

## Recommended next phases

Phase 2 - DELIVERED (now live in the app):
- Acknowledgement campaigns with per-employee completion tracking and reminders (Acknowledgements module).
- Risk register + control library with a 5x5 heatmap, linked to policies (Risk & Controls module).
- Form builder - create controlled forms in-app, not just fixed templates (Forms > New form).
- One-click RACI generation directly from a process flow (document view > Generate RACI).
- In-app Industry Benchmarks module showing platforms, feature sets, and adopted/planned/future status.

Phase 3 - DELIVERED (now live in the app):
- Swimlane process view by department, with a Flow/Swimlane toggle on each process.
- Link a form, a risk and a system to every process step.
- Budgeted-vs-filled headcount plan (Job Titles > Headcount plan) - 298 budgeted, 266 filled, 32 open.
- Job grades (E/L1/L2/M/S/P/G ladder) and a competency framework (core, leadership, functional) on job profiles and JDs.
- Auditor evidence export pack (PDF/print) per policy - metadata, approval history, acknowledgements, change requests, linked risks and audit trail.
- Still open for a later phase: BPMN 2.0 simulation, org what-if scenario planning, JD approval workflow, HRIS/SAP sync, regulatory-change feeds.

Phase 4 - IN PROGRESS (live-environment foundation DELIVERED):
- Full-stack conversion: Node/Express server + shared database (SQLite, Postgres-swappable). DONE.
- Real accounts with login (JWT) and RBAC enforced server-side (Viewer/Author/HOD/Executive/Admin). DONE.
- Audit actor set server-side (cannot be spoofed by the client). DONE.
- Still open: Microsoft Entra (Azure AD) SSO, HRIS/SAP sync for employees and org structure, regulatory-change feeds and training tie-ins, plus the remaining functional items (org what-if scenario planning, JD approval workflow, BPMN 2.0 editing).

Sources: NAVEX PolicyTech; MetricStream; LogicGate Risk Cloud; Nintex Process Manager (Promapp) RACI methodology; Bizagi; ChartHop; Pingboard; Orgvue; JDXpert; HRSG CompetencyCore.
