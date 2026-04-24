import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ziadyahya.moneynote',
  appName: 'موني نوت',
  webDir: 'dist',

  // ═══════════════════════════════════════
  //  السبلاش سكرين
  // ═══════════════════════════════════════
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchFadeOutDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#657370',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    // ═══════════════════════════════════════
    //  شريط الحالة
    // ═══════════════════════════════════════
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#657370',
      overlaysWebView: false,
    },

    // ═══════════════════════════════════════
    //  الكاميرا
    // ═══════════════════════════════════════
    Camera: {
      permissions: ['camera'],
    },

    // ═══════════════════════════════════════
    //  الحافظة (Clipboard)
    // ═══════════════════════════════════════
    Clipboard: {},
  },

  // ═══════════════════════════════════════
  //  إعدادات الأندرويد
  // ═══════════════════════════════════════
  android: {
    // اتجاه الشاشة عمودي فقط
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,

    // منع الـ overscroll (bounce effect)
    overScrollMode: 'never',

    // لون الخلفية أثناء التحميل
    backgroundColor: '#657370',

    // الـ minSdk و targetSdk
    minSdkVersion: 24,
    targetSdkVersion: 34,
  },

  // ═══════════════════════════════════════
  //  إعدادات الـ Server (للـ dev فقط)
  // ═══════════════════════════════════════
  server: {
    // في الـ production يكون التطبيق أوفلاين بالكامل
    // السطر ده بس للـ live reload أثناء التطوير
    // احذفه أو علق عليه قبل البناء النهائي
    // url: 'http://192.168.x.x:8080',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;