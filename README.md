# ChatGPT Project Template

A lightweight Git-based template for managing long-term ChatGPT Project context.

## Purpose

This repository is the canonical source of truth for a ChatGPT Project.

The goal is to keep ChatGPT Project Instructions small and stable while storing durable factual context in curated source documents that can be uploaded to the ChatGPT Project.

## Operating Model

- `instructions/` contains behavior rules for the ChatGPT Project.
- `sources/` contains factual context intended for upload.
- `prompts/` contains reusable maintenance/update prompts.
- `archive/` contains raw, historical, superseded, or snapshot material.
- `templates/` contains reusable document templates.
- `scripts/` contains validation and build helpers.

## Relationship to ChatGPT

The actual ChatGPT Project should use:

1. `instructions/project-instructions.copyable.md` as the Project Instructions.
2. Selected files from `sources/`, as listed in `sources/index.md`, as uploaded source documents.

Git remains the source of truth. Uploaded ChatGPT files are derived runtime context.

## Required Workflow

After editing source documents:

```bash
yarn check
yarn build:upload-bundle
```

Then upload the selected source files, or the generated upload bundle, to the ChatGPT Project.

## Required Files

- `PROJECT.md`
- `AGENTS.md`
- `instructions/project-instructions.md`
- `instructions/project-instructions.copyable.md`
- `sources/index.md`
- `sources/current-state.md`
- `sources/decisions.md`
- `sources/glossary.md`
- `prompts/update-source-doc.md`
- `prompts/prepare-upload-bundle.md`
- `archive/README.md`

## Design Rules

- Keep instructions small.
- Put facts in source documents.
- Put workflows in prompts.
- Keep archive material out of default uploads.
- Prefer boring, explicit, retrieval-friendly Markdown.
- Preserve dates, uncertainty, and provenance.

## Template Updates

Projects created from this template are independent repositories.

This template provides a starting structure, not an ongoing inheritance model. If the
template improves later, copy or cherry-pick useful changes manually.
