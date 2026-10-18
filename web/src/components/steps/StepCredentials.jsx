import { useSetup } from "../../context/SetupContext.jsx";

const FIELDS = [
  {
    name: "HUB_USER",
    label: "GitHub username",
    placeholder: "your-username",
    help: "The account whose commits should be turned into posts.",
  },
  {
    name: "GITHUB_TOKEN",
    label: "GitHub token",
    type: "password",
    placeholder: "github_pat_…",
    help: "Read access to your public repositories.",
    link: "https://github.com/settings/tokens",
  },
  {
    name: "GROQ_API_KEY",
    label: "Groq API key",
    type: "password",
    placeholder: "gsk_…",
    help: "Used to generate the post text.",
    link: "https://console.groq.com/keys",
  },
  {
    name: "GROQ_MODEL",
    label: "Model (optional)",
    placeholder: "qwen/qwen3.8-27b",
    help: "Leave blank to use the default. Must be a chat model.",
  },
];

export default function StepCredentials() {
  const { values, setValue } = useSetup();

  return (
    <section>
      <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400 mb-8">
        These stay in the setup server's memory until you save them. Nothing is
        sent anywhere until the next step, and nothing is written until you
        confirm it.
      </p>

      <div className="grid gap-6 max-w-2xl">
        {FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <label className="font-semibold text-slate-800 dark:text-slate-200">
              {field.label}
            </label>
            <input
              type={field.type ?? "text"}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => setValue(field.name, e.target.value)}
              className="w-full rounded-lg border-slate-300 bg-white text-slate-900 shadow-sm focus:border-primary focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {field.help}{" "}
              {field.link && (
                <a
                  className="text-primary hover:underline"
                  href={field.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get one
                </a>
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
