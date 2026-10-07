import { MenuBar } from '@/components/shell/MenuBar';
import { ButtonLink } from '@/components/ui/Button';
import { CaretDownIcon, MenuIcon } from '@/components/ui/icons';
import { ServerStatus } from '@/components/workspace/ServerStatus';
import { NavMenu } from './NavMenu';
import { SECTION_ITEMS } from './nav-data';

const LINK =
  'inline-flex h-9 items-center rounded-md px-2.5 text-body-xs font-semibold text-ink transition-transform hover:bg-surface-soft active:scale-95';

export function LandingMenuBar() {
  return (
    <MenuBar
      actions={
        <>
          <div className="hidden sm:block">
            <ServerStatus compact />
          </div>
          <ButtonLink href="/app" size="sm" data-track="nav-open-workspace">
            <span className="sm:hidden">Open</span>
            <span className="hidden sm:inline">Open the workspace</span>
          </ButtonLink>
          <div className="md:hidden">
            <NavMenu
              label="Menu"
              align="end"
              menu="all"
              trigger={<MenuIcon className="size-5" />}
              triggerClassName="px-2"
            />
          </div>
        </>
      }
    >
      <nav aria-label="Sections" className="hidden items-center gap-0.5 md:flex">
        <NavMenu
          label="How it works"
          menu="pipeline"
          trigger={
            <>
              How it works
              <CaretDownIcon className="size-3" />
            </>
          }
        />
        {SECTION_ITEMS.map((item) => (
          <a key={item.href} href={item.href} className={LINK}>
            {item.label}
          </a>
        ))}
      </nav>
    </MenuBar>
  );
}
