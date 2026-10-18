export const SCORE_RULES = [
  { match: /^feat:/i, score: 5 },
  { match: /^fix:/i, score: 4 },
  { match: /\b(add|implement|support)\b/i, score: 2 },

  { match: /\btest(s)?\b/i, score: -1 },
  { match: /\b(chore|lint|format|ci|docs|merge)\b/i, score: -2 },
];

export const MIN_SCORE = 1;

export function scoreCommit(message) {
  let score = 0;

  for (const rule of SCORE_RULES) {
    if (rule.match.test(message)) {
      score += rule.score;
    }
  }

  return score;
}

export function filterByScore(commits, minScore = MIN_SCORE) {
  return commits.filter((c) => c.score >= minScore);
}

export function rankCommits(commits, limit = 4) {
  return filterByScore(commits).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function scoreCommits(commits) {
  return commits.map((c) => ({ ...c, score: scoreCommit(c.message ?? "") }));
}

export function formatCommitMessage(msg) {
  if (/^feat:/i.test(msg)) return "✨ " + msg.replace(/^feat:\s*/i, "");
  if (/^fix:/i.test(msg)) return "🐛 " + msg.replace(/^fix:\s*/i, "");
  return "• " + msg;
}
