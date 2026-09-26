/* ============================================================
   ANON// — Shared constants and data blobs
   Extracted from page.tsx for lazy-loading + cleaner bundle.
   ============================================================ */

export const LS_USERNAME = "anon_username";
export const LS_LAST_OFFER = "anon_last_offer_at";
export const LS_PENDING = "anon_pending_offer";
export const LS_LANG = "anon_lang";
export const LS_MUTED = "anon_muted";
export const LS_LAST_SEEN_PUBLIC = "anon_last_seen_public";
export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
export const ONE_DAY = 24 * 60 * 60 * 1000;

export const EXTRA: Record<string, Record<string, string>> = {
  navHome:    { en:"HOME", hi:"होम", ar:"الرئيسية", es:"INICIO", fr:"ACCUEIL", zh:"首页" },
  navConnect: { en:"CONNECT", hi:"जुड़ें", ar:"اتصل", es:"CONECTAR", fr:"CONNEXION", zh:"连接" },
  navExplore: { en:"EXPLORE", hi:"खोजें", ar:"استكشف", es:"EXPLORAR", fr:"EXPLORER", zh:"探索" },
  navLearn:   { en:"LEARN", hi:"सीखें", ar:"تعلّم", es:"APRENDER", fr:"APPRENDRE", zh:"学习" },
  navMore:    { en:"MORE", hi:"और", ar:"المزيد", es:"MÁS", fr:"PLUS", zh:"更多" },
  usersLabel: { en:"USERS", hi:"उपयोगकर्ता", ar:"مستخدم", es:"USUARIOS", fr:"UTILISATEURS", zh:"用户" },
  muteTitle:  { en:"Mute", hi:"म्यूट", ar:"كتم", es:"Silenciar", fr:"Couper le son", zh:"静音" },
  unmuteTitle:{ en:"Unmute", hi:"अनम्यूट", ar:"إلغاء الكتم", es:"Activar sonido", fr:"Activer le son", zh:"取消静音" },
  backTitle:  { en:"Back to doors", hi:"दरवाज़ों पर वापस", ar:"العودة إلى الأبواب", es:"Volver a las puertas", fr:"Retour aux portes", zh:"返回门户" },
  dataLogTitle:{ en:"View full data log", hi:"पूरा डेटा लॉग देखें", ar:"عرض سجل البيانات الكامل", es:"Ver registro completo", fr:"Voir le journal complet", zh:"查看完整数据日志" },
  welcomeBackTitle:   { en:"Welcome back.", hi:"वापसी पर स्वागत है।", ar:"مرحبًا بعودتك.", es:"Bienvenido de nuevo.", fr:"Bon retour.", zh:"欢迎回来。" },
  welcomeBackAway:    { en:"You were away for {min} min", hi:"आप {min} मिनट दूर थे", ar:"كنت بعيدًا لمدة {min} دقيقة", es:"Estuviste ausente {min} min", fr:"Vous étiez absent {min} min", zh:"你离开了 {min} 分钟" },
  welcomeBackMsgsOne: { en:"— 1 new message while you were gone.", hi:"— आपकी अनुपस्थिति में 1 नया संदेश।", ar:"— رسالة جديدة واحدة أثناء غيابك.", es:"— 1 mensaje nuevo mientras no estabas.", fr:"— 1 nouveau message pendant votre absence.", zh:"— 你离开期间有 1 条新消息。" },
  welcomeBackMsgsMany:{ en:"— {count} new messages while you were gone.", hi:"— आपकी अनुपस्थिति में {count} नए संदेश।", ar:"— {count} رسائل جديدة أثناء غيابك.", es:"— {count} mensajes nuevos mientras no estabas.", fr:"— {count} nouveaux messages pendant votre absence.", zh:"— 你离开期间有 {count} 条新消息。" },
  welcomeBackNone:    { en:".", hi:"।", ar:".", es:".", fr:".", zh:"。" },
  dismiss:    { en:"Dismiss", hi:"खारिज करें", ar:"إغلاق", es:"Cerrar", fr:"Fermer", zh:"关闭" },
  missedTag:  { en:"missed", hi:"छूटा", ar:"فائتة", es:"perdido", fr:"manqué", zh:"错过" },
  queuedTag:  { en:"queued", hi:"कतार में", ar:"في الانتظار", es:"en cola", fr:"en attente", zh:"排队中" },
  youLabel:   { en:"you", hi:"आप", ar:"أنت", es:"tú", fr:"vous", zh:"你" },
  deletedLabel:     { en:"DELETED", hi:"मिटा दिया", ar:"محذوف", es:"ELIMINADO", fr:"SUPPRIMÉ", zh:"已删除" },
  deletedNextLabel: { en:"DELETED · NEXT {time}", hi:"मिटा दिया · अगला {time}", ar:"محذوف · التالي {time}", es:"ELIMINADO · PRÓXIMO {time}", fr:"SUPPRIMÉ · PROCHAIN {time}", zh:"已删除 · 下一个 {time}" },
  yesterday: { en:"yesterday", hi:"कल", ar:"أمس", es:"ayer", fr:"hier", zh:"昨天" },
  dAgo:  { en:"{n}d ago",  hi:"{n} दिन पहले",  ar:"قبل {n} يوم",  es:"hace {n}d",  fr:"il y a {n}j",  zh:"{n}天前" },
  wAgo:  { en:"{n}w ago",  hi:"{n} सप्ताह पहले", ar:"قبل {n} أسبوع", es:"hace {n}sem", fr:"il y a {n}sem", zh:"{n}周前" },
  moAgo: { en:"{n}mo ago", hi:"{n} माह पहले",  ar:"قبل {n} شهر",  es:"hace {n}mes", fr:"il y a {n}mois", zh:"{n}个月前" },
  yAgo:  { en:"{n}y ago",  hi:"{n} वर्ष पहले", ar:"قبل {n} سنة",  es:"hace {n}a",   fr:"il y a {n}a",  zh:"{n}年前" },
};

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "🙏"] as const;

