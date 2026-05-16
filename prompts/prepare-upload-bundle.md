# Prompt: Prepare Upload Bundle

## Purpose

Use this prompt before refreshing files in a ChatGPT Project.

## Prompt

You are helping prepare a ChatGPT Project upload bundle from a Git-based context repository.

Review:

- `sources/index.md`
- all source documents marked `upload_to_chatgpt: true`
- any project-specific upload rules

Produce:

1. a list of files to upload
2. a list of files to exclude
3. any stale or conflicting documents
4. any warnings about archive/raw/superseded material
5. a recommended upload order

Rules:

- Do not include archived files by default.
- Do not include prompts by default.
- Do not include repository maintenance docs by default.
- Prefer current curated source documents.
- Flag documents with missing or stale metadata.
