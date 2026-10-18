import CopyBlock from "../copyBlock.jsx";

export default function StepCloneRepo() {
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-2xl text-lg text-ash">
        Clone the repository, install its one dependency, and start the setup
        server. Everything after this happens in the browser.
      </p>

      <div className="space-y-6">
        <div>
          <p className="ff-mono mb-2 text-[10px] text-ash"># Clone the repository</p>
          <CopyBlock code={`git clone https://github.com/FerOuvina/LinkedIn_Github_Bot.git`} />
        </div>

        <div>
          <p className="ff-mono mb-2 text-[10px] text-ash"># Enter the folder and install</p>
          <CopyBlock code={`cd LinkedIn_Github_Bobot\nnpm install`} />
        </div>

        <div>
          <p className="ff-mono mb-2 text-[10px] text-ash"># Start the setup server</p>
          <CopyBlock code={`npm run setup`} output="setup server listening on http://127.0.0.1:4319" />
        </div>
      </div>
    </div>
  );
}
