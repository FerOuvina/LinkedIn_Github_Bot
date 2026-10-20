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
import { languageInstruction, languageName } from './languages.js';
import { addMissingRepoLinks, enforceRepoLinks, repoUrl } from './links.js';
import { loadPostConfig } from './postConfig.js';
import { commitWindowEnd } from './schedule.js';
import { scoreCommits, rankCommits } from './commitScoring.js';
import {
  fetchOwnedRepos,
  fetchRepoActivity,
  topActiveRepos
} from './github.js';
import { requestJson } from './http.js';
import { summarize } from './llm.js';

const DRY_RUN = process.argv.includes('--dry-run');
const CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'post.config.json'
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DAY_MS = 24 * 60 * 60 * 1000;

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
 * @returns {Promise<"published"|"dry-run"|"no-activity"|"no-significant-commits"|"not-scheduled">}
 */
export default async function run({ sleepImpl = sleep, configPath = CONFIG_PATH } = {}) {
  const config = loadPostConfig({ filePath: configPath });
  const scheduledCron = String(process.env.SCHEDULE_CRON ?? '').trim();
  const hasCrons = Object.keys(config.crons ?? {}).length > 0;

  // A scheduled run posts only the languages whose cron fired. Without crons
  // (older config) it behaves like the single-run version and posts them all.
  let languages = config.languages;
  if (scheduledCron && hasCrons) {
    languages = config.languages.filter(
      (code) => config.crons[code] === scheduledCron
    );
    if (languages.length === 0) {
      console.log('No language is scheduled for this run.');
      return 'not-scheduled';
    }
  }

  // Every language in a day shares one 24h window ending at the earliest post
  // time, so the later post does not silently include newer commits.
  const until =
    scheduledCron && hasCrons
      ? commitWindowEnd({
          timeZone: config.timezone,
          times: config.times,
          languages: config.languages,
        })
      : null;
  const since = until ? new Date(until.getTime() - DAY_MS) : getSinceDate(24, new Date());

  // Get repo activity — each repo's commits are fetched exactly once
  const repos = await fetchOwnedRepos(HUB_USER, { headers: GIT_HEADERS });
  const activity = await fetchRepoActivity(repos, {
    since,
    until,
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
    const url = repoUrl(fullName);

    filteredCommits.push(
      ...rankCommits(
        scoreCommits(
          messages.map((message) => ({ repo: fullName, url, message }))
        )
      )
    );
  }

  if (filteredCommits.length === 0) {
    console.log('No significant commits to post today.');
    return 'no-significant-commits';
  }

  // Build prompt for AI summary
  const commitsText = filteredCommits
    .map((c) => `- ${c.repo}: ${c.message}\n  repo link: ${c.url}`)
    .join('\n');
  const template = loadPrompt();
  const withCommits =
    template.includes('{commits}') ? template : (
      `${template}\n\nCommits:\n{commits}`
    );
  const basePrompt = withCommits
    .replace('{commits}', commitsText)
    .replace('{hubUser}', HUB_USER);
  const repoUrls = filteredCommits.map((c) => c.url);
  const { gapMinutes } = config;

  for (let index = 0; index < languages.length; index++) {
    const language = languages[index];
    const prompt = `${languageInstruction(language)}\n\n${basePrompt}`;

    const aiSummary = await summarize(prompt);
    const postText = addMissingRepoLinks(
      enforceRepoLinks(aiSummary, repoUrls),
      repoUrls,
      language
    );

    // Dry run for testing
    if (DRY_RUN) {
      console.log(
        `🧪 DRY RUN — ${languageName(language)} LinkedIn post would be:\n`
      );
      console.log(postText);
      continue;
    }

    await publish(postText);
    console.log(`LinkedIn post published in ${languageName(language)}.`);

    if (index < languages.length - 1) {
      await sleepImpl(gapMinutes * 60_000);
    }
  }

  return DRY_RUN ? 'dry-run' : 'published';
}

async function publish(postText) {
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
}
