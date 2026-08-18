import { readFile } from 'node:fs/promises';
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
});

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
