// 全局数据类型：人设 / 会话 / API 配置 / 社交内容

export type Id = string;

export interface Persona {
  id: Id;
  name: string;
  /** emoji 或 dataURL */
  avatar?: string;
  tagline?: string;
  description: string;
  style?: string;
  scenario?: string;
  firstMes?: string;
  example?: string;
  worldbook?: string;
  forbidden?: string;
  voiceId?: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant' | 'system';

/** 消息类型：普通文本 / 语音条 / 红包 / 转账 / 礼物 / 位置 / 通话记录 */
export type MessageKind = 'text' | 'voice' | 'redpacket' | 'transfer' | 'gift' | 'location' | 'call';

export interface MessagePayload {
  amount?: string;
  note?: string;
  name?: string;
  address?: string;
  media?: 'voice' | 'video';
  seconds?: number;
  missed?: boolean;
}

export interface ChatMessage {
  id: Id;
  role: MessageRole;
  text: string;
  /** 图片存在 IndexedDB，消息里只留 key */
  imageId?: string;
  /** 远程图片地址（生图接口直接返回 url 时使用） */
  imageUrl?: string;
  kind?: MessageKind;
  /** 语音条音频存在 IndexedDB */
  audioId?: string;
  audioDuration?: number;
  payload?: MessagePayload;
  /** 群聊里区分说话人 */
  senderId?: Id;
  senderName?: string;
  senderAvatar?: string;
  createdAt: number;
  error?: boolean;
}

export type Channel = 'chat' | 'wechat' | 'line' | 'qq' | 'group';

/** 群聊 */
export interface Group {
  id: Id;
  name: string;
  avatar?: string;
  memberIds: Id[];
  createdAt: number;
}

export interface Conversation {
  id: Id;
  personaId: Id;
  channel: Channel;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface TextConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
}

export type TtsProvider = 'volc' | 'minimax' | 'openai' | 'browser';

export interface TtsConfig {
  provider: TtsProvider;
  apiKey: string;
  voiceId: string;
  speed: number;
  pitch: number;
  /** MiniMax 必填 */
  groupId: string;
  /** MiniMax 模型，如 speech-02-hd */
  model: string;
  /** OpenAI 兼容语音的 base url */
  baseUrl: string;
}

export interface SttConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface UserPersona {
  name: string;
  bio: string;
  avatar?: string;
}

export interface Settings {
  text: TextConfig;
  image: ImageConfig;
  tts: TtsConfig;
  stt: SttConfig;
  user: UserPersona;
  autoRead: boolean;
  apiMode: 'proxy' | 'direct';
  /** 启用 starchat 的内置 MUFY 剧情预设（默认关闭） */
  presetEnabled?: boolean;
  /** 用户自定义的剧情预设文本 */
  presetText?: string;
  /** 进入聊天时让角色主动先说话 */
  proactive?: boolean;
  activePersonaId?: Id;
}

export interface MomentComment {
  id: Id;
  author: string;
  text: string;
  createdAt: number;
}

export interface MomentPost {
  id: Id;
  personaId: Id;
  authorName: string;
  authorAvatar?: string;
  text: string;
  images: { emoji: string; color: string }[];
  /** 相册/生图得到的真实配图 */
  photoId?: Id;
  photoUrl?: string;
  createdAt: number;
  likes: string[];
  comments: MomentComment[];
}

export interface XhsNote {
  id: Id;
  personaId: Id;
  title: string;
  content: string;
  coverEmoji: string;
  coverColor: string;
  likes: string;
  createdAt: number;
  liked?: boolean;
}

export interface XhsProfile {
  personaId: Id;
  nickname: string;
  handle: string;
  bio: string;
  ip: string;
  gender: '男' | '女';
  age: string;
  job: string;
  following: string;
  fans: string;
  likes: string;
}
