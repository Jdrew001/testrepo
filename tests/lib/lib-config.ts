import { InjectionToken } from "@angular/core";

export interface UILibraryConfig {
  uiLibrary: UILibrary;
  environment: any;
}

export enum UILibrary { 
  NG = 'NG',
  ICC = 'ICC'
}

export const UI_LIBRARY_CONFIG = new InjectionToken<UILibraryConfig>('UI_LIBRARY_CONFIG');
export const ENVIRONMENT = new InjectionToken<any>('environment');