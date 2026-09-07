import { NextRequest, NextResponse } from 'next/server';

type Locale = 'ar' | 'en';

const LOCALE_COOKIE = 'laxalab_locale';
const DEFAULT_LOCALE: Locale = 'ar';
const SKIP_PATHS = ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/favicon.ico'];
const EXT_RE = /\.(png|jpe?g|svg|gif|webp|ico|avif|woff2?|ttf|eot|otf|pdf|mp4|webm)$/i;

function getPreferredLocale(req: NextRequest): Locale {
    const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
    if (cookie === 'ar' || cookie === 'en') return cookie;
    const accept = req.headers.get('accept-language')?.toLowerCase() || '';
    if (accept.startsWith('en')) return 'en';
    return DEFAULT_LOCALE;
}

function setLocaleCookie(res: NextResponse, locale: Locale) {
    res.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
    });
}

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Never touch API routes, Next internals or static files.
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || SKIP_PATHS.includes(pathname) || EXT_RE.test(pathname)) {
        return NextResponse.next();
    }

    const first = pathname.split('/')[1];
    const hasPrefix = first === 'ar' || first === 'en';

    if (hasPrefix) {
        const locale = first as Locale;
        const url = req.nextUrl.clone();
        url.pathname = pathname.slice(locale.length + 1) || '/';
        const res = NextResponse.rewrite(url);
        setLocaleCookie(res, locale);
        return res;
    }

    // No locale prefix: redirect to the canonical locale-prefixed URL (308 permanent).
    const locale = getPreferredLocale(req);
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    const res = NextResponse.redirect(url, 308);
    setLocaleCookie(res, locale);
    return res;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};