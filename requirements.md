# Requirements Document

## Introduction

Escolent MVP is a subject-agnostic, AI-native adaptive learning platform. The platform operates as an embedded layer within existing LMS systems (Canvas, Moodle, Google Classroom) to provide adaptive, personalized practice with honest mastery tracking, for any subject a school teaches. The core problem being solved is that schools track completion rather than mastery—students can finish exercises without understanding the material.

**MVP pilot content scope:** the platform's subject-agnostic mechanisms (Skill_Graph, Misconception_Taxonomy, evaluation, remediation — see Requirement 31) are validated end-to-end against one initial subject, Grade 8 Mathematics (IEB-aligned, starting with algebraic equations), at a single pilot school. This is the pilot's *content* scope, not the platform's architecture — Requirement 31 requires that a second subject be addable without redesigning the Platform.

The MVP targets a pilot deployment at Teneo, an online private K-12 school in South Africa, with one Grade 8 class. The platform must support low-end devices and unreliable connectivity typical of South African, Kenyan, and Nigerian markets.

**Note on Numeric Targets:** Requirements in this document contain specific numeric performance targets (latency thresholds, retention periods, device specifications, etc.). Unless explicitly noted otherwise, these represent reasonable engineering defaults subject to refinement during design and implementation, not validated hard requirements. POPIA-related timelines (Requirements 24-29) are provisional pending POPIA legal counsel review and must be validated by qualified legal counsel before implementation.

## Glossary

- **Platform**: The Escolent adaptive learning system
- **Student**: A K-12 learner using the Platform within their school's LMS (MVP pilot cohort: a Grade 8 class)
- **Teacher**: An educator who creates Spaces, monitors student progress, and can override AI assessments
- **Parent**: A parent or guardian of a Student
- **Admin**: A school administrator managing pilot scope, billing, and data operations
- **Space**: A teacher-defined practice environment with specific topic boundaries and guardrails
- **LMS**: Learning Management System (Canvas, Moodle, or Google Classroom)
- **Mastery_State**: A per-Student, per-skill probability estimate indicating likelihood of skill mastery
- **Session**: A continuous period of Student practice activity within a Space
- **Skill**: An atomic concept or procedure within a subject/curriculum configured on the Platform (MVP pilot content: Grade 8 algebraic equation Skills from the IEB curriculum — see Requirement 33)
- **Skill_Graph**: A dependency map showing prerequisite relationships between Skills
- **Misconception**: A persistent incorrect mental model, distinct from a careless slip
- **Misconception_Taxonomy**: A structured catalog of known Misconceptions with targeted remediation strategies
- **Pedagogical_Lead**: The Platform's subject matter expert responsible for curating the Misconception_Taxonomy and learning content
- **Practice_Problem**: A question or task, in whatever form the Skill's subject calls for, presented to a Student during a Session
- **Distress_Signal**: Language or pattern indicating student distress or self-harm risk
- **POPIA**: Protection of Personal Information Act (South African data protection law)
- **LTI**: Learning Tools Interoperability standard for LMS integration
- **SSO**: Single Sign-On authentication mechanism
- **Scaffolding**: Graduated support that fades from worked examples to independent practice
- **Spaced_Repetition**: A scheduling algorithm that resurfaces mastered Skills at increasing intervals
- **Override**: A teacher's manual correction of a Student's Mastery_State for a specific Skill
- **Escalation**: An alert sent to a Teacher when a Distress_Signal is detected
- **Evaluation_Strategy**: A per-Skill declaration of how Student responses are checked for correctness (e.g., exact match, symbolic equivalence, or rubric-based evaluation)
- **Content_Status**: The maturity state of a Skill or Misconception ("draft," "pending_approval," or "validated"); only "validated" content is ever servable to Students
- **Coverage_Status**: A per-Skill indicator ("rich", "thin", or "gap") of how well existing ingested content covers that Skill
- **Lens**: A fixed, platform-level pedagogical explanation strategy (e.g., concrete/analogy, procedural, narrative, Socratic) applied to any Skill's base description at instruction time
- **Guardian**: A registered parent or guardian contact associated with a Student, provided by the school

## Requirements

### Requirement 1: LMS Launch and Authentication

**User Story:** As a Student or Teacher, I want to launch the Platform from my school's LMS using my existing credentials, so that I don't need to manage separate login credentials.

#### Acceptance Criteria

