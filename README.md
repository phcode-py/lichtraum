# lichtraum zürich

**Walk together. Notice the light. Keep what reflects.**

Lichtraum is a project by two architects exploring how we see Zürich: light on water, reflections in windows, shadows across a street, and the small things that make us stop and look.

This is our place to collect those observations, put them on a map, and keep a conversation going around them. The design is part of the project itself—the way a photograph sits beside a map matters as much as the features behind it.

## Take a look around

- **Walks** — explore an example route through the city, with stops and a replay. The current walk is a simulation, not a live GPS recording.
- **Light atlas** — browse photographs and their places, or add a reflection of your own.
- **Correspondence** — leave a thought, ask about a place, and share what caught your eye.

## Working on this together

You don't need to know how to code or use GitHub to contribute. Describe what you would like to change: a quieter layout, a different typeface, more room for photographs, or something that simply doesn't feel right yet.

We'll make the change locally first and show you a preview. When you're happy with it, we'll ask: **"Should we upload this to github?"** Only after you say yes will the reviewed changes be uploaded directly to `main`, the shared version of the project.

Your photographs, notes, and other saved material matter. We won't delete backend content or change existing storage without your explicit instruction. Any proposed action that affects existing storage will be flagged as risky before it happens.

## Opening the project on your computer

If you're working with a coding assistant, you can simply ask it to start a local preview. You can try out design changes there before deciding to upload them.

For anyone setting it up manually, you'll need Node.js 22.13 or newer and pnpm (the project specifies its version in `package.json`). From the project folder, run:

```sh
npm run install:ci
npm run dev
```

Open the local address printed in the terminal, usually http://localhost:5173. This starts a preview on your computer; it does not upload or publish the site. Existing hosted photographs and notes aren't automatically copied into a fresh local preview.

## A little further behind the scenes

The interface lives in `app/` and `components/`. The project uses React, Vinext, and Cloudflare, with database and file storage for saved content.

For the original setup and hosting reference, see [the development guide](docs/development.md). Coding assistants should also read [AGENTS.md](AGENTS.md) for our design priorities, storage safeguards, and preview-before-upload workflow.
