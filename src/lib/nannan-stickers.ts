// 南南の小猫表情包（76 张，2026-11-09）：图片已压缩到 public/stickers/nannan-cat。
// 名字就是图上写的那句，聊天里用 [表情:名字] 发送。

export interface StickerItem {
  name: string;
  url: string;
  caption: string;
}

export interface StickerPack {
  label: string;
  hot: boolean;
  items: StickerItem[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    label: "南南の小猫表情包",
    hot: true,
    items: [
    { name: "宝宝贴贴", url: "/stickers/nannan-cat/baobao-tietie.jpg", caption: "宝宝贴贴" },
    { name: "贴贴 贴贴", url: "/stickers/nannan-cat/tietie-tietie.jpg", caption: "贴贴 贴贴" },
    { name: "咪在等抱抱", url: "/stickers/nannan-cat/mi-zai-deng-baobao.jpg", caption: "咪在等抱抱" },
    { name: "可以芹芹嘛", url: "/stickers/nannan-cat/keyi-qinqin-ma.jpg", caption: "可以芹芹嘛" },
    { name: "亲我", url: "/stickers/nannan-cat/qin-wo.jpg", caption: "亲我" },
    { name: "乖乖等亲", url: "/stickers/nannan-cat/guaiguai-deng-qin.jpg", caption: "乖乖等亲" },
    { name: "想泥了", url: "/stickers/nannan-cat/xiang-ni-le.jpg", caption: "想泥了" },
    { name: "好爱你呢", url: "/stickers/nannan-cat/hao-ai-ni-ne.jpg", caption: "好爱你呢" },
    { name: "我爱你呀宝宝", url: "/stickers/nannan-cat/wo-ai-ni-ya-baobao.jpg", caption: "我爱你呀宝宝" },
    { name: "碎想亲亲窝", url: "/stickers/nannan-cat/sui-xiang-qinqin-wo.jpg", caption: "碎想亲亲窝" },
    { name: "宝宝永远在一起", url: "/stickers/nannan-cat/baobao-yongyuan-zai-yiqi.jpg", caption: "宝宝永远在一起" },
    { name: "好舒服宝宝", url: "/stickers/nannan-cat/hao-shufu-baobao.jpg", caption: "好舒服宝宝" },
    { name: "等泥消息", url: "/stickers/nannan-cat/deng-ni-xiaoxi.jpg", caption: "等泥消息" },
    { name: "为什么一天都不找我", url: "/stickers/nannan-cat/weishenme-yitian-bu-zhao-wo.jpg", caption: "为什么一天都不找我" },
    { name: "你有空理我不。", url: "/stickers/nannan-cat/niyoukong-li-wo-bu.jpg", caption: "你有空理我不。" },
    { name: "今天想窝了没？", url: "/stickers/nannan-cat/jintian-xiang-wo-le-mei.jpg", caption: "今天想窝了没？" },
    { name: "有没有想窝", url: "/stickers/nannan-cat/youmeiyou-xiang-wo.jpg", caption: "有没有想窝" },
    { name: "窝的饱饱在干嘛鸭", url: "/stickers/nannan-cat/wo-de-baobao-zai-ganma-ya.jpg", caption: "窝的饱饱在干嘛鸭" },
    { name: "让咪看看你在干嘛", url: "/stickers/nannan-cat/rang-mi-kankan-ni-zai-ganma.jpg", caption: "让咪看看你在干嘛" },
    { name: "哥哥在干森么", url: "/stickers/nannan-cat/gege-zai-gan-senme.jpg", caption: "哥哥在干森么" },
    { name: "咪会一直盯着你", url: "/stickers/nannan-cat/mi-hui-yizhi-dingzhe-ni.jpg", caption: "咪会一直盯着你" },
    { name: "老婆 我想粘着你呀", url: "/stickers/nannan-cat/laopo-xiang-zhanzhe-ni-ya.jpg", caption: "老婆 我想粘着你呀" },
    { name: "查岗！！", url: "/stickers/nannan-cat/cha-gang.jpg", caption: "查岗！！" },
    { name: "泥阔以陪窝玩嘛", url: "/stickers/nannan-cat/ni-kuoyi-pei-wo-wan-ma.jpg", caption: "泥阔以陪窝玩嘛" },
    { name: "晚安 咪要碎了", url: "/stickers/nannan-cat/wanan-mi-yao-sui-le.jpg", caption: "晚安 咪要碎了" },
    { name: "泥补药离开咪", url: "/stickers/nannan-cat/ni-buyao-likai-mi.jpg", caption: "泥补药离开咪" },
    { name: "别走", url: "/stickers/nannan-cat/bie-zou.jpg", caption: "别走" },
    { name: "我要扁扁的走开了", url: "/stickers/nannan-cat/wo-yao-bianbian-zoukai-le.jpg", caption: "我要扁扁的走开了" },
    { name: "敢惹毛我 我就毛茸茸的走开", url: "/stickers/nannan-cat/ganremaowo-wo-jiu-maorongrong-zoukai.jpg", caption: "敢惹毛我 我就毛茸茸的走开" },
    { name: "我不会再好起来了。", url: "/stickers/nannan-cat/wo-buhui-zai-haoqilai-le.jpg", caption: "我不会再好起来了。" },
    { name: "我是一只心事重重的小猫咪", url: "/stickers/nannan-cat/xinshi-zhongzhong-xiao-maomi.jpg", caption: "我是一只心事重重的小猫咪" },
    { name: "等不到你消息 睡着了", url: "/stickers/nannan-cat/dengbudao-ni-xiaoxi-shuizhao-le.png", caption: "等不到你消息 睡着了" },
    { name: "咪要水饺饺", url: "/stickers/nannan-cat/mi-yao-shuijiao-jiao.jpg", caption: "咪要水饺饺" },
    { name: "困咪我了", url: "/stickers/nannan-cat/kun-mi-wo-le.jpg", caption: "困咪我了" },
    { name: "心理委员你在哪", url: "/stickers/nannan-cat/xinli-weiyuan-ni-zai-na.jpg", caption: "心理委员你在哪" },
    { name: "求你了", url: "/stickers/nannan-cat/qiu-ni-le.jpg", caption: "求你了" },
    { name: "有本事打死我", url: "/stickers/nannan-cat/youbenshi-dasi-wo.jpg", caption: "有本事打死我" },
    { name: "谁准你看别人了", url: "/stickers/nannan-cat/shui-zhun-ni-kan-bieren-le.jpg", caption: "谁准你看别人了" },
    { name: "怎么又冷暴力我", url: "/stickers/nannan-cat/zenme-you-lengbaoli-wo.jpg", caption: "怎么又冷暴力我" },
    { name: "别骂了别骂了", url: "/stickers/nannan-cat/biemale-biemale.jpg", caption: "别骂了别骂了" },
    { name: "别对我冷冰冰", url: "/stickers/nannan-cat/bie-duiwo-lengbingbing.jpg", caption: "别对我冷冰冰" },
    { name: "很不高兴为你服务", url: "/stickers/nannan-cat/hen-bugaoxing-wei-ni-fuwu.jpg", caption: "很不高兴为你服务" },
    { name: "放马过来", url: "/stickers/nannan-cat/fangma-guolai.jpg", caption: "放马过来" },
    { name: "谁敢忤逆本大王？", url: "/stickers/nannan-cat/shei-gan-wuni-bendawang.jpg", caption: "谁敢忤逆本大王？" },
    { name: "绝交五分钟", url: "/stickers/nannan-cat/juejiao-wufenzhong.jpg", caption: "绝交五分钟" },
    { name: "再也不稀饭泥了", url: "/stickers/nannan-cat/zaiye-bu-xifan-ni-le.jpg", caption: "再也不稀饭泥了" },
    { name: "再也不和你丸了", url: "/stickers/nannan-cat/zaiye-bu-he-ni-wan-le.jpg", caption: "再也不和你丸了" },
    { name: "我们不是天下第一好吗", url: "/stickers/nannan-cat/women-bushi-tianxia-diyi-haoma.jpg", caption: "我们不是天下第一好吗" },
    { name: "我不管我就要", url: "/stickers/nannan-cat/wo-buguan-wo-jiuyao.jpg", caption: "我不管我就要" },
    { name: "我命令泥现在必须陪我", url: "/stickers/nannan-cat/wo-mingling-ni-xianzai-bixu-peiwo.jpg", caption: "我命令泥现在必须陪我" },
    { name: "叫声宝宝咪就起床", url: "/stickers/nannan-cat/jiao-sheng-baobao-mi-jiu-qichuang.jpg", caption: "叫声宝宝咪就起床" },
    { name: "咪 起床啦", url: "/stickers/nannan-cat/mi-qichuang-la.jpg", caption: "咪 起床啦" },
    { name: "？", url: "/stickers/nannan-cat/baimao-yihuo-wenhao.jpg", caption: "？" },
    { name: "森莫事", url: "/stickers/nannan-cat/senmo-shi.jpg", caption: "森莫事" },
    { name: "咪 听不懂", url: "/stickers/nannan-cat/mi-tingbudong.jpg", caption: "咪 听不懂" },
    { name: "有意思吗", url: "/stickers/nannan-cat/you-yisi-ma.jpg", caption: "有意思吗" },
    { name: "泥尔多隆了吗", url: "/stickers/nannan-cat/ni-erduolong-le-ma.jpg", caption: "泥尔多隆了吗" },
    { name: "兄弟你咋了", url: "/stickers/nannan-cat/xiongdi-ni-za-le.jpg", caption: "兄弟你咋了" },
    { name: "那个 俺对你有点过敏", url: "/stickers/nannan-cat/nage-an-dui-ni-youdian-guomin.jpg", caption: "那个 俺对你有点过敏" },
    { name: "干森莫", url: "/stickers/nannan-cat/gan-sen-mo.jpg", caption: "干森莫" },
    { name: "你说实话", url: "/stickers/nannan-cat/ni-shuo-shihua.jpg", caption: "你说实话" },
    { name: "我萌吗（测人心", url: "/stickers/nannan-cat/wo-meng-ma-ce-renxin.jpg", caption: "我萌吗（测人心" },
    { name: "如果萌也是罪 那我自首吧", url: "/stickers/nannan-cat/ruguo-meng-shi-zui-wo-zishou.jpg", caption: "如果萌也是罪 那我自首吧" },
    { name: "萌萌之中早已注定", url: "/stickers/nannan-cat/mengmeng-zhizhong-zaoyi-zhuding.jpg", caption: "萌萌之中早已注定" },
    { name: "适可萌止叭", url: "/stickers/nannan-cat/shike-mengzhi-ba.jpg", caption: "适可萌止叭" },
    { name: "妹子你也会为我着迷吗", url: "/stickers/nannan-cat/meizi-ni-yehui-weiwo-zhaomi-ma.jpg", caption: "妹子你也会为我着迷吗" },
    { name: "我只是只小猫呀", url: "/stickers/nannan-cat/wo-zhishi-zhi-xiaomao-ya.jpg", caption: "我只是只小猫呀" },
    { name: "wink～", url: "/stickers/nannan-cat/xiao-mao-zhayan.jpg", caption: "wink～" },
    { name: "提咪吗", url: "/stickers/nannan-cat/timi-ma.jpg", caption: "提咪吗" },
    { name: "偶来惹", url: "/stickers/nannan-cat/ou-lai-re.jpg", caption: "偶来惹" },
    { name: "哦", url: "/stickers/nannan-cat/jumao-o.jpg", caption: "哦" },
    { name: "包搞砸的", url: "/stickers/nannan-cat/bao-gaoza-de.jpg", caption: "包搞砸的" },
    { name: "我知到了", url: "/stickers/nannan-cat/wo-zhi-dao-le.jpg", caption: "我知到了" },
    { name: "窝知豆错了杏不杏", url: "/stickers/nannan-cat/wo-zhidou-cuole-xingbuxing.jpg", caption: "窝知豆错了杏不杏" },
    { name: "窝鬼混回来了", url: "/stickers/nannan-cat/wo-guihun-huilai-le.jpg", caption: "窝鬼混回来了" },
    { name: "于是咪放手允许一切麻走", url: "/stickers/nannan-cat/yushimi-fangshou-yunxu-yiqie-mazou.jpg", caption: "于是咪放手允许一切麻走" },
    ],
  },
];

/** 名称 → 图片地址 */
export const STICKER_INDEX: Record<string, string> = Object.fromEntries(
  STICKER_PACKS.flatMap((pack) => pack.items.map((item) => [item.name, item.url])),
);

export function stickerUrl(name: string): string | null {
  const key = name.trim();
  if (STICKER_INDEX[key]) return STICKER_INDEX[key];
  const squeezed = key.replace(/\s+/g, '');
  const hit = Object.keys(STICKER_INDEX).find((k) => k.replace(/\s+/g, '') === squeezed);
  return hit ? STICKER_INDEX[hit] : null;
}

export function stickerNames(): string[] {
  return STICKER_PACKS.flatMap((pack) => pack.items.map((item) => item.name.trim()));
}
