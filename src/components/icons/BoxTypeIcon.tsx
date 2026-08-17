import type { BoxType } from "../../domain/boxes/types";

function StraightTuckCartonIcon() {
  return (
    <>
      <path d="M10 14 32 4l22 9-22 10-22-9Z" />
      <path d="M10 14v21l22 10 22-11V13M32 23v22" />
      <path d="m19 10 22 9 8-4M32 23l9-4" />
    </>
  );
}

function GiftBoxIcon() {
  return (
    <>
      <path d="M31 18V5l23 9 1 14" />
      <path d="m8 29 23-11 24 10-23 12L8 29Z" />
      <path d="M8 29v5l24 10 23-11v-5M32 40v4" />
    </>
  );
}

function TwoPieceGiftBoxIcon() {
  return (
    <>
      <path d="M11 10 32 2l21 8-21 9-21-9Z" />
      <path d="M11 10v4l21 9 21-9v-4M32 19v4" />
      <path d="m9 35 23-9 23 8-23 9-23-8Z" />
      <path d="M9 35v4l23 8 23-9v-4M32 43v4" />
    </>
  );
}

const ICON_DRAWINGS: Record<BoxType, () => React.JSX.Element> = {
  "straight-tuck-carton-v1": StraightTuckCartonIcon,
  "gift-box-v1": GiftBoxIcon,
  "two-piece-gift-box-v1": TwoPieceGiftBoxIcon,
};

export function BoxTypeIcon({ type, className }: { type: BoxType; className?: string }) {
  const Drawing = ICON_DRAWINGS[type];

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 64 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <Drawing />
      </g>
    </svg>
  );
}
