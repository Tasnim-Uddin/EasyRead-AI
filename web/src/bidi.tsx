import type { ReactNode } from "react";
import { isFallback, t } from "./i18n";

/** English fallback text is rendered left-to-right even on an RTL page; translated text is left alone. */
function Wrap({ fallback, children }: { fallback: boolean; children: ReactNode }) {
  return fallback ? (
    <span dir="ltr" lang="en">
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}

/** A number or other interpolated value that must not be reordered by surrounding RTL text. */
export const Num = ({ children }: { children: ReactNode }) => <bdi>{children}</bdi>;

/** A plain UI string. */
export const T = ({ lang, k }: { lang: string; k: string }) => <Wrap fallback={isFallback(lang, k)}>{t(lang, k)}</Wrap>;

/** "1 of 9" */
export const Counter = ({ lang, n, total }: { lang: string; n: number; total: number }) => (
  <Wrap fallback={isFallback(lang, "of")}>
    <Num>{n}</Num> {t(lang, "of")} <Num>{total}</Num>
  </Wrap>
);

/** "Tool calls (3)" */
export const Counted = ({ lang, k, count }: { lang: string; k: string; count: number }) => (
  <Wrap fallback={isFallback(lang, k)}>
    {t(lang, k)} (<Num>{count}</Num>)
  </Wrap>
);

/** "3 steps" */
export const CountThen = ({ lang, k, count }: { lang: string; k: string; count: number }) => (
  <Wrap fallback={isFallback(lang, k)}>
    <Num>{count}</Num> {t(lang, k)}
  </Wrap>
);
