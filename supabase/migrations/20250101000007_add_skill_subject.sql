-- Follow-up to Task 1.3, after tasks.md/design.md were revised to make the
-- Platform explicitly subject-agnostic (Requirement 31.1, 31.6): adds the
-- `subject` field to `skills` that design.md's Skill TypeScript interface
-- calls for (e.g. "Grade 8 Mathematics") but that Task 1.3's original merge
-- predates. Used to parameterize LLM tutor prompts (design.md Section 13)
-- and dashboard grouping. Nullable, no default — content in the draft
-- pipeline may not have it assigned yet, and no requirement calls for it
-- to be mandatory.
alter table skills add column subject text;
