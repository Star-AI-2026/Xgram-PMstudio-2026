# Test Testpmstudio

یک پیام‌رسان مدرن و حرفه‌ای به نام Xgram بساز که از نظر تجربه کاربری و مجموعه قابلیت‌ها مشابه پیام‌رسان‌های حرفه‌ای مثل Telegram باشد، اما طراحی، هویت بصری، لوگو و رابط کاربری آن اختصاصی و متعلق به Xgram باشد. از کپی مستقیم لوگو، تصاویر، متن‌ها یا کدهای اختصاصی Telegram استفاده نکن.

1. هدف پروژه

Xgram یک پیام‌رسان کامل، سریع، مدرن و Responsive باشد که روی موبایل، تبلت و دسکتاپ به‌خوبی کار کند.

ظاهر برنامه باید حرفه‌ای، تمیز و مدرن باشد و حس یک پیام‌رسان واقعی و آماده استفاده را منتقل کند، نه یک Demo ساده.

نام برنامه در همه قسمت‌های اصلی:
Xgram

2. صفحات اصلی

این صفحات را ایجاد کن:

صفحه ورود / Login

ثبت‌نام / Sign Up

تأیید شماره تلفن یا ایمیل

صفحه اصلی پیام‌ها

صفحه چت خصوصی

صفحه گروه‌ها

صفحه کانال‌ها

صفحه مخاطبین

صفحه پروفایل

صفحه تنظیمات

صفحه جستجو

صفحه تماس صوتی

صفحه تماس تصویری

صفحه مدیریت گروه

صفحه مدیریت کانال

صفحه Media / Files

صفحه اعلان‌ها

3. صفحه اصلی Xgram

صفحه اصلی یک Layout شبیه پیام‌رسان‌های مدرن داشته باشد:

Sidebar

در سمت چپ:

لوگوی Xgram

Search

All Chats

Unread

Personal

Groups

Channels

Saved Messages

Contacts

Settings

لیست گفتگوها شامل:

عکس پروفایل

نام کاربر

آخرین پیام

زمان آخرین پیام

تعداد پیام‌های خوانده‌نشده

نشان Verified در صورت تأیید حساب

Pin

Mute

Archive

باشد.

4. صفحه Chat

صفحه چت باید بسیار حرفه‌ای باشد.

Header:

عکس پروفایل

نام کاربر

وضعیت Online / Last Seen

دکمه تماس صوتی

دکمه تماس تصویری

دکمه Search

منوی More

قسمت پیام‌ها:

پیام‌های ارسال‌شده

پیام‌های دریافت‌شده

Timestamp

وضعیت ارسال

Single Check

Double Check

Read status

Reply

Forward

Edit

Delete

Copy

Pin

React

Select multiple messages

Message Composer:

Emoji

Attachment

Photo

Video

File

Voice Message

GIF

Sticker

Send

امکان ارسال پیام با Enter و رفتن به خط بعد با Shift+Enter وجود داشته باشد.

5. امکانات پیام‌ها

این قابلیت‌ها را پیاده‌سازی کن:

ارسال پیام متنی

ویرایش پیام

حذف پیام

حذف برای خود

حذف برای همه

Reply

Forward

Copy

Pin

Unpin

React

Message Search

Message Selection

Multi-select

Reply Preview

Link Preview

Hashtag

Mention

Message Timestamp

Read / Unread

Typing Indicator

Online Indicator

برای پیام‌های صوتی:

ضبط صدا

نمایش Waveform

Play / Pause

مدت زمان

سرعت پخش

6. ارسال فایل و رسانه

امکان ارسال:

عکس

ویدئو

فایل

PDF

ZIP

APK

MP3

سایر فایل‌ها

وجود داشته باشد.

برای عکس و ویدئو:

Preview

Upload Progress

Cancel Upload

Download

Fullscreen Viewer

اضافه کن.

7. پروفایل کاربر

هر کاربر دارای:

Username

Display Name

Profile Picture

Bio

Phone Number

