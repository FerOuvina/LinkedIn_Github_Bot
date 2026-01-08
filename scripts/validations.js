import {
  GITHUB_TOKEN,
  LINKEDIN_TOKEN,
  HF_API_KEY,
  LINKEDIN_AUTHOR,
  HUB_USER,
} from "./consts.js";

const requiredEnv = {
  GITHUB_TOKEN,
  LINKEDIN_TOKEN,
  LINKEDIN_AUTHOR,
  HUB_USER,
  HF_API_KEY,
};

export const envMissing = Object.entries(requiredEnv)
  .filter(([_, value]) => !value)
  .map(([key]) => key);
