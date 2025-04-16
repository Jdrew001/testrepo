@NgModule({ // Show usages & Drew Atkison
    declarations: [
    ],
    imports: [
      CommonModule,
      CiaPrimingModule,
      FormsModule,
      ReactiveFormsModule,
      CiaLogModule,
      SharedBaseModule
    ],
    providers: [
      CommonFormService,
      CommonHttpService,
      CommonReferenceService,
      DependencyHandlerService,
      EventBusService,
      FieldRegistryService,
      ReferenceAdaptorRegistryService,
      ServiceLocator,
      ValidatorRegistryService,
      CommonFacadeService,
      ConditionStrategyFactory,
      BehaviorStrategyFactory,
      LibraryConfigService,
      DynamicDialogService
    ],
    exports: [
      SharedBaseModule
    ]
  })
  export class CiaCommonUIModule { // Show usages & Drew Atkison
    static forRoot(config: UILibraryConfig): ModuleWithProviders<CiaCommonUIModule> {
      return {
        ngModule: CiaCommonUIModule,
        providers: [
          { provide: UI_LIBRARY_CONFIG, useValue: config }
        ]
      }
    }
    
    constructor(injector: Injector) { // no usages & Drew Atkison
      ServiceLocator.setInjector(injector);
    }
  }
  