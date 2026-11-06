import Image from 'next/image';

interface BrandLogoProps {
  className?: string;
}

export const BrandLogo = ({ className }: BrandLogoProps) => (
  <Image
    src="/brand/carrime-logo.png"
    alt="Carrime"
    width={723}
    height={650}
    className={className}
    priority
  />
);