1. WHEN a Student clicks the Platform link in Canvas, THE Platform SHALL authenticate the Student via LTI 1.3 and display their practice dashboard
2. WHEN a Student clicks the Platform link in Moodle, THE Platform SHALL authenticate the Student via LTI 1.3 and display their practice dashboard
3. WHEN a Student clicks the Platform link in Google Classroom, THE Platform SHALL authenticate the Student via Google Classroom API and display their practice dashboard
4. WHEN an authentication request fails, THE Platform SHALL display an error message with contact information for technical support
5. THE Platform SHALL complete authentication within 3 seconds for 95th percentile latency on connections with 2Mbps or faster bandwidth
6. WHEN a Teacher launches the Platform from an LMS, THE Platform SHALL authenticate the Teacher via LTI 1.3 or Google Classroom API and display the teacher dashboard with Space management interface

### Requirement 1A: Admin Direct Authentication

**User Story:** As an Admin, I want to access the Platform directly without navigating through course-specific LMS interfaces, so that I can manage the pilot independently of course enrollments.

#### Acceptance Criteria

1. THE Platform SHALL provide a direct login interface for Admins separate from the LTI launch flow
2. WHEN an Admin accesses the direct login interface, THE Platform SHALL authenticate the Admin via SSO or username/password
3. WHEN Admin authentication succeeds, THE Platform SHALL display the admin dashboard with pilot management, billing, and data operations interfaces
4. THE Platform SHALL complete Admin authentication within 3 seconds for 95th percentile latency on connections with 2Mbps or faster bandwidth
5. WHEN Admin authentication fails, THE Platform SHALL display an error message with contact information for technical support

### Requirement 2: Skill Graph and Prerequisite Tracking

**User Story:** As a Teacher, I want the Platform to understand prerequisite relationships between Skills in my subject, so that remediation targets foundational gaps rather than surface symptoms.

#### Acceptance Criteria

1. THE Skill_Graph SHALL represent all Skills defined for each subject/curriculum configured on the Platform; for the MVP pilot, this is populated with Grade 8 algebraic equation Skills from the IEB curriculum (see Requirement 33)
2. THE Skill_Graph SHALL encode prerequisite dependencies between Skills
3. WHEN a Student demonstrates mastery of a Skill, THE Platform SHALL make dependent Skills available for practice
4. WHEN a Student struggles with a Skill, THE Platform SHALL identify prerequisite Skills in the Skill_Graph
5. THE Platform SHALL store the Skill_Graph structure in a format that allows modification without code changes

### Requirement 3: Real-Time Knowledge Tracing

**User Story:** As a Student, I want the Platform to adapt to my understanding in real-time, so that I receive appropriate challenge and support within a single practice session.

#### Acceptance Criteria

1. WHEN a Student answers a Practice_Problem, THE Platform SHALL update the Mastery_State for the associated Skill within 2 seconds
2. THE Platform SHALL maintain a separate Mastery_State for each Student and each Skill
3. THE Platform SHALL calculate Mastery_State based on correctness and recent performance history
4. WHEN a Student's Mastery_State crosses the mastery threshold for a Skill, THE Platform SHALL flag the Skill as potentially mastered
5. THE Platform SHALL apply different mastery thresholds for procedural Skills versus conceptual Skills
6. THE Platform SHALL confirm mastery across at least two separate Sessions before marking a Skill as durably mastered
7. WHEN network connectivity is unavailable, THE Platform SHALL queue Mastery_State updates and synchronize them when connectivity is restored
8. THE Platform MAY track response time as a diagnostic signal visible to Teachers but SHALL NOT use response time in Mastery_State calculation to avoid penalizing low-end device users and ESL students

### Requirement 4: Misconception Detection and Remediation

**User Story:** As a Student, I want the Platform to identify my specific misunderstandings, so that I receive targeted help rather than generic hints.

#### Acceptance Criteria

