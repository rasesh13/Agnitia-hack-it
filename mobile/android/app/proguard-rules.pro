# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Background Runner: its native JS engine looks up these classes by name over JNI,
# so R8 must not remove or rename them.
-keep class io.ionic.android_js_engine.** { *; }
-keep class io.ionic.backgroundrunner.** { *; }

# Capacitor resolves plugin methods and @PermissionCallback/@ActivityCallback handlers
# by name at runtime, so keep every plugin class whole.
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep class com.getcapacitor.** { *; }
-keepattributes *Annotation*
