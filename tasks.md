# Implementation Plan: Escolent MVP Adaptive Learning Platform

## Overview

This implementation plan breaks down the Escolent MVP into discrete, testable coding tasks. The platform is a TypeScript/Next.js PWA with Supabase backend, implementing five core adaptive learning components: Skill Graph, Knowledge Tracing, Misconception Detection, Spaced Repetition, and Scaffolding. The system supports four user roles (Student, Teacher, Admin, Pedagogical_Lead) with multi-tenant isolation enforced via Row Level Security.

The implementation follows an incremental approach: infrastructure → authentication → core adaptive learning engines → UI dashboards → offline support → compliance features.

## Tasks

- [ ] 1. Set up project infrastructure and core database schema
  - [ ] 1.1 Initialize Next.js 14+ project with TypeScript, Tailwind CSS, and PWA configuration
    - Initialize Next.js 14 project with App Router
    - Configure TypeScript with strict mode
    - Set up Tailwind CSS
    - Configure Workbox for service worker generation
    - Set up PWA manifest with offline support configuration
    - _Requirements: 23.1, 23.2, 8.1_

  - [ ] 1.2 Configure Supabase connection and create multi-tenancy foundation tables
    - Set up Supabase client with environment variables
    - Create `tenants` table with billing status
    - Create `users` table with tenant_id foreign key and LMS integration fields
    - Create `user_roles` table for role-based access control
    - Enable Row Level Security (RLS) on all tenant-scoped tables
    - _Requirements: 21.1, 21.2, 21.3, 1.1, 1.2, 1A.1_

  - [ ] 1.3 Create skill graph and mastery state database tables
    - Create `skills` table with prerequisite_ids JSON array and skill_type enum
    - Create `mastery_states` table with probability, response_history JSONB, and mastery flags
    - Create indexes for skill graph traversal queries
    - Create indexes for mastery state lookups by student and skill
    - _Requirements: 2.1, 2.2, 2.5, 3.2, 3.3_

  - [ ] 1.4 Create misconception taxonomy and spaced repetition database tables
    - Create `misconceptions` table with error_pattern JSONB and classification enum
    - Create `student_misconceptions` table tracking occurrence counts
    - Create `unmatched_errors` table with anonymized student IDs
    - Create `spaced_repetition_schedules` table with SM-2 algorithm fields
    - Create indexes for due review queries
    - _Requirements: 4.1, 4.2, 4.7, 4.8, 5.1_

  - [ ] 1.5 Create session, space, and escalation database tables
    - Create `sessions` table with status enum and problems JSONB array
    - Create `spaces` table with included_skill_ids array and classroom_pacing_mode
    - Create `space_enrollments` junction table
    - Create `mastery_overrides` table with reason validation constraint
    - Create `distress_escalations` table with detection_method enum
    - Create `audit_logs` table for POPIA compliance
    - Create indexes for active sessions and unacknowledged escalations
    - _Requirements: 7.7, 9.1, 9.2, 11.1, 11.2, 18.5, 29.1_

  - [ ] 1.6 Implement Row Level Security (RLS) policies for all tenant-scoped tables
    - Create RLS policies for students (own data access only)
    - Create RLS policies for teachers (tenant-scoped read access)
    - Create RLS policies for admins (tenant-scoped full access)
    - Create special RLS policies for Pedagogical_Lead (cross-tenant read for unmatched_errors, cross-tenant INSERT and UPDATE for misconceptions)
    - Test RLS enforcement with sample queries
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

- [ ] 2. Checkpoint - Database schema validation
  - Run database migrations and verify all tables created successfully
  - Test RLS policies with sample tenant data
  - Ensure all indexes created and foreign key constraints enforced
  - Ask the user if questions arise

- [ ] 3. Implement authentication system for all four user roles
  - [ ] 3.1 Create LTI 1.3 authentication flow for Canvas/Moodle
    - Implement `POST /api/auth/lti/login` endpoint for OIDC initiation
    - Implement `POST /api/auth/lti/launch` endpoint for JWT validation
    - Implement `GET /api/auth/lti/jwks` endpoint for public key publishing
    - Extract user role, tenant ID, and course context from LTI JWT claims
    - Create or retrieve Supabase user and set session with tenant_id context
    - Store LMS configuration per tenant in `lms_configs` table
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ] 3.2 Write unit tests for LTI JWT validation and session creation
    - Test valid LTI JWT creates session successfully
    - Test tampered JWT signature rejected
    - Test expired JWT rejected
    - Test missing required claims rejected
    - Test correct tenant_id extracted and set in session
    - _Requirements: 1.1, 1.4_

  - [ ] 3.3 Create Google Classroom API authentication flow
    - Implement `GET /api/auth/google/callback` endpoint for OAuth callback
    - Implement `POST /api/auth/google/launch` endpoint for token validation
    - Extract user role and course context from Google Classroom API
    - Infer tenant from course ownership mapping
    - Create or retrieve Supabase user and set session
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ] 3.4 Create Admin direct authentication flow
    - Implement `POST /api/auth/admin/login` endpoint with SSO validation
    - Implement `POST /api/auth/admin/logout` endpoint for session termination
    - Create `/admin/login` page with credential input form
    - Validate user has `admin` role in `user_roles` table
    - Set RLS context with tenant_id from user's school association
    - Redirect to admin dashboard on success
    - _Requirements: 1A.1, 1A.2, 1A.3, 1A.4, 1A.5_

  - [ ] 3.5 Create Pedagogical_Lead authentication flow
    - Implement `/pedagogical-lead/login` page
    - Validate user has `pedagogical_lead` role (global, no tenant constraint)
    - Set session without tenant_id constraint for cross-tenant access
    - Redirect to curation dashboard on success
    - _Requirements: 4.8_

  - [ ] 3.6 Write integration tests for all authentication flows
    - Test Student LTI launch from Canvas creates session and displays dashboard
    - Test Teacher LTI launch displays teacher dashboard
    - Test Admin direct login displays admin dashboard
    - Test Pedagogical_Lead login grants cross-tenant read access
    - Test authentication failures display error messages with support contact
    - _Requirements: 1.1, 1.2, 1.3, 1A.1, 1A.3_

- [ ] 4. Implement skill graph system and prerequisite traversal
  - [ ] 4.1 Create skill graph data loader and prerequisite traversal functions
    - Implement breadth-first search (BFS) for prerequisite identification
    - Implement topological sort for skill unlock sequencing
    - Implement cycle detection validation for skill creation/modification
    - Create TypeScript interfaces for Skill and traversal results
    - Load IEB Grade 8 algebra skill graph into database
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [ ] 4.2 Write property test for skill unlock on mastery
    - **Property 1: Skill Unlock on Mastery**
    - **Validates: Requirements 2.3**
    - Generate random skill DAGs with 10-50 nodes
    - For any skill marked mastered, verify all dependent skills become available
    - Run with 100+ iterations using fast-check

  - [ ] 4.3 Write property test for prerequisite identification via graph traversal
    - **Property 2: Prerequisite Identification via Graph Traversal**
    - **Validates: Requirements 2.4**
    - Generate random skill DAGs with varying depths
    - For any skill with mastery < 0.5, verify BFS returns transitive closure of prerequisites
    - Run with 100+ iterations using fast-check

  - [ ] 4.4 Create Pedagogical_Lead UI for skill graph modification
    - Create `/pedagogical-lead/skills` page listing all platform skills
    - Create form for adding new skills with prerequisite selection
    - Create form for editing existing skills (name, description, prerequisites)
    - Implement cycle detection validation on skill save
    - Display visual skill graph using React Flow or similar
    - _Requirements: 2.5_