1. THE Platform SHALL maintain a Misconception_Taxonomy per subject/curriculum configured on the Platform; for the MVP pilot, this is populated for Grade 8 algebraic equations
2. THE Misconception_Taxonomy SHALL classify each entry as either repetition-confirmed or first-occurrence-actionable, and THE Platform SHALL apply the distinction in Requirement 4.3 according to that classification
3. WHEN a Student provides an incorrect answer, THE Platform SHALL match the response pattern against the Misconception_Taxonomy within 3 seconds
4. THE Platform SHALL distinguish between a persistent Misconception and a careless slip based on error frequency across multiple Practice_Problems OR based on highly specific error patterns that indicate Misconception on first occurrence
5. WHEN a persistent Misconception is identified, THE Platform SHALL present targeted remediation addressing that specific Misconception
6. WHEN an error pattern suggests language comprehension difficulty rather than mathematical misunderstanding, THE Platform SHALL flag the response for Teacher review rather than applying mathematical remediation
7. THE Platform SHALL track identified Misconceptions per Student for Teacher visibility
8. WHEN a Student error does not match any pattern in the Misconception_Taxonomy, THE Platform SHALL log the unmatched error pattern with Student response context and make it available to the Pedagogical_Lead for taxonomy curation
9. WHEN a Pedagogical_Lead chooses to promote a logged unmatched error pattern to a Misconception, THE Platform SHALL pre-draft the Misconception entry (name, description, classification, remediation strategy) using the AI-assisted authoring mechanism specified in Requirement 31, for the Pedagogical_Lead to review and edit rather than author from a blank form
10. WHEN a Student error does not match any Misconception_Taxonomy pattern, THE Platform SHALL provide a general Socratic-style response to the Student in real time, independent of and not blocked by the asynchronous routing to the Pedagogical_Lead

### Requirement 5: Spaced Repetition Scheduling

**User Story:** As a Student, I want the Platform to help me remember what I've learned over time, so that my understanding is durable rather than temporary.

#### Acceptance Criteria

1. WHEN a Student achieves durable mastery of a Skill, THE Platform SHALL schedule the Skill for review using spaced repetition intervals
2. THE Platform SHALL increase the interval between reviews when a Student successfully completes review Practice_Problems
3. WHEN a Student struggles with a review Practice_Problem, THE Platform SHALL shorten the review interval for that Skill
4. THE Platform SHALL incorporate spaced repetition review Practice_Problems into regular practice Sessions
5. THE Platform SHALL limit spaced repetition reviews to no more than 20 percent of Practice_Problems in any Session

### Requirement 6: Cognitive Load-Aware Scaffolding

**User Story:** As a Student, I want the Platform to provide more support when I'm learning something new and less support as I gain confidence, so that I develop independent problem-solving skills.

#### Acceptance Criteria

1. WHEN a Student first encounters a new Skill, THE Platform SHALL present worked examples with step-by-step explanations
2. THE Platform SHALL fade scaffolding as a Student's Mastery_State for a Skill increases according to the mastery thresholds defined in Requirement 3
3. THE Platform SHALL provide partially completed Practice_Problems with hints when a Student's Mastery_State indicates emerging understanding but not yet mastery
4. WHEN a Student's Mastery_State indicates likely mastery, THE Platform SHALL present independent Practice_Problems without hints
5. WHEN a Student requests a hint during independent practice, THE Platform SHALL provide the hint but adjust the Mastery_State calculation accordingly

### Requirement 7: Adaptive Practice Session Experience

**User Story:** As a Student, I want practice sessions that adapt to my current understanding, so that I'm neither bored nor overwhelmed.

#### Acceptance Criteria

1. WHEN a Student starts a Session within a Space, THE Platform SHALL select Practice_Problems based on the Student's current Mastery_State and the Space's configured topic boundaries
2. THE Platform SHALL allow Students to continue Sessions without a hard time limit
3. WHEN a Student has completed 10 to 15 Practice_Problems or 15 to 20 minutes of practice, THE Platform SHALL suggest a natural stopping point
4. WHEN a Student demonstrates a prerequisite gap during individual practice, THE Platform SHALL automatically introduce prerequisite remediation within that Session
5. WHEN a Teacher has enabled classroom pacing mode for a Space, THE Platform SHALL prioritize Space-defined Skills over individually optimal prerequisite remediation
6. WHEN classroom pacing mode prevents prerequisite remediation, THE Platform SHALL flag the prerequisite gap visibly to the Teacher
7. THE Platform SHALL save Session progress every 30 seconds or after each Practice_Problem response, whichever occurs first

### Requirement 8: Offline Session Resilience

**User Story:** As a Student in an area with unreliable connectivity, I want to continue practicing even when my connection drops, so that my learning is not constantly interrupted.

#### Acceptance Criteria

1. WHEN a Student is mid-Session and network connectivity is lost, THE Platform SHALL allow the Student to continue answering loaded Practice_Problems
2. THE Platform SHALL queue Student responses locally when network connectivity is unavailable
3. WHEN network connectivity is restored, THE Platform SHALL synchronize queued responses within 10 seconds
4. WHEN a Student attempts to start a new Session without network connectivity, THE Platform SHALL display a message indicating that connectivity is required to load new content
5. THE Platform SHALL indicate connectivity status visibly to the Student during all Sessions

