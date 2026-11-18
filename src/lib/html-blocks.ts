/**
 * 把模型输出里的 HTML 卡片（```html 围栏 / <template>）拆出来，
 * 用 sandbox iframe 渲染，避免直接注入主文档。
 */
export function splitHtmlBlocks(text: string): { plain: string; blocks: string[] } {
  const blocks: string[] = [];
  let rest = text;

  const fenced = /```html\s*([\s\S]*?)```/gi;
  rest = rest.replace(fenced, (_match, inner: string) => {
    blocks.push(unwrapTemplate(inner));
    return '\n';
  });

  const templates = /<template[^>]*>([\s\S]*?)<\/template>/gi;
  rest = rest.replace(templates, (_match, inner: string) => {
    blocks.push(inner);
    return '\n';
  });

  return { plain: rest.replace(/\n{3,}/g, '\n\n').trim(), blocks };
}

function unwrapTemplate(html: string): string {
  const match = /<template[^>]*>([\s\S]*?)<\/template>/i.exec(html);
  return match ? match[1] : html;
}

/** 给卡片补最小文档骨架，保证它在 iframe 里也能正常排版 */
export function buildHtmlDocument(fragment: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>html,body{margin:0;padding:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1a1a1a;}*{box-sizing:border-box;}</style></head><body>${fragment}</body></html>`;
}
