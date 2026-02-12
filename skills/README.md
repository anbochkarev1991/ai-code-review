# Project skills

These skills define the AI Code Review Assistant’s **API contract**, **review output schema**, **run-review flow**, and **using Context7 during code review**. Use them so the agent keeps backend and frontend aligned and follows the same pipeline and validation rules.

| Skill | Purpose |
|-------|--------|
| **api-contract** | Shared types and endpoint shapes (repos, PRs, diff, reviews, billing). |
| **review-schema** | Zod shape and prompt snippet for agent output (findings + summary) and aggregator. |
| **run-review-flow** | Steps for POST /reviews: quota check → fetch diff → run pipeline → save trace + result. |
| **context7-code-review** | Use Context7 when reviewing this project’s code so feedback is grounded in up-to-date framework/API docs. |

## Cursor

To have Cursor load these automatically, copy each skill into `.cursor/skills/`:

```bash
mkdir -p .cursor/skills
cp -r skills/api-contract .cursor/skills/
cp -r skills/review-schema .cursor/skills/
cp -r skills/run-review-flow .cursor/skills/
cp -r skills/context7-code-review .cursor/skills/
```

Or symlink:

```bash
mkdir -p .cursor/skills
ln -sf ../../skills/api-contract .cursor/skills/api-contract
ln -sf ../../skills/review-schema .cursor/skills/review-schema
ln -sf ../../skills/run-review-flow .cursor/skills/run-review-flow
ln -sf ../../skills/context7-code-review .cursor/skills/context7-code-review
```

Each skill is a directory with a `SKILL.md` (YAML frontmatter + instructions). See [Cursor create-skill](https://cursor.com/docs) or the project TODOS for workflow (Context7, skills.sh, Traycer, Linear).
