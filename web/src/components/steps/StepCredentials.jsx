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
      <p className="mb-8 max-w-2xl text-lg text-ash">
        These stay in the setup server's memory until you save them. Nothing is
        sent anywhere until the next step, and nothing is written until you
        confirm it.
      </p>

      <div className="grid max-w-2xl gap-6">
        {FIELDS.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <label className="ff-mono text-[11px] uppercase tracking-[0.2em] text-bone">
              {field.label}
            </label>
            <input
              type={field.type ?? "text"}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => setValue(field.name, e.target.value)}
              className="ff-input"
            />
            <p className="text-sm text-ash">
              {field.help}{" "}
              {field.link && (
                <a
                  className="text-primary underline decoration-2 underline-offset-4 hover:text-cyan"
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
