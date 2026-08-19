import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const contentPath = resolve('content/blog-posts.json');
const content = JSON.parse(await readFile(contentPath, 'utf8'));
const posts = content.posts;

if (!Array.isArray(posts) || posts.length === 0) {
  throw new Error('content/blog-posts.json must contain a non-empty posts array.');
}

const requiredTextFields = [
  'slug',
  'title',
  'excerpt',
  'category',
  'published',
  'readTime',
  'author',
  'standfirst',
  'cta',
];
const slugs = new Set();
const postsPerDay = new Map();
const imageChecks = [];
const today = new Date().toISOString().slice(0, 10);

posts.forEach((post, index) => {
  requiredTextFields.forEach((field) => {
    if (typeof post[field] !== 'string' || post[field].trim() === '') {
      throw new Error(`Post ${index + 1} is missing a valid ${field}.`);
    }
  });

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    throw new Error(`Post slug "${post.slug}" must use lowercase kebab-case.`);
  }

  if (slugs.has(post.slug)) {
    throw new Error(`Duplicate post slug: ${post.slug}`);
  }
  slugs.add(post.slug);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.published)) {
    throw new Error(`Post "${post.slug}" has an invalid published date.`);
  }

  postsPerDay.set(post.published, (postsPerDay.get(post.published) || 0) + 1);

  if (!Array.isArray(post.takeaways) || post.takeaways.length < 2) {
    throw new Error(`Post "${post.slug}" needs at least two takeaways.`);
  }

  if (!Array.isArray(post.sections) || post.sections.length < 3) {
    throw new Error(`Post "${post.slug}" needs at least three sections.`);
  }

  post.sections.forEach((section, sectionIndex) => {
    if (!section.heading || !Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
      throw new Error(`Post "${post.slug}" has an incomplete section at index ${sectionIndex}.`);
    }
  });

  if (post.published > today) {
    throw new Error(`Post "${post.slug}" is dated ${post.published}, which is in the future.`);
  }

  // AGENTS.md requires traceable sources for factual or time-sensitive claims.
  if (!Array.isArray(post.sources) || post.sources.length === 0) {
    throw new Error(`Post "${post.slug}" needs at least one entry in sources.`);
  }

  post.sources.forEach((source, sourceIndex) => {
    if (!source?.title?.trim() || !source?.url?.trim()) {
      throw new Error(`Post "${post.slug}" has an incomplete source at index ${sourceIndex}.`);
    }
    if (!/^https?:\/\//.test(source.url)) {
      throw new Error(`Post "${post.slug}" source "${source.title}" must use an absolute http(s) URL.`);
    }
  });

  // Social cards and search results truncate past these lengths.
  if (post.title.length > 70) {
    throw new Error(`Post "${post.slug}" has a ${post.title.length}-character title. Keep it under 70.`);
  }
  if (post.excerpt.length > 165) {
    throw new Error(`Post "${post.slug}" has a ${post.excerpt.length}-character excerpt. Keep it under 165.`);
  }

  if (post.image) {
    if (!post.image.startsWith('/')) {
      throw new Error(`Post "${post.slug}" image must be a root-relative path such as /example.png.`);
    }
    if (!post.imageAlt?.trim()) {
      throw new Error(`Post "${post.slug}" sets an image but no imageAlt.`);
    }
    imageChecks.push(
      access(resolve(`public${post.image}`)).catch(() => {
        throw new Error(`Post "${post.slug}" references ${post.image}, which is missing from public/.`);
      })
    );
  }
});

await Promise.all(imageChecks);

for (const [date, count] of postsPerDay) {
  if (count > 2) {
    throw new Error(`${date} has ${count} posts. The publishing limit is two per day.`);
  }
}

for (let index = 1; index < posts.length; index += 1) {
  if (posts[index - 1].published < posts[index].published) {
    throw new Error('Blog posts must be sorted from newest to oldest.');
  }
}

console.log(`Validated ${posts.length} LogicFolds blog posts.`);
