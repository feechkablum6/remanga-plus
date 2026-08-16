Remanga Plus для Windows
========================

Установленные файлы находятся в папке:

  %LOCALAPPDATA%\Programs\Remanga Plus

Установщик уже выполнил следующие действия:

  1. Установил файлы расширения в папку extension.
  2. Установил встроенные node.exe, parser-server.js, host.js и host.exe.
  3. Зарегистрировал Native Messaging host для Chrome, Edge, Brave, Vivaldi,
     Chromium, Яндекс Браузера и Opera в профиле текущего пользователя Windows.

Остался один ручной шаг в браузере:

  1. Откройте chrome://extensions или edge://extensions.
  2. Включите режим разработчика.
  3. Нажмите «Загрузить распакованное расширение».
  4. Выберите папку:

     %LOCALAPPDATA%\Programs\Remanga Plus\extension

После подключения расширения откройте remanga.org. Когда функции Premium Free
потребуется парсер, расширение автоматически запустит parser-server через
Native Messaging. Вручную запускать parser-server не нужно.

Если Premium Free не работает:

  1. Откройте окно расширения.
  2. Проверьте статус сервиса.
  3. Если parser-server остановлен, нажмите кнопку перезапуска.
  4. После переустановки или перезагрузки расширения обновите вкладку remanga.org.
