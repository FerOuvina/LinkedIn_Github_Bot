import getSinceDate from "./getSinceDate.js";
import {
  GIT_HEADERS,
  GROQ_HEADERS,
  LINKEDIN_HEADERS,
  LINKEDIN_AUTHOR,
  HUB_USER,
  GROQ_MODEL,
} from "./consts.js";
import { scoreCommits, rankCommits } from "./commitScoring.js";
import {
  fetchOwnedRepos,
  fetchRepoActivity,
  topActiveRepos,
} from "./github.js";
import { requestJson } from "./http.js";

const DRY_RUN = process.argv.includes("--dry-run");

// Get previous 24hs date
const now = new Date(Date.now());
const since = getSinceDate(24, now);

// Helper: call the Groq chat completions API (OpenAI-compatible)
async function generateSummary(prompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const model = GROQ_MODEL;

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Start the post with normal greetings, something nice or similar but short, respond ONLY with the LinkedIn post text. Do not add any preamble, explanation, or labels, and DON'T forget to add a space after every emoji.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  // A POST is never retried here: a blind retry risks publishing twice.
  const data = await requestJson(
    url,
    { method: "POST", headers: GROQ_HEADERS, body: JSON.stringify(payload), retries: 0 }
  );

  // Chat completion response: choices[0].message.content
  if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  throw new Error(
    `Unexpected Groq response shape: ${JSON.stringify(data)}`
  );
}

/**
 * Build and publish the daily post.
 * @returns {Promise<"published"|"dry-run"|"no-activity"|"no-significant-commits">}
 */
export default async function run() {
  // Get repo activity — each repo's commits are fetched exactly once
  const repos = await fetchOwnedRepos(HUB_USER, { headers: GIT_HEADERS });
  const activity = await fetchRepoActivity(repos, {
    since,
    headers: GIT_HEADERS,
  });

  // Get last 3 repos with activity and check if there was any activity
  const topRepos = topActiveRepos(activity, 3);

  if (topRepos.length === 0) {
    console.log("No commits today — nothing to post.");
    return "no-activity";
  }

  // Check for non-important keywords and filter commits based on them
  const filteredCommits = [];

  for (const { fullName, messages } of topRepos) {
    const [, repo] = fullName.split("/");

    filteredCommits.push(
      ...rankCommits(
        scoreCommits(messages.map((message) => ({ repo, message })))
      )
    );
  }

  if (filteredCommits.length === 0) {
    console.log("No significant commits to post today.");
    return "no-significant-commits";
  }

  // Build prompt for AI summary
  const commitsText = filteredCommits
    .map((c) => `${c.repo}: ${c.message}`)
    .join("\n");
  const prompt = `
    Write a concise LinkedIn post summarizing the following commits from my GitHub repositories. For the github user use ${HUB_USER}.
    Make it professional, readable, and engaging. Use emojis for features and fixes.
    Keep it short and include clickable repo URLs if possible.
    DON'T forget to add a space after every emoji.
    Commits:
    ${commitsText}`;

  const aiSummary = await generateSummary(prompt);

  const postText = `${aiSummary}\n\n📝 This post was automated using the LinkedIn API, if you want to learn more about it, check out my repository on Github:\n🔗 My GitHub: https://github.com/${HUB_USER}\n🔗 My Portfolio: https://ouvina-fernando.vercel.app`;

  // Dry run for testing
  if (DRY_RUN) {
    console.log("🧪 DRY RUN — LinkedIn post would be:\n");
    console.log(postText);
    return "dry-run";
  }

  const body = {
    author: LINKEDIN_AUTHOR,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: postText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  // Never retried: LinkedIn's ugcPosts POST is not idempotent, so a retry after
  // a timeout could publish the post twice.
  await requestJson(
    "https://api.linkedin.com/v2/ugcPosts",
    {
      method: "POST",
      headers: LINKEDIN_HEADERS,
      body: JSON.stringify(body),
      retries: 0,
    }
  );

  console.log("LinkedIn post published.");

  return "published";
}
