'use client'

import { useEffect } from 'react'

export default function PrintFormPage() {
  useEffect(() => {
    // Auto-trigger print dialog after render
    const timer = setTimeout(() => window.print(), 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm 15mm; }
        }
        @media screen {
          body { background: #f0f0f0; }
          .print-page {
            background: white;
            max-width: 210mm;
            margin: 20px auto;
            padding: 12mm 15mm;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
        .print-page {
          font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
          font-size: 11px;
          color: #222;
          line-height: 1.4;
        }
        .form-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          letter-spacing: 2px;
        }
        .form-subtitle {
          text-align: center;
          font-size: 10px;
          color: #888;
          margin-bottom: 14px;
        }
        .top-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }
        .top-field {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .top-field label {
          font-weight: bold;
          white-space: nowrap;
          font-size: 11px;
        }
        .top-field .line {
          flex: 1;
          border-bottom: 1px solid #333;
          min-height: 22px;
        }
        .section {
          margin-bottom: 6px;
        }
        .section-header {
          font-weight: bold;
          font-size: 11px;
          background: #f5f5f5;
          padding: 3px 8px;
          border-left: 3px solid #4f46e5;
          margin-bottom: 4px;
        }
        .write-area {
          border: 1px solid #ccc;
          min-height: 60px;
          padding: 4px 6px;
          position: relative;
        }
        .write-area.small { min-height: 44px; }
        .write-area.large { min-height: 80px; }
        .write-area .hint {
          position: absolute;
          top: 3px;
          right: 5px;
          font-size: 8px;
          color: #bbb;
        }
        .write-lines {
          background-image: repeating-linear-gradient(
            transparent, transparent 19px, #e8e8e8 19px, #e8e8e8 20px
          );
        }
        .checkbox-row {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 5px 6px;
          border: 1px solid #ccc;
        }
        .checkbox-row label {
          font-size: 11px;
        }
        .checkbox-row .cb {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 1.5px solid #555;
          margin-right: 4px;
          vertical-align: middle;
          border-radius: 2px;
        }
        .two-col {
          display: flex;
          gap: 8px;
        }
        .two-col > div {
          flex: 1;
        }
        .textbook-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
        }
        .textbook-table th,
        .textbook-table td {
          border: 1px solid #ccc;
          padding: 3px 6px;
          text-align: left;
          font-size: 10px;
        }
        .textbook-table th {
          background: #f9f9f9;
          font-weight: bold;
          width: 50%;
        }
        .textbook-table td {
          min-height: 22px;
          height: 22px;
        }
        .footer-note {
          text-align: center;
          font-size: 8px;
          color: #aaa;
          margin-top: 8px;
        }
        .internal-section {
          border: 2px dashed #f59e0b;
          padding: 4px 6px;
          min-height: 44px;
          position: relative;
        }
        .internal-section .tag {
          position: absolute;
          top: -8px;
          left: 8px;
          background: white;
          padding: 0 4px;
          font-size: 9px;
          color: #f59e0b;
          font-weight: bold;
        }
      `}</style>

      <div className="no-print" style={{ textAlign: 'center', padding: '16px' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 24px', fontSize: '14px', cursor: 'pointer', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px' }}
        >
          印刷する
        </button>
        <p style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
          A4用紙に印刷してください
        </p>
      </div>

      <div className="print-page">
        <div className="form-title">授業レポート</div>
        <div className="form-subtitle">レフィー 個別指導塾 ── 記入後、写真入力（OCR）で読み取れます</div>

        {/* Top row: 日付・生徒名・科目・講師名 */}
        <div className="top-row">
          <div className="top-field">
            <label>日付</label>
            <div className="line" style={{ maxWidth: '120px' }}></div>
          </div>
          <div className="top-field">
            <label>生徒名</label>
            <div className="line"></div>
          </div>
          <div className="top-field">
            <label>科目</label>
            <div className="line" style={{ maxWidth: '100px' }}></div>
          </div>
        </div>

        {/* テキスト */}
        <div className="section">
          <div className="section-header">使用テキスト</div>
          <table className="textbook-table">
            <thead>
              <tr><th>テキスト名</th><th>ページ</th></tr>
            </thead>
            <tbody>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
              <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
            </tbody>
          </table>
        </div>

        {/* 扱った単元 */}
        <div className="section">
          <div className="section-header">扱った単元</div>
          <div className="write-area small write-lines"></div>
        </div>

        {/* 前回宿題チェック */}
        <div className="section">
          <div className="section-header">前回の宿題チェック</div>
          <div className="checkbox-row">
            <label><span className="cb"></span>やってきた</label>
            <label><span className="cb"></span>一部やった</label>
            <label><span className="cb"></span>やってきていない</label>
          </div>
        </div>

        {/* 生徒の様子 */}
        <div className="section">
          <div className="section-header">生徒の様子</div>
          <div className="two-col">
            <div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#16a34a', marginBottom: '2px' }}>ポジティブ（該当に○）</div>
              <div className="write-area small" style={{ fontSize: '10px', lineHeight: '1.8' }}>
                集中していた　／　積極的だった　／　理解が早かった　／　質問ができた　／　丁寧に取り組めた　／　前回より成長した　／　その他:
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#ea580c', marginBottom: '2px' }}>ネガティブ（該当に○）</div>
              <div className="write-area small" style={{ fontSize: '10px', lineHeight: '1.8' }}>
                集中が切れやすい　／　眠そう　／　理解が追いつかない　／　やる気が低い　／　ケアレスミスが多い　／　その他:
              </div>
            </div>
          </div>
        </div>

        {/* 理解できていたこと */}
        <div className="section">
          <div className="section-header">理解できていたこと・得意なこと</div>
          <div className="write-area write-lines"></div>
        </div>

        {/* 理解不十分 */}
        <div className="section">
          <div className="section-header">理解不十分・苦手なこと</div>
          <div className="write-area write-lines"></div>
        </div>

        {/* 様子の自由コメント */}
        <div className="section">
          <div className="section-header">様子の自由コメント</div>
          <div className="write-area write-lines"></div>
        </div>

        {/* 宿題内容 */}
        <div className="section">
          <div className="section-header">宿題内容</div>
          <div className="write-area write-lines"></div>
        </div>

        {/* 次回やること */}
        <div className="section">
          <div className="section-header">次回やること</div>
          <div className="write-area small write-lines"></div>
        </div>

        {/* 講師間申し送り */}
        <div className="section">
          <div className="section-header" style={{ borderLeftColor: '#f59e0b' }}>講師間申し送り（保護者には非公開）</div>
          <div className="internal-section write-lines">
          </div>
        </div>

        <div className="footer-note">
          レフィー 授業レポートシステム ── このフォームは「写真入力」機能でスキャンできます
        </div>
      </div>
    </>
  )
}
