type EditorialEmailTemplateVariant =
  | "exchange"
  | "correspondence"
  | "security"
  | "resolution"

export type EditorialEmailTemplateProps = {
  variant: EditorialEmailTemplateVariant
  logoSrc?: string
  preheader: string
  dispatchLabel: string
  eyebrow: string
  title: string
  greeting?: string
  lead: string
  body?: string[]
  ctaLabel: string
  ctaUrl: string
  secondaryLabel?: string
  secondaryUrl?: string
  spotlightLabel?: string
  spotlightValue?: string
  footerTagline: string
  footerDetails?: string[]
}

const VARIANT_STYLES: Record<
  EditorialEmailTemplateVariant,
  {
    heroBackground: string
    heroFallback: string
    accent: string
    accentSoft: string
    spotlightBackground: string
  }
> = {
  exchange: {
    heroBackground: "#1c1c1c",
    heroFallback: "#1c1c1c",
    accent: "#d8ba72",
    accentSoft: "#f4e4bc",
    spotlightBackground: "#18130f",
  },
  correspondence: {
    heroBackground: "#1c1c1c",
    heroFallback: "#1c1c1c",
    accent: "#d6b46c",
    accentSoft: "#efe0b8",
    spotlightBackground: "#171311",
  },
  security: {
    heroBackground: "#1c1c1c",
    heroFallback: "#1c1c1c",
    accent: "#e0bf7b",
    accentSoft: "#f7e8c3",
    spotlightBackground: "#191313",
  },
  resolution: {
    heroBackground: "#1c1c1c",
    heroFallback: "#1c1c1c",
    accent: "#d8ba72",
    accentSoft: "#f2e1b6",
    spotlightBackground: "#18140f",
  },
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const renderParagraph = (value: string, fontSize: number, color: string): string =>
  `<p style="margin:0 0 16px;color:${color};font-size:${fontSize}px;line-height:1.7;">${escapeHtml(value)}</p>`

export const renderEditorialEmailTemplate = (
  params: EditorialEmailTemplateProps
): string => {
  const styles = VARIANT_STYLES[params.variant]
  const bodyParagraphs = (params.body ?? []).filter(Boolean)

  const greetingHtml = params.greeting
    ? renderParagraph(params.greeting, 16, "#f6ead1")
    : ""

  const logoHtml = params.logoSrc
    ? `
        <div style="margin:0 0 12px;text-align:center;">
          <img
            src="${escapeHtml(params.logoSrc)}"
            alt="Perfumer's Hollow"
            width="164"
            style="display:inline-block;width:164px;max-width:100%;height:auto;border:0;"
          />
        </div>
      `
    : ""

  const spotlightHtml =
    params.spotlightLabel && params.spotlightValue
      ? `
        <tr>
          <td style="padding:0 32px 24px;">
            <table
              role="presentation"
              cellpadding="0"
              cellspacing="0"
              width="100%"
              style="border:1px solid #4c3b1f;background:${styles.spotlightBackground};border-radius:12px;"
            >
              <tr>
                <td style="padding:16px 18px;">
                  <div style="margin:0 0 8px;color:${styles.accent};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">
                    ${escapeHtml(params.spotlightLabel)}
                  </div>
                  <div style="color:${styles.accentSoft};font-family:Georgia, 'Times New Roman', serif;font-size:22px;line-height:1.35;font-weight:700;">
                    ${escapeHtml(params.spotlightValue)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : ""

  const secondaryHtml =
    params.secondaryLabel && params.secondaryUrl
      ? `
        <tr>
          <td style="padding:0 32px 28px;">
            <a
              href="${escapeHtml(params.secondaryUrl)}"
              style="color:${styles.accent};font-size:14px;line-height:1.5;text-decoration:underline;"
            >
              ${escapeHtml(params.secondaryLabel)}
            </a>
          </td>
        </tr>
      `
      : ""

  const footerDetailsHtml = (params.footerDetails ?? [])
    .filter(Boolean)
    .map(
      line =>
        `<p style="margin:0 0 8px;color:#9f8f6d;font-size:12px;line-height:1.6;">${escapeHtml(line)}</p>`
    )
    .join("")

  return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0d0b0a;font-family:Inter, Arial, sans-serif;">
    <div
      style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;"
    >
      ${escapeHtml(params.preheader)}
    </div>

    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      width="100%"
      style="background:#0d0b0a;margin:0;padding:24px 0;"
    >
      <tr>
        <td align="center" style="padding:0 12px;">
          <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            width="100%"
            style="max-width:640px;background:#1c1c1c;border:1px solid #5c4724;border-radius:18px;overflow:hidden;"
          >
            <tr>
              <td
                style="padding:20px 32px 24px;background:${styles.heroBackground};background-color:${styles.heroFallback};border-bottom:1px solid #3a2d18;"
              >
                ${logoHtml}
                <div
                  style="margin:0 0 18px;color:${styles.accent};font-size:11px;letter-spacing:0.24em;text-transform:uppercase;"
                >
                  ${escapeHtml(params.dispatchLabel)}
                </div>
                <div
                  style="margin:0;color:${styles.accentSoft};font-family:Georgia, 'Times New Roman', serif;font-size:30px;line-height:1.1;font-weight:700;"
                >
                  Perfumer&#39;s Hollow
                </div>
                <div
                  style="margin-top:12px;width:80px;border-top:1px solid ${styles.accent};"
                ></div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px 10px;">
                <div
                  style="margin:0 0 12px;color:${styles.accent};font-size:12px;letter-spacing:0.22em;text-transform:uppercase;"
                >
                  ${escapeHtml(params.eyebrow)}
                </div>
                <h1
                  style="margin:0 0 18px;color:${styles.accentSoft};font-family:Georgia, 'Times New Roman', serif;font-size:34px;line-height:1.2;font-weight:700;"
                >
                  ${escapeHtml(params.title)}
                </h1>
                ${greetingHtml}
                ${renderParagraph(params.lead, 17, "#eadcc1")}
                ${bodyParagraphs
                  .map(paragraph => renderParagraph(paragraph, 16, "#d7ccb4"))
                  .join("")}
              </td>
            </tr>

            ${spotlightHtml}

            <tr>
              <td style="padding:0 32px 18px;">
                <a
                  href="${escapeHtml(params.ctaUrl)}"
                  style="display:inline-block;padding:14px 20px;border-radius:10px;background:${styles.accent};color:#17120d;font-size:15px;line-height:1;text-decoration:none;font-weight:700;"
                >
                  ${escapeHtml(params.ctaLabel)}
                </a>
              </td>
            </tr>

            ${secondaryHtml}

            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid #312617;">
                <p
                  style="margin:0 0 10px;color:${styles.accent};font-size:12px;line-height:1.6;letter-spacing:0.1em;text-transform:uppercase;"
                >
                  ${escapeHtml(params.footerTagline)}
                </p>
                ${footerDetailsHtml}
                <p style="margin:0;color:#7f7358;font-size:12px;line-height:1.6;">
                  Sent by perfumer&#39;s hollow
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