Online Status

Last Seen

Verified Badge

باشد.

امکان:

Edit Profile

Change Username

Change Profile Picture

Change Bio

Privacy Settings

وجود داشته باشد.

8. Groups

سیستم گروه کامل بساز.

امکانات:

Create Group

Group Name

Group Photo

Group Description

Add Members

Remove Members

Admins

Owner

Permissions

Mute

Pin Message

Group Search

Invite Link

Member List

سطح دسترسی‌ها:

Owner

Admin

Member

باشد.

مدیر بتواند مشخص کند کاربران اجازه ارسال پیام، رسانه، فایل، لینک و تغییر اطلاعات گروه را داشته باشند یا نه.

9. Channels

سیستم کانال ایجاد کن.

امکانات:

Create Channel

Public Channel

Private Channel

Channel Username

Channel Description

Channel Photo

Subscribers

Admins

Post Messages

Pin Posts

Reactions

Views Counter

Share

Forward

باشد.

10. Contacts

صفحه Contacts شامل:

لیست مخاطبین

Search

Add Contact

Invite Friends

Start New Chat

باشد.

11. Search

یک سیستم Search حرفه‌ای ایجاد کن که بتواند بین:

Users

Chats

Groups

Channels

Messages

Files

جستجو کند.

نتایج به صورت لحظه‌ای نمایش داده شوند.

12. تماس صوتی و تصویری

ساختار تماس Voice Call و Video Call را طراحی کن.

امکانات:

Calling

Incoming Call

Accept

Reject

End Call

Mute

Speaker

Camera On/Off

Microphone On/Off

Switch Camera

اگر Backend فعلی امکان تماس واقعی را ندارد، UI و ساختار API/WebRTC را به شکلی آماده کن که بعداً بتوان WebRTC را به آن متصل کرد.

13. Notifications

سیستم اعلان ایجاد کن:

New Message

Mention

Reply

Group Message

Channel Post

Incoming Call

و امکان:

Enable/Disable Notifications

Mute Chat

Mute Group

Mute Channel

وجود داشته باشد.

14. Settings

صفحه Settings حرفه‌ای ایجاد کن.

بخش‌ها:

Account

Profile

Username

Phone

Email

Privacy

Last Seen

Profile Photo

Phone Number

Calls

Groups

Blocked Users

Notifications

Message Notifications

Group Notifications

Channel Notifications

Sound

Preview

Appearance

Light Mode

Dark Mode

System Theme

Accent Color

Font Size

Chat Background

Data

Storage Usage

Cache

Auto Download

Network Usage

Security

Password

Two-Factor Authentication

Active Sessions

Login History

15. Saved Messages

بخش Saved Messages ایجاد کن.

کاربر بتواند پیام‌ها، فایل‌ها، عکس‌ها و لینک‌های مهم را برای خودش ذخیره کند.

16. Dark Mode

Dark Mode باید کاملاً حرفه‌ای باشد.

از رنگ‌های مدرن و خوانا استفاده کن.

Theme سیستم نیز پشتیبانی شود:

Light

Dark

System

17. Responsive Design

Xgram باید کاملاً Responsive باشد.

Desktop:

Sidebar + Chat + Details

Tablet:

Sidebar + Chat

Mobile:

Chat List

Chat

Navigation مناسب موبایل

هیچ قسمت UI نباید در موبایل خراب یا خارج از صفحه شود.

18. طراحی UI

طراحی را از Telegram کپی نکن؛ اما از الگوهای استاندارد پیام‌رسان‌های حرفه‌ای الهام بگیر.

هویت بصری اختصاصی Xgram ایجاد کن.

ویژگی‌های طراحی:

Modern

Minimal

Fast

Smooth

Professional

Rounded Cards

Subtle Shadows

Smooth Animations

Glass/Blur فقط در جاهایی که مناسب است

Micro Interactions

لوگوی Xgram را نیز به صورت اختصاصی طراحی کن.

19. Backend و Database

