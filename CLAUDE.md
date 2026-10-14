# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a new LMS (learning management system) project with nothing built yet. The repo is not under git yet, and there are no package manifests, build tooling, tests or dependencies.

## Layout

- `client/`: frontend (empty so far)
- `server/`: backend; `server/app.js` is the planned entry point (currently an empty file)

The design and phased plan (data model, permissions matrix, API plan, phase acceptance criteria) live in `docs/superpowers/specs/2026-10-14-training-lms-design.md`. Read it before any work. The project is built one phase at a time: implement only the approved phase, then stop for the trainer's review.

Update this file with build/run/test commands and architecture notes once the client and server stacks are chosen and scaffolded.
