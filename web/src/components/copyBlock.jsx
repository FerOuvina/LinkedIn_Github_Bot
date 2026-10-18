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
    <div className="relative rounded-lg overflow-hidden bg-[#0d1117] border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] text-xs text-slate-400">
        <div className="flex justify-between w-full">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
          </div>
          <span className="font-mono">{language}</span>
        </div>
      </div>

      <pre className="flex justify-between p-4 overflow-x-auto font-mono text-sm text-white">
        <code>{code}</code>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 transition text-slate-400 hover:text-white"
        >
          <span className="material-symbols-outlined text-[16px]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied!" : "Copy"}
        </button>
      </pre>

      <div className="pb-2">
        {output && (
          <code className="pl-4 select-none text-slate-500">{output}</code>
        )}
      </div>
    </div>
  );
}
