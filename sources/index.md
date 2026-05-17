---
title: Source Document Index
status: current
last_updated: 2026-05-16
upload_to_chatgpt: false
---

# Source Document Index

This file defines which source documents should be uploaded to the
ChatGPT Project.

## Default Upload Set

Upload these files for normal project use:

- `sources/current-state.md`

## Do Not Upload By Default

Do not upload these directories by default:

- `archive/`
- `prompts/`
- `templates/`
- `scripts/`

## Upload Only When Needed

Upload archived or raw material only when historical context is
specifically required.

## Upload Notes

The ChatGPT Project should be refreshed after meaningful source document
changes are committed to Git.

The upload workflow is generated deterministically from source document
metadata.

Use:

```bash
yarn build:upload-bundle
```

Then upload files from:

```text
dist/upload-files/
```
