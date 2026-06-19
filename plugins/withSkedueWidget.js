const { withAndroidManifest, withAppBuildGradle, withProjectBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Widget receiver definition injected into AndroidManifest.xml
// ---------------------------------------------------------------------------
const WIDGET_RECEIVER = {
  $: {
    'android:name': '.widget.SkedueWidgetReceiver',
    'android:label': 'Skedue',
    'android:exported': 'true',
  },
  'intent-filter': [
    {
      action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
    },
  ],
  'meta-data': [
    {
      $: {
        'android:name': 'android.appwidget.provider',
        'android:resource': '@xml/skedue_widget_info',
      },
    },
  ],
};

const GLANCE_DEPENDENCY = "implementation 'androidx.glance:glance-appwidget:1.1.1'";

// ---------------------------------------------------------------------------
// Helper: recursively copy a directory tree
// ---------------------------------------------------------------------------
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: patch MainApplication.kt to register SkedueWidgetPackage
// ---------------------------------------------------------------------------
function patchMainApplication(mainAppPath) {
  if (!fs.existsSync(mainAppPath)) return;

  let src = fs.readFileSync(mainAppPath, 'utf8');

  const importLine = 'import com.kenzakigenryu.skedue.widget.SkedueWidgetPackage';
  const packageRegistration = 'add(SkedueWidgetPackage())';

  // Inject import if missing
  if (!src.includes(importLine)) {
    // Insert after the last existing import block
    src = src.replace(
      /(import expo\.modules\.ReactNativeHostWrapper\n)/,
      `$1${importLine}\n`
    );
  }

  // Inject package registration if missing
  if (!src.includes(packageRegistration)) {
    src = src.replace(
      /(PackageList\(this\)\.packages\.apply \{\n)/,
      `$1              add(SkedueWidgetPackage())\n`
    );
  }

  fs.writeFileSync(mainAppPath, src, 'utf8');
}

module.exports = function withSkedueWidget(config) {
  // 1. Copy resource files (res/xml and res/layout) into the android project
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidResDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const widgetSrcRes = path.join(projectRoot, 'plugins', 'widget-src', 'res');

      copyDirSync(widgetSrcRes, androidResDir);

      return modConfig;
    },
  ]);

  // 2. Copy Kotlin source files into the android project
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const androidJavaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java'
      );
      const widgetSrcKotlin = path.join(projectRoot, 'plugins', 'widget-src', 'kotlin');

      copyDirSync(widgetSrcKotlin, androidJavaDir);

      return modConfig;
    },
  ]);

  // 3. Inject the widget receiver into AndroidManifest.xml
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const application = manifest['application']?.[0];

    if (application) {
      if (!application['receiver']) {
        application['receiver'] = [];
      }

      // Guard against duplicate injection on repeated prebuild runs
      const alreadyAdded = application['receiver'].some(
        (r) => r.$?.['android:name'] === '.widget.SkedueWidgetReceiver'
      );
      if (!alreadyAdded) {
        application['receiver'].push(WIDGET_RECEIVER);
      }
    }

    return modConfig;
  });

  // 4. Add the Glance dependency and enable Compose in app/build.gradle
  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const depsMarker = 'dependencies {';

    // Inject Glance dependency
    if (!contents.includes('glance-appwidget')) {
      const idx = contents.indexOf(depsMarker);
      if (idx !== -1) {
        const insertPos = idx + depsMarker.length;
        contents =
          contents.slice(0, insertPos) +
          '\n    ' +
          GLANCE_DEPENDENCY +
          '\n' +
          contents.slice(insertPos);
      }
    }

    // Replace old-style apply plugin with plugins DSL block for compose
    // (apply plugin: resolves from buildscript classpath, plugins {} uses project-level pluginManagement)
    const oldComposeApply = 'apply plugin: "org.jetbrains.kotlin.plugin.compose"';
    if (contents.includes(oldComposeApply)) {
      contents = contents.replace(oldComposeApply, '// compose plugin applied via plugins block below');
    }

    // Ensure plugins { id "org.jetbrains.kotlin.plugin.compose" } exists at the top of the file
    if (!contents.includes('id "org.jetbrains.kotlin.plugin.compose"')) {
      const firstApply = contents.indexOf('apply plugin:');
      if (firstApply !== -1) {
        const pluginsBlock = `plugins {\n    id "org.jetbrains.kotlin.plugin.compose"\n}\n\n`;
        contents = contents.slice(0, firstApply) + pluginsBlock + contents.slice(firstApply);
      }
    }

    const androidMarker = 'android {';
    if (!contents.includes('buildFeatures {')) {
      const idx = contents.indexOf(androidMarker);
      if (idx !== -1) {
        const insertPos = idx + androidMarker.length;
        const composeConfig = `
    buildFeatures {
        compose true
    }`;
        contents = contents.slice(0, insertPos) + composeConfig + contents.slice(insertPos);
      }
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 4.5. Add the Kotlin Compose Compiler Plugin to root build.gradle
  // Gradle 8.x requires buildscript {} blocks to appear before plugins {} blocks
  config = withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Remove any existing plugins block that might have been placed before buildscript
    contents = contents.replace(/plugins\s*\{[^}]*org\.jetbrains\.kotlin\.plugin\.compose[^}]*\}\s*\n*/g, '');

    // Inject plugins block right before allprojects (which comes after buildscript)
    const pluginBlock = `plugins {\n    id "org.jetbrains.kotlin.plugin.compose" version "2.1.20" apply false\n}\n\n`;
    const allprojectsMarker = 'allprojects {';
    
    if (!contents.includes('org.jetbrains.kotlin.plugin.compose')) {
      const idx = contents.indexOf(allprojectsMarker);
      if (idx !== -1) {
        contents = contents.slice(0, idx) + pluginBlock + contents.slice(idx);
      }
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 5. Patch MainApplication.kt to register SkedueWidgetPackage
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const mainAppPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'kenzakigenryu',
        'skedue',
        'MainApplication.kt'
      );
      patchMainApplication(mainAppPath);
      return modConfig;
    },
  ]);

  return config;
};