- [ ] 5. Implement knowledge tracing engine with Bayesian Knowledge Tracing
  - [ ] 5.1 Create mastery state update function implementing simplified BKT algorithm
    - Implement BKT update logic (correct answers increase probability, incorrect decrease)
    - Weight updates by problem difficulty (1-5 scale)
    - Track response history (last 10 responses per skill)
    - Calculate and update tentative mastery flag based on skill-type threshold (0.85 procedural, 0.90 conceptual)
    - Track mastered_session_count for durable mastery calculation
    - Store response_time_ms for diagnostic visibility WITHOUT using in calculation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8_

  - [ ] 5.2 Create API endpoint for submitting student responses and updating mastery
    - Implement `POST /api/session/submit-response` endpoint
    - Validate response correctness (exact match, symbolic equivalence, or LLM evaluation)
    - Fetch current mastery state and response history from database
    - Call mastery update function with response data
    - Update `mastery_states` table with new probability and flags
    - Return feedback, next problem, and updated mastery state (target < 2 seconds)
    - _Requirements: 3.1, 3.3, 3.6_

  - [ ] 5.3 Write property test for mastery state update following BKT rules
    - **Property 3: Mastery State Update Follows BKT Rules**
    - **Validates: Requirements 3.1, 3.3**
    - Generate random current mastery probabilities [0, 1] and problem difficulties [1, 5]
    - For correct answers, verify probability increases
    - For incorrect answers, verify probability decreases
    - Verify updates weighted by difficulty
    - Run with 100+ iterations using fast-check

  - [ ] 5.4 Write property test for mastery state isolation between students
    - **Property 4: Mastery State Isolation Between Students**
    - **Validates: Requirements 3.2**
    - Generate two distinct student IDs and skill IDs
    - Update mastery state for student A
    - Verify student B's mastery state unchanged
    - Run with 100+ iterations using fast-check

  - [ ] 5.5 Write property test for mastery threshold detection
    - **Property 5: Mastery Threshold Detection**
    - **Validates: Requirements 3.4, 3.5**
    - Generate random mastery probabilities and skill types (procedural/conceptual)
    - Verify correct threshold applied (0.85 procedural, 0.90 conceptual)
    - Verify tentative mastery flag set if and only if probability >= threshold
    - Run with 100+ iterations using fast-check

  - [ ] 5.6 Write property test for durable mastery requiring multi-session confirmation
    - **Property 6: Durable Mastery Requires Multi-Session Confirmation**
    - **Validates: Requirements 3.6**
    - Generate session histories with varying mastery levels across days
    - Verify durable mastery flag set if and only if threshold exceeded in 2+ sessions on different days
    - Run with 100+ iterations using fast-check

  - [ ] 5.7 Write property test for response time invariance in mastery calculation
    - **Property 7: Response Time Invariance in Mastery Calculation**
    - **Validates: Requirements 3.8**
    - Generate pairs of responses identical except for response_time_ms
    - Verify identical mastery state updates produced
    - Run with 100+ iterations using fast-check

- [ ] 6. Checkpoint - Knowledge tracing validation
  - Run all property tests for knowledge tracing (Properties 3-7)
  - Verify mastery updates complete within 2 seconds for 95th percentile
  - Test with realistic response history sizes (0-10 responses)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 7. Implement misconception detection and remediation system
  - [ ] 7.1 Create misconception taxonomy data structure and pattern matcher
    - Implement symbolic pattern matching for exact error patterns
    - Implement regex pattern matching for common error formats
    - Implement LLM-based semantic matching for complex errors
    - Check misconception classification (repetition_confirmed vs first_occurrence_actionable)
    - Check student error history for pattern frequency
    - Return matched misconception ID and remediation strategy
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 7.2 Create API endpoint for misconception detection
    - Implement `POST /api/misconception/detect` endpoint
    - Run pattern matching sequence (symbolic → regex → semantic, target < 3 seconds)
    - Log matched misconceptions to `student_misconceptions` table
    - Log unmatched errors to `unmatched_errors` table with anonymized student ID
    - Return remediation strategy or generic Socratic prompt
    - _Requirements: 4.3, 4.5, 4.8, 4.9_

  - [ ] 7.3 Write property test for misconception pattern matching correctness
    - **Property 8: Misconception Pattern Matching Correctness**
    - **Validates: Requirements 4.3**
    - Generate random incorrect responses and error patterns (symbolic, regex, semantic)
    - Verify match returned if and only if response satisfies pattern definition
    - Run with 100+ iterations using fast-check

  - [ ] 7.4 Write property test for misconception vs slip classification
    - **Property 9: Misconception vs Slip Classification**
    - **Validates: Requirements 4.4**
    - Generate student error histories with varying frequencies
    - Verify classification as misconception if frequency meets threshold
    - Verify classification as slip otherwise
    - Run with 100+ iterations using fast-check

  - [ ] 7.5 Implement language comprehension difficulty detection
    - Detect uniform error frequency across skills with LLM language pattern analysis
    - Flag response for teacher review when language issue detected
    - Display "Possible language comprehension difficulty" in teacher dashboard
    - _Requirements: 4.6_

  - [ ] 7.6 Create Pedagogical_Lead unmatched error curation dashboard
    - Create `/pedagogical-lead/errors` page listing unmatched errors across all tenants
    - Display anonymized student ID, skill, problem text, student response, correct answer
    - Implement filters (reviewed status, skill, tenant)
    - Implement "promote to misconception" action that pre-drafts the entry (name, description, classification, remediation strategy) via the LLM abstraction layer (task 17), not a blank manual form — Pedagogical_Lead reviews and edits before saving
    - Implement `POST /api/pedagogical-lead/misconceptions` endpoint for taxonomy additions
    - Implement `POST /api/pedagogical-lead/errors/:id/mark-reviewed` endpoint
    - _Requirements: 4.8, 4.9_

- [ ] 8. Implement spaced repetition scheduler using SM-2 algorithm
  - [ ] 8.1 Create spaced repetition schedule creation and update functions
    - Implement schedule creation on durable mastery (initial interval 1 day, ease_factor 2.5)
    - Implement interval increase on correct review (interval * ease_factor)
    - Implement interval decrease on incorrect review (reset to 1 day minimum)
    - Ensure ease_factor remains in [1.3, 2.5] range
    - Store schedules in `spaced_repetition_schedules` table
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 8.2 Create query function for due spaced repetition reviews
    - Query `spaced_repetition_schedules` for reviews where next_review_date <= NOW()
    - Return list of skill IDs and student IDs for due reviews
    - Order by priority (shortest interval first)
    - _Requirements: 5.1, 5.4_

  - [ ] 8.3 Write property test for spaced repetition schedule creation on durable mastery
    - **Property 10: Spaced Repetition Schedule Creation on Durable Mastery**
    - **Validates: Requirements 5.1**
    - Generate skills marked as durably mastered
    - Verify schedule created with interval = 1 day and ease_factor = 2.5
    - Run with 100+ iterations using fast-check

  - [ ] 8.4 Write property test for interval increase on successful review
    - **Property 11: Spaced Repetition Interval Increase on Successful Review**
    - **Validates: Requirements 5.2**
    - Generate correct review responses with varying intervals and ease factors
    - Verify next interval = current_interval * ease_factor
    - Verify ease_factor >= 1.3
    - Run with 100+ iterations using fast-check

  - [ ] 8.5 Write property test for interval decrease on failed review
    - **Property 12: Spaced Repetition Interval Decrease on Failed Review**
    - **Validates: Requirements 5.3**
    - Generate incorrect review responses with varying intervals
    - Verify interval reset to minimum 1 day
    - Verify ease_factor decreased but >= 1.3
    - Run with 100+ iterations using fast-check

  - [ ] 8.6 Write property test for spaced repetition problem limit in sessions
    - **Property 13: Spaced Repetition Problem Limit in Sessions**
    - **Validates: Requirements 5.5**
    - Generate sessions with varying total problem counts and due reviews
    - Verify spaced repetition problems <= 20% of total (rounded down)
    - Run with 100+ iterations using fast-check

