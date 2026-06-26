type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export function BrandMark({ className = "", iconClassName = "", textClassName = "" }: BrandMarkProps) {
  return (
    <span className={`brand-mark ${className}`}>
      <img aria-hidden="true" className={`brand-mark-icon ${iconClassName}`} src="/revealid.png" alt="" />
      <span className={`brand-mark-text ${textClassName}`}>RevealID</span>
    </span>
  );
}
