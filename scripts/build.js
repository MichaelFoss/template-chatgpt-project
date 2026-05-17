import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';

const execFileAsync = promisify(execFile);

const buildTagPrefix = 'build-';
const projectInstructionsPath = path.resolve(
  'instructions',
  'project-instructions.md',
);
const sourceDir = path.resolve('sources');
const outputDir = path.resolve('dist');
const uploadsDir = path.join(outputDir, 'uploads');
const projectInstructionsOutputFile = path.join(
  outputDir,
  'project-instructions.md',
);
const outputFile = path.join(outputDir, 'chatgpt-upload-bundle.md');
const uploadInstructionsFile = path.join(
  outputDir,
  'upload-instructions.md',
);

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

function getTodayTagDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseBuildTag(tag) {
  const pattern = /^build-\d{4}-\d{2}-\d{2}-(\d{4})$/;
  const match = tag.match(pattern);

  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

async function runGit(args) {
  const { stdout } = await execFileAsync('git', args);
  return stdout.trim();
}

async function getCurrentCommit() {
  return runGit(['rev-parse', 'HEAD']);
}

async function getWorkingTreeStatus() {
  return runGit(['status', '--porcelain']);
}

const requiredRootFile = 'package.json';

async function validateRepositoryRoot() {
  try {
    await fs.access(path.resolve(requiredRootFile));
  } catch {
    console.error(
      'Build aborted: command must be run from the repository root.',
    );

    process.exit(1);
  }
}

async function getBuildTags() {
  const output = await runGit(['tag', '--list', `${buildTagPrefix}*`]);

  return output
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => parseBuildTag(tag) !== null)
    .sort((a, b) => {
      const aNumber = parseBuildTag(a) ?? 0;
      const bNumber = parseBuildTag(b) ?? 0;

      return aNumber - bNumber;
    });
}

