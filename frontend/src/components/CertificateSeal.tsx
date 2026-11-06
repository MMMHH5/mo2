import Image from 'next/image';

export type CertificateSealShape = 'round' | 'rosette' | 'square' | 'ribbon' | 'minimal';

type Props = {
    logoUrl: string;
    text: string;
    color: string;
    fillColor: string;
    shape: CertificateSealShape;
    borderStyle: 'double' | 'solid' | 'dashed';
    size: number;
};

const shapeStyles: Record<CertificateSealShape, { borderRadius: string; clipPath?: string }> = {
    round: { borderRadius: '50%' },
    rosette: { borderRadius: '0', clipPath: 'polygon(50% 0%, 61% 7%, 75% 4%, 82% 16%, 96% 25%, 93% 39%, 100% 50%, 93% 61%, 96% 75%, 82% 84%, 75% 96%, 61% 93%, 50% 100%, 39% 93%, 25% 96%, 18% 84%, 4% 75%, 7% 61%, 0% 50%, 7% 39%, 4% 25%, 18% 16%, 25% 4%, 39% 7%)' },
    square: { borderRadius: '12%' },
    ribbon: { borderRadius: '8% 8% 45% 45%' },
    minimal: { borderRadius: '50%' },
};

export default function CertificateSeal({ logoUrl, text, color, fillColor, shape, borderStyle, size }: Props) {
    const shapeStyle = shapeStyles[shape];
    const inset = Math.max(3, size * 0.07);
    const logoSize = size * 0.36;

    return (
        <div
            aria-label={text}
            className="relative flex shrink-0 items-center justify-center"
            style={{
                width: size,
                height: size,
                color,
                ...shapeStyle,
                border: `${shape === 'minimal' ? 2 : 3}px ${borderStyle} currentColor`,
                background: fillColor,
            }}
        >
            {shape !== 'minimal' && (
                <div
                    className="absolute"
                    style={{
                        inset,
                        border: '1px solid currentColor',
                        borderRadius: shape === 'round' ? '50%' : 'inherit',
                        opacity: 0.72,
                    }}
                />
            )}
            {shape === 'ribbon' && (
                <div
                    className="absolute"
                    style={{
                        left: '12%',
                        right: '12%',
                        bottom: '14%',
                        height: '16%',
                        background: color,
                        opacity: 0.16,
                    }}
                />
            )}
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-[3%] px-[12%] py-[10%] text-center">
                <Image
                    src={logoUrl}
                    alt=""
                    width={240}
                    height={240}
                    unoptimized
                    className="object-contain"
                    style={{ width: logoSize, height: logoSize * 0.72 }}
                />
                <span
                    className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-black uppercase tracking-[0.12em]"
                    style={{ fontSize: Math.max(6, size * 0.075), lineHeight: 1.15 }}
                >
                    {text}
                </span>
                <span
                    className="font-bold tracking-[0.16em]"
                    style={{ fontSize: Math.max(5, size * 0.055), lineHeight: 1 }}
                >
                    LAXALAB • ACADEMY
                </span>
            </div>
        </div>
    );
}