### Requirement 9: Teacher Space Creation and Configuration

**User Story:** As a Teacher, I want to create practice Spaces with specific topic boundaries, so that student practice aligns with my curriculum pacing and instructional goals.

#### Acceptance Criteria

1. THE Platform SHALL allow a Teacher to create a new Space with a name and description
2. WHEN creating a Space, THE Teacher SHALL specify which Skills from the Skill_Graph are included
3. WHEN creating a Space, THE Teacher SHALL specify a difficulty range for Practice_Problems
4. THE Platform SHALL allow a Teacher to enable or disable classroom pacing mode for a Space
5. THE Platform SHALL allow a Teacher to assign Students to a Space
6. THE Platform SHALL allow a Teacher to modify Space configuration after creation
7. WHEN a Teacher modifies Space boundaries, THE Platform SHALL apply changes to future Sessions without affecting in-progress Sessions
8. THE Platform SHALL allow a Teacher to describe a Space in plain language and receive pre-filled Skill selections and a suggested difficulty range for review, using the same AI co-authoring mechanism specified in Requirement 31; the Teacher SHALL review and may adjust every pre-filled value before saving

### Requirement 10: Teacher Dashboard and Mastery Visibility

**User Story:** As a Teacher, I want to see real-time mastery data for all my students, so that I can identify who needs help and with what.

#### Acceptance Criteria

1. THE Platform SHALL display a Teacher dashboard showing Mastery_State for each Student and each Skill in the Teacher's Spaces
2. THE Platform SHALL update the Teacher dashboard in real-time as Students practice
3. THE Platform SHALL allow a Teacher to filter the dashboard by Space, Student, or Skill
4. THE Platform SHALL visually distinguish between tentative mastery and durable mastery on the Teacher dashboard
5. THE Platform SHALL display flagged prerequisite gaps on the Teacher dashboard
6. THE Platform SHALL display identified Misconceptions per Student on the Teacher dashboard
7. THE Platform SHALL allow a Teacher to drill down into individual Student Session history
8. THE Platform SHALL allow a Teacher to ask a plain-language question about their students' progress and receive an answer synthesized from that Teacher's actual Mastery_State, Misconception, and Session data; THE Platform SHALL NOT state any fact not present in that underlying data

### Requirement 11: Teacher Override of AI Mastery Assessment

**User Story:** As a Teacher, I want to override the AI's mastery assessment when I observe student understanding directly, so that the Platform reflects my professional judgment.

#### Acceptance Criteria

1. THE Platform SHALL allow a Teacher to manually mark a Skill as mastered for a specific Student
2. WHEN a Teacher marks a Skill as mastered, THE Platform SHALL require the Teacher to provide a brief reason
3. THE Platform SHALL update the Student's Mastery_State immediately when a Teacher marks a Skill as mastered
4. THE Platform SHALL display Override history per Student for Teacher review
5. THE Platform SHALL periodically prompt Teachers to revisit Overrides that are more than 30 days old
6. THE Platform SHALL apply Overrides only to the specific Student, without modifying global mastery algorithms

### Requirement 12: Weekly Teacher Digests

**User Story:** As a Teacher, I want to receive weekly summaries of student progress, so that I can track trends without monitoring the dashboard constantly.

#### Acceptance Criteria

1. THE Platform SHALL generate a weekly digest email for each Teacher summarizing Student progress in their Spaces
2. THE weekly digest SHALL include the number of Students who achieved new durable mastery during the week
3. THE weekly digest SHALL include the number of Students with flagged prerequisite gaps
4. THE weekly digest SHALL include the most common Misconceptions identified during the week
5. THE Platform SHALL send weekly digests on a day and time configurable by the Teacher
6. THE Platform SHALL generate weekly digest content using the LLM abstraction layer specified in Requirement 22, grounded in that Teacher's actual Space and Student data for the week; THE Platform SHALL NOT generate digest content from a static template with values substituted in

### Requirement 13: Parent Mastery Updates

**User Story:** As a Parent, I want to receive plain-language updates about my child's mastery progress, so that I understand what my child is learning and where they may need support.

#### Acceptance Criteria

1. THE Platform SHALL generate plain-language mastery updates for Parents describing Student progress
2. THE Platform SHALL deliver Parent updates via the school's existing parent communication channel such as WhatsApp, SMS, or school mobile apps
3. THE Platform SHALL send Parent updates weekly by default
4. THE Platform SHALL include in Parent updates which Skills the Student mastered and which Skills need more practice
5. THE Platform SHALL avoid technical terminology in Parent updates
6. WHERE a Parent does not have access to digital communication channels, THE Platform SHALL provide a printable summary report that Teachers can deliver physically
7. THE Platform SHALL generate Parent update content using the LLM abstraction layer specified in Requirement 22, grounded in that Student's actual Mastery_State data for the period covered; THE Platform SHALL NOT generate update content from a static template with values substituted in