- [ ] 9. Implement cognitive load-aware scaffolding system
  - [ ] 9.1 Create scaffolding level selector based on mastery state
    - Map mastery probability to scaffolding level (worked_example < 0.3, partial_scaffold 0.3-0.7, hint_on_demand 0.7-threshold, independent >= threshold)
    - Apply skill-type-specific thresholds (0.85 procedural, 0.90 conceptual)
    - Return appropriate scaffolding level for problem generation
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ] 9.2 Create hint request handler with mastery penalty
    - Implement `POST /api/session/request-hint` endpoint
    - Return progressive hint based on current scaffolding level
    - Apply hint_penalty (-0.05) to mastery probability
    - Log hint request for self-regulation tracking
    - _Requirements: 6.5_

  - [ ] 9.3 Write property test for hint penalty consistent application
    - **Property 15: Hint Penalty Consistent Application**
    - **Validates: Requirements 6.5**
    - Generate hint requests during independent/hint_on_demand levels
    - Verify consistent penalty (-0.05) applied regardless of hint content
    - Run with 100+ iterations using fast-check

  - [ ] 9.4 Create problem generation service with scaffolding integration
    - Generate worked examples with step-by-step explanations for scaffolding level worked_example
    - Generate partially completed problems with hints for partial_scaffold
    - Generate independent problems without hints for independent level
    - Provide hints on demand for hint_on_demand level
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 10. Implement adaptive practice session engine
  - [ ] 10.1 Create session initialization and problem selection algorithm
    - Implement `POST /api/session/start` endpoint
    - Fetch Space boundaries (included_skill_ids, difficulty_range, classroom_pacing_mode)
    - Fetch student's mastery states for all Space skills
    - Query due spaced repetition reviews (max 20% of session)
    - Identify skills needing practice (struggling < 0.5, emerging 0.5-0.85, new with prerequisites met)
    - Handle classroom pacing mode (prioritize Space skills, flag prerequisite gaps vs. auto-inject remediation)
    - Select problem at appropriate scaffolding level based on mastery state
    - Return session ID and first problem
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 5.4, 5.5_

  - [ ] 10.2 Write property test for adaptive problem selection with all constraints
    - **Property 14: Adaptive Problem Selection with Boundary and Scaffolding Constraints**
    - **Validates: Requirements 6.2, 7.1, 7.4, 7.5, 7.6**
    - Generate random mastery states, space configurations, and due reviews
    - Verify problems only from space included_skill_ids
    - Verify problems within difficulty_range
    - Verify scaffolding level matches mastery state
    - Verify spaced repetition reviews <= 20%
    - Verify prerequisite injection when pacing mode false
    - Verify prerequisite gap flagging when pacing mode true
    - Run with 100+ iterations using fast-check

  - [ ] 10.3 Create session autosave and natural stopping point logic
    - Implement autosave every 30 seconds or after each response (whichever first)
    - Save session state to `sessions` table with status and problems array
    - After 10-15 problems or 15-20 minutes, suggest stopping point
    - Allow student to continue or end session
    - _Requirements: 7.2, 7.3, 7.7_

  - [ ] 10.4 Create session completion endpoint
    - Implement `POST /api/session/complete` endpoint
    - Update session status to 'completed'
    - Check for new durable mastery achievements (threshold met in 2+ sessions on different days)
    - Create spaced repetition schedules for newly durably mastered skills
    - Return session summary (problems completed, skills practiced, mastery changes)
    - _Requirements: 7.3, 5.1_

  - [ ] 10.5 Write unit tests for session management
    - Test session autosave triggered every 30 seconds
    - Test session autosave triggered after each response
    - Test natural stopping point suggested after 10-15 problems
    - Test natural stopping point suggested after 15-20 minutes
    - Test session completion marks status 'completed'
    - _Requirements: 7.2, 7.3, 7.7_

- [ ] 11. Checkpoint - Core adaptive learning validation
  - Run all property tests for spaced repetition (Properties 10-13)
  - Run property test for adaptive problem selection (Property 14)
  - Run property test for hint penalty (Property 15)
  - Test complete session flow: start → submit responses → autosave → natural stop → complete
  - Verify all core adaptive learning components integrated correctly
  - Ensure all tests pass, ask the user if questions arise

- [ ] 12. Implement teacher dashboard with real-time mastery visibility
  - [ ] 12.1 Create teacher dashboard UI with mastery heatmap
    - Create `/teacher/dashboard` page with student × skill grid
    - Color-code mastery states (gray not attempted, red struggling < 0.5, yellow emerging 0.5-0.85, green tentative >= threshold, dark green durable)
    - Implement filters (by Space, by Student, by Skill)
    - Display prerequisite gap alerts
    - Display common misconceptions tracker
    - Display live session activity indicators
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ] 12.2 Integrate Supabase Realtime for live mastery updates
    - Subscribe to `mastery_states` table changes for teacher's students
    - Update heatmap cells in real-time when students submit responses
    - Display live session activity (last activity timestamp)
    - Handle connection loss gracefully (reconnect automatically)
    - _Requirements: 10.2_

  - [ ] 12.3 Write integration test for real-time dashboard updates
    - Start student session and submit response
    - Verify teacher dashboard updates mastery state within 2 seconds
    - Verify color-coding changes when threshold crossed
    - _Requirements: 10.2, 10.4_

  - [ ] 12.4 Implement teacher override functionality
    - Add "Override" button on mastery heatmap cells
    - Create modal prompting for reason (20-200 chars validation)
    - Implement `POST /api/teacher/override` endpoint
    - Update mastery_states (is_durably_mastered = true, probability = 1.0)
    - Insert record to mastery_overrides table
    - Send real-time update to student's dashboard if online
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 12.5 Write property test for teacher override isolation
    - **Property 16: Teacher Override Isolation**
    - **Validates: Requirements 11.1, 11.3, 11.6**
    - Generate override for specific student and skill
    - Verify only that student's mastery state updated
    - Verify all other students' mastery states unchanged
    - Run with 100+ iterations using fast-check

  - [ ] 12.6 Implement override review prompts after 30 days
    - Query overrides older than 30 days for each teacher
    - Display prompt in teacher dashboard: "You marked [Student] as mastered in [Skill] 30 days ago. Confirm or reassess?"
    - Allow teacher to confirm, reset, or ignore
    - _Requirements: 11.5_

  - [ ] 12.7 Implement AI-assisted dashboard interpretation for Teachers
    - Implement `POST /api/teacher/dashboard/ask`: accepts a plain-language question, runs a structured query against that Teacher's actual mastery_states/student_misconceptions/sessions data (never an LLM call before retrieval)
    - Pass retrieved data as context to the LLM abstraction layer (task 17), with an explicit instruction to synthesize only from provided data
    - Return the answer alongside the underlying data it was grounded in
    - If the question can't be answered from available data, say so plainly rather than allowing the LLM to guess
    - Add a persistent, low-key ask entry point to the Teacher Dashboard UI, matching the Student Home Screen's "Ask about a skill" pattern
    - _Requirements: 10.8_

  - [ ] 12.8 Write property test for dashboard answer grounding
    - **Property 25: Dashboard Answer Grounding**
    - **Validates: Requirements 10.8, 15.5**
    - Generate retrieved-data contexts and questions where the correct answer is fully determined by the context
    - Verify every fact in the generated answer is traceable to the retrieved context
    - Run with 100+ iterations using fast-check

