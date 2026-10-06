/**
 * Two sections: the pipeline (a real ordered sequence, so it is numbered) and
 * what you get out of it (not a sequence, so it isn't).
 */

const PIPELINE = [
  {
    label: 'Upload',
    body: 'Drop in a recording. It streams to the server with a live progress bar — you always know how much has landed.',
    detail: 'MP4 · MOV · MKV · WEBM, up to 4 GB',
  },
  {
    label: 'Transcribe',
    body: 'Whisper turns the audio into timestamped text on your own machine. No audio leaves it, and it costs nothing per minute.',
    detail: 'Runs locally',
  },
  {
    label: 'Index',
    body: 'The transcript is split into passages and embedded into a searchable index, so a question finds the right minute out of the whole hour.',
    detail: 'Runs locally',
  },
  {
    label: 'Ask',
    body: 'Claude reads only the passages that matched and answers from them, citing the timestamp behind every claim.',
    detail: 'Claude Sonnet 5',
  },
];

const QUALITIES = [
  {
    title: 'Answers you can check',
    body: 'Every claim carries the timestamp it came from. If the lecture never said it, the answer says so instead of guessing.',
  },
  {
    title: 'Search that reads meaning',
    body: 'Ask in your own words. Matching happens on meaning, not on whether you guessed the lecturer’s exact phrasing.',
  },
  {
    title: 'Cost you can see',
    body: 'Token counts and spend appear next to every answer, and repeat questions are served from cache for nothing.',
  },
];

export default function Features() {
  return (
    <>
      <section id="how" className="border-t border-line px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow mb-4">What happens to a recording</p>
          <h2 className="font-display text-display-lg text-ink mb-14 max-w-2xl">
            Four steps. Three of them never leave your machine.
          </h2>

          <ol className="space-y-0">
            {PIPELINE.map((step, index) => (
              <li
                key={step.label}
                className="grid gap-4 border-t border-line py-8 last:border-b sm:grid-cols-[4rem_10rem_minmax(0,1fr)] sm:gap-8"
              >
                <span className="font-mono text-sm text-signal">
                  {(index + 1).toString().padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-xl text-ink">{step.label}</h3>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-faint">
                    {step.detail}
                  </p>
                </div>
                <p className="leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow mb-4">What you get</p>
          <h2 className="font-display text-display-lg text-ink mb-14 max-w-2xl">
            A lecture you can interrogate.
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            {QUALITIES.map((quality) => (
              <div key={quality.title} className="border-l-2 border-signal/40 pl-5">
                <h3 className="font-display text-lg text-ink mb-2">{quality.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{quality.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
