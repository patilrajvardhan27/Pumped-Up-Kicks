import { AskIcon, SearchIcon, UploadIcon, WaveformIcon } from '@/components/ui/icons';
import { Reveal } from './Reveal';

/* A real ordered sequence, so it is an ordered list on a connected rail. */
const PIPELINE = [
  {
    id: 'step-upload',
    Icon: UploadIcon,
    label: 'Upload',
    detail: 'MP4, MOV, MKV, WEBM, up to 4 GB',
    body: 'Drop in a recording. A live progress bar shows exactly how much has landed.',
  },
  {
    id: 'step-transcribe',
    Icon: WaveformIcon,
    label: 'Transcribe',
    detail: 'Open-source Whisper',
    body: 'Whisper turns the audio into text, with a timestamp on every segment.',
  },
  {
    id: 'step-index',
    Icon: SearchIcon,
    label: 'Index',
    detail: 'Search by meaning',
    body: 'The transcript is split into passages and embedded, so a question finds the right minute of the hour.',
  },
  {
    id: 'step-ask',
    Icon: AskIcon,
    label: 'Ask',
    detail: 'Answered by Claude',
    body: 'Claude reads only the passages that matched and cites the timestamp behind every claim.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="section-y scroll-mt-6 px-4 sm:px-8">
      <h2 id="how-heading" className="text-display-lg text-ink">
        Four steps from recording to answer.
      </h2>

      <Reveal as="ol" stagger className="mt-8 grid gap-x-4 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE.map(({ id, Icon, label, detail, body }) => (
          <li
            key={id}
            id={id}
            className="group/step relative flex scroll-mt-6 gap-4 pb-8 md:flex-col md:gap-0 md:pb-10 xl:pb-0"
          >
            {/* Rail: vertical beside the steps on phones, horizontal above them on desktop. */}
            <div aria-hidden="true" className="flex shrink-0 flex-col items-center md:mb-5 md:flex-row">
              <span className="flex size-11 items-center justify-center rounded-md bg-surface-dark text-on-dark transition-transform group-hover/step:-translate-y-1 group-hover/step:text-primary">
                <Icon className="size-6" />
              </span>
              <span className="w-px flex-1 bg-hairline md:h-px md:w-auto" />
            </div>
            <div className="flex min-w-0 flex-col gap-1 md:pr-6">
              <h3 className="text-heading-sm text-ink">{label}</h3>
              <p className="text-caption-sm text-mute-strong">{detail}</p>
              <p className="mt-1 text-body-sm text-body">{body}</p>
            </div>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