- [ ] 13. Implement teacher space management system
  - [ ] 13.1 Create space creation wizard UI
    - Create `/teacher/spaces/new` page with multi-step form
    - Step 1: Name and description input
    - Step 2: Visual skill tree picker for included_skill_ids selection
    - Step 3: Difficulty range slider [1, 5]
    - Step 4: Classroom pacing mode toggle with explanation
    - Step 5: Student assignment checkboxes
    - Implement `POST /api/teacher/spaces` endpoint
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 13.2 Create space management and editing UI
    - Create `/teacher/spaces` page listing all teacher's spaces
    - Display space details (name, description, skill count, student count)
    - Create `/teacher/spaces/:id/edit` page for modification
    - Implement `PUT /api/teacher/spaces/:id` endpoint
    - Apply changes only to future sessions (not in-progress)
    - _Requirements: 9.6, 9.7_

  - [ ] 13.3 Write property test for space boundary enforcement in problem sets
    - **Property 18: Space Boundary Enforcement in Problem Sets**
    - **Validates: Requirements 20.1**
    - Generate random space configurations with included_skill_ids
    - Generate problem sets for sessions in those spaces
    - Verify all problems have skill_id in space's included_skill_ids
    - Run with 100+ iterations using fast-check

  - [ ] 13.4 Write unit tests for space management
    - Test space creation stores configuration correctly
    - Test space modification updates configuration
    - Test changes only apply to future sessions
    - Test student assignment creates space_enrollments records
    - _Requirements: 9.1, 9.6, 9.7, 9.5_

- [ ] 14. Implement distress signal detection and escalation system
  - [ ] 14.1 Create distress signal detection service
    - Implement pattern-based detection with regex for explicit distress keywords
    - Implement LLM-based semantic analysis for implicit distress (confidence threshold 0.6)
    - Run pattern detection first (< 100ms), then async LLM analysis
    - Return detection result with method and confidence
    - _Requirements: 18.1, 18.2, 18.4_

  - [ ] 14.2 Create escalation creation and notification flow
    - Integrate distress detection in `POST /api/session/submit-response` endpoint
    - Create escalation record in `distress_escalations` table on detection
    - Send real-time notification to teacher via Supabase Realtime (target < 5 seconds)
    - Send email notification to teacher
    - Display to student: "Your teacher has been notified and will follow up with you."
    - _Requirements: 18.3, 18.5, 19.1, 19.2, 19.5_

  - [ ] 14.3 Write property test for distress pattern detection triggers escalation
    - **Property 17: Distress Pattern Detection Triggers Escalation**
    - **Validates: Requirements 18.1**
    - Generate student text responses with distress keywords
    - Verify escalation record created
    - Verify teacher notification triggered within 5 seconds
    - Run with 100+ iterations using fast-check

  - [ ] 14.4 Implement backup notification for unacknowledged escalations
    - Create background job checking for escalations unacknowledged for 10+ minutes
    - Send notification to backup teacher or Admin (configured per Space)
    - Set backup_notified flag in distress_escalations table
    - _Requirements: 19.3_

  - [ ] 14.5 Create teacher escalation dashboard
    - Implement `GET /api/teacher/escalations` endpoint for unacknowledged escalations
    - Create `/teacher/escalations` page displaying escalation details
    - Show student response text, timestamp, detection method, confidence
    - Implement `POST /api/teacher/escalations/:id/acknowledge` endpoint
    - Update acknowledged_by and acknowledged_at fields on acknowledgment
    - _Requirements: 19.2_

  - [ ] 14.6 Write integration test for complete distress escalation flow
    - Submit student response with distress keyword
    - Verify escalation created in database
    - Verify teacher receives real-time notification
    - Verify student sees notification message
    - Verify backup notification sent after 10 minutes if unacknowledged
    - _Requirements: 18.1, 18.3, 19.1, 19.2, 19.3_

- [ ] 15. Checkpoint - Teacher features validation
  - Test teacher dashboard displays mastery heatmap correctly
  - Test real-time updates when student submits response
  - Test teacher override updates mastery state
  - Test space creation and modification
  - Test distress escalation complete flow
  - Run all property tests for teacher features (Properties 16-18)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 16. Implement admin dashboard and pilot management
  - [ ] 16.1 Create admin dashboard with adoption and mastery metrics
    - Create `/admin/dashboard` page
    - Implement `GET /api/admin/dashboard` endpoint with filters (date range, teacher, class)
    - Display adoption metrics (active students, avg session duration, problems completed)
    - Display mastery metrics (avg skills mastered per student, mastery distribution chart)
    - Update metrics daily
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [ ] 16.1a Implement AI-assisted dashboard interpretation for Admins
    - Implement `POST /api/admin/metrics/ask`: accepts a plain-language question, runs a structured query against that tenant's actual adoption/mastery data (never an LLM call before retrieval)
    - Pass retrieved data as context to the LLM abstraction layer (task 17), with an explicit instruction to synthesize only from provided data
    - Return the answer alongside the underlying data it was grounded in
    - If the question can't be answered from available data, say so plainly rather than allowing the LLM to guess
    - Add a persistent, low-key ask entry point to the Admin Metrics UI, same pattern as the Teacher Dashboard's (task 12.7)
    - _Requirements: 15.5_

  - [ ] 16.2 Implement pilot scope management
    - Create `/admin/pilot` page for enabling/disabling class access
    - Implement `POST /api/admin/pilot/enable-class` endpoint
    - Implement `POST /api/admin/pilot/disable-class` endpoint
    - Display list of classes with Platform access status
    - Prevent students from accessing Platform when class disabled
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 16.2a Implement day-21 pilot checkpoint summary
    - Background job triggered 21 days after a pilot's start date
    - Compile adoption and early mastery signal to date into a summary surfaced to Admin and the Escolent team
    - _Requirements: 14.4_

  - [ ] 16.3 Create data export functionality
    - Implement `POST /api/admin/export` endpoint with export_type parameter
    - Support export types: interactions, mastery, sessions
    - Generate CSV format for selected data
    - Support optional student_ids filter
    - Complete export within 60 seconds for up to 100 students
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ] 16.4 Implement student data deletion
    - Implement `POST /api/admin/delete-student-data` endpoint
    - Delete mastery_states, sessions, interaction logs, student_misconceptions for student
    - Complete deletion within 72 hours (async job)
    - Retain anonymized aggregated statistics
    - Provide confirmation to Admin when deletion complete
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [ ] 16.5 Write unit tests for admin functionality
    - Test data export generates correct CSV format
    - Test data export completes within 60 seconds for 100 students
    - Test student data deletion removes all personal data
    - Test anonymized statistics retained after deletion
    - Test class disable prevents student access
    - _Requirements: 16.1, 16.4, 17.1, 17.2, 17.4, 14.3_

