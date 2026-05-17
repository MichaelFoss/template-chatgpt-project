import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const sourceDir = path.resolve('sources');
const outputDir = path.resolve('dist');

const outputFile = path.join(outputDir, 'chatgpt-upload-bundle.md');
const uploadFilesDir = path.join(outputDir, 'upload-files');

function demoteAtxHeadings(content, levels = 2) {
  return content.replace(/^(#{1,6})\s+/gm, (match, hashes) => {
    const nextLevel = Math.min(hashes.length + levels, 6);
    return `${'#'.repeat(nextLevel)} `;
  });
}

function formatMetadata(data) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return [];
  }

  return [
    '### Source Metadata',
    '',
    ...entries.map(([key, value]) => {
      if (Array.isArray(value)) {
        return `- \`${key}\`: ${value.join(', ')}`;
      }

      return `- \`${key}\`: ${String(value)}`;
    }),
    '',
  ];
}

async function getMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = await getMarkdownFiles(sourceDir);
  const included = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const parsed = matter(content);

    if (parsed.data.upload_to_chatgpt === true) {
      included.push({
        file,
        content: demoteAtxHeadings(parsed.content.trim()),
        metadata: parsed.data,
        title: parsed.data.title ?? path.basename(file),
      });
    }
  }

  included.sort((a, b) => a.file.localeCompare(b.file));

  const bundle = [
    '# ChatGPT Upload Bundle',
    '',
    'Generated from source documents marked `upload_to_chatgpt: true`.',
    '',
    ...included.flatMap((item) => [
      `## ${item.title}`,
      '',
      `File: \`${path.relative(process.cwd(), item.file)}\``,
      '',
      ...formatMetadata(item.metadata),
      item.content,
      '',
      '---',
      '',
    ]),
  ]
    .join('\n')
    .trimEnd();

  await fs.rm(uploadFilesDir, { recursive: true, force: true });
  await fs.mkdir(uploadFilesDir, { recursive: true });

  for (const item of included) {
    const relativePath = path.relative(sourceDir, item.file);
    const destinationPath = path.join(uploadFilesDir, relativePath);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(item.file, destinationPath);
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, `${bundle}\n`, 'utf8');

  console.log(`Wrote ${outputFile}`);
  console.log(`Copied upload files to ${uploadFilesDir}`);
  console.log(`Included ${included.length} source document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
