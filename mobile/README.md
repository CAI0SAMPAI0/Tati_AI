# 📱 Teacher Tatiana AI — Mobile App (Flutter)

Aplicativo mobile oficial da plataforma Teacher Tatiana AI desenvolvido em **Flutter** com alta performance nativa (120 FPS), suporte a gravação de áudio do microfone para o Chat de Voz e notificações push em segundo plano via Firebase Cloud Messaging (FCM).

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
1. **Flutter SDK** instalado ([Guia de instalação](https://docs.flutter.dev/get-started/install/windows)).
2. Celular Android conectado via USB (com Depuração USB ativada) ou Emulador Android.

### 1. Baixar as dependências
Abra o terminal dentro da pasta `mobile/`:
```bash
cd mobile
flutter pub get
```

### 2. Rodar no celular ou emulador (Modo Desenvolvimento)
```bash
flutter run
```

---

## 📦 Como Gerar o APK de Produção (Release)

Para gerar o arquivo `.apk` final para instalar nos celulares dos alunos:

```bash
flutter build apk --release
```

O arquivo compilado estará pronto em:
📂 `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 🔔 Configuração do Firebase Cloud Messaging (Push Notifications)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Adicione um app Android com o pacote: `com.tatiana.tatiapp`.
3. Baixe o arquivo `google-services.json` e coloque dentro de:
   📂 `mobile/android/app/google-services.json`.

---

## 🎯 Vantagens em relação ao Capacitor / Java:
* **Microfone Nativo:** Áudio e pronúncia sem bloqueios de permissão do navegador.
* **120 FPS:** Renderização fluida via GPU com `InAppWebView`.
* **Push em Background:** Acorda o celular mesmo com tela bloqueada e app fechado.
* **Multiplataforma:** O mesmo projeto pode gerar versão para iPhone (iOS) no futuro.

