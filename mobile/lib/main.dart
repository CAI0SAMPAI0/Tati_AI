import 'dart:async';
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

// ── BACKGROUND FCM HANDLER ──────────────────────────────────────────
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}

// ── NOTIFICATION PLUGIN ──────────────────────────────────────────────
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

  final String appUrl = "https://tati-ai.vercel.app";
  final String backendApiUrl = "https://caio007-tati-ai-backend.hf.space/api/v1";

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
  }

  Future<void> _initPermissionsAndPush() async {
    await Permission.notification.request();
    await Permission.microphone.request();

    try {
      fcmToken = await FirebaseMessaging.instance.getToken();
      debugPrint('[FCM] Token do Dispositivo: $fcmToken');

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
                ),
                onWebViewCreated: (controller) {
                  webViewController = controller;

                  // Handler para Login Google Nativo (Abre modal do Android)
                  controller.addJavaScriptHandler(
                    handlerName: 'googleLogin',
                    callback: (args) async {
                      try {
                        debugPrint('[Google Login] Abrindo modal nativo de contas do Android...');
                        final GoogleSignIn googleSignIn = GoogleSignIn(
                          scopes: ['email', 'profile'],
                        );

                        // Abre o modal nativo com as contas do celular
                        final GoogleSignInAccount? account = await googleSignIn.signIn();
                        if (account != null) {
                          debugPrint('[Google Login] Conta selecionada: ${account.email}');
                          final GoogleSignInAuthentication auth = await account.authentication;
                          final String? tokenToSend = auth.idToken ?? auth.accessToken;

                          if (tokenToSend != null) {
                            debugPrint('[Google Login] Token obtido, enviando ao backend...');
                            final response = await http.post(
                              Uri.parse("$backendApiUrl/auth/google"),
                              headers: {"Content-Type": "application/json"},
                              body: jsonEncode({"credential": tokenToSend}),
                            );

                            if (response.statusCode == 200) {
                              final data = jsonDecode(response.body);
                              final token = data['access_token'];
                              final user = data['user'];

                              debugPrint('[Google Login] Sucesso! Injetando sessão no WebView.');

                              // Injeta no localStorage e redireciona
                              await controller.evaluateJavascript(source: """
                                localStorage.setItem('token', '$token');
                                localStorage.setItem('user', '${jsonEncode(user)}');
                                document.cookie = 'token=$token; path=/; max-age=2592000; SameSite=Lax';
                                window.location.href = '/chat';
                              """);

                              if (user != null && user['username'] != null) {
                                _syncTokenWithBackend(user['username'], token);
                              }

                              return {"success": true};
                            } else {
                              debugPrint('[Google Login] Erro no backend: ${response.body}');
                            }
                          }
                        }
                      } catch (e) {
                        debugPrint('[Google Login] Erro ao abrir modal nativo: $e');
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

                    // Interceptação direta apenas quando o clique é no botão do Google
                    document.addEventListener('mousedown', function(e) {
                      var target = e.target;
                      while (target && target !== document) {
                        // Verifica se o elemento clicado (ou seus pais) é um botão e contém "Google"
                        if ((target.tagName === 'BUTTON' || target.getAttribute('role') === 'button') &&
                            target.innerText && target.innerText.toLowerCase().includes('google')) {
                          console.log('[Bridge] Google Login Clicked');
                          window.flutter_inappwebview.callHandler('googleLogin');
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        target = target.parentNode;
                      }
                    }, true);

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