### Requirement 14: Admin Pilot Scope Management

**User Story:** As an Admin, I want to control which classes participate in the pilot, so that I can manage rollout scope and risk.

#### Acceptance Criteria

1. THE Platform SHALL allow an Admin to enable or disable Platform access for specific classes
2. THE Platform SHALL allow an Admin to view which Teachers and Students have active Platform access
3. THE Platform SHALL prevent Students from accessing the Platform when their class is disabled by an Admin
4. WHEN a pilot reaches its 21st day, THE Platform SHALL surface a checkpoint summary to the Admin and the Escolent team, including adoption and early mastery signal to date
4. THE Platform SHALL surface a specific pilot-progress summary to the Admin at the pilot's day-21 mark, distinct from routine ongoing metrics

### Requirement 15: Admin Adoption and Mastery Trends

**User Story:** As an Admin, I want to see overall adoption and mastery trends across the pilot, so that I can evaluate Platform effectiveness.

#### Acceptance Criteria

1. THE Platform SHALL display an Admin dashboard showing adoption metrics including active Students, average Session duration, and total Practice_Problems completed
2. THE Platform SHALL display on the Admin dashboard aggregated mastery metrics including average Skills mastered per Student and distribution of Mastery_States
3. THE Platform SHALL allow an Admin to filter metrics by Teacher, class, or date range
4. THE Platform SHALL update Admin dashboard metrics daily
5. THE Platform SHALL allow an Admin to ask a plain-language question about pilot progress and receive an answer synthesized from that tenant's actual adoption and mastery data; THE Platform SHALL NOT state any fact not present in that underlying data

### Requirement 16: Admin Data Export

**User Story:** As an Admin, I want to export student data for analysis or migration, so that I retain control over school data.

#### Acceptance Criteria

1. THE Platform SHALL allow an Admin to export all Student interaction data in CSV format
2. THE Platform SHALL allow an Admin to export all Student Mastery_State data in CSV format
3. THE Platform SHALL allow an Admin to export Session history in CSV format
4. THE Platform SHALL complete data exports within 60 seconds for datasets containing up to 100 Students

### Requirement 17: Admin Data Deletion

**User Story:** As an Admin, I want to delete student data upon request, so that I comply with data protection regulations and parent requests.

#### Acceptance Criteria

1. THE Platform SHALL allow an Admin to request deletion of all data for a specific Student
2. WHEN an Admin requests Student data deletion, THE Platform SHALL permanently delete the Student's Mastery_State, Session history, and interaction logs within 72 hours
3. THE Platform SHALL provide confirmation to the Admin when data deletion is complete
4. THE Platform SHALL retain anonymized aggregated statistics after individual Student data deletion

### Requirement 18: Distress Signal Detection

**User Story:** As a Teacher, I want the Platform to alert me immediately if a student shows signs of distress, so that I can intervene appropriately.

#### Acceptance Criteria

1. THE Platform SHALL monitor Student free-text responses for Distress_Signals using pattern-based detection
2. THE Platform SHALL monitor Student free-text responses for Distress_Signals using contextual analysis
3. WHEN a Distress_Signal is detected, THE Platform SHALL create an immediate Escalation to the Student's Teacher
4. THE Platform SHALL err toward over-triggering rather than under-triggering Distress_Signal detection
5. THE Platform SHALL log all detected Distress_Signals with timestamp and context for Teacher review

### Requirement 19: Distress Signal Escalation and Response

**User Story:** As a Teacher, I want to receive real-time alerts when distress signals are detected, so that I can respond quickly and appropriately.

#### Acceptance Criteria

1. WHEN an Escalation is created, THE Platform SHALL send a real-time notification to the Student's Teacher within 5 seconds
2. THE Platform SHALL display Escalation details including the Student's response text and timestamp
3. WHEN the primary Teacher has not acknowledged an Escalation within 10 minutes, THE Platform SHALL send a backup Escalation to a designated backup Teacher or Admin
4. THE Platform SHALL never provide counseling or mental health advice to Students
5. THE Platform SHALL display a message to the Student indicating that their Teacher has been notified and will follow up

### Requirement 20: Guardrail Enforcement

