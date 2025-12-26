import "dotenv/config";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_AUTHOR = process.env.LINKEDIN_AUTHOR_URN;
const HUB_USER = process.env.HUB_USER;
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

const requiredEnv = {
  GITHUB_TOKEN,
  LINKEDIN_TOKEN,
  LINKEDIN_AUTHOR,
  HUB_USER,
  HF_API_KEY,
};

const missing = Object.entries(requiredEnv)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(`Missing env variables: ${missing.join(", ")}`);
}

const since = new Date();
since.setUTCHours(0, 0, 0, 0);

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "User-Agent": "daily-summary-bot",
  Accept: "application/vnd.github+json",
};

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
          "Start the post with something like: `This is what I am working on right now` or similar, respond ONLY with the LinkedIn post text. Do not add any preamble, explanation, or labels, and DON'T forget to add a space after every emoji.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
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

async function run() {
  const eventsRes = await fetch(
    `https://api.github.com/users/${HUB_USER}/events`,
    { headers }
  );
  const events = await eventsRes.json();

  const repoActivity = {};
  for (const event of events) {
    if (event.type !== "PushEvent") continue;
    const createdAt = new Date(event.created_at);
    if (createdAt < since) continue;

    const repoName = event.repo.name;
    const commitCount = event.payload.commits?.length || 0;
    repoActivity[repoName] = (repoActivity[repoName] || 0) + commitCount;
  }

  const topRepos = Object.entries(repoActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([repo]) => repo);

  if (topRepos.length === 0) {
    console.log("No commits today — nothing to post.");
    return;
  }

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
      { headers }
    );
    const commitsData = await res.json();
    const commits = Array.isArray(commitsData) ? commitsData : [];

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
    Write a concise LinkedIn post summarizing the following commits from my GitHub repositories.
    Make it professional, readable, and engaging. Use emojis for features and fixes.
    Keep it short and include clickable repo URLs if possible.
    DON'T forget to add a space after every emoji.
    Commits:
    ${commitsText}`;

  const aiSummary = await generateSummary(prompt);

  const postText = `${aiSummary}\n\n🔗 My GitHub: https://github.com/${HUB_USER}\n🔗 My Portfolio: https://ouvina-fernando.vercel.app`;

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
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("LinkedIn status:", res.status);
}

run().catch((err) => console.error(err));