- [ ] 17. Implement LLM provider abstraction layer
  - [ ] 17.1 Create LLM provider interface using Vercel AI SDK
    - Define LLMProvider interface with methods: generateResponse, classifyError, detectDistress
    - Implement provider selection based on environment variable (openai, anthropic, gemini)
    - Configure Vercel AI SDK with getModel() function
    - Store provider configuration in config/llm.ts
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ] 17.2 Implement provider-agnostic prompt templates
    - Create Socratic tutoring prompt template
    - Create misconception remediation prompt template
    - Create distress detection prompt template
    - Ensure no pedagogy embedded in prompts (logic in application code)
    - _Requirements: 22.1_

  - [ ] 17.3 Create LLM service functions for all use cases
    - Implement generateSocraticResponse for student errors
    - Implement classifyMisconception for semantic error matching
    - Implement detectDistress for free-text analysis
    - Add error handling with retry logic (3 attempts with exponential backoff)
    - Fall back to generic templates on LLM failure
    - _Requirements: 22.1, 22.2, 22.3_

  - [ ] 17.4 Write unit tests for LLM provider switching
    - Test switching from OpenAI to Anthropic via config change only
    - Test switching to Gemini via config change only
    - Test each provider generates valid responses
    - Test fallback to generic template on provider failure
    - _Requirements: 22.2, 22.3_

- [ ] 18. Implement offline-first PWA architecture
  - [ ] 18.1 Configure service worker with Workbox caching strategies
    - Set up cache-first strategy for static assets (JS, CSS, images)
    - Set up network-first with cache fallback for API calls
    - Configure background sync for queued responses
    - Register service worker in Next.js app
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [ ] 18.2 Create IndexedDB client-side cache schema
    - Create ObjectStores: sessions, responses, problems, mastery_cache
    - Implement IndexedDB wrapper functions (read, write, query)
    - Store unsynced responses with sync_status: 'pending' flag
    - Store session state for recovery
    - _Requirements: 8.2, 8.5, 30.1_

  - [ ] 18.3 Implement offline response queueing and sync
    - Save responses to IndexedDB when offline (connectivity check)
    - Display offline indicator in UI
    - Implement background sync task attempting sync every 10 seconds
    - Implement `POST /api/sync/responses` endpoint for bulk sync
    - Update mastery states on server, return updated data
    - Mark responses as 'synced' in IndexedDB after successful sync
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 18.4 Implement session state recovery
    - Check for interrupted sessions < 24 hours old on app load
    - Query IndexedDB for sessions with status 'interrupted'
    - Prompt user: "You have an unfinished session. Resume?"
    - Implement `POST /api/session/recover` endpoint
    - Restore exact problem and student responses from IndexedDB
    - Mark sessions > 24 hours old as 'expired'
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

  - [ ] 18.5 Write integration tests for offline functionality
    - Test student continues practicing when network lost mid-session
    - Test responses queued in IndexedDB with sync_status: 'pending'
    - Test responses sync automatically when network restored
    - Test session state recovery restores exact problem and responses
    - Test offline indicator displays when connectivity lost
    - _Requirements: 8.1, 8.2, 8.3, 30.1, 30.2, 30.3_

- [ ] 19. Implement student practice UI and dashboards
  - [ ] 19.1 Create student practice session interface
    - Create `/practice` page displaying current problem
    - Display Space name and topic boundaries
    - Display scaffolding content (worked examples, hints, or independent problem)
    - Input field for student response with validation
    - "Request Hint" button for hint_on_demand and independent levels
    - Progress indicator (problems completed in session)
    - Connectivity status indicator
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.5_

  - [ ] 19.2 Create student dashboard showing progress
    - Create `/student/dashboard` page
    - Display mastery progress for all practiced skills (visual progress bars)
    - Display recent sessions (duration, problems completed, skills practiced)
    - Display upcoming spaced repetition reviews
    - Button to start new practice session (select Space)
    - _Requirements: 1.1, 1.3_

  - [ ] 19.3 Write unit tests for student UI
    - Test problem displays correctly based on scaffolding level
    - Test hint request button only shown for appropriate levels
    - Test hint request applies penalty to mastery state
    - Test natural stopping point suggestion displays after 10-15 problems
    - Test connectivity indicator changes when network status changes
    - _Requirements: 6.2, 6.5, 7.2, 8.5_

- [ ] 20. Implement weekly teacher digests and parent updates
  - [ ] 20.1 Create weekly teacher digest generation
    - Implement background job running weekly (configurable day/time per teacher)
    - Query student progress for past week (new durable mastery, prerequisite gaps, common misconceptions)
    - Generate digest email content via the LLM abstraction layer (task 17), grounded in the queried real data — never a static template with values substituted in
    - Send email to teacher via transactional email service (e.g., SendGrid)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 20.2 Create parent mastery update generation
    - Implement background job running weekly (default frequency)
    - Query student progress for past week per parent
    - Generate plain-language summary via the LLM abstraction layer (task 17), grounded in the queried real Mastery_State data — never a static template with values substituted in
    - Avoid technical terminology (no "mastery probability", use "understanding")
    - Deliver via school's parent communication channel (WhatsApp, SMS, school app integration)
    - Generate printable summary report for parents without digital access
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 20.3 Write unit tests for digest and update content
    - Test digest includes correct summary data (mastery achievements, gaps, misconceptions)
    - Test parent update uses plain language (no technical terms)
    - Test parent update includes correct student progress details
    - _Requirements: 12.2, 12.3, 12.4, 13.4, 13.5_

- [ ] 21. Implement POPIA compliance features
  - [ ] 21.1 Create parent consent mechanism and data subject rights interface
    - Create parent consent form for data processing (pending legal review for scope)
    - Display clear information about data collection and usage
    - Implement `POST /api/parent/data-access-request` endpoint
    - Implement `POST /api/parent/data-correction-request` endpoint
    - Implement `POST /api/parent/data-deletion-request` endpoint
    - Provide data access within POPIA-compliant timeframe (pending legal review)
    - Complete deletion within POPIA-compliant timeframe (pending legal review)
    - _Requirements: 24.2, 24.3, 25.1, 25.2, 25.3, 25.4, 25.5_

  - [ ] 21.2 Implement automatic data retention and deletion
    - Create background job checking for expired retention periods
    - Calculate retention period: enrollment duration + POPIA-compliant retention (pending legal review)
    - Automatically delete or anonymize student personal information after retention period
    - Retain anonymized aggregated statistics after deletion
    - _Requirements: 26.1, 26.2, 26.3, 26.4_

  - [ ] 21.3 Implement audit logging for all data access and modifications
    - Insert audit log record on every read of student personal information
    - Insert audit log record on every update/delete of student personal information
    - Log fields: user_id, action, table_name, record_id, changed_fields, timestamp
    - Retain audit logs for at least 2 years
    - Implement `GET /api/admin/audit-logs` endpoint with export functionality
    - _Requirements: 29.1, 29.2, 29.3, 29.4_

  - [ ] 21.4 Implement cross-border data transfer disclosure
    - Display geographic location of data storage to Admins in settings page
    - Document cross-border transfer mechanisms (if data stored outside South Africa)
    - Provide documentation link for Admin review
    - _Requirements: 27.1, 27.2, 27.3_

  - [ ] 21.5 Create data breach notification system
    - Implement breach detection monitoring (integrate with Sentry/monitoring service)
    - Create breach notification template with required details
    - Implement `POST /api/admin/breach-notification` endpoint (internal use)
    - Send notification to Admin within POPIA-compliant timeframe (pending legal review)
    - Provide breach details (affected data, occurrence time, mitigation steps)
    - _Requirements: 28.1, 28.2, 28.3_

  - [ ] 21.6 Write unit tests for POPIA compliance features
    - Test audit log created on student data read
    - Test audit log created on student data modification
    - Test automatic data deletion after retention period
    - Test anonymized statistics retained after deletion
    - Test data export includes all student personal information
    - _Requirements: 29.1, 29.2, 26.1, 26.2, 26.4, 25.2_

  - [ ] 21.7 Validate all POPIA compliance with qualified legal counsel
    - Review consent mechanism with POPIA legal counsel
    - Confirm data subject rights procedures and timelines
    - Confirm retention periods and deletion procedures
    - Confirm breach notification procedures and timelines
    - Update implementation based on legal counsel feedback
    - _Requirements: 24.5, 25.6, 26.5, 28.4_

