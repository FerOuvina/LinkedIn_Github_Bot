import getSinceDate from "./getSinceDate.js";
import {
  GIT_HEADERS,
  HF_HEADERS,
  LINKEDIN_HEADERS,
  LINKEDIN_AUTHOR,
  HUB_USER,
} from "./consts.js";

const DRY_RUN = process.argv.includes("--dry-run");

// Get previous 24hs date
const now = new Date(Date.now());
const since = getSinceDate(24, now);

// Helper: call Hugging Face text-generation API
async function generateSummary(prompt) {
  const url = "https://router.huggingface.co/v1/chat/completions";
  const model = "zai-org/GLM-4.7";

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

  const res = await fetch(url, {
    method: "POST",
    headers: HF_HEADERS,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));

  // Chat completion response: choices[0].message.content
  if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Fallbacks for older response shapes
  if (Array.isArray(data) && data[0]?.generated_text)
    return data[0].generated_text;
  if (data.generated_text) return data.generated_text;

  throw new Error(
    `Unexpected Hugging Face response shape: ${JSON.stringify(data)}`
  );
}

// Main Script
export default async function run() {
  // Get repo activity
  const ownedRepos = await fetch(
    `https://api.github.com/users/${HUB_USER}/repos?per_page=30`,
    { headers: GIT_HEADERS }
  );
  const repos = await ownedRepos.json();
  const repoActivity = {};

  for (const repo of repos) {
    const commitsRes = await fetch(
      `https://api.github.com/repos/${repo.owner.login}/${
        repo.name
      }/commits?since=${since.toISOString()}`,
      { headers: GIT_HEADERS }
    );

    const commits = await commitsRes.json();
    if (!Array.isArray(commits) || commits.length === 0) continue;

    repoActivity[`${repo.owner.login}/${repo.name}`] = commits.length;

    console.log(repoActivity);
  }

  // Get last 3 repos with activity and check if there was any activity
  const topRepos = Object.entries(repoActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([repo]) => repo);

  if (topRepos.length === 0) {
    console.log("No commits today — nothing to post.");
    return;
  }

  // Check for non-important keywords and filter commits based on them
  const insignificantKeywords = [
    "typo",
    "lint",
    "format",
    "chore",
    "merge",
    "ci",
    "docs",
    "test",
  ];
  const filteredCommits = [];

  for (const fullRepo of topRepos) {
    const [owner, repo] = fullRepo.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?since=${since.toISOString()}`,
      { headers: GIT_HEADERS }
    );
    const commitsData = await res.json();
    const commits = Array.isArray(commitsData) ? commitsData : [];
    console.log(
      "Commits before filtering:",
      commits.map((c) => c.commit.message)
    );
    const significant = commits
      .map((c) => ({ repo, message: c.commit?.message?.split("\n")[0] ?? "" }))
      .filter(
        (c) =>
          !insignificantKeywords.some((kw) =>
            c.message.toLowerCase().includes(kw)
          )
      )
      .slice(0, 4);

    filteredCommits.push(...significant);
  }

  if (filteredCommits.length === 0) {
    console.log("No significant commits to post today.");
    return;
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

  const postText = `${aiSummary}\n\n📝 This post was automated using the LinkedIn API, if you wanna learn more about it check out my repository on Github.\n🔗 My GitHub: https://github.com/${HUB_USER}\n🔗 My Portfolio: https://ouvina-fernando.vercel.app`;

  // Dry run for testing
  if (DRY_RUN) {
    console.log("🧪 DRY RUN — LinkedIn post would be:\n");
    console.log(postText);
    return;
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

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: LINKEDIN_HEADERS,
    body: JSON.stringify(body),
  });

  console.log("LinkedIn status:", res.status);
}

// TESTS Functions

export function filterSignificantCommits(commits, insignificantKeywords) {
  return commits.filter((c) => {
    const msg = c.message.toLowerCase();
    return !insignificantKeywords.some((kw) => msg.includes(kw));
  });
}

export function formatCommitMessage(msg) {
  if (/^feat:/i.test(msg)) return "✨ " + msg.replace(/^feat:\s*/i, "");
  if (/^fix:/i.test(msg)) return "🐛 " + msg.replace(/^fix:\s*/i, "");
  return "• " + msg;
}
