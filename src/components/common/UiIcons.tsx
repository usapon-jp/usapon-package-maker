import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export function BoxIcon(props: IconProps) { return <Icon {...props}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></Icon>; }
export function EnvelopeIcon(props: IconProps) { return <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 7 8-7"/></Icon>; }
export function LetterIcon(props: IconProps) { return <Icon {...props}><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></Icon>; }
export function CardIcon(props: IconProps) { return <Icon {...props}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h5M7 14h8"/></Icon>; }
export function PlusIcon(props: IconProps) { return <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>; }
export function FolderIcon(props: IconProps) { return <Icon {...props}><path d="M3 7h7l2 2h9v10H3z"/></Icon>; }
export function SettingsIcon(props: IconProps) { return <Icon {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z"/></Icon>; }
export function EyeIcon(props: IconProps) { return <Icon {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></Icon>; }
export function SaveIcon(props: IconProps) { return <Icon {...props}><path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></Icon>; }
export function CopyIcon(props: IconProps) { return <Icon {...props}><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></Icon>; }
export function TrashIcon(props: IconProps) { return <Icon {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></Icon>; }
export function RotateIcon(props: IconProps) { return <Icon {...props}><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></Icon>; }