- [ ] 22. Checkpoint - Complete system integration
  - Test complete student journey: launch from LMS → practice session → offline sync → mastery update
  - Test complete teacher journey: dashboard → space creation → student progress monitoring → override
  - Test complete admin journey: pilot management → metrics review → data export
  - Test complete Pedagogical_Lead journey: error curation → misconception taxonomy update
  - Run all property tests (19 properties)
  - Run all integration tests
  - Verify performance targets met (authentication < 3s, mastery update < 2s, etc.)
  - Ensure all tests pass, ask the user if questions arise

- [ ] 23. Implement guardrail enforcement for topic boundaries
  - [ ] 23.1 Enforce Space boundaries in problem selection
    - Already implemented in task 10.1 (problem selection algorithm)
    - Add additional validation: reject problems outside Space boundaries
    - _Requirements: 20.1_

  - [ ] 23.2 Detect and redirect answer-seeking behavior
    - Implement pattern detection for answer-seeking in student input
    - Patterns: "what is the answer", "just tell me", "give me the solution"
    - Redirect to Socratic prompt: "Can you explain your thinking so far?"
    - Log answer-seeking attempts for teacher visibility
    - _Requirements: 20.3, 20.4_

  - [ ] 23.3 Handle student requests for help outside Space boundaries
    - Detect when student asks about topic outside Space included_skill_ids
    - Display message: "That topic is outside the current practice scope. Focus on [Space name] for now."
    - _Requirements: 20.2_

  - [ ] 23.4 Write unit tests for guardrail enforcement
    - Test problems outside Space boundaries rejected
    - Test answer-seeking patterns detected and redirected
    - Test requests outside Space boundaries show appropriate message
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [ ] 24. Implement low-end device performance optimizations
  - [ ] 24.1 Optimize client-side memory usage
    - Implement lazy loading for problem content (load on demand, not all upfront)
    - Limit IndexedDB cache size (max 50MB)
    - Clear old session data from IndexedDB after 7 days
    - Use React.memo and useMemo for expensive UI components
    - _Requirements: 23.3_

  - [ ] 24.2 Optimize API response sizes and latency
    - Implement pagination for large data sets (dashboard queries)
    - Compress API responses with gzip
    - Minimize JSON payload sizes (remove unnecessary fields)
    - Add caching headers for static data (skill graph, problem templates)
    - _Requirements: 23.1, 23.2_

  - [ ] 24.3 Run performance tests on low-end device simulation
    - Test PWA loads within 5 seconds on 2GB RAM, dual-core 1.5GHz, 2Mbps connection
    - Test UI interactions respond within 1 second for non-server actions
    - Test memory usage remains < 200MB during typical session
    - Use Chrome DevTools throttling (4x CPU slowdown, 2Mbps network)
    - _Requirements: 23.1, 23.2, 23.3_

- [ ] 25. Load IEB Grade 8 algebra curriculum and initial content
  - [ ] 25.1 Create platform-level skill graph for Grade 8 algebra
    - Load IEB curriculum skills for algebraic equations
    - Define prerequisite relationships between skills
    - Set skill_type (procedural vs conceptual) for each skill
    - Insert into skills table with tenant_id = null (platform-level)
    - _Requirements: 2.1, 2.2_

  - [ ] 25.2 Create initial misconception taxonomy for algebra
    - Define common misconceptions for one-step equations (e.g., "subtracting negative as adding positive")
    - Create error patterns (symbolic, regex, semantic)
    - Set classification (repetition_confirmed vs first_occurrence_actionable)
    - Write remediation strategies for each misconception
    - Insert into misconceptions table
    - _Requirements: 4.1, 4.2_

  - [ ] 25.3 Generate initial problem set for pilot
    - Create 50-100 problems per skill for pilot
    - Cover difficulty range 1-5 for each skill
    - Include worked examples, partial scaffolds, and independent problems
    - Store in problems table or generate dynamically via LLM
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 26. Deploy to staging and production environments
  - [ ] 26.1 Set up staging environment on Vercel and Supabase
    - Create staging project on Vercel
    - Create staging Supabase instance
    - Configure environment variables for staging
    - Deploy current build to staging
    - Run smoke tests on staging

  - [ ] 26.2 Configure production environment on Vercel and Supabase
    - Create production project on Vercel
    - Create production Supabase instance in South Africa region (or nearest with documentation)
    - Configure environment variables for production
    - Set up custom domain
    - Configure Vercel Analytics and Sentry for monitoring

  - [ ] 26.3 Set up monitoring and alerting
    - Configure Sentry for client-side and server-side error tracking
    - Set up Vercel log aggregation
    - Configure alert thresholds (auth failure rate, database errors, distress detection service down)
    - Set up Supabase dashboard monitoring for RLS violations
    - Test alerts trigger correctly

  - [ ] 26.4 Deploy to production and run validation
    - Deploy current build to production
    - Run smoke tests on production
    - Test LTI integration with Canvas/Moodle sandbox
    - Test Google Classroom integration
    - Verify multi-tenancy RLS policies enforced
    - Test complete user journeys for all four roles

- [ ] 27. Final validation and pilot launch preparation
  - [ ] 27.1 Run complete end-to-end test suite
    - Run all unit tests
    - Run all property tests (19 properties, 100+ iterations each)
    - Run all integration tests
    - Run performance tests on low-end device simulation
    - Verify all tests pass with 0 failures

  - [ ] 27.2 Conduct security review
    - Review RLS policies for tenant isolation
    - Test cross-tenant access attempts (should fail)
    - Test LTI JWT tampering attempts (should reject)
    - Run npm audit and fix vulnerabilities
    - Review audit log completeness

  - [ ] 27.3 Complete POPIA compliance validation with legal counsel
    - Submit all compliance documentation to POPIA legal counsel
    - Address legal counsel feedback
    - Obtain written confirmation of POPIA compliance
    - Update consent forms and data processing documentation
    - _Requirements: 24.5, 25.6, 26.5, 28.4_

  - [ ] 27.4 Prepare pilot launch documentation
    - Create teacher onboarding guide (Space creation, dashboard usage, override process)
    - Create admin onboarding guide (pilot management, metrics, data operations)
    - Create student quick start guide (launching from LMS, practice session walkthrough)
    - Create technical support contact information
    - Create incident response procedures

  - [ ] 27.5 Launch pilot at Teneo with one Grade 8 class
    - Coordinate with Teneo admin for LTI/Google Classroom integration
    - Create Teneo tenant in production database
    - Assign teacher and student accounts
    - Conduct teacher training session
    - Send parent consent forms (pending legal review)
    - Monitor first week actively for issues

