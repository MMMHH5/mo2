import { NextRequest, NextResponse } from 'next/server';

type Locale = 'ar' | 'en';

// Versioned on purpose. The previous name (`laxalab_locale`) is still sitting
// in every returning visitor's browser, written by the old Accept-Language
// sniffing, and it carries a `max-age` of a year. Honouring it would keep
// sending the entire existing audience to /en even though Arabic is now the
// primary language, so the old key is deliberately ignored and the new default
// applies once. From here on an explicit choice is what selects the language.
const LOCALE_COOKIE = 'laxalab_locale_v2';
const DEFAULT_LOCALE: Locale = 'ar';
const SKIP_PATHS = ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/favicon.ico'];
const EXT_RE = /\.(png|jpe?g|svg|gif|webp|ico|avif|woff2?|ttf|eot|otf|pdf|mp4|webm)$/i;

function getPreferredLocale(req: NextRequest): Locale {
    // Arabic is the primary language, so the only thing that may select
    // English is the visitor having explicitly chosen it. This used to fall
    // back to the browser's Accept-Language header, which sent every visitor
    // whose OS or Chrome UI is English to /en and made the platform read as
    // English-first despite `x-default`, the sitemap and the metadata all
    // pointing at Arabic.
    const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
    if (cookie === 'ar' || cookie === 'en') return cookie;
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