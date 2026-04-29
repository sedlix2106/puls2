# Подключение звонков LiveKit

Реальные голосовые и видеозвонки между двумя устройствами через WebRTC.

⚠️ **Важно:** в Expo Go звонки работать НЕ БУДУТ. WebRTC требует нативных библиотек, которые нельзя поставить в готовый Expo Go. Нужен **development build** — твой собственный сборка-клиент через EAS.

---

## Шаг 1. Регистрация LiveKit (3 минуты)

1. Открой https://cloud.livekit.io
2. **Sign up** через GitHub или email
3. Подтверди email

---

## Шаг 2. Создание проекта (1 минута)

1. После входа автоматически создастся первый проект, либо нажми **Create Project**
2. Имя: `pulse` (любое)
3. Регион: ближайший к тебе (Frankfurt для России/Европы, US East для Америки)

---

## Шаг 3. Получение ключей (2 минуты)

1. В проекте → **Settings** → **Keys**
2. Нажми **Add Key**
3. Имя ключа: `pulse-app`
4. Появятся:
   - **API Key** (начинается с `API...`)
   - **API Secret** (длинная строка)
5. **Скопируй оба** — Secret больше нельзя будет посмотреть, только сгенерировать новый

Также скопируй **WebSocket URL** проекта — он показан вверху страницы, выглядит как:
```
wss://pulse-xxxxxxx.livekit.cloud
```

---

## Шаг 4. Вставить ключи в проект

Открой `src/livekit/config.js` и замени плейсхолдеры:

```javascript
export const LIVEKIT_CONFIG = {
  url: 'wss://pulse-xxxxxxx.livekit.cloud',  // твой URL
  apiKey: 'APIxxxxxxxxxxxxx',                // твой API Key
  apiSecret: 'твой_секрет_длинная_строка',   // твой API Secret
};
```

---

## Шаг 5. Сборка development build через EAS

Это **один раз** — после этого приложение запускается как обычное.

В терминале в папке проекта:

```bash
npm install
eas login
eas build --platform android --profile development
```

EAS соберёт твой кастомный клиент с поддержкой WebRTC. Через 15–20 минут в консоли Expo появится QR-код и ссылка на APK.

Скачай и установи APK на Android-телефон.

Дальше для разработки запускай:

```bash
npx expo start --dev-client
```

Открой свой APK на телефоне → отсканируй QR-код → приложение откроется как обычно через Expo, но уже со звонками.

### Если у тебя iPhone

```bash
eas build --platform ios --profile development
```

Тут уже нужен Apple Developer аккаунт ($99/год) — это ограничение Apple, не Expo.

Если у тебя есть Mac, можно собирать симулятор бесплатно:

```bash
eas build --platform ios --profile preview
```

---

## Шаг 6. Тестирование звонков

Чтобы проверить, нужны **два устройства**:

1. На каждом — установи свой development build
2. Зарегистрируй два разных аккаунта (например `anna@test.com` и `petr@test.com`)
3. На устройстве 1: открой чат с устройством 2 → нажми кнопку **видеокамеры** в шапке
4. На устройстве 2: должен прийти **входящий звонок** с вибрацией → принять
5. Готово, видишь и слышишь собеседника

---

## Как это работает изнутри

1. **Сигнализация через Firestore** — когда ты нажимаешь «позвонить», в коллекцию `calls` пишется запись `{ from, to, type, status: 'ringing' }`
2. **Слушатель входящих** в `App.js` подписан на `where to == myUid && status == ringing` и показывает экран входящего
3. **При accept** статус меняется на `accepted`, оба клиента подключаются к одной комнате LiveKit
4. **WebRTC соединение** идёт напрямую между устройствами через серверы LiveKit (TURN/SFU), сам звонок не идёт через Firestore

---

## Что про токены и production

В файле `src/livekit/token.js` JWT генерируется на клиенте — это значит **API Secret лежит в приложении**. На production это плохо: кто-то может декомпилировать APK и получить ключ.

Правильный путь на production:

1. Поднять **Cloud Function** в Firebase или маленький Node.js-сервер
2. Сервер хранит API Secret и принимает запросы вида `POST /token` с проверкой авторизации Firebase
3. Сервер возвращает уже готовый токен на 6 часов
4. На клиенте удалить `apiSecret` из кода

LiveKit показывает примеры таких функций в их документации: https://docs.livekit.io/home/get-started/authentication/

Для разработки и для тестирования с друзьями — текущий вариант **полностью работает**.

---

## Бесплатные лимиты LiveKit Cloud

- **50 000 минут участников** в месяц бесплатно
- Это значит: 1 час разговора между двумя людьми = 120 минут участников
- То есть бесплатно можно говорить **~400 часов в месяц**

Этого с запасом для пет-проекта.

---

## Если что-то не работает

**«Permission denied: Camera/Microphone»** → Android: Настройки → Приложения → Pulse → Разрешения. iOS: Настройки → Pulse → Камера / Микрофон.

**«WebSocket failed to connect»** → проверь URL в `config.js`, должен начинаться с `wss://`

**«Invalid token»** → проверь API Key и API Secret, они должны быть из одного и того же ключа в LiveKit Console

**«Cannot find module @livekit/react-native-webrtc»** → ты запустил приложение через обычный Expo Go вместо development build. Установи development build (см. Шаг 5).

**Звонок принят но не слышно собеседника** → перезапусти оба устройства. Это бывает на первом запуске после установки — Android иногда не инициализирует аудио-сессию.

**Видеозвонок открывается только на одной стороне** → проверь Firebase Firestore Rules. Должна быть разрешена коллекция `calls`. Добавь в правила:

```javascript
match /calls/{callId} {
  allow read, write: if request.auth != null
    && (request.auth.uid == resource.data.from
        || request.auth.uid == resource.data.to);
  allow create: if request.auth != null
    && request.auth.uid == request.resource.data.from;
}
```

---

## Что осталось до полного production

1. ✅ Чат — работает
2. ✅ Звонки — работает (с development build)
3. ❌ Push-уведомления — когда приложение **закрыто**, входящий звонок не покажется. Решается через Firebase Cloud Messaging + Expo Notifications
4. ❌ История звонков в Firestore — пока mock
5. ❌ Сервер генерации токенов LiveKit — на production обязателен
6. ❌ Картинки и файлы в чате — добавляется через Firebase Storage

Если хочешь — подключим следующий пункт. Самый важный для повседневного использования это push-уведомления.
