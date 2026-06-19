const { withAndroidManifest, withAppBuildGradle, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const WIDGET_RECEIVER = {
  $: {
    'android:name': '.widget.SkedueWidgetReceiver',
    'android:label': 'Skedue',
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

const WIDGET_SRC_DIR = path.join(__dirname, 'widget-src');

function copyDirContents(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirContents(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = function withSkedueWidget(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const application = manifest['application']?.[0];

    if (application) {
      if (!application['receiver']) {
        application['receiver'] = [];
      }
      application['receiver'].push(WIDGET_RECEIVER);
    }

    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;
    const depsMarker = 'dependencies {';

    if (contents.includes('glance-appwidget')) {
      return modConfig;
    }

    const idx = contents.indexOf(depsMarker);
    if (idx !== -1) {
      const insertPos = idx + depsMarker.length;
      modConfig.modResults.contents =
        contents.slice(0, insertPos) + '\n    ' + GLANCE_DEPENDENCY + '\n' + contents.slice(insertPos);
    }

    return modConfig;
  });

  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const androidDir = modConfig.modRequest.platformProjectRoot;

      const kotlinSrc = path.join(WIDGET_SRC_DIR, 'kotlin');
      const kotlinDest = path.join(androidDir, 'app', 'src', 'main', 'java');
      copyDirContents(kotlinSrc, kotlinDest);

      const resSrc = path.join(WIDGET_SRC_DIR, 'res');
      const resDest = path.join(androidDir, 'app', 'src', 'main', 'res');
      copyDirContents(resSrc, resDest);

      return modConfig;
    },
  ]);

  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const importLine = 'import com.kenzakigenryu.skedue.widget.SkedueWidgetPackage';

    if (!contents.includes(importLine)) {
      const importIdx = contents.lastIndexOf('import ');
      const importEol = contents.indexOf('\n', importIdx);
      contents = contents.slice(0, importEol + 1) + importLine + '\n' + contents.slice(importEol + 1);
    }

    if (!contents.includes('add(SkedueWidgetPackage())')) {
      const applyLineIdx = contents.indexOf('PackageList(this).packages.apply {');
      if (applyLineIdx !== -1) {
        const lineStart = contents.lastIndexOf('\n', applyLineIdx - 1) + 1;
        const baseIndent = applyLineIdx - lineStart;
        const innerIndent = ' '.repeat(baseIndent + 2);
        const bracePos = contents.indexOf('{', applyLineIdx);
        const insertPos = contents.indexOf('\n', bracePos) + 1;
        contents = contents.slice(0, insertPos) +
          innerIndent + 'add(SkedueWidgetPackage())\n' +
          contents.slice(insertPos);
      }
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  return config;
};
