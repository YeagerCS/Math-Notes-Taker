import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 0 1 2.9 0l.5.5a2 2 0 0 1 0 2.9L8.6 18.8z" />
    <path d="M13.8 6.8l3.4 3.4" />
  </Icon>
);

export const HighlighterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 15l-3 3h-3l1.5-3" />
    <path d="M9 15l-2-2 9-9a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-9 9z" />
    <path d="M3 21h18" opacity="0.4" />
  </Icon>
);

export const EraserIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 20H20" />
    <path d="M4.6 15.6l9.9-9.9a2 2 0 0 1 2.8 0l2.9 2.9a2 2 0 0 1 0 2.8L12.3 19.3a2.4 2.4 0 0 1-3.4 0l-4.3-4.3a.4.4 0 0 1 0 .6z" />
    <path d="M8.2 12l5.6 5.6" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const RedoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Icon>
);

export const CloudCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z" />
    <path d="M9.5 13.2l1.8 1.8 3.5-3.5" />
  </Icon>
);

export const CloudAlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z" />
    <path d="M12 10.5v3M12 15.8v.1" />
  </Icon>
);

export const LassoIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="10" rx="8.5" ry="6" strokeDasharray="3.2 2.8" />
    <path d="M7.5 15.2c-1.2 1-1.6 2.6-.4 3.5 1.3 1 3-.2 2.4-1.6-.5-1.2-2.3-1-3 .2-.6 1.1-.3 2.4.3 3.4" />
  </Icon>
);

export const LineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 17.5l11-11" />
    <circle cx="5" cy="19" r="1.8" />
    <circle cx="19" cy="5" r="1.8" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11" />
    <path d="M7.5 11l4.5 4.5 4.5-4.5" />
    <path d="M5 19.5h14" />
  </Icon>
);
