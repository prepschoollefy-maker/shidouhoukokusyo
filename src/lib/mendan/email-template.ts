export function buildMendanHtmlEmail(
  studentName: string,
  periodLabel: string,
  requestUrl: string,
  expiresAt: string,
  schoolName: string,
  signature: string,
  customBody?: string
): string {
  const expiresDate = new Date(expiresAt)
  const expiresStr = `${expiresDate.getFullYear()}年${expiresDate.getMonth() + 1}月${expiresDate.getDate()}日`

  // Build body HTML from custom or default text
  let bodyHtml: string
  if (customBody) {
    const replaced = customBody
      .replace(/\{生徒名\}/g, studentName)
      .replace(/\{期間\}/g, periodLabel)
    bodyHtml = replaced.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('\n        ')
  } else {
    bodyHtml = `<p>保護者様</p>
        <p>${studentName}さんの${periodLabel}の面談日程についてご案内いたします。</p>
        <p>下記のボタンより、面談のご希望日時を3つお選びください。</p>`
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#3b82f6);border-radius:12px 12px 0 0;padding:24px 28px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">${schoolName}</p>
      <h1 style="margin:6px 0 0;font-size:20px;color:#fff;font-weight:bold;">面談のご案内</h1>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:14px;line-height:1.8;color:#333;">
        ${bodyHtml}
        <p style="font-size:13px;color:#666;">※ 回答期限: ${expiresStr}</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0 16px;">
        <a href="${requestUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:bold;">
          面談希望日を入力する
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#999;margin:0;">上のボタンが表示されない場合: <a href="${requestUrl}" style="color:#4f46e5;">${requestUrl}</a></p>
    </div>

    <!-- Footer -->
    <div style="padding:20px;text-align:center;">
      <p style="font-size:12px;color:#999;white-space:pre-wrap;margin:0;">${signature}</p>
    </div>
  </div>
</body>
</html>`
}
