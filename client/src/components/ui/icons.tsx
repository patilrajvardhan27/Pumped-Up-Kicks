import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowRightIcon as PhArrowRight,
  ArrowsHorizontalIcon,
  ArrowDownIcon as PhArrowDown,
  ArrowUpIcon as PhArrowUp,
  AtomIcon,
  BookOpenIcon,
  BooksIcon,
  BrainIcon as PhBrain,
  ArrowLeftIcon as PhArrowLeft,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  CalendarBlankIcon,
  ChartLineIcon,
  ClipboardTextIcon,
  CodeIcon as PhCode,
  CompassIcon,
  DnaIcon,
  FileDocIcon,
  FilePdfIcon,
  FlaskIcon,
  FunctionIcon,
  GlobeHemisphereWestIcon,
  GraduationCapIcon,
  MegaphoneIcon,
  MusicNotesIcon,
  PaletteIcon,
  PencilSimpleIcon,
  PresentationIcon,
  ScalesIcon,
  SidebarSimpleIcon,
  StackIcon,
  TrayIcon,
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
export const EditIcon = wrap(PencilSimpleIcon);
export const MoveUpIcon = wrap(PhArrowUp);
export const MoveDownIcon = wrap(PhArrowDown);
export const SidebarIcon = wrap(SidebarSimpleIcon);
export const ExternalIcon = wrap(ArrowSquareOutIcon);
export const SyncIcon = wrap(ArrowsClockwiseIcon);

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
export const AllLecturesIcon = wrap(StackIcon, 'duotone');
export const UnsortedIcon = wrap(TrayIcon, 'duotone');
export const CanvasIcon = wrap(GraduationCapIcon, 'duotone');
export const DeadlineIcon = wrap(CalendarBlankIcon, 'duotone');

// Kinds of imported course material.
export const PdfIcon = wrap(FilePdfIcon);
export const SlidesIcon = wrap(PresentationIcon);
export const WordIcon = wrap(FileDocIcon);
export const PageIcon = wrap(FileTextIcon);
export const AnnouncementIcon = wrap(MegaphoneIcon);
export const AssignmentIcon = wrap(ClipboardTextIcon);

// Subject icons, drawn white on the subject's colour tile.
export const SubjectBookIcon = wrap(BookOpenIcon);
export const SubjectFlaskIcon = wrap(FlaskIcon);
export const SubjectFunctionIcon = wrap(FunctionIcon);
export const SubjectCodeIcon = wrap(PhCode);
export const SubjectGlobeIcon = wrap(GlobeHemisphereWestIcon);
export const SubjectAtomIcon = wrap(AtomIcon);
export const SubjectDnaIcon = wrap(DnaIcon);
export const SubjectChartIcon = wrap(ChartLineIcon);
export const SubjectPaletteIcon = wrap(PaletteIcon);
export const SubjectMusicIcon = wrap(MusicNotesIcon);
export const SubjectScalesIcon = wrap(ScalesIcon);
export const SubjectBrainIcon = wrap(PhBrain);
