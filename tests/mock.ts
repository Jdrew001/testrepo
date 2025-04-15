// Mock implementation of IGenericStrategyInterface
const mockGenericStrategy: IGenericStrategyInterface = {
    // Services
    validatorService: jasmine.createSpyObj('ValidatorRegistryService', ['register', 'validate']),
    commonReferenceService: jasmine.createSpyObj('ICommonReference', ['getReference']),
    dependencyHandlerService: jasmine.createSpyObj('IDependencyHandler', ['registerDependencies']),
    fieldRegistry: jasmine.createSpyObj('IFieldRegistry', ['register', 'get']),
    commonHttpService: jasmine.createSpyObj('ICommonHttpService', ['makeRequest']),
    
    // Properties
    id: 'test-field-123',
    control: jasmine.createSpyObj('AbstractControl', ['setValue', 'updateValueAndValidity']),
    formGroup: jasmine.createSpyObj('FormGroup', ['get', 'addControl']),
    component: { fieldType: 'text' },
    rootId: 'root-123',
    entityId: 'entity-456',
    data: { defaultValue: 'test' },
    rowId: 'row-789',
    config: { 
      visible: true, 
      required: false,
      disabled: false
    },
    
    // Methods
    getUniqueRowId: jasmine.createSpy('getUniqueRowId').and.returnValue('row-789'),
    dependency: jasmine.createSpy('dependency').and.returnValue([]),
    refData: jasmine.createSpy('refData').and.returnValue({ referenceData: [] }),
    validators: jasmine.createSpy('validators').and.returnValue([]),
    libraryConfig: jasmine.createSpy('libraryConfig').and.returnValue({ entityType: 'test' }),
    setLibraryConfig: jasmine.createSpy('setLibraryConfig'),
    
    createControl: jasmine.createSpy('createControl').and.returnValue(
      jasmine.createSpyObj('AbstractControl', ['setValue', 'updateValueAndValidity'])
    ),
    dataInitialized: jasmine.createSpy('dataInitialized'),
    getFormGroupRawValue: jasmine.createSpy('getFormGroupRawValue').and.returnValue({ fieldValue: 'test' }),
    updateValueAndValidity: jasmine.createSpy('updateValueAndValidity'),
    updateValidators: jasmine.createSpy('updateValidators'),
    getValue: jasmine.createSpy('getValue').and.returnValue('test-value'),
    setValue: jasmine.createSpy('setValue'),
    patchValue: jasmine.createSpy('patchValue'),
    getErrors: jasmine.createSpy('getErrors').and.returnValue(null),
    isValid: jasmine.createSpy('isValid').and.returnValue(true),
    updateEnableDisableState: jasmine.createSpy('updateEnableDisableState'),
    enable: jasmine.createSpy('enable'),
    disable: jasmine.createSpy('disable'),
    editable: jasmine.createSpy('editable').and.returnValue(true),
    isRequired: jasmine.createSpy('isRequired').and.returnValue(false),
    applyBehavior: jasmine.createSpy('applyBehavior')
  };