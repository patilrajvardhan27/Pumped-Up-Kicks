import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowRightIcon as PhArrowRight,
  ArrowsHorizontalIcon,
  BooksIcon,
  BrainIcon as PhBrain,
  ArrowLeftIcon as PhArrowLeft,
  CompassIcon,
  CookieIcon as PhCookie,
  FileTextIcon,
  ShieldCheckIcon,
  CaretDownIcon as PhCaretDown,
  CaretRightIcon,
  ChatCircleTextIcon,
  ChatsCircleIcon,
  CircleNotchIcon,
  CoinsIcon as PhCoins,
  ListIcon,
  MagnifyingGlassIcon,
  MonitorPlayIcon,
  PauseIcon as PhPause,
  PlayIcon as PhPlay,
  PlusIcon as PhPlus,
  SealCheckIcon,
  TargetIcon as PhTarget,
  TrashIcon as PhTrash,
  UploadSimpleIcon,
  WaveformIcon as PhWaveform,
  XIcon,
} from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

/*
 * Every glyph in the app comes from Phosphor and passes through here, so
 * there is one family, one default size and one place to swap an icon.
 * Controls use the bold weight; feature illustrations use duotone.
 */
function wrap(Glyph: Icon, weight: IconProps['weight'] = 'bold', extraClass?: string) {
  return function AppIcon({ className, ...rest }: IconProps) {
    return (
      <Glyph
        aria-hidden="true"
        weight={weight}
        className={cn('size-4 shrink-0', extraClass, className)}
        {...rest}
      />
    );
  };
}

// Controls
export const PlayIcon = wrap(PhPlay, 'fill');
export const PauseIcon = wrap(PhPause, 'fill');
export const CloseIcon = wrap(XIcon);
export const TrashIcon = wrap(PhTrash);
export const PlusIcon = wrap(PhPlus);
export const ArrowRightIcon = wrap(PhArrowRight);
export const ArrowLeftIcon = wrap(PhArrowLeft);
export const CookieIcon = wrap(PhCookie, 'duotone');
export const CaretDownIcon = wrap(PhCaretDown);
export const DisclosureIcon = wrap(CaretRightIcon);
export const MenuIcon = wrap(ListIcon);
export const DragIcon = wrap(ArrowsHorizontalIcon);
export const SpinnerIcon = wrap(CircleNotchIcon, 'bold', 'animate-spin');

// Features
export const UploadIcon = wrap(UploadSimpleIcon, 'duotone');
export const WaveformIcon = wrap(PhWaveform, 'duotone');
export const SearchIcon = wrap(MagnifyingGlassIcon, 'duotone');
export const AskIcon = wrap(ChatCircleTextIcon, 'duotone');
export const VerifiedIcon = wrap(SealCheckIcon, 'duotone');
export const MeaningIcon = wrap(PhBrain, 'duotone');
export const CostIcon = wrap(PhCoins, 'duotone');
export const AnswerIcon = wrap(PhTarget, 'duotone');
export const LibraryIcon = wrap(BooksIcon, 'duotone');
export const ChatsIcon = wrap(ChatsCircleIcon, 'duotone');
export const PreviewIcon = wrap(MonitorPlayIcon, 'duotone');
export const PrivacyIcon = wrap(ShieldCheckIcon, 'duotone');
export const TermsIcon = wrap(FileTextIcon, 'duotone');
export const LostIcon = wrap(CompassIcon, 'duotone');