**User Story:** As a Teacher, I want the Platform to keep students within defined topic boundaries, so that practice remains aligned with my instructional goals.

#### Acceptance Criteria

1. WHEN a Student is practicing in a Space, THE Platform SHALL only present Practice_Problems for Skills within the Space's configured boundaries
2. IF a Student requests help with a topic outside the Space boundaries, THEN THE Platform SHALL indicate that the topic is outside the current practice scope
3. THE Platform SHALL prevent Students from using the Platform to extract direct answers to homework or test questions
4. WHEN a Student's input suggests answer-seeking behavior, THE Platform SHALL redirect the Student to explain their thinking rather than providing a direct answer

### Requirement 21: Multi-Tenancy by School

**User Story:** As an Admin, I want our school's data isolated from other schools, so that student privacy is protected.

#### Acceptance Criteria

1. THE Platform SHALL isolate Student, Teacher, and Admin data by school
2. THE Platform SHALL prevent Teachers from one school from accessing Student data from another school
3. THE Platform SHALL prevent Admins from one school from accessing data from another school
4. THE Platform SHALL allow the Platform operator to configure billing and feature settings per school

### Requirement 22: LLM Provider Abstraction

**User Story:** As a Platform operator, I want to swap LLM providers without rewriting core logic, so that the Platform is not locked into a single vendor.

#### Acceptance Criteria

1. THE Platform SHALL isolate LLM provider API calls behind a provider-agnostic interface
2. THE Platform SHALL allow configuration of LLM provider credentials without code changes
3. THE Platform SHALL support switching LLM providers through configuration changes only

### Requirement 23: Low-End Device Performance

**User Story:** As a Student using a low-end device, I want the Platform to load quickly and respond smoothly, so that I can focus on learning rather than waiting.

#### Acceptance Criteria

1. THE Platform SHALL load the practice interface within 5 seconds on a device with 2GB RAM and a dual-core 1.5GHz processor over a 2Mbps connection
2. THE Platform SHALL respond to Student interactions within 1 second for UI actions that do not require server computation
3. THE Platform SHALL minimize client-side memory usage to remain functional on devices with 2GB RAM

### Requirement 24: POPIA Lawful Processing Basis

**User Story:** As an Admin, I want to ensure the Platform processes student data lawfully under POPIA, so that the school complies with South African data protection law.

#### Acceptance Criteria

1. THE Platform SHALL process Student personal information only for the purpose of providing adaptive learning services
2. THE Platform SHALL obtain explicit parental consent before processing personal information of Students under 18 years (pending legal counsel review to determine consent mechanism and scope)
3. THE Platform SHALL provide clear information to Parents and Students about what data is collected and how it is used
4. THE Platform SHALL process only the minimum Student personal information necessary to provide adaptive learning services
5. THE Platform SHALL validate all POPIA compliance requirements with qualified POPIA legal counsel before production deployment

### Requirement 25: POPIA Data Subject Rights

**User Story:** As a Parent, I want to access, correct, and delete my child's data, so that I exercise my rights under POPIA.

#### Acceptance Criteria

1. THE Platform SHALL allow Parents to request access to their child's personal information
2. WHEN a Parent requests data access, THE Platform SHALL provide the information within a timeframe compliant with POPIA (pending legal counsel review to determine specific timeframe)
3. THE Platform SHALL allow Parents to request correction of inaccurate personal information
4. THE Platform SHALL allow Parents to request deletion of their child's personal information
5. WHEN a Parent requests data deletion, THE Platform SHALL complete deletion within a timeframe compliant with POPIA (pending legal counsel review to determine specific timeframe) and provide confirmation
6. THE Platform SHALL validate all data subject rights procedures and timelines with qualified POPIA legal counsel before production deployment; identity verification for these requests is governed by Requirement 35

### Requirement 26: POPIA Data Retention and Deletion

**User Story:** As an Admin, I want student data deleted automatically when no longer needed, so that the Platform complies with POPIA data minimization principles.

#### Acceptance Criteria

1. THE Platform SHALL retain Student interaction data, Mastery_State history, and Session logs for the duration of the Student's enrollment plus a retention period compliant with POPIA (pending legal counsel review to determine specific retention period)
2. WHEN the retention period expires, THE Platform SHALL automatically delete or anonymize Student personal information
3. THE Platform SHALL allow immediate data deletion upon request from a Parent or Admin
4. THE Platform SHALL retain anonymized aggregated statistics after individual Student data deletion for product improvement
5. THE Platform SHALL validate data retention periods and deletion procedures with qualified POPIA legal counsel before production deployment

