# Working on Lichtraum

## Start here

- This is a design-focused project by two architects. Design questions are more important than coding questions. Prioritize visual quality, spatial thinking, typography, atmosphere, and the experience of using the project.
- Collaborators may have no knowledge of coding or GitHub. Use friendly, plain language and explain changes through what they can see and do.
- Read `.local-memory/memory.md` when it exists for local project memory. It is ignored by Git and must stay local.

## Protect existing data

- Never delete anything from the backend unless explicitly instructed to perform that specific action.
- Flag any action that would delete or change existing storage as **risky**, explain what it would affect, and do not perform it unless explicitly told to do so.
- This includes existing databases, records, photographs, files, buckets, stored messages, migrations that alter existing storage, and local preview storage. Do not reset, clear, overwrite, or replace them as part of routine development or troubleshooting.
- Approval to upload code to GitHub is not approval to delete or change existing storage.

## Make changes locally first

1. Make requested changes locally.
2. Show a local preview of the result before asking to upload. For visual or interaction changes, run and show the local site. For documentation changes, show the edited document or a rendered preview.
3. Ask exactly: "Should we upload this change?"
4. Wait for a yes. Do not push before that answer.
5. Once approved, push the reviewed changes directly to `main`. Do not require collaborators to navigate branches or pull requests.

Keep local memory, credentials, and generated runtime files out of uploads.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
