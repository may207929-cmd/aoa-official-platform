<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html>
      <head>
        <title>亞洲眼整形醫師聯盟培訓機構網站地圖</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; background: #f5f7fa; color: #0b1b3a; }
          h1 { font-size: 22px; }
          table { width: 100%; border-collapse: collapse; background: #fff; }
          th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
          th { background: #0b1b3a; color: #fff; }
          tr:hover td { background: #f0f4f8; }
          .note { color: #6b7280; font-size: 12px; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <h1>亞洲眼整形醫師聯盟培訓機構網站地圖</h1>
        <div class="note">這是一個提供搜尋引擎使用的 XML 網站地圖；下表為人類可讀的視圖。</div>
        <table>
          <thead>
            <tr>
              <th>網址</th>
            </tr>
          </thead>
          <tbody>
            <xsl:for-each select="urlset/url">
              <tr>
                <td><xsl:value-of select="loc" /></td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
