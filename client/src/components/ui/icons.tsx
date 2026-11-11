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
 * Line style throughout (the regular weight), mono-tone, coloured by the text it sits in.
 */
function wrap(Glyph: Icon, weight: IconProps['weight'] = 'regular', extraClass?: string) {
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
export const CookieIcon = wrap(PhCookie);
export const CaretDownIcon = wrap(PhCaretDown);
export const DisclosureIcon = wrap(CaretRightIcon);
export const MenuIcon = wrap(ListIcon);
export const DragIcon = wrap(ArrowsHorizontalIcon);
export const SpinnerIcon = wrap(CircleNotchIcon, 'regular', 'animate-spin');
export const EditIcon = wrap(PencilSimpleIcon);
export const MoveUpIcon = wrap(PhArrowUp);
export const MoveDownIcon = wrap(PhArrowDown);
export const SidebarIcon = wrap(SidebarSimpleIcon);
export const ExternalIcon = wrap(ArrowSquareOutIcon);

// Features
export const UploadIcon = wrap(UploadSimpleIcon);
export const WaveformIcon = wrap(PhWaveform);
export const SearchIcon = wrap(MagnifyingGlassIcon);
export const AskIcon = wrap(ChatCircleTextIcon);
export const VerifiedIcon = wrap(SealCheckIcon);
export const MeaningIcon = wrap(PhBrain);
export const CostIcon = wrap(PhCoins);
export const AnswerIcon = wrap(PhTarget);
export const LibraryIcon = wrap(BooksIcon);
export const ChatsIcon = wrap(ChatsCircleIcon);
export const PreviewIcon = wrap(MonitorPlayIcon);
export const PrivacyIcon = wrap(ShieldCheckIcon);
export const TermsIcon = wrap(FileTextIcon);
export const LostIcon = wrap(CompassIcon);
export const AllLecturesIcon = wrap(StackIcon);
export const UnsortedIcon = wrap(TrayIcon);
export const CanvasIcon = wrap(GraduationCapIcon);
export const DeadlineIcon = wrap(CalendarBlankIcon);

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
