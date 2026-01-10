// TESTS Functions

export function formatCommitMessage(msg) {
  if (/^feat:/i.test(msg)) return "✨ " + msg.replace(/^feat:\s*/i, "");
  if (/^fix:/i.test(msg)) return "🐛 " + msg.replace(/^fix:\s*/i, "");
  return "• " + msg;
}

export const SCORE_RULES = [
  { match: /^feat:/i, score: 5 },
  { match: /^fix:/i, score: 4 },
  { match: /\b(add|implement|support)\b/i, score: 2 },
  { match: /\btest(s)?\b/i, score: -1 },
  { match: /\b(chore|lint|format|ci|docs|merge)\b/i, score: -2 },
];

export function scoreCommit(msg) {
  let score = 0;

  for (const rule of SCORE_RULES) {
    if (rule.match.test(msg)) {
      score += rule.score;
    }
  }

  return score;
}

export function filterByScore(commits, minScore = 1) {
  return commits.filter((c) => c.score >= minScore);
}
