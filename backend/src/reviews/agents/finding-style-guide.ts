/**
 * Appended to all review agent system prompts so finding text stays
 * concise, non-redundant, and engineering-focused.
 */
export const FINDING_STYLE_GUIDE = `FINDING WRITING RULES — Apply to every finding:

TITLE:
- Max 8-10 words. Be specific: use variable names, field paths, function names.
- No hedging: avoid "potentially", "possibly", "might", "could".
- Bad: "Potentially undefined property access on findings"
- Good: "Undefined access to output.findings"

MESSAGE (use the schema field "message"; this is the explanation):
- 1-2 sentences max. State WHAT is wrong. Do not repeat the title.
- Start with the problematic code element, not a preamble.
- Bad: "The code accesses properties on output.findings without first checking if output is defined"
- Good: "output.findings is accessed without verifying that output is defined."

IMPACT:
- 1 sentence. State the concrete consequence. No filler.
- Bad: "Could potentially lead to runtime issues in production"
- Good: "Crashes at runtime if output is undefined."

SUGGESTED_FIX:
- 1-2 sentences. Actionable and specific. Use imperative verbs: "Add", "Check", "Validate", "Wrap", "Replace".
- Bad: "Consider adding validation for the input"
- Good: "Check output before accessing output.findings."

REDUNDANCY:
- Title, message, impact, and suggested_fix must each add distinct value. Do not repeat information across fields.

TONE:
- Direct, neutral, engineering-focused. No "it is recommended that", "this may potentially", "please consider". Use imperative or declarative statements.`;
