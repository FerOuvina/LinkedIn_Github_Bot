import { useState } from "react";

export default function CopyBlock({ code, language = "bash", output }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="relative border-2 border-edge bg-void">
      <div className="flex items-center justify-between border-b-2 border-edge bg-shell px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="size-2 bg-primary" />
          <span className="size-2 bg-crimson" />
          <span className="size-2 bg-cyan" />
        </div>
        <span className="ff-mono text-[10px] text-ash">{language}</span>
      </div>

      <div className="flex items-start justify-between gap-4 p-4">
        <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-bone">
          <code>{code}</code>
        </pre>

        <button
          onClick={handleCopy}
          className="ff-mono shrink-0 border border-edge px-2 py-1 text-[10px] text-ash transition hover:border-primary hover:text-primary"
          aria-label="Copy to clipboard"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      {output && (
        <div className="border-t border-edge bg-shell px-4 py-2 font-mono text-xs text-acid">
          {output}
        </div>
      )}
    </div>
  );
}
