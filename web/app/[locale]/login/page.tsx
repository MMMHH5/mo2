import { notFound } from "next/navigation";

import { getDictionary } from "@/lib/i18n";
import { isLocale } from "@/lib/locales";

import { SignIn } from "./sign-in";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <SignIn locale={locale} dictionary={getDictionary(locale)} />;
}