اگر پروژه از Backend استفاده می‌کند، ساختار واقعی برای ذخیره اطلاعات ایجاد کن.

مدل‌های اصلی:

users

profiles

contacts

chats

chat_members

messages

message_reactions

groups

group_members

channels

channel_members

files

media

notifications

sessions

calls

ارتباط بین جداول را به شکل صحیح طراحی کن.

20. Authentication

سیستم Authentication واقعی ایجاد کن.

شامل:

Sign Up

Login

Logout

Session Management

Password Hashing

Email/Phone Verification

Forgot Password

Reset Password

باشد.

اطلاعات حساس هرگز نباید در Frontend یا Local Storage به شکل ناامن ذخیره شوند.

21. Real-time Messaging

سیستم پیام‌رسانی را به صورت Real-Time طراحی کن.

وقتی یک کاربر پیام ارسال می‌کند، کاربر دیگر باید بدون Refresh پیام را دریافت کند.

پشتیبانی از:

Real-time Messages

Typing Status

Online Status

Read Status

Message Updates

Message Deletion

را در نظر بگیر.

22. امنیت

امنیت Xgram بسیار مهم است.

موارد زیر را رعایت کن:

Authentication امن

Authorization

Input Validation

XSS Protection

CSRF Protection

Rate Limiting

Secure File Upload

Permission Checks

Access Control

Secure Sessions

کاربر نباید بتواند با تغییر Frontend به اطلاعات خصوصی کاربران دیگر دسترسی پیدا کند.

23. Performance

برنامه باید سریع باشد.

از:

Lazy Loading

Pagination

Infinite Scroll

Image Optimization

Caching

Debouncing Search

Virtualized Message List

استفاده کن.

24. Seed Data

برای اینکه هنگام اجرای اولیه برنامه خالی نباشد، چند حساب Demo، چند Chat، چند Group و چند Channel ایجاد کن.

اما ساختار را طوری بساز که بعداً بتوان این داده‌های Demo را حذف کرد.

25. UX

کاربر باید بتواند:

ثبت‌نام کند

وارد حساب شود

مخاطب پیدا کند

چت جدید ایجاد کند

پیام ارسال کند

فایل ارسال کند

گروه بسازد

کانال بسازد

پروفایل خود را تغییر دهد

تنظیمات را تغییر دهد

بدون اینکه نیاز به Refresh صفحه داشته باشد.

26. PWA

Xgram را به صورت PWA نیز آماده کن.

شامل:

Manifest

App Icon

Installable App

Offline Shell

Responsive Mobile UI

باشد.

27. کیفیت نهایی

مهم:

من یک Prototype ساده نمی‌خواهم.

Xgram باید از ابتدا با ساختار قابل توسعه طراحی شود و کدها Modular و تمیز باشند.

Componentها را قابل استفاده مجدد بساز.

از Hard-code کردن داده‌ها تا حد امکان خودداری کن.

تمام دکمه‌ها و منوها باید واقعاً کار کنند یا اگر Backend یک قابلیت هنوز پیاده‌سازی نشده، آن قسمت را با ساختار آماده برای اتصال Backend بساز.

در پایان پروژه:

هیچ صفحه‌ای ناقص نباشد.

هیچ Button بی‌دلیل بدون عملکرد نباشد.

Navigation کامل باشد.

Mobile و Desktop هر دو تست شوند.

Loading State

Empty State

Error State

Success State

برای قسمت‌های مختلف ایجاد شود.

نام نهایی محصول:
Xgram Messenger

این پروژه را با معماری تمیز، UI حرفه‌ای، Responsive Design و ساختار قابل توسعه پیاده‌سازی کن.

This project was built with PMstudio

**Live app**

## Build with Lovable

Continue developing this project in the 

- **Ship faster**: describe what you want to build and  handles the code.
- **Stay in sync**: every change made in  is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into , ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Environment variables

Copy `.env.example` to `.env` and fill in your own Supabase project values. Never commit `.env` or service-role secrets to a public repository.
