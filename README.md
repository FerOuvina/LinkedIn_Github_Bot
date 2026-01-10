### GitHub → LinkedIn Automation

Automatically turn your GitHub activity into polished LinkedIn posts using GitHub Actions and AI.

This project connects your GitHub workflow with LinkedIn to generate daily, human-readable updates based on your recent commits — ideal for maintaining a consistent LinkedIn presence without manual effort.

## 🚀 What it does

- Runs automatically on a daily schedule using GitHub Actions.

- Analyzes recent activity across your most active repositories.

- Extracts commit messages and identifies meaningful changes.

- Uses AI (via Hugging Face) to generate clear, professional LinkedIn posts.

- Publishes formatted updates directly to LinkedIn.

## 🎯 Why this exists

Developers build and ship things every day, but that work often stays invisible outside GitHub.

This project was created to:

- Bridge the gap between technical work and professional visibility.

- Encourage consistent LinkedIn activity without interrupting the development flow.

- Explore automation, APIs, OAuth flows, and AI-assisted content generation in a real-world scenario.

- Serve as a practical example of integrating multiple platforms into a single automated workflow.

- It’s both a useful personal tool and a learning-focused project that demonstrates backend automation, API integration, and production-ready practices.

## ✨ Sample LinkedIn Post Output

🚀 Daily Dev Update

Today I worked on improving authentication handling and refactoring API logic across multiple repositories.

- Enhanced OAuth flow and token validation.
- Cleaned up error handling and improved logging.
- Minor performance optimizations and code structure improvements.

Always iterating and learning. 💻⚙️

(This post was automated using the LinkedIn API, if you want to learn more about it, check out the repository on Github: https://github.com/FerOuvina/LinkedIn_Github_Bot)

## 🔐 Security & Authentication

- OAuth 2.0 for LinkedIn authentication.

- GitHub Secrets for securely storing tokens and API keys.

- No credentials are hard-coded or exposed in the repository.

## 🛠 Tech Stack

- Node.js – automation logic and API handling.

- GitHub Actions – scheduling and execution.

- GitHub REST API – repository and commit data.

- LinkedIn REST API – post publishing.

- Hugging Face – AI-powered text summarization.

## 🔮 Future ideas

While this project currently runs as a GitHub Action, it is designed with future expansion in mind.

Potential next steps include:

- Converting it into a web application where users can connect their own GitHub and LinkedIn accounts.

- Adding customization options for post tone, frequency, and formatting.