# SmartMarsh — ملفات المشروع الجاهزة لـGitHub

هذا مشروع React + TypeScript + Vite + Tailwind CSS + Recharts، ويشمل كود
المحاكاة وصفحات التطبيق الست وشعار SmartMarsh والاختبارات.

**SIMULATED ASSUMPTIONS, NOT MEASURED PORT DATA.**

الأرقام نتائج محاكاة وليست بيانات مقاسة من ميناء حقيقي.

## 1. رفع الملفات إلى GitHub

1. فكّي ضغط ملف `SmartMarsh-GitHub.zip`.
2. افتحي المجلد الناتج `SmartMarsh`.
3. في GitHub، اختاري **New repository** وأنشئي مستودعًا باسم `smartmarsh`
   أو أي اسم تفضّلينه. يُفضّل أن يكون **Public** عند استخدام GitHub Pages
   على حساب مجاني.
4. داخل المستودع، اختاري **Add file → Upload files**.
5. ارفعي **محتويات مجلد SmartMarsh**، وليس ملف ZIP أو المجلد الخارجي نفسه.
   يجب أن يكون `package.json` و`index.html` ومجلد `src` مباشرة في جذر المستودع.
6. تأكدي من رفع المجلد المخفي `.github` وملف
   `.github/workflows/deploy-pages.yml`، ثم اختاري **Commit changes**.
   إذا لم تظهر الملفات المخفية في جهازك، فعّلي إظهارها من مدير الملفات.

لا ترفعي `node_modules` أو `dist` أو ملفات `.env` أو مجلد `.git`.
هذه النسخة لا تحتاج مفاتيح API أو قاعدة بيانات أو حساب Figma.

## 2. تشغيل الموقع عبر GitHub Pages

رفع الكود وحده لا يجعل الموقع يعمل. لتفعيل رابط الموقع:

1. افتحي المستودع في GitHub.
2. اختاري **Settings → Pages**.
3. ضمن **Build and deployment**، اجعلي **Source = GitHub Actions**.
4. افتحي تبويب **Actions** ثم سير العمل **Deploy SmartMarsh to GitHub Pages**.
5. إذا لزم الأمر، اختاري **Run workflow** ثم **Run workflow** مرة أخرى.
6. بعد نجاحه، يظهر رابط الموقع في **Settings → Pages** وفي بيئة `github-pages`.

غالبًا سيكون الرابط بالشكل:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

استبدلي الأسماء بحسابك ومستودعك. سير العمل مضبوط على الفرع `main`؛
إذا كان فرعك الرئيسي باسم مختلف، عدّلي قائمة `branches` في ملف سير العمل.

تستخدم النسخة مسارات ملفات نسبية، لذلك لا يلزم تغيير إعدادات البناء
عند اختيار اسم مختلف للمستودع. الصفحات الداخلية تستخدم روابط `#`،
ولا تحتاج إعدادات تحويل خاصة بخادم الويب.

النشر يتم داخل حسابك عندما ترفعين الملفات وتفعّلين Pages؛
لا يتم نشر أي شيء في حسابك تلقائيًا من هذه المحادثة.

## 3. التشغيل على جهازك

ثبّتي **Node.js 22.12 أو أحدث**، ثم ثبّتي pnpm:

```sh
npm install -g pnpm@10.34.3
```

افتحي Terminal داخل المجلد الذي يحتوي على `package.json`، ثم نفّذي:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

افتحي الرابط الذي يظهر في الطرفية، وعادةً:

```text
http://localhost:3000
```

## 4. فحص المشروع وبناؤه

```sh
pnpm typecheck
pnpm test
pnpm build
```

ملفات الموقع الجاهزة للاستضافة تُنشأ داخل مجلد `dist`.

لمعاينة نسخة الإنتاج محليًا:

```sh
pnpm preview
```

لمراجعة التنسيق:

```sh
pnpm format --check src tests *.json *.ts
```

اختبارات المتصفح اختيارية. شغّلي خادم التطوير أولًا، ثم افتحي Terminal آخر:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

إذا كان التطبيق يعمل على عنوان آخر، اضبطي `PLAYWRIGHT_BASE_URL`
على عنوان الخادم قبل تشغيل اختبارات المتصفح.

## 5. محتويات المشروع

| الملف أو المجلد                      | الغرض                                 |
| ------------------------------------ | ------------------------------------- |
| `src/App.tsx`                        | التنقل وتشغيل التطبيق                 |
| `src/simulation.ts`                  | محرك المحاكاة الحتمي وحساب المؤشرات   |
| `src/SimulationView.tsx`             | صفحة المحاكاة                         |
| `src/PortScene.tsx`                  | مشهد الميناء وحركة الشاحنات           |
| `src/EventLog.tsx`                   | سجل الأحداث وتصديره                    |
| `src/Analytics.tsx`                  | المؤشرات والرسوم البيانية             |
| `src/TruckData.tsx`                  | جدول الشاحنات وتصدير CSV وExcel       |
| `src/SettingsPage.tsx`               | الإعدادات المحفوظة في المتصفح          |
| `src/Information.tsx`                | النتائج والاستنتاجات والتعريف بالمشروع |
| `src/assets/smartmarsh-logo.jpg`     | شعارك المرفق                          |
| `src/index.css`                      | التصميم والخطوط والألوان               |
| `src/simulation.test.ts`             | اختبارات المحرك والمعادلات             |
| `tests/app.spec.ts`                  | اختبارات واجهة التطبيق                |
| `.github/workflows/deploy-pages.yml` | بناء ونشر GitHub Pages                |
| `SIMULATION.md`                      | شرح هندسي للمعادلات والافتراضات         |

تعمل المحاكاة بالكامل في المتصفح. الإعدادات تُحفظ محليًا فقط،
ولا تتم مشاركة النتائج بين الأجهزة. تحميل الخطوط من Google Fonts
يتطلب اتصالًا بالإنترنت؛ وإذا تعذّر تحميلها، تستخدم الواجهة خطًا بديلًا.

إذا أُوقفت GitHub Actions في حسابك أو كانت Pages غير متاحة لخطة
المستودع، سيظل الكود قابلًا للتشغيل محليًا أو النشر على أي استضافة
مواقع ثابتة تدعم ملفات `dist`.
