import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import CopyBlock from './copyBlock.jsx';
import { docsUrl } from '../lib/api.js';

/**
 * The setup guide as documentation.
 *
 * Same steps as the wizard, but nothing to type and nothing to check: this is
 * what the hosted site shows, where the local server that performs those
 * checks does not exist.
 */

const STEPS = [
  {
    title: 'Check your machine',
    body: 'You need Node.js 20 or newer, and the GitHub CLI, which is what writes your credentials as Actions secrets.',
    commands: ['node -v', 'gh --version', 'gh auth login'],
    note: 'Install the CLI with `winget install GitHub.cli`, or `brew install gh` on macOS.'
  },
  {
    title: 'Clone and install',
    body: 'Get the repository and its single dependency.',
    commands: [
      'git clone https://github.com/FerOuvina/LinkedIn_Github_Bot.git',
      'cd LinkedIn_Github_Bot',
      'npm install'
    ]
  },
  {
    title: 'Add your API credentials',
    body: 'Create a `.env` file next to `package.json` with these values. They are read from the environment and never committed.',
    commands: [
      '# your GitHub username',
      'HUB_USER=your-username',
      '# read access to your public repositories',
      'GITHUB_TOKEN=github_pat_...',
      '# from https://console.groq.com/keys',
      'GROQ_API_KEY=gsk_...',
      '# optional, this is the default',
      'GROQ_MODEL=qwen/qwen3.8-27b',
      '# optional: up to two of en, es, pt, fr — one post each',
      'POST_LANGUAGES=en,es',
      '# only used when both languages share the same time',
      'POST_GAP_MINUTES=5'
    ]
  },
  {
    title: 'Connect LinkedIn',
    body: 'LinkedIn needs its own app before it will let the bot post. You will request both products, then authorize.',
    commands: ['npm run auth:linkedin'],
    note: 'You need your own LinkedIn app first, with both Sign In with LinkedIn and Share on LinkedIn approved. The full walkthrough, including screenshots and troubleshooting, is in the guide.',
    link: { label: 'Read the LinkedIn setup guide', file: 'LINKEDIN_SETUP.md' }
  },
  {
    title: 'Save your credentials',
    body: 'Push them to GitHub Actions secrets so the scheduled job can use them, and to your `.env` so local runs keep working.',
    commands: ['npm run sync:secrets', 'npm run sync:secrets -- --apply'],
    note: 'The first run is a dry run and only lists what it would set. Add `--apply` to write.'
  },
  {
    title: 'Edit the post prompt',
    body: 'Choose up to two languages for your posts, then tailor the prompt the LLM uses to write them. It is stored in `prompt.md` so it is version-controlled and picked up by the scheduled job.',
    commands: [],
    note: 'Use `{commits}` for the scored commit list and `{hubUser}` for your GitHub username.'
  },
  {
    title: 'Choose when it posts',
    body: 'Each selected language gets its own local time. GitHub scheduled jobs run on UTC, so the wizard converts both times into the cron lines the workflow needs; by hand they are the `schedule:` entries in `.github/workflows/linkedin-post.yml`. Both posts use the same 24-hour commit window, ending at the earliest time you picked.',
    commands: [],
    note: 'Times are picked in your timezone. A cron cannot follow daylight saving, so re-run that step after the clocks change.'
  },
  {
    title: 'Verify, then try a post',
    body: 'Check every credential against its real API, then generate a post without publishing it.',
    commands: ['npm run preflight', 'npm start -- --dry-run']
  },
  {
    title: 'Let it run',
    body: 'The schedule is whatever cron line is in the workflow — the setup wizard has a step that converts a city and time into the UTC cron for you. You can also trigger a run by hand from the Actions tab.',
    commands: []
  }
];

export default function StaticSetup() {
  const [guideHref, setGuideHref] = useState(null);

  useEffect(() => {
    setGuideHref(docsUrl('LINKEDIN_SETUP.md'));
  }, []);

  return (
    <div className='min-h-screen scanlines grid-bg bg-void font-body text-bone'>
      <header className='sticky top-0 z-40 border-b-2 border-edge bg-void/90 backdrop-blur-md'>
        <div className='flex items-center justify-between h-16 max-w-4xl px-4 mx-auto sm:px-6'>
          <Link href='/' className='flex items-center gap-2'>
            <span className='material-symbols-outlined text-primary'>
              rocket_launch
            </span>
            <span className='text-sm ff-mono'>setup_guide</span>
          </Link>
          <a
            href='https://github.com/FerOuvina/LinkedIn_Github_Bot'
            target='_blank'
            rel='noreferrer'
            className='px-4 py-2 btn btn-ghost'>
            <span className='material-symbols-outlined text-[18px]'>code</span>
            Get the code
          </a>
        </div>
      </header>

      <main className='max-w-4xl px-4 py-10 mx-auto sm:px-6'>
        <div className='p-6 my-6 text-sm panel text-ash'>
          <p className='ff-mono text-xs uppercase tracking-[0.2em] text-primary'>
            Why is this read-only?
          </p>
          <p className='mt-1'>
            The wizard checks your credentials, completes the LinkedIn OAuth
            flow and writes secrets to your repository. All of that needs a
            server running on your own machine, so run{' '}
            <code className='border border-edge bg-void px-1.5 py-0.5 font-mono text-acid'>
              npm run setup
            </code>{' '}
            to use it. These steps are the same ones, written out.
          </p>
        </div>
        <h1 className='mt-6 text-4xl ff-display sm:text-5xl'>Getting started</h1>
        <p className='max-w-2xl mt-4 text-lg text-ash'>
          Nine steps, about ten minutes. Nothing here needs a browser-based
          setup: run the commands in your terminal and everything works the same
          way.
        </p>

        <ol className='mt-10 space-y-10'>
          {STEPS.map((step, index) => (
            <li key={step.title} className='flex gap-5'>
              <span className='flex items-center justify-center border-2 ff-mono size-9 shrink-0 border-primary bg-primary/10 text-primary'>
                {index + 1}
              </span>

              <div className='flex-1 min-w-0'>
                <h2 className='text-xl ff-display'>{step.title}</h2>
                <p className='mt-2 text-ash'>{step.body}</p>

                {step.commands.length > 0 && (
                  <div className='mt-4'>
                    <CopyBlock code={step.commands.join('\n')} />
                  </div>
                )}

                {step.note && (
                  <p className='mt-3 text-sm text-ash'>{step.note}</p>
                )}

                {step.link && (
                  <Link
                    to='/guide'
                    className='ff-mono mt-3 inline-block text-[11px] text-primary hover:text-cyan'>
                    {step.link.label} →
                  </Link>
                )}

                {step.link && guideHref && (
                  <a
                    href={guideHref}
                    target='_blank'
                    rel='noreferrer'
                    className='ff-mono ml-4 text-[11px] text-ash hover:text-primary'>
                    Raw markdown
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