### Requirement 27: POPIA Cross-Border Data Transfer Awareness

**User Story:** As an Admin, I want to understand where student data is stored and processed, so that I can assess cross-border transfer implications under POPIA.

#### Acceptance Criteria

1. THE Platform SHALL disclose to Admins the geographic location of data storage and processing infrastructure
2. WHEN Student personal information is transferred outside South Africa, THE Platform SHALL implement appropriate safeguards as required by POPIA
3. THE Platform SHALL document cross-border data transfer mechanisms for Admin review

### Requirement 28: Data Breach Notification

**User Story:** As an Admin, I want to be notified immediately of any data breach, so that I can fulfill POPIA notification obligations.

#### Acceptance Criteria

1. IF a data breach affecting Student personal information occurs, THEN THE Platform SHALL notify the affected school's Admin within a timeframe compliant with POPIA (pending legal counsel review to determine specific notification timeframe)
2. THE Platform SHALL provide breach details including what data was affected, when the breach occurred, and what mitigation steps have been taken
3. THE Platform SHALL assist Admins in fulfilling POPIA breach notification obligations to the Information Regulator and affected Parents
4. THE Platform SHALL validate breach notification procedures and timelines with qualified POPIA legal counsel before production deployment

### Requirement 29: Logging and Audit Trail

**User Story:** As an Admin, I want a complete audit trail of data access and modifications, so that I can demonstrate POPIA compliance.

#### Acceptance Criteria

1. THE Platform SHALL log all access to Student personal information including timestamp, user, and purpose
2. THE Platform SHALL log all modifications to Student personal information including timestamp, user, and changed fields
3. THE Platform SHALL retain audit logs for at least 2 years
4. THE Platform SHALL allow Admins to export audit logs for compliance review

### Requirement 30: Session State Recovery

**User Story:** As a Student whose connection drops mid-session, I want to resume exactly where I left off, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN a Student's Session is interrupted by connectivity loss or browser closure, THE Platform SHALL save the Session state including current Practice_Problem and responses
2. WHEN a Student returns to the Platform, THE Platform SHALL offer to resume the interrupted Session
3. THE Platform SHALL restore the exact Practice_Problem and Student responses from the interrupted Session
4. THE Platform SHALL expire saved Session states after 24 hours

### Requirement 31: Subject-Agnostic Evaluation and AI-Assisted Content Authoring

**User Story:** As a Teacher or Pedagogical_Lead, I want to author adaptive learning content for any subject, not just mathematics, so that the Platform can scale to new subjects without being redesigned each time.

#### Acceptance Criteria

1. THE Platform SHALL support a configurable Evaluation_Strategy per Skill, including at minimum exact-match/symbolic-equivalence and rubric-based LLM evaluation
2. WHEN a Skill's Evaluation_Strategy is rubric-based, THE Platform SHALL grade Student responses against a teacher-defined rubric rather than requiring a single correct answer
3. THE Platform SHALL support semantic (LLM-based) Misconception pattern matching as the default detection mechanism for any Skill that does not use symbolic or regex matching
4. WHEN a Teacher or Pedagogical_Lead provides a plain-language description of a new subject or unit, THE Platform SHALL generate a draft Skill_Graph and draft Misconception_Taxonomy for review
5. THE Platform SHALL NOT present AI-proposed Skill_Graph or Misconception_Taxonomy content to Students until it has reached Content_Status "validated"
6. THE Platform SHALL track Content_Status for each Skill and Misconception as one of "draft" (AI-proposed, not yet reviewed by a human), "pending_approval" (reviewed and edited by a Teacher or Pedagogical_Lead, awaiting final sign-off from the content owner), or "validated" (signed off and live)
7. THE Platform SHALL NOT serve content with Content_Status "draft" or "pending_approval" to Students under any circumstance
8. THE Platform SHALL promote content from "pending_approval" to "validated" only via explicit sign-off from the content owner (the Teacher for Space-level content, the Pedagogical_Lead for platform-level content); promotion SHALL NOT occur automatically or based on accumulated Student interaction volume
9. THE Platform SHALL allow a Teacher to edit, merge, split, or remove AI-proposed Skills or Misconceptions before approval
10. WHEN a Skill's Evaluation_Strategy is rubric_llm, THE Platform SHALL display per-criterion feedback to the Student rather than a single binary correct/incorrect result

### Requirement 32: AI-Native Content Experience

**User Story:** As a Student or Teacher, I want school content reorganized into a clear, skill-based structure instead of a messy file list, so that navigating and understanding course material is easier.

