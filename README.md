# Google нэвтрэлт · Цаг агаар · Supabase

Онлайн хувилбар: <https://boldowen.github.io/ICSI215_Sem7/>

Google-ээр нэвтэрсэн хэрэглэгчийг Supabase (PostgreSQL) өгөгдлийн сангийн `users` хүснэгтэд хадгалж, цаг агаарын мэдээг харуулна.

## Өгөгдлийн сан (Supabase) тохируулах

1. <https://supabase.com> дээр project үүсгэнэ.
2. **SQL Editor** дээр `supabase/schema.sql` файлын агуулгыг ажиллуулна (`users` хүснэгт, RLS, `record_login()` функц үүснэ).
3. **Authentication → Sign In / Providers → Google**-ийг идэвхжүүлж, **Client IDs** талбарт `config.js` дэх `googleClientId`-г бичнэ (Client secret шаардлагагүй).
4. **Project Settings → API**-аас Project URL болон `anon` (publishable) key-г `config.js`-ийн `supabaseUrl`, `supabaseAnonKey`-д бичнэ.
5. Google Cloud Console → OAuth client → **Authorized JavaScript origins**-д `https://boldowen.github.io` болон `http://localhost:5500`-г нэмнэ.

Нэвтрэх үед: Google ID token → `supabase.auth.signInWithIdToken()` (Supabase token-ийн гарын үсэг, audience, nonce-ийг сервер талд шалгана) → `record_login()` функц `users` хүснэгтэд мөр үүсгэх эсвэл `last_login_at`, `login_count`-ийг шинэчилнэ. RLS-ийн улмаас хэрэглэгч зөвхөн өөрийн мөрийг уншина. Хадгалагдсан хэрэглэгчдийг Supabase → **Table Editor → users** дээрээс харна.

## Ажиллуулах

```bash
cd /home/bldoqwer/NUM/2026-2027_Fall/ICSI215/Sem7
python3 -m http.server 5500 --bind localhost
```

`http://127.0.0.1:5500` нь өөр origin тул дээрх localhost хаягаар орно. Popup болон JavaScript callback ашигласан учир Authorized redirect URIs бөглөх шаардлагагүй. Нэвтрэх үед `origin_mismatch` эсвэл `The given origin is not allowed for the given client ID` гарвал Client ID болон origin-оо шалгана. Cloud тохиргооны өөрчлөлт үйлчлэхэд хугацаа шаардагдаж болно.

## Файлууд

- `index.html` — нэвтрэх, хэрэглэгч, цаг агаарын хэсгүүд.
- `styles.css` — өмнөх цаг агаарын хуудасны загвар, нэвтрэх хэсгийн ижил загвар.
- `config.js` — Google Client ID, OpenWeatherMap API түлхүүр, Supabase URL болон anon key.
- `db.js` — Supabase холболт, нэвтэрсэн хэрэглэгчийг `users` хүснэгтэд хадгалах.
- `supabase/schema.sql` — хүснэгт, RLS policy, `record_login()` функц.
- `auth.js` — Google Identity Services товч, JWT payload унших, хэрэглэгч харуулах, гарах үйлдэл.
- `weather.js` — өмнөх хот хайх, одоогийн болон ойрын 24 цагийн мэдээний код.

Нэвтэрсний дараа хотын нэр бичээд санал болгосон жагсаалтаас сонгоно. Гарын дээш/доош сум болон Enter ашиглаж болно. Өмнөх `../weather/index.html` файлыг өөрчлөөгүй.

## Google нэвтрэлт хэрхэн ажилладаг вэ?

1. `https://accounts.google.com/gsi/client` санг ачаална.
2. `google.accounts.id.initialize()`-д Client ID болон callback дамжуулна.
3. `renderButton()` Google-ийн нэвтрэх товчийг үүсгэнэ.
4. Хэрэглэгч зөвшөөрсний дараа callback-д `credential` буюу JWT ID token ирнэ.
5. Payload доторх `name`, `email`, `picture`, `sub` мэдээллийг хуудсанд харуулна.

Энэ нь сервергүй сургалтын frontend жишээ. JWT payload тайлах нь гарын үсгийг баталгаажуулахгүй; цаг агаарын хэсгийг нуух нь серверийн эрхийн хамгаалалт биш. Бодит системд ID token-ийг backend рүү HTTPS-ээр илгээж Google-ийн сангаар гарын үсэг, audience, issuer, хугацааг баталгаажуулсны дараа session үүсгэнэ. Энэ жишээнд token, profile-ийг browser storage-д хадгалахгүй тул хуудсыг шинэчлэхэд дахин нэвтэрнэ. Client secret ашиглахгүй.

## Асуултын хариу

**API гэж юу вэ?**

API (Application Programming Interface) нь программууд хоорондоо харилцах дүрэм, боломжуудыг тодорхойлсон интерфейс. Веб API-д програм HTTP хүсэлт явуулж өгөгдөл авдаг. Энэ хуудсанд OpenWeatherMap API руу хотын нэр эсвэл координат явуулж температур, чийгшил, салхи, урьдчилсан мэдээ авна. Google Identity Services API-аар нэвтрэх үйлдлийг гүйцэтгэнэ.

**JSON гэж юу вэ?**

JSON (JavaScript Object Notation) нь өгөгдлийг текстээр солилцох формат. Объект нь түлхүүр–утгын хосуудаас бүрдэх бөгөөд массив, string, number, boolean, null утгыг дэмжинэ. JSON нь JavaScript код биш; түлхүүр болон string утгыг давхар хашилтаар бичдэг.

```json
{
  "city": "Улаанбаатар",
  "temperature": 5,
  "cloudy": false
}
```

Цаг агаарын API JSON хариу буцаана. `response.json()` түүнийг JavaScript өгөгдөл болгон тайлна.

**XML гэж юу вэ?**

XML (Extensible Markup Language) нь өгөгдлийг нэрлэсэн таг болон атрибутаар шаталсан бүтэцтэй илэрхийлэх текст формат. Өөрийн тагийн нэрийг тодорхойлж болно. Дээрх өгөгдлийг XML-ээр:

```xml
<weather>
  <city>Улаанбаатар</city>
  <temperature unit="celsius">5</temperature>
  <cloudy>false</cloudy>
</weather>
```

JSON болон XML хоёулаа өгөгдөл дамжуулах, хадгалах формат. JSON нь объект, массивтай өгөгдөлд авсаархан; XML нь таг, атрибут, namespace ашиглан бүтэц илэрхийлдэг. Энэ даалгаврын код JSON ашиглана.

## Эх сурвалж

- [Google Identity Services тохируулах](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Google JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
- [Сервер дээр ID token баталгаажуулах](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Даалгаварт өгсөн хуучин Google Sign-In заавар](https://developers.google.com/identity/sign-in/web/sign-in) — дэмжлэгээс гарсан тул одоогийн Google Identity Services-ийг ашиглав.
