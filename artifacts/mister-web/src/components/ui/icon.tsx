import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
}

/**
 * Wrapper Lucide con default di brand:
 *   strokeWidth 1.75 · strokeLinecap/Linejoin "round" · size 20 · color currentColor
 *
 * Uso: <Icon icon={Trophy} /> oppure <Icon icon={Users} size={16} />
 */
export function Icon({
  icon: Ic,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.75,
  strokeLinecap = "round",
  strokeLinejoin = "round",
  ...rest
}: IconProps) {
  return (
    <Ic
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      {...rest}
    />
  );
}
