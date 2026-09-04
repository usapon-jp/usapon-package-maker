import type { BoxType } from "../../domain/boxes/types";

type Illustration = {
  src: string;
  viewBox: string;
};

const ILLUSTRATIONS: Partial<Record<BoxType, Illustration>> = {
  "straight-tuck-carton-v1": { src: "/assets/box-caramel.png", viewBox: "120 120 760 920" },
  "gift-box-v1": { src: "/assets/box-shallow.png", viewBox: "950 300 850 700" },
  "two-piece-gift-box-v1": { src: "/assets/box-two-piece.png", viewBox: "450 1070 900 680" },
};

export function BoxTypeIcon({ type, className }: { type: BoxType; className?: string }) {
  const illustration = ILLUSTRATIONS[type] ?? ILLUSTRATIONS["gift-box-v1"]!;

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={illustration.viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={illustration.src} width="2048" height="2048" />
    </svg>
  );
}
