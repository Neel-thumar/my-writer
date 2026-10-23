/** Small stroke icons (16px by default) so the UI doesn't depend on emoji. */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: string[]) {
  return function Icon({ size = 16, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    );
  };
}

export const HomeIcon = make(["M3 10.5 12 3l9 7.5", "M5 9.5V20h14V9.5"]);
export const FolderIcon = make(["M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"]);
export const DocIcon = make(["M7 3h7l5 5v13H7z", "M14 3v5h5", "M10 13h6", "M10 17h6"]);
export const PlusIcon = make(["M12 5v14", "M5 12h14"]);
export const SearchIcon = make(["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "m20 20-4-4"]);
export const SettingsIcon = make([
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
]);
export const TrashIcon = make(["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"]);
export const SunIcon = make(["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 1v2", "M12 21v2", "M4.2 4.2l1.4 1.4", "M18.4 18.4l1.4 1.4", "M1 12h2", "M21 12h2", "M4.2 19.8l1.4-1.4", "M18.4 5.6l1.4-1.4"]);
export const MoonIcon = make(["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"]);
export const SparkleIcon = make(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"]);
export const CheckIcon = make(["M20 6 9 17l-5-5"]);
export const XIcon = make(["M18 6 6 18", "M6 6l12 12"]);
export const MoreIcon = make(["M5 12h.01", "M12 12h.01", "M19 12h.01"]);
export const ChevronDownIcon = make(["m6 9 6 6 6-6"]);
export const ChevronRightIcon = make(["m9 6 6 6-6 6"]);
export const PanelLeftIcon = make(["M4 4h16v16H4z", "M9 4v16"]);
export const PanelRightIcon = make(["M4 4h16v16H4z", "M15 4v16"]);
export const HistoryIcon = make(["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"]);
export const DownloadIcon = make(["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"]);
export const UploadIcon = make(["M12 21V9", "m7 14 5-5 5 5", "M5 3h14"]);
export const FocusIcon = make(["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"]);
export const WandIcon = make(["m15 4 5 5", "M3 21l12-12", "M18 2v2", "M22 6h-2", "M12 3v1"]);
export const TagIcon = make(["M3 12V3h9l9 9-9 9z", "M7.5 7.5h.01"]);
export const UndoIcon = make(["M9 14 4 9l5-5", "M4 9h11a5 5 0 0 1 0 10h-3"]);
export const RedoIcon = make(["m15 14 5-5-5-5", "M20 9H9a5 5 0 0 0 0 10h3"]);
export const BoltIcon = make(["M13 2 4 14h7l-1 8 9-12h-7z"]);
export const CopyIcon = make(["M8 8h12v12H8z", "M16 8V4H4v12h4"]);
export const PencilIcon = make(["M4 20h4L19 9l-4-4L4 16z", "m14 6 4 4"]);
export const SaveIcon = make(["M5 3h11l3 3v15H5z", "M8 3v5h7", "M8 21v-7h8v7"]);