#### Acceptance Criteria

1. THE Platform SHALL present Skills to Students organized by learning progression (Skill_Graph order) rather than by upload date or file order
2. THE Platform SHALL display, for each Skill, a synthesized summary alongside a visible reference to the original source material it was derived from
3. THE Platform SHALL NOT alter, delete, or replace original source material when generating a synthesized summary
4. WHEN a Teacher views a Space, THE Platform SHALL display a per-Skill content coverage indicator (rich, thin, or gap), aggregated from the coverage status of the Space's included Skills
5. THE Platform SHALL allow a Student to ask a free-text question, scoped to Skills within their current Space boundary, consistent with Requirement 20's guardrail enforcement
6. THE Platform SHALL display Content_Status ("draft," "pending_approval," or "validated") to Teachers, Pedagogical_Leads, and Admins, and SHALL NOT display Content_Status to Students
7. THE Platform SHALL provide the Pedagogical_Lead a platform-wide, cross-tenant view aggregating per-Skill coverage across all schools, to help prioritize content-authoring effort where it is most needed

### Requirement 33: LMS Content Ingestion and Structuring

**User Story:** As a Teacher or Pedagogical_Lead, I want the Platform to use content I've already created in our LMS, so that I don't have to re-author material from scratch.

#### Acceptance Criteria

1. THE Platform SHALL support ingesting text-based course content (pages, PDFs, Word documents) from a connected LMS, subject to explicit school authorization of the required read scope
2. THE Platform SHALL support ingesting image-based content (diagrams, scanned materials) via OCR and visual description
3. THE Platform SHALL preserve a traceable reference from any ingested content to its original source location
4. THE Platform SHALL NOT modify or delete original source content during ingestion
5. WHEN ingested content for a Skill is sparse or absent, THE Platform SHALL fall back to the plain-language-description authoring flow defined in Requirement 31.4
6. Video content ingestion is explicitly out of scope for this MVP and SHALL be treated as a future enhancement

### Requirement 34: Adaptive Instruction

**User Story:** As a Student, I want my first exposure to a new concept to build on what I already know and be explained in a way likely to make sense to me, so that I understand it the first time, not just after repeated practice failures.

#### Acceptance Criteria

1. WHEN a Student encounters a Skill for the first time, THE Platform SHALL check the Student's Mastery_State for that Skill's direct prerequisites before presenting instruction
2. IF a prerequisite's Mastery_State is tentative, stale, or unassessed, THEN THE Platform SHALL present a brief bridging explanation as part of the new Skill's instruction, rather than a separate remediation Session
3. THE Platform SHALL maintain a fixed, platform-level library of pedagogical explanation strategies ("Lenses"), authored once and reused across all Skills and subjects
4. THE Platform SHALL select a default Lens for a Skill's initial instruction based on the Skill's skill_type
5. WHEN a Student's first practice attempt after initial instruction is incorrect, THE Platform SHALL select a different Lens than the one used for initial instruction, using a fixed platform-level switching policy
6. THE Platform SHALL NOT require per-Skill authored explanation variants; Lens content SHALL be generated at runtime from the Skill's base description and the selected Lens template
7. THE Platform SHALL NOT require or prompt a Student to select or indicate a preferred teaching style at any point
8. THE Platform SHALL track Content_Status for generated Lens-delivered explanation content using the same three-stage model and promotion mechanism as other AI-proposed content, and SHALL NOT serve it to a Student until it reaches "validated"

### Requirement 35: Parent Identity Verification and Data Rights Access

**User Story:** As a Parent, I want to securely verify my identity before accessing, correcting, or deleting my child's data, so that only I, and not anyone claiming to be me, can exercise these rights.

#### Acceptance Criteria

1. THE Platform SHALL maintain a record of registered Guardian contacts per Student, provided by the school
2. WHEN a Parent submits a data access, correction, or deletion request, THE Platform SHALL send a verification token to the contact channel already on file for a matching registered Guardian, not to a contact value the requester provides freely
2a. THE Platform SHALL NOT disclose whether a submitted contact value matches a registered Guardian record to a requester whose information does not match; the requester-facing response SHALL be indistinguishable between a genuine non-match and a token having been sent
3. THE Platform SHALL NOT process a data rights request until the verification token is confirmed
4. THE Platform SHALL NOT create a persistent Parent user account; verified access SHALL be scoped to the single request session
5. WHEN a Student has multiple registered Guardians, THE Platform SHALL notify the school's Admin of any data rights request for Admin awareness, without blocking the verified Guardian's request
