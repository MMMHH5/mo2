"use client";

import Image from 'next/image';
import { useTheme } from '@/lib/theme-context';

type BrandLogoProps = {
    className: string;
    variant?: 'horizontal' | 'stacked' | 'mark';
    dark?: boolean;
    alt?: string;
};

export default function BrandLogo({
    className,
    variant = 'horizontal',
    dark: darkOverride,
    alt = 'LaxaLab Academy',
}: BrandLogoProps) {
    const { dark: themeDark } = useTheme();
    const isDark = darkOverride ?? themeDark;

    if (variant === 'mark') {
        return (
            <Image
                src="/icons/app-icon.svg"
                alt={alt}
                width={512}
                height={512}
                className={className}
            />
        );
    }

    const src = variant === 'stacked'
        ? isDark
            ? '/logos/LaxaLab_Academy_Stacked_Reverse_4K.png'
            : '/logos/LaxaLab_Academy_Stacked_Primary_4K.png'
        : isDark
            ? '/logos/LaxaLab_Academy_Horizontal_Reverse_4K.png'
            : '/logos/LaxaLab_Academy_Horizontal_Primary_4K.png';

    return (
        <Image
            src={src}
            alt={alt}
            width={4096}
            height={variant === 'stacked' ? 1693 : 822}
            className={className}
        />
    );
}
