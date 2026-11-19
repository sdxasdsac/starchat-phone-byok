import type { Persona, Settings } from './types';

/** 火山豆包语音合成 2.0 常用音色（可直接在设置里粘贴别的 speaker id） */
export const VOICE_PRESETS: { id: string; name: string; gender: '女' | '男'; style: string }[] = [
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何', gender: '女', style: '自然亲切，像身边朋友' },
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi', gender: '女', style: '知性温和，通用百搭' },
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts', name: '清新女声', gender: '女', style: '干净清透，少女感' },
  { id: 'zh_female_tianmeitaozi_uranus_bigtts', name: '甜美桃子', gender: '女', style: '甜美软糯，活泼可爱' },
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '高冷御姐', gender: '女', style: '成熟冷艳，气场强' },
  { id: 'zh_female_wenroushunv_uranus_bigtts', name: '温柔淑女', gender: '女', style: '温婉贤淑，轻声细语' },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '小天', gender: '男', style: '清亮少年感，通用' },
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟', gender: '男', style: '温润平和，通用' },
  { id: 'zh_male_aojiaobazong_uranus_bigtts', name: '傲娇霸总', gender: '男', style: '强势低沉，总裁范' },
  { id: 'zh_male_shenyeboke_uranus_bigtts', name: '深夜播客', gender: '男', style: '低沉磁性，耳语感' },
];

export const DEFAULT_SETTINGS: Settings = {
  text: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.9,
    maxTokens: 1200,
  },
  image: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-image-1',
    size: '1024x1024',
  },
  tts: {
    provider: 'volc',
    apiKey: '',
    voiceId: 'zh_female_xiaohe_uranus_bigtts',
    speed: 1,
    pitch: 0,
    groupId: '',
    model: 'speech-02-hd',
    baseUrl: 'https://api.minimax.chat/v1',
  },
  stt: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'whisper-1',
  },
  user: { name: '我', bio: '' },
  autoRead: true,
  apiMode: 'proxy',
  presetEnabled: false,
  presetText: '',
  proactive: true,
};

export function createDefaultPersona(): Persona {
  const now = Date.now();
  return {
    id: `p_${now.toString(36)}`,
    name: '星语',
    avatar: '🌙',
    tagline: '住在这部小手机里的 AI 女孩',
    description:
      '星语，22 岁，性格温柔但不黏人，偶尔会毒舌地吐槽你。她喜欢在深夜听歌、记录生活，对喜欢的人会认真记住每一个小细节。',
    style: '说话自然口语化，会用语气词；不说教，不写小说式旁白；回复一般 1~3 句。',
    scenario: '你们通过一部虚拟小手机认识，现在每天都会聊天。',
    firstMes: '「你来啦。今天过得怎么样？」',
    example: '{{user}}：我下班了。\n{{char}}：「辛苦啦，先喝口水。今天有没有发生什么想跟我说的事？」',
    worldbook: '',
    forbidden: '不要输出八股套话，不要替用户做决定，不要每句都加括号动作描写。',
    voiceId: 'zh_female_xiaohe_uranus_bigtts',
    createdAt: now,
    updatedAt: now,
  };
}
