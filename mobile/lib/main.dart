import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:http/http.dart' as http;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

//    BACKGROUND FCM HANDLER                                           
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}

//    NOTIFICATION PLUGIN                                               
final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

const AndroidNotificationChannel notificationChannel = AndroidNotificationChannel(
  'tati_ai_channel',
  'Teacher Tatiana Notifications',
  description: 'Notifications for new activities, streak alerts and study updates',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Trava orientação em retrato para melhor usabilidade
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Inicializa o Firebase
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('[Firebase] Init notice: $e');
  }

  // Inicializa o canal de notificações local do Android
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/launcher_icon');

  const InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
  );

  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      final String? payload = response.payload;
      if (payload != null && payload.isNotEmpty) {
        TatiAppScreen.navigateToRoute(payload);
      }
    },
  );

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(notificationChannel);

  runApp(const TatiApp());
}

class TatiApp extends StatelessWidget {
  const TatiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Teacher Tatiana AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F1015),
        primaryColor: const Color(0xFF8B5CF6),
      ),
      home: const TatiAppScreen(),
    );
  }
}

class TatiAppScreen extends StatefulWidget {
  const TatiAppScreen({super.key});

  static void Function(String route)? onNavigate;

  static void navigateToRoute(String route) {
    onNavigate?.call(route);
  }

  @override
  State<TatiAppScreen> createState() => _TatiAppScreenState();
}

class _TatiAppScreenState extends State<TatiAppScreen> {
  InAppWebViewController? webViewController;
  double loadingProgress = 0;
  bool isPageLoaded = false;
  String? fcmToken;

  static const int localVersionCode = 2;
  static const String localVersionName = "1.0.1";

  // Modo dev: falso por padrão para o APK de produção
  static const bool isDevMode = bool.fromEnvironment('DEV_MODE', defaultValue: false);

  // Frontend URL: em dev aponta para o Railway; em produção para Vercel
  final String appUrl = const String.fromEnvironment(
    'APP_URL',
    defaultValue: isDevMode
        ? "https://stunning-tranquility-production-4c54.up.railway.app"
        : "https://tati-ai.vercel.app",
  );

  // Backend API URL: em dev aponta para o Railway; em produção para HF Space
  final String backendApiUrl = const String.fromEnvironment(
    'BACKEND_API_URL',
    defaultValue: isDevMode
        ? "https://cheerful-surprise-production-f539.up.railway.app/api/v1"
        : "https://caio007-tati-ai-backend.hf.space/api/v1",
  );

