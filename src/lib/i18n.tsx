import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type Language = "fa" | "en";

export const LANGUAGES: { code: Language; label: string; flag: string; dir: "rtl" | "ltr" }[] = [
  { code: "fa", label: "فارسی", flag: "🇮🇷", dir: "rtl" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
];

const STORAGE_KEY = "xgram.language";

const dictionaries = {
  en: {
    "common.home": "Home",
    "common.chats": "Chats",
    "common.contacts": "Contacts",
    "common.settings": "Settings",
    "common.languages": "Languages",
    "common.profile": "My profile",
    "common.signOut": "Sign out",
    "common.back": "Back",
    "common.search": "Search",
    "common.cancel": "Cancel",
    "common.save": "Save changes",
    "common.call": "Call",
    "common.group": "Group",
    "common.channel": "Channel",
    "common.loading": "Loading…",
    "chat.sendMessage": "Send Message",
    "chat.writeMessage": "Write a message…",
    "chat.typing": "is typing…",
    "chat.recording": "is recording audio…",
    "chat.online": "Online",
    "chat.offline": "Offline",
    "chat.lastSeenRecently": "Last seen recently",
    "chat.lastSeen": "Last seen",
    "chat.searchInChat": "Search in this conversation",
    "chat.noMessages": "No messages yet — say hello!",
    "chat.noSearchResults": "No messages matched your search.",
    "chat.unavailable": "This conversation is unavailable.",
    "chat.backToChats": "Back to chats",
    "chat.savedMessages": "Saved Messages",
    "chat.personalSpace": "Your personal space",
    "chat.searchChats": "Search chats and messages",
    "chat.members": "members",
    "chat.newChat": "New chat",
    "chat.startChat": "Start a chat",
    "chat.nothingMatched": "Nothing matched your search.",
    "chat.noConversations": "No conversations here yet.",
    "chat.selectConversation": "Select a conversation",
    "chat.selectHint": "Pick a chat from the list or start a new one to send your first message.",
    "chat.attachment": "Attachment",
    "chat.deleted": "Message deleted",
    "chat.none": "No messages yet",
    "filter.all": "All",
    "filter.unread": "Unread",
    "filter.direct": "Personal",
    "filter.group": "Groups",
    "filter.channel": "Channels",
    "filter.archived": "Archived",
    "contacts.title": "Contacts",
    "contacts.searchPlaceholder": "@username or full email address",
    "contacts.invalid": "Enter @ followed by at least 3 username characters, or a full email address.",
    "contacts.searchError": "Search failed. Please try again.",
    "contacts.empty": "No users found",
    "contacts.message": "Message",
    "profile.title": "My profile",
    "profile.changePhoto": "Change photo",
    "profile.displayName": "Display name",
    "profile.username": "Username",
    "profile.bio": "Bio",
    "profile.phone": "Phone (optional)",
    "profile.updated": "Profile updated",
    "profile.photoUpdated": "Photo updated",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.system": "System",
    "settings.visualStyle": "Interface style",
    "settings.visualStyleHint": "Choose how panels, chat composer and menus look.",
    "settings.styleClassic": "Classic",
    "settings.styleBlur": "Blur",
    "settings.styleLiquidGlass": "Liquid Glass",
    "settings.styleClassicHint": "Clean solid surfaces",
    "settings.styleBlurHint": "Soft translucent blur",
    "settings.styleLiquidGlassHint": "Layered glass, reflections and depth",
    "settings.notifications": "Notifications",
    "settings.desktopNotifications": "Desktop notifications",
    "settings.desktopNotificationsHint": "Get alerted about new messages.",
    "settings.sounds": "Message sounds",
    "settings.soundsHint": "Play a sound when a message arrives.",
    "settings.deviceNote": "Notification preferences are stored on this device.",
    "settings.currentLanguage": "Current language",
    "settings.languageChanged": "Language changed successfully",
    "network.waiting": "Waiting for network",
    "network.connecting": "Connecting",
    "network.updating": "Updating",
    "auth.forgot": "Forgot password?",
    "auth.forgotTitle": "Reset your password",
    "auth.forgotHint": "Enter the email address you used to create your Xgram account.",
    "auth.sendLink": "Send reset link",
    "auth.resetSent": "If an account exists for this email, a password reset link has been sent.",
    "auth.backToSignIn": "Back to sign in",
    "auth.resetTitle": "Choose a new password",
    "auth.newPassword": "New password",
    "auth.confirmPassword": "Confirm new password",
    "auth.updatePassword": "Update password",
    "auth.passwordUpdated": "Password updated. You can sign in now.",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.linkInvalid": "This reset link is invalid or has expired.",
    "group.info": "Group info",
    "group.channelInfo": "Channel info",
    "group.addMembers": "Add Members",
    "group.edit": "Edit",
    "group.name": "Name",
    "group.description": "Description",
    "group.photo": "Photo",
    "group.permissions": "Permissions",
    "group.whoCanSend": "Who can send messages?",
    "group.whoCanMedia": "Who can send media?",
    "group.whoCanFiles": "Who can send files?",
    "group.whoCanLinks": "Who can send links?",
    "group.whoCanEdit": "Who can change group information?",
    "group.everyone": "Everyone",
    "group.adminsOnly": "Admins only",
    "group.saved": "Changes saved",
    "group.members": "Members",
    "group.admin": "Admin",
    "group.owner": "Owner",
    "group.goToPersonalPage": "Go to personal page",
    "group.addAdmin": "Add New Admin",
    "group.removeAdmin": "Remove from Admin",
    "group.adminAdded": "Member is now an admin",
    "group.adminRemoved": "Admin rights removed",
    "group.membersAdded": "Members added",
    "group.searchUsers": "Search people",
    "group.add": "Add",
    "group.noPermission": "You don't have permission to do that.",
    "group.cannotPost": "Only admins can send messages in this chat.",
  },

  fa: {
    "common.home": "خانه",
    "common.chats": "پیام‌ها",
    "common.contacts": "مخاطبین",
    "common.settings": "تنظیمات",
    "common.languages": "زبان‌ها",
    "common.profile": "پروفایل من",
    "common.signOut": "خروج",
    "common.back": "بازگشت",
    "common.search": "جستجو",
    "common.cancel": "انصراف",
    "common.save": "ذخیره تغییرات",
    "common.call": "تماس",
    "common.group": "گروه",
    "common.channel": "کانال",
    "common.loading": "در حال بارگذاری…",
    "chat.sendMessage": "ارسال پیام",
    "chat.writeMessage": "پیام بنویسید…",
    "chat.typing": "در حال نوشتن…",
    "chat.recording": "در حال ضبط صدا…",
    "chat.online": "آنلاین",
    "chat.offline": "آفلاین",
    "chat.lastSeenRecently": "آخرین بازدید اخیراً",
    "chat.lastSeen": "آخرین بازدید",
    "chat.searchInChat": "جستجو در این گفتگو",
    "chat.noMessages": "هنوز پیامی نیست — سلام کنید!",
    "chat.noSearchResults": "پیامی با جستجوی شما پیدا نشد.",
    "chat.unavailable": "این گفتگو در دسترس نیست.",
    "chat.backToChats": "بازگشت به گفتگوها",
    "chat.savedMessages": "پیام‌های ذخیره‌شده",
    "chat.personalSpace": "فضای شخصی شما",
    "chat.searchChats": "جستجوی گفتگوها و پیام‌ها",
    "chat.members": "عضو",
    "chat.newChat": "گفتگوی جدید",
    "chat.startChat": "شروع گفتگو",
    "chat.nothingMatched": "چیزی با جستجوی شما پیدا نشد.",
    "chat.noConversations": "هنوز گفتگویی اینجا نیست.",
    "chat.selectConversation": "یک گفتگو انتخاب کنید",
    "chat.selectHint": "از فهرست یک گفتگو انتخاب کنید یا گفتگوی تازه‌ای بسازید.",
    "chat.attachment": "پیوست",
    "chat.deleted": "پیام حذف شد",
    "chat.none": "هنوز پیامی نیست",
    "filter.all": "همه",
    "filter.unread": "خوانده‌نشده",
    "filter.direct": "شخصی",
    "filter.group": "گروه‌ها",
    "filter.channel": "کانال‌ها",
    "filter.archived": "بایگانی",
    "contacts.title": "مخاطبین",
    "contacts.searchPlaceholder": "@نام‌کاربری یا نشانی کامل ایمیل",
    "contacts.invalid": "@ و حداقل ۳ حرف از نام کاربری، یا نشانی کامل ایمیل را وارد کنید.",
    "contacts.searchError": "جستجو انجام نشد. دوباره تلاش کنید.",
    "contacts.empty": "کاربری پیدا نشد",
    "contacts.message": "پیام",
    "profile.title": "پروفایل من",
    "profile.changePhoto": "تغییر عکس",
    "profile.displayName": "نام نمایشی",
    "profile.username": "نام کاربری",
    "profile.bio": "بیوگرافی",
    "profile.phone": "شماره تلفن (اختیاری)",
    "profile.updated": "پروفایل به‌روزرسانی شد",
    "profile.photoUpdated": "عکس به‌روزرسانی شد",
    "settings.title": "تنظیمات",
    "settings.appearance": "ظاهر",
    "settings.light": "روشن",
    "settings.dark": "تیره",
    "settings.system": "سیستم",
    "settings.visualStyle": "سبک ظاهری رابط کاربری",
    "settings.visualStyleHint": "ظاهر پنل‌ها، کادر نوشتن پیام و منوها را انتخاب کنید.",
    "settings.styleClassic": "معمولی",
    "settings.styleBlur": "بلور",
    "settings.styleLiquidGlass": "لیکوئید گلس",
    "settings.styleClassicHint": "سطوح ساده و یکدست",
    "settings.styleBlurHint": "شفافیت و محوشدگی ملایم",
    "settings.styleLiquidGlassHint": "شیشه چندلایه، بازتاب نور و عمق",
    "settings.notifications": "اعلان‌ها",
    "settings.desktopNotifications": "اعلان‌های دسکتاپ",
    "settings.desktopNotificationsHint": "از پیام‌های جدید باخبر شوید.",
    "settings.sounds": "صدای پیام",
    "settings.soundsHint": "هنگام رسیدن پیام صدا پخش شود.",
    "settings.deviceNote": "تنظیمات اعلان روی همین دستگاه ذخیره می‌شود.",
    "settings.currentLanguage": "زبان فعلی",
    "settings.languageChanged": "زبان با موفقیت تغییر کرد",
    "network.waiting": "در انتظار شبکه",
    "network.connecting": "در حال اتصال",
    "network.updating": "در حال به‌روزرسانی",
    "auth.forgot": "فراموشی رمز عبور",
    "auth.forgotTitle": "بازیابی رمز عبور",
    "auth.forgotHint": "ایمیلی را که با آن حساب Xgram ساخته‌اید وارد کنید.",
    "auth.sendLink": "ارسال لینک بازیابی",
    "auth.resetSent": "اگر حسابی با این ایمیل وجود داشته باشد، لینک تغییر رمز عبور ارسال خواهد شد.",
    "auth.backToSignIn": "بازگشت به ورود",
    "auth.resetTitle": "رمز عبور جدید را انتخاب کنید",
    "auth.newPassword": "رمز عبور جدید",
    "auth.confirmPassword": "تکرار رمز عبور جدید",
    "auth.updatePassword": "تغییر رمز عبور",
    "auth.passwordUpdated": "رمز عبور تغییر کرد. اکنون می‌توانید وارد شوید.",
    "auth.passwordMismatch": "رمزهای عبور یکسان نیستند",
    "auth.linkInvalid": "این لینک بازیابی نامعتبر یا منقضی شده است.",
    "group.info": "اطلاعات گروه",
    "group.channelInfo": "اطلاعات کانال",
    "group.addMembers": "افزودن اعضا",
    "group.edit": "ویرایش",
    "group.name": "نام",
    "group.description": "توضیحات",
    "group.photo": "عکس",
    "group.permissions": "دسترسی‌ها",
    "group.whoCanSend": "چه کسی می‌تواند پیام بفرستد؟",
    "group.whoCanMedia": "چه کسی می‌تواند رسانه بفرستد؟",
    "group.whoCanFiles": "چه کسی می‌تواند فایل بفرستد؟",
    "group.whoCanLinks": "چه کسی می‌تواند لینک بفرستد؟",
    "group.whoCanEdit": "چه کسی می‌تواند اطلاعات گروه را تغییر دهد؟",
    "group.everyone": "همه",
    "group.adminsOnly": "فقط ادمین‌ها",
    "group.saved": "تغییرات ذخیره شد",
    "group.members": "اعضا",
    "group.admin": "ادمین",
    "group.owner": "مالک",
    "group.goToPersonalPage": "برو به صفحه شخصی",
    "group.addAdmin": "افزودن ادمین جدید",
    "group.removeAdmin": "حذف از ادمین",
    "group.adminAdded": "این عضو اکنون ادمین است",
    "group.adminRemoved": "دسترسی ادمین حذف شد",
    "group.membersAdded": "اعضا اضافه شدند",
    "group.searchUsers": "جستجوی افراد",
    "group.add": "افزودن",
    "group.noPermission": "شما اجازه این کار را ندارید.",
    "group.cannotPost": "فقط ادمین‌ها می‌توانند در این گفتگو پیام بفرستند.",
  },

} as const;

export type TranslationKey = keyof (typeof dictionaries)["en"];

type I18nContextValue = {
  language: Language;
  dir: "rtl" | "ltr";
  t: (key: TranslationKey) => string;
  setLanguage: (next: Language) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function applyDocumentLanguage(language: Language) {
  if (typeof document === "undefined") return;
  const dir = language === "fa" ? "rtl" : "ltr";
  document.documentElement.setAttribute("lang", language);
  document.documentElement.setAttribute("dir", dir);
}

const isLanguage = (value: unknown): value is Language => value === "fa" || value === "en";
const userKey = (userId: string) => `${STORAGE_KEY}.${userId}`;

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const userIdRef = useRef<string | null>(null);
  // Bumped on every local choice so a slower database read can never overwrite it.
  const versionRef = useRef(0);

  const apply = useCallback((next: Language) => {
    setLanguageState(next);
    applyDocumentLanguage(next);
  }, []);

  // Account language is the single source of truth. Device/browser language is never read.
  useEffect(() => {
    let cancelled = false;

    const syncForUser = async (userId: string | null) => {
      userIdRef.current = userId;
      if (!userId) {
        const last = localStorage.getItem(STORAGE_KEY);
        apply(isLanguage(last) ? last : "en");
        return;
      }
      // Instant: this account's last known language on this device (no flash of a wrong language).
      const cached = localStorage.getItem(userKey(userId));
      if (isLanguage(cached)) apply(cached);
      const version = versionRef.current;
      const { data: row, error } = await supabase.from("profiles").select("language").eq("id", userId).maybeSingle();
      if (cancelled || error || userIdRef.current !== userId || versionRef.current !== version) return;
      const remote = (row as { language?: string | null } | null)?.language;
      const resolved: Language = isLanguage(remote) ? remote : "en";
      if (!isLanguage(remote) && row) {
        void supabase.from("profiles").update({ language: "en" }).eq("id", userId);
      }
      localStorage.setItem(userKey(userId), resolved);
      localStorage.setItem(STORAGE_KEY, resolved);
      apply(resolved);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) void syncForUser(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const id = session?.user.id ?? null;
      if (event === "SIGNED_IN" && id === userIdRef.current) return;
      setTimeout(() => void syncForUser(id), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [apply]);

  const setLanguage = useCallback(
    (next: Language) => {
      versionRef.current += 1;
      apply(next);
      localStorage.setItem(STORAGE_KEY, next);
      const userId = userIdRef.current;
      if (!userId) return;
      localStorage.setItem(userKey(userId), next);
      void supabase
        .from("profiles")
        .update({ language: next })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error("Failed to save language", error);
        });
    },
    [apply],
  );

  const t = useCallback(
    (key: TranslationKey) => dictionaries[language][key] ?? dictionaries.en[key] ?? key,
    [language],
  );

  const value = useMemo(
    () => ({ language, dir: (language === "fa" ? "rtl" : "ltr") as "rtl" | "ltr", t, setLanguage }),
    [language, t, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