- [ ] 28. Implement subject-agnostic evaluation and AI-assisted content authoring
  - [ ] 28.1 Add evaluation_strategy, rubric, and content_status fields to skills and misconceptions
    - Add `evaluation_strategy`, `rubric` (JSONB), `content_status` columns to `skills` table
    - Add `content_status` column to `misconceptions` table
    - Default `content_status` to 'draft', `evaluation_strategy` to 'exact_match'
    - _Requirements: 31.1, 31.6_

  - [ ] 28.2 Implement pluggable answer evaluation routing
    - Fetch Skill's `evaluation_strategy` before grading a response
    - Route `exact_match`/`symbolic_equivalence` to existing correctness-check logic (task 5.1/5.2)
    - Route `rubric_llm` to a new rubric-based LLM evaluation function using the LLM abstraction layer (task 17)
    - Return a normalized correctness/partial-credit signal regardless of strategy, consumed unchanged by the BKT update (task 5.1)
    - _Requirements: 31.1, 31.2_

  - [ ] 28.2a Build the rubric-evaluated response UI
    - For Skills with evaluation_strategy = rubric_llm, render per-criterion feedback and any partial credit, never a single binary correct/incorrect result
    - Visually distinct from the exact-match correct/incorrect treatment used elsewhere
    - _Requirements: 31.10_

  - [ ] 28.2b Write property test for rubric feedback display
    - **Property 23: Rubric Feedback Display for Non-Binary Evaluation**
    - **Validates: Requirements 31.10**
    - Generate Skills with evaluation_strategy = rubric_llm and varying rubric criteria
    - Verify the Student-facing response always includes per-criterion feedback and never collapses to a single correct/incorrect value
    - Run with 100+ iterations using fast-check

  - [ ] 28.3 Write property test for evaluation strategy routing
    - **Property 20: Evaluation Strategy Routing**
    - **Validates: Requirements 31.1, 31.2**
    - Generate Skills with each evaluation_strategy value
    - Verify each routes only to its corresponding evaluator, never to another strategy's logic
    - Run with 100+ iterations using fast-check

  - [ ] 28.4 Extend misconception detection to default to semantic matching for non-symbolic skills
    - WHEN a Skill's evaluation_strategy is `rubric_llm`, default misconception detection to `semantic` matching (task 7.1)
    - Keep symbolic/regex matching as the math-specific fast path for `exact_match`/`symbolic_equivalence` skills
    - _Requirements: 31.3_

  - [ ] 28.5 Implement AI-assisted content co-authoring flow
    - Implement `POST /api/content/authoring/propose` endpoint: accepts subject/unit description, returns draft Skill_Graph and Misconception_Taxonomy via LLM abstraction layer (task 17)
    - Implement `POST /api/content/authoring/approve` endpoint: moves reviewed/edited content from `content_status = 'draft'` to `'pending_approval'` — still not servable to Students
    - Implement `POST /api/content/authoring/validate` endpoint: requires explicit sign-off from the content owner (Teacher for Space-level content, Pedagogical_Lead for platform-level content) to move `'pending_approval'` to `'validated'` — the only status servable to Students
    - Implement `PUT /api/content/authoring/skills/:id` and `PUT /api/content/authoring/misconceptions/:id` for teacher edits
    - Ensure `'draft'` and `'pending_approval'` content is never servable to Students under any circumstance
    - _Requirements: 31.4, 31.5, 31.6, 31.9_

  - [ ] 28.6 Create Teacher/Pedagogical_Lead content review and approval UI
    - Create review interface showing AI-proposed skills and misconceptions with their current Content_Status
    - Allow edit, merge, split, or removal of proposed items at `'draft'` or `'pending_approval'`
    - Require explicit sign-off action before content reaches `'validated'` and becomes servable
    - Display Content_Status to Teachers/Pedagogical_Leads/Admins; never to Students
    - _Requirements: 31.5, 31.6, 31.7, 31.9, 32.6_

  - [ ] 28.7 Implement content promotion from pending_approval to validated
    - Promotion is explicit content-owner sign-off only — never automatic, never triggered by accumulated Student interaction volume (impossible in any case, since pending_approval content is never shown to Students)
    - Require the sign-off actor to be the Teacher for Space-level content or the Pedagogical_Lead for platform-level content
    - _Requirements: 31.6, 31.8_

  - [ ] 28.8 Write integration test for full co-authoring flow
    - Submit a subject/unit description, verify draft Skill_Graph and Misconception_Taxonomy generated
    - Edit a proposed skill, verify edit persisted
    - Move content through draft → pending_approval → validated, verify it becomes servable to Students only at validated
    - Verify draft and pending_approval content is never presented to a Student at any point
    - _Requirements: 31.4, 31.5, 31.6, 31.7, 31.9_

- [ ] 29. Implement parent identity verification and data rights access
  - [ ] 29.1 Create guardians and data_rights_requests database tables
    - Create `guardians` table linked to students, populated from school-provided enrollment data
    - Create `data_rights_requests` table with verification token and status tracking
    - _Requirements: 35.1_

  - [ ] 29.2 Implement verification request and token confirmation endpoints
    - Implement `POST /api/parent/verify-request`: match requester's contact value against registered Guardian records, send token to the on-file contact channel (never to a value the requester supplies fresh)
    - Ensure the response is identical in content, shape, and timing regardless of match outcome — no observable difference between a genuine non-match and a token having been sent
    - Implement `POST /api/parent/confirm-token`: confirm token, mark request `verified`
    - Gate the existing data-access/correction/deletion endpoints (task 21.1) on `verified` status
    - _Requirements: 35.2, 35.2a, 35.3_

  - [ ] 29.2a Write property test for verification request non-enumerability
    - **Property 24: Verification Request Non-Enumerability**
    - **Validates: Requirements 35.2a**
    - Generate matching and non-matching verify-request submissions
    - Verify response content, shape, and timing are indistinguishable between the two cases
    - Run with 100+ iterations using fast-check

  - [ ] 29.3 Implement multi-guardian Admin notification
    - WHEN a Student has multiple registered Guardians, notify the tenant Admin on any data rights request, without blocking the verified requester
    - _Requirements: 35.5_

  - [ ] 29.4 Write property test for parent data rights verification gate
    - **Property 21: Parent Data Rights Verification Gate**
    - **Validates: Requirements 35.2, 35.3**
    - Generate data rights requests with and without confirmed tokens
    - Verify the underlying action never processes without confirmed verification
    - Run with 100+ iterations using fast-check

  - [ ] 29.5 Build the minimal Parent data-rights request UI
    - Standalone, no full-account-login page
    - Student identifier + contact value entry, token confirmation step, clear request-status confirmation
    - _Requirements: 35.2, 35.3, 35.4_