  @override
  void initState() {
    super.initState();
    TatiAppScreen.onNavigate = (route) {
      if (webViewController != null) {
        final target = route.startsWith('/') ? "$appUrl$route" : route;
        webViewController?.loadUrl(urlRequest: URLRequest(url: WebUri(target)));
      }
    };
    _initPermissionsAndPush();
    // Verifica se há atualização disponível em segundo plano após 2 segundos
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) _checkForAppUpdate();
    });
  }

  Future<void> _checkForAppUpdate() async {
    try {
      final response = await http
          .get(Uri.parse("$appUrl/downloads/version.json"))
          .timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final int remoteVersionCode = data['versionCode'] ?? 0;
        final String remoteVersionName = data['version'] ?? '';
        final String downloadUrl =
            data['downloadUrl'] ?? "$appUrl/downloads/tati-ai.apk";
        final String changelog = data['changelog'] ??
            'Uma nova versão do Teacher Tatiana AI está disponível com melhorias e correções.';
        final bool forceUpdate = data['forceUpdate'] ?? false;

        if (remoteVersionCode > localVersionCode && mounted) {
          showDialog(
            context: context,
            barrierDismissible: !forceUpdate,
            builder: (ctx) => WillPopScope(
              onWillPop: () async => !forceUpdate,
              child: AlertDialog(
                backgroundColor: const Color(0xFF181A20),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                title: Row(
                  children: [
                    const Icon(Icons.system_update_rounded,
                        color: Color(0xFF8B5CF6), size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Nova Versão ($remoteVersionName)',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Há uma atualização recomendada para o seu aplicativo:',
                      style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF262A34),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        changelog,
                        style: const TextStyle(
                            color: Color(0xFFE5E7EB), fontSize: 13),
                      ),
                    ),
                  ],
                ),
                actions: [
                  if (!forceUpdate)
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Depois',
                          style: TextStyle(color: Color(0xFF9CA3AF))),
                    ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () async {
                      try {
                        await InAppBrowser.openWithSystemBrowser(url: WebUri(downloadUrl));
                      } catch (e) {
                        webViewController?.loadUrl(urlRequest: URLRequest(url: WebUri(downloadUrl)));
                      }
                      if (!forceUpdate && mounted) {
                        Navigator.of(ctx).pop();
                      }
                    },
                    child: const Text('Atualizar Agora'),
                  ),
                ],
              ),
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('[Update Check] Verificação de versão: $e');
    }
  }

  Future<void> _initPermissionsAndPush() async {
    await Permission.notification.request();
    await Permission.microphone.request();

    try {
      fcmToken = await FirebaseMessaging.instance.getToken();
      debugPrint('[FCM] Token do Dispositivo: $fcmToken');

      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        fcmToken = newToken;
        debugPrint('[FCM] Token renovado pelo Firebase: $fcmToken');
      });

      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        RemoteNotification? notification = message.notification;
        Map<String, dynamic> data = message.data;

        if (notification != null) {
          flutterLocalNotificationsPlugin.show(
            notification.hashCode,
            notification.title,
            notification.body,
            NotificationDetails(
              android: AndroidNotificationDetails(
                notificationChannel.id,
                notificationChannel.name,
                channelDescription: notificationChannel.description,
                icon: '@mipmap/launcher_icon',
                importance: Importance.max,
                priority: Priority.high,
                playSound: true,
              ),
            ),
            payload: data['url'] ?? '/activities',
          );
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final targetUrl = message.data['url'];
        if (targetUrl != null) {
          TatiAppScreen.navigateToRoute(targetUrl);
        }
      });
    } catch (e) {
      debugPrint('[FCM] Setup notice: $e');
    }
  }

  Future<void> _syncTokenWithBackend(String username, String token) async {
    if (fcmToken == null) return;
    try {
      await http.post(
        Uri.parse("$backendApiUrl/notifications/subscribe"),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "endpoint": "fcm:$fcmToken",
          "p256dh": "fcm",
          "auth": "fcm",
          "user_agent": "TatiAI Flutter Android App",
        }),
      );
      debugPrint('[FCM] Token sincronizado com sucesso para: $username');
    } catch (err) {
      debugPrint('[FCM] Erro ao sincronizar token: $err');
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        if (webViewController != null && await webViewController!.canGoBack()) {
          webViewController!.goBack();
          return false;
        }
        return true;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0F1015),
        body: SafeArea(
          child: Stack(
            children: [
              InAppWebView(
                initialUrlRequest: URLRequest(url: WebUri(appUrl)),
                initialUserScripts: UnmodifiableListView([
                  UserScript(
                    source: """
                      window.isFlutterApp = true;
                      window.tatiAppVersion = '1.0.1';
                      window.tatiAppVersionCode = 2;
                    """,
                    injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
                  ),
                ]),
                initialSettings: InAppWebViewSettings(
                  javaScriptEnabled: true,
                  domStorageEnabled: true,
                  databaseEnabled: true,
                  supportZoom: false,
                  allowsInlineMediaPlayback: true,
                  mediaPlaybackRequiresUserGesture: false,
                  useHybridComposition: true,
                  transparentBackground: true,
                  saveFormData: true,
                  sharedCookiesEnabled: true,
                  useOnDownloadStart: true,
                  useShouldOverrideUrlLoading: true,
                  allowFileAccessFromFileURLs: true,
                  allowUniversalAccessFromFileURLs: true,
                  javaScriptCanOpenWindowsAutomatically: true,
                  supportMultipleWindows: true,
                ),
                onCreateWindow: (controller, createWindowAction) async {
                  final uri = createWindowAction.request.url;
                  if (uri != null) {
                    try {
                      await InAppBrowser.openWithSystemBrowser(url: uri);
                    } catch (e) {
                      debugPrint('[onCreateWindow] Erro ao abrir no navegador: $e');
                    }
                    return true;
                  }
                  return false;
                },
                onWebViewCreated: (controller) {
                  webViewController = controller;

                  // Handler para Login Google Nativo (Abre modal do Android)
                  controller.addJavaScriptHandler(
                    handlerName: 'googleLogin',
                    callback: (args) async {
                      try {
                        debugPrint('[Google Login] Abrindo modal nativo de contas do Android...');
                        final GoogleSignIn googleSignIn = GoogleSignIn(
                          serverClientId: '180033452403-sdrigagekhqpi9l937fpg3knkfgjgf1p.apps.googleusercontent.com',
                          scopes: ['email', 'profile'],
                        );

                        // Abre o modal nativo com as contas do celular
                        final GoogleSignInAccount? account = await googleSignIn.signIn();
                        if (account != null) {
                          debugPrint('[Google Login] Conta selecionada: ${account.email}');
                          final GoogleSignInAuthentication auth = await account.authentication;
                          
                          String? tokenToSend = auth.idToken ?? auth.accessToken;

                          if (tokenToSend != null) {
                            debugPrint('[Google Login] Token obtido, enviando ao backend...');
                            var response = await http.post(
                              Uri.parse("$backendApiUrl/auth/google"),
                              headers: {"Content-Type": "application/json"},
                              body: jsonEncode({"credential": tokenToSend}),
                            );

                            // Se idToken falhou (ex: audience mismatch), tenta com accessToken como fallback
                            if (response.statusCode != 200 && auth.accessToken != null && auth.accessToken != tokenToSend) {
                              debugPrint('[Google Login] idToken falhou (${response.statusCode}). Tentando com accessToken...');
                              response = await http.post(
                                Uri.parse("$backendApiUrl/auth/google"),
                                headers: {"Content-Type": "application/json"},
                                body: jsonEncode({"credential": auth.accessToken}),
                              );
                            }

                            if (response.statusCode == 200) {
                              final data = jsonDecode(response.body);
                              final token = data['access_token'];
                              final user = data['user'];

                              debugPrint('[Google Login] Sucesso! Injetando sessão no WebView.');

                              // Sincroniza cookies nativos no WebKit
                              try {
                                final cookieManager = CookieManager.instance();
                                await cookieManager.setCookie(
                                  url: WebUri(appUrl),
                                  name: "auth_token",
                                  value: token,
                                  path: "/",
                                  isSecure: true,
                                  sameSite: HTTPCookieSameSitePolicy.LAX,
                                );
                                await cookieManager.setCookie(
                                  url: WebUri(appUrl),
                                  name: "token",
                                  value: token,
                                  path: "/",
                                  isSecure: true,
                                  sameSite: HTTPCookieSameSitePolicy.LAX,
                                );
                              } catch (e) {
                                debugPrint('[Google Login] Aviso ao setar cookie nativo: $e');
                              }

                              // Injeta no localStorage e cookies do document
                              await controller.evaluateJavascript(source: """
                                localStorage.setItem('token', '$token');
                                localStorage.setItem('user', '${jsonEncode(user)}');
                                document.cookie = 'auth_token=$token; path=/; max-age=2592000; SameSite=Lax; Secure';
                                document.cookie = 'token=$token; path=/; max-age=2592000; SameSite=Lax; Secure';
                                window.location.href = '/chat';
                              """);

                              // Garantia defensiva: navegação direta via controller caso o window.location demore
                              Future.delayed(const Duration(milliseconds: 400), () {
                                controller.loadUrl(urlRequest: URLRequest(url: WebUri("$appUrl/chat")));
                              });

                              if (user != null && user['username'] != null) {
                                _syncTokenWithBackend(user['username'], token);
                              }

                              return {"success": true, "token": token, "user": user};
                            } else {
                              debugPrint('[Google Login] Erro no backend: ${response.body}');
                            }
                          }
                        }
                      } catch (e) {
                        debugPrint('[Google Login] Erro no modal nativo ($e). Abrindo tela do Google no WebView...');
                        try {
                          final res = await http.get(
                            Uri.parse("$backendApiUrl/auth/google/url"),
                            headers: {"Accept": "application/json"},
                          );
                          if (res.statusCode == 200) {
                            final data = jsonDecode(res.body);
                            final String? googleAuthUrl = data['url'];
                            if (googleAuthUrl != null) {
                              await controller.loadUrl(urlRequest: URLRequest(url: WebUri(googleAuthUrl)));
                              return {"success": true};
                            }
                          }
                        } catch (_) {}
                        await controller.loadUrl(urlRequest: URLRequest(url: WebUri("$backendApiUrl/auth/google/login")));
                      }
                      return {"success": false};
                    },
                  );

                  controller.addJavaScriptHandler(
                    handlerName: 'onUserLogin',
                    callback: (args) {
                      if (args.isNotEmpty && args[0] is Map) {
                        final data = args[0] as Map;
                        final username = data['username']?.toString() ?? '';
                        final userToken = data['token']?.toString() ?? '';
                        if (username.isNotEmpty && userToken.isNotEmpty) {
                          _syncTokenWithBackend(username, userToken);
                        }
                      }
                    },
                  );

                  // Handler para abrir links/downloads no navegador externo do Android
                  controller.addJavaScriptHandler(
                    handlerName: 'openExternalUrl',
                    callback: (args) async {
                      if (args.isNotEmpty) {
                        String urlToOpen = args[0] is Map
                            ? args[0]['url']?.toString() ?? ''
                            : args[0].toString();
                        if (urlToOpen.isNotEmpty) {
                          if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
                            urlToOpen = '$appUrl${urlToOpen.startsWith('/') ? '' : '/'}$urlToOpen';
                          }
                          debugPrint('[External Link] Abrindo no navegador: $urlToOpen');
                          try {
                            await InAppBrowser.openWithSystemBrowser(url: WebUri(urlToOpen));
                          } catch (e) {
                            debugPrint('[External Link] Erro ao abrir: $e');
                          }
                        }
                      }
                    },
                  );
                },
                onDownloadStartRequest: (controller, downloadStartRequest) async {
                  debugPrint('[Download] Detectado início de download: ${downloadStartRequest.url}');
                  try {
                    await InAppBrowser.openWithSystemBrowser(url: downloadStartRequest.url);
                  } catch (e) {
                    debugPrint('[Download] Erro ao abrir no navegador: $e');
                  }
                },
                shouldOverrideUrlLoading: (controller, navigationAction) async {
                  final uri = navigationAction.request.url;
                  if (uri == null) return NavigationActionPolicy.ALLOW;

                  final urlStr = uri.toString().toLowerCase();

                  // Se for download direto (.apk, .pdf, /downloads/), abre no navegador do celular
                  if (urlStr.endsWith('.apk') ||
                      urlStr.endsWith('.pdf') ||
                      urlStr.contains('/downloads/')) {
                    debugPrint('[Navigation] Redirecionando download para navegador: $uri');
                    await InAppBrowser.openWithSystemBrowser(url: uri);
                    return NavigationActionPolicy.CANCEL;
                  }

                  // Links externos ou esquemas especiais
                  if (urlStr.startsWith('whatsapp:') ||
                      urlStr.startsWith('tel:') ||
                      urlStr.startsWith('mailto:')) {
                    await InAppBrowser.openWithSystemBrowser(url: uri);
                    return NavigationActionPolicy.CANCEL;
                  }

                  return NavigationActionPolicy.ALLOW;
                },
                onPermissionRequest: (controller, request) async {
                  return PermissionResponse(
                    resources: request.resources,
                    action: PermissionResponseAction.GRANT,
                  );
                },
                onProgressChanged: (controller, progress) {
                  setState(() {
                    loadingProgress = progress / 100;
                  });
                },
                onLoadStop: (controller, url) async {
                  setState(() {
                    isPageLoaded = true;
                  });

                  await controller.evaluateJavascript(source: """
                    // Bridge para detectar Flutter e injetar comportamentos
                    window.isFlutterApp = true;
                    window.tatiAppVersion = '1.0.1';
                    window.tatiAppVersionCode = 2;

                    // Intercepta window.open para garantir abertura no navegador do celular
                    var origOpen = window.open;
                    window.open = function(url, target, features) {
                      if (url) {
                        var a = document.createElement('a');
                        a.href = url;
                        if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
                          window.flutter_inappwebview.callHandler('openExternalUrl', a.href);
                          return null;
                        }
                      }
                      return origOpen ? origOpen.apply(window, arguments) : null;
                    };

                    window.addEventListener('storage', function(e) {
                      if (e.key === 'token' && e.newValue) {
                        try {
                          var userStr = localStorage.getItem('user');
                          var userObj = userStr ? JSON.parse(userStr) : {};
                          window.flutter_inappwebview.callHandler('onUserLogin', {
                            username: userObj.username || '',
                            token: e.newValue
                          });
                        } catch(err) {}
                      }
                    });

                    // Sincroniza o token FCM imediatamente ao carregar se já estiver logado
                    try {
                      var storedToken = localStorage.getItem('token');
                      var userStr = localStorage.getItem('user');
                      if (storedToken && userStr) {
                        var userObj = JSON.parse(userStr);
                        if (userObj.username) {
                          window.flutter_inappwebview.callHandler('onUserLogin', {
                            username: userObj.username,
                            token: storedToken
                          });
                        }
                      }
                    } catch(err) {}
                  """);
                },
              ),
              if (loadingProgress < 1.0 && !isPageLoaded)
                LinearProgressIndicator(
                  value: loadingProgress,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF8B5CF6)),
                  minHeight: 2.5,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
