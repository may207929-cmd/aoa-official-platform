<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html>
      <head>
        <title>AOA Institute Sitemap</title>
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
        <h1>AOA Institute Sitemap</h1>
        <div class="note">This is an XML sitemap for search engines; the table below is a human‑readable view.</div>
        <table>
          <thead>
            <tr>
              <th>URL</th>
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
