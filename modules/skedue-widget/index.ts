import { NativeModules } from 'react-native';

const { SkedueWidgetNative } = NativeModules;

export async function writeWidgetData(json: string): Promise<void> {
  await SkedueWidgetNative.writeWidgetData(json);
}

export async function requestGlanceUpdate(): Promise<void> {
  await SkedueWidgetNative.requestGlanceUpdate();
}