async function getTagsPointingAtHead() {
  const output = await runGit(['tag', '--points-at', 'HEAD']);

  return output
    .split('\n')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function getLatestBuildTag() {
  const tags = await getBuildTags();

  return tags.at(-1) ?? null;
}

async function getNextBuildTag() {
  const tags = await getBuildTags();
  const highestBuildNumber = tags.reduce((highest, tag) => {
    return Math.max(highest, parseBuildTag(tag) ?? 0);
  }, 0);

  return `${buildTagPrefix}${getTodayTagDate()}-${String(
    highestBuildNumber + 1,
  ).padStart(4, '0')}`;
}

async function getChangedFilesSinceBuildTag(latestBuildTag) {
  if (!latestBuildTag) {
    const output = await runGit([
      'ls-files',
      '--',
      'sources',
      'instructions',
    ]);

    return output
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
      .sort();
  }

  const output = await runGit([
    'diff',
    '--name-only',
    `${latestBuildTag}..HEAD`,
    '--',
    'sources',
    'instructions',
  ]);

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .sort();
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

function toProjectPath(filePath) {
  return path.relative(process.cwd(), filePath);
}

function toUploadPath(filePath) {
  return path.join(
    'dist',
    'uploads',
    path.relative(sourceDir, filePath),
  );
}

function formatList(items) {
  if (items.length === 0) {
    return ['- None'];
  }

  return items.map((item) => `- \`${item}\``);
}

async function getBuildableSourceDocuments() {
  const files = await getMarkdownFiles(sourceDir);
  const buildable = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const parsed = matter(content);

    if (parsed.data.upload_to_chatgpt === true) {
      buildable.push({
        file,
        content: demoteAtxHeadings(parsed.content.trim()),
        metadata: parsed.data,
        title: parsed.data.title ?? path.basename(file),
      });
    }
  }

  return buildable.sort((a, b) => a.file.localeCompare(b.file));
}

function buildBundle(included) {
  return [
    '# ChatGPT Upload Bundle',
    '',
    'Generated from source documents marked `upload_to_chatgpt: true`.',
    '',
    ...included.flatMap((item) => [
      `## ${item.title}`,
      '',
      `File: \`${toProjectPath(item.file)}\``,
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
}

function buildUploadInstructions({
  buildTag,
  changedBuildableItems,
  projectInstructionsChanged,
  isFirstBuild,
}) {
  const changedUploadPaths = changedBuildableItems.map((item) =>
    toUploadPath(item.file),
  );

  return [
    '# Upload Instructions',
    '',
    `Generated build tag: \`${buildTag}\``,
    '',
    isFirstBuild
      ? 'This is the first build. Upload the full generated upload set.'
      : 'This build includes only files that changed since the previous build tag.',
    '',
    '## Required Human Action',
    '',
    changedBuildableItems.length > 0
      ? 'Upload these changed source files to the ChatGPT Project:'
      : 'No changed source files need to be uploaded.',
    '',
    ...formatList(changedUploadPaths),
    '',
    '## Project Instructions Update',
    '',
    projectInstructionsChanged
      ? 'Update the ChatGPT Project Instructions from:'
      : 'No ChatGPT Project Instructions update is required.',
    '',
    projectInstructionsChanged
      ? '- `dist/project-instructions.md`'
      : '- None',
    '',
    '## Upload Directory',
    '',
    'Changed source files were copied to:',
    '',
    '```text',
    'dist/uploads/',
    '```',
    '',
    '## Notes',
    '',
    '- Upload only the files listed above unless intentionally doing a full refresh.',
    '- If instructions changed, paste `dist/project-instructions.md` into the ChatGPT Project Instructions field.',
    '- For a major source refresh, start a new ChatGPT conversation.',
    '- For minor source refreshes, tell ChatGPT to use the current uploaded files as authoritative.',
  ]
    .join('\n')
    .trimEnd();
}

async function copyUploadFiles(items) {
  await fs.rm(uploadsDir, { recursive: true, force: true });
  await fs.mkdir(uploadsDir, { recursive: true });

  for (const item of items) {
    const relativePath = path.relative(sourceDir, item.file);
    const destinationPath = path.join(uploadsDir, relativePath);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(item.file, destinationPath);
  }
}

async function copyProjectInstructionsIfNeeded(
  projectInstructionsChanged,
) {
  await fs.rm(projectInstructionsOutputFile, { force: true });

  if (!projectInstructionsChanged) {
    return;
  }

  await fs.copyFile(
    projectInstructionsPath,
    projectInstructionsOutputFile,
  );
}

async function createBuildTag(tag) {
  await execFileAsync('git', ['tag', tag, 'HEAD']);
}

async function main() {
  await validateRepositoryRoot();
  const currentCommit = await getCurrentCommit();
  const status = await getWorkingTreeStatus();

  if (status) {
    console.error('Build aborted: working tree is not clean.');
    console.error('Commit or discard changes before building.');
    process.exit(1);
  }

  const tagsAtHead = await getTagsPointingAtHead();
  const existingBuildTagAtHead = tagsAtHead.find(
    (tag) => parseBuildTag(tag) !== null,
  );

  if (existingBuildTagAtHead) {
    console.log(`HEAD is already built: ${existingBuildTagAtHead}`);
    console.log('Nothing to do.');
    return;
  }

  const latestBuildTag = await getLatestBuildTag();
  const isFirstBuild = latestBuildTag === null;

  const changedFiles =
    await getChangedFilesSinceBuildTag(latestBuildTag);
  const included = await getBuildableSourceDocuments();
  const changedBuildableItems = isFirstBuild
    ? included
    : included.filter((item) => {
        return changedFiles.includes(toProjectPath(item.file));
      });
  const projectInstructionsChanged = changedFiles.includes(
    toProjectPath(projectInstructionsPath),
  );

  const hasUploadImpact =
    changedBuildableItems.length > 0 || projectInstructionsChanged;

  if (!hasUploadImpact) {
    console.log('No ChatGPT Project upload changes detected.');

    if (latestBuildTag) {
      console.log(`Latest build tag remains ${latestBuildTag}.`);
    } else {
      console.log(
        'No prior build tag exists, but no buildable files were found.',
      );
    }

    console.log('Nothing to upload.');
    return;
  }

  const buildTag = await getNextBuildTag();
  const bundle = buildBundle(included);
  const uploadInstructions = buildUploadInstructions({
    buildTag,
    changedBuildableItems,
    projectInstructionsChanged,
    isFirstBuild,
  });

  await fs.mkdir(outputDir, { recursive: true });
  await copyUploadFiles(changedBuildableItems);
  await copyProjectInstructionsIfNeeded(projectInstructionsChanged);
  await fs.writeFile(outputFile, `${bundle}\n`, 'utf8');
  await fs.writeFile(
    uploadInstructionsFile,
    `${uploadInstructions}\n`,
    'utf8',
  );
  await createBuildTag(buildTag);

  console.log(`Created build tag ${buildTag} at ${currentCommit}`);
  console.log(`Wrote ${outputFile}`);
  console.log(`Wrote ${uploadInstructionsFile}`);
  console.log(`Copied changed upload files to ${uploadsDir}`);
  console.log(
    `Changed source file(s): ${changedBuildableItems.length}`,
  );

  console.log('');
  console.log(
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
  );
  console.log('!! UPLOAD REQUIRED');
  console.log(
    '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
  );
  console.log('');

  if (changedBuildableItems.length > 0) {
    console.log('Upload these files to the ChatGPT Project:');

    for (const item of changedBuildableItems) {
      console.log(`- ${toUploadPath(item.file)}`);
    }
  } else {
    console.log('No changed source files need to be uploaded.');
  }

  if (projectInstructionsChanged) {
    console.log('');
    console.log('UPDATE PROJECT INSTRUCTIONS FROM:');
    console.log(
      `- ${path.relative(process.cwd(), projectInstructionsOutputFile)}`,
    );
  }

  console.log('');
  console.log('Open the generated checklist:');
  console.log(
    `- ${path.relative(process.cwd(), uploadInstructionsFile)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
