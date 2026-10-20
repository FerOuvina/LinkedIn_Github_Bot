import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import getSinceDate from './getSinceDate.js';
import {
  GIT_HEADERS,
  LINKEDIN_HEADERS,
  LINKEDIN_AUTHOR,
  HUB_USER
} from './consts.js';
import { scoreCommits, rankCommits } from './commitScoring.js';
import {
  fetchOwnedRepos,
  fetchRepoActivity,
  topActiveRepos
} from './github.js';
import { requestJson } from './http.js';
import { summarize } from './llm.js';

const DRY_RUN = process.argv.includes('--dry-run');

// Get previous 24hs date
const now = new Date(Date.now());
const since = getSinceDate(24, now);

/** The prompt template used to ask the LLM to write the post. */
const DEFAULT_PROMPT = `You are a thoughtful software engineer who occasionally shares short, genuine updates about your work on LinkedIn. You write in a natural, first-person voice — clear, calm, and professional, never salesy or overly enthusiastic.

Your goal is to turn a GitHub commit into a short LinkedIn post that feels like something a real person would write after finishing a piece of work.
Commits:
{commits}`;

/**
 * Resolve the post prompt: an env override wins, then the committed
 * prompt.md, then the built-in default.
 */
function loadPrompt() {
  if (process.env.LINKEDIN_POST_PROMPT) return process.env.LINKEDIN_POST_PROMPT;
  const promptPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'prompt.md'
  );
  try {
    if (existsSync(promptPath)) return readFileSync(promptPath, 'utf8');
  } catch {
    // fall through to the default
  }
  return DEFAULT_PROMPT;
}

// Groq call lives in llm.js so the preflight probe can reuse the same shape.

/**
 * Build and publish the daily post.
 * @returns {Promise<"published"|"dry-run"|"no-activity"|"no-significant-commits">}
 */
export default async function run() {
  // Get repo activity — each repo's commits are fetched exactly once
  const repos = await fetchOwnedRepos(HUB_USER, { headers: GIT_HEADERS });
  const activity = await fetchRepoActivity(repos, {
    since,
    headers: GIT_HEADERS
  });

  // Get last 3 repos with activity and check if there was any activity
  const topRepos = topActiveRepos(activity, 3);

  if (topRepos.length === 0) {
    console.log('No commits today — nothing to post.');
    return 'no-activity';
  }

  // Check for non-important keywords and filter commits based on them
  const filteredCommits = [];

  for (const { fullName, messages } of topRepos) {
    const [, repo] = fullName.split('/');

    filteredCommits.push(
      ...rankCommits(
        scoreCommits(messages.map((message) => ({ repo, message })))
      )
    );
  }

  if (filteredCommits.length === 0) {
    console.log('No significant commits to post today.');
    return 'no-significant-commits';
  }

  // Build prompt for AI summary
  const commitsText = filteredCommits
    .map((c) => `${c.repo}: ${c.message}`)
    .join('\n');
  const prompt = loadPrompt()
    .replace('{commits}', commitsText)
    .replace('{hubUser}', HUB_USER);

  const aiSummary = await summarize(prompt);

  const postText = `${aiSummary}\n\n📝 This post was automated using the LinkedIn API, if you want to learn more about it, check out my repository on Github:\n🔗 My GitHub: https://github.com/${HUB_USER}\n🔗 My Portfolio: https://ouvina-fernando.vercel.app`;

  // Dry run for testing
  if (DRY_RUN) {
    console.log('🧪 DRY RUN — LinkedIn post would be:\n');
    console.log(postText);
    return 'dry-run';
  }

  const body = {
    author: LINKEDIN_AUTHOR,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: postText },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  // Never retried: LinkedIn's ugcPosts POST is not idempotent, so a retry after
  // a timeout could publish the post twice.
  await requestJson('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: LINKEDIN_HEADERS,
    body: JSON.stringify(body),
    retries: 0
  });

  console.log('LinkedIn post published.');

  return 'published';
}
