import "dotenv/config";

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
export const LINKEDIN_AUTHOR = process.env.LINKEDIN_AUTHOR_URN;
export const HUB_USER = process.env.HUB_USER;

export const GIT_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "User-Agent": "daily-summary-bot",
  Accept: "application/vnd.github+json",
};

export const LINKEDIN_HEADERS = {
  Authorization: `Bearer ${LINKEDIN_TOKEN}`,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
};

export const GROQ_HEADERS = {
  Authorization: `Bearer ${GROQ_API_KEY}`,
  "Content-Type": "application/json",
};
