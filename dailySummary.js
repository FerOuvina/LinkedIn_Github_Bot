import "dotenv/config";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_AUTHOR = process.env.LINKEDIN_AUTHOR_URN;
const GITHUB_USER = process.env.GITHUB_USER; // your GitHub username
const DRY_RUN = process.argv.includes("--dry-run");

if (!GITHUB_TOKEN || !LINKEDIN_TOKEN || !LINKEDIN_AUTHOR || !GITHUB_USER) {
  throw new Error(
    "Missing one or more required env variables: GITHUB_TOKEN, LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN, GITHUB_USER"
  );
}

// 1 Calculate "today" in UTC
const since = new Date();
since.setUTCHours(0, 0, 0, 0);

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "User-Agent": "daily-summary-bot",
  Accept: "application/vnd.github+json",
};

async function run() {
  // 2 Fetch recent events
  const eventsRes = await fetch(
    `https://api.github.com/users/${GITHUB_USER}/events`,
    { headers }
  );
  const events = await eventsRes.json();

  // 3 Count commits per repo
  const repoActivity = {};
  for (const event of events) {
    if (event.type !== "PushEvent") continue;
    const createdAt = new Date(event.created_at);
    if (createdAt < since) continue;

    const repoName = event.repo.name;
    const commitCount = event.payload.commits?.length || 0;
    repoActivity[repoName] = (repoActivity[repoName] || 0) + commitCount;
  }

  // 4 Select top 3 active repos
  const topRepos = Object.entries(repoActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([repo]) => repo);

  if (topRepos.length === 0) {
    console.log("No commits today — nothing to post.");
    return;
  }

  // 5 Fetch and filter commits for top repos
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

  const allCommits = [];

  const filteredCommits = allCommits.filter((c) => {
    const msg = c.message.toLowerCase();
    return !insignificantKeywords.some((kw) => msg.includes(kw));
  });

  for (const fullRepo of topRepos) {
    const [owner, repo] = fullRepo.split("/");
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?since=${since.toISOString()}`,
      { headers }
    );
    const commits = await res.json();

    filteredCommits.push(
      ...commits.map((c) => ({
        repo,
        message: c.commit.message.split("\n")[0],
      }))
    );
  }

  if (filteredCommits.length === 0) {
    console.log("No significant commits to post today.");
    return;
  }

  // 6 Build LinkedIn summary
  const groupedByRepo = {};
  for (const c of filteredCommits) {
    if (!groupedByRepo[c.repo]) groupedByRepo[c.repo] = [];
    groupedByRepo[c.repo].push(c.message);
  }

  let postText = "🛠 Daily dev update\n\nToday's progress:\n";
  for (const [repo, messages] of Object.entries(groupedByRepo)) {
    const owner = GITHUB_USER;
    const repoUrl = `https://github.com/${owner}/${repo}`;

    postText += `📦 ${repo}: ${repoUrl}\n`;

    messages.forEach((m) => {
      let msg = m;
      if (/^feat:/i.test(msg)) msg = msg.replace(/^feat:\s*/i, "✨ ");
      else if (/^fix:/i.test(msg)) msg = msg.replace(/^fix:\s*/i, "🐛 ");
      else msg = `• ${msg}`;
      postText += `${msg}\n`;
    });

    postText += "\n";
  }
  postText += `🔗 My Github: https://github.com/${GITHUB_USER} \n🔗 My Portfolio: https://ouvina-fernando.vercel.app`;

  // 7 Post to LinkedIn (or dry-run)
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
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
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
