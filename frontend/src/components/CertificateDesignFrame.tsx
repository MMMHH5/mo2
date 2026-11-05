export type CertificateDesign =
    | 'classic'
    | 'royal'
    | 'modern'
    | 'minimal'
    | 'artDeco'
    | 'geometric'
    | 'botanical'
    | 'academic'
    | 'heritage'
    | 'ribbon'
    | 'wave'
    | 'mosaic';

type Props = {
    design: CertificateDesign;
    primaryColor: string;
    accentColor: string;
};

export const CERTIFICATE_DESIGNS: Array<{ id: CertificateDesign; nameAr: string; nameEn: string }> = [
    { id: 'classic', nameAr: 'كلاسيكي', nameEn: 'Classic' },
    { id: 'royal', nameAr: 'ملكي', nameEn: 'Royal' },
    { id: 'modern', nameAr: 'عصري', nameEn: 'Modern' },
    { id: 'minimal', nameAr: 'بسيط أنيق', nameEn: 'Minimal' },
    { id: 'artDeco', nameAr: 'آرت ديكو', nameEn: 'Art Deco' },
    { id: 'geometric', nameAr: 'هندسي', nameEn: 'Geometric' },
    { id: 'botanical', nameAr: 'نباتي', nameEn: 'Botanical' },
    { id: 'academic', nameAr: 'أكاديمي', nameEn: 'Academic' },
    { id: 'heritage', nameAr: 'تراثي', nameEn: 'Heritage' },
    { id: 'ribbon', nameAr: 'وسام', nameEn: 'Ribbon' },
    { id: 'wave', nameAr: 'موجي', nameEn: 'Wave' },
    { id: 'mosaic', nameAr: 'فسيفساء', nameEn: 'Mosaic' },
];

export default function CertificateDesignFrame({ design, primaryColor, accentColor }: Props) {
    const accentLine = `linear-gradient(90deg, transparent, ${accentColor}, transparent)`;

    return (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
            {design === 'royal' && (
                <div className="absolute border-2" style={{ inset: '3.2%', borderColor: `${accentColor}99` }} />
            )}
            {design === 'modern' && (
                <>
                    <div className="absolute inset-y-0 left-0 w-[2.4%]" style={{ backgroundColor: primaryColor }} />
                    <div className="absolute inset-y-0 left-[2.4%] w-[0.45%]" style={{ backgroundColor: accentColor }} />
                    <div className="absolute bottom-0 right-0 h-[1.4%] w-[22%]" style={{ backgroundColor: accentColor }} />
                </>
            )}
            {design === 'minimal' && (
                <>
                    <div className="absolute inset-x-[5%] top-[4%] h-[2px]" style={{ background: accentLine }} />
                    <div className="absolute inset-x-[5%] bottom-[4%] h-[2px]" style={{ background: accentLine }} />
                </>
            )}
            {design === 'artDeco' && (
                <>
                    <div className="absolute left-[3%] top-[3%] h-[11%] w-[9%] border-l-2 border-t-2" style={{ borderColor: accentColor }} />
                    <div className="absolute right-[3%] top-[3%] h-[11%] w-[9%] border-r-2 border-t-2" style={{ borderColor: accentColor }} />
                    <div className="absolute bottom-[3%] left-[3%] h-[11%] w-[9%] border-b-2 border-l-2" style={{ borderColor: accentColor }} />
                    <div className="absolute bottom-[3%] right-[3%] h-[11%] w-[9%] border-b-2 border-r-2" style={{ borderColor: accentColor }} />
                    <div className="absolute inset-y-[5%] left-1/2 w-px opacity-30" style={{ backgroundColor: accentColor }} />
                </>
            )}
            {design === 'geometric' && (
                <>
                    {[['left-[4%]', 'top-[5%]'], ['right-[4%]', 'top-[5%]'], ['left-[4%]', 'bottom-[5%]'], ['right-[4%]', 'bottom-[5%]']].map(([x, y]) => (
                        <div key={`${x}-${y}`} className={`absolute h-5 w-5 rotate-45 border-2 ${x} ${y}`} style={{ borderColor: accentColor }} />
                    ))}
                </>
            )}
            {design === 'botanical' && (
                <>
                    {['left-[4%] top-[5%]', 'right-[4%] top-[5%]', 'left-[4%] bottom-[5%]', 'right-[4%] bottom-[5%]'].map((position) => (
                        <div key={position} className={`absolute h-10 w-10 rounded-full border opacity-60 ${position}`} style={{ borderColor: accentColor, boxShadow: `inset 8px 0 0 -7px ${accentColor}, inset -8px 0 0 -7px ${accentColor}` }} />
                    ))}
                </>
            )}
            {design === 'academic' && (
                <>
                    <div className="absolute inset-y-[12%] left-[4%] w-[1px]" style={{ backgroundColor: `${primaryColor}55` }} />
                    <div className="absolute inset-y-[12%] right-[4%] w-[1px]" style={{ backgroundColor: `${primaryColor}55` }} />
                    <div className="absolute inset-x-[14%] top-[7%] h-px" style={{ background: accentLine }} />
                </>
            )}
            {design === 'heritage' && (
                <>
                    <div className="absolute left-1/2 top-[2.5%] h-10 w-10 -translate-x-1/2 rotate-45 border-2 bg-white/70" style={{ borderColor: accentColor }} />
                    <div className="absolute inset-x-[18%] top-[8%] h-px" style={{ background: accentLine }} />
                </>
            )}
            {design === 'ribbon' && (
                <>
                    <div className="absolute right-[4%] top-0 h-[17%] w-[5%]" style={{ backgroundColor: accentColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }} />
                    <div className="absolute left-[4%] top-0 h-[17%] w-[5%]" style={{ backgroundColor: primaryColor, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)' }} />
                </>
            )}
            {design === 'wave' && (
                <svg className="absolute inset-x-0 bottom-0 h-[10%] w-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
                    <path d="M0,42 C180,0 300,78 500,38 C690,0 810,72 1000,30 L1000,80 L0,80 Z" fill={accentColor} fillOpacity="0.22" />
                    <path d="M0,53 C180,12 300,86 500,48 C690,10 810,80 1000,40" fill="none" stroke={primaryColor} strokeOpacity="0.6" strokeWidth="2" />
                </svg>
            )}
            {design === 'mosaic' && (
                <>
                    {Array.from({ length: 5 }, (_, index) => (
                        <span key={index} className="absolute top-[4%] h-2 w-2 rotate-45" style={{ left: `${40 + index * 4}%`, backgroundColor: index % 2 ? accentColor : primaryColor }} />
                    ))}
                    <div className="absolute inset-x-[7%] bottom-[4%] h-[2px]" style={{ background: accentLine }} />
                </>
            )}
        </div>
    );
}
