import { useT } from '@app/hooks/useT';
import { type ILocalFolder } from '@shared/types/Preferences';
import { DetailRow } from '@ui/components/DetailList';
import { Button } from '@ui/primitives/button';

interface IFolderRowProps {
  label: string;
  folder: ILocalFolder;
  onOpen: () => void;
}

/** A place on disk: its path, and the button that opens it or, where that cannot be done, copies the path. */
export function FolderRow({ label, folder, onOpen }: IFolderRowProps) {
  const t = useT();

  return (
    <DetailRow
      label={label}
      description={<span className="break-all select-text">{folder.path}</span>}
    >
      <Button size="sm" variant="secondary" onClick={onOpen}>
        {folder.canOpen ? t.settings.openFolder : t.settings.copyPath}
      </Button>
    </DetailRow>
  );
}