export const EMOJI_PICKER: Record<string, string[]> = {
  Smileys: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  Gestures: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","👃","🧠","🦷","👀","👁️","👅","👄"],
  Hearts: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️","💌","💋","🔥","✨","⭐","🌟","💫","⚡","💥","💯"],
  Animals: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊"],
  Food: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🌮","🌯","🥗","🥘","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🍯","🥛","🍼","☕","🍵","🥤","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🍾"],
  Activities: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","🥅","⛳","🏹","🎣","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","🏂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🚣","🧗","🚵","🚴","🏆","🥇","🥈","🥉","🏅","🎫","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🎻","🎲","🎯","🎳","🎮","🎰","🧩"],
  Symbols: ["✅","❌","❎","⭕","🚫","💯","🔥","⭐","🌟","✨","⚡","❗","❓","❔","❕","‼️","⁉️","⚠️","♻️","🌐","💠","🌀","💤","➕","➖","➗","✖️","♾️","💲","™️","©️","®️","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🔺","🔻","🔸","🔹","🔶","🔷","⬛","⬜"],
};

export const SPARKS = Array.from({ length: 10 }, (_, i) => ({
  left: `${(i * 10) % 100}%`,
  duration: 12 + (i % 5) * 2,
  delay: (i % 6) * 1.4,
  size: 2 + (i % 3),
  drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6),
}));

export const doors = [
  {
    id: "chat" as const,
    name: "public",
    desc: "publicDesc",
    tag: "publicTag",
    icon: (<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M40 22c0 8.837-7.163 16-16 16-2.42 0-4.71-.537-6.766-1.497L8 40l3.497-9.234A15.93 15.93 0 0 1 8 22c0-8.837 7.163-16 16-16s16 7.163 16 16Z"/><circle cx="18" cy="22" r="1.5" fill="currentColor"/><circle cx="24" cy="22" r="1.5" fill="currentColor"/><circle cx="30" cy="22" r="1.5" fill="currentColor"/></svg>),
  },
  {
    id: "private" as const,
    name: "private",
    desc: "privateDesc",
    tag: "privateTag",
    icon: (<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="10" y="20" width="28" height="22" rx="3"/><path d="M16 20v-6a8 8 0 0 1 16 0v6"/><circle cx="24" cy="30" r="2" fill="currentColor"/></svg>),
  },
  {
    id: "content" as const,
    name: "content",
    desc: "contentDesc",
    tag: "contentTag",
    icon: (<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 6h14l10 10v26H14z"/><path d="M28 6v10h10"/><path d="M18 24h12M18 30h12M18 36h8"/></svg>),
  },
];