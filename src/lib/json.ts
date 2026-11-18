/** 模型有时会在 JSON 外包 ```json 或加解释文字，这里宽松解析。 */
export function parseLooseJson<T>(raw: string): T {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    /* 继续尝试截取 */
  }

  const firstObj = text.indexOf('{');
  const firstArr = text.indexOf('[');
  const start =
    firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
  if (start === -1) throw new Error('模型返回里没有 JSON');

  const isArray = text[start] === '[';
  const end = isArray ? text.lastIndexOf(']') : text.lastIndexOf('}');
  if (end <= start) throw new Error('模型返回的 JSON 不完整');
  return JSON.parse(text.slice(start, end + 1)) as T;
}