- [ ] 30. Implement Adaptive Instruction
  - [ ] 30.1 Create lenses table and seed the initial lens library
    - Create platform-level `lenses` table
    - Seed with an initial small set (e.g., concrete/analogy, procedural, narrative, Socratic), pending Pedagogical_Lead review
    - _Requirements: 34.3_

  - [ ] 30.2 Implement prerequisite diagnostic check before initial instruction
    - Before presenting a new Skill's instruction, check Mastery_State for direct prerequisites (reuse existing skill graph/mastery data — no new collection)
    - WHEN a prerequisite is tentative/stale/unassessed, weave a brief bridge into the new lesson's opening
    - _Requirements: 34.1, 34.2_

  - [ ] 30.3 Implement default Lens selection and LLM-delivered instruction
    - Select default Lens by Skill's skill_type
    - Generate explanation via LLM abstraction layer (task 17) from Skill base description + Lens template_rules
    - _Requirements: 34.4, 34.6_

  - [ ] 30.4 Implement lens-switching remediation policy
    - WHEN a Student's first practice attempt after instruction is incorrect, select a Lens differing from the one just used, using a fixed platform-level policy
    - Regenerate remediation through the new Lens
    - Tag generated explanation content `content_status: 'draft'` on first generation; promote via the existing content-maturity mechanism (task 28.7), not a separate governance path
    - Confirm no UI or API surface ever asks a Student to select or indicate a preferred teaching style
    - _Requirements: 34.5, 34.7, 34.8_

  - [ ] 30.5 Write property test for lens switching on remediation
    - **Property 22: Lens Switching on Remediation**
    - **Validates: Requirements 34.5**
    - Generate first-incorrect-attempt scenarios across Lenses
    - Verify remediation Lens always differs from initial-instruction Lens
    - Run with 100+ iterations using fast-check

- [ ] 31. Implement LMS content ingestion and structuring
  - [ ] 31.1 Create content_sources and content_ingestion_jobs database tables
    - _Requirements: 33.1, 33.3_

  - [ ] 31.2 Implement text-based extraction (pages, PDF, Word)
    - Extract native LMS text pages directly
    - Extract PDF/Word text, OCR fallback for scanned PDFs
    - Preserve source_reference for every extracted unit; never mutate or discard the original
    - _Requirements: 33.1, 33.3, 33.4_

  - [ ] 31.3 Implement image extraction
    - OCR for text-in-images, visual description via the multimodal LLM abstraction layer for diagrams/figures
    - _Requirements: 33.2_

  - [ ] 31.4 Implement AI-driven structuring pass
    - Deduplicate redundant material across extracted sources for a topic
    - Compute per-Skill coverage_status from linked ContentSource volume/diversity
    - Generate draft Skill_Graph/Misconception_Taxonomy entries grounded in extracted content, tagged content_status = 'draft'
    - _Requirements: 31.6, 32.4_

  - [ ] 31.5 Implement fallback to description-driven authoring
    - WHEN ingested content for a Skill is sparse or absent, automatically fall back to the existing co-authoring flow (task 28.5) — no manual mode switch required
    - _Requirements: 33.5_

  - [ ] 31.6 Explicitly scope out video ingestion for this MVP
    - Document as a deferred enhancement, not a partial/best-effort implementation
    - _Requirements: 33.6_

- [ ] 32. Implement the AI-native content experience (Course/Skill Map)
  - [ ] 32.1 Implement Course/Skill Map data endpoint
    - Implement `GET /api/student/course-map`: Skills in Skill_Graph order, synthesized summary, source citation link
    - _Requirements: 32.1, 32.2_

  - [ ] 32.2 Implement Space coverage aggregation endpoint
    - Implement `GET /api/teacher/space/:id/coverage`: aggregate coverage_status across a Space's included Skills
    - Cache result, track freshness via Space's `content_summary_generated_at`
    - _Requirements: 32.4_

  - [ ] 32.3 Implement scoped free-text question handling
    - Student free-text questions answered only within the current Space's included Skills — consistent with existing guardrail enforcement (task 23)
    - _Requirements: 20.1, 20.2, 32.5_

  - [ ] 32.4 Implement Content_Status visibility rules
    - Display to Teacher, Pedagogical_Lead, and Admin views
    - Never expose in any Student-facing endpoint or view
    - _Requirements: 32.6_

  - [ ]* 32.5 Write unit tests for content experience endpoints
    - Test Course/Skill Map returns Skill_Graph-ordered results
    - Test coverage aggregation reflects underlying Skill coverage_status correctly
    - Test Content_Status never appears in Student-facing API responses
    - _Requirements: 32.4, 32.6_

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP delivery, but are strongly recommended for production quality
- Each task references specific requirements for traceability back to requirements.md
- Property-based tests validate universal correctness guarantees across all inputs (19 properties total)
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end flows across system boundaries
- Checkpoints ensure incremental validation at logical breaks
- All test tasks use fast-check library for property-based testing with minimum 100 iterations
- POPIA compliance tasks (21.1-21.7) MUST NOT proceed to production without qualified legal counsel validation
- Multi-tenancy isolation is architectural from day one; RLS policies enforce tenant boundaries at database level
- LLM provider is swappable via configuration only; no pedagogy embedded in provider-specific prompts
- Offline-first architecture ensures students can practice during connectivity loss with automatic sync on restore

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "3.1", "4.1", "25.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "25.2"] },
    { "id": 4, "tasks": ["3.6", "5.1", "25.3"] },
    { "id": 5, "tasks": ["5.2", "7.1", "17.1"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7", "7.2", "17.2", "28.1", "28.2", "28.2a", "28.2b", "28.3", "28.4", "28.5"] },
    { "id": 7, "tasks": ["7.3", "7.4", "7.5", "17.3", "8.1", "28.6", "28.7"] },
    { "id": 8, "tasks": ["7.6", "17.4", "8.2", "9.1", "28.8"] },
    { "id": 9, "tasks": ["8.3", "8.4", "8.5", "8.6", "9.2", "9.3", "9.4", "30.1", "30.2"] },
    { "id": 10, "tasks": ["10.1", "30.3", "30.4", "30.5"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.4"] },
    { "id": 12, "tasks": ["10.5", "12.1"] },
    { "id": 13, "tasks": ["12.2", "12.4", "13.1", "14.1", "18.1", "19.1"] },
    { "id": 14, "tasks": ["12.3", "12.5", "12.6", "13.2", "14.2", "18.2", "19.2"] },
    { "id": 15, "tasks": ["13.3", "13.4", "14.3", "14.4", "18.3", "19.3", "12.7", "12.8"] },
    { "id": 16, "tasks": ["14.5", "14.6", "16.1", "16.1a", "16.2", "16.2a", "18.4"] },
    { "id": 17, "tasks": ["16.3", "16.4", "18.5", "20.1", "31.1", "31.2", "31.3"] },
    { "id": 18, "tasks": ["16.5", "20.2", "20.3", "21.1", "31.4", "31.5", "31.6", "29.1", "29.2"] },
    { "id": 19, "tasks": ["21.2", "21.3", "21.4", "21.5", "23.1", "29.2a", "29.3", "29.4", "29.5", "32.1", "32.2"] },
    { "id": 20, "tasks": ["21.6", "23.2", "23.3", "24.1", "32.3", "32.4", "32.5"] },
    { "id": 21, "tasks": ["21.7", "23.4", "24.2"] },
    { "id": 22, "tasks": ["24.3", "26.1"] },
    { "id": 23, "tasks": ["26.2", "26.3"] },
    { "id": 24, "tasks": ["26.4", "27.1"] },
    { "id": 25, "tasks": ["27.2", "27.3", "27.4"] },
    { "id": 26, "tasks": ["27.5"] }
  ]
}
```
