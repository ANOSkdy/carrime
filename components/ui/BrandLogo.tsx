import Image from 'next/image';

export const BrandLogo = () => (
  <Image
    src="/brand/carrime-logo.png"
    alt="Carrime"
    width={723}
    height={650}
    // Keep the logo inside the header even when global img rules override utilities.
    style={{ width: 49, height: 44, objectFit: 'contain', display: 'block', flexShrink: 0 }}
    priority
  />
);
