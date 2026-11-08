# راه‌اندازی Xgram روی GitHub Pages

## تغییرات این نسخه
- برنامه به یک React SPA استاتیک تبدیل شده و دیگر برای اجرای نسخه اصلی به Nitro/Cloudflare SSR نیاز ندارد.
- مسیر پایه برای مخزن `Xgram-PMstudio-2026` تنظیم شده است.
- مسیرهای ورود، چت، مخاطبین، پروفایل و تنظیمات در سمت مرورگر مدیریت می‌شوند.
- فایل `404.html` از `index.html` ساخته می‌شود تا مسیرهای داخلی در GitHub Pages پس از Refresh باز شوند.
- کدهای قبلی پنل مدیریت در `legacy-admin-routes/` نگه داشته شده‌اند و در نسخه عمومی Pages ثبت/منتشر نمی‌شوند؛ توابع مدیریتی سمت سرور روی GitHub Pages قابل اجرا نیستند.
- کش IndexedDB پیام‌ها و فهرست گفتگوها حفظ شده است.

## Secrets ضروری در GitHub
در Repository → Settings → Secrets and variables → Actions این دو Repository secret را اضافه کنید:

- `VITE_SUPABASE_URL` = آدرس پروژه Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` = کلید Publishable/anon پروژه Supabase

کلید `service_role` یا `sb_secret_...` را هرگز در متغیرهای `VITE_`، کد مرورگر یا GitHub Pages قرار ندهید.

اختیاری برای تماس‌های صوتی/تصویری، اگر از TURN استفاده می‌کنید:
- `VITE_TURN_URLS`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

## انتشار
پس از ثبت Secrets، تمام فایل‌های این ZIP را در ریشه مخزن GitHub جایگزین کنید و Commit کنید. Workflow با هر Push به شاخه `main` اجرا می‌شود.

آدرس مورد انتظار Pages: `https://star-ai-2026.github.io/Xgram-PMstudio-2026/`

## نکات مهم
- برای کارکرد ورود با Google/OAuth، آدرس GitHub Pages را در تنظیمات Supabase Auth → URL Configuration و Redirect URLs مجاز کنید.
- در Supabase، RLS باید برای جدول‌ها و Storage فعال و سیاست‌ها درست تنظیم شده باشند.
- پنل مدیریت قدیمی در این نسخه‌ی استاتیک فعال نیست؛ چون به توابع امن سمت سرور و نشست مدیریتی نیاز دارد.
- این پروژه در محیط فعلی Build نهایی نشده است؛ پس از Push، نتیجه‌ی GitHub Actions را بررسی کنید.
